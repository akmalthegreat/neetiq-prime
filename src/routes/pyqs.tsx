import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageShell } from "@/components/page-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, BookMarked } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { FeatureLock } from "@/components/feature-lock";

export const Route = createFileRoute("/pyqs")({
  head: () => ({ meta: [{ title: "NEET PYQs — NEETIQ Prime" }] }),
  component: () => (<FeatureLock feature="pyqs"><PyqPage/></FeatureLock>),
});

type Row = { year: number; count: number };

function PyqPage() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [launching, setLaunching] = useState<number | null>(null);

  useEffect(() => { if (!loading && !user) nav({ to: "/login" }); }, [user, loading, nav]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("questions").select("pyq_year").eq("is_pyq", true);
      const counts: Record<number, number> = {};
      (data ?? []).forEach((r) => { if (r.pyq_year) counts[r.pyq_year] = (counts[r.pyq_year] ?? 0) + 1; });
      const arr: Row[] = Object.entries(counts).map(([y, c]) => ({ year: Number(y), count: c })).sort((a, b) => b.year - a.year);
      setRows(arr);
    })();
  }, []);

  const start = async (year: number, mode: "quiz" | "exam") => {
    if (!user) return;
    setLaunching(year);
    const { data: qs } = await supabase.from("questions").select("id").eq("is_pyq", true).eq("pyq_year", year);
    const ids = (qs ?? []).map((q) => q.id);
    const { data: t, error } = await supabase.from("tests").insert({
      title: `NEET ${year} PYQ`, type: "custom", difficulty: "medium",
      duration_min: Math.max(30, ids.length), total_questions: ids.length,
      question_ids: ids, created_by: user.id, source: "PYQ",
    }).select("id").maybeSingle();
    setLaunching(null);
    if (error || !t) { toast.error(error?.message ?? "Could not start"); return; }
    nav({ to: "/quiz/$testId", params: { testId: t.id }, search: { mode } as never });
  };

  return (
    <PageShell eyebrow="Previous Years" title="NEET PYQs" description="Year-wise NEET previous year question banks.">
      {rows === null ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> :
        rows.length === 0 ? <Card><CardContent className="p-10 text-center text-sm text-muted-foreground">No PYQs added yet. Admins can upload them from the admin panel.</CardContent></Card> :
        <div className="grid gap-3 sm:grid-cols-2">
          {rows.map((r) => (
            <Card key={r.year}>
              <CardContent className="flex items-center gap-4 p-5">
                <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-blue-100 text-blue-700"><BookMarked className="h-7 w-7" /></div>
                <div className="flex-1">
                  <div className="text-lg font-bold">NEET {r.year}</div>
                  <div className="text-xs text-muted-foreground">{r.count} questions</div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Button size="sm" className="bg-gradient-primary" disabled={launching === r.year} onClick={() => start(r.year, "quiz")}>Quiz</Button>
                  <Button size="sm" variant="outline" disabled={launching === r.year} onClick={() => start(r.year, "exam")}>Exam</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      }
    </PageShell>
  );
}
