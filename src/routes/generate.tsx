import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { PageShell } from "@/components/page-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Gift } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { createCustomTestWithBonus } from "@/lib/generate-test.functions";
import { FeatureLock } from "@/components/feature-lock";

export const Route = createFileRoute("/generate")({
  head: () => ({ meta: [{ title: "Custom Test — NEET Track" }] }),
  component: () => (<FeatureLock feature="generate_test"><GeneratePage/></FeatureLock>),
});

type Subject = { id: string; name: string };
type Chapter = { id: string; name: string; subject_id: string };

function GeneratePage() {
  const { user, profile, loading, refresh } = useAuth();
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

  const createTest = useServerFn(createCustomTestWithBonus);
  const bonus = Number(profile?.bonus_balance ?? 0);
  const BONUS_COST = 5;

  useEffect(() => { if (!loading && !user) nav({ to: "/login" }); }, [user, loading, nav]);
  useEffect(() => { supabase.from("subjects").select("id,name").order("name").then(({ data }) => setSubjects((data ?? []) as Subject[])); }, []);
  useEffect(() => {
    if (!subjectId) return setChapters([]);
    supabase.from("chapters").select("id,name,subject_id").eq("subject_id", subjectId).order("order_index").then(({ data }) => setChapters((data ?? []) as Chapter[]));
  }, [subjectId]);

  const toggleChap = (id: string) => setChapIds((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id]);

  const start = async (mode: "quiz" | "exam") => {
    if (!user || !chapIds.length) return;
    if (bonus < BONUS_COST) {
      toast.error(`Need ${BONUS_COST} bonus to generate a test. You have ${bonus}.`);
      nav({ to: "/wallet" });
      return;
    }
    setLaunching(true);
    try {
      const subjName = subjects.find((s) => s.id === subjectId)?.name ?? "Custom";
      const { testId } = await createTest({
        data: {
          chapter_ids: chapIds,
          subject_name: subjName,
          count,
          difficulty,
          duration_min: timer,
        },
      });
      await refresh();
      toast.success(`-${BONUS_COST} bonus · test ready`);
      nav({ to: "/quiz/$testId", params: { testId }, search: { mode } as never });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start");
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
      {step === 1 && (
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {subjects.map((s) => (
            <button key={s.id} onClick={() => { setSubjectId(s.id); setChapIds([]); setStep(2); }} className={cn("rounded-2xl border p-5 text-left transition hover:border-primary/40", subjectId === s.id ? "border-primary bg-primary/5" : "border-border bg-card")}>
              <div className="text-base font-semibold">{s.name}</div>
            </button>
          ))}
        </div>
      )}
      {step === 2 && (
        <div className="mt-6 space-y-2">
          <div className="mb-2 text-sm text-muted-foreground">{chapIds.length} / {chapters.length} selected</div>
          {chapters.map((c) => (
            <button key={c.id} onClick={() => toggleChap(c.id)} className={cn("flex w-full items-center justify-between rounded-xl border p-4 text-left transition", chapIds.includes(c.id) ? "border-primary bg-primary/5" : "border-border bg-card")}>
              <span className="text-sm font-medium">{c.name}</span>
              <span className={cn("h-5 w-5 rounded border-2", chapIds.includes(c.id) ? "border-primary bg-primary" : "border-border")} />
            </button>
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
                <button key={d} onClick={() => setDifficulty(d)} className={cn("rounded-xl border p-3 text-sm font-semibold capitalize", difficulty === d ? "border-primary bg-primary/5" : "border-border")}>{d === "mix" ? "Mix Qs." : d}</button>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-2 text-sm font-bold">Number of Questions</div>
            <div className="grid grid-cols-4 gap-2">
              {[10, 20, 30, 50].map((n) => (
                <button key={n} onClick={() => setCount(n)} className={cn("rounded-xl border p-3 text-sm font-semibold", count === n ? "border-primary bg-primary/5" : "border-border")}>{n} Qs.</button>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-2 text-sm font-bold">Timer (minutes)</div>
            <div className="grid grid-cols-4 gap-2">
              {[10, 15, 30, 60].map((n) => (
                <button key={n} onClick={() => setTimer(n)} className={cn("rounded-xl border p-3 text-sm font-semibold", timer === n ? "border-primary bg-primary/5" : "border-border")}>{n} min</button>
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
                <span className="font-bold">Exam Mode</span>
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
          <span className={cn("flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold", step > i + 1 ? "bg-emerald-500 text-white" : step === i + 1 ? "bg-foreground text-background" : "bg-secondary text-muted-foreground")}>
            {step > i + 1 ? "✓" : i + 1}
          </span>
          <span className={cn("text-sm font-semibold", step === i + 1 ? "text-foreground" : "text-muted-foreground")}>{l}</span>
          {i < 2 && <span className="h-px flex-1 bg-border" />}
        </div>
      ))}
    </div>
  );
}
