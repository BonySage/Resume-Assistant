import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { fetchJobPostingText, parseJobPostingText } from '../lib/jobPosting.js';
import { cleanText } from '../lib/validators.js';

const router = Router();
router.use(requireAuth);

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
  const { rows } = await query('SELECT * FROM job_postings WHERE user_id = $1 ORDER BY id DESC', [req.user.id]);
  res.json({ jobPostings: rows.map(serialize) });
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
router.post('/', async (req, res) => {
  const { url, text } = req.body || {};
  if (!url && !text) {
    return res.status(400).json({ error: 'Provide either a job posting URL or pasted description text.' });
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
      return res.status(422).json({ error: err.message, fallbackToPaste: true });
    }
  } else {
    rawText = cleanText(text);
    if (rawText.length < 50) {
      return res.status(400).json({ error: 'That description looks too short to analyze.' });
    }
  }

  let parsed;
  try {
    parsed = await parseJobPostingText(rawText);
  } catch (err) {
    return res.status(502).json({ error: err.message || 'Could not parse that job posting.' }); // NFR-4.3
  }

  const requiredSkills = { critical: parsed.requiredSkills || [], secondary: parsed.secondarySkills || [] };
  const { rows } = await query(
    `INSERT INTO job_postings (user_id, source_url, raw_text, title, company, description, required_skills, responsibilities)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [
      req.user.id,
      sourceUrl,
      rawText,
      parsed.title || null,
      parsed.company || null,
      parsed.description || rawText.slice(0, 4000),
      JSON.stringify(requiredSkills),
      JSON.stringify(parsed.responsibilities || []),
    ]
  );

  res.status(201).json({ jobPosting: serialize(rows[0]) });
});

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
