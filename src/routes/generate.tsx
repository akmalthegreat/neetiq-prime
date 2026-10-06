import { DrAkzaLoader } from "@/components/dr-akza-loader";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Monitor, Check, Plus, Minus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/generate")({
  head: () => ({
    meta: [
      { title: "Generate Test & CBT — NEET Track" },
      { name: "description", content: "Create a custom multi-subject NEET practice quiz or timed CBT exam with custom questions per subject and timer." },
      { property: "og:title", content: "Generate Test & CBT — NEET Track" },
      { property: "og:description", content: "Create a custom multi-subject NEET practice quiz or timed CBT exam." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GeneratePage,
});

type Subject = { id: string; name: string };
type Chapter = { id: string; name: string; subject_id: string };

function GeneratePage() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [step, setStep] = useState(1);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [chapIds, setChapIds] = useState<string[]>([]);
  const [difficulty, setDifficulty] = useState<"mix" | "easy" | "medium" | "hard">("mix");
  
  // Custom questions per subject map (subject_id -> count)
  const [perSubjectCounts, setPerSubjectCounts] = useState<Record<string, number>>({});
  
  // Timer in minutes
  const [timer, setTimer] = useState(15);
  const [customTimerInput, setCustomTimerInput] = useState<string>("15");

  const [launching, setLaunching] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) nav({ to: "/login" });
  }, [user, loading, nav]);

  // Load available subjects
  useEffect(() => {
    if (loading || !user) return;
    let active = true;
    supabase
      .from("subjects")
      .select("id,name")
      .order("name")
      .then(({ data, error }) => {
        if (!active) return;
        const list = (data ?? []) as Subject[];
        setSubjects(list);
        if (list.length > 0 && selectedSubjectIds.length === 0) {
          // Pre-select first subject by default
          setSelectedSubjectIds([list[0].id]);
        }
        setCatalogError(error ? "Subjects could not load. Please refresh and try again." : null);
        setCatalogLoading(false);
      });
    return () => {
      active = false;
    };
  }, [loading, user]);

  // Load chapters whenever selectedSubjectIds changes
  useEffect(() => {
    if (!selectedSubjectIds.length) {
      setChapters([]);
      setChapIds([]);
      return;
    }
    let active = true;
    setCatalogLoading(true);
    setCatalogError(null);
    supabase
      .from("chapters")
      .select("id,name,subject_id")
      .in("subject_id", selectedSubjectIds)
      .order("order_index")
      .then(({ data, error }) => {
        if (!active) return;
        const chs = (data ?? []) as Chapter[];
        setChapters(chs);
        // Retain only valid chapter IDs that belong to currently selected subjects
        setChapIds((prev) => prev.filter((id) => chs.some((c) => c.id === id)));
        setCatalogError(error ? "Chapters could not load. Please try again." : null);
        setCatalogLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selectedSubjectIds]);

  // Keep per-subject counts in sync with selected subjects
  useEffect(() => {
    setPerSubjectCounts((prev) => {
      const updated: Record<string, number> = {};
      for (const sid of selectedSubjectIds) {
        updated[sid] = prev[sid] ?? 15;
      }
      return updated;
    });
  }, [selectedSubjectIds]);

  const toggleSubject = (id: string) => {
    setSelectedSubjectIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const selectAllSubjects = () => {
    if (selectedSubjectIds.length === subjects.length) {
      setSelectedSubjectIds([]);
    } else {
      setSelectedSubjectIds(subjects.map((s) => s.id));
    }
  };

  const toggleChap = (id: string) => {
    setChapIds((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  };

  const selectAllChaptersForSubject = (subjId: string) => {
    const subjChaps = chapters.filter((c) => c.subject_id === subjId).map((c) => c.id);
    const allSelected = subjChaps.every((cid) => chapIds.includes(cid));
    if (allSelected) {
      setChapIds((prev) => prev.filter((cid) => !subjChaps.includes(cid)));
    } else {
      setChapIds((prev) => Array.from(new Set([...prev, ...subjChaps])));
    }
  };

  const selectAllChapters = () => {
    if (chapIds.length === chapters.length) {
      setChapIds([]);
    } else {
      setChapIds(chapters.map((c) => c.id));
    }
  };

  const updateSubjectCount = (sid: string, delta: number) => {
    setPerSubjectCounts((prev) => {
      const current = prev[sid] ?? 15;
      const next = Math.max(1, Math.min(100, current + delta));
      return { ...prev, [sid]: next };
    });
  };

  const setAllSubjectCounts = (val: number) => {
    setPerSubjectCounts((prev) => {
      const updated: Record<string, number> = {};
      for (const sid of selectedSubjectIds) {
        updated[sid] = val;
      }
      return updated;
    });
  };

  const totalQuestions = useMemo(() => {
    return selectedSubjectIds.reduce((sum, sid) => sum + (perSubjectCounts[sid] ?? 15), 0);
  }, [selectedSubjectIds, perSubjectCounts]);

  const handleCustomTimerChange = (valStr: string) => {
    setCustomTimerInput(valStr);
    const n = parseInt(valStr, 10);
    if (!isNaN(n) && n > 0) {
      setTimer(n);
    }
  };

  const start = async (mode: "quiz" | "exam") => {
    if (!user || !chapIds.length || launching) return;
    setLaunching(true);
    try {
      const cap = difficulty === "mix" ? null : difficulty.charAt(0).toUpperCase() + difficulty.slice(1);
      const allSelectedIds: string[] = [];

      // Query questions per selected subject according to custom question counts
      for (const sid of selectedSubjectIds) {
        const targetCount = perSubjectCounts[sid] ?? 15;
        const subjChapIds = chapters.filter((c) => c.subject_id === sid && chapIds.includes(c.id)).map((c) => c.id);
        if (!subjChapIds.length) continue;

        let query = supabase.from("questions").select("id").in("chapter_id", subjChapIds);
        if (cap) query = query.eq("difficulty", cap);
        const { data: rows, error: qErr } = await query.limit(targetCount * 3);
        if (qErr) throw new Error(qErr.message);

        let ids = (rows ?? []).map((r) => r.id);
        if (ids.length < targetCount) {
          const { data: fb } = await supabase.from("questions").select("id").in("chapter_id", subjChapIds).limit(targetCount);
          ids = Array.from(new Set([...ids, ...(fb ?? []).map((r) => r.id)]));
        }

        // Shuffle subject questions
        for (let i = ids.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [ids[i], ids[j]] = [ids[j], ids[i]];
        }
        allSelectedIds.push(...ids.slice(0, targetCount));
      }

      if (!allSelectedIds.length) {
        throw new Error("No questions match the selected filters. Please select other chapters or difficulty.");
      }

      // Final shuffle
      for (let i = allSelectedIds.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allSelectedIds[i], allSelectedIds[j]] = [allSelectedIds[j], allSelectedIds[i]];
      }

      const subjNames = subjects.filter((s) => selectedSubjectIds.includes(s.id)).map((s) => s.name).join(" + ");
      const title = `${subjNames || "Custom"} Test (${allSelectedIds.length} Qs)`;

      const { data: t, error: tErr } = await supabase
        .from("tests")
        .insert({
          title,
          type: "custom",
          difficulty: difficulty === "mix" ? "mix" : cap!,
          duration_min: timer,
          total_questions: allSelectedIds.length,
          question_ids: allSelectedIds,
          created_by: user.id,
          source: "NCERT",
          marks_correct: 4,
          marks_wrong: -1,
        })
        .select("id")
        .maybeSingle();

      if (tErr || !t) throw new Error(tErr?.message ?? "Could not create test");
      toast.success("Test ready!");
      await nav({ to: "/quiz/$testId", params: { testId: t.id }, search: { mode } as never });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start test");
    } finally {
      setLaunching(false);
    }
  };

  return (
    <PageShell eyebrow="Builder" title="Generate Test" description="Build a custom multi-subject NEET test step-by-step.">
      <Stepper step={step} />

      {catalogLoading && step < 3 && (
        <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-primary" /> Loading subjects and chapters...
        </div>
      )}

      {catalogError && <p role="alert" className="mt-4 text-sm text-destructive">{catalogError}</p>}

      {!catalogLoading && !catalogError && step === 1 && !subjects.length && (
        <p className="mt-4 text-sm text-muted-foreground">No subjects available yet.</p>
      )}

      {/* STEP 1: Multiple Subject Selector */}
      {step === 1 && (
        <div className="mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">
              {selectedSubjectIds.length} of {subjects.length} subjects selected
            </span>
            <Button variant="ghost" size="sm" onClick={selectAllSubjects}>
              {selectedSubjectIds.length === subjects.length ? "Deselect All" : "Select All"}
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {subjects.map((s) => {
              const isSelected = selectedSubjectIds.includes(s.id);
              return (
                <div
                  key={s.id}
                  onClick={() => toggleSubject(s.id)}
                  className={cn(
                    "flex cursor-pointer items-center justify-between rounded-xl border p-5 transition-all hover:border-primary/50 hover:shadow-sm",
                    isSelected ? "border-primary bg-primary/5 shadow-xs" : "border-border bg-card"
                  )}
                >
                  <div>
                    <div className="text-base font-bold text-foreground">{s.name}</div>
                    <div className="text-xs text-muted-foreground">NEET syllabus</div>
                  </div>
                  <span
                    className={cn(
                      "flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border-2 transition",
                      isSelected ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background"
                    )}
                  >
                    {isSelected && <Check className="h-4 w-4" />}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="mt-6 flex justify-end">
            <Button
              className="bg-gradient-primary px-8"
              onClick={() => setStep(2)}
              disabled={!selectedSubjectIds.length}
            >
              Next: Select Chapters ({selectedSubjectIds.length} chosen)
            </Button>
          </div>
        </div>
      )}

      {/* STEP 2: Chapters Selector for Selected Subjects */}
      {step === 2 && (
        <div className="mt-6 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
            <div className="text-sm font-medium text-muted-foreground">
              <span className="font-bold text-foreground">{chapIds.length}</span> chapters selected across{" "}
              {selectedSubjectIds.length} subjects
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={selectAllChapters}>
                {chapIds.length === chapters.length ? "Deselect All" : "Select All"}
              </Button>
            </div>
          </div>

          {selectedSubjectIds.map((sid) => {
            const subj = subjects.find((s) => s.id === sid);
            const subjChapters = chapters.filter((c) => c.subject_id === sid);
            const selectedInSubj = subjChapters.filter((c) => chapIds.includes(c.id)).length;

            return (
              <div key={sid} className="rounded-xl border border-border bg-card/60 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-base font-bold text-foreground">{subj?.name ?? sid}</span>
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                      {selectedInSubj} / {subjChapters.length}
                    </span>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => selectAllChaptersForSubject(sid)} className="text-xs">
                    {selectedInSubj === subjChapters.length ? "Clear" : "Select all in " + (subj?.name ?? sid)}
                  </Button>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  {subjChapters.map((c) => {
                    const isSelected = chapIds.includes(c.id);
                    return (
                      <button
                        type="button"
                        key={c.id}
                        onClick={() => toggleChap(c.id)}
                        className={cn(
                          "flex items-center justify-between rounded-lg border p-3 text-left transition hover:border-primary/40",
                          isSelected ? "border-primary bg-primary/5" : "border-border/80 bg-background"
                        )}
                      >
                        <span className="text-sm font-medium text-foreground">{c.name}</span>
                        <span
                          className={cn(
                            "flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition",
                            isSelected ? "border-primary bg-primary text-primary-foreground" : "border-border"
                          )}
                        >
                          {isSelected && <Check className="h-3.5 w-3.5" />}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={() => setStep(1)}>
              ← Back to Subjects
            </Button>
            <Button
              className="flex-1 bg-gradient-primary"
              onClick={() => setStep(3)}
              disabled={!chapIds.length}
            >
              Next: Test Preferences ({chapIds.length} chapters)
            </Button>
          </div>
        </div>
      )}

      {/* STEP 3: Test Preferences (Custom Questions per Subject & Timer) */}
      {step === 3 && (
        <div className="mt-6 space-y-6">
          {/* Difficulty */}
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="mb-3 text-sm font-bold text-foreground">Difficulty Level</div>
            <div className="grid grid-cols-4 gap-2">
              {(["mix", "easy", "medium", "hard"] as const).map((d) => (
                <Button
                  variant="outline"
                  key={d}
                  onClick={() => setDifficulty(d)}
                  className={cn(
                    "h-auto rounded-lg border p-3 text-sm font-semibold capitalize transition",
                    difficulty === d ? "border-primary bg-primary/10 text-primary font-bold shadow-xs" : "border-border"
                  )}
                >
                  {d === "mix" ? "Mix Qs." : d}
                </Button>
              ))}
            </div>
          </div>

          {/* Custom Question Count per Subject */}
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="mb-2 flex items-center justify-between">
              <div>
                <div className="text-sm font-bold text-foreground">Questions per Subject</div>
                <div className="text-xs text-muted-foreground">Adjust the number of questions for each selected subject</div>
              </div>
              <div className="text-right">
                <span className="text-xs text-muted-foreground">Total Questions</span>
                <div className="text-xl font-black text-primary">{totalQuestions} Qs</div>
              </div>
            </div>

            {/* Quick batch presets */}
            <div className="mb-4 flex flex-wrap items-center gap-2 pt-2">
              <span className="text-xs font-medium text-muted-foreground">Quick set all:</span>
              {[10, 15, 25, 35, 45].map((val) => (
                <Button
                  key={val}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setAllSubjectCounts(val)}
                  className="h-7 text-xs"
                >
                  {val} each
                </Button>
              ))}
            </div>

            {/* Per-subject sliders / number steppers */}
            <div className="space-y-3">
              {selectedSubjectIds.map((sid) => {
                const subj = subjects.find((s) => s.id === sid);
                const countVal = perSubjectCounts[sid] ?? 15;

                return (
                  <div
                    key={sid}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-border/80 bg-secondary/30 p-3.5"
                  >
                    <div>
                      <div className="font-semibold text-foreground">{subj?.name ?? sid}</div>
                      <div className="text-xs text-muted-foreground">
                        {chapters.filter((c) => c.subject_id === sid && chapIds.includes(c.id)).length} chapters chosen
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 rounded-lg"
                        onClick={() => updateSubjectCount(sid, -5)}
                        disabled={countVal <= 5}
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </Button>

                      <div className="flex items-center gap-1.5">
                        <Input
                          type="number"
                          min={1}
                          max={100}
                          value={countVal}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10);
                            if (!isNaN(val)) {
                              setPerSubjectCounts((prev) => ({
                                ...prev,
                                [sid]: Math.max(1, Math.min(100, val)),
                              }));
                            }
                          }}
                          className="h-9 w-16 text-center font-bold"
                        />
                        <span className="text-xs text-muted-foreground">Qs</span>
                      </div>

                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 rounded-lg"
                        onClick={() => updateSubjectCount(sid, 5)}
                        disabled={countVal >= 100}
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Custom Timer */}
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="mb-2 flex items-center justify-between">
              <div>
                <div className="text-sm font-bold text-foreground">Exam Timer</div>
                <div className="text-xs text-muted-foreground">Select a preset or enter your custom duration in minutes</div>
              </div>
              <div className="text-right">
                <span className="text-xs text-muted-foreground">Selected Duration</span>
                <div className="text-xl font-black text-primary">{timer} mins</div>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-4 sm:grid-cols-7 gap-2">
              {[10, 15, 30, 45, 60, 90, 180].map((t) => (
                <Button
                  variant="outline"
                  key={t}
                  onClick={() => {
                    setTimer(t);
                    setCustomTimerInput(t.toString());
                  }}
                  className={cn(
                    "h-auto rounded-lg border p-2.5 text-xs sm:text-sm font-semibold transition",
                    timer === t ? "border-primary bg-primary/10 text-primary font-bold shadow-xs" : "border-border"
                  )}
                >
                  {t >= 60 ? `${t / 60}h` : `${t}m`}
                </Button>
              ))}
            </div>

            <div className="mt-4 flex items-center gap-3">
              <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap">Or Custom Timer:</span>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  max={300}
                  value={customTimerInput}
                  onChange={(e) => handleCustomTimerChange(e.target.value)}
                  placeholder="Minutes"
                  className="h-9 w-24 text-center font-bold"
                />
                <span className="text-xs text-muted-foreground">Minutes</span>
              </div>
            </div>
          </div>

          {/* Mode Selection & Launch */}
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="mb-3 text-sm font-bold text-foreground">Choose Mode to Start</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Button
                variant="outline"
                size="lg"
                disabled={launching}
                onClick={() => start("quiz")}
                className="h-auto flex-col items-start gap-1 rounded-xl border-border/80 p-4 hover:border-primary/50"
              >
                <span className="font-bold text-foreground">Practice Quiz Mode</span>
                <span className="text-xs font-normal text-muted-foreground">
                  Check answers immediately with instant explanations
                </span>
              </Button>
              <Button
                size="lg"
                disabled={launching}
                onClick={() => start("exam")}
                className="h-auto flex-col items-start gap-1 rounded-xl bg-gradient-primary p-4 shadow-md shadow-primary/20 hover:opacity-95"
              >
                <span className="flex items-center gap-2 font-bold text-primary-foreground">
                  <Monitor className="h-4 w-4" /> Timed CBT Exam Mode
                </span>
                <span className="text-xs font-normal text-primary-foreground/90">
                  Real NTA NEET exam interface, timer, and detailed result analysis
                </span>
              </Button>
            </div>

            {launching && (
          <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
            <DrAkzaLoader
              size="sm"
              message="Dr. Azka is generating test questions..."
              subMessage={`Crafting your ${totalQuestions}-question customized test`}
            />
          </div>
        )}
          </div>

          <Button variant="outline" onClick={() => setStep(2)}>
            ← Back to Chapters
          </Button>
        </div>
      )}
    </PageShell>
  );
}

function Stepper({ step }: { step: number }) {
  const labels = ["Subjects", "Chapters", "Custom Preferences"];
  return (
    <div className="flex items-center gap-2">
      {labels.map((l, i) => (
        <div key={l} className="flex flex-1 items-center gap-2">
          <span
            className={cn(
              "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
              step > i + 1
                ? "bg-emerald-500 text-white"
                : step === i + 1
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground"
            )}
          >
            {step > i + 1 ? "✓" : i + 1}
          </span>
          <span className={cn("text-xs sm:text-sm font-semibold", step === i + 1 ? "text-foreground" : "text-muted-foreground")}>
            {l}
          </span>
          {i < 2 && <span className="h-px flex-1 bg-border" />}
        </div>
      ))}
    </div>
  );
}
