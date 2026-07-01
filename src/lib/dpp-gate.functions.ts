// DPP entry gate: gated by daily_dpp feature entitlement.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireFeature } from "@/lib/access.server";

export const DPP_PAST_COST_BONUS = 0;

export const startDppAttempt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ test_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: test, error: tErr } = await supabase
      .from("tests").select("id,type").eq("id", data.test_id).maybeSingle();
    if (tErr) throw new Error(tErr.message);
    if (!test) throw new Error("Test not found");
    if (test.type !== "daily") return { ok: true as const, charged: 0, reason: "not_daily" };
    await requireFeature(userId, "daily_dpp");
    return { ok: true as const, charged: 0, reason: "entitled" };
  });
