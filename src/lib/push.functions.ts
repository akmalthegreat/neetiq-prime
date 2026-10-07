import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const Sub = z.object({
  endpoint: z.string().url().max(1000),
  keys: z.object({ p256dh: z.string().min(10).max(300), auth: z.string().min(6).max(100) }),
});

export const savePushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => Sub.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await (supabaseAdmin as any).from("push_subscriptions").upsert(
      { user_id: context.userId, endpoint: data.endpoint, p256dh: data.keys.p256dh, auth: data.keys.auth, failures: 0 },
      { onConflict: "endpoint" },
    );
    if (error) throw new Error(`Could not turn on notifications: ${error.message}`);
    return { ok: true };
  });

export const removePushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ endpoint: z.string().url().max(1000) }).parse(input))
  .handler(async ({ data, context }) => {
    await (supabaseAdmin as any).from("push_subscriptions").delete().eq("endpoint", data.endpoint).eq("user_id", context.userId);
    return { ok: true };
  });
