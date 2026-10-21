import * as cheerio from 'cheerio';
import { getClient, PARSE_MODEL, friendlyAiError, readJsonOutput } from './aiClient.js';

const URL_FETCH_TIMEOUT_MS = 10_000; // NFR-1.2

// FR-3.1: URL input with automatic extraction; throws on failure so the
// route can respond with a clear prompt to use the copy-paste fallback (NFR-4.2).
export async function fetchJobPostingText(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('That does not look like a valid URL.');
  }
  if (!/^https?:$/.test(parsed.protocol)) {
    throw new Error('Only http/https URLs are supported.');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), URL_FETCH_TIMEOUT_MS);
  let res;
  try {
    res = await fetch(parsed.href, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AIResumeAssistant/1.0)' },
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('Fetching that job posting took too long. Try pasting the description instead.');
    }
    throw new Error("Couldn't reach that URL. Try pasting the description instead.");
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    throw new Error(`That page returned an error (${res.status}). Try pasting the description instead.`);
  }
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) {
    throw new Error("That URL doesn't look like a web page. Try pasting the description instead.");
  }

  const html = await res.text();
  const $ = cheerio.load(html);

  // Many job boards render the posting with JavaScript, so the body is nearly
  // empty, but they embed a schema.org JobPosting for search engines. Read it
  // before the script tags are stripped; it's also cleaner than the page text.
  const structured = jobPostingFromJsonLd($);
  if (structured) return structured;

  const metaDescription = ($('meta[property="og:description"]').attr('content') || $('meta[name="description"]').attr('content') || '').trim();

  $('script, style, noscript, nav, header, footer, svg').remove();
  const text = $('body').text().replace(/[ \t]+/g, ' ').replace(/\n{2,}/g, '\n').trim();

  if (text.length >= 100) return text;
  if (metaDescription.length >= 100) return metaDescription;
  throw new Error("Couldn't find enough text on that page. Try pasting the description instead.");
}

function htmlToText(html) {
  const $ = cheerio.load(`<div>${html}</div>`);
  $('br').replaceWith('\n');
  $('p, li, div, h1, h2, h3, h4').append('\n');
  return $('div').first().text().replace(/[ \t]+/g, ' ').replace(/\n{2,}/g, '\n').trim();
}

// Returns the JobPosting JSON-LD as plain text, or null if there isn't a usable one.
function jobPostingFromJsonLd($) {
  const isJobPosting = (n) => n && typeof n === 'object' && [].concat(n['@type']).includes('JobPosting');
  for (const el of $('script[type="application/ld+json"]').toArray()) {
    let data;
    try {
      data = JSON.parse($(el).contents().text());
    } catch {
      continue;
    }
    const nodes = [].concat(data).flatMap((n) => [n, ...[].concat(n?.['@graph'] || [])]);
    const job = nodes.find(isJobPosting);
    if (!job?.description) continue;

    const field = (label, value) => (value ? `${label}: ${htmlToText([].concat(value).join(', '))}` : '');
    const text = [
      field('Title', job.title),
      field('Company', job.hiringOrganization?.name),
      htmlToText(job.description),
      field('Qualifications', job.qualifications),
      field('Skills', job.skills),
      field('Experience', typeof job.experienceRequirements === 'string' ? job.experienceRequirements : job.experienceRequirements?.description),
    ]
      .filter((s) => typeof s === 'string' && s)
      .join('\n\n');
    if (text.length >= 100) return text;
  }
  return null;
}

// Structured outputs need additionalProperties: false and every field required;
// the model uses "" / [] for anything the posting doesn't state.
const JOB_POSTING_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    company: { type: 'string' },
    description: { type: 'string', description: 'A cleaned-up version of the core job description text.' },
    summary: {
      type: 'string',
      description:
        '2–4 plain sentences for the candidate: what the role is, what they would do day to day, and any ' +
        'eligibility requirements (degree, class year, GPA, location, work authorization).',
    },
    requiredSkills: {
      type: 'array',
      items: { type: 'string', description: 'One keyword of 1–3 words, e.g. "Python", "SQL", "Agile", "Communication".' },
      description: 'Keywords explicitly required or strongly emphasized (critical keywords).',
    },
    secondarySkills: {
      type: 'array',
      items: { type: 'string', description: 'One keyword of 1–3 words, e.g. "Machine Learning", "Generative AI".' },
      description: 'Keywords mentioned as nice-to-have, or implied by responsibilities but not called out as required (secondary keywords).',
    },
    responsibilities: {
      type: 'array',
      items: { type: 'string' },
    },
  },
  required: ['title', 'company', 'description', 'summary', 'requiredSkills', 'secondarySkills', 'responsibilities'],
  additionalProperties: false,
};

// FR-3.2
export async function parseJobPostingText(rawText) {
  const anthropic = getClient();
  let message;
  try {
    message = await anthropic.messages.create({
      model: PARSE_MODEL,
      max_tokens: 8192,
      // Extraction, not reasoning: low effort keeps this fast.
      output_config: { effort: 'low', format: { type: 'json_schema', schema: JOB_POSTING_SCHEMA } },
      system:
        'You parse raw job-posting text (which may include unrelated page chrome from a scraped web page) into ' +
        'structured JSON. Ignore navigation/footer/ad text. Distinguish explicitly required skills (critical) from ' +
        'nice-to-have or implied skills (secondary). Skills are matched word-for-word against resumes, so each one ' +
        'must be a short keyword a resume would contain (1–3 words), never a sentence or requirement: turn ' +
        '"coding experience in JavaScript, Python, or another language" into "JavaScript" and "Python", and ' +
        '"understanding of relational databases and SQL queries" into "Relational Databases" and "SQL". Leave ' +
        'eligibility rules (GPA, class year, enrollment status) out of the skills and mention them in the summary. ' +
        'Use an empty string or empty list for anything not stated.',
      messages: [{ role: 'user', content: `Job posting text:\n\n---\n${rawText.slice(0, 12000)}\n---` }],
    });
  } catch (err) {
    throw friendlyAiError(err);
  }

  const parsed = readJsonOutput(message, 'job posting');
  return {
    ...parsed,
    requiredSkills: keywordsOnly(parsed.requiredSkills),
    secondarySkills: keywordsOnly(parsed.secondarySkills),
  };
}

// Matching counts literal occurrences in the resume, so a sentence-length
// "skill" can never match. Drop any the model returns despite the prompt.
const MAX_KEYWORD_WORDS = 4;
function keywordsOnly(list) {
  return (list || [])
    .map((s) => (typeof s === 'string' ? s.trim() : ''))
    .filter((s) => s && s.split(/\s+/).length <= MAX_KEYWORD_WORDS);
}
