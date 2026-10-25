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
  let db; // ../src/db.js, connected as the restricted resume_app role
  let api;
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
      async call(urlPath, init) {
        const res = await fetch(base + urlPath, init);
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
