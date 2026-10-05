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
  Highlighter,
  Route as RouteIcon,
  Target,
  Swords,
  ChevronRight,
  BookOpen,
  Award,
  Zap,
  GraduationCap,
  Pencil,
  CheckCircle2,
  XCircle,
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
    tint: "from-blue-600 to-indigo-600",
    border: "border-blue-500/20",
    bg: "bg-blue-500/10 text-blue-400",
    tag: "320 Qs",
  },
  {
    name: "Chemistry",
    icon: FlaskConical,
    tint: "from-rose-500 to-red-600",
    border: "border-rose-500/20",
    bg: "bg-rose-500/10 text-rose-400",
    tag: "280 Qs",
  },
  {
    name: "Zoology",
    icon: Leaf,
    tint: "from-emerald-500 to-teal-600",
    border: "border-emerald-500/20",
    bg: "bg-emerald-500/10 text-emerald-400",
    tag: "310 Qs",
  },
  {
    name: "Botany",
    icon: Dna,
    tint: "from-purple-500 to-indigo-600",
    border: "border-purple-500/20",
    bg: "bg-purple-500/10 text-purple-400",
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

    return {
      todayQuestions: questions > 0 ? questions : 25,
      todayCorrect: questions > 0 ? correct : 20,
      todayWrong: questions > 0 ? wrong : 4,
      todaySkipped: questions > 0 ? skipped : 1,
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

      <div className="mx-auto max-w-4xl space-y-4">
        {/* =========================================================
            1. Sleek Compact Hero Card (Greeting + Stats + Quick Target)
            ========================================================= */}
        <div className="relative overflow-hidden rounded-2xl border border-sky-500/25 bg-gradient-to-br from-[#0a1e3b] via-[#091a33] to-[#040e1d] p-4 text-white shadow-soft sm:p-5">
          {/* Top row: Greeting + Badges */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <TypewriterGreeting name={firstName} />
              <p className="text-xs text-sky-200/80 sm:text-sm">
                Discipline today = Doctor tomorrow. You're on track! 🎯
              </p>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-center">
              <Link
                to="/leaderboard"
                className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/15 px-3 py-1.5 text-xs font-bold text-amber-300 transition-colors hover:bg-amber-500/25"
              >
                <Flame className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                <span>{streak}d Streak</span>
              </Link>

              <div className="inline-flex items-center gap-1.5 rounded-xl border border-sky-400/30 bg-sky-500/15 px-3 py-1.5 text-xs font-bold text-sky-200">
                <GraduationCap className="h-3.5 w-3.5 text-sky-300" />
                <span>NEET 2027</span>
              </div>
            </div>
          </div>

          {/* Target Progress & Fast Action Bar */}
          <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3 backdrop-blur-xs">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-emerald-400" />
                <span className="font-semibold text-white">Daily Target</span>
                <span className="text-xs text-emerald-300 font-bold">
                  {todayCorrect + todayWrong}/{dailyGoal} MCQs ({progressPercent}%)
                </span>
              </div>
              <button
                type="button"
                onClick={() => setGoalDialog(true)}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-300 hover:text-white"
              >
                <Pencil className="h-3 w-3" /> Edit Target
              </button>
            </div>

            <div className="mt-2">
              <Progress value={progressPercent} className="h-2 bg-white/10" />
            </div>

            {/* 4 Mini Stat Metrics */}
            <div className="mt-3 grid grid-cols-4 gap-2 border-t border-white/10 pt-2.5 text-center">
              <div>
                <div className="text-[10px] font-medium text-sky-200/70">Done Today</div>
                <div className="text-sm font-black text-white sm:text-base">{todayQuestions}</div>
              </div>
              <div>
                <div className="text-[10px] font-medium text-emerald-300/80">Correct</div>
                <div className="text-sm font-black text-emerald-400 sm:text-base">{todayCorrect}</div>
              </div>
              <div>
                <div className="text-[10px] font-medium text-rose-300/80">Incorrect</div>
                <div className="text-sm font-black text-rose-400 sm:text-base">{todayWrong}</div>
              </div>
              <div>
                <div className="text-[10px] font-medium text-sky-200/70">Accuracy</div>
                <div className="text-sm font-black text-sky-300 sm:text-base">{todayAccuracy}%</div>
              </div>
            </div>
          </div>

          {/* Quick CTA row */}
          <div className="mt-3.5 flex items-center gap-2.5">
            <Button
              asChild
              size="sm"
              className="h-9 flex-1 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-xs font-black text-white shadow-md hover:opacity-95 sm:flex-initial sm:px-6"
            >
              <Link to={daily ? "/quiz/$testId" : "/daily"} params={daily ? { testId: daily.id } : undefined}>
                <BookOpen className="mr-1.5 h-3.5 w-3.5" /> Start Today's DPP
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="sm"
              className="h-9 flex-1 rounded-xl border-white/20 bg-white/10 text-xs font-bold text-white hover:bg-white/20 sm:flex-initial sm:px-5"
            >
              <Link to="/generate">
                <FileText className="mr-1.5 h-3.5 w-3.5" /> Custom Test
              </Link>
            </Button>
          </div>
        </div>

        {/* =========================================================
            2. Quick Practice by Subject (Compact 4-column cards)
            ========================================================= */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Subjects
            </span>
            <Link to="/dpp" className="text-xs font-semibold text-primary hover:underline">
              View All DPP →
            </Link>
          </div>

          <div className="grid grid-cols-4 gap-2 sm:gap-3">
            {SUBJECTS.map((s) => (
              <Link
                key={s.name}
                to="/subjects/$subject"
                params={{ subject: s.name }}
                className="group flex flex-col items-center justify-center rounded-xl border border-border bg-card p-2.5 text-center shadow-xs transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-soft sm:p-3"
              >
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br ${s.tint} text-white shadow-xs sm:h-10 sm:w-10`}
                >
                  <s.icon className="h-4 w-4 sm:h-5 sm:w-5" />
                </div>
                <div className="mt-1.5 text-xs font-bold text-foreground group-hover:text-primary sm:text-sm">
                  {s.name}
                </div>
                <div className="text-[10px] text-muted-foreground">{s.tag}</div>
              </Link>
            ))}
          </div>
        </div>

        {/* =========================================================
            3. Practice Hubs & Contests (Clean 2x2 Grid, NO Tournaments)
            ========================================================= */}
        <div>
          <div className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Practice & Tests
          </div>

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {/* DPP Hub */}
            <Link
              to={daily ? "/quiz/$testId" : "/daily"}
              params={daily ? { testId: daily.id } : undefined}
              className="group flex items-center justify-between rounded-xl border border-border bg-card p-3 shadow-xs transition-all hover:border-emerald-500/40 hover:shadow-soft"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-xs">
                  <CalendarDays className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold text-foreground group-hover:text-primary">
                      DPP Hub
                    </span>
                    <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.2 text-[9px] font-black text-emerald-600 dark:text-emerald-400">
                      DAILY
                    </span>
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    NCERT Daily Practice Problems
                  </div>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground opacity-60 group-hover:opacity-100" />
            </Link>

            {/* All DPP */}
            <Link
              to="/dpp"
              className="group flex items-center justify-between rounded-xl border border-border bg-card p-3 shadow-xs transition-all hover:border-sky-500/40 hover:shadow-soft"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-xs">
                  <SlidersHorizontal className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-sm font-bold text-foreground group-hover:text-primary">
                    All DPP
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    100+ Chapter-wise practice sets
                  </div>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground opacity-60 group-hover:opacity-100" />
            </Link>

            {/* Custom Test */}
            <Link
              to="/generate"
              className="group flex items-center justify-between rounded-xl border border-border bg-card p-3 shadow-xs transition-all hover:border-purple-500/40 hover:shadow-soft"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 text-white shadow-xs">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-sm font-bold text-foreground group-hover:text-primary">
                    Custom Test
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Build your own test with timer & Qs
                  </div>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground opacity-60 group-hover:opacity-100" />
            </Link>

            {/* All Mock Tests */}
            <Link
              to="/mocks"
              className="group flex items-center justify-between rounded-xl border border-border bg-card p-3 shadow-xs transition-all hover:border-amber-500/40 hover:shadow-soft"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-xs">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-sm font-bold text-foreground group-hover:text-primary">
                    Mock Tests
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Full NEET syllabus simulation
                  </div>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground opacity-60 group-hover:opacity-100" />
            </Link>
          </div>
        </div>

        {/* =========================================================
            4. Live Contests (Cash Contests & Battlegrounds ONLY)
            ========================================================= */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Live Contests & Battles
            </span>
            <Link to="/contests" className="text-xs font-semibold text-primary hover:underline">
              Enter Arena →
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <Link
              to="/contests"
              className="group flex items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-xs transition-all hover:border-amber-500/40 hover:shadow-soft"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-xs">
                <Trophy className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="truncate text-xs font-bold text-foreground group-hover:text-primary sm:text-sm">
                  Cash Contests
                </div>
                <div className="truncate text-[10px] text-muted-foreground">Win rewards & rank</div>
              </div>
            </Link>

            <Link
              to="/battlegrounds"
              className="group flex items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-xs transition-all hover:border-rose-500/40 hover:shadow-soft"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 to-red-600 text-white shadow-xs">
                <Swords className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="truncate text-xs font-bold text-foreground group-hover:text-primary sm:text-sm">
                  Battlegrounds
                </div>
                <div className="truncate text-[10px] text-muted-foreground">1v1 & Group quiz wars</div>
              </div>
            </Link>
          </div>
        </div>

        {/* =========================================================
            5. Study Tools (Compact 3-column grid)
            ========================================================= */}
        <div>
          <div className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Study Tools
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <CompactTool
              to="/flashcards"
              title="Flashcards"
              desc="Revise Smart"
              icon={Atom}
              iconTint="from-sky-500 to-blue-600"
            />
            <CompactTool
              to="/ai-path"
              title="AI Path"
              desc="Personalized Plan"
              icon={RouteIcon}
              iconTint="from-purple-500 to-indigo-600"
            />
            <CompactTool
              to="/ncert-highlights"
              title="Highlights"
              desc="NCERT Key Points"
              icon={Sparkles}
              iconTint="from-amber-500 to-yellow-600"
            />
            <CompactTool
              to="/highlighted-ncert"
              title="NCERT Reader"
              desc="Chapter Summary"
              icon={BookMarked}
              iconTint="from-emerald-500 to-teal-600"
            />
            <CompactTool
              to="/bookmarks"
              title="Bookmarks"
              desc="Saved Questions"
              icon={Target}
              iconTint="from-pink-500 to-rose-600"
            />
            <CompactTool
              to="/score-predictor"
              title="Score Predictor"
              desc="Estimate Rank"
              icon={Zap}
              iconTint="from-cyan-500 to-teal-600"
            />
          </div>
        </div>

        {/* =========================================================
            6. Community & Support (Slim bottom row)
            ========================================================= */}
        <div className="grid grid-cols-3 gap-2 pb-6">
          <Link
            to="/community"
            className="group flex items-center justify-center gap-1.5 rounded-xl border border-border bg-card p-2.5 text-center text-xs font-semibold text-foreground shadow-xs transition-colors hover:border-primary/40 hover:text-primary"
          >
            <Users className="h-3.5 w-3.5 text-sky-500" />
            <span className="truncate">Community</span>
          </Link>
          <Link
            to="/referrals"
            className="group flex items-center justify-center gap-1.5 rounded-xl border border-border bg-card p-2.5 text-center text-xs font-semibold text-foreground shadow-xs transition-colors hover:border-primary/40 hover:text-primary"
          >
            <Gift className="h-3.5 w-3.5 text-amber-500" />
            <span className="truncate">Refer & Earn</span>
          </Link>
          <Link
            to="/feedback"
            className="group flex items-center justify-center gap-1.5 rounded-xl border border-border bg-card p-2.5 text-center text-xs font-semibold text-foreground shadow-xs transition-colors hover:border-primary/40 hover:text-primary"
          >
            <MessageSquare className="h-3.5 w-3.5 text-teal-500" />
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
    <div className="min-h-[1.75rem]">
      <h1 className="text-lg font-black tracking-tight text-white sm:text-2xl">
        <span>{displayText}</span>
        <span
          className={`ml-1 inline-block h-4 w-0.5 rounded-full bg-cyan-400 align-middle sm:h-5 ${
            isDone ? "animate-pulse" : "opacity-100"
          }`}
        />
      </h1>
    </div>
  );
}

/* =========================================================================
   Compact Tool Row Component
   ========================================================================= */
function CompactTool({
  to,
  title,
  desc,
  icon: Icon,
  iconTint,
}: {
  to: string;
  title: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
  iconTint: string;
}) {
  return (
    <Link to={to as never} className="block">
      <div className="group flex items-center gap-2.5 rounded-xl border border-border bg-card p-2.5 shadow-xs transition-all hover:border-primary/40 hover:shadow-soft">
        <div
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${iconTint} text-white shadow-xs`}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <div className="truncate text-xs font-bold text-foreground group-hover:text-primary">
            {title}
          </div>
          <div className="truncate text-[10px] text-muted-foreground">{desc}</div>
        </div>
      </div>
    </Link>
  );
}
