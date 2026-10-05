import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageShell } from "@/components/page-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Play, Trash2, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { RichText } from "@/components/rich-text";
import { toast } from "sonner";

type Mistake = {
  id: string;
  text: string;
  options: string[];
  correct_index: number;
  explanation: string | null;
  question_image_url?: string | null;
  explanation_image_url?: string | null;
  image_url?: string | null;
  diagram_url?: string | null;
  difficulty: string;
  subject_id: string | null;
  chapter_id: string | null;
  created_at: string;
};

type Lookup = Record<string, string>;

export const Route = createFileRoute("/mistakes")({
  head: () => ({ meta: [{ title: "My Mistakes — NEET Track" }, { name: "description", content: "Review and practice questions you previously answered incorrectly." }] }),
  component: MistakesPage,
});

function MistakesPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [mistakes, setMistakes] = useState<Mistake[] | null>(null);
  const [subjects, setSubjects] = useState<Lookup>({});
  const [chapters, setChapters] = useState<Lookup>({});
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    (async () => {
      setMistakes(null);
      const { data: rows, error } = await supabase.from("wrong_questions")
        .select("question_id,chapter_id,created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1000);
      if (!active) return;
      if (error) {
        console.error("Could not load My Mistakes", error);
        toast.error("Could not load your mistakes. Please try again.");
        setMistakes([]);
        return;
      }
      const ids = (rows ?? []).map((row) => row.question_id);
      if (!ids.length) {
        setMistakes([]);
        return;
      }
      const batches: string[][] = [];
      for (let index = 0; index < ids.length; index += 60) batches.push(ids.slice(index, index + 60));
      const questionResults = await Promise.all(batches.map((batch) =>
        supabase.from("questions").select("*").in("id", batch),
      ));
      if (!active) return;
      const questions = questionResults.flatMap((result) => result.data ?? []) as unknown as Mistake[];
      const ordered = ids.map((id) => questions.find((question) => question.id === id)).filter(Boolean) as Mistake[];
      setMistakes(ordered);

      const subjectIds = [...new Set(ordered.map((question) => question.subject_id).filter(Boolean))] as string[];
      const chapterIds = [...new Set(ordered.map((question) => question.chapter_id).filter(Boolean))] as string[];
      const [{ data: subjectRows }, { data: chapterRows }] = await Promise.all([
        subjectIds.length ? supabase.from("subjects").select("id,name").in("id", subjectIds) : Promise.resolve({ data: [] as { id: string; name: string }[] }),
        chapterIds.length ? supabase.from("chapters").select("id,name").in("id", chapterIds) : Promise.resolve({ data: [] as { id: string; name: string }[] }),
      ]);
      if (!active) return;
      setSubjects(Object.fromEntries((subjectRows ?? []).map((row) => [row.id, row.name])));
      setChapters(Object.fromEntries((chapterRows ?? []).map((row) => [row.id, row.name])));
    })();
    return () => { active = false; };
  }, [user]);

  const filtered = useMemo(() => {
    if (!mistakes) return null;
    return subjectFilter === "all" ? mistakes : mistakes.filter((question) => question.subject_id === subjectFilter);
  }, [mistakes, subjectFilter]);

  const removeMistake = async (questionId: string) => {
    if (!user) return;
    const { error } = await supabase.from("wrong_questions").delete().eq("user_id", user.id).eq("question_id", questionId);
    if (error) {
      toast.error("Could not remove this question from My Mistakes.");
      return;
    }
    setMistakes((current) => (current ?? []).filter((question) => question.id !== questionId));
    toast.success("Removed from My Mistakes");
  };

  const practice = async () => {
    if (!user || !filtered?.length) return;
    setBusy(true);
    const questionIds = filtered.map((question) => question.id);
    const { data: test, error } = await supabase.from("tests").insert({
      title: "My Mistakes Practice",
      type: "practice",
      difficulty: "mixed",
      duration_min: Math.max(10, Math.ceil(questionIds.length * 1.2)),
      total_questions: questionIds.length,
      question_ids: questionIds,
      created_by: user.id,
      source: "My Mistakes",
    }).select("id").maybeSingle();
    setBusy(false);
    if (error || !test) {
      toast.error(error?.message ?? "Could not start practice");
      return;
    }
    navigate({ to: "/quiz/$testId", params: { testId: test.id }, search: { mode: "cbt" } });
  };

  if (authLoading || mistakes === null) return <PageShell eyebrow="Improvement Zone" title="My Mistakes"><div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div></PageShell>;

  const availableSubjects = [...new Set(mistakes.map((question) => question.subject_id).filter(Boolean))] as string[];
  return (
    <PageShell eyebrow="Improvement Zone" title="My Mistakes" description="Review questions you answered incorrectly, then practice them again to strengthen your understanding.">
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Select value={subjectFilter} onValueChange={setSubjectFilter}>
          <SelectTrigger className="w-full sm:w-56"><SelectValue placeholder="Filter by subject" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All subjects</SelectItem>
            {availableSubjects.map((id) => <SelectItem key={id} value={id}>{subjects[id] ?? "Subject"}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="text-sm text-muted-foreground">{filtered?.length ?? 0} question{filtered?.length === 1 ? "" : "s"}</div>
        {!!filtered?.length && <Button onClick={practice} disabled={busy} className="ml-auto">
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}Practice mistakes
        </Button>}
      </div>

      {!filtered?.length ? (
        <Card><CardContent className="p-10 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600"><RotateCcw className="h-5 w-5" /></div>
          <h2 className="font-semibold">You’re all caught up</h2>
          <p className="mt-1 text-sm text-muted-foreground">Questions you answer incorrectly will be saved here for review.</p>
        </CardContent></Card>
      ) : <div className="space-y-4">{filtered.map((question, index) => (
        <Card key={question.id}>
          <CardContent className="p-4 sm:p-5">
            <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="rounded-full bg-secondary px-2.5 py-1 font-semibold">Question {index + 1}</span>
                {question.subject_id && <span>{subjects[question.subject_id]}</span>}
                {question.chapter_id && <span>· {chapters[question.chapter_id]}</span>}
                <span>· {question.difficulty}</span>
              </div>
              <Button variant="ghost" size="sm" onClick={() => removeMistake(question.id)} aria-label="Remove from My Mistakes" className="text-muted-foreground hover:text-destructive">
                <Trash2 className="mr-1.5 h-4 w-4" />Remove
              </Button>
            </div>
            <div className="text-sm leading-relaxed"><RichText>{question.text}</RichText></div>
            {(question.question_image_url || question.image_url || question.diagram_url) && <div className="my-3"><RichText>{`<img src="${(question.question_image_url || question.image_url || question.diagram_url)!.replace(/"/g, "&quot;")}" />`}</RichText></div>}
            <div className="mt-3 space-y-2">
              {(question.options ?? []).map((option, optionIndex) => (
                <div key={optionIndex} className={`rounded-lg border px-3 py-2 text-sm ${optionIndex === question.correct_index ? "border-emerald-500/40 bg-emerald-500/5" : "border-border"}`}>
                  <span className="mr-2 font-semibold">{String.fromCharCode(65 + optionIndex)}.</span><RichText>{option}</RichText>
                  {optionIndex === question.correct_index && <span className="ml-2 text-xs font-semibold text-emerald-600">Correct answer</span>}
                </div>
              ))}
            </div>
            {question.explanation && <div className="mt-4 rounded-lg bg-secondary/50 p-3 text-sm"><div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Explanation</div><RichText>{question.explanation}</RichText></div>}
            {question.explanation_image_url && <div className="my-3"><RichText>{`<img src="${question.explanation_image_url.replace(/"/g, "&quot;")}" />`}</RichText></div>}
          </CardContent>
        </Card>
      ))}</div>}
    </PageShell>
  );
}
