// Target 700 Batch: the test-series hub. Phases, all 46 tests in order with
// syllabus, the student's progress, and the schedule PDF.

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, BookOpen, CheckCircle2, ChevronDown, Clock, Crown, Download, FileText, Flame, Layers, Lock, Target, Trophy } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { getFreeAccess } from "@/lib/premium-gate.functions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { T700, T700_HIGHLIGHTS, T700_PHASES, testKind, type T700Test } from "@/lib/target700";
import { cn } from "@/lib/utils";
import { FullBleedShell } from "@/components/page-shell";

export const Route = createFileRoute("/target-700")({
  head: () => ({
    meta: [
      { title: "Target 700 Batch — NEET Test Series | NEET Track" },
      { name: "description", content: "46 NEET-pattern tests: Class 11 and 12 part tests, combined tests and 30 full syllabus papers. 180 questions, 180 minutes, CBT." },
    ],
  }),
  component: Target700Hub,
});

type Attempt = { id: string; test_id: string; score: number | null; submitted_at: string | null };

export function useT700Tests() {
  const [tests, setTests] = useState<T700Test[] | null>(null);
  useEffect(() => {
    (supabase as any)
      .from("tests")
      .select("id,title,description,series_seq,series_label,series_group,syllabus")
      .eq("series", T700.slug)
      .eq("archived", false)
      .order("series_seq", { ascending: true })
      .then(({ data }: { data: T700Test[] | null }) => setTests(data ?? []));
  }, []);
  return tests;
}

