import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { PageShell } from "@/components/page-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Route as RouteIcon, Sparkles, CheckCircle2, Circle, Clock } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { getCurrentPath, generateAiPath, updatePathProgress } from "@/lib/ai-path.functions";
import { getAppSettings } from "@/lib/app-settings.functions";
import { toast } from "sonner";
import { FeatureLock } from "@/components/feature-lock";

export const Route = createFileRoute("/ai-path")({
  head: () => ({ meta: [{ title: "AI Path — NEET Track" }] }),
  component: () => (<FeatureLock feature="ai_path"><AiPathPage/></FeatureLock>),
});

type Day = { day: number; focus_subject: string; topics: string[]; daily_tasks: string[]; time_min: number; motivation_note: string };
type Plan = { id: string; start_date: string; payload: { summary?: string; days: Day[] }; progress: Record<string, boolean>; created_at: string };

function AiPathPage() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const fetchPath = useServerFn(getCurrentPath);
  const gen = useServerFn(generateAiPath);
  const upd = useServerFn(updatePathProgress);
  const settings = useServerFn(getAppSettings);

  const [plan, setPlan] = useState<Plan | null | undefined>(undefined);
  const [cost, setCost] = useState(45);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (!loading && !user) nav({ to: "/login" }); }, [user, loading, nav]);
  useEffect(() => {
    if (!user) return;
    fetchPath().then((r) => setPlan((r.path as Plan | null) ?? null)).catch(() => setPlan(null));
    settings().then((s) => setCost(s.ai_path_cost));
  }, [user?.id]);

  async function onGen() {
    if (!confirm(`Generate a fresh 7-day plan? This costs ${cost} bonus coins.`)) return;
    setBusy(true);
    try {
      const r = await gen({}) as { path: Plan };
      setPlan(r.path);
      toast.success("Your 7-day path is ready!");
    } catch (e: any) { toast.error(e?.message ?? "Failed"); }
    finally { setBusy(false); }
  }

  async function toggle(dayNum: number, idx: number, done: boolean) {
    if (!plan) return;
    const key = `d${dayNum}_${idx}`;
    setPlan({ ...plan, progress: { ...plan.progress, [key]: done } });
    try { await upd({ data: { path_id: plan.id, key, done } }); }
    catch (e: any) { toast.error(e?.message ?? "Failed"); }
  }

  if (loading || !user || plan === undefined) {
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <PageShell eyebrow="Personalized" title="AI Path" description={`A 7-day NEET prep plan built around your strengths & weaknesses. Costs ${cost} bonus per plan.`}>
      <Card className="mb-4 border-0 bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-600 text-white shadow-elegant">
        <CardContent className="p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 backdrop-blur"><RouteIcon className="h-6 w-6" /></div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold uppercase tracking-widest opacity-90">7-Day AI Plan</div>
              {plan ? (
                <>
                  <div className="text-lg font-extrabold">Started {new Date(plan.start_date).toLocaleDateString()}</div>
                  <div className="text-xs opacity-90">{plan.payload.summary ?? "Personalized to your performance"}</div>
                </>
              ) : (
                <div className="text-sm opacity-90">Generate a personalized 7-day plan.</div>
              )}
            </div>
          </div>
          <Button onClick={onGen} disabled={busy} variant="secondary" className="mt-4 w-full bg-white text-violet-700 hover:bg-white/90">
            {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1.5 h-4 w-4" />}
            {plan ? `Generate new plan (−${cost} bonus)` : `Create my plan (−${cost} bonus)`}
          </Button>
        </CardContent>
      </Card>

      {plan && plan.payload.days?.map((d) => (
        <Card key={d.day} className="mb-3 border-0 shadow-soft">
          <CardContent className="p-4">
            <div className="mb-2 flex items-center justify-between">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-primary">Day {d.day}</div>
                <div className="text-base font-bold">{d.focus_subject}</div>
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground"><Clock className="h-3 w-3" /> {d.time_min} min</div>
            </div>
            {d.topics?.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {d.topics.map((t, i) => <span key={i} className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium">{t}</span>)}
              </div>
            )}
            <ul className="space-y-1.5">
              {d.daily_tasks.map((t, i) => {
                const key = `d${d.day}_${i}`;
                const done = !!plan.progress[key];
                return (
                  <li key={i}>
                    <button onClick={() => toggle(d.day, i, !done)} className="flex w-full items-start gap-2 rounded-lg p-1.5 text-left text-sm transition-colors hover:bg-secondary/50">
                      {done ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" /> : <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />}
                      <span className={done ? "line-through text-muted-foreground" : ""}>{t}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
            {d.motivation_note && <div className="mt-2 rounded-lg bg-gradient-to-r from-violet-50 to-fuchsia-50 p-2 text-xs italic text-violet-700 dark:from-violet-500/10 dark:to-fuchsia-500/10 dark:text-violet-300">💪 {d.motivation_note}</div>}
          </CardContent>
        </Card>
      ))}
    </PageShell>
  );
}
