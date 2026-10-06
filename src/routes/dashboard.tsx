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
  CalendarDays,
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
  BookOpen,
  Sparkles,
  TrendingUp,
  Layers,
  ArrowRight,
  FileCheck,
  LayoutGrid,
  Plus,
  ListTodo,
  GraduationCap,
  ArrowUpRight,
  ShieldCheck,
  Activity,
  Check,
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
            .map((s) => new Date(s).toISOString().slice(0, 10)),
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
        0,
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
      <div className="relative -mx-4 -my-8 min-h-[calc(100vh-4rem)] overflow-hidden bg-slate-50/70 px-4 py-6 sm:-mx-6 sm:-my-10 sm:px-6 sm:py-8 lg:-mx-8 lg:px-8 dark:bg-[#070d18]">
        {/* Ambient background glows */}
        <div className="pointer-events-none absolute -top-32 -left-20 h-96 w-96 rounded-full bg-teal-500/10 blur-3xl dark:bg-teal-500/15" />
        <div className="pointer-events-none absolute top-1/4 -right-24 h-96 w-96 rounded-full bg-blue-500/10 blur-3xl dark:bg-blue-500/15" />
        <div className="pointer-events-none absolute bottom-12 left-1/3 h-96 w-96 rounded-full bg-emerald-500/10 blur-3xl dark:bg-emerald-500/10" />

        <TrialBanner />

        <div className="relative z-10 mx-auto max-w-6xl space-y-6 pb-12">
          {/* =========================================================
              1. EXECUTIVE COMMAND HEADER
              ========================================================= */}
          <div className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white/95 p-5 shadow-sm backdrop-blur-xl sm:p-7 dark:border-slate-800/80 dark:bg-slate-900/90 dark:shadow-2xl">
            <div className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-gradient-to-br from-teal-400/20 via-emerald-400/15 to-transparent blur-2xl" />

            <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              {/* Left: User Profile & Inspiring Message */}
              <div className="flex items-start gap-4">
                <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-teal-600 via-emerald-500 to-teal-400 text-white shadow-lg shadow-teal-500/25">
                  <GraduationCap className="h-7 w-7" />
                  <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-white ring-2 ring-white dark:bg-slate-900 dark:ring-slate-900">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  </span>
                </div>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <TypewriterGreeting name={firstName} />
                    <span className="rounded-full border border-teal-200/80 bg-teal-50/80 px-2.5 py-0.5 text-[11px] font-bold text-teal-800 dark:border-teal-800/40 dark:bg-teal-950/60 dark:text-teal-300">
                      NEET Aspirant
                    </span>
                  </div>
                  <p className="mt-1 text-xs font-medium text-slate-500 sm:text-sm dark:text-slate-400">
                    Discipline today = Doctor tomorrow. Target 700+ in NEET UG.
                  </p>
                </div>
              </div>

              {/* Right: Quick Action Badges & Shortcuts */}
              <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
                {/* Streak Badge */}
                <Link
                  to="/leaderboard"
                  className="group flex items-center gap-2 rounded-2xl border border-amber-200/80 bg-gradient-to-b from-amber-50/90 to-amber-100/50 px-3.5 py-2 transition-all duration-200 hover:border-amber-400 hover:shadow-md hover:shadow-amber-500/20 active:scale-95 dark:border-amber-900/50 dark:from-amber-950/40 dark:to-amber-900/20"
                >
                  <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400">
                    <Flame className="h-4 w-4 fill-amber-500 text-amber-500" />
                  </div>
                  <div className="text-left">
                    <div className="text-xs font-black text-amber-700 dark:text-amber-400">
                      {streak} {streak === 1 ? "Day" : "Days"}
                    </div>
                    <div className="text-[10px] font-semibold text-amber-700/80 dark:text-amber-300/80">
                      Active Streak
                    </div>
                  </div>
                </Link>

                {/* To-Do Quick Launcher */}
                <Link
                  to="/todo"
                  className="group flex items-center gap-2 rounded-2xl border border-teal-200/80 bg-gradient-to-r from-teal-50 to-emerald-50 px-3.5 py-2 transition-all duration-200 hover:border-teal-400 hover:shadow-md hover:shadow-teal-500/20 active:scale-95 dark:border-teal-900/50 dark:from-teal-950/40 dark:to-emerald-950/30"
                >
                  <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-teal-600 text-white shadow-xs">
                    <ListTodo className="h-4 w-4" />
                  </div>
                  <div className="text-left">
                    <div className="flex items-center gap-1 text-xs font-black text-slate-800 dark:text-slate-100">
                      <span>Study Planner</span>
                      <Plus className="h-3 w-3 text-teal-600 dark:text-teal-400" />
                    </div>
                    <div className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                      Time Tickets
                    </div>
                  </div>
                </Link>
              </div>
            </div>

            {/* Daily Target Progress Bar inside Header */}
            <div className="mt-6 rounded-2xl border border-slate-100 bg-slate-50/80 p-4 dark:border-slate-800/80 dark:bg-slate-800/40">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
                    <Target className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900 dark:text-white">
                        Daily Target Progress
                      </span>
                      <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-black text-emerald-700 dark:text-emerald-400">
                        {progressPercent}% Complete
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {todayCorrect + todayWrong >= dailyGoal ? (
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                          🎉 Target achieved! Fantastic dedication today!
                        </span>
                      ) : (
                        <span>
                          {Math.max(0, dailyGoal - (todayCorrect + todayWrong))} MCQs left to reach your target of {dailyGoal} MCQs
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <span className="text-xs font-black text-slate-700 dark:text-slate-300">
                    {todayCorrect + todayWrong} <span className="font-medium text-slate-400">/ {dailyGoal}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setGoalDialog(true)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-2xs transition-all duration-200 hover:border-teal-400 hover:text-teal-600 hover:shadow-xs active:scale-95 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-teal-500"
                  >
                    <Pencil className="h-3 w-3" />
                    <span>Set Target</span>
                  </button>
                </div>
              </div>

              {/* Progress track */}
              <div className="relative mt-3 h-2.5 w-full overflow-hidden rounded-full bg-slate-200/80 dark:bg-slate-700/60">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-teal-500 via-emerald-500 to-emerald-400 transition-all duration-700 ease-out"
                  style={{
                    width: `${Math.max(0, Math.min(100, Number.isFinite(progressPercent) ? progressPercent : 0))}%`,
                  }}
                />
              </div>
            </div>
          </div>

          {/* =========================================================
              2. KEY METRIC OVERVIEW CARDS (4-Column KPI Grid)
              ========================================================= */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {/* Metric 1: Today Solved */}
            <div className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-2xs backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md dark:border-slate-800/80 dark:bg-slate-900/80 dark:hover:border-blue-900">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                  Total Solved Today
                </span>
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400">
                  <FileText className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <div className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl dark:text-white">
                  {todayQuestions}
                </div>
                <span className="text-[11px] font-semibold text-slate-400">Questions</span>
              </div>
              <div className="mt-2 flex items-center gap-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                <Activity className="h-3 w-3 text-blue-500" />
                <span>Daily goal: {dailyGoal} MCQs</span>
              </div>
            </div>

            {/* Metric 2: Accuracy */}
            <div className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-2xs backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md dark:border-slate-800/80 dark:bg-slate-900/80 dark:hover:border-emerald-900">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                  Daily Accuracy
                </span>
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
                  <Clock className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <div className="text-2xl font-black tracking-tight text-emerald-600 sm:text-3xl dark:text-emerald-400">
                  {todayAccuracy}%
                </div>
                <span className="rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                  {todayAccuracy >= 80 ? "Excellent" : todayAccuracy >= 60 ? "Good" : "Keep Practicing"}
                </span>
              </div>
              <div className="mt-2 flex items-center gap-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                <TrendingUp className="h-3 w-3 text-emerald-500" />
                <span>Target: 85%+ for AIIMS</span>
              </div>
            </div>

            {/* Metric 3: Correct vs Wrong */}
            <div className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-2xs backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 hover:border-teal-300 hover:shadow-md dark:border-slate-800/80 dark:bg-slate-900/80 dark:hover:border-teal-900">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                  Correct / Wrong
                </span>
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-500/10 text-teal-600 dark:bg-teal-500/20 dark:text-teal-400">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-2 flex items-center gap-3">
                <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="text-xl font-black sm:text-2xl">{todayCorrect}</span>
                </div>
                <span className="text-slate-300 dark:text-slate-700">|</span>
                <div className="flex items-center gap-1 text-rose-500 dark:text-rose-400">
                  <XCircle className="h-4 w-4" />
                  <span className="text-xl font-black sm:text-2xl">{todayWrong}</span>
                </div>
              </div>
              <div className="mt-2 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                Negative marks avoided: {todayCorrect * 4 - todayWrong} pts
              </div>
            </div>

            {/* Metric 4: Streak & Discipline */}
            <div className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-2xs backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 hover:border-amber-300 hover:shadow-md dark:border-slate-800/80 dark:bg-slate-900/80 dark:hover:border-amber-900">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                  Current Streak
                </span>
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
                  <Flame className="h-4 w-4 fill-amber-500 text-amber-500" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <div className="text-2xl font-black tracking-tight text-amber-600 sm:text-3xl dark:text-amber-400">
                  {streak}
                </div>
                <span className="text-[11px] font-semibold text-slate-400">Days Active</span>
              </div>
              <div className="mt-2 flex items-center gap-1 text-[11px] font-medium text-amber-700/80 dark:text-amber-400/80">
                <Trophy className="h-3 w-3 text-amber-500" />
                <span>Keep solving daily!</span>
              </div>
            </div>
          </div>

          {/* =========================================================
              3. SUBJECT MASTERY HUB (Physics, Chemistry, Biology)
              ========================================================= */}
          <div>
            <div className="mb-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-teal-500/15 text-teal-600 dark:bg-teal-500/20 dark:text-teal-400">
                  <Zap className="h-3.5 w-3.5 fill-teal-500 text-teal-500" />
                </div>
                <div>
                  <h2 className="text-sm font-black uppercase tracking-wider text-slate-900 sm:text-base dark:text-white">
                    Subject Practice & Mastery
                  </h2>
                </div>
              </div>
              <Link
                to="/dpp"
                className="inline-flex items-center gap-1 text-xs font-bold text-teal-600 transition-colors hover:text-teal-700 dark:text-teal-400 dark:hover:text-teal-300"
              >
                <span>View Question Bank</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {/* Physics */}
              <Link
                to="/subjects/$subject"
                params={{ subject: "physics" }}
                className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-indigo-200/80 bg-gradient-to-b from-white via-indigo-50/20 to-white p-5 shadow-2xs transition-all duration-200 hover:-translate-y-1 hover:border-indigo-400 hover:shadow-xl hover:shadow-indigo-500/15 active:scale-[0.99] dark:border-indigo-900/40 dark:from-slate-900 dark:via-indigo-950/20 dark:to-slate-900 dark:hover:border-indigo-500"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-500/15 text-indigo-600 shadow-inner dark:bg-indigo-500/20 dark:text-indigo-400">
                      <Atom className="h-6 w-6 transition-transform duration-300 group-hover:scale-110" />
                    </div>
                    <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-[10px] font-bold text-indigo-700 dark:border-indigo-900 dark:bg-indigo-950 dark:text-indigo-300">
                      High Weightage
                    </span>
                  </div>

                  <h3 className="mt-3.5 text-base font-black text-slate-900 group-hover:text-indigo-600 sm:text-lg dark:text-white dark:group-hover:text-indigo-400">
                    Physics
                  </h3>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    Mechanics, Electrodynamics & Modern Physics
                  </p>

                  <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50/80 p-2.5 dark:border-slate-800 dark:bg-slate-800/40">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-slate-500 dark:text-slate-400">Question Pool</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {subjectCounts.physics.toLocaleString()} MCQs
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                      <div
                        className="h-full rounded-full bg-indigo-500 transition-all duration-500"
                        style={{ width: `${Math.max(5, subjectProgress.physics || 0)}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-3 text-xs font-bold text-indigo-600 group-hover:text-indigo-700 dark:border-slate-800 dark:text-indigo-400">
                  <span>Start Practice</span>
                  <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </div>
              </Link>

              {/* Chemistry */}
              <Link
                to="/subjects/$subject"
                params={{ subject: "chemistry" }}
                className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-emerald-200/80 bg-gradient-to-b from-white via-emerald-50/20 to-white p-5 shadow-2xs transition-all duration-200 hover:-translate-y-1 hover:border-emerald-400 hover:shadow-xl hover:shadow-emerald-500/15 active:scale-[0.99] dark:border-emerald-900/40 dark:from-slate-900 dark:via-emerald-950/20 dark:to-slate-900 dark:hover:border-emerald-500"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-600 shadow-inner dark:bg-emerald-500/20 dark:text-emerald-400">
                      <FlaskConical className="h-6 w-6 transition-transform duration-300 group-hover:scale-110" />
                    </div>
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
                      Scoring Subject
                    </span>
                  </div>

                  <h3 className="mt-3.5 text-base font-black text-slate-900 group-hover:text-emerald-600 sm:text-lg dark:text-white dark:group-hover:text-emerald-400">
                    Chemistry
                  </h3>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    Physical, Organic & Inorganic NCERT
                  </p>

                  <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50/80 p-2.5 dark:border-slate-800 dark:bg-slate-800/40">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-slate-500 dark:text-slate-400">Question Pool</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {subjectCounts.chemistry.toLocaleString()} MCQs
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                        style={{ width: `${Math.max(5, subjectProgress.chemistry || 0)}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-3 text-xs font-bold text-emerald-600 group-hover:text-emerald-700 dark:border-slate-800 dark:text-emerald-400">
                  <span>Start Practice</span>
                  <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </div>
              </Link>

              {/* Biology */}
              <Link
                to="/subjects/$subject"
                params={{ subject: "biology" }}
                className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-rose-200/80 bg-gradient-to-b from-white via-rose-50/20 to-white p-5 shadow-2xs transition-all duration-200 hover:-translate-y-1 hover:border-rose-400 hover:shadow-xl hover:shadow-rose-500/15 active:scale-[0.99] dark:border-rose-900/40 dark:from-slate-900 dark:via-rose-950/20 dark:to-slate-900 dark:hover:border-rose-500"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-500/15 text-rose-600 shadow-inner dark:bg-rose-500/20 dark:text-rose-400">
                      <Dna className="h-6 w-6 transition-transform duration-300 group-hover:scale-110" />
                    </div>
                    <span className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-[10px] font-bold text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300">
                      360 / 360 Target
                    </span>
                  </div>

                  <h3 className="mt-3.5 text-base font-black text-slate-900 group-hover:text-rose-600 sm:text-lg dark:text-white dark:group-hover:text-rose-400">
                    Biology
                  </h3>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    Botany & Zoology Line-by-Line NCERT
                  </p>

                  <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50/80 p-2.5 dark:border-slate-800 dark:bg-slate-800/40">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-slate-500 dark:text-slate-400">Question Pool</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {subjectCounts.biology.toLocaleString()} MCQs
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                      <div
                        className="h-full rounded-full bg-rose-500 transition-all duration-500"
                        style={{ width: `${Math.max(5, subjectProgress.biology || 0)}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-3 text-xs font-bold text-rose-600 group-hover:text-rose-700 dark:border-slate-800 dark:text-rose-400">
                  <span>Start Practice</span>
                  <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </div>
              </Link>
            </div>
          </div>

          {/* =========================================================
              4. STRATEGIC PREPARATION GRID (2x2 Core Hub)
              ========================================================= */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Card 1: Custom Test Generator */}
            <div className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-sky-200/80 bg-white/95 p-5 shadow-2xs backdrop-blur-md transition-all duration-200 hover:border-sky-400 hover:shadow-lg hover:shadow-sky-500/10 dark:border-sky-900/40 dark:bg-slate-900/90 dark:hover:border-sky-500">
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/15 text-sky-600 dark:bg-sky-500/20 dark:text-sky-400">
                      <Sparkles className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white">
                        Custom Test Generator
                      </h3>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Tailor tests to your revision needs
                      </p>
                    </div>
                  </div>
                  <Link
                    to="/generate"
                    className="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </div>

                {/* Inline Quick Selector */}
                <div className="mt-4 grid grid-cols-3 gap-2.5">
                  <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-2 dark:border-slate-800 dark:bg-slate-800/50">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Questions
                    </div>
                    <select
                      value={genQuestions}
                      onChange={(e) => setGenQuestions(Number(e.target.value))}
                      className="mt-1 w-full bg-transparent text-xs font-bold text-slate-800 focus:outline-none dark:text-white"
                    >
                      <option value={20} className="dark:bg-slate-900">20 Qs</option>
                      <option value={30} className="dark:bg-slate-900">30 Qs</option>
                      <option value={50} className="dark:bg-slate-900">50 Qs</option>
                      <option value={100} className="dark:bg-slate-900">100 Qs</option>
                    </select>
                  </div>

                  <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-2 dark:border-slate-800 dark:bg-slate-800/50">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Difficulty
                    </div>
                    <select
                      value={genDifficulty}
                      onChange={(e) => setGenDifficulty(e.target.value)}
                      className="mt-1 w-full bg-transparent text-xs font-bold text-slate-800 focus:outline-none dark:text-white"
                    >
                      <option value="Mixed" className="dark:bg-slate-900">Mixed</option>
                      <option value="Easy" className="dark:bg-slate-900">Easy</option>
                      <option value="Medium" className="dark:bg-slate-900">Medium</option>
                      <option value="Hard" className="dark:bg-slate-900">Hard</option>
                    </select>
                  </div>

                  <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-2 dark:border-slate-800 dark:bg-slate-800/50">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Timer
                    </div>
                    <select
                      value={genTimer}
                      onChange={(e) => setGenTimer(Number(e.target.value))}
                      className="mt-1 w-full bg-transparent text-xs font-bold text-slate-800 focus:outline-none dark:text-white"
                    >
                      <option value={30} className="dark:bg-slate-900">30 min</option>
                      <option value={60} className="dark:bg-slate-900">60 min</option>
                      <option value={90} className="dark:bg-slate-900">90 min</option>
                      <option value={180} className="dark:bg-slate-900">180 min</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <Button
                  asChild
                  className="w-full rounded-2xl bg-gradient-to-r from-sky-600 via-teal-600 to-emerald-600 py-5 font-bold text-white shadow-md shadow-teal-500/25 transition-all duration-200 hover:from-sky-500 hover:via-teal-500 hover:to-emerald-500 hover:shadow-lg hover:shadow-teal-500/35 active:scale-[0.98]"
                >
                  <Link
                    to="/generate"
                    search={{ q: genQuestions, diff: genDifficulty, timer: genTimer } as never}
                    className="flex items-center justify-center gap-2"
                  >
                    <span>Launch Custom Test</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>

            {/* Card 2: Improvement Zone */}
            <div className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-emerald-200/80 bg-white/95 p-5 shadow-2xs backdrop-blur-md transition-all duration-200 hover:border-emerald-400 hover:shadow-lg hover:shadow-emerald-500/10 dark:border-emerald-900/40 dark:bg-slate-900/90 dark:hover:border-emerald-500">
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
                      <BarChart3 className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white">
                        Improvement Zone
                      </h3>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Turn your mistakes into high-scoring strengths
                      </p>
                    </div>
                  </div>
                  <Link
                    to="/analytics"
                    className="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2">
                  <Link
                    to="/bookmarks"
                    className="flex flex-col items-center justify-center gap-1 rounded-2xl border border-amber-200/80 bg-amber-50/70 p-3 text-center transition-all duration-200 hover:border-amber-400 hover:bg-amber-100/80 hover:shadow-xs active:scale-95 dark:border-amber-900/40 dark:bg-amber-950/30 dark:hover:border-amber-500"
                  >
                    <Bookmark className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    <span className="text-xs font-bold text-amber-900 dark:text-amber-200">
                      Bookmarks
                    </span>
                    <span className="text-[10px] text-amber-700/80 dark:text-amber-400/80">
                      Saved Qs
                    </span>
                  </Link>

                  <Link
                    to="/mistakes"
                    className="flex flex-col items-center justify-center gap-1 rounded-2xl border border-rose-200/80 bg-rose-50/70 p-3 text-center transition-all duration-200 hover:border-rose-400 hover:bg-rose-100/80 hover:shadow-xs active:scale-95 dark:border-rose-900/40 dark:bg-rose-950/30 dark:hover:border-rose-500"
                  >
                    <FileText className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                    <span className="text-xs font-bold text-rose-900 dark:text-rose-200">
                      Mistakes
                    </span>
                    <span className="text-[10px] text-rose-700/80 dark:text-rose-400/80">
                      Error Log
                    </span>
                  </Link>

                  <Link
                    to="/analytics"
                    className="flex flex-col items-center justify-center gap-1 rounded-2xl border border-teal-200/80 bg-teal-50/70 p-3 text-center transition-all duration-200 hover:border-teal-400 hover:bg-teal-100/80 hover:shadow-xs active:scale-95 dark:border-teal-900/40 dark:bg-teal-950/30 dark:hover:border-teal-500"
                  >
                    <TrendingUp className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                    <span className="text-xs font-bold text-teal-900 dark:text-teal-200">
                      Analytics
                    </span>
                    <span className="text-[10px] text-teal-700/80 dark:text-teal-400/80">
                      Weak Areas
                    </span>
                  </Link>
                </div>
              </div>

              <div className="mt-4">
                <Link
                  to="/analytics"
                  className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-2.5 text-xs font-bold text-slate-700 transition-colors hover:border-teal-400 hover:text-teal-600 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-300 dark:hover:border-teal-500 dark:hover:text-teal-400"
                >
                  <span>View Chapter-Wise Accuracy Trends</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>

            {/* Card 3: Mock Tests & Simulator */}
            <Link
              to="/mocks"
              className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-amber-200/80 bg-white/95 p-5 shadow-2xs backdrop-blur-md transition-all duration-200 hover:border-amber-400 hover:shadow-lg hover:shadow-amber-500/10 active:scale-[0.99] dark:border-amber-900/40 dark:bg-slate-900/90 dark:hover:border-amber-500"
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
                      <Trophy className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white">
                        Full Mock Tests
                      </h3>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Real NTA NEET pattern & negative marking
                      </p>
                    </div>
                  </div>
                  <div className="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200">
                    <ChevronRight className="h-4 w-4" />
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2">
                  <div className="rounded-2xl border border-slate-200/70 bg-slate-50/80 p-2.5 text-center dark:border-slate-800 dark:bg-slate-800/50">
                    <FileCheck className="mx-auto h-4 w-4 text-amber-600 dark:text-amber-400" />
                    <div className="mt-1 text-xs font-bold text-slate-800 dark:text-slate-200">
                      720 Marks
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">Full Test</div>
                  </div>

                  <div className="rounded-2xl border border-slate-200/70 bg-slate-50/80 p-2.5 text-center dark:border-slate-800 dark:bg-slate-800/50">
                    <Clock className="mx-auto h-4 w-4 text-amber-600 dark:text-amber-400" />
                    <div className="mt-1 text-xs font-bold text-slate-800 dark:text-slate-200">
                      200 Min
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">Real Exam</div>
                  </div>

                  <div className="rounded-2xl border border-slate-200/70 bg-slate-50/80 p-2.5 text-center dark:border-slate-800 dark:bg-slate-800/50">
                    <Trophy className="mx-auto h-4 w-4 text-amber-600 dark:text-amber-400" />
                    <div className="mt-1 text-xs font-bold text-slate-800 dark:text-slate-200">
                      AIR Rank
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">Simulation</div>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs font-bold text-amber-600 group-hover:text-amber-700 dark:border-slate-800 dark:text-amber-400">
                <span>Browse Mock Test Series</span>
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
              </div>
            </Link>

            {/* Card 4: Previous Year Questions (PYQs) */}
            <Link
              to="/pyqs"
              className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-blue-200/80 bg-white/95 p-5 shadow-2xs backdrop-blur-md transition-all duration-200 hover:border-blue-400 hover:shadow-lg hover:shadow-blue-500/10 active:scale-[0.99] dark:border-blue-900/40 dark:bg-slate-900/90 dark:hover:border-blue-500"
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/15 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400">
                      <BookOpen className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white">
                          NEET PYQs
                        </h3>
                        <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-bold text-blue-600 dark:text-blue-400">
                          2013-2025
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        12+ years of verified past questions
                      </p>
                    </div>
                  </div>
                  <div className="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200">
                    <ChevronRight className="h-4 w-4" />
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2">
                  <div className="rounded-2xl border border-slate-200/70 bg-slate-50/80 p-2.5 text-center dark:border-slate-800 dark:bg-slate-800/50">
                    <CalendarDays className="mx-auto h-4 w-4 text-blue-600 dark:text-blue-400" />
                    <div className="mt-1 text-xs font-bold text-slate-800 dark:text-slate-200">
                      Year-Wise
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">Papers</div>
                  </div>

                  <div className="rounded-2xl border border-slate-200/70 bg-slate-50/80 p-2.5 text-center dark:border-slate-800 dark:bg-slate-800/50">
                    <LayoutGrid className="mx-auto h-4 w-4 text-blue-600 dark:text-blue-400" />
                    <div className="mt-1 text-xs font-bold text-slate-800 dark:text-slate-200">
                      Chapter
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">Categorized</div>
                  </div>

                  <div className="rounded-2xl border border-slate-200/70 bg-slate-50/80 p-2.5 text-center dark:border-slate-800 dark:bg-slate-800/50">
                    <ShieldCheck className="mx-auto h-4 w-4 text-blue-600 dark:text-blue-400" />
                    <div className="mt-1 text-xs font-bold text-slate-800 dark:text-slate-200">
                      Solutions
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">Step-by-step</div>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs font-bold text-blue-600 group-hover:text-blue-700 dark:border-slate-800 dark:text-blue-400">
                <span>Practice Past Year Questions</span>
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
              </div>
            </Link>
          </div>

          {/* =========================================================
              5. STUDY & REVISION TOOLS (Clean 4-Card Grid)
              ========================================================= */}
          <div>
            <div className="mb-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-teal-500/15 text-teal-600 dark:bg-teal-500/20 dark:text-teal-400">
                  <Layers className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                </div>
                <div>
                  <h2 className="text-sm font-black uppercase tracking-wider text-slate-900 sm:text-base dark:text-white">
                    Study &amp; Revision Tools
                  </h2>
                </div>
              </div>
              <Link
                to="/flashcards"
                className="inline-flex items-center gap-1 text-xs font-bold text-teal-600 transition-colors hover:text-teal-700 dark:text-teal-400 dark:hover:text-teal-300"
              >
                <span>View All Tools</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
              <StudyToolCard
                to="/highlighted-ncert"
                title="Short Notes"
                subtitle="Concise & High Yield"
                badge="High Yield"
                icon={FileText}
                iconClass="bg-violet-500/15 text-violet-600 dark:bg-violet-500/20 dark:text-violet-400"
                badgeClass="bg-violet-500/10 text-violet-700 dark:text-violet-300"
              />

              <StudyToolCard
                to="/flashcards"
                title="Flashcards"
                subtitle="Active Recall System"
                badge="Spaced Rep"
                icon={Layers}
                iconClass="bg-emerald-500/15 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400"
                badgeClass="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
              />

              <StudyToolCard
                to="/ncert-highlights"
                title="NCERT Points"
                subtitle="Crucial Lines & Diagrams"
                badge="NCERT"
                icon={Sparkles}
                iconClass="bg-rose-500/15 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400"
                badgeClass="bg-rose-500/10 text-rose-700 dark:text-rose-300"
              />

              <StudyToolCard
                to="/score-predictor"
                title="Score Predictor"
                subtitle="Predict NEET Rank & College"
                badge="AI Rank"
                icon={TrendingUp}
                iconClass="bg-amber-500/15 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400"
                badgeClass="bg-amber-500/10 text-amber-700 dark:text-amber-300"
              />
            </div>
          </div>

          {/* =========================================================
              6. ASPIRANT COMMUNITY & DISCUSSION PULSE
              ========================================================= */}
          <div className="relative overflow-hidden rounded-3xl border border-violet-200/80 bg-gradient-to-r from-violet-50/60 via-purple-50/40 to-white p-5 shadow-2xs dark:border-violet-900/40 dark:from-slate-900 dark:via-violet-950/20 dark:to-slate-900">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3.5">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-600 text-white shadow-md shadow-violet-500/25">
                  <Users className="h-6 w-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-black text-slate-900 sm:text-base dark:text-white">
                      Aspirant Community & Doubt Forum
                    </h3>
                    <span className="rounded-full bg-violet-600/10 px-2 py-0.5 text-[10px] font-bold text-violet-700 dark:text-violet-300">
                      Live
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
                    Ask doubts, share study tips, and discuss high-yield questions with fellow NEET aspirants.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 self-start sm:self-auto">
                <Link
                  to="/community"
                  className="inline-flex items-center gap-1.5 rounded-2xl bg-violet-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-violet-500/25 transition-all duration-200 hover:bg-violet-700 hover:shadow-lg hover:shadow-violet-500/35 active:scale-95"
                >
                  <span>Join Discussion</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          </div>

          {/* Goal Dialog Modal */}
          <Dialog open={goalDialog} onOpenChange={setGoalDialog}>
            <DialogContent className="sm:max-w-md rounded-3xl">
              <DialogHeader>
                <DialogTitle className="text-lg font-black tracking-tight">
                  Set Your Daily Target
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  Consistency is key for NEET. How many questions do you aim to complete each day?
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-3">
                <div className="space-y-1.5">
                  <Label htmlFor="goal" className="text-xs font-bold">
                    Target Questions Per Day
                  </Label>
                  <Input
                    id="goal"
                    type="number"
                    min={5}
                    max={300}
                    value={goalDraft}
                    onChange={(e) => setGoalDraft(Number(e.target.value))}
                    className="rounded-xl font-bold"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="text-[11px] font-semibold text-slate-500">Quick Presets:</div>
                  <div className="flex flex-wrap gap-2">
                    {PRESET_GOALS.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setGoalDraft(preset)}
                        className={cn(
                          "rounded-xl px-3 py-1.5 text-xs font-bold transition-all active:scale-95",
                          goalDraft === preset
                            ? "bg-teal-600 text-white shadow-xs"
                            : "border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300"
                        )}
                      >
                        {preset} MCQs
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  variant="ghost"
                  onClick={() => setGoalDialog(false)}
                  className="rounded-xl font-semibold"
                >
                  Cancel
                </Button>
                <Button
                  onClick={saveDailyGoal}
                  className="rounded-xl bg-teal-600 font-bold text-white hover:bg-teal-700 shadow-xs"
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

/* =========================================================================
   Typewriter Greeting
   ========================================================================= */
function TypewriterGreeting({ name }: { name: string }) {
  const [displayText, setDisplayText] = useState("");

  useEffect(() => {
    const hour = new Date().getHours();
    const salutation =
      hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
    const target = `${salutation}, ${name || "student"}!`;

    let idx = 0;
    setDisplayText("");

    const interval = setInterval(() => {
      idx++;
      if (idx <= target.length) {
        setDisplayText(target.slice(0, idx));
      } else {
        clearInterval(interval);
      }
    }, 40);

    return () => clearInterval(interval);
  }, [name]);

  return (
    <h1 className="text-xl font-black tracking-tight text-slate-900 sm:text-2xl dark:text-white">
      <span>{displayText}</span>
      <span className="ml-1 inline-block h-5 w-0.5 animate-pulse bg-teal-500 align-middle" />
    </h1>
  );
}

/* =========================================================================
   Study Tool Card
   ========================================================================= */
function StudyToolCard({
  to,
  title,
  subtitle,
  badge,
  icon: Icon,
  badgeClass,
  iconClass,
}: {
  to: string;
  title: string;
  subtitle: string;
  badge?: string;
  icon: React.ComponentType<{ className?: string }>;
  badgeClass?: string;
  iconClass?: string;
}) {
  return (
    <Link
      to={to as never}
      className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-slate-200/80 bg-white/95 p-4 shadow-2xs backdrop-blur-md transition-all duration-200 hover:-translate-y-1 hover:border-teal-400 hover:shadow-lg hover:shadow-teal-500/10 active:scale-[0.98] dark:border-slate-800/80 dark:bg-slate-900/90 dark:hover:border-teal-500/50"
    >
      <div className="flex items-start justify-between gap-2">
        <div
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-xl",
            iconClass || "bg-slate-100 text-slate-700"
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
        {badge && (
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[9px] font-bold",
              badgeClass || "bg-slate-100 text-slate-600"
            )}
          >
            {badge}
          </span>
        )}
      </div>

      <div className="mt-4">
        <div className="text-xs font-black text-slate-900 transition-colors group-hover:text-teal-600 sm:text-sm dark:text-white dark:group-hover:text-teal-400">
          {title}
        </div>
        <div className="mt-0.5 line-clamp-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
          {subtitle}
        </div>
      </div>
    </Link>
  );
}
