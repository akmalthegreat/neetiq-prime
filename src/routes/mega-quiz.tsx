// Daily Mega Quiz — live every day at 6:00 PM IST.
// Everything that decides the result runs in the database (see the daily_mega_quiz
// migration): this page only shows what the server says, on the server's clock.

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowRight, Check, ChevronDown, Clock, Lock, ShieldCheck, Trophy, Users, X } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { RichText, resolveAnyImageUrl } from "@/components/rich-text";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { PushOptIn } from "@/components/push-opt-in";

export const Route = createFileRoute("/mega-quiz")({
  head: () => ({
    meta: [
      { title: "Daily Mega Quiz — NEET Track" },
      { name: "description", content: "80 NEET-level questions live every day at 6 PM. Top score wins ₹21." },
    ],
  }),
  component: MegaQuizPage,
});

/* ---------------------------------------------------------------- types */
type Section = { subject: Subject; count: number; secs: number };
type Subject = "Physics" | "Chemistry" | "Biology";
type Today = {
  server_now: string;
  quiz: null | {
    id: string; date: string; starts_at: string; entry_closes_at: string; ends_at: string;
    prize: number; status: "scheduled" | "finalized"; players: number; total: number;
    winner: null | { name: string; avatar_url: string | null };
  };
  next_starts_at: string;
  prize: number;
  syllabus: { test_name: string; test_date: string; chapters: Record<Subject, string[]> };
  sections: Section[];
  me: null | { status: "playing" | "left"; strikes: number };
};
type State =
  | { phase: "not_joined"; server_now: string }
  | { phase: "waiting"; server_now: string; starts_at: string; total: number }
  | { phase: "break"; server_now: string; next_subject: Subject; next_opens_at: string; next_idx: number; next_secs: number; total: number; answered: number; strikes: number }
  | { phase: "question"; server_now: string; idx: number; total: number; subject: Subject; secs: number; opens_at: string; closes_at: string; text: string; image: string | null; options: string[]; answered: boolean; my_choice: number | null; answered_count: number; strikes: number }
  | { phase: "ended" | "left"; server_now: string; ends_at: string; total: number; answered: number };
type Result = {
  quiz: { id: string; date: string; prize: number; test_name: string };
  players: number;
  leaderboard: { rank: number; score: number; time_ms: number; prize: number; name: string; avatar_url: string | null; me: boolean }[];
  solutions: { idx: number; subject: Subject; text: string; image: string | null; options: string[]; correct: number; mine: number | null; explanation: string | null }[];
  me: null | { rank: number; score: number; correct: number; wrong: number; skipped: number; time_ms: number; prize: number; status: string; flagged: boolean };
};

const SUBJECT_TONE: Record<Subject, { text: string; bg: string; ring: string; bar: string }> = {
  Physics: { text: "text-sky-600 dark:text-sky-300", bg: "bg-sky-500/10", ring: "border-sky-500/50", bar: "bg-sky-500" },
  Chemistry: { text: "text-emerald-600 dark:text-emerald-300", bg: "bg-emerald-500/10", ring: "border-emerald-500/50", bar: "bg-emerald-500" },
  Biology: { text: "text-violet-600 dark:text-violet-300", bg: "bg-violet-500/10", ring: "border-violet-500/50", bar: "bg-violet-500" },
};

const rpc = <T,>(fn: string, args?: Record<string, unknown>) =>
  (supabase as any).rpc(fn, args).then(({ data, error }: { data: T; error: { message: string } | null }) => {
    if (error) throw new Error(error.message);
    return data;
  }) as Promise<T>;

const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" });
const pad = (n: number) => String(Math.max(0, n)).padStart(2, "0");

/** Server-synced clock: `now()` returns the server's current time in ms. */
function useServerClock() {
  const offset = useRef(0);
  const sync = useCallback((serverIso: string, sentAt: number) => {
    const rtt = Date.now() - sentAt;
    offset.current = new Date(serverIso).getTime() + rtt / 2 - Date.now();
  }, []);
  const now = useCallback(() => Date.now() + offset.current, []);
  return { sync, now };
}

/** Re-render every `ms` while `on`. */
function useTick(on: boolean, ms = 250) {
  const [, set] = useState(0);
  useEffect(() => {
    if (!on) return;
    const t = setInterval(() => set((n) => n + 1), ms);
    return () => clearInterval(t);
  }, [on, ms]);
}

