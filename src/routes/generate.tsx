import { locked } from "@/components/feature-lock";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Loader2, Monitor, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { createCustomTest } from "@/lib/generate-test.functions";

export const Route = createFileRoute("/generate")({
  head: () => ({ meta: [
    { title: "Generate Test & CBT — NEETIQ Prime" },
    { name: "description", content: "Create a chapter-based NEET practice quiz or timed CBT exam with your preferred difficulty." },
    { property: "og:title", content: "Generate Test & CBT — NEETIQ Prime" },
    { property: "og:description", content: "Create a chapter-based NEET practice quiz or timed CBT exam." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: locked("generate_test", GeneratePage),
});

type Subject = { id: string; name: string };
type Chapter = { id: string; name: string; subject_id: string };

function GeneratePage() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [step, setStep] = useState(1);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [subjectId, setSubjectId] = useState<string>("");
  const [chapIds, setChapIds] = useState<string[]>([]);
  const [count, setCount] = useState(10);
  const [difficulty, setDifficulty] = useState<"mix" | "easy" | "medium" | "hard">("mix");
  const [timer, setTimer] = useState(15);
  const [launching, setLaunching] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  const createTest = useServerFn(createCustomTest);

  useEffect(() => { if (!loading && !user) nav({ to: "/login" }); }, [user, loading, nav]);
  useEffect(() => {
    if (loading || !user) return;
    let active = true;
    supabase.from("subjects").select("id,name").order("name").then(({ data, error }) => {
      if (!active) return;
      setSubjects((data ?? []) as Subject[]);
      setCatalogError(error ? "Subjects could not load. Please refresh and try again." : null);
      setCatalogLoading(false);
    });
    return () => { active = false; };
  }, [loading, user]);
  useEffect(() => {
    if (!subjectId) return setChapters([]);
    let active = true;
    setChapters([]);
    setCatalogLoading(true);
    setCatalogError(null);
    supabase.from("chapters").select("id,name,subject_id").eq("subject_id", subjectId).order("order_index").then(({ data, error }) => {
      if (!active) return;
      setChapters((data ?? []) as Chapter[]);
      setCatalogError(error ? "Chapters could not load. Please choose the subject again." : null);
      setCatalogLoading(false);
    });
    return () => { active = false; };
  }, [subjectId]);

  const toggleChap = (id: string) => setChapIds((s) => s.includes(id) ? s.filter((x) => x !== id) : s.length < 20 ? [...s, id] : s);

  const start = async (mode: "quiz" | "exam") => {
    if (!user || !chapIds.length || launching) return;
    setLaunching(true);
    try {
      const subjName = subjects.find((s) => s.id === subjectId)?.name ?? "Custom";
      const { testId, totalQuestions } = await createTest({
        data: {
          chapter_ids: chapIds,
          subject_name: subjName,
          count,
          difficulty,
          duration_min: timer,
        },
      });
      toast.success(totalQuestions < count ? `Test ready with ${totalQuestions} available questions` : "Test ready");
      await nav({ to: "/quiz/$testId", params: { testId }, search: { mode } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start");
    } finally {
      setLaunching(false);
    }
  };

  return (
    <PageShell eyebrow="Builder" title="Generate Test" description="Build a custom test step-by-step.">
      <Stepper step={step} />
      {catalogLoading && step < 3 && <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading...</div>}
      {catalogError && <p role="alert" className="mt-4 text-sm text-destructive">{catalogError}</p>}
      {!catalogLoading && !catalogError && step === 1 && !subjects.length && <p className="mt-4 text-sm text-muted-foreground">No subjects available yet.</p>}
      {!catalogLoading && !catalogError && step === 2 && !chapters.length && <p className="mt-4 text-sm text-muted-foreground">No chapters available for this subject.</p>}
      {step === 1 && (
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {subjects.map((s) => (
            <Button variant="outline" key={s.id} onClick={() => { setSubjectId(s.id); setChapIds([]); setStep(2); }} className={cn("h-auto justify-start rounded-lg p-5 text-left transition hover:border-primary/40", subjectId === s.id ? "border-primary bg-primary/5" : "border-border bg-card")}>
              <div className="text-base font-semibold">{s.name}</div>
            </Button>
          ))}
        </div>
      )}
      {step === 2 && (
        <div className="mt-6 space-y-2">
          <div className="mb-2 text-sm text-muted-foreground">{chapIds.length} / {chapters.length} selected</div>
          {chapters.map((c) => (
            <Button variant="outline" aria-pressed={chapIds.includes(c.id)} disabled={!chapIds.includes(c.id) && chapIds.length >= 20} key={c.id} onClick={() => toggleChap(c.id)} className={cn("h-auto w-full justify-between whitespace-normal rounded-lg p-4 text-left transition", chapIds.includes(c.id) ? "border-primary bg-primary/5" : "border-border bg-card")}>
              <span className="text-sm font-medium">{c.name}</span>
              <span className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded border-2", chapIds.includes(c.id) ? "border-primary bg-primary text-primary-foreground" : "border-border")}>{chapIds.includes(c.id) && <Check className="h-4 w-4" />}</span>
            </Button>
          ))}
          <div className="mt-4 flex gap-2">
            <Button variant="outline" onClick={() => setStep(1)}>Previous</Button>
            <Button className="flex-1 bg-gradient-primary" onClick={() => setStep(3)} disabled={!chapIds.length}>Next</Button>
          </div>
        </div>
      )}
      {step === 3 && (
        <div className="mt-6 space-y-6">
          <div>
            <div className="mb-2 text-sm font-bold">Difficulty</div>
            <div className="grid grid-cols-4 gap-2">
              {(["mix", "easy", "medium", "hard"] as const).map((d) => (
                <Button variant="outline" aria-pressed={difficulty === d} key={d} onClick={() => setDifficulty(d)} className={cn("h-auto rounded-lg border p-3 text-sm font-semibold capitalize", difficulty === d ? "border-primary bg-primary/5" : "border-border")}>{d === "mix" ? "Mix Qs." : d}</Button>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-2 text-sm font-bold">Number of Questions</div>
            <div className="grid grid-cols-4 gap-2">
              {[10, 20, 30, 50].map((n) => (
                <Button variant="outline" aria-pressed={count === n} key={n} onClick={() => setCount(n)} className={cn("h-auto rounded-lg border p-3 text-sm font-semibold", count === n ? "border-primary bg-primary/5" : "border-border")}>{n} Qs.</Button>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-2 text-sm font-bold">Timer (minutes)</div>
            <div className="grid grid-cols-4 gap-2">
              {[10, 15, 30, 60].map((n) => (
                <Button variant="outline" aria-pressed={timer === n} key={n} onClick={() => setTimer(n)} className={cn("h-auto rounded-lg border p-3 text-sm font-semibold", timer === n ? "border-primary bg-primary/5" : "border-border")}>{n} min</Button>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-2 text-sm font-bold">Mode</div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="lg" disabled={launching} onClick={() => start("quiz")} className="h-auto flex-col items-start gap-1 p-4">
                <span className="font-bold">Quiz Mode</span>
                <span className="text-xs font-normal text-muted-foreground">Review answer within the session</span>
              </Button>
              <Button size="lg" disabled={launching} onClick={() => start("exam")} className="h-auto flex-col items-start gap-1 bg-gradient-primary p-4">
                <span className="flex items-center gap-2 font-bold"><Monitor className="h-4 w-4" />CBT Exam Mode</span>
                <span className="text-xs font-normal opacity-90">Review after submission</span>
              </Button>
            </div>
            {launching && <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Building your test...</div>}
          </div>
          <Button variant="outline" onClick={() => setStep(2)}>Previous</Button>
        </div>
      )}
    </PageShell>
  );
}

function Stepper({ step }: { step: number }) {
  const labels = ["Subject", "Chapter", "Preference"];
  return (
    <div className="flex items-center gap-2">
      {labels.map((l, i) => (
        <div key={l} className="flex flex-1 items-center gap-2">
          <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold", step > i + 1 ? "bg-success text-success-foreground" : step === i + 1 ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground")}>
            {step > i + 1 ? "✓" : i + 1}
          </span>
          <span className={cn("text-sm font-semibold", step === i + 1 ? "text-foreground" : "text-muted-foreground")}>{l}</span>
          {i < 2 && <span className="h-px flex-1 bg-border" />}
        </div>
      ))}
    </div>
  );
}
