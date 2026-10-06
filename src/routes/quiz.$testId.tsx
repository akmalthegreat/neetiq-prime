import { DrAkzaLoader } from "@/components/dr-akza-loader";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ChevronLeft, ChevronRight, CheckCircle2, Loader2, X, Bookmark, GraduationCap, Flag, Trophy, LayoutGrid, Clock, User, Check, AlertCircle, FileText, Maximize2, Laptop } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { RichText, resolveAnyImageUrl, handleImageFallback } from "@/components/rich-text";
import { ReportQuestionButton } from "@/components/report-question-button";
import { AntiCheatGate, hasAckedAntiCheat } from "@/components/anti-cheat-gate";

export const Route = createFileRoute("/quiz/$testId")({
  head: () => ({ meta: [{ title: "Quiz — NEET Track" }] }),
  validateSearch: (s: Record<string, unknown>): { mode?: "quiz" | "cbt" } => ({
    mode: (s.mode === "quiz" ? "quiz" : "cbt") as "quiz" | "cbt",
  }),
  component: QuizPlayer,
});

type Question = {
  id: string;
  text: string;
  options: string[];
  correct_index: number;
  difficulty: string;
  source: string;
  marks_correct: number;
  marks_wrong: number;
  explanation?: string | null;
  explanation_image_url?: string | null;
  question_image_url?: string | null;
  image_url?: string | null;
  diagram_url?: string | null;
  qtype?: string | null;
  subject_id?: string | null;
  chapter_id?: string | null;
};

function resolveImageUrl(url?: string | null) {
  return resolveAnyImageUrl(url);
}

function resolveOptionImageUrl(
  q?: Question | null,
  index?: number,
  optText?: string | null
): string | null {
  if (!q || index === undefined) return null;
  if (optText && typeof optText === "string") {
    const trimmed = optText.trim();
    if (trimmed && (/\.(png|jpg|jpeg|webp|svg)$/i.test(trimmed) || /optimg|img\/data/i.test(trimmed))) {
      const resolved = resolveAnyImageUrl(trimmed);
      if (resolved) return resolved;
    }
  }

  const isTextEmpty = !optText || typeof optText !== "string" || optText.trim() === "";
  if (isTextEmpty) {
    const qImg = q.question_image_url || q.image_url || q.diagram_url || "";
    const m = qImg.match(/^(?:([^/]+)\/)?(\d+)_(\d+)_(?:question|qtext)_[^/]+(\.[a-zA-Z0-9]+)$/i);
    if (m) {
      const [, subj, chap, qid, ext] = m;
      const finalSubj = subj || q.subject_id || "physics";
      return resolveAnyImageUrl(`${finalSubj}/${chap}_${qid}_optimg_${index + 1}_1${ext}`);
    }
    if (q.chapter_id && q.id) {
      const subj = q.subject_id || "physics";
      return resolveAnyImageUrl(`${subj}/${q.chapter_id}_${q.id}_optimg_${index + 1}_1.png`);
    }
  }
  return null;
}

type Test = {
  id: string;
  title: string;
  type: string;
  difficulty: string;
  duration_min: number;
  total_questions: number;
  source: string;
  question_ids: string[];
  marks_correct: number;
  marks_wrong: number;
};
type Lookup = Record<string, string>;
type NameLookupRow = { id: string; name: string };

function diffClass(d: string) {
  const k = d?.toLowerCase();
  if (k === "easy")
    return "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30";
  if (k === "hard")
    return "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/30";
  return "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30";
}

