// Foundation tests: run with `npm test`. No database needed — DATABASE_URL is
// pointed at a closed port so DB-dependent paths fail fast and predictably.
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgres://nobody:nothing@127.0.0.1:1/none';
process.env.JWT_SECRET = 'test-secret';

import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import jwt from 'jsonwebtoken';

const { createApp } = await import('../src/app.js');
const { pool } = await import('../src/db.js');
const { errorHandler } = await import('../src/middleware/errorHandler.js');
const { HttpError, notFound } = await import('../src/errors.js');
const { checkConfig } = await import('../src/config.js');

// Start an app on a random port and return a fetch helper for it.
async function serve(app) {
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (path, init) => {
    const res = await fetch(base + path, init);
    const text = await res.text();
    let body;
    try { body = JSON.parse(text); } catch { body = text; }
    return { status: res.status, body, headers: res.headers };
  };
  return { call, close: () => new Promise((r) => server.close(r)) };
}

describe('API app', () => {
  let api;
  before(async () => { api = await serve(createApp()); });
  after(async () => { await api.close(); await pool.end(); });

  test('health check reports the database as down with 503', async () => {
    const { status, body } = await api.call('/api/health');
    assert.equal(status, 503);
    assert.deepEqual({ ok: body.ok, db: body.db }, { ok: false, db: 'down' });
  });

  test('unknown API routes return a JSON 404', async () => {
    const { status, body } = await api.call('/api/does-not-exist');
    assert.equal(status, 404);
    assert.equal(body.code, 'ROUTE_NOT_FOUND');
  });

  test('CORS only grants the configured browser origin', async () => {
    const allowed = await api.call('/api/health', { headers: { Origin: 'http://localhost:5173' } });
    assert.equal(allowed.headers.get('access-control-allow-origin'), 'http://localhost:5173');
    const hostile = await api.call('/api/health', { headers: { Origin: 'https://attacker.example' } });
    assert.equal(hostile.headers.get('access-control-allow-origin'), null);
    const noOrigin = await api.call('/api/health');
    assert.equal(noOrigin.headers.get('access-control-allow-origin'), null);
  });

  test('malformed JSON returns a friendly 400, not a parser message', async () => {
    const { status, body } = await api.call('/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' }, body: '{nope',
    });
    assert.equal(status, 400);
    assert.equal(body.code, 'INVALID_JSON');
    assert.doesNotMatch(body.error, /Unexpected token/);
  });

  test('protected routes need a session', async () => {
    const { status, body } = await api.call('/api/resumes');
    assert.equal(status, 401);
    assert.equal(body.code, 'NO_SESSION');
  });

  test('state-changing requests reject missing and untrusted origins', async () => {
    const missing = await api.call('/api/auth/logout', { method: 'POST' });
    assert.equal(missing.status, 403);
    assert.equal(missing.body.code, 'UNTRUSTED_ORIGIN');
    const untrusted = await api.call('/api/auth/logout', {
      method: 'POST', headers: { Origin: 'https://attacker.example' },
    });
    assert.equal(untrusted.status, 403);
    assert.equal(untrusted.body.code, 'UNTRUSTED_ORIGIN');
  });

  test('an expired session is reported as SESSION_EXPIRED', async () => {
    const token = jwt.sign({ sub: 1 }, 'test-secret', { expiresIn: -10 });
    const { status, body } = await api.call('/api/resumes', { headers: { Cookie: `token=${token}` } });
    assert.equal(status, 401);
    assert.equal(body.code, 'SESSION_EXPIRED');
  });

  test('a database outage behind auth is a 500, not a crash or a fake logout', async () => {
    const token = jwt.sign({ sub: 1 }, 'test-secret', { expiresIn: '5m' });
    const { status, body } = await api.call('/api/resumes', { headers: { Cookie: `token=${token}` } });
    assert.equal(status, 500);
    assert.doesNotMatch(body.error, /ECONNREFUSED|127\.0\.0\.1/); // internals are not leaked
    // …and the server is still alive afterwards
    assert.equal((await api.call('/api/does-not-exist')).status, 404);
  });

  test('input validation still runs before any database work', async () => {
    const { status, body } = await api.call('/api/auth/signup', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' },
      body: JSON.stringify({ email: 'not-an-email', password: 'Abcdefg1' }),
    });
    assert.equal(status, 400);
    assert.match(body.error, /valid email/);
  });

  test('global API rate limiting returns a structured 429 response', async () => {
    const limited = await serve(createApp());
    try {
      let response;
      for (let i = 0; i < 125; i++) {
        response = await limited.call('/api/rate-limit-check');
        if (response.status === 429) break;
      }
      assert.equal(response.status, 429);
      assert.equal(response.body.code, 'RATE_LIMITED');
    } finally {
      await limited.close();
    }
  });
});

