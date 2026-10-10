// Miss Azka's routing: turns a student's message into replies and tappable cards.
// Pure functions (no I/O) so the same logic works with or without the AI model.
import { AZKA_FEATURES, AZKA_FEATURE_BY_ID, type AzkaCard, type AzkaFeatureId } from "@/lib/azka-catalog";

export type AzkaChapter = {
  id: string;
  name: string;
  subject: "biology" | "physics" | "chemistry" | string;
  cls: number | null;
  topics: string[];
  deckId: string | null;
  hasNuggets: boolean;
  noteSlug: string | null; // ready short note, if any
};

export type AzkaAction = {
  type: "open_feature" | "short_notes" | "flashcards" | "nuggets" | "make_quiz";
  feature?: string;
  chapter_ids?: string[];
  count?: number;
  difficulty?: string;
  pyq_only?: boolean;
};

const SUBJECT_NAME: Record<string, string> = { biology: "Biology", physics: "Physics", chemistry: "Chemistry" };
export const subjectName = (s: string) => SUBJECT_NAME[s] ?? s.charAt(0).toUpperCase() + s.slice(1);

export function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const STOP = new Set(
  "a an the of and in on for to is are with me my i you please give show open make create want need some about chapter topic notes note short quiz test questions question mcq mcqs flashcards flashcard cards nuggets nugget pyq pyqs from do can se ka ki ke ko hai karo kar do de dijiye chahiye mujhe ek bhi aur wala wale its their".split(" "),
);
const stem = (w: string) => w.replace(/ies$/, "y").replace(/(?<=[a-z]{3})e?s$/, "").replace(/ence$/, "ance");
const words = (s: string) => norm(s).split(" ").filter((w) => w.length > 2 && !STOP.has(w)).map(stem);

/** Fuzzy match a DB chapter name to a short-notes catalogue entry (names differ slightly). */
export function matchNoteSlug(name: string, notes: { title: string; slug: string }[]): string | null {
  const a = new Set(words(name));
  if (!a.size) return null;
  let best: { slug: string; score: number } | null = null;
  for (const n of notes) {
    const b = new Set(words(n.title));
    const inter = [...a].filter((w) => b.has(w)).length;
    const score = inter / new Set([...a, ...b]).size;
    if (!best || score > best.score) best = { slug: n.slug, score };
  }
  return best && best.score >= 0.5 ? best.slug : null;
}

/** Best-matching chapters for a free-text message, strongest first. */
export function matchChapters(message: string, chapters: AzkaChapter[], limit = 3): AzkaChapter[] {
  const msg = ` ${norm(message)} `;
  const msgWords = new Set(words(message));
  const scored = chapters.map((c) => {
    const name = norm(c.name);
    let score = 0;
    if (name && msg.includes(` ${name} `)) score += 100 + name.length;
    for (const t of c.topics) {
      const tn = norm(t);
      if (tn.length >= 3 && msg.includes(` ${tn} `)) score = Math.max(score, 60 + tn.length);
    }
    const nameWords = words(c.name);
    if (nameWords.length) {
      const hit = nameWords.filter((w) => msgWords.has(w)).length;
      if (hit) score = Math.max(score, Math.round((hit / nameWords.length) * 50) + hit * 5);
    }
    if (score > 0 && c.subject && msg.includes(` ${c.subject} `)) score += 15;
    return { c, score };
  });
  const best = scored.filter((x) => x.score >= 30).sort((a, b) => b.score - a.score);
  if (!best.length) return [];
  // Keep ties/near-ties (e.g. "Thermodynamics" exists in Physics and Chemistry).
  const top = best[0].score;
  return best.filter((x) => x.score >= top - 10).slice(0, limit).map((x) => x.c);
}

type Intent = "notes" | "flashcards" | "nuggets" | "quiz" | null;

export function detectIntent(message: string): Intent {
  const m = ` ${norm(message)} `;
  if (/ (short )?notes? | summary | revision /.test(m)) return "notes";
  if (/ flash ?cards? | cards /.test(m)) return "flashcards";
  if (/ nuggets? | ncert lines? | key lines /.test(m)) return "nuggets";
  if (/ quiz | mcqs? | questions? | test | practice | practise | sawal | prashn /.test(m)) return "quiz";
  return null;
}

