import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { RichText } from "@/components/rich-text";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/preview/human-reproduction")({
  head: () => ({ meta: [{ title: "Human Reproduction Preview — NEETIQ Prime" }] }),
  component: HumanReproductionPreview,
});

type Option = { text: string; isCorrect: boolean };
type Question = {
  id: number;
  question_html: string;
  options: Option[];
  correct_index: number;
  explanation?: string | null;
  difficulty: string;
  qtype: string;
};

function HumanReproductionPreview() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [count, setCount] = useState(20);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/preview/human-reproduction.json")
      .then((r) => r.json())
      .then((data: Question[]) => setQuestions(data))
      .finally(() => setLoading(false));
  }, []);

  const visible = useMemo(
    () => questions.slice(0, Math.min(count, questions.length)),
    [questions, count],
  );
  const q = visible[index];

  useEffect(() => {
    setIndex(0);
    setSelected(null);
  }, [count]);

  const choose = (optionIndex: number) => setSelected(optionIndex);
  const next = () => {
    setSelected(null);
    setIndex((i) => Math.min(i + 1, visible.length - 1));
  };
  const previous = () => {
    setSelected(null);
    setIndex((i) => Math.max(i - 1, 0));
  };

  if (loading) {
    return <div className="min-h-screen grid place-items-center p-6">Loading preview…</div>;
  }

  if (!q) {
    return <div className="min-h-screen grid place-items-center p-6">No preview questions found.</div>;
  }

  return (
    <main className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-4xl space-y-4">
        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">Private preview</p>
              <h1 className="text-xl font-bold">Human Reproduction</h1>
              <p className="text-sm text-muted-foreground">Loaded from the reviewed JSON file — not from Supabase.</p>
            </div>
            <Badge variant="secondary">No database write</Badge>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {[10, 20, 50, 141].map((n) => (
              <Button key={n} size="sm" variant={count === n ? "default" : "outline"} onClick={() => setCount(n)}>
                {n} questions
              </Button>
            ))}
          </div>
        </div>

        <Card>
          <CardContent className="p-5 md:p-7">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium">Question {index + 1} of {visible.length}</span>
              <div className="flex gap-2">
                <Badge variant="outline">{q.difficulty}</Badge>
                <Badge variant="outline">{q.qtype}</Badge>
              </div>
            </div>

            <div className="mb-6 text-base leading-7">
              <RichText html={q.question_html} />
            </div>

            <div className="space-y-3">
              {q.options.map((option, optionIndex) => {
                const answered = selected !== null;
                const correct = optionIndex === q.correct_index;
                const picked = optionIndex === selected;
                return (
                  <button
                    key={optionIndex}
                    type="button"
                    disabled={answered}
                    onClick={() => choose(optionIndex)}
                    className={cn(
                      "w-full rounded-xl border p-4 text-left transition",
                      !answered && "hover:border-primary hover:bg-muted/50",
                      answered && correct && "border-emerald-500 bg-emerald-500/10",
                      answered && picked && !correct && "border-rose-500 bg-rose-500/10",
                    )}
                  >
                    <span className="mr-3 inline-flex h-7 w-7 items-center justify-center rounded-full border text-sm font-semibold">
                      {String.fromCharCode(65 + optionIndex)}
                    </span>
                    <span dangerouslySetInnerHTML={{ __html: option.text }} />
                  </button>
                );
              })}
            </div>

            {selected !== null && (
              <div className="mt-6 rounded-xl border bg-muted/40 p-4">
                <p className={cn("font-semibold", selected === q.correct_index ? "text-emerald-600" : "text-rose-600")}>
                  {selected === q.correct_index ? "Correct" : "Incorrect"}
                </p>
                <div className="mt-2 text-sm leading-6">
                  <strong>Explanation:</strong>{" "}
                  <span dangerouslySetInnerHTML={{ __html: q.explanation ?? "No explanation available." }} />
                </div>
              </div>
            )}

            <div className="mt-7 flex justify-between gap-3">
              <Button variant="outline" onClick={previous} disabled={index === 0}>Previous</Button>
              <Button onClick={next} disabled={index === visible.length - 1}>Next</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
