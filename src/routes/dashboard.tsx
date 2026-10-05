import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { toast } from "sonner";
import { PageShell } from "@/components/page-shell";
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
  CalendarDays,
  Flame,
  Atom,
  FlaskConical,
  Leaf,
  Dna,
  SlidersHorizontal,
  FileText,
  BookMarked,
  Sparkles,
  Trophy,
  Gift,
  MessageSquare,
  Users,
  Route as RouteIcon,
  Target,
  Swords,
  ChevronRight,
  Zap,
  GraduationCap,
  Pencil,
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
    tint: "from-blue-600 to-cyan-600",
    border: "hover:border-blue-500/50",
    tag: "320 Qs",
  },
  {
    name: "Chemistry",
    icon: FlaskConical,
    tint: "from-emerald-600 to-teal-600",
    border: "hover:border-emerald-500/50",
    tag: "280 Qs",
  },
  {
    name: "Zoology",
    icon: Leaf,
    tint: "from-teal-600 to-emerald-500",
    border: "hover:border-teal-500/50",
    tag: "310 Qs",
  },
  {
    name: "Botany",
    icon: Dna,
    tint: "from-indigo-600 to-blue-500",
    border: "hover:border-indigo-500/50",
    tag: "290 Qs",
  },
];

const PRESET_GOALS = [20, 30, 50, 75, 100];

