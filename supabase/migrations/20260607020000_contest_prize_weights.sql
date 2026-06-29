-- ============================================================================
-- Contest prize distribution: pool = entry_fee × joiners, split by weights
-- 30/20/12/10/8/6/5/4/3/2 across the top-min(joiners,10), normalised.
-- Run this in the Lovable Cloud / Supabase SQL editor (or via migrations).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.finalize_contest(_contest_id UUID)
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _c        public.contests;
  _n        INT := 0;
  _r        RECORD;
  _joiners  INT := 0;
  _pool     NUMERIC := 0;
  _winners  INT := 0;
  _wsum     NUMERIC := 0;
  _weights  NUMERIC[] := ARRAY[30,20,12,10,8,6,5,4,3,2];
  i         INT;
BEGIN
  SELECT * INTO _c FROM public.contests WHERE id = _contest_id FOR UPDATE;
  IF _c IS NULL THEN RAISE EXCEPTION 'Contest not found'; END IF;
  IF _c.status = 'finalized' THEN RETURN 0; END IF;
  IF now() < _c.ends_at THEN RAISE EXCEPTION 'Contest not yet ended'; END IF;

  -- Pool = entry fee × number of joiners (fall back to configured pool when free).
  SELECT count(*) INTO _joiners FROM public.contest_entries WHERE contest_id = _contest_id;
  IF COALESCE(_c.entry_fee, 0) > 0 THEN
    _pool := round((_c.entry_fee * _joiners)::numeric, 2);
  ELSE
    _pool := COALESCE(_c.prize_pool, 0);
  END IF;

  _winners := LEAST(_joiners, 10);
  FOR i IN 1.._winners LOOP
    _wsum := _wsum + _weights[i];
  END LOOP;

  WITH ranked AS (
    SELECT e.user_id,
           COALESCE(a.score, 0) AS score,
           COALESCE(a.time_taken_sec, 999999) AS tsec,
           ROW_NUMBER() OVER (
             ORDER BY COALESCE(a.score,0) DESC NULLS LAST,
                      COALESCE(a.time_taken_sec, 999999) ASC
           ) AS rnk
    FROM public.contest_entries e
    LEFT JOIN LATERAL (
      SELECT score, time_taken_sec FROM public.attempts
       WHERE user_id = e.user_id AND test_id = _c.test_id AND status = 'completed'
       ORDER BY submitted_at DESC LIMIT 1
    ) a ON true
    WHERE e.contest_id = _contest_id
  )
  INSERT INTO public.contest_results (contest_id, user_id, rank, score, prize_amount)
  SELECT _contest_id, user_id, rnk::int, score,
         CASE
           WHEN rnk <= _winners AND _wsum > 0
             THEN round((_pool * _weights[rnk::int] / _wsum)::numeric, 2)
           ELSE 0
         END
  FROM ranked
  ON CONFLICT (contest_id, user_id) DO NOTHING;

  -- Persist the actual computed pool on the contest record.
  UPDATE public.contests SET prize_pool = _pool WHERE id = _contest_id;

  FOR _r IN SELECT user_id, prize_amount FROM public.contest_results
            WHERE contest_id = _contest_id AND prize_amount > 0
  LOOP
    UPDATE public.profiles
       SET winnings_balance = winnings_balance + _r.prize_amount,
           wallet_balance   = wallet_balance   + _r.prize_amount
     WHERE id = _r.user_id;
    INSERT INTO public.wallet_transactions (user_id, amount, type, bucket, status, reference)
      VALUES (_r.user_id, _r.prize_amount, 'contest_prize', 'winnings', 'completed', _contest_id::text);
    _n := _n + 1;
  END LOOP;

  UPDATE public.contests SET status = 'finalized' WHERE id = _contest_id;
  RETURN _n;
END $$;

GRANT EXECUTE ON FUNCTION public.finalize_contest(uuid) TO authenticated;
