-- ============================================================================
-- Daily Mega Quiz (6:00 PM IST, 80 questions, ₹21 to the winner)
-- Everything that decides a result lives here, on the server:
--   * the paper is built from the Yakeen NEET 2.0 2027 test planner syllabus,
--   * questions are served one at a time on a fixed live schedule,
--   * correct answers never leave the database until the quiz has ended,
--   * the day's questions are hidden from the public question bank while live.
-- ============================================================================

-- 1) Syllabus schedule (one row per planner test) ----------------------------
CREATE TABLE IF NOT EXISTS public.mega_syllabus (
  test_no    int PRIMARY KEY,
  test_date  date NOT NULL,
  test_name  text NOT NULL,
  physics    text[] NOT NULL DEFAULT '{}',
  chemistry  text[] NOT NULL DEFAULT '{}',
  botany     text[] NOT NULL DEFAULT '{}',
  zoology    text[] NOT NULL DEFAULT '{}'
);
ALTER TABLE public.mega_syllabus ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "mega_syllabus readable" ON public.mega_syllabus;
CREATE POLICY "mega_syllabus readable" ON public.mega_syllabus FOR SELECT TO authenticated USING (true);

-- 2) Quizzes, items, entries, answers ------------------------------------------
CREATE TABLE IF NOT EXISTS public.mega_quizzes (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_date        date NOT NULL UNIQUE,
  starts_at        timestamptz NOT NULL,
  entry_closes_at  timestamptz NOT NULL,
  ends_at          timestamptz NOT NULL,
  prize            numeric NOT NULL DEFAULT 21,
  test_no          int,
  test_name        text,
  test_date        date,
  status           text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','finalized')),
  winner_id        uuid,
  created_at       timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.mega_quizzes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "mega_quizzes readable" ON public.mega_quizzes;
CREATE POLICY "mega_quizzes readable" ON public.mega_quizzes FOR SELECT TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS public.mega_items (
  quiz_id    uuid NOT NULL REFERENCES public.mega_quizzes(id) ON DELETE CASCADE,
  idx        int  NOT NULL,
  qid        text NOT NULL,
  subject    text NOT NULL,          -- Physics | Chemistry | Biology
  secs       int  NOT NULL,
  opens_at   timestamptz NOT NULL,
  closes_at  timestamptz NOT NULL,
  PRIMARY KEY (quiz_id, idx)
);
CREATE INDEX IF NOT EXISTS mega_items_qid ON public.mega_items (qid);
ALTER TABLE public.mega_items ENABLE ROW LEVEL SECURITY;   -- no policies: RPC access only

CREATE TABLE IF NOT EXISTS public.mega_entries (
  quiz_id    uuid NOT NULL REFERENCES public.mega_quizzes(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL,
  joined_at  timestamptz NOT NULL DEFAULT now(),
  seed       int  NOT NULL DEFAULT floor(random() * 2000000000)::int,
  strikes    int  NOT NULL DEFAULT 0,
  status     text NOT NULL DEFAULT 'playing' CHECK (status IN ('playing','left')),
  score      int,
  correct    int,
  wrong      int,
  skipped    int,
  time_ms    bigint,
  rank       int,
  flagged    boolean NOT NULL DEFAULT false,
  prize      numeric NOT NULL DEFAULT 0,
  PRIMARY KEY (quiz_id, user_id)
);
ALTER TABLE public.mega_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "mega_entries own" ON public.mega_entries;
CREATE POLICY "mega_entries own" ON public.mega_entries FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.mega_answers (
  quiz_id     uuid NOT NULL,
  user_id     uuid NOT NULL,
  idx         int  NOT NULL,
  choice      smallint,               -- original option index (0-3)
  ms          int  NOT NULL,          -- time from question open to answer
  answered_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (quiz_id, user_id, idx),
  FOREIGN KEY (quiz_id, user_id) REFERENCES public.mega_entries(quiz_id, user_id) ON DELETE CASCADE
);
ALTER TABLE public.mega_answers ENABLE ROW LEVEL SECURITY; -- no policies: RPC access only

-- 3) Hide a live quiz's questions from the public question bank -------------
CREATE TABLE IF NOT EXISTS public.mega_locked (
  qid    text PRIMARY KEY,
  until  timestamptz NOT NULL
);
ALTER TABLE public.mega_locked ENABLE ROW LEVEL SECURITY;  -- no policies

CREATE OR REPLACE FUNCTION private.mega_is_locked(_qid text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.mega_locked l WHERE l.qid = _qid AND l.until > now());
$$;
REVOKE ALL ON FUNCTION private.mega_is_locked(text) FROM public;
GRANT EXECUTE ON FUNCTION private.mega_is_locked(text) TO anon, authenticated;
GRANT USAGE ON SCHEMA private TO anon, authenticated;

DROP POLICY IF EXISTS "qb_questions hide live mega quiz" ON public.qb_questions;
CREATE POLICY "qb_questions hide live mega quiz" ON public.qb_questions
  AS RESTRICTIVE FOR SELECT TO anon, authenticated
  USING (NOT private.mega_is_locked(id::text));

-- 4) Helpers --------------------------------------------------------------------
-- Per-player option order for one question (deterministic from the entry seed).
CREATE OR REPLACE FUNCTION private.mega_perm(_seed int, _idx int)
RETURNS int[] LANGUAGE sql IMMUTABLE AS $$
  SELECT array_agg(k ORDER BY md5(_seed::text || ':' || _idx || ':' || k)) FROM generate_series(0,3) k;
