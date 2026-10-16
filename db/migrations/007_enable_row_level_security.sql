-- Runtime requests set app.user_id locally per transaction. The API role is
-- not a table owner or superuser, so forced RLS applies to every data query.
GRANT SELECT, INSERT, UPDATE, DELETE ON users, resumes, job_postings, analyses, bullet_suggestions TO resume_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO resume_app;

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;
CREATE POLICY users_authentication_scope ON users
  USING (
    id = NULLIF(current_setting('app.user_id', true), '')::INTEGER
    OR email = NULLIF(current_setting('app.auth_email', true), '')
  )
  WITH CHECK (
    id = NULLIF(current_setting('app.user_id', true), '')::INTEGER
    OR email = NULLIF(current_setting('app.auth_email', true), '')
  );

ALTER TABLE resumes ENABLE ROW LEVEL SECURITY;
ALTER TABLE resumes FORCE ROW LEVEL SECURITY;
CREATE POLICY resumes_user_isolation ON resumes
  USING (user_id = NULLIF(current_setting('app.user_id', true), '')::INTEGER)
  WITH CHECK (user_id = NULLIF(current_setting('app.user_id', true), '')::INTEGER);

ALTER TABLE job_postings ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_postings FORCE ROW LEVEL SECURITY;
CREATE POLICY job_postings_user_isolation ON job_postings
  USING (user_id = NULLIF(current_setting('app.user_id', true), '')::INTEGER)
  WITH CHECK (user_id = NULLIF(current_setting('app.user_id', true), '')::INTEGER);

ALTER TABLE analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE analyses FORCE ROW LEVEL SECURITY;
CREATE POLICY analyses_user_isolation ON analyses
  USING (
    EXISTS (
      SELECT 1 FROM resumes
      WHERE resumes.id = analyses.resume_id
        AND resumes.user_id = NULLIF(current_setting('app.user_id', true), '')::INTEGER
    )
    AND EXISTS (
      SELECT 1 FROM job_postings
      WHERE job_postings.id = analyses.job_posting_id
        AND job_postings.user_id = NULLIF(current_setting('app.user_id', true), '')::INTEGER
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM resumes
      WHERE resumes.id = analyses.resume_id
        AND resumes.user_id = NULLIF(current_setting('app.user_id', true), '')::INTEGER
    )
    AND EXISTS (
      SELECT 1 FROM job_postings
      WHERE job_postings.id = analyses.job_posting_id
        AND job_postings.user_id = NULLIF(current_setting('app.user_id', true), '')::INTEGER
    )
  );

ALTER TABLE bullet_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bullet_suggestions FORCE ROW LEVEL SECURITY;
CREATE POLICY bullet_suggestions_user_isolation ON bullet_suggestions
  USING (EXISTS (SELECT 1 FROM analyses WHERE analyses.id = bullet_suggestions.analysis_id))
  WITH CHECK (EXISTS (SELECT 1 FROM analyses WHERE analyses.id = bullet_suggestions.analysis_id));