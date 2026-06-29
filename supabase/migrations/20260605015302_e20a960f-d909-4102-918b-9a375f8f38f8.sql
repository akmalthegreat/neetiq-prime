
WITH bad AS (
  SELECT id FROM public.questions
   WHERE text ~ '(<svg|\\begin\{tikzpicture\}|```tikz|```mermaid)'
)
DELETE FROM public.questions q USING bad WHERE q.id = bad.id;

UPDATE public.tests t
   SET question_ids = COALESCE(ARRAY(
     SELECT qid FROM unnest(t.question_ids) qid
     WHERE EXISTS (SELECT 1 FROM public.questions q WHERE q.id = qid)
   ), '{}'::uuid[]);

-- Drop tests left empty by the cleanup
DELETE FROM public.tests WHERE array_length(question_ids,1) IS NULL OR array_length(question_ids,1) = 0;
