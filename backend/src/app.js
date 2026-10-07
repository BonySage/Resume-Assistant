// Builds the Express app without starting a server, so tests can create
// their own instance. The server itself is started in index.js.
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { config } from './config.js';
import apiRoutes from './routes/index.js';
import { apiNotFound, errorHandler } from './middleware/errorHandler.js';
import { requestLogger } from './middleware/requestLogger.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  // Behind a proxy (Docker, a load balancer) so req.ip / req.secure are correct.
  app.set('trust proxy', 1);

  if (!config.isTest) app.use(requestLogger);
  // NFR-2.2: HTTPS/TLS terminates in front of this in production.
  app.use(cors({ origin: config.clientOrigins, credentials: true }));
  app.use(cookieParser());
  app.use(express.json({ limit: config.jsonLimit }));

  app.use('/api', apiRoutes);
  app.use('/api', apiNotFound);
  app.use(errorHandler);
  return app;
}
