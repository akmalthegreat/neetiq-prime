// Miss Azka — the in-app guide. Understands a student's message, finds the right
// chapter in our own database and replies with cards that open the exact page.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callAiGatewayWithRotation } from "@/lib/ai-keys.functions";
import { AZKA_FEATURES, type AzkaAnswer } from "@/lib/azka-catalog";
import { NOTE_CHAPTERS } from "@/lib/short-notes-catalog";
import { actionsToCards, localRoute, matchNoteSlug, subjectName, type AzkaAction, type AzkaChapter } from "@/lib/azka-router";

// ---- Chapter index (cached per worker for 10 minutes) ----
let cache: { at: number; chapters: AzkaChapter[]; byId: Map<string, AzkaChapter> } | null = null;

async function loadIndex() {
  if (cache && Date.now() - cache.at < 10 * 60_000) return cache;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as any;
  const [chs, decks, nugs] = await Promise.all([
    db.from("chapters").select("id,name,subject_id,class,syllabus,order_index").order("order_index"),
    db.from("flashcard_decks").select("id,chapter_id,card_count").eq("is_active", true),
    db.from("ncert_nuggets").select("chapter_id").eq("is_active", true).limit(5000),
  ]);
  const deckByChapter = new Map<string, string>();
  for (const d of (decks.data ?? []) as { id: string; chapter_id: string | null; card_count: number }[]) {
    if (d.chapter_id && d.card_count > 0 && !deckByChapter.has(String(d.chapter_id))) deckByChapter.set(String(d.chapter_id), d.id);
  }
  const nugChapters = new Set(((nugs.data ?? []) as { chapter_id: string }[]).map((n) => String(n.chapter_id)));
  const readyNotes = (subject: string) => (NOTE_CHAPTERS[subject as keyof typeof NOTE_CHAPTERS] ?? []).filter((n) => n.ready);
  const chapters: AzkaChapter[] = ((chs.data ?? []) as any[]).map((c) => {
    const subject = String(c.subject_id ?? "").toLowerCase();
    return {
      id: String(c.id),
      name: String(c.name),
      subject,
      cls: c.class ?? null,
      topics: String(c.syllabus ?? "").split(/•|;|\n/).map((t: string) => t.trim()).filter((t: string) => t.length > 2),
      deckId: deckByChapter.get(String(c.id)) ?? null,
      hasNuggets: nugChapters.has(String(c.id)),
      noteSlug: matchNoteSlug(String(c.name), readyNotes(subject)),
    };
  });
  cache = { at: Date.now(), chapters, byId: new Map(chapters.map((c) => [c.id, c])) };
  return cache;
}

// ---- AI ----
function systemPrompt(chapters: AzkaChapter[]) {
  const features = AZKA_FEATURES.map((f) => `- ${f.id}: ${f.label} — ${f.desc}`).join("\n");
  const chapterLines = chapters
    .map((c) => `${c.id} | ${subjectName(c.subject)} ${c.cls ?? ""} | ${c.name}${c.noteSlug ? " [notes]" : ""}${c.deckId ? " [flashcards]" : ""}${c.hasNuggets ? " [nuggets]" : ""}`)
    .join("\n");
  return `You are Miss Azka, the friendly guide inside NEET Track (a NEET preparation app). You help students find and use every feature, and you can open the exact page they need.

How to answer:
- Reply in the student's language and style (English, Hindi or Hinglish). Warm, encouraging, like a caring senior. At most 3 short sentences. One emoji at most.
- Whenever a page in the app can help, add actions so the student gets a tap-to-open card. Prefer actions over long explanations.
- For "notes / short notes" use short_notes, for flashcards use flashcards, for NCERT lines use nuggets, for "questions / quiz / test / MCQs / practice" on a topic use make_quiz (count 5-50, default 10; difficulty Easy, Medium, Hard or Mixed; pyq_only when they ask for PYQs).
- Map topics to the chapter that contains them (e.g. "mitochondria" → Cell: The Unit of Life; "Krebs cycle" → Respiration in Plants). Only use chapter ids from the list. If a name exists in two subjects (e.g. Thermodynamics) and the subject is unclear, include both.
- For anything else in the app (mistakes, saved questions, analytics, mock tests, PYQ papers, study plan, contests, wallet, premium …) use open_feature.
- Short concept doubts: answer briefly and correctly, then suggest a related card (notes or a quiz).
- Never invent links, features, prices or facts about the app. If you can't help, say so and offer open_feature "consult" or suggest "Talk to team".
- Suggestions: up to 3 very short follow-up messages the student might tap next (in their language).

Features (open_feature ids):
${features}

Chapters (id | subject class | name | what exists):
${chapterLines}`;
}

const TOOL = {
  type: "function",
  function: {
    name: "azka_respond",
    description: "Reply to the student and attach tap-to-open cards.",
    parameters: {
      type: "object",
      properties: {
        reply: { type: "string" },
        actions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              type: { type: "string", enum: ["open_feature", "short_notes", "flashcards", "nuggets", "make_quiz"] },
              feature: { type: "string", enum: AZKA_FEATURES.map((f) => f.id) },
              chapter_ids: { type: "array", items: { type: "string" } },
              count: { type: "integer" },
              difficulty: { type: "string", enum: ["Easy", "Medium", "Hard", "Mixed"] },
              pyq_only: { type: "boolean" },
            },
            required: ["type"],
          },
        },
        suggestions: { type: "array", items: { type: "string" } },
      },
      required: ["reply", "actions"],
    },
  },
};

const Input = z.object({
  message: z.string().trim().min(1).max(600),
  history: z
    .array(z.object({ role: z.enum(["user", "azka"]), text: z.string().max(1200) }))
    .max(10)
    .default([]),
  firstName: z.string().max(40).optional(),
});

export const askAzka = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => Input.parse(i))
  .handler(async ({ data }): Promise<AzkaAnswer> => {
    const { chapters, byId } = await loadIndex();
    const local = localRoute(data.message, chapters);

    try {
      const hint = local.matched.length
        ? `\n\n(Hint from keyword search — chapters that look relevant: ${local.matched.map((c) => `${c.id} ${c.name}`).join("; ")})`
        : "";
      const res = await callAiGatewayWithRotation("/v1/chat/completions", {
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt(chapters) },
          ...data.history.slice(-8).map((m) => ({ role: m.role === "user" ? "user" : "assistant", content: m.text })),
          { role: "user", content: `${data.firstName ? `[Student: ${data.firstName}] ` : ""}${data.message}${hint}` },
        ],
        tools: [TOOL],
        tool_choice: { type: "function", function: { name: "azka_respond" } },
      });
      const j: any = await res.json();
      const raw = j?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      const reply = String(parsed?.reply ?? "").trim();
      if (!reply) throw new Error("empty reply");
      const cards = actionsToCards(Array.isArray(parsed?.actions) ? (parsed.actions as AzkaAction[]) : [], byId);
      const suggestions = (Array.isArray(parsed?.suggestions) ? parsed.suggestions : [])
        .map((s: unknown) => String(s).trim())
        .filter((s: string) => s && s.length <= 80)
        .slice(0, 3);
      return { reply: reply.slice(0, 900), cards, suggestions };
    } catch (e) {
      console.error("[azka] AI unavailable, using local routing", e);
      return { reply: local.reply, cards: actionsToCards(local.actions, byId), suggestions: [] };
    }
  });
