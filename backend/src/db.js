import pg from 'pg';
import { config } from './config.js';

export const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  connectionTimeoutMillis: 5_000, // fail fast (503/500) instead of hanging when the DB is down
});

// An idle client losing its connection (e.g. DB restart) must not crash the server.
pool.on('error', (err) => console.error('[db] idle client error:', err.message));

// Parameterized queries only (NFR-2.3) — every call site passes values via $1, $2, ...
export function query(text, params) {
  return pool.query(text, params);
}