function Target700Hub() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const tests = useT700Tests();
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const accessFn = useServerFn(getFreeAccess);
  const [access, setAccess] = useState<Awaited<ReturnType<typeof getFreeAccess>> | null>(null);

  useEffect(() => { if (!loading && !user) nav({ to: "/login" }); }, [user, loading, nav]);
  useEffect(() => { if (user) accessFn().then(setAccess).catch(() => {}); }, [user]); // eslint-disable-line react-hooks/exhaustive-deps
  const free = access && !access.premium ? access : null;
  const isLocked = (id: string) => !!free && !free.t700.includes(id) && free.t700.length >= free.t700Limit;

  useEffect(() => {
    if (!user || !tests?.length) return;
    supabase
      .from("attempts")
      .select("id,test_id,score,submitted_at")
      .eq("user_id", user.id)
      .eq("status", "completed")
      .in("test_id", tests.map((t) => t.id))
      .order("submitted_at", { ascending: false })
      .then(({ data }) => setAttempts((data ?? []) as Attempt[]));
  }, [user, tests]);

  const best = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of attempts) m.set(a.test_id, Math.max(m.get(a.test_id) ?? -Infinity, Number(a.score ?? 0)));
    return m;
  }, [attempts]);

  const done = tests ? tests.filter((t) => best.has(t.id)).length : 0;
  const next = tests?.find((t) => !best.has(t.id)) ?? null;

  return (
    <FullBleedShell>
    <div className="bg-background pb-16">
      {/* Hero */}
      <section className="relative overflow-hidden bg-[#050B1F] text-white">
        <div className="absolute inset-0 bg-[radial-gradient(90%_70%_at_85%_0%,rgba(250,204,21,.22),transparent_60%),radial-gradient(70%_60%_at_0%_100%,rgba(37,99,235,.35),transparent_60%)]" />
        <div className="absolute -right-10 top-6 select-none text-[160px] font-black leading-none text-white/[.04] sm:text-[220px]">700</div>
        <div className="relative mx-auto max-w-5xl px-4 pb-8 pt-8 sm:px-6 sm:pt-12">
          <Link to="/mocks" className="text-xs font-semibold text-white/60 hover:text-white">← Mock tests</Link>
          <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-amber-200">
            <Target className="h-3.5 w-3.5" /> NEET Track test series
          </div>
          <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-6xl">
            Target <span className="bg-gradient-to-r from-amber-200 via-amber-300 to-yellow-500 bg-clip-text text-transparent">700</span> Batch
          </h1>
          <p className="mt-2 max-w-xl text-base text-white/75 sm:text-lg">{T700.tagline}. Solve it in order, exactly like the real exam.</p>

          <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              [`${T700.totalTests}`, "NEET-pattern tests"],
              ["8,280", "fresh questions"],
              ["180 / 180", "questions / minutes"],
              ["CBT", "NTA-style screen"],
            ].map(([v, l]) => (
              <div key={l} className="rounded-2xl border border-white/10 bg-white/[.04] px-3 py-3">
                <div className="text-xl font-extrabold sm:text-2xl">{v}</div>
                <div className="text-[11px] text-white/60">{l}</div>
              </div>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            {next ? (
              <Link to="/target-700-test/$testId" params={{ testId: next.id }}
                className="inline-flex h-12 items-center gap-2 rounded-xl bg-gradient-to-r from-amber-300 to-yellow-500 px-5 text-sm font-extrabold text-slate-950 shadow-[0_10px_30px_-10px_rgba(250,204,21,.7)]">
                {done ? `Continue: Test ${String(next.series_seq).padStart(2, "0")}` : "Start Test 01"} <ArrowRight className="h-4 w-4" />
              </Link>
            ) : tests?.length ? (
              <span className="inline-flex h-12 items-center gap-2 rounded-xl bg-emerald-500/20 px-5 text-sm font-bold text-emerald-200"><Trophy className="h-4 w-4" /> All 46 tests completed</span>
            ) : null}
            <a href={T700.pdf} target="_blank" rel="noopener"
              className="inline-flex h-12 items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-5 text-sm font-bold text-white hover:bg-white/10">
              <Download className="h-4 w-4" /> Schedule & syllabus (PDF)
            </a>
          </div>

          {free && (
            <div className="mt-5 flex max-w-xl flex-wrap items-center gap-3 rounded-2xl border border-amber-300/30 bg-amber-300/10 px-4 py-3">
              <Crown className="h-5 w-5 shrink-0 text-amber-300" />
              <div className="min-w-0 flex-1 text-sm">
                <div className="font-bold text-amber-100">
                  {free.t700.length >= free.t700Limit ? "Your free tests are used" : `Free plan: ${free.t700Limit - free.t700.length} of ${free.t700Limit} free tests left`}
                </div>
                <div className="text-xs text-white/70">Premium unlocks all {T700.totalTests} tests with solutions and analysis.</div>
              </div>
              <Link to="/premium" className="inline-flex h-10 items-center rounded-xl bg-gradient-to-r from-amber-300 to-yellow-500 px-4 text-xs font-extrabold text-slate-950">Get Premium</Link>
            </div>
          )}

          {tests && tests.length > 0 && (
            <div className="mt-6 max-w-md">
              <div className="flex justify-between text-xs text-white/70"><span>Your progress</span><span className="font-bold text-white">{done} / {tests.length}</span></div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-gradient-to-r from-amber-300 to-emerald-400 transition-all" style={{ width: `${(done / tests.length) * 100}%` }} />
              </div>
            </div>
          )}
        </div>
      </section>

      <div className="mx-auto max-w-5xl space-y-8 px-4 pt-6 sm:px-6">
        {/* Why */}
        <section className="grid gap-3 sm:grid-cols-[1.2fr_1fr]">
          <div className="rounded-2xl border border-border bg-card p-5">
            <h2 className="flex items-center gap-2 text-lg font-bold"><Flame className="h-5 w-5 text-amber-500" /> Why Target 700</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {T700_HIGHLIGHTS.map((h) => (
                <li key={h} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" /><span>{h}</span></li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5">
            <h2 className="flex items-center gap-2 text-lg font-bold"><Layers className="h-5 w-5 text-primary" /> How it builds up</h2>
            <ol className="mt-3 space-y-3">
              {T700_PHASES.map((p, i) => (
                <li key={p.group} className="flex gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">{i + 1}</span>
                  <div className="text-sm"><div className="font-semibold">{p.title} <span className="font-normal text-muted-foreground">· {p.range}</span></div><div className="text-muted-foreground">{p.blurb}</div></div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Tests */}
        {tests === null ? (
          <div className="space-y-3">{Array.from({ length: 6 }, (_, i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-secondary/60" />)}</div>
        ) : (
          T700_PHASES.map((p) => {
            const list = tests.filter((t) => t.series_group === p.group);
            if (!list.length) return null;
            return (
              <section key={p.group}>
                <div className="mb-3 flex items-end justify-between gap-2">
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-amber-600 dark:text-amber-400">{p.range}</div>
                    <h2 className="text-xl font-bold">{p.title}</h2>
                  </div>
                  <span className="text-xs text-muted-foreground">{list.filter((t) => best.has(t.id)).length} / {list.length} done</span>
                </div>
                <ul className="space-y-2.5">
                  {list.map((t) => <TestRow key={t.id} t={t} score={best.get(t.id)} isNext={next?.id === t.id} locked={isLocked(t.id)} />)}
                </ul>
              </section>
            );
          })
        )}

        <p className="text-center text-xs text-muted-foreground">
          Every test: 180 questions · 180 minutes · +4 / −1 · Physics 45 · Chemistry 45 · Botany 45 · Zoology 45
        </p>
      </div>
    </div>
    </FullBleedShell>
  );
}

function TestRow({ t, score, isNext, locked }: { t: T700Test; score: number | undefined; isNext: boolean; locked: boolean }) {
  const [open, setOpen] = useState(false);
  const kind = testKind(t.series_label);
  const syl = t.syllabus ?? [];
  const chapterCount = syl.reduce((n, s) => n + s.chapters.length, 0);
  const isFull = t.series_group === "full";
  const doneTest = score !== undefined;
  return (
    <li className={cn("overflow-hidden rounded-2xl border bg-card transition", isNext ? "border-amber-400/60 shadow-[0_0_0_3px_rgba(250,204,21,.12)]" : "border-border")}>
      <div className="flex items-center gap-3 p-3 sm:p-4">
        <div className={cn("flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl font-black leading-none",
          doneTest ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-gradient-to-br from-[#0B1A45] to-[#13296B] text-amber-200")}>
          <span className="text-[9px] font-bold uppercase tracking-wider opacity-70">Test</span>
          <span className="text-lg">{String(t.series_seq).padStart(2, "0")}</span>
        </div>
        <Link to="/target-700-test/$testId" params={{ testId: t.id }} className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-semibold">{t.series_label}</span>
            {isNext && !locked && <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-700 dark:text-amber-300">Up next</span>}
            {locked && <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-700 dark:text-amber-300"><Lock className="h-3 w-3" />Premium</span>}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            <span>{kind}</span>
            <span className="inline-flex items-center gap-1"><FileText className="h-3 w-3" />180 Qs</span>
            <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />180 min</span>
            {doneTest && <span className="font-semibold text-emerald-600 dark:text-emerald-400">Best {score} / 720</span>}
          </div>
        </Link>
        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">
          <BookOpen className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Syllabus</span>
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
        </button>
      </div>
      {open && (
        <div className="border-t border-border bg-secondary/20 px-4 py-3 text-xs">
          {isFull ? (
            <p className="text-muted-foreground">Complete NEET syllabus: all {chapterCount} chapters of Class 11 and 12, with NEET chapter weightage.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {syl.map((s) => (
                <div key={s.subjectId}>
                  <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{s.subjectName}</div>
                  <div className="flex flex-wrap gap-1">{s.chapters.map((c) => <span key={c.id} className="rounded-md border border-border bg-background px-1.5 py-0.5">{c.name}</span>)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </li>
  );
}
