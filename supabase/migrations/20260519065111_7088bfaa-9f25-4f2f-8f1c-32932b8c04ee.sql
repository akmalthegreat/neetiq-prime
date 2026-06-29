
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT, full_name TEXT, avatar_url TEXT,
  wallet_balance NUMERIC(10,2) NOT NULL DEFAULT 0,
  target_year INT, xp_total integer NOT NULL DEFAULT 0,
  daily_goal integer NOT NULL DEFAULT 20,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles viewable by owner" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id OR private.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL TO authenticated USING (private.has_role(auth.uid(), 'admin')) WITH CHECK (private.has_role(auth.uid(), 'admin'));

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

CREATE TABLE public.subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE, icon TEXT, color TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Subjects readable by all" ON public.subjects FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage subjects" ON public.subjects FOR ALL TO authenticated USING (private.has_role(auth.uid(),'admin')) WITH CHECK (private.has_role(auth.uid(),'admin'));

CREATE TABLE public.chapters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  name TEXT NOT NULL, class INT,
  order_index integer NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.chapters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Chapters readable" ON public.chapters FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage chapters" ON public.chapters FOR ALL TO authenticated USING (private.has_role(auth.uid(),'admin')) WITH CHECK (private.has_role(auth.uid(),'admin'));
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
  year INT, is_pyq boolean NOT NULL DEFAULT false, pyq_year integer,
  text_hash text GENERATED ALWAYS AS (md5(lower(btrim(text)))) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX questions_text_hash_idx ON public.questions (text_hash);
CREATE INDEX questions_subject_chapter_idx ON public.questions (subject_id, chapter_id);
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Questions readable" ON public.questions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage questions" ON public.questions FOR ALL TO authenticated USING (private.has_role(auth.uid(),'admin')) WITH CHECK (private.has_role(auth.uid(),'admin'));

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
CREATE POLICY "Tests readable" ON public.tests FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage tests" ON public.tests FOR ALL TO authenticated USING (private.has_role(auth.uid(),'admin')) WITH CHECK (private.has_role(auth.uid(),'admin'));
CREATE POLICY "Users create own practice tests" ON public.tests FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid() AND type IN ('practice','custom','bookmark','dpp'));
CREATE POLICY "Users update own practice tests" ON public.tests FOR UPDATE TO authenticated USING (created_by = auth.uid() AND type IN ('practice','custom','bookmark','dpp')) WITH CHECK (created_by = auth.uid() AND type IN ('practice','custom','bookmark','dpp'));
CREATE POLICY "Users delete own practice tests" ON public.tests FOR DELETE TO authenticated USING (created_by = auth.uid() AND type IN ('practice','custom','bookmark','dpp'));

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
CREATE POLICY "Users own attempts" ON public.attempts FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins view attempts" ON public.attempts FOR SELECT TO authenticated USING (private.has_role(auth.uid(),'admin'));

CREATE TABLE public.wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL, type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'completed',
  reference TEXT, meta JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own txns" ON public.wallet_transactions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins view txns" ON public.wallet_transactions FOR SELECT TO authenticated USING (private.has_role(auth.uid(),'admin'));

CREATE TABLE public.bookmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL, question_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, question_id)
);
ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own bookmarks" ON public.bookmarks FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins view bookmarks" ON public.bookmarks FOR SELECT TO authenticated USING (private.has_role(auth.uid(),'admin'));

CREATE TABLE public.xp_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL, attempt_id uuid,
  points integer NOT NULL,
  kind text NOT NULL CHECK (kind IN ('live','post_live','reattempt','bonus')),
  meta jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX xp_events_user_created_idx ON public.xp_events (user_id, created_at DESC);
ALTER TABLE public.xp_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own xp" ON public.xp_events FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own xp" ON public.xp_events FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins manage xp" ON public.xp_events FOR ALL TO authenticated USING (private.has_role(auth.uid(),'admin')) WITH CHECK (private.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.tg_bump_xp()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN UPDATE public.profiles SET xp_total = xp_total + NEW.points WHERE id = NEW.user_id; RETURN NEW; END $$;
CREATE TRIGGER xp_events_bump AFTER INSERT ON public.xp_events FOR EACH ROW EXECUTE FUNCTION public.tg_bump_xp();

