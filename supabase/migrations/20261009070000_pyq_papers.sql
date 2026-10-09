-- PYQ papers: group previous-year questions by exam and year (normalised exam tags).
CREATE OR REPLACE FUNCTION public.pyq_exam(tag text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN t IN ('NEET','NEETUG') THEN 'NEET'
    WHEN t = 'AIPMT' THEN 'AIPMT'
    WHEN t = 'AIIMS' THEN 'AIIMS'
    WHEN t IN ('KCET','KECT') THEN 'KCET'
    WHEN t IN ('TSEAMCET','EAMCET') THEN 'TS EAMCET'
    WHEN t = 'MHTCET' THEN 'MHT CET'
    WHEN t IN ('JEE','JEEMAIN','JEEMAINS') THEN 'JEE Main'
    WHEN t = '' THEN 'NEET'
    ELSE t END
  FROM (SELECT upper(regexp_replace(coalesce(tag,''), '\s', '', 'g')) AS t) s;
$$;

CREATE OR REPLACE FUNCTION public.pyq_summary()
RETURNS TABLE(exam text, year int, total bigint, physics bigint, chemistry bigint, biology bigint)
LANGUAGE sql STABLE SECURITY INVOKER AS $$
  SELECT public.pyq_exam(q.tag), q.year, count(*),
    count(*) FILTER (WHERE lower(q.subject_id) = 'physics'),
    count(*) FILTER (WHERE lower(q.subject_id) = 'chemistry'),
    count(*) FILTER (WHERE lower(q.subject_id) = 'biology')
  FROM public.questions q
  WHERE q.is_pyq AND q.year IS NOT NULL
  GROUP BY 1, 2;
$$;

-- Question ids of one exam-year paper in NEET order (Physics, Chemistry, Biology).
CREATE OR REPLACE FUNCTION public.pyq_paper_ids(p_exam text, p_year int)
RETURNS text[] LANGUAGE sql STABLE SECURITY INVOKER AS $$
  SELECT coalesce(array_agg(id ORDER BY CASE lower(subject_id) WHEN 'physics' THEN 1 WHEN 'chemistry' THEN 2 WHEN 'biology' THEN 3 ELSE 4 END, id), '{}')
  FROM public.questions
  WHERE is_pyq AND year = p_year AND public.pyq_exam(tag) = p_exam;
$$;

GRANT EXECUTE ON FUNCTION public.pyq_exam(text), public.pyq_summary(), public.pyq_paper_ids(text, int) TO authenticated;
