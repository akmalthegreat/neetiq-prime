// DPP entry gate: live daily DPPs are free; attempting any past (ended) daily
// DPP costs 5 bonus coins. Resuming an in-progress attempt is always free.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isAdminUser } from "@/lib/admin-bypass.server";

export const DPP_PAST_COST_BONUS = 5;

export const startDppAttempt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ test_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { supabase, userId } = context;

    // 1) Load target test.
    const { data: test, error: tErr } = await supabase
      .from("tests")
      .select("id,type,starts_at,ends_at")
      .eq("id", data.test_id)
      .maybeSingle();
    if (tErr) throw new Error(tErr.message);
    if (!test) throw new Error("Test not found");

    // Only daily DPPs are gated. Other test types pass through.
    if (test.type !== "daily") {
      return { ok: true as const, charged: 0, reason: "not_daily" };
    }

    const now = Date.now();
    const startMs = test.starts_at ? new Date(test.starts_at as string).getTime() : null;
    const endMs = test.ends_at ? new Date(test.ends_at as string).getTime() : null;
    const isLive = (startMs === null || startMs <= now) && (endMs === null || endMs > now);

    if (isLive) {
      return { ok: true as const, charged: 0, reason: "live_free" };
    }

    // 2) Resume any existing attempt on this DPP without charging again.
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

    // 3) Past DPP — debit 5 bonus.
    const { data: profile, error: pErr } = await supabaseAdmin
      .from("profiles")
      .select("id,bonus_balance")
      .eq("id", userId)
      .maybeSingle();
    if (pErr) throw new Error(pErr.message);
    const current = Number(profile?.bonus_balance ?? 0);
    if (current < DPP_PAST_COST_BONUS) {
      throw new Error(
        `Not enough bonus. Past DPPs cost ${DPP_PAST_COST_BONUS} bonus coins. The current live DPP is free.`,
      );
    }

    const next = current - DPP_PAST_COST_BONUS;
    const { error: uErr } = await supabaseAdmin
      .from("profiles")
      .update({ bonus_balance: next })
      .eq("id", userId);
    if (uErr) throw new Error(uErr.message);

    await supabaseAdmin.from("wallet_transactions").insert({
      user_id: userId,
      amount: -DPP_PAST_COST_BONUS,
      type: "dpp_past_entry",
      bucket: "bonus",
      status: "success",
      reference: data.test_id,
    });

    return { ok: true as const, charged: DPP_PAST_COST_BONUS, reason: "paid" };
  });