export function detectCount(message: string): number {
  const t = norm(message);
  const m =
    t.match(/\b(\d{1,3})\s*(?:[a-z]+\s+){0,2}?(?:q|qs|ques|questions?|mcqs?|sawal)\b/) ??
    t.match(/\b(?:quiz|test)\s+(?:of\s+)?(\d{1,3})\b/);
  const n = m ? parseInt(m[1], 10) : 10;
  return clampCount(n);
}
export const clampCount = (n: number) => Math.max(5, Math.min(50, Number.isFinite(n) ? Math.round(n) : 10));

export function detectDifficulty(message: string): "Easy" | "Medium" | "Hard" | "Mixed" {
  const m = norm(message);
  if (/\b(hard|tough|difficult|advanced)\b/.test(m)) return "Hard";
  if (/\b(easy|basic|simple)\b/.test(m)) return "Easy";
  if (/\b(medium|moderate)\b/.test(m)) return "Medium";
  return "Mixed";
}

export function featureFromKeywords(message: string): AzkaFeatureId[] {
  const m = ` ${norm(message)} `;
  const hits: { id: AzkaFeatureId; len: number }[] = [];
  for (const f of AZKA_FEATURES) {
    for (const k of f.keywords) {
      const kn = norm(k);
      if (kn && m.includes(` ${kn} `)) { hits.push({ id: f.id, len: kn.length }); break; }
    }
  }
  // Longest keyword wins (e.g. "improvement zone" over "zone").
  return hits.sort((a, b) => b.len - a.len).map((h) => h.id).slice(0, 2);
}

export function featureCard(id: string, sub?: string): AzkaCard | null {
  const f = AZKA_FEATURE_BY_ID.get(id as AzkaFeatureId);
  if (!f) return null;
  return { kind: "link", title: f.label, sub: sub ?? f.desc, href: f.path, emoji: f.emoji, tint: f.tint };
}

export function notesCard(c: AzkaChapter): AzkaCard {
  if (c.noteSlug) {
    return { kind: "link", title: `Short Notes · ${c.name}`, sub: `${subjectName(c.subject)}${c.cls ? ` · Class ${c.cls}` : ""} — NCERT notes with diagrams`, href: `/notes/${c.subject}/${c.noteSlug}`, emoji: "📝", tint: "#0EA5E9" };
  }
  return { kind: "link", title: `${subjectName(c.subject)} Short Notes`, sub: `Notes for ${c.name} are coming soon — open the notes library`, href: `/short-notes?s=${c.subject}`, emoji: "📝", tint: "#0EA5E9" };
}

export function flashcardsCard(c: AzkaChapter): AzkaCard {
  if (c.deckId) {
    return { kind: "link", title: `Flashcards · ${c.name}`, sub: `${subjectName(c.subject)} deck — flip, recall, repeat`, href: `/flashcards?deck=${encodeURIComponent(c.deckId)}`, emoji: "🃏", tint: "#8B5CF6" };
  }
  return { kind: "link", title: "Flashcards", sub: `No deck for ${c.name} yet — see all decks`, href: "/flashcards", emoji: "🃏", tint: "#8B5CF6" };
}

export function nuggetsCard(c: AzkaChapter): AzkaCard {
  if (c.hasNuggets) {
    return { kind: "link", title: `NCERT Nuggets · ${c.name}`, sub: "Read the key NCERT lines, then solve questions", href: `/nuggets?chapter=${encodeURIComponent(c.id)}`, emoji: "💎", tint: "#10B981" };
  }
  return { kind: "link", title: "NCERT Nuggets", sub: `Nuggets for ${c.name} are coming soon — see all chapters`, href: "/nuggets", emoji: "💎", tint: "#10B981" };
}

