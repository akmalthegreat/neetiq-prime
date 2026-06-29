import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/cron/finalize-contests")({
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
        const nowIso = new Date().toISOString();
        const { data: pending } = await supabaseAdmin
          .from("contests")
          .select("id")
          .lte("ends_at", nowIso)
          .eq("status", "scheduled");
        const ids = (pending ?? []).map((c: { id: string }) => c.id);
        const errors: Array<{ id: string; error: string }> = [];
        for (const id of ids) {
          const { error } = await supabaseAdmin.rpc("finalize_contest", { _contest_id: id });
          if (error) errors.push({ id, error: error.message });
        }
        return new Response(
          JSON.stringify({ ok: true, finalized: ids.length - errors.length, errors }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      },
    },
  },
});