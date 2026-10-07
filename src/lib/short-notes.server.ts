// Server-only: loads short-note HTML fragments from src/content/short-notes/<subject>/<slug>.html.
// Only imported (dynamically) from inside a server function handler, so the note text is
// never part of the browser bundle — students can read it only through getShortNote().

const FILES = import.meta.glob("../content/short-notes/*/*.html", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

export type NoteSection = { title: string; html: string };
export type NoteDoc = {
  meta: { title: string; cls: number; no: number; unit: string; tagline: string };
  sections: NoteSection[];
};

const decode = (s: string) =>
  s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");

export function loadNote(subject: string, slug: string): NoteDoc | null {
  if (!/^[a-z0-9-]+$/.test(subject) || !/^[a-z0-9-]+$/.test(slug)) return null;
  const raw = FILES[`../content/short-notes/${subject}/${slug}.html`];
  if (!raw) return null;

  const metaMatch = raw.match(/<!--meta([\s\S]*?)-->/);
  let meta: NoteDoc["meta"] = { title: slug, cls: 11, no: 0, unit: "", tagline: "" };
  if (metaMatch) {
    try { meta = { ...meta, ...JSON.parse(metaMatch[1]) }; } catch { /* keep defaults */ }
  }
  const body = raw.replace(/<!--meta[\s\S]*?-->/, "");
  const sections = body
    .split(/(?=<section\b)/)
    .map((s) => s.trim())
    .filter((s) => s.startsWith("<section"))
    .map((html) => ({ title: decode(html.match(/data-title="([^"]*)"/)?.[1] ?? "Section"), html }));
  return { meta, sections };
}
