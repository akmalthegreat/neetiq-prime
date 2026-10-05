import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { PageShell } from "@/components/page-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, ChevronRight, Atom, FlaskConical, Leaf, Dna } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

export const Route = createFileRoute("/subjects/$subject")({
  head: ({ params }) => ({ meta: [{ title: `${params.subject} — NEET Track` }] }),
  component: SubjectPage,
});

type Chapter = { id: string; name: string; order_index: number; q_count?: number };

const BOTANY_CHAPTER_KEYWORDS = [
  "plant",
  "living world",
  "biological classification",
  "photosynthesis",
  "respiration in plants",
  "morphology",
  "anatomy of flowering",
  "cell",
  "inheritance",
  "microbes",
  "biotechnology",
  "organisms and population",
  "ecosystem",
  "biodiversity",
];

const ZOOLOGY_CHAPTER_KEYWORDS = [
  "animal",
  "breathing",
  "body fluids",
  "excretory",
  "locomotion",
  "neural",
  "chemical coordination",
  "human reproduction",
  "reproductive health",
  "evolution",
  "health and disease",
  "biomolecules",
];

async function getChapterQuestionIds(chapterId: string) {
  // Fetch up to 100 questions per chapter quiz to keep performance fast and snappy
  const { data, error } = await supabase
    .from("questions")
    .select("id")
    .eq("chapter_id", chapterId)
    .order("created_at", { ascending: true })
    .limit(100);
  if (error || !data) return [];
  return data.map((q) => q.id);
}

const META: Record<string, { icon: typeof Atom; tint: string; title: string }> = {
  Physics: { icon: Atom, tint: "from-sky-500 to-blue-600", title: "Physics" },
  Chemistry: { icon: FlaskConical, tint: "from-emerald-500 to-teal-600", title: "Chemistry" },
  Biology: { icon: Leaf, tint: "from-green-500 to-emerald-600", title: "Biology" },
  Botany: { icon: Dna, tint: "from-lime-500 to-emerald-600", title: "Botany" },
  Zoology: { icon: Leaf, tint: "from-teal-500 to-green-600", title: "Zoology" },
};

function SubjectPage() {
  const { subject } = Route.useParams();
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [chapters, setChapters] = useState<Chapter[] | null>(null);
  const [launching, setLaunching] = useState<string | null>(null);

  const normalizedSubject = useMemo(() => {
    const s = (subject || "").toLowerCase();
    if (s.includes("bot")) return "Botany";
    if (s.includes("zoo")) return "Zoology";
    if (s.includes("bio")) return "Biology";
    if (s.includes("chem")) return "Chemistry";
    if (s.includes("phy")) return "Physics";
    return subject;
  }, [subject]);

  useEffect(() => {
    (async () => {
      let targetSubjectId = normalizedSubject.toLowerCase();
      if (targetSubjectId === "botany" || targetSubjectId === "zoology") {
        targetSubjectId = "biology";
      }

      // Query chapters for target subject
      const { data: chs, error } = await supabase
        .from("chapters")
        .select("id,name,order_index")
        .eq("subject_id", targetSubjectId)
        .order("order_index");

      if (error || !chs) {
        setChapters([]);
        return;
      }

      let filtered = chs;
      if (normalizedSubject === "Botany") {
        filtered = chs.filter((c) => {
          const n = c.name.toLowerCase();
          return BOTANY_CHAPTER_KEYWORDS.some((kw) => n.includes(kw)) &&
            !n.includes("animal kingdom") && !n.includes("human reproduction");
        });
      } else if (normalizedSubject === "Zoology") {
        filtered = chs.filter((c) => {
          const n = c.name.toLowerCase();
          return ZOOLOGY_CHAPTER_KEYWORDS.some((kw) => n.includes(kw));
        });
      }

      const ids = filtered.map((c) => c.id);
      const counts: Record<string, number> = {};
      if (ids.length) {
        await Promise.all(
          ids.slice(0, 50).map(async (cid) => {
            const { count } = await supabase
              .from("questions")
              .select("id", { count: "exact", head: true })
              .eq("chapter_id", cid);
            counts[cid] = count ?? 0;
          }),
        );
      }
      setChapters(filtered.map((c) => ({ ...c, q_count: counts[c.id] ?? 0 })));
    })();
  }, [normalizedSubject]);

  const startChapter = async (chapter: Chapter) => {
    if (!user) {
      toast.info("Please log in to start chapter practice.");
      nav({ to: "/login" });
      return;
    }
    if (chapter.q_count === 0) {
      toast.error("No questions in this chapter yet.");
      return;
    }
    setLaunching(chapter.id);
    const title = `${normalizedSubject} · ${chapter.name}`;
    const qids = await getChapterQuestionIds(chapter.id);
    if (qids.length === 0) {
      setLaunching(null);
      toast.error("No questions in this chapter yet.");
      return;
    }

    // Reuse existing chapter test for this user if available
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
      await supabase
        .from("tests")
        .update({ question_ids: qids, total_questions: qids.length })
        .eq("id", existing.id);
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
      toast.error(error?.message ?? "Could not start test");
      return;
    }
    nav({ to: "/quiz/$testId", params: { testId: t.id }, search: { mode: "quiz" } as never });
  };

  const meta = META[normalizedSubject] ?? META.Physics;
  const Icon = meta.icon;

  return (
    <PageShell
      eyebrow="Subject Wise Practice"
      title={normalizedSubject}
      description="Pick a chapter to begin practice. Questions, solutions, and explanations are revealed after each attempt."
    >
      <div className="mb-6 flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-xs">
        <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${meta.tint} text-white shadow-xs`}>
          <Icon className="h-6 w-6" />
        </div>
        <div>
          <div className="text-lg font-bold text-foreground">{normalizedSubject} Chapters</div>
          <div className="text-xs text-muted-foreground">
            {chapters ? `${chapters.length} chapters available` : "Loading syllabus..."}
          </div>
        </div>
      </div>

      {chapters === null ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : chapters.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            No chapters found for {normalizedSubject}.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {chapters.map((ch, idx) => (
            <Card
              key={ch.id}
              className="cursor-pointer transition-all hover:border-primary/50 hover:shadow-sm"
              onClick={() => !launching && startChapter(ch)}
            >
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-secondary text-xs font-semibold text-muted-foreground">
                    {idx + 1}
                  </span>
                  <div>
                    <div className="text-sm font-semibold text-foreground">{ch.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {ch.q_count !== undefined && ch.q_count > 0
                        ? `${ch.q_count} questions`
                        : "Practice available"}
                    </div>
                  </div>
                </div>
                <Button size="sm" variant="ghost" disabled={launching === ch.id}>
                  {launching === ch.id ? (
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </PageShell>
  );
}
