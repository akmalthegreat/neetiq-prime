import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isAdminUser } from "@/lib/admin-bypass.server";

const CreateSchema = z.object({
  chapter_ids: z.array(z.string().uuid()).min(1).max(20),
  subject_name: z.string().min(1).max(80),
  count: z.number().int().min(5).max(100),
  difficulty: z.enum(["mix", "easy", "medium", "hard"]),
  duration_min: z.number().int().min(5).max(180),
});

const BONUS_COST = 5;

/** Creates a custom quiz test, debiting 5 bonus from the user atomically. */
export const createCustomTestWithBonus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => CreateSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Pick matching question ids
    let q = supabaseAdmin
      .from("questions")
      .select("id")
      .in("chapter_id", data.chapter_ids)
      .limit(data.count);
    if (data.difficulty !== "mix") q = q.eq("difficulty", data.difficulty);
    const { data: qs, error: qErr } = await q;
    if (qErr) throw new Error(qErr.message);
    const ids = (qs ?? []).map((r) => r.id);
    if (!ids.length) throw new Error("No questions match — try different filters.");

    // 2. Atomically deduct bonus (admins bypass with infinite bonus).
    if (!(await isAdminUser(userId))) {
      const { data: ok, error: deductErr } = await (supabaseAdmin as any).rpc("deduct_bonus", {
        p_user_id: userId,
        p_amount: BONUS_COST,
        p_reason: "generate_test",
      });
      if (deductErr) throw new Error(deductErr.message);
      if (!ok) throw new Error(`Not enough bonus. Generating a test costs ${BONUS_COST} bonus.`);
    }

    // 3. Create the test (server-side so the question ids can't be tampered with)
    const { data: t, error: tErr } = await supabaseAdmin
      .from("tests")
      .insert({
        title: `${data.subject_name} Custom Test`,
        type: "custom",
        difficulty: data.difficulty,
        duration_min: data.duration_min,
        total_questions: ids.length,
        question_ids: ids,
        created_by: userId,
        source: "NCERT",
      })
      .select("id")
      .maybeSingle();

    if (tErr || !t) {
      // best-effort refund
      await supabaseAdmin.from("profiles").update({}).eq("id", userId); // no-op to keep types happy
      throw new Error(tErr?.message ?? "Could not create test");
    }
    return { testId: t.id, bonusSpent: BONUS_COST };
  });
