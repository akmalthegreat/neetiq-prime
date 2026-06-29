import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { pushNotification } from "@/lib/notifications.functions";

export const requestWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        amount: z.number().int().min(20).max(100000),
        upi_or_note: z.string().min(3).max(200),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: id, error } = await context.supabase.rpc("request_withdrawal", {
      _amount: data.amount,
      _upi_or_note: data.upi_or_note,
    });
    if (error) throw new Error(error.message);
    try {
      await pushNotification({
        user_id: context.userId,
        kind: "withdraw",
        title: `Withdrawal request for ₹${data.amount} submitted`,
        body: "We'll review and process it within 24 hours.",
        link: "/wallet",
      });
    } catch (e) { console.error("notify withdraw failed", e); }
    return { id };
  });

export const listMyWithdrawals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("withdrawal_requests")
      .select("id,amount,status,upi_or_note,admin_note,created_at,processed_at")
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const adminListPendingWithdrawals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: roles } = await context.supabase
      .from("user_roles").select("role").eq("user_id", context.userId);
    if (!roles?.some((r) => r.role === "admin")) throw new Error("Admin only");
    // Bypass the RPC's auth.uid()-based admin check (it returns nothing when
    // called via service-role) by querying the table directly with admin client.
    const { data: rows, error } = await supabaseAdmin
      .from("withdrawal_requests")
      .select("id,user_id,amount,upi_or_note,created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    const userIds = Array.from(new Set((rows ?? []).map((r: any) => r.user_id)));
    let profMap: Record<string, any> = {};
    if (userIds.length > 0) {
      const { data: profs } = await supabaseAdmin
        .from("profiles")
        .select("id,full_name,email,deposit_balance,winnings_balance")
        .in("id", userIds);
      profMap = Object.fromEntries((profs ?? []).map((p: any) => [p.id, p]));
    }
    return (rows ?? []).map((r: any) => {
      const p = profMap[r.user_id] ?? {};
      // The deposit + winnings here is AFTER the hold has already been
      // deducted by request_withdrawal. Add the request amount back so admins
      // see the user's real pre-hold available balance.
      const current = Number(p.deposit_balance ?? 0) + Number(p.winnings_balance ?? 0);
      const requested = Number(r.amount);
      return {
        id: r.id,
        user_id: r.user_id,
        amount: requested,
        upi_or_note: r.upi_or_note,
        created_at: r.created_at,
        full_name: p.full_name ?? null,
        email: p.email ?? null,
        available_balance: current + requested,
      };
    });
  });

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data: roles } = await context.supabase
    .from("user_roles").select("role").eq("user_id", context.userId);
  if (!roles?.some((r: any) => r.role === "admin")) throw new Error("Admin only");
}

export const adminApproveWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ id: z.string().uuid(), note: z.string().max(300).optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    // Load + lock-ish via select; admin client bypasses RLS.
    const { data: r, error: rErr } = await supabaseAdmin
      .from("withdrawal_requests").select("*").eq("id", data.id).maybeSingle();
    if (rErr || !r) throw new Error("Withdrawal not found");
    if (r.status !== "pending") throw new Error("Already processed");

    const note = data.note ?? "Paid manually";
    const { error: uErr } = await supabaseAdmin
      .from("withdrawal_requests")
      .update({ status: "paid", admin_note: note, processed_at: new Date().toISOString(), processed_by: context.userId })
      .eq("id", data.id);
    if (uErr) throw new Error(uErr.message);

    await supabaseAdmin.from("wallet_transactions").insert({
      user_id: r.user_id, amount: -Number(r.amount), type: "withdraw",
      bucket: "mixed", status: "completed", reference: data.id,
    });
    try {
      await pushNotification({
        user_id: r.user_id, kind: "withdraw",
        title: `Withdrawal of ₹${Number(r.amount)} paid`,
        body: note, link: "/wallet",
      });
    } catch (e) { console.error("notify withdraw paid failed", e); }
    return { ok: true };
  });

export const adminRejectWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ id: z.string().uuid(), note: z.string().max(300) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: r, error: rErr } = await supabaseAdmin
      .from("withdrawal_requests").select("*").eq("id", data.id).maybeSingle();
    if (rErr || !r) throw new Error("Withdrawal not found");
    if (r.status !== "pending") throw new Error("Already processed");

    // Refund using the original hold meta if present
    const { data: hold } = await supabaseAdmin
      .from("wallet_transactions").select("meta")
      .eq("reference", data.id).eq("type", "withdraw_hold").maybeSingle();
    const meta = (hold?.meta ?? {}) as { from_winnings?: number; from_deposit?: number };
    const fromWin = Number(meta.from_winnings ?? 0);
    const fromDep = Number(meta.from_deposit ?? Number(r.amount) - fromWin);

    const { data: prof } = await supabaseAdmin
      .from("profiles").select("deposit_balance,winnings_balance,wallet_balance")
      .eq("id", r.user_id).maybeSingle();
    if (!prof) throw new Error("Profile not found");

    await supabaseAdmin.from("profiles").update({
      deposit_balance: Number(prof.deposit_balance) + fromDep,
      winnings_balance: Number(prof.winnings_balance) + fromWin,
      wallet_balance: Number(prof.wallet_balance) + Number(r.amount),
    }).eq("id", r.user_id);

    await supabaseAdmin.from("withdrawal_requests").update({
      status: "rejected", admin_note: data.note,
      processed_at: new Date().toISOString(), processed_by: context.userId,
    }).eq("id", data.id);

    await supabaseAdmin.from("wallet_transactions").insert({
      user_id: r.user_id, amount: Number(r.amount), type: "withdraw_refund",
      bucket: "mixed", status: "completed", reference: data.id,
    });
    try {
      await pushNotification({
        user_id: r.user_id, kind: "withdraw",
        title: `Withdrawal of ₹${Number(r.amount)} rejected`,
        body: data.note, link: "/wallet",
      });
    } catch (e) { console.error("notify withdraw rejected failed", e); }
    return { ok: true };
  });