CREATE TABLE public.wrong_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  question_id uuid NOT NULL,
  chapter_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, question_id)
);
ALTER TABLE public.wrong_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users select own wrong" ON public.wrong_questions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own wrong" ON public.wrong_questions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own wrong" ON public.wrong_questions FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX wrong_questions_user_chapter_idx ON public.wrong_questions (user_id, chapter_id);

CREATE TABLE public.payment_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
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
CREATE POLICY "Users view own payment orders" ON public.payment_orders FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins view all payment orders" ON public.payment_orders FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'));
CREATE TRIGGER payment_orders_updated_at BEFORE UPDATE ON public.payment_orders FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE OR REPLACE FUNCTION public.credit_wallet_for_payment(_user_id UUID, _amount NUMERIC, _razorpay_order_id TEXT, _razorpay_payment_id TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _existing INT;
BEGIN
  IF _amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;
  SELECT COUNT(*) INTO _existing FROM public.wallet_transactions WHERE reference = _razorpay_payment_id AND type = 'recharge';
  IF _existing > 0 THEN RETURN false; END IF;
  INSERT INTO public.wallet_transactions (user_id, amount, type, status, reference, meta)
  VALUES (_user_id, _amount, 'recharge', 'completed', _razorpay_payment_id, jsonb_build_object('razorpay_order_id', _razorpay_order_id));
  UPDATE public.profiles SET wallet_balance = wallet_balance + _amount WHERE id = _user_id;
  UPDATE public.payment_orders SET status = 'paid', razorpay_payment_id = _razorpay_payment_id, verified_at = now()
  WHERE razorpay_order_id = _razorpay_order_id AND user_id = _user_id;
  RETURN true;
END; $$;

CREATE TABLE public.admin_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL, target text, meta jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX admin_actions_created_idx ON public.admin_actions(created_at DESC);
ALTER TABLE public.admin_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read actions" ON public.admin_actions FOR SELECT TO authenticated USING (private.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins write actions" ON public.admin_actions FOR INSERT TO authenticated WITH CHECK (private.has_role(auth.uid(),'admin'));

CREATE TABLE public.bug_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  title text NOT NULL, description text,
  severity text NOT NULL DEFAULT 'medium' CHECK (severity IN ('low','medium','high','critical')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','investigating','resolved','closed')),
  meta jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX bug_reports_created_idx ON public.bug_reports(created_at DESC);
ALTER TABLE public.bug_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users submit bugs" ON public.bug_reports FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users view own bugs" ON public.bug_reports FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins read all bugs" ON public.bug_reports FOR SELECT TO authenticated USING (private.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins update bugs" ON public.bug_reports FOR UPDATE TO authenticated USING (private.has_role(auth.uid(),'admin')) WITH CHECK (private.has_role(auth.uid(),'admin'));
CREATE TRIGGER bug_reports_updated_at BEFORE UPDATE ON public.bug_reports FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.cron_job_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name text NOT NULL, status text NOT NULL, details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX cron_job_runs_created_idx ON public.cron_job_runs(created_at DESC);
ALTER TABLE public.cron_job_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read cron history" ON public.cron_job_runs FOR SELECT TO authenticated USING (private.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.get_leaderboard(_limit int DEFAULT 100)
RETURNS TABLE(id uuid, full_name text, email text, xp_total int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.full_name, p.email, p.xp_total
  FROM public.profiles p
  WHERE p.xp_total > 0
  ORDER BY p.xp_total DESC, p.created_at ASC
  LIMIT GREATEST(_limit, 1);
$$;

CREATE OR REPLACE FUNCTION public.get_user_rank(_user_id uuid)
RETURNS int LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT (SELECT COUNT(*)::int + 1 FROM public.profiles p2
    WHERE p2.xp_total > (SELECT xp_total FROM public.profiles WHERE id = _user_id));
$$;

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;
REVOKE ALL ON FUNCTION public.get_leaderboard(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_leaderboard(integer) TO authenticated, anon;
REVOKE ALL ON FUNCTION public.get_user_rank(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_rank(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.credit_wallet_for_payment(uuid, numeric, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.credit_wallet_for_payment(uuid, numeric, text, text) TO service_role;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_bump_xp() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_set_updated_at() FROM PUBLIC, anon, authenticated;

GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated;
REVOKE USAGE ON SCHEMA private FROM anon;
REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM anon;
