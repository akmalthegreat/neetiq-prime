import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PageShell } from "@/components/page-shell";
import { useAuth } from "@/hooks/use-auth";
import { NOTES_CHROME_CSS, NOTES_DOC_CSS } from "@/components/short-notes/notes-styles";
import { findNoteChapter, NOTE_SUBJECTS } from "@/lib/short-notes-catalog";
import { getShortNote } from "@/lib/short-notes.functions";

const FONTS = "https://fonts.googleapis.com/css2?family=Poppins:wght@500;600;700;800&family=Manrope:wght@400;500;600;700;800&display=swap";

export const Route = createFileRoute("/notes/$subject/$slug")({
  head: ({ params }) => {
    const ch = findNoteChapter(params.subject, params.slug);
    return {
      meta: [{ title: `${ch?.title ?? "Short Notes"} · Short Notes — NEET Track` }, { name: "robots", content: "noindex" }],
      links: [
        { rel: "preconnect", href: "https://fonts.googleapis.com" },
        { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
        { rel: "stylesheet", href: FONTS },
      ],
    };
  },
  component: NoteReader,
});

type NoteDoc = {
  meta: { title: string; cls: number; no: number; unit: string; tagline: string };
  sections: { title: string; html: string }[];
};

const xml = (s: string) => s.replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c] as string);

/** Faint diagonal watermark with the student's name, repeated over every page. */
function watermarkUrl(label: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="190"><text x="150" y="100" text-anchor="middle" transform="rotate(-24 150 95)" font-family="Inter,Arial,sans-serif" font-size="15" font-weight="700" fill="#4C1D95">${xml(label)}</text></svg>`;
  return `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}")`;
}

function NoteReader() {
  const { subject, slug } = Route.useParams();
  const { user, profile, loading } = useAuth();
  const nav = useNavigate();
  const fetchNote = useServerFn(getShortNote);
  const chapter = findNoteChapter(subject, slug);
  const subjectName = NOTE_SUBJECTS.find((s) => s.id === subject)?.name ?? "Notes";

  useEffect(() => {
    if (!loading && !user) nav({ to: "/login" });
  }, [user, loading, nav]);

  // Wait for auth to hydrate before asking for the content.
  const note = useQuery<NoteDoc>({
    queryKey: ["short-note", subject, slug, user?.id ?? "anon"],
    queryFn: () => fetchNote({ data: { subject, slug } }) as Promise<NoteDoc>,
    enabled: !!user && !!chapter?.ready,
    staleTime: 10 * 60_000,
    retry: 1,
  });

  /* ---------- reading protection: no copy, no context menu, no print / save shortcuts */
  const docRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState<string | null>(null);
  useEffect(() => {
    const block = (e: Event) => e.preventDefault();
    const onClick = (e: Event) => {
      const fig = (e.target as Element | null)?.closest?.("figure.sn-fig");
      if (fig) setZoom(fig.outerHTML);
    };
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && ["p", "s", "c", "x", "a", "u"].includes(k)) e.preventDefault();
      if (k === "printscreen") e.preventDefault();
    };
    const el = docRef.current;
    el?.addEventListener("contextmenu", block);
    el?.addEventListener("copy", block);
    el?.addEventListener("cut", block);
    el?.addEventListener("dragstart", block);
    el?.addEventListener("selectstart", block);
    el?.addEventListener("click", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      el?.removeEventListener("contextmenu", block);
      el?.removeEventListener("copy", block);
      el?.removeEventListener("cut", block);
      el?.removeEventListener("dragstart", block);
      el?.removeEventListener("selectstart", block);
      el?.removeEventListener("click", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [note.data]);

  /* ---------- page tracking for the "Page x / n" pill and progress bar */
  const total = (note.data?.sections.length ?? 0) + 1;
  const [page, setPage] = useState(1);
  const [progress, setProgress] = useState(0);
  const [tocOpen, setTocOpen] = useState(false);
  useEffect(() => {
    if (!note.data) return;
    const pages = Array.from(document.querySelectorAll<HTMLElement>(".snr .sn-page"));
    const io = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (vis) setPage(Number((vis.target as HTMLElement).dataset.page ?? 1));
      },
      { rootMargin: "-35% 0px -55% 0px" },
    );
    pages.forEach((p) => io.observe(p));
    const onScroll = () => {
      const h = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(h > 0 ? Math.min(100, (window.scrollY / h) * 100) : 0);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => { io.disconnect(); window.removeEventListener("scroll", onScroll); };
  }, [note.data]);

  useEffect(() => {
    if (!tocOpen && !zoom) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setTocOpen(false); setZoom(null); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tocOpen, zoom]);

  const goTo = (n: number) => {
    setTocOpen(false);
    const el = document.querySelector<HTMLElement>(`.snr .sn-page[data-page="${n}"]`);
    if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - (window.innerWidth >= 1024 ? 70 : 135), behavior: "smooth" });
  };

  const viewer = profile?.full_name?.trim() || user?.email || "NEET Track student";
  const wm = useMemo(() => watermarkUrl(`NEET Track · ${viewer}`), [viewer]);
  const doc = note.data;
  const metaLine = doc ? `Class ${doc.meta.cls} · Ch ${doc.meta.no} · ${doc.meta.title}` : "";

  return (
    <PageShell>
      <div className="snr">
        <style dangerouslySetInnerHTML={{ __html: NOTES_CHROME_CSS + NOTES_DOC_CSS }} />
        <div className="bar">
          <Link to="/short-notes" search={{ s: subject as never }} className="bk" aria-label="Back to short notes">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
          </Link>
          <div className="ttl">
            <b>{chapter?.title ?? "Short Notes"}</b>
            <small>{subjectName} · Class {chapter?.cls ?? ""} · Short Notes</small>
          </div>
          {doc && (
            <button type="button" className="pg" onClick={() => setTocOpen(true)} aria-label="Open contents">
              {page} / {total}
            </button>
          )}
          <span className="prog" style={{ width: `${progress}%` }} />
        </div>

        {!chapter?.ready ? (
          <div className="snr-in"><div className="empty">These notes are not available yet. <Link to="/short-notes" style={{ color: "#C4B5FD" }}>Browse short notes</Link></div></div>
        ) : note.isError ? (
          <div className="snr-in"><div className="empty">Could not open these notes. Please check your connection and try again.</div></div>
        ) : !doc ? (
          <div aria-label="Loading notes"><div className="skel-page" /><div className="skel-page" /></div>
        ) : (
          <div ref={docRef} className="sn-doc protect">
            <NotePages doc={doc} wm={wm} subjectName={subjectName} metaLine={metaLine} total={total} />
            <div className="fineprint">For reading on NEET Track only · Licensed to {viewer}</div>
          </div>
        )}

        {zoom && (
          <div className="zoomwrap" role="dialog" aria-modal="true" aria-label="Diagram">
            <div className="zbar">
              <span>Diagram · scroll or pinch to explore</span>
              <button type="button" onClick={() => setZoom(null)} aria-label="Close diagram">✕</button>
            </div>
            <div className="zscroll" onContextMenu={(e) => e.preventDefault()}>
              <div className="sn-doc protect" dangerouslySetInnerHTML={{ __html: zoom }} />
            </div>
          </div>
        )}

        {tocOpen && doc && (
          <>
            <div className="scrim" onClick={() => setTocOpen(false)} />
            <div className="toc" role="dialog" aria-modal="true" aria-label="Contents">
              <div className="grab" />
              <h3>Contents</h3>
              <button type="button" className={page === 1 ? "on" : ""} onClick={() => goTo(1)}><span>1</span>Cover</button>
              {doc.sections.map((s, i) => (
                <button key={i} type="button" className={page === i + 2 ? "on" : ""} onClick={() => goTo(i + 2)}><span>{i + 2}</span>{s.title}</button>
              ))}
            </div>
          </>
        )}
      </div>
    </PageShell>
  );
}

