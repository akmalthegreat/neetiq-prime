// Dr. Azka Consult — pure analytics engine.
// Everything here is calculated from the student's own rows (attempts, questions,
// mistake book). No randomness and no AI: the AI only ever writes text on top of
// these numbers. Keep this file free of I/O so it can be unit-tested.

export type SectionKey = "Physics" | "Chemistry" | "Biology";

/** NEET-UG pattern (2025 onwards): 180 compulsory questions, +4 / −1, 180 minutes. */
export const NEET_SECTIONS: { key: SectionKey; questions: number; maxMarks: number }[] = [
  { key: "Physics", questions: 45, maxMarks: 180 },
  { key: "Chemistry", questions: 45, maxMarks: 180 },
  { key: "Biology", questions: 90, maxMarks: 360 },
];
export const NEET_MAX = 720;
export const NEET_SECONDS_PER_QUESTION = 60; // 180 min / 180 questions

/** Thresholds — shown to students on the report so the logic is transparent. */
export const RULES = {
  chapterMinAnswered: 10, // a chapter needs this many answered questions before we judge it
  strongAccuracy: 75,
  weakAccuracy: 50,
  watchAccuracy: 65,
  sectionMinAnswered: 30, // per section, before a score can be predicted
  windowDays: 120,
};

// ---------- raw input shapes (as read from the database) ----------

export type RawAttempt = {
  id: string;
  answers: Record<string, unknown> | null;
  correct_count: number | null;
  wrong_count: number | null;
  unattempted_count: number | null;
  score: number | null;
  submitted_at: string | null;
  time_taken_sec: number | null;
  test_type: string | null;
  test_title: string | null;
  question_ids: string[] | null;
  total_questions: number | null;
};

export type RawQuestion = {
  id: string;
  subject_id: string | null;
  chapter_id: string | null;
  correct_index: number;
  difficulty: string | null;
};

export type RawMistake = { question_id: string; chapter_id: string | null; created_at: string };

export type Lookups = {
  subjectNames: Map<string, string>; // subject_id -> name
  chapters: Map<string, { name: string; subject_id: string | null }>;
};

// ---------- output shapes ----------

export type Tally = { seen: number; answered: number; correct: number; wrong: number };

export type SectionStat = Tally & {
  key: SectionKey;
  accuracy: number | null; // % of answered that were correct
  attemptRate: number | null; // % of seen that were answered
};

export type ChapterStat = Tally & {
  chapterId: string;
  name: string;
  section: SectionKey | null;
  accuracy: number | null;
  lastSeen: string | null;
  mistakes: number;
};

export type Snapshot = {
  generatedAt: string;
  windowDays: number;
  totals: Tally & {
    tests: number;
    skipped: number;
    accuracy: number | null;
    attemptRate: number | null;
    avgSecPerQuestion: number | null;
    negativeMarksLost: number;
  };
  sections: SectionStat[];
  chapters: ChapterStat[];
  strengths: ChapterStat[];
  weaknesses: ChapterStat[];
  watchlist: ChapterStat[];
  difficulty: { level: string; answered: number; correct: number; accuracy: number | null }[];
  weekly: { weekStart: string; answered: number; accuracy: number | null }[];
  daily: { date: string; questions: number }[];
  consistency: { activeDays7: number; activeDays28: number; streak: number };
  mistakes: { total: number; last7: number; topChapters: { chapterId: string; name: string; count: number }[] };
  mocks: { last30: number; last: { date: string; title: string; score: number; outOf: number } | null };
  lastActivity: string | null;
  dataLevel: "none" | "low" | "medium" | "high";
};

// ---------- helpers ----------

const IST_OFFSET_MS = 330 * 60 * 1000;
/** Calendar day in India (students live in IST; the server runs in UTC). */
export function istDay(iso: string | Date): string {
  const t = typeof iso === "string" ? new Date(iso).getTime() : iso.getTime();
  return new Date(t + IST_OFFSET_MS).toISOString().slice(0, 10);
}
function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function mondayOf(day: string): string {
  const d = new Date(`${day}T00:00:00Z`);
  const dow = d.getUTCDay() || 7;
  return addDays(day, -(dow - 1));
}
export function pct(num: number, den: number): number | null {
  return den > 0 ? Math.round((num / den) * 100) : null;
}
const emptyTally = (): Tally => ({ seen: 0, answered: 0, correct: 0, wrong: 0 });

