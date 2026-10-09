import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import type { ComponentType } from "react";
import { PageShell } from "@/components/page-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Loader2, Flame, TrendingUp, TrendingDown, Calendar, Target, ChevronLeft, ChevronRight, Home, Share2,
  Clock, CheckCircle2, Zap, Trophy, Lock, Lightbulb, AlertTriangle, Crosshair, Minus, BarChart3,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { FeatureLock } from "@/components/feature-lock";

export const Route = createFileRoute("/progress")({
  head: () => ({ meta: [{ title: "Weekly Progress — NEET Track" }] }),
  component: () => (<FeatureLock feature="weekly_progress"><ProgressPage/></FeatureLock>),
});

type Attempt = {
  correct_count: number | null;
  wrong_count: number | null;
  unattempted_count: number | null;
  submitted_at: string;
  time_taken_sec: number | null;
};
type SubjectAccuracy = { subject: string; correct: number; total: number; accuracy: number; color: string };
type FocusChapter = { id: string; name: string; subject: string; correct: number; total: number; accuracy: number };

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const GOAL_PRESETS = [20, 30, 50, 75, 100, 150];

/* ---------- date helpers (all LOCAL time, so IST students never see off-by-one days) ---------- */
function startOfWeek(base: Date = new Date()) {
  const d = new Date(base); const day = d.getDay() || 7; d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - (day - 1)); return d;
}
const pad = (n: number) => String(n).padStart(2, "0");
const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const qCount = (a: Attempt) => (a.correct_count ?? 0) + (a.wrong_count ?? 0);
function fmtDuration(sec: number) {
  if (sec <= 0) return "0m";
  const h = Math.floor(sec / 3600); const m = Math.round((sec % 3600) / 60);
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function ProgressPage() {
  const { user, profile, loading, refresh } = useAuth();
  const nav = useNavigate();
  const [attempts, setAttempts] = useState<Attempt[] | null>(null);
  const [weekOffset, setWeekOffset] = useState(0); // 0 = current week
  const [goalOpen, setGoalOpen] = useState(false);
  const goal = (profile as unknown as { daily_goal?: number } | null)?.daily_goal ?? 20;
  const [goalDraft, setGoalDraft] = useState<number>(goal);
  const [subjectAcc, setSubjectAcc] = useState<SubjectAccuracy[] | null>(null);
  const [focus, setFocus] = useState<FocusChapter[] | null>(null);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  useEffect(() => { if (!loading && !user) nav({ to: "/login" }); }, [user, loading, nav]);

  useEffect(() => {
    if (!user) return;
    // last ~100 days: enough for the 12-week heatmap, 8-week trend and streaks
    const since = new Date(); since.setDate(since.getDate() - 100); since.setHours(0, 0, 0, 0);
    supabase.from("attempts").select("correct_count,wrong_count,unattempted_count,submitted_at,time_taken_sec")
      .eq("user_id", user.id).eq("status", "completed").gte("submitted_at", since.toISOString())
      .then(({ data }) => setAttempts((data ?? []) as Attempt[]));
  }, [user]);

  // Subject-wise accuracy + weakest chapters for the selected week (attempts → questions)
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const ws = startOfWeek(); ws.setDate(ws.getDate() + weekOffset * 7);
      const we = new Date(ws); we.setDate(we.getDate() + 7);

      // Always start from the full subject list so all NEET subjects render.
      const { data: allSubs } = await supabase.from("subjects").select("id,name,color").order("name");
      type SubRow = { id: string; name: string; color: string | null };
      const subjectsList = (allSubs ?? []) as SubRow[];
      const palette: Record<string, string> = { Physics: "#0ea5e9", Chemistry: "#f97316", Botany: "#84cc16", Zoology: "#10b981" };
      const baseBuckets = new Map<string, { correct: number; total: number; color: string }>();
      subjectsList.forEach((s) => {
        baseBuckets.set(s.name, { correct: 0, total: 0, color: s.color ?? palette[s.name] ?? "#6366f1" });
      });

      const { data: rows } = await supabase
        .from("attempts")
        .select("answers, test_id, tests(question_ids)")
        .eq("user_id", user.id).eq("status", "completed")
        .gte("submitted_at", ws.toISOString()).lt("submitted_at", we.toISOString());

      const all = (rows ?? []) as Array<{ answers: Record<string, number> | null; tests: { question_ids: string[] | null } | null }>;
      const qIds = Array.from(new Set(all.flatMap((r) => Object.keys(r.answers ?? {}))));
      const chapterBuckets = new Map<string, { correct: number; total: number; subject: string }>();

      if (qIds.length > 0) {
        const { data: qs } = await supabase
          .from("questions")
          .select("id, correct_index, subject_id, chapter_id, subjects(name, color)")
          .in("id", qIds);
        type Q = { id: string; correct_index: number; subject_id: string | null; chapter_id: string | null; subjects: { name: string; color: string | null } | null };
        const qmap = new Map<string, Q>(((qs ?? []) as unknown as Q[]).map((q) => [q.id, q]));

        for (const r of all) {
          for (const [qid, picked] of Object.entries(r.answers ?? {})) {
            const q = qmap.get(qid);
            if (!q || !q.subjects) continue;
            const name = q.subjects.name;
            const ok = picked === q.correct_index;
            const b = baseBuckets.get(name) ?? { correct: 0, total: 0, color: q.subjects.color ?? palette[name] ?? "#6366f1" };
            b.total++; if (ok) b.correct++;
            baseBuckets.set(name, b);
            if (q.chapter_id != null) {
              const cid = String(q.chapter_id);
              const cb = chapterBuckets.get(cid) ?? { correct: 0, total: 0, subject: name };
              cb.total++; if (ok) cb.correct++;
              chapterBuckets.set(cid, cb);
            }
          }
        }
      }

      const out: SubjectAccuracy[] = Array.from(baseBuckets.entries()).map(([subject, v]) => ({
        subject, correct: v.correct, total: v.total,
        accuracy: v.total ? Math.round((v.correct / v.total) * 100) : 0, color: v.color,
      }));
      const order = ["Physics", "Chemistry", "Botany", "Zoology"];
      out.sort((a, b) => {
        const ai = order.indexOf(a.subject); const bi = order.indexOf(b.subject);
        if (ai !== -1 && bi !== -1) return ai - bi;
        if (ai !== -1) return -1;
        if (bi !== -1) return 1;
        return b.total - a.total;
      });

      // weakest chapters: at least 3 questions attempted, lowest accuracy first
      const weak = Array.from(chapterBuckets.entries())
        .filter(([, v]) => v.total >= 3)
        .map(([id, v]) => ({ id, subject: v.subject, correct: v.correct, total: v.total, accuracy: Math.round((v.correct / v.total) * 100) }))
        .filter((c) => c.accuracy < 75)
        .sort((a, b) => a.accuracy - b.accuracy || b.total - a.total)
        .slice(0, 4);
      let focusRows: FocusChapter[] = [];
      if (weak.length) {
        const { data: chs } = await supabase.from("chapters").select("id,name").in("id", weak.map((w) => w.id));
        const nameOf = new Map(((chs ?? []) as unknown as Array<{ id: string | number; name: string }>).map((c) => [String(c.id), c.name]));
        focusRows = weak.map((w) => ({ ...w, name: nameOf.get(w.id) ?? "Chapter" }));
      }
      if (cancelled) return;
      setSubjectAcc(out);
      setFocus(focusRows);
    })();
    return () => { cancelled = true; };
  }, [user, weekOffset]);

  const weekStart = useMemo(() => { const w = startOfWeek(); w.setDate(w.getDate() + weekOffset * 7); return w; }, [weekOffset]);
  const weekEnd = useMemo(() => { const e = new Date(weekStart); e.setDate(e.getDate() + 7); return e; }, [weekStart]);
  const prevStart = useMemo(() => { const p = new Date(weekStart); p.setDate(p.getDate() - 7); return p; }, [weekStart]);

  const inRange = (a: Attempt, s: Date, e: Date) => { const d = new Date(a.submitted_at); return d >= s && d < e; };
  const weekAttempts = useMemo(() => (attempts ?? []).filter((a) => inRange(a, weekStart, weekEnd)), [attempts, weekStart, weekEnd]);
  const prevAttempts = useMemo(() => (attempts ?? []).filter((a) => inRange(a, prevStart, weekStart)), [attempts, prevStart, weekStart]);

  const sumStats = (list: Attempt[]) => {
    const correct = list.reduce((s, a) => s + (a.correct_count ?? 0), 0);
    const wrong = list.reduce((s, a) => s + (a.wrong_count ?? 0), 0);
    const total = correct + wrong;
    return { correct, wrong, total, accuracy: total ? Math.round((correct / total) * 100) : 0, seconds: list.reduce((s, a) => s + (a.time_taken_sec ?? 0), 0), tests: list.length };
  };
  const cur = useMemo(() => sumStats(weekAttempts), [weekAttempts]);
  const prev = useMemo(() => sumStats(prevAttempts), [prevAttempts]);
  const weekTarget = goal * 7;

  // per-day counts for the selected week
  const perDay = useMemo(() => DAY_LABELS.map((label, i) => {
    const day = new Date(weekStart); day.setDate(day.getDate() + i);
    const next = new Date(day); next.setDate(day.getDate() + 1);
    const count = (attempts ?? []).filter((a) => inRange(a, day, next)).reduce((s, a) => s + qCount(a), 0);
    return { label, dayNum: day.getDate(), count, date: day };
  }), [attempts, weekStart]);

  const todayKey = dayKey(new Date());
  const todayCount = useMemo(() => (attempts ?? []).filter((a) => dayKey(new Date(a.submitted_at)) === todayKey).reduce((s, a) => s + qCount(a), 0), [attempts, todayKey]);

  // streaks: current streak keeps counting from yesterday if you haven't studied yet today
  const { streak, bestStreak, streakAtRisk } = useMemo(() => {
    const set = new Set((attempts ?? []).map((a) => dayKey(new Date(a.submitted_at))));
    const c = new Date(); c.setHours(0, 0, 0, 0);
    const studiedToday = set.has(dayKey(c));
    if (!studiedToday) c.setDate(c.getDate() - 1);
    let s = 0;
    while (set.has(dayKey(c))) { s++; c.setDate(c.getDate() - 1); }
    // best streak within the loaded window
    const days = Array.from(set).sort();
    let best = 0, run = 0, last: Date | null = null;
    for (const k of days) {
      const [y, m, d] = k.split("-").map(Number); const dt = new Date(y, m - 1, d);
      run = last && Math.round((dt.getTime() - last.getTime()) / 86400000) === 1 ? run + 1 : 1;
      best = Math.max(best, run); last = dt;
    }
    return { streak: s, bestStreak: Math.max(best, s), streakAtRisk: s > 0 && !studiedToday };
  }, [attempts]);

  // goal tracking (only meaningful for the current week)
  const isCurrentWeek = weekOffset === 0;
  const dayIdx = isCurrentWeek ? ((new Date().getDay() || 7) - 1) : 6; // 0..6
  const daysElapsed = dayIdx + 1;
  const expectedByNow = goal * daysElapsed;
  const goalPct = Math.min(100, Math.round((cur.total / Math.max(1, weekTarget)) * 100));
  const daysLeftInclToday = isCurrentWeek ? 7 - dayIdx : 0;
  const remaining = Math.max(0, weekTarget - cur.total);
  const neededPerDay = daysLeftInclToday > 0 ? Math.ceil(remaining / daysLeftInclToday) : 0;
  const daysGoalHit = perDay.filter((d) => d.count >= goal).length;
  const activeDays = perDay.filter((d) => d.count > 0).length;
  const status: { label: string; tone: "good" | "warn" | "bad" | "idle" } =
    cur.total >= weekTarget ? { label: "Weekly goal achieved", tone: "good" }
    : !isCurrentWeek ? (cur.total === 0 ? { label: "No activity", tone: "idle" } : { label: `${goalPct}% of goal`, tone: "warn" })
    : cur.total >= expectedByNow ? { label: "On track", tone: "good" }
    : cur.total >= expectedByNow * 0.6 ? { label: `${expectedByNow - cur.total} behind pace`, tone: "warn" }
    : { label: `${expectedByNow - cur.total} behind pace`, tone: "bad" };
  const projected = isCurrentWeek && cur.total > 0 ? Math.round((cur.total / daysElapsed) * 7) : cur.total;

  // 8-week trend
  const trend = useMemo(() => {
    const thisMon = startOfWeek();
    return Array.from({ length: 8 }, (_, i) => {
      const s = new Date(thisMon); s.setDate(s.getDate() - (7 - i) * 7);
      const e = new Date(s); e.setDate(e.getDate() + 7);
      const st = sumStats((attempts ?? []).filter((a) => inRange(a, s, e)));
      return { label: `${s.getDate()} ${s.toLocaleString("en", { month: "short" })}`, total: st.total, accuracy: st.accuracy };
    });
  }, [attempts]);

  // heatmap (12 weeks, Monday-aligned) + summary
  const heat = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const start = new Date(today); start.setDate(start.getDate() - 83);
    const startDow = start.getDay() || 7; start.setDate(start.getDate() - (startDow - 1));
    const counts: Record<string, number> = {};
    (attempts ?? []).forEach((a) => { const k = dayKey(new Date(a.submitted_at)); counts[k] = (counts[k] ?? 0) + qCount(a); });
    const weeks: { date: Date; count: number; future: boolean }[][] = [];
    const cursor = new Date(start);
    while (cursor <= today) {
      const w: { date: Date; count: number; future: boolean }[] = [];
      for (let d = 0; d < 7; d++) {
        w.push({ date: new Date(cursor), count: counts[dayKey(cursor)] ?? 0, future: cursor > today });
        cursor.setDate(cursor.getDate() + 1);
      }
      weeks.push(w);
    }
    const flat = weeks.flat().filter((c) => !c.future);
    const active = flat.filter((c) => c.count > 0).length;
    const total = flat.reduce((s, c) => s + c.count, 0);
    const best = flat.reduce((m, c) => (c.count > m.count ? c : m), { date: today, count: 0, future: false });
    const monthLabels = weeks.map((w, i) => {
      const m = w[0].date.getMonth();
      return i === 0 || weeks[i - 1][0].date.getMonth() !== m ? w[0].date.toLocaleString("en", { month: "short" }) : "";
    });
    return { weeks, active, total, best, monthLabels, span: flat.length };
  }, [attempts]);

  const heatColor = (c: number, future: boolean) => {
    if (future) return "bg-transparent";
    if (c <= 0) return "bg-secondary/70";
    if (c < goal * 0.25) return "bg-primary/25";
    if (c < goal * 0.5) return "bg-primary/45";
    if (c < goal) return "bg-primary/70";
    return "bg-primary shadow-[0_0_8px_-1px] shadow-primary/60";
  };

  // milestones / badges
  const badges = useMemo(() => {
    const maxWeekQ = Math.max(0, ...trend.map((t) => t.total));
    const hasAccWeek = trend.some((t) => t.total >= 50 && t.accuracy >= 80);
    const total100d = (attempts ?? []).reduce((s, a) => s + qCount(a), 0);
    return [
      { id: "s3", title: "3-Day Streak", desc: "Practice 3 days in a row", icon: Flame, progress: Math.min(1, bestStreak / 3), earned: bestStreak >= 3 },
      { id: "s7", title: "7-Day Streak", desc: "A full week without a break", icon: Flame, progress: Math.min(1, bestStreak / 7), earned: bestStreak >= 7 },
      { id: "s30", title: "30-Day Streak", desc: "Make practice a habit", icon: Trophy, progress: Math.min(1, bestStreak / 30), earned: bestStreak >= 30 },
      { id: "q300", title: "300 in a Week", desc: "Attempt 300 questions in one week", icon: Zap, progress: Math.min(1, maxWeekQ / 300), earned: maxWeekQ >= 300 },
      { id: "acc", title: "Sharp Shooter", desc: "80%+ accuracy over 50+ questions in a week", icon: Crosshair, progress: hasAccWeek ? 1 : Math.min(0.99, Math.max(0, ...trend.filter((t) => t.total >= 50).map((t) => t.accuracy / 80), 0)), earned: hasAccWeek },
      { id: "q1k", title: "1,000 Club", desc: "1,000 questions in the last 100 days", icon: Target, progress: Math.min(1, total100d / 1000), earned: total100d >= 1000 },
    ];
  }, [trend, bestStreak, attempts]);

  // insights
  const insights = useMemo(() => {
    const out: { icon: ComponentType<{ className?: string }>; tone: "good" | "warn" | "info"; text: string }[] = [];
    if (cur.total === 0) {
      out.push({ icon: Lightbulb, tone: "info", text: isCurrentWeek ? `Start with just ${Math.min(goal, 20)} questions today — small, steady practice beats weekend cramming.` : "No practice recorded this week." });
      return out;
    }
    if (prev.total > 0) {
      const d = cur.accuracy - prev.accuracy;
      if (d >= 3) out.push({ icon: TrendingUp, tone: "good", text: `Accuracy is up ${d} points vs last week (${prev.accuracy}% → ${cur.accuracy}%). Your revision is working.` });
      else if (d <= -3) out.push({ icon: AlertTriangle, tone: "warn", text: `Accuracy dipped ${Math.abs(d)} points vs last week. Revisit the weak chapters below before adding new volume.` });
    }
    const bestDay = perDay.reduce((m, d) => (d.count > m.count ? d : m), perDay[0]);
    if (bestDay.count > 0) out.push({ icon: Zap, tone: "info", text: `${bestDay.label} was your strongest day with ${bestDay.count} questions.` });
    if (activeDays > 0) out.push({ icon: Calendar, tone: activeDays >= 5 ? "good" : "info", text: `You practised on ${activeDays} of ${isCurrentWeek ? daysElapsed : 7} days${daysGoalHit ? `, hitting your daily goal ${daysGoalHit} time${daysGoalHit > 1 ? "s" : ""}` : ""}.` });
    if (cur.total > 0 && cur.accuracy < 60 && cur.total >= 30) out.push({ icon: AlertTriangle, tone: "warn", text: "Below 60% accuracy: slow down, read explanations and move wrong answers into revision." });
    if (isCurrentWeek && streakAtRisk) out.push({ icon: Flame, tone: "warn", text: `Your ${streak}-day streak is at risk — answer a few questions today to keep it alive.` });
    return out.slice(0, 4);
  }, [cur, prev, perDay, activeDays, daysGoalHit, isCurrentWeek, daysElapsed, goal, streak, streakAtRisk]);

  const strongest = useMemo(() => (subjectAcc ?? []).filter((s) => s.total >= 5).sort((a, b) => b.accuracy - a.accuracy)[0], [subjectAcc]);
  const weakest = useMemo(() => (subjectAcc ?? []).filter((s) => s.total >= 5).sort((a, b) => a.accuracy - b.accuracy)[0], [subjectAcc]);

  const lastDayOfWeek = new Date(weekEnd.getTime() - 1);
  const rangeLabel = weekStart.getMonth() === lastDayOfWeek.getMonth()
    ? `${weekStart.getDate()} – ${lastDayOfWeek.getDate()} ${weekStart.toLocaleString("en", { month: "short", year: "numeric" })}`
    : `${weekStart.getDate()} ${weekStart.toLocaleString("en", { month: "short" })} – ${lastDayOfWeek.getDate()} ${lastDayOfWeek.toLocaleString("en", { month: "short", year: "numeric" })}`;
  const weekTitle = weekOffset === 0 ? "This week" : weekOffset === -1 ? "Last week" : `${-weekOffset} weeks ago`;

  const firstName = (profile?.full_name ?? user?.email ?? "Student").split(/[\s@]/)[0];
  const heroLine =
    !isCurrentWeek ? `Week in review · ${rangeLabel}`
    : streak >= 7 ? `${streak}-day streak — you're on fire. Keep it alive!`
    : todayCount >= goal ? "Daily goal crushed today. Great discipline!"
    : todayCount > 0 ? `${goal - todayCount} more questions to hit today's goal.`
    : `Answer ${goal} questions today to ${streak > 0 ? "extend your streak" : "start a streak"}.`;

  const saveGoal = async () => {
    if (!user) return;
    const v = Math.max(1, Math.min(500, Math.round(goalDraft) || 1));
    setGoalOpen(false);
    const { error } = await supabase.from("profiles").update({ daily_goal: v }).eq("id", user.id);
    if (error) return toast.error(error.message);
    await refresh();
    toast.success(`Daily goal updated to ${v} questions`);
  };

  const shareReport = async () => {
    const text = `📊 My NEET Track weekly report (${rangeLabel})\n` +
      `• ${cur.total} questions · ${cur.accuracy}% accuracy\n` +
      `• ${streak}-day streak 🔥 · ${activeDays} active days\n` +
      `• Weekly goal: ${cur.total}/${weekTarget} (${goalPct}%)\nneettrack.com`;
    try {
      if (typeof navigator !== "undefined" && navigator.share) await navigator.share({ title: "My NEET Track report", text });
      else { await navigator.clipboard.writeText(text); toast.success("Report copied — paste it anywhere"); }
    } catch { /* user cancelled share */ }
  };

  const delta = (c: number, p: number, suffix = "") => {
    if (prev.total === 0 && p === 0) return null;
    const d = c - p;
    return { d, text: `${d > 0 ? "+" : ""}${d}${suffix}` };
  };
  const qDelta = delta(cur.total, prev.total);
  const aDelta = prev.total > 0 && cur.total > 0 ? delta(cur.accuracy, prev.accuracy, " pts") : null;
  const tDelta = delta(Math.round(cur.seconds / 60), Math.round(prev.seconds / 60), "m");

  return (
    <PageShell>
      <div className="mx-auto max-w-3xl">
        {/* Header bar */}
        <div className="-mt-2 mb-4 flex items-center justify-between">
          <button onClick={() => history.back()} className="inline-flex items-center gap-1.5 text-sm font-semibold hover:text-primary">
            <ChevronLeft className="h-5 w-5" /> Weekly Progress Report
          </button>
          <div className="flex items-center gap-1">
            <button onClick={shareReport} aria-label="Share report" className="rounded-full p-2 text-muted-foreground transition hover:bg-primary/10 hover:text-primary"><Share2 className="h-[18px] w-[18px]" /></button>
            <Link to="/dashboard" aria-label="Dashboard" className="rounded-full p-2 text-primary hover:bg-primary/10"><Home className="h-[18px] w-[18px]" /></Link>
          </div>
        </div>

        {attempts === null ? <ProgressSkeleton /> : (
          <div className="space-y-6">
            {/* HERO */}
            <div className="relative overflow-hidden rounded-3xl border border-border bg-card p-4 shadow-sm sm:p-5">
              <div aria-hidden className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-primary/15 blur-3xl" />
              <div aria-hidden className="pointer-events-none absolute -bottom-24 -left-10 h-48 w-48 rounded-full bg-emerald-500/10 blur-3xl" />
              <div className="relative flex items-center gap-3.5">
                <div className="relative">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-primary text-xl font-extrabold text-primary-foreground shadow-md">
                    {firstName.slice(0, 1).toUpperCase()}
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-card bg-emerald-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-base font-bold leading-tight">{profile?.full_name ?? user?.email}</div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 font-semibold text-primary">NEET {(profile as unknown as { target_year?: number } | null)?.target_year ?? 2027}</span>
                    <span className="inline-flex items-center gap-1"><Flame className={cn("h-3.5 w-3.5", streak > 0 ? "text-orange-500" : "text-muted-foreground")} />{streak} day streak</span>
                  </div>
                </div>
              </div>
              <p className="relative mt-3.5 rounded-xl bg-secondary/60 px-3 py-2 text-[13px] font-medium text-foreground/90">{heroLine}</p>
            </div>

            {/* WEEK SWITCHER */}
            <div className="flex items-center justify-between rounded-2xl border border-border bg-card px-2 py-1.5">
              <button onClick={() => { setWeekOffset((o) => o - 1); setSelectedDay(null); }} aria-label="Previous week" className="rounded-xl p-2 hover:bg-secondary"><ChevronLeft className="h-4 w-4" /></button>
              <div className="text-center">
                <div className="text-sm font-bold leading-tight">{weekTitle}</div>
                <div className="text-[11px] text-muted-foreground">{rangeLabel}</div>
              </div>
              <button onClick={() => { setWeekOffset((o) => Math.min(0, o + 1)); setSelectedDay(null); }} disabled={weekOffset >= 0} aria-label="Next week" className="rounded-xl p-2 hover:bg-secondary disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button>
            </div>

            {/* KPI GRID */}
            <div className="grid grid-cols-2 gap-3">
              <Kpi icon={CheckCircle2} label="Questions" value={String(cur.total)} sub={`${cur.correct} correct · ${cur.wrong} wrong`} delta={qDelta} tone="primary" />
              <Kpi icon={Target} label="Accuracy" value={`${cur.accuracy}%`} sub={cur.total ? (cur.accuracy >= 75 ? "Excellent" : cur.accuracy >= 55 ? "Getting there" : "Needs revision") : "No attempts yet"} delta={aDelta} tone="emerald" />
              <Kpi icon={Clock} label="Study time" value={fmtDuration(cur.seconds)} sub={`${cur.tests} test${cur.tests === 1 ? "" : "s"} completed`} delta={prev.seconds || cur.seconds ? tDelta : null} tone="violet" />
              <Kpi icon={Flame} label="Best streak" value={`${bestStreak}d`} sub={streakAtRisk ? "Streak at risk today" : `Current: ${streak} day${streak === 1 ? "" : "s"}`} delta={null} tone="orange" warn={streakAtRisk} />
            </div>

            {/* WEEKLY GOAL */}
            <Section icon={TrendingUp} title={isCurrentWeek ? "This Week's Goal" : "Weekly Goal"} action={<Button size="sm" variant="ghost" className="h-7 rounded-full text-xs text-primary hover:bg-primary/10" onClick={() => { setGoalDraft(goal); setGoalOpen(true); }}>Update Daily Goal</Button>}>
              <Card className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <GoalRing pct={goalPct} value={cur.total} done={cur.total >= weekTarget} />
                    <div className="min-w-0 flex-1">
                      <div className="text-lg font-extrabold leading-tight tabular-nums">{cur.total} <span className="text-sm font-semibold text-muted-foreground">/ {weekTarget} questions</span></div>
                      <StatusChip tone={status.tone} label={status.label} />
                      <div className="mt-2 text-xs text-muted-foreground">
                        {cur.total >= weekTarget ? "Fantastic — you've beaten your weekly target. Raise the bar?" :
                          isCurrentWeek ? `${remaining} to go · about ${neededPerDay}/day for the remaining ${daysLeftInclToday} day${daysLeftInclToday === 1 ? "" : "s"}` : `${remaining} short of the target`}
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-3 divide-x divide-border rounded-xl bg-secondary/50 py-2.5 text-center">
                    <MiniStat label="Daily goal" value={String(goal)} />
                    <MiniStat label="Goal days" value={`${daysGoalHit}/7`} />
                    <MiniStat label={isCurrentWeek ? "Projected" : "Final"} value={String(projected)} />
                  </div>
                </CardContent>
              </Card>
            </Section>

            {/* DAILY ACTIVITY */}
            <Section icon={Calendar} title="Daily Activity" aside={`Goal ${goal}/day`}>
              <Card>
                <CardContent className="p-4">
                  <DayBars perDay={perDay} goal={goal} selected={selectedDay} onSelect={setSelectedDay} isCurrentWeek={isCurrentWeek} />
                </CardContent>
              </Card>
            </Section>

            {/* INSIGHTS */}
            {insights.length > 0 && (
              <Section icon={Lightbulb} title="Smart Insights">
                <div className="space-y-2">
                  {insights.map((it, i) => (
                    <div key={i} className={cn("flex items-start gap-3 rounded-2xl border p-3 text-[13px] leading-snug",
                      it.tone === "good" ? "border-emerald-500/25 bg-emerald-500/[0.07]" : it.tone === "warn" ? "border-amber-500/30 bg-amber-500/[0.08]" : "border-border bg-card")}>
                      <span className={cn("mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
                        it.tone === "good" ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : it.tone === "warn" ? "bg-amber-500/15 text-amber-600 dark:text-amber-400" : "bg-primary/10 text-primary")}>
                        <it.icon className="h-4 w-4" />
                      </span>
                      <span className="pt-0.5 text-foreground/90">{it.text}</span>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* SUBJECT ACCURACY */}
            <Section icon={BarChart3} title="Subject-wise Accuracy" aside={weekTitle}>
              <Card>
                <CardContent className="p-4">
                  {subjectAcc === null ? (
                    <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-primary" /></div>
                  ) : (
                    <>
                      <div className="space-y-3.5">
                        {subjectAcc.map((s) => {
                          const none = s.total === 0;
                          const badge = none ? null : s.accuracy >= 75 ? { t: "Strong", c: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" } : s.accuracy >= 50 ? { t: "Average", c: "bg-amber-500/15 text-amber-600 dark:text-amber-400" } : { t: "Weak", c: "bg-rose-500/15 text-rose-600 dark:text-rose-400" };
                          return (
                            <div key={s.subject} className={none ? "opacity-60" : ""}>
                              <div className="flex items-center justify-between text-xs">
                                <div className="flex items-center gap-2">
                                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
                                  <span className="font-semibold">{s.subject}</span>
                                  <span className="text-muted-foreground">({s.correct}/{s.total})</span>
                                  {badge && <span className={cn("rounded-full px-1.5 py-px text-[10px] font-bold", badge.c)}>{badge.t}</span>}
                                </div>
                                <span className="font-bold tabular-nums">{none ? "—" : `${s.accuracy}%`}</span>
                              </div>
                              <div className="relative mt-1.5 h-2 w-full overflow-hidden rounded-full bg-secondary">
                                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${s.accuracy}%`, background: s.color }} />
                                <span aria-hidden className="absolute inset-y-0 w-px bg-foreground/30" style={{ left: "75%" }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {subjectAcc.every((s) => s.total === 0) ? (
                        <div className="mt-3 rounded-xl bg-secondary/50 px-3 py-2.5 text-center text-[11px] text-muted-foreground">No attempts {isCurrentWeek ? "yet this week" : "that week"} — finish a quiz to see your subject accuracy.</div>
                      ) : (
                        <div className="mt-4 grid grid-cols-2 gap-2 text-[11px]">
                          {strongest && <div className="rounded-xl bg-emerald-500/[0.08] px-3 py-2"><div className="text-muted-foreground">Strongest</div><div className="font-bold">{strongest.subject} · {strongest.accuracy}%</div></div>}
                          {weakest && weakest.subject !== strongest?.subject && <div className="rounded-xl bg-rose-500/[0.08] px-3 py-2"><div className="text-muted-foreground">Needs attention</div><div className="font-bold">{weakest.subject} · {weakest.accuracy}%</div></div>}
                        </div>
                      )}
                      <div className="mt-3 text-[10px] text-muted-foreground">Vertical line marks the 75% target.</div>
                    </>
                  )}
                </CardContent>
              </Card>
            </Section>

            {/* FOCUS CHAPTERS */}
            {focus && focus.length > 0 && (
              <Section icon={Crosshair} title="Focus Chapters" aside="Lowest accuracy">
                <Card>
                  <CardContent className="divide-y divide-border p-0">
                    {focus.map((c) => (
                      <div key={c.id} className="flex items-center gap-3 px-4 py-3">
                        <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-extrabold tabular-nums",
                          c.accuracy < 50 ? "bg-rose-500/15 text-rose-600 dark:text-rose-400" : "bg-amber-500/15 text-amber-600 dark:text-amber-400")}>{c.accuracy}%</div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold">{c.name}</div>
                          <div className="text-[11px] text-muted-foreground">{c.subject} · {c.correct}/{c.total} correct</div>
                        </div>
                      </div>
                    ))}
                    <div className="grid grid-cols-2 gap-2 p-3">
                      <Button asChild variant="outline" size="sm" className="rounded-xl"><Link to="/mistakes">Review mistakes</Link></Button>
                      <Button asChild size="sm" className="rounded-xl bg-gradient-primary"><Link to="/dpp">Practice now</Link></Button>
                    </div>
                  </CardContent>
                </Card>
              </Section>
            )}

            {/* 8 WEEK TREND */}
            <Section icon={TrendingUp} title="8-Week Trend" aside="Volume & accuracy">
              <Card>
                <CardContent className="p-4">
                  {trend.every((t) => t.total === 0) ? (
                    <div className="py-6 text-center text-xs text-muted-foreground">Your weekly trend appears here after you complete a few quizzes.</div>
                  ) : <TrendChart data={trend} />}
                </CardContent>
              </Card>
            </Section>

            {/* HEATMAP */}
            <Section icon={Flame} title="Consistency Heatmap" aside="Last 12 weeks">
              <Card>
                <CardContent className="p-4">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <MiniCard label="Active days" value={`${heat.active}/${heat.span}`} />
                    <MiniCard label="Questions" value={heat.total.toLocaleString()} />
                    <MiniCard label="Best day" value={String(heat.best.count)} />
                  </div>
                  <div className="mt-4 flex gap-1.5 overflow-x-auto pb-1">
                    <div className="flex flex-col gap-1 pt-[18px] text-[9px] font-medium text-muted-foreground">
                      {DAY_LABELS.map((d, i) => <div key={d} className="flex h-3.5 items-center">{i % 2 === 0 ? d : ""}</div>)}
                    </div>
                    {heat.weeks.map((week, wi) => (
                      <div key={wi} className="flex flex-col gap-1">
                        <div className="h-3.5 text-[9px] font-medium leading-[14px] text-muted-foreground">{heat.monthLabels[wi]}</div>
                        {week.map((cell, di) => (
                          <div key={di}
                            title={cell.future ? "" : `${cell.date.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} · ${cell.count} questions`}
                            className={cn("h-3.5 w-3.5 rounded-[4px] transition", heatColor(cell.count, cell.future), dayKey(cell.date) === todayKey && "ring-1 ring-foreground/50")} />
                        ))}
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex items-center justify-end gap-1.5 text-[10px] text-muted-foreground">
                    Less
                    <span className="h-2.5 w-2.5 rounded-[3px] bg-secondary/70" />
                    <span className="h-2.5 w-2.5 rounded-[3px] bg-primary/25" />
                    <span className="h-2.5 w-2.5 rounded-[3px] bg-primary/45" />
                    <span className="h-2.5 w-2.5 rounded-[3px] bg-primary/70" />
                    <span className="h-2.5 w-2.5 rounded-[3px] bg-primary" />
                    More
                  </div>
                </CardContent>
              </Card>
            </Section>

            {/* MILESTONES */}
            <Section icon={Trophy} title="Milestones" aside={`${badges.filter((b) => b.earned).length}/${badges.length} unlocked`}>
              <div className="grid grid-cols-2 gap-3">
                {badges.map((b) => (
                  <div key={b.id} className={cn("relative overflow-hidden rounded-2xl border p-3", b.earned ? "border-amber-500/40 bg-gradient-to-br from-amber-500/15 to-transparent" : "border-border bg-card")}>
                    <div className="flex items-center gap-2.5">
                      <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", b.earned ? "bg-amber-500/20 text-amber-600 dark:text-amber-400" : "bg-secondary text-muted-foreground")}>
                        {b.earned ? <b.icon className="h-[18px] w-[18px]" /> : <Lock className="h-4 w-4" />}
                      </span>
                      <div className="min-w-0">
                        <div className="truncate text-[13px] font-bold leading-tight">{b.title}</div>
                        <div className="text-[10px] leading-tight text-muted-foreground">{b.desc}</div>
                      </div>
                    </div>
                    <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                      <div className={cn("h-full rounded-full transition-all duration-700", b.earned ? "bg-amber-500" : "bg-primary/70")} style={{ width: `${Math.round(b.progress * 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </Section>

            <Button onClick={shareReport} variant="outline" className="w-full rounded-2xl"><Share2 className="mr-2 h-4 w-4" /> Share this week's report</Button>
          </div>
        )}
      </div>

      <Dialog open={goalOpen} onOpenChange={setGoalOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Update daily goal</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">How many questions do you want to attempt each day?</p>
            <div className="flex flex-wrap gap-2">
              {GOAL_PRESETS.map((p) => (
                <button key={p} onClick={() => setGoalDraft(p)} className={cn("rounded-full border px-3.5 py-1.5 text-sm font-semibold transition", goalDraft === p ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary/50")}>{p}</button>
              ))}
            </div>
            <Input type="number" min={1} max={500} value={goalDraft} onChange={(e) => setGoalDraft(+e.target.value)} />
            <div className="rounded-xl bg-secondary/60 px-3 py-2 text-xs text-muted-foreground">
              Weekly target: <b className="text-foreground">{Math.max(1, Math.min(500, Math.round(goalDraft) || 1)) * 7}</b> questions · ≈ <b className="text-foreground">{Math.round(Math.max(1, Math.min(500, goalDraft || 1)) * 7 * 0.7)}</b> expected at 70% accuracy to be correct
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setGoalOpen(false)}>Cancel</Button>
            <Button onClick={saveGoal} className="bg-gradient-primary">Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}

/* ------------------------------ presentational pieces ------------------------------ */

function Section({ icon: Icon, title, aside, action, children }: { icon: ComponentType<{ className?: string }>; title: string; aside?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-2.5 flex items-center gap-2 px-0.5">
        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary/10"><Icon className="h-3.5 w-3.5 text-primary" /></span>
        <h2 className="text-sm font-bold">{title}</h2>
        {aside && <span className="ml-auto text-[10px] font-medium text-muted-foreground">{aside}</span>}
        {action && <span className="ml-auto">{action}</span>}
      </div>
      {children}
    </section>
  );
}

const TONES = {
  primary: { text: "text-primary", bg: "bg-primary/12", bar: "from-primary" },
  emerald: { text: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/12", bar: "from-emerald-500" },
  violet: { text: "text-violet-600 dark:text-violet-400", bg: "bg-violet-500/12", bar: "from-violet-500" },
  orange: { text: "text-orange-600 dark:text-orange-400", bg: "bg-orange-500/12", bar: "from-orange-500" },
} as const;

function Kpi({ icon: Icon, label, value, sub, delta, tone, warn }: { icon: ComponentType<{ className?: string }>; label: string; value: string; sub: string; delta: { d: number; text: string } | null; tone: keyof typeof TONES; warn?: boolean }) {
  const t = TONES[tone];
  return (
    <Card className="relative overflow-hidden">
      <div aria-hidden className={cn("absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r to-transparent", t.bar)} />
      <CardContent className="p-3.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
          <span className={cn("flex h-7 w-7 items-center justify-center rounded-lg", t.bg)}><Icon className={cn("h-4 w-4", t.text)} /></span>
        </div>
        <div className="mt-1.5 flex items-baseline gap-2">
          <span className="text-2xl font-extrabold leading-none tabular-nums">{value}</span>
          {delta && (
            <span className={cn("inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold",
              delta.d > 0 ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : delta.d < 0 ? "bg-rose-500/15 text-rose-600 dark:text-rose-400" : "bg-secondary text-muted-foreground")}>
              {delta.d > 0 ? <TrendingUp className="h-2.5 w-2.5" /> : delta.d < 0 ? <TrendingDown className="h-2.5 w-2.5" /> : <Minus className="h-2.5 w-2.5" />}
              {delta.text}
            </span>
          )}
        </div>
        <div className={cn("mt-1.5 text-[11px]", warn ? "font-semibold text-amber-600 dark:text-amber-400" : "text-muted-foreground")}>{sub}</div>
      </CardContent>
    </Card>
  );
}

function StatusChip({ tone, label }: { tone: "good" | "warn" | "bad" | "idle"; label: string }) {
  const c = tone === "good" ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : tone === "warn" ? "bg-amber-500/15 text-amber-600 dark:text-amber-400" : tone === "bad" ? "bg-rose-500/15 text-rose-600 dark:text-rose-400" : "bg-secondary text-muted-foreground";
  return <span className={cn("mt-1.5 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold", c)}>
    <span className="h-1.5 w-1.5 rounded-full bg-current" />{label}
  </span>;
}

function GoalRing({ pct, value, done }: { pct: number; value: number; done: boolean }) {
  const r = 42, c = 2 * Math.PI * r;
  return (
    <div className="relative h-28 w-28 shrink-0">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <defs>
          <linearGradient id="goalGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={done ? "#f59e0b" : "#10b981"} />
            <stop offset="100%" stopColor={done ? "#fbbf24" : "#38bdf8"} />
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r={r} fill="none" className="stroke-secondary" strokeWidth="9" />
        <circle cx="50" cy="50" r={r} fill="none" stroke="url(#goalGrad)" strokeWidth="9" strokeLinecap="round"
          strokeDasharray={`${(pct / 100) * c} ${c}`} className="transition-all duration-1000" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-extrabold leading-none tabular-nums">{value}</span>
        <span className="mt-0.5 text-[10px] font-semibold text-muted-foreground">{pct}%</span>
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return <div><div className="text-base font-extrabold tabular-nums">{value}</div><div className="text-[10px] font-medium text-muted-foreground">{label}</div></div>;
}
function MiniCard({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-secondary/60 px-2 py-2"><div className="text-base font-extrabold tabular-nums">{value}</div><div className="text-[10px] font-medium text-muted-foreground">{label}</div></div>;
}

function DayBars({ perDay, goal, selected, onSelect, isCurrentWeek }: {
  perDay: { label: string; dayNum: number; count: number; date: Date }[]; goal: number; selected: number | null; onSelect: (i: number | null) => void; isCurrentWeek: boolean;
}) {
  const max = Math.max(goal, ...perDay.map((d) => d.count), 1);
  const H = 120;
  const todayStr = dayKey(new Date());
  const sel = selected != null ? perDay[selected] : null;
  return (
    <div>
      <div className="relative flex items-end justify-between gap-2" style={{ height: H + 22 }}>
        <div aria-hidden className="pointer-events-none absolute inset-x-0 border-t border-dashed border-primary/50" style={{ bottom: 22 + (goal / max) * H }}>
          <span className="absolute -top-2.5 right-0 rounded bg-card px-1 text-[9px] font-bold text-primary">GOAL</span>
        </div>
        {perDay.map((d, i) => {
          const h = Math.max(d.count > 0 ? 6 : 3, (d.count / max) * H);
          const reached = d.count >= goal;
          const isToday = isCurrentWeek && dayKey(d.date) === todayStr;
          const future = d.date > new Date() && !isToday;
          return (
            <button key={d.label} onClick={() => onSelect(selected === i ? null : i)} className="group flex h-full flex-1 flex-col items-center justify-end gap-1 outline-none">
              <span className={cn("text-[10px] font-bold tabular-nums", d.count ? "text-foreground" : "text-transparent")}>{d.count || 0}</span>
              <div className={cn("w-full max-w-[34px] rounded-t-lg transition-all duration-700",
                future ? "bg-secondary/40" : d.count === 0 ? "bg-secondary" : reached ? "bg-gradient-to-t from-emerald-600 to-emerald-400" : "bg-gradient-to-t from-primary/70 to-primary",
                selected === i && "ring-2 ring-foreground/40")} style={{ height: h }} />
              <div className="flex flex-col items-center leading-tight">
                <span className={cn("text-[10px] font-semibold", isToday ? "text-primary" : "text-muted-foreground")}>{d.label}</span>
                <span className={cn("mt-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold", isToday ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>{d.dayNum}</span>
              </div>
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex items-center justify-between rounded-xl bg-secondary/50 px-3 py-2 text-xs">
        {sel ? (
          <>
            <span className="font-semibold">{sel.date.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" })}</span>
            <span className={cn("font-bold", sel.count >= goal ? "text-emerald-600 dark:text-emerald-400" : "text-foreground")}>{sel.count} questions{sel.count >= goal ? " ✓" : ` · ${goal - sel.count} to goal`}</span>
          </>
        ) : (
          <span className="mx-auto text-muted-foreground">Tap a day to see details</span>
        )}
      </div>
    </div>
  );
}

function TrendChart({ data }: { data: { label: string; total: number; accuracy: number }[] }) {
  const W = 320, H = 130, padL = 8, padR = 8, padT = 12, padB = 22;
  const innerW = W - padL - padR, innerH = H - padT - padB;
  const maxQ = Math.max(...data.map((d) => d.total), 1);
  const step = innerW / data.length, barW = Math.min(22, step * 0.55);
  const pts = data.map((d, i) => ({ x: padL + step * i + step / 2, y: padT + innerH - (d.accuracy / 100) * innerH, d, has: d.total > 0 }));
  const withData = pts.filter((p) => p.has);
  const line = withData.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Eight week questions and accuracy trend">
        {[0, 50, 100].map((g) => (
          <line key={g} x1={padL} x2={W - padR} y1={padT + innerH - (g / 100) * innerH} y2={padT + innerH - (g / 100) * innerH} className="stroke-border" strokeDasharray="3 3" strokeWidth="1" />
        ))}
        {data.map((d, i) => {
          const h = (d.total / maxQ) * innerH * 0.85;
          return <rect key={i} x={padL + step * i + (step - barW) / 2} y={padT + innerH - h} width={barW} height={Math.max(h, d.total ? 2 : 0)} rx="4" className="fill-primary/25" />;
        })}
        {withData.length > 1 && <path d={line} fill="none" stroke="#10b981" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />}
        {withData.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="3.2" fill="#10b981" className="stroke-card" strokeWidth="1.5" />)}
        {data.map((d, i) => <text key={i} x={padL + step * i + step / 2} y={H - 6} textAnchor="middle" className="fill-muted-foreground" style={{ fontSize: 8 }}>{d.label}</text>)}
      </svg>
      <div className="mt-2 flex items-center justify-center gap-4 text-[10px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-primary/30" />Questions</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-3 rounded bg-emerald-500" />Accuracy %</span>
      </div>
    </div>
  );
}

function ProgressSkeleton() {
  const bar = "animate-pulse rounded-2xl bg-secondary/70";
  return (
    <div className="space-y-4" aria-busy="true">
      <div className={cn(bar, "h-32")} />
      <div className={cn(bar, "h-12")} />
      <div className="grid grid-cols-2 gap-3"><div className={cn(bar, "h-28")} /><div className={cn(bar, "h-28")} /><div className={cn(bar, "h-28")} /><div className={cn(bar, "h-28")} /></div>
      <div className={cn(bar, "h-44")} />
      <div className={cn(bar, "h-52")} />
    </div>
  );
}
