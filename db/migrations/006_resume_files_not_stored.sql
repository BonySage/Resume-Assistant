-- Resumes are now parsed in memory and the uploaded file is not kept on disk,
-- so new rows have no stored_path. Existing rows keep their value; the column
-- can be dropped in a later migration once nothing depends on it.
ALTER TABLE resumes ALTER COLUMN stored_path DROP NOT NULL;
