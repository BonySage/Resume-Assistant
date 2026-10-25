import * as cheerio from 'cheerio';
import dns from 'node:dns';
import ipaddr from 'ipaddr.js';
import { Agent, fetch as undiciFetch } from 'undici';
import { getClient, PARSE_MODEL, friendlyAiError, readJsonOutput } from './aiClient.js';

const URL_FETCH_TIMEOUT_MS = 10_000; // NFR-1.2
const MAX_REDIRECTS = 5;
const MAX_PAGE_BYTES = 2 * 1024 * 1024;

function fetchError(message) {
  const error = new Error(message);
  error.name = 'JobFetchError';
  return error;
}

export function isPublicAddress(address) {
  try {
    return ipaddr.process(address).range() === 'unicast';
  } catch {
    return false;
  }
}

function publicLookup(hostname, options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }
  const cleanHost = hostname.startsWith('[') && hostname.endsWith(']')
    ? hostname.slice(1, -1)
    : hostname;
  if (ipaddr.isValid(cleanHost)) {
    if (!isPublicAddress(cleanHost)) {
      const blocked = new Error('Requests to private or reserved network addresses are blocked.');
      blocked.code = 'EACCES';
      return callback(blocked);
    }
    const family = cleanHost.includes(':') ? 6 : 4;
    if (options?.all) return callback(null, [{ address: cleanHost, family }]);
    return callback(null, cleanHost, family);
  }
  dns.lookup(cleanHost, { all: true, verbatim: true }, (err, addresses) => {
    if (err) return callback(err);
    if (!addresses.length || addresses.some(({ address }) => !isPublicAddress(address))) {
      const blocked = new Error('Requests to private or reserved network addresses are blocked.');
      blocked.code = 'EACCES';
      return callback(blocked);
    }
    if (options?.all) return callback(null, addresses);
    callback(null, addresses[0].address, addresses[0].family);
  });
}

const publicDispatcher = new Agent({ connect: { lookup: publicLookup } });

async function validatePublicUrl(url) {
  if (!/^https?:$/.test(url.protocol)) {
    throw fetchError('Only http/https URLs are supported.');
  }
  const hostname = url.hostname.startsWith('[') && url.hostname.endsWith(']')
    ? url.hostname.slice(1, -1)
    : url.hostname;
  let addresses;
  if (ipaddr.isValid(hostname)) {
    addresses = [{ address: hostname }];
  } else {
    try {
      addresses = await dns.promises.lookup(hostname, { all: true, verbatim: true });
    } catch {
      throw fetchError("Couldn't reach that URL. Try pasting the description instead.");
    }
  }
  if (!addresses.length || addresses.some(({ address }) => !isPublicAddress(address))) {
    throw fetchError('Internal network links are blocked for security reasons.');
  }
}

// FR-3.1: URL input with automatic extraction; throws on failure so the
// route can respond with a clear prompt to use the copy-paste fallback (NFR-4.2).
export async function fetchJobPostingText(url) {
  let currentUrl;
  try {
    currentUrl = new URL(url);
  } catch {
    throw new Error('That does not look like a valid URL.');
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), URL_FETCH_TIMEOUT_MS);
  try {
    for (let redirects = 0; ; redirects++) {
      await validatePublicUrl(currentUrl);
      const res = await undiciFetch(currentUrl.href, {
        dispatcher: publicDispatcher,
        signal: controller.signal,
        redirect: 'manual',
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AIResumeAssistant/1.0)' },
      });

      if ([301, 302, 303, 307, 308].includes(res.status)) {
        const location = res.headers.get('location');
        await res.body?.cancel();
        if (!location || redirects >= MAX_REDIRECTS) {
          throw fetchError('That page redirected too many times. Try pasting the description instead.');
        }
        try {
          currentUrl = new URL(location, currentUrl);
        } catch {
          throw fetchError("Couldn't follow that job posting link. Try pasting the description instead.");
        }
        continue;
      }

      if (!res.ok) {
        throw fetchError(`That page returned an error (${res.status}). Try pasting the description instead.`);
      }
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('text/html')) {
        throw fetchError("That URL doesn't look like a web page. Try pasting the description instead.");
      }

      let size = 0;
      const chunks = [];
      for await (const chunk of res.body) {
        size += chunk.length;
        if (size > MAX_PAGE_BYTES) {
          controller.abort();
          throw fetchError("That page is too large to process. Try pasting the description instead.");
        }
        chunks.push(chunk);
      }
      const html = Buffer.concat(chunks).toString('utf-8');
      const $ = cheerio.load(html);
      $('script, style, noscript, nav, header, footer, svg').remove();
      const text = $('body').text().replace(/[ \t]+/g, ' ').replace(/\n{2,}/g, '\n').trim();

      if (text.length < 100) {
        throw fetchError("Couldn't find enough text on that page. Try pasting the description instead.");
      }
      return text;
    }
  } catch (err) {
    if (err.name === 'JobFetchError') throw err;
    if (err.name === 'AbortError') {
      throw new Error('Fetching that job posting took too long. Try pasting the description instead.');
    }
    if (err.code === 'EACCES') {
      throw new Error('Internal network links are blocked for security reasons.');
    }
    throw new Error("Couldn't reach that URL. Try pasting the description instead.");
  } finally {
    clearTimeout(timer);
  }
}

// Structured outputs need additionalProperties: false and every field required;
// the model uses "" / [] for anything the posting doesn't state.
const JOB_POSTING_SCHEMA = {
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
  required: ['title', 'company', 'description', 'requiredSkills', 'secondarySkills', 'responsibilities'],
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
        'nice-to-have or implied skills (secondary). Use an empty string or empty list for anything not stated.',
      messages: [{ role: 'user', content: `Job posting text:\n\n---\n${rawText.slice(0, 12000)}\n---` }],
    });
  } catch (err) {
    throw friendlyAiError(err);
  }

  return readJsonOutput(message, 'job posting');
}