export function quizCard(cs: AzkaChapter[], count: number, difficulty: "Easy" | "Medium" | "Hard" | "Mixed", pyqOnly: boolean): AzkaCard {
  const names = cs.map((c) => c.name);
  const label = names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} & ${names[names.length - 1]}`;
  const bits = [`${count} questions`, difficulty === "Mixed" ? "mixed level" : difficulty.toLowerCase(), pyqOnly ? "PYQs only" : null, "from the NEET Track bank"].filter(Boolean);
  return { kind: "quiz", title: `Quiz · ${label}`, sub: bits.join(" · "), chapterIds: cs.map((c) => c.id), count, difficulty, pyqOnly };
}

const DIFFS = new Set(["Easy", "Medium", "Hard", "Mixed"]);

/** Turn validated AI (or local) actions into cards. Unknown ids are dropped. */
export function actionsToCards(actions: AzkaAction[], byId: Map<string, AzkaChapter>): AzkaCard[] {
  const cards: AzkaCard[] = [];
  const seen = new Set<string>();
  const push = (c: AzkaCard | null) => {
    if (!c) return;
    const key = c.kind === "link" ? c.href : `quiz:${c.chapterIds.join(",")}`;
    if (seen.has(key)) return;
    seen.add(key);
    cards.push(c);
  };
  for (const a of actions.slice(0, 6)) {
    const chs = (a.chapter_ids ?? []).map((id) => byId.get(String(id))).filter(Boolean) as AzkaChapter[];
    switch (a.type) {
      case "open_feature":
        if (a.feature) push(featureCard(a.feature));
        break;
      case "short_notes":
        if (chs.length) chs.slice(0, 3).forEach((c) => push(notesCard(c)));
        else push(featureCard("shortnotes"));
        break;
      case "flashcards":
        if (chs.length) chs.slice(0, 3).forEach((c) => push(flashcardsCard(c)));
        else push(featureCard("flashcards"));
        break;
      case "nuggets":
        if (chs.length) chs.slice(0, 3).forEach((c) => push(nuggetsCard(c)));
        else push(featureCard("nuggets"));
        break;
      case "make_quiz": {
        const diff = DIFFS.has(String(a.difficulty)) ? (a.difficulty as "Easy" | "Medium" | "Hard" | "Mixed") : "Mixed";
        if (chs.length) push(quizCard(chs.slice(0, 5), clampCount(a.count ?? 10), diff, !!a.pyq_only));
        else push(featureCard("generate", "Pick your chapters and build a custom test"));
        break;
      }
    }
  }
  return cards.slice(0, 5);
}

/** Rule-based answer used when the AI model is unavailable (and as the AI's hint). */
export function localRoute(message: string, chapters: AzkaChapter[]): { actions: AzkaAction[]; reply: string; matched: AzkaChapter[] } {
  const intent = detectIntent(message);
  const matched = matchChapters(message, chapters);
  const ids = matched.map((c) => c.id);
  const features = featureFromKeywords(message);

  if (intent === "notes" && matched.length) return { matched, actions: [{ type: "short_notes", chapter_ids: ids }], reply: `Here are the short notes for ${matched[0].name}. Tap to open 📝` };
  if (intent === "flashcards" && matched.length) return { matched, actions: [{ type: "flashcards", chapter_ids: ids }], reply: `Your ${matched[0].name} flashcards are ready — flip through them 🃏` };
  if (intent === "nuggets" && matched.length) return { matched, actions: [{ type: "nuggets", chapter_ids: ids }], reply: `Let's read the key NCERT lines of ${matched[0].name} 💎` };
  if (intent === "quiz" && matched.length) {
    const pyq = /\bpyqs?\b|previous year/.test(norm(message));
    // Same-named chapters in two subjects (e.g. Thermodynamics): one quiz card each.
    const quiz = (chapter_ids: string[]): AzkaAction => ({ type: "make_quiz", chapter_ids, count: detectCount(message), difficulty: detectDifficulty(message), pyq_only: pyq });
    const subjects = new Set(matched.map((c) => c.subject));
    return matched.length > 1 && subjects.size > 1
      ? { matched, actions: matched.slice(0, 2).map((c) => quiz([c.id])), reply: `${matched[0].name.replace(/\s*\(.*\)$/, "")} is in more than one subject — pick the quiz you want ✨` }
      : { matched, actions: [quiz([ids[0]])], reply: `Done! I picked questions on ${matched[0].name} from our question bank. Tap the card to start ✨` };
  }
  if (matched.length && !features.length) {
    return {
      matched,
      actions: [{ type: "short_notes", chapter_ids: [ids[0]] }, { type: "make_quiz", chapter_ids: [ids[0]], count: 10 }, { type: "flashcards", chapter_ids: [ids[0]] }],
      reply: `Here's everything I have for ${matched[0].name} — notes, a quick quiz and flashcards.`,
    };
  }
  if (features.length) {
    const f = AZKA_FEATURE_BY_ID.get(features[0])!;
    return { matched, actions: features.map((id) => ({ type: "open_feature" as const, feature: id })), reply: `${f.label}: ${f.desc}. Tap to open it ${f.emoji}` };
  }
  return {
    matched,
    actions: [{ type: "open_feature", feature: "studypath" }, { type: "open_feature", feature: "improve" }, { type: "open_feature", feature: "shortnotes" }],
    reply: "I can open notes, flashcards and nuggets for any chapter, build a quiz from our question bank, or take you to any part of NEET Track. Try one of these 👇",
  };
}
