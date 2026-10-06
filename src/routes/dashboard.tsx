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
      <div className="relative -mx-4 -my-10 px-4 py-8 sm:-mx-6 sm:-my-14 sm:px-6 sm:py-10 lg:-mx-8 lg:px-8 bg-gradient-to-b from-sky-50/60 via-teal-50/30 to-emerald-50/50 dark:from-[#08151f] dark:via-[#0a1c29] dark:to-[#06111a] min-h-[calc(100vh-4rem)]">
        <TrialBanner />

        <div className="mx-auto max-w-4xl space-y-4 pb-8">
        {/* =========================================================
            1. HERO GREETING & DAILY TARGET CARD (Matching Screenshot)
            ========================================================= */}
        <div className="relative overflow-hidden rounded-2xl border border-emerald-500/25 bg-gradient-to-br from-teal-600 via-emerald-600 to-cyan-700 p-4 text-white shadow-xl shadow-teal-900/10 border border-teal-200/40 dark:border-teal-500/30 dark:bg-gradient-to-br dark:from-[#0d2a2c] dark:via-[#092224] dark:to-[#06181b]">
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
              className="group relative overflow-hidden rounded-xl sm:rounded-2xl border bg-gradient-to-br from-blue-500 via-indigo-600 to-sky-600 p-2.5 sm:p-3.5 text-white shadow-md shadow-blue-500/15 border border-blue-200/50 transition-all hover:scale-[1.02] hover:shadow-xl dark:border-blue-500/30 dark:bg-gradient-to-br dark:from-[#0d2754] dark:via-[#091e42] dark:to-[#05132d]"
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
                  <div className="h-full rounded-full bg-cyan-400" style={{ width: `${subjectProgress.physics}%` }} />
                </div>
                <span className="text-[10px] sm:text-xs font-bold text-cyan-300">{subjectProgress.physics}%</span>
                <div className="hidden sm:flex h-5 w-5 items-center justify-center rounded-full bg-white/10 text-white/80 group-hover:bg-white/20 group-hover:text-white">
                  <ChevronRight className="h-3 w-3" />
                </div>
              </div>
            </Link>

            {/* Chemistry Card */}
            <Link
              to="/subjects/$subject"
              params={{ subject: "Chemistry" }}
              className="group relative overflow-hidden rounded-xl sm:rounded-2xl border border-teal-500/30 bg-gradient-to-br from-teal-500 via-emerald-600 to-cyan-600 p-2.5 sm:p-3.5 text-white shadow-md shadow-teal-500/15 border border-teal-200/50 transition-all hover:scale-[1.02] hover:shadow-xl dark:border-teal-500/30 dark:bg-gradient-to-br dark:from-[#07362d] dark:via-[#052822] dark:to-[#031916]"
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
                  <div className="h-full rounded-full bg-emerald-400" style={{ width: `${subjectProgress.chemistry}%` }} />
                </div>
                <span className="text-[10px] sm:text-xs font-bold text-emerald-300">{subjectProgress.chemistry}%</span>
                <div className="hidden sm:flex h-5 w-5 items-center justify-center rounded-full bg-white/10 text-white/80 group-hover:bg-white/20 group-hover:text-white">
                  <ChevronRight className="h-3 w-3" />
                </div>
              </div>
            </Link>

            {/* Biology Card */}
            <Link
              to="/subjects/$subject"
              params={{ subject: "Biology" }}
              className="group relative overflow-hidden rounded-xl sm:rounded-2xl border border-purple-500/30 bg-gradient-to-br from-purple-500 via-violet-600 to-indigo-600 p-2.5 sm:p-3.5 text-white shadow-md shadow-purple-500/15 border border-purple-200/50 transition-all hover:scale-[1.02] hover:shadow-xl dark:border-purple-500/30 dark:bg-gradient-to-br dark:from-[#2e1352] dark:via-[#210c3d] dark:to-[#150629]"
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
                  <div className="h-full rounded-full bg-purple-400" style={{ width: `${subjectProgress.biology}%` }} />
                </div>
                <span className="text-[10px] sm:text-xs font-bold text-purple-300">{subjectProgress.biology}%</span>
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
          <div className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-white via-emerald-50/50 to-teal-50/60 p-4 text-slate-800 shadow-md shadow-emerald-500/5 transition-all hover:border-emerald-400 hover:shadow-lg dark:border-emerald-500/30 dark:bg-gradient-to-br dark:from-[#0c2a22] dark:via-[#081e18] dark:to-[#051410] dark:text-white">
            {/* Top row */}
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-400/30">
                    <BarChart3 className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black tracking-wide text-foreground uppercase">
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

              <p className="mt-1 text-xs text-muted-foreground">Analyse. Learn. Improve Faster.</p>
            </div>

            {/* 3 Pills at bottom with balanced emerald gradient */}
            <div className="mt-6 grid grid-cols-3 gap-1.5">
              <Link
                to="/bookmarks"
                className="flex items-center justify-center gap-1.5 rounded-xl border border-emerald-200/80 bg-emerald-500/10 hover:bg-emerald-500/15 dark:border-emerald-500/30 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 px-2 py-2 text-[11px] font-semibold text-emerald-900 dark:text-emerald-200 shadow-xs transition-all hover:scale-[1.02]"
              >
                <Bookmark className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                <span className="truncate">Saved Questions</span>
              </Link>

              <Link
                to="/mistakes"
                className="flex items-center justify-center gap-1.5 rounded-xl border border-emerald-200/80 bg-emerald-500/10 hover:bg-emerald-500/15 dark:border-emerald-500/30 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 px-2 py-2 text-[11px] font-semibold text-emerald-900 dark:text-emerald-200 shadow-xs transition-all hover:scale-[1.02]"
              >
                <FileText className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                <span className="truncate">My Mistakes</span>
              </Link>

              <Link
                to="/analytics"
                className="flex items-center justify-center gap-1.5 rounded-xl border border-emerald-200/80 bg-emerald-500/10 hover:bg-emerald-500/15 dark:border-emerald-500/30 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 px-2 py-2 text-[11px] font-semibold text-emerald-900 dark:text-emerald-200 shadow-xs transition-all hover:scale-[1.02]"
              >
                <TrendingUp className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                <span className="truncate">Deep Analytics</span>
              </Link>
            </div>
          </div>

          {/* Card 2: GENERATE TEST (Top-Right) */}
          <div className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-sky-200/80 bg-gradient-to-br from-white via-sky-50/50 to-cyan-50/60 p-4 text-slate-800 shadow-md shadow-sky-500/5 transition-all hover:border-cyan-400 hover:shadow-lg dark:border-blue-500/30 dark:bg-gradient-to-br dark:from-[#0c2647] dark:via-[#081b33] dark:to-[#051224] dark:text-white">
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/20 text-cyan-400 border border-cyan-400/30">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black tracking-wide text-foreground uppercase">
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

              <p className="mt-1 text-xs text-muted-foreground">
                Create your own custom test with full control.
              </p>

              {/* 3 Selectors matching screenshot: Questions, Difficulty, Timer */}
              <div className="mt-3 grid grid-cols-3 gap-2">
                <div>
                  <div className="text-[10px] text-slate-600 dark:text-sky-200/70 font-medium mb-1">Questions</div>
                  <select
                    value={genQuestions}
                    onChange={(e) => setGenQuestions(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-200/80 bg-white dark:border-white/15 dark:bg-white/10 px-2 py-1 text-xs font-semibold text-slate-800 dark:text-white focus:outline-none focus:border-cyan-400"
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
                  <div className="text-[10px] text-slate-600 dark:text-sky-200/70 font-medium mb-1">Difficulty</div>
                  <select
                    value={genDifficulty}
                    onChange={(e) => setGenDifficulty(e.target.value)}
                    className="w-full rounded-lg border border-slate-200/80 bg-white dark:border-white/15 dark:bg-white/10 px-2 py-1 text-xs font-semibold text-slate-800 dark:text-white focus:outline-none focus:border-cyan-400"
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
                  <div className="text-[10px] text-slate-600 dark:text-sky-200/70 font-medium mb-1">Timer</div>
                  <select
                    value={genTimer}
                    onChange={(e) => setGenTimer(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-200/80 bg-white dark:border-white/15 dark:bg-white/10 px-2 py-1 text-xs font-semibold text-slate-800 dark:text-white focus:outline-none focus:border-cyan-400"
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
            className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-amber-200/80 bg-gradient-to-br from-white via-amber-50/50 to-orange-50/60 p-4 text-slate-800 shadow-md shadow-amber-500/5 transition-all hover:border-amber-400 hover:shadow-lg dark:border-amber-500/30 dark:bg-gradient-to-br dark:from-[#321c06] dark:via-[#221303] dark:to-[#160c02] dark:text-white"
          >
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400 border border-amber-400/30">
                    <Trophy className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black tracking-wide text-foreground uppercase">
                      MOCK TESTS
                    </h3>
                  </div>
                </div>
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-white/80 transition-colors group-hover:bg-white/20 group-hover:text-white">
                  <ChevronRight className="h-3.5 w-3.5" />
                </div>
              </div>

              <p className="mt-1 text-xs text-muted-foreground">
                Full NEET syllabus simulation with real exam experience.
              </p>
            </div>

            {/* 3 Pills at bottom with balanced amber gradient */}
            <div className="mt-6 grid grid-cols-3 gap-1.5">
              <div className="flex items-center justify-center gap-1.5 rounded-xl border border-amber-200/80 bg-amber-500/10 dark:border-amber-500/30 dark:bg-amber-950/40 px-2 py-2 text-[11px] font-semibold text-amber-900 dark:text-amber-200 shadow-xs">
                <FileText className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                <span className="truncate">Full Syllabus</span>
              </div>

              <div className="flex items-center justify-center gap-1.5 rounded-xl border border-amber-200/80 bg-amber-500/10 dark:border-amber-500/30 dark:bg-amber-950/40 px-2 py-2 text-[11px] font-semibold text-amber-900 dark:text-amber-200 shadow-xs">
                <Clock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                <span className="truncate">Real Pattern</span>
              </div>

              <div className="flex items-center justify-center gap-1.5 rounded-xl border border-amber-200/80 bg-amber-500/10 dark:border-amber-500/30 dark:bg-amber-950/40 px-2 py-2 text-[11px] font-semibold text-amber-900 dark:text-amber-200 shadow-xs">
                <BarChart3 className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                <span className="truncate">Detailed Analysis</span>
              </div>
            </div>
          </Link>

          {/* Card 4: PYQs (Bottom-Right) */}
          <Link
            to="/pyqs"
            className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-blue-200/80 bg-gradient-to-br from-white via-blue-50/50 to-indigo-50/60 p-4 text-slate-800 shadow-md shadow-blue-500/5 transition-all hover:border-blue-400 hover:shadow-lg dark:border-blue-500/30 dark:bg-gradient-to-br dark:from-[#0a2345] dark:via-[#061932] dark:to-[#041021] dark:text-white"
          >
            <div>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/20 text-cyan-400 border border-cyan-400/30">
                    <BookOpen className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black tracking-wide text-foreground uppercase">PYQs</h3>
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

              <p className="mt-1 text-xs text-muted-foreground">
                Previous Year Questions (NEET 2013 – 2025)
              </p>
            </div>

            {/* 3 Pills at bottom with balanced cyan/sky gradient */}
            <div className="mt-4 grid grid-cols-3 gap-1.5">
              <div className="flex items-center justify-center gap-1.5 rounded-xl border border-sky-200/80 bg-sky-500/10 dark:border-sky-500/30 dark:bg-sky-950/40 px-2 py-2 text-[11px] font-semibold text-sky-900 dark:text-sky-200 shadow-xs">
                <CalendarDays className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
                <span className="truncate">Year-wise</span>
              </div>

              <div className="flex items-center justify-center gap-1.5 rounded-xl border border-sky-200/80 bg-sky-500/10 dark:border-sky-500/30 dark:bg-sky-950/40 px-2 py-2 text-[11px] font-semibold text-sky-900 dark:text-sky-200 shadow-xs">
                <LayoutGrid className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
                <span className="truncate">Chapter-wise</span>
              </div>

              <div className="flex items-center justify-center gap-1.5 rounded-xl border border-sky-200/80 bg-sky-500/10 dark:border-sky-500/30 dark:bg-sky-950/40 px-2 py-2 text-[11px] font-semibold text-sky-900 dark:text-sky-200 shadow-xs">
                <FileCheck className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
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

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-3.5">
            {/* Tool 1: Short Notes (Purple & Violet Cube) */}
            <StudyToolItem
              to="/highlighted-ncert"
              title="Short Notes"
              subtitle="Concise & High Yield"
              badge="High Yield"
              icon={FileText}
              gradientClass="bg-gradient-to-br from-violet-500/15 via-purple-500/10 to-indigo-500/20 dark:from-purple-950/40 dark:via-violet-950/30 dark:to-indigo-950/50"
              iconGradient="bg-gradient-to-br from-violet-500 to-purple-600 shadow-purple-500/30"
              borderClass="border-purple-200/80 dark:border-purple-500/30 hover:border-purple-400 dark:hover:border-purple-400/60 shadow-purple-500/5"
            />

            {/* Tool 2: Flashcards (Emerald & Teal Cube) */}
            <StudyToolItem
              to="/flashcards"
              title="Flashcards"
              subtitle="Revise Anytime Anywhere"
              badge="Spaced Rep"
              icon={Layers}
              gradientClass="bg-gradient-to-br from-emerald-500/15 via-teal-500/10 to-cyan-500/20 dark:from-emerald-950/40 dark:via-teal-950/30 dark:to-cyan-950/50"
              iconGradient="bg-gradient-to-br from-emerald-500 to-teal-600 shadow-emerald-500/30"
              borderClass="border-emerald-200/80 dark:border-emerald-500/30 hover:border-emerald-400 dark:hover:border-emerald-400/60 shadow-emerald-500/5"
            />

            {/* Tool 3: Highlights (Pink & Rose Cube) */}
            <StudyToolItem
              to="/ncert-highlights"
              title="Highlights"
              subtitle="NCERT Key Points"
              badge="NCERT"
              icon={Sparkles}
              gradientClass="bg-gradient-to-br from-pink-500/15 via-rose-500/10 to-fuchsia-500/20 dark:from-pink-950/40 dark:via-rose-950/30 dark:to-fuchsia-950/50"
              iconGradient="bg-gradient-to-br from-pink-500 to-rose-600 shadow-pink-500/30"
              borderClass="border-pink-200/80 dark:border-pink-500/30 hover:border-pink-400 dark:hover:border-pink-400/60 shadow-pink-500/5"
            />

            {/* Tool 4: Score Predictor (Amber & Orange Cube) */}
            <StudyToolItem
              to="/score-predictor"
              title="Score Predictor"
              subtitle="Estimate NEET Rank"
              badge="AI Rank"
              icon={TrendingUp}
              gradientClass="bg-gradient-to-br from-amber-500/15 via-orange-500/10 to-yellow-500/20 dark:from-amber-950/40 dark:via-orange-950/30 dark:to-yellow-950/50"
              iconGradient="bg-gradient-to-br from-amber-500 to-orange-600 shadow-amber-500/30"
              borderClass="border-amber-200/80 dark:border-amber-500/30 hover:border-amber-400 dark:hover:border-amber-400/60 shadow-amber-500/5"
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

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {/* Live Contests */}
            <Link
              to="/contests"
              className="group relative flex items-center justify-between overflow-hidden rounded-2xl border border-amber-200/80 bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-amber-500/15 p-3.5 shadow-sm transition-all hover:scale-[1.02] hover:border-amber-400 dark:border-amber-500/30 dark:bg-gradient-to-br dark:from-amber-950/40 dark:via-orange-950/20 dark:to-amber-950/50"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-sm shadow-amber-500/30">
                  <Trophy className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-xs font-black text-foreground group-hover:text-amber-500">
                      Live Contests
                    </span>
                    <span className="rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-bold text-amber-600 dark:text-amber-300">
                      Rank
                    </span>
                  </div>
                  <div className="truncate text-[10px] text-muted-foreground font-medium">
                    Compete live with peers
                  </div>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-amber-500 transition-transform group-hover:translate-x-0.5" />
            </Link>

            {/* 1v1 Battles */}
            <Link
              to="/battlegrounds"
              className="group relative flex items-center justify-between overflow-hidden rounded-2xl border border-rose-200/80 bg-gradient-to-br from-rose-500/10 via-red-500/5 to-pink-500/15 p-3.5 shadow-sm transition-all hover:scale-[1.02] hover:border-rose-400 dark:border-rose-500/30 dark:bg-gradient-to-br dark:from-rose-950/40 dark:via-red-950/20 dark:to-pink-950/50"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 to-red-600 text-white shadow-sm shadow-rose-500/30">
                  <Swords className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-xs font-black text-foreground group-hover:text-rose-500">
                      1v1 Battleground
                    </span>
                    <span className="rounded-full bg-rose-500/20 px-1.5 py-0.5 text-[9px] font-bold text-rose-600 dark:text-rose-300">
                      Duels
                    </span>
                  </div>
                  <div className="truncate text-[10px] text-muted-foreground font-medium">
                    Fast-paced quiz matches
                  </div>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-rose-500 transition-transform group-hover:translate-x-0.5" />
            </Link>

            {/* Community & Doubts */}
            <Link
              to="/community"
              className="group relative flex items-center justify-between overflow-hidden rounded-2xl border border-violet-200/80 bg-gradient-to-br from-violet-500/10 via-purple-500/5 to-indigo-500/15 p-3.5 shadow-sm transition-all hover:scale-[1.02] hover:border-violet-400 dark:border-violet-500/30 dark:bg-gradient-to-br dark:from-violet-950/40 dark:via-purple-950/20 dark:to-indigo-950/50"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-sm shadow-violet-500/30">
                  <Users className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-xs font-black text-foreground group-hover:text-violet-500">
                      Community
                    </span>
                    <span className="rounded-full bg-violet-500/20 px-1.5 py-0.5 text-[9px] font-bold text-violet-600 dark:text-violet-300">
                      Discuss
                    </span>
                  </div>
                  <div className="truncate text-[10px] text-muted-foreground font-medium">
                    Ask doubts &amp; share tips
                  </div>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-violet-500 transition-transform group-hover:translate-x-0.5" />
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
  badge,
  icon: Icon,
  gradientClass,
  iconGradient,
  borderClass,
}: {
  to: string;
  params?: Record<string, string>;
  title: string;
  subtitle: string;
  badge?: string;
  icon: React.ComponentType<{ className?: string }>;
  gradientClass?: string;
  iconGradient?: string;
  borderClass?: string;
}) {
  return (
    <Link
      to={to as never}
      params={params as never}
      className={cn(
        "group relative flex flex-col justify-between overflow-hidden rounded-2xl border p-3.5 transition-all duration-200 hover:scale-[1.03] hover:shadow-lg active:scale-[0.98]",
        gradientClass || "bg-card",
        borderClass || "border-border/70"
      )}
    >
      {/* Top Row: Icon + Badge */}
      <div className="flex items-start justify-between gap-2">
        <div
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-xl text-white shadow-md transition-transform group-hover:rotate-3",
            iconGradient || "bg-primary"
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
        {badge && (
          <span className="rounded-full bg-white/70 dark:bg-white/10 backdrop-blur-xs px-2 py-0.5 text-[9px] font-bold text-foreground/80 border border-black/5 dark:border-white/10">
            {badge}
          </span>
        )}
      </div>

      {/* Bottom Content */}
      <div className="mt-3">
        <div className="text-xs sm:text-sm font-black text-foreground tracking-tight group-hover:underline decoration-primary/40 underline-offset-2">
          {title}
        </div>
        <div className="text-[10px] sm:text-[11px] text-muted-foreground font-medium line-clamp-1 mt-0.5">
          {subtitle}
        </div>
      </div>
    </Link>
  );
}