/** Map any subject name / id to a NEET section. Botany and Zoology are Biology. */
export function sectionOf(label: string | null | undefined): SectionKey | null {
  const s = (label ?? "").toLowerCase();
  if (!s) return null;
  if (s.includes("phys")) return "Physics";
  if (s.includes("chem")) return "Chemistry";
  if (s.includes("bio") || s.includes("bot") || s.includes("zoo")) return "Biology";
  return null;
}

function pickedOption(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function isMock(type: string | null, title: string | null): boolean {
  const t = `${type ?? ""} ${title ?? ""}`.toLowerCase();
  return t.includes("mock") || t.includes("full");
}

// ---------- snapshot ----------

export function buildSnapshot(input: {
  attempts: RawAttempt[];
  questions: Map<string, RawQuestion>;
  lookups: Lookups;
  mistakes: RawMistake[];
  now?: Date;
}): Snapshot {
  const now = input.now ?? new Date();
  const today = istDay(now);
  const { questions, lookups } = input;

  const totals = { ...emptyTally(), tests: 0, skipped: 0 };
  const sections = new Map<SectionKey, Tally>(NEET_SECTIONS.map((s) => [s.key, emptyTally()]));
  const chapters = new Map<string, ChapterStat>();
  const difficulty = new Map<string, { answered: number; correct: number }>();
  const perDay = new Map<string, number>();
  const perWeek = new Map<string, { answered: number; correct: number }>();
  let timedSeconds = 0;
  let timedQuestions = 0;
  let lastActivity: string | null = null;
  let mocksLast30 = 0;
  let lastMock: Snapshot["mocks"]["last"] = null;

  const sectionForQuestion = (q: RawQuestion): SectionKey | null =>
    sectionOf(q.subject_id ? lookups.subjectNames.get(q.subject_id) ?? q.subject_id : null);

  const chapterEntry = (q: RawQuestion): ChapterStat | null => {
    if (!q.chapter_id) return null;
    let c = chapters.get(q.chapter_id);
    if (!c) {
      const meta = lookups.chapters.get(q.chapter_id);
      const subjectLabel = meta?.subject_id ? lookups.subjectNames.get(meta.subject_id) ?? meta.subject_id : null;
      c = {
        ...emptyTally(),
        chapterId: q.chapter_id,
        name: meta?.name ?? "",
        section: sectionOf(subjectLabel) ?? sectionForQuestion(q),
        accuracy: null,
        lastSeen: null,
        mistakes: 0,
      };
      chapters.set(q.chapter_id, c);
    }
    return c;
  };

  for (const a of input.attempts) {
    if (!a.submitted_at) continue;
    totals.tests++;
    const day = istDay(a.submitted_at);
    if (!lastActivity || a.submitted_at > lastActivity) lastActivity = a.submitted_at;

    const answers = a.answers ?? {};
    const answeredIds = Object.keys(answers).filter((id) => pickedOption(answers[id]) !== null);
    const seenIds = new Set<string>([...(a.question_ids ?? []), ...answeredIds]);
    const hasPerQuestion = answeredIds.length > 0;

    let attemptAnswered = 0;
    let attemptCorrect = 0;
    let attemptWrong = 0;
    let attemptSkipped = 0;

    if (hasPerQuestion) {
      for (const qid of seenIds) {
        const picked = pickedOption(answers[qid]);
        const q = questions.get(qid);
        const sec = q ? sectionForQuestion(q) : null;
        const ch = q ? chapterEntry(q) : null;
        const secT = sec ? sections.get(sec)! : null;
        if (secT) secT.seen++;
        if (ch) ch.seen++;
        if (picked === null) { attemptSkipped++; continue; }
        attemptAnswered++;
        if (secT) secT.answered++;
        if (ch) { ch.answered++; if (!ch.lastSeen || a.submitted_at > ch.lastSeen) ch.lastSeen = a.submitted_at; }
        if (!q) continue; // answered but question no longer exists: count in totals only via counters below
        const right = picked === Number(q.correct_index);
        if (right) { attemptCorrect++; if (secT) secT.correct++; if (ch) ch.correct++; }
        else { attemptWrong++; if (secT) secT.wrong++; if (ch) ch.wrong++; }
        const lvl = (q.difficulty ?? "unrated").toLowerCase();
        const d = difficulty.get(lvl) ?? { answered: 0, correct: 0 };
        d.answered++; if (right) d.correct++;
        difficulty.set(lvl, d);
      }
      // Answers whose question row is missing: trust the stored counters for the remainder.
      const unresolved = attemptAnswered - attemptCorrect - attemptWrong;
      if (unresolved > 0) {
        const extraCorrect = Math.max(0, Math.min(unresolved, Number(a.correct_count ?? 0) - attemptCorrect));
        attemptCorrect += extraCorrect;
        attemptWrong += unresolved - extraCorrect;
      }
    } else {
      // Older attempts without per-question answers: use the stored counters.
      attemptCorrect = Number(a.correct_count ?? 0);
      attemptWrong = Number(a.wrong_count ?? 0);
      attemptAnswered = attemptCorrect + attemptWrong;
      attemptSkipped = Number(a.unattempted_count ?? 0);
    }

    totals.answered += attemptAnswered;
    totals.correct += attemptCorrect;
    totals.wrong += attemptWrong;
    totals.skipped += attemptSkipped;
    totals.seen += attemptAnswered + attemptSkipped;

    perDay.set(day, (perDay.get(day) ?? 0) + attemptAnswered);
    const wk = mondayOf(day);
    const w = perWeek.get(wk) ?? { answered: 0, correct: 0 };
    w.answered += attemptAnswered; w.correct += attemptCorrect;
    perWeek.set(wk, w);

    const secs = Number(a.time_taken_sec ?? 0);
    if (secs > 0 && attemptAnswered > 0 && secs / attemptAnswered <= 600) {
      timedSeconds += secs; timedQuestions += attemptAnswered;
    }

    if (isMock(a.test_type, a.test_title)) {
      if (day >= addDays(today, -29)) mocksLast30++;
      if (!lastMock || a.submitted_at > lastMock.date) {
        const outOf = Number(a.total_questions ?? seenIds.size) * 4;
        lastMock = { date: a.submitted_at, title: a.test_title ?? "Mock test", score: Number(a.score ?? 0), outOf };
      }
    }
  }

  // Mistake book
  const mistakeByChapter = new Map<string, number>();
  let mistakes7 = 0;
  for (const m of input.mistakes) {
    if (istDay(m.created_at) >= addDays(today, -6)) mistakes7++;
    const cid = m.chapter_id ?? questions.get(m.question_id)?.chapter_id ?? null;
    if (!cid) continue;
    mistakeByChapter.set(cid, (mistakeByChapter.get(cid) ?? 0) + 1);
    const ch = chapters.get(cid);
    if (ch) ch.mistakes++;
  }

  const chapterList = [...chapters.values()]
    .map((c) => ({ ...c, accuracy: pct(c.correct, c.answered) }))
    .sort((a, b) => b.answered - a.answered);
  // Only named chapters are listed; unnamed ones still count in subject totals.
  const judged = chapterList.filter((c) => c.name && c.answered >= RULES.chapterMinAnswered && c.accuracy !== null);
  const strengths = judged
    .filter((c) => c.accuracy! >= RULES.strongAccuracy)
    .sort((a, b) => b.accuracy! - a.accuracy! || b.answered - a.answered)
    .slice(0, 8);
  const weaknesses = judged
    .filter((c) => c.accuracy! < RULES.weakAccuracy)
    .sort((a, b) => a.accuracy! - b.accuracy! || b.answered - a.answered)
    .slice(0, 8);
  const watchlist = judged
    .filter((c) => c.accuracy! >= RULES.weakAccuracy && c.accuracy! < RULES.watchAccuracy)
    .sort((a, b) => a.accuracy! - b.accuracy!)
    .slice(0, 8);

  // Streak (IST days with at least one submitted test)
  let streak = 0;
  let cursor = perDay.has(today) ? today : addDays(today, -1);
  while (perDay.has(cursor)) { streak++; cursor = addDays(cursor, -1); }
  const activeIn = (n: number) => [...perDay.keys()].filter((d) => d >= addDays(today, -(n - 1))).length;

  const daily: Snapshot["daily"] = [];
  for (let i = 27; i >= 0; i--) {
    const d = addDays(today, -i);
    daily.push({ date: d, questions: perDay.get(d) ?? 0 });
  }
  const weekly: Snapshot["weekly"] = [];
  const thisMonday = mondayOf(today);
  for (let i = 7; i >= 0; i--) {
    const wk = addDays(thisMonday, -7 * i);
    const w = perWeek.get(wk);
    weekly.push({ weekStart: wk, answered: w?.answered ?? 0, accuracy: w ? pct(w.correct, w.answered) : null });
  }

  const order = ["easy", "medium", "hard"];
  const difficultyList = [...difficulty.entries()]
    .map(([level, v]) => ({ level, answered: v.answered, correct: v.correct, accuracy: pct(v.correct, v.answered) }))
    .sort((a, b) => {
      const rank = (l: string) => (order.indexOf(l) === -1 ? 99 : order.indexOf(l));
      return rank(a.level) - rank(b.level);
    });

  const sectionList: SectionStat[] = NEET_SECTIONS.map(({ key }) => {
    const t = sections.get(key)!;
    return { key, ...t, accuracy: pct(t.correct, t.answered), attemptRate: pct(t.answered, t.seen) };
  });

  const answered = totals.answered;
  const dataLevel: Snapshot["dataLevel"] =
    answered === 0 ? "none" : answered < 150 ? "low" : answered < 600 ? "medium" : "high";

  return {
    generatedAt: now.toISOString(),
    windowDays: RULES.windowDays,
    totals: {
      ...totals,
      accuracy: pct(totals.correct, totals.answered),
      attemptRate: pct(totals.answered, totals.seen),
      avgSecPerQuestion: timedQuestions > 0 ? Math.round(timedSeconds / timedQuestions) : null,
      negativeMarksLost: totals.wrong,
    },
    sections: sectionList,
    chapters: chapterList,
    strengths,
    weaknesses,
    watchlist,
    difficulty: difficultyList,
    weekly,
    daily,
    consistency: { activeDays7: activeIn(7), activeDays28: activeIn(28), streak },
    mistakes: {
      total: input.mistakes.length,
      last7: mistakes7,
      topChapters: [...mistakeByChapter.entries()]
        .map(([chapterId, count]) => ({ chapterId, count, name: lookups.chapters.get(chapterId)?.name ?? "" }))
        .filter((c) => c.name)
        .sort((a, b) => b.count - a.count)
        .slice(0, 5),
    },
    mocks: { last30: mocksLast30, last: lastMock },
    lastActivity,
    dataLevel,
  };
}

// ---------- score prediction ----------

export type SectionPrediction = {
  key: SectionKey;
  maxMarks: number;
  ready: boolean;
  answered: number;
  needed: number;
  accuracy: number | null;
  attemptRate: number | null;
  expected: number;
  low: number;
  high: number;
};

export type Prediction = {
  ready: boolean;
  expected: number;
  low: number;
  high: number;
  confidence: "low" | "medium" | "high";
  basedOn: number;
  sections: SectionPrediction[];
  levers: { label: string; detail: string; gain: number }[];
};

/**
 * Expected NEET marks from the student's own accuracy and attempt rate.
 * Per question: answer with probability r; if answered, +4 with probability a, −1 otherwise.
 * Expected marks per question = r × (4a − (1 − a)) = r × (5a − 1).
 * The range is an 80% band on accuracy (±1.28 standard errors, never narrower than ±3 points),
 * so a student with little data gets a wide, honest range.
 */
export function predictScore(s: Snapshot): Prediction {
  const sections: SectionPrediction[] = NEET_SECTIONS.map(({ key, questions: n, maxMarks }) => {
    const st = s.sections.find((x) => x.key === key)!;
    const answered = st.answered;
    const ready = answered >= RULES.sectionMinAnswered;
    const a = answered > 0 ? st.correct / answered : 0;
    const r = st.seen > 0 ? Math.min(1, answered / st.seen) : 1;
    const se = answered > 0 ? Math.sqrt((a * (1 - a)) / answered) : 0.5;
    const spread = Math.max(0.03, 1.28 * se);
    const marks = (acc: number) => answered === 0 ? 0 : Math.round(n * r * (5 * Math.min(1, Math.max(0, acc)) - 1));
    return {
      key, maxMarks, ready, answered,
      needed: Math.max(0, RULES.sectionMinAnswered - answered),
      accuracy: st.accuracy, attemptRate: st.attemptRate,
      expected: marks(a), low: marks(a - spread), high: marks(a + spread),
    };
  });

  const sum = (f: (p: SectionPrediction) => number) => sections.reduce((t, p) => t + f(p), 0);
  const clamp = (v: number) => Math.max(-180, Math.min(NEET_MAX, v));
  const minAnswered = Math.min(...sections.map((p) => p.answered));
  const confidence: Prediction["confidence"] = minAnswered >= 300 ? "high" : minAnswered >= 100 ? "medium" : "low";

  // What-if levers, computed from the same model
  const levers: Prediction["levers"] = [];
  const wrongPerExam = NEET_SECTIONS.reduce((t, { key, questions: n }) => {
    const st = s.sections.find((x) => x.key === key)!;
    if (!st.answered) return t;
    const r = st.seen > 0 ? st.answered / st.seen : 1;
    return t + n * r * (st.wrong / st.answered);
  }, 0);
  if (wrongPerExam >= 4) {
    const gain = Math.round(wrongPerExam / 2);
    levers.push({
      label: "Stop guessing",
      detail: `About ${Math.round(wrongPerExam)} answers per paper are wrong at your current accuracy. Skipping half of those guesses saves the −1 on each.`,
      gain,
    });
  }
  const readySections = sections.filter((p) => p.ready && p.accuracy !== null);
  if (readySections.length) {
    const weakest = [...readySections].sort((x, y) => x.accuracy! - y.accuracy!)[0];
    const n = NEET_SECTIONS.find((x) => x.key === weakest.key)!.questions;
    const r = (weakest.attemptRate ?? 100) / 100;
    const gain = Math.round(n * r * 5 * 0.1);
    if (weakest.accuracy! < 95) {
      levers.push({
        label: `Lift ${weakest.key} by 10 points`,
        detail: `${weakest.key} is your lowest-accuracy section (${weakest.accuracy}%). Taking it to ${Math.min(100, weakest.accuracy! + 10)}% adds this many marks.`,
        gain,
      });
    }
  }
  const lowAttempt = sections.filter((p) => p.ready && (p.attemptRate ?? 100) < 90 && (p.accuracy ?? 0) >= 60);
  for (const p of lowAttempt) {
    const n = NEET_SECTIONS.find((x) => x.key === p.key)!.questions;
    const extra = n * ((90 - (p.attemptRate ?? 90)) / 100);
    const a = (p.accuracy ?? 0) / 100;
    const gain = Math.round(extra * (5 * a - 1));
    if (gain > 0) {
      levers.push({
        label: `Attempt more ${p.key}`,
        detail: `You skip ${100 - (p.attemptRate ?? 100)}% of ${p.key} questions but get ${p.accuracy}% right when you answer. Attempting up to 90% is worth it.`,
        gain,
      });
    }
  }

  return {
    ready: sections.every((p) => p.ready),
    expected: clamp(sum((p) => p.expected)),
    low: clamp(sum((p) => p.low)),
    high: clamp(sum((p) => p.high)),
    confidence,
    basedOn: sum((p) => p.answered),
    sections,
    levers: levers.sort((x, y) => y.gain - x.gain).slice(0, 3),
  };
}

// ---------- recommendations ----------

export type Recommendation = {
  id: string;
  tone: "critical" | "improve" | "keep";
  title: string;
  detail: string;
  action?: { label: string; to: string };
};

export function buildRecommendations(s: Snapshot, p: Prediction): Recommendation[] {
  const out: Recommendation[] = [];
  const t = s.totals;

  if (s.dataLevel === "none") {
    return [{
      id: "start",
      tone: "improve",
      title: "Take your first test",
      detail: "Dr. Azka needs your real answers to analyse you. Start with a 30-question test in any subject.",
      action: { label: "Generate a test", to: "/generate" },
    }];
  }

  const weak = s.weaknesses[0];
  if (weak) {
    out.push({
      id: "weak-chapter",
      tone: "critical",
      title: `Fix ${weak.name} first`,
      detail: `${weak.accuracy}% accuracy over ${weak.answered} questions. Re-read the NCERT section, then solve 40 fresh questions on it before moving on.`,
      action: { label: "Practise this chapter", to: "/generate" },
    });
  }

  if (t.answered >= 50 && t.wrong / t.answered >= 0.35) {
    out.push({
      id: "negative",
      tone: "critical",
      title: "Negative marking is costing you",
      detail: `${Math.round((t.wrong / t.answered) * 100)}% of your answers are wrong, and each costs −1 in NEET. Answer only when you can rule out at least two options.`,
    });
  }

  const ranked = s.sections.filter((x) => x.answered >= RULES.sectionMinAnswered && x.accuracy !== null)
    .sort((a, b) => a.accuracy! - b.accuracy!);
  if (ranked.length >= 2 && ranked[ranked.length - 1].accuracy! - ranked[0].accuracy! >= 10) {
    const lo = ranked[0]; const hi = ranked[ranked.length - 1];
    out.push({
      id: "section-gap",
      tone: "improve",
      title: `Close the ${lo.key} gap`,
      detail: `${lo.key} is at ${lo.accuracy}% while ${hi.key} is at ${hi.accuracy}%. Give ${lo.key} an extra practice block every day this week.`,
      action: { label: "Start practice", to: "/generate" },
    });
  }
  const missing = p.sections.filter((x) => !x.ready);
  if (missing.length) {
    out.push({
      id: "coverage",
      tone: "improve",
      title: "Practise every section",
      detail: `Answer ${missing.map((m) => `${m.needed} more ${m.key}`).join(", ")} question${missing.length > 1 ? "s" : ""} to unlock a full score prediction.`,
      action: { label: "Generate a test", to: "/generate" },
    });
  }

  if (s.mistakes.total >= 20) {
    const top = s.mistakes.topChapters[0];
    out.push({
      id: "mistakes",
      tone: "improve",
      title: "Revise your Mistake Book",
      detail: `${s.mistakes.total} questions are saved in your Mistake Book${top ? `, most from ${top.name} (${top.count})` : ""}. Re-solve them without looking at the answers.`,
      action: { label: "Open Mistake Book", to: "/mistakes" },
    });
  }

  const pace = t.avgSecPerQuestion;
  if (pace !== null && pace > NEET_SECONDS_PER_QUESTION + 15) {
    out.push({
      id: "speed",
      tone: "improve",
      title: "Build exam speed",
      detail: `You take ${pace}s per question; NEET gives you ${NEET_SECONDS_PER_QUESTION}s. Practise timed sets of 45 questions in 45 minutes.`,
      action: { label: "Timed test", to: "/generate" },
    });
  } else if (pace !== null && pace < 35 && (t.accuracy ?? 0) < 60) {
    out.push({
      id: "rushing",
      tone: "improve",
      title: "Slow down slightly",
      detail: `You average ${pace}s per question with ${t.accuracy}% accuracy. Read every option before answering — you have time to spare.`,
    });
  }

  if (s.consistency.activeDays7 < 4) {
    out.push({
      id: "consistency",
      tone: "improve",
      title: "Practise every day",
      detail: `You practised on ${s.consistency.activeDays7} of the last 7 days. Daily practice, even 30 questions, beats long sessions twice a week.`,
      action: { label: "Today's DPP", to: "/dpp" },
    });
  }

  if (s.mocks.last30 === 0 && t.answered >= 150) {
    out.push({
      id: "mock",
      tone: "improve",
      title: "Take a full mock this week",
      detail: "No full-length mock in the last 30 days. Sit one on Sunday 2–5 PM, the same slot as the real NEET.",
      action: { label: "Mock tests", to: "/mocks" },
    });
  }

  const strong = s.strengths[0];
  if (strong) {
    out.push({
      id: "strength",
      tone: "keep",
      title: `Keep ${strong.name} sharp`,
      detail: `${strong.accuracy}% over ${strong.answered} questions. A 20-question revision set once a week is enough to hold it.`,
    });
  }

  return out.slice(0, 6);
}
