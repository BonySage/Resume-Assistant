import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query, withAuthEmailContext } from '../db.js';
import { signToken, requireAuth, COOKIE_OPTIONS } from '../middleware/auth.js';
import { isValidEmail, passwordStrengthError } from '../lib/validators.js';
import { rateLimit, ipKeyGenerator } from 'express-rate-limit';

const router = Router();

// Per-IP limits. Many people can share one IP (campus Wi-Fi, an office), so
// login only counts failed attempts: successful logins never lock anyone out.
// Sign-up counts every attempt, so accounts can't be created in bulk. The two
// keep separate counters.
function ipRateLimit({ limit, skip, skipSuccessfulRequests }) {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skip,
    skipSuccessfulRequests,
    message: { error: 'Too many sign-in attempts. Try again in 15 minutes.', code: 'RATE_LIMITED' },
  });
}
export function loginIpRateLimit({ limit = 10, skip = () => process.env.NODE_ENV === 'test' } = {}) {
  return ipRateLimit({ limit, skip, skipSuccessfulRequests: true });
}
export function signupIpRateLimit({ limit = 10, skip = () => process.env.NODE_ENV === 'test' } = {}) {
  return ipRateLimit({ limit, skip, skipSuccessfulRequests: false });
}

// The per-IP limit above doesn't stop guessing spread across many IPs, so failed
// logins are also counted per email. Successful logins don't count, so the
// owner isn't locked out by their own use. Trade-off: anyone who makes 10 failed
// attempts for an email does block that account's logins for the window.
export function loginEmailRateLimit({ limit = 10, skip = () => process.env.NODE_ENV === 'test' } = {}) {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skip,
    skipSuccessfulRequests: true,
    keyGenerator: (req) => {
      // Only well-formed emails get their own key, so arbitrary (e.g. 1 MB) strings
      // can't be stored as keys; anything else is counted against the IP.
      const email = req.body?.email;
      return isValidEmail(email) && email.length <= 254 ? `email:${email.toLowerCase()}` : ipKeyGenerator(req.ip);
    },
    message: { error: 'Too many failed sign-in attempts for this account. Try again in 15 minutes.', code: 'RATE_LIMITED' },
  });
}

// Same cost (12) as real password hashes; created once, on first use.
let dummyHashPromise;
const dummyHash = () => (dummyHashPromise ??= bcrypt.hash('not-a-real-account-password', 12));

function publicUser(u) {
  return { id: u.id, email: u.email };
}

router.post('/signup', signupIpRateLimit(), async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }
  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }
  const pwError = passwordStrengthError(password);
  if (pwError) return res.status(400).json({ error: pwError });

  const normalizedEmail = email.toLowerCase();
  const existing = await withAuthEmailContext(normalizedEmail, () =>
    query('SELECT id FROM users WHERE email = $1', [normalizedEmail])
  );
  if (existing.rows[0]) {
    return res.status(409).json({ error: 'An account with that email already exists.' });
  }
  const hash = await bcrypt.hash(password, 12);
  const { rows } = await withAuthEmailContext(normalizedEmail, () =>
    query(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email',
      [normalizedEmail, hash]
    )
  );
  const user = rows[0];
  res.cookie('token', signToken(user), COOKIE_OPTIONS);
  res.status(201).json({ user: publicUser(user) });
});

router.post('/login', loginIpRateLimit(), loginEmailRateLimit(), async (req, res) => {
  const { email, password } = req.body || {};
  if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }
  const normalizedEmail = email.toLowerCase();
  const { rows } = await withAuthEmailContext(normalizedEmail, () =>
    query('SELECT * FROM users WHERE email = $1', [normalizedEmail])
  );
  const user = rows[0];
  // Run bcrypt even for an unknown email, so the response time doesn't reveal
  // which emails have accounts.
  const ok = await bcrypt.compare(password, user ? user.password_hash : await dummyHash());
  if (!user || !ok) return res.status(401).json({ error: 'Invalid email or password.' });
  res.cookie('token', signToken(user), COOKIE_OPTIONS);
  res.json({ user: publicUser(user) });
});

router.post('/logout', (req, res) => {
  res.clearCookie('token', COOKIE_OPTIONS);
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

// Settings → Delete account. Resumes, job postings, analyses and bullet
// suggestions cascade in the database (no files are kept on disk).
router.delete('/me', requireAuth, async (req, res) => {
  await query('DELETE FROM users WHERE id = $1', [req.user.id]);
  res.clearCookie('token', COOKIE_OPTIONS);
  res.json({ ok: true });
});

export default router;
