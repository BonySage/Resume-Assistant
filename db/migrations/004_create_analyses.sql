-- Resume-to-job match results (FR-4.1, FR-4.2)
CREATE TABLE IF NOT EXISTS analyses (
  id SERIAL PRIMARY KEY,
  resume_id INTEGER NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
  job_posting_id INTEGER NOT NULL REFERENCES job_postings(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  score INTEGER CHECK (score BETWEEN 0 AND 100),
  -- each keyword list: [string]; missing_critical/secondary split by whether the
  -- keyword came from required_skills (critical) or description/responsibilities (secondary)
  matched_keywords JSONB NOT NULL DEFAULT '[]',
  missing_critical JSONB NOT NULL DEFAULT '[]',
  missing_secondary JSONB NOT NULL DEFAULT '[]',
  weak_keywords JSONB NOT NULL DEFAULT '[]',
  recommendations JSONB NOT NULL DEFAULT '[]',
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_analyses_resume ON analyses(resume_id);
CREATE INDEX IF NOT EXISTS idx_analyses_job_posting ON analyses(job_posting_id);
