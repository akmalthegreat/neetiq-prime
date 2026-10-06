import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { CheckCircle2, Loader2, X, Bookmark, GraduationCap, Flag, Trophy, LayoutGrid, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { RichText } from "@/components/rich-text";
import { ReportQuestionButton } from "@/components/report-question-button";
import { AntiCheatGate, hasAckedAntiCheat } from "@/components/anti-cheat-gate";
import { ReasonBreakdown } from "@/components/reason-breakdown";


export const Route = createFileRoute("/quiz/$testId")({
  head: () => ({ meta: [{ title: "Quiz — Neet Buddy" }, { name: "description", content: "Practice NEET questions in quiz or CBT mode." }, { property: "og:title", content: "Quiz — Neet Buddy" }, { property: "og:description", content: "Practice NEET questions in quiz or CBT mode." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  validateSearch: (s: Record<string, unknown>): { mode?: "quiz" | "exam" | "cbt" } => ({
    mode: (s.mode === "quiz" ? "quiz" : s.mode === "cbt" ? "cbt" : "exam") as "quiz" | "exam" | "cbt",
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
  subject_id?: string | null;
  chapter_id?: string | null;
};
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
  // In CBT mode the experience mirrors NTA: timer, no in-quiz review, palette-driven.
  const isExam = mode === "exam" || isCbt;
  const isQuiz = mode === "quiz";
  // Chapter-wise practice = no submit, persist answers, lock-on-pick reveal.
  const isChapterPractice = test?.type === "practice";
  // Per-question CBT status: 'not_visited' | 'not_answered' | 'answered' | 'marked' | 'marked_answered'
  const [visited, setVisited] = useState<Set<string>>(new Set());
  const [marked, setMarked] = useState<Set<string>>(new Set());
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
  const startedAt = useRef<number>(Date.now());
  const paletteRef = useRef<HTMLDivElement>(null);
  const isContest = test?.type === "contest";
  const isMock = test?.type === "mock";


  useEffect(() => {
    if (!authLoading && !user) nav({ to: "/login" });
  }, [user, authLoading, nav]);

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
      const { data: qs } = await supabase.from("questions").select("*").in("id", ids);
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
      // Fetch inline diagrams + option images and embed them as markdown URLs so
      // RichText renders them alongside the question / option text.
      try {
        const admin: any = supabase;
        const [{ data: diags }, { data: optImgs }] = await Promise.all([
          admin.from("question_diagrams").select("id,question_id").in("question_id", ids),
          admin.from("question_option_images").select("question_id,option_index").in("question_id", ids),
        ]);
        const diagsByQ = new Map<string, string[]>();
        for (const d of (diags ?? []) as Array<{ id: string; question_id: string }>) {
          const arr = diagsByQ.get(d.question_id) ?? [];
          arr.push(`/api/public/diagram/${d.id}`);
          diagsByQ.set(d.question_id, arr);
        }
        const optsByQ = new Map<string, Set<number>>();
        for (const oi of (optImgs ?? []) as Array<{ question_id: string; option_index: number }>) {
          const set = optsByQ.get(oi.question_id) ?? new Set<number>();
          set.add(oi.option_index);
          optsByQ.set(oi.question_id, set);
        }
        ordered = ordered.map((q) => {
          const dList = diagsByQ.get(q.id);
          const oSet = optsByQ.get(q.id);
          let text = q.text ?? "";
          if (dList?.length) {
            // Replace [diagram N] tokens or append if none present.
            // IMPORTANT: skip tokens already inside an ![...](...) markdown
            // image (the `!` prefix means the alt text is already embedded).
            let n = 0;
            const replaced = text.replace(/(!?)\[diagram\s*(\d+)?\]/gi, (whole, bang: string) => {
              if (bang === "!") return whole; // already an embedded image, leave it
              const url = dList[n] ?? dList[dList.length - 1];
              n++;
              return `\n\n![diagram](${url})`;
            });
            // Only append fallback images if the text has neither [diagram] tokens
            // nor an already-embedded diagram image.
            const hasEmbedded = /!\[[^\]]*\]\(\/api\/public\/diagram\//i.test(text);
            text = n > 0 || hasEmbedded ? replaced : `${text}\n\n${dList.map((u) => `![diagram](${u})`).join("\n\n")}`;
          }
          const options = (q.options ?? []).map((o, i) => {
            if (!oSet?.has(i)) return o;
            const url = `/api/public/option-image/${q.id}/${i}`;
            const plain = (o ?? "").trim();
            const label = plain && plain !== "[image]" ? plain : "";
            return `${label ? label + "\n\n" : ""}![option](${url})`;
          });
          return { ...q, text, options };
        });
      } catch (e) {
        console.warn("[quiz] failed to load question assets", e);
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
    if (loading || submitted || !isExam) return;
    if (secondsLeft <= 0) {
      submit();
      return;
    }
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secondsLeft, loading, submitted, isExam, submit]);

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
    if (!isContest || !isExam || submitted || contestDone || alreadyAttempted || loading) return;
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
  }, [isContest, isExam, submitted, contestDone, alreadyAttempted, loading, submit]);


  useEffect(() => {
    paletteRef.current
      ?.querySelector<HTMLButtonElement>(`[data-question-index="${idx}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [idx]);

  const q = questions[idx];
  const total = questions.length;
  const progress = total ? ((idx + 1) / total) * 100 : 0;
  const hh = String(Math.floor(secondsLeft / 3600)).padStart(2, "0");
  const mm = String(Math.floor((secondsLeft % 3600) / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");

  // Track "visited" question IDs (NTA CBT palette needs this).
  useEffect(() => {
    if (!q) return;
    setVisited((prev) => (prev.has(q.id) ? prev : new Set(prev).add(q.id)));
  }, [q?.id]);

  // NTA-style status resolver for a question id.
  const cbtStatus = (qid: string): "not_visited" | "not_answered" | "answered" | "marked" | "marked_answered" => {
    const ans = answers[qid] !== undefined;
    const mk = marked.has(qid);
    const vis = visited.has(qid);
    if (mk && ans) return "marked_answered";
    if (mk) return "marked";
    if (ans) return "answered";
    if (vis) return "not_answered";
    return "not_visited";
  };
  const cbtSwatch = (st: ReturnType<typeof cbtStatus>) => {
    switch (st) {
      case "answered": return "bg-emerald-500 text-white border-emerald-600";
      case "not_answered": return "bg-rose-500 text-white border-rose-600";
      case "marked": return "bg-violet-500 text-white border-violet-600";
      case "marked_answered": return "bg-violet-500 text-white border-violet-600 ring-2 ring-emerald-400";
      default: return "bg-card text-foreground border-border";
    }
  };

  const gotoNext = () => setIdx((i) => Math.min(total - 1, i + 1));
  const saveAndNext = () => { gotoNext(); };
  const markForReviewAndNext = () => {
    if (!q) return;
    setMarked((m) => { const n = new Set(m); n.add(q.id); return n; });
    gotoNext();
  };
  const clearResponse = () => {
    if (!q) return;
    setAnswers((a) => { const n = { ...a }; delete n[q.id]; return n; });
    setWrongMarks((w) => { const n = new Set(w); n.delete(q.id); return n; });
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
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
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
        attemptId={attemptId}
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

  const sourceLabel = (q.source || test.source || "").toUpperCase().includes("PYQ")
    ? "NEET PYQ"
    : q.source?.toUpperCase() === "NCERT"
      ? "NCERT"
      : q.source || "NCERT";
  const subjName = q.subject_id ? subjects[q.subject_id] : undefined;
  const chapName = q.chapter_id ? chapters[q.chapter_id] : undefined;

  return (
    <div className={cn("relative flex min-h-screen flex-col bg-background", isCbt && "lg:pr-[340px]")}>



      {isContest && !submitted && !contestDone && !alreadyAttempted && !hasAckedAntiCheat("contest", testId) && (
        <AntiCheatGate
          mode="contest"
          scopeId={testId}
          onAccept={() => { /* unlocks; rules already start enforcing via effects */ }}
          onCancel={() => nav({ to: "/contests" })}
        />
      )}

      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b border-border bg-card">
        <div className="mx-auto grid max-w-3xl grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-4 py-2.5 sm:flex sm:justify-between">
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
                  <span className="shrink-0 rounded-md border border-emerald-300 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 dark:border-emerald-500/40">
                    +{test.marks_correct}/{test.marks_wrong}
                  </span>
                  {isExam && (
                    <span className="shrink-0 rounded-md border border-rose-300 bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-rose-700 dark:text-rose-300 dark:border-rose-500/40">
                      {hh}:{mm}:{ss}
                    </span>
                  )}
                </div>
              );
            })()}
            <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Flag className="h-3 w-3 text-emerald-600" />
              <span className="font-semibold">NEET</span>
              <span className="ml-2">
                Q {idx + 1} / {total}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {!isCbt && (
              <>
                <Button variant="outline" size="icon" onClick={toggleBookmark}
                  aria-label="Bookmark for review" title="Bookmark for review" aria-pressed={bookmarks.has(q.id)}
                  className={cn("shrink-0", bookmarks.has(q.id) && "border-primary bg-primary/10 text-primary")}>
                  <Bookmark className={cn("h-5 w-5", bookmarks.has(q.id) && "fill-current")} />
                </Button>
                <Button size="sm" disabled={submitting} onClick={() => setConfirmSubmit(true)}>
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit"}
                </Button>
              </>
            )}
            <Sheet>
                <SheetTrigger asChild>
                  <button
                    aria-label="Grid view"
                    className="rounded-full p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
                  >
                    <LayoutGrid className="h-5 w-5" />
                  </button>
                </SheetTrigger>
                <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-[50vw] sm:w-[50vw]">
                  <SheetHeader>
                    <SheetTitle>Question Grid</SheetTitle>
                  </SheetHeader>
                  <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
                    {isCbt ? (
                      <>
                        <Legend swatch="bg-emerald-500" label="Answered" />
                        <Legend swatch="bg-rose-500" label="Not Answered" />
                        <Legend swatch="bg-violet-500" label="Marked" />
                        <Legend swatch="bg-violet-500 ring-2 ring-emerald-400" label="Marked & Answered" />
                        <Legend swatch="bg-card border" label="Not Visited" />
                      </>
                    ) : (
                      <>
                        <Legend swatch="bg-emerald-500/30" label="Attempted" />
                        <Legend swatch="bg-blue-500/30" label="Marked" />
                        <Legend swatch="bg-card border" label="Not Attempted" />
                      </>
                    )}
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
                                const cbt = isCbt ? cbtStatus(qq.id) : null;
                                return (
                                  <button
                                    key={qq.id}
                                    onClick={() => setIdx(i)}
                                    className={cn(
                                      "flex h-9 w-9 items-center justify-center rounded-md border text-xs font-semibold",
                                      cbt
                                        ? cbtSwatch(cbt)
                                        : isAns
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
          <div className="h-full bg-emerald-500 transition-all" style={{ width: `${progress}%` }} />
        </div>
        {/* Question palette */}
        <div className="mx-auto max-w-3xl">
          <div
            ref={paletteRef}
            className="flex snap-x flex-nowrap gap-1.5 overflow-x-auto overflow-y-hidden px-4 py-2 [scrollbar-width:thin]"
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
              const cbt = isCbt ? cbtStatus(qq.id) : null;
              return (
                <button
                  key={qq.id}
                  data-question-index={i}
                  onClick={() => setIdx(i)}
                  className={cn(
                    "relative flex h-8 w-8 shrink-0 snap-start items-center justify-center rounded-md border text-xs font-semibold transition",
                    active ? "ring-2 ring-primary/40" : "",
                    cbt
                      ? cbtSwatch(cbt)
                      : isWrong
                        ? "bg-rose-500/10 border-rose-300/60"
                        : isCorrect
                          ? "bg-emerald-500/10 border-emerald-300/60"
                          : isBm
                            ? "bg-blue-500/10 border-blue-300"
                            : "bg-card border-border",
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
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-5">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-foreground text-xs font-bold text-background">
            {idx + 1}
          </span>
          <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground">
            Type: single
          </span>
          <div className="ml-auto">
            <ReportQuestionButton questionId={q.id} />
          </div>
        </div>

        <div className="text-base leading-relaxed sm:text-lg">
          <RichText>{q.text}</RichText>
        </div>

        <div className="mt-4 space-y-2">
          {q.options.map((opt, i) => {
            const selected = answers[q.id] === i;
            const locked = (isChapterPractice || isQuiz) && answers[q.id] !== undefined;
            const isCorrectOpt = locked && i === q.correct_index;
            const isWrongPick = locked && selected && i !== q.correct_index;
            return (
              <button
                key={i}
                onClick={() => !locked && setAnswer(i)}
                disabled={locked}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg border bg-card p-3.5 text-left text-base transition",
                  !locked && "hover:border-primary/50",
                  selected && !locked && "border-primary ring-1 ring-primary/30",
                  isCorrectOpt && "border-emerald-400/60 bg-emerald-500/5",
                  isWrongPick && "border-rose-400/60 bg-rose-500/5",
                  locked && !isCorrectOpt && !isWrongPick && "border-border opacity-90",
                )}
              >
                <span
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-xs font-bold",
                    isCorrectOpt
                      ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                      : isWrongPick
                        ? "bg-rose-500/20 text-rose-700 dark:text-rose-300"
                        : "bg-secondary text-foreground",
                  )}
                >
                  {i + 1}
                </span>
                <span className="h-6 w-px bg-border" />
                <span className="flex-1">
                  <RichText>{opt}</RichText>
                </span>
                <span
                  className={cn(
                    "h-5 w-5 shrink-0 rounded-full border-2",
                    isCorrectOpt
                      ? "border-emerald-400/70 bg-emerald-400/40"
                      : isWrongPick
                        ? "border-rose-400/70 bg-rose-400/40"
                        : selected
                          ? "border-primary bg-primary"
                          : "border-border",
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
              </div>
            ) : (
              <div className="mt-3 text-xs text-muted-foreground">No explanation provided.</div>
            )}
          </div>
        )}
      </main>

      {/* Bottom action */}
      <footer className="sticky bottom-0 border-t border-border bg-card">
        {isCbt ? (
          <div className="mx-auto max-w-3xl px-3 py-2.5">
            {/* NTA-style palette legend + counts */}
            <div className="mb-2 grid grid-cols-5 gap-1 text-[10px]">
              {([
                ["answered","Answered","bg-emerald-500"],
                ["not_answered","Not Answered","bg-rose-500"],
                ["not_visited","Not Visited","bg-card border"],
                ["marked","Marked","bg-violet-500"],
                ["marked_answered","Marked & Answered","bg-violet-500 ring-2 ring-emerald-400"],
              ] as const).map(([k,label,cls]) => {
                const n = questions.filter((qq) => cbtStatus(qq.id) === k).length;
                return (
                  <div key={k} className="flex items-center gap-1 rounded border border-border bg-secondary/40 px-1 py-1">
                    <span className={cn("inline-block h-3 w-3 shrink-0 rounded-sm", cls)} />
                    <span className="truncate">{label}</span>
                    <span className="ml-auto font-bold tabular-nums">{n}</span>
                  </div>
                );
              })}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMarked((m) => { const n = new Set(m); if (n.has(q.id)) n.delete(q.id); else n.add(q.id); return n; })}
                className={cn("h-10", marked.has(q.id) && "border-violet-500 bg-violet-500/10 text-violet-700")}
              >
                {marked.has(q.id) ? "Unmark" : "Mark for Review & Next"}
              </Button>
              <Button variant="outline" size="sm" className="h-10" onClick={clearResponse}>
                Clear Response
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-10"
                disabled={idx === 0}
                onClick={() => setIdx((i) => Math.max(0, i - 1))}
              >
                Previous
              </Button>
              <div className="ml-auto flex gap-2">
                {idx < total - 1 ? (
                  <Button className="h-10 bg-emerald-600 hover:bg-emerald-700" onClick={saveAndNext}>
                    Save &amp; Next
                  </Button>
                ) : (
                  <Button
                    className="h-10 bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => setConfirmSubmit(true)}
                    disabled={submitting}
                  >
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit Test"}
                  </Button>
                )}
              </div>
            </div>
          </div>
        ) : (
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-2 px-4 py-3">
          <Button
            variant="outline"
            size="icon"
            className="h-11 w-11"
            aria-label="Previous question"
            title="Previous question"
            disabled={idx === 0}
            onClick={() => setIdx((i) => Math.max(0, i - 1))}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <Button size="icon" className="h-11 w-11" aria-label="Next question" title="Next question"
            disabled={idx === total - 1} onClick={() => setIdx((i) => Math.min(tot

... [truncated — file is 67197 bytes, showing first 51200]
