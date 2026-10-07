// Server functions for the admin panel: premium members, home banners,
// announcements and the quick numbers on the overview. Every function checks
// that the caller is an admin and records changes in admin_actions.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

async function ensureAdmin(ctx: { supabase: any; userId: string }) {
  const { data } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (!data) throw new Error("Admins only");
}

async function logAction(adminId: string, action: string, target: string, meta: Record<string, unknown>) {
  const d = await db();
  await d.from("admin_actions").insert({ user_id: adminId, action, target, meta }).then(() => undefined, () => undefined);
}

/* ------------------------------------------------------------------ premium members */

export type PremiumMember = {
  userId: string;
  name: string;
  email: string;
  plan: string;
  source: string;
  startedAt: string;
  expiresAt: string;
  active: boolean;
  daysLeft: number;
  grants: number;
};

export const adminListPremium = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context);
    const d = await db();
    const { data: subs, error } = await d
      .from("subscriptions")
      .select("id,user_id,plan,status,started_at,expires_at,source,source_batch_id,razorpay_payment_id,batches:source_batch_id(title)")
      .order("expires_at", { ascending: false })
      .limit(5000);
    if (error) throw new Error(error.message);

    // One row per student: the subscription that lasts longest decides their status.
    const byUser = new Map<string, any[]>();
    for (const s of subs ?? []) {
      const list = byUser.get(s.user_id) ?? [];
      list.push(s);
      byUser.set(s.user_id, list);
    }
    const ids = [...byUser.keys()];
    const profiles = new Map<string, { full_name: string | null; email: string | null }>();
    for (let i = 0; i < ids.length; i += 200) {
      const { data } = await d.from("profiles").select("id,full_name,email").in("id", ids.slice(i, i + 200));
      for (const p of data ?? []) profiles.set(p.id, p);
    }

    const now = Date.now();
    const members: PremiumMember[] = ids.map((uid) => {
      const rows = byUser.get(uid)!;
      const live = rows.filter((r) => r.status === "active" && new Date(r.expires_at).getTime() > now);
      const best = (live.length ? live : rows).reduce((a, b) => (new Date(b.expires_at) > new Date(a.expires_at) ? b : a));
      const first = rows.reduce((a, b) => (new Date(b.started_at) < new Date(a.started_at) ? b : a));
      const p = profiles.get(uid);
      const exp = new Date(best.expires_at).getTime();
      const source = best.razorpay_payment_id ? "Paid" : best.source === "admin_grant" ? "Given by admin" : best.source === "batch" ? "Plan purchase" : String(best.source ?? "—");
      return {
        userId: uid,
        name: p?.full_name || "—",
        email: p?.email || "—",
        plan: best.batches?.title ?? (best.plan === "yearly" ? "Yearly" : best.plan?.startsWith("mentorship") ? "Mentorship" : "Premium"),
        source,
        startedAt: first.started_at,
        expiresAt: best.expires_at,
        active: live.length > 0,
        daysLeft: Math.max(0, Math.ceil((exp - now) / 86_400_000)),
        grants: rows.length,
      };
    });
    members.sort((a, b) => Number(b.active) - Number(a.active) || a.daysLeft - b.daysLeft);

    const active = members.filter((m) => m.active);
    const monthAgo = now - 30 * 86_400_000;
    return {
      members,
      stats: {
        active: active.length,
        expiringSoon: active.filter((m) => m.daysLeft <= 7).length,
        newThisMonth: members.filter((m) => new Date(m.startedAt).getTime() > monthAgo).length,
        expired: members.length - active.length,
      },
    };
  });

