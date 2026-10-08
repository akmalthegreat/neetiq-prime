-- 21-day free period: every student gets full access for 21 days.
-- New sign-ups: 21 days from sign-up. Existing students: at least 21 days from today.
ALTER TABLE public.profiles ALTER COLUMN trial_expires_at SET DEFAULT (now() + interval '21 days');

UPDATE public.profiles
SET trial_expires_at = now() + interval '21 days'
WHERE trial_expires_at IS NULL OR trial_expires_at < now() + interval '21 days';

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, trial_expires_at, trial_tokens, trial_tokens_expires_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(COALESCE(NEW.email, ''), '@', 1)),
    now() + interval '21 days',   -- 21-day free period: all features
    100,                          -- 100 free tokens
    now() + interval '28 days'    -- token period: 7 days after the free period
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user') ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;
