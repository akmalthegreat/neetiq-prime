// Server-only access helpers. Do not import from client/route files directly.
import { TRIAL_FEATURES } from "./access-shared";

export async function getUserAccessServer(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as any;
  const [{ data: profile }, { data: sub }, { data: role }] = await Promise.all([
    db.from("profiles").select("trial_expires_at").eq("id", userId).maybeSingle(),
    db
      .from("subscriptions")
      .select("expires_at, batches:source_batch_id(features)")
      .eq("user_id", userId)
      .eq("status", "active")
      .gt("expires_at", new Date().toISOString())
      .order("expires_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    db.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle(),
  ]);
  const isAdmin = !!role;
  const now = new Date();
  const trialActive = !!profile?.trial_expires_at && new Date(profile.trial_expires_at) > now;
  let features: string[] = [];
  if (isAdmin) features = ["*"];
  else if (sub) {
    const feat = (sub as any).batches?.features ?? {};
    features = Object.entries(feat).filter(([, v]) => !!v).map(([k]) => k);
  } else if (trialActive) features = [...TRIAL_FEATURES];
  return { features, isAdmin, trialActive, subscriptionActive: !!sub };
}

export async function requireFeature(userId: string, key: string): Promise<void> {
  const acc = await getUserAccessServer(userId);
  if (acc.isAdmin) return;
  if (acc.features.includes("*") || acc.features.includes(key)) return;
  throw new Error("Upgrade required: this feature needs an active batch. Please purchase a batch to continue.");
}
