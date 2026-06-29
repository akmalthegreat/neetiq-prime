// Mock-test entry gate: first mock is free per user, every subsequent
// mock attempt debits 10 bonus coins.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isAdminUser } from "@/lib/admin-bypass.server";

export const MOCK_COST_BONUS = 10;

export const startMockAttempt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ test_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { supabase, userId } = context;

    // 1) Validate the target test exists and is a mock.
    const { data: test, error: tErr } = await supabase
      .from("tests")
      .select("id,type")
      .eq("id", data.test_id)
      .maybeSingle();
    if (tErr) throw new Error(tErr.message);
    if (!test) throw new Error("Test not found");
    if (test.type !== "mock") {
      // Non-mocks are not gated by this flow.
      return { ok: true as const, charged: 0, reason: "not_mock" };
    }

    // 2) If the user already has any attempt on THIS specific mock,
    //    let them resume without charging again.
    const { data: existing } = await supabase
      .from("attempts")
      .select("id")
      .eq("user_id", userId)
      .eq("test_id", data.test_id)
      .limit(1);
    if (existing && existing.length > 0) {
      return { ok: true as const, charged: 0, reason: "resume" };
    }

    // Admins bypass all bonus charges (infinite bonus).
    if (await isAdminUser(userId)) {
      return { ok: true as const, charged: 0, reason: "admin_free" };
    }

    // 3) Count distinct prior mock attempts (across all mocks).
    //    First mock is free; second onwards costs MOCK_COST_BONUS bonus coins.
    const { data: mockTests } = await supabaseAdmin
      .from("tests")
      .select("id")
      .eq("type", "mock");
    const mockIds = (mockTests ?? []).map((t: any) => t.id);

    let priorCount = 0;
    if (mockIds.length > 0) {
      const { count } = await supabase
        .from("attempts")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .in("test_id", mockIds);
      priorCount = count ?? 0;
    }

    if (priorCount === 0) {
      return { ok: true as const, charged: 0, reason: "first_free" };
    }

    // 4) Charge MOCK_COST_BONUS from bonus_balance.
    const { data: profile, error: pErr } = await supabaseAdmin
      .from("profiles")
      .select("id,bonus_balance")
      .eq("id", userId)
      .maybeSingle();
    if (pErr) throw new Error(pErr.message);
    const current = Number(profile?.bonus_balance ?? 0);
    if (current < MOCK_COST_BONUS) {
      throw new Error(
        `Not enough bonus. Mock tests cost ${MOCK_COST_BONUS} bonus coins after the first one. Earn more from the Bonus page.`,
      );
    }

    const next = current - MOCK_COST_BONUS;
    const { error: uErr } = await supabaseAdmin
      .from("profiles")
      .update({ bonus_balance: next })
      .eq("id", userId);
    if (uErr) throw new Error(uErr.message);

    await supabaseAdmin.from("wallet_transactions").insert({
      user_id: userId,
      amount: -MOCK_COST_BONUS,
      type: "mock_entry",
      bucket: "bonus",
      status: "success",
      reference: data.test_id,
    });

    return { ok: true as const, charged: MOCK_COST_BONUS, reason: "paid" };
  });
