import { Router } from 'express';
import multer from 'multer';
import { query } from '../db.js';
import { badRequest, notFound, unprocessable } from '../errors.js';
import { requireAuth } from '../middleware/auth.js';
import { extractResumeText, matchesFileSignature } from '../lib/parseResume.js';
import { parseResumeStructure } from '../lib/parseResumeStructure.js';

const ALLOWED_MIME = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

// The file stays in memory (never written to disk) and is saved in the
// database so the user can open their original. Export still rebuilds the
// PDF from parsed_data.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // FR-2.1: max 10MB
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      return cb(badRequest('Only PDF or DOCX files are supported.', { code: 'UNSUPPORTED_FILE_TYPE' }));
    }
    cb(null, true);
  },
});

const router = Router();
router.use(requireAuth);

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
    hasFile: row.has_file,
    ...resumeCounts(row.parsed_data), // shown on the dashboard ("Ready · 14 bullets")
  };
  if (includeParsed) out.parsed = row.parsed_data;
  return out;
}

// Every column except file_data, which can be up to 10 MB per row and is only
// read by the /file route.
const RESUME_COLUMNS = `id, user_id, original_filename, mime_type, size_bytes, created_at, parsed_data,
  parse_error, file_data IS NOT NULL AS has_file`;

// FR-2.1 + list for the Resume Upload Dashboard
router.get('/', async (req, res) => {
  const { rows } = await query(
    `SELECT ${RESUME_COLUMNS} FROM resumes WHERE user_id = $1 ORDER BY id DESC`,
    [req.user.id]
  );
  res.json({ resumes: rows.map((r) => serializeResume(r)) });
});

router.get('/:id', async (req, res) => {
  const { rows } = await query(`SELECT ${RESUME_COLUMNS} FROM resumes WHERE id = $1 AND user_id = $2`, [
    req.params.id,
    req.user.id,
  ]);
  if (!rows[0]) throw notFound('Resume not found.');
  res.json({ resume: serializeResume(rows[0], { includeParsed: true }) });
});

// The original uploaded file. PDFs open in the browser; DOCX can't be shown
// inline, so it downloads. ?download=1 forces a download for either.
router.get('/:id/file', async (req, res) => {
  const { rows } = await query(
    'SELECT original_filename, mime_type, file_data FROM resumes WHERE id = $1 AND user_id = $2',
    [req.params.id, req.user.id]
  );
  if (!rows[0]) throw notFound('Resume not found.');
  const { original_filename: filename, mime_type: mimeType, file_data: data } = rows[0];
  if (!data) throw notFound('The original file isn’t available for this resume. Upload it again to view it.', { code: 'FILE_NOT_STORED' });

  const inline = mimeType === 'application/pdf' && !req.query.download;
  res.set({
    'Content-Type': mimeType,
    'Content-Length': data.length,
    'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(filename)}`,
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'private, no-store',
  });
  res.send(data);
});

const UNREADABLE = "We couldn't read any text from that file. Try a different PDF or DOCX."; // NFR-4.1

// FR-2.1 upload + FR-2.2 automatic parsing
router.post('/', upload.single('file'), async (req, res) => {
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
    console.warn(`[resumes] text extraction failed for user ${req.user.id}:`, err.message);
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
    `INSERT INTO resumes (user_id, original_filename, mime_type, size_bytes, extracted_text, parsed_data, parse_error, file_data)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING ${RESUME_COLUMNS}`,
    [
      req.user.id,
      originalname,
      mimetype,
      size,
      text,
      parsedData ? JSON.stringify(parsedData) : null,
      parseError,
      buffer,
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
