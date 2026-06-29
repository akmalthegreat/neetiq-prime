-- =========================================================
--  Core: roles + profiles (with wallet split)
-- =========================================================
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT, full_name TEXT, avatar_url TEXT,
  wallet_balance NUMERIC(10,2) NOT NULL DEFAULT 0,
  deposit_balance  NUMERIC(10,2) NOT NULL DEFAULT 0,
  winnings_balance NUMERIC(10,2) NOT NULL DEFAULT 0,
  bonus_balance    NUMERIC(10,2) NOT NULL DEFAULT 0,
  target_year INT,
  xp_total INTEGER NOT NULL DEFAULT 0,
  daily_goal INTEGER NOT NULL DEFAULT 20,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles viewable by owner" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users update own profile"   ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users insert own profile"   ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR private.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage roles"  ON public.user_roles FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin')) WITH CHECK (private.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(COALESCE(NEW.email,''),'@',1)));
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user') ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.tg_set_updated_at() RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- =========================================================
--  Subjects / chapters / questions / tests / attempts
-- =========================================================
CREATE TABLE public.subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE, icon TEXT, color TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.subjects TO authenticated;
GRANT ALL ON public.subjects TO service_role;
CREATE POLICY "Subjects readable by all" ON public.subjects FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage subjects"   ON public.subjects FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin')) WITH CHECK (private.has_role(auth.uid(),'admin'));

CREATE TABLE public.chapters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  name TEXT NOT NULL, class INT,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.chapters ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.chapters TO authenticated;
GRANT ALL ON public.chapters TO service_role;
CREATE POLICY "Chapters readable"     ON public.chapters FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage chapters" ON public.chapters FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin')) WITH CHECK (private.has_role(auth.uid(),'admin'));
CREATE INDEX chapters_subject_name_idx ON public.chapters (subject_id, lower(name));

CREATE TABLE public.questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
  chapter_id UUID REFERENCES public.chapters(id) ON DELETE SET NULL,
  text TEXT NOT NULL, options JSONB NOT NULL,
  correct_index INT NOT NULL, explanation TEXT,
  difficulty TEXT NOT NULL DEFAULT 'medium',
  source TEXT NOT NULL DEFAULT 'NCERT',
  marks_correct INT NOT NULL DEFAULT 4,
  marks_wrong INT NOT NULL DEFAULT -1,
  year INT, is_pyq BOOLEAN NOT NULL DEFAULT false, pyq_year INTEGER,
  text_hash TEXT GENERATED ALWAYS AS (md5(lower(btrim(text)))) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX questions_text_hash_idx ON public.questions (text_hash);
CREATE INDEX questions_subject_chapter_idx ON public.questions (subject_id, chapter_id);
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.questions TO authenticated;
GRANT ALL ON public.questions TO service_role;
CREATE POLICY "Questions readable"      ON public.questions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage questions" ON public.questions FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin')) WITH CHECK (private.has_role(auth.uid(),'admin'));

CREATE TABLE public.tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL, description TEXT,
  type TEXT NOT NULL DEFAULT 'quiz',
  difficulty TEXT NOT NULL DEFAULT 'medium',
  duration_min INT NOT NULL DEFAULT 30,
  total_questions INT NOT NULL DEFAULT 10,
  is_paid BOOLEAN NOT NULL DEFAULT false,
  entry_fee NUMERIC(10,2) NOT NULL DEFAULT 0,
  prize_pool NUMERIC(10,2) NOT NULL DEFAULT 0,
  starts_at TIMESTAMPTZ, ends_at TIMESTAMPTZ,
  question_ids UUID[] NOT NULL DEFAULT '{}',
  marks_correct INT NOT NULL DEFAULT 4,
  marks_wrong INT NOT NULL DEFAULT -1,
  source TEXT NOT NULL DEFAULT 'NCERT',
  syllabus JSONB,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX tests_created_by_type_idx ON public.tests (created_by, type, created_at DESC);
