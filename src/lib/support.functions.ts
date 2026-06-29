import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getActiveAiKey } from "@/lib/ai-keys.functions";

const SYSTEM_PROMPT = `You are NEETIQ Support, a friendly assistant for the NEETIQ Prime NEET prep app.
Features: Daily DPP, AI generated quizzes, full Mock tests, PYQs, live Contests with prize money,
Leaderboard, Weekly progress analytics, Subject-wise quizzes, Wallet (deposit/withdraw via Razorpay,
min withdrawal ₹50), Referrals (share code, +10 bonus), Premium subscription (unlimited generated
tests + all paid mocks). Keep replies short (max 3 sentences). If you cannot solve the issue,
say: "I can connect you to the team — tap the team button below."`;

async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

async function getOrCreateOpen(userId: string) {
  const supabaseAdmin = await getAdmin();
  const { data: existing } = await (supabaseAdmin as any)
    .from("support_tickets")
    .select("id, mode, status")
    .eq("user_id", userId).eq("status", "open")
    .order("updated_at", { ascending: false })
    .limit(1).maybeSingle();
  if (existing) return existing as { id: string; mode: "ai" | "team"; status: "open" };
  const { data, error } = await (supabaseAdmin as any)
    .from("support_tickets")
    .insert({ user_id: userId, mode: "ai", status: "open" })
    .select("id, mode, status").single();
  if (error) throw new Error(error.message);
  return data as { id: string; mode: "ai" | "team"; status: "open" };
}

export const getMyTicket = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ticket = await getOrCreateOpen(context.userId);
    const supabaseAdmin = await getAdmin();
    const { data: messages } = await (supabaseAdmin as any)
      .from("support_messages")
      .select("id, sender, content, created_at")
      .eq("ticket_id", ticket.id)
      .order("created_at", { ascending: true });
    return { ticket, messages: messages ?? [] };
  });

export const setSupportMode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ mode: z.enum(["ai", "team"]) }).parse(i))
  .handler(async ({ data, context }) => {
    const ticket = await getOrCreateOpen(context.userId);
    const supabaseAdmin = await getAdmin();
    await (supabaseAdmin as any)
      .from("support_tickets")
      .update({ mode: data.mode, updated_at: new Date().toISOString() })
      .eq("id", ticket.id);
    if (data.mode === "team") {
      await (supabaseAdmin as any).from("support_messages").insert({
        ticket_id: ticket.id, sender: "ai",
        content: "Connected to our team. They'll reply here as soon as possible.",
      });
    }
    return { ok: true };
  });

export const sendSupportMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ content: z.string().trim().min(1).max(2000) }).parse(i))
  .handler(async ({ data, context }) => {
    const ticket = await getOrCreateOpen(context.userId);
    const supabaseAdmin = await getAdmin();
    // store user message
    await (supabaseAdmin as any).from("support_messages").insert({
      ticket_id: ticket.id, sender: "user", content: data.content,
    });
    await (supabaseAdmin as any).from("support_tickets")
      .update({ updated_at: new Date().toISOString() }).eq("id", ticket.id);

    if (ticket.mode === "team") {
      // wait for admin reply (polled by client). No AI call.
      return { ok: true, mode: "team" as const };
    }

    // AI mode: get history + call Lovable AI
    const { data: history } = await (supabaseAdmin as any)
      .from("support_messages").select("sender, content")
      .eq("ticket_id", ticket.id).order("created_at", { ascending: true }).limit(20);
    // Resolve an AI key from the database (admin-managed keys), falling back to env.
    let apiKey: string | null = null;
    try {
      apiKey = await getActiveAiKey();
    } catch (e) {
      console.error("No AI key available", e);
    }
    if (!apiKey) {
      const fallback = "AI is temporarily unavailable. Tap 'Talk to Team' below.";
      await (supabaseAdmin as any).from("support_messages").insert({
        ticket_id: ticket.id, sender: "ai", content: fallback,
      });
      return { ok: true, mode: "ai" as const };
    }
    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...(history ?? []).map((m: any) => ({
        role: m.sender === "user" ? "user" : "assistant",
        content: m.content,
      })),
    ];
    let aiText = "Sorry — I couldn't reach the AI. Try again or tap 'Talk to Team'.";
    try {
      const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "google/gemini-2.0-flash-001", messages }),
      });
      if (r.ok) {
        const j: any = await r.json();
        aiText = j?.choices?.[0]?.message?.content ?? aiText;
      } else {
        console.error("AI gateway", r.status, await r.text());
      }
    } catch (e) { console.error("AI call failed", e); }
    await (supabaseAdmin as any).from("support_messages").insert({
      ticket_id: ticket.id, sender: "ai", content: aiText,
    });
    return { ok: true, mode: "ai" as const };
  });

