import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { computeMatch } from '../lib/atsMatch.js';
import { generateBulletOptions, validateOptions, findUnsupportedClaims, hasPlaceholder } from '../lib/bulletEnhance.js';
import { cleanText } from '../lib/validators.js';
import { renderResumePdf, skillGroupsOf } from '../lib/generatePdf.js';
import { tailorResume } from '../lib/tailorResume.js';

const router = Router();
router.use(requireAuth);

const MAX_BULLET_LENGTH = 300; // matches the editor's limit on the improve page
const MAX_TAILORED_BULLET_LENGTH = 400; // matches the editor's limit on the tailor page
const MAX_SKILLS = 100;
const MAX_SKILL_LENGTH = 60;

// Missing, then weak, keywords. The analysis stores them lowercased, so map
// each back to the job's own spelling ("JavaScript") for the AI to use.
function keywordsToAdd(analysis, jobKeywords) {
  return [...(analysis.missing_critical || []), ...(analysis.missing_secondary || []), ...(analysis.weak_keywords || [])].map(
    (k) => jobKeywords.find((orig) => orig.toLowerCase().trim() === k) || k
  );
}

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
    tailoredSkills: row.tailored_skills, // [{ category, items }], null until a tailored resume is saved
    error: row.error,
    createdAt: row.created_at,
  };
}

async function ownedResume(id, userId) {
  // Skip file_data (the uploaded file, up to 10 MB); nothing here needs it.
  const { rows } = await query(
    'SELECT id, user_id, original_filename, extracted_text, parsed_data FROM resumes WHERE id = $1 AND user_id = $2',
    [id, userId]
  );
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
      // Same picks as the "Job keywords this could show" chips in BulletImprove.jsx.
      targetKeywords: keywordsToAdd(analysis, jobKeywords).slice(0, 3),
      resumeEvidence: resume.extracted_text.slice(0, 6000),
    });
    options = validateOptions(raw, { resumeText: resume.extracted_text, originalBullet: found.bullet.text, jobKeywords });
  } catch (err) {
    // NFR-4.3: AI service unavailable — tell the user, allow manual editing instead.
    return res.status(502).json({ error: err.message || 'The AI service is unavailable right now.', allowManualEdit: true });
  }

  const { rows } = await query(
    `INSERT INTO bullet_suggestions (analysis_id, bullet_id, original_text, options)
     VALUES ($1, $2, $3, $4)
     -- Regenerating must not undo a bullet the user already saved (FR-5.3): keep
     -- selected_text, but the old index no longer points at the same option.
     ON CONFLICT (analysis_id, bullet_id) DO UPDATE SET options = EXCLUDED.options, selected_index = NULL
     RETURNING *`,
    [analysis.id, req.params.bulletId, found.bullet.text, JSON.stringify(options)]
  );
  res.status(201).json({ suggestion: serializeSuggestion(rows[0]) });
});

