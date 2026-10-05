import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { PageShell } from "@/components/page-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, ChevronRight, Atom, FlaskConical, Leaf, Dna } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/subjects/$subject")({
  head: ({ params }) => ({ meta: [{ title: `${params.subject} — NEET Track` }] }),
  component: SubjectPage,
});

type Chapter = { id: string; name: string; order_index: number; q_count?: number };

type Difficulty = "any" | "easy" | "medium" | "hard";
type QType = "any" | "standard" | "assertion_reason" | "match_following" | "statement_based";

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

async function getChapterQuestionIds(
  chapterId: string,
  difficulty: Difficulty,
  qtype: QType,
) {
  const pageSize = 1000;
  const ids: string[] = [];
  for (let from = 0; ; from += pageSize) {
    let q = supabase
      .from("questions")
      .select("id")
      .eq("chapter_id", chapterId);
    if (difficulty !== "any") q = q.eq("difficulty", difficulty);
    if (qtype !== "any") q = (q as any).eq("question_type", qtype);
    const { data, error } = await q
      .order("created_at", { ascending: false })
      .range(from, from + pageSize - 1);
    if (error) break;
    const batch = data ?? [];
    ids.push(...batch.map((q) => q.id));
    if (batch.length < pageSize) break;
  }
  return ids;
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
  const [difficulty, setDifficulty] = useState<Difficulty>("any");
  const [qtype, setQType] = useState<QType>("any");

  const [picked, setPicked] = useState<{ chapter: Chapter; qids: string[] } | null>(null);
  const [setIdx, setSetIdx] = useState<number | null>(null);
  const BATCH = 35;

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
    if (!loading && !user) nav({ to: "/login" });
  }, [user, loading, nav]);

  useEffect(() => {
    (async () => {
      // First check by subject name in subjects table
      const { data: subj } = await supabase
        .from("subjects")
        .select("id")
        .ilike("name", normalizedSubject)
        .maybeSingle();

      let chs: any[] | null = null;
      if (subj?.id) {
        const { data } = await supabase
          .from("chapters")
          .select("id,name,order_index")
          .eq("subject_id", subj.id)
          .order("order_index");
        chs = data;
      }

      if (!chs || chs.length === 0) {
        let targetSubjectId = normalizedSubject.toLowerCase();
        if (targetSubjectId === "botany" || targetSubjectId === "zoology") {
          targetSubjectId = "biology";
        }
        const { data } = await supabase
          .from("chapters")
          .select("id,name,order_index")
          .eq("subject_id", targetSubjectId)
          .order("order_index");
        chs = data;
      }

      if (!chs) {
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
    if (!chapter.q_count) {
      toast.error("No questions in this chapter yet.");
      return;
    }
    setLaunching(chapter.id);
    const qids = await getChapterQuestionIds(chapter.id, difficulty, qtype);
    setLaunching(null);
    if (qids.length === 0) {
      toast.error("No questions match the selected filters.");
      return;
    }
    setPicked({ chapter, qids });
  };

  const launchSet = async (mode: "quiz" | "cbt") => {
    if (!user || !picked || setIdx === null) return;
    const { chapter } = picked;
    const qids = picked.qids.slice(setIdx * BATCH, (setIdx + 1) * BATCH);
    const filterTag =
      difficulty === "any" && qtype === "any"
        ? ""
        : ` (${[difficulty !== "any" ? difficulty : null, qtype !== "any" ? qtype.replace(/_/g, " ") : null].filter(Boolean).join(", ")})`;
    const title = `${normalizedSubject} · ${chapter.name} · Set ${setIdx + 1}${filterTag}`;
    setLaunching(chapter.id);
    const { data: existing } = await supabase
      .from("tests")
      .select("id")
      .eq("created_by", user.id)
      .eq("title", title)
      .eq("type", "practice")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let testId = existing?.id as string | undefined;
    if (testId) {
      const { error } = await supabase
        .from("tests")
        .update({ question_ids: qids, total_questions: qids.length })
        .eq("id", testId);
      if (error) {
        setLaunching(null);
        toast.error(error.message);
        return;
      }
    } else {
      const { data: t, error } = await supabase
        .from("tests")
        .insert({
          title,
          type: "practice",
          difficulty: "medium",
          duration_min: Math.round(Math.max(10, qids.length * 1.2)),
          total_questions: qids.length,
          question_ids: qids,
          created_by: user.id,
          source: "NCERT",
        })
        .select("id")
        .maybeSingle();
      if (error || !t) {
        setLaunching(null);
        toast.error(error?.message ?? "Could not start test");
        return;
      }
      testId = t.id;
    }
    setLaunching(null);
    setSetIdx(null);
    nav({ to: "/quiz/$testId", params: { testId: testId! }, search: { mode } as never });
  };

  const meta = META[normalizedSubject] ?? META.Physics;
  const Icon = meta.icon;

  return (
    <PageShell
      eyebrow="Subject Wise Practice"
      title={normalizedSubject}
      description="Pick a chapter to begin practice. Choose filters, select a test batch, and practice in Quiz or CBT mode."
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

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <div>
          <Label className="text-xs">Difficulty</Label>
          <Select value={difficulty} onValueChange={(v) => setDifficulty(v as Difficulty)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any difficulty</SelectItem>
              <SelectItem value="easy">Easy</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="hard">Hard</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Question type</Label>
          <Select value={qtype} onValueChange={(v) => setQType(v as QType)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any type</SelectItem>
              <SelectItem value="standard">Standard MCQ</SelectItem>
              <SelectItem value="assertion_reason">Assertion & Reason</SelectItem>
              <SelectItem value="match_following">Match the following</SelectItem>
              <SelectItem value="statement_based">Statement based</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Dialog open={setIdx !== null} onOpenChange={(o) => !o && setSetIdx(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Choose mode · Set {(setIdx ?? 0) + 1}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              disabled={!!launching}
              onClick={() => launchSet("quiz")}
              className="rounded-xl border border-border bg-card p-4 text-left transition hover:border-primary/50 disabled:opacity-50"
            >
              <div className="font-semibold">Quiz Mode</div>
              <div className="mt-1 text-xs text-muted-foreground">Instant answer & explanation after each question.</div>
            </button>
            <button
              disabled={!!launching}
              onClick={() => launchSet("cbt")}
              className="rounded-xl border border-border bg-card p-4 text-left transition hover:border-primary/50 disabled:opacity-50"
            >
              <div className="font-semibold">CBT Mode</div>
              <div className="mt-1 text-xs text-muted-foreground">NTA-style timed test with question palette; results at the end.</div>
            </button>
          </div>
          {launching && <Loader2 className="mx-auto h-5 w-5 animate-spin text-primary" />}
        </DialogContent>
      </Dialog>

      {picked ? (
        <div>
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <div className="text-sm font-semibold">{picked.chapter.name}</div>
              <div className="text-xs text-muted-foreground">
                {picked.qids.length} questions · {Math.ceil(picked.qids.length / BATCH)} tests of up to {BATCH}
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setPicked(null)}>← Chapters</Button>
          </div>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {Array.from({ length: Math.ceil(picked.qids.length / BATCH) }).map((_, i) => {
              const n = Math.min(BATCH, picked.qids.length - i * BATCH);
              return (
                <button
                  key={i}
                  onClick={() => setSetIdx(i)}
                  className="group flex items-center gap-3 rounded-xl border border-border bg-card p-4 text-left shadow-sm transition hover:border-primary/40"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-sm font-semibold">{i + 1}</span>
                  <span className="flex-1">
                    <div className="text-sm font-semibold">Test {i + 1}</div>
                    <div className="text-xs text-muted-foreground">Q {i * BATCH + 1}–{i * BATCH + n} · {n} questions</div>
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </button>
              );
            })}
          </div>
        </div>
      ) : chapters === null ? (
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
      <div className="mt-6">
        <Button asChild variant="ghost">
          <Link to="/dashboard">← Back to dashboard</Link>
        </Button>
      </div>
    </PageShell>
  );
}
