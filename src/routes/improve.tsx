// Improvement Zone: Saved questions, My Mistakes (with reasons and fixing),
// and Analytics (accuracy, timing, mistake patterns, weak chapters).

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Bookmark, XCircle, BarChart3, Play, Trash2, ChevronDown, Check, Clock, Target, TrendingUp, Zap, AlertTriangle, Brain, Sparkles, Loader2 } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { DrAkzaLoader } from "@/components/dr-akza-loader";
import { RichText } from "@/components/rich-text";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { FeatureLock } from "@/components/feature-lock";

type Tab = "saved" | "mistakes" | "analytics";
export const Route = createFileRoute("/improve")({
  validateSearch: (s: Record<string, unknown>): { tab?: Tab } => ({
    tab: s.tab === "mistakes" || s.tab === "analytics" || s.tab === "saved" ? (s.tab as Tab) : undefined,
  }),
  head: () => ({ meta: [{ title: "Improvement Zone — NEET Track" }] }),
  component: () => (<FeatureLock feature="improvement_zone"><ImprovePage /></FeatureLock>),
});

const db = supabase as any;

type Q = { id: string; text: string; options: string[]; correct_index: number; explanation: string | null; difficulty: string | null; subject_id: string | null; chapter_id: string | null; qtype: string | null; question_image_url?: string | null };
type Mistake = { question_id: string; chapter_id: string | null; reason: string | null; fixed_at: string | null; created_at: string };

const SUBJ: Record<string, { label: string; color: string }> = {
  physics: { label: "Physics", color: "#0EA5E9" }, chemistry: { label: "Chemistry", color: "#8B5CF6" }, biology: { label: "Biology", color: "#10B981" },
};
const REASONS = ["Silly mistake", "Concept not clear", "Forgot a fact", "Misread the question", "Calculation error", "Guessed"];
const QTYPE: Record<string, string> = {
  "MCQ": "Direct MCQ", "MCQ type-2": "Statement-based", "Assertion and Reason": "Assertion–Reason",
  "Match the following": "Match the column", "MCQ type-3": "Diagram / graph", "Graph/Figure": "Diagram / graph",
};

async function fetchQuestions(ids: string[]): Promise<Map<string, Q>> {
  const out = new Map<string, Q>();
  const uniq = Array.from(new Set(ids));
  const chunks: string[][] = [];
  for (let i = 0; i < uniq.length; i += 150) chunks.push(uniq.slice(i, i + 150));
  const res = await Promise.all(chunks.map((c) => db.from("questions").select("id,text,options,correct_index,explanation,difficulty,subject_id,chapter_id,qtype,question_image_url").in("id", c)));
  for (const r of res) for (const q of (r.data ?? []) as Q[]) out.set(q.id, q);
  return out;
}
async function fetchChapterNames(ids: string[]): Promise<Map<string, string>> {
  const uniq = Array.from(new Set(ids.filter(Boolean)));
  if (!uniq.length) return new Map();
  const { data } = await db.from("chapters").select("id,name").in("id", uniq);
  return new Map(((data ?? []) as { id: string; name: string }[]).map((c) => [String(c.id), c.name]));
}

