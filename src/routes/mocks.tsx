import { DrAkzaLoader } from "@/components/dr-akza-loader";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { PageShell } from "@/components/page-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Loader2, Clock, FileText, BookOpen, ChevronDown, Gift, Layers, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { startMockAttempt, MOCK_COST_BONUS } from "@/lib/mock-gate.functions";
import { toast } from "sonner";
import { FeatureLock } from "@/components/feature-lock";

type SyllabusEntry = { subjectId: string; subjectName: string; chapters: { id: string; name: string }[] };

type MockCategory = {
  id: string;
  name: string;
  sort_order: number;
};

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
  category_id: string | null;
};

export const Route = createFileRoute("/mocks")({
  head: () => ({
    meta: [
      { title: "Mock Tests — NEET Track" },
      { name: "description", content: "Full-length NEET mock tests with detailed solutions and analytics." },
    ],
  }),
  component: () => (
    <FeatureLock feature="ai_mock_tests">
      <MocksPage />
    </FeatureLock>
  ),
});

function MocksPage() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [tests, setTests] = useState<Test[] | null>(null);
  const [categoriesMap, setCategoriesMap] = useState<Record<string, string>>({});
  const [category, setCategory] = useState<string>("all");

  useEffect(() => {
    if (!loading && !user) nav({ to: "/login" });
  }, [user, loading, nav]);

  useEffect(() => {
    // 1. Fetch categories
    supabase
      .from("mock_categories")
      .select("id, name, sort_order")
      .order("sort_order", { ascending: true })
      .then(({ data }) => {
        if (data) {
          const map: Record<string, string> = {};
          data.forEach((c) => {
            map[c.id] = c.name;
          });
          setCategoriesMap(map);
        }
      });

    // 2. Fetch all mock tests with category_id
    supabase
      .from("tests")
      .select("id,title,description,difficulty,duration_min,total_questions,source,entry_fee,is_paid,syllabus,category_id")
      .eq("type", "mock")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setTests(((data ?? []) as unknown) as Test[]);
      });
  }, []);

  // Helper to categorize a test accurately based on category_id, category name, or title fallback
  const getTestCategoryInfo = (t: Test) => {
    const catName = t.category_id ? categoriesMap[t.category_id] || "" : "";
    const title = t.title || "";
    const lowerTitle = title.toLowerCase();
    const lowerCat = catName.toLowerCase();

    const isClass11 = lowerCat.includes("class 11") || lowerTitle.includes("class 11") || lowerTitle.includes("class 11th");
    const isClass12 = lowerCat.includes("class 12") || lowerTitle.includes("class 12") || lowerTitle.includes("class 12th");
    const isPart = lowerCat.includes("part") || lowerTitle.includes("part");
    const isFull =
      (lowerCat === "full syllabus" || (!isClass11 && !isClass12 && !isPart)) &&
      (lowerCat.includes("full") || lowerTitle.includes("full") || lowerTitle.includes("mock") || t.total_questions >= 180);

    let displayTag = catName;
    if (!displayTag) {
      if (isClass11 && isPart) displayTag = "Class 11 Part";
      else if (isClass11 && !isPart) displayTag = "Class 11 Full";
      else if (isClass12 && isPart) displayTag = "Class 12 Part";
      else if (isClass12 && !isPart) displayTag = "Class 12 Full";
      else if (isFull) displayTag = "Full Syllabus";
      else displayTag = "Mock Test";
    }

    return {
      catName,
      displayTag,
      isClass11,
      isClass12,
      isPart,
      isFull,
    };
  };

  // Pre-calculate counts for each filter chip
  const counts = useMemo(() => {
    if (!tests) return { all: 0, full: 0, class_11: 0, class_12: 0, part: 0 };
    let full = 0;
    let class_11 = 0;
    let class_12 = 0;
    let part = 0;

    tests.forEach((t) => {
      const info = getTestCategoryInfo(t);
      if (info.isFull) full++;
      if (info.isClass11) class_11++;
      if (info.isClass12) class_12++;
      if (info.isPart) part++;
    });

    return {
      all: tests.length,
      full,
      class_11,
      class_12,
      part,
    };
  }, [tests, categoriesMap]);

  const filterChips = useMemo(() => {
    return [
      { id: "all", label: "All Tests", count: counts.all },
      { id: "full", label: "Full Test", count: counts.full },
      { id: "class_11", label: "Class 11th", count: counts.class_11 },
      { id: "class_12", label: "Class 12th", count: counts.class_12 },
      { id: "part", label: "Part Test", count: counts.part },
    ];
  }, [counts]);

  const filteredTests = useMemo(() => {
    if (!tests) return [];
    if (category === "all") return tests;

    return tests.filter((t) => {
      const info = getTestCategoryInfo(t);
      if (category === "full") return info.isFull;
      if (category === "class_11") return info.isClass11;
      if (category === "class_12") return info.isClass12;
      if (category === "part") return info.isPart;
      return true;
    });
  }, [tests, category, categoriesMap]);

  return (
    <PageShell
      eyebrow="Practice"
      title="Mock tests"
      description={`Full-length NEET-pattern tests. First mock is FREE — every later mock costs ${MOCK_COST_BONUS} bonus coins.`}
    >
      {tests === null ? (
        <div className="flex h-48 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : tests.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            No mocks published yet.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {/* Pricing notice */}
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="flex items-center gap-3 p-4 text-xs sm:text-sm">
              <Gift className="h-4 w-4 shrink-0 text-primary" />
              <div className="min-w-0">
                <span className="font-semibold">Your first mock is free.</span>{" "}
                Every additional mock attempt costs <span className="font-bold">{MOCK_COST_BONUS} bonus coins</span>.
                Need more bonus?{" "}
                <Link to="/bonus" className="font-semibold text-primary underline">
                  Earn Bonus
                </Link>
                .
              </div>
            </CardContent>
          </Card>

          {/* Category Filter Chips */}
          <section aria-label="Filter mock tests by category">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Categories</h2>
              <span className="text-xs text-muted-foreground">Showing {filteredTests.length} tests</span>
            </div>
            <div
              className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-2"
              role="group"
              aria-label="Mock test categories"
            >
              {filterChips.map((item) => {
                const selected = category === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setCategory(item.id)}
                    aria-pressed={selected}
                    className={`inline-flex shrink-0 snap-start items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-all ${
                      selected
                        ? "border-primary bg-primary text-primary-foreground shadow-sm"
                        : "border-border bg-card text-muted-foreground hover:border-border/80 hover:bg-accent hover:text-foreground"
                    }`}
                  >
                    <span>{item.label}</span>
                    <span
                      className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-bold leading-none ${
                        selected
                          ? "bg-primary-foreground/20 text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {item.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Mocks Grid */}
          <section>
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted-foreground">
              {category === "all"
                ? `All mock tests (${filteredTests.length})`
                : category === "full"
                ? `Full Syllabus Tests (${filteredTests.length})`
                : category === "class_11"
                ? `Class 11th Tests (${filteredTests.length})`
                : category === "class_12"
                ? `Class 12th Tests (${filteredTests.length})`
                : `Part Tests (${filteredTests.length})`}
            </h2>
            {filteredTests.length ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {filteredTests.map((t) => (
                  <MockCard key={t.id} t={t} categoryTag={getTestCategoryInfo(t).displayTag} />
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="p-8 text-center text-sm text-muted-foreground">
                  No mock tests in this category yet.
                </CardContent>
              </Card>
            )}
          </section>
        </div>
      )}
    </PageShell>
  );
}

function MockCard({ t, categoryTag }: { t: Test; categoryTag: string }) {
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
    <Card className="hover-lift border-border/70 transition-all hover:border-primary/40 hover:shadow-md">
      <CardContent className="space-y-3 p-5">
        <div className="flex flex-wrap items-center gap-1.5">
          {categoryTag && (
            <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary font-medium text-[11px]">
              <Layers className="mr-1 h-3 w-3" />
              {categoryTag}
            </Badge>
          )}
          <Badge variant="outline" className="capitalize text-[11px]">
            {t.difficulty}
          </Badge>
          <Badge variant="secondary" className="text-[11px]">
            {t.source}
          </Badge>
          {t.is_paid ? (
            <Badge className="bg-gradient-accent text-[11px]">₹{t.entry_fee}</Badge>
          ) : (
            <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-medium text-[11px]">
              Free
            </Badge>
          )}
        </div>

        <div className="text-base font-semibold leading-tight text-foreground">{t.title}</div>
        {t.description && <p className="line-clamp-2 text-xs text-muted-foreground">{t.description}</p>}

        <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1">
          <span className="inline-flex items-center gap-1">
            <FileText className="h-3.5 w-3.5 text-primary" />
            <strong className="font-semibold text-foreground">{t.total_questions}</strong> Qs
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3.5 w-3.5 text-primary" />
            <strong className="font-semibold text-foreground">{t.duration_min}</strong> min
          </span>
        </div>

        {syl.length > 0 && (
          <Collapsible open={open} onOpenChange={setOpen}>
            <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md border bg-secondary/40 px-2.5 py-1.5 text-xs font-medium hover:bg-secondary transition-colors">
              <span className="inline-flex items-center gap-1.5">
                <BookOpen className="h-3.5 w-3.5 text-primary" /> Syllabus (
                {syl.reduce((n, s) => n + s.chapters.length, 0)} chapters)
              </span>
              <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 space-y-2 rounded-md border bg-card p-2.5 text-xs">
              {syl.map((s) => (
                <div key={s.subjectId}>
                  <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                    {s.subjectName}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {s.chapters.map((c) => (
                      <Badge key={c.id} variant="outline" className="font-normal text-[10px]">
                        {c.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </CollapsibleContent>
          </Collapsible>
        )}

        <Button onClick={handleStart} disabled={starting} className="w-full bg-gradient-primary font-medium">
          {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Start Mock CBT"}
        </Button>
      </CardContent>
    </Card>
  );
}
