import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { computeMatch } from '../lib/atsMatch.js';
import { generateBulletOptions, flagHallucinations } from '../lib/bulletEnhance.js';
import { renderResumePdf } from '../lib/generatePdf.js';

const router = Router();
router.use(requireAuth);

function serializeAnalysis(row) {
  return {
    id: row.id,
    resumeId: row.resume_id,
    jobPostingId: row.job_posting_id,
    status: row.status,
    score: row.score,
    matchedKeywords: row.matched_keywords,
    missingCritical: row.missing_critical,
    missingSecondary: row.missing_secondary,
    weakKeywords: row.weak_keywords,
    recommendations: row.recommendations,
    error: row.error,
    createdAt: row.created_at,
  };
}

async function ownedResume(id, userId) {
  const { rows } = await query('SELECT * FROM resumes WHERE id = $1 AND user_id = $2', [id, userId]);
  return rows[0];
}
async function ownedJobPosting(id, userId) {
  const { rows } = await query('SELECT * FROM job_postings WHERE id = $1 AND user_id = $2', [id, userId]);
  return rows[0];
}
async function ownedAnalysis(id, userId) {
  const { rows } = await query(
    `SELECT analyses.* FROM analyses
     JOIN resumes ON resumes.id = analyses.resume_id
     WHERE analyses.id = $1 AND resumes.user_id = $2`,
    [id, userId]
  );
  return rows[0];
}

router.get('/', async (req, res) => {
  const { rows } = await query(
    `SELECT analyses.* FROM analyses
     JOIN resumes ON resumes.id = analyses.resume_id
     WHERE resumes.user_id = $1 ORDER BY analyses.id DESC`,
    [req.user.id]
  );
  res.json({ analyses: rows.map(serializeAnalysis) });
});

router.get('/:id', async (req, res) => {
  const analysis = await ownedAnalysis(req.params.id, req.user.id);
  if (!analysis) return res.status(404).json({ error: 'Analysis not found.' });
  res.json({ analysis: serializeAnalysis(analysis) });
});

// FR-4.1 / FR-4.2: run the resume-to-job match.
router.post('/', async (req, res) => {
  const { resumeId, jobPostingId } = req.body || {};
  const resume = await ownedResume(resumeId, req.user.id);
  if (!resume) return res.status(404).json({ error: 'Resume not found.' });
  const jobPosting = await ownedJobPosting(jobPostingId, req.user.id);
  if (!jobPosting) return res.status(404).json({ error: 'Job posting not found.' });
  if (!resume.parsed_data) {
    return res.status(422).json({ error: 'This resume could not be structured for matching. Try re-uploading it.' });
  }

  const result = computeMatch(resume.parsed_data, {
    requiredSkills: jobPosting.required_skills,
  });

  const { rows } = await query(
    `INSERT INTO analyses (resume_id, job_posting_id, status, score, matched_keywords, missing_critical, missing_secondary, weak_keywords, recommendations)
     VALUES ($1, $2, 'complete', $3, $4, $5, $6, $7, $8) RETURNING *`,
    [
      resume.id,
      jobPosting.id,
      result.score,
      JSON.stringify(result.matchedKeywords),
      JSON.stringify(result.missingCritical),
      JSON.stringify(result.missingSecondary),
      JSON.stringify(result.weakKeywords),
      JSON.stringify(result.recommendations),
    ]
  );

  res.status(201).json({ analysis: serializeAnalysis(rows[0]) });
});

function findBullet(resume, bulletId) {
  for (const exp of resume.parsed_data?.experience || []) {
    const bullet = (exp.bullets || []).find((b) => b.id === bulletId);
    if (bullet) return { bullet, exp };
  }
  return null;
}

function serializeSuggestion(row) {
  return {
    id: row.id,
    analysisId: row.analysis_id,
    bulletId: row.bullet_id,
    originalText: row.original_text,
    options: row.options,
    selectedIndex: row.selected_index,
    selectedText: row.selected_text,
  };
}

router.get('/:id/bullets', async (req, res) => {
  const analysis = await ownedAnalysis(req.params.id, req.user.id);
  if (!analysis) return res.status(404).json({ error: 'Analysis not found.' });
  const { rows } = await query('SELECT * FROM bullet_suggestions WHERE analysis_id = $1 ORDER BY id', [analysis.id]);
  res.json({ suggestions: rows.map(serializeSuggestion) });
});

