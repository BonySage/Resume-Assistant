-- Resumes: uploaded files + parsed structure (FR-2.1, FR-2.2)
CREATE TABLE IF NOT EXISTS resumes (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  original_filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  stored_path TEXT NOT NULL,
  extracted_text TEXT NOT NULL,
  -- { contactInfo, summary, skills: [string], experience: [{ title, company, dates, bullets: [{ id, text }] }], education: [...] }
  parsed_data JSONB,
  parse_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_resumes_user ON resumes(user_id);
