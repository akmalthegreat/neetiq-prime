import { createFileRoute } from "@tanstack/react-router";

/**
 * Sends queued notifications (push_jobs) in small batches. Called every minute
 * during the evening quiz window by pg_cron. The first call for a job also adds
 * the in-app bell notifications.
 */
const BATCH = 40; // with the database calls, stays under the Workers sub-request limit of 50

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

export const Route = createFileRoute("/api/public/cron/push-run")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = request.headers.get("x-cron-secret") ?? "";
        const expected = process.env.CRON_SECRET ?? "";
        if (!expected || secret !== expected) return json({ error: "unauthorized" }, 401);

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { vapidAuth, sendEmptyPush } = await import("@/lib/web-push.server");
        const db = supabaseAdmin as any;

        const since = new Date(Date.now() - 6 * 3600_000).toISOString();
        const { data: job } = await db.from("push_jobs").select("*").eq("done", false).gte("created_at", since)
          .order("id", { ascending: true }).limit(1).maybeSingle();
        if (!job) return json({ ok: true, idle: true });

        let inApp = 0;
        if (!job.in_app_done) {
          const { data, error } = await db.rpc("push_job_in_app", { _job: job.id });
          if (error) return json({ ok: false, error: error.message }, 500);
          inApp = Number(data) || 0;
        }

        const { data: cfg } = await db.from("push_config").select("*").eq("id", 1).maybeSingle();
        const { data: subs, error: bErr } = await db.rpc("push_job_batch", { _job: job.id, _limit: BATCH });
        if (bErr) return json({ ok: false, error: bErr.message }, 500);
        const list = (subs ?? []) as { id: number; endpoint: string }[];

        let sent = 0;
        const gone: number[] = [];
        if (cfg && list.length) {
          const auths = new Map<string, string>();
          for (const s of list) {
            const origin = new URL(s.endpoint).origin;
            let auth = auths.get(origin);
            if (!auth) { auth = await vapidAuth(cfg.vapid_private_jwk, cfg.vapid_public, cfg.subject, s.endpoint); auths.set(origin, auth); }
            const r = await sendEmptyPush(s.endpoint, auth);
            if (r.ok) sent++;
            if (r.gone) gone.push(s.id);
          }
        }
        if (gone.length) await db.from("push_subscriptions").delete().in("id", gone);

        const last = list.length ? list[list.length - 1].id : job.cursor_id;
        await db.from("push_jobs").update({
          cursor_id: last, sent: (job.sent ?? 0) + sent, done: list.length < BATCH,
        }).eq("id", job.id);

        return json({ ok: true, job: job.id, in_app: inApp, batch: list.length, sent, removed: gone.length });
      },
    },
  },
});
