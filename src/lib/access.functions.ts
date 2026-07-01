import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const TRIAL_FEATURES = [
  "daily_dpp",
  "ai_mock_tests",
  "unlimited_ai_quizzes",
  "pyqs",
  "bookmarks",
  "generate_test",
  "weekly_progress",
  "subject_wise_quiz",
] as const;

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
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const userId = context.userId;

    const [{ data: profile }, { data: sub }, { data: roleRow }] = await Promise.all([
      db.from("profiles").select("trial_expires_at").eq("id", userId).maybeSingle(),
      db
        .from("subscriptions")
        .select("expires_at, source_batch_id, batches:source_batch_id(features, title)")
        .eq("user_id", userId)
        .eq("status", "active")
        .gt("expires_at", new Date().toISOString())
        .order("expires_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      db.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle(),
    ]);

    const isAdmin = !!roleRow;
    const now = new Date();
    const trialExp = profile?.trial_expires_at ? new Date(profile.trial_expires_at) : null;
    const trialActive = !!trialExp && trialExp > now;
    const subActive = !!sub;

    if (isAdmin) {
      return {
        tier: "elite",
        trialActive,
        trialExpiresAt: profile?.trial_expires_at ?? null,
        subscriptionActive: subActive,
        subscriptionExpiresAt: sub?.expires_at ?? null,
        features: ["*"],
        isAdmin: true,
      };
    }

    if (subActive) {
      const feat = (sub as any).batches?.features ?? {};
      const features = Object.entries(feat).filter(([, v]) => !!v).map(([k]) => k);
      // Derive tier from feature count
      let tier: AccessTier = "essential";
      if (features.includes("neetlab") || features.includes("battlegrounds") || features.includes("dedicated_program")) tier = "elite";
      else if (features.includes("flashcards") || features.includes("ai_path")) tier = "prime";
      return {
        tier,
        trialActive,
        trialExpiresAt: profile?.trial_expires_at ?? null,
        subscriptionActive: true,
        subscriptionExpiresAt: sub!.expires_at,
        features,
        isAdmin: false,
      };
    }

    if (trialActive) {
      return {
        tier: "trial",
        trialActive: true,
        trialExpiresAt: profile!.trial_expires_at,
        subscriptionActive: false,
        subscriptionExpiresAt: null,
        features: [...TRIAL_FEATURES],
        isAdmin: false,
      };
    }

    return {
      tier: "none",
      trialActive: false,
      trialExpiresAt: profile?.trial_expires_at ?? null,
      subscriptionActive: false,
      subscriptionExpiresAt: null,
      features: [],
      isAdmin: false,
    };
  });
