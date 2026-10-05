import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { toast } from "sonner";
import { PageShell } from "@/components/page-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Loader2, ArrowRight, CalendarDays, Flame, Sparkles,
  Atom, FlaskConical, Leaf, Dna, SlidersHorizontal, Brain,
  FileText, BookMarked, RefreshCw, TrendingUp, Trophy,
  Gift, MessageSquare, Layers, Users, Highlighter, Route as RouteIcon, Target,
  Swords, Crown, CheckCircle2, Zap, ArrowUpRight, BarChart3, Settings2
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { TrialBanner } from "@/components/dashboard/trial-banner";

const comingSoon = (label: string) =>
  toast.info(`${label} — Coming Soon`, { description: "We're putting the final touches on it." });

type Test = { id: string; title: string; type: string; difficulty: string; duration_min: number; total_questions: number };

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
  { name: "Physics", icon: Atom, tint: "from-emerald-500 to-teal-600", ring: "ring-emerald-400/30" },
  { name: "Chemistry", icon: FlaskConical, tint: "from-teal-500 to-emerald-700", ring: "ring-teal-400/30" },
  { name: "Botany", icon: Leaf, tint: "from-green-500 to-emerald-600", ring: "ring-green-400/30" },
  { name: "Zoology", icon: Dna, tint: "from-lime-500 to-emerald-600", ring: "ring-lime-400/30" },
];

