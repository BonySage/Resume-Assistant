// Source checks that keep SQL injection out: every query must send user input
// as $1, $2, ... parameters, never paste it into the SQL text. Fails if SQL is
// built with ${...} or string concatenation anywhere in backend/src.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');
const files = (dir) => fs.readdirSync(dir, { withFileTypes: true })
  .flatMap((e) => (e.isDirectory() ? files(path.join(dir, e.name)) : e.name.endsWith('.js') ? [path.join(dir, e.name)] : []));
const lineOf = (source, index) => source.slice(0, index).split('\n').length;

// Reviewed exceptions: [file, reason]. Nothing user-controlled reaches these.
const ALLOWED = [
  // The app role's password comes from server config and is escaped by Postgres's quote_literal() first.
  ['migrate.js', 'ALTER ROLE resume_app'],
];

describe('SQL injection guards (source)', () => {
  const sources = files(SRC).map((file) => ({ file: path.relative(SRC, file).replaceAll('\\', '/'), text: fs.readFileSync(file, 'utf8') }));

  test('no SQL is built with ${...} interpolation', () => {
    const found = [];
    for (const { file, text } of sources) {
      for (const m of text.matchAll(/\b(?:query|pool\.query|client\.query)\(\s*`([^`]*)`/g)) {
        if (!m[1].includes('${')) continue;
        if (ALLOWED.some(([f, marker]) => file.endsWith(f) && m[1].includes(marker))) continue;
        found.push(`${file}:${lineOf(text, m.index)}`);
      }
    }
    assert.deepEqual(found, [], 'use $1, $2 ... parameters instead of putting values into the SQL text');
  });

  test('no SQL is built with string concatenation', () => {
    const found = [];
    for (const { file, text } of sources) {
      for (const m of text.matchAll(/\b(?:query|pool\.query|client\.query)\(\s*(['"`])(?:(?!\1)[^\\]|\\.)*\1\s*\+/g)) {
        found.push(`${file}:${lineOf(text, m.index)}`);
      }
    }
    assert.deepEqual(found, [], 'use $1, $2 ... parameters instead of concatenating SQL');
  });

  test('the guard itself catches unsafe SQL', () => {
    const unsafe = 'query(`SELECT * FROM users WHERE email = \'${email}\'`)';
    assert.match(unsafe, /\b(?:query|pool\.query|client\.query)\(\s*`[^`]*\$\{/);
  });
});
