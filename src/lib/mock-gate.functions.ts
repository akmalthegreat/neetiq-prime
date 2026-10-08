// Mock-test entry gate.
//  • Target 700 Batch tests: open during the 21-day free period, then Premium (tests already started stay open).
//  • Other mock tests: require the ai_mock_tests feature (active batch/trial).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireFeature } from "@/lib/access.server";
import { claimFreeSlot, FREE_T700_TESTS, LOCKED_PREFIX } from "@/lib/premium-gate.functions";

export const MOCK_COST_BONUS = 0;

export const startMockAttempt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ test_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: test, error: tErr } = await (supabaseAdmin as any)
      .from("tests").select("id,type,series").eq("id", data.test_id).maybeSingle();
    if (tErr) throw new Error(tErr.message);
    if (!test) throw new Error("Test not found");
    if (test.type !== "mock") return { ok: true as const, charged: 0, reason: "not_mock" };
    if (test.series) {
      const ok = await claimFreeSlot(userId, "t700", test.id, FREE_T700_TESTS);
      if (!ok) throw new Error(`${LOCKED_PREFIX} Your 21-day free access has ended. Get Premium to unlock all 46 Target 700 tests.`);
      return { ok: true as const, charged: 0, reason: "entitled" };
    }
    await requireFeature(userId, "ai_mock_tests");
    return { ok: true as const, charged: 0, reason: "entitled" };
  });