/* ================================================================= page */
function MegaQuizPage() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const clock = useServerClock();
  const [today, setToday] = useState<Today | null>(null);
  const [state, setState] = useState<State | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [gate, setGate] = useState(false);
  const [joining, setJoining] = useState(false);

  useEffect(() => { if (!loading && !user) nav({ to: "/login" }); }, [user, loading, nav]);

  const loadToday = useCallback(async () => {
    const t0 = Date.now();
    const t = await rpc<Today>("mega_today");
    clock.sync(t.server_now, t0);
    setToday(t);
    return t;
  }, [clock]);

  const loadState = useCallback(async (quizId: string) => {
    const t0 = Date.now();
    const s = await rpc<State>("mega_state", { _quiz: quizId });
    clock.sync(s.server_now, t0);
    setState(s);
    return s;
  }, [clock]);

  useEffect(() => {
    if (!user) return;
    loadToday().then((t) => { if (t.quiz && t.me) void loadState(t.quiz.id); }).catch((e) => toast.error(e.message));
  }, [user, loadToday, loadState]);

  // After the quiz ends, fetch results (the server scores lazily if needed).
  const quizId = today?.quiz?.id;
  const ended = !!today?.quiz && clock.now() >= new Date(today.quiz.ends_at).getTime();
  useEffect(() => {
    if (!quizId || !ended || result) return;
    rpc<Result>("mega_result", { _quiz: quizId }).then(setResult).catch(() => {});
  }, [quizId, ended, result]);

  async function join() {
    if (!today?.quiz) return;
    setJoining(true);
    try {
      await rpc("mega_join", { _quiz: today.quiz.id });
      setGate(false);
      const t = await loadToday();
      if (t.quiz) await loadState(t.quiz.id);
      toast.success("You're in. Stay on this screen when the quiz starts.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not join");
    } finally {
      setJoining(false);
    }
  }

  const live = !!state && (state.phase === "question" || state.phase === "break" || state.phase === "waiting");

  if (!today) {
    return <PageShell><div className="mx-auto max-w-xl py-20 text-center text-sm text-muted-foreground">Loading today's Mega Quiz…</div></PageShell>;
  }

  if (live && today.quiz && state && state.phase !== "waiting") {
    return (
      <LivePlay
        quizId={today.quiz.id}
        state={state}
        now={clock.now}
        reload={() => loadState(today.quiz!.id)}
        onEnded={() => { void loadToday(); void loadState(today.quiz!.id); }}
      />
    );
  }

  return (
    <PageShell>
      <div className="mx-auto w-full max-w-2xl space-y-4">
        {result && today.quiz ? (
          <Results result={result} />
        ) : (
          <Lobby
            today={today}
            state={state}
            now={clock.now}
            onJoin={() => setGate(true)}
            onStart={() => today.quiz && loadState(today.quiz.id)}
          />
        )}
      </div>
      {gate && <FairPlayGate busy={joining} onAgree={join} onCancel={() => setGate(false)} />}
    </PageShell>
  );
}

