import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { PageShell } from "@/components/page-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Play, RotateCw, Eye, FileText, Coins } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { startDppAttempt, DPP_PAST_COST_BONUS } from "@/lib/dpp-gate.functions";
import { toast } from "sonner";
import { FeatureLock } from "@/components/feature-lock";

export const Route = createFileRoute("/dpp")({
  head: () => ({ meta: [{ title: "DPP & Quiz — NEETIQ Prime" }] }),
  component: () => (<FeatureLock feature="daily_dpp"><DppPage/></FeatureLock>),
});

type Test = { id: string; title: string; difficulty: string; total_questions: number; duration_min: number; marks_correct: number; created_at: string; starts_at: string | null; ends_at: string | null; type: string };
type Attempt = { id: string; test_id: string; status: string };

function DppPage() {
  const { user, loading, refresh } = useAuth();
  const nav = useNavigate();
  const [tests, setTests] = useState<Test[] | null>(null);
  const [attempts, setAttempts] = useState<Record<string, Attempt>>({});
  const [now, setNow] = useState(() => Date.now());
  const [gating, setGating] = useState<string | null>(null);
  const startGate = useServerFn(startDppAttempt);

  useEffect(() => { if (!loading && !user) nav({ to: "/login" }); }, [user, loading, nav]);
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(id); }, []);

  useEffect(() => {
    (async () => {
      const { data: t } = await supabase.from("tests").select("id,title,difficulty,total_questions,duration_min,marks_correct,created_at,starts_at,ends_at,type")
        .in("type", ["daily", "quiz"]).order("created_at", { ascending: false });
      setTests((t ?? []) as Test[]);
      if (user) {
        const { data: a } = await supabase.from("attempts").select("id,test_id,status").eq("user_id", user.id).order("started_at", { ascending: false });
        const map: Record<string, Attempt> = {};
        (a ?? []).forEach((row) => { if (!map[row.test_id]) map[row.test_id] = row as Attempt; });
        setAttempts(map);
      }
    })();
  }, [user]);

  async function attemptDpp(t: Test) {
    if (gating) return;
    setGating(t.id);
    try {
      const r = await startGate({ data: { test_id: t.id } });
      if (r.charged > 0) {
        toast.success(`−${r.charged} bonus deducted for past DPP`);
        await refresh();
      }
      nav({ to: "/quiz/$testId", params: { testId: t.id }, search: { mode: "quiz" } as never });
    } catch (e: any) {
      toast.error(e?.message ?? "Could not start DPP");
    } finally {
      setGating(null);
    }
  }

  return (
    <PageShell eyebrow="Practice" title="All DPP & Quiz" description="Daily Practice Problems and topic quizzes.">
      <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
        <strong>Live DPP is free.</strong> Attempting any past (ended) DPP costs <strong>{DPP_PAST_COST_BONUS} bonus</strong>. Resuming an in-progress attempt is free.
      </div>
      {tests === null ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> :
        tests.length === 0 ? <Card><CardContent className="p-10 text-center text-sm text-muted-foreground">No DPPs yet.</CardContent></Card> :
        <div className="space-y-3">
          {tests.map((t) => {
            const a = attempts[t.id];
            const startMs = t.starts_at ? new Date(t.starts_at).getTime() : null;
            const endMs = t.ends_at ? new Date(t.ends_at).getTime() : null;
            const isLive = t.type === "daily" && (startMs === null || startMs <= now) && (endMs === null || endMs > now);
            const isExpired = t.type === "daily" && endMs !== null && endMs <= now;
            const needsBonus = isExpired && !a;
            return (
              <Card key={t.id} className={isExpired ? "opacity-90" : undefined}>
                <CardContent className="flex items-start gap-3 p-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                    <FileText className="h-7 w-7" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="secondary" className="capitalize">{t.difficulty}</Badge>
                      {isLive && (
                        <Badge className="gap-1 bg-destructive text-destructive-foreground">
                          <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-75" /><span className="relative inline-flex h-2 w-2 rounded-full bg-current" /></span>
                          LIVE · FREE
                        </Badge>
                      )}
                      {isExpired && <Badge variant="outline">Ended</Badge>}
                      {needsBonus && (
                         <Badge className="gap-1 bg-warning text-warning-foreground"><Coins className="h-3 w-3" /> {DPP_PAST_COST_BONUS} bonus</Badge>
                      )}
                      <span>{new Date(t.created_at).toLocaleDateString()}</span>
                    </div>
                    <div className="mt-1 text-sm font-semibold leading-tight">{t.title}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{t.total_questions} Qs · {t.total_questions * t.marks_correct} Marks · {t.duration_min} min</div>
                    <div className="mt-3">
                      {a?.status === "completed" ? (
                        <Button asChild size="sm" variant="outline"><Link to="/analysis/$attemptId" params={{ attemptId: a.id }}><Eye className="mr-1.5 h-3.5 w-3.5" /> View Analysis</Link></Button>
                      ) : a?.status === "in_progress" ? (
                        <Button asChild size="sm" className="bg-warning text-warning-foreground hover:bg-warning/90"><Link to="/quiz/$testId" params={{ testId: t.id }} search={{ mode: "quiz" } as never}><RotateCw className="mr-1.5 h-3.5 w-3.5" /> Resume</Link></Button>
                      ) : (
                        <Button
                          size="sm"
                          className={isExpired ? "" : "bg-gradient-primary"}
                          variant={isExpired ? "outline" : "default"}
                          disabled={gating === t.id}
                          onClick={() => attemptDpp(t)}
                        >
                          {gating === t.id ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Play className="mr-1.5 h-3.5 w-3.5" />}
                          {isExpired ? `Attempt · ${DPP_PAST_COST_BONUS} bonus` : "Attempt"}
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      }
    </PageShell>
  );
}