// FR-5.1 / FR-5.2: generate 3 AI options for a specific resume bullet.
router.post('/:id/bullets/:bulletId/generate', async (req, res) => {
  const analysis = await ownedAnalysis(req.params.id, req.user.id);
  if (!analysis) return res.status(404).json({ error: 'Analysis not found.' });
  const resume = await ownedResume(analysis.resume_id, req.user.id);
  const jobPosting = await ownedJobPosting(analysis.job_posting_id, req.user.id);

  const found = findBullet(resume, req.params.bulletId);
  if (!found) return res.status(404).json({ error: 'Bullet not found on this resume.' });

  const jobKeywords = [
    ...(jobPosting.required_skills?.critical || []),
    ...(jobPosting.required_skills?.secondary || []),
  ];

  let options;
  try {
    const raw = await generateBulletOptions({
      bulletText: found.bullet.text,
      jobTitle: jobPosting.title,
      jobRequirements: jobKeywords,
      resumeEvidence: resume.extracted_text.slice(0, 6000),
    });
    options = flagHallucinations(raw, jobKeywords, resume.extracted_text);
  } catch (err) {
    // NFR-4.3: AI service unavailable — tell the user, allow manual editing instead.
    return res.status(502).json({ error: err.message || 'The AI service is unavailable right now.', allowManualEdit: true });
  }

  const { rows } = await query(
    `INSERT INTO bullet_suggestions (analysis_id, bullet_id, original_text, options)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (analysis_id, bullet_id) DO UPDATE SET options = EXCLUDED.options, selected_index = NULL, selected_text = NULL
     RETURNING *`,
    [analysis.id, req.params.bulletId, found.bullet.text, JSON.stringify(options)]
  );
  res.status(201).json({ suggestion: serializeSuggestion(rows[0]) });
});

// FR-5.3: pick (or manually edit) the improved bullet and save it.
router.post('/:id/bullets/:bulletId/select', async (req, res) => {
  const analysis = await ownedAnalysis(req.params.id, req.user.id);
  if (!analysis) return res.status(404).json({ error: 'Analysis not found.' });
  const { index, text } = req.body || {};

  const { rows: existingRows } = await query(
    'SELECT * FROM bullet_suggestions WHERE analysis_id = $1 AND bullet_id = $2',
    [analysis.id, req.params.bulletId]
  );
  const existing = existingRows[0];
  if (!existing) return res.status(404).json({ error: 'Generate options for this bullet first.' });

  let selectedText = text;
  if (selectedText == null && Number.isInteger(index)) {
    selectedText = existing.options?.[index]?.text ?? null;
  }
  if (!selectedText) return res.status(400).json({ error: 'Provide a selected option index or edited text.' });

  const { rows } = await query(
    'UPDATE bullet_suggestions SET selected_index = $1, selected_text = $2 WHERE id = $3 RETURNING *',
    [Number.isInteger(index) ? index : null, selectedText, existing.id]
  );
  res.json({ suggestion: serializeSuggestion(rows[0]) });
});

// FR-6.1: export the resume with selected bullet improvements applied.
router.get('/:id/export', async (req, res) => {
  const analysis = await ownedAnalysis(req.params.id, req.user.id);
  if (!analysis) return res.status(404).json({ error: 'Analysis not found.' });
  const resume = await ownedResume(analysis.resume_id, req.user.id);
  if (!resume.parsed_data) return res.status(422).json({ error: 'This resume has no structured data to export.' });

  const { rows } = await query(
    'SELECT bullet_id, selected_text FROM bullet_suggestions WHERE analysis_id = $1 AND selected_text IS NOT NULL',
    [analysis.id]
  );
  const overrides = new Map(rows.map((r) => [r.bullet_id, r.selected_text]));

  const baseName = resume.original_filename.replace(/\.(pdf|docx)$/i, '');
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${baseName}-updated.pdf"`);
  renderResumePdf({ resume: { ...resume.parsed_data, originalFilename: baseName }, bulletOverrides: overrides }, res);
});

export default router;