/* ================================================================ lobby */
function Lobby({ today, state, now, onJoin, onStart }: {
  today: Today; state: State | null; now: () => number; onJoin: () => void; onStart: () => void;
}) {
  useTick(true, 1000);
  const q = today.quiz;
  const startsAt = new Date(q?.starts_at ?? today.next_starts_at).getTime();
  const left = Math.max(0, startsAt - now());
  const H = Math.floor(left / 3.6e6), M = Math.floor(left / 6e4) % 60, S = Math.floor(left / 1000) % 60;
  const joined = !!today.me;
  const entryOpen = !!q && now() <= new Date(q.entry_closes_at).getTime();
  const running = !!q && now() >= startsAt && now() < new Date(q.ends_at).getTime();
  const firedStart = useRef(false);

  // When the clock reaches 6:00 PM for a joined player, switch into the live screen.
  useEffect(() => {
    if (joined && running && !firedStart.current) { firedStart.current = true; onStart(); }
  });

  const totalMin = today.sections.reduce((n, s) => n + s.count * s.secs, 0) / 60;

  return (
    <>
      <section className="relative overflow-hidden rounded-3xl border border-amber-500/40 bg-gradient-to-br from-amber-100 via-amber-50 to-background p-6 dark:from-[#2A1E06] dark:via-[#15110A] dark:to-card sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-amber-400/20 blur-3xl" aria-hidden="true" />
        <div className="relative">
          <div className="text-xs font-bold uppercase tracking-[0.18em] text-amber-700 dark:text-amber-400">Daily Mega Quiz</div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Live every day at 6:00 PM</h1>
          <p className="mt-2 max-w-md text-muted-foreground">
            80 NEET-level questions from this week's syllabus. One attempt, the same questions for everyone at the same time.
          </p>
          <div className="mt-5 flex items-baseline gap-2">
            <span className="text-5xl font-bold tracking-tight text-amber-600 dark:text-amber-400">₹{today.prize}</span>
            <span className="text-sm text-muted-foreground">to the top scorer, added to their wallet</span>
          </div>

          {!running && (
            <div className="mt-5 grid grid-cols-3 gap-2" aria-label="Time until the quiz starts">
              {[[H, "Hours"], [M, "Min"], [S, "Sec"]].map(([v, l]) => (
                <div key={l as string} className="rounded-2xl border border-amber-500/25 bg-background/60 py-3 text-center">
                  <div className="text-2xl font-bold tabular-nums">{pad(v as number)}</div>
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{l}</div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-5">
            {!q ? (
              <div className="rounded-2xl border border-border bg-background/60 px-4 py-3 text-sm">
                Entry opens at <b>5:30 PM</b>. Come back then to join.
              </div>
            ) : joined ? (
              <div className="flex items-center gap-2 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                <Check className="h-4 w-4" />
                {today.me?.status === "left" ? "Your attempt ended because you left the quiz screen twice." : running ? "The quiz is live. Opening…" : "You're in. Keep this page open at 6:00 PM."}
              </div>
            ) : entryOpen ? (
              <button type="button" onClick={onJoin} className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-amber-400 text-base font-bold text-amber-950 transition hover:bg-amber-300">
                Join today's Mega Quiz <ArrowRight className="h-5 w-5" />
              </button>
            ) : (
              <div className="rounded-2xl border border-border bg-background/60 px-4 py-3 text-sm">
                Entry for today closed at {fmtTime(q.entry_closes_at)}. Results at {fmtTime(q.ends_at)}. See you tomorrow at 6 PM.
              </div>
            )}
          </div>

          {q && (
            <div className="mt-3 flex items-center gap-1.5 text-sm text-muted-foreground">
              <Users className="h-4 w-4" /> {q.players} {q.players === 1 ? "student has" : "students have"} joined
            </div>
          )}
        </div>
      </section>

      {state?.phase === "ended" && <EndedNote />}

      <PushOptIn />

      <section className="rounded-3xl border border-border bg-card p-5 sm:p-6">
        <h2 className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">Paper and timing</h2>
        <div className="mt-3 space-y-2">
          {today.sections.map((s) => (
            <div key={s.subject} className={cn("flex items-center gap-3 rounded-2xl border-l-4 bg-secondary/40 px-4 py-3", SUBJECT_TONE[s.subject].ring)}>
              <span className={cn("w-9 text-center text-xl font-bold tabular-nums", SUBJECT_TONE[s.subject].text)}>{s.count}</span>
              <span className="flex-1"><b className="block text-[15px]">{s.subject}</b><span className="text-sm text-muted-foreground">{s.secs} seconds per question</span></span>
              <span className="text-sm font-semibold tabular-nums">{Math.round((s.count * s.secs) / 60)} min</span>
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap justify-between gap-2 text-sm text-muted-foreground">
          <span>Starts <b className="text-foreground">6:00 PM</b></span>
          <span>Entry closes <b className="text-foreground">6:05 PM</b></span>
          <span>About <b className="text-foreground">{Math.round(totalMin)} min</b></span>
        </div>
      </section>

      <section className="rounded-3xl border border-border bg-card p-5 sm:p-6">
        <h2 className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">Syllabus</h2>
        <p className="mt-1 text-sm text-muted-foreground">Chapters of {today.syllabus.test_name} ({new Date(today.syllabus.test_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}).</p>
        <div className="mt-3 space-y-3">
          {(["Physics", "Chemistry", "Biology"] as Subject[]).map((s) => (
            <div key={s}>
              <div className={cn("text-sm font-bold", SUBJECT_TONE[s].text)}>{s}</div>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {(today.syllabus.chapters[s] ?? []).map((c) => (
                  <span key={c} className="rounded-full border border-border bg-secondary/50 px-2.5 py-1 text-[13px] font-medium">{c}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-border bg-card p-5 sm:p-6">
        <h2 className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">Rules</h2>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-2xl bg-secondary/50 py-3"><div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">+4</div><div className="text-xs text-muted-foreground">Correct</div></div>
          <div className="rounded-2xl bg-secondary/50 py-3"><div className="text-xl font-bold text-rose-600 dark:text-rose-400">−1</div><div className="text-xs text-muted-foreground">Wrong</div></div>
          <div className="rounded-2xl bg-secondary/50 py-3"><div className="text-xl font-bold">0</div><div className="text-xs text-muted-foreground">Skipped</div></div>
        </div>
        <ul className="mt-4 space-y-2.5 text-[15px] leading-snug">
          {RULES.map((r, i) => (
            <li key={i} className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-xs font-bold text-amber-700 dark:text-amber-400">{i + 1}</span>{r}</li>
          ))}
        </ul>
      </section>
    </>
  );
}

const RULES = [
  "Everyone sees the same question at the same moment. You cannot go back or skip ahead.",
  "When a question's time runs out, it locks and the next one opens.",
  "Leaving the quiz screen gives one warning. The second time, your attempt ends.",
  "Highest score wins. Ties go to whoever used less total time.",
  "Every player gets the options in a different order.",
  "Top scores are checked for fair play before the prize is paid.",
];

function EndedNote() {
  return (
    <div className="rounded-2xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
      Today's quiz has ended. Results are being prepared.
    </div>
  );
}

/* ============================================================ fair play */
function FairPlayGate({ busy, onAgree, onCancel }: { busy: boolean; onAgree: () => void; onCancel: () => void }) {
  const [ok, setOk] = useState(false);
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/90 px-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="mq-gate-title">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-elegant">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400"><ShieldCheck className="h-6 w-6" /></div>
        <h2 id="mq-gate-title" className="mt-4 text-xl font-bold">Play fair to win</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Stay on the quiz screen from 6:00 PM until it ends. Switching apps or tabs gives one warning, then ends your attempt.
        </p>
        <label className="mt-4 flex cursor-pointer items-start gap-3 text-[15px] leading-snug">
          <input type="checkbox" className="mt-0.5 h-5 w-5 accent-amber-500" checked={ok} onChange={(e) => setOk(e.target.checked)} />
          I will not use other apps, AI tools or help from anyone during the quiz.
        </label>
        <div className="mt-5 flex gap-2">
          <button type="button" onClick={onCancel} className="h-12 flex-1 rounded-xl border border-border font-semibold">Not now</button>
          <button type="button" onClick={onAgree} disabled={!ok || busy} className="h-12 flex-[2] rounded-xl bg-amber-400 font-bold text-amber-950 disabled:opacity-40">
            {busy ? "Joining…" : "I agree, join"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================ live play */
function LivePlay({ quizId, state, now, reload, onEnded }: {
  quizId: string; state: State; now: () => number; reload: () => Promise<State>; onEnded: () => void;
}) {
  useTick(true, 200);
  const [sel, setSel] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  const [warn, setWarn] = useState<string | null>(null);
  const reloading = useRef(false);

  const key = state.phase === "question" ? `q${state.idx}` : state.phase === "break" ? `b${state.next_idx}` : state.phase;
  useEffect(() => { setSel(state.phase === "question" ? state.my_choice : null); }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  const deadline = state.phase === "question" ? new Date(state.closes_at).getTime()
    : state.phase === "break" ? new Date(state.next_opens_at).getTime() : 0;
  const leftMs = Math.max(0, deadline - now());

  // Move on exactly when the server's schedule says so (plus a safety poll every 8 s).
  const refresh = useCallback(async () => {
    if (reloading.current) return;
    reloading.current = true;
    try {
      const s = await reload();
      if (s.phase === "ended" || s.phase === "left") onEnded();
    } catch { /* network blip: the next tick retries */ } finally { reloading.current = false; }
  }, [reload, onEnded]);
  // Once the deadline passes, ask the server for the next screen (at most once a second until it changes).
  const lastAsk = useRef(0);
  useEffect(() => {
    if (!deadline || now() - deadline < 250 || Date.now() - lastAsk.current < 1000) return;
    lastAsk.current = Date.now();
    void refresh();
  });
  useEffect(() => { const t = setInterval(() => void refresh(), 8000); return () => clearInterval(t); }, [refresh]);

  // Leaving the screen: first a warning, then the attempt ends (decided by the server).
  useEffect(() => {
    const onVis = async () => {
      if (document.visibilityState !== "hidden") return;
      try {
        const r = await rpc<{ counted: boolean; strikes: number; status: string }>("mega_strike", { _quiz: quizId });
        if (!r.counted) return;
        if (r.status === "left") onEnded();
        else setWarn("You left the quiz screen. One more time and your attempt ends.");
      } catch { /* ignore */ }
    };
    const block = (e: Event) => e.preventDefault();
    document.addEventListener("visibilitychange", onVis);
    document.addEventListener("copy", block);
    document.addEventListener("contextmenu", block);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      document.removeEventListener("copy", block);
      document.removeEventListener("contextmenu", block);
    };
  }, [quizId, onEnded]);

  async function lock(choice: number | null) {
    if (state.phase !== "question" || state.answered || sending) return;
    setSending(true);
    try {
      await rpc("mega_answer", { _quiz: quizId, _idx: state.idx, _choice: choice });
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Answer not saved");
      void refresh();
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[90] overflow-y-auto bg-background select-none" style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}>
      <div className="mx-auto flex min-h-full w-full max-w-xl flex-col px-4 py-4">
        {state.phase === "question" ? (
          <QuestionView state={state} leftMs={leftMs} sel={sel} setSel={setSel} sending={sending} onLock={() => lock(sel)} onSkip={() => lock(null)} />
        ) : state.phase === "break" ? (
          <BreakView state={state} leftMs={leftMs} />
        ) : (
          <div className="m-auto text-center text-muted-foreground">Loading…</div>
        )}
      </div>
      {warn && (
        <div className="fixed inset-x-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-[95] mx-auto max-w-xl rounded-2xl border border-rose-500 bg-rose-50 p-4 text-sm font-semibold text-rose-800 shadow-elegant dark:bg-rose-950 dark:text-rose-200">
          <div className="flex items-start gap-3">
            <span className="flex-1">{warn}</span>
            <button type="button" onClick={() => setWarn(null)} aria-label="Dismiss warning"><X className="h-4 w-4" /></button>
          </div>
        </div>
      )}
    </div>
  );
}

function QuestionView({ state, leftMs, sel, setSel, sending, onLock, onSkip }: {
  state: Extract<State, { phase: "question" }>; leftMs: number; sel: number | null; setSel: (n: number) => void;
  sending: boolean; onLock: () => void; onSkip: () => void;
}) {
  const tone = SUBJECT_TONE[state.subject];
  const secLeft = Math.ceil(leftMs / 1000);
  const frac = Math.max(0, Math.min(1, leftMs / (state.secs * 1000)));
  const R = 22, C = 2 * Math.PI * R;
  const img = state.image ? resolveAnyImageUrl(state.image) : null;

  return (
    <>
      <div className="flex items-center gap-3">
        <span className={cn("rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider", tone.bg, tone.text)}>{state.subject}</span>
        <span className="text-sm font-semibold tabular-nums text-muted-foreground">Q {state.idx} / {state.total}</span>
        <div className="relative ml-auto h-14 w-14" aria-label={`${secLeft} seconds left`}>
          <svg viewBox="0 0 56 56" className="h-14 w-14 -rotate-90">
            <circle cx="28" cy="28" r={R} fill="none" className="stroke-secondary" strokeWidth="5" />
            <circle cx="28" cy="28" r={R} fill="none" strokeWidth="5" strokeLinecap="round"
              className={secLeft <= 5 ? "stroke-rose-500" : "stroke-current " + tone.text}
              strokeDasharray={C} strokeDashoffset={C * (1 - frac)} />
          </svg>
          <span className={cn("absolute inset-0 flex items-center justify-center text-lg font-bold tabular-nums", secLeft <= 5 && "text-rose-500")}>{secLeft}</span>
        </div>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
        <div className={cn("h-full rounded-full", tone.bar)} style={{ width: `${((state.idx - 1) / state.total) * 100}%` }} />
      </div>

      <div className="mt-5 rounded-3xl border border-border bg-card p-5">
        <div className="text-[17px] font-medium leading-relaxed"><RichText>{state.text}</RichText></div>
        {img && <img src={img} alt="" className="mt-3 max-h-64 w-auto rounded-xl border border-border" draggable={false} />}
        <div className="mt-5 space-y-2.5">
          {state.options.map((o, i) => {
            const on = sel === i;
            return (
              <button key={i} type="button" disabled={state.answered || sending}
                onClick={() => setSel(i)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-2xl border-2 px-4 py-3.5 text-left text-[15.5px] font-medium transition",
                  on ? cn(tone.ring, tone.bg) : "border-border bg-background hover:border-foreground/20",
                  state.answered && !on && "opacity-50",
                )}>
                <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-sm font-bold", on ? cn(tone.bar, "text-white") : "bg-secondary text-muted-foreground")}>
                  {"ABCD"[i]}
                </span>
                <span className="min-w-0 flex-1"><RichText>{o}</RichText></span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4">
        {state.answered ? (
          <div className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-secondary/50 px-4 py-4 text-sm font-semibold">
            <Lock className="h-4 w-4" />
            {state.my_choice == null ? "Skipped" : "Answer locked"} · next question in {secLeft}s
          </div>
        ) : (
          <div className="flex gap-2">
            <button type="button" onClick={onSkip} disabled={sending} className="h-14 flex-1 rounded-2xl border border-border font-semibold">Skip</button>
            <button type="button" onClick={onLock} disabled={sel == null || sending} className="h-14 flex-[2] rounded-2xl bg-amber-400 text-base font-bold text-amber-950 disabled:opacity-40">
              {sending ? "Saving…" : "Lock answer"}
            </button>
          </div>
        )}
        <p className="mt-3 text-center text-xs text-muted-foreground">Locked answers can't be changed. Stay on this screen.</p>
      </div>
    </>
  );
}

function BreakView({ state, leftMs }: { state: Extract<State, { phase: "break" }>; leftMs: number }) {
  const tone = SUBJECT_TONE[state.next_subject] ?? SUBJECT_TONE.Physics;
  return (
    <div className="m-auto w-full rounded-3xl border border-border bg-card px-6 py-12 text-center">
      <div className={cn("text-xs font-bold uppercase tracking-[0.18em]", tone.text)}>Next section</div>
      <h2 className="mt-2 text-3xl font-bold">{state.next_subject}</h2>
      <p className="mt-2 text-muted-foreground">{state.next_secs} seconds per question</p>
      <div className={cn("mt-8 text-6xl font-bold tabular-nums", tone.text)}>{Math.ceil(leftMs / 1000)}</div>
      <p className="mt-6 text-sm text-muted-foreground">{state.answered} of {state.total} answered so far</p>
    </div>
  );
}

/* ============================================================== results */
function Results({ result }: { result: Result }) {
  const me = result.me;
  const [open, setOpen] = useState(false);
  const mins = (ms: number) => `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
  const winner = result.leaderboard.find((r) => r.prize > 0);
  return (
    <>
      <section className="rounded-3xl border border-amber-500/40 bg-gradient-to-br from-amber-100 via-amber-50 to-background p-6 text-center dark:from-[#2A1E06] dark:via-[#15110A] dark:to-card">
        <div className="text-xs font-bold uppercase tracking-[0.18em] text-amber-700 dark:text-amber-400">
          Mega Quiz · {new Date(result.quiz.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
        </div>
        {me ? (
          <>
            <div className="mt-3 text-6xl font-bold tracking-tight">{me.score}<span className="text-xl text-muted-foreground"> / 320</span></div>
            <div className="mt-2 text-lg font-semibold">Rank {me.rank} of {result.players}</div>
            {me.prize > 0 && (
              <div className="mx-auto mt-3 inline-flex items-center gap-2 rounded-full bg-amber-400 px-4 py-1.5 text-sm font-bold text-amber-950">
                <Trophy className="h-4 w-4" /> You won ₹{me.prize}. It's in your wallet.
              </div>
            )}
            {me.status === "left" && <p className="mt-3 text-sm text-rose-600 dark:text-rose-400">Your attempt ended early because you left the quiz screen twice, so it can't win a prize.</p>}
            {me.flagged && me.prize === 0 && <p className="mt-3 text-sm text-muted-foreground">Your result is being checked for fair play.</p>}
            <div className="mt-5 grid grid-cols-4 gap-2">
              {[[me.correct, "Correct", "text-emerald-600 dark:text-emerald-400"], [me.wrong, "Wrong", "text-rose-600 dark:text-rose-400"], [me.skipped, "Skipped", ""], [mins(me.time_ms ?? 0), "Time", ""]].map(([v, l, c]) => (
                <div key={l as string} className="rounded-2xl bg-background/70 py-3">
                  <div className={cn("text-lg font-bold tabular-nums", c as string)}>{v}</div>
                  <div className="text-[11px] text-muted-foreground">{l}</div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="mt-3 text-muted-foreground">You didn't play today. Join tomorrow at 6 PM.</p>
        )}
      </section>

      <section className="rounded-3xl border border-border bg-card p-5 sm:p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">Leaderboard</h2>
          <span className="text-sm text-muted-foreground">{result.players} played</span>
        </div>
        {winner && <p className="mt-2 text-sm">Winner: <b>{winner.name}</b> · ₹{winner.prize}</p>}
        <ol className="mt-3 divide-y divide-border">
          {result.leaderboard.map((r) => (
            <li key={r.rank} className={cn("flex items-center gap-3 py-2.5", r.me && "font-semibold")}>
              <span className={cn("w-7 text-center text-sm font-bold tabular-nums", r.rank <= 3 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground")}>{r.rank}</span>
              <span className="min-w-0 flex-1 truncate">{r.name}{r.me && " (you)"}</span>
              <span className="text-xs tabular-nums text-muted-foreground">{mins(r.time_ms ?? 0)}</span>
              <span className="w-10 text-right font-bold tabular-nums">{r.score}</span>
            </li>
          ))}
          {result.leaderboard.length === 0 && <li className="py-3 text-sm text-muted-foreground">No one played today.</li>}
        </ol>
      </section>

      {result.solutions.length > 0 && (
        <section className="rounded-3xl border border-border bg-card p-5 sm:p-6">
          <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-center justify-between text-left">
            <h2 className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">Answers and solutions</h2>
            <ChevronDown className={cn("h-5 w-5 transition", open && "rotate-180")} />
          </button>
          {open && (
            <div className="mt-4 space-y-3">
              {result.solutions.map((s) => {
                const state = s.mine == null ? "skip" : s.mine === s.correct ? "ok" : "bad";
                return (
                  <div key={s.idx} className={cn("rounded-2xl border-l-4 bg-secondary/40 p-4", state === "ok" ? "border-emerald-500" : state === "bad" ? "border-rose-500" : "border-border")}>
                    <div className="flex justify-between text-xs font-semibold text-muted-foreground">
                      <span>Q{s.idx} · {s.subject}</span>
                      <span>{state === "ok" ? "Correct · +4" : state === "bad" ? "Wrong · −1" : "Skipped · 0"}</span>
                    </div>
                    <div className="mt-2 text-[15px]"><RichText>{s.text}</RichText></div>
                    <div className="mt-2 space-y-1 text-sm">
                      {s.options.map((o, i) => (
                        <div key={i} className={cn("flex gap-2 rounded-lg px-2 py-1", i === s.correct && "bg-emerald-500/10 font-semibold", i === s.mine && i !== s.correct && "bg-rose-500/10")}>
                          <span>{"ABCD"[i]}.</span><span className="min-w-0 flex-1"><RichText>{o}</RichText></span>
                          {i === s.correct && <Check className="h-4 w-4 text-emerald-600" />}
                        </div>
                      ))}
                    </div>
                    {s.explanation && <div className="mt-2 text-sm text-muted-foreground"><RichText>{s.explanation}</RichText></div>}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <Clock className="h-4 w-4" /> Next Mega Quiz: tomorrow at 6:00 PM · <Link to="/wallet" className="font-semibold text-primary">Wallet</Link>
      </div>
    </>
  );
}

