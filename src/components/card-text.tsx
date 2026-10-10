// Renders flashcard text: <b>, <i>, <sub>, <sup> (nestable), inline $LaTeX$ and line breaks.
import { Fragment, type ReactNode } from "react";
import { InlineMath } from "react-katex";
import "katex/dist/katex.min.css";
import { decodeEntities } from "@/lib/html-entities";

const TOKEN = /\$([^$]+?)\$|<(b|i|sub|sup|strong|em)>([\s\S]*?)<\/\2>|<br\s*\/?>/gi;

function plain(tex: string) {
  return tex.replace(/\\text\{([^}]*)\}/g, "$1").replace(/\\d?frac\{([^}]+)\}\{([^}]+)\}/g, "($1)/($2)").replace(/[{}\\]/g, "");
}

function parse(src: string, depth = 0): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0, k = 0;
  const re = new RegExp(TOKEN.source, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    if (m.index > last) out.push(<Fragment key={k++}>{src.slice(last, m.index)}</Fragment>);
    if (m[1] !== undefined) {
      const tex = m[1];
      out.push(<InlineMath key={k++} math={tex} renderError={() => <span>{plain(tex)}</span>} />);
    } else if (m[2] !== undefined) {
      const inner = depth < 4 ? parse(m[3], depth + 1) : [m[3]];
      const t = m[2].toLowerCase();
      if (t === "b" || t === "strong") out.push(<b key={k++}>{inner}</b>);
      else if (t === "i" || t === "em") out.push(<i key={k++}>{inner}</i>);
      else if (t === "sub") out.push(<sub key={k++}>{inner}</sub>);
      else out.push(<sup key={k++}>{inner}</sup>);
    } else {
      out.push(<br key={k++} />);
    }
    last = m.index + m[0].length;
  }
  if (last < src.length) out.push(<Fragment key={k++}>{src.slice(last)}</Fragment>);
  return out;
}

export function CardText({ children, className }: { children?: string | null; className?: string }) {
  if (!children) return null;
  return <span className={`whitespace-pre-wrap break-words [&_.katex]:text-[1.02em] [&_sub]:text-[0.72em] [&_sup]:text-[0.72em] ${className ?? ""}`}>{parse(decodeEntities(children))}</span>;
}
