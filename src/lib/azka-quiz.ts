// Builds a quiz from our own question bank for Miss Azka, the same way the
// Generate Test page does: questions are picked through the signed-in client
// (so the learner can load every one of them), then saved as a custom test.
import { supabase } from "@/integrations/supabase/client";

function shuffle<T>(a: T[]): T[] {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

export async function createAzkaQuiz(opts: {
  userId: string;
  title: string;
  chapterIds: string[];
  count: number;
  difficulty: "Easy" | "Medium" | "Hard" | "Mixed";
  pyqOnly: boolean;
}): Promise<{ testId: string; got: number }> {
  const { userId, chapterIds, count, difficulty, pyqOnly } = opts;
  const per = Math.max(1, Math.ceil(count / chapterIds.length));

  const pick = async (cid: string, strict: boolean) => {
    let q = supabase.from("questions").select("id").eq("chapter_id", cid);
    if (strict && difficulty !== "Mixed") q = q.eq("difficulty", difficulty);
    if (pyqOnly) q = q.eq("is_pyq", true);
    const { data } = await q.limit(per * 4);
    return shuffle(((data ?? []) as { id: string }[]).map((r) => r.id));
  };

  let ids: string[] = [];
  const firstPass = await Promise.all(chapterIds.map((c) => pick(c, true)));
  firstPass.forEach((g) => ids.push(...g.slice(0, per)));
  if (ids.length < count && difficulty !== "Mixed") {
    const more = await Promise.all(chapterIds.map((c) => pick(c, false)));
    ids = Array.from(new Set([...ids, ...more.flat()]));
  }
  ids = shuffle(Array.from(new Set(ids))).slice(0, count);
  if (!ids.length) {
    throw new Error(pyqOnly ? "No PYQs found for this chapter yet. Try without PYQs only." : "No questions found for this chapter yet.");
  }

  const { data: t, error } = await supabase
    .from("tests")
    .insert({
      title: `${opts.title} (${ids.length} Qs)`.slice(0, 140),
      type: "custom",
      difficulty: difficulty === "Mixed" ? "mix" : difficulty,
      duration_min: Math.max(5, ids.length),
      total_questions: ids.length,
      question_ids: ids,
      created_by: userId,
      source: pyqOnly ? "PYQ" : "NCERT",
      marks_correct: 4,
      marks_wrong: -1,
    })
    .select("id")
    .maybeSingle();
  if (error || !t) throw new Error(error?.message ?? "Could not create the quiz");
  return { testId: (t as { id: string }).id, got: ids.length };
}