export const adminRevokePremium = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ user_id: z.string().uuid(), reason: z.string().max(200).optional() }).parse(i))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const d = await db();
    const nowIso = new Date().toISOString();
    const { data: rows, error } = await d
      .from("subscriptions")
      .update({ status: "cancelled", expires_at: nowIso })
      .eq("user_id", data.user_id)
      .eq("status", "active")
      .gt("expires_at", nowIso)
      .select("id");
    if (error) throw new Error(error.message);
    await logAction(context.userId, "revoke_premium", data.user_id, { reason: data.reason ?? null, subscriptions: (rows ?? []).length });
    return { removed: (rows ?? []).length };
  });

export const adminExtendPremium = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ user_id: z.string().uuid(), days: z.number().int().min(1).max(3650) }).parse(i))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const d = await db();
    const nowIso = new Date().toISOString();
    const { data: cur } = await d
      .from("subscriptions")
      .select("id,expires_at")
      .eq("user_id", data.user_id)
      .eq("status", "active")
      .gt("expires_at", nowIso)
      .order("expires_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let expiresAt: string;
    if (cur) {
      expiresAt = new Date(new Date(cur.expires_at).getTime() + data.days * 86_400_000).toISOString();
      const { error } = await d.from("subscriptions").update({ expires_at: expiresAt }).eq("id", cur.id);
      if (error) throw new Error(error.message);
    } else {
      const { data: exp, error } = await context.supabase.rpc("admin_grant_premium", {
        _user_id: data.user_id, _days: data.days, _note: "Extended from admin panel", _batch_id: null,
      });
      if (error) throw new Error(error.message);
      expiresAt = exp as string;
    }
    await logAction(context.userId, "extend_premium", data.user_id, { days: data.days, expires_at: expiresAt });
    return { expires_at: expiresAt };
  });

export const adminFindUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ q: z.string().trim().min(2).max(120) }).parse(i))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const d = await db();
    const q = data.q.replace(/[%,()]/g, " ").trim();
    const { data: rows, error } = await d
      .from("profiles")
      .select("id,full_name,email,created_at")
      .or(`email.ilike.%${q}%,full_name.ilike.%${q}%`)
      .order("created_at", { ascending: false })
      .limit(8);
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r: any) => ({ id: r.id as string, name: (r.full_name as string) || "—", email: (r.email as string) || "—" }));
  });

export const adminGrantPremiumTo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      user_id: z.string().uuid(),
      days: z.number().int().min(1).max(3650),
      batch_id: z.string().uuid().nullable().optional(),
      note: z.string().max(200).nullable().optional(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const { data: exp, error } = await context.supabase.rpc("admin_grant_premium", {
      _user_id: data.user_id, _days: data.days, _note: data.note ?? null, _batch_id: data.batch_id ?? null,
    });
    if (error) throw new Error(error.message);
    await logAction(context.userId, "grant_premium", data.user_id, { days: data.days, note: data.note ?? null, expires_at: exp });
    return { expires_at: exp as string };
  });

/* ------------------------------------------------------------------ home banners */

const BannerInput = z.object({
  id: z.string().uuid().optional(),
  tag: z.string().trim().max(40).default(""),
  title: z.string().trim().min(2).max(80),
  subtitle: z.string().trim().max(160).default(""),
  cta_label: z.string().trim().max(30).default("Open"),
  link_url: z.string().trim().min(1).max(300),
  image_url: z.string().trim().max(600).nullable().optional(),
  theme: z.enum(["blue", "amber", "green", "pink", "violet"]).default("blue"),
  active: z.boolean().default(true),
  starts_at: z.string().datetime({ offset: true }).nullable().optional(),
  ends_at: z.string().datetime({ offset: true }).nullable().optional(),
});

export const adminListBanners = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context);
    const d = await db();
    const [{ data, error }, { data: setting }] = await Promise.all([
      d.from("dashboard_banners").select("*").order("sort_order", { ascending: true }).order("created_at", { ascending: true }),
      d.from("app_settings").select("value").eq("key", "home_builtin_slides").maybeSingle(),
    ]);
    if (error) throw new Error(error.message);
    return { banners: (data ?? []) as any[], showBuiltIn: setting?.value === false ? false : true };
  });