function Dashboard() {
  const { user, profile, isAdmin, loading, refresh } = useAuth();
  const nav = useNavigate();
  const [daily, setDaily] = useState<Test | null | undefined>(undefined);
  const [streak, setStreak] = useState<number>(0);
  const [todayAttempts, setTodayAttempts] = useState<TodayAttempt[]>([]);
  const [goalDialog, setGoalDialog] = useState(false);
  const [goalDraft, setGoalDraft] = useState(30);

  const dailyGoal = profile?.daily_goal ?? 30;

  useEffect(() => {
    if (profile?.daily_goal) setGoalDraft(profile.daily_goal);
  }, [profile?.daily_goal]);

  useEffect(() => { if (!loading && !user) nav({ to: "/login" }); }, [user, loading, nav]);
  useEffect(() => { if (user) refresh(); }, [user?.id]);

  // Fetch featured DPP HUB test
  useEffect(() => {
    supabase.from("tests").select("id,title,type,difficulty,duration_min,total_questions")
      .eq("type", "daily").order("created_at", { ascending: false }).limit(1).maybeSingle()
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
        
        // Filter for today's completed attempts
        const todayItems = attempts.filter((a) => {
          if (!a.submitted_at) return false;
          return new Date(a.submitted_at) >= today;
        });
        setTodayAttempts(todayItems);

        // Calculate streak
        const days = new Set(
          attempts
            .map((a) => a.submitted_at)
            .filter((s): s is string => !!s)
            .map((s) => new Date(s).toISOString().slice(0, 10)),
        );
        let s = 0;
        const cur = new Date(); cur.setHours(0, 0, 0, 0);
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
  const { todayQuestions, todayCorrect, todayAccuracy, progressPercent } = useMemo(() => {
    const questions = todayAttempts.reduce((sum, a) => sum + (a.correct_count ?? 0) + (a.wrong_count ?? 0), 0);
    const correct = todayAttempts.reduce((sum, a) => sum + (a.correct_count ?? 0), 0);
    const accuracy = questions > 0 ? Math.round((correct / questions) * 100) : 0;
    const pct = Math.min(100, Math.round((questions / dailyGoal) * 100));
    return { todayQuestions: questions, todayCorrect: correct, todayAccuracy: accuracy, progressPercent: pct };
  }, [todayAttempts, dailyGoal]);

  const saveDailyGoal = async () => {
    if (!user) return;
    const val = Math.max(5, Math.min(200, Number(goalDraft) || 30));
    const { error } = await supabase.from("profiles").update({ daily_goal: val }).eq("id", user.id);
    if (!error) {
      toast.success(`Daily target updated to ${val} questions!`);
      refresh();
      setGoalDialog(false);
    } else {
      toast.error("Could not update target");
    }
  };

  if (loading || !user) {
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  const firstName = profile?.full_name?.split(" ")[0] ?? "Aspirant";
  const todayStr = new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

  return (
    <PageShell>
      <TrialBanner />

      {/* Hero Welcome & Today Status */}
      <div className="relative mb-6 overflow-hidden rounded-3xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 via-card to-teal-500/10 p-5 shadow-soft sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
              <Zap className="h-3.5 w-3.5" /> NEET 2027 Track
            </div>
            <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
              Welcome back, <span className="text-gradient-primary">{firstName}</span>
            </h1>
            <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
              Today is {todayStr} · Stay consistent and hit your daily target.
            </p>
          </div>

          {/* Quick Header Metric Pills */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-2xl border border-emerald-500/20 bg-card/80 px-3 py-2 shadow-sm backdrop-blur">
              <Flame className="h-4 w-4 text-emerald-700 dark:text-emerald-300" />
              <div>
                <div className="text-[10px] uppercase font-bold text-muted-foreground">Streak</div>
                <div className="text-xs font-extrabold text-foreground">{streak} Days</div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 rounded-2xl border border-emerald-500/20 bg-card/80 px-3 py-2 shadow-sm backdrop-blur">
              <Trophy className="h-4 w-4 text-emerald-700 dark:text-emerald-300" />
              <div>
                <div className="text-[10px] uppercase font-bold text-muted-foreground">XP</div>
                <div className="text-xs font-extrabold text-foreground">{profile?.xp_total ?? 0}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Daily Target & Question Count Tracker Card */}
        <div className="mt-5 rounded-2xl border border-border bg-card/90 p-4 shadow-sm backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Target className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Daily Question Target</div>
                <div className="text-base font-extrabold text-foreground sm:text-lg">
                  {todayQuestions} <span className="text-xs font-medium text-muted-foreground">/ {dailyGoal} questions done today</span>
                </div>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setGoalDialog(true)}
              className="h-8 rounded-xl border-emerald-500/30 text-xs font-semibold hover:bg-emerald-500/10"
            >
              <Settings2 className="mr-1.5 h-3.5 w-3.5" /> Set Target
            </Button>
          </div>

          <div className="mt-3">
            <div className="mb-1.5 flex justify-between text-xs font-medium text-muted-foreground">
              <span>{progressPercent}% completed</span>
              <span>{Math.max(0, dailyGoal - todayQuestions)} questions left</span>
            </div>
            <Progress value={progressPercent} className="h-2.5 rounded-full bg-secondary" />
          </div>
        </div>
      </div>

      {/* Target Setting Dialog */}
      <Dialog open={goalDialog} onOpenChange={setGoalDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Set Your Daily Question Target</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-3">
            <div className="space-y-2">
              <Label>Target Questions per Day</Label>
              <Input
                type="number"
                min={5}
                max={200}
                value={goalDraft}
                onChange={(e) => setGoalDraft(Number(e.target.value))}
                placeholder="30"
              />
              <p className="text-xs text-muted-foreground">Recommended: 30–60 questions daily for NEET high yield.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setGoalDialog(false)}>Cancel</Button>
            <Button onClick={saveDailyGoal} className="bg-primary text-primary-foreground">Save Target</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Statistics Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          icon={CheckCircle2}
          label="Today's Solved"
          value={String(todayQuestions)}
          sub={`${todayCorrect} correct`}
          tint="text-emerald-700 dark:text-emerald-300"
        />
        <StatCard
          icon={BarChart3}
          label="Today's Accuracy"
          value={todayQuestions > 0 ? `${todayAccuracy}%` : "—"}
          sub={todayQuestions > 0 ? "Live calculation" : "Solve a DPP"}
          tint="text-teal-700 dark:text-teal-300"
        />
        <StatCard
          icon={Flame}
          label="Active Streak"
          value={`${streak}d`}
          sub="Consistency rank"
          tint="text-emerald-700 dark:text-emerald-300"
        />
        <StatCard
          icon={Trophy}
          label="Total Points"
          value={String(profile?.xp_total ?? 0)}
          sub="Leaderboard score"
          tint="text-green-700 dark:text-green-300"
        />
      </div>

      {/* Quick Practice Subjects */}
      <Section title="Quick Practice by Subject" first>
        <div className="grid grid-cols-4 gap-3">
          {SUBJECTS.map((s) => (
            <Link key={s.name} to="/subjects/$subject" params={{ subject: s.name }} className="group">
              <div className={`flex aspect-square items-center justify-center rounded-2xl bg-gradient-to-br ${s.tint} shadow-soft ring-1 ${s.ring} transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-elegant`}>
                <s.icon className="h-8 w-8 text-white sm:h-10 sm:w-10" strokeWidth={1.8} />
              </div>
              <div className="mt-2 text-center text-xs font-bold text-foreground sm:text-sm">{s.name}</div>
            </Link>
          ))}
        </div>
      </Section>

      {/* Primary Practice Arenas: DPP HUB & ALL DPP */}
      <Section title="Practice Arenas">
        <div className="space-y-3">
          {/* DPP HUB Featured Tile */}
          <ToolCard
            to={daily ? "/quiz/$testId" : "/daily"}
            params={daily ? { testId: daily.id } : undefined}
            title="DPP HUB"
            subtitle={`Daily Practice Problem Set · 20-min speed drill · ${streak}-day streak`}
            icon={CalendarDays}
            tint="from-emerald-500 to-teal-700"
            badge="TODAY'S DPP"
          />

          {/* ALL DPP & Custom Test Grid */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <SmallTool
              to="/dpp"
              title="ALL DPP"
              subtitle="Browse topic-wise DPPs, past sets & quizzes"
              icon={SlidersHorizontal}
              tint="from-teal-500 to-emerald-600"
              tall
            />
            <SmallTool
              to="/generate"
              title="Custom Test"
              subtitle="Build your customized test by chapter & difficulty"
              icon={FileText}
              bonus={5}
              tint="from-green-500 to-teal-600"
              tall
              badge="CUSTOM"
            />
          </div>
        </div>
      </Section>

      {/* Tests & Mock Exams */}
      <Section title="Exams & Contests">
        <div className="space-y-3">
          <ToolCard
            to="/mocks"
            title="All Mock Tests"
            subtitle="Full-length 720-mark NEET pattern mock examinations with timer & analysis"
            icon={Brain}
            tint="from-emerald-600 to-green-700"
            bonus={10}
          />

          <div className="grid grid-cols-2 gap-3">
            <SmallTool
              to="/contests"
              title="Cash Contests"
              subtitle="Daily 7 PM · Win prizes"
              icon={Trophy}
              tint="from-amber-500 to-emerald-600"
              tall
              badge="LIVE"
            />
            <SmallTool
              to="/battlegrounds"
              title="Battlegrounds"
              subtitle="1v1 Real-time NEET Quiz"
              icon={Swords}
              tint="from-teal-600 to-emerald-700"
              tall
              badge="1V1"
            />
          </div>
        </div>
      </Section>

      {/* Study & High-Yield Tools */}
      <Section title="High-Yield Study Tools">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <SmallTool to="/flashcards" title="Flashcards" subtitle="High-yield formula & concept cards" icon={Layers} bonus={15} tint="from-emerald-500 to-teal-600" tall />
            <SmallTool to="/ai-path" title="AI Path" subtitle="7-day personalized study roadmap" icon={RouteIcon} bonus={45} tint="from-teal-600 to-green-600" tall />
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
            tint="from-teal-600 to-emerald-700"
            bonus={15}
          />

          <div className="grid grid-cols-2 gap-3">
            <SmallTool to="/neetlab" title="NEETLab" subtitle="3D simulations & models" icon={BookMarked} tint="from-green-600 to-emerald-700" />
            <SmallTool to="/bookmarks" title="Bookmarks" subtitle="Saved questions bank" icon={RefreshCw} tint="from-teal-600 to-emerald-600" />
          </div>

          <ToolCard
            to="/score-predictor"
            title="Score Predictor"
            subtitle="AI NEET score forecast & percentile rank analysis"
            icon={Target}
            tint="from-emerald-600 to-teal-700"
            bonus={25}
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
          <SmallTool to="/community" title="Our Community" subtitle="WhatsApp & Telegram groups" icon={Users} tint="from-emerald-500 to-teal-600" tall />
          <SmallTool to="/referrals" title="Refer & Earn" subtitle="Invite friends, get coins" icon={Gift} bonus={50} tint="from-green-500 to-emerald-600" tall />
          <Link to="/feedback" className="col-span-2 block h-full">
            <div className="flex h-full min-h-[76px] items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-soft transition-transform hover:-translate-y-0.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-sm">
                <MessageSquare className="h-5 w-5" strokeWidth={1.8} />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold text-foreground">Feedback & Requests</div>
                <div className="text-xs text-muted-foreground">Tell us what features you need next</div>
              </div>
            </div>
          </Link>
        </div>
      </Section>

      {isAdmin && (
        <Section title="Admin Controls">
          <Card className="border-emerald-500/30 bg-gradient-primary text-primary-foreground shadow-elegant">
            <CardContent className="flex items-center justify-between gap-3 p-5">
              <div>
                <div className="text-xs uppercase tracking-widest opacity-80">Admin Console</div>
                <div className="mt-1 text-base font-semibold">Manage tests, contests & questions</div>
              </div>
              <Button asChild variant="secondary" size="sm">
                <Link to="/admin">Open <ArrowRight className="ml-1 h-4 w-4" /></Link>
              </Button>
            </CardContent>
          </Card>
        </Section>
      )}
    </PageShell>
  );
}

function Section({ title, children, first }: { title: string; children: React.ReactNode; first?: boolean }) {
  return (
    <section className={first ? "mt-4" : "mt-6"}>
      <div className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">{title}</div>
      {children}
    </section>
  );
}

function StatCard({ icon: Icon, label, value, sub, tint }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub: string;
  tint?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3.5 shadow-soft transition-transform hover:-translate-y-0.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
        <Icon className={`h-4 w-4 ${tint ?? "text-primary"}`} />
      </div>
      <div className="mt-2 text-xl font-extrabold text-foreground">{value}</div>
      <div className="mt-0.5 text-[11px] text-muted-foreground">{sub}</div>
    </div>
  );
}

function tintStyles(tint?: string) {
  const t = tint ?? "from-emerald-500 to-teal-700";
  return {
    bg: "bg-card hover:bg-emerald-500/[0.04]",
    border: "border-border hover:border-emerald-500/40",
    pill: "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300",
  };
}

function ToolCard({ to, params, title, subtitle, icon: Icon, bonus, tint, badge }: {
  to: string; params?: Record<string, string>; title: string; subtitle: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  bonus?: number; tint?: string; badge?: string;
}) {
  const s = tintStyles(tint);
  return (
    <Link to={to as never} params={params as never} className="block">
      <div className={`relative overflow-hidden rounded-2xl border ${s.border} ${s.bg} p-5 shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:shadow-elegant`}>
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-base font-extrabold text-foreground sm:text-lg">{title}</span>
              {badge && (
                <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[9px] font-extrabold tracking-wider text-emerald-800 dark:text-emerald-300">
                  {badge}
                </span>
              )}
              {bonus && (
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${s.pill}`}>
                  +{bonus} XP
                </span>
              )}
            </div>
            <div className="mt-1 text-xs text-muted-foreground sm:text-sm">{subtitle}</div>
          </div>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-soft">
            <Icon className="h-5 w-5" strokeWidth={2} />
          </div>
        </div>
      </div>
    </Link>
  );
}

function SmallTool({ to, title, subtitle, icon: Icon, bonus, tint, badge, tall, onClick }: {
  to: string; title: string; subtitle: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  bonus?: number; tint?: string; badge?: string; tall?: boolean;
  onClick?: (e: React.MouseEvent) => void;
}) {
  const s = tintStyles(tint);
  return (
    <Link to={to as never} onClick={onClick} className="block h-full">
      <div className={`group flex h-full ${tall ? "min-h-[105px]" : "min-h-[85px]"} flex-col justify-between rounded-2xl border ${s.border} ${s.bg} p-4 shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:shadow-elegant`}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-sm">
            <Icon className="h-4 w-4" strokeWidth={2} />
          </div>
          <div className="flex items-center gap-1">
            {badge && (
              <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[9px] font-extrabold tracking-wider text-emerald-800 dark:text-emerald-300">
                {badge}
              </span>
            )}
            {bonus && (
              <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${s.pill}`}>
                +{bonus}
              </span>
            )}
          </div>
        </div>
        <div className="mt-2 min-w-0">
          <div className="flex items-center justify-between">
            <div className="text-sm font-bold text-foreground group-hover:text-primary">{title}</div>
            <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
          </div>
          <div className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">{subtitle}</div>
        </div>
      </div>
    </Link>
  );
}
