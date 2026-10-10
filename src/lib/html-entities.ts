// Decodes HTML entities (&nbsp;, &rarr;, &deg;, &#8594; …) left in imported question text.
const NAMED_ENTITIES: Record<string, string> = {
  nbsp: " ", emsp: " ", ensp: " ", thinsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'",
  deg: "°", micro: "µ", ndash: "–", mdash: "—", rarr: "→", larr: "←", harr: "↔", rArr: "⇒",
  lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”", times: "×", divide: "÷", plusmn: "±", minus: "−",
  le: "≤", ge: "≥", ne: "≠", alpha: "α", beta: "β", gamma: "γ", delta: "δ", mu: "μ", pi: "π",
  lambda: "λ", theta: "θ", omega: "ω", Omega: "Ω", sigma: "σ", Delta: "Δ", middot: "·", hellip: "…",
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (all, name: string) => {
    if (name[0] === "#") {
      const code = name[1] === "x" || name[1] === "X" ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : all;
    }
    return NAMED_ENTITIES[name] ?? NAMED_ENTITIES[name.toLowerCase()] ?? all;
  });
}