function ImprovePage() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const search = Route.useSearch();
  const tab: Tab = search.tab ?? "mistakes";
  const setTab = (t: Tab) => nav({ to: "/improve", search: { tab: t }, replace: true });
  const [counts, setCounts] = useState<{ saved: number; open: number; fixed: number } | null>(null);
  const [chapterFilter, setChapterFilter] = useState<string | null>(null);

  useEffect(() => { if (!loading && !user) nav({ to: "/login" }); }, [user, loading, nav]);
  const refreshCounts = async () => {
    if (!user) return;
    const [b, o, f] = await Promise.all([
      db.from("bookmarks").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      db.from("wrong_questions").select("id", { count: "exact", head: true }).eq("user_id", user.id).is("fixed_at", null),
      db.from("wrong_questions").select("id", { count: "exact", head: true }).eq("user_id", user.id).not("fixed_at", "is", null),
    ]);
    setCounts({ saved: b.count ?? 0, open: o.count ?? 0, fixed: f.count ?? 0 });
  };
  useEffect(() => { refreshCounts(); }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  async function startPractice(ids: string[], title: string, source: string) {
    if (!user || !ids.length) return;
    const qids = ids.slice(0, 60);
    const { data, error } = await db.from("tests").insert({
      title, type: "practice", difficulty: "mixed", duration_min: Math.max(10, Math.ceil(qids.length * 1.2)),
      total_questions: qids.length, question_ids: qids, created_by: user.id, source,
    }).select("id").maybeSingle();
    if (error || !data) { toast.error("Could not start practice"); return; }
    nav({ to: "/quiz/$testId", params: { testId: data.id }, search: { mode: "quiz" } as never });
  }

  const tabs: { k: Tab; label: string; icon: typeof Bookmark; n?: number; tint: string }[] = [
    { k: "saved", label: "Saved", icon: Bookmark, n: counts?.saved, tint: "#F59E0B" },
    { k: "mistakes", label: "My Mistakes", icon: XCircle, n: counts?.open, tint: "#EF4444" },
    { k: "analytics", label: "Analytics", icon: BarChart3, tint: "#3B82F6" },
  ];
  const fixRate = counts && counts.open + counts.fixed > 0 ? Math.round((counts.fixed / (counts.open + counts.fixed)) * 100) : 0;

  return (
    <PageShell>
      <div className="mx-auto max-w-4xl space-y-5">
        {/* Hero */}
        <section className="relative overflow-hidden rounded-3xl bg-[#071226] p-6 text-white sm:p-8">
          <div className="absolute inset-0 bg-[radial-gradient(70%_80%_at_100%_0%,rgba(16,185,129,.25),transparent_60%),radial-gradient(60%_70%_at_0%_100%,rgba(59,130,246,.3),transparent_60%)]" />
          <div className="relative">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/15 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-200"><TrendingUp className="h-3.5 w-3.5" /> Improvement Zone</div>
            <h1 className="mt-3 text-3xl font-black leading-tight sm:text-4xl">Turn every mistake into marks.</h1>
            <p className="mt-2 max-w-xl text-sm text-white/70 sm:text-base">Save doubtful questions, fix your mistakes until they stick, and see exactly where your marks are leaking.</p>
            <div className="mt-5 grid grid-cols-3 gap-2">
              {[
                ["Saved", counts?.saved, "to revisit"],
                ["To fix", counts?.open, "open mistakes"],
                ["Fixed", counts?.fixed, `${fixRate}% fixed`],
              ].map(([l, v, sub]) => (
                <div key={String(l)} className="rounded-2xl border border-white/10 bg-white/[.05] p-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-white/60">{l}</div>
                  <div className="mt-0.5 text-2xl font-black tabular-nums">{v === undefined ? "—" : Number(v).toLocaleString("en-IN")}</div>
                  <div className="text-[11px] text-white/55">{sub}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Tabs */}
        <div className="sticky top-2 z-20 grid grid-cols-3 gap-1 rounded-2xl border border-border bg-card/90 p-1 backdrop-blur">
          {tabs.map((t) => (
            <button key={t.k} type="button" onClick={() => setTab(t.k)}
              className={cn("flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-[13px] font-semibold transition", tab === t.k ? "bg-background shadow-sm" : "text-muted-foreground")}>
              <t.icon className="h-4 w-4" style={{ color: tab === t.k ? t.tint : undefined }} />{t.label}
              {t.n ? <span className="rounded-full bg-secondary px-1.5 text-[10px] font-bold">{t.n > 999 ? "999+" : t.n}</span> : null}
            </button>
          ))}
        </div>

        {tab === "saved" && <SavedTab userId={user?.id} onPractice={startPractice} onChange={refreshCounts} />}
        {tab === "mistakes" && <MistakesTab userId={user?.id} onPractice={startPractice} onChange={refreshCounts} chapterFilter={chapterFilter} setChapterFilter={setChapterFilter} />}
        {tab === "analytics" && <AnalyticsTab userId={user?.id} onWeakChapter={(ch) => { setChapterFilter(ch); setTab("mistakes"); }} />}
      </div>
    </PageShell>
  );
}

/* ================================================================ SAVED */

function SavedTab({ userId, onPractice, onChange }: { userId?: string; onPractice: (ids: string[], t: string, s: string) => void; onChange: () => void }) {
  const [rows, setRows] = useState<{ q: Q; at: string }[] | null>(null);
  const [chapters, setChapters] = useState<Map<string, string>>(new Map());
  const [subject, setSubject] = useState<string>("all");
  useEffect(() => {
    if (!userId) return;
    (async () => {
      const { data } = await db.from("bookmarks").select("question_id,created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(1000);
      const list = (data ?? []) as { question_id: string; created_at: string }[];
      const qs = await fetchQuestions(list.map((b) => b.question_id));
      const r = list.map((b) => ({ q: qs.get(b.question_id)!, at: b.created_at })).filter((x) => x.q);
      setChapters(await fetchChapterNames(r.map((x) => String(x.q.chapter_id ?? ""))));
      setRows(r);
    })();
  }, [userId]);

  if (rows === null) return <DrAkzaLoader message="Opening your saved questions" />;
  const shown = rows.filter((r) => subject === "all" || r.q.subject_id === subject);

  async function remove(id: string) {
    setRows((x) => (x ?? []).filter((r) => r.q.id !== id));
    await db.from("bookmarks").delete().eq("user_id", userId).eq("question_id", id);
    onChange();
  }

  return (
    <div className="space-y-4">
      <InfoCard icon={<Bookmark className="h-5 w-5" />} tint="#F59E0B" title="Questions you weren't sure about"
        text="While solving, tap the bookmark on any question you guessed or felt unsure of. Reattempt them here until you're confident." />
      {rows.length === 0 ? <Empty emoji="🔖" title="No saved questions yet" text="Tap the bookmark icon while solving any question to save it here." /> : (
        <>
          <Toolbar subject={subject} setSubject={setSubject} counts={countBySubject(rows.map((r) => r.q))}
            action={<button type="button" onClick={() => onPractice(shown.map((r) => r.q.id), "Saved Questions — Reattempt", "Saved")} className="btn-primary-iz"><Play className="h-4 w-4" />Reattempt {Math.min(60, shown.length)}</button>} />
          <ul className="space-y-2.5">
            {shown.map((r) => (
              <QuestionCard key={r.q.id} q={r.q} chapter={chapters.get(String(r.q.chapter_id))}
                extra={<button type="button" onClick={() => remove(r.q.id)} className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" />Remove</button>} />
            ))}
          </ul>
        </>
      )}
      <IzStyles />
    </div>
  );
}

/* ================================================================ MISTAKES */

function MistakesTab({ userId, onPractice, onChange, chapterFilter, setChapterFilter }: {
  userId?: string; onPractice: (ids: string[], t: string, s: string) => void; onChange: () => void;
  chapterFilter: string | null; setChapterFilter: (c: string | null) => void;
}) {
  const [rows, setRows] = useState<{ q: Q; m: Mistake }[] | null>(null);
  const [chapters, setChapters] = useState<Map<string, string>>(new Map());
  const [subject, setSubject] = useState("all");
  const [view, setView] = useState<"open" | "fixed">("open");
  useEffect(() => {
    if (!userId) return;
    (async () => {
      const { data } = await db.from("wrong_questions").select("question_id,chapter_id,reason,fixed_at,created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(2000);
      const list = (data ?? []) as Mistake[];
      const qs = await fetchQuestions(list.map((m) => m.question_id));
      const r = list.map((m) => ({ q: qs.get(m.question_id)!, m })).filter((x) => x.q);
      setChapters(await fetchChapterNames(r.map((x) => String(x.q.chapter_id ?? x.m.chapter_id ?? ""))));
      setRows(r);
    })();
  }, [userId]);

  if (rows === null) return <DrAkzaLoader message="Gathering your mistakes" />;
  const open = rows.filter((r) => !r.m.fixed_at);
  const base = view === "open" ? open : rows.filter((r) => r.m.fixed_at);
  const shown = base.filter((r) => (subject === "all" || r.q.subject_id === subject) && (!chapterFilter || String(r.q.chapter_id) === chapterFilter));

  // Chapters with the most open mistakes
  const byChapter = new Map<string, number>();
  for (const r of open) { const c = String(r.q.chapter_id ?? ""); if (c) byChapter.set(c, (byChapter.get(c) ?? 0) + 1); }
  const topChapters = [...byChapter.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  const reasonCounts = new Map<string, number>();
  for (const r of rows) if (r.m.reason) reasonCounts.set(r.m.reason, (reasonCounts.get(r.m.reason) ?? 0) + 1);

  async function setReason(qid: string, reason: string | null) {
    setRows((x) => (x ?? []).map((r) => (r.q.id === qid ? { ...r, m: { ...r.m, reason } } : r)));
    await db.from("wrong_questions").update({ reason, updated_at: new Date().toISOString() }).eq("user_id", userId).eq("question_id", qid);
  }
  async function markFixed(qid: string) {
    const at = new Date().toISOString();
    setRows((x) => (x ?? []).map((r) => (r.q.id === qid ? { ...r, m: { ...r.m, fixed_at: at } } : r)));
    await db.from("wrong_questions").update({ fixed_at: at }).eq("user_id", userId).eq("question_id", qid);
    toast.success("Marked as fixed 💪");
    onChange();
  }

  return (
    <div className="space-y-4">
      <InfoCard icon={<XCircle className="h-5 w-5" />} tint="#EF4444" title="Every wrong answer, in one place"
        text="Read the solution, note why you got it wrong, then practise. A mistake is marked fixed automatically when you answer it correctly." />

      {rows.length === 0 ? <Empty emoji="🎯" title="No mistakes yet" text="Wrong answers from your tests and practice appear here automatically." /> : (
        <>
          {topChapters.length > 0 && (
            <section className="rounded-3xl border border-border bg-card p-4">
              <div className="mb-2 text-sm font-bold">Chapters with the most mistakes</div>
              <div className="flex flex-wrap gap-1.5">
                {chapterFilter && <button type="button" onClick={() => setChapterFilter(null)} className="rounded-full bg-foreground px-3 py-1 text-xs font-semibold text-background">All chapters ✕</button>}
                {topChapters.map(([c, n]) => (
                  <button key={c} type="button" onClick={() => setChapterFilter(chapterFilter === c ? null : c)}
                    className={cn("rounded-full border px-3 py-1 text-xs font-medium", chapterFilter === c ? "border-rose-500 bg-rose-500/10 text-rose-600 dark:text-rose-400" : "border-border text-muted-foreground")}>
                    {chapters.get(c) ?? "Chapter"} <b className="ml-0.5">{n}</b>
                  </button>
                ))}
              </div>
            </section>
          )}

          <div className="flex items-center gap-2">
            <div className="grid flex-1 grid-cols-2 gap-1 rounded-xl bg-secondary/60 p-1 text-xs font-semibold">
              <button type="button" onClick={() => setView("open")} className={cn("rounded-lg py-2", view === "open" ? "bg-background shadow-sm" : "text-muted-foreground")}>To fix · {open.length}</button>
              <button type="button" onClick={() => setView("fixed")} className={cn("rounded-lg py-2", view === "fixed" ? "bg-background shadow-sm" : "text-muted-foreground")}>Fixed · {rows.length - open.length}</button>
            </div>
          </div>

          <Toolbar subject={subject} setSubject={setSubject} counts={countBySubject(base.map((r) => r.q))}
            action={view === "open" && shown.length > 0
              ? <button type="button" onClick={() => onPractice(shown.map((r) => r.q.id), chapterFilter ? `Fix mistakes — ${chapters.get(chapterFilter) ?? "Chapter"}` : "Fix my mistakes", "My Mistakes")} className="btn-primary-iz"><Zap className="h-4 w-4" />Fix {Math.min(60, shown.length)} now</button>
              : null} />

          {reasonCounts.size > 0 && (
            <div className="flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
              <span className="font-semibold">Your reasons:</span>
              {[...reasonCounts.entries()].sort((a, b) => b[1] - a[1]).map(([r, n]) => <span key={r} className="rounded-full bg-secondary px-2 py-0.5">{r} · {n}</span>)}
            </div>
          )}

          {shown.length === 0 ? <Empty emoji={view === "open" ? "🎉" : "🛠️"} title={view === "open" ? "Nothing to fix here" : "No fixed mistakes yet"} text={view === "open" ? "Great work. Try another subject or chapter." : "Answer a past mistake correctly and it moves here."} /> : (
            <ul className="space-y-2.5">
              {shown.slice(0, 200).map((r) => (
                <QuestionCard key={r.q.id} q={r.q} chapter={chapters.get(String(r.q.chapter_id))} fixed={!!r.m.fixed_at}
                  extra={
                    <div className="w-full space-y-2">
                      <div className="flex flex-wrap gap-1">
                        <span className="mr-1 self-center text-[11px] font-semibold text-muted-foreground">Why wrong?</span>
                        {REASONS.map((x) => (
                          <button key={x} type="button" onClick={() => setReason(r.q.id, r.m.reason === x ? null : x)}
                            className={cn("rounded-full border px-2 py-0.5 text-[11px]", r.m.reason === x ? "border-primary bg-primary/10 font-semibold text-primary" : "border-border text-muted-foreground")}>{x}</button>
                        ))}
                      </div>
                      {!r.m.fixed_at && <button type="button" onClick={() => markFixed(r.q.id)} className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400"><Check className="h-3.5 w-3.5" />I've understood this</button>}
                    </div>
                  } />
              ))}
            </ul>
          )}
          {shown.length > 200 && <p className="text-center text-xs text-muted-foreground">Showing 200 of {shown.length}. Use the filters to narrow down.</p>}
        </>
      )}
      <IzStyles />
    </div>
  );
}

/* ================================================================ ANALYTICS */

type Row = { q: Q; ok: boolean; skipped: boolean; t: number | null; exact: boolean };

function AnalyticsTab({ userId, onWeakChapter }: { userId?: string; onWeakChapter: (ch: string) => void }) {
  const [data, setData] = useState<{ rows: Row[]; tests: { title: string; pct: number; at: string }[]; chapters: Map<string, string>; exactCount: number } | null>(null);
  useEffect(() => {
    if (!userId) return;
    (async () => {
      const since = new Date(Date.now() - 90 * 86_400_000).toISOString();
      const { data: ats } = await db.from("attempts")
        .select("answers,question_times,time_taken_sec,submitted_at,correct_count,wrong_count,unattempted_count,tests:test_id(title,question_ids,type)")
        .eq("user_id", userId).eq("status", "completed").gte("submitted_at", since)
        .order("submitted_at", { ascending: false }).limit(60);
      const list = (ats ?? []) as any[];
      const ids: string[] = [];
      for (const a of list) for (const id of (a.tests?.question_ids ?? []) as string[]) ids.push(id);
      const qs = await fetchQuestions(ids.slice(0, 5000));
      const rows: Row[] = [];
      let exactCount = 0;
      for (const a of list) {
        const qids = ((a.tests?.question_ids ?? []) as string[]).filter((id) => qs.has(id));
        const answers = (a.answers ?? {}) as Record<string, number>;
        const times = (a.question_times ?? null) as Record<string, number> | null;
        const answered = Object.keys(answers).length || 1;
        const avg = a.time_taken_sec ? Math.min(600, a.time_taken_sec / answered) : null;
        for (const id of qids) {
          const q = qs.get(id)!;
          const ans = answers[id];
          const exact = !!times && times[id] !== undefined;
          if (exact) exactCount++;
          rows.push({ q, ok: ans !== undefined && ans === q.correct_index, skipped: ans === undefined, t: exact ? times![id] : ans === undefined ? null : avg, exact });
        }
      }
      const tests = list.filter((a) => (a.correct_count ?? 0) + (a.wrong_count ?? 0) + (a.unattempted_count ?? 0) >= 10).slice(0, 12).reverse().map((a) => {
        const total = (a.correct_count ?? 0) + (a.wrong_count ?? 0) + (a.unattempted_count ?? 0);
        return { title: a.tests?.title ?? "Test", pct: Math.max(0, Math.round(((a.correct_count * 4 - a.wrong_count) / (total * 4)) * 100)), at: a.submitted_at };
      });
      setData({ rows, tests, chapters: await fetchChapterNames(rows.map((r) => String(r.q.chapter_id ?? ""))), exactCount });
    })();
  }, [userId]);

  const s = useMemo(() => {
    if (!data) return null;
    const att = data.rows.filter((r) => !r.skipped);
    const acc = (rs: Row[]) => { const a = rs.filter((r) => !r.skipped); return a.length ? Math.round((a.filter((r) => r.ok).length / a.length) * 100) : null; };
    const avgT = (rs: Row[]) => { const t = rs.filter((r) => !r.skipped && r.t !== null); return t.length ? Math.round(t.reduce((x, r) => x + (r.t ?? 0), 0) / t.length) : null; };
    const group = (key: (r: Row) => string) => {
      const m = new Map<string, Row[]>();
      for (const r of data.rows) { const k = key(r); if (!k) continue; m.set(k, [...(m.get(k) ?? []), r]); }
      return m;
    };
    const bySubj = group((r) => r.q.subject_id ?? "");
    const byDiff = group((r) => (r.q.difficulty ?? "").toLowerCase());
    const byType = group((r) => QTYPE[r.q.qtype ?? "MCQ"] ?? "Direct MCQ");
    const byCh = group((r) => String(r.q.chapter_id ?? ""));
    const chAcc = new Map<string, number>();
    for (const [c, rs] of byCh) { const a = rs.filter((r) => !r.skipped); if (a.length >= 6) chAcc.set(c, a.filter((r) => r.ok).length / a.length); }

    // Classify each wrong answer
    const wrong = att.filter((r) => !r.ok);
    const kinds = { rushed: 0, easy: 0, concept: 0, slow: 0, tough: 0 };
    for (const r of wrong) {
      const ch = String(r.q.chapter_id ?? "");
      if (r.exact && r.t !== null && r.t < 25) kinds.rushed++;
      else if ((r.q.difficulty ?? "").toLowerCase() === "easy") kinds.easy++;
      else if ((chAcc.get(ch) ?? 1) < 0.5) kinds.concept++;
      else if (r.t !== null && r.t > 150) kinds.slow++;
      else kinds.tough++;
    }
    const exactRows = att.filter((r) => r.exact && r.t !== null);
    const buckets = [["Under 30s", 0, 30], ["30s – 1 min", 30, 60], ["1 – 2 min", 60, 120], ["Over 2 min", 120, 1e9]].map(([l, lo, hi]) => {
      const rs = exactRows.filter((r) => (r.t as number) >= (lo as number) && (r.t as number) < (hi as number));
      return { label: l as string, n: rs.length, acc: rs.length ? Math.round((rs.filter((r) => r.ok).length / rs.length) * 100) : null };
    });
    const weak = [...chAcc.entries()].sort((a, b) => a[1] - b[1]).slice(0, 6);
    return {
      attempted: att.length, accuracy: acc(data.rows), avgTime: avgT(data.rows),
      skipped: data.rows.filter((r) => r.skipped).length, lost: wrong.length,
      subjects: ["physics", "chemistry", "biology"].map((k) => ({ k, rs: bySubj.get(k) ?? [] })).filter((x) => x.rs.length).map((x) => ({ k: x.k, acc: acc(x.rs), t: avgT(x.rs), n: x.rs.filter((r) => !r.skipped).length })),
      diffs: ["easy", "medium", "hard"].map((k) => ({ k, acc: acc(byDiff.get(k) ?? []), n: (byDiff.get(k) ?? []).filter((r) => !r.skipped).length })),
      types: [...byType.entries()].map(([k, rs]) => ({ k, acc: acc(rs), n: rs.filter((r) => !r.skipped).length })).filter((x) => x.n >= 3).sort((a, b) => (a.acc ?? 0) - (b.acc ?? 0)),
      kinds, wrongTotal: wrong.length, buckets, weak,
    };
  }, [data]);

  if (!data || !s) return <DrAkzaLoader message="Analysing your tests" subMessage="Accuracy, timing and mistake patterns" />;
  if (s.attempted === 0) return <Empty emoji="📊" title="No test data yet" text="Take a test or practise a chapter. Your analysis appears here right after." />;

  const KIND_INFO: [keyof typeof s.kinds, string, string, string][] = [
    ["rushed", "Rushed answers", "Answered in under 25 seconds and got it wrong. Slow down and read every option.", "#F59E0B"],
    ["easy", "Easy questions missed", "Marks you should never lose. Revise NCERT lines and re-check before marking.", "#EF4444"],
    ["concept", "Concept gaps", "From chapters where your accuracy is below 50%. Re-learn the concept, then practise.", "#8B5CF6"],
    ["slow", "Overthinking", "Spent over 2.5 minutes and still got it wrong. Skip and come back later.", "#0EA5E9"],
    ["tough", "Tough questions", "Genuinely hard questions. Review the solution and move on.", "#64748B"],
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Tile icon={<Target className="h-4 w-4 text-emerald-500" />} label="Accuracy" value={s.accuracy === null ? "—" : `${s.accuracy}%`} sub={`${s.attempted.toLocaleString("en-IN")} attempted`} />
        <Tile icon={<Clock className="h-4 w-4 text-sky-500" />} label="Time / question" value={s.avgTime === null ? "—" : `${s.avgTime}s`} sub="NEET pace: 60s" />
        <Tile icon={<XCircle className="h-4 w-4 text-rose-500" />} label="Marks lost" value={`−${s.lost.toLocaleString("en-IN")}`} sub="from negative marking" />
        <Tile icon={<AlertTriangle className="h-4 w-4 text-amber-500" />} label="Skipped" value={s.skipped.toLocaleString("en-IN")} sub="questions left blank" />
      </div>

      {data.tests.length > 1 && (
        <Panel title="Score trend" icon={<TrendingUp className="h-4 w-4 text-emerald-500" />}>
          <div className="flex h-32 items-end gap-1.5">
            {data.tests.map((t, i) => (
              <div key={i} className="group flex h-full flex-1 flex-col items-center justify-end gap-1" title={`${t.title}: ${t.pct}%`}>
                <span className="text-[10px] font-bold text-muted-foreground">{t.pct}%</span>
                <div className="w-full rounded-t-md bg-gradient-to-t from-emerald-500 to-cyan-400" style={{ height: `${Math.max(4, t.pct)}%` }} />
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">Your last {data.tests.length} tests (score as % of maximum marks).</p>
        </Panel>
      )}

      <Panel title="Your mistake patterns" icon={<Brain className="h-4 w-4 text-violet-500" />}>
        <p className="mb-3 text-xs text-muted-foreground">We sorted your {s.wrongTotal.toLocaleString("en-IN")} wrong answers by what most likely went wrong.</p>
        <ul className="space-y-3">
          {KIND_INFO.map(([k, title, tip, color]) => {
            const n = s.kinds[k]; const pct = s.wrongTotal ? Math.round((n / s.wrongTotal) * 100) : 0;
            return (
              <li key={k}>
                <div className="flex items-center justify-between text-sm"><span className="font-semibold">{title}</span><span className="text-xs text-muted-foreground">{n} · {pct}%</span></div>
                <div className="mt-1 h-2 rounded-full bg-secondary"><div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} /></div>
                <p className="mt-1 text-[11.5px] text-muted-foreground">{tip}</p>
              </li>
            );
          })}
        </ul>
      </Panel>

      <div className="grid gap-4 sm:grid-cols-2">
        <Panel title="By subject" icon={<Sparkles className="h-4 w-4 text-sky-500" />}>
          <ul className="space-y-3">
            {s.subjects.map((x) => (
              <li key={x.k}>
                <div className="flex justify-between text-sm"><span className="font-semibold" style={{ color: SUBJ[x.k]?.color }}>{SUBJ[x.k]?.label ?? x.k}</span><span className="text-xs text-muted-foreground">{x.acc ?? "—"}% · {x.t ?? "—"}s per Q</span></div>
                <Bar pct={x.acc ?? 0} color={SUBJ[x.k]?.color} />
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="By difficulty" icon={<Target className="h-4 w-4 text-emerald-500" />}>
          <ul className="space-y-3">
            {s.diffs.filter((d) => d.n > 0).map((d) => (
              <li key={d.k}>
                <div className="flex justify-between text-sm"><span className="font-semibold capitalize">{d.k}</span><span className="text-xs text-muted-foreground">{d.acc ?? "—"}% · {d.n} Qs</span></div>
                <Bar pct={d.acc ?? 0} color={d.k === "easy" ? "#10B981" : d.k === "medium" ? "#F59E0B" : "#EF4444"} />
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Panel title="By question type" icon={<Brain className="h-4 w-4 text-violet-500" />}>
          {s.types.length === 0 ? <p className="text-sm text-muted-foreground">Solve a few more questions to see this.</p> : (
            <ul className="space-y-3">
              {s.types.map((x) => (
                <li key={x.k}>
                  <div className="flex justify-between text-sm"><span className="font-semibold">{x.k}</span><span className="text-xs text-muted-foreground">{x.acc ?? "—"}% · {x.n} Qs</span></div>
                  <Bar pct={x.acc ?? 0} color="#8B5CF6" />
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Speed vs accuracy" icon={<Clock className="h-4 w-4 text-sky-500" />}>
          {data.exactCount === 0 ? (
            <p className="text-sm text-muted-foreground">Exact time per question is recorded from today. Take a test and this chart fills in.</p>
          ) : (
            <ul className="space-y-3">
              {s.buckets.map((b) => (
                <li key={b.label}>
                  <div className="flex justify-between text-sm"><span className="font-semibold">{b.label}</span><span className="text-xs text-muted-foreground">{b.acc === null ? "—" : `${b.acc}%`} · {b.n} Qs</span></div>
                  <Bar pct={b.acc ?? 0} color="#0EA5E9" />
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {s.weak.length > 0 && (
        <Panel title="Weakest chapters" icon={<AlertTriangle className="h-4 w-4 text-rose-500" />}>
          <ul className="divide-y divide-border">
            {s.weak.map(([c, a]) => (
              <li key={c} className="flex items-center gap-3 py-2.5">
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{data.chapters.get(c) ?? "Chapter"}</span>
                <span className={cn("text-sm font-bold", a < 0.5 ? "text-rose-500" : "text-amber-500")}>{Math.round(a * 100)}%</span>
                <button type="button" onClick={() => onWeakChapter(c)} className="rounded-lg bg-secondary px-2.5 py-1 text-xs font-semibold">Fix mistakes</button>
              </li>
            ))}
          </ul>
        </Panel>
      )}
      <p className="text-center text-[11px] text-muted-foreground">Based on your tests and practice in the last 90 days.</p>
    </div>
  );
}

/* ================================================================ SHARED BITS */

function countBySubject(qs: Q[]) {
  const m: Record<string, number> = { all: qs.length };
  for (const q of qs) if (q.subject_id) m[q.subject_id] = (m[q.subject_id] ?? 0) + 1;
  return m;
}

function Toolbar({ subject, setSubject, counts, action }: { subject: string; setSubject: (s: string) => void; counts: Record<string, number>; action: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex flex-1 flex-wrap gap-1.5">
        {["all", "physics", "chemistry", "biology"].filter((k) => k === "all" || counts[k]).map((k) => (
          <button key={k} type="button" onClick={() => setSubject(k)}
            className={cn("rounded-full border px-3 py-1.5 text-xs font-semibold", subject === k ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground")}>
            {k === "all" ? "All" : SUBJ[k].label} <span className="opacity-70">{counts[k] ?? 0}</span>
          </button>
        ))}
      </div>
      {action}
    </div>
  );
}

function QuestionCard({ q, chapter, extra, fixed }: { q: Q; chapter?: string; extra?: React.ReactNode; fixed?: boolean }) {
  const [open, setOpen] = useState(false);
  const sj = SUBJ[q.subject_id ?? ""];
  return (
    <li className={cn("rounded-2xl border bg-card p-4", fixed ? "border-emerald-500/30" : "border-border")}>
      <div className="mb-1.5 flex flex-wrap items-center gap-1.5 text-[11px]">
        {sj && <span className="rounded-full px-2 py-0.5 font-semibold" style={{ background: `${sj.color}1a`, color: sj.color }}>{sj.label}</span>}
        {chapter && <span className="text-muted-foreground">{chapter}</span>}
        {q.difficulty && <span className="rounded-full bg-secondary px-2 py-0.5 capitalize text-muted-foreground">{q.difficulty.toLowerCase()}</span>}
        {fixed && <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 font-semibold text-emerald-600 dark:text-emerald-400">Fixed ✓</span>}
      </div>
      <div className={cn("text-sm leading-relaxed", !open && "line-clamp-3")}><RichText>{q.text}</RichText></div>
      {open && (
        <div className="mt-3 space-y-1.5">
          {(q.options ?? []).map((o, i) => (
            <div key={i} className={cn("flex gap-2 rounded-xl border px-3 py-2 text-sm", i === q.correct_index ? "border-emerald-500/50 bg-emerald-500/10" : "border-border")}>
              <b className="text-muted-foreground">{String.fromCharCode(65 + i)}.</b><div className="min-w-0 flex-1"><RichText>{o}</RichText></div>{i === q.correct_index && <Check className="h-4 w-4 shrink-0 text-emerald-500" />}
            </div>
          ))}
          {q.explanation && <div className="rounded-xl bg-secondary/50 p-3 text-sm"><div className="mb-1 text-xs font-bold text-muted-foreground">Solution</div><RichText>{q.explanation}</RichText></div>}
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <button type="button" onClick={() => setOpen((v) => !v)} className="inline-flex items-center gap-1 text-xs font-semibold text-primary">
          {open ? "Hide answer" : "See answer & solution"}<ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
        </button>
        {extra}
      </div>
    </li>
  );
}

function InfoCard({ icon, tint, title, text }: { icon: React.ReactNode; tint: string; title: string; text: string }) {
  return (
    <div className="flex gap-3 rounded-2xl border border-border bg-card p-4">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white" style={{ background: tint }}>{icon}</span>
      <div><div className="text-sm font-bold">{title}</div><p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">{text}</p></div>
    </div>
  );
}
function Empty({ emoji, title, text }: { emoji: string; title: string; text: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-border p-10 text-center">
      <div className="text-4xl">{emoji}</div><div className="mt-2 font-semibold">{title}</div><p className="mt-1 text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
function Panel({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return <section className="rounded-3xl border border-border bg-card p-4"><div className="mb-3 flex items-center gap-2 text-sm font-bold">{icon}{title}</div>{children}</section>;
}
function Tile({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{icon}{label}</div>
      <div className="mt-1 text-xl font-black tabular-nums">{value}</div><div className="text-[11px] text-muted-foreground">{sub}</div>
    </div>
  );
}
function Bar({ pct, color }: { pct: number; color?: string }) {
  return <div className="mt-1 h-2 rounded-full bg-secondary"><div className="h-full rounded-full transition-all" style={{ width: `${Math.max(2, pct)}%`, background: color ?? "#3B82F6" }} /></div>;
}
function IzStyles() {
  return <style>{`.btn-primary-iz{display:inline-flex;align-items:center;gap:6px;height:40px;padding:0 16px;border-radius:12px;font-size:13px;font-weight:700;color:#fff;background:linear-gradient(90deg,#10B981,#0EA5E9);box-shadow:0 8px 20px -10px rgba(16,185,129,.8)}`}</style>;
}

void Loader2;
