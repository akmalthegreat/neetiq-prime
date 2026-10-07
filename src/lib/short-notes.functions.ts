import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { findNoteChapter } from "@/lib/short-notes-catalog";

/** Returns one chapter of short notes. Signed-in students only. */
export const getShortNote = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { subject: string; slug: string }) =>
    z.object({ subject: z.string().regex(/^[a-z0-9-]+$/), slug: z.string().regex(/^[a-z0-9-]+$/) }).parse(d),
  )
  .handler(async ({ data }) => {
    const ch = findNoteChapter(data.subject, data.slug);
    if (!ch || !ch.ready) throw new Error("These notes are not available yet.");
    const { loadNote } = await import("@/lib/short-notes.server");
    const doc = loadNote(data.subject, data.slug);
    if (!doc) throw new Error("These notes are not available yet.");
    return doc;
  });
