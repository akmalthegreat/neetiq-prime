import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getActiveAiKey } from "@/lib/ai-keys.functions";

type QType =
  | "numerical" | "assertion-reason" | "statement-based" | "match-the-following"
  | "ranking" | "graphical" | "diagram-based" | "case-based" | "fill-in-the-blanks"
  | "incorrect-statement" | "reaction-sequence" | "concept-mcq";

type GenQ = {
  type: QType;
  text: string;
  options: [string, string, string, string];
  correct_index: 0 | 1 | 2 | 3;
  explanation: string;
  difficulty: "Easy" | "Medium" | "Hard";
};

// Prize weights for ranks 1..10. Normalised across the actual number of joiners (capped at 10).
export const PRIZE_WEIGHTS = [30, 20, 12, 10, 8, 6, 5, 4, 3, 2] as const;

/** Pool = entry_fee × joiners. Split among top-min(joiners,10) by normalised weights. */
export function computePrizeSplit(pool: number, joiners: number): number[] {
  const winners = Math.min(Math.max(0, Math.floor(joiners)), 10);
  if (winners <= 0 || pool <= 0) return [];
  const weights = PRIZE_WEIGHTS.slice(0, winners);
  const sum = weights.reduce((a, b) => a + b, 0);
  // Round each to 2 decimals; push any rounding remainder onto rank 1.
  const raw = weights.map((w) => Math.round(((pool * w) / sum) * 100) / 100);
  const distributed = raw.reduce((a, b) => a + b, 0);
  const remainder = Math.round((pool - distributed) * 100) / 100;
  if (raw.length > 0) raw[0] = Math.round((raw[0] + remainder) * 100) / 100;
  return raw;
}



const NEET_MASTER_SYSTEM = `You are an elite NEET-UG / IIT-JEE question setter. Generate high-yield, exam-standard, unique MCQs from the rationalized NCERT syllabus (Classes 11 & 12).

LATEX: Wrap every variable, unit, formula, ratio in LaTeX. Inline $...$, display $$...$$. Single backslash inside JSON strings. Never break \`$\` delimiters.

QUESTION-TYPE MIX (vary across the batch — never all the same type):
- numerical, assertion-reason, statement-based, ranking, graphical, diagram-based, case-based, fill-in-the-blanks, incorrect-statement, reaction-sequence, concept-mcq
- match-the-following: MUST use a LaTeX array table — NOT a markdown pipe table. Exact template:
\`Match the following ...:\\n\\n$$\\n\\\\begin{array}{|c|c|}\\n\\\\hline\\n\\\\textbf{Column I} & \\\\textbf{Column II} \\\\\\\\\\n\\\\hline\\nA.\\\\ \\\\text{...} & i.\\\\ \\\\text{...} \\\\\\\\\\n\\\\hline\\nB.\\\\ \\\\text{...} & ii.\\\\ \\\\text{...} \\\\\\\\\\n\\\\hline\\nC.\\\\ \\\\text{...} & iii.\\\\ \\\\text{...} \\\\\\\\\\n\\\\hline\\nD.\\\\ \\\\text{...} & iv.\\\\ \\\\text{...} \\\\\\\\\\n\\\\hline\\n\\\\end{array}\\n$$\\n\\nSelect the correct matching sequence:\`
  Options like "A-iii, B-i, C-ii, D-iv".
- diagram-based: describe a labelled diagram in words/LaTeX with labels (P), (Q), (R), (S) and ask to identify a part. No images.
- assertion-reason 4 options: (A) Both true + R explains A. (B) Both true but R does NOT explain A. (C) A true, R false. (D) A false, R true. Text: \`**Assertion (A):** ...\\n\\n**Reason (R):** ...\`

QUALITY: Zero redundancy. All 4 distractors plausible. Exactly one correct option. Mix Easy/Medium/Hard. Spread correct option across A/B/C/D.

EXPLANATION — SHORT & CLEAR (4–8 lines max). Understanding > length. No long derivations, no 4-section template.
- One line key concept / NCERT fact
- 1–3 lines core reasoning or calculation (LaTeX)
- One line ruling out closest distractor
- End with \`**Answer: Option X.**\``;

