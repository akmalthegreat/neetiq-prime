import { Fragment, type ReactNode } from "react";
import { InlineMath, BlockMath } from "react-katex";
import "katex/dist/katex.min.css";
import { cn } from "@/lib/utils";
import { decodeEntities } from "@/lib/html-entities";
import { Tikz } from "@/components/tikz";
import { Mermaid } from "@/components/mermaid";
import { JSDELIVR_CDN_BASE, RAW_GITHUB_CDN_BASE, QUESTION_IMAGE_CDN_BASE } from "@/lib/cdn";

/**
 * Diagram- and Image-aware rich text renderer for NEET exam questions.
 * Handles:
 *  - HTML <img> tags with local or remote src
 *  - Cloudinary, Mathpix, Supabase, and generic image URLs
 *  - Relative image paths (/img/data/..., physics/..., etc.)
 *  - Inline LaTeX: $...$ or \(...\)
 *  - Block LaTeX: $$...$$ or \[...\]
 *  - HTML tags: <br>, <strong>, <b>, <em>, <i>, <sub>, <sup>, <p>
 *  - TikZ and Mermaid diagrams
 *  - Safe fallback when LaTeX fails
 */
export function RichText({ children, className }: { children?: string | null; className?: string }) {
  if (!children) return null;
  try {
    return (
      <span className={cn("inline-block max-w-full break-words leading-relaxed whitespace-pre-wrap", className)}>
        {renderWithMatching(children)}
      </span>
    );
  } catch (error) {
    console.error("[rich-text] render failed", error);
    return <span className={cn("break-words whitespace-pre-wrap", className)}>{toPlainText(children)}</span>;
  }
}

/**
 * Plain-text version of a stored question, for previews and one-line summaries
 * (strips markup, decodes entities, keeps statement/column content readable).
 */
export function toPlainText(src?: string | null): string {
  if (!src) return "";
  return decodeEntities(
    src
      .replace(MATCHING_RE, (_all, left?: string, right?: string) => {
        const parts = [left, right].map((x) => (x ?? "").trim()).filter(Boolean);
        return parts.length ? ` ${parts.join(" | ")}` : "";
      })
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<[^>]+>/g, ""),
  )
    .replace(/\s+/g, " ")
    .trim();
}

// Questions imported from the bank keep statement pairs and match-the-column
// lists in this wrapper: <div class="matching-question"><div class="column-left">…</div><div class="column-right">…</div></div>
// (sometimes empty). Column contents never contain nested <div>s.
const MATCHING_RE =
  /<div\s+class=["']matching-question["']\s*>\s*(?:<div\s+class=["']column-left["']\s*>([\s\S]*?)<\/div>)?\s*(?:<div\s+class=["']column-right["']\s*>([\s\S]*?)<\/div>)?\s*<\/div>/gi;

function renderWithMatching(src: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = new RegExp(MATCHING_RE.source, "gi");
  let last = 0;
  let k = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const before = src.slice(last, m.index);
    if (before.trim()) out.push(<Fragment key={k++}>{renderBlocks(normalizeRichText(before).replace(/\s+$/, ""))}</Fragment>);
    const left = m[1] ?? "";
    const right = m[2] ?? "";
    if (stripTags(left) || stripTags(right)) {
      out.push(<MatchingBlock key={k++} left={left} right={right} stem={src.slice(0, m.index)} />);
    }
    last = m.index + m[0].length;
  }
  const rest = src.slice(last);
  if (rest.trim() || out.length === 0) out.push(<Fragment key={k++}>{renderBlocks(normalizeRichText(rest))}</Fragment>);
  return out;
}

function stripTags(s: string): string {
  return decodeEntities(s.replace(/<(?!img\b)[^>]+>/gi, "")).trim();
}

function splitLines(s: string): string[] {
  return s
    .split(/<br\s*\/?>|\n/i)
    .map((l) => l.trim())
    .filter((l) => stripTags(l).length > 0);
}

