// Unit tests for pure helpers in src/lib (no server, no database).
process.env.NODE_ENV = 'test';

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import Anthropic from '@anthropic-ai/sdk';
import PDFDocument from 'pdfkit';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeDocx } from './helpers/docx.js';
import { MAX_DOCX_UNCOMPRESSED_BYTES, MAX_DOCX_ENTRIES, checkDocxArchive } from '../src/lib/docxLimits.js';
import { matchesFileSignature, extractResumeText, MAX_RESUME_PAGES, MAX_RESUME_CHARS } from '../src/lib/parseResume.js';
import { fetchJobPostingText, isPublicAddress } from '../src/lib/jobPosting.js';
import { cleanText, isValidId, isValidEmail, passwordStrengthError, cleanFilename } from '../src/lib/validators.js';
import { friendlyAiError, readJsonOutput } from '../src/lib/aiClient.js';
import { findUnsupportedClaims, validateOptions, hasPlaceholder } from '../src/lib/bulletEnhance.js';
import { computeMatch } from '../src/lib/atsMatch.js';

const PDF = 'application/pdf';
const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

describe('matchesFileSignature', () => {
  test('accepts real PDF and DOCX headers', () => {
    assert.equal(matchesFileSignature(Buffer.from('%PDF-1.7\n...'), PDF), true);
    assert.equal(matchesFileSignature(Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14]), DOCX), true);
  });

  test('rejects files whose bytes do not match the claimed type', () => {
    assert.equal(matchesFileSignature(Buffer.from('<html>not a pdf'), PDF), false);
    assert.equal(matchesFileSignature(Buffer.from('%PDF-1.7'), DOCX), false);
    assert.equal(matchesFileSignature(Buffer.from('MZ\x90\x00'), DOCX), false);
    assert.equal(matchesFileSignature(Buffer.alloc(0), PDF), false);
    assert.equal(matchesFileSignature(Buffer.from('%PDF-1.7'), 'text/plain'), false);
  });
});

describe('extractResumeText', () => {
  // The upload route turns this into a 422 with a generic message, so the
  // parser's own wording never reaches the user.
  test('a corrupt PDF with a valid header throws', async () => {
    await assert.rejects(extractResumeText(Buffer.from('%PDF-1.7\ngarbage'), PDF, 'cv.pdf'));
  });

  // Audit #3: a 2.85 MB, 4,000-page PDF took 12.8s of CPU and produced ~3M
  // tokens that were stored and sent to the AI. Real resumes are 1-3 pages.
  test('extracts the text of a normal two-page resume', async () => {
    const text = await extractResumeText(await makePdf(2, 'Built REST APIs in Node.js and PostgreSQL.'), PDF, 'cv.pdf');
    assert.match(text, /Built REST APIs in Node\.js and PostgreSQL\./);
  });

  test(`rejects a PDF with more than ${MAX_RESUME_PAGES} pages before reading it`, async () => {
    await assert.rejects(
      extractResumeText(await makePdf(MAX_RESUME_PAGES + 1, 'Page'), PDF, 'cv.pdf'),
      { code: 'RESUME_TOO_LONG', message: /pages/ }
    );
  });

  test(`accepts exactly ${MAX_RESUME_PAGES} pages`, async () => {
    const text = await extractResumeText(await makePdf(MAX_RESUME_PAGES, 'Page'), PDF, 'cv.pdf');
    assert.ok(text.length > 0);
  });

  test(`rejects a resume with more than ${MAX_RESUME_CHARS.toLocaleString('en-US')} characters of text`, async () => {
    const dense = 'Delivered measurable results across many projects. '.repeat(400); // ~20k chars per page
    await assert.rejects(
      extractResumeText(await makePdf(3, dense), PDF, 'cv.pdf'),
      { code: 'RESUME_TOO_LONG', message: /too long/ }
    );
  });
});

