// Target 700 Batch: shared content for the test-series pages.

export const T700 = {
  slug: "target-700",
  name: "Target 700 Batch",
  tagline: "The must-solve test series for 700+ in NEET",
  pdf: "/target-700/Target-700-Test-Schedule.pdf",
  totalTests: 46,
  totalQuestions: 8280,
};

export type T700Group = "c11" | "c12" | "full";

export const T700_PHASES: { group: T700Group; title: string; range: string; blurb: string }[] = [
  { group: "c11", title: "Phase 1 · Class 11", range: "Tests 01–08", blurb: "Class 11 in four parts, combined tests after every two parts, then two complete Class 11 papers." },
  { group: "c12", title: "Phase 2 · Class 12", range: "Tests 09–16", blurb: "The same proven build-up for Class 12: part tests, combined tests, then two complete Class 12 papers." },
  { group: "full", title: "Phase 3 · Full Syllabus", range: "Tests 17–46", blurb: "30 full NEET papers on Class 11 + 12 with real NEET chapter weightage." },
];

export const T700_SECTIONS = [
  { key: "physics", name: "Physics", range: "Q 1 – 45", color: "#38BDF8" },
  { key: "chemistry", name: "Chemistry", range: "Q 46 – 90", color: "#A78BFA" },
  { key: "botany", name: "Botany", range: "Q 91 – 135", color: "#34D399" },
  { key: "zoology", name: "Zoology", range: "Q 136 – 180", color: "#FBBF24" },
] as const;

export const T700_HIGHLIGHTS = [
  "Exact NEET pattern: 180 questions, 180 minutes, 720 marks",
  "8,280 handpicked questions, no repeats across the series",
  "All NEET question types: statement-based, assertion-reason, match the column, graph & figure",
  "Easy, moderate and tough questions in NEET proportion, getting tougher phase by phase",
  "Detailed solution for every question after you submit",
];

/** NTA-style general instructions, adapted to the online CBT screen. */
export const T700_INSTRUCTIONS: { title: string; points: string[] }[] = [
  {
    title: "General",
    points: [
      "The duration of the test is 3 hours (180 minutes). The countdown timer at the top of the screen shows the time left. The test is submitted automatically when the time is over.",
      "The paper has 180 questions. All questions are compulsory. There is no optional section.",
      "Physics: Q 1–45 · Chemistry: Q 46–90 · Botany: Q 91–135 · Zoology: Q 136–180. Botany and Zoology appear together under the Biology section.",
      "Each question has four options. Only one option is correct.",
    ],
  },
  {
    title: "Marking scheme",
    points: [
      "+4 marks for every correct answer.",
      "−1 mark for every incorrect answer.",
      "0 marks for a question that is not answered. Maximum marks: 720.",
      "Only one answer is accepted for a question. Choosing more than one is not possible.",
    ],
  },
  {
    title: "Answering a question",
    points: [
      "Tap an option to choose it, then tap Save & Next to save the answer and go to the next question.",
      "Clear removes the option you chose for the current question.",
      "Save & Mark saves your answer and marks the question for review. Mark & Next marks it for review without saving an answer.",
      "Questions marked for review that also have an answer are counted for evaluation.",
      "You can move between questions with Back and Next, or jump to any question from the question palette, and change an answer any time before submitting.",
    ],
  },
  {
    title: "Question palette",
    points: [
      "Not Visited: you have not opened the question yet.",
      "Not Answered: you opened the question but have not answered it.",
      "Answered: you have answered the question.",
      "Marked for Review: you marked the question to look at again and have not answered it.",
      "Answered & Marked: you answered and also marked the question for review.",
    ],
  },
  {
    title: "Exam conduct",
    points: [
      "Sit the test in one go, in a quiet place, like the real exam. Keep a pen and blank sheets ready for rough work.",
      "Calculators, mobile phones (other than the device you are testing on), books, notes and any other help are not allowed. Your rank is only meaningful if you follow this.",
      "Do not close or refresh the test window. Make sure your internet and battery will last 3 hours.",
      "After submitting you will see your score, accuracy, time analysis and detailed solutions for all 180 questions.",
    ],
  },
];

export type T700Test = {
  id: string;
  title: string;
  description: string | null;
  series_seq: number;
  series_label: string;
  series_group: T700Group;
  syllabus: { subjectId: string; subjectName: string; chapters: { id: string; name: string }[] }[] | null;
};

export const testKind = (label: string) =>
  label.includes("Parts") ? "Combined" : label.includes("Full Class") ? "Full Class" : label.startsWith("Full Syllabus") ? "Full Syllabus" : "Part Test";
