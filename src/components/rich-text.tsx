import { Fragment, type ReactNode } from "react";
import { InlineMath, BlockMath } from "react-katex";
import "katex/dist/katex.min.css";
import { cn } from "@/lib/utils";
import { Tikz } from "@/components/tikz";
import { Mermaid } from "@/components/mermaid";

/**
 * Diagram-aware rich text renderer for exam questions.
 * Handles:
 *  - Inline LaTeX: $...$ or \(...\)
 *  - Block LaTeX: $$...$$ or \[...\]
 *  - Markdown & standalone images: ![alt](url) and raw https://... (Cloudinary, Mathpix, etc.)
 *  - HTML tags: <br>, <strong>, <b>, <em>, <i>, <sub>, <sup>, <div>
 *  - TikZ and Mermaid diagrams
 *  - Safe fallback when LaTeX fails
 */
export function RichText({ children, className }: { children?: string | null; className?: string }) {
  if (!children) return null;
  try {
    const normalized = normalizeRichText(children);
    return (
      <span className={cn("whitespace-pre-wrap break-words leading-relaxed", className)}>
        {renderBlocks(normalized)}
      </span>
    );
  } catch (error) {
    console.error("[rich-text] render failed", error);
    return <span className={cn("whitespace-pre-wrap break-words", className)}>{children}</span>;
  }
}

function normalizeRichText(src: string): string {
  let s = src.replace(/\r\n/g, "\n");

  // Replace common HTML tags with manageable markers or clean representation
  s = s.replace(/<br\s*\/?>/gi, "\n");
  s = s.replace(/<strong>([\s\S]*?)<\/strong>/gi, "**$1**");
  s = s.replace(/<b>([\s\S]*?)<\/b>/gi, "**$1**");
  s = s.replace(/<em>([\s\S]*?)<\/em>/gi, "*$1*");
  s = s.replace(/<i>([\s\S]*?)<\/i>/gi, "*$1*");

  // Fix JSON double escaping in stored questions (e.g. \\text{...})
  s = s.replace(/\\{2,}([A-Za-z])/g, "\\$1");
  s = s.replace(/\\{4,}(?=\s*(?:\n|$))/g, "\\\\");
  s = s.replace(/\\{2,}([\[\](){}])/g, "\\$1");

  // Clean unclosed HTML divs/spans that might surround question columns
  s = s.replace(/<div[^>]*>/gi, "");
  s = s.replace(/<\/div>/gi, "\n");
  s = s.replace(/<span[^>]*>/gi, "");
  s = s.replace(/<\/span>/gi, "");

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
      out.push(
        <span key={k++} className="my-2 block overflow-x-auto">
          <SafeBlockMath tex={tex} />
        </span>,
      );
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

  // Match:
  // 1. Markdown image: ![alt](url)
  // 2. Standalone image URL: https://...(png|jpg|jpeg|webp|svg|mathpix|cloudinary)
  // 3. Inline LaTeX: $...$ or \(...\)
  // 4. Bold / italic / code
  const re =
    /!\[([^\]]*)\]\(((?:https?:\/\/|\/)[^\s)]+)\)|(https?:\/\/[^\s<>]+\.(?:png|jpg|jpeg|webp|svg)(?:\?[^\s<>]*)?|https?:\/\/(?:res\.cloudinary\.com|cdn\.mathpix\.com)[^\s<>]+)|\$([^$\n]+?)\$|\\\(([^\n]+?)\\\)|\*\*([^*\n]+?)\*\*|\*([^*\n]+?)\*|`([^`\n]+?)`/gi;

  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;

  while ((m = re.exec(src))) {
    if (m.index > last) {
      out.push(<Fragment key={k++}>{src.slice(last, m.index)}</Fragment>);
    }

    if (m[1] !== undefined) {
      // Markdown image
      out.push(
        <img
          key={k++}
          src={m[2]}
          alt={m[1] || "diagram"}
          loading="lazy"
          className="my-2 block max-h-80 max-w-full rounded-lg border border-border/60 bg-card object-contain shadow-xs"
        />,
      );
    } else if (m[3] !== undefined) {
      // Standalone image URL
      out.push(
        <img
          key={k++}
          src={m[3]}
          alt="diagram"
          loading="lazy"
          className="my-2 block max-h-80 max-w-full rounded-lg border border-border/60 bg-card object-contain shadow-xs"
        />,
      );
    } else if (m[4] !== undefined || m[5] !== undefined) {
      // Inline LaTeX
      const tex = (m[4] ?? m[5]) as string;
      out.push(<SafeInlineMath key={k++} tex={tex} />);
    } else if (m[6] !== undefined) {
      out.push(<strong key={k++}>{m[6]}</strong>);
    } else if (m[7] !== undefined) {
      out.push(<em key={k++}>{m[7]}</em>);
    } else if (m[8] !== undefined) {
      out.push(<code key={k++} className="rounded bg-secondary px-1 py-0.5 text-[0.9em]">{m[8]}</code>);
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
