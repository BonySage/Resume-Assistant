// Unit tests for pure helpers in src/lib (no server, no database).
process.env.NODE_ENV = 'test';

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import Anthropic from '@anthropic-ai/sdk';
import { matchesFileSignature, extractResumeText } from '../src/lib/parseResume.js';
import { cleanText } from '../src/lib/validators.js';
import { friendlyAiError } from '../src/lib/aiClient.js';

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

describe('friendlyAiError', () => {
  test('connection failures become a plain-English "unavailable" message', () => {
    const err = friendlyAiError(new Anthropic.APIConnectionError({ message: 'socket hang up' }));
    assert.match(err.message, /temporarily unavailable/);
    assert.doesNotMatch(err.message, /socket/);
  });
});
