
-- 1) contest_results: restrict reads to own row (admins see all)
DROP POLICY IF EXISTS "Results readable" ON public.contest_results;
CREATE POLICY "Users view own results" ON public.contest_results
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR private.has_role(auth.uid(), 'admin'::app_role));

-- 2) xp_events: remove user INSERT, force via SECURITY DEFINER RPC
DROP POLICY IF EXISTS "Users insert own xp" ON public.xp_events;

CREATE OR REPLACE FUNCTION public.award_attempt_xp(_attempt_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _a public.attempts;
  _t public.tests;
  _kind text;
  _in_window boolean;
  _mult numeric;
  _xp integer;
  _correct int;
  _wrong int;
  _prior int;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO _a FROM public.attempts WHERE id = _attempt_id AND user_id = _uid;
  IF _a IS NULL THEN RAISE EXCEPTION 'Attempt not found'; END IF;
  IF _a.status <> 'completed' THEN RAISE EXCEPTION 'Attempt not completed'; END IF;

  -- idempotent: skip if XP already awarded for this attempt
  IF EXISTS (SELECT 1 FROM public.xp_events WHERE attempt_id = _attempt_id) THEN
    RETURN 0;
  END IF;

  SELECT * INTO _t FROM public.tests WHERE id = _a.test_id;
  _correct := COALESCE(_a.correct_count, 0);
  _wrong   := COALESCE(_a.wrong_count, 0);

  SELECT COUNT(*) INTO _prior FROM public.attempts
   WHERE user_id = _uid AND test_id = _a.test_id AND status = 'completed' AND id <> _attempt_id;
  _in_window := _t.starts_at IS NOT NULL AND _t.ends_at IS NOT NULL
                AND now() BETWEEN _t.starts_at AND _t.ends_at;
  IF _prior > 0 THEN _kind := 'reattempt'; _mult := 0;
  ELSIF _in_window THEN _kind := 'live'; _mult := 1;
  ELSE _kind := 'post_live'; _mult := 0.5;
  END IF;

  -- canonical scoring: +4 correct, -1 wrong, floored at 0
  _xp := GREATEST(0, (_correct * 4 - _wrong * 1));
  _xp := GREATEST(0, FLOOR(_xp * _mult)::int);

  IF _xp > 0 THEN
    INSERT INTO public.xp_events (user_id, attempt_id, points, kind, meta)
    VALUES (_uid, _attempt_id, _xp, _kind,
            jsonb_build_object('correct', _correct, 'wrong', _wrong));
  END IF;
  RETURN _xp;
END $$;

REVOKE ALL ON FUNCTION public.award_attempt_xp(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.award_attempt_xp(uuid) TO authenticated;

-- 3) Realtime: scope channel subscriptions
DROP POLICY IF EXISTS "auth users subscribe to safe topics" ON realtime.messages;
CREATE POLICY "auth users subscribe to safe topics" ON realtime.messages
  FOR SELECT TO authenticated
  USING (
    -- own notification channel
    (realtime.topic() = 'notif-' || auth.uid()::text)
    -- public contest channels (contest_results & attempts have their own RLS)
    OR (realtime.topic() LIKE 'contest-%')
  );

-- 4) Delete legacy diagram questions that don't include a real diagram block
WITH bad AS (
  SELECT id FROM public.questions
   WHERE source ILIKE '%diagram%'
     AND text !~ '(<svg|\\begin\{tikzpicture\}|```tikz|```mermaid)'
)
DELETE FROM public.questions q USING bad WHERE q.id = bad.id;

-- 5) Strip stale question ids from tests
UPDATE public.tests t
   SET question_ids = COALESCE(ARRAY(
     SELECT qid FROM unnest(t.question_ids) qid
     WHERE EXISTS (SELECT 1 FROM public.questions q WHERE q.id = qid)
   ), '{}'::uuid[]);
