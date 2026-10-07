// Dr. Azka Study Plan — deterministic timetable skeleton.
// The code decides the time slots (so hours always add up and breaks are real);
// the AI only fills in WHAT to study in each slot, from the student's real data.

import type { SectionKey, Snapshot } from "./insights-engine";

export type Intensity = "standard" | "intensive" | "dropper";
export type StudyMode = "coaching" | "self";

export type BlockKind =
  | "lecture" | "revision" | "practice" | "module" | "ncert" | "pyq"
  | "mistakes" | "notes" | "mock" | "analysis" | "break";

export type PlanBlock = {
  id: string;
  start: string; // "HH:MM"
  end: string;
  minutes: number;
  kind: BlockKind;
  subject: SectionKey | "Mixed" | null;
  label: string; // slot type, e.g. "Lecture 2"
  title: string; // what to study (filled by AI or fallback)
  details: string;
};

export type PlanDay = {
  day: number;
  date: string; // YYYY-MM-DD
  weekday: string;
  isMockDay: boolean;
  theme: string;
  studyMinutes: number;
  lectureMinutes: number;
  selfStudyMinutes: number;
  blocks: PlanBlock[];
  motivation_note: string;
  // Fields kept for the existing AI Path page (backwards compatible):
  focus_subject: string;
  topics: string[];
  daily_tasks: string[];
  time_min: number;
};

export const INTENSITY_INFO: Record<Intensity, { label: string; hours: string; who: string; lectures: number }> = {
  standard: { label: "Standard", hours: "8–9 h", who: "Balanced pace, 2 lectures a day", lectures: 2 },
  intensive: { label: "Intensive", hours: "10–11 h", who: "Serious preparation, 3 lectures a day", lectures: 3 },
  dropper: { label: "Dropper", hours: "12–13 h", who: "Full-time NEET prep, 4 lectures a day", lectures: 4 },
};

export const KIND_LABEL: Record<BlockKind, string> = {
  lecture: "Lecture",
  revision: "Revision",
  practice: "DPP practice",
  module: "Module / question practice",
  ncert: "NCERT reading",
  pyq: "PYQ practice",
  mistakes: "Mistake Book review",
  notes: "Short notes",
  mock: "Full mock test",
  analysis: "Mock analysis",
  break: "Break",
};

type Slot = [minutes: number, kind: BlockKind, label?: string, optionalFor?: Intensity[]];

const W = (label: string): Slot => [30, "break", label];

const DAY_TEMPLATES: Record<Intensity, Slot[]> = {
  // 6 h lectures + ~6¾ h self-study = 12 h 45 min
  dropper: [
    W("Wake up & freshen up"), [60, "revision", "Morning revision"], W("Breakfast"),
    [90, "lecture", "Lecture 1"], [15, "break", "Short break"], [90, "lecture", "Lecture 2"],
    [60, "practice", "DPP on today's lectures"], [45, "break", "Lunch & rest"],
    [90, "lecture", "Lecture 3"], [15, "break", "Short break"], [90, "lecture", "Lecture 4"],
    W("Snack & short walk"), [90, "module", "Module practice"], [60, "ncert", "NCERT reading"],
    [45, "break", "Dinner"], [60, "pyq", "PYQ practice"], [45, "mistakes", "Mistake Book"], [30, "notes", "Short notes"],
  ],
  // 4½ h lectures + ~6¼ h self-study = 10 h 45 min
  intensive: [
    W("Wake up & freshen up"), [60, "revision", "Morning revision"], W("Breakfast"),
    [90, "lecture", "Lecture 1"], [15, "break", "Short break"], [90, "lecture", "Lecture 2"],
    [60, "practice", "DPP on today's lectures"], [45, "break", "Lunch & rest"],
    [90, "lecture", "Lecture 3"], W("Snack & short walk"), [90, "module", "Module practice"],
    [60, "ncert", "NCERT reading"], [45, "break", "Dinner"], [60, "pyq", "PYQ practice"], [45, "mistakes", "Mistake Book"],
  ],
  // 3 h lectures + ~5¾ h self-study = 8 h 45 min
  standard: [
    W("Wake up & freshen up"), [45, "revision", "Morning revision"], W("Breakfast"),
    [90, "lecture", "Lecture 1"], [15, "break", "Short break"], [90, "lecture", "Lecture 2"],
    [60, "practice", "DPP on today's lectures"], [60, "break", "Lunch & rest"],
    [90, "module", "Module practice"], [15, "break", "Short break"], [60, "ncert", "NCERT reading"],
    [45, "pyq", "PYQ practice"], [45, "break", "Dinner"], [45, "mistakes", "Mistake Book"],
  ],
};

