import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Permanently deletes the signed-in user's account and the data linked to it.
 * Required by Google Play (in-app account deletion). Only the caller's own
 * account can be deleted: the user id comes from the verified auth token,
 * never from the request body.
 */
export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ confirm: z.literal("DELETE") }).parse(i))
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const userId: string = context.userId;

    // Don't silently wipe money the user can still withdraw.
    const { data: prof } = await admin
      .from("profiles")
      .select("deposit_balance, winnings_balance")
      .eq("id", userId)
      .maybeSingle();
    const withdrawable = Number(prof?.deposit_balance ?? 0) + Number(prof?.winnings_balance ?? 0);
    if (withdrawable > 0) {
      return {
        ok: false as const,
        reason: "wallet" as const,
        message:
          "Your wallet still has money in it. Please withdraw it first (or contact support to have it refunded), then delete your account.",
      };
    }

    // Deleting the auth user cascades to the rest of the user's data
    // (profile, progress, bookmarks, attempts, etc.) through foreign keys.
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) {
      console.error("[deleteMyAccount] failed", error.message);
      return {
        ok: false as const,
        reason: "error" as const,
        message:
          "We couldn't delete your account automatically. Please email support@neetiq.app from your registered email address and we will delete it for you.",
      };
    }
    return { ok: true as const };
  });