export const adminSaveBanner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => BannerInput.parse(i))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const d = await db();
    const row = {
      tag: data.tag || null, title: data.title, subtitle: data.subtitle || null, cta_label: data.cta_label || "Open",
      link_url: data.link_url, image_url: data.image_url || null, theme: data.theme, active: data.active,
      starts_at: data.starts_at ?? null, ends_at: data.ends_at ?? null, updated_at: new Date().toISOString(),
    };
    let id = data.id;
    if (id) {
      const { error } = await d.from("dashboard_banners").update(row).eq("id", id);
      if (error) throw new Error(error.message);
    } else {
      const { data: last } = await d.from("dashboard_banners").select("sort_order").order("sort_order", { ascending: false }).limit(1).maybeSingle();
      const { data: ins, error } = await d.from("dashboard_banners").insert({ ...row, sort_order: Number(last?.sort_order ?? 0) + 10 }).select("id").single();
      if (error) throw new Error(error.message);
      id = ins.id;
    }
    await logAction(context.userId, data.id ? "edit_banner" : "add_banner", id!, { title: data.title, active: data.active });
    return { id };
  });

export const adminDeleteBanner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const d = await db();
    const { error } = await d.from("dashboard_banners").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await logAction(context.userId, "delete_banner", data.id, {});
    return { ok: true };
  });

export const adminReorderBanners = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ ids: z.array(z.string().uuid()).max(100) }).parse(i))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const d = await db();
    await Promise.all(data.ids.map((id, i) => d.from("dashboard_banners").update({ sort_order: (i + 1) * 10 }).eq("id", id)));
    return { ok: true };
  });

export const adminSetBuiltInSlides = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ show: z.boolean() }).parse(i))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const d = await db();
    const { error } = await d.from("app_settings").upsert({ key: "home_builtin_slides", value: data.show, updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
    await logAction(context.userId, "builtin_slides", String(data.show), {});
    return { ok: true };
  });

export const adminBannerUploadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ filename: z.string().min(1).max(120) }).parse(i))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const d = await db();
    const ext = (data.filename.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
    const path = `banners/${crypto.randomUUID()}.${ext}`;
    const { data: signed, error } = await d.storage.from("banner-images").createSignedUploadUrl(path);
    if (error) throw new Error(error.message);
    const { data: pub } = d.storage.from("banner-images").getPublicUrl(path);
    return { path, token: signed.token as string, public_url: pub.publicUrl as string };
  });

/* ------------------------------------------------------------------ announcements */

export const adminSendAnnouncement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      title: z.string().trim().min(3).max(70),
      body: z.string().trim().min(3).max(200),
      url: z.string().trim().max(300).default("/dashboard"),
      audience: z.enum(["all", "premium"]),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const d = await db();
    const { data: job, error } = await d
      .from("push_jobs")
      .insert({ title: data.title, body: data.body, url: data.url || "/dashboard", audience: data.audience, kind: "announcement" })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    const { data: n, error: e2 } = await d.rpc("push_job_in_app", { _job: job.id });
    if (e2) throw new Error(e2.message);
    await logAction(context.userId, "announcement", String(job.id), { title: data.title, audience: data.audience, in_app: n });
    return { job: job.id as number, inApp: Number(n) || 0 };
  });

const PUSH_BATCH = 40;

