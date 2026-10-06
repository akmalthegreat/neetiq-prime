import { cn } from "@/lib/utils";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { toast } from "sonner";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Loader2,
  Flame,
  Atom,
  FlaskConical,
  Dna,
  FileText,
  Trophy,
  Users,
  Target,
  ChevronRight,
  Zap,
  Pencil,
  CheckCircle2,
  XCircle,
  Clock,
  Bookmark,
  BarChart3,
  Sparkles,
  TrendingUp,
  Layers,
  ArrowRight,
  FileCheck,
  LayoutGrid,
  Plus,
  ListTodo,
  Play,
  Check,
  BookOpen,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { TrialBanner } from "@/components/dashboard/trial-banner";

type Test = {
  id: string;
  title: string;
  type: string;
  difficulty: string;
  duration_min: number;
  total_questions: number;
};

type TodayAttempt = {
  id: string;
  correct_count: number;
  wrong_count: number;
  unattempted_count: number;
  submitted_at: string;
};

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — NEET Track" }] }),
  component: Dashboard,
});

const PRESET_GOALS = [20, 30, 50, 75, 100];

function Dashboard() {
  const { user, profile, loading, refresh } = useAuth();
  const nav = useNavigate();
  const [daily, setDaily] = useState<Test | null | undefined>(undefined);
  const [subjectCounts, setSubjectCounts] = useState({
    physics: 16047,
    chemistry: 15602,
    biology: 15146,
  });

  // Fetch real counts from Supabase
  useEffect(() => {
    async function fetchCounts() {
      try {
        const [p, c, b] = await Promise.all([
          supabase
            .from("questions")
            .select("id", { count: "exact", head: true })
            .eq("subject_id", "physics"),
          supabase
            .from("questions")
            .select("id", { count: "exact", head: true })
            .eq("subject_id", "chemistry"),
          supabase
            .from("questions")
            .select("id", { count: "exact", head: true })
            .eq("subject_id", "biology"),
        ]);
        setSubjectCounts({
          physics: p.count ?? 16047,
          chemistry: c.count ?? 15602,
          biology: b.count ?? 15146,
        });
      } catch (e) {
        console.error("Failed to load subject counts:", e);
      }
    }
    fetchCounts();
  }, []);

  const [streak, setStreak] = useState<number>(0);
  const [subjectProgress, setSubjectProgress] = useState<Record<string, number>>({
    physics: 0,
    chemistry: 0,
    biology: 0,
  });
  const [todayAttempts, setTodayAttempts] = useState<TodayAttempt[]>([]);
  const [goalDialog, setGoalDialog] = useState(false);
  const [goalDraft, setGoalDraft] = useState(20);

  // Quick Generate Test form state
  const [genQuestions, setGenQuestions] = useState<number>(50);
  const [genDifficulty, setGenDifficulty] = useState<string>("Mixed");
  const [genTimer, setGenTimer] = useState<number>(60);

  const dailyGoal = profile?.daily_goal ?? 20;

  useEffect(() => {
    if (profile?.daily_goal) setGoalDraft(profile.daily_goal);
  }, [profile?.daily_goal]);

  useEffect(() => {
    if (!loading && !user) nav({ to: "/login" });
  }, [user, loading, nav]);

  useEffect(() => {
    if (user) refresh();
  }, [user?.id]);

  // Fetch featured DPP HUB test
  useEffect(() => {
    supabase
      .from("tests")
      .select("id,title,type,difficulty,duration_min,total_questions")
      .eq("type", "daily")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setDaily((data as Test | null) ?? null));
  }, []);

  // Fetch streak & today's question counts
  useEffect(() => {
    if (!user) return;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
    sixtyDaysAgo.setHours(0, 0, 0, 0);

    supabase
      .from("attempts")
      .select("id,correct_count,wrong_count,unattempted_count,submitted_at,answers")
      .eq("user_id", user.id)
      .eq("status", "completed")
      .gte("submitted_at", sixtyDaysAgo.toISOString())
      .then(({ data }) => {
        const attempts = (data ?? []) as TodayAttempt[];

        const todayItems = attempts.filter((a) => {
          if (!a.submitted_at) return false;
          return new Date(a.submitted_at) >= today;
        });
        setTodayAttempts(todayItems);

        const days = new Set(
          attempts
            .map((a) => a.submitted_at)
            .filter((s): s is string => !!s)
            .map((s) => new Date(s).toISOString().slice(0, 10))
        );
        let s = 0;
        const cur = new Date();
        cur.setHours(0, 0, 0, 0);
        if (!days.has(cur.toISOString().slice(0, 10))) {
          cur.setDate(cur.getDate() - 1);
        }
        while (days.has(cur.toISOString().slice(0, 10))) {
          s++;
          cur.setDate(cur.getDate() - 1);
        }
        if (s > 0) setStreak(s);

        // Fetch subject breakdown from user completed attempts
        (async () => {
          try {
            const allAnswers = attempts.flatMap((a: any) => Object.keys(a.answers || {}));
            const qIds = Array.from(new Set(allAnswers)).slice(0, 300);
            if (qIds.length > 0) {
              const { data: qData } = await supabase
                .from("questions")
                .select("id, subject_id, correct_index")
                .in("id", qIds);
              const qMap = new Map((qData || []).map((q: any) => [String(q.id), q]));
              const counts: Record<string, { total: number; correct: number }> = {
                physics: { total: 0, correct: 0 },
                chemistry: { total: 0, correct: 0 },
                biology: { total: 0, correct: 0 },
              };
              for (const a of attempts as any[]) {
                const ans = a.answers || {};
                for (const [qid, picked] of Object.entries(ans)) {
                  const q = qMap.get(String(qid));
                  if (!q || !q.subject_id) continue;
                  const sId = q.subject_id.toLowerCase();
                  if (counts[sId]) {
                    counts[sId].total++;
                    if (Number(picked) === Number(q.correct_index)) {
                      counts[sId].correct++;
                    }
                  }
                }
              }
              setSubjectProgress({
                physics:
                  counts.physics.total > 0
                    ? Math.min(100, Math.round((counts.physics.correct / counts.physics.total) * 100))
                    : 0,
                chemistry:
                  counts.chemistry.total > 0
                    ? Math.min(100, Math.round((counts.chemistry.correct / counts.chemistry.total) * 100))
                    : 0,
                biology:
                  counts.biology.total > 0
                    ? Math.min(100, Math.round((counts.biology.correct / counts.biology.total) * 100))
                    : 0,
              });
            }
          } catch (err) {
            console.error("Error computing subject progress:", err);
          }
        })();
      });
  }, [user?.id]);

  // Calculations for today's stats
  const { todayQuestions, todayCorrect, todayWrong, todayAccuracy, progressPercent } =
    useMemo(() => {
      const questions = todayAttempts.reduce(
        (sum, a) =>
          sum + (a.correct_count ?? 0) + (a.wrong_count ?? 0) + (a.unattempted_count ?? 0),
        0
      );
      const correct = todayAttempts.reduce((sum, a) => sum + (a.correct_count ?? 0), 0);
      const wrong = todayAttempts.reduce((sum, a) => sum + (a.wrong_count ?? 0), 0);
      const solved = correct + wrong;
      const accuracy = solved > 0 ? Math.round((correct / solved) * 100) : 0;
      const pct = Math.min(100, Math.round((solved / dailyGoal) * 100));

      return {
        todayQuestions: questions,
        todayCorrect: correct,
        todayWrong: wrong,
        todayAccuracy: solved > 0 ? accuracy : 0,
        progressPercent: dailyGoal > 0 ? pct : 0,
      };
    }, [todayAttempts, dailyGoal]);

  const saveDailyGoal = async () => {
    if (!user) return;
    const val = Math.max(5, Math.min(300, Number(goalDraft) || 20));
    const { error } = await supabase.from("profiles").update({ daily_goal: val }).eq("id", user.id);
    if (!error) {
      toast.success("Daily goal updated");
      refresh();
      setGoalDialog(false);
    } else {
      toast.error("Could not update target", { description: error.message });
    }
  };

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const firstName =
    profile?.full_name?.trim()?.split(" ")[0] || user?.email?.split("@")[0] || "Doctor";

  return (
    <PageShell>
      <div className="relative -mx-4 -my-8 min-h-[calc(100vh-4rem)] overflow-hidden bg-slate-50/60 px-4 py-5 sm:-mx-6 sm:-my-10 sm:px-6 sm:py-6 lg:-mx-8 lg:px-8 dark:bg-[#070d18]">
        {/* Subtle, refined background ambient glow */}
        <div className="pointer-events-none absolute -top-32 -left-20 h-80 w-80 rounded-full bg-teal-500/10 blur-3xl dark:bg-teal-500/10" />
        <div className="pointer-events-none absolute top-1/4 -right-20 h-80 w-80 rounded-full bg-blue-500/10 blur-3xl dark:bg-blue-500/10" />

        <TrialBanner />

        <div className="relative z-10 mx-auto max-w-5xl space-y-4 pb-10">
          {/* =========================================================
              1. COMPACT COMMAND COCKPIT (Greeting, Target & 4 KPIs)
              ========================================================= */}
          <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white/95 p-4 shadow-xs backdrop-blur-md transition-all sm:p-5 dark:border-slate-800/80 dark:bg-slate-900/90 dark:shadow-md">
            {/* Top Row: User Greeting, Quick Actions & Target Progress */}
            <div className="flex flex-col gap-3.5 sm:flex-row sm:items-center sm:justify-between">
              {/* Left: User Identity */}
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-teal-600 via-emerald-500 to-teal-400 text-white shadow-md shadow-teal-500/20">
                  <Atom className="h-5 w-5 animate-spin-slow" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h1 className="truncate text-base font-black tracking-tight text-slate-900 sm:text-lg dark:text-white">
                      Hi, Dr. {firstName}
                    </h1>
                    <span className="shrink-0 rounded-full bg-teal-500/10 px-2 py-0.5 text-[10px] font-black text-teal-700 dark:bg-teal-500/20 dark:text-teal-300">
                      NEET UG
                    </span>
                  </div>
                  <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    Aiming for 700+ | AIIMS New Delhi
                  </p>
                </div>
              </div>

              {/* Right: Quick Action Badges */}
              <div className="flex items-center gap-2 self-start sm:self-auto">
                <Link
                  to="/todo"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-teal-200/80 bg-teal-50/70 px-2.5 py-1.5 text-xs font-bold text-teal-800 transition-all hover:bg-teal-100 hover:shadow-xs active:scale-95 dark:border-teal-900/60 dark:bg-teal-950/40 dark:text-teal-300"
                >
                  <ListTodo className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                  <span>Planner</span>
                </Link>

                <Link
                  to="/leaderboard"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200/80 bg-amber-50/70 px-2.5 py-1.5 text-xs font-bold text-amber-800 transition-all hover:bg-amber-100 hover:shadow-xs active:scale-95 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300"
                >
                  <Flame className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
                  <span>{streak}d Streak</span>
                </Link>

                <button
                  type="button"
                  onClick={() => setGoalDialog(true)}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-bold text-slate-700 transition-all hover:border-slate-300 hover:bg-white active:scale-95 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-200"
                >
                  <Pencil className="h-3 w-3 text-slate-500" />
                  <span>Target</span>
                </button>
              </div>
            </div>

            {/* Target Progress Bar Ribbon */}
            <div className="mt-3.5 rounded-xl border border-slate-100 bg-slate-50/80 p-2.5 sm:p-3 dark:border-slate-800/60 dark:bg-slate-800/40">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200">
                  <Target className="h-3.5 w-3.5 text-emerald-500" />
                  <span>Daily Goal</span>
                  <span className="text-slate-400">·</span>
                  <span className="font-semibold text-slate-500 dark:text-slate-400">
                    {todayCorrect + todayWrong} / {dailyGoal} MCQs
                  </span>
                </div>
                <span className="font-black text-emerald-600 dark:text-emerald-400">
                  {progressPercent}%
                </span>
              </div>
              <div className="relative mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-teal-500 to-emerald-500 transition-all duration-700 ease-out"
                  style={{ width: `${Math.max(0, Math.min(100, progressPercent))}%` }}
                />
              </div>
            </div>

            {/* 4 Compact KPIs Row */}
            <div className="mt-3 grid grid-cols-4 gap-2 pt-1 text-center">
              <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-2 dark:border-slate-800/60 dark:bg-slate-800/40">
                <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-slate-500 sm:text-[11px] dark:text-slate-400">
                  <FileText className="h-3 w-3 text-blue-500" />
                  <span>Solved</span>
                </div>
                <div className="mt-0.5 text-sm font-black text-slate-900 sm:text-base dark:text-white">
                  {todayQuestions}
                </div>
              </div>

              <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-2 dark:border-emerald-950/40 dark:bg-emerald-950/20">
                <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-emerald-700 sm:text-[11px] dark:text-emerald-400">
                  <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                  <span>Correct</span>
                </div>
                <div className="mt-0.5 text-sm font-black text-emerald-600 sm:text-base dark:text-emerald-400">
                  {todayCorrect}
                </div>
              </div>

              <div className="rounded-xl border border-rose-100 bg-rose-50/40 p-2 dark:border-rose-950/40 dark:bg-rose-950/20">
                <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-rose-700 sm:text-[11px] dark:text-rose-400">
                  <XCircle className="h-3 w-3 text-rose-500" />
                  <span>Wrong</span>
                </div>
                <div className="mt-0.5 text-sm font-black text-rose-600 sm:text-base dark:text-rose-400">
                  {todayWrong}
                </div>
              </div>

              <div className="rounded-xl border border-teal-100 bg-teal-50/40 p-2 dark:border-teal-950/40 dark:bg-teal-950/20">
                <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-teal-700 sm:text-[11px] dark:text-teal-400">
                  <Clock className="h-3 w-3 text-teal-500" />
                  <span>Accuracy</span>
                </div>
                <div className="mt-0.5 text-sm font-black text-teal-600 sm:text-base dark:text-teal-400">
                  {todayAccuracy}%
                </div>
              </div>
            </div>
          </div>

          {/* =========================================================
              2. SLEEK SUBJECT PILLARS (Physics, Chemistry, Biology)
              ========================================================= */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5 fill-teal-500 text-teal-500" />
                <span className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  SUBJECT MASTERY
                </span>
              </div>
              <Link
                to="/dpp"
                className="inline-flex items-center gap-1 text-xs font-bold text-teal-600 transition-colors hover:text-teal-700 dark:text-teal-400"
              >
                <span>Question Bank</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {/* Physics */}
              <Link
                to="/subjects/$subject"
                params={{ subject: "Physics" }}
                className="group relative flex flex-col justify-between overflow-hidden rounded-xl border border-sky-200/70 bg-gradient-to-b from-white to-sky-50/30 p-2.5 sm:p-3.5 shadow-2xs transition-all duration-200 hover:-translate-y-0.5 hover:border-sky-400 hover:shadow-md hover:shadow-sky-500/15 active:scale-[0.98] dark:border-sky-900/40 dark:from-slate-900 dark:to-sky-950/20"
              >
                <div className="flex items-center justify-between">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-500/15 text-sky-600 sm:h-8 sm:w-8 dark:bg-sky-500/20 dark:text-sky-400">
                    <Atom className="h-4 w-4" />
                  </div>
                  <span className="text-[11px] font-black text-sky-600 dark:text-sky-400">
                    {subjectProgress.physics}%
                  </span>
                </div>
                <div className="mt-2">
                  <div className="truncate text-xs font-bold text-slate-900 group-hover:text-sky-600 sm:text-sm dark:text-white dark:group-hover:text-sky-400">
                    Physics
                  </div>
                  <div className="truncate text-[10px] font-medium text-slate-400">
                    {subjectCounts.physics.toLocaleString()} Qs
                  </div>
                  <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      className="h-full rounded-full bg-sky-500 transition-all duration-500"
                      style={{ width: `${Math.max(0, Math.min(100, subjectProgress.physics))}%` }}
                    />
                  </div>
                </div>
              </Link>

              {/* Chemistry */}
              <Link
                to="/subjects/$subject"
                params={{ subject: "Chemistry" }}
                className="group relative flex flex-col justify-between overflow-hidden rounded-xl border border-teal-200/70 bg-gradient-to-b from-white to-teal-50/30 p-2.5 sm:p-3.5 shadow-2xs transition-all duration-200 hover:-translate-y-0.5 hover:border-teal-400 hover:shadow-md hover:shadow-teal-500/15 active:scale-[0.98] dark:border-teal-900/40 dark:from-slate-900 dark:to-teal-950/20"
              >
                <div className="flex items-center justify-between">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-500/15 text-teal-600 sm:h-8 sm:w-8 dark:bg-teal-500/20 dark:text-teal-400">
                    <FlaskConical className="h-4 w-4" />
                  </div>
                  <span className="text-[11px] font-black text-teal-600 dark:text-teal-400">
                    {subjectProgress.chemistry}%
                  </span>
                </div>
                <div className="mt-2">
                  <div className="truncate text-xs font-bold text-slate-900 group-hover:text-teal-600 sm:text-sm dark:text-white dark:group-hover:text-teal-400">
                    Chemistry
                  </div>
                  <div className="truncate text-[10px] font-medium text-slate-400">
                    {subjectCounts.chemistry.toLocaleString()} Qs
                  </div>
                  <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      className="h-full rounded-full bg-teal-500 transition-all duration-500"
                      style={{ width: `${Math.max(0, Math.min(100, subjectProgress.chemistry))}%` }}
                    />
                  </div>
                </div>
              </Link>

              {/* Biology */}
              <Link
                to="/subjects/$subject"
                params={{ subject: "Biology" }}
                className="group relative flex flex-col justify-between overflow-hidden rounded-xl border border-purple-200/70 bg-gradient-to-b from-white to-purple-50/30 p-2.5 sm:p-3.5 shadow-2xs transition-all duration-200 hover:-translate-y-0.5 hover:border-purple-400 hover:shadow-md hover:shadow-purple-500/15 active:scale-[0.98] dark:border-purple-900/40 dark:from-slate-900 dark:to-purple-950/20"
              >
                <div className="flex items-center justify-between">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-500/15 text-purple-600 sm:h-8 sm:w-8 dark:bg-purple-500/20 dark:text-purple-400">
                    <Dna className="h-4 w-4" />
                  </div>
                  <span className="text-[11px] font-black text-purple-600 dark:text-purple-400">
                    {subjectProgress.biology}%
                  </span>
                </div>
                <div className="mt-2">
                  <div className="truncate text-xs font-bold text-slate-900 group-hover:text-purple-600 sm:text-sm dark:text-white dark:group-hover:text-purple-400">
                    Biology
                  </div>
                  <div className="truncate text-[10px] font-medium text-slate-400">
                    {subjectCounts.biology.toLocaleString()} Qs
                  </div>
                  <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      className="h-full rounded-full bg-purple-500 transition-all duration-500"
                      style={{ width: `${Math.max(0, Math.min(100, subjectProgress.biology))}%` }}
                    />
                  </div>
                </div>
              </Link>
            </div>
          </div>

          {/* =========================================================
              3. COMPACT 2x2 ACTION HUB (Custom Generator & High Yield Hubs)
              ========================================================= */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {/* Card 1: Quick Test Generator */}
            <div className="relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/80 bg-white/95 p-3.5 shadow-2xs backdrop-blur-md transition-all hover:border-sky-300 dark:border-slate-800 dark:bg-slate-900/90 dark:hover:border-sky-900 sm:p-4">
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-500/15 text-sky-600 dark:bg-sky-500/20 dark:text-sky-400">
                      <Sparkles className="h-3.5 w-3.5" />
                    </div>
                    <span className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                      Quick Test Generator
                    </span>
                  </div>
                  <Link
                    to="/generate"
                    className="text-[11px] font-bold text-sky-600 hover:text-sky-700 dark:text-sky-400"
                  >
                    Custom →
                  </Link>
                </div>

                {/* 3 Selectors Inline */}
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <div>
                    <label className="mb-1 block text-[10px] font-bold text-slate-400">MCQs</label>
                    <select
                      value={genQuestions}
                      onChange={(e) => setGenQuestions(Number(e.target.value))}
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-bold text-slate-800 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    >
                      <option value={20}>20 Qs</option>
                      <option value={30}>30 Qs</option>
                      <option value={50}>50 Qs</option>
                      <option value={100}>100 Qs</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-[10px] font-bold text-slate-400">Level</label>
                    <select
                      value={genDifficulty}
                      onChange={(e) => setGenDifficulty(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-bold text-slate-800 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    >
                      <option value="Mixed">Mixed</option>
                      <option value="Easy">Easy</option>
                      <option value="Medium">Medium</option>
                      <option value="Hard">Hard</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-[10px] font-bold text-slate-400">Timer</label>
                    <select
                      value={genTimer}
                      onChange={(e) => setGenTimer(Number(e.target.value))}
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-bold text-slate-800 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    >
                      <option value={30}>30 min</option>
                      <option value={60}>60 min</option>
                      <option value={90}>90 min</option>
                      <option value={180}>180 min</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="mt-3.5">
                <Button
                  asChild
                  className="w-full rounded-xl bg-gradient-to-r from-sky-600 via-teal-600 to-emerald-600 font-bold text-white shadow-xs transition-all hover:from-sky-500 hover:to-emerald-500 active:scale-[0.98]"
                >
                  <Link
                    to="/generate"
                    search={{ q: genQuestions, diff: genDifficulty, timer: genTimer } as never}
                  >
                    <Play className="mr-1.5 h-3.5 w-3.5 fill-white" />
                    <span>Launch Test ({genQuestions} Qs)</span>
                  </Link>
                </Button>
              </div>
            </div>

            {/* Card 2: Improvement Hub */}
            <div className="relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/80 bg-white/95 p-3.5 shadow-2xs backdrop-blur-md transition-all hover:border-emerald-300 dark:border-slate-800 dark:bg-slate-900/90 dark:hover:border-emerald-900 sm:p-4">
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
                      <BarChart3 className="h-3.5 w-3.5" />
                    </div>
                    <span className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                      Improvement Zone
                    </span>
                  </div>
                  <Link
                    to="/analytics"
                    className="text-[11px] font-bold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
                  >
                    Deep Dive →
                  </Link>
                </div>

                <p className="mt-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  Target weak topics and eliminate negative marking
                </p>

                <div className="mt-3 grid grid-cols-3 gap-2">
                  <Link
                    to="/mistakes"
                    className="group flex flex-col items-center justify-center rounded-xl border border-rose-200/70 bg-rose-50/50 p-2.5 text-center transition-all hover:border-rose-400 hover:shadow-xs active:scale-95 dark:border-rose-900/40 dark:bg-rose-950/20"
                  >
                    <XCircle className="h-4 w-4 text-rose-500" />
                    <span className="mt-1 text-[11px] font-bold text-rose-800 dark:text-rose-300">
                      Mistakes
                    </span>
                  </Link>

                  <Link
                    to="/bookmarks"
                    className="group flex flex-col items-center justify-center rounded-xl border border-amber-200/70 bg-amber-50/50 p-2.5 text-center transition-all hover:border-amber-400 hover:shadow-xs active:scale-95 dark:border-amber-900/40 dark:bg-amber-950/20"
                  >
                    <Bookmark className="h-4 w-4 text-amber-500" />
                    <span className="mt-1 text-[11px] font-bold text-amber-800 dark:text-amber-300">
                      Bookmarks
                    </span>
                  </Link>

                  <Link
                    to="/analytics"
                    className="group flex flex-col items-center justify-center rounded-xl border border-teal-200/70 bg-teal-50/50 p-2.5 text-center transition-all hover:border-teal-400 hover:shadow-xs active:scale-95 dark:border-teal-900/40 dark:bg-teal-950/20"
                  >
                    <TrendingUp className="h-4 w-4 text-teal-500" />
                    <span className="mt-1 text-[11px] font-bold text-teal-800 dark:text-teal-300">
                      Analytics
                    </span>
                  </Link>
                </div>
              </div>

              <div className="mt-3.5">
                <Link
                  to="/mistakes"
                  className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2 text-xs font-bold text-slate-700 transition-all hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-300"
                >
                  <span className="text-[11px]">Resolve Past Mistakes</span>
                  <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                </Link>
              </div>
            </div>

            {/* Card 3: Mocks & PYQs Hub */}
            <div className="relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/80 bg-white/95 p-3.5 shadow-2xs backdrop-blur-md transition-all hover:border-amber-300 dark:border-slate-800 dark:bg-slate-900/90 dark:hover:border-amber-900 sm:p-4">
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
                      <Trophy className="h-3.5 w-3.5" />
                    </div>
                    <span className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                      Exam Simulation
                    </span>
                  </div>
                  <span className="rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-black text-amber-700 dark:text-amber-300">
                    NTA Pattern
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Link
                    to="/mocks"
                    className="flex flex-col justify-between rounded-xl border border-slate-200/70 bg-gradient-to-b from-white to-amber-50/30 p-2.5 transition-all hover:border-amber-400 hover:shadow-xs active:scale-95 dark:border-slate-800 dark:from-slate-900 dark:to-amber-950/20"
                  >
                    <div className="flex items-center justify-between">
                      <Trophy className="h-4 w-4 text-amber-500" />
                      <span className="text-[9px] font-black text-amber-600">720 Marks</span>
                    </div>
                    <div className="mt-2 text-xs font-black text-slate-900 dark:text-white">
                      Full Mocks
                    </div>
                    <div className="text-[10px] text-slate-400">All-India Ranking</div>
                  </Link>

                  <Link
                    to="/pyqs"
                    className="flex flex-col justify-between rounded-xl border border-slate-200/70 bg-gradient-to-b from-white to-blue-50/30 p-2.5 transition-all hover:border-blue-400 hover:shadow-xs active:scale-95 dark:border-slate-800 dark:from-slate-900 dark:to-blue-950/20"
                  >
                    <div className="flex items-center justify-between">
                      <FileCheck className="h-4 w-4 text-blue-500" />
                      <span className="text-[9px] font-black text-blue-600">2010–2025</span>
                    </div>
                    <div className="mt-2 text-xs font-black text-slate-900 dark:text-white">
                      NEET PYQs
                    </div>
                    <div className="text-[10px] text-slate-400">Chapter & Year-wise</div>
                  </Link>
                </div>
              </div>

              <div className="mt-3">
                <Link
                  to="/mocks"
                  className="flex items-center justify-between rounded-xl border border-amber-200/60 bg-amber-50/60 px-3 py-2 text-xs font-bold text-amber-900 transition-all hover:bg-amber-100/70 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300"
                >
                  <span className="text-[11px]">Start Full Syllabus Mock</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>

            {/* Card 4: Study Tools & Community Quick Hub */}
            <div className="relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/80 bg-white/95 p-3.5 shadow-2xs backdrop-blur-md transition-all hover:border-violet-300 dark:border-slate-800 dark:bg-slate-900/90 dark:hover:border-violet-900 sm:p-4">
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-500/15 text-violet-600 dark:bg-violet-500/20 dark:text-violet-400">
                      <Layers className="h-3.5 w-3.5" />
                    </div>
                    <span className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                      High-Yield Tools
                    </span>
                  </div>
                  <Link
                    to="/flashcards"
                    className="text-[11px] font-bold text-violet-600 hover:text-violet-700 dark:text-violet-400"
                  >
                    All Tools →
                  </Link>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Link
                    to="/flashcards"
                    className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50/80 p-2 transition-all hover:border-violet-300 hover:bg-white active:scale-95 dark:border-slate-800 dark:bg-slate-800/50"
                  >
                    <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400">
                      <Layers className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-xs font-bold text-slate-800 dark:text-slate-200">
                        Flashcards
                      </div>
                      <div className="truncate text-[9px] text-slate-400">Spaced recall</div>
                    </div>
                  </Link>

                  <Link
                    to="/community"
                    className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50/80 p-2 transition-all hover:border-purple-300 hover:bg-white active:scale-95 dark:border-slate-800 dark:bg-slate-800/50"
                  >
                    <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
                      <Users className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-xs font-bold text-slate-800 dark:text-slate-200">
                        Community
                      </div>
                      <div className="truncate text-[9px] text-slate-400">Ask & Discuss</div>
                    </div>
                  </Link>
                </div>
              </div>

              <div className="mt-3">
                <Link
                  to="/community"
                  className="flex items-center justify-between rounded-xl border border-violet-200/60 bg-violet-50/60 px-3 py-2 text-xs font-bold text-violet-900 transition-all hover:bg-violet-100/70 dark:border-violet-900/50 dark:bg-violet-950/30 dark:text-violet-300"
                >
                  <span className="text-[11px]">Join Aspirants Discussion</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          </div>

          {/* Goal Dialog Modal */}
          <Dialog open={goalDialog} onOpenChange={setGoalDialog}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Set Daily MCQ Target</DialogTitle>
                <DialogDescription>
                  Aim consistently to build speed, accuracy, and NEET exam stamina.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">Quick Presets</Label>
                  <div className="flex flex-wrap gap-2">
                    {PRESET_GOALS.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setGoalDraft(preset)}
                        className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all ${
                          goalDraft === preset
                            ? "border-primary bg-primary text-primary-foreground shadow-xs"
                            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
                        }`}
                      >
                        {preset} MCQs
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="custom-goal" className="text-xs font-semibold">
                    Custom Daily Target
                  </Label>
                  <Input
                    id="custom-goal"
                    type="number"
                    min={5}
                    max={300}
                    value={goalDraft}
                    onChange={(e) => setGoalDraft(Number(e.target.value) || 0)}
                    placeholder="e.g. 50"
                  />
                </div>
              </div>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button variant="ghost" onClick={() => setGoalDialog(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={saveDailyGoal}
                  className="bg-teal-600 font-bold text-white hover:bg-teal-700"
                >
                  Save Target
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </PageShell>
  );
}