// ---------------- ADMIN ----------------
async function assertAdmin(userId: string) {
  const supabaseAdmin = await getAdmin();
  const { data } = await (supabaseAdmin as any)
    .from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
  if (!data) throw new Error("Admin only");
}

export const listOpenTickets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const supabaseAdmin = await getAdmin();
    const { data: tickets } = await (supabaseAdmin as any)
      .from("support_tickets")
      .select("id, user_id, mode, status, updated_at, created_at")
      .eq("status", "open")
      .order("updated_at", { ascending: false }).limit(100);
    return { tickets: tickets ?? [] };
  });

export const getTicketMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ ticket_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const supabaseAdmin = await getAdmin();
    const { data: messages } = await (supabaseAdmin as any)
      .from("support_messages").select("id, sender, content, created_at")
      .eq("ticket_id", data.ticket_id).order("created_at", { ascending: true });
    return { messages: messages ?? [] };
  });

export const adminReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    ticket_id: z.string().uuid(),
    content: z.string().trim().min(1).max(2000),
  }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const supabaseAdmin = await getAdmin();
    await (supabaseAdmin as any).from("support_messages").insert({
      ticket_id: data.ticket_id, sender: "admin", content: data.content,
    });
    await (supabaseAdmin as any).from("support_tickets")
      .update({ updated_at: new Date().toISOString() }).eq("id", data.ticket_id);
    return { ok: true };
  });

export const closeTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ ticket_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const supabaseAdmin = await getAdmin();
    await (supabaseAdmin as any).from("support_tickets")
      .update({ status: "closed" }).eq("id", data.ticket_id);
    return { ok: true };
  });

// Bot helper for admins: generate an AI-drafted reply from the conversation.
// `send: true` posts it to the user as a team reply; otherwise it's returned as a suggestion.
export const adminBotReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    ticket_id: z.string().uuid(),
    send: z.boolean().default(false),
  }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const supabaseAdmin = await getAdmin();
    const { data: history } = await (supabaseAdmin as any)
      .from("support_messages").select("sender, content")
      .eq("ticket_id", data.ticket_id).order("created_at", { ascending: true }).limit(30);

    let apiKey: string | null = null;
    try { apiKey = await getActiveAiKey(); } catch { /* fall through */ }
    if (!apiKey) throw new Error("Bot unavailable: AI key not configured");

    const messages = [
      { role: "system", content: `${SYSTEM_PROMPT}\nYou are drafting a reply ON BEHALF OF the support team to the user's latest message. Be specific, warm, and solution-oriented.` },
      ...(history ?? []).map((m: any) => ({
        role: m.sender === "user" ? "user" : "assistant",
        content: m.content,
      })),
    ];

    let aiText = "";
    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "google/gemini-2.0-flash-001", messages }),
    });
    if (!r.ok) {
      const t = await r.text();
      if (r.status === 429) throw new Error("Bot is rate limited, try again shortly.");
      if (r.status === 402) throw new Error("Bot unavailable: AI credits exhausted.");
      throw new Error(`Bot error ${r.status}: ${t.slice(0, 120)}`);
    }
    const j: any = await r.json();
    aiText = j?.choices?.[0]?.message?.content ?? "";
    if (!aiText) throw new Error("Bot returned an empty reply.");

    if (data.send) {
      await (supabaseAdmin as any).from("support_messages").insert({
        ticket_id: data.ticket_id, sender: "admin", content: aiText,
      });
      await (supabaseAdmin as any).from("support_tickets")
        .update({ updated_at: new Date().toISOString() }).eq("id", data.ticket_id);
    }
    return { ok: true, reply: aiText };
  });

