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
  Zap,
  ArrowUpRight,
  BarChart3,
  Settings2,
  PlayCircle,
  HelpCircle,
  Compass,
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
    tint: "from-sky-500 to-blue-600",
    ring: "ring-sky-400/30",
    bgLight: "bg-sky-50 dark:bg-sky-950/20",
    textLight: "text-sky-700 dark:text-sky-300",
  },
  {
    name: "Chemistry",
    icon: FlaskConical,
    tint: "from-orange-500 to-rose-600",
    ring: "ring-orange-400/30",
    bgLight: "bg-orange-50 dark:bg-orange-950/20",
    textLight: "text-orange-700 dark:text-orange-300",
  },
  {
    name: "Zoology",
    icon: Leaf,
    tint: "from-emerald-500 to-teal-600",
    ring: "ring-emerald-400/30",
    bgLight: "bg-emerald-50 dark:bg-emerald-950/20",
    textLight: "text-emerald-700 dark:text-emerald-300",
  },
  {
    name: "Botany",
    icon: Dna,
    tint: "from-lime-500 to-green-600",
    ring: "ring-lime-400/30",
    bgLight: "bg-lime-50 dark:bg-lime-950/20",
    textLight: "text-lime-700 dark:text-lime-300",
  },
];

const PRESET_GOALS = [20, 30, 50, 75, 100];

