import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireFeature } from "@/lib/access.server";

type Feature = "flashcards" | "ncert_highlights";

export const accessStudyFeature = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { feature: Feature }) =>
    z.object({ feature: z.enum(["flashcards", "ncert_highlights"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireFeature(context.userId, data.feature);
    return { ok: true, charged: 0, free: true as const };
  });
