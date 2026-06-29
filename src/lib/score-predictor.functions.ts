import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { callAiGatewayWithRotation } from "@/lib/ai-keys.functions";
import { getSettingNumber } from "@/lib/app-settings.functions";
import { isAdminUser } from "@/lib/admin-bypass.server";

async function chargeBonus(userId: string, cost: number, type: string, reference: string) {
  // Admins bypass all bonus charges (infinite bonus).
  if (await isAdminUser(userId)) return Number.POSITIVE_INFINITY;
  const { data: profile, error } = await supabaseAdmin
    .from("profiles")
    .select("id,bonus_balance")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const current = Number(profile?.bonus_balance ?? 0);
  if (current < cost) {
    throw new Error(`Not enough bonus. You need ${cost} bonus coins (you have ${current}). Earn more from the Bonus page.`);
  }
  const next = current - cost;
  const { error: uErr } = await supabaseAdmin
    .from("profiles")
    .update({ bonus_balance: next })
    .eq("id", userId);
  if (uErr) throw new Error(uErr.message);
  await supabaseAdmin.from("wallet_transactions").insert({
    user_id: userId, amount: -cost, type, bucket: "bonus", status: "success", reference,
  });
  return next;
}

type SubjectStat = { subject: string; attempted: number; correct: number; accuracy: number };

async function gatherUserStats(userId: string) {
  const { data: attempts } = await supabaseAdmin
    .from("attempts")
    .select("id,score,correct_count,wrong_count,unattempted_count,submitted_at,test_id,tests:test_id(type,total_questions)")
    .eq("user_id", userId)
    .eq("status", "completed")
    .order("submitted_at", { ascending: false })
    .limit(40);

  const list = (attempts ?? []) as any[];
  // Per-subject accuracy from attempt_answers
  const { data: ans } = await supabaseAdmin
    .from("attempt_answers" as never)
    .select("is_correct,question_id,questions:question_id(subjects:subject_id(name))")
    .in("attempt_id", list.map((a) => a.id).filter(Boolean) as string[])
    .limit(2000);
  const buckets = new Map<string, { c: number; t: number }>();
  for (const r of (ans ?? []) as any[]) {
    const subj = r?.questions?.subjects?.name ?? "General";
    const cur = buckets.get(subj) ?? { c: 0, t: 0 };
    cur.t++; if (r.is_correct) cur.c++;
    buckets.set(subj, cur);
  }
  const subjectStats: SubjectStat[] = [];
  for (const [subject, v] of buckets) {
    subjectStats.push({ subject, attempted: v.t, correct: v.c, accuracy: v.t ? Math.round((v.c / v.t) * 100) : 0 });
  }
  const totalScore = list.reduce((s, a) => s + Number(a.score ?? 0), 0);
  const totalQs = list.reduce((s, a) => s + Number(a.tests?.total_questions ?? 0), 0);
  return {
    attempts: list.length,
    avgScorePct: totalQs ? Math.round((totalScore / (totalQs * 4)) * 100) : 0,
    subjectStats,
    recent: list.slice(0, 10).map((a) => ({
      score: Number(a.score ?? 0),
      correct: Number(a.correct_count ?? 0),
      wrong: Number(a.wrong_count ?? 0),
      type: a.tests?.type ?? "quiz",
    })),
  };
}

export const getLatestPrediction = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await supabaseAdmin
      .from("score_predictions" as never)
      .select("id,predicted_marks,predicted_air_band,payload,created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return { latest: data ?? null };
  });

export const runScorePrediction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const cost = await getSettingNumber("score_predictor_cost", 25);
    // 1) Gather stats first so we can surface error before charging
    const stats = await gatherUserStats(context.userId);
    if (stats.attempts < 1) {
      throw new Error("Take at least one test before using the Score Predictor.");
    }
    // 2) Charge
    const reference = `predict_${Date.now()}`;
    await chargeBonus(context.userId, cost, "score_predict", reference);

    // 3) Call AI
    const sys = `You are an expert NEET-UG examiner. Given a student's recent NEETIQ test history, predict their NEET-UG 2027 score out of 720.
Be realistic. Output via tool call only.`;
    const userMsg = `Student stats JSON:\n${JSON.stringify(stats, null, 2)}`;
    let res: Response;
    try {
      res = await callAiGatewayWithRotation("/v1/chat/completions", {
        model: "google/gemini-2.5-flash",
        messages: [{ role: "system", content: sys }, { role: "user", content: userMsg }],
        tools: [{
          type: "function",
          function: {
            name: "emit_prediction",
            parameters: {
              type: "object",
              properties: {
                predicted_marks: { type: "integer" },
                predicted_air_band: { type: "string" },
                subject_breakdown: {
                  type: "array",
                  items: { type: "object", properties: {
                    subject: { type: "string" }, predicted_marks: { type: "integer" }, max_marks: { type: "integer" },
                  }, required: ["subject", "predicted_marks", "max_marks"], additionalProperties: false },
                },
                strengths: { type: "array", items: { type: "string" } },
                weaknesses: { type: "array", items: { type: "string" } },
                advice: { type: "array", items: { type: "string" } },
              },
              required: ["predicted_marks", "predicted_air_band", "subject_breakdown", "strengths", "weaknesses", "advice"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "emit_prediction" } },
      });
    } catch (e: any) {
      // Refund on AI failure
      await supabaseAdmin.from("profiles").update({
        bonus_balance: (await supabaseAdmin.from("profiles").select("bonus_balance").eq("id", context.userId).maybeSingle()).data?.bonus_balance as any + cost,
      }).eq("id", context.userId);
      throw e;
    }
    const j = await res.json();
    const args = j?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) throw new Error("AI returned no prediction");
    const payload = JSON.parse(args);

    const { data: inserted, error } = await supabaseAdmin
      .from("score_predictions" as never)
      .insert({
        user_id: context.userId,
        predicted_marks: Math.max(0, Math.min(720, Number(payload.predicted_marks ?? 0))),
        predicted_air_band: String(payload.predicted_air_band ?? "—"),
        payload,
      } as never)
      .select("id,predicted_marks,predicted_air_band,payload,created_at")
      .single();
    if (error) throw new Error(error.message);
    return { prediction: inserted, charged: cost };
  });