$$;

-- Pick _n good questions spread across the given chapters, mostly hard/medium,
-- never reused within 90 days, skipping questions with blank options or missing figures.
CREATE OR REPLACE FUNCTION private.mega_pick(_chapters text[], _n int, _not text[])
RETURNS SETOF text LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM (
    SELECT q.id,
           row_number() OVER (PARTITION BY q.chapter_id ORDER BY
             CASE WHEN q.difficulty ILIKE 'hard'   THEN random() * 0.5
                  WHEN q.difficulty ILIKE 'medium' THEN 0.2 + random() * 0.5
                  ELSE 0.6 + random() END) AS rn
    FROM public.questions q
    WHERE q.chapter_id = ANY(_chapters)
      AND NOT (q.id = ANY(_not))
      AND coalesce(array_length(q.options, 1), 0) = 4
      AND q.correct_index BETWEEN 0 AND 3
      AND length(trim(regexp_replace(coalesce(q.text,''), '<[^>]*>', '', 'g'))) >= 15
      AND NOT EXISTS (SELECT 1 FROM unnest(q.options) o WHERE length(trim(regexp_replace(coalesce(o,''), '<[^>]*>', '', 'g'))) = 0)
      AND q.text NOT LIKE '%matching-question"></div>%'
      AND (q.question_image_url IS NOT NULL OR q.text ~* '<img'
           OR q.text !~* '(following|given|above|below)\s+(graph|figure|diagram|structure|compound|reaction|circuit|curve|plot)s?')
      AND NOT EXISTS (SELECT 1 FROM public.mega_items i JOIN public.mega_quizzes m ON m.id = i.quiz_id
                      WHERE i.qid = q.id AND m.quiz_date > current_date - 90)
  ) s
  ORDER BY rn, random()
  LIMIT _n;
$$;

-- 5) Build the day's paper (runs at 5:30 PM IST) ------------------------------
CREATE OR REPLACE FUNCTION public.mega_build(_day date DEFAULT ((now() AT TIME ZONE 'Asia/Kolkata')::date))
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _id uuid; _syl public.mega_syllabus; _start timestamptz; _t timestamptz;
  _idx int := 0; _picked text[] := '{}'; _q text; _bio text[];
  _sec record;
BEGIN
  SELECT id INTO _id FROM public.mega_quizzes WHERE quiz_date = _day;
  IF FOUND THEN RETURN _id; END IF;

  SELECT * INTO _syl FROM public.mega_syllabus WHERE test_date >= _day ORDER BY test_date LIMIT 1;
  IF NOT FOUND THEN SELECT * INTO _syl FROM public.mega_syllabus ORDER BY test_date DESC LIMIT 1; END IF;

  _start := (_day::timestamp + time '18:00') AT TIME ZONE 'Asia/Kolkata';
  INSERT INTO public.mega_quizzes (quiz_date, starts_at, entry_closes_at, ends_at, test_no, test_name, test_date)
  VALUES (_day, _start, _start + interval '5 minutes', _start, _syl.test_no, _syl.test_name, _syl.test_date)
  RETURNING id INTO _id;

  _t := _start;
  -- Physics 20 × 50 s, Chemistry 20 × 40 s, Biology 40 × 30 s (Botany 20 + Zoology 20, mixed)
  FOR _sec IN SELECT * FROM (VALUES (1,'Physics',50), (2,'Chemistry',40), (3,'Biology',30)) v(o, subject, secs) ORDER BY o LOOP
    IF _sec.subject = 'Biology' THEN
      _bio := ARRAY(SELECT private.mega_pick(_syl.botany, 20, _picked)) || ARRAY(SELECT private.mega_pick(_syl.zoology, 20, _picked));
      _bio := ARRAY(SELECT x FROM unnest(_bio) x ORDER BY random());
    ELSIF _sec.subject = 'Physics' THEN
      _bio := ARRAY(SELECT private.mega_pick(_syl.physics, 20, _picked));
    ELSE
      _bio := ARRAY(SELECT private.mega_pick(_syl.chemistry, 20, _picked));
    END IF;
    IF _idx > 0 THEN _t := _t + interval '8 seconds'; END IF;   -- short break between sections
    FOREACH _q IN ARRAY coalesce(_bio, '{}') LOOP
      _idx := _idx + 1;
      INSERT INTO public.mega_items (quiz_id, idx, qid, subject, secs, opens_at, closes_at)
      VALUES (_id, _idx, _q, _sec.subject, _sec.secs, _t, _t + make_interval(secs => _sec.secs));
      _t := _t + make_interval(secs => _sec.secs);
      _picked := _picked || _q;
    END LOOP;
  END LOOP;

  UPDATE public.mega_quizzes SET ends_at = _t WHERE id = _id;
  INSERT INTO public.mega_locked (qid, until)
    SELECT qid, _t + interval '2 minutes' FROM public.mega_items WHERE quiz_id = _id
  ON CONFLICT (qid) DO UPDATE SET until = EXCLUDED.until;
  DELETE FROM public.mega_locked WHERE until < now() - interval '1 day';
  RETURN _id;