// "A. …", "(a) …", "i) …", "P. …", "1. …" — a labelled list item in a match column.
const ITEM_LABEL = /^\s*(?:\(?[A-Za-z]{1,4}\)|[A-Za-z]{1,4}\.|\(?\d{1,2}[.)])\s*/;
// The content already names itself ("Statement I: …", "Assertion: …", "I. …").
const SELF_LABELLED = /^\s*(?:statement|assertion|reason)\b|^\s*(?:\(?[IVX]{1,4}[.:)]|[AB][.:)])\s/i;

function statementLabels(stem: string): [string, string] {
  if (/assertion/i.test(stem)) return ["Assertion (A)", "Reason (R)"];
  if (/statement[\s-]*(?:I|1)\b/i.test(stem)) return ["Statement I", "Statement II"];
  return ["Statement A", "Statement B"];
}

function MatchingBlock({ left, right, stem }: { left: string; right: string; stem: string }) {
  const leftItems = splitLines(left);
  const rightItems = splitLines(right);
  const isColumns =
    (leftItems.length >= 2 || rightItems.length >= 2) &&
    [...leftItems, ...rightItems].filter((l) => ITEM_LABEL.test(stripTags(l))).length >= Math.max(2, leftItems.length);

  if (isColumns) {
    const rows = Math.max(leftItems.length, rightItems.length);
    return (
      <span className="my-3 block overflow-x-auto whitespace-normal">
        <span className="grid min-w-[16rem] grid-cols-2 overflow-hidden rounded-xl border border-border text-[0.95em]">
          <span className="border-b border-r border-border bg-secondary/60 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">Column I</span>
          <span className="border-b border-border bg-secondary/60 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">Column II</span>
          {Array.from({ length: rows }, (_, i) => (
            <Fragment key={i}>
              <span className={cn("border-r border-border px-3 py-2", i < rows - 1 && "border-b")}>
                {leftItems[i] ? renderBlocks(normalizeRichText(leftItems[i])) : null}
              </span>
              <span className={cn("px-3 py-2", i < rows - 1 && "border-b border-border")}>
                {rightItems[i] ? renderBlocks(normalizeRichText(rightItems[i])) : null}
              </span>
            </Fragment>
          ))}
        </span>
      </span>
    );
  }

  const labels = statementLabels(stem);
  const items = [left, right].filter((s) => stripTags(s));
  return (
    <span className="my-3 block space-y-2 whitespace-normal">
      {items.map((s, i) => {
        const body = normalizeRichText(s).trim();
        const named = items.length < 2 || SELF_LABELLED.test(stripTags(s));
        return (
          <span key={i} className="block rounded-xl border border-border bg-secondary/40 px-3 py-2">
            {!named && <span className="mb-0.5 block text-xs font-bold uppercase tracking-wide text-primary">{labels[i]}</span>}
            <span className="block whitespace-pre-wrap">{renderBlocks(body)}</span>
          </span>
        );
      })}
    </span>
  );
}


export function formatCdnUrl(path: string): string {
  const clean = path.replace(/^\/+/, "");
  return `${QUESTION_IMAGE_CDN_BASE}/${clean}`;
}

