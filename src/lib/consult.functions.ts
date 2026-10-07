// Dr. Azka Consult — server functions.
// Reads the logged-in student's real rows, runs the pure engines, and (for the study
// plan only) asks the AI to fill a code-built timetable. Read-only except for saving
// a new study plan to ai_paths and charging the existing AI Path cost.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { callAiGatewayWithRotation } from "@/lib/ai-keys.functions";
import { getSettingNumber } from "@/lib/app-settings.functions";
import { isAdminUser } from "@/lib/admin-bypass.server";
import {
  buildSnapshot, predictScore, buildRecommendations, istDay, RULES,
  type RawAttempt, type RawQuestion, type RawMistake, type Lookups, type Snapshot,
} from "@/lib/insights-engine";
import {
  buildSkeleton, fallbackFill, finalizeCompat, INTENSITY_INFO, KIND_LABEL,
  type PlanDay, type Intensity, type StudyMode,
} from "@/lib/study-plan-engine";

const db = supabaseAdmin as any;
const MAX_QUESTIONS = 5000;
const CHUNK = 150;

async function inChunks<T>(ids: string[], fetchChunk: (chunk: string[]) => Promise<T[]>): Promise<T[]> {
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += CHUNK) chunks.push(ids.slice(i, i + CHUNK));
  const out: T[] = [];
  for (let i = 0; i < chunks.length; i += 6) {
    const results = await Promise.all(chunks.slice(i, i + 6).map(fetchChunk));
    results.forEach((r) => out.push(...r));
  }
  return out;
}

/** Load everything the engines need for one student. */
async function loadSnapshot(userId: string): Promise<Snapshot> {
  const since = new Date(Date.now() - RULES.windowDays * 86400_000).toISOString();

  const [{ data: attemptRows, error: aErr }, { data: mistakeRows }, { data: subjectRows }] = await Promise.all([
    db.from("attempts")
      .select("id,answers,correct_count,wrong_count,unattempted_count,score,submitted_at,time_taken_sec,tests:test_id(type,title,question_ids,total_questions)")
      .eq("user_id", userId).eq("status", "completed").gte("submitted_at", since)
      .order("submitted_at", { ascending: false }).limit(400),
    db.from("wrong_questions").select("question_id,chapter_id,created_at").eq("user_id", userId).limit(5000),
    db.from("subjects").select("id,name"),
  ]);
  if (aErr) throw new Error(aErr.message);

  const attempts: RawAttempt[] = (attemptRows ?? []).map((a: any) => ({
    id: a.id,
    answers: a.answers && typeof a.answers === "object" ? a.answers : null,
    correct_count: a.correct_count, wrong_count: a.wrong_count, unattempted_count: a.unattempted_count,
    score: a.score, submitted_at: a.submitted_at, time_taken_sec: a.time_taken_sec,
    test_type: a.tests?.type ?? null, test_title: a.tests?.title ?? null,
    question_ids: Array.isArray(a.tests?.question_ids) ? a.tests.question_ids : null,
    total_questions: a.tests?.total_questions ?? null,
  }));

  // Most recent attempts first, until the question budget is used.
  const qids = new Set<string>();
  for (const a of attempts) {
    const ids = [...Object.keys(a.answers ?? {}), ...(a.question_ids ?? [])];
    if (qids.size + ids.length > MAX_QUESTIONS && qids.size > 0) break;
    ids.forEach((id) => qids.add(id));
  }
  const mistakes: RawMistake[] = (mistakeRows ?? []) as RawMistake[];

  const questionRows = await inChunks<RawQuestion>([...qids], async (chunk) => {
    const { data } = await db.from("questions")
      .select("id,subject_id,chapter_id,correct_index,difficulty").in("id", chunk);
    return (data ?? []) as RawQuestion[];
  });
  const questions = new Map(questionRows.map((q) => [q.id, q]));

  // Load the whole chapter list (same approach as the flashcards / NCERT pages),
  // so names resolve whatever format the chapter ids use.
  const chapterRows: any[] = [];
  for (let from = 0; from < 20000; from += 1000) {
    const { data, error } = await db.from("chapters").select("id,name,subject_id").range(from, from + 999);
    if (error) { console.warn("[consult] chapters lookup failed", error.message); break; }
    chapterRows.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  const chapterMap = new Map<string, { name: string; subject_id: string | null }>();
  for (const c of chapterRows) {
    if (!c?.id || !c?.name) continue;
    const entry = { name: String(c.name).trim(), subject_id: c.subject_id ?? null };
    chapterMap.set(String(c.id), entry);
    chapterMap.set(String(c.id).trim().toLowerCase(), entry);
  }
  // Resolve ids that differ only by case/whitespace.
  const resolve = new Map<string, { name: string; subject_id: string | null }>();
  const allIds = new Set<string>();
  questionRows.forEach((q) => q.chapter_id && allIds.add(q.chapter_id));
  mistakes.forEach((m) => m.chapter_id && allIds.add(m.chapter_id));
  for (const id of allIds) {
    const hit = chapterMap.get(String(id)) ?? chapterMap.get(String(id).trim().toLowerCase());
    if (hit) resolve.set(id, hit);
  }
  if (allIds.size && !resolve.size) console.warn(`[consult] none of ${allIds.size} chapter ids matched the chapters table`);

  const lookups: Lookups = {
    subjectNames: new Map((subjectRows ?? []).map((s: any) => [String(s.id), String(s.name)])),
    chapters: resolve,
  };

  return buildSnapshot({ attempts, questions, lookups, mistakes });
}

type PlanRow = { id: string; start_date: string; payload: any; progress: Record<string, boolean>; created_at: string };

async function latestPlan(userId: string): Promise<PlanRow | null> {
  const { data } = await db.from("ai_paths")
    .select("id,start_date,payload,progress,created_at")
    .eq("user_id", userId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  return (data as PlanRow) ?? null;
}

/** One call powers the Consult hub, the Score Predictor and the Overall Report. */
export const getConsultData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [snapshot, plan, { data: profile }] = await Promise.all([
      loadSnapshot(context.userId),
      latestPlan(context.userId),
      db.from("profiles").select("full_name,target_year,daily_goal").eq("id", context.userId).maybeSingle(),
    ]);
    const prediction = predictScore(snapshot);
    const recommendations = buildRecommendations(snapshot, prediction);

    let planSummary: null | { id: string; version: number; startDate: string; done: number; total: number; dayIndex: number; intensity: string | null } = null;
    if (plan) {
      const days: any[] = plan.payload?.days ?? [];
      const total = days.reduce((t, d) => t + (d.daily_tasks?.length ?? 0), 0);
      const done = Object.values(plan.progress ?? {}).filter(Boolean).length;
      const start = new Date(`${plan.start_date}T00:00:00Z`).getTime();
      const todayMs = new Date(`${istDay(new Date())}T00:00:00Z`).getTime();
      planSummary = {
        id: plan.id, version: Number(plan.payload?.version ?? 1), startDate: plan.start_date,
        done, total, dayIndex: Math.floor((todayMs - start) / 86400_000) + 1,
        intensity: plan.payload?.settings?.intensity ?? null,
      };
    }

    return {
      profile: { name: (profile as any)?.full_name ?? null, targetYear: (profile as any)?.target_year ?? null },
      snapshot, prediction, recommendations, plan: planSummary,
    };
  });

