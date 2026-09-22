import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import authRoutes from './routes/auth.js';
import resumeRoutes from './routes/resumes.js';
import jobPostingRoutes from './routes/jobPostings.js';
import analysisRoutes from './routes/analyses.js';
import { pool } from './db.js';

const app = express();
const PORT = process.env.PORT || 3000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

app.use(cors({ origin: CLIENT_ORIGIN, credentials: true })); // NFR-2.2 (HTTPS/TLS terminates in front of this in production)
app.use(cookieParser());
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api/auth', authRoutes);
app.use('/api/resumes', resumeRoutes);
app.use('/api/job-postings', jobPostingRoutes);
app.use('/api/analyses', analysisRoutes);

app.use((err, req, res, next) => {
  if (err) {
    const status = err.status || 400;
    return res.status(status).json({ error: err.message || 'Something went wrong.' });
  }
  next();
});

app.listen(PORT, () => {
  console.log(`AI Resume Assistant API listening on http://localhost:${PORT}`);
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn('ANTHROPIC_API_KEY is not set — parsing/matching/bullet generation will fail until it is configured in backend/.env');
  }
  if (!process.env.DATABASE_URL) {
    console.warn('DATABASE_URL is not set — see backend/.env.example. Run `npm run migrate` after setting it.');
  }
});

process.on('SIGTERM', () => pool.end());
