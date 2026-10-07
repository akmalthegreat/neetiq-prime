-- Admin panel tools: richer home-page banners and announcements to premium members.
-- Safe to run more than once.

-- 1) Banner slides editable from the admin panel.
ALTER TABLE public.dashboard_banners
  ADD COLUMN IF NOT EXISTS subtitle  text,
  ADD COLUMN IF NOT EXISTS tag       text,
  ADD COLUMN IF NOT EXISTS cta_label text,
  ADD COLUMN IF NOT EXISTS theme     text DEFAULT 'blue',
  ADD COLUMN IF NOT EXISTS starts_at timestamptz,
  ADD COLUMN IF NOT EXISTS ends_at   timestamptz;

-- 2) Announcements can target everyone, premium members, or Mega Quiz players.
ALTER TABLE public.push_jobs DROP CONSTRAINT IF EXISTS push_jobs_audience_check;
ALTER TABLE public.push_jobs ADD CONSTRAINT push_jobs_audience_check
  CHECK (audience IN ('all', 'premium', 'mega_players'));

CREATE OR REPLACE FUNCTION public.push_job_batch(_job bigint, _limit integer)
RETURNS TABLE(id bigint, endpoint text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT s.id, s.endpoint FROM public.push_subscriptions s, public.push_jobs j
  WHERE j.id = _job AND s.id > j.cursor_id
    AND (j.audience = 'all'
      OR (j.audience = 'premium' AND s.user_id IN (
            SELECT user_id FROM public.subscriptions WHERE status = 'active' AND expires_at > now()))
      OR (j.audience = 'mega_players' AND s.user_id IN (
            SELECT user_id FROM public.mega_entries WHERE quiz_id = j.quiz_id)))
  ORDER BY s.id LIMIT _limit;
$$;

CREATE OR REPLACE FUNCTION public.push_job_in_app(_job bigint)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _j public.push_jobs; _n int := 0; _players int;
BEGIN
  SELECT * INTO _j FROM public.push_jobs WHERE id = _job FOR UPDATE;
  IF _j.id IS NULL OR _j.in_app_done THEN RETURN 0; END IF;
  IF _j.audience = 'all' THEN
    INSERT INTO public.notifications (user_id, kind, title, body, link)
    SELECT p.id, _j.kind, _j.title, _j.body, _j.url FROM public.profiles p;
    GET DIAGNOSTICS _n = ROW_COUNT;
  ELSIF _j.audience = 'premium' THEN
    INSERT INTO public.notifications (user_id, kind, title, body, link)
    SELECT DISTINCT s.user_id, _j.kind, _j.title, _j.body, _j.url
    FROM public.subscriptions s WHERE s.status = 'active' AND s.expires_at > now();
    GET DIAGNOSTICS _n = ROW_COUNT;
  ELSE
    SELECT count(*) INTO _players FROM public.mega_entries WHERE quiz_id = _j.quiz_id;
    INSERT INTO public.notifications (user_id, kind, title, body, link)
    SELECT e.user_id, _j.kind,
      CASE WHEN e.prize > 0 THEN 'You won today''s Mega Quiz' ELSE 'Mega Quiz results are out' END,
      CASE WHEN e.prize > 0 THEN '₹' || e.prize || ' has been added to your wallet. Score ' || coalesce(e.score,0) || ', rank 1 of ' || _players || '.'
           WHEN e.rank IS NOT NULL THEN 'You scored ' || coalesce(e.score,0) || ' and ranked ' || e.rank || ' of ' || _players || '. See all 80 solutions.'
           ELSE _j.body END,
      _j.url
    FROM public.mega_entries e WHERE e.quiz_id = _j.quiz_id;
    GET DIAGNOSTICS _n = ROW_COUNT;
  END IF;
  UPDATE public.push_jobs SET in_app_done = true WHERE id = _job;
  RETURN _n;
END $$;
REVOKE ALL ON FUNCTION public.push_job_batch(bigint, integer), public.push_job_in_app(bigint) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.push_job_batch(bigint, integer), public.push_job_in_app(bigint) TO service_role;