function QuizPlayer() {
  const { testId } = Route.useParams();
  const { mode } = Route.useSearch();
  const { user, loading: authLoading } = useAuth();
  const nav = useNavigate();
  const [test, setTest] = useState<Test | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [subjects, setSubjects] = useState<Lookup>({});
  const [chapters, setChapters] = useState<Lookup>({});
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set());
  const [wrongMarks, setWrongMarks] = useState<Set<string>>(new Set());
  const isCbt = mode === "cbt";
  const isQuiz = mode === "quiz";
  // Chapter-wise practice = no submit, persist answers, lock-on-pick reveal.
  const isChapterPractice = test?.type === "practice" && isQuiz;
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<{
    score: number;
    correct: number;
    wrong: number;
    unattempted: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [battleMatchId, setBattleMatchId] = useState<string | null>(null);
  const [contestDone, setContestDone] = useState<null | { score: number; correct: number; wrong: number; attempted: number }>(null);
  const [alreadyAttempted, setAlreadyAttempted] = useState<null | { contestId: string | null; score: number | null }>(null);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  // NTA CBT state: visited questions + marked-for-review set
  const [visitedIds, setVisitedIds] = useState<Set<number>>(new Set());
  const [markedForReview, setMarkedForReview] = useState<Set<string>>(new Set());
  const [cbtPick, setCbtPick] = useState<Record<string, number>>({});
  const startedAt = useRef<number>(Date.now());
  const paletteRef = useRef<HTMLDivElement>(null);
  const isContest = test?.type === "contest";
  const isMock = test?.type === "mock";


  useEffect(() => {
    if (!authLoading && !user) nav({ to: "/login" });
  }, [user, authLoading, nav]);

  // Quiz page is light-mode only: temporarily disable the app's dark theme here.
  useEffect(() => {
    const root = document.documentElement;
    const wasDark = root.classList.contains("dark");
    root.classList.remove("dark");
    root.style.colorScheme = "light";
    return () => {
      if (wasDark) {
        root.classList.add("dark");
        root.style.colorScheme = "dark";
      }
    };
  }, []);

  useEffect(() => {
    (async () => {
      const { data: t } = await supabase.from("tests").select("*").eq("id", testId).maybeSingle();
      if (!t) {
        toast.error("Test not found");
        setLoading(false);
        return;
      }
      setTest(t as Test);

      // Contest re-attempt guard: contests are one-shot per user.
      // If a completed attempt already exists for this user/contest test, block.
      if (user && (t as Test).type === "contest") {
        const { data: prior } = await supabase
          .from("attempts")
          .select("id,score")
          .eq("user_id", user.id)
          .eq("test_id", testId)
          .eq("status", "completed")
          .order("submitted_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (prior?.id) {
          const { data: contestRow } = await (supabase as any)
            .from("contests")
            .select("id")
            .eq("test_id", testId)
            .maybeSingle();
          setAlreadyAttempted({
            contestId: contestRow?.id ?? null,
            score: typeof prior.score === "number" ? prior.score : null,
          });
          setLoading(false);
          return;
        }
      }

      // Battlegrounds override: if this test is the current battle for the user,
      // cap to 10 questions / 5 minutes regardless of the underlying test's config.
      let battleActive = false;
      if (user) {
        const { data: bm } = await (supabase as any)
          .from("battle_matches")
          .select("id,status,test_id,ends_at")
          .eq("test_id", testId)
          .eq("status", "active")
          .order("started_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (bm?.id) {
          const { data: mp } = await (supabase as any)
            .from("battle_match_players")
            .select("user_id")
            .eq("match_id", bm.id)
            .eq("user_id", user.id)
            .maybeSingle();
          battleActive = !!mp;
          if (mp) setBattleMatchId(bm.id);
        }
      }

      const totalSeconds = battleActive ? 5 * 60 : (t.duration_min ?? 30) * 60;
      setSecondsLeft(totalSeconds);
      let ids = (t.question_ids as string[]) ?? [];
      if (battleActive) ids = ids.slice(0, 5);
      if (ids.length === 0) {
        setLoading(false);
        return;
      }
      const chunks: string[][] = [];
      for (let i = 0; i < ids.length; i += 60) {
        chunks.push(ids.slice(i, i + 60));
      }
      const qsResults = await Promise.all(
        chunks.map((chunk) => supabase.from("questions").select("*").in("id", chunk))
      );
      const qs = qsResults.flatMap((r) => r.data ?? []);
      let ordered = ids.map((id) => qs?.find((q) => q.id === id)).filter(Boolean) as Question[];

      const subjIds = Array.from(
        new Set(ordered.map((q) => q.subject_id).filter(Boolean)),
      ) as string[];
      const chapIds = Array.from(
        new Set(ordered.map((q) => q.chapter_id).filter(Boolean)),
      ) as string[];
      const [{ data: subs }, { data: chs }] = await Promise.all([
        subjIds.length
          ? supabase.from("subjects").select("id,name").in("id", subjIds)
          : Promise.resolve({ data: [] as NameLookupRow[] }),
        chapIds.length
          ? supabase.from("chapters").select("id,name").in("id", chapIds)
          : Promise.resolve({ data: [] as NameLookupRow[] }),
      ]);
      const subjMap = Object.fromEntries((subs ?? []).map((s: NameLookupRow) => [s.id, s.name]));
      setSubjects(subjMap);
      setChapters(Object.fromEntries((chs ?? []).map((c: NameLookupRow) => [c.id, c.name])));

      // Mock tests: enforce Physics → Chemistry → Botany → Zoology ordering
      if ((t as Test).type === "mock") {
        const rank = (sid: string | null | undefined) => {
          const sname = (sid ? subjMap[sid] || "" : "").toLowerCase();
          if (sname.includes("phy")) return 0;
          if (sname.includes("chem")) return 1;
          if (sname.includes("bot")) return 2;
          if (sname.includes("zoo")) return 3;
          return 4;
        };
        ordered = [...ordered].sort((a, b) => {
          const ra = rank(a.subject_id);
          const rb = rank(b.subject_id);
          if (ra !== rb) return ra - rb;
          return ids.indexOf(a.id) - ids.indexOf(b.id);
        });
      }
      setQuestions(ordered);

      // Preload existing bookmarks + persistent wrong marks for these questions.
      // IMPORTANT: Only chapter-wise practice quizzes resume the previous attempt
      // (answers + bookmarks). Daily / mock / live tests always start fresh.
      const isPracticeTest = (t as Test).type === "practice";
      if (user) {
        const [{ data: existingBm }, { data: existingWrong }] = await Promise.all([
          supabase
            .from("bookmarks")
            .select("question_id")
            .eq("user_id", user.id)
            .in("question_id", ids),
          supabase
            .from("wrong_questions")
            .select("question_id")
            .eq("user_id", user.id)
            .in("question_id", ids),
        ]);
        if (existingBm?.length) setBookmarks(new Set(existingBm.map((b) => b.question_id)));
        // Only show prior wrong marking on chapter-wise practice. For daily / live /
        // mock quizzes the user wants a clean slate every attempt.
        if (isPracticeTest && existingWrong?.length) {
          setWrongMarks(new Set(existingWrong.map((w) => w.question_id)));
        }
        if (isPracticeTest) {
          const { data: existingAttempts } = await supabase
            .from("attempts")
            .select("id,answers,bookmarks,status")
            .eq("user_id", user.id)
            .eq("test_id", testId)
            .order("started_at", { ascending: false })
            .limit(1);
          const prev = existingAttempts?.[0];
          if (prev) {
            setAttemptId(prev.id);
            if (prev.answers && typeof prev.answers === "object")
              setAnswers(prev.answers as Record<string, number>);
            if (Array.isArray(prev.bookmarks))
              setBookmarks((b) => new Set([...b, ...(prev.bookmarks as string[])]));
          }
        }
      }

      setLoading(false);
      startedAt.current = Date.now();
    })();
  }, [testId, user]);

  // Persist answers in real-time for chapter-wise quizzes (no submit button).
  const persistAnswers = async (next: Record<string, number>) => {
    if (!user || !isChapterPractice) return;
    if (attemptId) {
      await supabase
        .from("attempts")
        .update({ answers: next, bookmarks: Array.from(bookmarks) })
        .eq("id", attemptId);
    } else {
      const { data } = await supabase
        .from("attempts")
        .insert({
          user_id: user.id,
          test_id: testId,
          answers: next,
          bookmarks: Array.from(bookmarks),
          status: "in_progress",
        })
        .select("id")
        .maybeSingle();
      if (data?.id) setAttemptId(data.id);
    }
  };

  const submit = useCallback(async () => {
    if (submitting || submitted) return;
    setSubmitting(true);
    let correct = 0,
      wrong = 0,
      score = 0;
    const wrongRows: { user_id: string; question_id: string; chapter_id: string | null }[] = [];
    for (const q of questions) {
      const ans = answers[q.id];
      if (ans === undefined) continue;
      if (ans === q.correct_index) {
        correct++;
        score += q.marks_correct;
      } else {
        wrong++;
        score += q.marks_wrong;
        if (user)
          wrongRows.push({ user_id: user.id, question_id: q.id, chapter_id: q.chapter_id ?? null });
      }
    }
    const unattempted = questions.length - correct - wrong;
    if (user && wrongRows.length) {
      await supabase
        .from("wrong_questions")
        .upsert(wrongRows, { onConflict: "user_id,question_id" });
    }
    const result = { score, correct, wrong, unattempted };
    if (user) {
      const { data: ins } = await supabase
        .from("attempts")
        .insert({
          user_id: user.id,
          test_id: testId,
          answers,
          bookmarks: Array.from(bookmarks),
          score,
          correct_count: correct,
          wrong_count: wrong,
          unattempted_count: unattempted,
          time_taken_sec: Math.floor((Date.now() - startedAt.current) / 1000),
          status: "completed",
          submitted_at: new Date().toISOString(),
        })
        .select("id")
        .maybeSingle();

      // ===== XP management =====
      // Determine attempt kind:
      //   live      — first completed attempt during the live window of the test
      //   post_live — first completed attempt after the live window ended
      //   reattempt — any subsequent completed attempt (capped XP)
      const { count: priorCount } = await supabase
        .from("attempts")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("test_id", testId)
        .eq("status", "completed");
      const isReattempt = (priorCount ?? 0) > 1; // current insert above is included
      // XP is awarded server-side via SECURITY DEFINER RPC (+4 correct / -1 wrong)
      if (ins?.id) {
        await supabase.rpc("award_attempt_xp", { _attempt_id: ins.id });
      }
      void isReattempt;

      if (ins?.id) {
        // Battlegrounds: submit score to match and go to the battle result page.
        if (battleMatchId) {
          try {
            await (supabase as any).rpc("bg_submit_match_score", {
              _match_id: battleMatchId,
              _score: score,
            });
          } catch {
            /* result page will surface errors */
          }
          nav({ to: "/battle/$matchId/result", params: { matchId: battleMatchId } });
          return;
        }
        // For contests: NEVER navigate to analysis. Show a "results awaiting" modal.
        if (test?.type === "contest") {
          setContestDone({ score, correct, wrong, attempted: correct + wrong });
          setSubmitting(false);
          return;
        }
        nav({ to: "/analysis/$attemptId", params: { attemptId: ins.id } });
        return;
      }

    }
    setSubmitted(result);
    setSubmitting(false);
  }, [answers, bookmarks, nav, questions, submitted, submitting, testId, user, test, battleMatchId]);

  useEffect(() => {
    if (loading || submitted || !isCbt) return;
    if (secondsLeft <= 0) {
      submit();
      return;
    }
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secondsLeft, loading, submitted, isCbt, submit]);

  // ===== Contest anti-cheat =====
  // Disable text copy / selection / context menu on the whole document while
  // a contest is in progress. Reverted on cleanup.
  useEffect(() => {
    if (!isContest || submitted || contestDone || alreadyAttempted) return;
    const block = (e: Event) => { e.preventDefault(); return false; };
    const keyBlock = (e: KeyboardEvent) => {
      const k = e.key;
      const ctrl = e.ctrlKey || e.metaKey;
      if (k === "PrintScreen" || (e.shiftKey && (k === "S" || k === "s") && e.metaKey) || k === "F12") {
        e.preventDefault();
        toast.error("Screenshots are disabled during a contest.");
        return;
      }
      if (ctrl && ["c","C","v","V","x","X","s","S","p","P","u","U"].includes(k)) {
        e.preventDefault();
        toast.error("That shortcut is disabled during a contest.");
      }
      if (ctrl && e.shiftKey && ["I","i","J","j","C","c"].includes(k)) e.preventDefault();
    };
    document.addEventListener("copy", block);
    document.addEventListener("cut", block);
    document.addEventListener("paste", block);
    document.addEventListener("contextmenu", block);
    document.addEventListener("selectstart", block);
    document.addEventListener("dragstart", block);
    document.addEventListener("keydown", keyBlock, true);
    const prevUserSelect = document.body.style.userSelect;
    document.body.style.userSelect = "none";
    // Screen-share / cast detection — auto-submits if user starts mirroring.
    let pollId: ReturnType<typeof setInterval> | null = null;
    const perms = (navigator as any).permissions;
    if (perms?.query) {
      pollId = setInterval(async () => {
        try {
          const status = await perms.query({ name: "display-capture" as any });
          if (status?.state === "granted" && !submitted) {
            toast.error("Screen sharing detected — contest auto-submitted.");
            submit();
          }
        } catch { /* unsupported */ }
      }, 2500);
    }
    return () => {
      document.removeEventListener("copy", block);
      document.removeEventListener("cut", block);
      document.removeEventListener("paste", block);
      document.removeEventListener("contextmenu", block);
      document.removeEventListener("selectstart", block);
      document.removeEventListener("dragstart", block);
      document.removeEventListener("keydown", keyBlock, true);
      document.body.style.userSelect = prevUserSelect;
      if (pollId) clearInterval(pollId);
    };
  }, [isContest, submitted, contestDone, alreadyAttempted, submit]);


  // Leaving the app/tab for more than 10 seconds during a contest auto-submits.
  useEffect(() => {
    if (!isContest || !isCbt || submitted || contestDone || alreadyAttempted || loading) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let warned = false;
    const start = () => {
      if (timer) return;
      if (!warned) {
        warned = true;
        toast.warning("Don't leave the contest — auto-submitting in 10 seconds.");
      }
      timer = setTimeout(() => {
        toast.error("You left the app. Contest auto-submitted.");
        submit();
      }, 10_000);
    };
    const stop = () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    };
    const onVis = () => {
      if (document.hidden) start();
      else stop();
    };
    window.addEventListener("blur", start);
    window.addEventListener("focus", stop);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      stop();
      window.removeEventListener("blur", start);
      window.removeEventListener("focus", stop);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [isContest, isCbt, submitted, contestDone, alreadyAttempted, loading, submit]);


  useEffect(() => {
    paletteRef.current
      ?.querySelector<HTMLButtonElement>(`[data-question-index="${idx}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [idx]);

  // Track which questions the candidate has visited (NTA CBT "Not Visited" state)
  useEffect(() => {
    setVisitedIds((v) => {
      if (v.has(idx)) return v;
      const n = new Set(v);
      n.add(idx);
      return n;
    });
  }, [idx]);

  const q = questions[idx];
  const total = questions.length;
  const progress = total ? ((idx + 1) / total) * 100 : 0;
  const hh = String(Math.floor(secondsLeft / 3600)).padStart(2, "0");
  const mm = String(Math.floor((secondsLeft % 3600) / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");

  // ===== NTA CBT helpers =====
  type CbtStatus = "answered_marked" | "marked" | "answered" | "not_answered" | "not_visited";
  const cbtStatus = (i: number): CbtStatus => {
    const qq = questions[i];
    if (!qq) return "not_visited";
    const answered = answers[qq.id] !== undefined;
    const marked = markedForReview.has(qq.id);
    if (answered && marked) return "answered_marked";
    if (marked) return "marked";
    if (answered) return "answered";
    if (visitedIds.has(i)) return "not_answered";
    return "not_visited";
  };

  // Contiguous subject groups (questions arrive subject-ordered) for CBT section tabs
  const subjectGroups = useMemo(() => {
    const groups: { name: string; indices: number[] }[] = [];
    questions.forEach((qq, i) => {
      const name = (qq.subject_id ? subjects[qq.subject_id] : "Other") || "Other";
      const last = groups[groups.length - 1];
      if (last && last.name === name) last.indices.push(i);
      else groups.push({ name, indices: [i] });
    });
    return groups;
  }, [questions, subjects]);

  const activeGroupIndex = subjectGroups.findIndex((g) => g.indices.includes(idx));

  const cbtSaveAndNext = () => setIdx((i) => Math.min(total - 1, i + 1));
  const cbtClearResponse = () => {
    if (!q) return;
    setAnswers((prev) => {
      const next = { ...prev };
      delete next[q.id];
      return next;
    });
    setMarkedForReview((m) => {
      const n = new Set(m);
      n.delete(q.id);
      return n;
    });
  };
  const cbtSaveAndMark = (advance: boolean) => {
    if (!q) return;
    setMarkedForReview((m) => {
      const n = new Set(m);
      n.add(q.id);
      return n;
    });
    if (advance) setIdx((i) => Math.min(total - 1, i + 1));
  };

  const setAnswer = (i: number) => {
    if (!q) return;
    const next = { ...answers, [q.id]: i };
    setAnswers(next);
    const isCorrectNow = i === q.correct_index;
    // Always update local wrongMarks so the grid color reacts immediately.
    setWrongMarks((w) => {
      const n = new Set(w);
      if (isCorrectNow) n.delete(q.id);
      else n.add(q.id);
      return n;
    });
    if (isQuiz) {
      void persistAnswers(next);
      if (user) {
        if (!isCorrectNow) {
          void supabase
            .from("wrong_questions")
            .upsert(
              { user_id: user.id, question_id: q.id, chapter_id: q.chapter_id ?? null },
              { onConflict: "user_id,question_id" },
            );
        } else {
          // Remove from persistent wrong list when corrected.
          void supabase
            .from("wrong_questions")
            .delete()
            .eq("user_id", user.id)
            .eq("question_id", q.id);
        }
      }
    }
  };
  const toggleBookmark = async () => {
    if (!q) return;
    const willAdd = !bookmarks.has(q.id);
    setBookmarks((b) => {
      const n = new Set(b);
      if (willAdd) n.add(q.id);
      else n.delete(q.id);
      return n;
    });
    if (!user) return;
    if (willAdd) {
      const { error } = await supabase
        .from("bookmarks")
        .upsert({ user_id: user.id, question_id: q.id }, { onConflict: "user_id,question_id" });
      if (error) toast.error("Could not save bookmark");
    } else {
      const { error } = await supabase
        .from("bookmarks")
        .delete()
        .eq("user_id", user.id)
        .eq("question_id", q.id);
      if (error) toast.error("Could not remove bookmark");
    }
  };

  if (loading || authLoading)
    return (
      <DrAkzaLoader
        fullScreen
        message="Dr. Azka is preparing your quiz..."
        subMessage="Setting up your questions, timer, and CBT exam environment"
      />
    );

  if (!test)
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="text-center">
          <p className="text-muted-foreground">Test not found.</p>
          <Button asChild variant="link">
            <Link to="/dashboard">Back to dashboard</Link>
          </Button>
        </div>
      </div>
    );

  if (alreadyAttempted)
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md border-amber-500/40 bg-gradient-to-br from-amber-500/5 to-transparent shadow-elegant">
          <CardContent className="p-6 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/15 text-amber-600">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <h2 className="mt-3 text-xl font-extrabold">You've already attempted this contest</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Each contest can be attempted only once. Wait for the results to be published on the contest page.
              {alreadyAttempted.score !== null && (
                <> Your score: <span className="font-bold text-foreground">{alreadyAttempted.score}</span>.</>
              )}
            </p>
            <div className="mt-5 flex gap-2">
              {alreadyAttempted.contestId ? (
                <Button asChild className="flex-1 bg-gradient-primary">
                  <Link to="/contest/$contestId" params={{ contestId: alreadyAttempted.contestId }}>
                    View contest
                  </Link>
                </Button>
              ) : (
                <Button asChild className="flex-1 bg-gradient-primary">
                  <Link to="/contests">Browse contests</Link>
                </Button>
              )}
              <Button asChild variant="outline" className="flex-1">
                <Link to="/dashboard">Dashboard</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );

  if (contestDone)
    return (
      <Dialog open onOpenChange={() => nav({ to: "/contests" })}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-primary to-blue-600 text-primary-foreground shadow-elegant">
              <Trophy className="h-8 w-8" />
            </div>
            <DialogTitle className="text-center text-2xl">🎉 Contest Submitted!</DialogTitle>
            <DialogDescription className="text-center">
              Great job completing <b>{test.title}</b>. Results are awaiting — the leaderboard and prize distribution will appear on the contest page once the live window ends.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-2 py-2 text-center">
            <div className="rounded-xl border bg-card p-3"><div className="text-xl font-extrabold">{contestDone.score}</div><div className="text-[10px] uppercase text-muted-foreground">Your score</div></div>
            <div className="rounded-xl border bg-card p-3"><div className="text-xl font-extrabold text-emerald-600">{contestDone.correct}</div><div className="text-[10px] uppercase text-muted-foreground">Correct</div></div>
            <div className="rounded-xl border bg-card p-3"><div className="text-xl font-extrabold">{contestDone.attempted}/{questions.length}</div><div className="text-[10px] uppercase text-muted-foreground">Attempted</div></div>
          </div>
          <DialogFooter>
            <Button className="w-full bg-gradient-to-r from-primary to-blue-600" onClick={() => nav({ to: "/contests" })}>
              Back to contests
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );

  if (submitted)
    return (
      <ResultsView
        test={test}
        result={submitted}
        questions={questions}
        answers={answers}
        bookmarks={bookmarks}
        subjects={subjects}
        chapters={chapters}
      />
    );

  if (questions.length === 0)
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="text-center">
          <p className="text-muted-foreground">This test has no questions yet.</p>
          <Button asChild variant="link">
            <Link to="/dashboard">Back to dashboard</Link>
          </Button>
        </div>
      </div>
    );

  if (!q) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <DrAkzaLoader message="Preparing next question..." />
      </div>
    );
  }

  const safeOptions = Array.isArray(q.options) && q.options.length > 0 ? q.options : ["", "", "", ""];

  const sourceLabel = (q.source || test.source || "").toUpperCase().includes("PYQ")
    ? "NEET PYQ"
    : q.source?.toUpperCase() === "NCERT"
      ? "NCERT"
      : q.source || "NCERT";
  const subjName = q.subject_id ? subjects[q.subject_id] : undefined;
  const chapName = q.chapter_id ? chapters[q.chapter_id] : undefined;

  const cbtSubmitDialog = (
      <Dialog open={confirmSubmit} onOpenChange={setConfirmSubmit}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden">
        <div className="bg-primary/10 px-5 py-4 border-b border-primary/20 flex items-center gap-3">
          <Laptop className="h-5 w-5 text-primary" />
          <DialogTitle className="text-lg font-bold">NEET CBT — Exam Summary</DialogTitle>
        </div>
        <div className="p-5 space-y-4">
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted text-muted-foreground uppercase text-[10px]">
                <tr>
                  <th className="p-2 font-bold">Subject</th>
                  <th className="p-2 text-center font-bold">Total</th>
                  <th className="p-2 text-center font-bold text-emerald-600">Answered</th>
                  <th className="p-2 text-center font-bold text-rose-600">Not Ans.</th>
                  <th className="p-2 text-center font-bold text-purple-600">Marked</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {subjectGroups.map((g) => {
                  const totalG = g.indices.length;
                  const ansG = g.indices.filter((i) => answers[questions[i]?.id] !== undefined).length;
                  const markedG = g.indices.filter((i) => markedForReview.has(questions[i]?.id)).length;
                  const notAnsG = totalG - ansG;
                  return (
                    <tr key={g.name} className="hover:bg-muted/50">
                      <td className="p-2 font-bold">{g.name}</td>
                      <td className="p-2 text-center font-semibold">{totalG}</td>
                      <td className="p-2 text-center font-semibold text-emerald-600">{ansG}</td>
                      <td className="p-2 text-center font-semibold text-rose-600">{notAnsG}</td>
                      <td className="p-2 text-center font-semibold text-purple-600">{markedG}</td>
                    </tr>
                  );
                })}
                <tr className="bg-muted/30 font-bold border-t border-border">
                  <td className="p-2">Total</td>
                  <td className="p-2 text-center">{questions.length}</td>
                  <td className="p-2 text-center text-emerald-600">{Object.keys(answers).length}</td>
                  <td className="p-2 text-center text-rose-600">{questions.length - Object.keys(answers).length}</td>
                  <td className="p-2 text-center text-purple-600">{markedForReview.size}</td>
                </tr>
              </tbody>
            </table>
          </div>
            {(() => {
              const total = questions.length;
              const answered = Object.keys(answers).length;
              const marked = markedForReview.size;
              const unanswered = total - answered;
              return (
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between border-b border-border/60 pb-2"><span className="text-muted-foreground">Total Questions:</span><span className="font-bold">{total}</span></div>
                  <div className="flex items-center justify-between border-b border-border/60 pb-2"><span className="text-muted-foreground">Answered:</span><span className="font-bold text-emerald-600">{answered}</span></div>
                  <div className="flex items-center justify-between border-b border-border/60 pb-2"><span className="text-muted-foreground">Unanswered:</span><span className="font-bold text-rose-600">{unanswered}</span></div>
                  <div className="flex items-center justify-between"><span className="text-muted-foreground">Marked for Review:</span><span className="font-bold text-amber-600">{marked}</span></div>
                </div>
              );
            })()}
          {(() => {
            const unanswered = questions.length - Object.keys(answers).length;
            if (unanswered > 0) return (
              <div className="rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 px-3 py-2 text-sm text-amber-700 dark:text-amber-300 flex items-center gap-2">
                <Flag className="h-4 w-4 shrink-0" /> You have {unanswered} unanswered question{unanswered === 1 ? "" : "s"}
              </div>
            );
            return null;
          })()}
          <p className="text-center text-sm text-muted-foreground">Are you sure you want to submit your {isContest ? "contest" : "test"}?</p>
          <div className="space-y-2">
            <Button variant="secondary" className="w-full h-11" onClick={() => setConfirmSubmit(false)}>Review Answers</Button>
            <Button className="w-full h-11 bg-gradient-primary" onClick={() => { setConfirmSubmit(false); submit(); }} disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : `Submit ${isContest ? "Contest" : "Test"}`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );

  const cbtCandidate =
    (user?.user_metadata as { full_name?: string; name?: string } | undefined)?.full_name ||
    (user?.user_metadata as { name?: string } | undefined)?.name ||
    user?.email?.split("@")[0] ||
    "Candidate";
  const cbtSelected = cbtPick[q.id] !== undefined ? cbtPick[q.id] : answers[q.id];
  const cbtCommit = () => {
    const v = cbtPick[q.id];
    if (v === undefined) return answers[q.id] !== undefined;
    setAnswers((prev) => ({ ...prev, [q.id]: v }));
    setCbtPick((p) => { const n = { ...p }; delete n[q.id]; return n; });
    return true;
  };
  const cbtGo = (i: number) => {
    setCbtPick((p) => { const n = { ...p }; delete n[q.id]; return n; });
    setIdx(Math.max(0, Math.min(total - 1, i)));
  };
  const cbtCounts = questions.reduce(
    (acc, _qq, i) => { acc[cbtStatus(i)]++; return acc; },
    { not_visited: 0, not_answered: 0, answered: 0, marked: 0, answered_marked: 0 } as Record<CbtStatus, number>,
  );
  const cbtTile: Record<CbtStatus, string> = {
    not_visited: "bg-slate-100 text-slate-700 border-slate-300 rounded-md",
    not_answered: "bg-gradient-to-b from-amber-500 to-orange-600 text-white border-orange-600 rounded-b-xl rounded-t-sm shadow-sm",
    answered: "bg-gradient-to-br from-emerald-500 to-green-600 text-white border-emerald-600 rounded-lg shadow-sm",
    marked: "bg-gradient-to-br from-purple-600 to-indigo-600 text-white border-purple-700 rounded-full shadow-sm",
    answered_marked: "bg-gradient-to-br from-purple-600 to-indigo-600 text-white border-purple-700 rounded-full shadow-sm",
  };
  const cbtBtn = "h-10 rounded-[3px] border px-4 text-sm font-bold uppercase tracking-wide shadow-sm transition active:translate-y-px disabled:opacity-50";

  if (isCbt)
    return (
      <div className="light min-h-screen bg-white text-slate-800" style={{ fontFamily: "Arial, Helvetica, sans-serif" }}>
        {isContest && !hasAckedAntiCheat("contest", testId) && (
          <AntiCheatGate mode="contest" scopeId={testId} onAccept={() => {}} onCancel={() => nav({ to: "/contests" })} />
        )}
        {/* Candidate info */}
        <div className="flex items-start gap-4 border-b border-slate-200 bg-white px-4 py-3 sm:px-8">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded bg-slate-100 text-slate-500 sm:h-16 sm:w-16">
            <User className="h-9 w-9" />
          </div>
          <table className="text-sm sm:text-[15px]">
            <tbody>
              <tr><td className="pr-4 text-slate-600">Candidate Name</td><td className="font-semibold text-[#e8590c]">: {cbtCandidate}</td></tr>
              <tr><td className="pr-4 text-slate-600">Exam Name</td><td className="font-semibold text-[#e8590c]">: {test.title} ({total} Qs · {test.duration_min}m)</td></tr>
              <tr><td className="pr-4 text-slate-600">Subject</td><td className="font-semibold text-[#e8590c]">: {subjectGroups.length > 1 ? "Mixed" : subjName || "Mixed"}</td></tr>
            </tbody>
          </table>
        </div>

        <div className="mx-auto flex max-w-[1400px] flex-col gap-4 p-3 sm:p-5 lg:flex-row">
          {/* Left: question area */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between bg-[#e8590c] px-4 py-2.5 text-white">
              <span className="text-lg font-bold">Question {idx + 1}:</span>
              <span className="flex items-center gap-2 text-sm font-semibold">
                Time:
                <span className="rounded-[3px] bg-white px-2.5 py-1 font-mono text-sm font-bold tabular-nums text-[#c2410c]">{hh}:{mm}:{ss}</span>
              </span>
            </div>
            <div className="border border-t-0 border-slate-300 bg-white">
              <div className="px-5 py-4">
                <div className="text-[15px] leading-relaxed sm:text-base"><RichText>{q.text}</RichText></div>
                {resolveImageUrl(q.question_image_url || q.image_url || q.diagram_url) && (
                  <img
                    src={resolveImageUrl(q.question_image_url || q.image_url || q.diagram_url)!}
                    alt="Question diagram"
                    className="my-3 max-h-80 w-auto object-contain"
                    loading="lazy"
                    onError={(e) => handleImageFallback(e.currentTarget)}
                  />
                )}
                <div className="mt-4 space-y-3">
                  {safeOptions.map((opt, i) => {
                    const optImg = resolveOptionImageUrl(q, i, opt);
                    return (
                      <div key={i} className="flex gap-3 text-[15px] items-center">
                        <span className="shrink-0 font-bold">({i + 1})</span>
                        <div className="min-w-0 flex-1">
                          {optImg ? (
                            <img
                              src={optImg}
                              alt={`Option ${i + 1}`}
                              className="max-h-36 max-w-full rounded border border-slate-200 bg-white p-1 object-contain"
                              loading="lazy"
                              onError={(e) => { (e.currentTarget as HTMLElement).style.display = "none"; }}
                            />
                          ) : (
                            <RichText>{opt || `Option ${i + 1}`}</RichText>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="grid grid-cols-4 border-t border-slate-200 px-5 py-3">
                {safeOptions.map((_, i) => (
                  <label key={i} className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name={`cbt-${q.id}`}
                      className="h-4 w-4 accent-[#1c7ed6]"
                      checked={cbtSelected === i}
                      onChange={() => setCbtPick((p) => ({ ...p, [q.id]: i }))}
                    />
                    {i + 1} )
                  </label>
                ))}
              </div>
            </div>

            {/* Action buttons */}
            <div className="mt-4 flex flex-wrap gap-2">
              <button className={cn(cbtBtn, "border-[#237a35] bg-[#2f9e44] text-white hover:bg-[#2b8a3e]")}
                onClick={() => { cbtCommit(); setMarkedForReview((m) => { const n = new Set(m); n.delete(q.id); return n; }); cbtGo(idx + 1); }}>
                Save &amp; Next
              </button>
              <button className={cn(cbtBtn, "border-slate-300 bg-white text-slate-700 hover:bg-slate-50")}
                onClick={() => { setCbtPick((p) => { const n = { ...p }; delete n[q.id]; return n; }); cbtClearResponse(); }}>
                Clear
              </button>
              <button className={cn(cbtBtn, "inline-flex items-center gap-1.5 border-slate-300 bg-white text-slate-700 hover:bg-slate-50")}
                onClick={() => { if (cbtCommit()) toast.success("Response saved"); else toast("Select an option first"); }}>
                <Bookmark className="h-4 w-4" /> Save
              </button>
              <button className={cn(cbtBtn, "border-[#e0a800] bg-[#fab005] text-white hover:bg-[#f59f00]")}
                onClick={() => { if (!cbtCommit()) { toast("Select an option to Save & Mark"); return; } cbtSaveAndMark(false); }}>
                Save &amp; Mark
              </button>
              <button className={cn(cbtBtn, "border-[#1864ab] bg-[#1c7ed6] text-white hover:bg-[#1971c2]")}
                onClick={() => { cbtSaveAndMark(false); cbtGo(idx + 1); }}>
                Mark &amp; Next
              </button>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button className={cn(cbtBtn, "border-slate-300 bg-white text-slate-600 hover:bg-slate-50")} disabled={idx === 0} onClick={() => cbtGo(idx - 1)}>
                &lt;&lt; Back
              </button>
              <button className={cn(cbtBtn, "border-slate-300 bg-white text-slate-600 hover:bg-slate-50")} disabled={idx === total - 1} onClick={() => cbtGo(idx + 1)}>
                Next &gt;&gt;
              </button>
              <button className={cn(cbtBtn, "ml-auto border-[#237a35] bg-[#2f9e44] px-7 text-white hover:bg-[#2b8a3e]")} disabled={submitting} onClick={() => setConfirmSubmit(true)}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit"}
              </button>
            </div>
          </div>

          {/* Right: status + palette */}
          <aside className="w-full shrink-0 space-y-3 lg:w-[360px]">
            <div className="space-y-2.5 rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-sm">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Question Status Legend</div>
              {([
                ["answered", "Answered (Done)", "✓"],
                ["marked", "Marked for Review", "★"],
                ["answered_marked", "Answered & Marked", "✓"],
                ["not_answered", "Not Answered", "—"],
                ["not_visited", "Not Visited", ""],
              ] as [CbtStatus, string, string][]).map(([k, label, symbol]) => (
                <div key={k} className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className={cn("relative flex h-6 w-6 items-center justify-center border text-[11px] font-black", cbtTile[k])}>
                      {symbol ? symbol : ""}
                      {k === "answered" && <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full border border-white bg-emerald-500 shadow-sm" />}
                      {k === "marked" && <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full border border-white bg-purple-500 shadow-sm" />}
                      {k === "answered_marked" && <span className="absolute -bottom-0.5 -right-0.5 flex h-2.5 w-2.5 items-center justify-center rounded-full border border-white bg-emerald-500 text-[8px] text-white">✓</span>}
                    </span>
                    <span className="text-slate-700 font-medium text-xs">{label}</span>
                  </div>
                  <span className="font-mono text-xs font-bold text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200">{cbtCounts[k]}</span>
                </div>
              ))}
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700">Question Palette</span>
                <span className="text-[11px] font-semibold text-slate-500">{total} Questions</span>
              </div>
              <div className="grid max-h-[420px] grid-cols-6 gap-2 overflow-y-auto pr-1">
                {questions.map((qq, i) => {
                  const s = cbtStatus(i);
                  return (
                    <button
                      key={qq.id}
                      onClick={() => cbtGo(i)}
                      aria-label={`Question ${i + 1}`}
                      className={cn(
                        "relative flex h-10 w-full items-center justify-center border text-xs font-bold transition-transform active:scale-95",
                        cbtTile[s],
                        i === idx && "ring-2 ring-primary ring-offset-2 ring-offset-white shadow-md z-10",
                      )}
                    >
                      {i + 1}
                      {s === "answered" && (
                        <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full border border-white bg-emerald-600 text-[8px] font-black text-white shadow-sm">
                          ✓
                        </span>
                      )}
                      {s === "marked" && (
                        <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full border border-white bg-purple-600 text-[8px] font-black text-white shadow-sm">
                          ★
                        </span>
                      )}
                      {s === "answered_marked" && (
                        <span className="absolute -bottom-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full border border-white bg-emerald-500 text-[8px] font-black text-white shadow-sm">
                          ✓
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
            <Link to="/dashboard" className="block text-right text-xs font-medium text-slate-500 hover:text-slate-800 hover:underline">Exit test</Link>
          </aside>
        </div>
        {cbtSubmitDialog}
      </div>
    );

  return (
    <div className={cn("flex min-h-screen flex-col", isQuiz ? "bg-slate-50 text-slate-900 light" : "bg-background")}>
      {isContest && !submitted && !contestDone && !alreadyAttempted && !hasAckedAntiCheat("contest", testId) && (
        <AntiCheatGate
          mode="contest"
          scopeId={testId}
          onAccept={() => { /* unlocks; rules already start enforcing via effects */ }}
          onCancel={() => nav({ to: "/contests" })}
        />
      )}

      {/* Top bar */}
      <header className={cn("sticky top-0 z-40 border-b", isQuiz ? "bg-white border-blue-100/80 shadow-xs" : "border-border bg-card")}>
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-2.5">
          <div className="min-w-0 flex-1">
            {(() => {
              const sname = (subjName || "").toLowerCase();
              const isBio = sname.includes("bot") || sname.includes("zoo");
              const isPC = sname.includes("phy") || sname.includes("chem");
              const boxColor = isBio
                ? "bg-emerald-500/15 text-emerald-700 border-emerald-300 dark:text-emerald-300 dark:border-emerald-500/40"
                : isPC
                  ? "bg-blue-500/15 text-blue-700 border-blue-300 dark:text-blue-300 dark:border-blue-500/40"
                  : "bg-secondary text-foreground border-border";
              return (
                <div className="flex items-center gap-1.5">
                  <span className={cn("min-w-0 truncate rounded-md border px-2 py-0.5 text-xs font-bold", boxColor)}>
                    {test.title}
                  </span>

                  {isCbt && (
                    <span className="shrink-0 rounded-md border border-rose-300 bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-rose-700 dark:text-rose-300 dark:border-rose-500/40">
                      {hh}:{mm}:{ss}
                    </span>
                  )}
                </div>
              );
            })()}
            <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
              <div className="flex items-center gap-1 font-semibold text-foreground/90">
                <User className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                <span className="truncate max-w-[140px] sm:max-w-[200px]">
                  {(user?.user_metadata as { full_name?: string; name?: string } | undefined)?.full_name ||
                    (user?.user_metadata as { name?: string } | undefined)?.name ||
                    user?.email?.split("@")[0] ||
                    "Student"}
                </span>
              </div>
              <span className="text-muted-foreground/50">•</span>
              <span>Q {idx + 1} / {total}</span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {/* Bookmark button in Top Bar */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => { if (q) toggleBookmark(); }}
              disabled={!q}
              className={cn(
                "h-8 px-2.5 text-xs font-semibold gap-1 rounded-lg transition-colors",
                Boolean(q && bookmarks.has(q.id)) && "border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400"
              )}
              aria-label="Bookmark question"
              title="Bookmark question"
            >
              <Bookmark className={cn("h-3.5 w-3.5", Boolean(q && bookmarks.has(q.id)) && "fill-current")} />
              <span className="hidden sm:inline">Bookmark</span>
            </Button>

            {/* Submit button in Top Bar */}
            <Button
              size="sm"
              className={cn(
                "h-8 px-3 text-xs font-bold shadow-xs",
                isQuiz
                  ? "bg-blue-600 hover:bg-blue-700 text-white"
                  : "bg-emerald-600 hover:bg-emerald-700 text-white"
              )}
              onClick={() => {
                if (isChapterPractice || isQuiz) {
                  submit();
                } else {
                  setConfirmSubmit(true);
                }
              }}
              disabled={submitting}
            >
              {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Submit"}
            </Button>

            {isMock && (
              <Sheet>
                <SheetTrigger asChild>
                  <button
                    aria-label="Grid view"
                    className="rounded-full p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
                  >
                    <LayoutGrid className="h-5 w-5" />
                  </button>
                </SheetTrigger>
                <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
                  <SheetHeader>
                    <SheetTitle>Question Grid</SheetTitle>
                  </SheetHeader>
                  <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <Legend swatch="bg-emerald-500/30" label="Attempted" />
                    <Legend swatch="bg-blue-500/30" label="Marked" />
                    <Legend swatch="bg-card border" label="Not Attempted" />
                  </div>
                  <div className="mt-4 space-y-5">
                    {(() => {
                      const groups: Record<string, { idx: number; q: Question }[]> = {};
                      questions.forEach((qq, i) => {
                        const name = (qq.subject_id ? subjects[qq.subject_id] : "Other") || "Other";
                        (groups[name] ||= []).push({ idx: i, q: qq });
                      });
                      const order = ["Physics", "Chemistry", "Botany", "Zoology"];
                      const sortedKeys = Object.keys(groups).sort((a, b) => {
                        const ia = order.findIndex((o) => a.toLowerCase().includes(o.toLowerCase()));
                        const ib = order.findIndex((o) => b.toLowerCase().includes(o.toLowerCase()));
                        return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
                      });
                      return sortedKeys.map((name) => {
                        const items = groups[name];
                        const attempted = items.filter((it) => answers[it.q.id] !== undefined).length;
                        return (
                          <div key={name}>
                            <div className="mb-2 flex items-center justify-between">
                              <div className="text-sm font-bold">{name}</div>
                              <div className="text-xs text-muted-foreground">{attempted}/{items.length} attempted</div>
                            </div>
                            <div className="grid grid-cols-8 gap-1.5 sm:grid-cols-10">
                              {items.map(({ idx: i, q: qq }) => {
                                const isAns = answers[qq.id] !== undefined;
                                const isBm = bookmarks.has(qq.id);
                                return (
                                  <button
                                    key={qq.id}
                                    onClick={() => setIdx(i)}
                                    className={cn(
                                      "flex h-9 w-9 items-center justify-center rounded-md border text-xs font-semibold",
                                      isAns
                                        ? "bg-emerald-500/20 border-emerald-300"
                                        : isBm
                                          ? "bg-blue-500/15 border-blue-300"
                                          : "bg-card border-border",
                                    )}
                                  >
                                    {i + 1}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </SheetContent>
              </Sheet>
            )}
            <Link
              to="/dashboard"
              aria-label="Exit"
              className="rounded-full p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </Link>
          </div>
        </div>
        {/* progress bar */}
        <div className="h-1 w-full bg-secondary">
          <div className={cn("h-full transition-all", isQuiz ? "bg-blue-600" : "bg-emerald-500")} style={{ width: `${progress}%` }} />
        </div>
        {/* Question palette */}
        <div className="mx-auto max-w-3xl">
          <div
            ref={paletteRef}
            className="flex snap-x flex-nowrap gap-1.5 overflow-x-auto overflow-y-hidden px-4 py-1.5 [scrollbar-width:thin]"
          >
            {questions.map((qq, i) => {
              const isAns = answers[qq.id] !== undefined;
              const isBm = bookmarks.has(qq.id);
              const isCorrect = isAns && isChapterPractice && answers[qq.id] === qq.correct_index;
              const isWrong =
                isChapterPractice &&
                (wrongMarks.has(qq.id) ||
                  (isAns && answers[qq.id] !== qq.correct_index));
              const active = i === idx;
              return (
                <button
                  key={qq.id}
                  data-question-index={i}
                  onClick={() => setIdx(i)}
                  className={cn(
                    "relative flex h-8 w-8 shrink-0 snap-start items-center justify-center rounded-md border text-xs font-semibold transition",
                    active ? "border-primary ring-2 ring-primary/30" : "border-border",
                    isWrong
                      ? "bg-rose-500/10 border-rose-300/60"
                      : isCorrect
                        ? "bg-emerald-500/10 border-emerald-300/60"
                        : isBm
                          ? "bg-blue-500/10 border-blue-300"
                          : "bg-card",
                  )}
                  aria-label={`Question ${i + 1}`}
                >
                  <span className="relative">{i + 1}</span>
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Question */}
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className={cn("flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold", isQuiz ? "bg-blue-600 text-white" : "bg-foreground text-background")}>
            {idx + 1}
          </span>
          <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground">
            Type: {q.qtype || "MCQ"}
          </span>
          <div className="ml-auto">
            <ReportQuestionButton questionId={q.id} />
          </div>
        </div>

        <div className="text-base leading-relaxed sm:text-lg">
          <RichText>{q.text}</RichText>
        </div>

        {resolveImageUrl(q.question_image_url || q.image_url || q.diagram_url) && (
          <div className="my-3 flex flex-col items-center justify-center overflow-hidden rounded-xl border border-border bg-card p-2 text-center shadow-xs">
            <img
              src={resolveImageUrl(q.question_image_url || q.image_url || q.diagram_url)!}
              alt="Question diagram"
              className="max-h-80 w-auto rounded-lg object-contain"
              loading="lazy"
              onError={(e) => {
                e.currentTarget.classList.add("hidden");
                const fallback = e.currentTarget.parentElement?.querySelector("[data-image-fallback]");
                fallback?.classList.remove("hidden");
              }}
            />
            <span data-image-fallback className="hidden p-3 text-xs text-muted-foreground">Question image could not be loaded.</span>
          </div>
        )}

        <div className="mt-4 space-y-2">
          {safeOptions.map((opt, i) => {
            const selected = answers[q.id] === i;
            const locked = (isChapterPractice || isQuiz) && answers[q.id] !== undefined;
            const isCorrectOpt = locked && i === q.correct_index;
            const isWrongPick = locked && selected && i !== q.correct_index;
            const optImg = resolveOptionImageUrl(q, i, opt);
            return (
              <button
                key={i}
                onClick={() => !locked && setAnswer(i)}
                disabled={locked}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left text-[15px] transition",
                  isQuiz
                    ? cn(
                        "bg-white border-blue-100/90 text-slate-800 shadow-xs",
                        !locked && "hover:border-blue-400 hover:bg-blue-50/40",
                        selected && !locked && "border-blue-600 bg-blue-50/60 ring-2 ring-blue-500/30",
                        isCorrectOpt && "border-emerald-500 bg-emerald-50 text-emerald-950 font-medium",
                        isWrongPick && "border-rose-400 bg-rose-50 text-rose-950",
                        locked && !isCorrectOpt && !isWrongPick && "border-slate-200 opacity-80"
                      )
                    : cn(
                        "bg-card",
                        !locked && "hover:border-primary/50",
                        selected && !locked && "border-primary ring-1 ring-primary/30",
                        isCorrectOpt && "border-emerald-400/60 bg-emerald-500/5",
                        isWrongPick && "border-rose-400/60 bg-rose-500/5",
                        locked && !isCorrectOpt && !isWrongPick && "border-border opacity-90"
                      )
                )}
              >
                <span
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-xs font-bold",
                    isCorrectOpt
                      ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                      : isWrongPick
                        ? "bg-rose-500/20 text-rose-700 dark:text-rose-300"
                        : isQuiz
                          ? "bg-blue-50 text-blue-700 border border-blue-200/60"
                          : "bg-secondary text-foreground",
                  )}
                >
                  {i + 1}
                </span>
                <span className="h-6 w-px bg-border" />
                <span className="flex-1">
                  {optImg ? (
                    <div className="my-1 flex items-center">
                      <img
                        src={optImg}
                        alt={`Option ${i + 1}`}
                        className="max-h-40 max-w-full rounded-md object-contain bg-white p-1"
                        loading="lazy"
                        onError={(e) => { (e.currentTarget as HTMLElement).style.display = "none"; }}
                      />
                      {opt && opt.trim() && <span className="ml-2"><RichText>{opt}</RichText></span>}
                    </div>
                  ) : (
                    <RichText>{opt || `Option ${i + 1}`}</RichText>
                  )}
                </span>
                <span
                  className={cn(
                    "h-5 w-5 shrink-0 rounded-full border-2",
                    isCorrectOpt
                      ? "border-emerald-500 bg-emerald-500"
                      : isWrongPick
                        ? "border-rose-400 bg-rose-400"
                        : selected
                          ? (isQuiz ? "border-blue-600 bg-blue-600" : "border-primary bg-primary")
                          : (isQuiz ? "border-blue-200" : "border-border"),
                  )}
                />
              </button>
            );
          })}
        </div>

        {(isChapterPractice || isQuiz) && answers[q.id] !== undefined && (
          <div className="mt-6">
            <h3 className="text-lg font-bold">Explanation</h3>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-semibold capitalize",
                  diffClass(q.difficulty),
                )}
              >
                {q.difficulty || "medium"}
              </span>
              <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/15 dark:text-blue-300">
                {sourceLabel}
              </span>
              {subjName && (() => {
                const s = subjName.toLowerCase();
                const isBio = s.includes("bot") || s.includes("zoo");
                const isPC = s.includes("phy") || s.includes("chem");
                const c = isBio
                  ? "border-emerald-300 bg-emerald-500/15 text-emerald-700 dark:border-emerald-500/40 dark:text-emerald-300"
                  : isPC
                    ? "border-blue-300 bg-blue-500/15 text-blue-700 dark:border-blue-500/40 dark:text-blue-300"
                    : "border-border bg-secondary text-muted-foreground";
                return <span className={cn("rounded-full border px-3 py-1 text-xs font-semibold", c)}>{subjName}</span>;
              })()}
              {chapName && (() => {
                const s = (subjName || "").toLowerCase();
                const isBio = s.includes("bot") || s.includes("zoo");
                const isPC = s.includes("phy") || s.includes("chem");
                const c = isBio
                  ? "border-emerald-300 bg-emerald-500/15 text-emerald-700 dark:border-emerald-500/40 dark:text-emerald-300"
                  : isPC
                    ? "border-blue-300 bg-blue-500/15 text-blue-700 dark:border-blue-500/40 dark:text-blue-300"
                    : "border-border bg-secondary text-muted-foreground";
                return <span className={cn("rounded-full border px-3 py-1 text-xs font-semibold", c)}>{chapName}</span>;
              })()}
            </div>
            <div
              className={cn(
                "mt-1 text-xs font-semibold",
                answers[q.id] === q.correct_index
                  ? "text-emerald-700 dark:text-emerald-300"
                  : "text-rose-700 dark:text-rose-300",
              )}
            >
              {answers[q.id] === q.correct_index ? "Correct" : "Incorrect"} · Answer:{" "}
              {q.correct_index + 1}
            </div>
            {q.explanation ? (
              <div className="mt-3 text-sm leading-relaxed">
                <RichText>{q.explanation}</RichText>
                {resolveImageUrl(q.explanation_image_url) && (
                  <div
                    className="my-3 flex justify-center overflow-hidden rounded-xl border border-border bg-card p-2 shadow-xs"
                    onError={(e) => {
                      (e.currentTarget as HTMLElement).style.display = "none";
                    }}
                  >
                    <img
                      src={resolveImageUrl(q.explanation_image_url)!}
                      alt="Solution Diagram"
                      className="max-h-80 w-auto rounded-lg object-contain"
                      loading="lazy"
                      onError={(e) => {
                        const frame = (e.currentTarget as HTMLElement).parentElement;
                        if (frame) frame.style.display = "none";
                      }}
                    />
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-3 text-xs text-muted-foreground">No explanation provided.</div>
            )}
          </div>
        )}
      </main>

      {/* Bottom action — Previous and Next navigation buttons */}
      <footer className={cn("sticky bottom-0 z-20 border-t backdrop-blur-md", isQuiz ? "bg-white/95 border-blue-100/80 shadow-lg" : "border-border bg-card/95")}>
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-2.5">
          {/* Previous Button */}
          <Button
            variant="outline"
            disabled={idx === 0}
            onClick={() => setIdx((i) => Math.max(0, i - 1))}
            className="h-11 px-5 font-bold gap-2 rounded-xl text-sm transition-all hover:bg-secondary"
            aria-label="Previous question"
          >
            <ChevronLeft className="h-4 w-4" />
            <span>Previous</span>
          </Button>

          <div className="text-xs font-semibold text-muted-foreground tabular-nums">
            Question <span className="text-foreground font-bold">{idx + 1}</span> of <span className="text-foreground font-bold">{total}</span>
          </div>

          {/* Next Button */}
          <Button
            disabled={idx >= total - 1}
            onClick={() => setIdx((i) => Math.min(total - 1, i + 1))}
            className={cn(
              "h-11 px-5 font-bold gap-2 rounded-xl text-sm shadow-sm transition-all",
              isQuiz
                ? "bg-blue-600 hover:bg-blue-700 text-white"
                : "bg-emerald-600 hover:bg-emerald-700 text-white"
            )}
            aria-label="Next question"
          >
            <span>Next</span>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </footer>

      {cbtSubmitDialog}
    </div>
  );
}


function PalettePanelContent({
  user,
  questions,
  answers,
  markedForReview,
  visitedIds,
  cbtStatus,
  idx,
  setIdx,
  setConfirmSubmit,
  submitting,
}: {
  user: any;
  questions: Question[];
  answers: Record<string, number>;
  markedForReview: Set<string>;
  visitedIds: Set<number>;
  cbtStatus: (i: number) => "answered_marked" | "marked" | "answered" | "not_answered" | "not_visited";
  idx: number;
  setIdx: (fn: (i: number) => number | number) => void;
  setConfirmSubmit: (b: boolean) => void;
  submitting: boolean;
}) {
  let countAnswered = 0;
  let countNotAnswered = 0;
  let countNotVisited = 0;
  let countMarked = 0;
  let countAnsweredMarked = 0;

  for (let i = 0; i < questions.length; i++) {
    const s = cbtStatus(i);
    if (s === "answered") countAnswered++;
    else if (s === "not_answered") countNotAnswered++;
    else if (s === "marked") countMarked++;
    else if (s === "answered_marked") countAnsweredMarked++;
    else countNotVisited++;
  }

  return (
    <div className="flex flex-col h-full justify-between space-y-4">
      <div className="space-y-4">
        {/* Candidate Profile Box */}
        <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-secondary/30 p-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-sm">
            <User className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold truncate">{user?.email?.split("@")[0] ?? "Candidate"}</div>
            <div className="text-[10px] text-muted-foreground uppercase font-mono">NEET Candidate</div>
          </div>
        </div>

        {/* Official NTA 5-Color Status Legend */}
        <div className="rounded-xl border border-border/70 bg-card p-3 space-y-2">
          <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Legend</div>
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="flex items-center gap-1.5">
              <span className="flex h-5 w-5 items-center justify-center rounded bg-emerald-600 text-[10px] font-bold text-white shrink-0">
                {countAnswered}
              </span>
              <span className="text-muted-foreground truncate">Answered</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="flex h-5 w-5 items-center justify-center rounded bg-rose-500 text-[10px] font-bold text-white shrink-0">
                {countNotAnswered}
              </span>
              <span className="text-muted-foreground truncate">Not Answered</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="flex h-5 w-5 items-center justify-center rounded bg-slate-200 dark:bg-slate-700 text-[10px] font-bold text-foreground shrink-0 border border-border">
                {countNotVisited}
              </span>
              <span className="text-muted-foreground truncate">Not Visited</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-purple-600 text-[10px] font-bold text-white shrink-0">
                {countMarked}
              </span>
              <span className="text-muted-foreground truncate">Marked for Review</span>
            </div>
            <div className="flex items-center gap-1.5 col-span-2">
              <span className="relative flex h-5 w-5 items-center justify-center rounded-full bg-purple-600 text-[10px] font-bold text-white shrink-0 after:absolute after:bottom-0 after:right-0 after:h-2 after:w-2 after:bg-emerald-400 after:rounded-full after:border after:border-white">
                {countAnsweredMarked}
              </span>
              <span className="text-muted-foreground truncate text-[10px]">Answered & Marked (Evaluated)</span>
            </div>
          </div>
        </div>

        {/* Numbered Palette Grid */}
        <div>
          <div className="mb-2 text-xs font-bold text-foreground">Questions ({questions.length})</div>
          <div className="grid grid-cols-5 gap-1.5 max-h-[300px] overflow-y-auto pr-1">
            {questions.map((qq, i) => {
              const status = cbtStatus(i);
              const isActive = i === idx;
              let bg = "bg-slate-200 dark:bg-slate-700 text-foreground border-border";
              let shape = "rounded";

              if (status === "answered") {
                bg = "bg-emerald-600 text-white border-emerald-700";
              } else if (status === "not_answered") {
                bg = "bg-rose-500 text-white border-rose-600";
              } else if (status === "marked") {
                bg = "bg-purple-600 text-white border-purple-700";
                shape = "rounded-full";
              } else if (status === "answered_marked") {
                bg = "bg-purple-600 text-white border-purple-700";
                shape = "rounded-full relative after:absolute after:bottom-0 after:right-0 after:h-2 after:w-2 after:bg-emerald-400 after:rounded-full after:border after:border-white";
              }

              return (
                <button
                  key={qq.id}
                  type="button"
                  onClick={() => setIdx(() => i)}
                  className={cn(
                    "flex h-9 w-9 items-center justify-center text-xs font-bold transition border cursor-pointer",
                    shape,
                    bg,
                    isActive && "ring-2 ring-primary ring-offset-1"
                  )}
                >
                  <span>{i + 1}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Prominent Submit Test Button */}
      <div className="pt-3 border-t border-border">
        <Button
          type="button"
          onClick={() => setConfirmSubmit(true)}
          disabled={submitting}
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-11"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit Test"}
        </Button>
      </div>
    </div>
  );
}


function ResultsView({
  test,
  result,
  questions,
  answers,
  bookmarks,
  subjects,
  chapters,
}: {
  test: Test;
  result: { score: number; correct: number; wrong: number; unattempted: number };
  questions: Question[];
  answers: Record<string, number>;
  bookmarks: Set<string>;
  subjects: Lookup;
  chapters: Lookup;
}) {
  const max = questions.reduce((s, q) => s + q.marks_correct, 0);
  const pct = Math.max(0, Math.round((result.score / Math.max(1, max)) * 100));
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-4">
          <GraduationCap className="h-5 w-5 text-primary" />
          <span className="font-bold">Result · {test.title}</span>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8">
        <Card className="overflow-hidden shadow-elegant">
          <div className="bg-gradient-primary p-8 text-center text-primary-foreground">
            <CheckCircle2 className="mx-auto h-10 w-10" />
            <div className="mt-2 text-sm uppercase tracking-widest opacity-90">Your score</div>
            <div className="mt-1 text-5xl font-extrabold">
              {result.score}
              <span className="text-2xl opacity-80"> / {max}</span>
            </div>
            <div className="mt-1 text-sm opacity-90">{pct}%</div>
          </div>
          <CardContent className="grid grid-cols-3 gap-3 p-6">
            <Stat label="Correct" value={result.correct} color="text-emerald-600" />
            <Stat label="Wrong" value={result.wrong} color="text-rose-600" />
            <Stat label="Skipped" value={result.unattempted} color="text-muted-foreground" />
          </CardContent>
        </Card>

        {/* Palette legend */}
        <div className="mt-6 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <Legend swatch="bg-emerald-500/30" label="Correct" />
          <Legend swatch="bg-rose-500/30" label="Wrong" />
          <Legend swatch="bg-blue-500/30" label="Marked for review" />
          <span className="inline-flex items-center gap-1.5">
            <span className="relative inline-block h-3 w-6 overflow-hidden rounded">
              <span className="absolute inset-y-0 left-0 w-1/2 bg-blue-500/40" />
              <span className="absolute inset-y-0 right-0 w-1/2 bg-emerald-500/40" />
            </span>{" "}
            Correct + review
          </span>
        </div>

        {/* Result palette */}
        <div className="mt-3 flex flex-wrap gap-2">
          {questions.map((q, i) => {
            const u = answers[q.id];
            const ok = u === q.correct_index;
            const wrong = u !== undefined && !ok;
            const bm = bookmarks.has(q.id);
            return (
              <span
                key={q.id}
                className={cn(
                  "relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-md border text-xs font-semibold",
                  "border-border bg-card",
                )}
              >
                {ok && bm && (
                  <>
                    <span className="absolute inset-y-0 left-0 w-1/2 bg-blue-500/30" />
                    <span className="absolute inset-y-0 right-0 w-1/2 bg-emerald-500/40" />
                  </>
                )}
                {ok && !bm && <span className="absolute inset-0 bg-emerald-500/30" />}
                {wrong && <span className="absolute inset-0 bg-rose-500/30" />}
                {u === undefined && bm && <span className="absolute inset-0 bg-blue-500/25" />}
                <span className="relative">{i + 1}</span>
              </span>
            );
          })}
        </div>

        <h2 className="mt-8 mb-3 text-lg font-bold">Solutions</h2>
        <div className="space-y-3">
          {questions.map((q, i) => {
            const u = answers[q.id];
            const ok = u === q.correct_index;
            const subjName = q.subject_id ? subjects[q.subject_id] : undefined;
            const chapName = q.chapter_id ? chapters[q.chapter_id] : undefined;
            return (
              <Card key={q.id}>
                <CardContent className="p-5">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <Badge variant="secondary">Q{i + 1}</Badge>
                    <Badge
                      className={cn(
                        ok
                          ? "bg-emerald-600"
                          : u === undefined
                            ? "bg-muted text-muted-foreground"
                            : "bg-rose-600",
                      )}
                    >
                      {ok ? "Correct" : u === undefined ? "Skipped" : "Wrong"}
                    </Badge>
                    <span
                      className={cn(
                        "rounded-full border px-2.5 py-0.5 font-semibold capitalize",
                        diffClass(q.difficulty),
                      )}
                    >
                      {q.difficulty}
                    </span>
                    {subjName && (
                      <span className="rounded-full bg-secondary px-2.5 py-0.5 text-muted-foreground">
                        {subjName}
                      </span>
                    )}
                    {chapName && (
                      <span className="rounded-full bg-secondary px-2.5 py-0.5 text-muted-foreground">
                        {chapName}
                      </span>
                    )}
                  </div>
                  <div className="mt-2 text-sm">
                    <RichText>{q.text}</RichText>
                  </div>
                  <div className="mt-2 grid gap-1.5 text-sm">
                    {q.options.map((o, j) => (
                      <div
                        key={j}
                        className={cn(
                          "rounded-lg border px-3 py-2",
                          j === q.correct_index && "border-emerald-500 bg-emerald-500/10",
                          j === u && j !== q.correct_index && "border-rose-500 bg-rose-500/10",
                        )}
                      >
                        <span className="font-semibold">{String.fromCharCode(65 + j)}.</span>{" "}
                        <RichText>{o}</RichText>
                      </div>
                    ))}
                  </div>
                  {q.explanation && (
                    <div className="mt-3 rounded-lg bg-secondary p-3 text-xs">
                      <b>Solution:</b> <RichText>{q.explanation}</RichText>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="mt-8 flex justify-center">
          <Button asChild className="bg-gradient-primary">
            <Link to="/dashboard">Back to dashboard</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("h-3 w-6 rounded", swatch)} /> {label}
    </span>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-xl border bg-card p-4 text-center">
      <div className={cn("text-2xl font-extrabold", color)}>{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