// A DOCX is a ZIP. A "zip bomb" under the 10 MB upload limit can expand to
// hundreds of MB, and mammoth used to unpack all of it before the 50,000-
// character check ran. The archive is now checked first, by really
// decompressing each entry under a hard cap (declared sizes can lie).
describe('DOCX size limits (zip bombs)', () => {
  const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  const bombPadding = () => Buffer.alloc(MAX_DOCX_UNCOMPRESSED_BYTES * 2, ' '); // whitespace compresses ~1000:1

  test('extracts the text of a normal DOCX', async () => {
    const text = await extractResumeText(makeDocx('Built REST APIs in Node.js and PostgreSQL.'), DOCX_MIME, 'cv.docx');
    assert.match(text, /Built REST APIs in Node\.js and PostgreSQL\./);
  });

  test('a DOCX with a large photo (5 MB) still works', async () => {
    const photo = { name: 'word/media/photo.jpg', data: randomBytes(5 * 1024 * 1024), method: 0 };
    const text = await extractResumeText(makeDocx('Jane Doe, Software Engineer', { extra: [photo] }), DOCX_MIME, 'cv.docx');
    assert.match(text, /Jane Doe/);
  });

  test('rejects a zip bomb before unpacking it all', async () => {
    const bomb = makeDocx('Hi', { padding: bombPadding() });
    assert.ok(bomb.length < 1024 * 1024, `bomb is only ${bomb.length} bytes on disk`);
    await assert.rejects(extractResumeText(bomb, DOCX_MIME, 'cv.docx'), { code: 'RESUME_TOO_LONG', message: /too large/ });
  });

  test('rejects a zip bomb whose headers lie about its size', async () => {
    const liar = makeDocx('Hi', { padding: bombPadding(), documentEntry: { declaredSize: 1000 } });
    await assert.rejects(extractResumeText(liar, DOCX_MIME, 'cv.docx'), { code: 'RESUME_TOO_LONG' });
  });

  test(`rejects an archive with more than ${MAX_DOCX_ENTRIES} files`, async () => {
    const many = Array.from({ length: MAX_DOCX_ENTRIES + 1 }, (_, i) => ({ name: `word/x${i}.xml`, data: '<x/>' }));
    await assert.rejects(extractResumeText(makeDocx('Hi', { extra: many }), DOCX_MIME, 'cv.docx'), { code: 'RESUME_TOO_LONG' });
  });

  // JSZip (inside mammoth) reads every central header it finds and follows
  // ZIP64 / shifted offsets, so the check must not trust a smaller entry count.
  test('rejects a zip bomb hidden behind an entry count that is too small', async () => {
    const bomb = makeDocx('Hi', { padding: bombPadding() });
    const eocd = bomb.length - 22;
    bomb.writeUInt16LE(2, eocd + 8);
    bomb.writeUInt16LE(2, eocd + 10); // word/document.xml (the bomb) is the 3rd entry
    await assert.rejects(extractResumeText(bomb, DOCX_MIME, 'cv.docx'), { message: /Malformed DOCX/ });
  });

  test('rejects an archive that marks itself as ZIP64', async () => {
    const zip = makeDocx('Hi');
    zip.writeUInt32LE(0xffffffff, zip.length - 22 + 12); // central directory size
    await assert.rejects(extractResumeText(zip, DOCX_MIME, 'cv.docx'), { code: 'RESUME_TOO_LONG' });
  });

  test('rejects an archive with data prepended (shifted offsets)', async () => {
    const zip = Buffer.concat([Buffer.alloc(64), makeDocx('Hi')]);
    await assert.rejects(extractResumeText(zip, DOCX_MIME, 'cv.docx'), { message: /Malformed DOCX/ });
  });

  // The stricter structure checks must not reject real documents. mammoth
  // ships DOCX files made by Word and other editors with its own tests.
  const realDocxDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'node_modules', 'mammoth', 'test', 'test-data');
  test('real DOCX files from Word and other editors pass the archive check', { skip: !fs.existsSync(realDocxDir) && 'mammoth sample files not installed' }, () => {
    const files = fs.readdirSync(realDocxDir).filter((f) => f.endsWith('.docx'));
    assert.ok(files.length >= 10, `found ${files.length} sample files`);
    for (const f of files) assert.doesNotThrow(() => checkDocxArchive(fs.readFileSync(path.join(realDocxDir, f))), f);
  });

  test('a truncated or fake ZIP is rejected as unreadable', async () => {
    const fake = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from('not really a zip file')]);
    await assert.rejects(extractResumeText(fake, DOCX_MIME, 'cv.docx'));
  });
});

