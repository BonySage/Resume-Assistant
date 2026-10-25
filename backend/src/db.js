import pg from 'pg';
import { AsyncLocalStorage } from 'node:async_hooks';
import { config } from './config.js';

const userContext = new AsyncLocalStorage();

export const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  connectionTimeoutMillis: 5_000, // fail fast (503/500) instead of hanging when the DB is down
});

// An idle client losing its connection (e.g. DB restart) must not crash the server.
pool.on('error', (err) => console.error('[db] idle client error:', err.code || err.name || 'unknown'));

// Parameterized queries only (NFR-2.3) — every call site passes values via $1, $2, ...
export function query(text, params) {
  const context = userContext.getStore();
  if (!context?.userId && !context?.authEmail) return pool.query(text, params);

  return (async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query("SELECT set_config('app.user_id', $1, true)", [context.userId ? String(context.userId) : '']);
      await client.query("SELECT set_config('app.auth_email', $1, true)", [context.authEmail || '']);
      const result = await client.query(text, params);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  })();
}

export function withUserContext(userId, callback) {
  return userContext.run({ ...userContext.getStore(), userId: String(userId) }, callback);
}

export function withAuthEmailContext(email, callback) {
  return userContext.run({ ...userContext.getStore(), authEmail: email.toLowerCase() }, callback);
}
