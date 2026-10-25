import { getClient, MODEL, friendlyAiError, readJsonOutput } from './aiClient.js';

// NFR-1.4: AI bullet generation may take up to 15 seconds. This is a hard
// wall-clock budget for the whole call, retries included.
export const AI_DEADLINE_MS = 15_000;

// Three named fields rather than a 3-item array, because the API can't
// enforce array length but can enforce required properties.
const BULLET_OPTIONS_SCHEMA = {
  type: 'object',
  properties: {
    impact: { type: 'string', description: 'Rewrite focused on outcome and impact.' },
    skills: { type: 'string', description: 'Rewrite focused on technical skills and tools.' },
    keywords: { type: 'string', description: 'Rewrite that works in job-posting keywords the evidence supports.' },
  },
  required: ['impact', 'skills', 'keywords'],
  additionalProperties: false,
};

// FR-5.2: generate 3 AI-improved options for a bullet, grounded in the job's
// requirements and the resume's own evidence (so it doesn't invent skills).
export async function generateBulletOptions({ bulletText, jobTitle, jobRequirements, resumeEvidence }) {
  const anthropic = getClient();
  let message;
  try {
    message = await anthropic.messages.create(
      {
        model: MODEL,
        max_tokens: 4096,
        // Low effort keeps latency well inside the 15s budget; this is a short rewrite.
        output_config: { effort: 'low', format: { type: 'json_schema', schema: BULLET_OPTIONS_SCHEMA } },
        system:
          'You rewrite a single resume bullet to be stronger and more tailored to a target job, using only facts ' +
          'already present in the provided resume evidence. Never claim a skill, tool, employer, or outcome that is ' +
          'not backed by the evidence — that is a hallucination and is not acceptable, even if it would match the job better.\n\n' +
          'Rules:\n' +
          '- Use a job requirement only if the evidence already describes that skill in other words.\n' +
          '- Do not name any company, product, client, or tool that the evidence does not name.\n' +
          '- If a number would help but none is in the evidence, write a placeholder like [X%] or [number] ' +
          'so the user fills in the real figure. Never invent a metric.\n' +
          '- Start each option with a strong action verb (Built, Developed, Led, Automated, Designed).\n' +
          '- Keep each option to one line, under about 25 words.\n' +
          '- Each option is only the bullet text itself: no notes, advice, or parenthetical comments to the user.\n' +
          '- Make the 3 options different: one focused on impact, one on technical skills, one on job-posting keywords.',
        messages: [
          {
            role: 'user',
            content:
              `Target job: ${jobTitle || '(untitled role)'}\n` +
              `Job requirements to tailor toward: ${jobRequirements.join(', ') || '(none provided)'}\n\n` +
              `Resume evidence (the only facts you may draw on):\n${resumeEvidence}\n\n` +
              `Original bullet to improve:\n"${bulletText}"`,
          },
        ],
      },
      // The signal caps the total time including the SDK's retry; the per-request
      // timeout alone would allow timeout x (retries + 1).
      { timeout: AI_DEADLINE_MS, maxRetries: 1, signal: AbortSignal.timeout(AI_DEADLINE_MS) }
    );
  } catch (err) {
    throw friendlyAiError(err);
  }

  const parsed = readJsonOutput(message, 'bullet');
  const options = [...new Set([parsed.impact, parsed.skills, parsed.keywords].map((s) => (typeof s === 'string' ? s.trim() : '')).filter(Boolean))];
  if (!options.length) throw new Error('The AI did not return any options. Please try again.');
  return options;
}

// ---------------------------------------------------------------------------
// FR-5.2 validation: an option may only use skills, names (employers, clients,
// tools) and numbers that already appear in the resume. Anything else is a
// likely hallucination and is reported as an issue.
// ---------------------------------------------------------------------------

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Word boundaries that also work for terms like "C++", "C#" or ".NET", where \b fails.
const containsTerm = (haystack, term) => new RegExp(`(?<![\\w])${escapeRe(term)}(?![\\w])`, 'i').test(haystack);

// "[X%]", "[number]" — placeholders the user must fill in; they are not claims.
const PLACEHOLDER_RE = /\[[^\]]*\]/g;
export const hasPlaceholder = (text) => /\[[^\]]*\]/.test(text);

// 40%, $1.2M, 3x, 10k, 2,000+, 2023 … → the numeric core ("40", "1.2", "2000").
const NUMBER_RE = /\d[\d,]*(?:\.\d+)?/g;
const numbersIn = (text) => new Set((text.match(NUMBER_RE) || []).map((n) => n.replace(/,/g, '').replace(/\.0+$/, '')));

// Tokens that look like a proper noun or a tool: capitalized/uppercase words
// after the first word ("Google", "AWS", "Kubernetes"), or words with
// tech punctuation/digits ("Node.js", "C#", "S3").
function nameLikeTokens(text) {
  const words = text.split(/[\s/]+/).map((w) => w.replace(/^[("'“‘]+|[)"'”’,;:!?]+$|\.+$/g, '')).filter(Boolean);
  return words.filter((w, i) => {
    if (!/[A-Za-z]/.test(w)) return false;
    if (/[+#]|\w\.\w|[A-Za-z]\d|\d[A-Za-z]/.test(w)) return !/^\d+[a-z]{1,2}$/i.test(w); // skip "3x", "10k", "5th"
    return i > 0 && /^[A-Z]/.test(w);
  });
}

// Returns [{ type: 'skill' | 'name' | 'metric', term }] for one piece of text.
export function findUnsupportedClaims(text, { resumeText, jobKeywords = [] }) {
  const evidence = resumeText || '';
  const body = text.replace(PLACEHOLDER_RE, ' ');
  const issues = [];
  const seen = new Set();
  const add = (type, term) => {
    const key = term.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    issues.push({ type, term });
  };

  for (const kw of jobKeywords) {
    const k = (kw || '').trim();
    if (k && containsTerm(body, k) && !containsTerm(evidence, k)) add('skill', k);
  }

  for (const tok of nameLikeTokens(body)) {
    if (seen.has(tok.toLowerCase())) continue;
    const singular = tok.replace(/'?s$/i, '');
    if (containsTerm(evidence, tok) || (singular.length > 1 && containsTerm(evidence, singular))) continue;
    add('name', tok);
  }

  const known = numbersIn(evidence);
  for (const n of numbersIn(body)) {
    if (!known.has(n)) add('metric', n);
  }

  return issues;
}

// Annotates each AI option with the claims it makes that the resume doesn't back.
export function validateOptions(options, { resumeText, originalBullet, jobKeywords }) {
  const evidence = `${resumeText}\n${originalBullet || ''}`;
  return options.map((text) => {
    const issues = findUnsupportedClaims(text, { resumeText: evidence, jobKeywords });
    return { text, flagged: issues.length > 0, issues };
  });
}
