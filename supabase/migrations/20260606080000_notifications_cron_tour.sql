-- ============================================================
--  Wallet / referral / contest notifications + AI cron jobs
--  Run this manually on your Supabase Postgres.
-- ============================================================

-- 1) Wallet-transaction → notification (covers deposit, withdraw,
--    withdraw_refund, contest_win, contest_entry, referral_bonus,
--    subscription, bonus, deduction, etc.)
CREATE OR REPLACE FUNCTION public.notify_wallet_tx()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _amt numeric := COALESCE(NEW.amount, 0);
  _sign text   := CASE WHEN _amt >= 0 THEN '+' ELSE '-' END;
  _abs  text   := to_char(ABS(_amt), 'FM999999990.00');
  _kind text   := COALESCE(NEW.type, 'wallet');
  _title text;
  _body text;
BEGIN
  _title := CASE _kind
    WHEN 'deposit'         THEN 'Deposit credited'
    WHEN 'withdraw'        THEN 'Withdrawal paid'
    WHEN 'withdraw_hold'   THEN 'Withdrawal requested'
    WHEN 'withdraw_refund' THEN 'Withdrawal refunded'
    WHEN 'contest_entry'   THEN 'Contest entry fee'
    WHEN 'contest_win'     THEN 'You won! Prize credited'
    WHEN 'referral_bonus'  THEN 'Referral bonus credited'
    WHEN 'subscription'    THEN 'Subscription charged'
    WHEN 'bonus'           THEN 'Bonus credited'
    WHEN 'deduction'       THEN 'Amount deducted'
    ELSE initcap(replace(_kind, '_', ' '))
  END;
  _body := 'Wallet ' || _sign || '₹' || _abs ||
           CASE WHEN NEW.note IS NOT NULL AND length(NEW.note) > 0
                THEN ' — ' || NEW.note ELSE '' END;
  INSERT INTO public.notifications (user_id, kind, title, body, link)
  VALUES (NEW.user_id, _kind, _title, _body, '/wallet');
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_notify_wallet_tx ON public.wallet_transactions;
CREATE TRIGGER trg_notify_wallet_tx
AFTER INSERT ON public.wallet_transactions
FOR EACH ROW EXECUTE FUNCTION public.notify_wallet_tx();

-- 2) Referral created → notify referrer
CREATE OR REPLACE FUNCTION public.notify_referral_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.notifications (user_id, kind, title, body, link)
  VALUES (NEW.referrer_id, 'referral',
          'New referral joined',
          'Someone signed up with your code. Bonus ₹' ||
            to_char(COALESCE(NEW.referrer_bonus,0), 'FM999999990.00') || ' added.',
          '/referrals');
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_notify_referral_created ON public.referrals;
CREATE TRIGGER trg_notify_referral_created
AFTER INSERT ON public.referrals
FOR EACH ROW EXECUTE FUNCTION public.notify_referral_created();

-- 3) Contest result → notify user with rank + prize
CREATE OR REPLACE FUNCTION public.notify_contest_result()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _prize numeric := COALESCE(NEW.prize_amount, 0);
BEGIN
  INSERT INTO public.notifications (user_id, kind, title, body, link)
  VALUES (NEW.user_id, 'contest_result',
          'Contest result: Rank #' || COALESCE(NEW.rank::text, '-'),
          'Score ' || COALESCE(NEW.score::text,'0') ||
          CASE WHEN _prize > 0
               THEN ' · Prize ₹' || to_char(_prize, 'FM999999990.00')
               ELSE '' END,
          '/contest/' || NEW.contest_id || '/results');
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_notify_contest_result ON public.contest_results;
CREATE TRIGGER trg_notify_contest_result
AFTER INSERT ON public.contest_results
FOR EACH ROW EXECUTE FUNCTION public.notify_contest_result();

-- 4) Withdrawal status change → notify
CREATE OR REPLACE FUNCTION public.notify_withdrawal_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.notifications (user_id, kind, title, body, link)
    VALUES (NEW.user_id, 'withdraw',
      'Withdrawal ' || NEW.status,
      'Your request of ₹' || to_char(NEW.amount, 'FM999999990.00') ||
      ' is now ' || NEW.status || '.',
      '/wallet');
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_notify_withdrawal_status ON public.withdrawal_requests;
CREATE TRIGGER trg_notify_withdrawal_status
AFTER UPDATE ON public.withdrawal_requests
FOR EACH ROW EXECUTE FUNCTION public.notify_withdrawal_status();

-- 5) Onboarding tour flag
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false;

-- 6) AI cron jobs (pg_cron + pg_net).  After applying, configure:
--      ALTER DATABASE postgres SET app.cron_base_url = 'https://your-domain.lovable.app';
--      ALTER DATABASE postgres SET app.cron_secret   = 'long-random-string';
--      SELECT pg_reload_conf();
--    Then store the same CRON_SECRET in your project secrets so the
--    /api/public/cron/* routes can validate the X-Cron-Secret header.

CREATE OR REPLACE FUNCTION public.cron_call(path text, body jsonb DEFAULT '{}'::jsonb)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _url text; _sec text; _rid bigint;
BEGIN
  _url := current_setting('app.cron_base_url', true);
  _sec := current_setting('app.cron_secret',  true);
  IF _url IS NULL OR _sec IS NULL THEN
    RAISE NOTICE 'cron_call skipped: app.cron_base_url / app.cron_secret unset';
    RETURN NULL;
  END IF;
  SELECT net.http_post(
    url     := _url || path,
    headers := jsonb_build_object(
      'content-type',  'application/json',
      'x-cron-secret', _sec
    ),
    body    := body
  ) INTO _rid;
  RETURN _rid;
END $$;

-- Unschedule any previous versions
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT jobid FROM cron.job
           WHERE jobname IN ('lovable_daily_dpp','lovable_daily_contest','lovable_finalize_contests')
  LOOP PERFORM cron.unschedule(r.jobid); END LOOP;
END $$;

SELECT cron.schedule(
  'lovable_daily_dpp', '0 3 * * *',
  $$ SELECT public.cron_call('/api/public/cron/daily-dpp', '{"count":3}'::jsonb); $$
);
SELECT cron.schedule(
  'lovable_daily_contest', '15 3 * * *',
  $$ SELECT public.cron_call('/api/public/cron/daily-contest', '{}'::jsonb); $$
);
SELECT cron.schedule(
  'lovable_finalize_contests', '*/5 * * * *',
  $$ SELECT public.cron_call('/api/public/cron/finalize-contests', '{}'::jsonb); $$
);
