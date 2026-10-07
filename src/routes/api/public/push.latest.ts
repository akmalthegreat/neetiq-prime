import { createFileRoute } from "@tanstack/react-router";

/** Text for the most recent notification. The service worker shows it when a push arrives. */
export const Route = createFileRoute("/api/public/push/latest")({
  server: {
    handlers: {
      GET: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data } = await (supabaseAdmin as any).from("push_jobs")
          .select("title,body,url,kind,created_at").order("id", { ascending: false }).limit(1).maybeSingle();
        const msg = data ?? { title: "NEET Track", body: "Open NEET Track to see what's new.", url: "/dashboard", kind: "general" };
        return new Response(JSON.stringify(msg), {
          headers: { "content-type": "application/json", "cache-control": "no-store" },
        });
      },
    },
  },
});
