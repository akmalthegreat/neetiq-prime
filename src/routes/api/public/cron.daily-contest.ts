import { createFileRoute } from "@tanstack/react-router";

/**
 * Creates one free auto-AI contest for the day, starting in 1 hour, lasting 30 min.
 * Uses the same DB layout as the admin contest creator.
 */
export const Route = createFileRoute("/api/public/cron/daily-contest")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = request.headers.get("x-cron-secret") ?? "";
        const expected = process.env.CRON_SECRET ?? "";
        if (!expected || secret !== expected) {
          return new Response(JSON.stringify({ error: "unauthorized" }), {
            status: 401, headers: { "content-type": "application/json" },
          });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Skip if a contest already exists for today.
        const since = new Date(); since.setUTCHours(0, 0, 0, 0);
        const { data: existing } = await supabaseAdmin
          .from("contests")
          .select("id")
          .gte("created_at", since.toISOString())
          .ilike("title", "Daily Contest%")
          .limit(1);
        if (existing && existing.length > 0) {
          return new Response(JSON.stringify({ ok: true, skipped: "already exists" }), {
            status: 200, headers: { "content-type": "application/json" },
          });
        }

        // Generate questions by reusing the daily-quiz generator (it inserts
        // a 'daily' test); then promote a copy to a contest.
        const { generateAiDailyQuizzes } = await import("@/lib/ai-quiz.functions");
        const gen = await generateAiDailyQuizzes({ data: { count: 1 } });
        if (!gen.created) {
          return new Response(JSON.stringify({ ok: false, error: "AI generation failed", details: gen.errors }), {
            status: 500, headers: { "content-type": "application/json" },
          });
        }

        // Grab newest 'daily' test, clone into contest.
        const { data: src } = await supabaseAdmin
          .from("tests")
          .select("id,title,description,duration_min,total_questions,question_ids")
          .eq("type", "daily")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!src) {
          return new Response(JSON.stringify({ ok: false, error: "No source test" }), {
            status: 500, headers: { "content-type": "application/json" },
          });
        }

        const startsAt = new Date(Date.now() + 60 * 60_000); // +1h
        const endsAt = new Date(startsAt.getTime() + (src.duration_min ?? 15) * 60_000);

        const { data: test, error: tErr } = await supabaseAdmin.from("tests").insert({
          title: `Daily Contest — ${new Date().toLocaleDateString()}`,
          description: "Free daily AI contest",
          type: "contest",
          difficulty: "medium",
          duration_min: src.duration_min ?? 15,
          total_questions: src.total_questions,
          is_paid: false,
          entry_fee: 0,
          prize_pool: 0,
          starts_at: startsAt.toISOString(),
          ends_at: endsAt.toISOString(),
          question_ids: src.question_ids,
          marks_correct: 4,
          marks_wrong: -1,
          source: "AI-CRON-CONTEST",
        }).select("id").single();
        if (tErr) {
          return new Response(JSON.stringify({ ok: false, error: tErr.message }), {
            status: 500, headers: { "content-type": "application/json" },
          });
        }

        const { data: contest, error: cErr } = await supabaseAdmin.from("contests").insert({
          title: `Daily Contest — ${new Date().toLocaleDateString()}`,
          description: "Free daily AI contest",
          prize_pool: 0,
          entry_fee: 0,
          starts_at: startsAt.toISOString(),
          ends_at: endsAt.toISOString(),
          duration_min: src.duration_min ?? 15,
          total_questions: src.total_questions,
          chapter_ids: [],
          question_ids: src.question_ids,
          test_id: test.id,
        }).select("id").single();
        if (cErr) {
          return new Response(JSON.stringify({ ok: false, error: cErr.message }), {
            status: 500, headers: { "content-type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ ok: true, contest_id: contest.id, test_id: test.id }), {
          status: 200, headers: { "content-type": "application/json" },
        });
      },
    },
  },
});