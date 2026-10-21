import { getClient, MODEL, friendlyAiError, readJsonOutput } from './aiClient.js';
import { findUnsupportedClaims } from './bulletEnhance.js';
import { skillGroupsOf } from './generatePdf.js';

// Rewriting a whole resume takes longer than one bullet, so it gets a larger
// budget. The three versions are requested in parallel, so this is also
// roughly the wall-clock limit for the whole request.
export const TAILOR_DEADLINE_MS = 60_000;

// Each version takes a different angle; all of them must cover every target keyword.
export const TAILOR_STYLES = [
  { key: 'balanced', label: 'Balanced', focus: 'Work the keywords in naturally and keep the candidate’s own voice and structure.' },
  { key: 'impact', label: 'Impact-focused', focus: 'Lead every bullet with the outcome or result; use [X%] / [number] placeholders where a figure would help.' },
  { key: 'keywords', label: 'Keyword-rich', focus: 'Maximize ATS keyword coverage: use the job’s exact terms, and repeat the most important ones across several bullets.' },
];

const TAILORED_SCHEMA = {
  type: 'object',
  properties: {
    skillGroups: {
      type: 'array',
      description:
        'The full skills section in the resume’s own categories: every original skill, plus each target keyword ' +
        'added to the category it fits best, with the most job-relevant skills first in each category.',
      items: {
        type: 'object',
        properties: {
          category: { type: 'string' },
          items: { type: 'array', items: { type: 'string', description: 'One skill keyword of 1–3 words.' } },
        },
        required: ['category', 'items'],
        additionalProperties: false,
      },
    },
    bullets: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'The id of the bullet being rewritten, exactly as given.' },
          text: { type: 'string' },
        },
        required: ['id', 'text'],
        additionalProperties: false,
      },
      description: 'One rewritten bullet for every bullet id in the input.',
    },
  },
  required: ['skillGroups', 'bullets'],
  additionalProperties: false,
};

function resumeOutline(parsed) {
  return (parsed.experience || [])
    .map((exp) => {
      const head = [exp.title, exp.company, exp.dates].filter(Boolean).join(' | ');
      const bullets = (exp.bullets || []).map((b) => `  [${b.id}] ${b.text}`).join('\n');
      return `${head}\n${bullets}`;
    })
    .join('\n\n');
}

async function generateVersion(style, { parsed, resumeText, jobTitle, jobKeywords, targetKeywords }) {
  const anthropic = getClient();
  let message;
  try {
    message = await anthropic.messages.create(
      {
        model: MODEL,
        max_tokens: 8192,
        output_config: { effort: 'low', format: { type: 'json_schema', schema: TAILORED_SCHEMA } },
        system:
          'You tailor a whole resume to a target job: you rewrite its skills list and every experience and project ' +
          'bullet. Use the facts in the resume evidence. Never invent an employer, project, outcome, or metric.\n\n' +
          'Rules:\n' +
          '- Every target keyword must appear in the skills section, and at least once in the bullet where it fits best, ' +
          'spelled as given. Spread them across bullets; do not cram them all into one. The user reviews the result ' +
          'and unsupported keywords are flagged for them.\n' +
          '- Keep the resume’s skill categories and every original skill unless it is a duplicate. Add a new category ' +
          'only if a keyword fits none of the existing ones.\n' +
          '- Return one rewritten bullet for every bullet id, in the same order, with the id copied exactly.\n' +
          '- If a number would help but none is in the evidence, write a placeholder like [X%] or [number].\n' +
          '- Start each bullet with a strong action verb. Keep each to one line, under about 35 words.\n' +
          '- Bullets are only the bullet text: no notes or parenthetical comments to the user.\n' +
          `- Style for this version: ${style.focus}`,
        messages: [
          {
            role: 'user',
            content:
              `Target job: ${jobTitle || '(untitled role)'}\n` +
              `All job keywords: ${jobKeywords.join(', ') || '(none)'}\n` +
              `Target keywords (must all appear): ${targetKeywords.join(', ') || '(none)'}\n\n` +
              `Current skills:\n${skillGroupsOf(parsed).map((g) => `${g.category || 'Skills'}: ${g.items.join(', ')}`).join('\n') || '(none)'}\n\n` +
              `Experience and projects (bullet ids in brackets):\n${resumeOutline(parsed)}\n\n` +
              `Full resume evidence (the only facts you may draw on):\n${resumeText.slice(0, 8000)}`,
          },
        ],
      },
      { timeout: TAILOR_DEADLINE_MS, maxRetries: 1, signal: AbortSignal.timeout(TAILOR_DEADLINE_MS) }
    );
  } catch (err) {
    throw friendlyAiError(err);
  }
  return readJsonOutput(message, 'resume');
}

// Fits one AI version onto the resume's real bullet ids (a missing or unknown
// id falls back to the original text) and flags claims the resume doesn't back.
function shapeVersion(style, raw, { parsed, resumeText, jobKeywords }) {
  const rewritten = new Map((raw.bullets || []).filter((b) => b && typeof b.text === 'string').map((b) => [b.id, b.text.trim()]));
  const evidence = `${resumeText}\n${(parsed.skills || []).join(', ')}`;
  // A flagged keyword like "Generative AI" also yields name flags for its
  // capitalized words ("Generative", "Processing-based"); keep only the keyword itself.
  const keywordWords = new Set(jobKeywords.flatMap((k) => k.toLowerCase().split(/[\s/-]+/)));
  const issuesFor = (text, original) =>
    findUnsupportedClaims(text, { resumeText: `${evidence}\n${original}`, jobKeywords }).filter(
      (i) => i.type !== 'name' || !keywordWords.has(i.term.toLowerCase().split(/[\s/-]+/)[0])
    );

  const sections = (parsed.experience || []).map((exp) => ({
    heading: [exp.title, exp.company].filter(Boolean).join(' · ') || 'Experience',
    dates: exp.dates || '',
    bullets: (exp.bullets || []).map((b) => {
      const text = rewritten.get(b.id) || b.text;
      return { id: b.id, original: b.text, text, issues: issuesFor(text, b.text) };
    }),
  }));

  // Drop blanks and repeats (across categories too), then empty categories.
  const seen = new Set();
  const skillGroups = (raw.skillGroups || [])
    .map((g) => ({
      category: typeof g.category === 'string' ? g.category.trim() : '',
      items: (g.items || [])
        .map((s) => (typeof s === 'string' ? s.trim() : ''))
        .filter((s) => s && !seen.has(s.toLowerCase()) && seen.add(s.toLowerCase())),
    }))
    .filter((g) => g.items.length);

  return { key: style.key, label: style.label, skills: skillGroups.flatMap((g) => g.items), skillGroups, sections };
}

// Returns up to 3 tailored versions of the resume. Fails only if every version fails.
export async function tailorResume({ parsed, resumeText, jobTitle, jobKeywords, targetKeywords }) {
  const input = { parsed, resumeText, jobTitle, jobKeywords, targetKeywords };
  const results = await Promise.allSettled(TAILOR_STYLES.map((style) => generateVersion(style, input)));

  const versions = results
    .map((r, i) => (r.status === 'fulfilled' ? shapeVersion(TAILOR_STYLES[i], r.value, input) : null))
    .filter(Boolean);
  if (!versions.length) {
    throw results.find((r) => r.status === 'rejected')?.reason || new Error('The AI did not return any versions. Please try again.');
  }
  return versions;
}
