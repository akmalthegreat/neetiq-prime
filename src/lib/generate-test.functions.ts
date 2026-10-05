import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CreateSchema = z.object({
  chapter_ids: z.array(z.string().uuid()).min(1).max(20),
  subject_name: z.string().min(1).max(80),
  count: z.number().int().min(5).max(100),
  difficulty: z.enum(["mix", "easy", "medium", "hard"]),
  duration_min: z.number().int().min(5).max(180),
});

/** Creates a custom quiz test for users whose plan includes Generate Test. */
export const createCustomTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => CreateSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Check access before looking up or creating any test data.
    const { requireFeature } = await import("@/lib/access.server");
    await requireFeature(userId, "generate_test");

    // 1. Pick matching question ids
    let q = supabase
      .from("questions")
      .select("id")
      .in("chapter_id", data.chapter_ids)
      .limit(data.count);
    if (data.difficulty !== "mix") q = q.eq("difficulty", data.difficulty);
    const { data: qs, error: qErr } = await q;
    if (qErr) throw new Error(qErr.message);
    const ids = (qs ?? []).map((r) => r.id);
    if (!ids.length) throw new Error("No questions match — try different filters.");

    // 3. Create the test (server-side so the question ids can't be tampered with)
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: t, error: tErr } = await supabaseAdmin
      .from("tests")
      .insert({
        title: `${data.subject_name} Custom Test (${ids.length} Qs)`,
        type: "custom",
        difficulty: data.difficulty,
        duration_min: data.duration_min,
        total_questions: ids.length,
        question_ids: ids,
        created_by: userId,
        source: "NCERT",
        marks_correct: 4,
        marks_wrong: -1,
      })
      .select("id")
      .maybeSingle();

    if (tErr || !t) throw new Error(tErr?.message ?? "Could not create test");
    return { testId: t.id, totalQuestions: ids.length };
  });
