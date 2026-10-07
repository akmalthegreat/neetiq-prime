import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { PageShell } from "@/components/page-shell";
import { useAuth } from "@/hooks/use-auth";
import { NOTES_CHROME_CSS } from "@/components/short-notes/notes-styles";
import { NOTE_CHAPTERS, NOTE_SUBJECTS, type NoteSubject } from "@/lib/short-notes-catalog";

const FONTS = "https://fonts.googleapis.com/css2?family=Poppins:wght@500;600;700;800&family=Manrope:wght@400;500;600;700;800&display=swap";

export const Route = createFileRoute("/short-notes")({
  validateSearch: (s: Record<string, unknown>): { s?: NoteSubject } => {
    const v = s.s;
    return v === "physics" || v === "chemistry" || v === "biology" ? { s: v } : {};
  },
  head: () => ({
    meta: [
      { title: "Short Notes — NEET Track" },
      { name: "description", content: "Premium NCERT-based NEET short notes with diagrams, tables and high-yield highlights." },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: FONTS },
    ],
  }),
  component: ShortNotesHub,
});

function ShortNotesHub() {
  const { s } = Route.useSearch();
  const subject: NoteSubject = s ?? "biology";
  const { user, loading } = useAuth();
  const nav = useNavigate();

  useEffect(() => {
    if (!loading && !user) nav({ to: "/login" });
  }, [user, loading, nav]);

  const chapters = NOTE_CHAPTERS[subject];
  const ready = chapters.filter((c) => c.ready).length;
  const groups = ([11, 12] as const).map((cls) => ({ cls, items: chapters.filter((c) => c.cls === cls) })).filter((g) => g.items.length);

  return (
    <PageShell>
      <div className="snr">
        <style dangerouslySetInnerHTML={{ __html: NOTES_CHROME_CSS }} />
        <div className="snr-in">
          <Link to="/dashboard" className="back">← Dashboard</Link>

          <section className="hero rv" aria-label="Short notes">
            <div className="stack" aria-hidden="true">
              <div className="sheet" /><div className="sheet" />
              <div className="sheet"><i className="t" /><i /><i className="m" /><i className="s" /><i /><i className="m" /><i className="s" /></div>
            </div>
            <div className="eyebrow">NEET Track · Short Notes</div>
            <h1>Short Notes</h1>
            <p>Strictly NCERT, chapter by chapter. Every key point, diagram and NEET trap on a few beautiful pages.</p>
            <div className="feats"><span>Strictly NCERT</span><span>Diagrams</span><span>NEET highlights</span><span>Quick revision</span></div>
          </section>

          <div className="tabs" role="tablist" aria-label="Subject">
            {NOTE_SUBJECTS.map((sub) => {
              const n = NOTE_CHAPTERS[sub.id].filter((c) => c.ready).length;
              return (
                <button key={sub.id} type="button" role="tab" aria-selected={subject === sub.id} className={subject === sub.id ? "on" : ""}
                  onClick={() => nav({ to: "/short-notes", search: { s: sub.id }, replace: true })}>
                  {sub.name}<small>{n ? `${n} ready` : "Coming soon"}</small>
                </button>
              );
            })}
          </div>

          {chapters.length === 0 ? (
            <div className="empty" style={{ marginTop: 16 }}>
              {NOTE_SUBJECTS.find((x) => x.id === subject)?.name} short notes are being written. They will appear here chapter by chapter.
            </div>
          ) : (
            groups.map((g) => (
              <div key={g.cls}>
                <div className="grp"><h2>Class {g.cls}</h2><span>{g.items.filter((c) => c.ready).length} of {g.items.length} ready</span></div>
                <div className="list">
                  {g.items.map((c, k) => c.ready ? (
                    <Link key={c.slug} to="/notes/$subject/$slug" params={{ subject, slug: c.slug }} className="nc" style={{ animationDelay: `${Math.min(0.5, k * 0.03)}s` }}>
                      <span className="no">{c.no}</span>
                      <span className="mid"><span className="t">{c.title}</span><span className="u">Chapter {c.no} Short Notes · {c.unit}</span></span>
                      <span className="go">Open notes</span>
                    </Link>
                  ) : (
                    <div key={c.slug} className="nc soon" style={{ animationDelay: `${Math.min(0.5, k * 0.03)}s` }}>
                      <span className="no">{c.no}</span>
                      <span className="mid"><span className="t">{c.title}</span><span className="u">Chapter {c.no} · {c.unit}</span></span>
                      <span className="lock">SOON</span>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}

          {ready > 0 && (
            <div className="note">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#A78BFA" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>
              <span>Notes open inside NEET Track for reading only. They are personalised to your account and cannot be downloaded or printed.</span>
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}
