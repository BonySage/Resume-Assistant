// Integration tests against a real Postgres: migrations, auth, and the
// row-level security policies from db/migrations/007.
//
// Needs TEST_DATABASE_ADMIN_URL, a superuser URL for a THROWAWAY Postgres
// server (see TESTING.md). Each run creates its own database and drops it
// afterwards, but migrate.js also (re)sets the password of the cluster-wide
// resume_app role, so never point this at the dev or production server.
// Without the variable the suite is skipped locally and fails in CI.
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import PDFDocument from 'pdfkit';
import { makeDocx } from './helpers/docx.js';
import { MAX_DOCX_UNCOMPRESSED_BYTES } from '../src/lib/docxLimits.js';

// Builds a PDF in memory with `pages` pages, each holding `text`.
function makePdf(pages, text) {
  const doc = new PDFDocument({ size: 'LETTER' });
  const chunks = [];
  doc.on('data', (c) => chunks.push(c));
  const done = new Promise((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));
  for (let i = 0; i < pages; i++) {
    if (i) doc.addPage();
    doc.fontSize(11).text(text);
  }
  doc.end();
  return done;
}

const ADMIN_URL = process.env.TEST_DATABASE_ADMIN_URL;
const ORIGIN = 'http://localhost:5173';
const PASSWORD = 'Passw0rdTest';

if (!ADMIN_URL && process.env.CI) {
  throw new Error('TEST_DATABASE_ADMIN_URL must be set in CI so the database tests run.');
}