// Builds a PDF in memory with `pages` pages, each holding `text`.
function makePdf(pages, text) {
  const doc = new PDFDocument({ size: 'LETTER', margins: { top: 20, bottom: 20, left: 20, right: 20 } });
  const chunks = [];
  doc.on('data', (c) => chunks.push(c));
  const done = new Promise((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));
  for (let i = 0; i < pages; i++) {
    if (i) doc.addPage();
    doc.fontSize(4).text(text);
  }
  doc.end();
  return done;
}

describe('cleanText', () => {
  test('keeps &, < and > verbatim (no HTML entity encoding)', () => {
    assert.equal(cleanText('R&D team, C++ <5 yrs, salary > 100k'), 'R&D team, C++ <5 yrs, salary > 100k');
  });

  test('strips control characters, normalizes newlines and trims', () => {
    assert.equal(cleanText('  Senior\x00 Engineer\r\nRemote\t(US)\x07  '), 'Senior Engineer\nRemote\t(US)');
  });

  test('non-strings become an empty string', () => {
    assert.equal(cleanText(undefined), '');
    assert.equal(cleanText(42), '');
  });
});

describe('job posting URL safety', () => {
  test('allows public addresses and rejects private or reserved IPv4/IPv6 addresses', () => {
    assert.equal(isPublicAddress('1.1.1.1'), true);
    for (const address of [
      '10.0.0.1',
      '172.16.0.1',
      '192.168.1.1',
      '169.254.169.254',
      '127.0.0.1',
      '::1',
      'fe80::1',
      'fc00::1',
      '::ffff:127.0.0.1',
    ]) {
      assert.equal(isPublicAddress(address), false, `${address} should not be public`);
    }
  });

  test('rejects private destinations before making a request', async () => {
    await assert.rejects(fetchJobPostingText('http://172.16.0.1/'), /Internal network links are blocked/);
    await assert.rejects(fetchJobPostingText('http://[fe80::1]/'), /Internal network links are blocked/);
  });
});

