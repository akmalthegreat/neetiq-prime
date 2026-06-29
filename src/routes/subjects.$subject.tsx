import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageShell } from "@/components/page-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, ChevronRight, Atom, FlaskConical, Leaf, Dna } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

export const Route = createFileRoute("/subjects/$subject")({
  head: () => ({ meta: [{ title: "Subject — NEETIQ Prime" }] }),
  component: SubjectPage,
});

type Chapter = { id: string; name: string; order_index: number; q_count?: number };

async function getChapterQuestionIds(chapterId: string) {
  // Paginate to bypass PostgREST's default 1000-row cap so large chapters
  // surface every question in the quiz.
  const pageSize = 1000;
  const ids: string[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("questions")
      .select("id")
      .eq("chapter_id", chapterId)
      .order("created_at", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) break;
    const batch = data ?? [];
    ids.push(...batch.map((q) => q.id));
    if (batch.length < pageSize) break;
  }
  return ids;
}

const META: Record<string, { icon: typeof Atom; tint: string }> = {
  Physics: { icon: Atom, tint: "from-sky-100 to-blue-100" },
  Chemistry: { icon: FlaskConical, tint: "from-orange-100 to-amber-100" },
  Botany: { icon: Dna, tint: "from-lime-100 to-emerald-100" },
  Zoology: { icon: Leaf, tint: "from-emerald-100 to-green-100" },
};

function SubjectPage() {
  const { subject } = Route.useParams();
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [chapters, setChapters] = useState<Chapter[] | null>(null);
  const [launching, setLaunching] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) nav({ to: "/login" });
  }, [user, loading, nav]);

  useEffect(() => {
    (async () => {
      const { data: subj } = await supabase
        .from("subjects")
        .select("id")
        .eq("name", subject)
        .maybeSingle();
      if (!subj) {
        setChapters([]);
        return;
      }
      const { data: chs } = await supabase
        .from("chapters")
        .select("id,name,order_index")
        .eq("subject_id", subj.id)
        .order("order_index");
      const ids = (chs ?? []).map((c) => c.id);
      const counts: Record<string, number> = {};
      if (ids.length) {
        // Per-chapter exact count avoids the PostgREST 1000-row cap that was
        // making large subjects under-report (or zero out) chapter totals.
        await Promise.all(
          ids.map(async (cid) => {
            const { count } = await supabase
              .from("questions")
              .select("id", { count: "exact", head: true })
              .eq("chapter_id", cid);
            counts[cid] = count ?? 0;
          }),
        );
      }
      setChapters((chs ?? []).map((c) => ({ ...c, q_count: counts[c.id] ?? 0 })));
    })();
  }, [subject]);

  const startChapter = async (chapter: Chapter) => {
    if (!user) return;
    if (!chapter.q_count) {
      toast.error("No questions in this chapter yet.");
      return;
    }
    setLaunching(chapter.id);
    const title = `${subject} · ${chapter.name}`;
    const qids = await getChapterQuestionIds(chapter.id);
    if (qids.length === 0) {
      setLaunching(null);
      toast.error("No questions in this chapter yet.");
      return;
    }
    // Reuse existing chapter test for this user, so answers persist across visits.
    const { data: existing } = await supabase
      .from("tests")
      .select("id,question_ids,total_questions")
      .eq("created_by", user.id)
      .eq("title", title)
      .eq("type", "practice")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existing?.id) {
      // Always refresh question_ids — protects against stale/empty arrays that blank the quiz screen.
      const { error: updErr } = await supabase
        .from("tests")
        .update({ question_ids: qids, total_questions: qids.length })
        .eq("id", existing.id);
      if (updErr) {
        setLaunching(null);
        toast.error(updErr.message);
        return;
      }
      setLaunching(null);
      nav({
        to: "/quiz/$testId",
        params: { testId: existing.id },
        search: { mode: "quiz" } as never,
      });
      return;
    }
    const { data: t, error } = await supabase
      .from("tests")
      .insert({
        title,
        type: "practice",
        difficulty: "medium",
        duration_min: Math.round(Math.max(10, Math.min(30, qids.length * 1.5))),
        total_questions: qids.length,
        question_ids: qids,
        created_by: user.id,
        source: "NCERT",
      })
      .select("id")
      .maybeSingle();
    setLaunching(null);
    if (error || !t) {
      toast.error(error?.message ?? "Could not start");
      return;
    }
    nav({ to: "/quiz/$testId", params: { testId: t.id }, search: { mode: "quiz" } as never });
  };

  const meta = META[subject] ?? META.Physics;
  const Icon = meta.icon;

  return (
    <PageShell
      eyebrow="Subject"
      title={subject}
      description="Pick a chapter to begin practice. Answers and explanations are shown after each question in Quiz Mode."
    >
      <div
        className={`mb-6 flex items-center gap-4 rounded-2xl bg-gradient-to-br ${meta.tint} p-5 shadow-soft`}
      >
        <Icon className="h-10 w-10" strokeWidth={1.6} />
        <div>
          <div className="text-xs uppercase tracking-widest text-foreground/60">
            NEET 2027 Syllabus
          </div>
          <div className="text-lg font-bold">{chapters?.length ?? 0} Chapters</div>
        </div>
      </div>

      {chapters === null ? (
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      ) : chapters.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            No chapters yet.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2.5">
          {chapters.map((c, i) => (
            <button
              key={c.id}
              onClick={() => startChapter(c)}
              disabled={launching === c.id}
              className="group flex w-full items-center gap-3 rounded-xl border border-border bg-card p-4 text-left shadow-sm transition hover:border-primary/40 hover:shadow disabled:opacity-50"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-muted-foreground">
                {i + 1}
              </span>
              <span className="h-8 w-px bg-border" />
              <span className="flex-1 min-w-0">
                <div className="text-sm font-semibold leading-tight">{c.name}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">{c.q_count} Questions</div>
              </span>
              {launching === c.id ? (
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
              )}
            </button>
          ))}
        </div>
      )}
      <div className="mt-6">
        <Button asChild variant="ghost">
          <Link to="/dashboard">← Back to dashboard</Link>
        </Button>
      </div>
    </PageShell>
  );
}