END $$;

-- 6) Lobby info ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mega_today()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _day date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
  _m public.mega_quizzes; _syl public.mega_syllabus; _next timestamptz; _e public.mega_entries;
  _players int := 0; _chapters jsonb; _winner jsonb;
BEGIN
  SELECT * INTO _m FROM public.mega_quizzes WHERE quiz_date = _day;
  -- After today's quiz has ended and been finalized, keep showing it until midnight.
  _next := (_day::timestamp + time '18:00') AT TIME ZONE 'Asia/Kolkata';
  IF _m.id IS NULL AND now() > _next + interval '1 hour' THEN _next := _next + interval '1 day'; _day := _day + 1; END IF;

  SELECT * INTO _syl FROM public.mega_syllabus
   WHERE test_date >= coalesce(_m.quiz_date, _day) ORDER BY test_date LIMIT 1;
  IF NOT FOUND THEN SELECT * INTO _syl FROM public.mega_syllabus ORDER BY test_date DESC LIMIT 1; END IF;
  IF _m.test_no IS NOT NULL THEN SELECT * INTO _syl FROM public.mega_syllabus WHERE test_no = _m.test_no; END IF;

  SELECT jsonb_build_object(
    'Physics',   coalesce((SELECT jsonb_agg(name ORDER BY name) FROM public.chapters WHERE id = ANY(_syl.physics)), '[]'),
    'Chemistry', coalesce((SELECT jsonb_agg(name ORDER BY name) FROM public.chapters WHERE id = ANY(_syl.chemistry)), '[]'),
    'Biology',   coalesce((SELECT jsonb_agg(name ORDER BY name) FROM public.chapters WHERE id = ANY(_syl.botany || _syl.zoology)), '[]')
  ) INTO _chapters;

  IF _m.id IS NOT NULL THEN
    SELECT count(*) INTO _players FROM public.mega_entries WHERE quiz_id = _m.id;
    SELECT * INTO _e FROM public.mega_entries WHERE quiz_id = _m.id AND user_id = auth.uid();
    IF _m.winner_id IS NOT NULL THEN
      SELECT jsonb_build_object('name', coalesce(p.full_name, 'NEET Track student'), 'avatar_url', p.avatar_url)
        INTO _winner FROM public.profiles p WHERE p.id = _m.winner_id;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'server_now', now(),
    'quiz', CASE WHEN _m.id IS NULL THEN NULL ELSE jsonb_build_object(
      'id', _m.id, 'date', _m.quiz_date, 'starts_at', _m.starts_at, 'entry_closes_at', _m.entry_closes_at,
      'ends_at', _m.ends_at, 'prize', _m.prize, 'status', _m.status, 'players', _players,
      'total', (SELECT count(*) FROM public.mega_items WHERE quiz_id = _m.id), 'winner', _winner) END,
    'next_starts_at', CASE WHEN _m.id IS NULL THEN _next ELSE _m.starts_at END,
    'prize', coalesce(_m.prize, 21),
    'syllabus', jsonb_build_object('test_name', _syl.test_name, 'test_date', _syl.test_date, 'chapters', _chapters),
    'sections', jsonb_build_array(
      jsonb_build_object('subject','Physics','count',20,'secs',50),
      jsonb_build_object('subject','Chemistry','count',20,'secs',40),
      jsonb_build_object('subject','Biology','count',40,'secs',30)),
    'me', CASE WHEN _e.user_id IS NULL THEN NULL ELSE jsonb_build_object('status', _e.status, 'strikes', _e.strikes) END
  );
