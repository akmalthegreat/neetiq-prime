-- Fix tests scoring 0: some questions were saved with marks_correct 0/NULL,
-- so correct answers added nothing to the score.
-- NEET marking is +4 for correct, -1 for wrong.

-- 1) Repair existing questions.
UPDATE public.questions
SET marks_correct = 4,
    marks_wrong = CASE WHEN marks_wrong IS NULL OR marks_wrong >= 0 THEN -1 ELSE marks_wrong END
WHERE marks_correct IS NULL OR marks_correct <= 0;

-- A positive "wrong" mark means a negative mark was entered without its sign.
UPDATE public.questions
SET marks_wrong = -marks_wrong
WHERE marks_wrong > 0;

-- 2) Guard: any future insert or update (admin import, PYQ import, AI generation)
--    is normalised the same way, so broken marks can never be saved again.
CREATE OR REPLACE FUNCTION public.normalize_question_marks()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.marks_correct IS NULL OR NEW.marks_correct <= 0 THEN
    NEW.marks_correct := 4;
    IF NEW.marks_wrong IS NULL OR NEW.marks_wrong >= 0 THEN
      NEW.marks_wrong := -1;
    END IF;
  END IF;
  IF NEW.marks_wrong IS NULL THEN
    NEW.marks_wrong := -1;
  ELSIF NEW.marks_wrong > 0 THEN
    NEW.marks_wrong := -NEW.marks_wrong;
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_normalize_question_marks ON public.questions;
CREATE TRIGGER trg_normalize_question_marks
BEFORE INSERT OR UPDATE OF marks_correct, marks_wrong ON public.questions
FOR EACH ROW EXECUTE FUNCTION public.normalize_question_marks();

-- Same guard for tests (practice sets are created without explicit marks).
UPDATE public.tests
SET marks_correct = 4
WHERE marks_correct IS NULL OR marks_correct <= 0;

-- 3) Repair saved results: completed attempts that have correct answers but were
--    stored with score 0/NULL get the NEET score from their own counts.
--    contest_results (ranks and prizes already published) is not touched.
UPDATE public.attempts
SET score = COALESCE(correct_count, 0) * 4 - COALESCE(wrong_count, 0)
WHERE status = 'completed'
  AND COALESCE(correct_count, 0) > 0
  AND (score IS NULL OR score = 0);
