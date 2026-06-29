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
    if (!program) return { program: null, stats: null, invited: [] as any[] };
    const [{ data: statsRows }, { data: invited }] = await Promise.all([
      supabase.rpc("collab_my_stats"),
      supabase.rpc("collab_my_invited"),
    ]);
    return {
      program,
      stats: (statsRows && statsRows[0]) ?? null,
      invited: invited ?? [],
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

    // Compute per-collaborator totals server-side
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
      out.push({
        ...r,
        profile: nameMap[r.user_id] ?? null,
        total_invited: refIds.length,
        total_invested: invested,
        total_revenue: revenue,
        collaborator_earnings: earnings,
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
