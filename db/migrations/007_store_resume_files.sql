-- Keep the uploaded file so users can view or download their original resume.
-- Rows uploaded before this have no file (NULL) and can only be re-uploaded.
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS file_data BYTEA;