/** The paper pages. Memoised so scroll-driven state (page pill, progress bar) never re-renders the notes. */
const NotePages = memo(function NotePages({ doc, wm, subjectName, metaLine, total }: {
  doc: NoteDoc; wm: string; subjectName: string; metaLine: string; total: number;
}) {
  return (
    <>
      <div className="sn-page sn-cover" data-page={1}>
        <div className="orb" /><div className="orb2" />
        <div className="bignum">{String(doc.meta.no).padStart(2, "0")}</div>
        <div className="sn-wm" style={{ backgroundImage: wm, opacity: 0.05, filter: "invert(1)" }} />
        <div className="in">
          <div className="brand">NEET Track · Short Notes</div>
          <div className="kick">{subjectName} · Class {doc.meta.cls} · Chapter {doc.meta.no}</div>
          <h1>{doc.meta.title}</h1>
          {doc.meta.tagline ? <div className="sub">{doc.meta.tagline}</div> : null}
          <div className="chips"><span>Strictly NCERT</span><span>NEET syllabus</span><span>Diagrams &amp; highlights</span></div>
          <div className="sn-toc"><b>Inside</b><ol>{doc.sections.map((s, i) => <li key={i}>{s.title}</li>)}</ol></div>
        </div>
      </div>
      {doc.sections.map((s, i) => (
        <div key={i} className="sn-page" data-page={i + 2}>
          <div className="sn-wm" style={{ backgroundImage: wm }} />
          <div className="sn-run"><span><b>NEET Track</b> · Short Notes · {subjectName}</span><span>{metaLine}</span></div>
          <div dangerouslySetInnerHTML={{ __html: s.html }} />
          <div className="sn-foot"><span>neettrack.com</span><span>Page {i + 2} / {total}</span></div>
        </div>
      ))}
    </>
  );
});
