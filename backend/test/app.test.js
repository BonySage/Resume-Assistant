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

  // XSS: text a user controls (here, the URL) is echoed back only as JSON,
  // which browsers never run, and a strict CSP means nothing could run even if
  // an API response were ever rendered as a page.
  test('a script in the URL comes back as inert JSON with no-script headers', async () => {
    const { status, body, headers } = await api.call('/api/%3Cscript%3Ealert(1)%3C%2Fscript%3E');
    assert.equal(status, 404);
    assert.match(headers.get('content-type'), /^application\/json/);
    assert.equal(typeof body, 'object');
    assert.equal(headers.get('x-content-type-options'), 'nosniff');
    assert.match(headers.get('content-security-policy') || '', /default-src 'none'/);
    assert.match(headers.get('content-security-policy') || '', /frame-ancestors 'none'/);
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
    // APP_DB_PASSWORD uses the same placeholder list as JWT_SECRET.
    assert.equal(checkConfig({ ...base, isProduction: true, jwtSecret: 'a-real-secret-that-is-long-enough-32', appDbPassword: 'your-key-here-but-made-long-enough-32' }).errors.length, 1);
  });

  test('development only warns about the dev secret and a missing AI key', () => {
    const { errors, warnings } = checkConfig({ ...base, anthropicApiKey: '' });
    assert.equal(errors.length, 0);
    assert.equal(warnings.length, 2);
  });

  // Audit #1: the JWT secret signs every session; a value copied from a
  // public template lets anyone forge a login for any user id.
  test('development refuses a JWT secret copied from the example env files', () => {
    for (const jwtSecret of [
      'change-me-to-a-unique-random-secret-at-least-32-characters', // compose.env.example
      'change-me-to-a-long-random-string', // backend/.env.example
      'your-key-here',
      'secret',
    ]) {
      assert.equal(checkConfig({ ...base, jwtSecret }).errors.length, 1, jwtSecret);
    }
  });

  test('development warns (but still starts) with a short JWT secret', () => {
    const { errors, warnings } = checkConfig({ ...base, jwtSecret: 'my-own-short-secret' });
    assert.equal(errors.length, 0);
    assert.ok(warnings.some((w) => /JWT_SECRET/.test(w)));
  });

  test('development accepts a long random JWT secret without warnings', () => {
    const { errors, warnings } = checkConfig({ ...base, jwtSecret: 'f3a9c1d7e2b84a6f9c0d1e2f3a4b5c6d' });
    assert.equal(errors.length, 0);
    assert.equal(warnings.length, 0);
  });

  // Audit #4: behind a proxy without TRUST_PROXY every user shares the
  // proxy's IP, so one attacker exhausts the login limit for everyone.
  test('production warns when TRUST_PROXY is not set', () => {
    const prod = { ...base, isProduction: true, jwtSecret: 'a-real-secret-that-is-long-enough-32' };
    assert.ok(checkConfig({ ...prod, trustProxy: false }).warnings.some((w) => /TRUST_PROXY/.test(w)));
    assert.ok(!checkConfig({ ...prod, trustProxy: 1 }).warnings.some((w) => /TRUST_PROXY/.test(w)));
    assert.ok(!checkConfig({ ...base, trustProxy: false }).warnings.some((w) => /TRUST_PROXY/.test(w)), 'not in development');
  });

  test('a missing DATABASE_URL is an error', () => {
    assert.equal(checkConfig({ ...base, databaseUrl: undefined }).errors.length, 1);
  });
});

