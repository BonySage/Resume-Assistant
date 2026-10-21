-- A short AI-written summary of the role, shown on the match results page.
-- Postings added before this have no summary (NULL).
ALTER TABLE job_postings ADD COLUMN IF NOT EXISTS summary TEXT;
