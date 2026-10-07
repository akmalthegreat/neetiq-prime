import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronLeft, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { getConsultData } from "@/lib/consult.functions";
import type { SectionKey, Snapshot } from "@/lib/insights-engine";

export type ConsultData = Awaited<ReturnType<typeof getConsultData>>;

/** Shared, cached data for the Consult hub, Score Predictor and Report. */
export function useConsultData() {
  const { user } = useAuth();
  const fn = useServerFn(getConsultData);
  return useQuery<ConsultData>({
    queryKey: ["consult-data", user?.id ?? "anon"],
    queryFn: () => fn() as Promise<ConsultData>,
    enabled: !!user,
    staleTime: 60_000,
  });
}

export const SECTION_STYLE: Record<SectionKey, { bar: string; text: string; soft: string; dot: string }> = {
  Physics: { bar: "bg-sky-500", text: "text-sky-600 dark:text-sky-400", soft: "bg-sky-500/10", dot: "bg-sky-500" },
  Chemistry: { bar: "bg-amber-500", text: "text-amber-600 dark:text-amber-400", soft: "bg-amber-500/10", dot: "bg-amber-500" },
  Biology: { bar: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400", soft: "bg-emerald-500/10", dot: "bg-emerald-500" },
};

export function accuracyTone(acc: number | null | undefined) {
  if (acc === null || acc === undefined) return "text-muted-foreground";
  if (acc >= 75) return "text-emerald-600 dark:text-emerald-400";
  if (acc >= 50) return "text-amber-600 dark:text-amber-400";
  return "text-rose-600 dark:text-rose-400";
}

export function ConsultTopBar({ eyebrow, title, subtitle, right }: { eyebrow: string; title: string; subtitle?: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-6 animate-fade-in-up">
      <Link to="/consult" className="mb-4 inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground">
        <ChevronLeft className="h-3.5 w-3.5" /> Dr. Azka Consult
      </Link>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">{eyebrow}</div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
          {subtitle && <div className="mt-2 max-w-2xl text-sm text-muted-foreground">{subtitle}</div>}
        </div>
        {right}
      </div>
    </div>
  );
}

export function Panel({ title, hint, children, className }: { title?: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-2xl border border-border bg-card p-4 shadow-soft sm:p-5", className)}>
      {(title || hint) && (
        <div className="mb-3 flex items-baseline justify-between gap-3">
          {title && <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">{title}</h2>}
          {hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function StatTile({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3 shadow-soft">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn("mt-1 text-xl font-extrabold tabular-nums sm:text-2xl", tone)}>{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

export function Meter({ value, className, barClass }: { value: number | null; className?: string; barClass?: string }) {
  const v = Math.max(0, Math.min(100, value ?? 0));
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-muted", className)}>
      <div className={cn("h-full rounded-full transition-[width] duration-700", barClass ?? "bg-primary")} style={{ width: `${v}%` }} />
    </div>
  );
}

export function DataBasis({ snapshot }: { snapshot: Snapshot }) {
  const level = { none: "No data yet", low: "Early estimate", medium: "Good data", high: "Strong data" }[snapshot.dataLevel];
  return (
    <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
      <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
      {level} · {snapshot.totals.answered.toLocaleString("en-IN")} answers, last {snapshot.windowDays} days
    </div>
  );
}

/** Semicircle gauge for 0–720 with the likely range shaded. */
export function ScoreGauge({ value, low, high, max = 720 }: { value: number; low: number; high: number; max?: number }) {
  const R = 90, cx = 110, cy = 105;
  const angle = (v: number) => Math.PI * (1 - Math.max(0, Math.min(max, v)) / max);
  const pt = (v: number, r = R) => [cx + r * Math.cos(angle(v)), cy - r * Math.sin(angle(v))] as const;
  const arc = (from: number, to: number, r = R) => {
    const [x1, y1] = pt(from, r); const [x2, y2] = pt(to, r);
    return `M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`;
  };
  const [nx, ny] = pt(value, R - 2);
  return (
    <svg viewBox="0 0 220 120" className="w-full max-w-[300px]" role="img" aria-label={`Predicted ${value} out of ${max}, likely range ${low} to ${high}`}>
      <path d={arc(0, max)} className="stroke-muted" strokeWidth={14} fill="none" strokeLinecap="round" />
      <path d={arc(0, Math.max(0, value))} stroke="url(#azkaGauge)" strokeWidth={14} fill="none" strokeLinecap="round" />
      {high > low && <path d={arc(Math.max(0, low), Math.max(0, high), R + 13)} className="stroke-primary/50" strokeWidth={4} fill="none" strokeLinecap="round" />}
      <circle cx={nx} cy={ny} r={6} className="fill-background stroke-foreground" strokeWidth={2.5} />
      <defs>
        <linearGradient id="azkaGauge" x1="0" x2="1">
          <stop offset="0%" stopColor="#f43f5e" />
          <stop offset="45%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#10b981" />
        </linearGradient>
      </defs>
      <text x={20} y={118} className="fill-muted-foreground" fontSize={9}>0</text>
      <text x={186} y={118} className="fill-muted-foreground" fontSize={9}>{max}</text>
    </svg>
  );
}

export function WeeklyTrend({ weekly }: { weekly: Snapshot["weekly"] }) {
  const maxQ = Math.max(1, ...weekly.map((w) => w.answered));
  return (
    <div>
      <div className="flex h-36 items-end gap-1.5 sm:gap-2">
        {weekly.map((w) => {
          const h = Math.round((w.answered / maxQ) * 100);
          return (
            <div key={w.weekStart} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
              <div className={cn("text-[10px] font-bold tabular-nums", accuracyTone(w.accuracy))}>{w.accuracy !== null ? `${w.accuracy}%` : ""}</div>
              <div className="w-full rounded-t-md bg-primary/80" style={{ height: `${Math.max(w.answered ? 4 : 0, h * 0.75)}%` }} title={`${w.answered} questions`} />
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 flex gap-1.5 sm:gap-2">
        {weekly.map((w) => (
          <div key={w.weekStart} className="flex-1 text-center text-[9px] text-muted-foreground">
            {new Date(`${w.weekStart}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
          </div>
        ))}
      </div>
      <div className="mt-2 text-[11px] text-muted-foreground">Bar height = questions answered that week · label = accuracy</div>
    </div>
  );
}

export function ActivityGrid({ daily }: { daily: Snapshot["daily"] }) {
  const shade = (q: number) =>
    q === 0 ? "bg-muted" : q < 20 ? "bg-emerald-500/30" : q < 50 ? "bg-emerald-500/55" : q < 100 ? "bg-emerald-500/80" : "bg-emerald-600";
  return (
    <div>
      <div className="grid grid-cols-7 gap-1.5">
        {daily.map((d) => (
          <div key={d.date} title={`${d.date}: ${d.questions} questions`} className={cn("aspect-square rounded-md", shade(d.questions))} />
        ))}
      </div>
      <div className="mt-2 flex items-center justify-end gap-1 text-[10px] text-muted-foreground">
        Less {["bg-muted", "bg-emerald-500/30", "bg-emerald-500/55", "bg-emerald-500/80", "bg-emerald-600"].map((c) => (
          <span key={c} className={cn("h-2.5 w-2.5 rounded-sm", c)} />
        ))} More
      </div>
    </div>
  );
}

export function NotEnoughData({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-center">
      <img src="/dr-azka.png" alt="" className="mx-auto h-16 w-16 object-contain" />
      <div className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">{children}</div>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