ALTER TABLE public.tests ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tests TO authenticated;
GRANT ALL ON public.tests TO service_role;
CREATE POLICY "Tests readable"      ON public.tests FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage tests" ON public.tests FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin')) WITH CHECK (private.has_role(auth.uid(),'admin'));
CREATE POLICY "Users create own practice tests" ON public.tests FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND type IN ('practice','custom','bookmark','dpp'));
CREATE POLICY "Users update own practice tests" ON public.tests FOR UPDATE TO authenticated
  USING (created_by = auth.uid() AND type IN ('practice','custom','bookmark','dpp'))
  WITH CHECK (created_by = auth.uid() AND type IN ('practice','custom','bookmark','dpp'));
CREATE POLICY "Users delete own practice tests" ON public.tests FOR DELETE TO authenticated
  USING (created_by = auth.uid() AND type IN ('practice','custom','bookmark','dpp'));

CREATE TABLE public.attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  test_id UUID NOT NULL REFERENCES public.tests(id) ON DELETE CASCADE,
  answers JSONB NOT NULL DEFAULT '{}',
  bookmarks JSONB NOT NULL DEFAULT '[]',
  score NUMERIC(10,2), correct_count INT, wrong_count INT, unattempted_count INT,
  time_taken_sec INT,
  status TEXT NOT NULL DEFAULT 'in_progress',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  submitted_at TIMESTAMPTZ
);
CREATE INDEX attempts_user_test_status_idx ON public.attempts (user_id, test_id, status);
ALTER TABLE public.attempts ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attempts TO authenticated;
GRANT ALL ON public.attempts TO service_role;
CREATE POLICY "Users own attempts"  ON public.attempts FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins view attempts" ON public.attempts FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(),'admin'));

CREATE TABLE public.wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL,
  type TEXT NOT NULL,
  bucket TEXT NOT NULL DEFAULT 'deposit',
  status TEXT NOT NULL DEFAULT 'completed',
  reference TEXT, meta JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.wallet_transactions TO authenticated;
GRANT ALL ON public.wallet_transactions TO service_role;
CREATE POLICY "Users own txns"      ON public.wallet_transactions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins view all txns" ON public.wallet_transactions FOR SELECT TO authenticated USING (private.has_role(auth.uid(),'admin'));

CREATE TABLE public.bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL, question_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, question_id)
);
ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, DELETE ON public.bookmarks TO authenticated;
GRANT ALL ON public.bookmarks TO service_role;
CREATE POLICY "Users manage own bookmarks" ON public.bookmarks FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins view bookmarks" ON public.bookmarks FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(),'admin'));

CREATE TABLE public.xp_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL, attempt_id UUID,
  points INTEGER NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('live','post_live','reattempt','bonus','contest')),
  meta JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX xp_events_user_created_idx ON public.xp_events (user_id, created_at DESC);
ALTER TABLE public.xp_events ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.xp_events TO authenticated;
GRANT ALL ON public.xp_events TO service_role;
CREATE POLICY "Users view own xp"  ON public.xp_events FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins manage xp"   ON public.xp_events FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin')) WITH CHECK (private.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.tg_bump_xp()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN UPDATE public.profiles SET xp_total = xp_total + NEW.points WHERE id = NEW.user_id; RETURN NEW; END $$;
CREATE TRIGGER xp_events_bump AFTER INSERT ON public.xp_events FOR EACH ROW EXECUTE FUNCTION public.tg_bump_xp();

CREATE TABLE public.wrong_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL, question_id UUID NOT NULL, chapter_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, question_id)
);
ALTER TABLE public.wrong_questions ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, DELETE ON public.wrong_questions TO authenticated;
GRANT ALL ON public.wrong_questions TO service_role;
CREATE POLICY "Users select own wrong" ON public.wrong_questions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own wrong" ON public.wrong_questions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own wrong" ON public.wrong_questions FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX wrong_questions_user_chapter_idx ON public.wrong_questions (user_id, chapter_id);

