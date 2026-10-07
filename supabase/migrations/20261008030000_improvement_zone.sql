-- Improvement Zone: mistake reasons, fixed tracking, per-question time.
ALTER TABLE public.wrong_questions
  ADD COLUMN IF NOT EXISTS reason text CHECK (reason IS NULL OR char_length(reason) <= 40),
  ADD COLUMN IF NOT EXISTS fixed_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE public.attempts ADD COLUMN IF NOT EXISTS question_times jsonb;
