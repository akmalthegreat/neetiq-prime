
-- pgcrypto for encrypting stored AI keys
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============ notifications ============
CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  kind text NOT NULL,
  title text NOT NULL,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user_created ON public.notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_user_unread ON public.notifications(user_id) WHERE read_at IS NULL;

GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own notifications"
  ON public.notifications FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users update own notifications"
  ON public.notifications FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============ ai_api_keys (admin-only, encrypted) ============
CREATE TABLE public.ai_api_keys (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  label text NOT NULL,
  key_encrypted bytea NOT NULL,
  last_four text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

-- Only service_role can touch this table directly (raw key bytes never reach the browser)
GRANT ALL ON public.ai_api_keys TO service_role;

ALTER TABLE public.ai_api_keys ENABLE ROW LEVEL SECURITY;

-- No policies for authenticated/anon — table is service-role-only.
-- Admin UI reads via a SECURITY DEFINER server fn that returns masked metadata only.

-- ============ helper: list AI keys for admin (masked) ============
CREATE OR REPLACE FUNCTION public.admin_list_ai_keys()
RETURNS TABLE(id uuid, label text, last_four text, is_active boolean, last_used_at timestamptz, created_at timestamptz)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT k.id, k.label, k.last_four, k.is_active, k.last_used_at, k.created_at
  FROM public.ai_api_keys k
  WHERE private.has_role(auth.uid(), 'admin')
  ORDER BY k.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_ai_keys() TO authenticated;

-- ============ realtime publications ============
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.attempts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.contest_entries;
ALTER PUBLICATION supabase_realtime ADD TABLE public.contest_results;

ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER TABLE public.attempts REPLICA IDENTITY FULL;
ALTER TABLE public.contest_entries REPLICA IDENTITY FULL;
ALTER TABLE public.contest_results REPLICA IDENTITY FULL;
