import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { toast } from "sonner";
import { PageShell } from "@/components/page-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
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
  ArrowRight,
  CalendarDays,
  Flame,
  Sparkles,
  Atom,
  FlaskConical,
  Leaf,
  Dna,
  SlidersHorizontal,
  Brain,
  FileText,
  BookMarked,
  RefreshCw,
  TrendingUp,
  Trophy,
  Gift,
  MessageSquare,
  Layers,
  Users,
  Highlighter,
  Route as RouteIcon,
  Target,
  Swords,
  Crown,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Clock,
  ChevronRight,
  BookOpen,
  Award,
  Zap,
  Check,
  GraduationCap,
  BellRing,
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

const SUBJECTS = [
  {
    name: "Physics",
    icon: Atom,
    tint: "from-blue-600 to-indigo-700",
    ring: "ring-blue-500/30",
    progress: "42%",
    questions: "320 Qs",
  },
  {
    name: "Chemistry",
    icon: FlaskConical,
    tint: "from-rose-500 to-red-600",
    ring: "ring-rose-500/30",
    progress: "38%",
    questions: "280 Qs",
  },
  {
    name: "Zoology",
    icon: Leaf,
    tint: "from-emerald-500 to-teal-600",
    ring: "ring-emerald-500/30",
    progress: "56%",
    questions: "310 Qs",
  },
  {
    name: "Botany",
    icon: Dna,
    tint: "from-purple-500 to-indigo-600",
    ring: "ring-purple-500/30",
    progress: "48%",
    questions: "290 Qs",
  },
];

const PRESET_GOALS = [20, 30, 50, 75, 100];