END $$;

-- 7) Join ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mega_join(_quiz uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _m public.mega_quizzes;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Please log in to join'; END IF;
  SELECT * INTO _m FROM public.mega_quizzes WHERE id = _quiz;
  IF _m.id IS NULL THEN RAISE EXCEPTION 'Quiz not found'; END IF;
  IF now() > _m.entry_closes_at THEN RAISE EXCEPTION 'Entry for today''s Mega Quiz has closed. See you tomorrow at 6 PM.'; END IF;
  INSERT INTO public.mega_entries (quiz_id, user_id) VALUES (_quiz, auth.uid()) ON CONFLICT DO NOTHING;
  RETURN jsonb_build_object('ok', true);
END $$;

-- 8) Live state: what the player should see right now -------------------------
CREATE OR REPLACE FUNCTION public.mega_state(_quiz uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _m public.mega_quizzes; _e public.mega_entries; _it public.mega_items; _nx public.mega_items;
  _q record; _perm int[]; _a public.mega_answers; _total int; _answered int;
BEGIN
  SELECT * INTO _m FROM public.mega_quizzes WHERE id = _quiz;
  IF _m.id IS NULL THEN RAISE EXCEPTION 'Quiz not found'; END IF;
  SELECT * INTO _e FROM public.mega_entries WHERE quiz_id = _quiz AND user_id = auth.uid();
  IF _e.user_id IS NULL THEN RETURN jsonb_build_object('phase','not_joined','server_now',now()); END IF;
  SELECT count(*) INTO _total FROM public.mega_items WHERE quiz_id = _quiz;
  SELECT count(*) INTO _answered FROM public.mega_answers WHERE quiz_id = _quiz AND user_id = auth.uid();

  IF _e.status = 'left' THEN
    RETURN jsonb_build_object('phase','left','server_now',now(),'ends_at',_m.ends_at,'total',_total,'answered',_answered);
  END IF;
  IF now() < _m.starts_at THEN
    RETURN jsonb_build_object('phase','waiting','server_now',now(),'starts_at',_m.starts_at,'total',_total);
  END IF;
  IF now() >= _m.ends_at THEN
    RETURN jsonb_build_object('phase','ended','server_now',now(),'ends_at',_m.ends_at,'total',_total,'answered',_answered);
  END IF;

  SELECT * INTO _it FROM public.mega_items WHERE quiz_id = _quiz AND opens_at <= now() AND closes_at > now();
  IF _it.quiz_id IS NULL THEN
    SELECT * INTO _nx FROM public.mega_items WHERE quiz_id = _quiz AND opens_at > now() ORDER BY opens_at LIMIT 1;
    RETURN jsonb_build_object('phase','break','server_now',now(),'next_subject',_nx.subject,'next_opens_at',_nx.opens_at,
      'next_idx',_nx.idx,'next_secs',_nx.secs,'total',_total,'answered',_answered,'strikes',_e.strikes);
  END IF;

  SELECT text, options, question_image_url INTO _q FROM public.questions WHERE id = _it.qid;
  _perm := private.mega_perm(_e.seed, _it.idx);
  SELECT * INTO _a FROM public.mega_answers WHERE quiz_id = _quiz AND user_id = auth.uid() AND idx = _it.idx;

  RETURN jsonb_build_object(
    'phase','question','server_now',now(),'idx',_it.idx,'total',_total,'subject',_it.subject,'secs',_it.secs,
    'opens_at',_it.opens_at,'closes_at',_it.closes_at,'text',_q.text,'image',_q.question_image_url,
    'options', jsonb_build_array(_q.options[_perm[1]+1], _q.options[_perm[2]+1], _q.options[_perm[3]+1], _q.options[_perm[4]+1]),
    'answered', _a.idx IS NOT NULL,
    'my_choice', CASE WHEN _a.choice IS NULL THEN NULL ELSE array_position(_perm, _a.choice::int) - 1 END,
    'answered_count', _answered, 'strikes', _e.strikes);
END $$;

-- 9) Answer (display position 0-3, or null to skip) ---------------------------
CREATE OR REPLACE FUNCTION public.mega_answer(_quiz uuid, _idx int, _choice int)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _e public.mega_entries; _it public.mega_items; _orig smallint;
BEGIN
  SELECT * INTO _e FROM public.mega_entries WHERE quiz_id = _quiz AND user_id = auth.uid();
  IF _e.user_id IS NULL OR _e.status <> 'playing' THEN RAISE EXCEPTION 'Your attempt is not active'; END IF;
  SELECT * INTO _it FROM public.mega_items WHERE quiz_id = _quiz AND idx = _idx;
  IF _it.quiz_id IS NULL THEN RAISE EXCEPTION 'Question not found'; END IF;
  IF now() < _it.opens_at OR now() > _it.closes_at + interval '2 seconds' THEN
    RAISE EXCEPTION 'Time is up for this question';
  END IF;
  IF _choice IS NOT NULL AND (_choice < 0 OR _choice > 3) THEN RAISE EXCEPTION 'Invalid option'; END IF;
  _orig := CASE WHEN _choice IS NULL THEN NULL ELSE (private.mega_perm(_e.seed, _idx))[_choice + 1] END;
  INSERT INTO public.mega_answers (quiz_id, user_id, idx, choice, ms)
  VALUES (_quiz, auth.uid(), _idx, _orig, LEAST(_it.secs * 1000, GREATEST(0, (extract(epoch FROM now() - _it.opens_at) * 1000)::int)))
  ON CONFLICT DO NOTHING;
  RETURN jsonb_build_object('ok', FOUND);
