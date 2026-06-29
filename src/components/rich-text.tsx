import { Fragment, type ReactNode } from "react";
import { InlineMath, BlockMath } from "react-katex";
import "katex/dist/katex.min.css";
import { cn } from "@/lib/utils";
import { Tikz } from "@/components/tikz";
import { Mermaid } from "@/components/mermaid";

/**
 * Diagram-aware rich text renderer for exam questions.
 *
 *  - Line breaks (\n -> <br/>)
 *  - **bold**, *italic*, `code`
 *  - Inline LaTeX: $...$  or  \(...\)
 *  - Block LaTeX: $$...$$  or  \[...\]
 *  - Images: ![alt](https://url)  — renders as responsive <img>
 *  - Raw SVG: full <svg ...>...</svg> blocks
 *  - TikZ:
 *      ```tikz ... ```                (fenced)
 *      \begin{tikzpicture}...\end{tikzpicture}
 *  - Mermaid:
 *      ```mermaid ... ```             (flowcharts, sequence, class, etc.)
 */
export function RichText({ children, className }: { children?: string | null; className?: string }) {
  if (!children) return null;
  try {
    return <span className={cn("whitespace-pre-wrap break-words", className)}>{renderBlocks(normalizeRichText(children))}</span>;
  } catch (error) {
    console.error("[rich-text] render failed", error, {
      preview: children.slice(0, 180),
    });
    return <span className={cn("whitespace-pre-wrap break-words", className)}>{normalizeRichText(children)}</span>;
  }
}

function normalizeRichText(src: string): string {
  let s = src.replace(/\r\n/g, "\n");

  // Older AI rows were stored with JSON-escaped LaTeX as real text, e.g.
  // `\\text{CH}_3` instead of `\text{CH}_3`, which KaTeX renders as raw
  // "text...". Keep table row breaks (`\\`) while fixing commands.
  s = s.replace(/\\{2,}([A-Za-z])/g, "\\$1");
  s = s.replace(/\\{4,}(?=\s*(?:\n|$))/g, "\\\\");
  s = s.replace(/\\{2,}([\[\](){}])/g, "\\$1");

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
          <BlockMath math={tex} renderError={() => <span className="font-sans text-base not-italic">{plainLatex(tex)}</span>} />
        </span>,
      );
    }
    last = m.index + m[0].length;
  }
  if (last < src.length) out.push(<Fragment key={k++}>{renderInline(src.slice(last))}</Fragment>);
  return out;
}

function DiagramFrame({ children }: { children: ReactNode }) {
  return (
    <span className="my-3 flex justify-center overflow-x-auto rounded-xl border border-border/60 bg-card/60 p-3 shadow-sm">
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
  // Render inline SVG — trusted question content from admin import.
  const cleanedSvg = svg.replace(/\$([^$]+?)\$/g, (_, tex: string) => tex.replace(/\\text\{([^}]+)\}/g, "$1"));
  return <DiagramFrame><span className="max-w-full [&_svg]:h-auto [&_svg]:max-w-full" dangerouslySetInnerHTML={{ __html: cleanedSvg }} /></DiagramFrame>;
}

function renderInline(src: string): ReactNode[] {
  const out: ReactNode[] = [];
  // image must be first to avoid * being parsed
  const re = /!\[([^\]]*)\]\(((?:https?:\/\/|\/)[^\s)]+)\)|\$([^$\n]+?)\$|\\\(([^\n]+?)\\\)|\*\*([^*\n]+?)\*\*|\*([^*\n]+?)\*|`([^`\n]+?)`/g;
  let last = 0; let m: RegExpExecArray | null; let k = 0;
  while ((m = re.exec(src))) {
    if (m.index > last) out.push(<Fragment key={k++}>{src.slice(last, m.index)}</Fragment>);
    if (m[1] !== undefined) {
      out.push(
        <img
          key={k++}
          src={m[2]}
          alt={m[1] || "diagram"}
          loading="lazy"
          className="my-2 inline-block max-h-80 max-w-full rounded-lg border border-border/60 bg-card object-contain shadow-sm"
        />,
      );
    } else if (m[3] !== undefined || m[4] !== undefined) {
      const tex = (m[3] ?? m[4]) as string;
      out.push(<InlineMath key={k++} math={tex} renderError={() => <span>{plainLatex(tex)}</span>} />);
    } else if (m[5] !== undefined) {
      out.push(<strong key={k++}>{m[5]}</strong>);
    } else if (m[6] !== undefined) {
      out.push(<em key={k++}>{m[6]}</em>);
    } else if (m[7] !== undefined) {
      out.push(<code key={k++} className="rounded bg-secondary px-1 py-0.5 text-[0.9em]">{m[7]}</code>);
    }
    last = m.index + m[0].length;
  }
  if (last < src.length) out.push(<Fragment key={k++}>{src.slice(last)}</Fragment>);
  return out;
}

function plainLatex(tex: string): string {
  return tex
    .replace(/\\text\{([^}]*)\}/g, "$1")
    .replace(/\\(?:begin|end)\{[^}]+\}/g, "")
    .replace(/\\(?:hline|left|right)/g, "")
    .replace(/\\xrightarrow\{([^}]*)\}/g, " → $1 → ")
    .replace(/\\/g, " ")
    .replace(/[{}$]/g, "")
    .replace(/_/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
