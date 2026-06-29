import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { callAiGatewayWithRotation } from "@/lib/ai-keys.functions";
import { getSettingNumber } from "@/lib/app-settings.functions";
import { isAdminUser } from "@/lib/admin-bypass.server";

async function chargeBonus(userId: string, cost: number, type: string, reference: string) {
  // Admins bypass all bonus charges (infinite bonus).
  if (await isAdminUser(userId)) return;
  const { data: profile, error } = await supabaseAdmin
    .from("profiles").select("id,bonus_balance").eq("id", userId).maybeSingle();
  if (error) throw new Error(error.message);
  const current = Number(profile?.bonus_balance ?? 0);
  if (current < cost) {
    throw new Error(`Not enough bonus. You need ${cost} bonus coins (you have ${current}).`);
  }
  await supabaseAdmin.from("profiles").update({ bonus_balance: current - cost }).eq("id", userId);
  await supabaseAdmin.from("wallet_transactions").insert({
    user_id: userId, amount: -cost, type, bucket: "bonus", status: "success", reference,
  });
}

async function gatherUserStats(userId: string) {
  const { data: attempts } = await supabaseAdmin
    .from("attempts")
    .select("id,score,correct_count,wrong_count")
    .eq("user_id", userId).eq("status", "completed")
    .order("submitted_at", { ascending: false }).limit(20);
  const list = (attempts ?? []) as any[];
  const { data: ans } = await supabaseAdmin
    .from("attempt_answers" as never)
    .select("is_correct,questions:question_id(subjects:subject_id(name))")
    .in("attempt_id", list.map((a) => a.id) as string[]).limit(2000);
  const buckets = new Map<string, { c: number; t: number }>();
  for (const r of (ans ?? []) as any[]) {
    const subj = r?.questions?.subjects?.name ?? "General";
    const cur = buckets.get(subj) ?? { c: 0, t: 0 };
    cur.t++; if (r.is_correct) cur.c++;
    buckets.set(subj, cur);
  }
  const subjects = Array.from(buckets.entries()).map(([subject, v]) => ({
    subject, attempted: v.t, accuracy: v.t ? Math.round((v.c / v.t) * 100) : 0,
  }));
  return { attempts: list.length, subjects };
}

export const getCurrentPath = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await supabaseAdmin
      .from("ai_paths" as never)
      .select("id,start_date,payload,progress,created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    return { path: data ?? null };
  });

export const generateAiPath = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const cost = await getSettingNumber("ai_path_cost", 45);
    const stats = await gatherUserStats(context.userId);
    const reference = `aipath_${Date.now()}`;
    await chargeBonus(context.userId, cost, "ai_path", reference);

    const sys = `You are an elite NEET-UG coach. Create a 7-day personalized study plan based on the student's stats.
Each day: focus_subject, topics[], daily_tasks[] (specific actionable items like "Solve 20 Physics DPP — Kinematics" or "Revise 30 flashcards — Cell Cycle"), time_min, motivation_note.
Total daily time: 4–6 hours. Mix subjects across the week. Prioritize the weakest subject. Output via tool call only.`;
    const userMsg = `Student stats:\n${JSON.stringify(stats, null, 2)}`;

    const res = await callAiGatewayWithRotation("/v1/chat/completions", {
      model: "google/gemini-2.5-flash",
      messages: [{ role: "system", content: sys }, { role: "user", content: userMsg }],
      tools: [{
        type: "function",
        function: {
          name: "emit_plan",
          parameters: {
            type: "object",
            properties: {
              summary: { type: "string" },
              days: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    day: { type: "integer" },
                    focus_subject: { type: "string" },
                    topics: { type: "array", items: { type: "string" } },
                    daily_tasks: { type: "array", items: { type: "string" } },
                    time_min: { type: "integer" },
                    motivation_note: { type: "string" },
                  },
                  required: ["day", "focus_subject", "topics", "daily_tasks", "time_min", "motivation_note"],
                  additionalProperties: false,
                },
              },
            },
            required: ["summary", "days"],
            additionalProperties: false,
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "emit_plan" } },
    });
    const j = await res.json();
    const args = j?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) throw new Error("AI returned no plan");
    const payload = JSON.parse(args);
    const { data: inserted, error } = await supabaseAdmin
      .from("ai_paths" as never)
      .insert({
        user_id: context.userId,
        start_date: new Date().toISOString().slice(0, 10),
        payload,
        progress: {},
      } as never)
      .select("id,start_date,payload,progress,created_at")
      .single();
    if (error) throw new Error(error.message);
    return { path: inserted, charged: cost };
  });

export const updatePathProgress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { path_id: string; key: string; done: boolean }) =>
    z.object({
      path_id: z.string().uuid(),
      key: z.string().min(1).max(50),
      done: z.boolean(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: row } = await supabaseAdmin
      .from("ai_paths" as never)
      .select("progress")
      .eq("id", data.path_id).eq("user_id", context.userId).maybeSingle();
    if (!row) throw new Error("Path not found");
    const progress = { ...((row as any).progress ?? {}), [data.key]: data.done };
    const { error } = await supabaseAdmin
      .from("ai_paths" as never)
      .update({ progress } as never)
      .eq("id", data.path_id).eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { progress };
  });
