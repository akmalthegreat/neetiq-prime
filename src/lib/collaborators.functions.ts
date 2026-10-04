import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const minWithdrawalFor = (share: number) =>
  share === 80 ? 100 : share === 60 ? 50 : 25;

export const applyForCollaboratorProgram = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      name: z.string().trim().min(2).max(120),
      contact: z.string().trim().min(4).max(60),
      email: z.string().trim().email().max(200),
      promo_asset: z.string().trim().min(3).max(500),
      months: z.number().int().min(1).max(60),
      share_pct: z.union([z.literal(40), z.literal(60), z.literal(80)]),
      accepted_terms: z.literal(true),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const admin = supabaseAdmin as any;
    const min_withdrawal = minWithdrawalFor(data.share_pct);
    const { error } = await admin
      .from("collaborator_programs")
      .upsert({
        user_id: context.userId,
        name: data.name,
        contact: data.contact,
        email: data.email,
        promo_asset: data.promo_asset,
        months: data.months,
        share_pct: data.share_pct,
        min_withdrawal,
        accepted_terms: true,
        status: "pending",
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getMyCollaboratorProgram = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase as any;
    const { data: program } = await supabase
      .from("collaborator_programs")
      .select("*")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!program) return { program: null, stats: null, invited: [] as any[], link: null, coupon: null };

    const admin = supabaseAdmin as any;
    const [{ data: statsRows }, { data: invited }, { data: link }, { data: coupon }] = await Promise.all([
      supabase.rpc("collab_my_stats"),
      supabase.rpc("collab_my_invited"),
      admin.from("collaborator_links").select("id,code,clicks,active").eq("collaborator_user_id", context.userId).maybeSingle(),
      admin.from("coupons").select("id,code,kind,value,batch_id,active").eq("owner_user_id", context.userId).maybeSingle(),
    ]);

    return {
      program,
      stats: (statsRows && statsRows[0]) ?? null,
      invited: invited ?? [],
      link: link ?? null,
      coupon: coupon ?? null,
    };
  });

async function assertAdmin(userId: string) {
  const admin = supabaseAdmin as any;
  const { data } = await admin
    .from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
  if (!data) throw new Error("Forbidden: admin only");
}

export const adminListCollaborators = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const admin = supabaseAdmin as any;
    const { data: rows, error } = await admin
      .from("collaborator_programs")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const ids = Array.from(new Set((rows ?? []).map((r: any) => r.user_id)));
    let nameMap: Record<string, { full_name: string | null; email: string | null }> = {};
    if (ids.length) {
      const { data: profs } = await admin
        .from("profiles").select("id,full_name,email").in("id", ids);
      nameMap = Object.fromEntries((profs ?? []).map((p: any) =>
        [p.id, { full_name: p.full_name, email: p.email }]));
    }

    const out: any[] = [];
    for (const r of rows ?? []) {
      const { data: refs } = await admin
        .from("referrals").select("referred_id").eq("referrer_id", r.user_id);
      const refIds = (refs ?? []).map((x: any) => x.referred_id);
      let invested = 0;
      if (refIds.length) {
        const { data: pos } = await admin
          .from("payment_orders")
          .select("amount,status")
          .in("user_id", refIds)
          .in("status", ["paid", "completed"]);
        invested = (pos ?? []).reduce((s: number, p: any) => s + Number(p.amount || 0), 0);
      }
      const revenue = Math.round(invested * 0.30 * 100) / 100;
      const earnings = Math.round(revenue * (r.share_pct / 100) * 100) / 100;

      const [{ data: link }, { data: coupon }] = await Promise.all([
        admin.from("collaborator_links").select("id,code,clicks,active").eq("collaborator_user_id", r.user_id).maybeSingle(),
        admin.from("coupons").select("id,code,kind,value,batch_id,active").eq("owner_user_id", r.user_id).maybeSingle(),
      ]);

      out.push({
        ...r,
        profile: nameMap[r.user_id] ?? null,
        total_invited: refIds.length,
        total_invested: invested,
        total_revenue: revenue,
        collaborator_earnings: earnings,
        collaborator_link: link ?? null,
        collaborator_coupon: coupon ?? null,
      });
    }
    return { rows: out };
  });

export const adminUpdateCollaboratorStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    id: z.string().uuid(),
    status: z.enum(["pending", "approved", "rejected", "ended"]),
    admin_notes: z.string().max(2000).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const admin = supabaseAdmin as any;
    const { error } = await admin
      .from("collaborator_programs")
      .update({
        status: data.status,
        admin_notes: data.admin_notes ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminUpdateCollaboratorDetails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    user_id: z.string().uuid(),
    name: z.string().trim().min(2).max(120),
    link_code: z.string().trim().min(4).max(40).regex(/^[A-Za-z0-9_-]+$/, "Link code can use letters, numbers, _ and - only."),
    coupon_code: z.string().trim().min(4).max(40).regex(/^[A-Za-z0-9_-]+$/, "Coupon code can use letters, numbers, _ and - only."),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const admin = supabaseAdmin as any;
    const linkCode = data.link_code.toUpperCase();
    const couponCode = data.coupon_code.toUpperCase();

    const { data: otherLink } = await admin
      .from("collaborator_links")
      .select("id")
      .eq("code", linkCode)
      .neq("collaborator_user_id", data.user_id)
      .maybeSingle();
    if (otherLink) throw new Error("That collaborator link code is already in use.");

    const { data: otherCoupon } = await admin
      .from("coupons")
      .select("id")
      .eq("code", couponCode)
      .neq("owner_user_id", data.user_id)
      .maybeSingle();
    if (otherCoupon) throw new Error("That coupon code is already in use.");

    const { error: programError } = await admin
      .from("collaborator_programs")
      .update({ name: data.name, updated_at: new Date().toISOString() })
      .eq("user_id", data.user_id);
    if (programError) throw new Error(programError.message);

    const { data: existingLink } = await admin
      .from("collaborator_links")
      .select("id")
      .eq("collaborator_user_id", data.user_id)
      .maybeSingle();

    if (existingLink) {
      const { error } = await admin
        .from("collaborator_links")
        .update({ code: linkCode, updated_at: new Date().toISOString(), active: true })
        .eq("id", existingLink.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await admin
        .from("collaborator_links")
        .insert({ collaborator_user_id: data.user_id, code: linkCode, active: true });
      if (error) throw new Error(error.message);
    }

    const { data: existingCoupon } = await admin
      .from("coupons")
      .select("id")
      .eq("owner_user_id", data.user_id)
      .maybeSingle();

    if (existingCoupon) {
      const { error } = await admin
        .from("coupons")
        .update({ code: couponCode, active: true })
        .eq("id", existingCoupon.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await admin
        .from("coupons")
        .insert({
          code: couponCode,
          kind: "percent",
          value: 0,
          active: true,
          used_count: 0,
          owner_user_id: data.user_id,
          program: "batch",
        });
      if (error) throw new Error(error.message);
    }

    return { ok: true, link_code: linkCode, coupon_code: couponCode };
  });
