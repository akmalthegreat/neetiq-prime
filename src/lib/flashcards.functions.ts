import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { callAiGatewayWithRotation } from "@/lib/ai-keys.functions";

async function assertAdmin(userId: string) {
  const { data: roles } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (!roles?.some((r) => r.role === "admin")) throw new Error("Admin only");
}

export type Flashcard = {
  id: string;
  deck_id: string;
  front: string;
  back: string;
  hint: string | null;
  tags: string[];
  difficulty: string;
  source: string;
  position: number;
};

export type FlashcardDeck = {
  id: string;
  title: string;
  subject: string;
  description: string | null;
  card_count: number;
  sort_order: number;
  chapter_id: string | null;
  class: number | null;
};

const CARD_COLS = "id,deck_id,front,back,hint,tags,difficulty,source,position";

// -------- Public: list decks --------
export const listFlashcardDecks = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await supabaseAdmin
    .from("flashcard_decks" as never)
    .select("id,title,subject,description,card_count,sort_order,chapter_id,class")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  const decks = ((data ?? []) as FlashcardDeck[]).filter((d) => d.card_count > 0);
  return { decks, totalCards: decks.reduce((n, d) => n + d.card_count, 0) };
});

// -------- Public: cards of one deck (in order), or a random mix from a subject --------
export const getFlashcards = createServerFn({ method: "POST" })
  .inputValidator((d: { deck_id?: string | null; subject?: string | null; limit?: number }) =>
    z.object({
      deck_id: z.string().uuid().nullable().optional(),
      subject: z.string().max(40).nullable().optional(),
      limit: z.number().int().min(1).max(300).optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    if (data.deck_id) {
      const { data: rows, error } = await supabaseAdmin
        .from("flashcards" as never)
        .select(CARD_COLS)
        .eq("deck_id", data.deck_id)
        .order("position", { ascending: true })
        .limit(data.limit ?? 300);
      if (error) throw new Error(error.message);
      return { cards: (rows ?? []) as Flashcard[] };
    }
    // Random mix: pick decks of the subject, then sample cards.
    let dq = supabaseAdmin.from("flashcard_decks" as never).select("id").eq("is_active", true);
    if (data.subject) dq = dq.eq("subject", data.subject);
    const { data: decks } = await dq;
    const ids = ((decks ?? []) as { id: string }[]).map((d) => d.id);
    if (!ids.length) return { cards: [] as Flashcard[] };
    const { data: rows, error } = await supabaseAdmin
      .from("flashcards" as never)
      .select(CARD_COLS)
      .in("deck_id", ids)
      .limit(3000);
    if (error) throw new Error(error.message);
    const list = (rows ?? []) as Flashcard[];
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return { cards: list.slice(0, data.limit ?? 30) };
  });

// -------- Auth: my latest rating for every card I've reviewed --------
export const getMyFlashcardProgress = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const latest: Record<string, { r: number; d: string | null }> = {};
    for (let off = 0; off < 20000; off += 1000) {
      const { data, error } = await supabaseAdmin
        .from("flashcard_reviews" as never)
        .select("card_id,deck_id,rating,reviewed_at")
        .eq("user_id", context.userId)
        .order("reviewed_at", { ascending: false })
        .range(off, off + 999);
      if (error) throw new Error(error.message);
      const chunk = (data ?? []) as { card_id: string; deck_id: string | null; rating: number }[];
      for (const r of chunk) if (!latest[r.card_id]) latest[r.card_id] = { r: r.rating, d: r.deck_id };
      if (chunk.length < 1000) break;
    }
    return { latest };
  });

