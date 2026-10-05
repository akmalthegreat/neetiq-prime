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
import { PremiumDashboard } from "@/components/dashboard/premium-dashboard";

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

  const firstName = profile?.full_name?.trim()?.split(" ")[0] || "Akmal";

  return (
    <PremiumDashboard
      firstName={firstName}
      streak={streak}
      dailyGoal={dailyGoal}
      todayQuestions={todayQuestions}
      todayCorrect={todayCorrect}
      todayWrong={todayWrong}
      todayAccuracy={todayAccuracy}
      progressPercent={progressPercent}
      subjectCounts={subjectCounts}
      onEditTarget={() => setGoalDialog(true)}
    />
  );}

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
