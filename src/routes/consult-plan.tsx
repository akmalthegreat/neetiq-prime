import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import {
  BookOpen, BookOpenCheck, CheckCircle2, Circle, Clock, Coffee, FileQuestion, GraduationCap, History,
  NotebookPen, PenLine, RefreshCw, Sparkles, Target, Timer, Trophy,
} from "lucide-react";
import { toast } from "sonner";
import { PageShell } from "@/components/page-shell";
import { DrAzkaLoader } from "@/components/dr-akza-loader";
import { FeatureLock } from "@/components/feature-lock";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { getConsultPlan, generateConsultPlan } from "@/lib/consult.functions";
import { updatePathProgress } from "@/lib/ai-path.functions";
import { INTENSITY_INFO, type BlockKind, type Intensity, type PlanDay, type StudyMode } from "@/lib/study-plan-engine";
import { istDay } from "@/lib/insights-engine";
import { ConsultTopBar, Meter, Panel, accuracyTone } from "@/components/consult/consult-ui";

export const Route = createFileRoute("/consult-plan")({
  head: () => ({ meta: [{ title: "7-Day Study Plan — Dr. Azka" }] }),
  component: () => (<FeatureLock feature="ai_path"><PlanPage /></FeatureLock>),
});

type PlanData = Awaited<ReturnType<typeof getConsultPlan>>;
type PlanRow = { id: string; start_date: string; payload: any; progress: Record<string, boolean>; created_at: string };

const KIND_STYLE: Record<BlockKind, { icon: typeof Clock; dot: string; chip: string }> = {
  lecture: { icon: GraduationCap, dot: "bg-indigo-500", chip: "bg-indigo-500/12 text-indigo-700 dark:text-indigo-300" },
  revision: { icon: History, dot: "bg-amber-500", chip: "bg-amber-500/12 text-amber-700 dark:text-amber-300" },
  practice: { icon: Target, dot: "bg-emerald-500", chip: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300" },
  module: { icon: PenLine, dot: "bg-teal-500", chip: "bg-teal-500/12 text-teal-700 dark:text-teal-300" },
  ncert: { icon: BookOpen, dot: "bg-lime-600", chip: "bg-lime-500/15 text-lime-700 dark:text-lime-300" },
  pyq: { icon: FileQuestion, dot: "bg-violet-500", chip: "bg-violet-500/12 text-violet-700 dark:text-violet-300" },
  mistakes: { icon: RefreshCw, dot: "bg-rose-500", chip: "bg-rose-500/12 text-rose-700 dark:text-rose-300" },
  notes: { icon: NotebookPen, dot: "bg-sky-500", chip: "bg-sky-500/12 text-sky-700 dark:text-sky-300" },
  mock: { icon: Trophy, dot: "bg-fuchsia-500", chip: "bg-fuchsia-500/12 text-fuchsia-700 dark:text-fuchsia-300" },
  analysis: { icon: BookOpenCheck, dot: "bg-orange-500", chip: "bg-orange-500/12 text-orange-700 dark:text-orange-300" },
  break: { icon: Coffee, dot: "bg-muted-foreground/40", chip: "bg-muted text-muted-foreground" },
};

const hours = (m: number) => (m < 60 ? `${m}m` : `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ""}`);

function PlanPage() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const fetchPlan = useServerFn(getConsultPlan);
  const [data, setData] = useState<PlanData | null>(null);
  const [mode, setMode] = useState<"view" | "setup">("view");
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (!loading && !user) nav({ to: "/login" }); }, [user, loading, nav]);
  useEffect(() => {
    if (!user) return;
    fetchPlan().then((r) => setData(r as PlanData)).catch((e) => toast.error(e?.message ?? "Couldn't load your plan"));
  }, [user?.id]);

  const plan = data?.plan as PlanRow | null | undefined;
  const isCurrentV2 = !!plan && plan.payload?.version === 2 && daysSince(plan.start_date) < 7;

  if (loading || !user || !data) return <DrAzkaLoader fullScreen message="Dr. Azka is opening your planner..." />;
  if (busy) return <DrAzkaLoader fullScreen message="Dr. Azka is building your timetable..." subMessage="Matching every slot to your weak chapters — this takes up to a minute" />;

  return (
    <PageShell>
      <div className="mx-auto max-w-3xl">
        <ConsultTopBar
          eyebrow="Study Plan"
          title="Your 7-day timetable"
          subtitle="Hour-by-hour: lectures, revision, module practice, NCERT, PYQs and a Sunday mock — built around your real weak chapters."
        />
        {isCurrentV2 && mode === "view" ? (
          <PlanView plan={plan!} onNew={() => setMode("setup")} onProgress={(p) => setData({ ...data, plan: { ...plan!, progress: p } })} />
        ) : (
          <PlanSetup
            data={data}
            hasCurrent={isCurrentV2}
            onCancel={isCurrentV2 ? () => setMode("view") : undefined}
            onBusy={setBusy}
            onDone={(row) => { setData({ ...data, plan: row }); setMode("view"); qc.invalidateQueries({ queryKey: ["consult-data"] }); }}
          />
        )}
      </div>
    </PageShell>
  );
}

