import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const CreateSchema = z.object({
  chapter_ids: z.array(z.string().min(1)).min(1).max(20),
  subject_name: z.string().min(1).max(80),
  count: z.number().int().min(5).max(100),
  difficulty: z.enum(["mix", "easy", "medium", "hard"]),
  duration_min: z.number().int().min(5).max(180),
});

/** Creates a custom quiz test server-side. Uses the service client; no user token required. */
export const createCustomTest = createServerFn({ method: "POST" })
  .inputValidator((d) => CreateSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Pick matching question ids (DB stores capitalized difficulty values).
    let q = supabaseAdmin
      .from("questions")
      .select("id")
      .in("chapter_id", data.chapter_ids)
      .limit(data.count);
    if (data.difficulty !== "mix") q = q.ilike("difficulty", data.difficulty);
    const { data: qs, error: qErr } = await q;
    if (qErr) throw new Error(qErr.message);
    const ids = (qs ?? []).map((r) => r.id);
    if (!ids.length) throw new Error("No questions match — try different filters.");

    // 2. Create the test
    const { data: t, error: tErr } = await supabaseAdmin
      .from("tests")
      .insert({
        title: `${data.subject_name} Custom Test (${ids.length} Qs)`,
        type: "custom",
        difficulty: data.difficulty,
        duration_min: data.duration_min,
        total_questions: ids.length,
        question_ids: ids,
        source: "NCERT",
        marks_correct: 4,
        marks_wrong: -1,
      })
      .select("id")
      .maybeSingle();

    if (tErr || !t) throw new Error(tErr?.message ?? "Could not create test");
    return { testId: t.id, totalQuestions: ids.length };
  });
