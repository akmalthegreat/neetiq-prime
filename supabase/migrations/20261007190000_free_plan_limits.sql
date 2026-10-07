-- Free-plan limits: which Target 700 tests and practice chapters each free student has used.
CREATE TABLE IF NOT EXISTS public.free_unlocks (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('chapter','t700')),
  ref text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, kind, ref)
);
ALTER TABLE public.free_unlocks ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.free_unlocks TO service_role;
