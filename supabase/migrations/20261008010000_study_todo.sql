-- Daily to-do & targets: tasks (with timers) and the end-of-day review.
CREATE TABLE IF NOT EXISTS public.study_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day date NOT NULL,
  subject text NOT NULL CHECK (subject IN ('physics','chemistry','biology','other')),
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 140),
  target_min int CHECK (target_min IS NULL OR target_min BETWEEN 5 AND 720),
  spent_sec int NOT NULL DEFAULT 0 CHECK (spent_sec >= 0),
  timer_started_at timestamptz,
  done boolean NOT NULL DEFAULT false,
  done_at timestamptz,
  sort int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS study_tasks_user_day ON public.study_tasks (user_id, day);
CREATE TABLE IF NOT EXISTS public.study_days (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day date NOT NULL,
  locked_at timestamptz,
  closed_at timestamptz,
  mood int CHECK (mood BETWEEN 1 AND 5),
  went_well text CHECK (char_length(went_well) <= 1000),
  mistakes text CHECK (char_length(mistakes) <= 1000),
  mistake_tags text[] NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, day)
);
ALTER TABLE public.study_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_days ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='study_tasks' AND policyname='own tasks') THEN
    CREATE POLICY "own tasks" ON public.study_tasks FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='study_days' AND policyname='own days') THEN
    CREATE POLICY "own days" ON public.study_days FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;
END $$;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.study_tasks, public.study_days TO authenticated;
GRANT ALL ON public.study_tasks, public.study_days TO service_role;
