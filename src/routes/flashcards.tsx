// Flashcards: chapter decks (NCERT order), flip cards, "Know it / Unsure / Revise again"
// tracking per card, and focused sessions on the cards a student still needs to revise.

import { DrAzkaLoader } from "@/components/dr-akza-loader";
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Check, ChevronRight, Eye, Layers, Lightbulb, RotateCcw, Shuffle, Sparkles, X, HelpCircle, Trophy } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { listFlashcardDecks, getFlashcards, recordFlashcardReview, getMyFlashcardProgress, type Flashcard, type FlashcardDeck } from "@/lib/flashcards.functions";
import { accessStudyFeature } from "@/lib/feature-gate.functions";
import { useAuth } from "@/hooks/use-auth";
import { RichText } from "@/components/rich-text";
import { FeatureLock } from "@/components/feature-lock";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/flashcards")({
  head: () => ({
    meta: [
      { title: "Flashcards — NEET Track" },
      { name: "description", content: "Chapter-wise NCERT flashcards for NEET Biology. Flip, recall and track what you know." },
    ],
  }),
  component: () => (<FeatureLock feature="flashcards"><FlashcardsPage /></FeatureLock>),
});

type Latest = Record<string, { r: number; d: string | null }>;
type Session = { deck: FlashcardDeck | null; title: string; cards: Flashcard[]; kind: "all" | "revise" | "shuffle" | "mix"; round: number };
type Result = Record<string, 1 | 2 | 3>;

const SUBJECTS = ["Biology", "Physics", "Chemistry"] as const;
const SUBJ_TINT: Record<string, string> = { Biology: "#A855F7", Physics: "#3B82F6", Chemistry: "#10B981" };

function shuffle<T>(a: T[]): T[] { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; }