END $$;

-- 10) Leaving the screen: first a warning, second time the attempt ends ------
CREATE OR REPLACE FUNCTION public.mega_strike(_quiz uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _m public.mega_quizzes; _e public.mega_entries;
BEGIN
  SELECT * INTO _m FROM public.mega_quizzes WHERE id = _quiz;
  IF _m.id IS NULL OR now() < _m.starts_at OR now() >= _m.ends_at THEN RETURN jsonb_build_object('counted', false); END IF;
  UPDATE public.mega_entries
     SET strikes = strikes + 1, status = CASE WHEN strikes + 1 >= 2 THEN 'left' ELSE status END
   WHERE quiz_id = _quiz AND user_id = auth.uid() AND status = 'playing'
  RETURNING * INTO _e;
  RETURN jsonb_build_object('counted', _e.user_id IS NOT NULL, 'strikes', _e.strikes, 'status', _e.status);
END $$;

-- 11) Score, rank and pay the winner ------------------------------------------
CREATE OR REPLACE FUNCTION public.mega_finalize(_quiz uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _m public.mega_quizzes; _total int; _w uuid;
BEGIN
  SELECT * INTO _m FROM public.mega_quizzes WHERE id = _quiz FOR UPDATE;
  IF _m.id IS NULL THEN RAISE EXCEPTION 'Quiz not found'; END IF;
  IF _m.status = 'finalized' THEN RETURN jsonb_build_object('ok', true, 'already', true); END IF;
  IF now() < _m.ends_at THEN RAISE EXCEPTION 'Quiz has not ended'; END IF;
  SELECT count(*) INTO _total FROM public.mega_items WHERE quiz_id = _quiz;

  WITH s AS (
    SELECT e.user_id,
           count(*) FILTER (WHERE a.choice IS NOT NULL AND a.choice = q.correct_index) AS c,
           count(*) FILTER (WHERE a.choice IS NOT NULL AND a.choice <> q.correct_index) AS w,
           coalesce(sum(a.ms) FILTER (WHERE a.choice IS NOT NULL), 0) AS t,
           count(a.choice) AS answered
    FROM public.mega_entries e
    LEFT JOIN public.mega_answers a ON a.quiz_id = e.quiz_id AND a.user_id = e.user_id
    LEFT JOIN public.mega_items i ON i.quiz_id = a.quiz_id AND i.idx = a.idx
    LEFT JOIN public.questions q ON q.id = i.qid
    WHERE e.quiz_id = _quiz
    GROUP BY e.user_id
  ), r AS (
    SELECT user_id, c, w, t, answered, (4 * c - w) AS score,
           row_number() OVER (ORDER BY (4 * c - w) DESC, t ASC) AS rk
    FROM s
  )
  UPDATE public.mega_entries e
     SET correct = r.c, wrong = r.w, skipped = _total - r.answered, score = r.score, time_ms = r.t, rank = r.rk,
         -- Very fast and near-perfect on many questions is checked by a person before any prize.
         flagged = (r.answered >= 20 AND r.t::numeric / GREATEST(r.answered, 1) < 4000 AND r.c::numeric / GREATEST(r.answered, 1) >= 0.9)
    FROM r
   WHERE e.quiz_id = _quiz AND e.user_id = r.user_id;

  SELECT user_id INTO _w FROM public.mega_entries
   WHERE quiz_id = _quiz AND status = 'playing' AND NOT flagged AND score > 0
   ORDER BY rank LIMIT 1;

  IF _w IS NOT NULL THEN
    UPDATE public.mega_entries SET prize = _m.prize WHERE quiz_id = _quiz AND user_id = _w;
    UPDATE public.profiles
       SET winnings_balance = coalesce(winnings_balance, 0) + _m.prize,
           wallet_balance   = coalesce(wallet_balance, 0) + _m.prize
     WHERE id = _w;
  END IF;

  UPDATE public.mega_quizzes SET status = 'finalized', winner_id = _w WHERE id = _quiz;
  RETURN jsonb_build_object('ok', true, 'winner', _w);
END $$;

CREATE OR REPLACE FUNCTION public.mega_finalize_due()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _r record; _n int := 0;
BEGIN
  FOR _r IN SELECT id FROM public.mega_quizzes WHERE status = 'scheduled' AND ends_at <= now() LOOP
    PERFORM public.mega_finalize(_r.id); _n := _n + 1;
  END LOOP;
  RETURN _n;
END $$;

-- 12) Results + solutions (only after the quiz has ended) ---------------------
CREATE OR REPLACE FUNCTION public.mega_result(_quiz uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _m public.mega_quizzes; _e public.mega_entries; _board jsonb; _sol jsonb; _players int;
BEGIN
  SELECT * INTO _m FROM public.mega_quizzes WHERE id = _quiz;
  IF _m.id IS NULL THEN RAISE EXCEPTION 'Quiz not found'; END IF;
  IF now() < _m.ends_at THEN RAISE EXCEPTION 'Results appear when the quiz ends'; END IF;
  IF _m.status <> 'finalized' THEN PERFORM public.mega_finalize(_quiz); SELECT * INTO _m FROM public.mega_quizzes WHERE id = _quiz; END IF;

  SELECT * INTO _e FROM public.mega_entries WHERE quiz_id = _quiz AND user_id = auth.uid();
  SELECT count(*) INTO _players FROM public.mega_entries WHERE quiz_id = _quiz;
  SELECT coalesce(jsonb_agg(x ORDER BY (x->>'rank')::int), '[]') INTO _board FROM (
    SELECT jsonb_build_object('rank', e.rank, 'score', e.score, 'time_ms', e.time_ms, 'prize', e.prize,
             'name', coalesce(nullif(trim(p.full_name), ''), 'NEET Track student'), 'avatar_url', p.avatar_url,
             'me', e.user_id = auth.uid()) AS x
    FROM public.mega_entries e LEFT JOIN public.profiles p ON p.id = e.user_id
    WHERE e.quiz_id = _quiz AND e.rank IS NOT NULL ORDER BY e.rank LIMIT 20) t;

  IF _e.user_id IS NOT NULL THEN
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'idx', i.idx, 'subject', i.subject, 'text', q.text, 'image', q.question_image_url,
      'options', to_jsonb(q.options), 'correct', q.correct_index, 'mine', a.choice,
      'explanation', q.explanation) ORDER BY i.idx), '[]')
      INTO _sol
      FROM public.mega_items i
      JOIN public.questions q ON q.id = i.qid
      LEFT JOIN public.mega_answers a ON a.quiz_id = i.quiz_id AND a.idx = i.idx AND a.user_id = auth.uid()
     WHERE i.quiz_id = _quiz;
  END IF;

  RETURN jsonb_build_object(
    'quiz', jsonb_build_object('id', _m.id, 'date', _m.quiz_date, 'prize', _m.prize, 'test_name', _m.test_name),
    'players', _players, 'leaderboard', _board, 'solutions', coalesce(_sol, '[]'),
    'me', CASE WHEN _e.user_id IS NULL THEN NULL ELSE jsonb_build_object(
      'rank', _e.rank, 'score', _e.score, 'correct', _e.correct, 'wrong', _e.wrong, 'skipped', _e.skipped,
      'time_ms', _e.time_ms, 'prize', _e.prize, 'status', _e.status, 'flagged', _e.flagged) END);
