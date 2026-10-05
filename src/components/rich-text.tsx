import { Fragment, type ReactNode } from "react";
import { InlineMath, BlockMath } from "react-katex";
import "katex/dist/katex.min.css";
import { cn } from "@/lib/utils";
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
    const normalized = normalizeRichText(children);
    return (
      <span className={cn("inline-block max-w-full break-words leading-relaxed whitespace-pre-wrap", className)}>
        {renderBlocks(normalized)}
      </span>
    );
  } catch (error) {
    console.error("[rich-text] render failed", error);
    return <span className={cn("break-words whitespace-pre-wrap", className)}>{children}</span>;
  }
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

    // Keep all other external URLs (Cloudinary, Mathpix, etc.) intact
    return trimmed;
  }

  // Relative paths: e.g. "/img/data/biology/...", "biology/...", "physics/...", "question-images/..."
  const clean = trimmed
    .replace(/^\/+/, "")
    .replace(/^public\//i, "")
    .replace(/^img\/data\//i, "")
    .replace(/^question-images\//i, "");

  if (!clean || clean.split("/").some((part) => part === "..")) return null;

  return formatCdnUrl(clean);
}

function formatCdnUrl(relPath: string): string {
  const clean = relPath.replace(/^\/+/, "");
  const encodedParts = clean
    .split("/")
    .map((part) => encodeURIComponent(decodeURIComponentSafe(part)))
    .join("/");
  return `${QUESTION_IMAGE_CDN_BASE}/${encodedParts}`;
}

export function handleImageFallback(image: HTMLImageElement) {
  const currentSrc = image.getAttribute("src") || "";
  // Seamlessly fall back from jsDelivr to raw GitHub if needed
  if (currentSrc.startsWith(JSDELIVR_CDN_BASE)) {
    image.src = currentSrc.replace(JSDELIVR_CDN_BASE, RAW_GITHUB_CDN_BASE);
    return;
  }
  showImageFallback(image);
}

function decodeURIComponentSafe(value: string) {
  try { return decodeURIComponent(value); } catch { return value; }
}

function showImageFallback(image: HTMLImageElement) {
  image.style.display = "none";
  const fallback = document.createElement("span");
  fallback.className = "my-2 block rounded-lg border border-dashed border-border p-3 text-center text-xs text-muted-foreground";
  fallback.textContent = "Question image could not be loaded.";
  image.insertAdjacentElement("afterend", fallback);
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
      // Inline LaTeX
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
