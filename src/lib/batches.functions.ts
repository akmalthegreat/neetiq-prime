import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}
async function ensureAdmin(ctx: { supabase: any; userId: string }) {
  const { data } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (!data) throw new Error("Forbidden");
}

// ---------- Public: list active batches ----------
export const listActiveBatches = createServerFn({ method: "GET" }).handler(async () => {
  const db = await admin();
  const { data, error } = await db
    .from("batches")
    .select("id, title, image_url, price, discounted_price, duration_days, features, ai_description, short_tagline, sort_order")
    .eq("active", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
});

// ---------- Admin: list all batches ----------
export const adminListBatches = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context);
    const db = await admin();
    const { data, error } = await db.from("batches").select("*").order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const BatchInput = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(2).max(120),
  image_url: z.string().url().nullable().optional(),
  price: z.number().min(0),
  discounted_price: z.number().min(0),
  duration_days: z.number().int().min(1).max(3650),
  features: z.record(z.boolean()),
  ai_description: z.string().nullable().optional(),
  short_tagline: z.string().nullable().optional(),
  active: z.boolean().default(true),
  sort_order: z.number().int().default(0),
});

export const adminUpsertBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => BatchInput.parse(i))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const db = await admin();
    if (data.discounted_price > data.price) throw new Error("Discounted price must be <= price");
    const row = { ...data, updated_at: new Date().toISOString() };
    if (data.id) {
      const { error } = await db.from("batches").update(row).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    } else {
      const { data: ins, error } = await db.from("batches").insert(row).select("id").single();
      if (error) throw new Error(error.message);
      return { id: ins.id };
    }
  });

export const adminDeleteBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const db = await admin();
    const { error } = await db.from("batches").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- AI description generator ----------
const FEATURE_LABELS: Record<string, string> = {
  daily_dpp: "Daily DPP",
  ai_mock_tests: "AI Mock Tests",
  unlimited_ai_quizzes: "Unlimited AI quizzes",
  flashcards: "Flashcards",
  ncert_highlights: "NCERT Highlights",
  pyqs: "NEET PYQs",
  contests: "Contests",
  battlegrounds: "1v1 Battlegrounds",
  analytics: "Advanced analytics",
  score_predictor: "AI Score Predictor",
  neetlab: "NEETLab 3D simulations",
  bookmarks: "Unlimited bookmarks",
  priority_support: "Priority support",
  ai_path: "Personalized AI study path",
  dedicated_program: "Dedicated mentor program",
};
export const FEATURE_KEYS = Object.keys(FEATURE_LABELS);
export const FEATURE_LABEL_MAP = FEATURE_LABELS;

export const adminGenerateBatchDescription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      title: z.string().min(2),
      features: z.record(z.boolean()),
      duration_days: z.number().int(),
      price: z.number(),
      discounted_price: z.number(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Lovable AI not configured");
    const enabled = Object.entries(data.features).filter(([_, v]) => v).map(([k]) => FEATURE_LABELS[k] ?? k);
    const prompt = `You write concise marketing copy for a NEET (medical entrance) prep app called NEETIQ Prime.
Generate a short, exciting batch description for users.

Batch title: ${data.title}
Duration: ${data.duration_days} days
Price: ₹${data.price} → Discounted ₹${data.discounted_price}
Included features: ${enabled.join(", ") || "none"}

Requirements:
- 2 short paragraphs max (60-90 words total)
- Hindi-English friendly tone
- Mention 3-4 standout features by name
- End with a single line CTA
- No emojis, no markdown, plain text only`;
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`AI failed (${res.status}): ${txt.slice(0, 200)}`);
    }
    const json = await res.json();
    const text = json?.choices?.[0]?.message?.content ?? "";
    return { description: String(text).trim() };
  });

// ---------- Coupons ----------
export const adminListCoupons = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context);
    const db = await admin();
    const { data, error } = await db.from("coupons").select("*, batch:batches(title)").order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const adminUpsertCoupon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      id: z.string().uuid().optional(),
      code: z.string().min(2).max(40).regex(/^[A-Z0-9_-]+$/i),
      kind: z.enum(["percent", "flat"]),
      value: z.number().min(0),
      max_uses: z.number().int().min(1).nullable().optional(),
      expires_at: z.string().nullable().optional(),
      batch_id: z.string().uuid().nullable().optional(),
      active: z.boolean().default(true),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const db = await admin();
    const row = { ...data, code: data.code.toUpperCase() };
    if (data.id) {
      const { error } = await db.from("coupons").update(row).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: ins, error } = await db.from("coupons").insert(row).select("id").single();
    if (error) throw new Error(error.message);
    return { id: ins.id };
  });

export const adminDeleteCoupon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const db = await admin();
    const { error } = await db.from("coupons").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Validate coupon (user) ----------
export const validateCoupon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ code: z.string().min(1).max(40), batch_id: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { data: batch } = await db.from("batches").select("id, discounted_price").eq("id", data.batch_id).maybeSingle();
    if (!batch) throw new Error("Batch not found");
    const { data: coupon } = await db.from("coupons").select("*").ilike("code", data.code.trim()).maybeSingle();
    if (!coupon || !coupon.active) throw new Error("Invalid coupon");
    if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) throw new Error("Coupon expired");
    if (coupon.max_uses != null && coupon.used_count >= coupon.max_uses) throw new Error("Coupon usage limit reached");
    if (coupon.batch_id && coupon.batch_id !== batch.id) throw new Error("Coupon not valid for this batch");
    const { data: already } = await db
      .from("coupon_redemptions")
      .select("id")
      .eq("coupon_id", coupon.id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (already) throw new Error("Coupon already used");

    const base = Number(batch.discounted_price);
    let discount = coupon.kind === "percent" ? (base * Number(coupon.value)) / 100 : Number(coupon.value);
    discount = Math.min(discount, base);
    const final = Math.max(0, Math.round((base - discount) * 100) / 100);
    return {
      coupon_id: coupon.id as string,
      code: coupon.code as string,
      discount_amount: discount,
      final_amount: final,
    };
  });

// ---------- Admin: grant premium to a user ----------
export const adminGrantPremium = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      user_id: z.string().uuid(),
      days: z.number().int().min(1).max(3650),
      note: z.string().max(200).nullable().optional(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const db = await admin();
    const { data: expires, error } = await db.rpc("admin_grant_premium", {
      _user_id: data.user_id, _days: data.days, _note: data.note ?? null,
    });
    if (error) throw new Error(error.message);
    return { expires_at: expires as string };
  });

// ---------- Image upload (signed by client; this returns upload URL) ----------
export const adminCreateBatchImageUploadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ filename: z.string().min(1).max(120) }).parse(i))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const db = await admin();
    const ext = data.filename.split(".").pop()?.toLowerCase() || "jpg";
    const path = `batches/${crypto.randomUUID()}.${ext}`;
    const { data: signed, error } = await db.storage.from("batch-images").createSignedUploadUrl(path);
    if (error) throw new Error(error.message);
    const { data: pub } = db.storage.from("batch-images").getPublicUrl(path);
    return { path, token: signed.token, public_url: pub.publicUrl };
  });
