import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageShell } from "@/components/page-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Loader2, ArrowRight, CalendarDays, Flame, Sparkles,
  Atom, FlaskConical, Leaf, Dna, SlidersHorizontal, Brain,
  FileText, BookMarked, RefreshCw, TrendingUp, Trophy,
  Gift, MessageSquare, Layers, Users, Highlighter, Route as RouteIcon, Target, Coins,
  Swords, Crown,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

const comingSoon = (label: string) =>
  toast.info(`${label} — Coming Soon`, { description: "We're putting the final touches on it." });

type Test = { id: string; title: string; type: string; difficulty: string; duration_min: number; total_questions: number };

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — NEETIQ Prime" }] }),
  component: Dashboard,
});

const SUBJECTS = [
  { name: "Physics", icon: Atom, tint: "from-sky-500 to-blue-600", ring: "ring-sky-400/30" },
  { name: "Chemistry", icon: FlaskConical, tint: "from-orange-500 to-rose-600", ring: "ring-orange-400/30" },
  { name: "Zoology", icon: Leaf, tint: "from-emerald-500 to-teal-600", ring: "ring-emerald-400/30" },
  { name: "Botany", icon: Dna, tint: "from-lime-500 to-green-600", ring: "ring-lime-400/30" },
];

function Dashboard() {
  const { user, profile, isAdmin, loading, refresh } = useAuth();
  const nav = useNavigate();
  const [daily, setDaily] = useState<Test | null | undefined>(undefined);
  const [streak, setStreak] = useState<number>(0);

  useEffect(() => { if (!loading && !user) nav({ to: "/login" }); }, [user, loading, nav]);
  useEffect(() => { if (user) refresh(); }, [user?.id]);
  useEffect(() => {
    supabase.from("tests").select("id,title,type,difficulty,duration_min,total_questions")
      .eq("type", "daily").order("created_at", { ascending: false }).limit(1).maybeSingle()
      .then(({ data }) => setDaily((data as Test | null) ?? null));
  }, []);

  // Compute current daily streak from completed attempts
  useEffect(() => {
    if (!user) return;
    const since = new Date(); since.setDate(since.getDate() - 60); since.setHours(0, 0, 0, 0);
    supabase
      .from("attempts")
      .select("submitted_at")
      .eq("user_id", user.id)
      .eq("status", "completed")
      .gte("submitted_at", since.toISOString())
      .then(({ data }) => {
        const days = new Set(
          (data ?? [])
            .map((a) => a.submitted_at)
            .filter((s): s is string => !!s)
            .map((s) => new Date(s).toISOString().slice(0, 10)),
        );
        let s = 0;
        const cur = new Date(); cur.setHours(0, 0, 0, 0);
        // Allow today missing but streak continues from yesterday
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

  if (loading || !user) {
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  const firstName = profile?.full_name?.split(" ")[0] ?? "Aspirant";
  const today = new Date().toISOString().slice(0, 10);

  return (
    <PageShell>
      {/* Top status strip */}
      <div className="-mt-2 mb-2 grid grid-cols-3 gap-1.5 sm:max-w-md">
        <StatPill icon={CalendarDays} label="NEET" value="2027" />
        <Link to="/leaderboard"><StatPill icon={Flame} label="Streak" value={`${streak}d`} /></Link>
        <Link to="/leaderboard"><StatPill icon={Trophy} label="XP" value={String((profile as unknown as { xp_total?: number } | null)?.xp_total ?? 0)} /></Link>
      </div>

      {/* Quick Practice */}
      <Section title="Quick Practice" first>
        <div className="grid grid-cols-4 gap-3">
          {SUBJECTS.map((s) => (
            <Link key={s.name} to="/subjects/$subject" params={{ subject: s.name }} className="group">
            <div className={`flex aspect-square items-center justify-center rounded-2xl bg-gradient-to-br ${s.tint} opacity-90 shadow-soft ring-1 ${s.ring} transition-transform group-hover:-translate-y-0.5`}>
                <s.icon className="h-8 w-8 text-white sm:h-10 sm:w-10" strokeWidth={1.8} />
              </div>
              <div className="mt-2 text-center text-sm font-semibold">{s.name}</div>
            </Link>
          ))}
        </div>
      </Section>

      {/* Daily DPP — uniform tile style */}
      <Section title="Daily DPP">
        <ToolCard
          to={daily ? "/quiz/$testId" : "/daily"}
          params={daily ? { testId: daily.id } : undefined}
          title="Daily DPP"
          subtitle={`20-min NEET practice · ${streak}-day streak · ${today}`}
          icon={CalendarDays}
          tint="from-sky-500 to-blue-600"
        />
      </Section>

      {/* Live Contests — uniform tiles */}
      <Section title="Live Contests">
        <ToolCard
          to="/contests"
          title="Cash Contests"
          subtitle="Daily 7 PM · live leaderboard · win real prizes"
          icon={Trophy}
          tint="from-amber-500 to-orange-600"
          badge="LIVE"
        />

        <div className="mt-3 grid grid-cols-2 gap-3">
          <SmallTool
            to="/battlegrounds"
            title="Battlegrounds"
            subtitle="Pick stake · Free / ₹2 / ₹5 / ₹10 / ₹25"
            icon={Swords}
            tint="from-rose-500 to-red-600"
            tall
            badge="LIVE"
          />
          <SmallTool
            to="#"
            title="Tournaments"
            subtitle="Bracket-style elimination"
            icon={Crown}
            tint="from-fuchsia-500 to-purple-600"
            tall
            badge="SOON"
            onClick={(e) => { e.preventDefault(); comingSoon("Tournaments"); }}
          />
        </div>
      </Section>

      {/* Study Tools — distinct per-feature accent colors */}
      <Section title="Study Tools">
        <div className="space-y-3">
          <ToolCard
            to="/dpp"
            title="All DPP & Quiz"
            subtitle="Daily Practice Problems and topic quizzes"
            icon={SlidersHorizontal}
            tint="from-sky-500 to-blue-600"
          />
          <ToolCard
            to="/mocks"
            title="All Mock Tests"
            subtitle="Full-length NEET-pattern mocks"
            icon={Brain}
            tint="from-violet-500 to-indigo-600"
            bonus={10}
          />

          <div className="grid grid-cols-2 gap-3">
            <SmallTool to="/generate" title="Generate Test" subtitle="Custom DPP wizard" icon={FileText} bonus={5} tint="from-orange-500 to-rose-600" />
            <div className="grid gap-3">
              <SmallTool to="/neetlab" title="NEETLab" subtitle="3D simulations & PYQs" icon={BookMarked} tint="from-amber-500 to-yellow-600" />
              <SmallTool to="/bookmarks" title="Bookmarks" subtitle="Saved questions" icon={RefreshCw} tint="from-pink-500 to-rose-600" />
            </div>
          </div>

          {/* Flashcards + AI Path */}
          <div className="grid grid-cols-2 gap-3">
            <SmallTool to="/flashcards" title="Flashcards" subtitle="Flip & recall high-yield concepts" icon={Layers} bonus={15} tint="from-cyan-500 to-teal-600" tall />
            <SmallTool to="/ai-path" title="AI Path" subtitle="7-day personalized plan" icon={RouteIcon} bonus={45} tint="from-fuchsia-500 to-purple-600" tall />
          </div>

          <ToolCard
            to="/highlighted-ncert"
            title="Highlighted NCERT"
            subtitle="Class 11 & 12 Biology · PYQ-coloured lines & diagrams"
            icon={BookMarked}
            tint="from-emerald-500 to-teal-600"
          />

          <ToolCard
            to="/ncert-highlights"
            title="NCERT Highlights"
            subtitle="Most-repeated NCERT lines for NEET"
            icon={Highlighter}
            tint="from-emerald-500 to-green-600"
            bonus={15}
          />

          <ToolCard
            to="/score-predictor"
            title="Score Predictor"
            subtitle="AI NEET score & rank forecast"
            icon={Target}
            tint="from-red-500 to-orange-600"
            bonus={25}
          />

          <ToolCard
            to="/progress"
            title="Weekly Progress Report"
            subtitle="Parent dashboard analytics"
            icon={TrendingUp}
            tint="from-teal-500 to-emerald-600"
          />
        </div>
      </Section>


      {/* More — Community, Refer & Earn, Feedback */}
      <Section title="More">
        <div className="grid grid-cols-2 gap-3">
          <SmallTool to="/community" title="Our Community" subtitle="WhatsApp & Telegram channels" icon={Users} tint="from-green-500 to-emerald-600" tall />
          <SmallTool to="/referrals" title="Refer & Earn" subtitle="Invite friends, get bonus" icon={Gift} bonus={50} tint="from-yellow-500 to-amber-600" tall />
          <Link to="/feedback" className="col-span-2 block h-full">
            <div className="flex h-full min-h-[88px] items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-soft transition-transform hover:-translate-y-0.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 text-white shadow-sm">
                <MessageSquare className="h-5 w-5" strokeWidth={1.8} />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold leading-tight text-foreground">Feedback</div>
                <div className="mt-0.5 text-xs text-muted-foreground">Tell us what to improve</div>
              </div>
            </div>
          </Link>
        </div>
      </Section>



      {isAdmin && (
        <Section title="Admin">
          <Card className="border-primary/30 bg-gradient-primary text-primary-foreground shadow-elegant">
            <CardContent className="flex items-center justify-between gap-3 p-5">
              <div>
                <div className="text-xs uppercase tracking-widest opacity-80">Admin</div>
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

function StatPill({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-center gap-1.5 rounded-full border border-border bg-card px-2 py-1.5 shadow-sm">
      <Icon className="h-3.5 w-3.5 shrink-0 text-primary" />
      <div className="min-w-0 leading-tight">
        <div className="truncate text-[8px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="truncate text-[11px] font-bold">{value}</div>
      </div>
    </div>
  );
}

// Map gradient tints to subtle tile backgrounds + border + bonus pill colors (works in light & dark)
function tintStyles(tint?: string) {
  const t = tint ?? "from-primary to-blue-600";
  // Extract the "from-xxx-500" base color name
  const m = t.match(/from-([a-z]+)-\d+/);
  const c = m?.[1] ?? "primary";
  if (c === "primary") {
    return {
      bg: "bg-gradient-to-br from-primary/15 via-card to-primary/25",
      border: "border-primary/40 hover:border-primary/70",
      pill: "bg-primary/20 text-primary",
    };
  }
  return {
    bg: `bg-gradient-to-br from-${c}-500/20 via-card to-${c}-500/25 dark:from-${c}-500/25 dark:to-${c}-500/35`,
    border: `border-${c}-500/40 hover:border-${c}-500/70`,
    pill: `bg-${c}-500/20 text-${c}-700 dark:text-${c}-300`,
  };
}

function ToolCard({ to, params, title, subtitle, icon: Icon, bonus, tint, badge }: {
  to: string; params?: Record<string, string>; title: string; subtitle: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  bonus?: number; tint?: string; badge?: string;
}) {
  const grad = tint ?? "from-primary to-blue-600";
  const s = tintStyles(tint);
  return (
    <Link to={to as never} params={params as never} className="block">
      <div className={`relative overflow-hidden rounded-2xl border ${s.border} ${s.bg} p-5 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-elegant`}>
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="text-[15px] font-bold uppercase tracking-wide text-foreground">{title}</div>
              {badge && <BadgePill text={badge} />}
            </div>
            <div className="mt-1 text-sm text-muted-foreground">{subtitle}</div>
            {bonus !== undefined && <BonusPill amount={bonus} className={`mt-2 ${s.pill}`} />}
          </div>
          <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${grad} text-white shadow-md`}>
            <Icon className="h-7 w-7" strokeWidth={1.6} />
          </div>
        </div>
      </div>
    </Link>
  );
}

function SmallTool({ to, title, subtitle, icon: Icon, bonus, tall, tint, badge, onClick }: {
  to: string; title: string; subtitle: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  bonus?: number; tall?: boolean; tint?: string; badge?: string;
  onClick?: (e: React.MouseEvent) => void;
}) {
  const grad = tint ?? "from-primary to-blue-600";
  const s = tintStyles(tint);
  return (
    <Link to={to as never} onClick={onClick} className="block h-full">
      <div className={`flex h-full ${tall ? "min-h-[132px]" : ""} flex-col justify-between rounded-2xl border ${s.border} ${s.bg} p-4 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-elegant`}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-sm font-bold uppercase tracking-wide leading-tight text-foreground">{title}</div>
            {badge && <div className="mt-1"><BadgePill text={badge} /></div>}
          </div>
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${grad} text-white shadow-sm`}>
            <Icon className="h-4 w-4" strokeWidth={1.8} />
          </div>
        </div>
        <div>
          <div className="mt-2 text-xs text-muted-foreground">{subtitle}</div>
          {bonus !== undefined && <BonusPill amount={bonus} className={`mt-2 ${s.pill}`} />}
        </div>
      </div>
    </Link>
  );
}

function BadgePill({ text }: { text: string }) {
  const isLive = text.toUpperCase() === "LIVE";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
      isLive
        ? "bg-red-500/15 text-red-600 dark:text-red-400"
        : "bg-muted text-muted-foreground"
    }`}>
      {isLive && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />}
      {text}
    </span>
  );
}

function ComingSoonTile({ title, subtitle, icon: Icon, onClick, tint = "from-primary/90 via-accent/80 to-primary/70" }: {
  title: string; subtitle: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  onClick: () => void;
  tint?: string;
}) {
  return (
    <button type="button" onClick={onClick} className="block h-full w-full text-left">
      <div className={`relative flex h-full min-h-[132px] flex-col justify-between overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br ${tint} p-4 text-primary-foreground shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-elegant`}>
        <div className="flex items-start justify-between gap-2">
          <div className="text-sm font-bold uppercase tracking-wide leading-tight">{title}</div>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-background/20 text-primary-foreground shadow-sm backdrop-blur">
            <Icon className="h-4 w-4" strokeWidth={1.8} />
          </div>
        </div>
        <div>
          <div className="mt-2 text-xs text-primary-foreground/90">{subtitle}</div>
          <span className="mt-2 inline-flex w-fit items-center gap-1 rounded-full bg-background/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary-foreground backdrop-blur">Coming Soon</span>
        </div>
      </div>
    </button>
  );
}


function BonusPill({ amount, className = "" }: { amount: number; className?: string }) {
  return (
    <span className={`inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${className}`}>
      <Coins className="h-3 w-3" /> {amount} bonus
    </span>
  );
}