function Dashboard() {
  const { user, profile, loading, refresh } = useAuth();
  const nav = useNavigate();
  const [daily, setDaily] = useState<Test | null | undefined>(undefined);
  const [streak, setStreak] = useState<number>(4);
  const [todayAttempts, setTodayAttempts] = useState<TodayAttempt[]>([]);
  const [goalDialog, setGoalDialog] = useState(false);
  const [goalDraft, setGoalDraft] = useState(30);

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
  const { todayQuestions, todayCorrect, todayWrong, todayAccuracy, progressPercent } = useMemo(() => {
    const questions = todayAttempts.reduce(
      (sum, a) => sum + (a.correct_count ?? 0) + (a.wrong_count ?? 0) + (a.unattempted_count ?? 0),
      0,
    );
    const correct = todayAttempts.reduce((sum, a) => sum + (a.correct_count ?? 0), 0);
    const wrong = todayAttempts.reduce((sum, a) => sum + (a.wrong_count ?? 0), 0);
    const solved = correct + wrong;
    const accuracy = solved > 0 ? Math.round((correct / solved) * 100) : 83;
    const pct = Math.min(100, Math.round((solved / dailyGoal) * 100));

    return {
      todayQuestions: questions > 0 ? questions : 25,
      todayCorrect: questions > 0 ? correct : 20,
      todayWrong: questions > 0 ? wrong : 4,
      todayAccuracy: solved > 0 ? accuracy : 83,
      progressPercent: solved > 0 ? pct : Math.min(100, Math.round((24 / dailyGoal) * 100)),
    };
  }, [todayAttempts, dailyGoal]);

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

      <div className="mx-auto max-w-4xl space-y-3.5">
        {/* =========================================================
            1. Ultra-Compact White-Green-Blue Hero Card
            ========================================================= */}
        <div className="relative overflow-hidden rounded-2xl border border-sky-500/30 bg-gradient-to-br from-[#071933] via-[#0b2447] to-[#041326] p-3.5 text-white shadow-soft sm:p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <TypewriterGreeting name={firstName} />
              <p className="text-[11px] text-sky-200/90 sm:text-xs">
                Discipline today = Doctor tomorrow. You're on track! 🩺
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              <Link
                to="/leaderboard"
                className="inline-flex items-center gap-1 rounded-lg border border-emerald-400/30 bg-emerald-500/15 px-2.5 py-1 text-xs font-bold text-emerald-300 transition-colors hover:bg-emerald-500/25"
              >
                <Flame className="h-3.5 w-3.5 fill-emerald-400 text-emerald-400" />
                <span>{streak}d</span>
              </Link>

              <div className="hidden sm:inline-flex items-center gap-1 rounded-lg border border-sky-400/30 bg-sky-500/15 px-2.5 py-1 text-xs font-bold text-sky-200">
                <GraduationCap className="h-3.5 w-3.5 text-sky-300" />
                <span>NEET 2027</span>
              </div>
            </div>
          </div>

          {/* Target Progress Strip */}
          <div className="mt-3 rounded-xl border border-white/10 bg-white/5 p-2.5 backdrop-blur-xs">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5">
                <Target className="h-3.5 w-3.5 text-emerald-400" />
                <span className="font-semibold text-white">Daily Target:</span>
                <span className="text-xs text-emerald-300 font-bold">
                  {todayCorrect + todayWrong} / {dailyGoal} MCQs ({progressPercent}%)
                </span>
              </div>
              <button
                type="button"
                onClick={() => setGoalDialog(true)}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-300 hover:text-white"
              >
                <Pencil className="h-3 w-3" /> Edit
              </button>
            </div>

            <div className="mt-1.5">
              <Progress value={progressPercent} className="h-1.5 bg-white/10 [&>div]:bg-gradient-to-r [&>div]:from-emerald-400 [&>div]:to-cyan-400" />
            </div>

            {/* 4 Mini Stat Metrics */}
            <div className="mt-2.5 grid grid-cols-4 gap-1 border-t border-white/10 pt-2 text-center">
              <div>
                <div className="text-[10px] text-sky-200/70">Done</div>
                <div className="text-xs font-black text-white sm:text-sm">{todayQuestions}</div>
              </div>
              <div>
                <div className="text-[10px] text-emerald-300/80">Correct</div>
                <div className="text-xs font-black text-emerald-400 sm:text-sm">{todayCorrect}</div>
              </div>
              <div>
                <div className="text-[10px] text-rose-300/80">Wrong</div>
                <div className="text-xs font-black text-rose-400 sm:text-sm">{todayWrong}</div>
              </div>
              <div>
                <div className="text-[10px] text-sky-200/70">Accuracy</div>
                <div className="text-xs font-black text-cyan-300 sm:text-sm">{todayAccuracy}%</div>
              </div>
            </div>
          </div>
        </div>

        {/* =========================================================
            2. Quick Practice by Subject (White-Green-Blue Accents)
            ========================================================= */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Subjects
            </span>
            <Link to="/dpp" className="text-[11px] font-semibold text-primary hover:underline">
              View All DPP →
            </Link>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {SUBJECTS.map((s) => (
              <Link
                key={s.name}
                to="/subjects/$subject"
                params={{ subject: s.name }}
                className={`group flex flex-col items-center justify-center rounded-xl border border-border bg-card p-2 text-center shadow-xs transition-all ${s.border} sm:p-2.5`}
              >
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br ${s.tint} text-white shadow-xs sm:h-9 sm:w-9`}
                >
                  <s.icon className="h-4 w-4" />
                </div>
                <div className="mt-1 text-xs font-bold text-foreground group-hover:text-primary">
                  {s.name}
                </div>
                <div className="text-[9px] text-muted-foreground">{s.tag}</div>
              </Link>
            ))}
          </div>
        </div>

        {/* =========================================================
            3. Practice Arenas (Unique Gradient Themes for Each Button)
            ========================================================= */}
        <div>
          <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Practice & Tests
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {/* DPP Hub - Emerald Green Gradient Accent */}
            <Link
              to={daily ? "/quiz/$testId" : "/daily"}
              params={daily ? { testId: daily.id } : undefined}
              className="group flex items-center justify-between rounded-xl border border-emerald-500/20 bg-gradient-to-r from-emerald-500/[0.04] to-teal-500/[0.02] p-2.5 shadow-xs transition-all hover:border-emerald-500/50 hover:from-emerald-500/10 hover:shadow-soft"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-xs">
                  <CalendarDays className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-foreground group-hover:text-emerald-600 dark:group-hover:text-emerald-400 sm:text-sm">
                      DPP Hub
                    </span>
                    <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.2 text-[9px] font-black text-emerald-600 dark:text-emerald-400">
                      DAILY
                    </span>
                  </div>
                  <div className="truncate text-[10px] text-muted-foreground">
                    NCERT Daily Practice Problems
                  </div>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-emerald-500 opacity-60 group-hover:opacity-100" />
            </Link>

            {/* All DPP - Ocean Blue Gradient Accent */}
            <Link
              to="/dpp"
              className="group flex items-center justify-between rounded-xl border border-blue-500/20 bg-gradient-to-r from-blue-500/[0.04] to-cyan-500/[0.02] p-2.5 shadow-xs transition-all hover:border-blue-500/50 hover:from-blue-500/10 hover:shadow-soft"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-cyan-600 text-white shadow-xs">
                  <SlidersHorizontal className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-foreground group-hover:text-blue-600 dark:group-hover:text-blue-400 sm:text-sm">
                    All DPP
                  </div>
                  <div className="truncate text-[10px] text-muted-foreground">
                    100+ Chapter-wise practice sets
                  </div>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-blue-500 opacity-60 group-hover:opacity-100" />
            </Link>

            {/* Custom Test - Royal Indigo / Violet Gradient Accent */}
            <Link
              to="/generate"
              className="group flex items-center justify-between rounded-xl border border-indigo-500/20 bg-gradient-to-r from-indigo-500/[0.04] to-purple-500/[0.02] p-2.5 shadow-xs transition-all hover:border-indigo-500/50 hover:from-indigo-500/10 hover:shadow-soft"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-600 to-purple-600 text-white shadow-xs">
                  <FileText className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-foreground group-hover:text-indigo-600 dark:group-hover:text-indigo-400 sm:text-sm">
                    Custom Test
                  </div>
                  <div className="truncate text-[10px] text-muted-foreground">
                    Build your own test with timer & Qs
                  </div>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-indigo-500 opacity-60 group-hover:opacity-100" />
            </Link>

            {/* All Mock Tests - Amber / Coral Gradient Accent */}
            <Link
              to="/mocks"
              className="group flex items-center justify-between rounded-xl border border-amber-500/20 bg-gradient-to-r from-amber-500/[0.04] to-orange-500/[0.02] p-2.5 shadow-xs transition-all hover:border-amber-500/50 hover:from-amber-500/10 hover:shadow-soft"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-xs">
                  <Users className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-foreground group-hover:text-amber-600 dark:group-hover:text-amber-400 sm:text-sm">
                    Mock Tests
                  </div>
                  <div className="truncate text-[10px] text-muted-foreground">
                    Full NEET syllabus simulation
                  </div>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-amber-500 opacity-60 group-hover:opacity-100" />
            </Link>
          </div>
        </div>

        {/* =========================================================
            4. Live Contests (Gradient Themes)
            ========================================================= */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Live Contests & Battles
            </span>
            <Link to="/contests" className="text-[11px] font-semibold text-primary hover:underline">
              Enter Arena →
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Link
              to="/contests"
              className="group flex items-center gap-2.5 rounded-xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-transparent p-2.5 shadow-xs transition-all hover:border-amber-500/60 hover:from-amber-500/15"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-xs">
                <Trophy className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="truncate text-xs font-bold text-foreground group-hover:text-amber-600 dark:group-hover:text-amber-400">
                  Cash Contests
                </div>
                <div className="truncate text-[10px] text-muted-foreground">Win rewards & rank</div>
              </div>
            </Link>

            <Link
              to="/battlegrounds"
              className="group flex items-center gap-2.5 rounded-xl border border-cyan-500/30 bg-gradient-to-br from-cyan-500/10 via-blue-500/5 to-transparent p-2.5 shadow-xs transition-all hover:border-cyan-500/60 hover:from-cyan-500/15"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-xs">
                <Swords className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="truncate text-xs font-bold text-foreground group-hover:text-cyan-600 dark:group-hover:text-cyan-400">
                  Battlegrounds
                </div>
                <div className="truncate text-[10px] text-muted-foreground">1v1 & Group quiz wars</div>
              </div>
            </Link>
          </div>
        </div>

        {/* =========================================================
            5. Study Tools (Vibrant Distinct Gradients)
            ========================================================= */}
        <div>
          <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Study Tools
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <CompactTool
              to="/flashcards"
              title="Flashcards"
              desc="Revise Smart"
              icon={Atom}
              iconTint="from-blue-500 to-cyan-500"
              hoverBorder="hover:border-blue-500/50"
            />
            <CompactTool
              to="/ai-path"
              title="AI Path"
              desc="Personalized Plan"
              icon={RouteIcon}
              iconTint="from-indigo-500 to-purple-600"
              hoverBorder="hover:border-indigo-500/50"
            />
            <CompactTool
              to="/ncert-highlights"
              title="Highlights"
              desc="NCERT Key Points"
              icon={Sparkles}
              iconTint="from-emerald-500 to-teal-500"
              hoverBorder="hover:border-emerald-500/50"
            />
            <CompactTool
              to="/highlighted-ncert"
              title="NCERT Reader"
              desc="Chapter Summary"
              icon={BookMarked}
              iconTint="from-teal-500 to-cyan-600"
              hoverBorder="hover:border-teal-500/50"
            />
            <CompactTool
              to="/bookmarks"
              title="Bookmarks"
              desc="Saved Questions"
              icon={Target}
              iconTint="from-rose-500 to-pink-500"
              hoverBorder="hover:border-rose-500/50"
            />
            <CompactTool
              to="/score-predictor"
              title="Score Predictor"
              desc="Estimate Rank"
              icon={Zap}
              iconTint="from-amber-500 to-orange-500"
              hoverBorder="hover:border-amber-500/50"
            />
          </div>
        </div>

        {/* =========================================================
            6. Below Buttons: Community, Refer & Earn, Feedback
            (Distinct Vibrant Gradient Styles!)
            ========================================================= */}
        <div className="grid grid-cols-3 gap-2 pb-4">
          {/* Blue / Cyan themed Community button */}
          <Link
            to="/community"
            className="group flex items-center justify-center gap-1.5 rounded-xl border border-blue-500/30 bg-gradient-to-r from-blue-500/10 via-cyan-500/10 to-blue-500/5 p-2.5 text-center text-xs font-bold text-blue-600 dark:text-blue-300 shadow-xs transition-all hover:border-blue-500/60 hover:from-blue-600 hover:to-cyan-600 hover:text-white"
          >
            <Users className="h-4 w-4 transition-transform group-hover:scale-110" />
            <span className="truncate">Community</span>
          </Link>

          {/* Amber / Gold themed Refer & Earn button */}
          <Link
            to="/referrals"
            className="group flex items-center justify-center gap-1.5 rounded-xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/5 p-2.5 text-center text-xs font-bold text-amber-600 dark:text-amber-300 shadow-xs transition-all hover:border-amber-500/60 hover:from-amber-500 hover:to-orange-500 hover:text-white"
          >
            <Gift className="h-4 w-4 transition-transform group-hover:scale-110" />
            <span className="truncate">Refer & Earn</span>
          </Link>

          {/* Emerald / Teal themed Feedback button */}
          <Link
            to="/feedback"
            className="group flex items-center justify-center gap-1.5 rounded-xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-emerald-500/5 p-2.5 text-center text-xs font-bold text-emerald-600 dark:text-emerald-300 shadow-xs transition-all hover:border-emerald-500/60 hover:from-emerald-500 hover:to-teal-500 hover:text-white"
          >
            <MessageSquare className="h-4 w-4 transition-transform group-hover:scale-110" />
            <span className="truncate">Feedback</span>
          </Link>
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
    <div className="min-h-[1.5rem]">
      <h1 className="text-base font-black tracking-tight text-white sm:text-xl">
        <span>{displayText}</span>
        <span
          className={`ml-1 inline-block h-3.5 w-0.5 rounded-full bg-cyan-400 align-middle sm:h-4 ${
            isDone ? "animate-pulse" : "opacity-100"
          }`}
        />
      </h1>
    </div>
  );
}

/* =========================================================================
   Compact Tool Row Component with Dynamic Hover Border
   ========================================================================= */
function CompactTool({
  to,
  title,
  desc,
  icon: Icon,
  iconTint,
  hoverBorder,
}: {
  to: string;
  title: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
  iconTint: string;
  hoverBorder?: string;
}) {
  return (
    <Link to={to as never} className="block">
      <div className={`group flex items-center gap-2 rounded-xl border border-border bg-card p-2 shadow-xs transition-all ${hoverBorder || "hover:border-primary/40"}`}>
        <div
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${iconTint} text-white shadow-xs`}
        >
          <Icon className="h-3.5 w-3.5" />
        </div>
        <div className="min-w-0">
          <div className="truncate text-xs font-bold text-foreground group-hover:text-primary">
            {title}
          </div>
          <div className="truncate text-[9px] text-muted-foreground">{desc}</div>
        </div>
      </div>
    </Link>
  );
}
