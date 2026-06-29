-- ===== ai-path-predictor-highlights.sql =====
-- =================================================================
-- AI Path, Score Predictor, NCERT Highlights, App Settings
-- Apply manually to your external Supabase project (SQL editor).
-- =================================================================

-- ===== app_settings (editable bonus costs) =====
CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.app_settings TO anon, authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "settings public read" ON public.app_settings;
CREATE POLICY "settings public read" ON public.app_settings FOR SELECT USING (true);
DROP POLICY IF EXISTS "settings admin write" ON public.app_settings;
CREATE POLICY "settings admin write" ON public.app_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.app_settings(key, value) VALUES
  ('score_predictor_cost', '15'::jsonb),
  ('ai_path_cost', '50'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ===== score_predictions =====
CREATE TABLE IF NOT EXISTS public.score_predictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  predicted_marks int NOT NULL,
  predicted_air_band text,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.score_predictions TO authenticated;
GRANT ALL ON public.score_predictions TO service_role;
ALTER TABLE public.score_predictions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "predict own select" ON public.score_predictions;
CREATE POLICY "predict own select" ON public.score_predictions FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE INDEX IF NOT EXISTS idx_score_predictions_user ON public.score_predictions(user_id, created_at DESC);

-- ===== ai_paths =====
CREATE TABLE IF NOT EXISTS public.ai_paths (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  start_date date NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  payload jsonb NOT NULL,
  progress jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.ai_paths TO authenticated;
GRANT ALL ON public.ai_paths TO service_role;
ALTER TABLE public.ai_paths ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "aipath own select" ON public.ai_paths;
CREATE POLICY "aipath own select" ON public.ai_paths FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "aipath own update" ON public.ai_paths;
CREATE POLICY "aipath own update" ON public.ai_paths FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_ai_paths_user ON public.ai_paths(user_id, created_at DESC);

-- ===== ncert_highlights =====
CREATE TABLE IF NOT EXISTS public.ncert_highlights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
  chapter_id uuid REFERENCES public.chapters(id) ON DELETE CASCADE,
  body text NOT NULL,
  source text NOT NULL DEFAULT 'Manual',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ncert_highlights TO anon, authenticated;
GRANT ALL ON public.ncert_highlights TO service_role;
ALTER TABLE public.ncert_highlights ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ncert public read" ON public.ncert_highlights;
CREATE POLICY "ncert public read" ON public.ncert_highlights FOR SELECT USING (true);
DROP POLICY IF EXISTS "ncert admin write" ON public.ncert_highlights;
CREATE POLICY "ncert admin write" ON public.ncert_highlights FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE INDEX IF NOT EXISTS idx_ncert_chapter ON public.ncert_highlights(chapter_id);

-- ===== feature-bonus-costs.sql =====
-- =========================================================================
-- NEETIQ Prime — Premium study-tool bonus costs
-- Paste into your Supabase SQL Editor and run once. Safe to re-run.
--
-- Sets the bonus-coin price for each premium tool:
--   Flashcards       = 15
--   NCERT Highlights = 15
--   Score Predictor  = 25
--   AI Path          = 45
--
-- Requires app_settings (see db/ai-path-predictor-highlights.sql). If you have
-- not yet run that file, run it first.
-- =========================================================================

INSERT INTO public.app_settings(key, value) VALUES
  ('flashcards_cost',       '15'::jsonb),
  ('ncert_highlights_cost', '15'::jsonb),
  ('score_predictor_cost',  '25'::jsonb),
  ('ai_path_cost',          '45'::jsonb)
ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value, updated_at = now();

NOTIFY pgrst, 'reload schema';

-- ===== fixes.sql =====
-- =========================================================================
-- NEETIQ Prime — FIXES bundle
-- Paste this whole file into your Supabase SQL editor (https://supabase.com
-- → your project → SQL Editor) and run it ONCE.
--
-- It is SAFE to re-run (idempotent): IF NOT EXISTS / CREATE OR REPLACE /
-- DROP POLICY IF EXISTS are used everywhere. It only ADDS the objects your
-- app was missing — it does not drop or recreate your existing data.
--
-- What this repairs (verified against your live database):
--   • Wallet bonus pack (money not updating)  -> credit_bonus_for_payment()  [was MISSING]
--   • "Deduct bonus" when creating a test     -> deduct_bonus()              [was MISSING]
--   • Premium purchase                        -> payment_orders.plan column
--   • Join contest (balance check)            -> hardened join_contest()
--   • Daily DPP source label ("AI" -> exam)   -> relabels old rows
--
-- (referrals, apply_referral_code, subscriptions already exist on your DB and
--  are left untouched. The referral "invite list" bug was a read-side fix made
--  in the app code, no DB change needed.)
-- =========================================================================

-- ---------------------------------------------------------------------------
-- 0. Make sure the columns the app writes/reads exist (safe no-ops if present)
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bonus_balance     NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deposit_balance   NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS winnings_balance  NUMERIC(10,2) NOT NULL DEFAULT 0;

ALTER TABLE public.payment_orders
  ADD COLUMN IF NOT EXISTS purpose      TEXT NOT NULL DEFAULT 'deposit',
  ADD COLUMN IF NOT EXISTS bonus_amount NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS plan         TEXT;

-- ---------------------------------------------------------------------------
-- 1. Bonus credit for a paid bonus pack (₹10 -> 100 bonus)   [MISSING]
--    Called from verifyRazorpayPayment when purpose = 'bonus'.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.credit_bonus_for_payment(
  _user_id UUID, _amount NUMERIC, _bonus_amount NUMERIC,
  _razorpay_payment_id TEXT, _razorpay_order_id TEXT
) RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _existing INT;
BEGIN
  IF _bonus_amount <= 0 THEN RAISE EXCEPTION 'Bonus must be positive'; END IF;
  SELECT COUNT(*) INTO _existing FROM public.wallet_transactions
    WHERE reference = _razorpay_payment_id AND type = 'bonus_purchase';
  IF _existing > 0 THEN RETURN false; END IF;

  INSERT INTO public.wallet_transactions (user_id, amount, type, bucket, status, reference, meta)
  VALUES (_user_id, _bonus_amount, 'bonus_purchase', 'bonus', 'completed', _razorpay_payment_id,
          jsonb_build_object('razorpay_order_id', _razorpay_order_id, 'paid', _amount));

  UPDATE public.profiles
     SET bonus_balance = bonus_balance + _bonus_amount
   WHERE id = _user_id;

  UPDATE public.payment_orders
     SET status = 'paid', razorpay_payment_id = _razorpay_payment_id, verified_at = now()
   WHERE razorpay_order_id = _razorpay_order_id AND user_id = _user_id;

  RETURN true;
END $$;

REVOKE ALL ON FUNCTION public.credit_bonus_for_payment(uuid, numeric, numeric, text, text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.credit_bonus_for_payment(uuid, numeric, numeric, text, text) TO service_role;

-- ---------------------------------------------------------------------------
-- 2. Deduct bonus (used when generating a custom AI test)    [MISSING]
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.deduct_bonus(
  p_user_id UUID, p_amount NUMERIC, p_reason TEXT DEFAULT 'spend'
) RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _bal NUMERIC;
BEGIN
  IF p_amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;
  SELECT bonus_balance INTO _bal FROM public.profiles WHERE id = p_user_id FOR UPDATE;
  IF _bal IS NULL OR _bal < p_amount THEN RETURN false; END IF;

  UPDATE public.profiles SET bonus_balance = bonus_balance - p_amount WHERE id = p_user_id;
  INSERT INTO public.wallet_transactions (user_id, amount, type, bucket, status, reference)
  VALUES (p_user_id, -p_amount, 'bonus_spend', 'bonus', 'completed', p_reason);
  RETURN true;
END $$;

REVOKE ALL ON FUNCTION public.deduct_bonus(uuid, numeric, text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.deduct_bonus(uuid, numeric, text) TO service_role;

-- ---------------------------------------------------------------------------
-- 3. Hardened join_contest — checks deposit+winnings (matches the UI),
--    deducts deposits first then winnings, keeps wallet_balance in sync.
--    Signature is unchanged, so this is a drop-in improvement.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.join_contest(_contest_id UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid UUID := auth.uid();
  _c public.contests;
  _entry UUID;
  _dep NUMERIC; _win NUMERIC;
  _take_dep NUMERIC; _take_win NUMERIC;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO _c FROM public.contests WHERE id = _contest_id;
  IF _c IS NULL THEN RAISE EXCEPTION 'Contest not found'; END IF;
  IF now() >= _c.ends_at THEN RAISE EXCEPTION 'Contest already ended'; END IF;

  IF EXISTS (SELECT 1 FROM public.contest_entries WHERE contest_id = _contest_id AND user_id = _uid) THEN
    SELECT id INTO _entry FROM public.contest_entries WHERE contest_id = _contest_id AND user_id = _uid;
    RETURN _entry;
  END IF;

  IF _c.entry_fee > 0 THEN
    SELECT deposit_balance, winnings_balance INTO _dep, _win
      FROM public.profiles WHERE id = _uid FOR UPDATE;
    IF (COALESCE(_dep,0) + COALESCE(_win,0)) < _c.entry_fee THEN RAISE EXCEPTION 'Insufficient balance'; END IF;
    _take_dep := LEAST(COALESCE(_dep,0), _c.entry_fee);
    _take_win := _c.entry_fee - _take_dep;
    UPDATE public.profiles
       SET deposit_balance  = deposit_balance  - _take_dep,
           winnings_balance = winnings_balance - _take_win,
           wallet_balance   = GREATEST(0, wallet_balance - _c.entry_fee)
     WHERE id = _uid;
    INSERT INTO public.wallet_transactions (user_id, amount, type, bucket, status, reference, meta)
    VALUES (_uid, -_c.entry_fee, 'contest_entry', 'mixed', 'completed', _contest_id::text,
            jsonb_build_object('from_deposit', _take_dep, 'from_winnings', _take_win));
  END IF;

  INSERT INTO public.contest_entries (contest_id, user_id)
  VALUES (_contest_id, _uid) RETURNING id INTO _entry;
  RETURN _entry;
END $$;

GRANT EXECUTE ON FUNCTION public.join_contest(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. Relabel old daily-DPP "AI" sources to exam-style labels (one-time)
-- ---------------------------------------------------------------------------
UPDATE public.tests
   SET source = 'NCERT & PYQ'
 WHERE type = 'daily' AND (source IS NULL OR source ILIKE 'AI%');

UPDATE public.questions
   SET source = 'NCERT'
 WHERE source ILIKE 'AI-%' OR source = 'AI';

-- ---------------------------------------------------------------------------
-- Reload PostgREST schema cache so the new RPCs are callable immediately.
-- ---------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';