function Dashboard() {
  const { user, profile, isAdmin, loading, refresh } = useAuth();
  const nav = useNavigate();
  const [daily, setDaily] = useState<Test | null | undefined>(undefined);
  const [streak, setStreak] = useState<number>(0);
  const [todayAttempts, setTodayAttempts] = useState<TodayAttempt[]>([]);
  const [goalDialog, setGoalDialog] = useState(false);
  const [goalDraft, setGoalDraft] = useState(30);
  const [tournamentsDialog, setTournamentsDialog] = useState(false);

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
        setStreak(s);
      });
  }, [user?.id]);

  // Calculations for today's stats
  const { todayQuestions, todayCorrect, todayWrong, todayAccuracy, progressPercent } = useMemo(() => {
    const questions = todayAttempts.reduce(
      (sum, a) => sum + (a.correct_count ?? 0) + (a.wrong_count ?? 0),
      0,
    );
    const correct = todayAttempts.reduce((sum, a) => sum + (a.correct_count ?? 0), 0);
    const wrong = todayAttempts.reduce((sum, a) => sum + (a.wrong_count ?? 0), 0);
    const accuracy = questions > 0 ? Math.round((correct / questions) * 100) : 0;
    const pct = Math.min(100, Math.round((questions / dailyGoal) * 100));
    return {
      todayQuestions: questions,
      todayCorrect: correct,
      todayWrong: wrong,
      todayAccuracy: accuracy,
      progressPercent: pct,
    };
  }, [todayAttempts, dailyGoal]);

  const saveDailyGoal = async () => {
    if (!user) return;
    const val = Math.max(5, Math.min(300, Number(goalDraft) || 30));
    const { error } = await supabase.from("profiles").update({ daily_goal: val }).eq("id", user.id);
    if (!error) {
      toast.success(`Target set to ${val} questions/day!`, {
        description: "Your daily dashboard tracker has been updated.",
      });
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
  const todayStr = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  return (
    <PageShell>
      <TrialBanner />

      {/* Top Quick Status Bar */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
            <Sparkles className="h-3.5 w-3.5" /> NEET 2027 Track
          </span>
          <span className="hidden text-xs text-muted-foreground sm:inline-block">
            {todayStr}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/leaderboard"
            className="flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-700 transition-colors hover:bg-amber-500/20 dark:text-amber-300"
          >
            <Flame className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
            <span>{streak}d Streak</span>
          </Link>
          <Link
            to="/leaderboard"
            className="flex items-center gap-1.5 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-xs font-bold text-violet-700 transition-colors hover:bg-violet-500/20 dark:text-violet-300"
          >
            <Trophy className="h-3.5 w-3.5 text-violet-500" />
            <span>{profile?.xp_total ?? 0} XP</span>
          </Link>
        </div>
      </div>

      {/* Sleek Hero Card with Typewriter Greeting & Daily Target */}
      <div className="relative mb-6 overflow-hidden rounded-3xl border border-border/80 bg-gradient-to-b from-card via-card to-muted/20 p-5 shadow-soft sm:p-7">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div className="space-y-1">
            <TypewriterGreeting name={firstName} />
            <p className="text-xs text-muted-foreground sm:text-sm">
              Track daily progress, build consistency, and master your NCERT question bank.
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setGoalDialog(true)}
              className="h-9 rounded-xl border-border bg-card/80 text-xs font-semibold shadow-xs hover:border-primary/50 hover:bg-primary/5"
            >
              <Settings2 className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" />
              Set Daily Target
            </Button>
            <Button
              asChild
              size="sm"
              className="h-9 rounded-xl bg-primary px-4 text-xs font-bold text-primary-foreground shadow-sm hover:opacity-90"
            >
              <Link to={daily ? "/quiz/$testId" : "/daily"} params={daily ? { testId: daily.id } : undefined}>
                <PlayCircle className="mr-1.5 h-4 w-4" />
                Solve Today's DPP
              </Link>
            </Button>
          </div>
        </div>

        {/* Daily Target Progress Bar Section */}
        <div className="mt-6 rounded-2xl border border-border/60 bg-muted/30 p-4 backdrop-blur-xs">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Target className="h-4 w-4" />
              </div>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Today's Question Target
                </span>
                <div className="text-base font-black text-foreground sm:text-lg">
                  {todayQuestions}{" "}
                  <span className="text-xs font-semibold text-muted-foreground">
                    / {dailyGoal} questions solved
                  </span>
                </div>
              </div>
            </div>

            <div className="text-right">
              <span className="text-xs font-bold text-foreground">{progressPercent}% Achieved</span>
              <div className="text-[11px] text-muted-foreground">
                {todayQuestions >= dailyGoal
                  ? "🎉 Daily target completed!"
                  : `${Math.max(0, dailyGoal - todayQuestions)} questions remaining`}
              </div>
            </div>
          </div>

          <div className="mt-3">
            <Progress
              value={progressPercent}
              className="h-2.5 rounded-full bg-secondary"
            />
          </div>

          <div className="mt-3.5 flex flex-wrap items-center justify-between gap-3 border-t border-border/40 pt-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-4">
              <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {todayCorrect} correct
              </span>
              <span className="inline-flex items-center gap-1 text-rose-500 font-medium">
                <HelpCircle className="h-3.5 w-3.5" />
                {todayWrong} wrong
              </span>
            </div>
            <div className="font-medium text-foreground">
              Today's Accuracy:{" "}
              <span className="font-bold text-primary">
                {todayQuestions > 0 ? `${todayAccuracy}%` : "—"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Target Setting Dialog */}
      <Dialog open={goalDialog} onOpenChange={setGoalDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Set Your Daily Target</DialogTitle>
            <DialogDescription>
              Set the number of MCQs you aim to solve each day to build high exam stamina.
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
              <p className="text-[11px] text-muted-foreground">
                High-yield NEET aspirants recommend 30–60 daily questions.
              </p>
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

      {/* Tournaments Info Modal */}
      <Dialog open={tournamentsDialog} onOpenChange={setTournamentsDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-fuchsia-500" />
              NEET Weekend Tournaments
            </DialogTitle>
            <DialogDescription>
              Bracket-style elimination championship with top NEET aspirants nationwide.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-3 text-sm text-muted-foreground">
            <div className="rounded-2xl border border-fuchsia-500/20 bg-fuchsia-500/5 p-4">
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

      {/* Multi-color KPI Metric Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard
          icon={CheckCircle2}
          label="Today's Solved"
          value={String(todayQuestions)}
          subtitle={`${todayCorrect} correct`}
          badge="Live"
          accentColor="text-sky-600 dark:text-sky-400"
          bgColor="bg-sky-500/10"
        />
        <KpiCard
          icon={BarChart3}
          label="Today's Accuracy"
          value={todayQuestions > 0 ? `${todayAccuracy}%` : "—"}
          subtitle={todayQuestions > 0 ? "Calculated live" : "Solve a quiz"}
          badge="Daily"
          accentColor="text-emerald-600 dark:text-emerald-400"
          bgColor="bg-emerald-500/10"
        />
        <KpiCard
          icon={Flame}
          label="Active Streak"
          value={`${streak}d`}
          subtitle="Consistency score"
          badge="Rank"
          accentColor="text-amber-600 dark:text-amber-400"
          bgColor="bg-amber-500/10"
        />
        <KpiCard
          icon={Trophy}
          label="Total XP"
          value={String(profile?.xp_total ?? 0)}
          subtitle="Leaderboard score"
          badge="Global"
          accentColor="text-violet-600 dark:text-violet-400"
          bgColor="bg-violet-500/10"
        />
      </div>

      {/* Quick Practice by Subject */}
      <Section title="Quick Practice by Subject" first>
        <div className="grid grid-cols-4 gap-3">
          {SUBJECTS.map((s) => (
            <Link
              key={s.name}
              to="/subjects/$subject"
              params={{ subject: s.name }}
              className="group block text-center"
            >
              <div
                className={`relative flex aspect-square items-center justify-center rounded-2xl bg-gradient-to-br ${s.tint} shadow-soft ring-1 ${s.ring} transition-all duration-200 group-hover:-translate-y-1 group-hover:shadow-elegant`}
              >
                <s.icon className="h-8 w-8 text-white sm:h-10 sm:w-10" strokeWidth={1.8} />
              </div>
              <div className="mt-2 text-xs font-bold text-foreground sm:text-sm">{s.name}</div>
            </Link>
          ))}
        </div>
      </Section>

      {/* Practice Arenas */}
      <Section title="Practice Arenas">
        <div className="space-y-3">
          {/* DPP HUB Featured Tile */}
          <ToolCard
            to={daily ? "/quiz/$testId" : "/daily"}
            params={daily ? { testId: daily.id } : undefined}
            title="DPP HUB"
            subtitle={`Daily Practice Problem Set · 20-min speed drill · ${streak}-day streak`}
            icon={CalendarDays}
            tint="from-emerald-600 to-teal-700"
            badge="TODAY'S DPP"
          />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <SmallTool
              to="/dpp"
              title="ALL DPP"
              subtitle="Browse topic-wise DPPs, past sets & quizzes"
              icon={SlidersHorizontal}
              tint="from-sky-500 to-blue-600"
              tall
            />
            <SmallTool
              to="/generate"
              title="Custom Test"
              subtitle="Build customized tests by chapter & difficulty"
              icon={FileText}
              tint="from-violet-500 to-purple-600"
              tall
              badge="CUSTOM"
            />
          </div>
        </div>
      </Section>

      {/* Exams & Live Contests */}
      <Section title="Exams & Live Contests">
        <div className="space-y-3">
          <ToolCard
            to="/mocks"
            title="All Mock Tests"
            subtitle="Full-length 720-mark NEET pattern mock examinations with timer & analysis"
            icon={Brain}
            tint="from-blue-600 to-indigo-700"
          />

          <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
            <SmallTool
              to="/contests"
              title="Cash Contests"
              subtitle="Daily 7 PM · Win prizes"
              icon={Trophy}
              tint="from-amber-500 to-orange-600"
              tall
              badge="LIVE"
            />
            <SmallTool
              to="/battlegrounds"
              title="Battlegrounds"
              subtitle="1v1 Real-time Quiz"
              icon={Swords}
              tint="from-rose-500 to-red-600"
              tall
              badge="1V1"
            />
            <SmallTool
              to="#"
              title="Tournaments"
              subtitle="Weekend championship"
              icon={Crown}
              tint="from-fuchsia-500 to-purple-600"
              tall
              badge="WEEKLY"
              onClick={(e) => {
                e.preventDefault();
                setTournamentsDialog(true);
              }}
            />
          </div>
        </div>
      </Section>

      {/* High-Yield Study Tools */}
      <Section title="High-Yield Study Tools">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <SmallTool
              to="/flashcards"
              title="Flashcards"
              subtitle="High-yield formula & concept cards"
              icon={Layers}
              tint="from-cyan-500 to-teal-600"
              tall
            />
            <SmallTool
              to="/ai-path"
              title="AI Path"
              subtitle="7-day personalized study roadmap"
              icon={RouteIcon}
              tint="from-fuchsia-500 to-purple-600"
              tall
            />
          </div>

          <ToolCard
            to="/highlighted-ncert"
            title="Highlighted NCERT"
            subtitle="Class 11 & 12 Biology · PYQ-coloured high-yield lines"
            icon={BookMarked}
            tint="from-emerald-600 to-teal-600"
          />

          <ToolCard
            to="/ncert-highlights"
            title="NCERT Highlights"
            subtitle="High-probability recurring NCERT lines for NEET"
            icon={Highlighter}
            tint="from-amber-500 to-orange-600"
          />

          <div className="grid grid-cols-2 gap-3">
            <SmallTool
              to="/neetlab"
              title="NEETLab"
              subtitle="3D simulations & models"
              icon={Compass}
              tint="from-yellow-500 to-amber-600"
            />
            <SmallTool
              to="/bookmarks"
              title="Bookmarks"
              subtitle="Saved questions bank"
              icon={RefreshCw}
              tint="from-pink-500 to-rose-600"
            />
          </div>

          <ToolCard
            to="/score-predictor"
            title="Score Predictor"
            subtitle="AI NEET score forecast & percentile rank analysis"
            icon={Target}
            tint="from-red-500 to-orange-600"
          />

          <ToolCard
            to="/progress"
            title="Weekly Progress Report"
            subtitle="Detailed accuracy, subject analysis & parent reporting"
            icon={TrendingUp}
            tint="from-teal-500 to-emerald-600"
          />
        </div>
      </Section>

      {/* Community & Referrals */}
      <Section title="Community & Support">
        <div className="grid grid-cols-2 gap-3">
          <SmallTool
            to="/community"
            title="Our Community"
            subtitle="WhatsApp & Telegram groups"
            icon={Users}
            tint="from-green-500 to-emerald-600"
            tall
          />
          <SmallTool
            to="/referrals"
            title="Refer & Earn"
            subtitle="Invite friends, get coins"
            icon={Gift}
            tint="from-amber-500 to-yellow-600"
            tall
          />
          <Link to="/feedback" className="col-span-2 block h-full">
            <div className="flex h-full min-h-[76px] items-center gap-3.5 rounded-2xl border border-border bg-card p-4 shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:shadow-elegant">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 text-white shadow-sm">
                <MessageSquare className="h-5 w-5" strokeWidth={1.8} />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold text-foreground">Feedback & Feature Requests</div>
                <div className="text-xs text-muted-foreground">
                  Tell us what test series or features you need next
                </div>
              </div>
            </div>
          </Link>
        </div>
      </Section>

      {/* Admin Quick Console */}
      {isAdmin && (
        <Section title="Admin Console">
          <Card className="border-primary/30 bg-gradient-to-r from-primary via-emerald-700 to-teal-800 text-primary-foreground shadow-elegant">
            <CardContent className="flex items-center justify-between gap-3 p-5">
              <div>
                <div className="text-xs uppercase tracking-widest opacity-80">Admin Console</div>
                <div className="mt-1 text-base font-semibold">Manage tests, questions & users</div>
              </div>
              <Button asChild variant="secondary" size="sm" className="rounded-xl font-bold">
                <Link to="/admin">
                  Open Admin <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </Section>
      )}
    </PageShell>
  );
}

/* =========================================================================
   Typewriter Greeting Component
   Smooth typing effect for "Good morning / afternoon / evening, {name}"
   ========================================================================= */
function TypewriterGreeting({ name }: { name: string }) {
  const [displayText, setDisplayText] = useState("");
  const [isDone, setIsDone] = useState(false);

  useEffect(() => {
    const hour = new Date().getHours();
    let prefix = "Good morning";
    if (hour >= 12 && hour < 17) prefix = "Good afternoon";
    else if (hour >= 17) prefix = "Good evening";

    const target = `${prefix}, ${name}`;
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
    <div className="min-h-[2.25rem] sm:min-h-[2.5rem]">
      <h1 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl">
        <span>{displayText}</span>
        <span
          className={`ml-1 inline-block h-6 w-0.5 rounded-full bg-primary align-middle sm:h-7 ${
            isDone ? "animate-pulse" : "opacity-100"
          }`}
        />
      </h1>
    </div>
  );
}

/* =========================================================================
   Section Header
   ========================================================================= */
function Section({
  title,
  children,
  first,
}: {
  title: string;
  children: React.ReactNode;
  first?: boolean;
}) {
  return (
    <section className={first ? "mt-4" : "mt-6"}>
      <div className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
        {title}
      </div>
      {children}
    </section>
  );
}

/* =========================================================================
   KPI Metric Card
   ========================================================================= */
function KpiCard({
  icon: Icon,
  label,
  value,
  subtitle,
  badge,
  accentColor,
  bgColor,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  subtitle: string;
  badge?: string;
  accentColor: string;
  bgColor: string;
}) {
  return (
    <div className="group rounded-2xl border border-border bg-card p-3.5 shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:shadow-elegant">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${bgColor} ${accentColor}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="mt-2 text-xl font-black tracking-tight text-foreground sm:text-2xl">
        {value}
      </div>
      <div className="mt-1 flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground">{subtitle}</span>
        {badge && (
          <span className="rounded-md bg-muted px-1.5 py-0.5 text-[9px] font-bold uppercase text-muted-foreground">
            {badge}
          </span>
        )}
      </div>
    </div>
  );
}

/* =========================================================================
   ToolCard (Large horizontal interactive card)
   ========================================================================= */
function ToolCard({
  to,
  params,
  title,
  subtitle,
  icon: Icon,
  tint,
  badge,
}: {
  to: string;
  params?: Record<string, string>;
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  tint?: string;
  badge?: string;
}) {
  const grad = tint ?? "from-primary to-blue-600";
  return (
    <Link to={to as never} params={params as never} className="block">
      <div className="group relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:border-border/80 hover:shadow-elegant">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-base font-extrabold text-foreground group-hover:text-primary transition-colors sm:text-lg">
                {title}
              </span>
              {badge && (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[9px] font-extrabold tracking-wider text-primary">
                  {badge}
                </span>
              )}
            </div>
            <div className="mt-1 text-xs text-muted-foreground sm:text-sm">{subtitle}</div>
          </div>
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${grad} text-white shadow-md transition-transform group-hover:scale-105`}
          >
            <Icon className="h-6 w-6" strokeWidth={1.8} />
          </div>
        </div>
      </div>
    </Link>
  );
}

/* =========================================================================
   SmallTool (Grid card with colored gradient icon & badges)
   ========================================================================= */
function SmallTool({
  to,
  title,
  subtitle,
  icon: Icon,
  tint,
  badge,
  tall,
  onClick,
}: {
  to: string;
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  tint?: string;
  badge?: string;
  tall?: boolean;
  onClick?: (e: React.MouseEvent) => void;
}) {
  const grad = tint ?? "from-primary to-blue-600";
  const isLive = badge === "LIVE" || badge === "1V1";
  return (
    <Link to={to as never} onClick={onClick} className="block h-full">
      <div
        className={`group flex h-full ${
          tall ? "min-h-[115px]" : "min-h-[90px]"
        } flex-col justify-between rounded-2xl border border-border bg-card p-4 shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:border-border/80 hover:shadow-elegant`}
      >
        <div className="flex items-start justify-between gap-2">
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${grad} text-white shadow-sm transition-transform group-hover:scale-105`}
          >
            <Icon className="h-4 w-4" strokeWidth={2} />
          </div>
          {badge && (
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-extrabold tracking-wider ${
                isLive
                  ? "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {isLive && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />}
              {badge}
            </span>
          )}
        </div>
        <div className="mt-2 min-w-0">
          <div className="flex items-center justify-between">
            <div className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">
              {title}
            </div>
            <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
          </div>
          <div className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">{subtitle}</div>
        </div>
      </div>
    </Link>
  );
}
