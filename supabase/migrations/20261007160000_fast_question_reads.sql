-- Fast question reads.
-- The `questions` view casts ids to text, so filters like chapter_id = '12' or
-- id IN (...) could not use an index, and the row-level "hide live Mega Quiz
-- questions" rule blocked index use as well. Every count scanned all ~47k rows
-- and often hit the 8 s timeout, which the app showed as "0 questions".

-- 1) Indexes that match the view's text columns.
CREATE INDEX IF NOT EXISTS qb_q_chapter_text_idx ON public.qb_questions (((chapter_id)::text));
CREATE INDEX IF NOT EXISTS qb_q_id_text_idx      ON public.qb_questions (((id)::text));
CREATE INDEX IF NOT EXISTS qb_q_subject_idx      ON public.qb_questions (subject_id);

-- 2) Cheap live-quiz rule on the raw table (no per-row function call).
GRANT SELECT ON public.mega_locked TO anon, authenticated;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'mega_locked' AND policyname = 'mega_locked read active') THEN
    CREATE POLICY "mega_locked read active" ON public.mega_locked FOR SELECT TO anon, authenticated USING (until > now());
  END IF;
END $$;
ALTER POLICY "qb_questions hide live mega quiz" ON public.qb_questions
  USING (NOT EXISTS (SELECT 1 FROM public.mega_locked l WHERE l.qid = (qb_questions.id)::text));

-- 3) The views run with the owner's rights (so indexes are usable) and hide
--    live Mega Quiz questions from app users themselves. Server functions
--    (Mega Quiz scoring etc.) still see every question.
LOCK TABLE public.questions IN ACCESS EXCLUSIVE MODE;
LOCK TABLE public.questions_full IN ACCESS EXCLUSIVE MODE;
DO $$ DECLARE d text; BEGIN
  d := rtrim(pg_get_viewdef('public.questions_full'::regclass), E'; \n');
  IF position('mega_locked' in d) = 0 THEN
    EXECUTE 'CREATE OR REPLACE VIEW public.questions_full WITH (security_invoker = false) AS ' || d ||
      E'\n  WHERE ((CURRENT_USER <> ALL (ARRAY[''anon''::name, ''authenticated''::name])) OR NOT EXISTS (SELECT 1 FROM public.mega_locked l WHERE l.qid = (q.id)::text AND l.until > now()))';
  END IF;
  ALTER VIEW public.questions SET (security_invoker = false);
END $$;

-- 4) Count every chapter of a subject in one request.
CREATE OR REPLACE FUNCTION public.chapter_question_counts(
  _chapter_ids text[], _difficulty text DEFAULT NULL, _qtype text DEFAULT NULL, _figure boolean DEFAULT false)
RETURNS TABLE (chapter_id text, n bigint)
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT q.chapter_id, count(*)
  FROM public.questions q
  WHERE q.chapter_id = ANY(_chapter_ids)
    AND (_difficulty IS NULL OR q.difficulty ILIKE _difficulty)
    AND (_qtype IS NULL OR q.qtype = _qtype)
    AND (NOT _figure OR q.question_image_url IS NOT NULL OR q.qtype = 'MCQ type-3'
         OR q.text ILIKE '%figure%' OR q.text ILIKE '%diagram%' OR q.text ILIKE '%graph%')
  GROUP BY q.chapter_id
$$;
REVOKE ALL ON FUNCTION public.chapter_question_counts(text[], text, text, boolean) FROM public;
GRANT EXECUTE ON FUNCTION public.chapter_question_counts(text[], text, text, boolean) TO anon, authenticated;

-- 5) Question bank totals, pre-computed hourly (home page / dashboard).
CREATE TABLE IF NOT EXISTS public.question_bank_stats (id int PRIMARY KEY DEFAULT 1 CHECK (id = 1), counts jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE public.question_bank_stats ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.question_bank_stats TO service_role;
CREATE OR REPLACE FUNCTION public.refresh_question_bank_stats()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.question_bank_stats (id, counts, updated_at)
  SELECT 1, coalesce(jsonb_object_agg(subject_id, n), '{}'::jsonb) || jsonb_build_object('total', coalesce(sum(n), 0)), now()
  FROM (SELECT q.subject_id, count(*) n FROM public.questions q GROUP BY q.subject_id) s
  ON CONFLICT (id) DO UPDATE SET counts = EXCLUDED.counts, updated_at = EXCLUDED.updated_at;
$$;
REVOKE ALL ON FUNCTION public.refresh_question_bank_stats() FROM public, anon, authenticated;
CREATE OR REPLACE FUNCTION public.question_bank_counts()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT counts FROM public.question_bank_stats WHERE id = 1
$$;
REVOKE ALL ON FUNCTION public.question_bank_counts() FROM public;
GRANT EXECUTE ON FUNCTION public.question_bank_counts() TO anon, authenticated, service_role;
SELECT public.refresh_question_bank_stats();
SELECT cron.schedule('question_bank_stats', '7 * * * *', $$ select public.refresh_question_bank_stats(); $$);
