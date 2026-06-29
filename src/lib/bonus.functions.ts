import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const VERIFY_URL = "https://project--47a3c72b-91bb-4f59-b32c-40147a2a873f-dev.lovable.app/api/public/verify-key";

export const claimBonusKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ key: z.string().trim().toUpperCase().regex(/^[A-F0-9]{12}$/) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const key = data.key;
    const userId = context.userId;

    // 1. Call external verify API
    const res = await fetch(VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key }),
    });

    if (!res.ok) {
      console.error("Verify key HTTP error", res.status, await res.text().catch(() => ""));
      return { ok: false, error: "network" as const };
    }

    const body = (await res.json()) as { valid: boolean; error?: "not_found" | "already_used" | "invalid_format" };

    if (!body.valid) {
      return { ok: false, error: body.error ?? "unknown" as const };
    }

    // 2. Check if this user already claimed this key (idempotent guard)
    const { data: existing } = await (supabaseAdmin as any)
      .from("wallet_transactions")
      .select("id")
      .eq("user_id", userId)
      .eq("type", "bonus_key")
      .eq("reference", key)
      .maybeSingle();

    if (existing) {
      return { ok: false, error: "already_used" as const };
    }

    // 3. Credit +20 bonus
    const { data: profile } = await (supabaseAdmin as any)
      .from("profiles")
      .select("bonus_balance")
      .eq("id", userId)
      .maybeSingle();

    if (!profile) {
      return { ok: false, error: "profile_not_found" as const };
    }

    const newBonus = Number(profile.bonus_balance ?? 0) + 20;

    await (supabaseAdmin as any)
      .from("profiles")
      .update({ bonus_balance: newBonus })
      .eq("id", userId);

    await (supabaseAdmin as any).from("wallet_transactions").insert({
      user_id: userId,
      amount: 20,
      type: "bonus_key",
      bucket: "bonus",
      status: "completed",
      reference: key,
    });

    return { ok: true, bonus: 20 };
  });
