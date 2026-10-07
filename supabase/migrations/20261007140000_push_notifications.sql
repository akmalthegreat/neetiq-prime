-- Phone push notifications (Web Push) for the Daily Mega Quiz and future announcements.
-- The VAPID private key is stored in push_config by hand (never in git).

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id          bigserial PRIMARY KEY,
  user_id     uuid NOT NULL,
  endpoint    text NOT NULL UNIQUE,
  p256dh      text NOT NULL,
  auth        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  failures    int NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS push_subscriptions_user ON public.push_subscriptions (user_id);
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;  -- server access only

-- Messages waiting to be sent. The site's push runner sends them in small batches.
CREATE TABLE IF NOT EXISTS public.push_jobs (
  id          bigserial PRIMARY KEY,
  title       text NOT NULL,
  body        text NOT NULL,
  url         text NOT NULL DEFAULT '/',
  audience    text NOT NULL DEFAULT 'all' CHECK (audience IN ('all','mega_players')),
  quiz_id     uuid,
  kind        text NOT NULL DEFAULT 'announcement',
  cursor_id   bigint NOT NULL DEFAULT 0,
  in_app_done boolean NOT NULL DEFAULT false,
  done        boolean NOT NULL DEFAULT false,
  sent        int NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.push_jobs ENABLE ROW LEVEL SECURITY;  -- server access only

CREATE TABLE IF NOT EXISTS public.push_config (
  id     int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  vapid_public  text NOT NULL,
  vapid_private_jwk jsonb NOT NULL,
  subject text NOT NULL DEFAULT 'mailto:support@neettrack.com'
);
ALTER TABLE public.push_config ENABLE ROW LEVEL SECURITY;  -- server access only

-- Daily Mega Quiz messages (pg_cron runs in UTC):
--   5:45 PM IST reminder to everyone, 6:53 PM IST results to players.
CREATE OR REPLACE FUNCTION public.mega_queue_reminder()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _m public.mega_quizzes;
BEGIN
  SELECT * INTO _m FROM public.mega_quizzes WHERE quiz_date = (now() AT TIME ZONE 'Asia/Kolkata')::date;
  IF _m.id IS NULL THEN RETURN; END IF;
  INSERT INTO public.push_jobs (title, body, url, audience, quiz_id, kind)
  VALUES ('Mega Quiz live at 6:00 PM', 'Join now: 80 questions, ₹' || _m.prize || ' for the top scorer. Entry closes 6:05 PM.', '/mega-quiz', 'all', _m.id, 'mega_reminder');
END $$;

CREATE OR REPLACE FUNCTION public.mega_queue_results()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _m public.mega_quizzes;
BEGIN
  SELECT * INTO _m FROM public.mega_quizzes
   WHERE quiz_date = (now() AT TIME ZONE 'Asia/Kolkata')::date AND status = 'finalized';
  IF _m.id IS NULL THEN RETURN; END IF;
  INSERT INTO public.push_jobs (title, body, url, audience, quiz_id, kind)
  VALUES ('Mega Quiz results are out', 'See your rank, the winner and all 80 solutions.', '/mega-quiz', 'mega_players', _m.id, 'mega_results');
END $$;

REVOKE ALL ON FUNCTION public.mega_queue_reminder(), public.mega_queue_results() FROM public, anon, authenticated;

SELECT cron.schedule('mega_push_reminder', '15 12 * * *', $$ select public.mega_queue_reminder(); $$);
SELECT cron.schedule('mega_push_results', '23 13 * * *', $$ select public.mega_queue_results(); $$);
-- The site sends queued messages in batches (only during the evening quiz window).
SELECT cron.schedule('push_runner', '* 12-13 * * *', $$ select public.cron_call('/api/public/cron/push-run', '{}'::jsonb); $$);

-- In-app bell notifications for a queued message (run once per job by the push runner).
CREATE OR REPLACE FUNCTION public.push_job_in_app(_job bigint)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _j public.push_jobs; _n int := 0; _players int;
BEGIN
  SELECT * INTO _j FROM public.push_jobs WHERE id = _job FOR UPDATE;
  IF _j.id IS NULL OR _j.in_app_done THEN RETURN 0; END IF;
  IF _j.audience = 'all' THEN
    INSERT INTO public.notifications (user_id, kind, title, body, link)
    SELECT p.id, _j.kind, _j.title, _j.body, _j.url FROM public.profiles p;
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

-- Next batch of phone subscriptions for a job.
CREATE OR REPLACE FUNCTION public.push_job_batch(_job bigint, _limit int)
RETURNS TABLE (id bigint, endpoint text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.id, s.endpoint FROM public.push_subscriptions s, public.push_jobs j
  WHERE j.id = _job AND s.id > j.cursor_id
    AND (j.audience = 'all' OR s.user_id IN (SELECT user_id FROM public.mega_entries WHERE quiz_id = j.quiz_id))
  ORDER BY s.id LIMIT _limit;
$$;
REVOKE ALL ON FUNCTION public.push_job_in_app(bigint), public.push_job_batch(bigint, int) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.push_job_in_app(bigint), public.push_job_batch(bigint, int) TO service_role;