function daysSince(isoDate: string) {
  const a = new Date(`${isoDate}T00:00:00Z`).getTime();
  const b = new Date(`${istDay(new Date())}T00:00:00Z`).getTime();
  return Math.floor((b - a) / 86400_000);
}

// ---------------------------------------------------------------- setup

function PlanSetup({ data, hasCurrent, onCancel, onBusy, onDone }: {
  data: PlanData; hasCurrent: boolean; onCancel?: () => void; onBusy: (b: boolean) => void; onDone: (row: PlanRow) => void;
}) {
  const gen = useServerFn(generateConsultPlan);
  const [intensity, setIntensity] = useState<Intensity>("dropper");
  const [studyMode, setStudyMode] = useState<StudyMode>("coaching");
  const [wake, setWake] = useState("06:00");
  const [current, setCurrent] = useState({ physics: "", chemistry: "", biology: "" });
  const { inputs, cost } = data;

  async function build() {
    if (cost > 0 && !confirm(`Build your 7-day timetable? This uses ${cost} bonus coins.`)) return;
    onBusy(true);
    try {
      const r = await gen({ data: { intensity, mode: studyMode, wake, current } }) as { plan: PlanRow };
      onDone(r.plan);
      toast.success("Your timetable is ready");
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't build the plan");
    } finally { onBusy(false); }
  }

  return (
    <div className="space-y-4">
      <Panel title="1 · How many hours can you give?">
        <div className="grid gap-2 sm:grid-cols-3">
          {(Object.keys(INTENSITY_INFO) as Intensity[]).map((k) => {
            const info = INTENSITY_INFO[k];
            const on = intensity === k;
            return (
              <button key={k} onClick={() => setIntensity(k)}
                className={cn("rounded-xl border-2 p-3 text-left transition-colors", on ? "border-primary bg-primary/5" : "border-border hover:border-primary/40")}>
                <div className="flex items-center justify-between">
                  <span className="font-bold">{info.label}</span>
                  {on ? <CheckCircle2 className="h-4 w-4 text-primary" /> : <Circle className="h-4 w-4 text-muted-foreground" />}
                </div>
                <div className="mt-1 text-2xl font-extrabold tabular-nums">{info.hours}</div>
                <div className="text-[11px] text-muted-foreground">{info.who}</div>
              </button>
            );
          })}
        </div>
        {intensity === "dropper" && (
          <p className="mt-3 rounded-lg bg-muted/60 p-2.5 text-xs text-muted-foreground">
            About 6 h of lectures + 6¾ h of self-study, with meal breaks and 7½ h of sleep. Sunday is a full mock at 2 PM, the real NEET slot.
          </p>
        )}
      </Panel>

      <Panel title="2 · Your routine">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <div className="mb-1.5 text-xs font-semibold text-muted-foreground">How do you learn new chapters?</div>
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
              {([["coaching", "Lectures / coaching"], ["self", "Self-study"]] as const).map(([v, l]) => (
                <button key={v} onClick={() => setStudyMode(v)} className={cn("rounded-lg px-2 py-2 text-xs font-bold", studyMode === v ? "bg-card shadow-soft" : "text-muted-foreground")}>{l}</button>
              ))}
            </div>
          </div>
          <label className="block">
            <div className="mb-1.5 text-xs font-semibold text-muted-foreground">Wake-up time</div>
            <select value={wake} onChange={(e) => setWake(e.target.value)} className="h-10 w-full rounded-xl border border-border bg-card px-3 text-sm font-semibold">
              {["04:30", "05:00", "05:30", "06:00", "06:30", "07:00", "07:30"].map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
        </div>
      </Panel>

      <Panel title="3 · Chapters you're studying now" hint="Optional, but makes lectures exact">
        <div className="grid gap-2 sm:grid-cols-3">
          {(["physics", "chemistry", "biology"] as const).map((k) => (
            <label key={k} className="block">
              <div className="mb-1 text-[11px] font-semibold capitalize text-muted-foreground">{k}</div>
              <input value={current[k]} maxLength={120} onChange={(e) => setCurrent({ ...current, [k]: e.target.value })}
                placeholder={k === "physics" ? "e.g. Rotational Motion" : k === "chemistry" ? "e.g. Chemical Bonding" : "e.g. Cell Cycle"}
                className="h-10 w-full rounded-xl border border-border bg-card px-3 text-sm" />
            </label>
          ))}
        </div>
      </Panel>

      <Panel title="What Dr. Azka will use" hint="From your own answers">
        {inputs.dataLevel === "none" ? (
          <p className="text-sm text-muted-foreground">You have no completed tests yet, so the plan will be balanced across subjects. Take a few tests and rebuild it for a sharper plan.</p>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {inputs.sections.map((s) => (
                <span key={s.key} className="rounded-full bg-muted px-2.5 py-1 text-xs">
                  {s.key} <b className={accuracyTone(s.accuracy)}>{s.accuracy !== null ? `${s.accuracy}%` : "—"}</b>
                </span>
              ))}
            </div>
            {inputs.weak.length > 0 && (
              <div>
                <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">Weak chapters to target</div>
                <div className="flex flex-wrap gap-1.5">
                  {inputs.weak.map((c) => <span key={c.name} className="rounded-md bg-rose-500/10 px-2 py-0.5 text-xs">{c.name} · {c.accuracy}%</span>)}
                </div>
              </div>
            )}
            {inputs.mistakes.length > 0 && (
              <div className="text-xs text-muted-foreground">Mistake Book focus: {inputs.mistakes.map((m) => `${m.name} (${m.count})`).join(", ")}</div>
            )}
          </div>
        )}
      </Panel>

      <div className="flex flex-col gap-2 sm:flex-row">
        {onCancel && <button onClick={onCancel} className="h-12 rounded-xl border border-border bg-card px-4 text-sm font-bold">Keep current plan</button>}
        <button onClick={build} className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-sm font-bold text-white shadow-elegant">
          <Sparkles className="h-4 w-4" /> {hasCurrent ? "Rebuild my timetable" : "Build my timetable"}{cost > 0 ? ` · ${cost} bonus` : ""}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- view

function PlanView({ plan, onNew, onProgress }: { plan: PlanRow; onNew: () => void; onProgress: (p: Record<string, boolean>) => void }) {
  const upd = useServerFn(updatePathProgress);
  const days: PlanDay[] = plan.payload.days ?? [];
  const today = Math.min(7, Math.max(1, daysSince(plan.start_date) + 1));
  const [sel, setSel] = useState(today);
  const day = days.find((d) => d.day === sel) ?? days[0];
  const s = plan.payload.settings ?? {};

  const dayStats = useMemo(() => days.map((d) => {
    const n = d.blocks.filter((b) => b.kind !== "break").length;
    const done = Array.from({ length: n }, (_, i) => plan.progress?.[`d${d.day}_${i}`]).filter(Boolean).length;
    return { day: d.day, n, done };
  }), [days, plan.progress]);
  const totalDone = dayStats.reduce((t, x) => t + x.done, 0);
  const total = dayStats.reduce((t, x) => t + x.n, 0);

  async function toggle(i: number) {
    const key = `d${day.day}_${i}`;
    const next = { ...(plan.progress ?? {}), [key]: !plan.progress?.[key] };
    onProgress(next);
    try { await upd({ data: { path_id: plan.id, key, done: !!next[key] } }); }
    catch (e: any) { toast.error(e?.message ?? "Couldn't save"); onProgress(plan.progress); }
  }

  let studyIdx = -1;
  const dayDone = dayStats.find((x) => x.day === day.day)!;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="rounded-2xl bg-gradient-to-br from-emerald-600 via-teal-600 to-sky-700 p-5 text-white shadow-elegant">
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-wider">
          <span className="rounded-full bg-white/15 px-2 py-0.5">{s.label} · {s.hours}/day</span>
          <span className="rounded-full bg-white/15 px-2 py-0.5">{s.mode === "self" ? "Self-study" : "Lectures"}</span>
          <span className="rounded-full bg-white/15 px-2 py-0.5">Wake {s.wake}</span>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-white/90">{plan.payload.summary}</p>
        {plan.payload.weekly_focus?.length > 0 && (
          <ul className="mt-3 space-y-1">
            {plan.payload.weekly_focus.map((f: string) => (
              <li key={f} className="flex items-start gap-2 text-sm"><Target className="mt-0.5 h-3.5 w-3.5 shrink-0" />{f}</li>
            ))}
          </ul>
        )}
        <div className="mt-4">
          <div className="flex justify-between text-xs text-white/80"><span>Week progress</span><span className="tabular-nums">{totalDone}/{total} tasks</span></div>
          <Meter value={total ? (totalDone / total) * 100 : 0} className="mt-1 bg-white/20" barClass="bg-white" />
        </div>
      </div>

      {/* Day tabs */}
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-7 sm:px-0">
        {days.map((d) => {
          const st = dayStats.find((x) => x.day === d.day)!;
          const on = d.day === sel;
          return (
            <button key={d.day} onClick={() => setSel(d.day)}
              className={cn("min-w-[64px] rounded-xl border p-2 text-center transition-colors",
                on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-primary/40")}>
              <div className="text-[10px] font-bold uppercase">{d.weekday}{d.day === today ? " · Today" : ""}</div>
              <div className="text-lg font-extrabold tabular-nums">{new Date(`${d.date}T00:00:00`).getDate()}</div>
              <div className={cn("mx-auto mt-1 h-1 w-8 overflow-hidden rounded-full", on ? "bg-white/30" : "bg-muted")}>
                <div className={cn("h-full", on ? "bg-white" : "bg-emerald-500")} style={{ width: `${st.n ? (st.done / st.n) * 100 : 0}%` }} />
              </div>
            </button>
          );
        })}
      </div>

      {/* Day header */}
      <Panel>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-primary">Day {day.day} · {new Date(`${day.date}T00:00:00`).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" })}</div>
            <div className="mt-0.5 text-lg font-bold">{day.isMockDay ? "Mock test day" : day.focus_subject}</div>
          </div>
          <div className="text-right">
            <div className="text-xl font-extrabold tabular-nums">{hours(day.studyMinutes)}</div>
            <div className="text-[11px] text-muted-foreground">study time</div>
          </div>
        </div>
        {day.lectureMinutes > 0 && (
          <div className="mt-3">
            <div className="flex h-2.5 overflow-hidden rounded-full">
              <div className="bg-indigo-500" style={{ width: `${(day.lectureMinutes / day.studyMinutes) * 100}%` }} />
              <div className="flex-1 bg-teal-500" />
            </div>
            <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
              <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-indigo-500" />{s.mode === "self" ? "Concept study" : "Lectures"} {hours(day.lectureMinutes)}</span>
              <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-teal-500" />Self-study {hours(day.selfStudyMinutes)}</span>
            </div>
          </div>
        )}
        <div className="mt-3 text-xs text-muted-foreground">{dayDone.done}/{dayDone.n} done today</div>
      </Panel>

      {/* Timeline */}
      <div className="relative rounded-2xl border border-border bg-card p-2 shadow-soft sm:p-3">
        {day.blocks.map((b) => {
          const st = KIND_STYLE[b.kind];
          const Icon = st.icon;
          if (b.kind === "break") {
            return (
              <div key={b.id} className="flex items-center gap-3 px-2 py-1.5 text-xs text-muted-foreground">
                <span className="w-[86px] shrink-0 tabular-nums">{b.start}–{b.end}</span>
                <Coffee className="h-3.5 w-3.5" /> {b.title}
              </div>
            );
          }
          studyIdx++;
          const i = studyIdx;
          const done = !!plan.progress?.[`d${day.day}_${i}`];
          return (
            <button key={b.id} onClick={() => toggle(i)}
              className={cn("my-1 flex w-full items-start gap-3 rounded-xl p-2.5 text-left transition-colors hover:bg-muted/60", done && "opacity-60")}>
              <div className="w-[86px] shrink-0 pt-0.5">
                <div className="text-xs font-bold tabular-nums">{b.start}–{b.end}</div>
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground"><Timer className="h-3 w-3" />{hours(b.minutes)}</div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className={cn("inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold", st.chip)}><Icon className="h-3 w-3" />{b.label}</span>
                  {b.subject && b.subject !== "Mixed" && <span className="text-[10px] font-semibold text-muted-foreground">{b.subject}</span>}
                </div>
                <div className={cn("mt-1 text-sm font-bold", done && "line-through")}>{b.title}</div>
                {b.details && <div className="mt-0.5 text-xs text-muted-foreground">{b.details}</div>}
              </div>
              {done ? <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-emerald-500" /> : <Circle className="mt-1 h-5 w-5 shrink-0 text-muted-foreground" />}
            </button>
          );
        })}
      </div>

      {day.motivation_note && (
        <div className="flex items-start gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-3">
          <img src="/dr-azka.png" alt="" className="h-9 w-9 shrink-0 object-contain" />
          <p className="text-sm"><b>Dr. Azka:</b> {day.motivation_note}</p>
        </div>
      )}

      <div className="flex flex-col gap-2 pb-4 sm:flex-row">
        <button onClick={onNew} className="h-11 flex-1 rounded-xl border border-border bg-card text-sm font-bold">Build a new plan</button>
        <Link to="/consult-report" className="flex h-11 flex-1 items-center justify-center rounded-xl border border-border bg-card text-sm font-bold">See my report</Link>
      </div>
    </div>
  );
}
