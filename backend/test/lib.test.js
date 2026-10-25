// Unit tests for pure helpers in src/lib (no server, no database).
process.env.NODE_ENV = 'test';

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import Anthropic from '@anthropic-ai/sdk';
import { matchesFileSignature, extractResumeText } from '../src/lib/parseResume.js';
import { fetchJobPostingText, isPublicAddress } from '../src/lib/jobPosting.js';
import { cleanText, isValidEmail, passwordStrengthError } from '../src/lib/validators.js';
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
});

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