describe('computeMatch', () => {
  test('returns no score and no false strong-match recommendation when no skills exist', () => {
    const result = computeMatch({ skills: [], experience: [] }, { requiredSkills: { critical: [], secondary: [] } });
    assert.equal(result.score, null);
    assert.match(result.recommendations[0], /could not be calculated/);
    assert.doesNotMatch(result.recommendations.join(' '), /Strong match/);
  });

  // The resume and job used in the TESTING.md QA run: C++ and C# were reported
  // missing (score 27%) although the resume names each of them three times.
  const qaResume = {
    summary: 'Software engineer with C++ and C# experience.',
    skills: ['C++', 'C#', 'Python', 'SQL'],
    experience: [{
      title: 'Software Engineer', company: 'Acme Corp',
      bullets: [
        { id: 'exp0-b0', text: 'Built C++ services handling 10,000 requests per second' },
        { id: 'exp0-b1', text: 'Wrote C# tools for internal reporting with SQL' },
        { id: 'exp0-b2', text: 'Automated Python test suites for the build pipeline' },
      ],
    }],
  };
  const qaJob = { requiredSkills: { critical: ['C++', 'C#', 'Python', 'Kubernetes'], secondary: ['SQL', 'Docker', 'Go'] } };

  test('recognizes keywords that end in symbols (C++, C#)', () => {
    const result = computeMatch(qaResume, qaJob);
    assert.deepEqual(result.matchedKeywords, ['c++', 'c#', 'python', 'sql']);
    assert.deepEqual(result.missingCritical, ['kubernetes']);
    assert.deepEqual(result.missingSecondary, ['docker', 'go']);
    assert.doesNotMatch(result.recommendations.join(' '), /"c\+\+"|"c#"/);
  });

  test('scores the QA resume at 64% (critical ×2, secondary ×1)', () => {
    // Earned: C++ 2 + C# 2 + Python 2 + SQL 1 = 7 of 4×2 + 3×1 = 11.
    assert.equal(computeMatch(qaResume, qaJob).score, 64);
  });

  test('recognizes keywords that start with a symbol (.NET) and other punctuation (Node.js)', () => {
    const resume = { skills: ['.NET', 'Node.js'], experience: [{ bullets: [{ id: 'b', text: 'Built .NET and Node.js APIs' }] }] };
    const result = computeMatch(resume, { requiredSkills: { critical: ['.NET', 'Node.js'], secondary: [] } });
    assert.deepEqual(result.matchedKeywords, ['.net', 'node.js']);
  });

  test('a symbol keyword needs a boundary only on its word side (ASP.NET has .NET)', () => {
    const resume = { skills: ['ASP.NET'], experience: [{ bullets: [{ id: 'b', text: 'Built ASP.NET APIs' }] }] };
    assert.deepEqual(computeMatch(resume, { requiredSkills: { critical: ['.NET'], secondary: [] } }).matchedKeywords, ['.net']);
    const network = { skills: ['.NETwork'], experience: [] };
    assert.deepEqual(computeMatch(network, { requiredSkills: { critical: ['.NET'], secondary: [] } }).missingCritical, ['.net']);
  });

  // The results page labels scores Low 0–49, Fair 50–74, Strong 75+; the
  // "match is low" advice must follow the same scale, not contradict a Fair badge.
  const lowAdvice = /overall match is low/;
  const scaleResume = { skills: ['Python', 'SQL'], experience: [{ bullets: [{ id: 'b', text: 'Wrote Python tools' }] }] };
  test('a Fair score (50–74) does not say the match is low', () => {
    const result = computeMatch(scaleResume, { requiredSkills: { critical: ['Python', 'Kubernetes'], secondary: ['SQL'] } });
    assert.equal(result.score, 50);
    assert.doesNotMatch(result.recommendations.join(' '), lowAdvice);
  });

  test('a Fair score with only nice-to-have gaps is not called a strong match', () => {
    const resume = { skills: ['Python', 'SQL'], experience: [{ bullets: [{ id: 'b', text: 'Wrote Python and SQL tools' }] }] };
    const result = computeMatch(resume, { requiredSkills: { critical: ['Python', 'SQL'], secondary: ['Docker', 'Go', 'AWS'] } });
    assert.equal(result.score, 57);
    assert.doesNotMatch(result.recommendations.join(' '), /Strong match/);
    assert.match(result.recommendations.join(' '), /docker/);
  });

  test('a Low score (under 50) says the match is low', () => {
    const result = computeMatch(scaleResume, { requiredSkills: { critical: ['Kubernetes', 'AWS'], secondary: ['SQL'] } });
    assert.equal(result.score, 10);
    assert.match(result.recommendations.join(' '), lowAdvice);
  });

  test('still matches whole words only', () => {
    const resume = { skills: ['JavaScript', 'Golang'], experience: [] };
    const result = computeMatch(resume, { requiredSkills: { critical: ['Java', 'Go'], secondary: [] } });
    assert.deepEqual(result.missingCritical, ['java', 'go']);
  });
});

