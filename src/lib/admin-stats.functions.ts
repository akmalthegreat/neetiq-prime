import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function assertAdmin(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin only");
}

export const getAdminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);

    const [users, questions, subjects, paidTests, txns, paidOrders, subjectsList, recentActions, recentBugs, cronRuns] = await Promise.all([
      supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }),
      (supabaseAdmin as any).rpc("question_bank_counts"),
      supabaseAdmin.from("subjects").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("tests").select("id", { count: "exact", head: true }).eq("is_paid", true),
      supabaseAdmin.from("wallet_transactions").select("amount,type,created_at").eq("type", "recharge").eq("status", "completed"),
      supabaseAdmin.from("payment_orders").select("amount,status,created_at").in("status", ["paid", "completed"]),
      supabaseAdmin.from("subjects").select("id,name,color"),
      supabaseAdmin.from("admin_actions").select("id,action,target,meta,created_at,user_id").order("created_at", { ascending: false }).limit(10),
      supabaseAdmin.from("bug_reports").select("id,title,severity,status,created_at").order("created_at", { ascending: false }).limit(10),
      supabaseAdmin.from("cron_job_runs").select("id,job_name,status,details,created_at").order("created_at", { ascending: false }).limit(10),
    ]);

    // Revenue = wallet recharges + completed subscription / one-off payment orders.
    const txnTotal = (txns.data ?? []).reduce((s, r) => s + Number(r.amount || 0), 0);
    const ordersTotal = (paidOrders.data ?? []).reduce((s, r) => s + Number((r as any).amount || 0), 0);
    const totalRevenue = txnTotal + ordersTotal;

    // last 30 days revenue series
    const days = Array.from({ length: 30 }, (_, i) => {
      const d = new Date(); d.setUTCHours(0, 0, 0, 0); d.setUTCDate(d.getUTCDate() - (29 - i));
      return { date: d.toISOString().slice(0, 10), revenue: 0 };
    });
    const accrue = (rows: Array<{ amount: number | string; created_at: string }>) => {
      for (const r of rows) {
        const k = (r.created_at as string).slice(0, 10);
        const day = days.find((x) => x.date === k);
        if (day) day.revenue += Number(r.amount || 0);
      }
    };
    accrue((txns.data ?? []) as any);
    accrue((paidOrders.data ?? []) as any);


    // Questions by subject, from the hourly cached totals (fast).
    const bank = ((questions as any).data ?? {}) as Record<string, number>;
    const bySubject: { name: string; color: string | null; count: number }[] = (subjectsList.data ?? []).map((s: any) => ({
      name: s.name, color: s.color, count: Number(bank[String(s.id)] ?? bank[String(s.name).toLowerCase()] ?? 0),
    }));

    return {
      totals: {
        users: users.count ?? 0,
        questions: Number(bank.total ?? 0),
        subjects: subjects.count ?? (subjectsList.data ?? []).length,
        paidTests: paidTests.count ?? 0,
        revenue: totalRevenue,
      },
      bySubject,
      revenueSeries: days,
      recentActions: recentActions.data ?? [],
      recentBugs: recentBugs.data ?? [],
      cronRuns: cronRuns.data ?? [],
    };
  });