function FlashcardsPage() {
  const { user } = useAuth();
  const loadDecks = useServerFn(listFlashcardDecks);
  const loadCards = useServerFn(getFlashcards);
  const loadProgress = useServerFn(getMyFlashcardProgress);
  const review = useServerFn(recordFlashcardReview);
  const unlock = useServerFn(accessStudyFeature);

  const [decks, setDecks] = useState<FlashcardDeck[] | null>(null);
  const [latest, setLatest] = useState<Latest>({});
  const [subject, setSubject] = useState<string>("Biology");
  const [cls, setCls] = useState<11 | 12 | 0>(0);
  const [session, setSession] = useState<Session | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const unlocked = useRef(false);

  useEffect(() => {
    loadDecks().then((d) => setDecks(d.decks as FlashcardDeck[])).catch((e) => { toast.error(e?.message ?? "Could not load flashcards"); setDecks([]); });
  }, [loadDecks]);
  useEffect(() => {
    if (!user) return;
    loadProgress().then((p) => setLatest(p.latest as Latest)).catch(() => {});
  }, [user, loadProgress]);

  // Per-deck progress from my latest ratings.
  const deckStats = useMemo(() => {
    const m = new Map<string, { known: number; revise: number; seen: number }>();
    for (const v of Object.values(latest)) {
      if (!v.d) continue;
      const s = m.get(v.d) ?? { known: 0, revise: 0, seen: 0 };
      s.seen++; if (v.r === 3) s.known++; else s.revise++;
      m.set(v.d, s);
    }
    return m;
  }, [latest]);

  const subjectDecks = useMemo(() => (decks ?? []).filter((d) => d.subject === subject), [decks, subject]);
  const shown = subjectDecks.filter((d) => !cls || d.class === cls);
  const totals = useMemo(() => {
    let cards = 0, known = 0, revise = 0;
    for (const d of subjectDecks) { cards += d.card_count; const s = deckStats.get(d.id); if (s) { known += s.known; revise += s.revise; } }
    return { cards, known, revise, pct: cards ? Math.round((known / cards) * 100) : 0 };
  }, [subjectDecks, deckStats]);
  const available = useMemo(() => new Set((decks ?? []).map((d) => d.subject)), [decks]);

  async function ensureUnlocked() {
    if (unlocked.current) return true;
    try {
      const r = await unlock({ data: { feature: "flashcards" } });
      unlocked.current = true;
      if (r.charged > 0) toast.success(`${r.charged} bonus used. Flashcards unlocked for today.`);
      return true;
    } catch (e: any) {
      toast.error(e?.message ?? "Could not unlock flashcards");
      return false;
    }
  }

  async function open(deck: FlashcardDeck | null, kind: Session["kind"]) {
    if (!user) { toast.error("Please log in to study flashcards."); return; }
    setOpening(deck?.id ?? "mix");
    try {
      if (!(await ensureUnlocked())) return;
      const r = await loadCards({ data: deck ? { deck_id: deck.id } : { subject, limit: 30 } });
      let cards = r.cards as Flashcard[];
      if (kind === "revise") cards = cards.filter((c) => (latest[c.id]?.r ?? 0) !== 3);
      if (kind === "shuffle") cards = shuffle(cards);
      if (!cards.length) { toast.message(kind === "revise" ? "Nothing to revise here. You know every card!" : "No cards in this deck yet."); return; }
      setSession({ deck, title: deck?.title ?? `${subject} · Random 30`, cards, kind, round: 1 });
      window.scrollTo({ top: 0 });
    } catch (e: any) {
      toast.error(e?.message ?? "Could not load cards");
    } finally { setOpening(null); }
  }

  function onRated(card: Flashcard, rating: 1 | 2 | 3) {
    setLatest((p) => ({ ...p, [card.id]: { r: rating, d: card.deck_id } }));
    if (user) review({ data: { card_id: card.id, deck_id: card.deck_id, rating } }).catch(() => {});
  }

  if (session) {
    return (
      <PageShell>
        <Study key={`${session.title}-${session.round}`} session={session} onRated={onRated}
          onExit={() => setSession(null)}
          onRestart={(cards) => setSession({ ...session, cards: shuffle(cards), kind: "revise", round: session.round + 1 })} />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <style>{FC_CSS}</style>
      {/* Hero */}
      <section className="fc-hero">
        <div className="fc-hero-glow" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-violet-300">Active recall</div>
            <h1 className="mt-1.5 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">Flashcards</h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-300">Chapter-wise NCERT points in question–answer form. Flip, recall, and mark what you know. Cards you miss come back until they stick.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={() => void open(null, "mix")} disabled={!subjectDecks.length || !!opening} className="fc-cta">
                <Shuffle className="h-4 w-4" />Random 30 from {subject}
              </button>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Ring pct={totals.pct} size={104} stroke={9} color="#A78BFA"><div className="text-center"><div className="text-2xl font-extrabold text-white">{totals.pct}%</div><div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">mastered</div></div></Ring>
            <div className="space-y-2 text-sm">
              <Stat dot="#34D399" label="Know it" value={totals.known} />
              <Stat dot="#FB7185" label="To revise" value={totals.revise} />
              <Stat dot="#94A3B8" label="Total cards" value={totals.cards} />
            </div>
          </div>
        </div>
      </section>

      {/* Subject + class filters */}
      <div className="sticky top-0 z-20 -mx-4 mt-5 bg-background/85 px-4 py-2.5 backdrop-blur sm:mx-0 sm:rounded-2xl sm:px-0">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-xl border bg-card p-1">
            {SUBJECTS.map((s) => (
              <button key={s} type="button" onClick={() => setSubject(s)}
                className={cn("rounded-lg px-3.5 py-1.5 text-sm font-semibold transition", subject === s ? "text-white shadow" : "text-muted-foreground hover:text-foreground")}
                style={subject === s ? { background: SUBJ_TINT[s] } : undefined}>
                {s}{!available.has(s) && decks ? <span className="ml-1 text-[10px] font-medium opacity-70">soon</span> : null}
              </button>
            ))}
          </div>
          <div className="flex rounded-xl border bg-card p-1">
            {([0, 11, 12] as const).map((c) => (
              <button key={c} type="button" onClick={() => setCls(c)} className={cn("rounded-lg px-3 py-1.5 text-sm font-semibold transition", cls === c ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground")}>
                {c ? `Class ${c}` : "All"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {decks === null ? (
        <DrAzkaLoader size="sm" message="Arranging your flashcards" className="py-12" />
      ) : shown.length === 0 ? (
        <div className="mt-4 rounded-3xl border border-dashed p-10 text-center">
          <Sparkles className="mx-auto mb-2 h-6 w-6 text-primary" />
          <div className="font-semibold">{subject} flashcards are coming soon</div>
          <p className="mt-1 text-sm text-muted-foreground">Biology is ready now, with every NCERT chapter.</p>
          {subject !== "Biology" && <button type="button" onClick={() => setSubject("Biology")} className="mt-4 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Open Biology</button>}
        </div>
      ) : (
        ([11, 12] as const).filter((c) => !cls || c === cls).map((c) => {
          const list = shown.filter((d) => d.class === c);
          if (!list.length) return null;
          return (
            <div key={c} className="mt-5">
              <div className="mb-2.5 flex items-baseline justify-between">
                <h2 className="text-base font-bold">Class {c}</h2>
                <span className="text-xs text-muted-foreground">{list.length} chapters · {list.reduce((n, d) => n + d.card_count, 0)} cards</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {list.map((d, i) => (
                  <DeckTile key={d.id} deck={d} n={i + 1} stats={deckStats.get(d.id)} busy={opening === d.id} tint={SUBJ_TINT[d.subject] ?? "#6366F1"}
                    onStudy={() => void open(d, "all")} onRevise={() => void open(d, "revise")} onShuffle={() => void open(d, "shuffle")} />
                ))}
              </div>
            </div>
          );
        })
      )}
    </PageShell>
  );
}

function Stat({ dot, label, value }: { dot: string; label: string; value: number }) {
  return (
    <div className="flex items-center gap-2 text-slate-300">
      <span className="h-2 w-2 rounded-full" style={{ background: dot }} />
      <span className="w-20 text-xs">{label}</span>
      <b className="text-white">{value.toLocaleString("en-IN")}</b>
    </div>
  );
}

function Ring({ pct, size, stroke, color, children }: { pct: number; size: number; stroke: number; color: string; children?: ReactNode }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  return (
    <div className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeOpacity={0.15} strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(100, pct) / 100)} style={{ transition: "stroke-dashoffset .8s cubic-bezier(.2,.8,.2,1)" }} />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  );
}

function DeckTile({ deck, n, stats, busy, tint, onStudy, onRevise, onShuffle }: {
  deck: FlashcardDeck; n: number; stats?: { known: number; revise: number; seen: number }; busy: boolean; tint: string;
  onStudy: () => void; onRevise: () => void; onShuffle: () => void;
}) {
  const known = stats?.known ?? 0, revise = stats?.revise ?? 0;
  const pct = deck.card_count ? Math.round((known / deck.card_count) * 100) : 0;
  const started = (stats?.seen ?? 0) > 0;
  return (
    <div className="fc-tile group" style={{ ["--t" as string]: tint }}>
      <button type="button" onClick={onStudy} disabled={busy} className="flex w-full items-center gap-3 text-left">
        <Ring pct={pct} size={52} stroke={5} color={tint}><span className="text-[11px] font-bold">{pct}%</span></Ring>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: tint }}>Chapter {n}</div>
          <div className="truncate text-[15px] font-bold leading-snug">{deck.title}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">{deck.card_count} cards{started ? ` · ${known} known` : ""}</div>
        </div>
        {busy ? <span className="h-5 w-5 animate-spin rounded-full border-2 border-muted border-t-primary" /> : <ChevronRight className="h-5 w-5 text-muted-foreground transition group-hover:translate-x-0.5" />}
      </button>
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={onStudy} disabled={busy} className="fc-chip fc-chip-main"><Layers className="h-3.5 w-3.5" />{started ? "Study all" : "Start"}</button>
        {revise > 0 && <button type="button" onClick={onRevise} disabled={busy} className="fc-chip fc-chip-red"><RotateCcw className="h-3.5 w-3.5" />Revise {revise}</button>}
        <button type="button" onClick={onShuffle} disabled={busy} className="fc-chip" aria-label="Shuffle"><Shuffle className="h-3.5 w-3.5" /></button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ STUDY */

function Study({ session, onRated, onExit, onRestart }: {
  session: Session; onRated: (c: Flashcard, r: 1 | 2 | 3) => void; onExit: () => void; onRestart: (cards: Flashcard[]) => void;
}) {
  const { cards } = session;
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [hint, setHint] = useState(false);
  const [res, setRes] = useState<Result>({});
  const [anim, setAnim] = useState<"" | "out-l" | "out-r">("");
  const done = idx >= cards.length;
  const card = cards[idx];
  const touch = useRef<{ x: number; y: number } | null>(null);

  const rate = useCallback((r: 1 | 2 | 3) => {
    if (!card || anim) return;
    onRated(card, r);
    setRes((p) => ({ ...p, [card.id]: r }));
    setAnim(r === 3 ? "out-r" : "out-l");
    window.setTimeout(() => { setAnim(""); setFlipped(false); setHint(false); setIdx((i) => i + 1); }, 220);
  }, [card, anim, onRated]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (done) return;
      if (e.key === " " || e.key === "Enter") { e.preventDefault(); setFlipped((f) => !f); }
      else if (flipped && e.key === "1") rate(1);
      else if (flipped && e.key === "2") rate(2);
      else if (flipped && e.key === "3") rate(3);
      else if (e.key === "ArrowLeft" && idx > 0) { setIdx(idx - 1); setFlipped(false); setHint(false); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [done, flipped, rate, idx]);

  const counts = useMemo(() => {
    const v = Object.values(res);
    return { know: v.filter((x) => x === 3).length, unsure: v.filter((x) => x === 2).length, again: v.filter((x) => x === 1).length };
  }, [res]);

  return (
    <div className="mx-auto max-w-2xl">
      <style>{FC_CSS}</style>
      <div className="mb-3 flex items-center gap-3">
        <button type="button" onClick={onExit} className="grid h-10 w-10 place-items-center rounded-full border bg-card" aria-label="Back to decks"><ArrowLeft className="h-4 w-4" /></button>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[11px] font-bold uppercase tracking-wider text-violet-500 dark:text-violet-300">{session.kind === "revise" ? "Revision round" : session.kind === "mix" ? "Random mix" : session.deck?.class ? `Class ${session.deck.class} · ${session.deck.subject}` : "Flashcards"}</div>
          <div className="truncate text-base font-bold">{session.title}</div>
        </div>
        <div className="text-right text-sm font-bold tabular-nums">{Math.min(idx + 1, cards.length)}<span className="text-muted-foreground">/{cards.length}</span></div>
      </div>
      <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-secondary">
        <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-400 transition-all duration-300" style={{ width: `${(Math.min(idx, cards.length) / cards.length) * 100}%` }} />
      </div>

      {done ? (
        <div className="fc-done">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-lg"><Trophy className="h-8 w-8" /></div>
          <div className="mt-4 text-xl font-extrabold">Round complete</div>
          <p className="mt-1 text-sm text-muted-foreground">You went through {cards.length} cards.</p>
          <div className="mx-auto mt-5 grid max-w-sm grid-cols-3 gap-2">
            <Score n={counts.know} label="Know it" cls="text-emerald-500" />
            <Score n={counts.unsure} label="Unsure" cls="text-amber-500" />
            <Score n={counts.again} label="Revise" cls="text-rose-500" />
          </div>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            {counts.again + counts.unsure > 0 && (
              <button type="button" className="fc-cta justify-center" onClick={() => onRestart(cards.filter((c) => res[c.id] !== 3))}>
                <RotateCcw className="h-4 w-4" />Revise the {counts.again + counts.unsure} I missed
              </button>
            )}
            <button type="button" onClick={onExit} className="rounded-xl border px-5 py-2.5 text-sm font-semibold">Back to decks</button>
          </div>
        </div>
      ) : card ? (
        <>
          <div className={cn("fc-scene", anim)}
            onTouchStart={(e) => { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }}
            onTouchEnd={(e) => {
              const t = touch.current; touch.current = null;
              if (!t || !flipped) return;
              const dx = e.changedTouches[0].clientX - t.x, dy = e.changedTouches[0].clientY - t.y;
              if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5) rate(dx > 0 ? 3 : 1);
            }}>
            <button type="button" className={cn("fc-card", flipped && "is-flipped")} onClick={() => setFlipped((f) => !f)} aria-label={flipped ? "Show question" : "Show answer"}>
              <div className="fc-face fc-front">
                <div className="flex items-center justify-between gap-2">
                  <span className="fc-tag">{card.tags?.[0] ?? "NCERT"}</span>
                  <Level d={card.difficulty} />
                </div>
                <div className="flex flex-1 items-center justify-center py-6">
                  <div className="text-center text-xl font-bold leading-snug sm:text-2xl"><RichText>{card.front}</RichText></div>
                </div>
                <div className="flex items-center justify-center gap-1.5 text-xs font-medium text-muted-foreground"><Eye className="h-3.5 w-3.5" />Tap to reveal the answer</div>
              </div>
              <div className="fc-face fc-back">
                <div className="flex items-center justify-between gap-2">
                  <span className="fc-tag fc-tag-ok">Answer</span>
                  <span className="truncate text-[11px] font-medium text-muted-foreground">{card.tags?.[0]}</span>
                </div>
                <div className="mt-2 line-clamp-2 text-left text-[13px] font-semibold text-muted-foreground"><RichText>{card.front}</RichText></div>
                <div className="flex flex-1 items-center py-4">
                  <div className="fc-answer w-full text-left text-[17px] leading-relaxed sm:text-lg"><RichText>{card.back}</RichText></div>
                </div>
                {card.hint && (
                  <div className="fc-hint"><Lightbulb className="mt-0.5 h-4 w-4 shrink-0" /><span><RichText>{card.hint}</RichText></span></div>
                )}
              </div>
            </button>
          </div>

          {!flipped ? (
            <div className="mt-4 grid grid-cols-[auto_1fr] gap-2">
              {card.hint ? (
                <button type="button" onClick={() => setHint((h) => !h)} className={cn("flex items-center gap-1.5 rounded-xl border px-4 text-sm font-semibold", hint && "border-amber-400 text-amber-600 dark:text-amber-300")}>
                  <Lightbulb className="h-4 w-4" />Hint
                </button>
              ) : <span />}
              <button type="button" onClick={() => setFlipped(true)} className="fc-cta h-12 justify-center text-base">Show answer</button>
              {hint && card.hint && <div className="fc-hint col-span-2"><Lightbulb className="mt-0.5 h-4 w-4 shrink-0" /><span><RichText>{card.hint}</RichText></span></div>}
            </div>
          ) : (
            <div className="mt-4">
              <div className="mb-2 text-center text-xs font-medium text-muted-foreground">Did you recall it? <span className="hidden sm:inline">(keys 1 · 2 · 3)</span><span className="sm:hidden">Swipe right if you knew it</span></div>
              <div className="grid grid-cols-3 gap-2">
                <button type="button" onClick={() => rate(1)} className="fc-rate fc-rate-red"><X className="h-5 w-5" />Revise again</button>
                <button type="button" onClick={() => rate(2)} className="fc-rate fc-rate-amber"><HelpCircle className="h-5 w-5" />Unsure</button>
                <button type="button" onClick={() => rate(3)} className="fc-rate fc-rate-green"><Check className="h-5 w-5" />Know it</button>
              </div>
            </div>
          )}
          <div className="mt-4 flex justify-center gap-4 text-xs font-semibold">
            <span className="text-emerald-500">✓ {counts.know}</span><span className="text-amber-500">? {counts.unsure}</span><span className="text-rose-500">✗ {counts.again}</span>
          </div>
        </>
      ) : null}
    </div>
  );
}

function Score({ n, label, cls }: { n: number; label: string; cls: string }) {
  return <div className="rounded-2xl border bg-card p-3"><div className={cn("text-2xl font-extrabold", cls)}>{n}</div><div className="text-[11px] font-semibold text-muted-foreground">{label}</div></div>;
}

function Level({ d }: { d: string }) {
  const l = (d ?? "medium").toLowerCase();
  const m = l === "easy" ? ["Easy", "#10B981"] : l === "hard" ? ["Hard", "#F43F5E"] : ["Medium", "#F59E0B"];
  return <span className="rounded-full px-2.5 py-0.5 text-[11px] font-bold" style={{ color: m[1], background: `${m[1]}1f` }}>{m[0]}</span>;
}

const FC_CSS = `
.fc-hero{position:relative;overflow:hidden;border-radius:28px;padding:22px;background:linear-gradient(140deg,#1E1240 0%,#120A2A 55%,#0B0820 100%);border:1px solid rgba(167,139,250,.25);box-shadow:0 24px 60px -30px rgba(76,29,149,.7)}
@media (min-width:640px){.fc-hero{padding:30px}}
.fc-hero-glow{position:absolute;inset:0;background:radial-gradient(420px 220px at 85% 10%,rgba(217,70,239,.28),transparent 70%),radial-gradient(380px 240px at 0% 100%,rgba(99,102,241,.25),transparent 70%);pointer-events:none}
.fc-cta{display:inline-flex;align-items:center;gap:8px;height:44px;padding:0 18px;border-radius:14px;font-weight:700;font-size:14px;color:#fff;background:linear-gradient(90deg,#7C3AED,#C026D3);box-shadow:0 12px 26px -12px rgba(192,38,211,.8);transition:transform .15s}
.fc-cta:active{transform:scale(.98)}
.fc-cta:disabled{opacity:.5}
.fc-tile{border-radius:22px;padding:14px;background:var(--card);border:1px solid var(--border);transition:border-color .2s,box-shadow .2s,transform .2s}
.fc-tile:hover{border-color:color-mix(in oklab,var(--t) 55%,transparent);box-shadow:0 14px 34px -22px var(--t);transform:translateY(-1px)}
.fc-chip{display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 11px;border-radius:10px;font-size:12px;font-weight:700;border:1px solid var(--border);color:var(--muted-foreground)}
.fc-chip-main{flex:1;justify-content:center;color:#fff;border-color:transparent;background:linear-gradient(90deg,var(--t),color-mix(in oklab,var(--t) 70%,#EC4899))}
.fc-chip-red{color:#F43F5E;border-color:rgba(244,63,94,.35);background:rgba(244,63,94,.08)}
.fc-scene{perspective:1400px;transition:transform .22s ease,opacity .22s ease}
.fc-scene.out-r{transform:translateX(40px) rotate(3deg);opacity:0}
.fc-scene.out-l{transform:translateX(-40px) rotate(-3deg);opacity:0}
.fc-card{position:relative;display:block;width:100%;min-height:360px;transform-style:preserve-3d;transition:transform .5s cubic-bezier(.2,.8,.2,1);-webkit-tap-highlight-color:transparent}
.fc-card.is-flipped{transform:rotateY(180deg)}
.fc-face{position:absolute;inset:0;display:flex;flex-direction:column;padding:20px;border-radius:26px;backface-visibility:hidden;-webkit-backface-visibility:hidden;border:1px solid var(--border);background:var(--card);box-shadow:0 30px 60px -36px rgba(15,23,42,.55)}
.fc-front{background:radial-gradient(500px 260px at 100% 0%,rgba(168,85,247,.13),transparent 60%),radial-gradient(400px 240px at 0% 100%,rgba(59,130,246,.10),transparent 60%),var(--card)}
.fc-back{transform:rotateY(180deg);background:radial-gradient(500px 260px at 100% 0%,rgba(16,185,129,.12),transparent 60%),var(--card);overflow:auto}
.fc-tag{max-width:70%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;border-radius:999px;padding:3px 10px;font-size:11px;font-weight:700;color:#8B5CF6;background:rgba(139,92,246,.12)}
.fc-tag-ok{color:#059669;background:rgba(16,185,129,.14)}
.dark .fc-tag{color:#C4B5FD}.dark .fc-tag-ok{color:#6EE7B7}
.fc-answer b{color:#7C3AED;font-weight:800}
.dark .fc-answer b{color:#C4B5FD}
.fc-answer i{font-style:italic}
.fc-hint{display:flex;gap:8px;text-align:left;border-radius:14px;padding:10px 12px;font-size:13px;line-height:1.45;color:#92400E;background:rgba(245,158,11,.12);border:1px solid rgba(245,158,11,.3)}
.dark .fc-hint{color:#FCD34D}
.fc-rate{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;height:68px;border-radius:16px;font-size:12.5px;font-weight:700;border:1px solid;transition:transform .12s}
.fc-rate:active{transform:scale(.96)}
.fc-rate-red{color:#E11D48;border-color:rgba(244,63,94,.35);background:rgba(244,63,94,.08)}
.fc-rate-amber{color:#D97706;border-color:rgba(245,158,11,.35);background:rgba(245,158,11,.08)}
.fc-rate-green{color:#fff;border-color:transparent;background:linear-gradient(135deg,#10B981,#059669);box-shadow:0 12px 24px -12px rgba(16,185,129,.8)}
.fc-done{border-radius:26px;padding:28px 20px;text-align:center;background:var(--card);border:1px solid var(--border)}
@media (prefers-reduced-motion:reduce){.fc-card,.fc-scene{transition:none}}
`;