export const getConsultPlan = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [plan, snapshot] = await Promise.all([latestPlan(context.userId), loadSnapshot(context.userId)]);
    const cost = await getSettingNumber("ai_path_cost", 45);
    const free = await isAdminUser(context.userId);
    return {
      plan,
      cost: free ? 0 : cost,
      inputs: {
        weak: snapshot.weaknesses.slice(0, 6).map((c) => ({ name: c.name, section: c.section, accuracy: c.accuracy, answered: c.answered })),
        watch: snapshot.watchlist.slice(0, 4).map((c) => ({ name: c.name, section: c.section, accuracy: c.accuracy })),
        sections: snapshot.sections.map((s) => ({ key: s.key, accuracy: s.accuracy, answered: s.answered })),
        mistakes: snapshot.mistakes.topChapters.slice(0, 3),
        dataLevel: snapshot.dataLevel,
      },
    };
  });

const PlanInput = z.object({
  intensity: z.enum(["standard", "intensive", "dropper"]),
  mode: z.enum(["coaching", "self"]),
  wake: z.string().regex(/^(0[4-9]|1[0-1]):(00|30)$/),
  current: z.object({
    physics: z.string().trim().max(120).optional().default(""),
    chemistry: z.string().trim().max(120).optional().default(""),
    biology: z.string().trim().max(120).optional().default(""),
  }),
});

