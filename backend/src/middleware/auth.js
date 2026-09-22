import jwt from 'jsonwebtoken';
import { query } from '../db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-insecure-secret-change-me';

// FR-1.2: session timeout after 15 minutes of inactivity. Implemented as a
// sliding JWT expiry — every authenticated request re-issues the cookie with
// a fresh 15-minute window, so the session only actually expires once 15
// minutes pass with no requests at all.
const SESSION_TTL = '15m';
const SESSION_TTL_MS = 15 * 60 * 1000;

export function signToken(user) {
  return jwt.sign({ sub: user.id }, JWT_SECRET, { expiresIn: SESSION_TTL });
}

export const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  maxAge: SESSION_TTL_MS,
};

export async function requireAuth(req, res, next) {
  const token = req.cookies?.token;
  if (!token) return res.status(401).json({ error: 'Not authenticated', code: 'NO_SESSION' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const { rows } = await query('SELECT id, email FROM users WHERE id = $1', [payload.sub]);
    const user = rows[0];
    if (!user) return res.status(401).json({ error: 'Not authenticated', code: 'NO_SESSION' });
    req.user = user;
    // Sliding expiry: reset the 15-minute inactivity window on every request.
    res.cookie('token', signToken(user), COOKIE_OPTIONS);
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Your session expired after 15 minutes of inactivity. Please log in again.', code: 'SESSION_EXPIRED' });
    }
    return res.status(401).json({ error: 'Not authenticated', code: 'NO_SESSION' });
  }
}
