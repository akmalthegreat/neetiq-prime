import { cn } from "@/lib/utils";
import { DrAkzaLoader } from "@/components/dr-akza-loader";
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
  Plus,
  CheckSquare,
  ListTodo,
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
                physics: counts.physics.total > 0 ? Math.min(100, Math.round((counts.physics.correct / counts.physics.total) * 100)) : 0,
                chemistry: counts.chemistry.total > 0 ? Math.min(100, Math.round((counts.chemistry.correct / counts.chemistry.total) * 100)) : 0,
                biology: counts.biology.total > 0 ? Math.min(100, Math.round((counts.biology.correct / counts.biology.total) * 100)) : 0,
              });
            }
          } catch (err) {
            console.error("Error computing subject progress:", err);
          }
        })();
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
      const accuracy = solved > 0 ? Math.round((correct / solved) * 100) : 0;
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

  const firstName = profile?.full_name?.trim()?.split(" ")[0] || user?.email?.split("@")[0] || "Doctor";

  return (
    <PageShell>
      <div className="relative -mx-4 -my-8 overflow-hidden px-4 py-6 sm:-mx-6 sm:-my-10 sm:px-6 sm:py-8 lg:-mx-8 lg:px-8 bg-slate-50/60 dark:bg-[#070d18] min-h-[calc(100vh-4rem)]">
        {/* Subtle, refined background ambient glow */}
        <div className="pointer-events-none absolute -top-32 -left-20 h-96 w-96 rounded-full bg-teal-400/10 blur-3xl dark:bg-teal-500/10" />
        <div className="pointer-events-none absolute top-1/3 -right-24 h-96 w-96 rounded-full bg-blue-400/10 blur-3xl dark:bg-blue-500/10" />
        <div className="pointer-events-none absolute bottom-10 left-1/4 h-80 w-80 rounded-full bg-indigo-400/10 blur-3xl dark:bg-indigo-500/10" />

        <TrialBanner />

        <div className="relative z-10 mx-auto max-w-4xl space-y-4 pb-10">
          {/* =========================================================
              1. HERO GREETING & DAILY TARGET (Sleek Clean Card)
              ========================================================= */}
          <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white/90 p-4 sm:p-5 text-slate-800 shadow-sm backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-900/80 dark:text-slate-100 transition-all">
            {/* Soft decorative accent */}
            <div className="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full bg-gradient-to-br from-teal-400/15 via-emerald-400/10 to-transparent blur-2xl" />

            <div className="relative z-10">
              {/* Top Row: Greeting + Study Streak */}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <TypewriterGreeting name={firstName} />
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 sm:text-sm font-medium">
                    Discipline today = Doctor tomorrow. You're on track!
                  </p>
                </div>

                {/* Study Streak Badge */}
                <Link
                  to="/leaderboard"
                  className="group flex shrink-0 flex-col items-center justify-center rounded-xl border border-amber-200/80 bg-amber-50/70 px-3 py-1.5 transition-all hover:bg-amber-100/70 dark:border-amber-500/20 dark:bg-amber-950/30 dark:hover:bg-amber-900/40 shadow-xs"
                >
                  <div className="flex items-center gap-1 text-xs font-black text-amber-600 dark:text-amber-400">
                    <Flame className="h-3.5 w-3.5 fill-amber-500 text-amber-500 dark:fill-amber-400 dark:text-amber-400" />
                    <span>{streak}d</span>
                  </div>
                  <span className="text-[10px] font-semibold text-amber-700/80 dark:text-amber-300/80">Streak</span>
                </Link>
              </div>

              {/* To-Do List & Time Ticket Quick Launcher */}
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2.5 rounded-xl border border-teal-200/70 bg-gradient-to-r from-teal-50/80 to-emerald-50/80 p-2.5 dark:border-teal-900/40 dark:bg-gradient-to-r dark:from-teal-950/40 dark:to-emerald-950/30">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-600 text-white shadow-xs">
                    <ListTodo className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                      Today's Study Plan &amp; Time Tickets
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">
                      Set targeted time tickets &amp; stay disciplined
                    </div>
                  </div>
                </div>

                <Link
                  to="/todo"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 px-3 py-1.5 text-xs font-bold text-white shadow-xs transition-all active:scale-[0.98]"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Create Today's To-Do List</span>
                </Link>
              </div>

              {/* Daily Target Section */}
              <div className="mt-3.5 space-y-2">
                <div className="flex items-center justify-between text-xs sm:text-sm">
                  <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
                      <Target className="h-3.5 w-3.5" />
                    </div>
                    <span className="font-bold text-slate-900 dark:text-white">Daily Target</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                      {todayCorrect + todayWrong} / {dailyGoal} MCQs ({progressPercent}%)
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setGoalDialog(true)}
                    className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                  >
                    <Pencil className="h-3 w-3" />
                    <span>Edit Target</span>
                  </button>
                </div>

                {/* Progress Bar */}
                <div className="relative h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-700"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>

              {/* 4 Stats Metrics Row */}
              <div className="mt-3.5 grid grid-cols-4 gap-2 border-t border-slate-100 dark:border-slate-800/80 pt-3 text-center">
                <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200/60 bg-slate-50/80 p-2 dark:border-slate-800 dark:bg-slate-800/50">
                  <div className="flex items-center gap-1 text-[11px] font-medium text-slate-600 dark:text-slate-400">
                    <FileText className="h-3.5 w-3.5 text-blue-500" />
                    <span>Done</span>
                  </div>
                  <div className="mt-0.5 text-base font-extrabold text-slate-900 dark:text-white sm:text-lg">
                    {todayQuestions}
                  </div>
                </div>

                <div className="flex flex-col items-center justify-center rounded-xl border border-emerald-200/60 bg-emerald-50/50 p-2 dark:border-emerald-950/60 dark:bg-emerald-950/30">
                  <div className="flex items-center gap-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    <span>Correct</span>
                  </div>
                  <div className="mt-0.5 text-base font-extrabold text-emerald-600 dark:text-emerald-400 sm:text-lg">
                    {todayCorrect}
                  </div>
                </div>

                <div className="flex flex-col items-center justify-center rounded-xl border border-rose-200/60 bg-rose-50/50 p-2 dark:border-rose-950/60 dark:bg-rose-950/30">
                  <div className="flex items-center gap-1 text-[11px] font-medium text-rose-700 dark:text-rose-400">
                    <XCircle className="h-3.5 w-3.5 text-rose-500" />
                    <span>Wrong</span>
                  </div>
                  <div className="mt-0.5 text-base font-extrabold text-rose-600 dark:text-rose-400 sm:text-lg">
                    {todayWrong}
                  </div>
                </div>

                <div className="flex flex-col items-center justify-center rounded-xl border border-teal-200/60 bg-teal-50/50 p-2 dark:border-teal-950/60 dark:bg-teal-950/30">
                  <div className="flex items-center gap-1 text-[11px] font-medium text-teal-700 dark:text-teal-400">
                    <Clock className="h-3.5 w-3.5 text-teal-500" />
                    <span>Accuracy</span>
                  </div>
                  <div className="mt-0.5 text-base font-extrabold text-teal-600 dark:text-teal-400 sm:text-lg">
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
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Zap className="h-4 w-4 fill-emerald-500 text-emerald-500" />
                <span className="text-xs font-black uppercase tracking-wider text-foreground sm:text-sm">
                  QUICK PRACTICE
                </span>
                <span className="hidden text-xs text-muted-foreground sm:inline">
                  — Jump into subject-wise practice
                </span>
              </div>
              <Link
                to="/dpp"
                className="inline-flex items-center gap-1 text-xs font-bold text-teal-600 transition-colors hover:text-teal-700 dark:text-teal-400 dark:hover:text-teal-300"
              >
                <span>View All Subjects</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {/* Physics */}
              <Link
                to="/subjects/"
                params={{ subject: "Physics" }}
                className="group relative overflow-hidden rounded-xl border border-slate-200/80 bg-white p-3 sm:p-4 text-slate-800 shadow-xs transition-all hover:border-sky-400 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:text-white"
              >
                <div className="flex items-center justify-between">
                  <div className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-lg bg-sky-500/15 text-sky-600 dark:bg-sky-500/20 dark:text-sky-400">
                    <Atom className="h-4 w-4 sm:h-5 sm:w-5" />
                  </div>
                  <span className="text-[11px] font-bold text-sky-600 dark:text-sky-400">{subjectProgress.physics}%</span>
                </div>
                <div className="mt-2">
                  <div className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-sky-600 dark:text-white truncate">
                    Physics
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                    {subjectCounts.physics.toLocaleString()} Qs
                  </div>
                </div>
                <div className="mt-2 relative h-1 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div className="h-full rounded-full bg-sky-500" style={{ width: `${subjectProgress.physics}%` }} />
                </div>
              </Link>

              {/* Chemistry */}
              <Link
                to="/subjects/"
                params={{ subject: "Chemistry" }}
                className="group relative overflow-hidden rounded-xl border border-slate-200/80 bg-white p-3 sm:p-4 text-slate-800 shadow-xs transition-all hover:border-teal-400 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:text-white"
              >
                <div className="flex items-center justify-between">
                  <div className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-lg bg-teal-500/15 text-teal-600 dark:bg-teal-500/20 dark:text-teal-400">
                    <FlaskConical className="h-4 w-4 sm:h-5 sm:w-5" />
                  </div>
                  <span className="text-[11px] font-bold text-teal-600 dark:text-teal-400">{subjectProgress.chemistry}%</span>
                </div>
                <div className="mt-2">
                  <div className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-teal-600 dark:text-white truncate">
                    Chemistry
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                    {subjectCounts.chemistry.toLocaleString()} Qs
                  </div>
                </div>
                <div className="mt-2 relative h-1 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div className="h-full rounded-full bg-teal-500" style={{ width: `${subjectProgress.chemistry}%` }} />
                </div>
              </Link>

              {/* Biology */}
              <Link
                to="/subjects/"
                params={{ subject: "Biology" }}
                className="group relative overflow-hidden rounded-xl border border-slate-200/80 bg-white p-3 sm:p-4 text-slate-800 shadow-xs transition-all hover:border-purple-400 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:text-white"
              >
                <div className="flex items-center justify-between">
                  <div className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-lg bg-purple-500/15 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400">
                    <Dna className="h-4 w-4 sm:h-5 sm:w-5" />
                  </div>
                  <span className="text-[11px] font-bold text-purple-600 dark:text-purple-400">{subjectProgress.biology}%</span>
                </div>
                <div className="mt-2">
                  <div className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-purple-600 dark:text-white truncate">
                    Biology
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                    {subjectCounts.biology.toLocaleString()} Qs
                  </div>
                </div>
                <div className="mt-2 relative h-1 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div className="h-full rounded-full bg-purple-500" style={{ width: `${subjectProgress.biology}%` }} />
                </div>
              </Link>
            </div>
          </div>

          {/* =========================================================
              3. 2x2 FEATURE GRID (Improvement Zone, Generate Test, Mock Tests, PYQs)
              ========================================================= */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {/* Card 1: IMPROVEMENT ZONE */}
            <div className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 text-slate-800 shadow-xs hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:text-white transition-all">
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
                      <BarChart3 className="h-4 w-4" />
                    </div>
                    <h3 className="text-sm font-black tracking-wide text-foreground uppercase">
                      IMPROVEMENT ZONE
                    </h3>
                  </div>
                  <Link
                    to="/analytics"
                    className="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
                    aria-label="Improvement Zone"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </div>

                <p className="mt-1 text-xs text-muted-foreground">
                  Analyse. Learn. Improve Faster.
                </p>
              </div>

              {/* Action buttons with full legible labels */}
              <div className="mt-4 grid grid-cols-3 gap-1.5">
                <Link
                  to="/bookmarks"
                  className="flex items-center justify-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-1.5 py-2 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors"
                >
                  <Bookmark className="h-3 w-3 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <span className="truncate">Bookmarks</span>
                </Link>

                <Link
                  to="/mistakes"
                  className="flex items-center justify-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-1.5 py-2 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors"
                >
                  <FileText className="h-3 w-3 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <span className="truncate">Mistakes</span>
                </Link>

                <Link
                  to="/analytics"
                  className="flex items-center justify-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-1.5 py-2 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors"
                >
                  <TrendingUp className="h-3 w-3 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <span className="truncate">Analytics</span>
                </Link>
              </div>
            </div>

            {/* Card 2: GENERATE TEST */}
            <div className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 text-slate-800 shadow-xs hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:text-white transition-all">
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/15 text-sky-600 dark:bg-sky-500/20 dark:text-sky-400">
                      <Sparkles className="h-4 w-4" />
                    </div>
                    <h3 className="text-sm font-black tracking-wide text-foreground uppercase">
                      GENERATE TEST
                    </h3>
                  </div>
                  <Link
                    to="/generate"
                    aria-label="Generate Test"
                    className="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </div>

                <p className="mt-1 text-xs text-muted-foreground">
                  Create your custom test with full control.
                </p>

                {/* 3 Selectors */}
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mb-1">Questions</div>
                    <select
                      value={genQuestions}
                      onChange={(e) => setGenQuestions(Number(e.target.value))}
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800 px-2 py-1 text-xs font-semibold text-slate-800 dark:text-white focus:outline-none"
                    >
                      <option value={20}>20</option>
                      <option value={30}>30</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                    </select>
                  </div>

                  <div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mb-1">Difficulty</div>
                    <select
                      value={genDifficulty}
                      onChange={(e) => setGenDifficulty(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800 px-2 py-1 text-xs font-semibold text-slate-800 dark:text-white focus:outline-none"
                    >
                      <option value="Mixed">Mixed</option>
                      <option value="Easy">Easy</option>
                      <option value="Medium">Medium</option>
                      <option value="Hard">Hard</option>
                    </select>
                  </div>

                  <div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mb-1">Timer</div>
                    <select
                      value={genTimer}
                      onChange={(e) => setGenTimer(Number(e.target.value))}
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800 px-2 py-1 text-xs font-semibold text-slate-800 dark:text-white focus:outline-none"
                    >
                      <option value={30}>30 min</option>
                      <option value={60}>60 min</option>
                      <option value={90}>90 min</option>
                      <option value={180}>180 min</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Create Test Button */}
              <div className="mt-3.5">
                <Button
                  asChild
                  className="w-full rounded-xl bg-teal-600 hover:bg-teal-700 font-bold text-white shadow-xs transition-all"
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

            {/* Card 3: MOCK TESTS */}
            <Link
              to="/mocks"
              className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 text-slate-800 shadow-xs hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:text-white transition-all"
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
                      <Trophy className="h-4 w-4" />
                    </div>
                    <h3 className="text-sm font-black tracking-wide text-foreground uppercase">
                      MOCK TESTS
                    </h3>
                  </div>
                  <div className="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground group-hover:text-foreground">
                    <ChevronRight className="h-4 w-4" />
                  </div>
                </div>

                <p className="mt-1 text-xs text-muted-foreground">
                  Full NEET syllabus simulation with real exam experience.
                </p>
              </div>

              {/* 3 Pills */}
              <div className="mt-4 grid grid-cols-3 gap-1.5">
                <div className="flex items-center justify-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-1.5 py-2 text-[11px] font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-300">
                  <FileCheck className="h-3 w-3 shrink-0 text-amber-600 dark:text-amber-400" />
                  <span className="truncate">Full Tests</span>
                </div>

                <div className="flex items-center justify-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-1.5 py-2 text-[11px] font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-300">
                  <Clock className="h-3 w-3 shrink-0 text-amber-600 dark:text-amber-400" />
                  <span className="truncate">Real Pattern</span>
                </div>

                <div className="flex items-center justify-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-1.5 py-2 text-[11px] font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-300">
                  <BarChart3 className="h-3 w-3 shrink-0 text-amber-600 dark:text-amber-400" />
                  <span className="truncate">Rank Predict</span>
                </div>
              </div>
            </Link>

            {/* Card 4: PYQs */}
            <Link
              to="/pyqs"
              className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 text-slate-800 shadow-xs hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:text-white transition-all"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/15 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400">
                      <BookOpen className="h-4 w-4" />
                    </div>
                    <h3 className="text-sm font-black tracking-wide text-foreground uppercase">
                      PYQS
                    </h3>
                  </div>

                  <div className="flex items-center gap-1">
                    <span className="rounded-md bg-blue-500/10 px-1.5 py-0.5 text-[9px] font-bold text-blue-600 dark:text-blue-400">
                      2013-2025
                    </span>
                    <div className="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground group-hover:text-foreground">
                      <ChevronRight className="h-4 w-4" />
                    </div>
                  </div>
                </div>

                <p className="mt-1 text-xs text-muted-foreground">
                  Previous Year Questions (NEET 2013 – 2025)
                </p>
              </div>

              {/* 3 Pills */}
              <div className="mt-4 grid grid-cols-3 gap-1.5">
                <div className="flex items-center justify-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-1.5 py-2 text-[11px] font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-300">
                  <CalendarDays className="h-3 w-3 shrink-0 text-blue-600 dark:text-blue-400" />
                  <span className="truncate">Year-wise</span>
                </div>

                <div className="flex items-center justify-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-1.5 py-2 text-[11px] font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-300">
                  <LayoutGrid className="h-3 w-3 shrink-0 text-blue-600 dark:text-blue-400" />
                  <span className="truncate">Chapter</span>
                </div>

                <div className="flex items-center justify-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-1.5 py-2 text-[11px] font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-300">
                  <FileCheck className="h-3 w-3 shrink-0 text-blue-600 dark:text-blue-400" />
                  <span className="truncate">Solutions</span>
                </div>
              </div>
            </Link>
          </div>

          {/* =========================================================
              4. STUDY TOOLS (Clean 4-Card Grid)
              ========================================================= */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Layers className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <span className="text-xs font-black uppercase tracking-wider text-foreground sm:text-sm">
                  STUDY TOOLS
                </span>
                <span className="hidden text-xs text-muted-foreground sm:inline">
                  — Everything you need to study smarter
                </span>
              </div>
              <Link
                to="/flashcards"
                className="inline-flex items-center gap-1 text-xs font-bold text-teal-600 transition-colors hover:text-teal-700 dark:text-teal-400 dark:hover:text-teal-300"
              >
                <span>View All Tools</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
              {/* Short Notes */}
              <StudyToolItem
                to="/highlighted-ncert"
                title="Short Notes"
                subtitle="Concise & High Yield"
                badge="High Yield"
                icon={FileText}
                badgeClass="bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20"
                iconClass="bg-violet-500/15 text-violet-600 dark:text-violet-400"
              />

              {/* Flashcards */}
              <StudyToolItem
                to="/flashcards"
                title="Flashcards"
                subtitle="Revise Anytime Anywhere"
                badge="Spaced Rep"
                icon={Layers}
                badgeClass="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                iconClass="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
              />

              {/* Highlights */}
              <StudyToolItem
                to="/ncert-highlights"
                title="Highlights"
                subtitle="NCERT Key Points"
                badge="NCERT"
                icon={Sparkles}
                badgeClass="bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                iconClass="bg-rose-500/15 text-rose-600 dark:text-rose-400"
              />

              {/* Score Predictor */}
              <StudyToolItem
                to="/score-predictor"
                title="Score Predictor"
                subtitle="Estimate NEET Rank"
                badge="AI Rank"
                icon={TrendingUp}
                badgeClass="bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                iconClass="bg-amber-500/15 text-amber-600 dark:text-amber-400"
              />
            </div>
          </div>

          {/* =========================================================
              5. LIVE & COMMUNITY
              ========================================================= */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Users className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <span className="text-xs font-black uppercase tracking-wider text-foreground sm:text-sm">
                  LIVE &amp; COMMUNITY
                </span>
              </div>
              <Link
                to="/community"
                className="inline-flex items-center gap-1 text-xs font-bold text-teal-600 transition-colors hover:text-teal-700 dark:text-teal-400 dark:hover:text-teal-300"
              >
                <span>View All</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <Link
                to="/community"
                className="group relative flex items-center justify-between overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-xs transition-all hover:border-violet-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 text-violet-600 dark:bg-violet-500/20 dark:text-violet-400">
                    <Users className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-xs font-black text-foreground group-hover:text-violet-600">
                        Community
                      </span>
                      <span className="rounded-full bg-violet-500/10 px-1.5 py-0.5 text-[9px] font-bold text-violet-600 dark:text-violet-400">
                        Discuss
                      </span>
                    </div>
                    <div className="truncate text-[11px] text-muted-foreground">
                      Ask doubts &amp; share tips with NEET aspirants
                    </div>
                  </div>
                </div>
                <div className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground group-hover:text-foreground">
                  <ChevronRight className="h-4 w-4" />
                </div>
              </Link>
            </div>
          </div>

          {/* Goal Dialog */}
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
                        className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all ${
                          goalDraft === preset
                            ? "border-primary bg-primary text-primary-foreground shadow-sm"
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
                  className="bg-teal-600 hover:bg-teal-700 text-white font-bold"
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
  const [isDone, setIsDone] = useState(false);

  useEffect(() => {
    const hour = new Date().getHours();
    const salutation =
      hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
    const target = `${salutation}, ${name || "student"}!`;

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
      <h1 className="text-lg font-black tracking-tight text-slate-900 dark:text-white sm:text-2xl">
        <span>{displayText}</span>
        <span
          className="ml-1 inline-block h-5 w-0.5 animate-pulse bg-primary align-middle"
        />
      </h1>
    </div>
  );
}

/* =========================================================================
   Study Tool Item
   ========================================================================= */
function StudyToolItem({
  to,
  params,
  title,
  subtitle,
  badge,
  icon: Icon,
  badgeClass,
  iconClass,
}: {
  to: string;
  params?: Record<string, string>;
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
      params={params as never}
      className="group relative flex flex-col justify-between overflow-hidden rounded-xl border border-slate-200/80 bg-white p-3.5 transition-all hover:border-slate-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 active:scale-[0.98]"
    >
      <div className="flex items-start justify-between gap-2">
        <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg", iconClass || "bg-slate-100 text-slate-700")}>
          <Icon className="h-4 w-4" />
        </div>
        {badge && (
          <span className={cn("rounded-md px-1.5 py-0.5 text-[9px] font-bold", badgeClass || "bg-slate-100 text-slate-600")}>
            {badge}
          </span>
        )}
      </div>

      <div className="mt-3">
        <div className="text-xs sm:text-sm font-black text-foreground tracking-tight group-hover:text-teal-600">
          {title}
        </div>
        <div className="text-[10px] text-muted-foreground font-medium line-clamp-1 mt-0.5">
          {subtitle}
        </div>
      </div>
    </Link>
  );
}
