-- ===== fixes-2.sql =====
-- =========================================================================
-- NEETIQ Prime — FIXES bundle #2
-- Paste this whole file into your Supabase SQL Editor and run it ONCE.
-- Safe / idempotent (CREATE OR REPLACE, DROP ... IF EXISTS, IF NOT EXISTS).
--
-- What this repairs:
--   1. "record \"new\" has no field \"note\"" on EVERY wallet write
--      -> the notify_wallet_tx() trigger referenced a column that does not
--         exist on wallet_transactions. This single bug was breaking:
--           • wallet money not updating after a successful Razorpay payment
--           • bonus pack credit
--           • test generation (deduct_bonus)
--           • joining a paid contest
--   2. Premium purchase failing with
--      "payment_orders_purpose_check (23514)"
--      -> the CHECK constraint did not allow purpose = 'subscription'.
--   3. "could not bookmark" / "permission denied" when reporting questions
--      -> the upsert needs UPDATE privilege, which was not granted.
-- =========================================================================

-- ---------------------------------------------------------------------------
-- 1. FIX the wallet-transaction notification trigger (root cause of many bugs)
--    wallet_transactions has columns: amount, type, bucket, status,
--    reference, meta — but NO "note" column. Read any optional note from meta.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_wallet_tx()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _amt  numeric := COALESCE(NEW.amount, 0);
  _sign text   := CASE WHEN _amt >= 0 THEN '+' ELSE '-' END;
  _abs  text   := to_char(ABS(_amt), 'FM999999990.00');
  _kind text   := COALESCE(NEW.type, 'wallet');
  _note text   := COALESCE(NEW.meta->>'note', '');
  _title text;
  _body  text;
BEGIN
  _title := CASE _kind
    WHEN 'deposit'         THEN 'Deposit credited'
    WHEN 'recharge'        THEN 'Deposit credited'
    WHEN 'withdraw'        THEN 'Withdrawal paid'
    WHEN 'withdraw_hold'   THEN 'Withdrawal requested'
    WHEN 'withdraw_refund' THEN 'Withdrawal refunded'
    WHEN 'contest_entry'   THEN 'Contest entry fee'
    WHEN 'contest_win'     THEN 'You won! Prize credited'
    WHEN 'referral_bonus'  THEN 'Referral bonus credited'
    WHEN 'subscription'    THEN 'Subscription charged'
    WHEN 'bonus'           THEN 'Bonus credited'
    WHEN 'bonus_purchase'  THEN 'Bonus credited'
    WHEN 'bonus_spend'     THEN 'Bonus spent'
    WHEN 'deduction'       THEN 'Amount deducted'
    ELSE initcap(replace(_kind, '_', ' '))
  END;
  _body := 'Wallet ' || _sign || '₹' || _abs ||
           CASE WHEN length(_note) > 0 THEN ' — ' || _note ELSE '' END;
  INSERT INTO public.notifications (user_id, kind, title, body, link)
  VALUES (NEW.user_id, _kind, _title, _body, '/wallet');
  RETURN NEW;
END $$;

-- ---------------------------------------------------------------------------
-- 2. Allow purpose = 'subscription' (and 'deposit' / 'bonus') on payment_orders
-- ---------------------------------------------------------------------------
ALTER TABLE public.payment_orders DROP CONSTRAINT IF EXISTS payment_orders_purpose_check;
ALTER TABLE public.payment_orders
  ADD CONSTRAINT payment_orders_purpose_check
  CHECK (purpose IN ('deposit', 'bonus', 'subscription'));

-- ---------------------------------------------------------------------------
-- 3. Bookmarks: the client uses upsert(onConflict) which needs UPDATE.
-- ---------------------------------------------------------------------------
GRANT UPDATE ON public.bookmarks TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. Question reports: upsert(onConflict) needs UPDATE grant + policy.
-- ---------------------------------------------------------------------------
GRANT UPDATE ON public.question_reports TO authenticated;
DROP POLICY IF EXISTS "Users update own reports" ON public.question_reports;
CREATE POLICY "Users update own reports" ON public.question_reports
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Reload PostgREST schema cache.
-- ---------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';

-- ===== fixes-3.sql =====
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
