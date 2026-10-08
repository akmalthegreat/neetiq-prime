import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useMemo, type CSSProperties } from "react";
import { PageShell } from "@/components/page-shell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { getFreeAccess, unlockPracticeChapter, LOCKED_PREFIX } from "@/lib/premium-gate.functions";
import { useConsultData } from "@/components/consult/consult-ui";
import { SUBJECT_CSS } from "@/components/subjects/subject-styles";

export const Route = createFileRoute("/subjects/$subject")({
  head: ({ params }) => ({
    meta: [{ title: `${params.subject} — NEET Track` }],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Poppins:wght@500;600;700;800&family=Manrope:wght@400;500;600;700;800&display=swap" },
    ],
  }),
  component: SubjectPage,
});

type Chapter = { id: string; name: string; order_index: number; class?: number | null; q_count?: number };

type Difficulty = "any" | "easy" | "medium" | "hard";
type QType = "any" | "standard" | "assertion_reason" | "match_following" | "statement_based" | "graph_figure";

const QTYPE_MAP: Record<QType, string | null> = {
  any: null,
  standard: "MCQ",
  assertion_reason: "Assertion and Reason",
  match_following: "Match the following",
  statement_based: "MCQ type-2",
  graph_figure: "Graph/Figure",
};

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

async function getChapterQuestionIdPage(
  chapterId: string,
  difficulty: Difficulty,
  qtype: QType,
  offset: number,
  limit: number,
) {
  let query = supabase
    .from("questions")
    .select("id")
    .eq("chapter_id", chapterId);

  if (difficulty !== "any") {
    const value = difficulty.charAt(0).toUpperCase() + difficulty.slice(1);
    query = (query as any).ilike("difficulty", value);
  }

  if (qtype === "graph_figure") {
    query = (query as any).or(
      "question_image_url.not.is.null,qtype.eq.MCQ type-3,text.ilike.%figure%,text.ilike.%diagram%,text.ilike.%graph%",
    );
  } else if (qtype !== "any") {
    const dbType = QTYPE_MAP[qtype];
    if (dbType) query = (query as any).eq("qtype", dbType);
  }

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error("Could not load chapter questions", error);
    return [];
  }

  return (data ?? []).map((question) => question.id);
}

/* ------------------------------------------------------------------ subject look & copy */

type ArtKind = "atom" | "flask" | "dna";
type SubjectMeta = {
  title: string;
  marks: number;
  line: string;
  tip: string;
  art: ArtKind;
  vars: Record<string, string>;
};

const theme = (c: string, c2: string, soft: string, line: string, deep: string, dnaA = "rgba(233,213,255,.85)", dnaB = "rgba(110,231,183,.85)") => ({
  "--c": c, "--c2": c2, "--c-soft": soft, "--c-line": line, "--deep": deep, "--dna-a": dnaA, "--dna-b": dnaB,
});

const META: Record<string, SubjectMeta> = {
  Physics: {
    title: "Physics", marks: 180, art: "atom",
    line: "Concepts, numericals and graphs, chapter by chapter.",
    tip: "Physics rewards practice. Solve numericals daily and review every wrong answer.",
    vars: theme("#60A5FA", "#3B82F6", "rgba(59,130,246,.16)", "rgba(96,165,250,.42)", "#0E1E4A"),
  },
  Chemistry: {
    title: "Chemistry", marks: 180, art: "flask",
    line: "Physical, Organic and Inorganic, mastered one chapter at a time.",
    tip: "Inorganic is pure NCERT. Organic is reactions. Physical is numericals.",
    vars: theme("#34D399", "#10B981", "rgba(16,185,129,.16)", "rgba(16,185,129,.42)", "#063A31"),
  },
  Biology: {
    title: "Biology", marks: 360, art: "dna",
    line: "Half of your NEET score. Botany and Zoology, NCERT line by line.",
    tip: "90 of 180 NEET questions are Biology. Every NCERT line can become a question.",
    vars: theme("#C084FC", "#A855F7", "rgba(168,85,247,.16)", "rgba(192,132,252,.42)", "#33114F"),
  },
  Botany: {
    title: "Botany", marks: 180, art: "dna",
    line: "Plants, cells, genetics and ecology, NCERT line by line.",
    tip: "Botany questions come straight from NCERT diagrams and tables. Revise them often.",
    vars: theme("#4ADE80", "#22C55E", "rgba(34,197,94,.16)", "rgba(74,222,128,.42)", "#0B3A1E", "rgba(187,247,208,.9)", "rgba(250,204,21,.8)"),
  },
  Zoology: {
    title: "Zoology", marks: 180, art: "dna",
    line: "Human physiology, reproduction and evolution, NCERT line by line.",
    tip: "Human physiology is high-yield. Practise it until the diagrams feel familiar.",
    vars: theme("#F472B6", "#EC4899", "rgba(236,72,153,.16)", "rgba(244,114,182,.42)", "#4A0F2E", "rgba(251,207,232,.9)", "rgba(110,231,183,.85)"),
  },
};

