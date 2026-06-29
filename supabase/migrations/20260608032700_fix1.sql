-- =====================================================================
-- PENDING DB CHANGES — CONSOLIDATED
-- =====================================================================
-- The project uses an EXTERNAL Supabase project (see src/integrations/supabase/config.ts).
-- Lovable's managed migration tool is not connected to it, so apply the SQL below
-- yourself via the Supabase SQL editor or `supabase db push` against the external project.
--
-- Order matters. Run from top to bottom.
-- Each block is idempotent (CREATE IF NOT EXISTS / DROP POLICY IF EXISTS / etc).
--
-- Source files merged here:
--   1) flashcards.sql
--   2) infinite-run.sql               (admin-only feature)
--   3) premium-feedback-support.sql
--   4) ai-path-predictor-highlights.sql
--   5) feature-bonus-costs.sql
--   6) fixes.sql, fixes-2.sql, fixes-3.sql
-- =====================================================================


-- ===== flashcards.sql =====
-- =========================================================================
-- NEETIQ Prime — Flashcards schema
-- Paste into Supabase SQL Editor and run once. Safe to re-run (idempotent).
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.flashcards (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id  uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
  chapter_id  uuid REFERENCES public.chapters(id) ON DELETE SET NULL,
  front       text NOT NULL,
  back        text NOT NULL,
  difficulty  text NOT NULL DEFAULT 'medium',
  source      text NOT NULL DEFAULT 'NCERT',
  created_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_flashcards_chapter ON public.flashcards(chapter_id);
CREATE INDEX IF NOT EXISTS idx_flashcards_subject ON public.flashcards(subject_id);

GRANT SELECT ON public.flashcards TO anon, authenticated;
GRANT ALL    ON public.flashcards TO service_role;

ALTER TABLE public.flashcards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "flashcards_select_all" ON public.flashcards;
CREATE POLICY "flashcards_select_all" ON public.flashcards
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "flashcards_admin_write" ON public.flashcards;
CREATE POLICY "flashcards_admin_write" ON public.flashcards
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ---------------------------------------------------------------------------
-- Per-user review log (lightweight spaced repetition history)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.flashcard_reviews (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  card_id     uuid NOT NULL REFERENCES public.flashcards(id) ON DELETE CASCADE,
  rating      smallint NOT NULL CHECK (rating BETWEEN 1 AND 3), -- 1=again 2=good 3=easy
  reviewed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_flashcard_reviews_user
  ON public.flashcard_reviews(user_id, reviewed_at DESC);

GRANT SELECT, INSERT ON public.flashcard_reviews TO authenticated;
GRANT ALL ON public.flashcard_reviews TO service_role;

ALTER TABLE public.flashcard_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "flashcard_reviews_own_select" ON public.flashcard_reviews;
CREATE POLICY "flashcard_reviews_own_select" ON public.flashcard_reviews
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "flashcard_reviews_own_insert" ON public.flashcard_reviews;
CREATE POLICY "flashcard_reviews_own_insert" ON public.flashcard_reviews
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- ===== infinite-run.sql =====
-- Mirror of supabase/migrations/20260607030000_infinite_run.sql
-- Apply this against any new Supabase project that doesn't already have the infinite_runs tables.

create table if not exists public.infinite_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  status text not null default 'running' check (status in ('running','paused','stopped','exhausted','error')),
  modes jsonb not null default '["dpp","flashcards","ncert"]'::jsonb,
  per_tick_count int not null default 5,
  tick_interval_sec int not null default 60,
  total_credits_spent int not null default 0,
  total_items_generated int not null default 0,
  last_tick_at timestamptz,
  last_error text,
  started_at timestamptz not null default now(),
  stopped_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create index if not exists infinite_runs_status_idx on public.infinite_runs(status);
grant select, insert, update, delete on public.infinite_runs to authenticated;
grant all on public.infinite_runs to service_role;
alter table public.infinite_runs enable row level security;

create policy "users read own infinite run" on public.infinite_runs for select to authenticated using (auth.uid() = user_id);
create policy "users insert own infinite run" on public.infinite_runs for insert to authenticated with check (auth.uid() = user_id);
create policy "users update own infinite run" on public.infinite_runs for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users delete own infinite run" on public.infinite_runs for delete to authenticated using (auth.uid() = user_id);

create table if not exists public.infinite_run_events (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references public.infinite_runs(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  kind text not null,
  mode text,
  items_generated int not null default 0,
  credits_spent int not null default 0,
  detail jsonb,
  created_at timestamptz not null default now()
);
create index if not exists infinite_run_events_run_id_idx on public.infinite_run_events(run_id, created_at desc);
grant select, insert on public.infinite_run_events to authenticated;
grant all on public.infinite_run_events to service_role;
alter table public.infinite_run_events enable row level security;
create policy "users read own run events" on public.infinite_run_events for select to authenticated using (auth.uid() = user_id);

-- ===== premium-feedback-support.sql =====
-- =========================================================================
-- NEETIQ Prime — Premium / Feedback / Support schema
-- Paste this in your Supabase SQL editor (one-time setup).
-- =========================================================================

-- subscriptions
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan text NOT NULL CHECK (plan IN ('monthly','yearly')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','expired','cancelled')),
  started_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  razorpay_payment_id text,
  razorpay_order_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS subscriptions_user_idx ON public.subscriptions(user_id, status, expires_at DESC);
GRANT SELECT ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own subs" ON public.subscriptions;
CREATE POLICY "Users read own subs" ON public.subscriptions
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR private.has_role(auth.uid(),'admin'));

-- feedback
CREATE TABLE IF NOT EXISTS public.feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating int NOT NULL CHECK (rating BETWEEN 1 AND 5),
  category text NOT NULL DEFAULT 'other' CHECK (category IN ('bug','idea','other')),
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS feedback_created_idx ON public.feedback(created_at DESC);
GRANT SELECT, INSERT ON public.feedback TO authenticated;
GRANT ALL ON public.feedback TO service_role;
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users insert own feedback" ON public.feedback;
CREATE POLICY "Users insert own feedback" ON public.feedback
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users read own feedback" ON public.feedback;
CREATE POLICY "Users read own feedback" ON public.feedback
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR private.has_role(auth.uid(),'admin'));

-- support tickets
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mode text NOT NULL DEFAULT 'ai' CHECK (mode IN ('ai','team')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS support_tickets_user_idx ON public.support_tickets(user_id, status);
CREATE INDEX IF NOT EXISTS support_tickets_open_idx ON public.support_tickets(status, updated_at DESC);
GRANT SELECT, UPDATE ON public.support_tickets TO authenticated;
GRANT ALL ON public.support_tickets TO service_role;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users see own tickets" ON public.support_tickets;
CREATE POLICY "Users see own tickets" ON public.support_tickets
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR private.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "Admins update tickets" ON public.support_tickets;
CREATE POLICY "Admins update tickets" ON public.support_tickets
  FOR UPDATE TO authenticated USING (private.has_role(auth.uid(),'admin')) WITH CHECK (private.has_role(auth.uid(),'admin'));

CREATE TABLE IF NOT EXISTS public.support_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  sender text NOT NULL CHECK (sender IN ('user','ai','admin')),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS support_messages_ticket_idx ON public.support_messages(ticket_id, created_at);
GRANT SELECT ON public.support_messages TO authenticated;
GRANT ALL ON public.support_messages TO service_role;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Read messages for own tickets" ON public.support_messages;
CREATE POLICY "Read messages for own tickets" ON public.support_messages
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.support_tickets t WHERE t.id = ticket_id AND (t.user_id = auth.uid() OR private.has_role(auth.uid(),'admin')))
  );

NOTIFY pgrst, 'reload schema';

