-- Job postings: input via URL or paste, parsed structure (FR-3.1, FR-3.2)
CREATE TABLE IF NOT EXISTS job_postings (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_url TEXT,
  raw_text TEXT NOT NULL,
  title TEXT,
  company TEXT,
  description TEXT,
  -- required_skills: [string], responsibilities: [string]
  required_skills JSONB NOT NULL DEFAULT '[]',
  responsibilities JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_job_postings_user ON job_postings(user_id);
