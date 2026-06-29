// Lenient JSON parsing for bulk uploads.
// Handles: BOM, trailing commas, // and /* */ comments, single quotes,
// and "smart" curly quotes that LLMs love to emit.
// Critically does NOT touch backslashes inside strings — LaTeX (\frac, \vec,
// \Delta, ...) survives untouched.
export function parseLenientJson(input: string): unknown {
  let s = input.replace(/^\uFEFF/, "").trim();

  // First try strict parse — fastest path.
  try {
    return JSON.parse(s);
  } catch {
    /* fall through */
  }

  // Walk the string char-by-char, only transforming OUTSIDE string literals.
  let out = "";
  let i = 0;
  const n = s.length;
  while (i < n) {
    const c = s[i];
    // Strings — copy verbatim, including escapes.
    if (c === '"' || c === "'") {
      const quote = c;
      const start = i;
      i++;
      while (i < n) {
        const cc = s[i];
        if (cc === "\\") {
          i += 2;
          continue;
        }
        if (cc === quote) {
          i++;
          break;
        }
        i++;
      }
      let lit = s.slice(start, i);
      if (quote === "'") {
        // Convert single-quoted string to double-quoted: re-escape inner ".
        const body = lit.slice(1, -1).replace(/\\'/g, "'").replace(/"/g, '\\"');
        lit = `"${body}"`;
      }
      out += lit;
      continue;
    }
    // Line comment.
    if (c === "/" && s[i + 1] === "/") {
      while (i < n && s[i] !== "\n") i++;
      continue;
    }
    // Block comment.
    if (c === "/" && s[i + 1] === "*") {
      i += 2;
      while (i < n && !(s[i] === "*" && s[i + 1] === "/")) i++;
      i += 2;
      continue;
    }
    out += c;
    i++;
  }
  // Smart quotes outside strings are handled implicitly above (they aren't
  // string delimiters in our scanner) — replace any leftover smart quotes
  // with plain ones.
  out = out.replace(/[\u201C\u201D]/g, '"').replace(/[\u2018\u2019]/g, "'");
  // Trailing commas: ,] or ,}
  out = out.replace(/,(\s*[}\]])/g, "$1");
  return JSON.parse(out);
}

// Insert rows in fixed-size chunks so a single huge upload doesn't blow the
// PostgREST request limit and so duplicate-key errors only kill the chunk
// they belong to (not the whole import).
export async function chunkedInsert<T>(
  rows: T[],
  size: number,
  insert: (chunk: T[]) => Promise<{ inserted: number; error?: string }>,
): Promise<{ inserted: number; errors: string[] }> {
  let inserted = 0;
  const errors: string[] = [];
  for (let i = 0; i < rows.length; i += size) {
    const chunk = rows.slice(i, i + size);
    try {
      const r = await insert(chunk);
      inserted += r.inserted;
      if (r.error) errors.push(r.error);
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }
  return { inserted, errors };
}
