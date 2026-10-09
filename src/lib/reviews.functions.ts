import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { assertAdmin } from "./admin-content.server";

export type MyReview = {
  rating: number;
  body: string;
  display_name: string;
  status: "published" | "hidden";
  updated_at: string;
} | null;

const SPAM = /(https?:\/\/|www\.|\.com\b|@[a-z0-9-]+\.|(?:\+?91[\s-]?)?\b[6-9]\d{9}\b|t\.me\/|telegram|whatsapp)/i;

/** "Mohd Akmal" -> "Mohd A." — used only as a default the student can change. */
function shortName(full: string | null | undefined): string {
  const parts = (full ?? "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "";
  const first = parts[0].slice(0, 24);
  return parts.length > 1 ? `${first} ${parts[parts.length - 1][0].toUpperCase()}.` : first;
}

/** The signed-in student's own review (any status) plus a suggested display name. */
export const getMyReview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ review: MyReview; suggestedName: string; ready: boolean }> => {
    const db = supabaseAdmin as any;
    const [{ data: prof }, r] = await Promise.all([
      db.from("profiles").select("full_name").eq("id", context.userId).maybeSingle(),
      db.from("site_reviews").select("rating,body,display_name,status,updated_at").eq("user_id", context.userId).maybeSingle(),
    ]);
    return { review: (r.data as MyReview) ?? null, suggestedName: shortName(prof?.full_name), ready: !r.error };
  });

export const submitReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      rating: z.number().int().min(1).max(5),
      body: z.string().trim().min(10, "Please write at least 10 characters").max(600),
      displayName: z.string().trim().min(1, "Please add a name").max(40),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const clean = (t: string) => t.replace(/neet\s?track(\.com)?/gi, "");
    if (SPAM.test(clean(data.body)) || SPAM.test(clean(data.displayName))) {
      throw new Error("Please remove links, phone numbers or contact details from your review.");
    }
    const db = supabaseAdmin as any;
    const { data: prof } = await db.from("profiles").select("target_year").eq("id", context.userId).maybeSingle();
    const { data: existing } = await db.from("site_reviews").select("status").eq("user_id", context.userId).maybeSingle();
    const row = {
      user_id: context.userId,
      rating: data.rating,
      body: data.body.replace(/\s+\n/g, "\n").replace(/\n{3,}/g, "\n\n"),
      display_name: data.displayName.replace(/\s+/g, " "),
      target_year: prof?.target_year ?? null,
      updated_at: new Date().toISOString(),
      // An admin-hidden review stays hidden after edits.
      status: existing?.status === "hidden" ? "hidden" : "published",
    };
    const { error } = await db.from("site_reviews").upsert(row, { onConflict: "user_id" });
    if (error) {
      if (/site_reviews/.test(error.message) && /(exist|schema cache)/i.test(error.message)) {
        throw new Error("Reviews are being set up. Please try again in a little while.");
      }
      throw new Error(`Could not save your review: ${error.message}`);
    }
    return { ok: true };
  });

export const deleteMyReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await (supabaseAdmin as any).from("site_reviews").delete().eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ───────── admin ───────── */

export const adminListReviews = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const db = supabaseAdmin as any;
    const { data, error } = await db
      .from("site_reviews")
      .select("id,user_id,rating,body,display_name,target_year,status,created_at,updated_at")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    const ids = Array.from(new Set(((data ?? []) as { user_id: string }[]).map((r) => r.user_id)));
    let emails: Record<string, string | null> = {};
    if (ids.length) {
      const { data: p } = await db.from("profiles").select("id,email").in("id", ids);
      emails = Object.fromEntries((p ?? []).map((x: any) => [x.id, x.email]));
    }
    return { rows: (data ?? []).map((r: any) => ({ ...r, email: emails[r.user_id] ?? null })) };
  });

export const adminSetReviewStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), status: z.enum(["published", "hidden"]) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await (supabaseAdmin as any).from("site_reviews").update({ status: data.status }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeleteReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await (supabaseAdmin as any).from("site_reviews").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