/* NCERT order, used to show chapters in syllabus order and to fill in the class when the DB has none. */
const NCERT: Record<string, [string, number][]> = {
  Physics: [["Units and Measurements", 11], ["Motion in a Straight Line", 11], ["Motion in a Plane", 11], ["Laws of Motion", 11], ["Work, Energy and Power", 11], ["System of Particles and Rotational Motion", 11], ["Gravitation", 11], ["Mechanical Properties of Solids", 11], ["Mechanical Properties of Fluids", 11], ["Thermal Properties of Matter", 11], ["Thermodynamics", 11], ["Kinetic Theory", 11], ["Oscillations", 11], ["Waves", 11], ["Electric Charges and Fields", 12], ["Electrostatic Potential and Capacitance", 12], ["Current Electricity", 12], ["Moving Charges and Magnetism", 12], ["Magnetism and Matter", 12], ["Electromagnetic Induction", 12], ["Alternating Current", 12], ["Electromagnetic Waves", 12], ["Ray Optics", 12], ["Wave Optics", 12], ["Dual Nature of Radiation and Matter", 12], ["Atoms", 12], ["Nuclei", 12], ["Semiconductor Electronics", 12]],
  Chemistry: [["Some Basic Concepts of Chemistry", 11], ["Structure of Atom", 11], ["Classification of Elements and Periodicity", 11], ["Chemical Bonding and Molecular Structure", 11], ["States of Matter", 11], ["Thermodynamics", 11], ["Equilibrium", 11], ["Redox Reactions", 11], ["Hydrogen", 11], ["s-Block", 11], ["Organic Chemistry", 11], ["Hydrocarbons", 11], ["Environmental Chemistry", 11], ["Solid State", 12], ["Solutions", 12], ["Electrochemistry", 12], ["Chemical Kinetics", 12], ["Surface Chemistry", 12], ["General Principles and Processes of Isolation", 12], ["p-Block", 12], ["d- and f-Block", 12], ["Coordination Compounds", 12], ["Haloalkanes and Haloarenes", 12], ["Alcohols, Phenols and Ethers", 12], ["Aldehydes, Ketones and Carboxylic Acids", 12], ["Amines", 12], ["Biomolecules", 12], ["Polymers", 12], ["Chemistry in Everyday Life", 12], ["Practical Chemistry", 12]],
  Biology: [["The Living World", 11], ["Biological Classification", 11], ["Plant Kingdom", 11], ["Animal Kingdom", 11], ["Morphology of Flowering Plants", 11], ["Anatomy of Flowering Plants", 11], ["Structural Organisation in Animals", 11], ["Cell: The Unit of Life", 11], ["Biomolecules", 11], ["Cell Cycle and Cell Division", 11], ["Transport in Plants", 11], ["Mineral Nutrition", 11], ["Photosynthesis in Higher Plants", 11], ["Respiration in Plants", 11], ["Plant Growth and Development", 11], ["Digestion and Absorption", 11], ["Breathing and Exchange of Gases", 11], ["Body Fluids and Circulation", 11], ["Excretory Products and Their Elimination", 11], ["Locomotion and Movement", 11], ["Neural Control and Coordination", 11], ["Chemical Coordination and Integration", 11], ["Reproduction in Organisms", 12], ["Sexual Reproduction in Flowering Plants", 12], ["Human Reproduction", 12], ["Reproductive Health", 12], ["Principles of Inheritance and Variation", 12], ["Molecular Basis of Inheritance", 12], ["Evolution", 12], ["Human Health and Disease", 12], ["Strategies for Enhancement in Food Production", 12], ["Microbes in Human Welfare", 12], ["Biotechnology: Principles and Processes", 12], ["Biotechnology and its Applications", 12], ["Organisms and Populations", 12], ["Ecosystem", 12], ["Biodiversity and Conservation", 12], ["Environmental Issues", 12]],
};

