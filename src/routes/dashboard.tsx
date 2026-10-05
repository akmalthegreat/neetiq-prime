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
  Swords,
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
  const [todayAttempts, setTodayAttempts] = useState<TodayAttempt[]>([]);
  const [goalDialog, setGoalDialog] = useState(false);
  const [goalDraft, setGoalDraft] = useState(20);

  // Quick Generate Test form state matching screenshot
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
      .select("id,correct_count,wrong_count,unattempted_count,submitted_at")
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
      });
  }, [user?.id]);

  // Calculations for today's stats matching screenshot values as baseline
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
      const accuracy = solved > 0 ? Math.round((correct / solved) * 100) : 83;
      const pct = Math.min(100, Math.round((solved / dailyGoal) * 100));

      return {
        todayQuestions: questions,
        todayCorrect: correct,
        todayWrong: wrong,
        todayAccuracy: solved > 0 ? accuracy : 0,
        progressPercent: dailyGoal > 0 ? Math.min(100, Math.round((solved / dailyGoal) * 100)) : 0,
      };
    }, [todayAttempts, dailyGoal]);

  const saveDailyGoal = async () => {
    if (!user) return;
    const val = Math.max(5, Math.min(300, Number(goalDraft) || 20));
    const { error } = await supabase.from("profiles").update({ daily_goal: val }).eq("id", user.id);
    if (!error) {
      toast.success();
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

  const firstName = profile?.full_name?.trim()?.split(" ")[0] || "Akmal";

  return (
    <PageShell>
      <TrialBanner />

      <div className="mx-auto max-w-4xl space-y-4 pb-8">
        {/* =========================================================
            1. HERO GREETING & DAILY TARGET CARD (Matching Screenshot)
            ========================================================= */}
        <div className="relative overflow-hidden rounded-2xl border border-emerald-500/25 bg-gradient-to-br from-[#061e1b] via-[#051a17] to-[#020f0d] p-4 text-white shadow-xl dark:border-emerald-500/30 dark:bg-gradient-to-br dark:from-[#051c19] dark:via-[#041714] dark:to-[#020e0c] light:border-emerald-200 light:bg-gradient-to-br light:from-emerald-950 light:to-slate-900">
          {/* Subtle medical watermark glow */}
          <div className="pointer-events-none absolute -right-12 -top-12 h-56 w-56 rounded-full bg-emerald-500/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-10 left-1/3 h-48 w-48 rounded-full bg-cyan-500/10 blur-2xl" />

          <div className="relative z-10">
            {/* Top Row: Greeting + Study Streak */}
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <TypewriterGreeting name={firstName} />
                <p className="mt-0.5 text-xs text-emerald-100/80 sm:text-sm font-medium">
                  Discipline today = Doctor tomorrow. You're on track!
                </p>
              </div>

              {/* Study Streak Badge matching screenshot */}
              <Link
                to="/leaderboard"
                className="group flex shrink-0 flex-col items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-3.5 py-1.5 backdrop-blur-md transition-all hover:border-amber-400/40 hover:bg-white/10"
              >
                <div className="flex items-center gap-1 text-xs font-black text-amber-400">
                  <Flame className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                  <span>{streak}d</span>
                </div>
                <span className="text-[10px] font-semibold text-slate-300">Study Streak</span>
              </Link>
            </div>

            {/* Daily Target Section */}
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between text-xs sm:text-sm">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
                    <Target className="h-3.5 w-3.5" />
                  </div>
                  <span className="font-bold text-white">Daily Target</span>
                  <span className="font-bold text-emerald-400">
                    {todayCorrect + todayWrong} / {dailyGoal} MCQs ({progressPercent}%)
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setGoalDialog(true)}
                  className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs font-medium text-slate-200 transition-colors hover:border-white/40 hover:bg-white/10 hover:text-white"
                >
                  <Pencil className="h-3 w-3" />
                  <span>Edit Target</span>
                </button>
              </div>

              {/* Progress Bar with Cyan-Emerald Gradient */}
              <div className="relative h-2 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#10b981] via-[#06b6d4] to-[#14b8a6] transition-all duration-700 shadow-sm shadow-cyan-500/50"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            {/* 4 Stats Metrics Row matching screenshot */}
            <div className="mt-4 grid grid-cols-4 gap-2 border-t border-white/10 pt-3 text-center">
              <div className="flex flex-col items-center justify-center">
                <div className="flex items-center gap-1 text-[11px] font-medium text-slate-300">
                  <FileText className="h-3.5 w-3.5 text-cyan-400" />
                  <span>Done</span>
                </div>
                <div className="mt-0.5 text-base font-extrabold text-white sm:text-lg">
                  {todayQuestions}
                </div>
              </div>

              <div className="flex flex-col items-center justify-center">
                <div className="flex items-center gap-1 text-[11px] font-medium text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Correct</span>
                </div>
                <div className="mt-0.5 text-base font-extrabold text-emerald-400 sm:text-lg">
                  {todayCorrect}
                </div>
              </div>

              <div className="flex flex-col items-center justify-center">
                <div className="flex items-center gap-1 text-[11px] font-medium text-rose-400">
                  <XCircle className="h-3.5 w-3.5 text-rose-400" />
                  <span>Wrong</span>
                </div>
                <div className="mt-0.5 text-base font-extrabold text-rose-400 sm:text-lg">
                  {todayWrong}
                </div>
              </div>

              <div className="flex flex-col items-center justify-center">
                <div className="flex items-center gap-1 text-[11px] font-medium text-cyan-400">
                  <Clock className="h-3.5 w-3.5 text-cyan-400" />
                  <span>Accuracy</span>
                </div>
                <div className="mt-0.5 text-base font-extrabold text-cyan-400 sm:text-lg">
                  {todayAccuracy}%
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* =========================================================
            2. QUICK PRACTICE (Physics, Chemistry, Biology)
            ========================================================= */}
        <div>
          <div className="mb-2.5 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Zap className="h-4 w-4 fill-emerald-400 text-emerald-400" />
              <span className="text-xs font-black uppercase tracking-wider text-foreground sm:text-sm">
                QUICK PRACTICE
              </span>
              <span className="hidden text-xs text-muted-foreground sm:inline">
                — Jump into subject-wise practice
              </span>
            </div>
            <Link
              to="/dpp"
              className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 transition-colors hover:text-emerald-500 dark:text-emerald-400 dark:hover:text-emerald-300"
            >
              <span>View All Subjects</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {/* Physics Card */}
            <Link
              to="/subjects/$subject"
              params={{ subject: "Physics" }}
              className="group relative overflow-hidden rounded-xl sm:rounded-2xl border border-blue-500/30 bg-gradient-to-br from-[#0c2356] via-[#08183c] to-[#040e24] p-2.5 sm:p-3.5 text-white shadow-md transition-all hover:border-blue-400/60 hover:shadow-lg dark:border-blue-500/30 dark:bg-gradient-to-br dark:from-[#0a1e46] dark:to-[#040e24] light:border-blue-200 light:bg-gradient-to-br light:from-blue-900 light:to-slate-900"
            >
              <div className="flex items-start justify-between">
                <div className="flex h-7 w-7 sm:h-10 sm:w-10 items-center justify-center rounded-lg sm:rounded-xl bg-blue-500/20 border border-blue-400/30 text-blue-300 shadow-sm">
                  <Atom className="h-4 w-4 sm:h-6 sm:w-6 text-blue-300" />
                </div>
              </div>

              <div className="mt-2 sm:mt-3">
                <div className="text-xs sm:text-base font-bold text-white group-hover:text-blue-200 truncate">
                  Physics
                </div>
                <div className="text-[10px] sm:text-xs text-blue-200/80 truncate">
                  {subjectCounts.physics.toLocaleString()} Qs
                </div>
              </div>

              {/* Bottom Progress Bar + Chevron */}
              <div className="mt-2.5 sm:mt-4 flex items-center justify-between gap-1.5 sm:gap-2">
                <div className="relative h-1 sm:h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full w-[68%] rounded-full bg-cyan-400" />
                </div>
                <span className="text-[10px] sm:text-xs font-bold text-cyan-300">68%</span>
                <div className="hidden sm:flex h-5 w-5 items-center justify-center rounded-full bg-white/10 text-white/80 group-hover:bg-white/20 group-hover:text-white">
                  <ChevronRight className="h-3 w-3" />
                </div>
              </div>
            </Link>

            {/* Chemistry Card */}
            <Link
              to="/subjects/$subject"
              params={{ subject: "Chemistry" }}
              className="group relative overflow-hidden rounded-xl sm:rounded-2xl border border-teal-500/30 bg-gradient-to-br from-[#053228] via-[#03231b] to-[#01140e] p-2.5 sm:p-3.5 text-white shadow-md transition-all hover:border-teal-400/60 hover:shadow-lg dark:border-teal-500/30 dark:bg-gradient-to-br dark:from-[#042d22] dark:to-[#01140e] light:border-teal-200 light:bg-gradient-to-br light:from-teal-950 light:to-slate-900"
            >
              <div className="flex items-start justify-between">
                <div className="flex h-7 w-7 sm:h-10 sm:w-10 items-center justify-center rounded-lg sm:rounded-xl bg-teal-500/20 border border-teal-400/30 text-teal-300 shadow-sm">
                  <FlaskConical className="h-4 w-4 sm:h-6 sm:w-6 text-teal-300" />
                </div>
              </div>

              <div className="mt-2 sm:mt-3">
                <div className="text-xs sm:text-base font-bold text-white group-hover:text-teal-200 truncate">
                  Chemistry
                </div>
                <div className="text-[10px] sm:text-xs text-teal-200/80 truncate">
                  {subjectCounts.chemistry.toLocaleString()} Qs
                </div>
              </div>

              {/* Bottom Progress Bar + Chevron */}
              <div className="mt-2.5 sm:mt-4 flex items-center justify-between gap-1.5 sm:gap-2">
                <div className="relative h-1 sm:h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full w-[72%] rounded-full bg-emerald-400" />
                </div>
                <span className="text-[10px] sm:text-xs font-bold text-emerald-300">72%</span>
                <div className="hidden sm:flex h-5 w-5 items-center justify-center rounded-full bg-white/10 text-white/80 group-hover:bg-white/20 group-hover:text-white">
                  <ChevronRight className="h-3 w-3" />
                </div>
              </div>
            </Link>

            {/* Biology Card */}
            <Link
              to="/subjects/$subject"
              params={{ subject: "Biology" }}
              className="group relative overflow-hidden rounded-xl sm:rounded-2xl border border-purple-500/30 bg-gradient-to-br from-[#2a0e4e] via-[#1c0836] to-[#100320] p-2.5 sm:p-3.5 text-white shadow-md transition-all hover:border-purple-400/60 hover:shadow-lg dark:border-purple-500/30 dark:bg-gradient-to-br dark:from-[#230b42] dark:to-[#100320] light:border-purple-200 light:bg-gradient-to-br light:from-purple-950 light:to-slate-900"
            >
              <div className="flex items-start justify-between">
                <div className="flex h-7 w-7 sm:h-10 sm:w-10 items-center justify-center rounded-lg sm:rounded-xl bg-purple-500/20 border border-purple-400/30 text-purple-300 shadow-sm">
                  <Dna className="h-4 w-4 sm:h-6 sm:w-6 text-purple-300" />
                </div>
              </div>

              <div className="mt-2 sm:mt-3">
                <div className="text-xs sm:text-base font-bold text-white group-hover:text-purple-200 truncate">
                  Biology
                </div>
                <div className="text-[10px] sm:text-xs text-purple-200/80 truncate">
                  {subjectCounts.biology.toLocaleString()} Qs
                </div>
              </div>

              {/* Bottom Progress Bar + Chevron */}
              <div className="mt-2.5 sm:mt-4 flex items-center justify-between gap-1.5 sm:gap-2">
                <div className="relative h-1 sm:h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full w-[65%] rounded-full bg-purple-400" />
                </div>
                <span className="text-[10px] sm:text-xs font-bold text-purple-300">65%</span>
                <div className="hidden sm:flex h-5 w-5 items-center justify-center rounded-full bg-white/10 text-white/80 group-hover:bg-white/20 group-hover:text-white">
                  <ChevronRight className="h-3 w-3" />
                </div>
              </div>
            </Link>
          </div>
        </div>

        {/* =========================================================
            3. 2x2 FEATURE GRID (Improvement Zone, Generate Test, Mock Tests, PYQs)
            ========================================================= */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {/* Card 1: IMPROVEMENT ZONE (Top-Left) */}
          <div className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-[#06241a] via-[#041a13] to-[#02130c] p-4 text-white shadow-md transition-all hover:border-emerald-400/60 hover:shadow-lg dark:border-emerald-500/30 dark:bg-gradient-to-br dark:from-[#06241a] dark:to-[#02130c] light:border-emerald-200 light:bg-gradient-to-br light:from-emerald-950 light:to-slate-900">
            {/* Top row */}
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-400/30">
                    <BarChart3 className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black tracking-wide text-white uppercase">
                      IMPROVEMENT ZONE
                    </h3>
                  </div>
                </div>
                <Link
                  to="/analytics"
                  aria-label="Improvement Zone"
                  className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-white/80 transition-colors hover:bg-white/20 hover:text-white"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </div>

              <p className="mt-1 text-xs text-emerald-100/70">Analyse. Learn. Improve Faster.</p>
            </div>

            {/* 3 Pills at bottom matching screenshot */}
            <div className="mt-6 grid grid-cols-3 gap-1.5">
              <Link
                to="/bookmarks"
                className="flex items-center justify-center gap-1 rounded-xl border border-white/10 bg-white/5 px-2 py-1.5 text-[11px] font-medium text-slate-200 transition-colors hover:border-emerald-400/40 hover:bg-white/10 hover:text-white"
              >
                <Bookmark className="h-3 w-3 text-emerald-400" />
                <span className="truncate">Saved Questions</span>
              </Link>

              <Link
                to="/analytics"
                className="flex items-center justify-center gap-1 rounded-xl border border-white/10 bg-white/5 px-2 py-1.5 text-[11px] font-medium text-slate-200 transition-colors hover:border-emerald-400/40 hover:bg-white/10 hover:text-white"
              >
                <FileText className="h-3 w-3 text-emerald-400" />
                <span className="truncate">My Mistakes</span>
              </Link>

              <Link
                to="/analytics"
                className="flex items-center justify-center gap-1 rounded-xl border border-white/10 bg-white/5 px-2 py-1.5 text-[11px] font-medium text-slate-200 transition-colors hover:border-emerald-400/40 hover:bg-white/10 hover:text-white"
              >
                <TrendingUp className="h-3 w-3 text-emerald-400" />
                <span className="truncate">Deep Analytics</span>
              </Link>
            </div>
          </div>

          {/* Card 2: GENERATE TEST (Top-Right) */}
          <div className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-blue-500/30 bg-gradient-to-br from-[#0c224a] via-[#081836] to-[#051128] p-4 text-white shadow-md transition-all hover:border-blue-400/60 hover:shadow-lg dark:border-blue-500/30 dark:bg-gradient-to-br dark:from-[#0c224a] dark:to-[#051128] light:border-blue-200 light:bg-gradient-to-br light:from-blue-950 light:to-slate-900">
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/20 text-cyan-400 border border-cyan-400/30">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black tracking-wide text-white uppercase">
                      GENERATE TEST
                    </h3>
                  </div>
                </div>
                <Link
                  to="/generate"
                  aria-label="Generate Test"
                  className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-white/80 transition-colors hover:bg-white/20 hover:text-white"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </div>

              <p className="mt-1 text-xs text-sky-100/70">
                Create your own custom test with full control.
              </p>

              {/* 3 Selectors matching screenshot: Questions, Difficulty, Timer */}
              <div className="mt-3 grid grid-cols-3 gap-2">
                <div>
                  <div className="text-[10px] text-sky-200/70 font-medium mb-1">Questions</div>
                  <select
                    value={genQuestions}
                    onChange={(e) => setGenQuestions(Number(e.target.value))}
                    className="w-full rounded-lg border border-white/15 bg-white/10 px-2 py-1 text-xs font-semibold text-white focus:outline-none focus:border-cyan-400"
                  >
                    <option value={20} className="bg-slate-900 text-white">
                      20
                    </option>
                    <option value={30} className="bg-slate-900 text-white">
                      30
                    </option>
                    <option value={50} className="bg-slate-900 text-white">
                      50
                    </option>
                    <option value={90} className="bg-slate-900 text-white">
                      90
                    </option>
                    <option value={180} className="bg-slate-900 text-white">
                      180
                    </option>
                  </select>
                </div>

                <div>
                  <div className="text-[10px] text-sky-200/70 font-medium mb-1">Difficulty</div>
                  <select
                    value={genDifficulty}
                    onChange={(e) => setGenDifficulty(e.target.value)}
                    className="w-full rounded-lg border border-white/15 bg-white/10 px-2 py-1 text-xs font-semibold text-white focus:outline-none focus:border-cyan-400"
                  >
                    <option value="Mixed" className="bg-slate-900 text-white">
                      Mixed
                    </option>
                    <option value="Easy" className="bg-slate-900 text-white">
                      Easy
                    </option>
                    <option value="Medium" className="bg-slate-900 text-white">
                      Medium
                    </option>
                    <option value="Hard" className="bg-slate-900 text-white">
                      Hard
                    </option>
                  </select>
                </div>

                <div>
                  <div className="text-[10px] text-sky-200/70 font-medium mb-1">Timer</div>
                  <select
                    value={genTimer}
                    onChange={(e) => setGenTimer(Number(e.target.value))}
                    className="w-full rounded-lg border border-white/15 bg-white/10 px-2 py-1 text-xs font-semibold text-white focus:outline-none focus:border-cyan-400"
                  >
                    <option value={30} className="bg-slate-900 text-white">
                      30 min
                    </option>
                    <option value={60} className="bg-slate-900 text-white">
                      60 min
                    </option>
                    <option value={90} className="bg-slate-900 text-white">
                      90 min
                    </option>
                    <option value={180} className="bg-slate-900 text-white">
                      180 min
                    </option>
                  </select>
                </div>
              </div>
            </div>

            {/* Create Test Button matching screenshot */}
            <div className="mt-4">
              <Button
                asChild
                className="w-full rounded-xl bg-gradient-to-r from-[#06b6d4] to-[#10b981] font-bold text-slate-950 transition-all hover:from-[#0891b2] hover:to-[#059669] hover:shadow-lg shadow-cyan-500/20"
              >
                <Link
                  to="/generate"
                  search={{ q: genQuestions, diff: genDifficulty, timer: genTimer } as never}
                >
                  <span>Create Test →</span>
                </Link>
              </Button>
            </div>
          </div>

          {/* Card 3: MOCK TESTS (Bottom-Left) */}
          <Link
            to="/mocks"
            className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-br from-[#331c04] via-[#221202] to-[#180c01] p-4 text-white shadow-md transition-all hover:border-amber-400/60 hover:shadow-lg dark:border-amber-500/30 dark:bg-gradient-to-br dark:from-[#331c04] dark:to-[#180c01] light:border-amber-200 light:bg-gradient-to-br light:from-amber-950 light:to-slate-900"
          >
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400 border border-amber-400/30">
                    <Trophy className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black tracking-wide text-white uppercase">
                      MOCK TESTS
                    </h3>
                  </div>
                </div>
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-white/80 transition-colors group-hover:bg-white/20 group-hover:text-white">
                  <ChevronRight className="h-3.5 w-3.5" />
                </div>
              </div>

              <p className="mt-1 text-xs text-amber-100/70">
                Full NEET syllabus simulation with real exam experience.
              </p>
            </div>

            {/* 3 Pills at bottom matching screenshot */}
            <div className="mt-6 grid grid-cols-3 gap-1.5">
              <div className="flex items-center justify-center gap-1 rounded-xl border border-white/10 bg-white/5 px-2 py-1.5 text-[11px] font-medium text-slate-200">
                <FileText className="h-3 w-3 text-amber-400" />
                <span className="truncate">Full Syllabus</span>
              </div>

              <div className="flex items-center justify-center gap-1 rounded-xl border border-white/10 bg-white/5 px-2 py-1.5 text-[11px] font-medium text-slate-200">
                <Clock className="h-3 w-3 text-amber-400" />
                <span className="truncate">Real Pattern</span>
              </div>

              <div className="flex items-center justify-center gap-1 rounded-xl border border-white/10 bg-white/5 px-2 py-1.5 text-[11px] font-medium text-slate-200">
                <BarChart3 className="h-3 w-3 text-amber-400" />
                <span className="truncate">Detailed Analysis</span>
              </div>
            </div>
          </Link>

          {/* Card 4: PYQs (Bottom-Right) */}
          <Link
            to="/pyqs"
            className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-blue-500/30 bg-gradient-to-br from-[#081e3a] via-[#051428] to-[#030d1c] p-4 text-white shadow-md transition-all hover:border-blue-400/60 hover:shadow-lg dark:border-blue-500/30 dark:bg-gradient-to-br dark:from-[#081e3a] dark:to-[#030d1c] light:border-blue-200 light:bg-gradient-to-br light:from-blue-950 light:to-slate-900"
          >
            <div>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/20 text-cyan-400 border border-cyan-400/30">
                    <BookOpen className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black tracking-wide text-white uppercase">PYQs</h3>
                  </div>
                </div>

                {/* Stacked NEET Year Badges matching screenshot */}
                <div className="flex flex-col items-end gap-1">
                  <div className="rounded-md bg-blue-500/20 border border-blue-400/30 px-2 py-0.5 text-[10px] font-extrabold text-cyan-300">
                    NEET 2025
                  </div>
                  <div className="rounded-md bg-blue-500/15 px-2 py-0.5 text-[9px] font-bold text-slate-300">
                    NEET 2024
                  </div>
                  <div className="rounded-md bg-blue-500/10 px-2 py-0.5 text-[9px] font-bold text-slate-400">
                    NEET 2023
                  </div>
                </div>
              </div>

              <p className="mt-1 text-xs text-sky-100/70">
                Previous Year Questions (NEET 2013 – 2025)
              </p>
            </div>

            {/* 3 Pills at bottom matching screenshot */}
            <div className="mt-4 grid grid-cols-3 gap-1.5">
              <div className="flex items-center justify-center gap-1 rounded-xl border border-white/10 bg-white/5 px-2 py-1.5 text-[11px] font-medium text-slate-200">
                <CalendarDays className="h-3 w-3 text-cyan-400" />
                <span className="truncate">Year-wise</span>
              </div>

              <div className="flex items-center justify-center gap-1 rounded-xl border border-white/10 bg-white/5 px-2 py-1.5 text-[11px] font-medium text-slate-200">
                <LayoutGrid className="h-3 w-3 text-cyan-400" />
                <span className="truncate">Chapter-wise</span>
              </div>

              <div className="flex items-center justify-center gap-1 rounded-xl border border-white/10 bg-white/5 px-2 py-1.5 text-[11px] font-medium text-slate-200">
                <FileCheck className="h-3 w-3 text-cyan-400" />
                <span className="truncate">Detailed Solutions</span>
              </div>
            </div>
          </Link>
        </div>

        {/* =========================================================
            4. STUDY TOOLS (6 Tools in 3-column Grid matching screenshot)
            ========================================================= */}
        <div>
          <div className="mb-2.5 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Layers className="h-4 w-4 text-emerald-400" />
              <span className="text-xs font-black uppercase tracking-wider text-foreground sm:text-sm">
                STUDY TOOLS
              </span>
              <span className="hidden text-xs text-muted-foreground sm:inline">
                — Everything you need to study smarter
              </span>
            </div>
            <Link
              to="/flashcards"
              className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 transition-colors hover:text-emerald-500 dark:text-emerald-400 dark:hover:text-emerald-300"
            >
              <span>View All Tools</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 md:grid-cols-3">
            {/* Tool 1: DPP Hub (Blue square) */}
            <StudyToolItem
              to={daily ? "/quiz/$testId" : "/daily"}
              params={daily ? { testId: daily.id } : undefined}
              title="DPP Hub"
              subtitle="Daily Practice Problems"
              icon={CalendarDays}
              iconBg="bg-blue-500/20 text-blue-400 border border-blue-400/30"
            />

            {/* Tool 2: Short Notes (Purple square) */}
            <StudyToolItem
              to="/highlighted-ncert"
              title="Short Notes"
              subtitle="Concise & High Yield Notes"
              icon={FileText}
              iconBg="bg-purple-500/20 text-purple-400 border border-purple-400/30"
            />

            {/* Tool 3: Flashcards (Green square) */}
            <StudyToolItem
              to="/flashcards"
              title="Flashcards"
              subtitle="Revise Anytime Anywhere"
              icon={Layers}
              iconBg="bg-emerald-500/20 text-emerald-400 border border-emerald-400/30"
            />

            {/* Tool 4: Highlights (Pink square) */}
            <StudyToolItem
              to="/ncert-highlights"
              title="Highlights"
              subtitle="NCERT Key Points"
              icon={Sparkles}
              iconBg="bg-pink-500/20 text-pink-400 border border-pink-400/30"
            />

            {/* Tool 5: NCERT Reader (Teal square) */}
            <StudyToolItem
              to="/highlighted-ncert"
              title="NCERT Reader"
              subtitle="Chapter Summary & Line by Line"
              icon={BookOpen}
              iconBg="bg-teal-500/20 text-teal-400 border border-teal-400/30"
            />

            {/* Tool 6: Score Predictor (Orange/Amber square) */}
            <StudyToolItem
              to="/score-predictor"
              title="Score Predictor"
              subtitle="Estimate Your NEET Rank"
              icon={TrendingUp}
              iconBg="bg-amber-500/20 text-amber-400 border border-amber-400/30"
            />
          </div>
        </div>

        {/* =========================================================
            5. LIVE & COMMUNITY (3 Cards matching screenshot)
            ========================================================= */}
        <div>
          <div className="mb-2.5 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Users className="h-4 w-4 text-emerald-400" />
              <span className="text-xs font-black uppercase tracking-wider text-foreground sm:text-sm">
                LIVE & COMMUNITY
              </span>
              <span className="hidden text-xs text-muted-foreground sm:inline">
                — Compete. Discuss. Grow Together.
              </span>
            </div>
            <Link
              to="/community"
              className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 transition-colors hover:text-emerald-500 dark:text-emerald-400 dark:hover:text-emerald-300"
            >
              <span>View All</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            {/* Cash Contests */}
            <Link
              to="/contests"
              className="group flex items-center justify-between rounded-2xl border border-white/10 bg-card p-3 shadow-sm transition-all hover:border-amber-400/50 hover:bg-muted/50 dark:border-white/10 dark:bg-white/[0.03]"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400 border border-amber-400/30">
                  <Trophy className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-xs font-bold text-foreground group-hover:text-amber-500">
                    Cash Contests
                  </div>
                  <div className="truncate text-[10px] text-muted-foreground">
                    Win rewards & rank
                  </div>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-foreground" />
            </Link>

            {/* Battlegrounds */}
            <Link
              to="/battlegrounds"
              className="group flex items-center justify-between rounded-2xl border border-white/10 bg-card p-3 shadow-sm transition-all hover:border-blue-400/50 hover:bg-muted/50 dark:border-white/10 dark:bg-white/[0.03]"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-500/20 text-cyan-400 border border-cyan-400/30">
                  <Swords className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-xs font-bold text-foreground group-hover:text-cyan-500">
                    Battlegrounds
                  </div>
                  <div className="truncate text-[10px] text-muted-foreground">
                    1v1 & Group quiz wars
                  </div>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-foreground" />
            </Link>

            {/* Community */}
            <Link
              to="/community"
              className="group flex items-center justify-between rounded-2xl border border-white/10 bg-card p-3 shadow-sm transition-all hover:border-purple-400/50 hover:bg-muted/50 dark:border-white/10 dark:bg-white/[0.03]"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-purple-500/20 text-purple-400 border border-purple-400/30">
                  <Users className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-xs font-bold text-foreground group-hover:text-purple-500">
                    Community
                  </div>
                  <div className="truncate text-[10px] text-muted-foreground">
                    Ask, Discuss, Learn
                  </div>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-foreground" />
            </Link>
          </div>
        </div>

        {/* Target Setting Dialog */}
        <Dialog open={goalDialog} onOpenChange={setGoalDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Set Your Daily Target</DialogTitle>
              <DialogDescription>
                Set the number of MCQs you aim to solve each day to build exam stamina.
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
                      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                        goalDraft === preset
                          ? "border-emerald-400 bg-emerald-500/20 text-emerald-300"
                          : "border-white/15 bg-white/5 text-slate-300 hover:border-emerald-400/50 hover:text-white"
                      }`}
                    >
                      {preset} MCQs
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="custom-goal" className="text-xs font-semibold">
                  Or enter custom questions count
                </Label>
                <Input
                  id="custom-goal"
                  type="number"
                  min={5}
                  max={300}
                  value={goalDraft}
                  onChange={(e) => setGoalDraft(Number(e.target.value))}
                  placeholder="20"
                  className="h-10 rounded-xl"
                />
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="ghost" onClick={() => setGoalDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={saveDailyGoal}
                className="bg-primary text-primary-foreground font-bold"
              >
                Save Target
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </PageShell>
  );
}

/* =========================================================================
   Typewriter Greeting
   ========================================================================= */
function TypewriterGreeting({ name }: { name: string }) {
  const [displayText, setDisplayText] = useState("");
  const [isDone, setIsDone] = useState(false);

  useEffect(() => {
    const hour = new Date().getHours();
    let prefix = "Good morning";
    if (hour >= 12 && hour < 17) prefix = "Good afternoon";
    else if (hour >= 17) prefix = "Good evening";

    const target = `${prefix}, ${name}!`;
    let idx = 0;
    setDisplayText("");
    setIsDone(false);

    const interval = setInterval(() => {
      idx++;
      if (idx <= target.length) {
        setDisplayText(target.slice(0, idx));
      } else {
        setIsDone(true);
        clearInterval(interval);
      }
    }, 40);

    return () => clearInterval(interval);
  }, [name]);

  return (
    <div className="min-h-[1.75rem]">
      <h1 className="text-lg font-black tracking-tight text-white sm:text-2xl">
        <span>{displayText}</span>
        <span
          className={`ml-1 inline-block h-5 w-0.5 bg-emerald-300 align-middle ${isDone ? "opacity-0" : "animate-pulse"}`}
        />
      </h1>
    </div>
  );
}

/* =========================================================================
   Study Tool Item Helper Component
   ========================================================================= */
function StudyToolItem({
  to,
  params,
  title,
  subtitle,
  icon: Icon,
  iconBg,
}: {
  to: string;
  params?: Record<string, string>;
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
}) {
  return (
    <Link
      to={to as never}
      params={params as never}
      className="group flex items-center justify-between rounded-2xl border border-white/10 bg-card p-3 shadow-sm transition-all hover:border-emerald-400/50 hover:bg-muted/50 dark:border-white/10 dark:bg-white/[0.03]"
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${iconBg}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <div className="truncate text-xs font-bold text-foreground group-hover:text-emerald-500">
            {title}
          </div>
          <div className="truncate text-[10px] text-muted-foreground">{subtitle}</div>
        </div>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-foreground" />
    </Link>
  );
}
