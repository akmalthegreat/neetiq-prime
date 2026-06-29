import { createFileRoute } from "@tanstack/react-router";
import { generateAiDailyQuizzes } from "@/lib/ai-quiz.functions";

function unauthorized() {
  return new Response(JSON.stringify({ error: "unauthorized" }), {
    status: 401, headers: { "content-type": "application/json" },
  });
}

export const Route = createFileRoute("/api/public/cron/daily-dpp")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = request.headers.get("x-cron-secret") ?? "";
        const expected = process.env.CRON_SECRET ?? "";
        if (!expected || secret !== expected) return unauthorized();

        let count = 3;
        try {
          const body = (await request.json().catch(() => ({}))) as { count?: number };
          if (typeof body?.count === "number") count = Math.min(Math.max(body.count, 1), 20);
        } catch { /* empty body ok */ }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        try {
          const out = await generateAiDailyQuizzes({ data: { count } });
          await supabaseAdmin.from("cron_job_runs").insert({
            job_name: "daily-dpp",
            status: out.errors?.length ? "partial" : "ok",
            details: { requested: count, ...out },
          }).then(() => undefined, () => undefined);
          return new Response(JSON.stringify({ ok: true, ...out }), {
            status: 200, headers: { "content-type": "application/json" },
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          await supabaseAdmin.from("cron_job_runs").insert({
            job_name: "daily-dpp",
            status: "error",
            details: { requested: count, error: msg },
          }).then(() => undefined, () => undefined);
          return new Response(JSON.stringify({ ok: false, error: msg }), {
            status: 500, headers: { "content-type": "application/json" },
          });
        }
      },
    },
  },
});