import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
export { TRIAL_FEATURES } from "@/lib/access-shared";

export type AccessTier = "elite" | "prime" | "essential" | "trial" | "none";

export type MyAccess = {
  tier: AccessTier;
  trialActive: boolean;
  trialExpiresAt: string | null;
  subscriptionActive: boolean;
  subscriptionExpiresAt: string | null;
  features: string[];
  isAdmin: boolean;
};

export const getMyAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyAccess> => {
    const { resolveAccess } = await import("@/lib/access.server");
    return resolveAccess(context.userId);
  });