describe('error handler', () => {
  test('async throws become JSON errors with status, code and details', async () => {
    const app = express();
    app.get('/http', async () => { throw new HttpError(422, 'Nope', { code: 'X', details: { fallbackToPaste: true } }); });
    app.get('/missing', async () => { throw notFound('Gone.'); });
    app.get('/boom', async () => { throw new Error('secret internals'); });
    app.use(errorHandler);
    const s = await serve(app);
    const origError = console.error;
    console.error = () => {}; // the unexpected-error log is expected here
    try {
      assert.deepEqual(await s.call('/http').then((r) => [r.status, r.body]), [422, { error: 'Nope', code: 'X', fallbackToPaste: true }]);
      assert.deepEqual(await s.call('/missing').then((r) => [r.status, r.body.error]), [404, 'Gone.']);
      const boom = await s.call('/boom');
      assert.equal(boom.status, 500);
      assert.doesNotMatch(boom.body.error, /secret internals/);
    } finally {
      console.error = origError;
      await s.close();
    }
  });
});

describe('config', () => {
  const base = { databaseUrl: 'postgres://x', jwtSecret: 'dev-only-insecure-secret-change-me', appDbPassword: 'a-real-database-password-with-32-chars', anthropicApiKey: 'k', isProduction: false, clientOrigins: ['https://app.example'] };

  test('production refuses to start without a real JWT secret', () => {
    assert.equal(checkConfig({ ...base, isProduction: true, jwtSecret: '' }).errors.length, 1);
    assert.equal(checkConfig({ ...base, isProduction: true, jwtSecret: 'change-me-to-a-long-random-string' }).errors.length, 1);
    assert.equal(checkConfig({ ...base, isProduction: true, jwtSecret: 'replace-with-a-random-secret-that-is-long-enough' }).errors.length, 1);
    assert.equal(checkConfig({ ...base, isProduction: true, jwtSecret: 'dev-only-insecure-secret-change-me' }).errors.length, 1);
    assert.equal(checkConfig({ ...base, isProduction: true, jwtSecret: 'a-real-secret-that-is-long-enough-32' }).errors.length, 0);
    assert.equal(checkConfig({ ...base, isProduction: true, jwtSecret: 'a-real-secret-that-is-long-enough-32', appDbPassword: 'replace-with-sample-password-at-least-32' }).errors.length, 1);
    assert.equal(checkConfig({ ...base, isProduction: true, jwtSecret: 'a-real-secret-that-is-long-enough-32', appDbPassword: '' }).errors.length, 1);
  });

  test('development only warns about the dev secret and a missing AI key', () => {
    const { errors, warnings } = checkConfig({ ...base, anthropicApiKey: '' });
    assert.equal(errors.length, 0);
    assert.equal(warnings.length, 2);
  });

  test('a missing DATABASE_URL is an error', () => {
    assert.equal(checkConfig({ ...base, databaseUrl: undefined }).errors.length, 1);
  });
});
