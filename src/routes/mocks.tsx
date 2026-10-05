import { DrAkzaLoader } from "@/components/dr-akza-loader";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { PageShell } from "@/components/page-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Loader2, Clock, FileText, BookOpen, ChevronDown, Gift } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { startMockAttempt, MOCK_COST_BONUS } from "@/lib/mock-gate.functions";
import { toast } from "sonner";
import { FeatureLock } from "@/components/feature-lock";

type SyllabusEntry = { subjectId: string; subjectName: string; chapters: { id: string; name: string }[] };

type Test = {
  id: string;
  title: string;
  description: string | null;
  difficulty: string;
  duration_min: number;
  total_questions: number;
  source: string;
  entry_fee: number;
  is_paid: boolean;
  syllabus: SyllabusEntry[] | null;
};

export const Route = createFileRoute("/mocks")({
  head: () => ({ meta: [{ title: "Mock Tests — NEET Track" }, { name: "description", content: "Full-length NEET mock tests with detailed solutions and analytics." }] }),
  component: () => (<FeatureLock feature="ai_mock_tests"><MocksPage/></FeatureLock>),
});

function MocksPage() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [tests, setTests] = useState<Test[] | null>(null);

  useEffect(() => { if (!loading && !user) nav({ to: "/login" }); }, [user, loading, nav]);

  useEffect(() => {
    supabase
      .from("tests")
      .select("id,title,description,difficulty,duration_min,total_questions,source,entry_fee,is_paid,syllabus")
      .eq("type", "mock")
      .order("created_at", { ascending: false })
      .then(({ data }) => setTests(((data ?? []) as unknown) as Test[]));
  }, []);

  const [category, setCategory] = useState("all");
  const categories = useMemo(() => {
    return [
      { id: "all", label: "All Tests" },
      { id: "full", label: "Full Test" },
      { id: "class_11", label: "Class 11th" },
      { id: "class_12", label: "Class 12th" },
      { id: "part", label: "Part Test" },
    ];
  }, []);

  const filteredTests = useMemo(() => {
    if (!tests || category === "all") return tests ?? [];

    return tests.filter((t) => {
      const title = (t.title || "").toLowerCase();
      const desc = (t.description || "").toLowerCase();
      const source = (t.source || "").toLowerCase();
      const combined = `${title} ${desc} ${source}`;

      if (category === "full") {
        return (
          /full|complete|grand|major|all india|neet-ug|mock \d+/i.test(title) ||
          t.total_questions >= 180 ||
          (!/11th|12th|class 11|class 12|part/i.test(combined) && !/chapter|unit/i.test(combined))
        );
      }

      if (category === "class_11") {
        return (
          /11th|class 11|xi|class-11/i.test(combined) ||
          (Array.isArray(t.syllabus) &&
            t.syllabus.some((s) =>
              /11th|xi/i.test(s.subjectName) || s.chapters?.some((c) => /11th|xi/i.test(c.name))
            ))
        );
      }

      if (category === "class_12") {
        return (
          /12th|class 12|xii|class-12/i.test(combined) ||
          (Array.isArray(t.syllabus) &&
            t.syllabus.some((s) =>
              /12th|xii/i.test(s.subjectName) || s.chapters?.some((c) => /12th|xii/i.test(c.name))
            ))
        );
      }

      if (category === "part") {
        return (
          /part|minor|unit|section|chapter|module/i.test(combined) ||
          (t.total_questions < 180 && !/11th|12th/i.test(combined))
        );
      }

      return true;
    });
  }, [tests, category]);

  return (
    <PageShell eyebrow="Practice" title="Mock tests" description={`Full-length NEET-pattern tests. First mock is FREE — every later mock costs ${MOCK_COST_BONUS} bonus coins.`}>
      {tests === null ? <Loader2 className="h-5 w-5 animate-spin text-primary" />
        : tests.length === 0 ? (
          <Card><CardContent className="p-10 text-center text-sm text-muted-foreground">No mocks published yet.</CardContent></Card>
        ) : (
          <div className="space-y-8">
            {/* Pricing notice */}
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="flex items-center gap-3 p-4 text-xs sm:text-sm">
                <Gift className="h-4 w-4 shrink-0 text-primary" />
                <div className="min-w-0">
                  <span className="font-semibold">Your first mock is free.</span>{" "}
                  Every additional mock attempt costs <span className="font-bold">{MOCK_COST_BONUS} bonus coins</span>.
                  Need more bonus? <Link to="/bonus" className="font-semibold text-primary underline">Earn Bonus</Link>.
                </div>
              </CardContent>
            </Card>

            <section aria-label="Filter mock tests by category">
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted-foreground">Categories</h2>
              <div className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-2" role="group" aria-label="Mock test categories">
                {categories.map((item) => {
                  const selected = category === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setCategory(item.id)}
                      aria-pressed={selected}
                      className={`shrink-0 snap-start rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
                        selected
                          ? "border-primary bg-primary text-primary-foreground shadow-xs"
                          : "border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground"
                      }`}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </section>

            {/* All mocks list */}
            <section>
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted-foreground">{category === "all" ? "All mock tests" : category === "full" ? "Full syllabus tests" : `${category} tests`}</h2>
              {filteredTests.length ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {filteredTests.map((t) => <MockCard key={t.id} t={t} />)}
              </div> : <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">No mock tests in this category yet.</CardContent></Card>}
            </section>
          </div>
        )}
    </PageShell>
  );
}

function MockCard({ t }: { t: Test }) {
  const [open, setOpen] = useState(false);
  const [starting, setStarting] = useState(false);
  const nav = useNavigate();
  const syl = Array.isArray(t.syllabus) ? t.syllabus : [];
  const gate = useServerFn(startMockAttempt);

  const handleStart = async () => {
    setStarting(true);
    try {
      await gate({ data: { test_id: t.id } });
      nav({ to: "/quiz/$testId", params: { testId: t.id }, search: { mode: "cbt" } as never });
    } catch (e: any) {
      toast.error(e?.message ?? "Could not start this mock");
    } finally {
      setStarting(false);
    }
  };

  return (
    <Card className="hover-lift">
      <CardContent className="space-y-3 p-5">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="outline" className="capitalize">{t.difficulty}</Badge>
          <Badge variant="secondary">{t.source}</Badge>
          {t.is_paid ? <Badge className="bg-gradient-accent">₹{t.entry_fee}</Badge> : <Badge className="bg-success/15 text-success">Free</Badge>}
        </div>
        <div className="text-base font-semibold leading-tight">{t.title}</div>
        {t.description && <p className="line-clamp-2 text-xs text-muted-foreground">{t.description}</p>}
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1"><FileText className="h-3.5 w-3.5" />{t.total_questions} Qs</span>
          <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{t.duration_min} min</span>
        </div>

        {syl.length > 0 && (
          <Collapsible open={open} onOpenChange={setOpen}>
            <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md border bg-secondary/40 px-2.5 py-1.5 text-xs font-medium hover:bg-secondary">
              <span className="inline-flex items-center gap-1.5">
                <BookOpen className="h-3.5 w-3.5" /> Syllabus ({syl.reduce((n, s) => n + s.chapters.length, 0)} chapters)
              </span>
              <ChevronDown className={`h-3.5 w-3.5 transition ${open ? "rotate-180" : ""}`} />
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 space-y-2 rounded-md border bg-card p-2.5">
              {syl.map((s) => (
                <div key={s.subjectId}>
                  <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{s.subjectName}</div>
                  <div className="flex flex-wrap gap-1">
                    {s.chapters.map((c) => (
                      <Badge key={c.id} variant="outline" className="font-normal">{c.name}</Badge>
                    ))}
                  </div>
                </div>
              ))}
            </CollapsibleContent>
          </Collapsible>
        )}

        <Button onClick={handleStart} disabled={starting} className="w-full bg-gradient-primary">
          {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Start"}
        </Button>
      </CardContent>
    </Card>
  );
}