describe('database integration', { skip: ADMIN_URL ? false : 'set TEST_DATABASE_ADMIN_URL to run (see TESTING.md)' }, () => {
  const dbName = `resume_test_${process.pid}_${Date.now()}`;
  const appPassword = `test-app-password-${Date.now()}`;
  let admin; // superuser connection to the test database (bypasses RLS)
  let appDbUrlForChild; // restricted resume_app URL, for tests that start their own server
  let db; // ../src/db.js, connected as the restricted resume_app role
  let api;
  let requestCount = 0;
  let alice;
  let bob;

  // Signs up through the real API and returns { id, cookie }.
  async function signup(email) {
    const res = await api.call('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
      body: JSON.stringify({ email, password: PASSWORD }),
    });
    assert.equal(res.status, 201, `signup failed: ${JSON.stringify(res.body)}`);
    return { id: res.body.user.id, cookie: res.headers.get('set-cookie').split(';')[0] };
  }

  // Seeds a resume, job posting, analysis and bullet suggestion owned by `userId`.
  function seedOwnedRows(userId) {
    return db.withUserContext(userId, async () => {
      const resume = (await db.query(
        `INSERT INTO resumes (user_id, original_filename, mime_type, size_bytes, extracted_text, parsed_data)
         VALUES ($1, 'cv.pdf', 'application/pdf', 100, 'Built APIs in Node.js', '{"experience":[]}') RETURNING id`,
        [userId]
      )).rows[0];
      const job = (await db.query(
        `INSERT INTO job_postings (user_id, raw_text, title) VALUES ($1, 'Backend role', 'Backend Engineer') RETURNING id`,
        [userId]
      )).rows[0];
      const analysis = (await db.query(
        `INSERT INTO analyses (resume_id, job_posting_id, status, score) VALUES ($1, $2, 'complete', 50) RETURNING id`,
        [resume.id, job.id]
      )).rows[0];
      const bullet = (await db.query(
        `INSERT INTO bullet_suggestions (analysis_id, bullet_id, original_text) VALUES ($1, 'exp0-b0', 'Built APIs') RETURNING id`,
        [analysis.id]
      )).rows[0];
      return { resumeId: resume.id, jobId: job.id, analysisId: analysis.id, bulletId: bullet.id };
    });
  }

  before(async () => {
    const server = new pg.Client({ connectionString: ADMIN_URL });
    await server.connect();
    await server.query(`CREATE DATABASE ${dbName}`);
    await server.end();

    const testDbUrl = new URL(ADMIN_URL);
    testDbUrl.pathname = `/${dbName}`;
    const appDbUrl = new URL(testDbUrl);
    appDbUrl.username = 'resume_app';
    appDbUrl.password = appPassword;
    appDbUrlForChild = appDbUrl.href;

    const backendDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
    await promisify(execFile)(process.execPath, ['src/migrate.js'], {
      cwd: backendDir,
      env: { ...process.env, MIGRATION_DATABASE_URL: testDbUrl.href, APP_DB_PASSWORD: appPassword },
    });

    // config.js reads process.env when first imported, so set it before importing the app.
    Object.assign(process.env, {
      NODE_ENV: 'test',
      DATABASE_URL: appDbUrl.href,
      JWT_SECRET: 'test-secret',
      CLIENT_ORIGIN: ORIGIN,
      ANTHROPIC_API_KEY: '', // never call the real AI from tests
      // The global limit (120 requests/minute per IP) stays on in tests. This
      // suite sends more than that from one machine, so each request below
      // gets its own X-Forwarded-For address instead.
      TRUST_PROXY: 'true',
    });
    db = await import('../src/db.js');
    const { createApp } = await import('../src/app.js');

    admin = new pg.Client({ connectionString: testDbUrl.href });
    await admin.connect();

    const server2 = await new Promise((resolve) => {
      const s = createApp().listen(0, '127.0.0.1', () => resolve(s));
    });
    const base = `http://127.0.0.1:${server2.address().port}`;
    api = {
      server: server2,
      base,
      async call(urlPath, init = {}) {
        const n = ++requestCount;
        const headers = { 'X-Forwarded-For': `198.18.${Math.floor(n / 250) % 250}.${(n % 250) + 1}`, ...init.headers };
        const res = await fetch(base + urlPath, { ...init, headers });
        const text = await res.text();
        let body;
        try { body = JSON.parse(text); } catch { body = text; }
        return { status: res.status, body, headers: res.headers };
      },
    };

    alice = await signup('alice@example.com');
    bob = await signup('bob@example.com');
    alice.rows = await seedOwnedRows(alice.id);
  });

  after(async () => {
    await new Promise((resolve) => (api?.server ? api.server.close(resolve) : resolve()));
    await db?.pool.end();
    await admin?.end();
    const server = new pg.Client({ connectionString: ADMIN_URL });
    await server.connect();
    await server.query(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`);
    await server.end();
  });

  describe('migrations and auth', () => {
    test('health check reports the database as up', async () => {
      const { status, body } = await api.call('/api/health');
      assert.equal(status, 200);
      assert.deepEqual(body, { ok: true, db: 'up' });
    });

    test('the API connects as resume_app, which is not a superuser and cannot bypass RLS', async () => {
      const { rows } = await db.pool.query(
        'SELECT current_user AS name, rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user'
      );
      assert.deepEqual(rows[0], { name: 'resume_app', rolsuper: false, rolbypassrls: false });
    });

    test('a user can log in and read their own account', async () => {
      const login = await api.call('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
        body: JSON.stringify({ email: 'alice@example.com', password: PASSWORD }),
      });
      assert.equal(login.status, 200);
      const cookie = login.headers.get('set-cookie').split(';')[0];
      const me = await api.call('/api/auth/me', { headers: { Cookie: cookie } });
      assert.equal(me.status, 200);
      assert.equal(me.body.user.email, 'alice@example.com');
    });

    // Audit #7: without a bcrypt check for unknown emails, the fast answer
    // revealed which emails have accounts.
    test('an unknown email takes about as long as a wrong password', async () => {
      const timeLogin = async (email) => {
        const start = performance.now();
        const res = await api.call('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
          body: JSON.stringify({ email, password: 'Wr0ngPassword' }),
        });
        assert.equal(res.status, 401);
        assert.equal(res.body.error, 'Invalid email or password.');
        return performance.now() - start;
      };
      const median = (xs) => xs.sort((a, b) => a - b)[Math.floor(xs.length / 2)];
      const wrongPassword = [];
      const unknownEmail = [];
      for (let i = 0; i < 3; i++) {
        wrongPassword.push(await timeLogin('alice@example.com'));
        unknownEmail.push(await timeLogin(`nobody-${i}@example.com`));
      }
      assert.ok(
        median(unknownEmail) > median(wrongPassword) * 0.5,
        `unknown email ${median(unknownEmail).toFixed(0)}ms vs wrong password ${median(wrongPassword).toFixed(0)}ms`
      );
    });

    test('login with a non-string email or password is a 400, not a server error', async () => {
      for (const body of [
        { email: ['alice@example.com'], password: PASSWORD },
        { email: 123, password: PASSWORD },
        { email: 'alice@example.com', password: { x: 1 } },
      ]) {
        const res = await api.call('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
          body: JSON.stringify(body),
        });
        assert.equal(res.status, 400, `${JSON.stringify(body)} gave ${res.status}`);
      }
    });

    test('the session token only travels in the HttpOnly cookie, never in a response body', async () => {
      const res = await api.call('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
        body: JSON.stringify({ email: 'alice@example.com', password: PASSWORD }),
      });
      const token = res.headers.get('set-cookie').match(/^token=([^;]+)/)[1];
      assert.deepEqual(Object.keys(res.body), ['user']);
      assert.deepEqual(Object.keys(res.body.user).sort(), ['email', 'id']);
      assert.ok(!JSON.stringify(res.body).includes(token));
      const me = await api.call('/api/auth/me', { headers: { Cookie: `token=${token}` } });
      assert.ok(!JSON.stringify(me.body).includes(token));
      assert.ok(!JSON.stringify(me.body).includes('test-secret'));
    });

    test('a deleted user\'s old session token stops working', async () => {
      const dave = await signup('dave@example.com');
      const del = await api.call('/api/auth/me', { method: 'DELETE', headers: { Cookie: dave.cookie, Origin: ORIGIN } });
      assert.equal(del.status, 200);
      const reuse = await api.call('/api/resumes', { headers: { Cookie: dave.cookie } });
      assert.equal(reuse.status, 401);
    });

    test('a wrong password is rejected', async () => {
      const res = await api.call('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
        body: JSON.stringify({ email: 'alice@example.com', password: 'Wr0ngPassword' }),
      });
      assert.equal(res.status, 401);
    });
  });

  // These queries deliberately have no "WHERE user_id = ..." so only the
  // database policies stand between one user and another user's data.
  describe('row-level security (SQL level)', () => {
    for (const table of ['users', 'resumes', 'job_postings', 'analyses', 'bullet_suggestions']) {
      test(`another user sees none of the owner's rows in ${table}`, async () => {
        const asOwner = await db.withUserContext(alice.id, () => db.query(`SELECT * FROM ${table}`));
        assert.ok(asOwner.rows.length > 0, `alice should see her own ${table} rows`);
        const asOther = await db.withUserContext(bob.id, () => db.query(`SELECT * FROM ${table}`));
        const leaked = asOther.rows.filter((r) => asOwner.rows.some((o) => o.id === r.id));
        assert.deepEqual(leaked, []);
      });

      test(`a query with no user context sees no rows in ${table}`, async () => {
        const { rows } = await db.query(`SELECT * FROM ${table}`);
        assert.deepEqual(rows, []);
      });
    }

    test('a user cannot insert a row owned by someone else', async () => {
      await assert.rejects(
        db.withUserContext(bob.id, () => db.query(
          `INSERT INTO resumes (user_id, original_filename, mime_type, size_bytes, extracted_text)
           VALUES ($1, 'x.pdf', 'application/pdf', 1, 'x')`,
          [alice.id]
        )),
        { code: '42501' } // insufficient_privilege: new row violates row-level security policy
      );
    });

    test('a user cannot attach an analysis to someone else\'s resume', async () => {
      const bobJob = await db.withUserContext(bob.id, () => db.query(
        `INSERT INTO job_postings (user_id, raw_text) VALUES ($1, 'Bob job') RETURNING id`, [bob.id]
      ));
      await assert.rejects(
        db.withUserContext(bob.id, () => db.query(
          'INSERT INTO analyses (resume_id, job_posting_id) VALUES ($1, $2)',
          [alice.rows.resumeId, bobJob.rows[0].id]
        )),
        { code: '42501' }
      );
    });

    test('a user cannot update or delete someone else\'s rows', async () => {
      const updated = await db.withUserContext(bob.id, () => db.query(
        "UPDATE resumes SET original_filename = 'hacked.pdf' WHERE id = $1", [alice.rows.resumeId]
      ));
      const deleted = await db.withUserContext(bob.id, () => db.query(
        'DELETE FROM job_postings WHERE id = $1', [alice.rows.jobId]
      ));
      assert.equal(updated.rowCount, 0);
      assert.equal(deleted.rowCount, 0);
      const { rows } = await admin.query('SELECT original_filename FROM resumes WHERE id = $1', [alice.rows.resumeId]);
      assert.equal(rows[0].original_filename, 'cv.pdf');
    });
  });

  describe('resume upload', () => {
    const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    const upload = (cookie, file, name = 'cv.pdf', type = 'application/pdf') => {
      const form = new FormData();
      form.append('file', new Blob([file], { type }), name);
      return api.call('/api/resumes', { method: 'POST', headers: { Cookie: cookie, Origin: ORIGIN }, body: form });
    };
    const countResumes = async (userId) =>
      Number((await admin.query('SELECT COUNT(*) FROM resumes WHERE user_id = $1', [userId])).rows[0].count);

    test('a normal resume uploads and is saved (AI off: kept with a parse error)', async () => {
      const before = await countResumes(alice.id);
      const res = await upload(alice.cookie, await makePdf(2, 'Software Engineer at Acme. Built REST APIs in Node.js.'));
      assert.equal(res.status, 201, JSON.stringify(res.body));
      assert.equal(res.body.resume.filename, 'cv.pdf');
      assert.equal(await countResumes(alice.id), before + 1);
    });

    test('an oversized resume is rejected with a clear 422 and nothing is saved', async () => {
      const before = await countResumes(alice.id);
      const res = await upload(alice.cookie, await makePdf(25, 'Page'));
      assert.equal(res.status, 422);
      assert.equal(res.body.code, 'RESUME_TOO_LONG');
      assert.match(res.body.error, /pages/);
      assert.equal(await countResumes(alice.id), before);
    });

    test('a normal DOCX uploads and is saved', async () => {
      const before = await countResumes(alice.id);
      const res = await upload(alice.cookie, makeDocx('Software Engineer at Acme. Built REST APIs.'), 'cv.docx', DOCX_MIME);
      assert.equal(res.status, 201, JSON.stringify(res.body));
      assert.equal(await countResumes(alice.id), before + 1);
    });

    test('a DOCX zip bomb is rejected with a clear 422 and nothing is saved', async () => {
      const before = await countResumes(alice.id);
      const bomb = makeDocx('Hi', { padding: Buffer.alloc(MAX_DOCX_UNCOMPRESSED_BYTES * 2, ' ') });
      const res = await upload(alice.cookie, bomb, 'cv.docx', DOCX_MIME);
      assert.equal(res.status, 422);
      assert.equal(res.body.code, 'RESUME_TOO_LONG');
      assert.match(res.body.error, /too large/);
      assert.equal(await countResumes(alice.id), before);
    });
  });

  // The limits on the paid AI calls (upload -> resume parsing, job posting ->
  // job parsing, bullet rewrite) are off in tests, so this starts the real
  // server as a separate process in development mode, where they are on.
  // Limits must count per user: people on one IP (campus Wi-Fi) don't share
  // an allowance, and one user can't reset theirs by changing IP.
  describe('rate limits on AI calls (real server, limiters on)', () => {
    let child;
    let base;
    const SHARED_IP = '203.0.113.10';
    const call = (path, { cookie, ip = SHARED_IP, json } = {}) => fetch(base + path, {
      method: 'POST',
      headers: { Origin: ORIGIN, 'X-Forwarded-For': ip, ...(cookie ? { Cookie: cookie } : {}), ...(json ? { 'Content-Type': 'application/json' } : {}) },
      body: json ? JSON.stringify(json) : undefined,
    });
    const signupOn = async (email) => {
      const res = await call('/api/auth/signup', { json: { email, password: PASSWORD } });
      assert.equal(res.status, 201, `signup ${email}`);
      return res.headers.get('set-cookie').split(';')[0];
    };

    before(async () => {
      const { spawn } = await import('node:child_process');
      const net = await import('node:net');
      const port = await new Promise((resolve) => {
        const s = net.createServer().listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => resolve(p)); });
      });
      base = `http://127.0.0.1:${port}`;
      child = spawn(process.execPath, ['src/index.js'], {
        cwd: path.join(path.dirname(fileURLToPath(import.meta.url)), '..'),
        env: {
          PATH: process.env.PATH, SystemRoot: process.env.SystemRoot,
          NODE_ENV: 'development', PORT: String(port), DATABASE_URL: appDbUrlForChild,
          JWT_SECRET: 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90',
          CLIENT_ORIGIN: ORIGIN, TRUST_PROXY: '1', ANTHROPIC_API_KEY: '',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('server did not start')), 15_000);
        child.stdout.on('data', (d) => { if (String(d).includes('listening')) { clearTimeout(timer); resolve(); } });
        child.on('exit', (code) => { clearTimeout(timer); reject(new Error(`server exited (${code})`)); });
      });
    });
    after(() => child?.kill());

    for (const [name, limit, request] of [
      ['resume upload', 10, (cookie, ip) => call('/api/resumes', { cookie, ip })],
      ['job posting', 10, (cookie, ip) => call('/api/job-postings', { cookie, ip, json: { text: 'too short' } })],
      ['AI bullet rewrite', 5, (cookie, ip) => call('/api/analyses/1/bullets/exp0-b0/generate', { cookie, ip })],
    ]) {
      test(`${name}: ${limit} per user per 15 minutes, not shared by an IP, not reset by changing IP`, async () => {
        const tag = name.replace(/\W+/g, '-');
        const userA = await signupOn(`rl-a-${tag}@example.com`);
        const userB = await signupOn(`rl-b-${tag}@example.com`);
        let allowed = 0;
        while (allowed < limit + 5 && (await request(userA, SHARED_IP)).status !== 429) allowed++;
        assert.equal(allowed, limit, `user A was allowed ${allowed}`);
        const blocked = await request(userA, SHARED_IP);
        assert.equal(blocked.status, 429);
        assert.equal((await blocked.json()).code, 'RATE_LIMITED');
        assert.equal((await request(userA, '198.51.100.77')).status, 429, 'changing IP does not reset the limit');
        assert.notEqual((await request(userB, SHARED_IP)).status, 429, 'another user on the same IP still has their own allowance');
      });
    }
  });

  // Cross-site request forgery: another website making a logged-in user's
  // browser send a request to the API. Defenses: every POST/DELETE must carry
  // the app's own Origin (app.js requireTrustedOrigin), the session cookie is
  // SameSite=Lax, CORS only trusts the app's origin, and GETs never change data.
  // Each attack runs with a real session and must change nothing at all.
  describe('CSRF protection', () => {
    const EVIL = 'https://evil.example';
    // Fingerprint of every row in every table: any change shows up.
    const snapshot = async () => {
      const out = {};
      for (const t of ['users', 'resumes', 'job_postings', 'analyses', 'bullet_suggestions']) {
        out[t] = (await admin.query(`SELECT count(*)::int AS n, md5(coalesce(string_agg(${t}::text, '|' ORDER BY id), '')) AS h FROM ${t}`)).rows[0];
      }
      return out;
    };
    const attack = (method, path, { origin = EVIL, cookie = alice.cookie, contentType = 'application/json', body } = {}) =>
      api.call(path, {
        method,
        headers: {
          ...(origin !== undefined ? { Origin: origin } : {}),
          ...(cookie ? { Cookie: cookie } : {}),
          ...(body !== undefined ? { 'Content-Type': contentType } : {}),
        },
        body,
      });
    const blocked = (res, label) => {
      assert.equal(res.status, 403, `${label}: ${res.status} ${JSON.stringify(res.body)}`);
      assert.equal(res.body.code, 'UNTRUSTED_ORIGIN', label);
      assert.equal(res.headers.get('set-cookie'), null, `${label}: no cookie set or cleared`);
    };

    test('every state-changing route refuses another website, and nothing changes', async () => {
      const r = alice.rows;
      const routes = [
        ['POST', '/api/auth/signup', { email: 'csrf-new@example.com', password: PASSWORD }],
        ['POST', '/api/auth/login', { email: 'alice@example.com', password: PASSWORD }],
        ['POST', '/api/auth/logout', {}],
        ['DELETE', '/api/auth/me'],
        ['POST', '/api/resumes', {}],
        ['DELETE', `/api/resumes/${r.resumeId}`],
        ['POST', '/api/job-postings', { text: 'Backend developer role. Required: Node.js, PostgreSQL, Docker, REST APIs.' }],
        ['DELETE', `/api/job-postings/${r.jobId}`],
        ['POST', '/api/analyses', { resumeId: r.resumeId, jobPostingId: r.jobId }],
        ['POST', `/api/analyses/${r.analysisId}/bullets/exp0-b0/generate`, {}],
        ['POST', `/api/analyses/${r.analysisId}/bullets/exp0-b0/select`, { text: 'Changed by another website' }],
      ];
      const before = await snapshot();
      for (const [method, path, json] of routes) {
        blocked(await attack(method, path, { body: json === undefined ? undefined : JSON.stringify(json) }), `${method} ${path}`);
      }
      assert.deepEqual(await snapshot(), before, 'the database must be untouched');
      assert.equal((await api.call('/api/auth/me', { headers: { Cookie: alice.cookie } })).status, 200, 'alice is still logged in');
    });

    test('a missing, "null" or look-alike Origin is refused too', async () => {
      const before = await snapshot();
      for (const origin of [
        null, // header left out entirely
        'null', // sandboxed iframes, data: URLs, some redirects
        'http://localhost:5173.evil.example',
        'http://localhost:51730',
        'https://localhost:5173', // same host, different scheme
        'http://evil.example?http://localhost:5173',
      ]) {
        const res = await attack('DELETE', `/api/resumes/${alice.rows.resumeId}`, { origin: origin ?? undefined });
        blocked(res, `Origin ${JSON.stringify(origin)}`);
      }
      assert.deepEqual(await snapshot(), before);
    });

    test('classic form-style attacks (no preflight) are refused', async () => {
      const before = await snapshot();
      for (const [contentType, body] of [
        ['application/x-www-form-urlencoded', 'text=Backend+role+requiring+Node.js+and+PostgreSQL+for+our+team'],
        ['text/plain', '{"text":"Backend role requiring Node.js and PostgreSQL for our team"}'],
        ['multipart/form-data; boundary=x', '--x\r\nContent-Disposition: form-data; name="text"\r\n\r\nhi\r\n--x--\r\n'],
      ]) {
        blocked(await attack('POST', '/api/job-postings', { contentType, body }), contentType);
      }
      assert.deepEqual(await snapshot(), before);
    });

    test('login CSRF: another website cannot log the browser into an account', async () => {
      const res = await attack('POST', '/api/auth/login', {
        cookie: null,
        body: JSON.stringify({ email: 'bob@example.com', password: PASSWORD }),
      });
      blocked(res, 'login from another website');
    });

    test('CORS never lets another website read responses or send credentialed requests', async () => {
      const preflight = await api.call(`/api/resumes/${alice.rows.resumeId}`, {
        method: 'OPTIONS',
        headers: { Origin: EVIL, 'Access-Control-Request-Method': 'DELETE', 'Access-Control-Request-Headers': 'content-type' },
      });
      assert.equal(preflight.headers.get('access-control-allow-origin'), null);
      assert.equal(preflight.headers.get('access-control-allow-credentials'), null);
      const read = await api.call('/api/resumes', { headers: { Origin: EVIL, Cookie: alice.cookie } });
      assert.equal(read.headers.get('access-control-allow-origin'), null, 'the browser hides the response from evil.example');
    });

    test('the session cookie is HttpOnly and SameSite=Lax', async () => {
      const res = await api.call('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
        body: JSON.stringify({ email: 'bob@example.com', password: PASSWORD }),
      });
      const cookie = res.headers.get('set-cookie');
      assert.match(cookie, /^token=/);
      assert.match(cookie, /HttpOnly/i);
      assert.match(cookie, /SameSite=Lax/i);
    });

    // SameSite=Lax still sends the cookie on top-level GET navigations, so no GET may change data.
    test('GET routes never change data', async () => {
      const r = alice.rows;
      const before = await snapshot();
      for (const path of [
        '/api/health', '/api/auth/me', '/api/resumes', `/api/resumes/${r.resumeId}`, '/api/job-postings', `/api/job-postings/${r.jobId}`,
        '/api/analyses', `/api/analyses/${r.analysisId}`, `/api/analyses/${r.analysisId}/bullets`, `/api/analyses/${r.analysisId}/export`,
      ]) {
        await api.call(path, { headers: { Cookie: alice.cookie, Origin: EVIL } });
      }
      assert.deepEqual(await snapshot(), before);
    });

    test('the same requests from the app itself still work', async () => {
      const ok = await api.call(`/api/analyses/${alice.rows.analysisId}/bullets/exp0-b0/select`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: ORIGIN, Cookie: alice.cookie },
        body: JSON.stringify({ text: 'Built APIs', confirmUnverified: true }),
      });
      assert.notEqual(ok.status, 403, JSON.stringify(ok.body));
    });
  });

  // Every way an upload can be wrong or hostile. Requests are built by hand so
  // the test controls exactly what the server receives (names, types, parts).
  describe('upload validation', () => {
    const PDF = 'application/pdf';
    const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    let boundaryN = 0;
    // parts: [{ name, filename?, type?, data }]
    const multipart = (parts) => {
      const boundary = `----qa${++boundaryN}`;
      const chunks = [];
      for (const p of parts) {
        const disp = `form-data; name="${p.name}"${p.filename != null ? `; filename="${p.filename}"` : ''}`;
        chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: ${disp}\r\n${p.type ? `Content-Type: ${p.type}\r\n` : ''}\r\n`));
        chunks.push(Buffer.isBuffer(p.data) ? p.data : Buffer.from(p.data));
        chunks.push(Buffer.from('\r\n'));
      }
      chunks.push(Buffer.from(`--${boundary}--\r\n`));
      return { body: Buffer.concat(chunks), contentType: `multipart/form-data; boundary=${boundary}` };
    };
    const send = ({ body, contentType }, { cookie = alice.cookie, origin = ORIGIN } = {}) =>
      api.call('/api/resumes', {
        method: 'POST',
        headers: { 'Content-Type': contentType, ...(cookie ? { Cookie: cookie } : {}), ...(origin ? { Origin: origin } : {}) },
        body,
      });
    const countResumes = async () => Number((await admin.query('SELECT COUNT(*) FROM resumes WHERE user_id = $1', [alice.id])).rows[0].count);
    let goodPdf;
    before(async () => { goodPdf = await makePdf(1, 'Software Engineer at Acme. Built REST APIs in Node.js.'); });
    const file = (data, { filename = 'cv.pdf', type = PDF, name = 'file' } = {}) => ({ name, filename, type, data });

    // Rejected uploads must store nothing.
    const rejects = async (request, status, code, opts) => {
      const before = await countResumes();
      const res = await send(request, opts);
      assert.equal(res.status, status, `${JSON.stringify(res.body)}`);
      if (code) assert.equal(res.body.code, code);
      assert.equal(await countResumes(), before, 'nothing stored');
      return res;
    };

    test('not logged in -> 401; another website -> 403', async () => {
      await rejects(multipart([file(goodPdf)]), 401, 'NO_SESSION', { cookie: null });
      await rejects(multipart([file(goodPdf)]), 403, 'UNTRUSTED_ORIGIN', { origin: 'https://evil.example' });
    });

    test('no file, or the file under the wrong field name -> 400', async () => {
      await rejects(multipart([{ name: 'note', data: 'hello' }]), 400);
      await rejects(multipart([file(goodPdf, { name: 'resume' })]), 400);
    });

    test('more than one file -> 400', async () => {
      await rejects(multipart([file(goodPdf), file(goodPdf, { filename: 'cv2.pdf' })]), 400);
    });

    test('types other than PDF and DOCX -> 400', async () => {
      await rejects(multipart([file('plain text resume', { filename: 'cv.txt', type: 'text/plain' })]), 400, 'UNSUPPORTED_FILE_TYPE');
      await rejects(multipart([file(Buffer.from([0xd0, 0xcf, 0x11, 0xe0]), { filename: 'cv.doc', type: 'application/msword' })]), 400, 'UNSUPPORTED_FILE_TYPE');
      await rejects(multipart([file(Buffer.from('MZ\x90\x00'), { filename: 'cv.exe', type: 'application/x-msdownload' })]), 400, 'UNSUPPORTED_FILE_TYPE');
      await rejects(multipart([file(Buffer.from('<svg onload=alert(1)>'), { filename: 'cv.svg', type: 'image/svg+xml' })]), 400, 'UNSUPPORTED_FILE_TYPE');
    });

    test('content that does not match the claimed type -> 400 (bytes are checked, not the label)', async () => {
      await rejects(multipart([file('just text pretending to be a PDF')]), 400, 'UNSUPPORTED_FILE_TYPE');
      await rejects(multipart([file(goodPdf, { filename: 'cv.docx', type: DOCX })]), 400, 'UNSUPPORTED_FILE_TYPE');
      await rejects(multipart([file(makeDocx('Hi'), { filename: 'cv.pdf', type: PDF })]), 400, 'UNSUPPORTED_FILE_TYPE');
      await rejects(multipart([file(Buffer.alloc(0))]), 400, 'UNSUPPORTED_FILE_TYPE');
    });

    test('over 10 MB -> 413', async () => {
      const big = Buffer.concat([goodPdf, Buffer.alloc(10 * 1024 * 1024)]);
      await rejects(multipart([file(big)]), 413, 'FILE_TOO_LARGE');
    });

    test('a corrupt PDF, or one with no readable text -> 422 with a friendly message', async () => {
      const corrupt = await rejects(multipart([file(Buffer.from('%PDF-1.7\nthis is not really a pdf'))]), 422, 'UNREADABLE_FILE');
      assert.equal(corrupt.body.error, "We couldn't read any text from that file. Try a different PDF or DOCX.", 'no parser internals');
      await rejects(multipart([file(await makePdf(1, ''))]), 422, 'UNREADABLE_FILE');
    });

    // Extra text fields were unlimited (up to 1 MB each, all kept in memory).
    test('extra form fields are refused (the app only sends the file)', async () => {
      const filler = Array.from({ length: 20 }, (_, i) => ({ name: `junk${i}`, data: 'x'.repeat(100 * 1024) }));
      await rejects(multipart([...filler, file(goodPdf)]), 400);
      await rejects(multipart([{ name: 'note', data: 'hi' }, file(goodPdf)]), 400);
    });

    test('a valid upload still works and keeps an accented file name intact', async () => {
      const name = 'Résumé – Zoë Ñúñez.pdf';
      const before = await countResumes();
      const res = await send(multipart([file(goodPdf, { filename: name })]));
      assert.equal(res.status, 201, JSON.stringify(res.body));
      assert.equal(res.body.resume.filename, name);
      assert.equal(await countResumes(), before + 1);
    });

    // A raw control character in the upload header is malformed; the parser
    // rejects it, and that used to surface as a 500 "something went wrong".
    test('a malformed or cut-off upload -> 400, not a server error', async () => {
      await rejects(multipart([file(goodPdf, { filename: 'cv\x07.pdf' })]), 400, 'MALFORMED_UPLOAD');
      const { body, contentType } = multipart([file(goodPdf)]);
      await rejects({ body: body.subarray(0, body.length - 40), contentType }, 400, 'MALFORMED_UPLOAD');
    });

    // Control characters can still arrive encoded (RFC 5987 filename*=), and
    // names can be very long; both are cleaned before the name is stored.
    test('file names are cleaned: control characters removed, length capped', async () => {
      const encoded = `cv%07%1B%5B31m%0A-${'a'.repeat(400)}.pdf`;
      const boundary = '----qaencoded';
      const body = Buffer.concat([
        Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename*=UTF-8''${encoded}\r\nContent-Type: application/pdf\r\n\r\n`),
        goodPdf,
        Buffer.from(`\r\n--${boundary}--\r\n`),
      ]);
      const res = await send({ body, contentType: `multipart/form-data; boundary=${boundary}` });
      assert.equal(res.status, 201, JSON.stringify(res.body));
      const stored = res.body.resume.filename;
      assert.doesNotMatch(stored, /[\x00-\x1f\x7f]/, 'no control characters');
      assert.ok(stored.length <= 255, `length ${stored.length}`);
      assert.ok(stored.startsWith('cv[31m -aaa'), JSON.stringify(stored.slice(0, 20)));
    });
  });

  // SQL injection and stored XSS payloads in every input the API accepts. The
  // input must be stored and returned as plain text, change nothing else, and
  // come back only as JSON (escaping for display is React's job, and the
  // frontend tests check that).
  describe('SQL injection and XSS payloads (live)', () => {
    const SQLI = "x' OR '1'='1'; DROP TABLE users; --";
    const XSS = '<img src=x onerror=alert(1)><script>alert(2)</script>';
    const post = (path, body, cookie) => api.call(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: ORIGIN, ...(cookie ? { Cookie: cookie } : {}) },
      body: JSON.stringify(body),
    });
    const tablesIntact = async () => {
      const { rows } = await admin.query(
        "SELECT count(*)::int AS n FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('users','resumes','job_postings','analyses','bullet_suggestions')"
      );
      assert.equal(rows[0].n, 5, 'a table was dropped');
    };

    test('login: classic injection strings do not log anyone in', async () => {
      for (const body of [
        { email: "alice@example.com' --", password: 'anything' },
        { email: "' OR '1'='1", password: "' OR '1'='1" },
        { email: 'alice@example.com', password: "' OR '1'='1' --" },
        { email: SQLI, password: SQLI },
      ]) {
        const res = await post('/api/auth/login', body);
        assert.ok([400, 401].includes(res.status), `${JSON.stringify(body)} gave ${res.status}`);
        assert.equal(res.headers.get('set-cookie'), null, 'no session issued');
      }
      await tablesIntact();
    });

    test('sign-up: an injection string is rejected as an invalid email, and a password containing SQL is just a password', async () => {
      assert.equal((await post('/api/auth/signup', { email: SQLI, password: PASSWORD })).status, 400);
      const tricky = "Aa1' OR '1'='1";
      const created = await post('/api/auth/signup', { email: 'tricky@example.com', password: tricky });
      assert.equal(created.status, 201);
      assert.equal((await post('/api/auth/login', { email: 'tricky@example.com', password: "' OR '1'='1" })).status, 401);
      assert.equal((await post('/api/auth/login', { email: 'tricky@example.com', password: tricky })).status, 200);
      await tablesIntact();
    });

    test('resume file name: stored as plain text, returned as JSON, and made safe in the download header', async () => {
      // No "/" in the name: the upload parser keeps only what follows the last
      // slash (like a folder path), which would cut "</script>" short.
      const name = `${SQLI} <img src=x onerror=alert(1)>".pdf`;
      const form = new FormData();
      form.append('file', new Blob([await makePdf(1, 'Software Engineer. Built REST APIs.')], { type: 'application/pdf' }), name);
      const up = await api.call('/api/resumes', { method: 'POST', headers: { Cookie: alice.cookie, Origin: ORIGIN }, body: form });
      assert.equal(up.status, 201, JSON.stringify(up.body));
      assert.match(up.headers.get('content-type'), /^application\/json/);
      assert.equal(up.body.resume.filename, name, 'kept verbatim');
      const { rows } = await admin.query('SELECT original_filename FROM resumes WHERE id = $1', [up.body.resume.id]);
      assert.equal(rows[0].original_filename, name);
      await tablesIntact();

      // Export of a resume with this name: the attachment file name has no quotes, tags or script.
      await admin.query(`UPDATE resumes SET parsed_data = '{"experience":[]}' WHERE id = $1`, [up.body.resume.id]);
      const analysis = await admin.query(
        "INSERT INTO analyses (resume_id, job_posting_id, status, score) VALUES ($1, $2, 'complete', 50) RETURNING id",
        [up.body.resume.id, alice.rows.jobId]
      );
      const res = await fetch(`${api.base}/api/analyses/${analysis.rows[0].id}/export`, { headers: { Cookie: alice.cookie } });
      assert.equal(res.status, 200);
      const disposition = res.headers.get('content-disposition');
      assert.match(disposition, /^attachment; filename="[A-Za-z0-9_-]+-updated\.pdf"$/, disposition);
    });

    test('list paging: injection in ?page and ?limit is ignored', async () => {
      for (const qs of ['?limit=1;DROP%20TABLE%20users', "?page=1%20OR%201=1", '?limit=-5&page=abc', "?limit=1'--"]) {
        const res = await api.call(`/api/resumes${qs}`, { headers: { Cookie: alice.cookie } });
        assert.equal(res.status, 200, qs);
        assert.ok(Array.isArray(res.body.resumes));
        assert.ok(res.body.resumes.every((r) => r.id), 'only real rows');
      }
      const bobView = await api.call("/api/resumes?limit=100'%20OR%20'1'='1", { headers: { Cookie: bob.cookie } });
      assert.equal(bobView.body.resumes.length, 0, 'no other user\'s rows leak');
      await tablesIntact();
    });

    test('bullet text: saved verbatim, not executed', async () => {
      const payload = `Built APIs ${SQLI} ${XSS}`.slice(0, 290);
      await admin.query(
        `UPDATE resumes SET parsed_data = '{"experience":[{"title":"Dev","company":"Acme","dates":"","bullets":[{"id":"exp0-b0","text":"Built APIs"}]}]}' WHERE id = $1`,
        [alice.rows.resumeId]
      );
      const res = await post(`/api/analyses/${alice.rows.analysisId}/bullets/exp0-b0/select`, { text: payload, confirmUnverified: true }, alice.cookie);
      assert.equal(res.status, 200, JSON.stringify(res.body));
      assert.equal(res.body.suggestion.selectedText, payload);
      const { rows } = await admin.query('SELECT selected_text FROM bullet_suggestions WHERE analysis_id = $1 AND bullet_id = $2', [alice.rows.analysisId, 'exp0-b0']);
      assert.equal(rows[0].selected_text, payload);
      await tablesIntact();
    });
  });

  describe('row-level security (through the API)', () => {
    const asBob = () => ({ headers: { Cookie: bob.cookie, Origin: ORIGIN } });

    test('list endpoints only return the caller\'s own data', async () => {
      for (const [urlPath, key, aliceId] of [
        ['/api/resumes', 'resumes', alice.rows.resumeId],
        ['/api/job-postings', 'jobPostings', alice.rows.jobId],
        ['/api/analyses', 'analyses', alice.rows.analysisId],
      ]) {
        const res = await api.call(urlPath, asBob());
        assert.equal(res.status, 200);
        assert.ok(!res.body[key].some((r) => r.id === aliceId), `${urlPath} leaked alice's row`);
      }
    });

    test('fetching another user\'s resume, job posting or analysis returns 404', async () => {
      for (const urlPath of [
        `/api/resumes/${alice.rows.resumeId}`,
        `/api/job-postings/${alice.rows.jobId}`,
        `/api/analyses/${alice.rows.analysisId}`,
        `/api/analyses/${alice.rows.analysisId}/bullets`,
        `/api/analyses/${alice.rows.analysisId}/export`,
      ]) {
        const res = await api.call(urlPath, asBob());
        assert.equal(res.status, 404, `${urlPath} should be 404 for another user`);
      }
    });

    // Audit #10: a non-numeric id reached Postgres as an INTEGER and made it
    // throw, which came back as a 500 instead of a 404.
    test('malformed ids return 404, not a server error', async () => {
      for (const [method, urlPath] of [
        ['GET', '/api/resumes/abc'],
        ['DELETE', '/api/resumes/1%20OR%201=1'],
        ['GET', '/api/job-postings/-1'],
        ['DELETE', '/api/job-postings/1.5'],
        ['GET', '/api/analyses/abc'],
        ['GET', '/api/analyses/abc/bullets'],
        ['GET', '/api/analyses/99999999999999999999/export'],
      ]) {
        const res = await api.call(urlPath, { method, ...asBob() });
        assert.equal(res.status, 404, `${method} ${urlPath} gave ${res.status}`);
      }
      for (const body of [
        { resumeId: 'abc', jobPostingId: 1 },
        { resumeId: alice.rows.resumeId, jobPostingId: { x: 1 } },
        { resumeId: ['1'], jobPostingId: 1 }, // String(['1']) === '1', but pg sends it as '{"1"}'
        { resumeId: 1, jobPostingId: [2] },
      ]) {
        const res = await api.call('/api/analyses', {
          method: 'POST',
          headers: { Cookie: bob.cookie, Origin: ORIGIN, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        assert.equal(res.status, 404, `POST /api/analyses ${JSON.stringify(body)} gave ${res.status}`);
      }
    });

    test('a malformed id gets the same message as a missing one', async () => {
      for (const [malformed, missing] of [
        ['/api/resumes/abc', '/api/resumes/2147483647'],
        ['/api/job-postings/abc', '/api/job-postings/2147483647'],
        ['/api/analyses/abc', '/api/analyses/2147483647'],
      ]) {
        const a = await api.call(malformed, asBob());
        const b = await api.call(missing, asBob());
        assert.equal(a.status, 404);
        assert.equal(a.body.error, b.body.error, malformed);
      }
    });

    test('deleting another user\'s resume returns 404 and leaves it in place', async () => {
      const res = await api.call(`/api/resumes/${alice.rows.resumeId}`, { method: 'DELETE', ...asBob() });
      assert.equal(res.status, 404);
      const { rowCount } = await admin.query('SELECT 1 FROM resumes WHERE id = $1', [alice.rows.resumeId]);
      assert.equal(rowCount, 1);
    });

    test('deleting an account removes that user\'s data and nobody else\'s', async () => {
      const carol = await signup('carol@example.com');
      const carolRows = await seedOwnedRows(carol.id);
      const res = await api.call('/api/auth/me', { method: 'DELETE', headers: { Cookie: carol.cookie, Origin: ORIGIN } });
      assert.equal(res.status, 200);
      const gone = await admin.query('SELECT 1 FROM resumes WHERE id = $1', [carolRows.resumeId]);
      const kept = await admin.query('SELECT 1 FROM resumes WHERE id = $1', [alice.rows.resumeId]);
      assert.equal(gone.rowCount, 0);
      assert.equal(kept.rowCount, 1);
    });
  });
});