/** Sends the next batch of phone notifications for an announcement. Call until done. */
export const adminPushAnnouncementBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ job: z.number().int().positive() }).parse(i))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const d = await db();
    const { vapidAuth, sendEmptyPush } = await import("@/lib/web-push.server");
    const { data: job } = await d.from("push_jobs").select("*").eq("id", data.job).maybeSingle();
    if (!job || job.done) return { done: true, sent: 0, batch: 0 };

    const { data: cfg } = await d.from("push_config").select("*").eq("id", 1).maybeSingle();
    const { data: subs, error } = await d.rpc("push_job_batch", { _job: job.id, _limit: PUSH_BATCH });
    if (error) throw new Error(error.message);
    const list = (subs ?? []) as { id: number; endpoint: string }[];

    let sent = 0;
    const gone: number[] = [];
    if (cfg && list.length) {
      const auths = new Map<string, string>();
      for (const s of list) {
        const origin = new URL(s.endpoint).origin;
        let auth = auths.get(origin);
        if (!auth) { auth = await vapidAuth(cfg.vapid_private_jwk, cfg.vapid_public, cfg.subject, s.endpoint); auths.set(origin, auth); }
        const r = await sendEmptyPush(s.endpoint, auth);
        if (r.ok) sent++;
        if (r.gone) gone.push(s.id);
      }
    }
    if (gone.length) await d.from("push_subscriptions").delete().in("id", gone);
    const done = list.length < PUSH_BATCH;
    await d.from("push_jobs").update({
      cursor_id: list.length ? list[list.length - 1].id : job.cursor_id,
      sent: (job.sent ?? 0) + sent,
      done,
    }).eq("id", job.id);
    return { done, sent, batch: list.length };
  });

export const adminListAnnouncements = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context);
    const d = await db();
    const [{ data: jobs }, { count: devices }] = await Promise.all([
      d.from("push_jobs").select("id,title,body,url,audience,kind,sent,done,created_at").order("id", { ascending: false }).limit(15),
      d.from("push_subscriptions").select("id", { count: "exact", head: true }),
    ]);
    return { jobs: (jobs ?? []) as any[], devices: devices ?? 0 };
  });

/* ------------------------------------------------------------------ overview numbers */

export const adminQuickStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context);
    const d = await db();
    const now = new Date();
    const dayStartIst = new Date(Math.floor((now.getTime() + 19_800_000) / 86_400_000) * 86_400_000 - 19_800_000);
    const weekAgo = new Date(now.getTime() - 7 * 86_400_000);
    const istDate = new Date(now.getTime() + 19_800_000).toISOString().slice(0, 10);

    const [premium, signupsToday, signups7, activeToday, bank, mega] = await Promise.all([
      d.from("subscriptions").select("user_id").eq("status", "active").gt("expires_at", now.toISOString()).limit(10000),
      d.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", dayStartIst.toISOString()),
      d.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", weekAgo.toISOString()),
      d.from("profiles").select("id", { count: "exact", head: true }).gte("last_seen_at", dayStartIst.toISOString()),
      d.rpc("question_bank_counts"),
      d.from("mega_quizzes").select("id,starts_at,status,winner_id,prize").eq("quiz_date", istDate).maybeSingle(),
    ]);

    let megaInfo: { startsAt: string; status: string; players: number; winner: string | null; prize: number } | null = null;
    if (mega.data) {
      const [{ count: players }, winner] = await Promise.all([
        d.from("mega_entries").select("user_id", { count: "exact", head: true }).eq("quiz_id", mega.data.id),
        mega.data.winner_id ? d.from("profiles").select("full_name,email").eq("id", mega.data.winner_id).maybeSingle() : Promise.resolve({ data: null }),
      ]);
      megaInfo = {
        startsAt: mega.data.starts_at, status: mega.data.status, players: players ?? 0,
        winner: winner?.data ? (winner.data.full_name || winner.data.email) : null, prize: Number(mega.data.prize ?? 0),
      };
    }
    const counts = (bank.data ?? {}) as Record<string, number>;
    return {
      premium: new Set(((premium.data ?? []) as any[]).map((r) => r.user_id)).size,
      signupsToday: signupsToday.count ?? 0,
      signups7: signups7.count ?? 0,
      activeToday: activeToday.count ?? 0,
      questions: Number(counts.total ?? 0),
      bySubject: Object.entries(counts).filter(([k]) => k !== "total").map(([name, count]) => ({ name, count: Number(count) })),
      mega: megaInfo,
    };
  });