-- =========================================================
--  Razorpay payments
-- =========================================================
CREATE TABLE public.payment_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  razorpay_order_id TEXT NOT NULL UNIQUE,
  razorpay_payment_id TEXT,
  status TEXT NOT NULL DEFAULT 'created',
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX payment_orders_user_idx ON public.payment_orders(user_id, created_at DESC);
ALTER TABLE public.payment_orders ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.payment_orders TO authenticated;
GRANT ALL ON public.payment_orders TO service_role;
CREATE POLICY "Users view own payment orders" ON public.payment_orders FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins view all payment orders" ON public.payment_orders FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'));
CREATE TRIGGER payment_orders_updated_at BEFORE UPDATE ON public.payment_orders FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE OR REPLACE FUNCTION public.credit_wallet_for_payment(
  _user_id UUID, _amount NUMERIC, _razorpay_order_id TEXT, _razorpay_payment_id TEXT
) RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _existing INT;
BEGIN
  IF _amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;
  SELECT COUNT(*) INTO _existing FROM public.wallet_transactions
    WHERE reference = _razorpay_payment_id AND type = 'recharge';
  IF _existing > 0 THEN RETURN false; END IF;
  INSERT INTO public.wallet_transactions (user_id, amount, type, bucket, status, reference, meta)
  VALUES (_user_id, _amount, 'recharge', 'deposit', 'completed', _razorpay_payment_id,
          jsonb_build_object('razorpay_order_id', _razorpay_order_id));
  UPDATE public.profiles
    SET deposit_balance = deposit_balance + _amount,
        wallet_balance  = wallet_balance  + _amount
    WHERE id = _user_id;
  UPDATE public.payment_orders
    SET status = 'paid', razorpay_payment_id = _razorpay_payment_id, verified_at = now()
    WHERE razorpay_order_id = _razorpay_order_id AND user_id = _user_id;
  RETURN true;
END; $$;

-- =========================================================
--  Withdrawals
-- =========================================================
CREATE TABLE public.withdrawal_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL CHECK (amount >= 50),
  upi_or_note TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','rejected')),
  admin_note TEXT,
  processed_at TIMESTAMPTZ,
  processed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX withdrawal_requests_status_idx ON public.withdrawal_requests (status, created_at DESC);
CREATE INDEX withdrawal_requests_user_idx   ON public.withdrawal_requests (user_id, created_at DESC);
ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.withdrawal_requests TO authenticated;
GRANT ALL ON public.withdrawal_requests TO service_role;
CREATE POLICY "Users view own withdrawals"  ON public.withdrawal_requests FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins view all withdrawals" ON public.withdrawal_requests FOR SELECT TO authenticated USING (private.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.request_withdrawal(_amount NUMERIC, _upi_or_note TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid UUID := auth.uid(); _req UUID;
        _dep NUMERIC; _win NUMERIC; _take_dep NUMERIC; _take_win NUMERIC;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _amount < 50 THEN RAISE EXCEPTION 'Minimum withdrawal is 50'; END IF;
  IF length(_upi_or_note) < 3 THEN RAISE EXCEPTION 'UPI / note required'; END IF;
  SELECT deposit_balance, winnings_balance INTO _dep, _win
    FROM public.profiles WHERE id = _uid FOR UPDATE;
  IF (_dep + _win) < _amount THEN RAISE EXCEPTION 'Insufficient withdrawable balance'; END IF;
  _take_win := LEAST(_win, _amount);
  _take_dep := _amount - _take_win;
  UPDATE public.profiles
     SET winnings_balance = winnings_balance - _take_win,
         deposit_balance  = deposit_balance  - _take_dep,
         wallet_balance   = wallet_balance   - _amount
   WHERE id = _uid;
  INSERT INTO public.withdrawal_requests (user_id, amount, upi_or_note)
    VALUES (_uid, _amount, _upi_or_note) RETURNING id INTO _req;
  INSERT INTO public.wallet_transactions (user_id, amount, type, bucket, status, reference, meta)
    VALUES (_uid, -_amount, 'withdraw_hold', 'mixed', 'pending', _req::text,
            jsonb_build_object('from_winnings', _take_win, 'from_deposit', _take_dep));
  RETURN _req;