describe('friendlyAiError', () => {
  test('connection failures become a plain-English "unavailable" message', () => {
    const err = friendlyAiError(new Anthropic.APIConnectionError({ message: 'socket hang up' }));
    assert.match(err.message, /temporarily unavailable/);
    assert.doesNotMatch(err.message, /socket/);
  });

  test('timeouts and our own deadline abort say the AI took too long', () => {
    assert.match(friendlyAiError(new Anthropic.APIConnectionTimeoutError()).message, /took too long/);
    assert.match(friendlyAiError(new Anthropic.APIUserAbortError()).message, /took too long/);
  });

  // Audit #9: errors without an HTTP status were passed through unchanged,
  // so internal messages reached the user (and resumes.parse_error).
  test('internal errors never reach the user verbatim', () => {
    for (const internal of [
      new TypeError("Cannot read properties of undefined (reading 'content')"),
      new Anthropic.AnthropicError('Missing required parameter: model at /app/backend/src/lib/x.js'),
    ]) {
      const err = friendlyAiError(internal);
      assert.match(err.message, /AI service/);
      assert.doesNotMatch(err.message, /Cannot read|parameter|\/app\//);
    }
  });

  test('an invalid-key error never shows the key', () => {
    const key = 'sk-ant-api03-CANARYsecretvalue';
    const authError = new Anthropic.AuthenticationError(401, { error: { type: 'authentication_error', message: `invalid x-api-key ${key}` } }, `invalid x-api-key ${key}`, new Headers());
    const err = friendlyAiError(authError);
    assert.doesNotMatch(err.message, /sk-ant|CANARY|x-api-key/);
    assert.match(err.message, /not configured correctly/);
  });

  test('API error bodies are not shown either', () => {
    const apiError = new Anthropic.BadRequestError(400, { error: { message: 'prompt is too long: 250000 tokens' } }, 'prompt is too long', new Headers());
    assert.doesNotMatch(friendlyAiError(apiError).message, /tokens|prompt/);
  });
});

describe('findUnsupportedClaims (FR-5.2 hallucination check)', () => {
  const resumeText =
    'Software Engineer, Acme Corp. Built REST API in Node.js and PostgreSQL. ' +
    'Cut page load time by 40% for 2,000 users. Used C++ for the image pipeline.';
  const check = (text, jobKeywords = []) => findUnsupportedClaims(text, { resumeText, jobKeywords });

  test('a rewrite that only uses resume facts passes', () => {
    assert.deepEqual(check('Built a Node.js REST API on PostgreSQL, cutting load time 40% for 2000 users'), []);
    assert.deepEqual(check('Optimized C++ image pipeline at Acme'), []);
  });

  test('flags a job skill the resume never mentions', () => {
    assert.deepEqual(check('Deployed services on Kubernetes', ['Kubernetes', 'Node.js']), [{ type: 'skill', term: 'Kubernetes' }]);
  });

  test('flags an employer or tool name the resume never mentions', () => {
    assert.deepEqual(check('Led API migration for Google using Terraform'), [
      { type: 'name', term: 'Google' },
      { type: 'name', term: 'Terraform' },
    ]);
  });

  test('flags invented metrics but not placeholders', () => {
    assert.deepEqual(check('Cut load time by 65% for 2,000 users'), [{ type: 'metric', term: '65' }]);
    assert.deepEqual(check('Cut load time by [X%] across 3x more pages'), [{ type: 'metric', term: '3' }]);
    assert.deepEqual(check('Cut load time by [X%] for [number] users'), []);
  });

  test('the leading action verb and plurals of resume terms are not flagged', () => {
    assert.deepEqual(check('Designed REST APIs in Node.js'), []);
  });

  test('validateOptions marks only the options with issues, using the original bullet as evidence', () => {
    const out = validateOptions(['Built Node.js API', 'Built API with GraphQL'], {
      resumeText: 'Node.js API work',
      originalBullet: 'Built an API',
      jobKeywords: ['GraphQL'],
    });
    assert.deepEqual(out.map((o) => o.flagged), [false, true]);
    assert.deepEqual(out[1].issues, [{ type: 'skill', term: 'GraphQL' }]);
  });

  test('hasPlaceholder detects unfilled [placeholders]', () => {
    assert.equal(hasPlaceholder('Grew revenue by [X%]'), true);
    assert.equal(hasPlaceholder('Grew revenue by 12%'), false);
  });
});

describe('readJsonOutput', () => {
  const msg = (text, stop_reason = 'end_turn') => ({ stop_reason, content: [{ type: 'thinking', thinking: '' }, { type: 'text', text }] });

  test('returns the parsed JSON from the text block', () => {
    assert.deepEqual(readJsonOutput(msg('{"title":"Engineer"}'), 'job posting'), { title: 'Engineer' });
  });

  test('refusals, truncation and bad JSON become plain-English errors', () => {
    assert.throws(() => readJsonOutput(msg('', 'refusal'), 'resume'), /couldn’t process this resume/);
    assert.throws(() => readJsonOutput(msg('{"ti', 'max_tokens'), 'resume'), /too long/);
    assert.throws(() => readJsonOutput(msg('not json'), 'resume'), /unreadable answer/);
  });
});

describe('isValidId', () => {
  test('accepts positive integers in the Postgres INTEGER range', () => {
    for (const id of ['1', '42', '2147483647']) assert.equal(isValidId(id), true, id);
  });

  test('rejects anything that cannot be a row id', () => {
    for (const id of ['0', '-1', '1.5', '01', 'abc', '1 OR 1=1', '2147483648', '99999999999', '', ' 1', undefined, 5]) {
      assert.equal(isValidId(id), false, String(id));
    }
  });
});

describe('isValidEmail (FR-1.1)', () => {
  test('accepts ordinary addresses', () => {
    for (const email of ['a@b.co', 'first.last+tag@uni.example.edu']) assert.equal(isValidEmail(email), true, email);
  });

  test('rejects malformed input and non-strings', () => {
    for (const email of ['not-an-email', 'a@b', '@b.com', 'a @b.com', 'a@b .com', '', null, 42]) {
      assert.equal(isValidEmail(email), false, String(email));
    }
  });
});

describe('passwordStrengthError (FR-1.1)', () => {
  test('accepts 8+ characters with upper, lower and a number', () => {
    assert.equal(passwordStrengthError('Passw0rd'), null);
  });

  test('explains each missing rule', () => {
    assert.match(passwordStrengthError('Pa1'), /at least 8/);
    assert.match(passwordStrengthError('password1'), /uppercase and lowercase/);
    assert.match(passwordStrengthError('PASSWORD1'), /uppercase and lowercase/);
    assert.match(passwordStrengthError('Password'), /number/);
    assert.match(passwordStrengthError(undefined), /at least 8/);
  });

  // Audit #8: bcrypt ignores everything after 72 bytes, so a longer password
  // would silently match any password sharing its first 72 bytes.
  test('rejects passwords longer than bcrypt can use (72 bytes)', () => {
    assert.equal(passwordStrengthError('Aa1' + 'x'.repeat(69)), null); // exactly 72
    assert.match(passwordStrengthError('Aa1' + 'x'.repeat(70)), /too long/); // 73
    assert.match(passwordStrengthError('Aa1' + 'é'.repeat(35)), /too long/); // 38 chars but 73 bytes
  });
});

describe('cleanFilename', () => {
  test('keeps normal and accented names unchanged', () => {
    assert.equal(cleanFilename('Résumé – Zoë 2026.pdf'), 'Résumé – Zoë 2026.pdf');
  });

  test('removes control characters and turns line breaks and tabs into spaces', () => {
    assert.equal(cleanFilename('cv\x07\x1b[31m\n-x\t.pdf'), 'cv[31m -x .pdf');
  });

  test('caps the length at 255 characters', () => {
    assert.equal(cleanFilename('a'.repeat(400) + '.pdf').length, 255);
  });

  test('never cuts an emoji in half when shortening', () => {
    const cut = cleanFilename('a'.repeat(254) + '\u{1F600}.pdf'); // the emoji would straddle character 255
    assert.equal(cut, 'a'.repeat(254));
    assert.doesNotMatch(cut, /[\uD800-\uDFFF]/, 'no lone surrogate');
  });

  test('an empty or unusable name becomes "resume"', () => {
    assert.equal(cleanFilename('\x00\x07'), 'resume');
    assert.equal(cleanFilename(undefined), 'resume');
  });
});
