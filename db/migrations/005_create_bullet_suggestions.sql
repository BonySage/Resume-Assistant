-- AI bullet enhancement: 3 options per selected bullet, user picks/saves one (FR-5.1-5.3)
CREATE TABLE IF NOT EXISTS bullet_suggestions (
  id SERIAL PRIMARY KEY,
  analysis_id INTEGER NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
  bullet_id TEXT NOT NULL, -- matches an id inside resumes.parsed_data experience[].bullets[]
  original_text TEXT NOT NULL,
  -- options: [{ text: string, flagged: boolean }] -- flagged = failed the hallucination check
  options JSONB NOT NULL DEFAULT '[]',
  selected_index INTEGER,
  selected_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (analysis_id, bullet_id)
);

CREATE INDEX IF NOT EXISTS idx_bullet_suggestions_analysis ON bullet_suggestions(analysis_id);
