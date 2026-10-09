-- NCERT Nuggets: key NCERT lines + questions from the bank, read then solve.
CREATE TABLE IF NOT EXISTS public.nuggets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject text NOT NULL,
  chapter_id text NOT NULL,
  chapter_title text NOT NULL,
  class int,
  chapter_sort int NOT NULL DEFAULT 0,
  position int NOT NULL,
  title text NOT NULL,
  lines jsonb NOT NULL,
  tip text,
  questions jsonb NOT NULL,          -- [{ "id": "<question id>", "why": "<explanation>" }]
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (chapter_id, position)
);
ALTER TABLE public.nuggets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "nuggets readable" ON public.nuggets FOR SELECT USING (true);

CREATE TABLE IF NOT EXISTS public.nugget_progress (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nugget_id uuid NOT NULL REFERENCES public.nuggets(id) ON DELETE CASCADE,
  correct int NOT NULL DEFAULT 0,
  total int NOT NULL DEFAULT 0,
  best int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, nugget_id)
);
ALTER TABLE public.nugget_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own nugget progress select" ON public.nugget_progress FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own nugget progress insert" ON public.nugget_progress FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own nugget progress update" ON public.nugget_progress FOR UPDATE USING (auth.uid() = user_id);
GRANT SELECT ON public.nuggets TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.nugget_progress TO authenticated;
-- Content is loaded from supabase/seed/nuggets-biology.json.
