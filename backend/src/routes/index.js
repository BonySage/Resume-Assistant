// All API routers are mounted here, under /api. To add a new API:
//   1. create src/routes/<name>.js exporting an express.Router()
//   2. add one line below
import { Router } from 'express';
import { pool } from '../db.js';
import authRoutes from './auth.js';
import resumeRoutes from './resumes.js';
import jobPostingRoutes from './jobPostings.js';
import analysisRoutes from './analyses.js';

const api = Router();

// Liveness + database reachability, used by Docker and uptime checks.
api.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true, db: 'up' });
  } catch {
    res.status(503).json({ ok: false, db: 'down', error: 'The database is not reachable.' });
  }
});

api.use('/auth', authRoutes); //            FR-1 accounts & sessions
api.use('/resumes', resumeRoutes); //       FR-2 upload & parsing
api.use('/job-postings', jobPostingRoutes); // FR-3 job input & parsing
api.use('/analyses', analysisRoutes); //    FR-4 matching, FR-5 bullets, FR-6 export

export default api;
