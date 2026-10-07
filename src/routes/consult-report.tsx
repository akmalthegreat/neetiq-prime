import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { AlertTriangle, ArrowRight, CheckCircle2, Eye, Printer } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { DrAzkaLoader } from "@/components/dr-akza-loader";
import { FeatureLock } from "@/components/feature-lock";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { NEET_SECONDS_PER_QUESTION, RULES, type ChapterStat } from "@/lib/insights-engine";
import {
  ActivityGrid, ConsultTopBar, DataBasis, Meter, NotEnoughData, Panel, SECTION_STYLE, StatTile, WeeklyTrend,
  accuracyTone, useConsultData,
} from "@/components/consult/consult-ui";

export const Route = createFileRoute("/consult-report")({
  head: () => ({ meta: [{ title: "Overall Report — Dr. Azka" }] }),
  component: () => (<FeatureLock feature="analytics"><ReportPage /></FeatureLock>),
});

function ReportPage() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const q = useConsultData();
  useEffect(() => { if (!loading && !user) nav({ to: "/login" }); }, [user, loading, nav]);

  if (loading || !user || q.isLoading || !q.data) {
    return <DrAzkaLoader fullScreen message="Dr. Azka is preparing your report..." subMessage="Chapter accuracy, trends and mistake patterns" />;
  }
  const { snapshot: s, recommendations: recs, profile } = q.data;
  const t = s.totals;
  const generated = new Date(s.generatedAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });

  return (
    <PageShell>
      <div className="mx-auto max-w-4xl print:max-w-none">
        <ConsultTopBar
          eyebrow="Overall Report"
          title={profile.name ? `${profile.name.split(" ")[0]}'s performance report` : "Your performance report"}
          subtitle={<>Generated {generated}. Built only from your own answers — no estimates or sample data.</>}
          right={
            <button onClick={() => window.print()} className="hidden shrink-0 items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-bold sm:inline-flex print:hidden">
              <Printer className="h-4 w-4" /> Save PDF
            </button>
          }
        />

        {s.dataLevel === "none" ? (
          <NotEnoughData action={<Link to="/generate" className="inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">Take your first test</Link>}>
            Your report is built from your real answers, and you haven't completed a test in the last {s.windowDays} days yet.
          </NotEnoughData>
        ) : (
          <div className="space-y-4">
            <div className="flex justify-end"><DataBasis snapshot={s} /></div>

            {/* Headline numbers */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <StatTile label="Questions answered" value={t.answered.toLocaleString("en-IN")} sub={`${t.tests} tests · ${t.skipped} skipped`} />
              <StatTile label="Accuracy" value={t.accuracy !== null ? `${t.accuracy}%` : "—"} tone={accuracyTone(t.accuracy)} sub={`${t.correct} right · ${t.wrong} wrong`} />
              <StatTile
                label="Time per question"
                value={t.avgSecPerQuestion !== null ? `${t.avgSecPerQuestion}s` : "—"}
                tone={t.avgSecPerQuestion !== null && t.avgSecPerQuestion > NEET_SECONDS_PER_QUESTION + 15 ? "text-amber-600 dark:text-amber-400" : undefined}
                sub={`NEET pace: ${NEET_SECONDS_PER_QUESTION}s`}
              />
              <StatTile label="Lost to −1 marking" value={`−${t.negativeMarksLost}`} tone="text-rose-600 dark:text-rose-400" sub="marks, NEET scheme" />
            </div>

            {/* Sections */}
            <Panel title="Subject performance">
              <div className="grid gap-3 sm:grid-cols-3">
                {s.sections.map((x) => (
                  <div key={x.key} className={cn("rounded-xl p-3", SECTION_STYLE[x.key].soft)}>
                    <div className="flex items-center justify-between">
                      <span className={cn("text-sm font-bold", SECTION_STYLE[x.key].text)}>{x.key}</span>
                      <span className={cn("text-xl font-extrabold tabular-nums", accuracyTone(x.accuracy))}>{x.accuracy !== null ? `${x.accuracy}%` : "—"}</span>
                    </div>
                    <Meter value={x.accuracy} className="mt-2 bg-background/60" barClass={SECTION_STYLE[x.key].bar} />
                    <div className="mt-2 text-[11px] text-muted-foreground">
                      {x.answered.toLocaleString("en-IN")} answered · {x.correct} right · {x.wrong} wrong
                      {x.attemptRate !== null && <> · attempts {x.attemptRate}%</>}
                    </div>
                  </div>
                ))}
              </div>
            </Panel>

            {/* Chapters */}
            <div className="grid gap-4 md:grid-cols-2">
              <ChapterList
                title="Weak chapters" icon={<AlertTriangle className="h-4 w-4 text-rose-500" />}
                empty={`No chapter below ${RULES.weakAccuracy}% (with ${RULES.chapterMinAnswered}+ answers). Well done.`}
                items={s.weaknesses}
              />
              <ChapterList
                title="Strong chapters" icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                empty={`No chapter at ${RULES.strongAccuracy}%+ yet (with ${RULES.chapterMinAnswered}+ answers).`}
                items={s.strengths}
              />
            </div>
            {s.watchlist.length > 0 && (
              <ChapterList title="Watch list" icon={<Eye className="h-4 w-4 text-amber-500" />} empty="" items={s.watchlist}
                hint={`${RULES.weakAccuracy}–${RULES.watchAccuracy - 1}%: one bad week from becoming weak`} />
            )}

            {/* Trend + activity */}
            <div className="grid gap-4 md:grid-cols-5">
              <Panel title="Weekly trend" className="md:col-span-3"><WeeklyTrend weekly={s.weekly} /></Panel>
              <Panel title="Last 28 days" hint={`${s.consistency.activeDays28} active days · streak ${s.consistency.streak}`} className="md:col-span-2">
                <ActivityGrid daily={s.daily} />
              </Panel>
            </div>

            {/* Difficulty + mistakes */}
            <div className="grid gap-4 md:grid-cols-2">
              <Panel title="By difficulty">
                {s.difficulty.length === 0 ? <p className="text-sm text-muted-foreground">No difficulty data on your questions yet.</p> : (
                  <div className="space-y-3">
                    {s.difficulty.map((d) => (
                      <div key={d.level}>
                        <div className="flex justify-between text-xs"><span className="font-semibold capitalize">{d.level}</span><span className={cn("font-bold tabular-nums", accuracyTone(d.accuracy))}>{d.accuracy}% <span className="font-normal text-muted-foreground">of {d.answered}</span></span></div>
                        <Meter value={d.accuracy} className="mt-1" />
                      </div>
                    ))}
                  </div>
                )}
              </Panel>
              <Panel title="Mistake Book" hint={`${s.mistakes.last7} added this week`}>
                <div className="text-3xl font-extrabold tabular-nums">{s.mistakes.total.toLocaleString("en-IN")}</div>
                <div className="text-xs text-muted-foreground">questions saved to re-solve</div>
                {s.mistakes.topChapters.length > 0 && (
                  <div className="mt-3 space-y-1.5">
                    {s.mistakes.topChapters.map((c) => (
                      <div key={c.chapterId} className="flex justify-between text-sm"><span className="truncate pr-2">{c.name}</span><span className="font-bold tabular-nums text-rose-600 dark:text-rose-400">{c.count}</span></div>
                    ))}
                  </div>
                )}
                <Link to="/mistakes" className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-primary print:hidden">Open Mistake Book <ArrowRight className="h-3.5 w-3.5" /></Link>
              </Panel>
            </div>

            {/* Recommendations */}
            <Panel title="Dr. Azka's recommendations">
              <div className="space-y-2.5">
                {recs.map((r, i) => (
                  <div key={r.id} className="flex gap-3 rounded-xl bg-muted/50 p-3">
                    <div className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-extrabold text-white",
                      r.tone === "critical" ? "bg-rose-500" : r.tone === "keep" ? "bg-emerald-500" : "bg-amber-500")}>{i + 1}</div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold">{r.title}</div>
                      <div className="text-xs text-muted-foreground">{r.detail}</div>
                      {r.action && (
                        <Link to={r.action.to as any} className="mt-1.5 inline-flex items-center gap-1 text-xs font-bold text-primary print:hidden">{r.action.label} <ArrowRight className="h-3 w-3" /></Link>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Panel>

            <p className="pb-4 text-center text-[11px] text-muted-foreground">
              Chapters are judged only after {RULES.chapterMinAnswered}+ answers. Strong ≥ {RULES.strongAccuracy}% · Weak &lt; {RULES.weakAccuracy}%. Data window: last {s.windowDays} days.
            </p>
          </div>
        )}
      </div>
    </PageShell>
  );
}

function ChapterList({ title, icon, items, empty, hint }: { title: string; icon: ReactNode; items: ChapterStat[]; empty: string; hint?: string }) {
  return (
    <Panel title={title} hint={hint}>
      {items.length === 0 ? <p className="text-sm text-muted-foreground">{empty}</p> : (
        <div className="divide-y divide-border">
          {items.map((c) => (
            <div key={c.chapterId} className="flex items-center gap-3 py-2">
              {icon}
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{c.name}</div>
                <div className="text-[11px] text-muted-foreground">{c.section ?? "—"} · {c.answered} answered{c.mistakes ? ` · ${c.mistakes} in Mistake Book` : ""}</div>
              </div>
              <div className={cn("text-sm font-extrabold tabular-nums", accuracyTone(c.accuracy))}>{c.accuracy}%</div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
