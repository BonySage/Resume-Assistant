import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { query } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { extractResumeText } from '../lib/parseResume.js';
import { parseResumeStructure } from '../lib/parseResumeStructure.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '..', '..', 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_MIME = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => {
      const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
      cb(null, `${req.user.id}-${Date.now()}-${safe}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 }, // FR-2.1: max 10MB
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      return cb(new Error('Only PDF or DOCX files are supported.'));
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
    ...resumeCounts(row.parsed_data), // shown on the dashboard ("Ready · 14 bullets")
  };
  if (includeParsed) out.parsed = row.parsed_data;
  return out;
}

// FR-2.1 + list for the Resume Upload Dashboard
router.get('/', async (req, res) => {
  const { rows } = await query(
    'SELECT * FROM resumes WHERE user_id = $1 ORDER BY id DESC',
    [req.user.id]
  );
  res.json({ resumes: rows.map((r) => serializeResume(r)) });
});

router.get('/:id', async (req, res) => {
  const { rows } = await query('SELECT * FROM resumes WHERE id = $1 AND user_id = $2', [
    req.params.id,
    req.user.id,
  ]);
  if (!rows[0]) return res.status(404).json({ error: 'Resume not found.' });
  res.json({ resume: serializeResume(rows[0], { includeParsed: true }) });
});

// FR-2.1 upload + FR-2.2 automatic parsing
router.post('/', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
  try {
    const buffer = fs.readFileSync(req.file.path);
    const text = await extractResumeText(buffer, req.file.mimetype, req.file.originalname);
    if (!text || text.length < 20) {
      fs.unlinkSync(req.file.path);
      return res.status(422).json({ error: "We couldn't read any text from that file. Try a different PDF or DOCX." }); // NFR-4.1
    }

    let parsedData = null;
    let parseError = null;
    try {
      parsedData = await parseResumeStructure(text);
    } catch (err) {
      // NFR-4.1: don't fail the whole upload if structuring fails — keep the raw
      // text so matching can still run, and surface the failure to the user.
      parseError = err.message || 'Could not parse resume structure.';
    }

    const { rows } = await query(
      `INSERT INTO resumes (user_id, original_filename, mime_type, size_bytes, stored_path, extracted_text, parsed_data, parse_error)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [
        req.user.id,
        req.file.originalname,
        req.file.mimetype,
        req.file.size,
        req.file.path,
        text,
        parsedData ? JSON.stringify(parsedData) : null,
        parseError,
      ]
    );
    res.status(201).json({ resume: serializeResume(rows[0], { includeParsed: true }) });
  } catch (err) {
    if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: err.message || 'Failed to process resume.' });
  }
});

router.delete('/:id', async (req, res) => {
  const { rows } = await query('SELECT * FROM resumes WHERE id = $1 AND user_id = $2', [
    req.params.id,
    req.user.id,
  ]);
  const resume = rows[0];
  if (!resume) return res.status(404).json({ error: 'Resume not found.' });
  await query('DELETE FROM resumes WHERE id = $1', [resume.id]);
  if (fs.existsSync(resume.stored_path)) fs.unlinkSync(resume.stored_path);
  res.json({ ok: true });
});

export default router;