// Audit #4: the IP-based login limit doesn't stop guessing spread over many
// IPs, so failed logins are also limited per email address. Limiters are off
// in tests, so this runs the factory directly with limiting switched on.
describe('per-email login limit', () => {
  let api;
  before(async () => {
    const { loginEmailRateLimit } = await import('../src/routes/auth.js');
    const app = express();
    app.set('trust proxy', true); // let each request pick its IP via X-Forwarded-For
    app.use(express.json());
    app.post('/login', loginEmailRateLimit({ limit: 3, skip: () => false }), (req, res) => {
      if (req.body.password === 'right') return res.json({ ok: true });
      res.status(401).json({ error: 'Invalid email or password.' });
    });
    api = await serve(app);
  });
  after(() => api.close());

  let ip = 0;
  const login = (email, password) => api.call('/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `203.0.113.${++ip}` }, // a new IP every time
    body: JSON.stringify({ email, password }),
  });

  test('blocks an email after too many failed attempts, even from different IPs', async () => {
    for (let i = 0; i < 3; i++) assert.equal((await login('victim@example.com', 'guess')).status, 401);
    const blocked = await login('victim@example.com', 'guess');
    assert.equal(blocked.status, 429);
    assert.equal(blocked.body.code, 'RATE_LIMITED');
  });

  test('the limit is per email and ignores letter case', async () => {
    assert.equal((await login('VICTIM@example.com', 'guess')).status, 429);
    assert.equal((await login('someone-else@example.com', 'guess')).status, 401);
  });

  // Arbitrary strings (e.g. 1 MB) must not become keys in the in-memory store.
  test('values that are not real emails are counted against the IP instead', async () => {
    const fromOneIp = (email) => api.call('/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '198.51.100.7' },
      body: JSON.stringify({ email, password: 'guess' }),
    });
    for (const junk of ['junk-1', 'x'.repeat(5000), 'junk-3']) assert.equal((await fromOneIp(junk)).status, 401);
    assert.equal((await fromOneIp('junk-4')).status, 429, 'all junk values share the IP bucket');
  });

  test('successful logins do not count toward the limit', async () => {
    for (let i = 0; i < 5; i++) assert.equal((await login('regular@example.com', 'right')).status, 200);
    assert.equal((await login('regular@example.com', 'guess')).status, 401);
  });
});

// Everyone behind one shared IP (campus Wi-Fi, an office, a proxy) used to
// share 10 sign-in/sign-up requests per 15 minutes, successful ones included,
// so the 11th person to log in was locked out. Login now only counts failures
// per IP; sign-up still counts every attempt (no bulk account creation), and
// the two no longer share a counter.
describe('per-IP login and sign-up limits', () => {
  // A fresh app per test, so each starts with empty counters. Same IP for all requests.
  async function makeApp() {
    const { loginIpRateLimit, signupIpRateLimit } = await import('../src/routes/auth.js');
    const app = express();
    app.use(express.json());
    const on = { limit: 3, skip: () => false };
    app.post('/signup', signupIpRateLimit(on), (req, res) => res.status(201).json({ ok: true }));
    app.post('/login', loginIpRateLimit(on), (req, res) =>
      req.body.password === 'right' ? res.json({ ok: true }) : res.status(401).json({ error: 'Invalid email or password.' }));
    return serve(app);
  }
  const post = (api, path, body) => api.call(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  test('successful logins from one IP are never blocked', async () => {
    const api = await makeApp();
    for (let i = 0; i < 8; i++) {
      assert.equal((await post(api, '/login', { email: `student${i}@example.com`, password: 'right' })).status, 200, `login ${i + 1}`);
    }
    await api.close();
  });

  test('failed logins from one IP are still blocked after the limit', async () => {
    const api = await makeApp();
    for (let i = 0; i < 3; i++) assert.equal((await post(api, '/login', { email: `x${i}@example.com`, password: 'guess' })).status, 401);
    const blocked = await post(api, '/login', { email: 'x9@example.com', password: 'guess' });
    assert.equal(blocked.status, 429);
    assert.equal(blocked.body.code, 'RATE_LIMITED');
    await api.close();
  });

  test('sign-ups still count every attempt, so accounts cannot be created in bulk', async () => {
    const api = await makeApp();
    for (let i = 0; i < 3; i++) assert.equal((await post(api, '/signup', { email: `new${i}@example.com` })).status, 201);
    assert.equal((await post(api, '/signup', { email: 'new9@example.com' })).status, 429);
    await api.close();
  });

  test('sign-ups and logins have separate counters', async () => {
    const api = await makeApp();
    for (let i = 0; i < 4; i++) await post(api, '/signup', { email: `new${i}@example.com` }); // uses up sign-ups
    assert.equal((await post(api, '/login', { email: 'student@example.com', password: 'right' })).status, 200);
    await api.close();
  });
});
