// Admin-only: list the top wallets across all users, with deposit /
// winnings / bonus breakdowns. Used by the admin "Top Wallets" panel.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Forbidden: admin only");
}

export const adminListTopWallets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        sortBy: z.enum(["wallet_balance", "deposit_balance", "winnings_balance", "bonus_balance"]).default("wallet_balance"),
        limit: z.number().int().min(1).max(200).default(50),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const { data: rows, error } = await admin
      .from("profiles")
      .select("id,email,full_name,avatar_url,wallet_balance,deposit_balance,winnings_balance,bonus_balance,created_at")
      .order(data.sortBy, { ascending: false, nullsFirst: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    const totals = (rows ?? []).reduce(
      (acc: any, r: any) => {
        acc.wallet += Number(r.wallet_balance ?? 0);
        acc.deposit += Number(r.deposit_balance ?? 0);
        acc.winnings += Number(r.winnings_balance ?? 0);
        acc.bonus += Number(r.bonus_balance ?? 0);
        return acc;
      },
      { wallet: 0, deposit: 0, winnings: 0, bonus: 0 },
    );
    return { users: rows ?? [], totals };
  });
