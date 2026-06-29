
CREATE TABLE IF NOT EXISTS public.question_diagrams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid REFERENCES public.questions(id) ON DELETE CASCADE,
  mime text NOT NULL DEFAULT 'image/png',
  data bytea NOT NULL,
  prompt text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.question_diagrams TO anon, authenticated;
GRANT ALL ON public.question_diagrams TO service_role;

ALTER TABLE public.question_diagrams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "diagrams public read"
  ON public.question_diagrams FOR SELECT
  TO anon, authenticated
  USING (true);