const norm = (s: string) =>
  s.toLowerCase().replace(/\(.*?\)/g, " ").replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").replace(/\b(the|of|and|in|its|their)\b/g, " ").replace(/\s+/g, " ").trim();

function syllabusSlot(subject: string, name: string): { pos: number; cls: number } | null {
  const list = NCERT[subject === "Botany" || subject === "Zoology" ? "Biology" : subject];
  if (!list) return null;
  const n = norm(name);
  let best = -1;
  list.forEach(([ref], i) => {
    if (best >= 0) return;
    const r = norm(ref);
    if (n === r) best = i;
  });
  if (best < 0) {
    list.forEach(([ref], i) => {
      if (best >= 0) return;
      const r = norm(ref);
      if (r.length >= 4 && (n.startsWith(r) || r.startsWith(n))) best = i;
    });
  }
  return best >= 0 ? { pos: best, cls: list[best][1] } : null;
}

const LEVELS: { id: Difficulty; label: string; dot: string | null }[] = [
  { id: "any", label: "All levels", dot: null },
  { id: "easy", label: "Easy", dot: "#34D399" },
  { id: "medium", label: "Medium", dot: "#FBBF24" },
  { id: "hard", label: "Hard", dot: "#FB7185" },
];

const FORMATS: { id: QType; label: string; icon: string }[] = [
  { id: "any", label: "All types", icon: "M4 6h16M4 12h16M4 18h16" },
  { id: "standard", label: "Single-correct MCQ", icon: "M9 11l3 3 8-8M20 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" },
  { id: "assertion_reason", label: "Assertion & Reason", icon: "M5 12h14M13 6l6 6-6 6" },
  { id: "match_following", label: "Match the Columns", icon: "M4 6h6M4 12h6M4 18h6M14 6h6M14 12h6M14 18h6" },
  { id: "statement_based", label: "Statement-based", icon: "M4 5h16M4 10h10M4 15h16M4 20h8" },
  { id: "graph_figure", label: "Diagram & Graph", icon: "M3 3v18h18M7 15l4-4 3 3 5-6" },
];

const MIN_ANSWERED = 5; // answered questions before a chapter shows an accuracy label