async function generateContestQuestions(
  chapters: { name: string; subject: string }[],
  count: number,
): Promise<GenQ[]> {
  const apiKey = await getActiveAiKey();
  const chapterList = chapters.map((c) => `- ${c.subject} / ${c.name}`).join("\n");
  const user = `Produce ${count} unique NEET-grade MCQs distributed across these chapters:\n${chapterList}\nUse a VARIED mix of question types. Each MCQ has 4 distinct options and one correct index (0-3).`;
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [{ role: "system", content: NEET_MASTER_SYSTEM }, { role: "user", content: user }],
      tools: [{ type: "function", function: { name: "emit_questions", parameters: {
        type: "object", properties: { questions: { type: "array", items: { type: "object", properties: {
          type: { type: "string", enum: [
            "numerical","assertion-reason","statement-based","match-the-following",
            "ranking","graphical","diagram-based","case-based","fill-in-the-blanks",
            "incorrect-statement","reaction-sequence","concept-mcq",
          ] },
          text: { type: "string" },
          options: { type: "array", items: { type: "string" }, minItems: 4, maxItems: 4 },
          correct_index: { type: "integer", minimum: 0, maximum: 3 },
          explanation: { type: "string" },
          difficulty: { type: "string", enum: ["Easy","Medium","Hard"] },
        }, required: ["type","text","options","correct_index","explanation","difficulty"], additionalProperties: false } } },
        required: ["questions"], additionalProperties: false,
      }}}],
      tool_choice: { type: "function", function: { name: "emit_questions" } },
    }),
  });
  if (!res.ok) throw new Error(`AI gateway error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const args = data?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (!args) throw new Error("AI did not return tool call");
  const parsed = JSON.parse(args) as { questions: GenQ[] };
  return (parsed.questions ?? []).filter((q) => q.text && q.options?.length === 4 && q.correct_index >= 0 && q.correct_index <= 3);
}

async function assertAdmin(supa: typeof supabaseAdmin, userId: string) {
  const { data: roles } = await supa.from("user_roles").select("role").eq("user_id", userId);
  if (!roles?.some((r) => r.role === "admin")) throw new Error("Admin only");
}

export const adminCreateContest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    title: z.string().min(3).max(120),
    description: z.string().max(500).optional(),
    prize_pool: z.number().min(0).max(1000000),
    entry_fee: z.number().min(0).max(10000),
    starts_at: z.string().min(10),
    duration_min: z.number().int().min(5).max(180),
    total_questions: z.number().int().min(1).max(200),
    chapter_ids: z.array(z.string().uuid()).max(20).optional().default([]),
    manual_questions: z.array(z.object({
      text: z.string().min(3),
      options: z.array(z.string().min(1)).length(4),
      correct_index: z.number().int().min(0).max(3),
      explanation: z.string().optional().nullable(),
      difficulty: z.string().optional().default("medium"),
      subject_id: z.string().uuid().optional().nullable(),
      chapter_id: z.string().uuid().optional().nullable(),
    })).optional().default([]),
  }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(supabaseAdmin, context.userId);

    let insertRows: Array<{
      subject_id: string | null; chapter_id: string | null; text: string;
      options: string[]; correct_index: number; explanation: string | null;
      difficulty: string; source: string; marks_correct: number; marks_wrong: number;
    }> = [];

    if (data.manual_questions.length > 0) {
      insertRows = data.manual_questions.map((q) => ({
        subject_id: q.subject_id ?? null, chapter_id: q.chapter_id ?? null,
        text: q.text, options: q.options, correct_index: q.correct_index,
        explanation: q.explanation ?? null,
        difficulty: (q.difficulty ?? "medium").toLowerCase(),
        source: "MANUAL-CONTEST", marks_correct: 4, marks_wrong: -1,
      }));
    } else {
      if (!data.chapter_ids.length) throw new Error("Pick at least one chapter or add manual questions");
      const { data: chapters, error: chErr } = await supabaseAdmin
        .from("chapters").select("id,name,subject_id,subjects:subject_id(name)").in("id", data.chapter_ids);
      if (chErr || !chapters?.length) throw new Error("Chapters not found");
      const chapterInfo = chapters.map((c) => ({
        id: c.id, subject_id: c.subject_id, name: c.name,
        subject: (c as { subjects: { name: string } | null }).subjects?.name ?? "Science",
      }));
      const qs = await generateContestQuestions(chapterInfo.map((c) => ({ name: c.name, subject: c.subject })), data.total_questions);
      if (qs.length < Math.min(5, data.total_questions)) throw new Error(`AI returned only ${qs.length} questions`);
      insertRows = qs.map((q, i) => {
        const ch = chapterInfo[i % chapterInfo.length];
        return { subject_id: ch.subject_id, chapter_id: ch.id, text: q.text, options: q.options,
          correct_index: q.correct_index, explanation: q.explanation ?? null,
          difficulty: (q.difficulty ?? "Medium").toLowerCase(), source: `AI-CONTEST-${q.type}`, marks_correct: 4, marks_wrong: -1 };
      });
    }

    const { data: inserted, error: qErr } = await supabaseAdmin.from("questions").insert(insertRows).select("id");
    if (qErr) throw new Error(qErr.message);
    const questionIds = (inserted ?? []).map((r) => r.id);


    const startsAt = new Date(data.starts_at);
    const endsAt = new Date(startsAt.getTime() + data.duration_min * 60_000);

    const { data: test, error: tErr } = await supabaseAdmin.from("tests").insert({
      title: data.title, description: data.description ?? null, type: "contest", difficulty: "medium",
      duration_min: data.duration_min, total_questions: questionIds.length,
      is_paid: data.entry_fee > 0, entry_fee: data.entry_fee, prize_pool: data.prize_pool,
      starts_at: startsAt.toISOString(), ends_at: endsAt.toISOString(),
      question_ids: questionIds, marks_correct: 4, marks_wrong: -1,
      source: "AI-CONTEST", created_by: context.userId,
    }).select("id").single();
    if (tErr) throw new Error(tErr.message);

    const { data: contest, error: cErr } = await supabaseAdmin.from("contests").insert({
      title: data.title, description: data.description ?? null,
      prize_pool: data.prize_pool, entry_fee: data.entry_fee,
      starts_at: startsAt.toISOString(), ends_at: endsAt.toISOString(),
      duration_min: data.duration_min, total_questions: questionIds.length,
      chapter_ids: data.chapter_ids, question_ids: questionIds,
      test_id: test.id, created_by: context.userId,
    }).select("id").single();
    if (cErr) throw new Error(cErr.message);

    return { contest_id: contest.id, test_id: test.id, questions: questionIds.length };
  });

/** Sanctioned battleground stakes (in ₹). Free = 0. */
export const ENTRY_FEE_OPTIONS = [0, 2, 5, 10, 25] as const;

export const joinContest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      contest_id: z.string().uuid(),
      // Each user picks their own stake when joining a battleground.
      entry_fee: z.number().refine((n) => (ENTRY_FEE_OPTIONS as readonly number[]).includes(n), {
        message: "Entry fee must be one of 0, 2, 5, 10, 25",
      }).default(0),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    // RPC accepts (_contest_id, _fee). Older deployments without the new signature
    // will fall back to the legacy single-arg form.
    let entryId: string | null = null;
    const { data: newEntryId, error } = await context.supabase.rpc("join_contest", {
      _contest_id: data.contest_id,
      _fee: data.entry_fee,
    });
    if (error) {
      // Fallback for pre-migration databases.
      if (/function .*join_contest.* does not exist|argument/i.test(error.message)) {
        const r2 = await context.supabase.rpc("join_contest", { _contest_id: data.contest_id });
        if (r2.error) throw new Error(r2.error.message);
        entryId = r2.data as string;
      } else {
        throw new Error(error.message);
      }
    } else {
      entryId = newEntryId as string;
    }

    const { data: contest } = await context.supabase
      .from("contests")
      .select("test_id,title")
      .eq("id", data.contest_id)
      .maybeSingle();
    try {
      const { pushNotification } = await import("@/lib/notifications.functions");
      await pushNotification({
        user_id: context.userId, kind: "contest",
        title: `Joined battleground: ${contest?.title ?? "Contest"}`,
        body: `Stake ${data.entry_fee > 0 ? "₹" + data.entry_fee : "Free"}. Open the contest page to play when it starts.`,
        link: `/contest/${data.contest_id}`,
      });
    } catch (e) { console.error("notify join failed", e); }
    return { entry_id: entryId, test_id: contest?.test_id ?? null };
  });

/** Returns past contests (last 30 days) with finalization done lazily + leaderboard top 10. */
export const listPastContests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const since = new Date(Date.now() - 30 * 86400_000).toISOString();
    const nowIso = new Date().toISOString();
    // Finalize any ended-but-unfinalized contests
    const { data: pending } = await supabaseAdmin.from("contests")
      .select("id").lte("ends_at", nowIso).eq("status", "scheduled").gte("ends_at", since);
    for (const c of pending ?? []) {
      try { await supabaseAdmin.rpc("finalize_contest", { _contest_id: c.id }); } catch (e) { console.error("finalize", c.id, e); }
    }
    const { data: contests } = await supabaseAdmin.from("contests")
      .select("id,title,prize_pool,entry_fee,starts_at,ends_at,total_questions,status,test_id")
      .lte("ends_at", nowIso).gte("ends_at", since)
      .order("ends_at", { ascending: false }).limit(30);

    const out: Array<{
      id: string; title: string; prize_pool: number; entry_fee: number;
      starts_at: string; ends_at: string; total_questions: number; status: string; test_id: string;
      entries_count: number;
      leaderboard: { user_id: string; full_name: string | null; rank: number; score: number; prize_amount: number }[];
    }> = [];
    for (const c of contests ?? []) {
      const [{ count }, { data: results }] = await Promise.all([
        supabaseAdmin.from("contest_entries").select("id", { count: "exact", head: true }).eq("contest_id", c.id),
        supabaseAdmin.from("contest_results")
          .select("user_id,rank,score,prize_amount,profiles:user_id(full_name)")
          .eq("contest_id", c.id).order("rank", { ascending: true }).limit(10),
      ]);
      out.push({
        ...c, entries_count: count ?? 0,
        leaderboard: (results ?? []).map((r) => ({
          user_id: r.user_id, rank: r.rank, score: Number(r.score), prize_amount: Number(r.prize_amount),
          full_name: (r as any).profiles?.full_name ?? null,
        })),
      });
    }
    return out;
  });

/** Detail for a single contest (live or past): rules, leaderboard, prizes, solutions. */
export const getContestDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ contest_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: c, error: cErr } = await supabaseAdmin
      .from("contests")
      .select("id,title,description,prize_pool,entry_fee,starts_at,ends_at,duration_min,total_questions,status,test_id,question_ids")
      .eq("id", data.contest_id)
      .maybeSingle();
    if (cErr || !c) throw new Error("Contest not found");

    const ended = new Date(c.ends_at).getTime() <= Date.now();
    // Lazy finalize if window closed
    if (ended && c.status !== "finalized") {
      try { await supabaseAdmin.rpc("finalize_contest", { _contest_id: c.id }); } catch {/* ignore */}
    }

    // NOTE: `entry_fee` on contest_entries is added by db/battlegrounds-user-stakes.sql.
    // Until the user runs that migration the typegen lacks the column, so we cast.
    const entriesAll = supabaseAdmin
      .from("contest_entries")
      .select("user_id, entry_fee")
      .eq("contest_id", c.id) as unknown as Promise<{
        data: Array<{ user_id: string; entry_fee: number | null }> | null;
      }>;
    const myEntryReq = supabaseAdmin
      .from("contest_entries")
      .select("id, attempt_id, entry_fee")
      .eq("contest_id", c.id)
      .eq("user_id", context.userId)
      .maybeSingle() as unknown as Promise<{
        data: { id: string; attempt_id: string | null; entry_fee: number | null } | null;
      }>;

    const [{ count: entriesCount }, { data: myEntry }, { data: results }, { data: entries }] =
      await Promise.all([
        supabaseAdmin
          .from("contest_entries")
          .select("id", { count: "exact", head: true })
          .eq("contest_id", c.id),
        myEntryReq,
        // No FK join here — relational embeds silently return empty when the
        // FK relationship isn't declared, which breaks the leaderboard.
        supabaseAdmin
          .from("contest_results")
          .select("user_id,rank,score,prize_amount")
          .eq("contest_id", c.id)
          .order("rank", { ascending: true })
          .limit(100),
        entriesAll,
      ]);


    const joiners = entriesCount ?? (entries?.length ?? 0);

    // Pool = SUM of per-user stakes when any are non-zero, otherwise
    // legacy: contest entry_fee × joiners, otherwise the configured prize_pool.
    const stakeSum = (entries ?? []).reduce(
      (a, e: { entry_fee: number | null }) => a + (Number(e.entry_fee) || 0),
      0,
    );
    const legacyFee = Number(c.entry_fee) || 0;
    const prizePool =
      stakeSum > 0
        ? Math.round(stakeSum * 100) / 100
        : legacyFee > 0
          ? Math.round(legacyFee * joiners * 100) / 100
          : Number(c.prize_pool) || 0;
    const split = computePrizeSplit(prizePool, joiners);

    type Row = {
      user_id: string; rank: number; score: number; prize_amount: number;
      full_name: string | null; avatar_url: string | null;
    };

    // Resolve profile names for ALL participants in one batch, no fragile FK joins.
    const allUserIds = Array.from(
      new Set<string>([
        ...(results ?? []).map((r) => r.user_id as string),
        ...(entries ?? []).map((e) => e.user_id as string),
      ]),
    );
    const profileMap = new Map<string, { full_name: string | null; avatar_url: string | null }>();
    if (allUserIds.length) {
      const { data: profs } = await supabaseAdmin
        .from("profiles")
        .select("id,full_name,avatar_url")
        .in("id", allUserIds);
      for (const p of profs ?? []) {
        profileMap.set(p.id as string, {
          full_name: (p.full_name as string | null) ?? null,
          avatar_url: (p.avatar_url as string | null) ?? null,
        });
      }
    }

    let leaderboard: Row[] = [];
    const finalized = (results ?? []).length > 0;
    if (finalized) {
      leaderboard = (results ?? []).map((r) => {
        const p = profileMap.get(r.user_id as string);
        return {
          user_id: r.user_id as string,
          rank: r.rank as number,
          score: Number(r.score),
          prize_amount: Number(r.prize_amount),
          full_name: p?.full_name ?? null,
          avatar_url: p?.avatar_url ?? null,
        };
      });
    } else {
      // Build a LIVE leaderboard from entries + their latest completed attempt.
      const userIds = (entries ?? []).map((e) => e.user_id as string);
      const attemptByUser = new Map<string, { score: number; tsec: number }>();
      if (c.test_id && userIds.length) {
        const { data: atts } = await supabaseAdmin
          .from("attempts")
          .select("user_id,score,time_taken_sec,submitted_at,status")
          .eq("test_id", c.test_id)
          .eq("status", "completed")
          .in("user_id", userIds)
          .order("submitted_at", { ascending: false });
        for (const a of atts ?? []) {
          if (!attemptByUser.has(a.user_id as string)) {
            attemptByUser.set(a.user_id as string, {
              score: Number(a.score) || 0,
              tsec: Number(a.time_taken_sec) || 999999,
            });
          }
        }
      }
      leaderboard = (entries ?? [])
        .map((e) => {
          const uid = e.user_id as string;
          const a = attemptByUser.get(uid);
          const p = profileMap.get(uid);
          return {
            user_id: uid,
            score: a?.score ?? 0,
            tsec: a?.tsec ?? 999999,
            full_name: p?.full_name ?? null,
            avatar_url: p?.avatar_url ?? null,
          };
        })
        .sort((x, y) => (y.score - x.score) || (x.tsec - y.tsec))
        .map((r, i) => ({
          user_id: r.user_id,
          rank: i + 1,
          score: r.score,
          prize_amount: split[i] ?? 0,
          full_name: r.full_name,
          avatar_url: r.avatar_url,
        }));
    }

    // ----- Inject 6 bot players. Bots ALWAYS occupy top-3 with believable
    // scores that are strictly greater than every real player AND ≤ max score.
    // Bot prize_amount is 0 — real users keep the prize they actually earned.
    {
      const maxScore = Math.max(1, Number(c.total_questions ?? 0)) * 4;
      const topReal = leaderboard.reduce((m, r) => Math.max(m, Number(r.score) || 0), 0);
      // Hashed seed for stable per-contest bot identities
      let seed = 0;
      for (let i = 0; i < c.id.length; i++) seed = (seed * 31 + c.id.charCodeAt(i)) | 0;
      const rand = (i: number) => {
        const x = Math.sin((seed + i * 9301 + 49297) % 233280) * 10000;
        return x - Math.floor(x);
      };
      const BOT_POOL = [
        "Aarav Prime", "Meera Ace", "Vihaan Pro", "Isha Spark", "Kabir Nova",
        "Tara Flux", "Arjun Nair", "Anaya Verma", "Rohan Pillai", "Diya Khanna",
        "Ishaan Rao", "Sneha Iyer",
      ];
      // Pick 6 deterministic, unique names per contest
      const used = new Set<number>();
      const chosen: string[] = [];
      while (chosen.length < 6 && used.size < BOT_POOL.length) {
        const idx = Math.floor(rand(chosen.length + 1) * BOT_POOL.length);
        if (!used.has(idx)) { used.add(idx); chosen.push(BOT_POOL[idx]); }
      }
      // Build 6 strictly-decreasing scores in (topReal, maxScore].
      // Floor at topReal+1; ceil at maxScore. If room is tight, allow equal
      // adjacent bot scores but never < topReal+1 and never > maxScore.
      const minBot = Math.min(maxScore, topReal + 1);
      const span = Math.max(0, maxScore - minBot);
      const botScores: number[] = [];
      for (let i = 0; i < 6; i++) {
        // bot[0] is the strongest; bot[5] is the weakest above the user
        const portion = span === 0 ? 0 : 1 - i / 6 - rand(i + 10) * 0.05;
        const s = Math.round(minBot + span * Math.max(0, Math.min(1, portion)));
        botScores.push(Math.max(minBot, Math.min(maxScore, s)));
      }
      // Enforce strictly non-increasing while preserving the floor
      for (let i = 1; i < botScores.length; i++) {
        if (botScores[i] > botScores[i - 1]) botScores[i] = botScores[i - 1];
        if (botScores[i] < minBot) botScores[i] = minBot;
      }
      const botRows: Row[] = chosen.map((name, i) => ({
        user_id: `bot:${c.id}:${i}`,
        rank: 0,
        score: botScores[i],
        prize_amount: 0,
        full_name: name,
        avatar_url: null,
      }));
      // Merge + sort by score desc; ties keep bots above real users
      const merged = [...botRows, ...leaderboard];
      merged.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        const aBot = a.user_id.startsWith("bot:");
        const bBot = b.user_id.startsWith("bot:");
        if (aBot !== bBot) return aBot ? -1 : 1;
        return 0;
      });
      leaderboard = merged.map((r, i) => ({ ...r, rank: i + 1 }));
    }

    // Solutions: only show after contest end
    let questions: Array<{
      id: string; text: string; options: string[]; correct_index: number;
      explanation: string | null; difficulty: string;
    }> = [];
    if (ended && c.question_ids?.length) {
      const { data: qs } = await supabaseAdmin
        .from("questions")
        .select("id,text,options,correct_index,explanation,difficulty")
        .in("id", c.question_ids);
      const order = c.question_ids as string[];
      questions = order
        .map((id) => qs?.find((q) => q.id === id))
        .filter(Boolean)
        .map((q: any) => ({ ...q, options: q.options as string[] }));
    }

    return {
      contest: { ...c, prize_pool: prizePool },
      ended,
      entries_count: joiners,
      prize_pool: prizePool,
      prize_split: split,
      my_entry: myEntry ?? null,
      leaderboard,
      questions,
    };
  });