// -------- Auth: record review (1 = revise again, 2 = unsure, 3 = know it) --------
export const recordFlashcardReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { card_id: string; deck_id?: string | null; rating: 1 | 2 | 3 }) =>
    z.object({
      card_id: z.string().uuid(),
      deck_id: z.string().uuid().nullable().optional(),
      rating: z.number().int().min(1).max(3),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await supabaseAdmin.from("flashcard_reviews" as never).insert({
      user_id: context.userId,
      card_id: data.card_id,
      deck_id: data.deck_id ?? null,
      rating: data.rating,
    } as any);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Find or create the deck for a chapter and return its id. */
async function deckForChapter(ch: { id: string; name: string; class: number | null; subjectName: string }): Promise<string> {
  const { data: found } = await supabaseAdmin.from("flashcard_decks" as never).select("id").eq("chapter_id", ch.id).maybeSingle();
  if (found) return (found as { id: string }).id;
  const { data, error } = await supabaseAdmin.from("flashcard_decks" as never).insert({
    title: ch.name, subject: ch.subjectName, chapter_id: ch.id, class: ch.class,
    description: ch.class ? `Class ${ch.class}` : null, card_count: 0, sort_order: 1000, is_active: true,
  } as any).select("id").single();
  if (error || !data) throw new Error(error?.message ?? "Could not create deck");
  return (data as { id: string }).id;
}

async function addCardsToDeck(deckId: string, cards: AiCard[]) {
  const { count } = await supabaseAdmin.from("flashcards" as never).select("id", { count: "exact", head: true }).eq("deck_id", deckId);
  const base = count ?? 0;
  const rows = cards.map((c, i) => ({
    deck_id: deckId, front: c.front, back: c.back,
    difficulty: (c.difficulty ?? "Medium").toLowerCase(), source: "AI · NCERT", position: base + i + 1, tags: [],
  }));
  const { error } = await supabaseAdmin.from("flashcards" as never).insert(rows as any);
  if (error) throw new Error(error.message);
  await supabaseAdmin.from("flashcard_decks" as never).update({ card_count: base + rows.length } as any).eq("id", deckId);
  return rows.length;
}

// -------- Admin: generate flashcards with AI --------
const FC_SYSTEM = `You are an elite NEET-UG / NCERT flashcard author.
Generate concise, high-yield flashcards (front/back) from the requested chapter.
- "front": a short question, term, or "Define/State/Compare X" prompt (<= 140 chars).
- "back": the precise NCERT-grade answer (1-3 short sentences or a tight bulleted list).
- Use LaTeX for variables / formulas / units: $v=u+at$, $\\Delta H$, $\\text{kJ mol}^{-1}$.
- No markdown headings, no images, no diagrams, no \`\`\`tikz/\`\`\`mermaid blocks.
- Spread difficulty: ~40% Easy, ~40% Medium, ~20% Hard.
- Be factually correct, exam-grade. Avoid trivia outside NEET syllabus.`;

type AiCard = { front: string; back: string; difficulty?: "Easy" | "Medium" | "Hard" };

async function generateAiFlashcards(subjectName: string, chapterName: string, klass: number, n: number): Promise<AiCard[]> {
  const user = `Subject: ${subjectName}
Chapter: "${chapterName}" (Class ${klass})
Produce ${n} unique NEET-grade flashcards strictly from this chapter. Vary topic coverage across the chapter.`;

  const res = await callAiGatewayWithRotation("/v1/chat/completions", {
    model: "google/gemini-2.5-flash",
    messages: [
      { role: "system", content: FC_SYSTEM },
      { role: "user", content: user },
    ],
    tools: [{
      type: "function",
      function: {
        name: "emit_flashcards",
        parameters: {
          type: "object",
          properties: {
            cards: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  front: { type: "string" },
                  back: { type: "string" },
                  difficulty: { type: "string", enum: ["Easy", "Medium", "Hard"] },
                },
                required: ["front", "back"],
                additionalProperties: false,
              },
            },
          },
          required: ["cards"],
          additionalProperties: false,
        },
      },
    }],
    tool_choice: { type: "function", function: { name: "emit_flashcards" } },
  });
  const data = await res.json();
  const args = data?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (!args) throw new Error("AI returned no tool call");
  const parsed = JSON.parse(args) as { cards: AiCard[] };
  return (parsed.cards ?? []).filter((c) => c.front && c.back);
}

