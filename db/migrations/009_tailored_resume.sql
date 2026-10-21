-- Whole-resume tailoring: the 3 AI-written versions offered for an analysis,
-- and the skills the user saved as [{ category, items }] (bullets are saved in
-- bullet_suggestions).
ALTER TABLE analyses ADD COLUMN IF NOT EXISTS tailored_options JSONB;
ALTER TABLE analyses ADD COLUMN IF NOT EXISTS tailored_skills JSONB;
