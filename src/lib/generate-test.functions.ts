import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isAdminUser } from "@/lib/admin-bypass.server";

const CreateSchema = z.object({
  chapter_ids: z.array(z.string().min(1)).min(1).max(1000),
  subject_name: z.string().min(1).max(120),
  count: z.number().int().min(1).max(180),
  difficulty: z.enum(["mix", "easy", "medium", "hard"]),
  duration_min: z.number().int().min(5).max(360),
  chapter_distribution: z.record(z.string(), z.number().int().min(1).max(180)).optional(),
});

const BONUS_COST = 5;

function shuffle<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Creates a custom quiz test, debiting 5 bonus from the user atomically. */
export const createCustomTestWithBonus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => CreateSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const diffFilter = data.difficulty !== "mix" ? data.difficulty : null;
    let selectedIds: string[] = [];

    // 1. If explicit per-chapter distribution is provided
    if (data.chapter_distribution && Object.keys(data.chapter_distribution).length > 0) {
      for (const [chapId, requestedCount] of Object.entries(data.chapter_distribution)) {
        if (!requestedCount || requestedCount <= 0) continue;
        let query = supabaseAdmin
          .from("questions")
          .select("id")
          .eq("chapter_id", chapId);

        if (diffFilter) {
          query = query.ilike("difficulty", diffFilter);
        }

        const { data: matched, error: mErr } = await query.limit(requestedCount * 3);
        if (mErr) throw new Error(mErr.message);

        let ids = (matched ?? []).map((r) => r.id);

        // Fallback: if not enough difficulty-matched questions, fetch any questions from this chapter
        if (ids.length < requestedCount && diffFilter) {
          const { data: fallback } = await supabaseAdmin
            .from("questions")
            .select("id")
            .eq("chapter_id", chapId)
            .limit(requestedCount * 2);
          const fallbackIds = (fallback ?? []).map((r) => r.id);
          ids = Array.from(new Set([...ids, ...fallbackIds]));
        }

        selectedIds.push(...shuffle(ids).slice(0, requestedCount));
      }
    } else {
      // 2. Uniform / balanced distribution across selected chapters
      const chapCount = data.chapter_ids.length;
      const targetPerChap = Math.max(1, Math.ceil(data.count / chapCount));

      // Fetch in parallel chunks for selected chapters
      const fetchPromises = data.chapter_ids.map(async (chapId) => {
        let q = supabaseAdmin
          .from("questions")
          .select("id")
          .eq("chapter_id", chapId);
        if (diffFilter) {
          q = q.ilike("difficulty", diffFilter);
        }
        const { data: rows } = await q.limit(targetPerChap * 2);
        let ids = (rows ?? []).map((r) => r.id);

        if (ids.length < targetPerChap && diffFilter) {
          const { data: fallback } = await supabaseAdmin
            .from("questions")
            .select("id")
            .eq("chapter_id", chapId)
            .limit(targetPerChap * 2);
          const fIds = (fallback ?? []).map((r) => r.id);
          ids = Array.from(new Set([...ids, ...fIds]));
        }

        return shuffle(ids).slice(0, targetPerChap);
      });

      const chunkResults = await Promise.all(fetchPromises);
      for (const chunk of chunkResults) {
        selectedIds.push(...chunk);
      }

      // If still fewer than data.count, backfill from any selected chapters
      if (selectedIds.length < data.count) {
        let backfillQ = supabaseAdmin
          .from("questions")
          .select("id")
          .in("chapter_id", data.chapter_ids.slice(0, 100))
          .limit(data.count * 2);
        if (diffFilter) backfillQ = backfillQ.ilike("difficulty", diffFilter);
        const { data: bfRows } = await backfillQ;
        const bfIds = (bfRows ?? []).map((r) => r.id);
        selectedIds = Array.from(new Set([...selectedIds, ...bfIds]));
      }
    }

    selectedIds = Array.from(new Set(selectedIds));
    selectedIds = shuffle(selectedIds).slice(0, Math.min(180, data.count));

    if (!selectedIds.length) {
      throw new Error("No questions match your chosen syllabus and difficulty. Try adjusting filters.");
    }

    // 3. Atomically deduct bonus (admins bypass with infinite bonus)
    if (!(await isAdminUser(userId))) {
      const { data: ok, error: deductErr } = await (supabaseAdmin as any).rpc("deduct_bonus", {
        p_user_id: userId,
        p_amount: BONUS_COST,
        p_reason: "generate_test",
      });
      if (deductErr) throw new Error(deductErr.message);
      if (!ok) throw new Error(`Not enough bonus. Generating a test costs ${BONUS_COST} bonus.`);
    }

    // 4. Create the test record
    const { data: t, error: tErr } = await supabaseAdmin
      .from("tests")
      .insert({
        title: `${data.subject_name} Custom Test (${selectedIds.length} Qs)`,
        type: "custom",
        difficulty: data.difficulty,
        duration_min: data.duration_min,
        total_questions: selectedIds.length,
        question_ids: selectedIds,
        created_by: userId,
        source: "NCERT",
      })
      .select("id")
      .maybeSingle();

    if (tErr || !t) {
      throw new Error(tErr?.message ?? "Could not create test");
    }

    return { testId: t.id, bonusSpent: BONUS_COST, totalQuestions: selectedIds.length };
  });
