import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { PageShell } from "@/components/page-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2, Gift, Search, CheckSquare, Square, Sliders, Clock, BookOpen, Layers } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { createCustomTestWithBonus } from "@/lib/generate-test.functions";
import { FeatureLock } from "@/components/feature-lock";

export const Route = createFileRoute("/generate")({
  head: () => ({ meta: [{ title: "Custom Test — NEET Track" }] }),
  component: () => (
    <FeatureLock feature="generate_test">
      <GeneratePage />
    </FeatureLock>
  ),
});

type Subject = { id: string; name: string };
type Chapter = { id: string; name: string; subject_id: string };

const MAX_QUESTIONS_LIMIT = 180;
const BONUS_COST = 5;

function GeneratePage() {
  const { user, profile, loading, refresh } = useAuth();
  const nav = useNavigate();
  const [step, setStep] = useState(1);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [allChapters, setAllChapters] = useState<Chapter[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>("all");
  const [chapIds, setChapIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  // Step 3 state
  const [count, setCount] = useState(45);
  const [difficulty, setDifficulty] = useState<"mix" | "easy" | "medium" | "hard">("mix");
  const [timer, setTimer] = useState(45);
  const [customTimerInput, setCustomTimerInput] = useState("");
  const [isPerChapterCount, setIsPerChapterCount] = useState(false);
  const [perChapterDistribution, setPerChapterDistribution] = useState<Record<string, number>>({});
  const [launching, setLaunching] = useState(false);

  const createTest = useServerFn(createCustomTestWithBonus);
  const bonus = Number(profile?.bonus_balance ?? 0);

  useEffect(() => {
    if (!loading && !user) nav({ to: "/login" });
  }, [user, loading, nav]);

  useEffect(() => {
    supabase
      .from("subjects")
      .select("id,name")
      .order("name")
      .then(({ data }) => setSubjects((data ?? []) as Subject[]));

    supabase
      .from("chapters")
      .select("id,name,subject_id")
      .order("name")
      .then(({ data }) => setAllChapters((data ?? []) as Chapter[]));
  }, []);

  const visibleChapters = useMemo(() => {
    let list = allChapters;
    if (selectedSubjectId !== "all") {
      list = list.filter((c) => c.subject_id === selectedSubjectId);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((c) => c.name.toLowerCase().includes(q));
    }
    return list;
  }, [allChapters, selectedSubjectId, searchQuery]);

  const toggleChap = (id: string) => {
    setChapIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const selectAllVisible = () => {
    const visibleIds = visibleChapters.map((c) => c.id);
    setChapIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
  };

  const deselectAllVisible = () => {
    const visibleSet = new Set(visibleChapters.map((c) => c.id));
    setChapIds((prev) => prev.filter((id) => !visibleSet.has(id)));
  };

  // Sync default per-chapter count when chapters or total count changes
  useEffect(() => {
    if (!chapIds.length) {
      setPerChapterDistribution({});
      return;
    }
    setPerChapterDistribution((prev) => {
      const updated: Record<string, number> = {};
      const avg = Math.max(1, Math.floor(count / chapIds.length));
      for (const id of chapIds) {
        updated[id] = prev[id] ?? avg;
      }
      return updated;
    });
  }, [chapIds]);

  const totalCalculatedQuestions = useMemo(() => {
    if (!isPerChapterCount) return Math.min(MAX_QUESTIONS_LIMIT, count);
    const sum = Object.values(perChapterDistribution).reduce((a, b) => a + (Number(b) || 0), 0);
    return Math.min(MAX_QUESTIONS_LIMIT, sum);
  }, [isPerChapterCount, count, perChapterDistribution]);

  const updateChapterCount = (chapId: string, val: number) => {
    const sanitized = Math.max(1, Math.min(MAX_QUESTIONS_LIMIT, val || 1));
    setPerChapterDistribution((prev) => ({
      ...prev,
      [chapId]: sanitized,
    }));
  };

  const applyUniformPerChapter = (num: number) => {
    const updated: Record<string, number> = {};
    for (const id of chapIds) {
      updated[id] = num;
    }
    setPerChapterDistribution(updated);
  };

  const start = async (mode: "quiz" | "exam") => {
    if (!user || !chapIds.length) return;
    if (bonus < BONUS_COST) {
      toast.error(`Need ${BONUS_COST} bonus to generate a test. You have ${bonus}.`);
      nav({ to: "/wallet" });
      return;
    }

    if (totalCalculatedQuestions > MAX_QUESTIONS_LIMIT) {
      toast.error(`Maximum question limit is ${MAX_QUESTIONS_LIMIT}. Currently: ${totalCalculatedQuestions}`);
      return;
    }

    if (totalCalculatedQuestions < 1) {
      toast.error("Please select at least 1 question.");
      return;
    }

    setLaunching(true);
    try {
      const subjName =
        selectedSubjectId === "all"
          ? "Full Syllabus"
          : subjects.find((s) => s.id === selectedSubjectId)?.name ?? "Custom";

      const { testId, totalQuestions } = await createTest({
        data: {
          chapter_ids: chapIds,
          subject_name: subjName,
          count: totalCalculatedQuestions,
          difficulty,
          duration_min: timer,
          chapter_distribution: isPerChapterCount ? perChapterDistribution : undefined,
        },
      });

      await refresh();
      toast.success(`-${BONUS_COST} bonus · Custom test ready with ${totalQuestions} questions`);
      nav({ to: "/quiz/$testId", params: { testId }, search: { mode } as never });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start test");
    } finally {
      setLaunching(false);
    }
  };

  return (
    <PageShell eyebrow="Builder" title="Custom Test" description="Build a custom practice test tailored to your syllabus & difficulty.">
      <div className="mb-4 flex items-center justify-between rounded-xl border border-amber-300/40 bg-amber-500/10 px-4 py-2.5 text-sm">
        <span className="inline-flex items-center gap-2 font-medium">
          <Gift className="h-4 w-4 text-amber-600" />
          Bonus balance: <span className="font-bold">{bonus}</span>
        </span>
        <span className="text-xs text-muted-foreground">Each test costs {BONUS_COST} bonus</span>
      </div>

      <Stepper step={step} />

      {/* STEP 1: SUBJECT SELECTION */}
      {step === 1 && (
        <div className="mt-6 space-y-4">
          <div className="text-sm font-medium text-muted-foreground">Select a subject or practice the full syllabus:</div>
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              onClick={() => {
                setSelectedSubjectId("all");
                setStep(2);
              }}
              className={cn(
                "flex items-center justify-between rounded-2xl border p-5 text-left transition hover:border-primary/40",
                selectedSubjectId === "all" ? "border-primary bg-primary/5 shadow-sm" : "border-border bg-card"
              )}
            >
              <div>
                <div className="flex items-center gap-2 text-base font-bold">
                  <Layers className="h-5 w-5 text-primary" />
                  All Subjects (Full Syllabus)
                </div>
                <div className="mt-1 text-xs text-muted-foreground">Physics, Chemistry & Biology ({allChapters.length} chapters)</div>
              </div>
            </button>

            {subjects.map((s) => {
              const countForSubj = allChapters.filter((c) => c.subject_id === s.id).length;
              return (
                <button
                  key={s.id}
                  onClick={() => {
                    setSelectedSubjectId(s.id);
                    setStep(2);
                  }}
                  className={cn(
                    "flex items-center justify-between rounded-2xl border p-5 text-left transition hover:border-primary/40",
                    selectedSubjectId === s.id ? "border-primary bg-primary/5 shadow-sm" : "border-border bg-card"
                  )}
                >
                  <div>
                    <div className="text-base font-bold">{s.name}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{countForSubj} chapters available</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* STEP 2: MULTIPLE CHAPTER SELECTOR */}
      {step === 2 && (
        <div className="mt-6 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-base font-bold">
                {selectedSubjectId === "all"
                  ? "All Subjects Chapters"
                  : `${subjects.find((s) => s.id === selectedSubjectId)?.name ?? ""} Chapters`}
              </div>
              <div className="text-xs text-muted-foreground">
                {chapIds.length} of {allChapters.length} total chapters selected
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={selectAllVisible} className="h-8 text-xs">
                <CheckSquare className="mr-1.5 h-3.5 w-3.5 text-primary" />
                Select All
              </Button>
              <Button size="sm" variant="ghost" onClick={deselectAllVisible} className="h-8 text-xs">
                <Square className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" />
                Deselect All
              </Button>
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search chapters by name..."
              className="pl-9 text-sm"
            />
          </div>

          <div className="max-h-[380px] space-y-2 overflow-y-auto pr-1">
            {visibleChapters.map((c) => {
              const selected = chapIds.includes(c.id);
              const subj = subjects.find((s) => s.id === c.subject_id);
              return (
                <button
                  key={c.id}
                  onClick={() => toggleChap(c.id)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-xl border p-3.5 text-left transition",
                    selected ? "border-primary bg-primary/5 font-medium shadow-xs" : "border-border bg-card hover:border-border/80"
                  )}
                >
                  <div className="flex items-center gap-2.5 pr-2">
                    <span
                      className={cn(
                        "flex h-5 w-5 shrink-0 items-center justify-center rounded border transition",
                        selected ? "border-primary bg-primary text-white" : "border-muted-foreground/30"
                      )}
                    >
                      {selected && "✓"}
                    </span>
                    <span className="text-sm">{c.name}</span>
                  </div>
                  {selectedSubjectId === "all" && subj && (
                    <span className="shrink-0 rounded-md bg-secondary px-2 py-0.5 text-[10px] font-semibold text-muted-foreground uppercase">
                      {subj.name}
                    </span>
                  )}
                </button>
              );
            })}
            {visibleChapters.length === 0 && (
              <div className="py-8 text-center text-sm text-muted-foreground">No chapters match your search.</div>
            )}
          </div>

          <div className="mt-4 flex gap-2">
            <Button variant="outline" onClick={() => setStep(1)}>
              Previous
            </Button>
            <Button
              className="flex-1 bg-gradient-primary font-semibold"
              onClick={() => setStep(3)}
              disabled={!chapIds.length}
            >
              Next: Configure Test ({chapIds.length} selected)
            </Button>
          </div>
        </div>
      )}

      {/* STEP 3: PREFERENCES & CUSTOM CONFIGURATION */}
      {step === 3 && (
        <div className="mt-6 space-y-6">
          {/* Difficulty */}
          <div>
            <div className="mb-2 text-sm font-bold">Difficulty</div>
            <div className="grid grid-cols-4 gap-2">
              {(["mix", "easy", "medium", "hard"] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => setDifficulty(d)}
                  className={cn(
                    "rounded-xl border p-3 text-sm font-semibold capitalize transition",
                    difficulty === d ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border bg-card"
                  )}
                >
                  {d === "mix" ? "Mix Qs." : d}
                </button>
              ))}
            </div>
          </div>

          {/* Question Count Section */}
          <div className="rounded-2xl border border-border bg-card p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-bold">Question Count</div>
                <div className="text-xs text-muted-foreground">Max question limit is {MAX_QUESTIONS_LIMIT} questions</div>
              </div>
              <div className="text-sm font-bold text-primary">
                Total: {totalCalculatedQuestions} / {MAX_QUESTIONS_LIMIT} Qs
              </div>
            </div>

            {/* Per-Chapter Selector Toggle */}
            <div className="flex items-center justify-between rounded-xl bg-secondary/50 p-3">
              <div className="flex items-center gap-2">
                <Sliders className="h-4 w-4 text-primary" />
                <div>
                  <Label htmlFor="per-chapter-switch" className="text-xs font-semibold cursor-pointer">
                    Custom question count per chapter
                  </Label>
                  <p className="text-[11px] text-muted-foreground">Customize exact questions for each chosen chapter</p>
                </div>
              </div>
              <Switch
                id="per-chapter-switch"
                checked={isPerChapterCount}
                onCheckedChange={setIsPerChapterCount}
              />
            </div>

            {!isPerChapterCount ? (
              <div className="space-y-3">
                <div className="grid grid-cols-5 gap-2">
                  {[10, 30, 45, 90, 180].map((n) => (
                    <button
                      key={n}
                      onClick={() => setCount(n)}
                      className={cn(
                        "rounded-xl border p-2.5 text-xs font-bold transition",
                        count === n ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border"
                      )}
                    >
                      {n} Qs
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-3">
                  <Label className="text-xs font-medium text-muted-foreground shrink-0">Custom Total Count:</Label>
                  <Input
                    type="number"
                    min={1}
                    max={MAX_QUESTIONS_LIMIT}
                    value={count}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      if (!isNaN(v)) setCount(Math.max(1, Math.min(MAX_QUESTIONS_LIMIT, v)));
                    }}
                    className="h-9 w-32 text-sm font-bold"
                  />
                  <span className="text-xs text-muted-foreground">(1 – {MAX_QUESTIONS_LIMIT})</span>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-muted-foreground">Quick set all chapters:</span>
                  <div className="flex gap-1.5">
                    {[2, 5, 10].map((preset) => (
                      <Button
                        key={preset}
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-[11px]"
                        onClick={() => applyUniformPerChapter(preset)}
                      >
                        {preset} each
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="max-h-[220px] space-y-2 overflow-y-auto pr-1 rounded-lg border border-border/50 p-2 bg-background/50">
                  {chapIds.map((cId) => {
                    const chapter = allChapters.find((c) => c.id === cId);
                    const currentVal = perChapterDistribution[cId] ?? 1;
                    return (
                      <div key={cId} className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-card px-3 py-2 text-xs">
                        <span className="truncate font-medium">{chapter?.name ?? `Chapter ${cId}`}</span>
                        <div className="flex items-center gap-2 shrink-0">
                          <Input
                            type="number"
                            min={1}
                            max={MAX_QUESTIONS_LIMIT}
                            value={currentVal}
                            onChange={(e) => updateChapterCount(cId, parseInt(e.target.value, 10))}
                            className="h-7 w-16 text-center text-xs font-bold"
                          />
                          <span className="text-[11px] text-muted-foreground">Qs</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Timer Section */}
          <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-sm font-bold">
                <Clock className="h-4 w-4 text-primary" />
                Custom Timer
              </div>
              <span className="text-sm font-bold text-primary">{timer} minutes</span>
            </div>

            <div className="grid grid-cols-6 gap-2">
              {[15, 30, 45, 60, 90, 180, 200].map((t) => (
                <button
                  key={t}
                  onClick={() => {
                    setTimer(t);
                    setCustomTimerInput("");
                  }}
                  className={cn(
                    "rounded-xl border p-2 text-xs font-bold transition",
                    timer === t && !customTimerInput ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border"
                  )}
                >
                  {t}m
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3 pt-1">
              <Label className="text-xs font-medium text-muted-foreground shrink-0">Custom Minutes:</Label>
              <Input
                type="number"
                min={5}
                max={360}
                placeholder="e.g. 120"
                value={customTimerInput}
                onChange={(e) => {
                  setCustomTimerInput(e.target.value);
                  const v = parseInt(e.target.value, 10);
                  if (!isNaN(v) && v > 0) setTimer(Math.min(360, Math.max(5, v)));
                }}
                className="h-9 w-32 text-sm font-bold"
              />
              <span className="text-xs text-muted-foreground">(5 – 360 mins)</span>
            </div>
          </div>

          {/* Mode Selection */}
          <div>
            <div className="mb-2 text-sm font-bold">Mode</div>
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                size="lg"
                disabled={launching}
                onClick={() => start("quiz")}
                className="h-auto flex-col items-start gap-1 p-4"
              >
                <span className="font-bold">Quiz Mode</span>
                <span className="text-xs font-normal text-muted-foreground">Review answers instantly after each question</span>
              </Button>
              <Button
                size="lg"
                disabled={launching}
                onClick={() => start("exam")}
                className="h-auto flex-col items-start gap-1 bg-gradient-primary p-4"
              >
                <span className="font-bold">Exam Mode</span>
                <span className="text-xs font-normal opacity-90">Simulate real NEET exam with final submission</span>
              </Button>
            </div>
            {launching && (
              <div className="mt-3 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin text-primary" /> Building your custom test ({totalCalculatedQuestions} questions)...
              </div>
            )}
          </div>

          <Button variant="outline" onClick={() => setStep(2)}>
            Previous
          </Button>
        </div>
      )}
    </PageShell>
  );
}

function Stepper({ step }: { step: number }) {
  const labels = ["Subject", "Chapters", "Configuration"];
  return (
    <div className="flex items-center gap-2">
      {labels.map((l, i) => (
        <div key={l} className="flex flex-1 items-center gap-2">
          <span
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold",
              step > i + 1
                ? "bg-emerald-500 text-white"
                : step === i + 1
                ? "bg-foreground text-background"
                : "bg-secondary text-muted-foreground"
            )}
          >
            {step > i + 1 ? "✓" : i + 1}
          </span>
          <span className={cn("text-sm font-semibold", step === i + 1 ? "text-foreground" : "text-muted-foreground")}>
            {l}
          </span>
          {i < 2 && <span className="h-px flex-1 bg-border" />}
        </div>
      ))}
    </div>
  );
}
