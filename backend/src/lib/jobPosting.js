import * as cheerio from 'cheerio';
import { getClient, MODEL, friendlyAiError } from './aiClient.js';

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
  $('script, style, noscript, nav, header, footer, svg').remove();
  const text = $('body').text().replace(/[ \t]+/g, ' ').replace(/\n{2,}/g, '\n').trim();

  if (text.length < 100) {
    throw new Error("Couldn't find enough text on that page. Try pasting the description instead.");
  }
  return text;
}

const JOB_POSTING_TOOL = {
  name: 'submit_job_posting',
  description: 'Submit the job posting parsed into structured fields.',
  input_schema: {
    type: 'object',
    properties: {
      title: { type: 'string' },
      company: { type: 'string' },
      description: { type: 'string', description: 'A cleaned-up version of the core job description text.' },
      requiredSkills: {
        type: 'array',
        items: { type: 'string' },
        description: 'Skills/tools/qualifications explicitly required or strongly emphasized (critical keywords).',
      },
      secondarySkills: {
        type: 'array',
        items: { type: 'string' },
        description: 'Skills/tools mentioned as nice-to-have, or implied by responsibilities but not called out as required (secondary keywords).',
      },
      responsibilities: {
        type: 'array',
        items: { type: 'string' },
      },
    },
    required: ['requiredSkills', 'secondarySkills', 'responsibilities'],
  },
};

// FR-3.2
export async function parseJobPostingText(rawText) {
  const anthropic = getClient();
  let message;
  try {
    message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 2048,
      system:
        'You parse raw job-posting text (which may include unrelated page chrome from a scraped web page) into ' +
        'structured JSON. Ignore navigation/footer/ad text. Distinguish explicitly required skills (critical) from ' +
        'nice-to-have or implied skills (secondary).',
      tools: [JOB_POSTING_TOOL],
      tool_choice: { type: 'tool', name: 'submit_job_posting' },
      messages: [{ role: 'user', content: `Job posting text:\n\n---\n${rawText.slice(0, 12000)}\n---` }],
    });
  } catch (err) {
    throw friendlyAiError(err);
  }

  const toolUse = message.content.find((b) => b.type === 'tool_use');
  if (!toolUse) throw new Error('The model did not return a structured job posting.');
  return toolUse.input;
}