export function resolveAnyImageUrl(url?: string | null): string | null {
  if (!url) return null;
  const trimmed = url.trim().replace(/^['"\s]+|['"\s]+$/g, "");
  if (!trimmed) return null;

  // External or absolute URLs
  if (/^(?:https?:|data:|blob:)/i.test(trimmed)) {
    // 1. Map old Supabase question-images URLs to the CDN
    const sbMatch = trimmed.match(/\/storage\/v1\/object\/public\/question-images\/(.+)$/i);
    if (sbMatch && sbMatch[1]) {
      return formatCdnUrl(sbMatch[1]);
    }

    // 2. Map old neet_track GitHub raw URLs to the new CDN
    const ntMatch = trimmed.match(/neet_track\/[^/]+\/public\/img\/data\/(.+)$/i);
    if (ntMatch && ntMatch[1]) {
      return formatCdnUrl(ntMatch[1]);
    }

    // 3. Map old neetbuddy-media URLs
    const nbMatch = trimmed.match(/(?:ncert\/)?(physics|chemistry|biology)\/(?:images\/)?(.+)$/i);
    if (nbMatch && nbMatch[1] && nbMatch[2]) {
      return formatCdnUrl(`${nbMatch[1].toLowerCase()}/${nbMatch[2]}`);
    }

    return trimmed;
  }

  // Relative paths: e.g. "/img/data/biology/...", "biology/...", "physics/...", "ncert/...", or just "opt_1.png"
  let clean = trimmed
    .replace(/^\/+/, "")
    .replace(/^public\//i, "")
    .replace(/^img\/data\//i, "")
    .replace(/^question-images\//i, "");

  // Convert ncert/physics/images/... -> physics/...
  const ncertMatch = clean.match(/^ncert\/(physics|chemistry|biology)\/(?:images\/)?(.+)$/i);
  if (ncertMatch) {
    clean = `${ncertMatch[1].toLowerCase()}/${ncertMatch[2]}`;
  }

  if (!clean || clean.split("/").some((part) => part === "..")) return null;

  return formatCdnUrl(clean);
}

export function handleImageFallback(image: HTMLImageElement) {
  const currentSrc = image.getAttribute("src") || "";
  let step = parseInt(image.dataset.fallbackStep || "0", 10);
  image.dataset.fallbackStep = String(step + 1);

  // Extract base filename
  const filename = currentSrc.split("/").pop()?.split("?")[0] || "";
  if (!filename) {
    showImageFallback(image);
    return;
  }

  // Fallback sequence: try raw github, then test across all 3 subjects (physics, chemistry, biology)
  const candidateUrls = [
    currentSrc.replace(JSDELIVR_CDN_BASE, RAW_GITHUB_CDN_BASE),
    `${JSDELIVR_CDN_BASE}/physics/${filename}`,
    `${RAW_GITHUB_CDN_BASE}/physics/${filename}`,
    `${JSDELIVR_CDN_BASE}/chemistry/${filename}`,
    `${RAW_GITHUB_CDN_BASE}/chemistry/${filename}`,
    `${JSDELIVR_CDN_BASE}/biology/${filename}`,
    `${RAW_GITHUB_CDN_BASE}/biology/${filename}`
  ];

  if (step < candidateUrls.length) {
    const nextUrl = candidateUrls[step];
    if (nextUrl && nextUrl !== currentSrc) {
      image.src = nextUrl;
      return;
    }
  }

  showImageFallback(image);
}

function showImageFallback(image: HTMLImageElement) {
  // Hide the broken image only. Never insert or remove DOM nodes here:
  // React owns this subtree, and manual mutations crash reconciliation
  // ("This page didn't load" error boundary) when the question changes.
  image.style.display = "none";
  image.dataset.failed = "true";
}

function normalizeRichText(src: string): string {
  let s = src.replace(/\r\n/g, "\n");

  // Fix mid-sentence <br> tags commonly created by scrapers/OCR
  s = s.replace(/\s*<br\s*\/?>\s*([,.;:!?\)\]])/gi, "$1");
  s = s.replace(/\b(of|and|or|in|at|to|with|by|from|is|are|was|were|the|a|an|be|as|for|that|which|on|into)\s*<br\s*\/?>\s*/gi, "$1 ");
  s = s.replace(/([,\-(\[])\s*<br\s*\/?>\s*/gi, "$1 ");
  s = s.replace(/<br\s*\/?>\s*([a-z])/gi, " $1");
  s = s.replace(/<br\s*\/?>/gi, "\n");

  // Standardize font styling tags
  s = s.replace(/<strong>([\s\S]*?)<\/strong>/gi, "**$1**");
  s = s.replace(/<b>([\s\S]*?)<\/b>/gi, "**$1**");
  s = s.replace(/<em>([\s\S]*?)<\/em>/gi, "*$1*");
  s = s.replace(/<i>([\s\S]*?)<\/i>/gi, "*$1*");

  // Fix JSON double escaping in stored questions (e.g. \\text{...})
  s = s.replace(/\\{2,}([A-Za-z])/g, "\\$1");
  s = s.replace(/\\{4,}(?=\s*(?:\n|$))/g, "\\\\");
  s = s.replace(/\\{2,}([\[\](){}])/g, "\\$1");

  // Clean unclosed HTML divs/spans while preserving content
  s = s.replace(/<div[^>]*>/gi, "");
  s = s.replace(/<\/div>/gi, "\n");
  s = s.replace(/<span[^>]*>/gi, "");
  s = s.replace(/<\/span>/gi, "");
  s = s.replace(/<p[^>]*>/gi, "");
  s = s.replace(/<\/p>/gi, "\n");

  // Collapse 3+ newlines to max 2
  s = s.replace(/\n{3,}/g, "\n\n");

  // &nbsp;, &rarr;, &deg; … stored by the old editor
  s = decodeEntities(s);

  return s;
}

function renderBlocks(src: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re =
    /```tikz\s*([\s\S]+?)```|```mermaid\s*([\s\S]+?)```|(<svg[\s\S]+?<\/svg>)|(\\begin\{tikzpicture\}[\s\S]+?\\end\{tikzpicture\})|\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(src))) {
    if (m.index > last) out.push(<Fragment key={k++}>{renderInline(src.slice(last, m.index))}</Fragment>);
    if (m[1] !== undefined) {
      out.push(<TikzBlock key={k++} code={m[1].trim()} />);
    } else if (m[2] !== undefined) {
      out.push(<MermaidBlock key={k++} code={m[2].trim()} />);
    } else if (m[3] !== undefined) {
      out.push(<SvgBlock key={k++} svg={m[3]} />);
    } else if (m[4] !== undefined) {
      out.push(<TikzBlock key={k++} code={m[4].trim()} />);
    } else {
      const tex = (m[5] ?? m[6] ?? "") as string;
      // If the math expression is a short single-line expression without line breaks or environment blocks,
      // render it inline so it does not break the question sentence across multiple lines.
      const isMultiline = tex.includes("\n") || tex.includes("\\\\") || /\\begin\{/.test(tex);
      if (!isMultiline && tex.trim().length < 80) {
        out.push(<SafeInlineMath key={k++} tex={tex} />);
      } else {
        out.push(
          <span key={k++} className="my-2 block overflow-x-auto">
            <SafeBlockMath tex={tex} />
          </span>,
        );
      }
    }
    last = m.index + m[0].length;
  }
  if (last < src.length) out.push(<Fragment key={k++}>{renderInline(src.slice(last))}</Fragment>);
  return out;
}

function SafeBlockMath({ tex }: { tex: string }) {
  try {
    return (
      <BlockMath
        math={tex}
        renderError={() => <span className="font-sans text-base not-italic text-foreground">{plainLatex(tex)}</span>}
      />
    );
  } catch {
    return <span className="font-sans text-base not-italic text-foreground">{plainLatex(tex)}</span>;
  }
}

function SafeInlineMath({ tex }: { tex: string }) {
  try {
    return (
      <InlineMath
        math={tex}
        renderError={() => <span className="font-sans not-italic text-foreground">{plainLatex(tex)}</span>}
      />
    );
  } catch {
    return <span className="font-sans not-italic text-foreground">{plainLatex(tex)}</span>;
  }
}

function DiagramFrame({ children }: { children: ReactNode }) {
  return (
    <span className="my-3 flex justify-center overflow-x-auto rounded-xl border border-border/60 bg-card/60 p-3 shadow-xs">
      {children}
    </span>
  );
}

function TikzBlock({ code }: { code: string }) {
  const body = /\\begin\{tikzpicture\}/.test(code)
    ? code
    : `\\begin{tikzpicture}\n${code}\n\\end{tikzpicture}`;
  return <DiagramFrame><Tikz>{body}</Tikz></DiagramFrame>;
}

function MermaidBlock({ code }: { code: string }) {
  return <DiagramFrame><Mermaid>{code}</Mermaid></DiagramFrame>;
}

function SvgBlock({ svg }: { svg: string }) {
  const cleanedSvg = svg.replace(/\$([^$]+?)\$/g, (_, tex: string) => tex.replace(/\\text\{([^}]+)\}/g, "$1"));
  return (
    <DiagramFrame>
      <span className="max-w-full [&_svg]:h-auto [&_svg]:max-w-full" dangerouslySetInnerHTML={{ __html: cleanedSvg }} />
    </DiagramFrame>
  );
}

function renderInline(src: string): ReactNode[] {
  const out: ReactNode[] = [];

  const re =
    /<img[^>]+src=["']([^"']+)["'][^>]*\/?>|!\[([^\]]*)\]\(((?:https?:\/\/|\/)[^\s)]+)\)|(https?:\/\/[^\s<>]+\.(?:png|jpg|jpeg|webp|svg)(?:\?[^\s<>]*)?|https?:\/\/(?:res\.cloudinary\.com|cdn\.mathpix\.com|image\.cleverb\.in)[^\s<>]+)|\$([^$\n]+?)\$|\\\(([^\n]+?)\\\)|\*\*([^*\n]+?)\*\*|\*([^*\n]+?)\*|`([^`\n]+?)`/gi;

  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;

  while ((m = re.exec(src))) {
    if (m.index > last) {
      out.push(<Fragment key={k++}>{src.slice(last, m.index)}</Fragment>);
    }

    if (m[1] !== undefined) {
      // HTML <img src="..."> tag
      const resolved = resolveAnyImageUrl(m[1]);
      if (resolved) {
        out.push(
          <img
            key={k++}
            src={resolved}
            alt="question diagram"
            loading="lazy"
            className="my-3 block max-h-96 max-w-full rounded-xl border border-border/80 bg-white p-1 object-contain shadow-md"
            onError={(e) => handleImageFallback(e.currentTarget)}
          />,
        );
      }
    } else if (m[2] !== undefined || m[3] !== undefined) {
      // Markdown image: ![alt](url)
      const resolved = resolveAnyImageUrl(m[3]);
      if (resolved) {
        out.push(
          <img
            key={k++}
            src={resolved}
            alt={m[2] || "diagram"}
            loading="lazy"
            className="my-3 block max-h-96 max-w-full rounded-xl border border-border/80 bg-white p-1 object-contain shadow-md"
            onError={(e) => handleImageFallback(e.currentTarget)}
          />,
        );
      }
    } else if (m[4] !== undefined) {
      // Standalone image URL (Cloudinary, Mathpix, etc.)
      const resolved = resolveAnyImageUrl(m[4]);
      if (resolved) {
        out.push(
          <img
            key={k++}
            src={resolved}
            alt="diagram"
            loading="lazy"
            className="my-3 block max-h-96 max-w-full rounded-xl border border-border/80 bg-white p-1 object-contain shadow-md"
            onError={(e) => handleImageFallback(e.currentTarget)}
          />,
        );
      }
    } else if (m[5] !== undefined || m[6] !== undefined) {
      // Inline LaTeX: $...$ or \(...\)
      const tex = (m[5] ?? m[6]) as string;
      out.push(<SafeInlineMath key={k++} tex={tex} />);
    } else if (m[7] !== undefined) {
      out.push(<strong key={k++}>{m[7]}</strong>);
    } else if (m[8] !== undefined) {
      out.push(<em key={k++}>{m[8]}</em>);
    } else if (m[9] !== undefined) {
      out.push(<code key={k++} className="rounded bg-secondary px-1 py-0.5 text-[0.9em]">{m[9]}</code>);
    }

    last = m.index + m[0].length;
  }

  if (last < src.length) {
    out.push(<Fragment key={k++}>{src.slice(last)}</Fragment>);
  }

  return out;
}

function plainLatex(tex: string): string {
  return tex
    .replace(/\\text\{([^}]*)\}/g, "$1")
    .replace(/\\(?:begin|end)\{[^}]+\}/g, "")
    .replace(/\\(?:hline|left|right)/g, "")
    .replace(/\\xrightarrow\{([^}]*)\}/g, " → $1 → ")
    .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, "($1)/($2)")
    .replace(/\\dfrac\{([^}]+)\}\{([^}]+)\}/g, "($1)/($2)")
    .replace(/\\rm\{([^}]*)\}/g, "$1")
    .replace(/\\rm\s*/g, "")
    .replace(/\\,/g, " ")
    .replace(/\\/g, " ")
    .replace(/[{}$]/g, "")
    .replace(/_/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
