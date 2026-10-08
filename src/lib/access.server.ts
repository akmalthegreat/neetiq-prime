// Server-only access helpers. Do not import from client/route files directly.
import { TRIAL_FEATURES, FREE_FEATURES } from "./access-shared";

export type AccessTier = "elite" | "prime" | "essential" | "trial" | "none";

export type ResolvedAccess = {
  tier: AccessTier;
  features: string[];
  isAdmin: boolean;
  trialActive: boolean;
  trialExpiresAt: string | null;
  subscriptionActive: boolean;
  subscriptionExpiresAt: string | null;
};

/**
 * One place that decides what a student can use.
 *  • Admin or a subscription without a restricting batch → everything ("*").
 *  • Subscription with a batch → the batch's features, plus everything a free/trial student gets.
 *  • Free period (first 21 days) → all study features.
 *  • After the free period → everything except the premium-only features.
 */
export async function resolveAccess(userId: string): Promise<ResolvedAccess> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as any;
  const [{ data: profile }, { data: sub }, { data: role }] = await Promise.all([
    db.from("profiles").select("trial_expires_at").eq("id", userId).maybeSingle(),
    db
      .from("subscriptions")
      .select("expires_at, source_batch_id, batches:source_batch_id(features)")
      .eq("user_id", userId)
      .eq("status", "active")
      .gt("expires_at", new Date().toISOString())
      .order("expires_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    db.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle(),
  ]);
  const isAdmin = !!role;
  const trialExpiresAt: string | null = profile?.trial_expires_at ?? null;
  const trialActive = !!trialExpiresAt && new Date(trialExpiresAt) > new Date();
  const base: string[] = trialActive ? [...TRIAL_FEATURES] : [...FREE_FEATURES];
  const common = { isAdmin, trialActive, trialExpiresAt, subscriptionActive: !!sub, subscriptionExpiresAt: (sub?.expires_at as string) ?? null };

  if (isAdmin) return { ...common, tier: "elite", features: ["*"] };

  if (sub) {
    const feat = (sub as any).batches?.features ?? {};
    const batch = Object.entries(feat).filter(([, v]) => !!v).map(([k]) => k);
    if (!sub.source_batch_id || batch.length === 0) return { ...common, tier: "elite", features: ["*"] };
    let tier: AccessTier = "essential";
    if (batch.includes("neetlab") || batch.includes("battlegrounds") || batch.includes("dedicated_program")) tier = "elite";
    else if (batch.includes("flashcards") || batch.includes("ai_path")) tier = "prime";
    return { ...common, tier, features: Array.from(new Set([...base, ...batch])) };
  }

  return { ...common, tier: trialActive ? "trial" : "none", features: base };
}

export async function getUserAccessServer(userId: string) {
  const a = await resolveAccess(userId);
  return { features: a.features, isAdmin: a.isAdmin, trialActive: a.trialActive, subscriptionActive: a.subscriptionActive };
}

/** Used by mentorship (elite plans only). */
export const getAccessForUser = resolveAccess;

export function hasAccess(a: { features: string[]; isAdmin: boolean }, key: string) {
  return a.isAdmin || a.features.includes("*") || a.features.includes(key);
}

/** True when the student can use everything: admin, any active subscription, or inside the free period. */
export async function hasFullAccess(userId: string): Promise<boolean> {
  const a = await resolveAccess(userId);
  return a.isAdmin || a.subscriptionActive || a.trialActive;
}

export async function requireFeature(userId: string, key: string): Promise<void> {
  const acc = await resolveAccess(userId);
  if (hasAccess(acc, key)) return;
  throw new Error("PREMIUM_REQUIRED: Your 21-day free access has ended. Get Premium to keep using this feature.");
}