function Svg({ d, size = 16, stroke = "currentColor" }: { d: string; size?: number; stroke?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

function HeroArt({ kind }: { kind: ArtKind }) {
  if (kind === "atom") {
    return (
      <div className="atom">
        <div className="ell w1"><div className="o" /></div>
        <div className="ell w2"><div className="o" /></div>
        <div className="ell w3"><div className="o" /></div>
        <div className="core" />
      </div>
    );
  }
  if (kind === "flask") {
    const shape = "M32 4h20v30l26 56a8 8 0 0 1-7 12H13a8 8 0 0 1-7-12l26-56z";
    return (
      <>
        <svg className="hexa" width="40" height="40" viewBox="0 0 40 40" fill="none" stroke="#6EE7B7" strokeWidth="1.6" aria-hidden="true">
          <path d="M20 4 34 12v16l-14 8-14-8V12z" />
          <circle cx="20" cy="4" r="2.5" fill="#6EE7B7" />
          <circle cx="34" cy="28" r="2.5" fill="#6EE7B7" />
          <circle cx="6" cy="28" r="2.5" fill="#6EE7B7" />
        </svg>
        <div className="flask">
          <svg width="84" height="110" viewBox="0 0 84 104" aria-hidden="true">
            <defs><clipPath id="nsp-flask"><path d={shape} /></clipPath></defs>
            <g clipPath="url(#nsp-flask)" className="liq">
              <path d="M-20 62 Q0 54 20 62 T60 62 T100 62 T140 62 V110 H-20z" fill="#10B981" opacity=".75" />
            </g>
            <path d={shape} fill="none" stroke="#A7F3D0" strokeWidth="2.5" />
            <path d="M28 4h28" stroke="#A7F3D0" strokeWidth="3" strokeLinecap="round" />
          </svg>
          <span className="bub" style={{ left: 30 }} />
          <span className="bub" style={{ left: 46, animationDelay: ".8s" }} />
          <span className="bub" style={{ left: 38, animationDelay: "1.6s" }} />
        </div>
      </>
    );
  }
  return (
    <div className="dna">
      {Array.from({ length: 10 }).map((_, i) => (
        <span key={i} style={{ top: i * 15 + 4, animationDelay: `${-i * 0.3}s` }} />
      ))}
    </div>
  );
}

function AccuracyChip({ acc }: { acc: number | null }) {
  if (acc === null) {
    return <span className="acc" style={{ background: "rgba(255,255,255,.05)", color: "#9AA9C8" }}>New<small>START</small></span>;
  }
  const [bg, fg, label] = acc >= 75
    ? ["rgba(16,185,129,.14)", "#34D399", "STRONG"]
    : acc >= 50
      ? ["rgba(245,158,11,.14)", "#FBBF24", "IMPROVE"]
      : ["rgba(244,63,94,.14)", "#FB7185", "WEAK"];
  return <span className="acc" style={{ background: bg, color: fg }}>{acc}%<small>{label}</small></span>;
}

/* ------------------------------------------------------------------ page */

function SubjectPage() {
  const { subject } = Route.useParams();
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const consult = useConsultData();
  const [chapters, setChapters] = useState<Chapter[] | null>(null);
  const [launching, setLaunching] = useState<string | null>(null);
  const [launchMode, setLaunchMode] = useState<"quiz" | "cbt" | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty>("any");
  const [qtype, setQType] = useState<QType>("any");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"syllabus" | "weak">("syllabus");

  const [picked, setPicked] = useState<{ chapter: Chapter; total: number } | null>(null);
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
    setPicked(null);
    setSearch("");
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
          .select("id,name,order_index,class")
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
          .select("id,name,order_index,class")
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

      // Show chapters in NCERT syllabus order; anything not recognised keeps its DB order at the end.
      const ranked = filtered.map((c, i) => {
        const slot = syllabusSlot(normalizedSubject, c.name);
        return { c: { ...c, class: c.class ?? slot?.cls ?? null } as Chapter, key: slot ? slot.pos : 1000 + i };
      });
      ranked.sort((a, b) => a.key - b.key);
      setChapters(ranked.map((r) => r.c));
    })();
  }, [normalizedSubject]);

  const [counts, setCounts] = useState<Record<string, number>>({});
  const [counting, setCounting] = useState(false);

  useEffect(() => {
    if (!chapters || chapters.length === 0) {
      setCounts({});
      setCounting(false);
      return;
    }

    let active = true;
    const timer = window.setTimeout(() => {
      setCounting(true);
      (async () => {
        const ids = chapters.map((c) => c.id).slice(0, 100);

        // One request counts every chapter at once. Retry before giving up so a
        // brief network blip never shows "0 questions".
        const diff = difficulty !== "any" ? difficulty.charAt(0).toUpperCase() + difficulty.slice(1) : null;
        const dbType = qtype !== "any" && qtype !== "graph_figure" ? QTYPE_MAP[qtype] ?? null : null;
        for (let attempt = 0; attempt < 3 && active; attempt++) {
          const { data, error } = await (supabase as any).rpc("chapter_question_counts", {
            _chapter_ids: ids, _difficulty: diff, _qtype: dbType, _figure: qtype === "graph_figure",
          });
          if (!error && Array.isArray(data)) {
            if (!active) return;
            const next: Record<string, number> = {};
            for (const id of ids) next[id] = 0;
            for (const row of data as { chapter_id: string; n: number }[]) next[row.chapter_id] = Number(row.n);
            setCounts(next);
            setCounting(false);
            return;
          }
          console.error("Could not count questions", error);
          await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
        }
        if (!active) return;

        // Fallback: count chapter by chapter with a small worker pool.
        let cursor = 0;
        const workerCount = Math.min(4, ids.length);

        const countOne = async (cid: string) => {
          let q = supabase
            .from("questions")
            .select("id", { count: "exact", head: true })
            .eq("chapter_id", cid);

          if (difficulty !== "any") {
            const cap = difficulty.charAt(0).toUpperCase() + difficulty.slice(1);
            q = (q as any).ilike("difficulty", cap);
          }
          if (qtype === "graph_figure") {
            q = (q as any).or(
              "question_image_url.not.is.null,qtype.eq.MCQ type-3,text.ilike.%figure%,text.ilike.%diagram%,text.ilike.%graph%",
            );
          } else if (qtype !== "any") {
            const dbType = QTYPE_MAP[qtype];
            if (dbType) q = (q as any).eq("qtype", dbType);
          }

          const { count, error } = await q;
          if (error) {
            // Leave it unknown rather than showing a misleading 0.
            console.error("Could not count chapter questions", error);
            return;
          }
          if (active) {
            setCounts((prev) => ({ ...prev, [cid]: count ?? 0 }));
          }
        };

        const worker = async () => {
          while (active) {
            const i = cursor++;
            if (i >= ids.length) return;
            await countOne(ids[i]);
          }
        };

        await Promise.all(Array.from({ length: workerCount }, worker));
        if (active) setCounting(false);
      })();
    }, 120);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [chapters, difficulty, qtype]);

  // The learner's own accuracy per chapter (from the same snapshot Dr. Azka Consult uses).
  const accuracy = useMemo(() => {
    const map = new Map<string, { acc: number | null; answered: number }>();
    for (const c of consult.data?.snapshot?.chapters ?? []) {
      map.set(c.chapterId, { acc: c.answered >= MIN_ANSWERED ? c.accuracy : null, answered: c.answered });
    }
    return map;
  }, [consult.data]);
  const accOf = (id: string) => {
    const a = accuracy.get(id)?.acc;
    return a === null || a === undefined ? null : Math.round(a);
  };

  // Free plan: a limited number of chapters, then Premium.
  const accessFn = useServerFn(getFreeAccess);
  const unlockFn = useServerFn(unlockPracticeChapter);
  const [access, setAccess] = useState<Awaited<ReturnType<typeof getFreeAccess>> | null>(null);
  const [premiumPrompt, setPremiumPrompt] = useState(false);
  useEffect(() => { if (user) accessFn().then(setAccess).catch(() => {}); }, [user]); // eslint-disable-line react-hooks/exhaustive-deps
  const freePlan = access && !access.premium && (access as { chapterGate?: boolean }).chapterGate !== false ? access : null;
  const chapterLocked = (id: string) => !!freePlan && !freePlan.chapters.includes(id) && freePlan.chapters.length >= freePlan.chapterLimit;

  const startChapter = async (chapter: Chapter) => {
    if (chapterLocked(chapter.id)) { setPremiumPrompt(true); return; }
    if (!user) {
      toast.info("Please log in to start chapter practice.");
      nav({ to: "/login" });
      return;
    }
    let availableCount = counts[chapter.id] ?? chapter.q_count;
    if (availableCount == null && !counting) {
      // Its count failed earlier: ask again now instead of making the student wait.
      const { data } = await (supabase as any).rpc("chapter_question_counts", {
        _chapter_ids: [chapter.id],
        _difficulty: difficulty !== "any" ? difficulty.charAt(0).toUpperCase() + difficulty.slice(1) : null,
        _qtype: qtype !== "any" && qtype !== "graph_figure" ? QTYPE_MAP[qtype] ?? null : null,
        _figure: qtype === "graph_figure",
      });
      if (Array.isArray(data)) {
        availableCount = Number(data[0]?.n ?? 0);
        setCounts((prev) => ({ ...prev, [chapter.id]: availableCount as number }));
      }
    }
    if (availableCount == null) {
      toast.info("Question count is still loading. Please tap again in a moment.");
      return;
    }
    if (availableCount === 0) {
      toast.error("No questions match the selected filters in this chapter.");
      return;
    }
    // Open the chapter immediately. Fetch only the selected test's IDs later.
    setPicked({ chapter, total: availableCount });
    setSetIdx(null);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const launchSet = async (mode: "quiz" | "cbt") => {
    if (!user || !picked || setIdx === null) return;
    const { chapter } = picked;
    const offset = setIdx * BATCH;
    setLaunching(chapter.id);
    if (freePlan && !freePlan.chapters.includes(chapter.id)) {
      try {
        await unlockFn({ data: { chapter_id: chapter.id } });
        setAccess((a) => (a ? { ...a, chapters: [...a.chapters, chapter.id] } : a));
      } catch (e: any) {
        setLaunching(null);
        setLaunchMode(null);
        if (String(e?.message ?? "").includes(LOCKED_PREFIX)) { setSetIdx(null); setPremiumPrompt(true); }
        else toast.error(e?.message ?? "Could not start this chapter");
        return;
      }
    }
    setLaunchMode(mode);

    const qids = await getChapterQuestionIdPage(
      chapter.id,
      difficulty,
      qtype,
      offset,
      BATCH,
    );

    if (qids.length === 0) {
      setLaunching(null);
      setLaunchMode(null);
      toast.error("No questions are available for this test.");
      return;
    }

    const filterTag =
      difficulty === "any" && qtype === "any"
        ? ""
        : ` (${[difficulty !== "any" ? difficulty : null, qtype !== "any" ? qtype.replace(/_/g, " ") : null].filter(Boolean).join(", ")})`;
    const title = `${normalizedSubject} · ${chapter.name} · Set ${setIdx + 1}${filterTag}`;
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
        setLaunchMode(null);
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
        setLaunchMode(null);
        toast.error(error?.message ?? "Could not start test");
        return;
      }
      testId = t.id;
    }
    setLaunching(null);
    setLaunchMode(null);
    setSetIdx(null);
    const targetMode = mode === "cbt" ? "exam" : "quiz";
    nav({ to: "/quiz/$testId", params: { testId: testId! }, search: { mode: targetMode } as never });
  };

  // Close the mode sheet with Escape.
  useEffect(() => {
    if (setIdx === null) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !launching) setSetIdx(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setIdx, launching]);

  const meta = META[normalizedSubject] ?? META.Physics;
  const title = META[normalizedSubject]?.title ?? normalizedSubject;

  /* ---------- derived numbers for the hero and list */
  const countsReady = !!chapters && !counting;
  const totalQuestions = chapters ? chapters.reduce((t, c) => t + (counts[c.id] ?? 0), 0) : 0;
  const tried = (chapters ?? []).map((c) => accOf(c.id)).filter((a): a is number => a !== null);
  const mastery = tried.length ? Math.round(tried.reduce((t, a) => t + a, 0) / tried.length) : null;
  const weakCount = tried.filter((a) => a < 50).length;
  const filtersOn = difficulty !== "any" || qtype !== "any";
  const levelLabel = LEVELS.find((l) => l.id === difficulty)!.label;
  const formatLabel = FORMATS.find((f) => f.id === qtype)!.label;

  const visible = useMemo(() => {
    if (!chapters) return [];
    const q = search.trim().toLowerCase();
    const rows = chapters.map((c, i) => ({ c, i })).filter((r) => !q || r.c.name.toLowerCase().includes(q));
    if (sort === "weak") {
      rows.sort((a, b) => (accOf(a.c.id) ?? 101) - (accOf(b.c.id) ?? 101));
    }
    return rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapters, search, sort, accuracy]);

  const fmt = (n: number) => n.toLocaleString("en-IN");

  return (
    <PageShell>
      <div className="nsp" style={meta.vars as unknown as CSSProperties}>
        <style dangerouslySetInnerHTML={{ __html: SUBJECT_CSS }} />
        <div className="nsp-in">
          {picked ? (
            <ChapterDetail
              subject={title}
              chapter={picked.chapter}
              total={picked.total}
              batch={BATCH}
              acc={accOf(picked.chapter.id)}
              onBack={() => setPicked(null)}
              onPick={(i) => setSetIdx(i)}
            />
          ) : (
            <>
              <Link to="/dashboard" className="back">← Dashboard</Link>

              <section className="hero rv" aria-label={`${title} overview`}>
                <div className="grid" />
                <div className="glow" />
                <div className="art"><HeroArt kind={meta.art} /></div>
                <div className="eyebrow">Subject practice · {meta.marks} marks in NEET</div>
                <h1>{title}</h1>
                <p>{meta.line}</p>
                <div className="stats">
                  <div className="stat">
                    {chapters ? <b>{chapters.length}</b> : <span className="skel" />}
                    <small>Chapters</small>
                  </div>
                  <div className="stat">
                    {countsReady ? <b>{fmt(totalQuestions)}</b> : <span className="skel" />}
                    <small>Questions</small>
                  </div>
                  <div className="stat">
                    {consult.isLoading ? <span className="skel" /> : <b style={{ color: "var(--c)" }}>{mastery === null ? "—" : `${mastery}%`}</b>}
                    <small>Mastery</small>
                  </div>
                  <div className="stat">
                    {consult.isLoading ? <span className="skel" /> : <b style={{ color: "#FB7185" }}>{weakCount}</b>}
                    <small>Weak</small>
                  </div>
                </div>
              </section>

              <section className="panel rv" style={{ animationDelay: ".08s" }} aria-label="Practice filters">
                <div className="ph">
                  <h2>
                    <span className="si"><Svg d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" /></span>
                    Customise your practice
                  </h2>
                  {filtersOn && (
                    <button type="button" className="reset" onClick={() => { setDifficulty("any"); setQType("any"); }}>Reset</button>
                  )}
                </div>

                <div className="flabel"><span>DIFFICULTY</span></div>
                <div className="seg" role="group" aria-label="Difficulty">
                  {LEVELS.map((l) => (
                    <button key={l.id} type="button" className={difficulty === l.id ? "on" : ""} aria-pressed={difficulty === l.id} onClick={() => setDifficulty(l.id)}>
                      {l.dot && <i style={{ background: l.dot }} />}{l.label}
                    </button>
                  ))}
                </div>

                <div className="flabel" style={{ marginTop: 14 }}><span>QUESTION FORMAT</span><span>Swipe for more →</span></div>
                <div className="chips" role="group" aria-label="Question format">
                  {FORMATS.map((f) => (
                    <button key={f.id} type="button" className={`chip ${qtype === f.id ? "on" : ""}`} aria-pressed={qtype === f.id} onClick={() => setQType(f.id)}>
                      <Svg d={f.icon} />{f.label}
                    </button>
                  ))}
                </div>

                <div className="summary" aria-live="polite">
                  <Svg d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 8v4l3 2" stroke="var(--c)" />
                  {countsReady
                    ? <span><b>{fmt(totalQuestions)}</b> questions match · {levelLabel} · {formatLabel}</span>
                    : <span>Counting questions for {levelLabel.toLowerCase()} · {formatLabel.toLowerCase()}…</span>}
                </div>
              </section>

              <div className="toolbar rv" style={{ animationDelay: ".14s" }}>
                <label className="search">
                  <Svg d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-3.5-3.5" stroke="#9AA9C8" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={chapters ? `Search ${chapters.length} chapters` : "Search chapters"}
                    aria-label="Search chapters"
                  />
                </label>
                <div className="sort" role="group" aria-label="Sort chapters">
                  <button type="button" className={sort === "syllabus" ? "on" : ""} aria-pressed={sort === "syllabus"} onClick={() => setSort("syllabus")}>Syllabus</button>
                  <button type="button" className={sort === "weak" ? "on" : ""} aria-pressed={sort === "weak"} onClick={() => setSort("weak")}>Weakest</button>
                </div>
              </div>

              {freePlan && (
                <div className="mb-3 flex flex-wrap items-center gap-3 rounded-2xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-sm">
                  <span className="flex-1 min-w-[200px]">
                    <b>Free plan:</b>{" "}
                    {freePlan.chapters.length >= freePlan.chapterLimit
                      ? `you have used all ${freePlan.chapterLimit} free chapters. You can keep practising them.`
                      : `${Math.min(freePlan.chapters.length, freePlan.chapterLimit)} of ${freePlan.chapterLimit} free chapters used.`}
                  </span>
                  <Link to="/premium" className="inline-flex h-9 items-center rounded-xl bg-amber-400 px-4 text-xs font-extrabold text-amber-950">Get Premium</Link>
                </div>
              )}

              <div className="listhead"><h3>Chapters</h3><span>Tap a chapter to see its tests</span></div>

              {chapters === null ? (
                <div className="loading" aria-label="Loading chapters">
                  {Array.from({ length: 6 }).map((_, i) => <div key={i} className="ph-card" />)}
                </div>
              ) : chapters.length === 0 ? (
                <div className="empty">No chapters found for {title} yet.</div>
              ) : visible.length === 0 ? (
                <div className="empty">No chapter matches "{search}".</div>
              ) : (
                <div className="list">
                  {visible.map(({ c, i }, k) => {
                    const n = counts[c.id];
                    const acc = accOf(c.id);
                    const busy = launching === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        className="ch"
                        style={{ animationDelay: `${Math.min(0.6, k * 0.03)}s` }}
                        disabled={!!launching}
                        onClick={() => startChapter(c)}
                      >
                        <span className="no">{i + 1}</span>
                        <span className="mid">
                          <span className="nm">{c.name}</span>
                          <span className="meta">
                            {n === undefined
                              ? <span className="skel" />
                              : <span>{fmt(n)} questions</span>}
                            {c.class ? <span className="tagc">Class {c.class}</span> : null}
                            {!counting && n !== undefined && n > 0 ? <span>· {Math.ceil(n / BATCH)} {Math.ceil(n / BATCH) === 1 ? "test" : "tests"}</span> : null}
                          </span>
                          <span className="mbar"><i style={{ width: `${acc ?? 0}%` }} /></span>
                        </span>
                        {busy ? <span className="spin" aria-label="Loading" />
                          : chapterLocked(c.id)
                            ? <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/20 px-2.5 py-1 text-[11px] font-bold text-amber-700 dark:text-amber-300">🔒 Premium</span>
                            : <AccuracyChip acc={acc} />}
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="summary" style={{ marginTop: 14 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="#FBBF24" aria-hidden="true"><path d="M12 2l2.4 7.2H22l-6 4.6 2.3 7.2L12 16.6 5.7 21l2.3-7.2-6-4.6h7.6z" /></svg>
                <span>{meta.tip}</span>
              </div>
            </>
          )}
        </div>

        {setIdx !== null && picked && (
          <>
            <div className="scrim" onClick={() => !launching && setSetIdx(null)} />
            <div className="sheet" role="dialog" aria-modal="true" aria-label="Choose how to attempt this test">
              <div className="grab" />
              <h3>Test {setIdx + 1} · {picked.chapter.name}</h3>
              <p className="sub">How would you like to attempt it?</p>
              <div className="modes">
                <button type="button" className="mode" disabled={!!launching} onClick={() => launchSet("quiz")} autoFocus>
                  <span className="mi" style={{ background: "rgba(34,211,238,.14)", color: "#22D3EE" }}>
                    <Svg size={22} d="M9 11l3 3 8-8M20 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                  </span>
                  <span>
                    <b>Practice mode</b>
                    <small>See the answer and full solution right after each question.</small>
                  </span>
                  {launchMode === "quiz" && <span className="spin" aria-label="Starting" />}
                </button>
                <button type="button" className="mode" disabled={!!launching} onClick={() => launchSet("cbt")}>
                  <span className="mi" style={{ background: "rgba(245,158,11,.14)", color: "#FBBF24" }}>
                    <Svg size={22} d="M9 3h6v4H9zM7 5H5v16h14V5h-2M9 12h6M9 16h4" />
                  </span>
                  <span>
                    <b>NEET exam mode</b>
                    <small>Real NTA CBT screen with timer and question palette. Results at the end.</small>
                  </span>
                  {launchMode === "cbt" ? <span className="spin" aria-label="Starting" /> : <span className="best">EXAM-LIKE</span>}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
      {premiumPrompt && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 p-4 sm:items-center" onClick={() => setPremiumPrompt(false)}>
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 text-center text-slate-900 shadow-2xl dark:bg-slate-900 dark:text-white" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-200 to-yellow-500 text-2xl">👑</div>
            <h2 className="mt-3 text-xl font-bold">Unlock every chapter</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Your free plan includes {freePlan?.chapterLimit ?? 6} chapters, and you have used them. Get Premium to practise all chapters of Physics, Chemistry and Biology.
            </p>
            <Link to="/premium" className="mt-5 flex h-12 items-center justify-center rounded-xl bg-gradient-to-r from-amber-300 to-yellow-500 text-sm font-extrabold text-slate-950">Get Premium</Link>
            <button type="button" onClick={() => setPremiumPrompt(false)} className="mt-2 h-10 w-full text-sm font-medium text-slate-500">Not now</button>
          </div>
        </div>
      )}
    </PageShell>
  );
}

function ChapterDetail({ subject, chapter, total, batch, acc, onBack, onPick }: {
  subject: string; chapter: Chapter; total: number; batch: number; acc: number | null;
  onBack: () => void; onPick: (i: number) => void;
}) {
  const sets = Math.ceil(total / batch);
  return (
    <div className="detail">
      <button type="button" className="back" onClick={onBack}>← All {subject} chapters</button>
      <div className="dh">
        <div className="crumb">{subject}{chapter.class ? ` · Class ${chapter.class}` : ""}</div>
        <h2>{chapter.name}</h2>
        <div className="row">
          <span>{total.toLocaleString("en-IN")} questions</span>
          <span>{sets} {sets === 1 ? "test" : "tests"} of up to {batch}</span>
          <span>{acc === null ? "Not started" : `Your accuracy ${acc}%`}</span>
        </div>
      </div>
      <div className="sets">
        {Array.from({ length: sets }).map((_, i) => {
          const n = Math.min(batch, total - i * batch);
          return (
            <button key={i} type="button" className="set" style={{ animationDelay: `${Math.min(0.5, i * 0.04)}s` }} onClick={() => onPick(i)}>
              <span className="go">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 5v14l12-7z" /></svg>
              </span>
              <div className="sn">Test {i + 1}</div>
              <div className="sr">Q {i * batch + 1}–{i * batch + n} · {n} questions</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