/** The plan-writing instruction. Kept here so it is easy to review and improve. */
export function planSystemPrompt(): string {
  return `You are Dr. Azka, a senior NEET-UG faculty mentor with 15 years of experience at top Kota coaching institutes.
You are writing ONE student's 7-day timetable. The time slots are already fixed by the system; your job is to fill
each slot with exactly what to study, using ONLY the student's real data provided.

NON-NEGOTIABLE RULES
1. Never invent performance data. Use only the chapters, accuracies and counts given. If a section has little data, say so
   in the summary instead of guessing.
2. Lecture / concept-study slots: if the student told you their current chapter for that subject, continue THAT chapter
   (split it into sensible sub-topics across the week, in syllabus order). If not given, write
   "<Subject>: next lecture in your sequence" — do NOT pick a random chapter.
3. Morning revision = the previous day's lecture topics (Day 1: revise the weakest chapter's notes).
4. "DPP on today's lectures" = questions on that same day's lecture topics, 25–35 questions.
5. Module practice slot = the subject given for that slot; target the student's weak chapters in that subject first
   (accuracy below 50%), then watch-list chapters (50–64%). State the question count (30–50) and a target accuracy
   that is 10–15 points above their current accuracy for that chapter.
6. NCERT reading = line-by-line reading of a specific NCERT chapter/topic for that subject (Biology most days,
   Inorganic/Physical Chemistry NCERT on Chemistry days). Name the chapter.
7. PYQ slot = previous-year NEET questions on a named chapter for that subject, 25–35 questions, timed at 1 min each.
8. Mistake Book slot = the chapters with the most saved mistakes, by name.
9. Sunday = mock day: the full mock is 180 questions in 3 hours (2:00–5:00 PM, the real NEET slot). The analysis slot
   must classify every error (concept gap / silly mistake / time pressure) and update the Mistake Book.
10. Spaced repetition: a weak chapter practised on day N should reappear in revision or PYQs on day N+2 or N+3.
11. Be concrete: every "details" line must contain a number (questions, pages, or a target %) and one clear instruction.
12. Indian NEET context, NCERT-first. Simple English a 17-year-old understands. No emojis. Titles under 60 characters,
    details under 160 characters. motivation_note: one practical sentence, not a generic quote.

Return the result through the emit_plan tool only. Return every block id you were given (except breaks), exactly once.`;
}

function planUserMessage(days: PlanDay[], snapshot: Snapshot, input: z.infer<typeof PlanInput>) {
  const info = INTENSITY_INFO[input.intensity as Intensity];
  const data = {
    plan_type: `${info.label} (${info.hours} of study per day)`,
    study_mode: input.mode === "coaching" ? "Attends coaching / online lectures" : "Self-study from books (no lectures)",
    current_chapters: {
      Physics: input.current.physics || null,
      Chemistry: input.current.chemistry || null,
      Biology: input.current.biology || null,
    },
    performance_last_120_days: {
      questions_answered: snapshot.totals.answered,
      overall_accuracy_pct: snapshot.totals.accuracy,
      avg_seconds_per_question: snapshot.totals.avgSecPerQuestion,
      sections: snapshot.sections.map((s) => ({ section: s.key, answered: s.answered, accuracy_pct: s.accuracy })),
      weak_chapters: snapshot.weaknesses.map((c) => ({ chapter: c.name, section: c.section, accuracy_pct: c.accuracy, answered: c.answered })),
      watch_list_chapters: snapshot.watchlist.map((c) => ({ chapter: c.name, section: c.section, accuracy_pct: c.accuracy, answered: c.answered })),
      strong_chapters: snapshot.strengths.slice(0, 5).map((c) => ({ chapter: c.name, section: c.section, accuracy_pct: c.accuracy })),
      mistake_book_top_chapters: snapshot.mistakes.topChapters,
      data_level: snapshot.dataLevel,
    },
    timetable: days.map((d) => ({
      day: d.day, date: d.date, weekday: d.weekday, mock_day: d.isMockDay,
      blocks: d.blocks.filter((b) => b.kind !== "break")
        .map((b) => ({ id: b.id, time: `${b.start}-${b.end}`, slot: b.label, type: KIND_LABEL[b.kind], subject: b.subject })),
    })),
  };
  return `Fill this student's timetable.\n\n${JSON.stringify(data, null, 2)}`;
}

const PLAN_TOOL = {
  type: "function",
  function: {
    name: "emit_plan",
    parameters: {
      type: "object",
      properties: {
        summary: { type: "string", description: "2–3 sentences: what this week targets and why, citing the student's real numbers." },
        weekly_focus: { type: "array", items: { type: "string" }, description: "Exactly 3 short goals for the week." },
        days: {
          type: "array",
          items: {
            type: "object",
            properties: {
              day: { type: "integer" },
              motivation_note: { type: "string" },
              blocks: {
                type: "array",
                items: {
                  type: "object",
                  properties: { id: { type: "string" }, title: { type: "string" }, details: { type: "string" } },
                  required: ["id", "title", "details"],
                  additionalProperties: false,
                },
              },
            },
            required: ["day", "motivation_note", "blocks"],
            additionalProperties: false,
          },
        },
      },
      required: ["summary", "weekly_focus", "days"],
      additionalProperties: false,
    },
  },
};

