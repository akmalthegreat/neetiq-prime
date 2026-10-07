import { DrAkzaLoader } from "@/components/dr-akza-loader";
// Target 700 Batch: one test. Syllabus, paper pattern and NTA-style
// instructions; the student confirms they have read them, then starts the CBT.

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, BarChart3, BookOpen, CheckCircle2, ChevronDown, Clock, Crown, FileText, Loader2, ShieldCheck, Target } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { startMockAttempt } from "@/lib/mock-gate.functions";
import { getFreeAccess, LOCKED_PREFIX } from "@/lib/premium-gate.functions";
import { T700, T700_INSTRUCTIONS, T700_SECTIONS, testKind, type T700Test } from "@/lib/target700";
import { cn } from "@/lib/utils";
import { FullBleedShell } from "@/components/page-shell";

export const Route = createFileRoute("/target-700-test/$testId")({
  head: () => ({ meta: [{ title: "Target 700 Batch — Test | NEET Track" }] }),
  component: Target700TestPage,
});

type Attempt = { id: string; score: number | null; correct_count: number | null; wrong_count: number | null; submitted_at: string | null };

function Target700TestPage() {
  const { testId } = Route.useParams();
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const gate = useServerFn(startMockAttempt);
  const [t, setT] = useState<T700Test | null | undefined>(undefined);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [agreed, setAgreed] = useState(false);
  const [starting, setStarting] = useState(false);
  const [locked, setLocked] = useState(false);
  const [openSec, setOpenSec] = useState<number>(0);
  const accessFn = useServerFn(getFreeAccess);
  const [freeLeft, setFreeLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!user) return;
    accessFn().then((a) => {
      if (a.premium) { setFreeLeft(null); return; }
      if (a.t700.includes(testId)) { setFreeLeft(null); return; }
      const left = Math.max(0, a.t700Limit - a.t700.length);
      setFreeLeft(left);
      if (left === 0) setLocked(true);
    }).catch(() => {});
  }, [user, testId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (!loading && !user) nav({ to: "/login" }); }, [user, loading, nav]);

  useEffect(() => {
    (supabase as any)
      .from("tests")
      .select("id,title,description,series_seq,series_label,series_group,syllabus")
      .eq("id", testId)
      .eq("series", T700.slug)
      .maybeSingle()
      .then(({ data }: { data: T700Test | null }) => setT(data ?? null));
  }, [testId]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("attempts")
      .select("id,score,correct_count,wrong_count,submitted_at")
      .eq("user_id", user.id)
      .eq("test_id", testId)
      .eq("status", "completed")
      .order("submitted_at", { ascending: false })
      .limit(5)
      .then(({ data }) => setAttempts((data ?? []) as Attempt[]));
  }, [user, testId]);

  async function start() {
    if (!agreed) { toast("Please confirm you have read the instructions"); return; }
    setStarting(true);
    try {
      await gate({ data: { test_id: testId } });
      nav({ to: "/quiz/$testId", params: { testId }, search: { mode: "cbt" } as never });
    } catch (e: any) {
      const msg = String(e?.message ?? "");
      if (msg.includes(LOCKED_PREFIX) || /upgrade required/i.test(msg)) setLocked(true);
      else toast.error(msg || "Could not start this test");
    } finally {
      setStarting(false);
    }
  }

  if (t === undefined) return <DrAkzaLoader fullScreen message="Opening your test" subMessage="Loading syllabus and instructions" />;
  if (t === null) {
    return (
      <FullBleedShell>
        <div className="mx-auto max-w-md px-4 py-16 text-center">
          <p className="font-semibold">This test isn't available.</p>
          <Link to="/target-700" className="mt-3 inline-block text-sm font-semibold text-primary">Back to Target 700 Batch</Link>
        </div>
      </FullBleedShell>
    );
  }

  const num = String(t.series_seq).padStart(2, "0");
  const syl = t.syllabus ?? [];
  const isFull = t.series_group === "full";

  return (
    <FullBleedShell>
    <div className="bg-background pb-36">
      <section className="relative overflow-hidden bg-[#050B1F] text-white">
        <div className="absolute inset-0 bg-[radial-gradient(80%_70%_at_100%_0%,rgba(250,204,21,.2),transparent_60%),radial-gradient(60%_60%_at_0%_100%,rgba(37,99,235,.3),transparent_60%)]" />
        <div className="relative mx-auto max-w-3xl px-4 pb-7 pt-6 sm:px-6">
          <Link to="/target-700" className="inline-flex items-center gap-1 text-xs font-semibold text-white/60 hover:text-white"><ArrowLeft className="h-3.5 w-3.5" /> Target 700 Batch</Link>
          <div className="mt-4 flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-2xl bg-gradient-to-br from-amber-200 to-yellow-500 font-black leading-none text-slate-950">
              <span className="text-[9px] font-bold uppercase tracking-wider">Test</span><span className="text-2xl">{num}</span>
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-amber-200">Target 700 Batch · {testKind(t.series_label)}</div>
              <h1 className="text-2xl font-black leading-tight sm:text-3xl">{t.series_label}</h1>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2 text-xs">
            {[[FileText, "180 questions"], [Clock, "180 minutes"], [Target, "720 marks"], [ShieldCheck, "+4 / −1"]].map(([Icon, l]: any) => (
              <span key={l} className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 font-semibold"><Icon className="h-3.5 w-3.5 text-amber-200" />{l}</span>
            ))}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-3xl space-y-5 px-4 pt-5 sm:px-6">
        {attempts.length > 0 && (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> You have taken this test</div>
            <ul className="mt-2 space-y-1.5 text-sm">
              {attempts.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-2">
                  <span><b>{Number(a.score ?? 0)}</b> / 720 <span className="text-muted-foreground">· {a.correct_count ?? 0} correct, {a.wrong_count ?? 0} wrong · {a.submitted_at ? new Date(a.submitted_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : ""}</span></span>
                  <Link to="/analysis/$attemptId" params={{ attemptId: a.id }} className="inline-flex items-center gap-1 text-xs font-semibold text-primary"><BarChart3 className="h-3.5 w-3.5" /> Analysis</Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Pattern */}
        <section className="rounded-2xl border border-border bg-card">
          <h2 className="border-b border-border px-4 py-3 text-sm font-bold">Paper pattern</h2>
          <div className="divide-y divide-border">
            {T700_SECTIONS.map((s) => (
              <div key={s.key} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span className="flex items-center gap-2 font-medium"><i className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />{s.name}</span>
                <span className="text-muted-foreground">{s.range} · 45 questions · 180 marks</span>
              </div>
            ))}
            <div className="flex items-center justify-between bg-secondary/30 px-4 py-2.5 text-sm font-bold"><span>Total</span><span>180 questions · 720 marks · 3 hours</span></div>
          </div>
        </section>

        {/* Syllabus */}
        <section className="rounded-2xl border border-border bg-card p-4">
          <h2 className="flex items-center gap-2 text-sm font-bold"><BookOpen className="h-4 w-4 text-primary" /> Syllabus</h2>
          {isFull && <p className="mt-1 text-xs text-muted-foreground">Complete NEET syllabus (Class 11 + 12) with real NEET chapter weightage.</p>}
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {syl.map((s) => {
              const sec = T700_SECTIONS.find((x) => x.key === s.subjectId);
              return (
                <div key={s.subjectId} className="rounded-xl border border-border p-3">
                  <div className="mb-2 flex items-center justify-between text-xs font-bold uppercase tracking-wider">
                    <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full" style={{ background: sec?.color }} />{s.subjectName}</span>
                    <span className="font-medium normal-case tracking-normal text-muted-foreground">{s.chapters.length} chapter{s.chapters.length === 1 ? "" : "s"}</span>
                  </div>
                  <ul className={cn("space-y-1 text-sm", isFull && "max-h-40 overflow-y-auto pr-1")}>
                    {s.chapters.map((c) => <li key={c.id} className="flex gap-2"><span className="text-muted-foreground">•</span>{c.name}</li>)}
                  </ul>
                </div>
              );
            })}
          </div>
        </section>

        {/* Instructions */}
        <section className="rounded-2xl border border-border bg-card">
          <h2 className="border-b border-border px-4 py-3 text-sm font-bold">Instructions to candidates</h2>
          <p className="px-4 pt-3 text-xs text-muted-foreground">Read these carefully before you start. They follow the NTA's NEET (UG) instructions, adapted for this online test.</p>
          <div className="divide-y divide-border">
            {T700_INSTRUCTIONS.map((sec, i) => (
              <div key={sec.title}>
                <button type="button" onClick={() => setOpenSec(openSec === i ? -1 : i)} className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold">
                  {i + 1}. {sec.title}
                  <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", openSec === i && "rotate-180")} />
                </button>
                {openSec === i && (
                  <ol className="list-decimal space-y-1.5 px-4 pb-4 pl-9 text-sm leading-relaxed text-foreground/90">
                    {sec.points.map((p) => <li key={p}>{p}</li>)}
                  </ol>
                )}
              </div>
            ))}
          </div>
        </section>

        {!locked && freeLeft !== null && (
          <div className="rounded-2xl border border-amber-400/40 bg-amber-400/10 p-4 text-sm">
            <span className="font-semibold">Free plan:</span> starting this test uses 1 of your {freeLeft} remaining free Target 700 test{freeLeft === 1 ? "" : "s"}.{" "}
            <Link to="/premium" className="font-semibold text-amber-700 underline dark:text-amber-300">Get Premium</Link> for all 46.
          </div>
        )}

        {locked && (
          <div className="rounded-2xl border border-amber-400/40 bg-amber-400/10 p-4 text-sm">
            <div className="flex items-center gap-2 font-bold"><Crown className="h-4 w-4 text-amber-500" /> Your free Target 700 tests are used</div>
            <p className="mt-1 text-muted-foreground">Get Premium to unlock all 46 tests with detailed solutions and analysis.</p>
            <Link to="/premium" className="mt-3 inline-flex h-10 items-center rounded-xl bg-amber-400 px-4 text-sm font-bold text-amber-950">Get Premium</Link>
          </div>
        )}
      </div>

      {/* Start bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t lg:left-64 border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:px-6">
          <label className="flex flex-1 cursor-pointer items-start gap-2 text-xs leading-snug sm:text-sm">
            <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 h-4 w-4 accent-amber-500" />
            I have read and understood the instructions. I will attempt this test honestly, in one sitting.
          </label>
          {locked ? (
            <Link to="/premium" className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-300 to-yellow-500 px-6 text-sm font-extrabold text-slate-950">
              <Crown className="h-4 w-4" /> Unlock with Premium
            </Link>
          ) : (
          <button type="button" onClick={start} disabled={starting || !agreed}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-300 to-yellow-500 px-6 text-sm font-extrabold text-slate-950 disabled:opacity-50">
            {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {attempts.length ? "Reattempt test" : `Start Test ${num}`}
          </button>
          )}
        </div>
      </div>
    </div>
    </FullBleedShell>
  );
}