END $$;

-- 13) Permissions ---------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.mega_build(date), public.mega_finalize(uuid), public.mega_finalize_due() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION private.mega_pick(text[], int, text[]), private.mega_perm(int, int) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.mega_today(), public.mega_join(uuid), public.mega_state(uuid),
  public.mega_answer(uuid, int, int), public.mega_strike(uuid), public.mega_result(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.mega_today(), public.mega_join(uuid), public.mega_state(uuid),
  public.mega_answer(uuid, int, int), public.mega_strike(uuid), public.mega_result(uuid) TO authenticated;

-- Syllabus from the Yakeen NEET 2.0 2027 test planner (chapter ids from public.chapters)
INSERT INTO public.mega_syllabus (test_no, test_date, test_name, physics, chemistry, botany, zoology) VALUES
(1, '2026-07-19', 'NEET-1', ARRAY['19']::text[], ARRAY['15']::text[], ARRAY['10']::text[], ARRAY['84']::text[]),
(2, '2026-08-02', 'NEET-2', ARRAY['19','20']::text[], ARRAY['15']::text[], ARRAY['10']::text[], ARRAY['84']::text[]),
(3, '2026-08-16', 'Rank Booster Test-1', ARRAY['19','20']::text[], ARRAY['15']::text[], ARRAY['10']::text[], ARRAY['84']::text[]),
(4, '2026-08-30', 'NEET-3', ARRAY['19','20','3']::text[], ARRAY['48','50','58']::text[], ARRAY['73','77']::text[], ARRAY['86']::text[]),
(5, '2026-09-13', 'NEET-4', ARRAY['20','21']::text[], ARRAY['49']::text[], ARRAY['74']::text[], ARRAY['87']::text[]),
(6, '2026-09-27', 'Rank Booster Test-2', ARRAY['19','20','3']::text[], ARRAY['48','49','50','58']::text[], ARRAY['73','74','77']::text[], ARRAY['86','87']::text[]),
(7, '2026-10-04', 'AITS-1', ARRAY['19','20','3']::text[], ARRAY['15','50']::text[], ARRAY['10']::text[], ARRAY['84']::text[]),
(8, '2026-10-18', 'NEET-5', ARRAY['21','22','23']::text[], ARRAY['44','59','60']::text[], ARRAY['9','75']::text[], ARRAY['88','89']::text[]),
(9, '2026-11-01', 'AITS-2', ARRAY['21','22','23']::text[], ARRAY['44','58']::text[], ARRAY['77']::text[], ARRAY['86','87']::text[]),
(10, '2026-11-22', 'NEET-6', ARRAY['23','24','25','26']::text[], ARRAY['45','46']::text[], ARRAY['76','81']::text[], ARRAY['90','91']::text[]),
(11, '2026-12-06', 'Rank Booster Test-3', ARRAY['19','20','3','21','22','23','24','25','26']::text[], ARRAY['44','45','46','59','60']::text[], ARRAY['9','75','76','81']::text[], ARRAY['88','89','90','91']::text[]),
(12, '2026-12-13', 'AITS-3', ARRAY['23','24','25']::text[], ARRAY['48','54']::text[], ARRAY['73','74']::text[], ARRAY['88','89']::text[]),
(13, '2026-12-27', 'NEET-7', ARRAY['27','28','29','30','31','12']::text[], ARRAY['54']::text[], ARRAY['80','82','8']::text[], ARRAY['83','11']::text[]),
(14, '2027-01-10', 'NEET-8', ARRAY['12','32']::text[], ARRAY['54','55']::text[], ARRAY['94']::text[], ARRAY['100']::text[]),
(15, '2027-01-17', 'AITS-4', ARRAY['26','27','28','29']::text[], ARRAY['49','59']::text[], ARRAY['9','75']::text[], ARRAY['90','91']::text[]),
(16, '2027-01-31', 'Rank Booster Test-4', ARRAY['19','20','3','21','22','23','24','25','26','27','28','29','30','31','12']::text[], ARRAY['54','55']::text[], ARRAY['80','82','8']::text[], ARRAY['83','11','100']::text[]),
(17, '2027-02-14', 'NEET-9', ARRAY['32','33','34','35','36','37']::text[], ARRAY['66','67','68']::text[], ARRAY['93','94']::text[], ARRAY['101','103']::text[]),
(18, '2027-02-21', 'AITS-5', ARRAY['30','31','12','32']::text[], ARRAY['54','55','60']::text[], ARRAY['76','8']::text[], ARRAY['83','100','101']::text[]),
(19, '2027-02-28', 'NEET-10', ARRAY['38','18']::text[], ARRAY['54','65','69','70']::text[], ARRAY['93']::text[], ARRAY['97','98']::text[]),
(20, '2027-03-07', 'Rank Booster Test-5', ARRAY['19','20','3','21','22','23','24','25','26','27','28','29','30','12','32','33','34','35','36','37','38','18']::text[], ARRAY['54','65','66','67','68','69','70']::text[], ARRAY['93','94']::text[], ARRAY['101','103','97','98']::text[]),
(21, '2027-03-14', 'AITS-6', ARRAY['33']::text[], ARRAY['66','67']::text[], ARRAY['94']::text[], ARRAY['11','103']::text[]),
(22, '2027-03-21', 'AITS-7', ARRAY['34','35','36']::text[], ARRAY['68','69','70']::text[], ARRAY['80','81']::text[], ARRAY['102']::text[]),
(23, '2027-03-28', 'AITS-8', ARRAY['37','38','18','13','39','40','41']::text[], ARRAY['53','63','54','64','65']::text[], ARRAY['82','105','99']::text[], ARRAY['97']::text[]),
(24, '2027-04-04', 'AITS-9', ARRAY['3','12','13','18','19','20','21','22','23','24','25','26','27','28','29','30','31','32','33','34','35','36','37','38','39','40','41','42']::text[], ARRAY['15','44','45','46','48','49','50','53','54','55','58','59','60','63','64','65','66','67','68','69','70']::text[], ARRAY['8','9','10','73','74','75','76','77','80','81','82','93','94','96','99','105','106']::text[], ARRAY['11','83','84','86','87','88','89','90','91','97','98','100','101','102','103']::text[]),
(25, '2027-04-11', 'AITS-10', ARRAY['3','12','13','18','19','20','21','22','23','24','25','26','27','28','29','30','31','32','33','34','35','36','37','38','39','40','41','42']::text[], ARRAY['15','44','45','46','48','49','50','53','54','55','58','59','60','63','64','65','66','67','68','69','70']::text[], ARRAY['8','9','10','73','74','75','76','77','80','81','82','93','94','96','99','105','106']::text[], ARRAY['11','83','84','86','87','88','89','90','91','97','98','100','101','102','103']::text[]),
(26, '2027-04-14', 'AITS-11', ARRAY['3','12','13','18','19','20','21','22','23','24','25','26','27','28','29','30','31','32','33','34','35','36','37','38','39','40','41','42']::text[], ARRAY['15','44','45','46','48','49','50','53','54','55','58','59','60','63','64','65','66','67','68','69','70']::text[], ARRAY['8','9','10','73','74','75','76','77','80','81','82','93','94','96','99','105','106']::text[], ARRAY['11','83','84','86','87','88','89','90','91','97','98','100','101','102','103']::text[]),
(27, '2027-04-18', 'AITS-12', ARRAY['3','12','13','18','19','20','21','22','23','24','25','26','27','28','29','30','31','32','33','34','35','36','37','38','39','40','41','42']::text[], ARRAY['15','44','45','46','48','49','50','53','54','55','58','59','60','63','64','65','66','67','68','69','70']::text[], ARRAY['8','9','10','73','74','75','76','77','80','81','82','93','94','96','99','105','106']::text[], ARRAY['11','83','84','86','87','88','89','90','91','97','98','100','101','102','103']::text[]),
(28, '2027-04-21', 'AITS-13', ARRAY['3','12','13','18','19','20','21','22','23','24','25','26','27','28','29','30','31','32','33','34','35','36','37','38','39','40','41','42']::text[], ARRAY['15','44','45','46','48','49','50','53','54','55','58','59','60','63','64','65','66','67','68','69','70']::text[], ARRAY['8','9','10','73','74','75','76','77','80','81','82','93','94','96','99','105','106']::text[], ARRAY['11','83','84','86','87','88','89','90','91','97','98','100','101','102','103']::text[]),
(29, '2027-04-25', 'AITS-14', ARRAY['3','12','13','18','19','20','21','22','23','24','25','26','27','28','29','30','31','32','33','34','35','36','37','38','39','40','41','42']::text[], ARRAY['15','44','45','46','48','49','50','53','54','55','58','59','60','63','64','65','66','67','68','69','70']::text[], ARRAY['8','9','10','73','74','75','76','77','80','81','82','93','94','96','99','105','106']::text[], ARRAY['11','83','84','86','87','88','89','90','91','97','98','100','101','102','103']::text[]),
(30, '2027-04-28', 'AITS-15', ARRAY['3','12','13','18','19','20','21','22','23','24','25','26','27','28','29','30','31','32','33','34','35','36','37','38','39','40','41','42']::text[], ARRAY['15','44','45','46','48','49','50','53','54','55','58','59','60','63','64','65','66','67','68','69','70']::text[], ARRAY['8','9','10','73','74','75','76','77','80','81','82','93','94','96','99','105','106']::text[], ARRAY['11','83','84','86','87','88','89','90','91','97','98','100','101','102','103']::text[])
ON CONFLICT (test_no) DO UPDATE SET test_date=EXCLUDED.test_date, test_name=EXCLUDED.test_name, physics=EXCLUDED.physics, chemistry=EXCLUDED.chemistry, botany=EXCLUDED.botany, zoology=EXCLUDED.zoology;

-- Daily schedule (pg_cron runs in UTC): build the paper 5:30 PM IST, score + pay 6:52 PM IST.
SELECT cron.schedule('mega_quiz_build', '0 12 * * *', $$ select public.mega_build(); $$);
SELECT cron.schedule('mega_quiz_finalize', '22 13 * * *', $$ select public.mega_finalize_due(); $$);
