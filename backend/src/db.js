import pg from 'pg';

export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

// Parameterized queries only (NFR-2.3) — every call site passes values via $1, $2, ...
export function query(text, params) {
  return pool.query(text, params);
}
