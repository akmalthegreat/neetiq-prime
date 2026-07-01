import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageShell } from "@/components/page-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, Clock, FileText, CalendarDays } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { FeatureLock } from "@/components/feature-lock";

type Test = { id: string; title: string; description: string | null; difficulty: string; duration_min: number; total_questions: number; source: string; created_at: string };

export const Route = createFileRoute("/daily")({
  head: () => ({ meta: [{ title: "Daily Free Quiz — NEETIQ Prime" }, { name: "description", content: "A fresh free NEET quiz every day. 10 questions, 15 minutes." }] }),
  component: () => (<FeatureLock feature="daily_dpp"><DailyPage/></FeatureLock>),
});

function DailyPage() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [today, setToday] = useState<Test | null | undefined>(undefined);
  const [past, setPast] = useState<Test[]>([]);

  useEffect(() => { if (!loading && !user) nav({ to: "/login" }); }, [user, loading, nav]);

  useEffect(() => {
    // Show EVERY DPP-style test (daily, quiz, dpp, generated) in the Daily DPP feed.
    supabase.from("tests").select("id,title,description,difficulty,duration_min,total_questions,source,created_at,type")
      .in("type", ["daily", "quiz", "dpp", "generated"]).order("created_at", { ascending: false }).limit(500)
      .then(({ data }) => {
        const list = (data ?? []) as Test[];
        const todayStr = new Date().toDateString();
        const latest = list[0];
        const isToday = latest && new Date(latest.created_at).toDateString() === todayStr;
        setToday(isToday ? latest : null);
        setPast(isToday ? list.slice(1) : list);
      });
  }, []);

  return (
    <PageShell eyebrow="Free everyday" title="Daily quiz" description="Stay sharp with a free quiz, refreshed daily.">
      {today === undefined ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : !today ? (
        <Card><CardContent className="p-10 text-center text-sm text-muted-foreground">No daily quiz yet. Check back soon.</CardContent></Card>
      ) : (
        <Card className="overflow-hidden border-primary/25 shadow-soft">
          <div className="bg-gradient-to-br from-primary/90 via-accent/80 to-primary/75 p-6 text-primary-foreground sm:p-8">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest backdrop-blur">
              <Sparkles className="h-3.5 w-3.5" /> Today
            </div>
            <h2 className="mt-3 text-2xl font-bold sm:text-3xl">{today.title}</h2>
            {today.description && <p className="mt-2 max-w-xl text-sm opacity-90">{today.description}</p>}
            <div className="mt-4 flex flex-wrap items-center gap-3 text-sm opacity-90">
              <span className="inline-flex items-center gap-1"><FileText className="h-4 w-4" />{today.total_questions} Qs</span>
              <span className="inline-flex items-center gap-1"><Clock className="h-4 w-4" />{today.duration_min} min</span>
              <Badge className="bg-white/20 capitalize">{today.difficulty}</Badge>
              <Badge className="bg-white/20">{today.source}</Badge>
            </div>
            <Button asChild size="lg" className="mt-6 bg-background text-foreground hover:bg-background/90">
              <Link to="/quiz/$testId" params={{ testId: today.id }}>Start now</Link>
            </Button>
          </div>
        </Card>
      )}

      {past.length > 0 && (
        <div className="mt-10">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-widest text-muted-foreground">Previous quizzes</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {past.map((t) => (
              <Card key={t.id} className="hover-lift">
                <CardContent className="space-y-3 p-5">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {new Date(t.created_at).toLocaleDateString()}
                  </div>
                  <div className="text-base font-semibold leading-tight">{t.title}</div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{t.total_questions} Qs</span><span>·</span><span>{t.duration_min} min</span>
                  </div>
                  <Button asChild variant="outline" className="w-full"><Link to="/quiz/$testId" params={{ testId: t.id }}>Attempt</Link></Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </PageShell>
  );
}