// FR-5.3: pick (or manually edit) the improved bullet and save it.
router.post('/:id/bullets/:bulletId/select', async (req, res) => {
  const analysis = await ownedAnalysis(req.params.id, req.user.id);
  if (!analysis) return res.status(404).json({ error: 'Analysis not found.' });
  const { index, confirmUnverified } = req.body || {};
  const text = req.body?.text == null ? null : cleanText(req.body.text).replace(/\s+/g, ' ');

  const resume = await ownedResume(analysis.resume_id, req.user.id);
  const found = findBullet(resume, req.params.bulletId);
  if (!found) return res.status(404).json({ error: 'Bullet not found on this resume.' });

  const { rows: existingRows } = await query(
    'SELECT * FROM bullet_suggestions WHERE analysis_id = $1 AND bullet_id = $2',
    [analysis.id, req.params.bulletId]
  );
  let existing = existingRows[0];

  // Resolve what is being saved: an AI option picked as-is, or edited text.
  let option = Number.isInteger(index) ? existing?.options?.[index] : null;
  if (Number.isInteger(index) && !option) return res.status(400).json({ error: 'That option no longer exists. Pick one of the current options.' });
  if (text != null && option && text !== option.text) option = null; // edited, so it's the user's own text now
  const selectedText = option ? option.text : text;

  if (!selectedText) return res.status(400).json({ error: 'The bullet can’t be empty.' });
  if (selectedText.length > MAX_BULLET_LENGTH) {
    return res.status(400).json({ error: `Keep the bullet under ${MAX_BULLET_LENGTH} characters.` });
  }
  if (hasPlaceholder(selectedText)) {
    return res.status(400).json({ error: 'Replace the [placeholder] with your real number or detail before saving.', code: 'PLACEHOLDER' });
  }

  // FR-5.2: an AI option that failed validation can't be saved as-is — the AI
  // must not put a claim on the resume that the resume doesn't back up.
  if (option?.flagged) {
    return res.status(422).json({
      error: 'This option mentions something that isn’t in your resume. Edit it first, or pick another option.',
      code: 'UNVERIFIED_CLAIM',
      issues: option.issues || [],
    });
  }
  // Text the user wrote or edited is theirs to vouch for, but ask them to confirm
  // anything the resume doesn't support (e.g. a leftover AI claim they didn't remove).
  if (!option) {
    const jobPosting = await ownedJobPosting(analysis.job_posting_id, req.user.id);
    const jobKeywords = [...(jobPosting?.required_skills?.critical || []), ...(jobPosting?.required_skills?.secondary || [])];
    const issues = findUnsupportedClaims(selectedText, { resumeText: `${resume.extracted_text}\n${found.bullet.text}`, jobKeywords });
    if (issues.length && confirmUnverified !== true) {
      return res.status(422).json({
        error: 'This bullet mentions something that isn’t in your resume.',
        code: 'UNVERIFIED_CLAIM',
        issues,
        canConfirm: true,
      });
    }
  }

  if (!existing) {
    // NFR-4.3: when AI generation failed, the user can still save a manually edited bullet.
    const { rows: created } = await query(
      `INSERT INTO bullet_suggestions (analysis_id, bullet_id, original_text, options)
       VALUES ($1, $2, $3, '[]') RETURNING *`,
      [analysis.id, req.params.bulletId, found.bullet.text]
    );
    existing = created[0];
  }

  // FR-5.3: the saved text replaces the original bullet in the exported resume.
  const { rows } = await query(
    'UPDATE bullet_suggestions SET selected_index = $1, selected_text = $2 WHERE id = $3 RETURNING *',
    [option ? index : null, selectedText, existing.id]
  );
  res.json({ suggestion: serializeSuggestion(rows[0]) });
});

// Whole-resume tailoring: the 3 versions generated earlier, if any.
router.get('/:id/tailor', async (req, res) => {
  const analysis = await ownedAnalysis(req.params.id, req.user.id);
  if (!analysis) return res.status(404).json({ error: 'Analysis not found.' });
  res.json({ versions: analysis.tailored_options });
});

// Whole-resume tailoring: ask the AI for 3 versions of the skills list and
// every experience/project bullet, each covering all missing keywords.
router.post('/:id/tailor', async (req, res) => {
  const analysis = await ownedAnalysis(req.params.id, req.user.id);
  if (!analysis) return res.status(404).json({ error: 'Analysis not found.' });
  const resume = await ownedResume(analysis.resume_id, req.user.id);
  const jobPosting = await ownedJobPosting(analysis.job_posting_id, req.user.id);
  if (!resume.parsed_data) {
    return res.status(422).json({ error: 'This resume could not be structured for tailoring. Try re-uploading it.' });
  }

  const jobKeywords = [...(jobPosting.required_skills?.critical || []), ...(jobPosting.required_skills?.secondary || [])];
  let versions;
  try {
    versions = await tailorResume({
      parsed: resume.parsed_data,
      resumeText: resume.extracted_text,
      jobTitle: jobPosting.title,
      jobKeywords,
      targetKeywords: keywordsToAdd(analysis, jobKeywords),
    });
  } catch (err) {
    return res.status(502).json({ error: err.message || 'The AI service is unavailable right now.' });
  }

  await query('UPDATE analyses SET tailored_options = $1 WHERE id = $2', [JSON.stringify(versions), analysis.id]);
  res.status(201).json({ versions });
});

