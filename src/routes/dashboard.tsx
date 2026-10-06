import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type ComponentType } from "react";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Atom, FlaskConical, Leaf, Dna, ArrowRight, Flame, Target, Trophy, FileText, Bookmark, BarChart3, BookOpen, Brain, Users, CalendarDays, Loader2, RefreshCw, GraduationCap } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { TrialBanner } from "@/components/dashboard/trial-banner";
import mountainImage from "@/assets/dashboard-mountains.jpg";

const description = "Your NEET preparation dashboard: daily goals, subject practice, progress and study resources.";
export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Your Study Dashboard — Neet Buddy" }, { name: "description", content: description }, { property: "og:title", content: "Your Study Dashboard — Neet Buddy" }, { property: "og:description", content: description }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: Dashboard,
});

type Attempt = { correct_count: number; wrong_count: number; submitted_at: string | null; score: number; answers: unknown; tests: { type: string } | null };
type SubjectStats = { total: number; correct: number; chapters: Set<string> };
const SUBJECTS = [
  { name: "Physics", icon: Atom, tone: "text-study-blue bg-study-blue/10 border-study-blue/25" },
  { name: "Chemistry", icon: FlaskConical, tone: "text-study-gold bg-study-gold/10 border-study-gold/25" },
  { name: "Biology", icon: Leaf, tone: "text-study-green bg-study-green/10 border-study-green/25" },
];
function dayKey(date: Date) { return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`; }
function readAnswers(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, number] => typeof entry[1] === "number"));
}

function Dashboard() {
  const { user, profile, isAdmin, loading } = useAuth();
  const nav = useNavigate();
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [stats, setStats] = useState<Record<string, SubjectStats>>({});
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState(false);
  useEffect(() => { if (!loading && !user) nav({ to: "/login" }); }, [loading, user, nav]);
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    async function load() {
      try {
        const since = new Date(); since.setDate(since.getDate() - 60);
        const { data, error } = await supabase.from("attempts").select("correct_count,wrong_count,submitted_at,score,answers,tests(type)").eq("user_id", user?.id ?? "").eq("status", "completed").gte("submitted_at", since.toISOString()).order("submitted_at", { ascending: false }).limit(500);
        if (error) throw error;
        const rows = (data ?? []) as unknown as Attempt[];
        if (cancelled) return;
        setAttempts(rows);
        const ids = [...new Set(rows.flatMap((row) => Object.keys(readAnswers(row.answers))))];
        const buckets: Record<string, SubjectStats> = {};
        // Chunk IDs to keep ordinary browser requests within URL limits.
        for (let offset = 0; offset < ids.length; offset += 150) {
          const { data: questions, error: questionError } = await supabase.from("questions").select("id,correct_index,chapter_id,subjects(name)").in("id", ids.slice(offset, offset + 150));
          if (questionError) throw questionError;
          for (const q of questions ?? []) {
            const subject = q.subjects?.name;
            if (!subject) continue;
            const bucket = buckets[subject] ?? { total: 0, correct: 0, chapters: new Set<string>() };
            for (const attempt of rows) {
              const answer = readAnswers(attempt.answers)[q.id];
              if (answer === undefined) continue;
              bucket.total++; if (answer === q.correct_index) bucket.correct++;
              if (q.chapter_id) bucket.chapters.add(q.chapter_id);
            }
            buckets[subject] = bucket;
          }
        }
        if (!cancelled) setStats(buckets);
      } catch { if (!cancelled) setDataError(true); }
      finally { if (!cancelled) setDataLoading(false); }
    }
    load();
    return () => { cancelled = true; };
  }, [user?.id]);
  if (loading || !user) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  const now = new Date();
  const goal = Math.max(1, profile?.daily_goal ?? 20);
  const solved = (rows: Attempt[]) => rows.reduce((sum, a) => sum + (a.correct_count ?? 0) + (a.wrong_count ?? 0), 0);
  const todaySolved = solved(attempts.filter((a) => a.submitted_at && dayKey(new Date(a.submitted_at)) === dayKey(now)));
  const goalPercent = Math.min(100, Math.round(todaySolved / goal * 100));
  const days = new Set(attempts.filter((a) => a.submitted_at).map((a) => dayKey(new Date(a.submitted_at ?? ""))));
  const cursor = new Date(now); let streak = 0;
  if (!days.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  while (days.has(dayKey(cursor))) { streak++; cursor.setDate(cursor.getDate() - 1); }
  const week = Array.from({ length: 7 }, (_, i) => { const date = new Date(now); date.setDate(date.getDate() - 6 + i); return { label: date.toLocaleDateString("en", { weekday: "short" }), count: solved(attempts.filter((a) => a.submitted_at && dayKey(new Date(a.submitted_at)) === dayKey(date))) }; });
  const total = solved(attempts);
  const correct = attempts.reduce((sum, a) => sum + (a.correct_count ?? 0), 0);
  const accuracy = total ? Math.round(correct / total * 100) : 0;
  const bestMock = attempts.filter((a) => a.tests?.type === "mock").reduce((best, a) => Math.max(best, Number(a.score)), 0);
  const statValue = (value: number, suffix = "") => dataError ? "—" : dataLoading ? "…" : `${value}${suffix}`;
  const biology = [stats.Botany, stats.Zoology, stats.Biology].filter((s): s is SubjectStats => !!s);
  const bioStats: SubjectStats = { total: biology.reduce((s, b) => s + b.total, 0), correct: biology.reduce((s, b) => s + b.correct, 0), chapters: new Set(biology.flatMap((b) => [...b.chapters])) };
  const greeting = now.getHours() < 12 ? "Good Morning" : now.getHours() < 18 ? "Good Afternoon" : "Good Evening";
  return <PageShell>
    <div className="dashboard-view mx-auto max-w-6xl space-y-7">
      <section className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(260px,1fr)]">
        <div className="min-w-0">
          <p className="mb-2 text-xs font-semibold uppercase text-study-green">Your preparation, your pace</p>
          <h1 className="font-display text-3xl font-semibold leading-tight sm:text-4xl">{greeting},<br className="sm:hidden" /> Future Doctor! <span className="text-2xl">👋</span></h1>
          <p className="mt-2 text-sm text-muted-foreground">Small consistent steps lead to big dreams.</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(140px,1fr)]">
            <div className="flex min-w-0 items-center gap-4 rounded-lg border border-border bg-card/80 p-5 backdrop-blur-sm">
              <div className="relative h-24 w-24 shrink-0">
                <svg viewBox="0 0 112 112" className="h-full w-full -rotate-90" aria-hidden="true"><circle cx="56" cy="56" r="46" stroke="currentColor" strokeWidth="7" className="text-secondary" fill="none" /><circle cx="56" cy="56" r="46" stroke="currentColor" strokeWidth="7" className="text-study-green" fill="none" strokeDasharray="289" strokeDashoffset={289 * (1 - goalPercent / 100)} strokeLinecap="round" /></svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center"><strong className="font-display text-2xl">{statValue(todaySolved)}</strong><span className="text-xs text-muted-foreground">/ {goal}</span></div>
              </div>
              <div className="min-w-0 flex-1"><p className="text-xs text-study-green">Today's target</p><h2 className="mt-1 font-display text-lg font-semibold">Questions completed</h2><div className="mt-3 flex items-center justify-between text-xs text-muted-foreground"><span>Daily goal</span><strong className="text-foreground">{statValue(goalPercent, "%")}</strong></div><meter className="study-meter mt-2 w-full" min={0} max={100} value={goalPercent} aria-label="Daily goal progress" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-1">
              <Metric icon={Flame} label="Day streak" value={statValue(streak)} tone="text-study-gold" />
              <Metric icon={CalendarDays} label="Target NEET" value={String(profile?.target_year ?? 2027)} tone="text-study-green" />
            </div>
          </div>
        </div>
        <div className="dashboard-photo relative min-h-[245px] overflow-hidden rounded-lg">
          <img src={mountainImage} width={1536} height={1024} alt="Sunrise over a green mountain valley" className="absolute inset-0 h-full w-full object-cover" />
          <div className="photo-shade absolute inset-0" />
          <div className="relative flex h-full min-h-[245px] flex-col justify-end p-6 text-photo-foreground"><p className="font-display text-2xl leading-snug">Same Steps,<br /><strong className="text-study-gold">Bigger Dreams.</strong></p><Button asChild className="mt-5 h-11 w-full bg-study-gold text-study-gold-foreground hover:bg-study-gold/90"><Link to="/daily">Continue Preparation <ArrowRight /></Link></Button></div>
        </div>
      </section>
      {dataError && <p role="alert" className="text-sm text-destructive">Your progress could not be loaded. Your practice and study tools are still available.</p>}
      <section className="grid gap-3 sm:grid-cols-3" aria-label="Subject practice">
        {SUBJECTS.map((subject) => {
          const data = subject.name === "Biology" ? bioStats : stats[subject.name];
          const acc = data?.total ? Math.round(data.correct / data.total * 100) : 0;
          return <div key={subject.name} className={`min-w-0 rounded-lg border p-5 ${subject.tone}`}>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3"><subject.icon className="h-9 w-9" strokeWidth={1.5} /><div className="text-right"><strong className="font-display text-2xl text-foreground">{statValue(acc, "%")}</strong><h2 className="font-display text-sm font-semibold">{subject.name}</h2></div></div>
            <div className="mt-4 flex justify-between gap-2 text-xs text-muted-foreground"><span>Questions practised</span><strong className="text-foreground">{statValue(data?.total ?? 0)}</strong></div>
            <meter className="study-meter mt-2 w-full" min={0} max={100} value={acc} aria-label={`${subject.name} accuracy`} />
            <div className="mt-3 flex justify-between gap-2 text-xs text-muted-foreground"><span>Accuracy <strong className="text-foreground">{statValue(acc, "%")}</strong></span><span>Chapters practised <strong className="text-foreground">{statValue(data?.chapters.size ?? 0)}</strong></span></div>
            <div className="mt-4 flex gap-2">
              {subject.name === "Biology" ? <><Button variant="outline" asChild size="sm" className="flex-1"><Link to="/subjects/$subject" params={{ subject: "Botany" }}><Leaf />Botany</Link></Button><Button variant="outline" asChild size="sm" className="flex-1"><Link to="/subjects/$subject" params={{ subject: "Zoology" }}><Dna />Zoology</Link></Button></> : <Button variant="outline" asChild size="sm" className="w-full"><Link to="/subjects/$subject" params={{ subject: subject.name }}>Practice {subject.name}<ArrowRight /></Link></Button>}
            </div>
          </div>;
        })}
      </section>
      <section className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(260px,1fr)]" aria-label="Performance">
        <div className="min-w-0 border-y border-border py-4"><div className="flex items-center justify-between gap-3"><h2 className="font-display text-base font-semibold">Your Performance <span className="text-xs font-normal text-muted-foreground">(Last 7 Days)</span></h2><Link to="/progress" className="text-xs text-study-green">View report <ArrowRight className="inline h-3 w-3" /></Link></div><PerformanceChart days={week} /></div>
        <div className="grid grid-cols-2 gap-3"><Metric icon={Target} label="Overall accuracy" value={statValue(accuracy, "%")} tone="text-study-green" /><Metric icon={BarChart3} label="Questions / day" value={statValue(Math.round(week.reduce((s, d) => s + d.count, 0) / 7))} tone="text-study-blue" /><Metric icon={Trophy} label="Best mock score · 60d" value={statValue(bestMock)} tone="text-study-gold" /><Metric icon={FileText} label="Completed tests · 60d" value={statValue(attempts.length)} tone="text-study-green" /></div>
      </section>
      <section><h2 className="mb-4 font-display text-lg font-semibold">Find Your Weaknesses. <span className="text-study-green">Build Your Strengths.</span></h2><div className="grid gap-3 sm:grid-cols-3"><Shortcut to="/mistakes" icon={RefreshCw} title="My Mistakes" subtitle="Revisit incorrect questions" tone="text-destructive" /><Shortcut to="/bookmarks" icon={Bookmark} title="Saved Questions" subtitle="Your important concepts" tone="text-study-gold" /><Shortcut to="/analytics" icon={BarChart3} title="Deep Analytics" subtitle="Your preparation insights" tone="text-study-green" /></div></section>
      <section><h2 className="mb-3 font-display text-lg font-semibold">Start Practicing</h2><div className="grid gap-3 sm:grid-cols-3"><Shortcut to="/generate" icon={FileText} title="Generate Test" subtitle="Practice your selected chapters" tone="text-study-green" /><Shortcut to="/mocks" icon={Trophy} title="Mock Tests" subtitle="Full-length NEET practice" tone="text-study-gold" /><Shortcut to="/pyqs" icon={BookOpen} title="NEET PYQs" subtitle="Previous year question papers" tone="text-study-blue" /></div></section>
      <section className="grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(240px,1fr)]"><div><h2 className="mb-3 font-display text-lg font-semibold">Study Resources</h2><div className="grid grid-cols-2 gap-3"><Shortcut to="/ncert-highlights" icon={BookOpen} title="NCERT Key Points" tone="text-study-gold" /><Shortcut to="/flashcards" icon={Bookmark} title="Flashcards" tone="text-study-blue" /><Shortcut to="/study-essentials" icon={GraduationCap} title="Study Essentials" tone="text-study-green" /><Shortcut to="/neetlab" icon={Atom} title="NEETLab" tone="text-study-blue" /></div></div><div><h2 className="mb-3 font-display text-lg font-semibold">Live & Community</h2><div className="grid gap-3"><Shortcut to="/arena" icon={Trophy} title="Arena" subtitle="Contests & battlegrounds" tone="text-study-gold" /><Shortcut to="/community" icon={Users} title="Join the Community" subtitle="Learn and grow together" tone="text-study-green" /></div></div></section>
      <TrialBanner />
      {isAdmin && <Button asChild variant="outline"><Link to="/admin">Admin panel <ArrowRight /></Link></Button>}
    </div>
  </PageShell>;
}
function Metric({ icon: Icon, label, value, tone }: { icon: ComponentType<{ className?: string }>; label: string; value: string; tone: string }) {
  return <div className="flex min-w-0 items-center gap-3 rounded-lg border border-border bg-card/70 p-4"><Icon className={`h-6 w-6 shrink-0 ${tone}`} /><div className="min-w-0"><strong className="font-display text-xl leading-none">{value}</strong><p className="mt-1 text-[11px] leading-snug text-muted-foreground">{label}</p></div></div>;
}
function Shortcut({ to, icon: Icon, title, subtitle, tone }: { to: string; icon: ComponentType<{ className?: string }>; title: string; subtitle?: string; tone: string }) {
  return <Button asChild variant="ghost" className="h-auto w-full justify-start whitespace-normal rounded-lg border border-border bg-card/70 p-4 text-left hover:bg-secondary"><Link to={to}><span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary ${tone}`}><Icon className="h-5 w-5" /></span><span className="min-w-0 flex-1"><span className="block font-display text-sm font-semibold">{title}</span>{subtitle && <span className="mt-1 block text-[11px] font-normal text-muted-foreground">{subtitle}</span>}</span><ArrowRight className="shrink-0 text-muted-foreground" /></Link></Button>;
}
function PerformanceChart({ days }: { days: { label: string; count: number }[] }) {
  const max = Math.max(10, ...days.map((d) => d.count));
  const coords = days.map((d, i) => ({ x: 35 + i * 80, y: 135 - d.count / max * 105 }));
  return <svg viewBox="0 0 560 170" className="mt-3 h-[170px] w-full overflow-visible" role="img" aria-label={`Questions solved: ${days.map((d) => `${d.label} ${d.count}`).join(", ")}`}>
    {[0, 0.5, 1].map((r) => <g key={r}><line x1="35" x2="535" y1={135 - r * 105} y2={135 - r * 105} className="stroke-border" /><text x="5" y={139 - r * 105} className="fill-muted-foreground text-[10px]">{Math.round(max * r)}</text></g>)}
    <polyline points={coords.map((c) => `${c.x},${c.y}`).join(" ")} fill="none" className="stroke-study-blue" strokeWidth="2" strokeLinejoin="round" />
    {coords.map((c, i) => <g key={i}><circle cx={c.x} cy={c.y} r="3.5" className="fill-study-blue"><title>{days[i].label}: {days[i].count} questions</title></circle><text x={c.x} y="160" textAnchor="middle" className="fill-muted-foreground text-[10px]">{days[i].label}</text></g>)}
  </svg>;
}
