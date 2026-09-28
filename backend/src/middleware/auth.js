import jwt from 'jsonwebtoken';
import { query } from '../db.js';
import { config } from '../config.js';
import { unauthorized } from '../errors.js';

const JWT_SECRET = config.jwtSecret;

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
  secure: config.cookieSecure,
  maxAge: SESSION_TTL_MS,
};

// Guards a router or route: sets req.user = { id, email } or responds 401.
export async function requireAuth(req, res, next) {
  const token = req.cookies?.token;
  if (!token) throw unauthorized();
  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw unauthorized('Your session expired after 15 minutes of inactivity. Please log in again.', { code: 'SESSION_EXPIRED' });
    }
    throw unauthorized();
  }
  // Database errors are real outages (500), not "logged out" — let them reach the error handler.
  const { rows } = await query('SELECT id, email FROM users WHERE id = $1', [payload.sub]);
  const user = rows[0];
  if (!user) throw unauthorized();
  req.user = user;
  // Sliding expiry: reset the 15-minute inactivity window on every request.
  res.cookie('token', signToken(user), COOKIE_OPTIONS);
  next();
}