async function askAi(model: string, system: string, user: string) {
  const res = await callAiGatewayWithRotation("/v1/chat/completions", {
    model,
    temperature: 0.4,
    messages: [{ role: "system", content: system }, { role: "user", content: user }],
    tools: [PLAN_TOOL],
    tool_choice: { type: "function", function: { name: "emit_plan" } },
  });
  const j = await res.json();
  const args = j?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (!args) throw new Error("AI returned no plan");
  return JSON.parse(args) as { summary: string; weekly_focus: string[]; days: { day: number; motivation_note: string; blocks: { id: string; title: string; details: string }[] }[] };
}

const clip = (s: unknown, n: number) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, n);

export const generateConsultPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => PlanInput.parse(d))
  .handler(async ({ data, context }) => {
    const userId = context.userId;
    const admin = await isAdminUser(userId);
    const cost = admin ? 0 : await getSettingNumber("ai_path_cost", 45);

    // Check the balance before spending AI credits; charge only after a plan exists.
    if (cost > 0) {
      const { data: p } = await db.from("profiles").select("bonus_balance").eq("id", userId).maybeSingle();
      const bal = Number(p?.bonus_balance ?? 0);
      if (bal < cost) throw new Error(`Not enough bonus. You need ${cost} bonus coins (you have ${bal}).`);
    }

    const snapshot = await loadSnapshot(userId);
    const startDate = istDay(new Date());
    let days = buildSkeleton({ intensity: data.intensity, mode: data.mode as StudyMode, wake: data.wake, startDate, snapshot });

    let summary = "";
    let weeklyFocus: string[] = [];
    let source: "ai" | "rules" = "rules";
    const system = planSystemPrompt();
    const user = planUserMessage(days, snapshot, data);
    let ai: Awaited<ReturnType<typeof askAi>> | null = null;
    for (const model of ["google/gemini-2.5-pro", "google/gemini-2.5-flash"]) {
      try { ai = await askAi(model, system, user); break; } catch (e) { console.warn(`[consult-plan] ${model} failed`, e); }
    }

    if (ai) {
      source = "ai";
      summary = clip(ai.summary, 500);
      weeklyFocus = (ai.weekly_focus ?? []).slice(0, 3).map((x) => clip(x, 90));
      const byId = new Map<string, { title: string; details: string }>();
      ai.days?.forEach((d) => d.blocks?.forEach((b) => byId.set(String(b.id), b)));
      const notes = new Map((ai.days ?? []).map((d) => [Number(d.day), clip(d.motivation_note, 160)]));
      days = days.map((d) => ({
        ...d,
        motivation_note: notes.get(d.day) ?? "",
        blocks: d.blocks.map((b) => {
          const f = byId.get(b.id);
          return f && b.kind !== "break" ? { ...b, title: clip(f.title, 70), details: clip(f.details, 200) } : b;
        }),
      }));
    }
    // Any slot the AI skipped gets data-driven content, so the plan is always complete.
    days = finalizeCompat(fallbackFill(days, snapshot));
    if (!summary) {
      const weak = snapshot.weaknesses.slice(0, 2).map((c) => c.name);
      summary = weak.length
        ? `This week prioritises ${weak.join(" and ")}, your lowest-accuracy chapters, while keeping all three subjects moving.`
        : "A balanced week across Physics, Chemistry and Biology. Practise more questions so the next plan can target your weak chapters.";
    }

    const info = INTENSITY_INFO[data.intensity as Intensity];
    const payload = {
      version: 2,
      source,
      summary,
      weekly_focus: weeklyFocus,
      settings: { ...data, label: info.label, hours: info.hours },
      based_on: { answered: snapshot.totals.answered, accuracy: snapshot.totals.accuracy, generated_at: snapshot.generatedAt },
      days,
    };

    const { data: inserted, error } = await db.from("ai_paths")
      .insert({ user_id: userId, start_date: startDate, payload, progress: {} })
      .select("id,start_date,payload,progress,created_at").single();
    if (error) throw new Error(error.message);

    if (cost > 0) {
      const { data: p } = await db.from("profiles").select("bonus_balance").eq("id", userId).maybeSingle();
      const bal = Number(p?.bonus_balance ?? 0);
      await db.from("profiles").update({ bonus_balance: Math.max(0, bal - cost) }).eq("id", userId);
      await db.from("wallet_transactions").insert({
        user_id: userId, amount: -cost, type: "ai_path", bucket: "bonus", status: "success", reference: `consult_plan_${inserted.id}`,
      });
    }
    return { plan: inserted as PlanRow, charged: cost };
  });
