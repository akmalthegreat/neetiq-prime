// Free-plan limits, enforced on the server.
//  • During the 21-day free period everything is open.
//  • After it, the Target 700 mock series needs Premium (tests already started stay open).
//  • Subject chapter practice is open to everyone (the old 6-chapter limit is switched off).
// "Full access" = admin, an active subscription, or inside the free period.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const FREE_T700_TESTS = 0;
export const FREE_CHAPTERS = 6;
/** Off: chapter practice is free for everyone. Set to true to bring back the FREE_CHAPTERS limit. */
export const CHAPTER_LIMIT_ON = false;
export const LOCKED_PREFIX = "PREMIUM_REQUIRED:";

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

export async function isPremiumUser(userId: string): Promise<boolean> {
  const { hasFullAccess } = await import("@/lib/access.server");
  return hasFullAccess(userId);
}

async function used(userId: string, kind: "chapter" | "t700"): Promise<string[]> {
  const d = await db();
  const { data } = await d.from("free_unlocks").select("ref").eq("user_id", userId).eq("kind", kind);
  return ((data ?? []) as { ref: string }[]).map((r) => r.ref);
}

/**
 * Lets a free student use one more item if they are under the limit.
 * Returns true when allowed (premium, already used, or a free slot left).
 */
export async function claimFreeSlot(userId: string, kind: "chapter" | "t700", ref: string, limit: number): Promise<boolean> {
  if (await isPremiumUser(userId)) {
    // Remember tests started with full access so they stay open after the free period.
    if (kind === "t700") {
      const d = await db();
      await d.from("free_unlocks").insert({ user_id: userId, kind, ref }).then(() => undefined, () => undefined);
    }
    return true;
  }
  const list = await used(userId, kind);
  if (list.includes(ref)) return true;
  if (list.length >= limit) return false;
  const d = await db();
  const { error } = await d.from("free_unlocks").insert({ user_id: userId, kind, ref });
  if (error && !String(error.message).includes("duplicate")) throw new Error(error.message);
  return true;
}

export const getFreeAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const premium = await isPremiumUser(context.userId);
    if (premium) return { premium: true, chapterGate: CHAPTER_LIMIT_ON, chapters: [] as string[], t700: [] as string[], chapterLimit: FREE_CHAPTERS, t700Limit: FREE_T700_TESTS };
    const [chapters, t700] = await Promise.all([used(context.userId, "chapter"), used(context.userId, "t700")]);
    return { premium: false, chapterGate: CHAPTER_LIMIT_ON, chapters, t700, chapterLimit: FREE_CHAPTERS, t700Limit: FREE_T700_TESTS };
  });

export const unlockPracticeChapter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ chapter_id: z.string().min(1).max(40) }).parse(i))
  .handler(async ({ data, context }) => {
    if (!CHAPTER_LIMIT_ON) return { ok: true as const };
    const ok = await claimFreeSlot(context.userId, "chapter", data.chapter_id, FREE_CHAPTERS);
    if (!ok) throw new Error(`${LOCKED_PREFIX} Free plan includes ${FREE_CHAPTERS} chapters. Get Premium to practise every chapter.`);
    return { ok: true as const };
  });

/** Used by the test screen so a locked series test can't be opened from a direct link. */
export const checkSeriesTestAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ test_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const d = await db();
    const { data: t } = await d.from("tests").select("series").eq("id", data.test_id).maybeSingle();
    if (!t?.series) return { locked: false };
    if (await isPremiumUser(context.userId)) return { locked: false };
    const list = await used(context.userId, "t700");
    return { locked: !list.includes(data.test_id) };
  });
