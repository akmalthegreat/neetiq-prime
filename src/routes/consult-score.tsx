import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { ChevronDown, TrendingUp } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { DrAzkaLoader } from "@/components/dr-akza-loader";
import { FeatureLock } from "@/components/feature-lock";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { RULES } from "@/lib/insights-engine";
import {
  ConsultTopBar, DataBasis, Meter, NotEnoughData, Panel, ScoreGauge, SECTION_STYLE, accuracyTone, useConsultData,
} from "@/components/consult/consult-ui";

export const Route = createFileRoute("/consult-score")({
  head: () => ({ meta: [{ title: "NEET Score Predictor — Dr. Azka" }] }),
  component: () => (<FeatureLock feature="score_predictor"><ScorePage /></FeatureLock>),
});

const CONFIDENCE = {
  low: { label: "Low confidence", cls: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  medium: { label: "Medium confidence", cls: "bg-sky-500/15 text-sky-700 dark:text-sky-300" },
  high: { label: "High confidence", cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
};

function ScorePage() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const q = useConsultData();
  useEffect(() => { if (!loading && !user) nav({ to: "/login" }); }, [user, loading, nav]);

  if (loading || !user || q.isLoading || !q.data) {
    return <DrAzkaLoader fullScreen message="Dr. Azka is calculating your NEET score..." subMessage="Applying +4 / −1 marking to your real accuracy" />;
  }
  const { prediction: p, snapshot: s } = q.data;

  return (
    <PageShell>
      <div className="mx-auto max-w-3xl">
        <ConsultTopBar
          eyebrow="Score Predictor"
          title="Your expected NEET score"
          subtitle="If NEET were held today, this is what your current accuracy and attempt pattern would score."
        />

        {!p.ready ? (
          <NotEnoughData action={<Link to="/generate" className="inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">Generate a test</Link>}>
            <div className="font-semibold text-foreground">I need a little more data to predict honestly.</div>
            <div className="mt-3 space-y-2 text-left">
              {p.sections.map((x) => (
                <div key={x.key}>
                  <div className="flex justify-between text-xs"><span>{x.key}</span><span className="tabular-nums">{Math.min(x.answered, RULES.sectionMinAnswered)}/{RULES.sectionMinAnswered} answered</span></div>
                  <Meter value={(Math.min(x.answered, RULES.sectionMinAnswered) / RULES.sectionMinAnswered) * 100} className="mt-1" barClass={SECTION_STYLE[x.key].bar} />
                </div>
              ))}
            </div>
          </NotEnoughData>
        ) : (
          <div className="space-y-4">
            <Panel>
              <div className="flex flex-col items-center text-center">
                <ScoreGauge value={p.expected} low={p.low} high={p.high} />
                <div className="-mt-6 flex items-baseline gap-1">
                  <span className="text-5xl font-extrabold tabular-nums tracking-tight">{p.expected}</span>
                  <span className="text-lg text-muted-foreground">/ 720</span>
                </div>
                <div className="mt-1 text-sm text-muted-foreground">Likely range <span className="font-bold text-foreground">{p.low} – {p.high}</span></div>
                <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                  <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-bold", CONFIDENCE[p.confidence].cls)}>{CONFIDENCE[p.confidence].label}</span>
                  <DataBasis snapshot={s} />
                </div>
              </div>
            </Panel>

            <Panel title="Section-wise marks" hint="Bar = likely range · dot = expected">
              <div className="space-y-4">
                {p.sections.map((x) => {
                  const st = SECTION_STYLE[x.key];
                  const lo = Math.max(0, x.low) / x.maxMarks * 100;
                  const hi = Math.max(0, x.high) / x.maxMarks * 100;
                  const ex = Math.max(0, x.expected) / x.maxMarks * 100;
                  return (
                    <div key={x.key}>
                      <div className="flex items-baseline justify-between">
                        <div className="flex items-center gap-2 font-semibold"><span className={cn("h-2.5 w-2.5 rounded-full", st.dot)} />{x.key}</div>
                        <div className="text-sm"><span className="font-extrabold tabular-nums">{x.expected}</span><span className="text-muted-foreground"> / {x.maxMarks}</span></div>
                      </div>
                      <div className="relative mt-2 h-2.5 rounded-full bg-muted">
                        <div className={cn("absolute h-full rounded-full opacity-40", st.bar)} style={{ left: `${lo}%`, width: `${Math.max(1, hi - lo)}%` }} />
                        <div className={cn("absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background", st.bar)} style={{ left: `${ex}%` }} />
                      </div>
                      <div className="mt-1.5 flex justify-between text-[11px] text-muted-foreground">
                        <span>Accuracy <b className={accuracyTone(x.accuracy)}>{x.accuracy}%</b> · Attempted {x.attemptRate ?? 100}%</span>
                        <span>{x.answered.toLocaleString("en-IN")} answers</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Panel>

            {p.levers.length > 0 && (
              <Panel title="Fastest ways to add marks">
                <div className="space-y-2.5">
                  {p.levers.map((l) => (
                    <div key={l.label} className="flex items-start gap-3 rounded-xl bg-muted/50 p-3">
                      <div className="flex h-12 w-14 shrink-0 flex-col items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                        <TrendingUp className="h-3.5 w-3.5" />
                        <span className="text-sm font-extrabold tabular-nums">+{l.gain}</span>
                      </div>
                      <div>
                        <div className="text-sm font-bold">{l.label}</div>
                        <div className="text-xs text-muted-foreground">{l.detail}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </Panel>
            )}

            <details className="group rounded-2xl border border-border bg-card p-4 shadow-soft">
              <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-bold">
                How this score is calculated
                <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
              </summary>
              <ul className="mt-3 list-disc space-y-1.5 pl-5 text-xs text-muted-foreground">
                <li>NEET pattern: Physics 45, Chemistry 45, Biology 90 questions. +4 for correct, −1 for wrong, 0 for skipped.</li>
                <li>For each section we use <b>your</b> accuracy and how often you attempt questions, from your last {s.windowDays} days of tests.</li>
                <li>Expected marks per question = attempt rate × (4 × accuracy − 1 × (1 − accuracy)).</li>
                <li>The range reflects how much data we have: fewer answers means a wider range. It narrows as you practise more.</li>
                <li>Practice tests can be easier or harder than the real paper, so treat this as a guide, not a guarantee.</li>
              </ul>
            </details>
          </div>
        )}
      </div>
    </PageShell>
  );
}