END $$;

CREATE OR REPLACE FUNCTION public.approve_withdrawal(_request_id UUID, _admin_note TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _admin UUID := auth.uid(); _r public.withdrawal_requests;
BEGIN
  IF NOT private.has_role(_admin, 'admin') THEN RAISE EXCEPTION 'Admin only'; END IF;
  SELECT * INTO _r FROM public.withdrawal_requests WHERE id = _request_id FOR UPDATE;
  IF _r IS NULL THEN RAISE EXCEPTION 'Not found'; END IF;
  IF _r.status <> 'pending' THEN RAISE EXCEPTION 'Already processed'; END IF;
  UPDATE public.withdrawal_requests
     SET status = 'paid', admin_note = _admin_note,
         processed_at = now(), processed_by = _admin
   WHERE id = _request_id;
  INSERT INTO public.wallet_transactions (user_id, amount, type, bucket, status, reference)
    VALUES (_r.user_id, -_r.amount, 'withdraw', 'mixed', 'completed', _request_id::text);
END $$;

CREATE OR REPLACE FUNCTION public.reject_withdrawal(_request_id UUID, _admin_note TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _admin UUID := auth.uid(); _r public.withdrawal_requests;
        _from_win NUMERIC; _from_dep NUMERIC;
BEGIN
  IF NOT private.has_role(_admin, 'admin') THEN RAISE EXCEPTION 'Admin only'; END IF;
  SELECT * INTO _r FROM public.withdrawal_requests WHERE id = _request_id FOR UPDATE;
  IF _r IS NULL THEN RAISE EXCEPTION 'Not found'; END IF;
  IF _r.status <> 'pending' THEN RAISE EXCEPTION 'Already processed'; END IF;
  SELECT (meta->>'from_winnings')::numeric, (meta->>'from_deposit')::numeric
    INTO _from_win, _from_dep
    FROM public.wallet_transactions
   WHERE reference = _request_id::text AND type = 'withdraw_hold' LIMIT 1;
  IF _from_win IS NULL THEN _from_win := 0; _from_dep := _r.amount; END IF;
  UPDATE public.profiles
     SET winnings_balance = winnings_balance + _from_win,
         deposit_balance  = deposit_balance  + _from_dep,
         wallet_balance   = wallet_balance   + _r.amount
   WHERE id = _r.user_id;
  UPDATE public.withdrawal_requests
     SET status = 'rejected', admin_note = _admin_note,
         processed_at = now(), processed_by = _admin
   WHERE id = _request_id;
  INSERT INTO public.wallet_transactions (user_id, amount, type, bucket, status, reference)
    VALUES (_r.user_id, _r.amount, 'withdraw_refund', 'mixed', 'completed', _request_id::text);
END $$;

CREATE OR REPLACE FUNCTION public.admin_list_pending_withdrawals()
RETURNS TABLE(id UUID, user_id UUID, full_name TEXT, email TEXT,
              amount NUMERIC, upi_or_note TEXT, available_balance NUMERIC, created_at TIMESTAMPTZ)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT w.id, w.user_id, p.full_name, p.email, w.amount, w.upi_or_note,
         (p.deposit_balance + p.winnings_balance) AS available_balance, w.created_at
  FROM public.withdrawal_requests w
  JOIN public.profiles p ON p.id = w.user_id
  WHERE w.status = 'pending' AND private.has_role(auth.uid(),'admin')
  ORDER BY w.created_at ASC;
$$;

-- =========================================================
--  Contests
-- =========================================================
CREATE TABLE public.contests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  prize_pool NUMERIC(10,2) NOT NULL DEFAULT 0,
  entry_fee  NUMERIC(10,2) NOT NULL DEFAULT 0,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at   TIMESTAMPTZ NOT NULL,
  duration_min INT NOT NULL,
  total_questions INT NOT NULL,
  chapter_ids UUID[] NOT NULL DEFAULT '{}',
  question_ids UUID[] NOT NULL DEFAULT '{}',
  test_id UUID NOT NULL REFERENCES public.tests(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','live','finalized','cancelled')),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX contests_starts_idx ON public.contests (starts_at DESC);
CREATE INDEX contests_status_idx ON public.contests (status, ends_at);
ALTER TABLE public.contests ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.contests TO authenticated;
GRANT ALL ON public.contests TO service_role;
CREATE POLICY "Contests readable"     ON public.contests FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage contests" ON public.contests FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin')) WITH CHECK (private.has_role(auth.uid(),'admin'));

CREATE TABLE public.contest_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_id UUID NOT NULL REFERENCES public.contests(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id)      ON DELETE CASCADE,
  attempt_id UUID REFERENCES public.attempts(id) ON DELETE SET NULL,
  joined_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (contest_id, user_id)
);
CREATE INDEX contest_entries_contest_idx ON public.contest_entries (contest_id);
CREATE INDEX contest_entries_user_idx    ON public.contest_entries (user_id);
ALTER TABLE public.contest_entries ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.contest_entries TO authenticated;
GRANT ALL ON public.contest_entries TO service_role;
CREATE POLICY "Users view own entries" ON public.contest_entries FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Anyone view counts"     ON public.contest_entries FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage entries"  ON public.contest_entries FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin')) WITH CHECK (private.has_role(auth.uid(),'admin'));

CREATE TABLE public.contest_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_id UUID NOT NULL REFERENCES public.contests(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rank INT NOT NULL,
  score NUMERIC(10,2) NOT NULL DEFAULT 0,
  time_taken_sec INT,
  prize_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (contest_id, user_id)
);
CREATE INDEX contest_results_contest_rank_idx ON public.contest_results (contest_id, rank);
ALTER TABLE public.contest_results ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.contest_results TO authenticated;
GRANT ALL ON public.contest_results TO service_role;
CREATE POLICY "Users view own results" ON public.contest_results
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR private.has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.join_contest(_contest_id UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid UUID := auth.uid(); _c public.contests; _entry UUID; _bal NUMERIC;
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
    SELECT wallet_balance INTO _bal FROM public.profiles WHERE id = _uid FOR UPDATE;
    IF _bal < _c.entry_fee THEN RAISE EXCEPTION 'Insufficient balance'; END IF;
    UPDATE public.profiles
       SET deposit_balance = GREATEST(0, deposit_balance - _c.entry_fee),
           wallet_balance  = wallet_balance - _c.entry_fee
     WHERE id = _uid;
    INSERT INTO public.wallet_transactions (user_id, amount, type, bucket, status, reference)
      VALUES (_uid, -_c.entry_fee, 'contest_entry', 'deposit', 'completed', _contest_id::text);
  END IF;
  INSERT INTO public.contest_entries (contest_id, user_id)
    VALUES (_contest_id, _uid) RETURNING id INTO _entry;
  RETURN _entry;
END $$;

CREATE OR REPLACE FUNCTION public.finalize_contest(_contest_id UUID)
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _c public.contests; _n INT := 0; _r RECORD;
BEGIN
  SELECT * INTO _c FROM public.contests WHERE id = _contest_id FOR UPDATE;
  IF _c IS NULL THEN RAISE EXCEPTION 'Contest not found'; END IF;
  IF _c.status = 'finalized' THEN RETURN 0; END IF;
  IF now() < _c.ends_at THEN RAISE EXCEPTION 'Contest not yet ended'; END IF;
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
         CASE rnk
           WHEN 1 THEN _c.prize_pool * 0.50
           WHEN 2 THEN _c.prize_pool * 0.30
           WHEN 3 THEN _c.prize_pool * 0.20
           ELSE 0
         END
  FROM ranked
  ON CONFLICT (contest_id, user_id) DO NOTHING;
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

-- =========================================================
--  Admin / observability tables
-- =========================================================
CREATE TABLE public.admin_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL, target TEXT, meta JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX admin_actions_created_idx ON public.admin_actions(created_at DESC);
ALTER TABLE public.admin_actions ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON public.admin_actions TO authenticated;
GRANT ALL ON public.admin_actions TO service_role;
CREATE POLICY "Admins read actions"  ON public.admin_actions FOR SELECT TO authenticated USING (private.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins write actions" ON public.admin_actions FOR INSERT TO authenticated WITH CHECK (private.has_role(auth.uid(),'admin'));

CREATE TABLE public.bug_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  title TEXT NOT NULL, description TEXT,
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low','medium','high','critical')),
  status   TEXT NOT NULL DEFAULT 'open'  CHECK (status IN ('open','investigating','resolved','closed')),
  meta JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX bug_reports_created_idx ON public.bug_reports(created_at DESC);
ALTER TABLE public.bug_reports ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.bug_reports TO authenticated;
GRANT ALL ON public.bug_reports TO service_role;
CREATE POLICY "Users submit bugs"   ON public.bug_reports FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users view own bugs" ON public.bug_reports FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins read all bugs" ON public.bug_reports FOR SELECT TO authenticated USING (private.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins update bugs"  ON public.bug_reports FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(),'admin')) WITH CHECK (private.has_role(auth.uid(),'admin'));
CREATE TRIGGER bug_reports_updated_at BEFORE UPDATE ON public.bug_reports FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.cron_job_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name TEXT NOT NULL, status TEXT NOT NULL, details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX cron_job_runs_created_idx ON public.cron_job_runs(created_at DESC);
ALTER TABLE public.cron_job_runs ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.cron_job_runs TO authenticated;
GRANT ALL ON public.cron_job_runs TO service_role;
CREATE POLICY "Admins read cron history" ON public.cron_job_runs FOR SELECT TO authenticated USING (private.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.get_leaderboard(_limit INT DEFAULT 100)
RETURNS TABLE(id UUID, full_name TEXT, email TEXT, xp_total INT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.full_name, p.email, p.xp_total FROM public.profiles p
  WHERE p.xp_total > 0
  ORDER BY p.xp_total DESC, p.created_at ASC
  LIMIT GREATEST(_limit, 1);
$$;

CREATE OR REPLACE FUNCTION public.get_user_rank(_user_id UUID)
RETURNS INT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT (SELECT COUNT(*)::INT + 1 FROM public.profiles p2
    WHERE p2.xp_total > (SELECT xp_total FROM public.profiles WHERE id = _user_id));
$$;

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;
REVOKE ALL ON FUNCTION public.get_leaderboard(integer) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.get_leaderboard(integer) TO authenticated, anon;
REVOKE ALL ON FUNCTION public.get_user_rank(uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.get_user_rank(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.credit_wallet_for_payment(uuid, numeric, text, text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.credit_wallet_for_payment(uuid, numeric, text, text) TO service_role;
GRANT  EXECUTE ON FUNCTION public.request_withdrawal(numeric, text)        TO authenticated;
GRANT  EXECUTE ON FUNCTION public.approve_withdrawal(uuid, text)           TO authenticated;
GRANT  EXECUTE ON FUNCTION public.reject_withdrawal(uuid, text)            TO authenticated;
GRANT  EXECUTE ON FUNCTION public.admin_list_pending_withdrawals()         TO authenticated;
GRANT  EXECUTE ON FUNCTION public.join_contest(uuid)                       TO authenticated;
GRANT  EXECUTE ON FUNCTION public.finalize_contest(uuid)                   TO authenticated;

GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated;
REVOKE USAGE ON SCHEMA private FROM anon;
REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM anon;

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
  ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users update own notifications"
  ON public.notifications FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============ ai_api_keys ============
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
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_api_keys TO authenticated;
GRANT ALL ON public.ai_api_keys TO service_role;
ALTER TABLE public.ai_api_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage ai keys"
ON public.ai_api_keys FOR ALL TO authenticated
USING (private.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.admin_list_ai_keys()
RETURNS TABLE(id uuid, label text, last_four text, is_active boolean, last_used_at timestamptz, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT k.id, k.label, k.last_four, k.is_active, k.last_used_at, k.created_at
  FROM public.ai_api_keys k
  WHERE private.has_role(auth.uid(), 'admin')
  ORDER BY k.created_at DESC;
$$;
GRANT EXECUTE ON FUNCTION public.admin_list_ai_keys() TO authenticated;

-- realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.attempts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.contest_entries;
ALTER PUBLICATION supabase_realtime ADD TABLE public.contest_results;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER TABLE public.attempts REPLICA IDENTITY FULL;
ALTER TABLE public.contest_entries REPLICA IDENTITY FULL;
ALTER TABLE public.contest_results REPLICA IDENTITY FULL;

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- award_attempt_xp (replaces user INSERT on xp_events)
CREATE OR REPLACE FUNCTION public.award_attempt_xp(_attempt_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _a public.attempts; _t public.tests;
  _kind text; _in_window boolean; _mult numeric;
  _xp integer; _correct int; _wrong int; _prior int;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO _a FROM public.attempts WHERE id = _attempt_id AND user_id = _uid;
  IF _a IS NULL THEN RAISE EXCEPTION 'Attempt not found'; END IF;
  IF _a.status <> 'completed' THEN RAISE EXCEPTION 'Attempt not completed'; END IF;
  IF EXISTS (SELECT 1 FROM public.xp_events WHERE attempt_id = _attempt_id) THEN RETURN 0; END IF;
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
  _xp := GREATEST(0, (_correct * 4 - _wrong * 1));
  _xp := GREATEST(0, FLOOR(_xp * _mult)::int);
  IF _xp > 0 THEN
    INSERT INTO public.xp_events (user_id, attempt_id, points, kind, meta)
    VALUES (_uid, _attempt_id, _xp, _kind, jsonb_build_object('correct', _correct, 'wrong', _wrong));
  END IF;
  RETURN _xp;
END $$;
REVOKE ALL ON FUNCTION public.award_attempt_xp(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.award_attempt_xp(uuid) TO authenticated;

-- question diagrams
CREATE TABLE public.question_diagrams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid REFERENCES public.questions(id) ON DELETE CASCADE,
  mime text NOT NULL DEFAULT 'image/png',
  data bytea NOT NULL,
  prompt text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.question_diagrams TO anon, authenticated;
GRANT ALL ON public.question_diagrams TO service_role;
ALTER TABLE public.question_diagrams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "diagrams public read" ON public.question_diagrams FOR SELECT
  TO anon, authenticated USING (true);

-- =========================================================
--  Question reports (new feature)
-- =========================================================
CREATE TABLE public.question_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  details TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','verified_bad','rejected','deleted')),
  ai_verdict JSONB,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (question_id, user_id)
);
CREATE INDEX question_reports_status_idx ON public.question_reports(status, created_at DESC);
CREATE INDEX question_reports_question_idx ON public.question_reports(question_id);
GRANT SELECT, INSERT ON public.question_reports TO authenticated;
GRANT ALL ON public.question_reports TO service_role;
ALTER TABLE public.question_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users submit reports" ON public.question_reports
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users view own reports" ON public.question_reports
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR private.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage reports" ON public.question_reports
  FOR ALL TO authenticated USING (private.has_role(auth.uid(),'admin')) WITH CHECK (private.has_role(auth.uid(),'admin'));