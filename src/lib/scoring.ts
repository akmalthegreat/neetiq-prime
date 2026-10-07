// NEET marking: +4 for a correct answer, −1 for a wrong one, 0 for skipped.
// Some imported questions have their marks stored as 0 or empty, which made every
// test score 0. These helpers fall back to the test's marking, then to NEET marking.

export const NEET_CORRECT = 4;
export const NEET_WRONG = -1;

type Marks = { marks_correct?: number | null; marks_wrong?: number | null } | null | undefined;

const num = (v: unknown): number | null => {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
};

/** Marks for one question: its own marks when valid, else the test's, else NEET (+4 / −1). */
export function questionMarks(q: Marks, test?: Marks): { correct: number; wrong: number } {
  const qc = num(q?.marks_correct);
  const tc = num(test?.marks_correct);
  const qw = num(q?.marks_wrong);
  const tw = num(test?.marks_wrong);
  if (qc !== null && qc > 0) {
    return { correct: qc, wrong: qw !== null ? -Math.abs(qw) : tw !== null ? -Math.abs(tw) : NEET_WRONG };
  }
  return {
    correct: tc !== null && tc > 0 ? tc : NEET_CORRECT,
    wrong: tw !== null ? -Math.abs(tw) : NEET_WRONG,
  };
}

/**
 * Score to show for a saved attempt. Attempts saved while question marks were broken
 * have score 0 (or empty) even with correct answers; for those we rebuild the score
 * from the correct / wrong counts with NEET marking.
 */
export function attemptScore(a: { score?: number | string | null; correct_count?: number | null; wrong_count?: number | null } | null | undefined): number {
  const stored = num(a?.score);
  const correct = Number(a?.correct_count ?? 0);
  const wrong = Number(a?.wrong_count ?? 0);
  if ((stored === null || stored === 0) && correct > 0) {
    return correct * NEET_CORRECT + wrong * NEET_WRONG;
  }
  return stored ?? 0;
}