// Save the tailored resume the user picked and edited. Bullets go into
// bullet_suggestions (same as one-at-a-time edits), so export picks them up.
router.put('/:id/tailored', async (req, res) => {
  const analysis = await ownedAnalysis(req.params.id, req.user.id);
  if (!analysis) return res.status(404).json({ error: 'Analysis not found.' });
  const resume = await ownedResume(analysis.resume_id, req.user.id);

  const { skillGroups, bullets } = req.body || {};
  if (!Array.isArray(skillGroups) || !Array.isArray(bullets)) {
    return res.status(400).json({ error: 'Send the skills and the bullets to save.' });
  }
  const oneLine = (s) => cleanText(s).replace(/\s+/g, ' ');
  const cleanGroups = skillGroups
    .map((g) => ({ category: oneLine(g?.category), items: [...new Set((Array.isArray(g?.items) ? g.items : []).map(oneLine).filter(Boolean))] }))
    .filter((g) => g.items.length);
  const allSkills = cleanGroups.flatMap((g) => [g.category, ...g.items]);
  if (cleanGroups.flatMap((g) => g.items).length > MAX_SKILLS || allSkills.some((s) => s.length > MAX_SKILL_LENGTH)) {
    return res.status(400).json({ error: `Keep the skills to ${MAX_SKILLS} skills of up to ${MAX_SKILL_LENGTH} characters each.` });
  }

  const ids = [];
  const originals = [];
  const selected = [];
  for (const b of bullets) {
    const found = findBullet(resume, b?.id);
    if (!found) return res.status(400).json({ error: 'One of the bullets isn’t on this resume. Reload the page and try again.' });
    const text = cleanText(b.text).replace(/\s+/g, ' ');
    if (!text) return res.status(400).json({ error: 'A bullet can’t be empty.', bulletId: b.id });
    if (text.length > MAX_TAILORED_BULLET_LENGTH) {
      return res.status(400).json({ error: `Keep each bullet under ${MAX_TAILORED_BULLET_LENGTH} characters.`, bulletId: b.id });
    }
    ids.push(found.bullet.id);
    originals.push(found.bullet.text);
    selected.push(text === found.bullet.text ? null : text); // unchanged = keep the original
  }

  if (ids.length) {
    await query(
      `INSERT INTO bullet_suggestions (analysis_id, bullet_id, original_text, selected_text)
       SELECT $1, * FROM unnest($2::text[], $3::text[], $4::text[])
       ON CONFLICT (analysis_id, bullet_id) DO UPDATE SET selected_text = EXCLUDED.selected_text, selected_index = NULL`,
      [analysis.id, ids, originals, selected]
    );
  }
  const { rows } = await query('UPDATE analyses SET tailored_skills = $1 WHERE id = $2 RETURNING *', [
    JSON.stringify(cleanGroups),
    analysis.id,
  ]);
  res.json({ analysis: serializeAnalysis(rows[0]) });
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
  // Tailored skills (category groups, or a flat list from older saves) replace the originals.
  const tailored = analysis.tailored_skills ? { skillGroups: skillGroupsOf({ skillGroups: analysis.tailored_skills }) } : {};
  const jobPosting = await ownedJobPosting(analysis.job_posting_id, req.user.id);
  const boldTerms = [...(jobPosting?.required_skills?.critical || []), ...(jobPosting?.required_skills?.secondary || [])];
  renderResumePdf({ resume: { ...resume.parsed_data, ...tailored, originalFilename: baseName }, bulletOverrides: overrides, boldTerms }, res);
});

export default router;