// Sunday: full mock at 2:00 PM — the real NEET slot. The lunch break (FLEX) stretches
// or shrinks so the mock always starts at 14:00, whatever the wake-up time.
const FLEX = -1;
const MOCK_START = 14 * 60;
const MOCK_DAY: Slot[] = [
  W("Wake up & freshen up"), [90, "revision", "Weekly revision"], W("Breakfast"),
  [90, "ncert", "NCERT reading", ["standard"]], [15, "break", "Short break"],
  [60, "notes", "Formula & short-notes revision"], [45, "pyq", "Light PYQ warm-up"],
  [FLEX, "break", "Lunch & rest — stay fresh for the mock"],
  [180, "mock", "Full NEET mock (180 Qs · 3 h)"], W("Break"),
  [120, "analysis", "Mock analysis"], [45, "break", "Dinner"], [60, "mistakes", "Mistake Book + next-week targets"],
];

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}
function fmt(mins: number): string {
  const m = ((mins % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}
function addDaysIso(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function lectureSubjects(intensity: Intensity, dayIdx: number): (SectionKey)[] {
  if (intensity === "dropper") return ["Physics", "Chemistry", "Biology", "Biology"];
  if (intensity === "intensive") return ["Physics", "Chemistry", "Biology"];
  return dayIdx % 2 === 0 ? ["Physics", "Biology"] : ["Chemistry", "Biology"];
}

/** Weakest section first, by accuracy from the student's own answers. */
export function sectionPriority(s: Snapshot): SectionKey[] {
  const known = s.sections.filter((x) => x.accuracy !== null && x.answered >= 15);
  const unknown = s.sections.filter((x) => !(x.accuracy !== null && x.answered >= 15));
  return [
    ...unknown.map((x) => x.key),
    ...known.sort((a, b) => a.accuracy! - b.accuracy!).map((x) => x.key),
  ];
}

export function buildSkeleton(opts: {
  intensity: Intensity;
  mode: StudyMode;
  wake: string; // "HH:MM"
  startDate: string; // YYYY-MM-DD (IST)
  snapshot: Snapshot;
}): PlanDay[] {
  const priority = sectionPriority(opts.snapshot);
  const days: PlanDay[] = [];
  for (let i = 0; i < 7; i++) {
    const date = addDaysIso(opts.startDate, i);
    const weekdayIdx = new Date(`${date}T00:00:00Z`).getUTCDay();
    const isMockDay = weekdayIdx === 0; // Sunday
    const template = (isMockDay ? MOCK_DAY : DAY_TEMPLATES[opts.intensity])
      .filter(([, , , skip]) => !skip?.includes(opts.intensity));
    const lecSubjects = lectureSubjects(opts.intensity, i);
    let lecIdx = 0;
    let t = toMinutes(opts.wake);
    const weakFocus = priority[i % priority.length];
    const ncertSubject: SectionKey = i % 3 === 2 ? "Chemistry" : "Biology";
    const pyqSubject = priority[(i + 1) % priority.length];

    const blocks: PlanBlock[] = template.map(([rawMinutes, kind, label], j) => {
      const minutes = rawMinutes === FLEX ? Math.max(45, MOCK_START - t) : rawMinutes;
      let subject: PlanBlock["subject"] = null;
      let slotLabel = label ?? KIND_LABEL[kind];
      if (kind === "lecture") {
        subject = lecSubjects[lecIdx++] ?? "Biology";
        if (opts.mode === "self") slotLabel = slotLabel.replace("Lecture", "Concept study");
      } else if (kind === "module") subject = weakFocus;
      else if (kind === "ncert") subject = ncertSubject;
      else if (kind === "pyq") subject = pyqSubject;
      else if (kind === "practice" || kind === "revision" || kind === "mistakes" || kind === "notes") subject = "Mixed";
      else if (kind === "mock" || kind === "analysis") subject = "Mixed";
      const b: PlanBlock = {
        id: `d${i + 1}b${j + 1}`,
        start: fmt(t), end: fmt(t + minutes), minutes, kind, subject,
        label: slotLabel, title: kind === "break" ? slotLabel : "", details: "",
      };
      t += minutes;
      return b;
    });

    const study = blocks.filter((b) => b.kind !== "break");
    const lectureMinutes = study.filter((b) => b.kind === "lecture").reduce((x, b) => x + b.minutes, 0);
    const studyMinutes = study.reduce((x, b) => x + b.minutes, 0);
    days.push({
      day: i + 1, date, weekday: WEEKDAYS[weekdayIdx], isMockDay,
      theme: isMockDay ? "Mock test day" : `Focus: ${weakFocus}`,
      studyMinutes, lectureMinutes, selfStudyMinutes: studyMinutes - lectureMinutes,
      blocks, motivation_note: "",
      focus_subject: "", topics: [], daily_tasks: [], time_min: studyMinutes,
    });
  }
  return days;
}

/** Deterministic content, used when the AI is unavailable and as the AI's starting point. */
export function fallbackFill(days: PlanDay[], s: Snapshot): PlanDay[] {
  const weakBySection = (sec: SectionKey | "Mixed" | null) =>
    [...s.weaknesses, ...s.watchlist].filter((c) => sec === "Mixed" || !sec || c.section === sec);
  const mistakeTop = s.mistakes.topChapters;
  return days.map((d, di) => ({
    ...d,
    motivation_note: d.motivation_note || (d.isMockDay
      ? "Treat today exactly like NEET day: same time, no phone, OMR discipline."
      : "Consistency beats intensity. Finish every block, even if one runs short."),
    blocks: d.blocks.map((b) => {
      if (b.kind === "break" || b.title) return b;
      const weak = weakBySection(b.subject)[di % Math.max(1, weakBySection(b.subject).length)];
      const sub = b.subject && b.subject !== "Mixed" ? b.subject : "";
      switch (b.kind) {
        case "lecture":
          return { ...b, title: `${b.subject}: next lecture in your sequence`, details: "Make your own notes in the margin; mark every doubt to clear the same day." };
        case "revision":
          return { ...b, title: d.isMockDay ? "Revise this week's notes" : "Revise yesterday's lecture notes", details: "Close the notes and recall each key point; re-read only what you missed." };
        case "practice":
          return { ...b, title: "DPP on today's lectures", details: "30 questions from today's topics. Target 80%+ accuracy." };
        case "module":
          return { ...b, title: weak ? `${sub || weak.section}: ${weak.name}` : `${sub} module practice`, details: weak ? `Your accuracy here is ${weak.accuracy}% over ${weak.answered} Qs. Solve 40 questions, read every solution.` : "Solve 40 module questions from your current chapter." };
        case "ncert":
          return { ...b, title: `${sub} NCERT line-by-line`, details: "Read one topic slowly, underline facts and diagrams, then answer 15 NCERT-based questions." };
        case "pyq":
          return { ...b, title: `${sub} previous-year questions`, details: "Solve 30 PYQs in timed mode (1 min per question)." };
        case "mistakes":
          return { ...b, title: mistakeTop[0] ? `Mistake Book — ${mistakeTop[0].name}` : "Mistake Book review", details: "Re-solve saved mistakes without looking at answers. Note why each was wrong." };
        case "notes":
          return { ...b, title: "Formula & key-point sheet", details: "Write a one-page summary of today's chapters." };
        case "mock":
          return { ...b, title: "Full NEET mock", details: "180 questions, 3 hours, no breaks. Use an OMR-style sheet." };
        case "analysis":
          return { ...b, title: "Analyse every wrong and skipped question", details: "Classify each error: concept gap, silly mistake, or time pressure. Add them to the Mistake Book." };
        default:
          return b;
      }
    }),
  }));
}

/** Fill the fields the existing AI Path page reads, so old screens keep working. */
export function finalizeCompat(days: PlanDay[]): PlanDay[] {
  return days.map((d) => {
    const study = d.blocks.filter((b) => b.kind !== "break");
    const subjects = [...new Set(d.blocks.filter((b) => b.kind === "lecture").map((b) => b.subject))].filter(Boolean);
    return {
      ...d,
      focus_subject: d.isMockDay ? "Full mock test" : subjects.join(" · ") || "Mixed",
      topics: [...new Set(study.filter((b) => b.kind === "lecture" || b.kind === "module").map((b) => b.title))].slice(0, 4),
      daily_tasks: study.map((b) => `${b.start}–${b.end} · ${b.label}: ${b.title}`),
      time_min: d.studyMinutes,
    };
  });
}