export const adminGenerateFlashcards = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { chapter_id: string; count?: number }) =>
    z.object({
      chapter_id: z.string().min(1).max(64),
      count: z.number().int().min(5).max(60).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { data: ch, error: chErr } = await supabaseAdmin
      .from("chapters")
      .select("id,name,class,subject_id,subjects:subject_id(name)")
      .eq("id", data.chapter_id)
      .maybeSingle();
    if (chErr || !ch) throw new Error("Chapter not found");
    const c = ch as any;
    const subjName = (c.subjects?.name as string) ?? "Science";
    const cards = await generateAiFlashcards(subjName, c.name, c.class ?? 12, data.count ?? 20);
    if (cards.length === 0) throw new Error("AI returned no cards");
    const deckId = await deckForChapter({ id: String(c.id), name: c.name, class: c.class ?? null, subjectName: subjName });
    const created = await addCardsToDeck(deckId, cards);
    return { created, chapter: c.name as string };
  });

export const adminDeleteFlashcardsByChapter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { chapter_id: string }) =>
    z.object({ chapter_id: z.string().min(1).max(64) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { data: deck } = await supabaseAdmin.from("flashcard_decks" as never).select("id").eq("chapter_id", data.chapter_id).maybeSingle();
    if (!deck) return { deleted: 0 };
    const deckId = (deck as { id: string }).id;
    const { error, count } = await supabaseAdmin
      .from("flashcards" as never)
      .delete({ count: "exact" })
      .eq("deck_id", deckId);
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("flashcard_decks" as never).update({ card_count: 0 } as any).eq("id", deckId);
    return { deleted: count ?? 0 };
  });

export const adminListChaptersForFlashcards = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data, error } = await supabaseAdmin
      .from("chapters")
      .select("id,name,class,subject_id,subjects:subject_id(name)")
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map((c: any) => ({
      id: c.id,
      name: c.name,
      class: c.class,
      subject_id: c.subject_id,
      subject_name: c.subjects?.name ?? "General",
    }));
  });

// -------- Admin: BULK generate flashcards across chapters --------
// Processes chapters that currently have no flashcards, a few per call to stay
// within serverless time limits. Call repeatedly until `remaining` is 0.
export const adminGenerateFlashcardsBulk = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { subject_id?: string | null; per_chapter?: number; max_chapters?: number }) =>
    z.object({
      subject_id: z.string().max(64).nullable().optional(),
      per_chapter: z.number().int().min(5).max(40).optional(),
      max_chapters: z.number().int().min(1).max(8).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const per = data.per_chapter ?? 15;
    const batch = data.max_chapters ?? 4;

    let chQ = supabaseAdmin
      .from("chapters")
      .select("id,name,class,subject_id,subjects:subject_id(name)")
      .order("name", { ascending: true });
    if (data.subject_id) chQ = chQ.eq("subject_id", data.subject_id);
    const { data: chapters, error: chErr } = await chQ;
    if (chErr) throw new Error(chErr.message);

    const { data: filled } = await supabaseAdmin.from("flashcard_decks" as never).select("chapter_id,card_count").gt("card_count", 0);
    const populated = new Set(((filled ?? []) as { chapter_id: string | null }[]).map((r) => r.chapter_id).filter(Boolean));
    const pending = (chapters ?? []).filter((c: any) => !populated.has(String(c.id)));

    const slice = pending.slice(0, batch);
    let created = 0;
    const results: { chapter: string; created: number }[] = [];
    for (const ch of slice as any[]) {
      try {
        const subjName = ch.subjects?.name ?? "Science";
        const cards = await generateAiFlashcards(subjName, ch.name, ch.class ?? 12, per);
        if (cards.length) {
          const deckId = await deckForChapter({ id: String(ch.id), name: ch.name, class: ch.class ?? null, subjectName: subjName });
          const n = await addCardsToDeck(deckId, cards);
          created += n; results.push({ chapter: ch.name, created: n });
        }
      } catch (e) { console.error("bulk flashcards", ch.name, e); }
    }
    return {
      processed: slice.length,
      created,
      remaining: Math.max(0, pending.length - slice.length),
      results,
    };
  });