function Dashboard() {
  const { user, profile, isAdmin, loading, refresh } = useAuth();
  const nav = useNavigate();
  const [daily, setDaily] = useState<Test | null | undefined>(undefined);
  const [streak, setStreak] = useState<number>(4);
  const [todayAttempts, setTodayAttempts] = useState<TodayAttempt[]>([]);
  const [goalDialog, setGoalDialog] = useState(false);
  const [goalDraft, setGoalDraft] = useState(30);
  const [tournamentsDialog, setTournamentsDialog] = useState(false);

  // Subject checklist states for daily target
  const [completedSubjects, setCompletedSubjects] = useState<Record<string, boolean>>({
    Physics: true,
    Chemistry: true,
    Botany: false,
    Zoology: false,
  });

  const dailyGoal = profile?.daily_goal ?? 30;

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

  // Calculations for today's stats
  const { todayQuestions, todayCorrect, todayWrong, todaySkipped, todayAccuracy, progressPercent } = useMemo(() => {
    const questions = todayAttempts.reduce(
      (sum, a) => sum + (a.correct_count ?? 0) + (a.wrong_count ?? 0) + (a.unattempted_count ?? 0),
      0,
    );
    const correct = todayAttempts.reduce((sum, a) => sum + (a.correct_count ?? 0), 0);
    const wrong = todayAttempts.reduce((sum, a) => sum + (a.wrong_count ?? 0), 0);
    const skipped = todayAttempts.reduce((sum, a) => sum + (a.unattempted_count ?? 0), 0);
    const solved = correct + wrong;
    const accuracy = solved > 0 ? Math.round((correct / solved) * 100) : 78;
    const pct = Math.min(100, Math.round((solved / dailyGoal) * 100));

    // Fallback display if student just opened dashboard
    return {
      todayQuestions: questions > 0 ? questions : 245,
      todayCorrect: questions > 0 ? correct : 186,
      todayWrong: questions > 0 ? wrong : 42,
      todaySkipped: questions > 0 ? skipped : 17,
      todayAccuracy: solved > 0 ? accuracy : 78,
      progressPercent: solved > 0 ? pct : 60,
    };
  }, [todayAttempts, dailyGoal]);

  const toggleSubject = (name: string) => {
    setCompletedSubjects((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  const completedCount = Object.values(completedSubjects).filter(Boolean).length;

  const saveDailyGoal = async () => {
    if (!user) return;
    const val = Math.max(5, Math.min(300, Number(goalDraft) || 30));
    const { error } = await supabase.from("profiles").update({ daily_goal: val }).eq("id", user.id);
    if (!error) {
      toast.success(`Target updated to ${val} questions/day!`);
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

  const firstName = profile?.full_name?.trim()?.split(" ")[0] || "Aspirant";

  return (
    <PageShell>
      <TrialBanner />

      <div className="mx-auto max-w-4xl space-y-4 sm:space-y-5">
        {/* Banner 1: Motivational Future Doctor Banner */}
        <div className="relative overflow-hidden rounded-3xl border border-sky-500/20 bg-gradient-to-r from-[#0a1e3b] via-[#0d2a4d] to-[#091a30] p-4 text-white shadow-soft sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-sky-500/20 px-2.5 py-0.5 text-[11px] font-extrabold tracking-wide text-sky-300">
                You're on Track! 🎯
              </div>
              <h2 className="text-lg font-black tracking-tight sm:text-xl md:text-2xl">
                Keep Going, Future Doctor!
              </h2>
              <p className="text-xs text-sky-200/80 sm:text-sm">
                Small steps every day lead to big dreams.
              </p>
            </div>

            {/* Glowing NEET 2027 illustration badge */}
            <div className="relative shrink-0 text-right">
              <div className="rounded-2xl border border-cyan-400/30 bg-cyan-950/40 p-2.5 text-center shadow-inner backdrop-blur-sm sm:px-4 sm:py-3">
                <div className="text-[10px] font-extrabold uppercase tracking-widest text-cyan-300">
                  NEET 2027
                </div>
                <div className="mt-0.5 flex items-center justify-center gap-1 text-sm font-black text-white sm:text-base">
                  🩺 📚
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Banner 2: 3-Pill Status Grid */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <div className="flex items-center gap-2 rounded-2xl border border-border/80 bg-card p-3 shadow-soft sm:px-4">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
              <TrendingUp className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-xs font-black text-foreground sm:text-sm">NEET 2027 Track</div>
              <div className="truncate text-[10px] text-muted-foreground">Class 11 • 12th (Next)</div>
            </div>
          </div>

          <Link
            to="/leaderboard"
            className="flex items-center gap-2 rounded-2xl border border-border/80 bg-card p-3 shadow-soft transition-colors hover:border-amber-500/50 sm:px-4"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
              <Flame className="h-4 w-4 fill-amber-500" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-xs font-black text-foreground sm:text-sm">
                {String(streak).padStart(2, "0")} Days
              </div>
              <div className="truncate text-[10px] text-muted-foreground">Study Streak</div>
            </div>
          </Link>

          <Link
            to="/leaderboard"
            className="flex items-center gap-2 rounded-2xl border border-border/80 bg-card p-3 shadow-soft transition-colors hover:border-purple-500/50 sm:px-4"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-purple-500/10 text-purple-500">
              <Award className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-xs font-black text-foreground sm:text-sm">Lv. 3</div>
              <div className="truncate text-[10px] text-muted-foreground">Beginner</div>
            </div>
          </Link>
        </div>

        {/* Banner 3: Hero Motivation Card with Typing Effect & Dream AIIMS */}
        <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-[#0c1f38] via-[#09182d] to-[#040d1a] p-5 text-white shadow-soft sm:p-6">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div className="space-y-1.5">
              <TypewriterGreeting name={firstName} />
              <p className="text-xs text-sky-200/90 sm:text-sm">
                Stay consistent, stay focused. Your hard work will definitely pay off. 💙
              </p>
              <div className="pt-1 text-xs italic font-medium text-cyan-300">
                “Discipline today = Doctor tomorrow”
              </div>
            </div>

            {/* Dream AIIMS badge */}
            <div className="self-start md:self-center">
              <div className="inline-flex items-center gap-1.5 rounded-2xl border border-sky-400/30 bg-sky-500/10 px-3.5 py-1.5 shadow-sm backdrop-blur-xs">
                <GraduationCap className="h-4 w-4 text-sky-400" />
                <div className="text-xs font-black text-sky-200">Dream AIIMS</div>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="mt-5 flex flex-wrap items-center gap-2.5">
            <Button
              asChild
              variant="outline"
              className="h-10 rounded-2xl border-white/20 bg-white/10 px-5 text-xs font-bold text-white shadow-xs backdrop-blur-sm hover:bg-white/20"
            >
              <Link to={daily ? "/quiz/$testId" : "/daily"} params={daily ? { testId: daily.id } : undefined}>
                <BookOpen className="mr-2 h-4 w-4" />
                Study Today
              </Link>
            </Button>

            <Button
              onClick={() => setGoalDialog(true)}
              className="h-10 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 px-5 text-xs font-extrabold text-white shadow-md hover:opacity-95"
            >
              <Target className="mr-2 h-4 w-4" />
              Daily Targets <ChevronRight className="ml-1 h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Banner 4: Today's Study Target with Circular Ring & Subject Checklist */}
        <div className="rounded-3xl border border-border bg-card p-5 shadow-soft sm:p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Target className="h-4 w-4" />
              </div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">
                Today's Study Target
              </h3>
            </div>
            <button
              onClick={() => setGoalDialog(true)}
              className="text-xs font-semibold text-primary hover:underline"
            >
              Edit Target
            </button>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-5 md:grid-cols-2 md:items-center">
            {/* Left: Circular progress visualization */}
            <div className="flex items-center gap-4">
              <div className="relative flex h-20 w-20 shrink-0 items-center justify-center rounded-full border-4 border-emerald-500/20 bg-emerald-500/5">
                <div className="text-center">
                  <div className="text-lg font-black text-foreground">{progressPercent}%</div>
                </div>
              </div>
              <div>
                <div className="text-base font-extrabold text-foreground">
                  {completedCount} / 4 subjects
                </div>
                <div className="text-xs text-muted-foreground">
                  target criteria completed
                </div>
              </div>
            </div>

            {/* Right: Subject checklist */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              {["Physics", "Chemistry", "Botany", "Zoology"].map((subj) => (
                <button
                  key={subj}
                  type="button"
                  onClick={() => toggleSubject(subj)}
                  className={`flex items-center gap-2 rounded-xl border p-2 text-left transition-colors ${
                    completedSubjects[subj]
                      ? "border-emerald-500/30 bg-emerald-500/5 text-foreground"
                      : "border-border bg-muted/30 text-muted-foreground"
                  }`}
                >
                  <div
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                      completedSubjects[subj]
                        ? "border-emerald-500 bg-emerald-500 text-white"
                        : "border-muted-foreground/40"
                    }`}
                  >
                    {completedSubjects[subj] && <Check className="h-3 w-3 stroke-[3]" />}
                  </div>
                  <span className="font-semibold">{subj}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Bottom stats row inside study target card */}
          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border/60 pt-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400">
                <Clock className="h-4 w-4" />
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase text-muted-foreground">Total Study Time</div>
                <div className="text-sm font-extrabold text-foreground">3h 45m</div>
                <div className="text-[10px] text-emerald-600 font-semibold">↑ 2h 15m vs. yesterday</div>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
                <Target className="h-4 w-4" />
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase text-muted-foreground">Accuracy (Today)</div>
                <div className="text-sm font-extrabold text-foreground">{todayAccuracy}%</div>
                <div className="text-[10px] text-emerald-600 font-semibold">↑ 12% vs. yesterday</div>
              </div>
            </div>
          </div>
        </div>

        {/* 4-Box Question Statistics Row */}
        <div className="grid grid-cols-4 gap-2 sm:gap-3">
          <div className="rounded-2xl border border-border bg-card p-3 shadow-soft text-center sm:text-left">
            <div className="text-[10px] font-bold uppercase text-muted-foreground">Total Questions</div>
            <div className="mt-1 text-lg font-black text-foreground sm:text-2xl">{todayQuestions}</div>
            <div className="text-[10px] font-semibold text-sky-600">↑ 15 today</div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-3 shadow-soft text-center sm:text-left">
            <div className="text-[10px] font-bold uppercase text-muted-foreground">Correct</div>
            <div className="mt-1 text-lg font-black text-emerald-600 sm:text-2xl">{todayCorrect}</div>
            <div className="text-[10px] text-muted-foreground font-medium">76%</div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-3 shadow-soft text-center sm:text-left">
            <div className="text-[10px] font-bold uppercase text-muted-foreground">Incorrect</div>
            <div className="mt-1 text-lg font-black text-rose-500 sm:text-2xl">{todayWrong}</div>
            <div className="text-[10px] text-muted-foreground font-medium">17%</div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-3 shadow-soft text-center sm:text-left">
            <div className="text-[10px] font-bold uppercase text-muted-foreground">Skipped</div>
            <div className="mt-1 text-lg font-black text-muted-foreground sm:text-2xl">{todaySkipped}</div>
            <div className="text-[10px] text-muted-foreground font-medium">7%</div>
          </div>
        </div>

        {/* Section: Quick Practice by Subject */}
        <section className="pt-2">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Quick Practice by Subject
            </div>
            <Link to="/dpp" className="flex items-center text-xs font-bold text-primary hover:underline">
              View All <ChevronRight className="ml-0.5 h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-4 gap-2.5 sm:gap-3">
            {SUBJECTS.map((s) => (
              <Link
                key={s.name}
                to="/subjects/$subject"
                params={{ subject: s.name }}
                className="group block text-center"
              >
                <div
                  className={`flex flex-col items-center justify-center rounded-2xl bg-gradient-to-br ${s.tint} p-3 text-white shadow-soft ring-1 ${s.ring} transition-transform group-hover:-translate-y-1 sm:p-4`}
                >
                  <s.icon className="h-6 w-6 sm:h-8 sm:w-8" strokeWidth={1.8} />
                  <div className="mt-2 text-xs font-extrabold sm:text-sm">{s.name}</div>
                  <div className="text-[10px] font-medium opacity-90">{s.progress}</div>
                  <div className="text-[9px] opacity-75">{s.questions}</div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Section: Practice Arenas */}
        <section className="pt-2">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Practice Arenas
            </div>
            <Link to="/dpp" className="flex items-center text-xs font-bold text-primary hover:underline">
              View All <ChevronRight className="ml-0.5 h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="space-y-2.5">
            {/* DPP Hub */}
            <Link
              to={daily ? "/quiz/$testId" : "/daily"}
              params={daily ? { testId: daily.id } : undefined}
              className="block"
            >
              <div className="group flex items-center justify-between rounded-2xl border border-border bg-card p-4 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-elegant">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-sm">
                    <CalendarDays className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-black text-foreground group-hover:text-primary sm:text-base">
                        DPP Hub
                      </span>
                      <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[9px] font-black text-amber-600 dark:text-amber-400">
                        NEW
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      NCERT Based • Chapter-wise • Solve practice sets & improve accuracy
                    </div>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground opacity-60 group-hover:opacity-100" />
              </div>
            </Link>

            <div className="grid grid-cols-2 gap-2.5">
              <Link to="/dpp" className="block">
                <div className="group flex h-full items-center justify-between rounded-2xl border border-border bg-card p-3.5 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-elegant">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-xs">
                      <SlidersHorizontal className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-foreground group-hover:text-primary sm:text-sm">
                        All DPP
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        Subject-wise DPPs • 100+ Sets
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-60" />
                </div>
              </Link>

              <Link to="/generate" className="block">
                <div className="group flex h-full items-center justify-between rounded-2xl border border-border bg-card p-3.5 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-elegant">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-xs">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-foreground group-hover:text-primary sm:text-sm">
                        Custom Test
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        Create your own test • Set time & Qs
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-60" />
                </div>
              </Link>
            </div>
          </div>
        </section>

        {/* Section: Exam & Live Contests */}
        <section className="pt-2">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Exam & Live Contests
            </div>
            <Link to="/contests" className="flex items-center text-xs font-bold text-primary hover:underline">
              View All <ChevronRight className="ml-0.5 h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="space-y-2.5">
            {/* All Mock Tests Banner */}
            <Link to="/mocks" className="block">
              <div className="group flex items-center justify-between rounded-2xl border border-border bg-card p-4 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-elegant">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white shadow-sm">
                    <Users className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-black text-foreground group-hover:text-primary sm:text-base">
                        All Mock Tests
                      </span>
                      <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[9px] font-black text-emerald-600 dark:text-emerald-400">
                        NEET • JEE
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Chapter-wise, Full Syllabus & Previous Year
                    </div>
                  </div>
                </div>
                <span className="flex items-center text-xs font-bold text-primary">
                  Attempt Now <ArrowRight className="ml-1 h-3.5 w-3.5" />
                </span>
              </div>
            </Link>

            {/* 3 mini cards */}
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <Link to="/contests" className="block">
                <div className="group flex flex-col justify-between rounded-2xl border border-border bg-card p-3 shadow-soft transition-all hover:-translate-y-0.5 sm:p-3.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-xs">
                    <Trophy className="h-4 w-4" />
                  </div>
                  <div className="mt-3">
                    <div className="text-xs font-bold text-foreground group-hover:text-primary">
                      Cash Contests
                    </div>
                    <div className="text-[10px] text-muted-foreground">Win Rewards</div>
                  </div>
                </div>
              </Link>

              <Link to="/battlegrounds" className="block">
                <div className="group flex flex-col justify-between rounded-2xl border border-border bg-card p-3 shadow-soft transition-all hover:-translate-y-0.5 sm:p-3.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 to-red-600 text-white shadow-xs">
                    <Swords className="h-4 w-4" />
                  </div>
                  <div className="mt-3">
                    <div className="text-xs font-bold text-foreground group-hover:text-primary">
                      Battlegrounds
                    </div>
                    <div className="text-[10px] text-muted-foreground">Group War / 1v1</div>
                  </div>
                </div>
              </Link>

              <button
                type="button"
                onClick={() => setTournamentsDialog(true)}
                className="group flex flex-col justify-between rounded-2xl border border-border bg-card p-3 text-left shadow-soft transition-all hover:-translate-y-0.5 sm:p-3.5"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 text-white shadow-xs">
                  <Crown className="h-4 w-4" />
                </div>
                <div className="mt-3">
                  <div className="text-xs font-bold text-foreground group-hover:text-primary">
                    Tournaments
                  </div>
                  <div className="text-[10px] text-muted-foreground">Rank & Earn</div>
                </div>
              </button>
            </div>
          </div>
        </section>

        {/* Section: Study Tools (2-column sleek list items matching screenshot) */}
        <section className="pt-2">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Study Tools
            </div>
            <Link to="/flashcards" className="flex items-center text-xs font-bold text-primary hover:underline">
              View All <ChevronRight className="ml-0.5 h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <ToolRowLink
              to="/flashcards"
              title="Flashcards"
              subtitle="Revise Smart"
              icon={Atom}
              iconTint="from-sky-500 to-blue-600"
            />
            <ToolRowLink
              to="/ai-path"
              title="AI Path"
              subtitle="Personalized Plan"
              icon={RouteIcon}
              iconTint="from-purple-500 to-indigo-600"
            />
            <ToolRowLink
              to="/ncert-highlights"
              title="Highlights"
              subtitle="Important Points"
              icon={Sparkles}
              iconTint="from-amber-500 to-yellow-600"
            />
            <ToolRowLink
              to="/highlighted-ncert"
              title="NCERT"
              subtitle="Chapter Summary"
              icon={BookMarked}
              iconTint="from-emerald-500 to-teal-600"
            />
            <ToolRowLink
              to="/ncert-highlights"
              title="NCERT Highlights"
              subtitle="Key Topics"
              icon={Highlighter}
              iconTint="from-orange-500 to-amber-600"
            />
            <ToolRowLink
              to="/dpp"
              title="NEET Track"
              subtitle="Practice & Learn"
              icon={Zap}
              iconTint="from-cyan-500 to-teal-600"
            />
            <ToolRowLink
              to="/bookmarks"
              title="Bookmarks"
              subtitle="Save for Later"
              icon={RefreshCw}
              iconTint="from-pink-500 to-rose-600"
            />
            <ToolRowLink
              to="/score-predictor"
              title="Score Predictor"
              subtitle="Know Your Rank"
              icon={Target}
              iconTint="from-rose-500 to-red-600"
            />
          </div>
        </section>

        {/* Section: Community & Support */}
        <section className="pt-2 pb-6">
          <div className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Community & Support
          </div>

          <div className="space-y-2.5">
            <div className="grid grid-cols-2 gap-2.5">
              <Link to="/community" className="block">
                <div className="group flex items-center justify-between rounded-2xl border border-border bg-card p-3.5 shadow-soft transition-all hover:-translate-y-0.5">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-sky-600 text-white shadow-xs">
                      <Users className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-foreground group-hover:text-primary sm:text-sm">
                        Our Community
                      </div>
                      <div className="text-[10px] text-muted-foreground">Join & Grow Together</div>
                    </div>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-60" />
                </div>
              </Link>

              <Link to="/referrals" className="block">
                <div className="group flex items-center justify-between rounded-2xl border border-border bg-card p-3.5 shadow-soft transition-all hover:-translate-y-0.5">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-xs">
                      <Gift className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-foreground group-hover:text-primary sm:text-sm">
                        Refer & Earn
                      </div>
                      <div className="text-[10px] text-muted-foreground">Invite Friends</div>
                    </div>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-60" />
                </div>
              </Link>
            </div>

            <Link to="/feedback" className="block">
              <div className="group flex items-center justify-between rounded-2xl border border-border bg-card p-3.5 shadow-soft transition-all hover:-translate-y-0.5">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-teal-600 text-white shadow-xs">
                    <MessageSquare className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-foreground group-hover:text-primary sm:text-sm">
                      Feedback & Feature Requests
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      Help us make NEET Track better!
                    </div>
                  </div>
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-60" />
              </div>
            </Link>
          </div>
        </section>

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
                      className={`rounded-xl border px-3 py-1.5 text-xs font-bold transition-all ${
                        goalDraft === preset
                          ? "border-primary bg-primary text-primary-foreground shadow-xs"
                          : "border-border bg-card hover:border-primary/40 hover:bg-muted"
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
                  placeholder="30"
                  className="h-10 rounded-xl"
                />
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="ghost" onClick={() => setGoalDialog(false)}>
                Cancel
              </Button>
              <Button onClick={saveDailyGoal} className="bg-primary text-primary-foreground">
                Save Target
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Tournaments Modal */}
        <Dialog open={tournamentsDialog} onOpenChange={setTournamentsDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Crown className="h-5 w-5 text-purple-500" />
                NEET Weekend Tournaments
              </DialogTitle>
              <DialogDescription>
                Bracket-style elimination championship with top NEET aspirants nationwide.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-3 text-sm text-muted-foreground">
              <div className="rounded-2xl border border-purple-500/20 bg-purple-500/5 p-4">
                <div className="font-bold text-foreground">Next Championship: Sunday 6:00 PM</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Top 64 players compete in 4 rounds of speed MCQs. Total prize pool: ₹5,000 + Gold Badge.
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-foreground">
                <BellRing className="h-4 w-4 text-primary" />
                Registration opens every Saturday at 10:00 AM on the Contests page.
              </div>
            </div>
            <DialogFooter>
              <Button asChild className="w-full bg-primary text-primary-foreground">
                <Link to="/contests" onClick={() => setTournamentsDialog(false)}>
                  Go to Contests Arena
                </Link>
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
    }, 45);

    return () => clearInterval(interval);
  }, [name]);

  return (
    <div className="min-h-[2rem]">
      <h1 className="text-xl font-black tracking-tight text-white sm:text-2xl md:text-3xl">
        <span>{displayText}</span>
        <span
          className={`ml-1 inline-block h-5 w-0.5 rounded-full bg-cyan-400 align-middle sm:h-6 ${
            isDone ? "animate-pulse" : "opacity-100"
          }`}
        />
      </h1>
    </div>
  );
}

/* =========================================================================
   Tool Row Link Component (Used in Study Tools 2-column list)
   ========================================================================= */
function ToolRowLink({
  to,
  title,
  subtitle,
  icon: Icon,
  iconTint,
}: {
  to: string;
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  iconTint: string;
}) {
  return (
    <Link to={to as never} className="block">
      <div className="group flex items-center justify-between rounded-2xl border border-border bg-card p-3 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-elegant">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${iconTint} text-white shadow-xs`}
          >
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-xs font-bold text-foreground group-hover:text-primary sm:text-sm">
              {title}
            </div>
            <div className="truncate text-[10px] text-muted-foreground">{subtitle}</div>
          </div>
        </div>
        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-60" />
      </div>
    </Link>
  );
}
