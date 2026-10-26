import { Router } from 'express';
import { createHash } from 'node:crypto';
import { query } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { requireValidId } from '../middleware/idParam.js';
import { userRateLimit } from '../middleware/userRateLimit.js';
import { fetchJobPostingText, parseJobPostingText } from '../lib/jobPosting.js';
import { cleanText } from '../lib/validators.js';
import { createInFlight } from '../lib/inFlight.js';

const router = Router();
router.use(requireAuth);
router.param('id', requireValidId('Job posting not found.'));
const parseRateLimit = userRateLimit({ limit: 10, message: 'Too many job-posting requests. Try again in 15 minutes.' });
const shareInFlight = createInFlight();

function serialize(row) {
  return {
    id: row.id,
    sourceUrl: row.source_url,
    title: row.title,
    company: row.company,
    description: row.description,
    requiredSkills: row.required_skills, // { critical: [string], secondary: [string] }
    responsibilities: row.responsibilities,
    createdAt: row.created_at,
  };
}

router.get('/', async (req, res) => {
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const offset = (page - 1) * limit;

  const { rows } = await query(
    'SELECT * FROM job_postings WHERE user_id = $1 ORDER BY id DESC LIMIT $2 OFFSET $3',
    [req.user.id, limit, offset]
  );
  const { rows: countRows } = await query(
    'SELECT COUNT(*) AS total FROM job_postings WHERE user_id = $1',
    [req.user.id]
  );
  const total = parseInt(countRows[0].total, 10);
  res.json({ jobPostings: rows.map(serialize), pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
});

router.get('/:id', async (req, res) => {
  const { rows } = await query('SELECT * FROM job_postings WHERE id = $1 AND user_id = $2', [
    req.params.id,
    req.user.id,
  ]);
  if (!rows[0]) return res.status(404).json({ error: 'Job posting not found.' });
  res.json({ jobPosting: serialize(rows[0]) });
});

// FR-3.1 / FR-3.2: accepts either { url } or { text }.
router.post('/', parseRateLimit, async (req, res) => {
  const { url, text } = req.body || {};
  // TESTING.md 3.4: the same posting sent again while the first is still being
  // parsed (a double-click, a second tab) gets that request's answer instead of
  // creating a duplicate job posting. Compared after the same clean-up the
  // posting gets, so spacing and line endings don't make it look different.
  const same = (v, clean) => (typeof v === 'string' ? clean(v) : v ?? null);
  const key = createHash('sha256')
    .update(JSON.stringify([req.user.id, same(url, (u) => u.trim()), same(text, cleanText)]))
    .digest('hex');
  const { status, body } = await shareInFlight(key, () => createJobPosting(req.user.id, { url, text }));
  res.status(status).json(body);
});

// Returns { status, body } for the response, so duplicate requests can share it.
async function createJobPosting(userId, { url, text }) {
  if (!url && !text) {
    return { status: 400, body: { error: 'Provide either a job posting URL or pasted description text.' } };
  }

  let rawText;
  let sourceUrl = null;
  if (url) {
    sourceUrl = url;
    try {
      rawText = await fetchJobPostingText(url);
    } catch (err) {
      // NFR-4.2: surface a clear, actionable message so the frontend can
      // prompt the copy-paste fallback.
      return { status: 422, body: { error: err.message, fallbackToPaste: true } };
    }
  } else {
    rawText = cleanText(text);
    if (rawText.length < 50) {
      return { status: 400, body: { error: 'That description looks too short to analyze.' } };
    }
  }

  let parsed;
  try {
    parsed = await parseJobPostingText(rawText);
  } catch (err) {
    return { status: 502, body: { error: err.message || 'Could not parse that job posting.' } }; // NFR-4.3
  }

  const requiredSkills = { critical: parsed.requiredSkills || [], secondary: parsed.secondarySkills || [] };
  const { rows } = await query(
    `INSERT INTO job_postings (user_id, source_url, raw_text, title, company, description, required_skills, responsibilities)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [
      userId,
      sourceUrl,
      rawText,
      parsed.title || null,
      parsed.company || null,
      parsed.description || rawText.slice(0, 4000),
      JSON.stringify(requiredSkills),
      JSON.stringify(parsed.responsibilities || []),
    ]
  );

  return { status: 201, body: { jobPosting: serialize(rows[0]) } };
}

router.delete('/:id', async (req, res) => {
  const { rows } = await query('SELECT id FROM job_postings WHERE id = $1 AND user_id = $2', [
    req.params.id,
    req.user.id,
  ]);
  if (!rows[0]) return res.status(404).json({ error: 'Job posting not found.' });
  await query('DELETE FROM job_postings WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

export default router;
