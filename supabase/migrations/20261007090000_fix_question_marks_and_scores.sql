-- Fix tests scoring 0. The live questions table has no marks_correct / marks_wrong
-- columns, so the old quiz code added "undefined" for every answer and saved an
-- empty score. The app now falls back to NEET marking (+4 / -1); this migration
-- repairs saved results and guards against empty scores in future.

-- 1) Repair saved results: completed attempts with correct answers but an
--    empty/zero score get the NEET score from their own counts.
--    contest_results (published ranks and prizes) is not touched.
UPDATE public.attempts
SET score = COALESCE(correct_count, 0) * 4 - COALESCE(wrong_count, 0)
WHERE status = 'completed'
  AND COALESCE(correct_count, 0) > 0
  AND (score IS NULL OR score = 0);

-- 2) Guard: if any client (an old cached app version, for example) saves a completed
--    attempt with an empty/zero score despite correct answers, fill in the NEET score.
CREATE OR REPLACE FUNCTION public.fill_attempt_score()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'completed'
     AND COALESCE(NEW.correct_count, 0) > 0
     AND (NEW.score IS NULL OR NEW.score = 0) THEN
    NEW.score := COALESCE(NEW.correct_count, 0) * 4 - COALESCE(NEW.wrong_count, 0);
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_fill_attempt_score ON public.attempts;
CREATE TRIGGER trg_fill_attempt_score
BEFORE INSERT OR UPDATE ON public.attempts
FOR EACH ROW EXECUTE FUNCTION public.fill_attempt_score();
