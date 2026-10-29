import { Router } from 'express';
import multer from 'multer';
import { query } from '../db.js';
import { HttpError, badRequest, notFound, unprocessable } from '../errors.js';
import { requireAuth } from '../middleware/auth.js';
import { requireValidId } from '../middleware/idParam.js';
import { userRateLimit } from '../middleware/userRateLimit.js';
import { extractResumeText, matchesFileSignature } from '../lib/parseResume.js';
import { parseResumeStructure } from '../lib/parseResumeStructure.js';
import { cleanFilename } from '../lib/validators.js';

const ALLOWED_MIME = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

const uploadRateLimit = userRateLimit({ limit: 10, message: 'Too many resume uploads. Try again in 15 minutes.' });

// The file is only needed long enough to extract its text, so it stays in
// memory and is never written to disk. Export rebuilds the PDF from parsed_data.
const upload = multer({
  storage: multer.memoryStorage(),
  // FR-2.1: max 10MB. The app sends exactly one part (the file), so anything
  // more (extra fields are otherwise unlimited, 1 MB each, held in memory) is refused.
  limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 0, parts: 1 },
  defParamCharset: 'utf8', // browsers send file names as UTF-8 ("Résumé.pdf"); multer's default is latin1
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      return cb(badRequest('Only PDF or DOCX files are supported.', { code: 'UNSUPPORTED_FILE_TYPE' }));
    }
    cb(null, true);
  },
});

// The upload parser throws plain Errors for a malformed or cut-off request
// ("Malformed part header", "Unexpected end of form"). Those are the client's
// fault, so answer 400 instead of letting them become a 500.
function parseUpload(req, res, next) {
  upload.single('file')(req, res, (err) => {
    if (!err || err instanceof multer.MulterError || err instanceof HttpError) return next(err);
    next(badRequest('That upload could not be read. Try again with a single PDF or DOCX file.', { code: 'MALFORMED_UPLOAD' }));
  });
}

const router = Router();
router.use(requireAuth);
router.param('id', requireValidId('Resume not found.'));

function resumeCounts(parsed) {
  if (!parsed) return { bulletCount: 0, sectionCount: 0 };
  const bulletCount = (parsed.experience || []).reduce((n, exp) => n + (exp.bullets?.length || 0), 0);
  const sectionCount = [
    Object.values(parsed.contactInfo || {}).some(Boolean),
    !!parsed.summary,
    parsed.skills?.length > 0,
    parsed.experience?.length > 0,
    parsed.education?.length > 0,
  ].filter(Boolean).length;
  return { bulletCount, sectionCount };
}

function serializeResume(row, { includeParsed = false } = {}) {
  const out = {
    id: row.id,
    filename: row.original_filename,
    sizeBytes: row.size_bytes,
    createdAt: row.created_at,
    parseError: row.parse_error,
    ...resumeCounts(row.parsed_data), // shown on the dashboard ("Ready · 14 bullets")
  };
  if (includeParsed) out.parsed = row.parsed_data;
  return out;
}

// FR-2.1 + list for the Resume Upload Dashboard
router.get('/', async (req, res) => {
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const offset = (page - 1) * limit;

  // Only what serializeResume needs: extracted_text can be large and the list never shows it.
  const { rows } = await query(
    `SELECT id, original_filename, size_bytes, created_at, parse_error, parsed_data
     FROM resumes WHERE user_id = $1 ORDER BY id DESC LIMIT $2 OFFSET $3`,
    [req.user.id, limit, offset]
  );
  const { rows: countRows } = await query(
    `SELECT COUNT(*) AS total,
            COUNT(*) FILTER (WHERE parse_error IS NULL) AS ready_total
     FROM resumes WHERE user_id = $1`,
    [req.user.id]
  );
  const total = parseInt(countRows[0].total, 10);
  const readyTotal = parseInt(countRows[0].ready_total, 10);
  res.json({ resumes: rows.map((r) => serializeResume(r)), pagination: { page, limit, total, pages: Math.ceil(total / limit), readyTotal } });
});

router.get('/:id', async (req, res) => {
  const { rows } = await query('SELECT * FROM resumes WHERE id = $1 AND user_id = $2', [
    req.params.id,
    req.user.id,
  ]);
  if (!rows[0]) throw notFound('Resume not found.');
  res.json({ resume: serializeResume(rows[0], { includeParsed: true }) });
});

const UNREADABLE = "We couldn't read any text from that file. Try a different PDF or DOCX."; // NFR-4.1

// FR-2.1 upload + FR-2.2 automatic parsing
router.post('/', uploadRateLimit, parseUpload, async (req, res) => {
  if (!req.file) throw badRequest('No file uploaded.', { code: 'NO_FILE' });
  const { buffer, mimetype, originalname, size } = req.file;

  // The browser-supplied MIME type is only a claim; check the file's actual bytes.
  if (!matchesFileSignature(buffer, mimetype)) {
    throw badRequest('That file is not a valid PDF or DOCX.', { code: 'UNSUPPORTED_FILE_TYPE' });
  }

  // A corrupt or password-protected file makes the parser throw. That's the
  // user's file, not a server fault, so answer 422 without exposing the
  // parser's own message. Database errors below still reach the error handler.
  let text;
  try {
    text = await extractResumeText(buffer, mimetype, originalname);
  } catch (err) {
    // Our own size limit: the message is written for the user, so show it.
    if (err.code === 'RESUME_TOO_LONG') throw unprocessable(err.message, { code: err.code });
    console.warn(`[resumes] text extraction failed for user ${req.user.id}: ${err.name || 'Error'}`);
    throw unprocessable(UNREADABLE, { code: 'UNREADABLE_FILE' });
  }
  if (!text || text.length < 20) throw unprocessable(UNREADABLE, { code: 'UNREADABLE_FILE' });

  let parsedData = null;
  let parseError = null;
  try {
    parsedData = await parseResumeStructure(text);
  } catch (err) {
    // NFR-4.1: don't fail the whole upload if structuring fails — keep the raw
    // text so matching can still run, and surface the failure to the user.
    // AI errors are already translated to plain English by friendlyAiError.
    parseError = err.message || 'Could not parse resume structure.';
  }

  const { rows } = await query(
    `INSERT INTO resumes (user_id, original_filename, mime_type, size_bytes, extracted_text, parsed_data, parse_error)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [
      req.user.id,
      cleanFilename(originalname), // stored and shown later, so made safe first
      mimetype,
      size,
      text,
      parsedData ? JSON.stringify(parsedData) : null,
      parseError,
    ]
  );
  res.status(201).json({ resume: serializeResume(rows[0], { includeParsed: true }) });
});

router.delete('/:id', async (req, res) => {
  const { rowCount } = await query('DELETE FROM resumes WHERE id = $1 AND user_id = $2', [
    req.params.id,
    req.user.id,
  ]);
  if (!rowCount) throw notFound('Resume not found.');
  res.json({ ok: true });
});

export default router;
