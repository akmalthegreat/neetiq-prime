import { createFileRoute } from "@tanstack/react-router";
import { generateAiDailyQuizzes } from "@/lib/ai-quiz.functions";

function unauthorized() {
  return Response.json({ error: "unauthorized" }, { status: 401 });
}

export const Route = createFileRoute("/api/public/hooks/generate-daily-quiz")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = request.headers.get("x-cron-secret") ?? "";
        const expected = process.env.CRON_SECRET ?? "";
        if (!expected || secret !== expected) return unauthorized();

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        let count = 1;
        try {
          const body = await request.json().catch(() => null);
          if (body && typeof body.count === "number") {
            count = Math.min(20, Math.max(1, Math.floor(body.count)));
          }
        } catch {/* ignore */}
        try {
          const result = await generateAiDailyQuizzes({ data: { count } });
          await supabaseAdmin.from("cron_job_runs").insert({
            job_name: "daily-ai-quiz",
            status: result.errors.length ? "partial" : "ok",
            details: { count, ...result },
          });
          return Response.json({ ok: true, ...result });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          await supabaseAdmin.from("cron_job_runs").insert({
            job_name: "daily-ai-quiz",
            status: "error",
            details: { error: msg },
          }).then(() => undefined, () => undefined);
          return Response.json(
            { ok: false, error: msg },
            { status: 500 },
          );
        }
      },
    },
  },
});