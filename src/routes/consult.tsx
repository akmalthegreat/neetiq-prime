import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { ArrowRight, CalendarClock, FileBarChart2, Gauge, Lock, Sparkles, Target } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { DrAzkaLoader } from "@/components/dr-akza-loader";
import { useAuth } from "@/hooks/use-auth";
import { useAccess } from "@/hooks/use-access";
import { cn } from "@/lib/utils";
import { DataBasis, Meter, accuracyTone, useConsultData, type ConsultData } from "@/components/consult/consult-ui";

export const Route = createFileRoute("/consult")({
  head: () => ({ meta: [{ title: "Dr. Azka Consult — NEET Track" }] }),
  component: ConsultHub,
});

function ConsultHub() {
  const { user, profile, loading } = useAuth();
  const nav = useNavigate();
  const { hasFeature } = useAccess();
  const q = useConsultData();

  useEffect(() => { if (!loading && !user) nav({ to: "/login" }); }, [user, loading, nav]);

  if (loading || !user || q.isLoading) {
    return <DrAzkaLoader fullScreen message="Dr. Azka is reviewing your performance..." subMessage="Reading your attempts, chapters and mistake book" />;
  }
  if (q.isError || !q.data) {
    return (
      <PageShell>
        <div className="mx-auto max-w-md rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          Couldn't load your consultation. <button className="font-semibold text-primary underline" onClick={() => q.refetch()}>Try again</button>
        </div>
      </PageShell>
    );
  }

  const d = q.data;
  const name = (d.profile.name ?? (profile as any)?.full_name ?? "").trim().split(" ")[0] || "there";
  const top = d.recommendations[0];

  return (
    <PageShell>
      <div className="mx-auto max-w-5xl">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600 via-teal-600 to-sky-700 p-5 text-white shadow-elegant sm:p-7 animate-fade-in-up">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
          <div className="relative flex items-center gap-4">
            <img src="/dr-azka.png" alt="Dr. Azka" className="h-20 w-20 shrink-0 object-contain drop-shadow-[0_8px_18px_rgba(0,0,0,0.25)] sm:h-24 sm:w-24" />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-100">
                <Sparkles className="h-3.5 w-3.5" /> Dr. Azka · AI NEET Mentor
              </div>
              <h1 className="mt-1 text-2xl font-extrabold leading-tight sm:text-3xl">Hi {name}, let's review your preparation</h1>
              <p className="mt-1.5 text-sm text-white/85">
                {d.snapshot.totals.answered > 0
                  ? `Everything below is calculated from your own ${d.snapshot.totals.answered.toLocaleString("en-IN")} answers across ${d.snapshot.totals.tests} tests.`
                  : "Take a few tests and I'll analyse every answer you give."}
              </p>
            </div>
          </div>
          {d.snapshot.totals.answered > 0 && (
            <div className="relative mt-5 grid grid-cols-3 gap-2 text-center">
              <HeroStat label="Accuracy" value={d.snapshot.totals.accuracy !== null ? `${d.snapshot.totals.accuracy}%` : "—"} />
              <HeroStat label="Days active / week" value={`${d.snapshot.consistency.activeDays7}/7`} />
              <HeroStat label="Mistake Book" value={d.snapshot.mistakes.total.toLocaleString("en-IN")} />
            </div>
          )}
        </div>

        <div className="mt-3 flex justify-end"><DataBasis snapshot={d.snapshot} /></div>

        {/* Three services */}
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <ServiceCard
            to="/consult-score" icon={Gauge} accent="from-violet-500 to-indigo-600"
            title="NEET Score Predictor" locked={!hasFeature("score_predictor")}
            body={<ScorePreview d={d} />}
          />
          <ServiceCard
            to="/consult-plan" icon={CalendarClock} accent="from-emerald-500 to-teal-600"
            title="7-Day Study Plan" locked={!hasFeature("ai_path")}
            body={<PlanPreview d={d} />}
          />
          <ServiceCard
            to="/consult-report" icon={FileBarChart2} accent="from-sky-500 to-blue-600"
            title="Overall Report" locked={!hasFeature("analytics")}
            body={<ReportPreview d={d} />}
          />
        </div>

        {/* Today's priority */}
        {top && (
          <div className="mt-4 rounded-2xl border border-border bg-card p-4 shadow-soft sm:p-5">
            <div className="flex items-start gap-3">
              <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                top.tone === "critical" ? "bg-rose-500/15 text-rose-600 dark:text-rose-400" : top.tone === "keep" ? "bg-emerald-500/15 text-emerald-600" : "bg-amber-500/15 text-amber-600 dark:text-amber-400")}>
                <Target className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Dr. Azka's priority for you today</div>
                <div className="mt-0.5 font-bold">{top.title}</div>
                <p className="mt-1 text-sm text-muted-foreground">{top.detail}</p>
                {top.action && (
                  <Link to={top.action.to as any} className="mt-3 inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground">
                    {top.action.label} <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </PageShell>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/12 px-2 py-2 backdrop-blur-sm ring-1 ring-white/15">
      <div className="text-lg font-extrabold tabular-nums sm:text-xl">{value}</div>
      <div className="text-[10px] font-medium uppercase tracking-wider text-white/75">{label}</div>
    </div>
  );
}

function ServiceCard({ to, icon: Icon, accent, title, body, locked }: {
  to: string; icon: typeof Gauge; accent: string; title: string; body: ReactNode; locked: boolean;
}) {
  return (
    <Link to={(locked ? "/premium" : to) as any} className="group flex flex-col rounded-2xl border border-border bg-card p-4 shadow-soft hover-lift">
      <div className="flex items-center justify-between">
        <div className={cn("flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-sm", accent)}>
          <Icon className="h-5 w-5" />
        </div>
        {locked
          ? <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground"><Lock className="h-3 w-3" /> Premium</span>
          : <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />}
      </div>
      <div className="mt-3 text-base font-bold">{title}</div>
      <div className="mt-2 flex-1">{body}</div>
    </Link>
  );
}

function ScorePreview({ d }: { d: ConsultData }) {
  const p = d.prediction;
  if (!p.ready) {
    const need = p.sections.filter((s) => !s.ready).map((s) => `${s.needed} ${s.key}`).join(", ");
    return <p className="text-sm text-muted-foreground">Answer {need} more questions to unlock your prediction.</p>;
  }
  return (
    <div>
      <div className="flex items-baseline gap-1"><span className="text-3xl font-extrabold tabular-nums">{p.expected}</span><span className="text-sm text-muted-foreground">/ 720</span></div>
      <div className="text-xs text-muted-foreground">Likely range {p.low}–{p.high}</div>
    </div>
  );
}

function PlanPreview({ d }: { d: ConsultData }) {
  const plan = d.plan;
  if (!plan || plan.version < 2 || plan.dayIndex > 7) {
    return <p className="text-sm text-muted-foreground">Build an hour-by-hour week: lectures, revision, modules, PYQs and a Sunday mock — up to 12–13 h a day.</p>;
  }
  const pct = plan.total ? Math.round((plan.done / plan.total) * 100) : 0;
  return (
    <div>
      <div className="text-sm font-semibold">Day {Math.max(1, plan.dayIndex)} of 7</div>
      <Meter value={pct} className="mt-2" barClass="bg-emerald-500" />
      <div className="mt-1 text-xs text-muted-foreground">{plan.done}/{plan.total} tasks done · {pct}%</div>
    </div>
  );
}

function ReportPreview({ d }: { d: ConsultData }) {
  const s = d.snapshot;
  if (s.dataLevel === "none") return <p className="text-sm text-muted-foreground">Your full report appears after your first test.</p>;
  return (
    <div className="space-y-1.5">
      {s.sections.map((x) => (
        <div key={x.key} className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">{x.key}</span>
          <span className={cn("font-bold tabular-nums", accuracyTone(x.accuracy))}>{x.accuracy !== null ? `${x.accuracy}%` : "—"}</span>
        </div>
      ))}
      <div className="pt-1 text-[11px] text-muted-foreground">{s.strengths.length} strong · {s.weaknesses.length} weak chapters</div>
    </div>
  );
}
