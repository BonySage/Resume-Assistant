import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query, withAuthEmailContext } from '../db.js';
import { signToken, requireAuth, COOKIE_OPTIONS } from '../middleware/auth.js';
import { isValidEmail, passwordStrengthError } from '../lib/validators.js';
import { rateLimit } from 'express-rate-limit';

const router = Router();
const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  message: { error: 'Too many sign-in attempts. Try again in 15 minutes.', code: 'RATE_LIMITED' },
});

function publicUser(u) {
  return { id: u.id, email: u.email };
}

router.post('/signup', authRateLimit, async (req, res) => {
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

router.post('/login', authRateLimit, async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }
  const normalizedEmail = email.toLowerCase();
  const { rows } = await withAuthEmailContext(normalizedEmail, () =>
    query('SELECT * FROM users WHERE email = $1', [normalizedEmail])
  );
  const user = rows[0];
  if (!user) return res.status(401).json({ error: 'Invalid email or password.' });
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Invalid email or password.' });
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
