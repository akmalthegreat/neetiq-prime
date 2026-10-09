-- NCERT Nuggets: key NCERT lines + questions from the bank, read then solve.
-- Tables ncert_nuggets / nugget_progress already exist; add the per-question explanations and tip.
ALTER TABLE public.ncert_nuggets ADD COLUMN IF NOT EXISTS tip text, ADD COLUMN IF NOT EXISTS questions jsonb; -- [{id, why}]
-- Content is loaded from supabase/seed/nuggets-biology.json.
