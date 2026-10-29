import { rateLimit } from 'express-rate-limit';

// A 15-minute limit counted per logged-in user. Use it after requireAuth:
// people sharing an IP don't share the allowance, and changing IP doesn't reset it.
export function userRateLimit({ limit, message }) {
  return rateLimit({
    keyGenerator: (req) => `user:${req.user.id}`,
    windowMs: 15 * 60 * 1000,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skip: () => process.env.NODE_ENV === 'test',
    message: { error: message, code: 'RATE_LIMITED' },
  });
}
