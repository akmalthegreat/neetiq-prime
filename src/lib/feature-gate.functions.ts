import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getSettingNumber } from "@/lib/app-settings.functions";
import { isAdminUser } from "@/lib/admin-bypass.server";

type Feature = "flashcards" | "ncert_highlights";

const COST_KEY: Record<Feature, string> = {
  flashcards: "flashcards_cost",
  ncert_highlights: "ncert_highlights_cost",
};

const DEFAULT_COST: Record<Feature, number> = {
  flashcards: 15,
  ncert_highlights: 15,
};

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

async function isPremium(userId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("subscriptions" as never)
    .select("id")
    .eq("user_id", userId)
    .eq("status", "active")
    .gt("expires_at", new Date().toISOString())
    .limit(1)
    .maybeSingle();
  return !!data;
}

/**
 * Charges the bonus cost for a premium study tool — once per UTC day per feature.
 * Premium subscribers and a same-day repeat access are free.
 */
export const accessStudyFeature = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { feature: Feature }) =>
    z.object({ feature: z.enum(["flashcards", "ncert_highlights"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const feature = data.feature as Feature;
    const userId = context.userId;
    const cost = await getSettingNumber(COST_KEY[feature], DEFAULT_COST[feature]);

    if (cost <= 0 || (await isPremium(userId)) || (await isAdminUser(userId))) {
      return { ok: true, charged: 0, free: true as const };
    }

    const reference = `${feature}:${todayUtc()}`;

    // Already unlocked today?
    const { data: existing } = await supabaseAdmin
      .from("wallet_transactions")
      .select("id")
      .eq("user_id", userId)
      .eq("type", "feature_access")
      .eq("reference", reference)
      .limit(1)
      .maybeSingle();
    if (existing) return { ok: true, charged: 0, free: true as const };

    // Charge bonus
    const { data: profile, error } = await supabaseAdmin
      .from("profiles")
      .select("bonus_balance")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const current = Number(profile?.bonus_balance ?? 0);
    if (current < cost) {
      throw new Error(
        `Not enough bonus. Unlocking this for today costs ${cost} bonus coins (you have ${current}). Earn more from the Bonus page.`,
      );
    }
    const { error: uErr } = await supabaseAdmin
      .from("profiles")
      .update({ bonus_balance: current - cost })
      .eq("id", userId);
    if (uErr) throw new Error(uErr.message);
    await supabaseAdmin.from("wallet_transactions").insert({
      user_id: userId,
      amount: -cost,
      type: "feature_access",
      bucket: "bonus",
      status: "success",
      reference,
    });
    return { ok: true, charged: cost, free: false as const };
  });
