// Builds the Express app without starting a server, so tests can create
// their own instance. The server itself is started in index.js.
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { config } from './config.js';
import apiRoutes from './routes/index.js';
import { apiNotFound, errorHandler } from './middleware/errorHandler.js';
import { requestLogger } from './middleware/requestLogger.js';
import { forbidden } from './errors.js';

function requireTrustedOrigin(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.get('origin');
  if (!origin || !config.clientOrigins.includes(origin)) {
    return next(forbidden('This request origin is not allowed.', { code: 'UNTRUSTED_ORIGIN' }));
  }
  next();
}

const apiRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many requests. Try again shortly.', code: 'RATE_LIMITED' },
});

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);

  if (!config.isTest) app.use(requestLogger);
  // The API only returns JSON and PDF downloads, never a page, so its CSP
  // allows nothing: even if a response were opened as a page, no script in
  // user text could run, and it can't be framed. (The frontend has its own CSP.)
  app.use(helmet({
    contentSecurityPolicy: { useDefaults: false, directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
  }));
  app.use(cors({
    origin(origin, callback) {
      callback(null, Boolean(origin && config.clientOrigins.includes(origin)));
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
  }));
  app.use(cookieParser());
  app.use(express.json({ limit: config.jsonLimit }));

  app.use('/api', apiRateLimit, requireTrustedOrigin);
  app.use('/api', apiRoutes);
  app.use('/api', apiNotFound);
  app.use(errorHandler);
  return app;
}
