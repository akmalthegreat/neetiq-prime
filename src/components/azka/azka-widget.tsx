// Miss Azka — the floating guide on every page. Students ask in plain words
// ("short notes of Cell", "20 hard questions on Bonding") and she replies with
// cards that open the exact page. The old "Talk to team" support chat lives in
// the second tab.
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useRouter, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, ArrowUp, Loader2, Lock, Play, RotateCcw, Sparkles, Users, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { useAccess } from "@/hooks/use-access";
import { askAzka } from "@/lib/azka.functions";
import { createAzkaQuiz } from "@/lib/azka-quiz";
import { AZKA_STARTERS, type AzkaCard } from "@/lib/azka-catalog";
import { getMyTicket, sendSupportMessage, setSupportMode } from "@/lib/support.functions";
import { cn } from "@/lib/utils";
import { AZKA_CSS } from "./azka-styles";

const AVATAR = "/azka-avatar.webp";
const POS_KEY = "neetiq_support_pos";
const HIDE_KEY = "neetiq_support_hidden"; // session-only: comes back on the next visit
const INTRO_KEY = "azka_intro_seen_v1";
const NUDGE_KEY = "azka_nudge_day";
const FAB = 60;

type ChatMsg = { id: string; role: "user" | "azka"; text: string; cards?: AzkaCard[]; suggestions?: string[]; error?: boolean };
type TeamMsg = { id: string; sender: "user" | "ai" | "admin"; content: string; created_at: string };

const CAPABILITIES = [
  { emoji: "📝", title: "Short notes", sub: "Any chapter, one tap", ask: "Short notes of Human Reproduction" },
  { emoji: "🎯", title: "Quiz maker", sub: "From our question bank", ask: "Make a 15-question quiz on Chemical Bonding" },
  { emoji: "🃏", title: "Flashcards", sub: "Quick active recall", ask: "Flashcards for Cell: The Unit of Life" },
  { emoji: "🧭", title: "Find anything", sub: "Every feature of the app", ask: "What can I do on NEET Track?" },
];

const NUDGES = [
  "Need short notes? Just ask me 📝",
  "I can make a quiz on any chapter 🎯",
  "Lost? I'll take you to any feature 🧭",
  "Want flashcards for today's chapter? 🃏",
];

const uid = () => Math.random().toString(36).slice(2, 10);

function readLocal(key: string) { try { return localStorage.getItem(key); } catch { return null; } }
function writeLocal(key: string, v: string) { try { localStorage.setItem(key, v); } catch { /* ignore */ } }

export function AzkaWidget() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { hasFeature, loading: accessLoading } = useAccess();
  const ask = useServerFn(askAzka);

  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"azka" | "team">("azka");
  const [hidden, setHidden] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [bubble, setBubble] = useState<"intro" | "nudge" | null>(null);
  const [nudge, setNudge] = useState(NUDGES[0]);

  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [quizBusy, setQuizBusy] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const dragRef = useRef({ active: false, moved: false, dx: 0, dy: 0 });

  const firstName = useMemo(
    () => profile?.full_name?.trim()?.split(" ")[0] || user?.email?.split("@")[0] || "Doctor",
    [profile?.full_name, user?.email],
  );
  const chatKey = user ? `azka_chat_${user.id}` : null;

  // Saved position, session-hide, intro/nudge bubbles
  useEffect(() => {
    try {
      if (sessionStorage.getItem(HIDE_KEY) === "1") setHidden(true);
      const raw = localStorage.getItem(POS_KEY);
      if (raw) {
        const p = JSON.parse(raw);
        if (typeof p?.x === "number" && typeof p?.y === "number") {
          setPos({ x: Math.min(p.x, window.innerWidth - FAB - 8), y: Math.min(p.y, window.innerHeight - FAB - 8) });
        }
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (!user) return;
    if (!readLocal(INTRO_KEY)) {
      const t = setTimeout(() => setBubble("intro"), 1800);
      return () => clearTimeout(t);
    }
    const today = new Date().toDateString();
    if (readLocal(NUDGE_KEY) !== today) {
      const t = setTimeout(() => {
        setNudge(NUDGES[new Date().getDate() % NUDGES.length]);
        setBubble("nudge");
        writeLocal(NUDGE_KEY, today);
      }, 25_000);
      return () => clearTimeout(t);
    }
  }, [user?.id]);

  useEffect(() => {
    if (bubble !== "nudge") return;
    const t = setTimeout(() => setBubble(null), 7000);
    return () => clearTimeout(t);
  }, [bubble]);

  // Chat history survives page changes within the session
  useEffect(() => {
    if (!chatKey) return;
    try {
      const raw = sessionStorage.getItem(chatKey);
      if (raw) setMsgs(JSON.parse(raw) as ChatMsg[]);
    } catch { /* ignore */ }
  }, [chatKey]);
  useEffect(() => {
    if (!chatKey) return;
    try { sessionStorage.setItem(chatKey, JSON.stringify(msgs.slice(-30))); } catch { /* ignore */ }
  }, [msgs, chatKey]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs.length, thinking, open, tab]);

  // Close the panel with Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const hide = !user || loading || hidden || path === "/" || path.startsWith("/login") || path.startsWith("/admin") || /^\/(quiz|battle|contest|target-700-test)\//.test(path);

  function openPanel() {
    setOpen(true);
    setBubble(null);
    writeLocal(INTRO_KEY, "1");
    setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 350);
  }

  async function send(textArg?: string) {
    const text = (textArg ?? input).trim();
    if (!text || thinking) return;
    setInput("");
    const history = msgs.slice(-8).map((m) => ({ role: m.role, text: m.text.slice(0, 1200) }));
    setMsgs((p) => [...p, { id: uid(), role: "user", text }]);
    setThinking(true);
    try {
      const r = await ask({ data: { message: text.slice(0, 600), history, firstName } });
      setMsgs((p) => [...p, { id: uid(), role: "azka", text: r.reply, cards: r.cards, suggestions: r.suggestions }]);
    } catch {
      setMsgs((p) => [...p, { id: uid(), role: "azka", text: "Oops, I couldn't connect just now. Please try again in a moment.", error: true }]);
    } finally {
      setThinking(false);
    }
  }

  function go(href: string) {
    setOpen(false);
    void router.navigate({ href });
  }

  async function startQuiz(card: Extract<AzkaCard, { kind: "quiz" }>, key: string) {
    if (!user || quizBusy) return;
    if (!accessLoading && !hasFeature("generate_test")) {
      toast.message("Custom quizzes are a Premium feature", { description: "Unlock Premium to let Miss Azka build quizzes for you." });
      go("/premium");
      return;
    }
    setQuizBusy(key);
    try {
      const { testId, got } = await createAzkaQuiz({ userId: user.id, title: card.title.replace(/^Quiz · /, "Azka Quiz · "), chapterIds: card.chapterIds, count: card.count, difficulty: card.difficulty, pyqOnly: card.pyqOnly });
      if (got < card.count) toast.message(`Found ${got} of ${card.count} questions`, { description: "Your quiz uses all of them." });
      setOpen(false);
      await router.navigate({ to: "/quiz/$testId", params: { testId }, search: { mode: "quiz" } as never });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create the quiz");
    } finally {
      setQuizBusy(null);
    }
  }

  function clearChat() {
    setMsgs([]);
    try { if (chatKey) sessionStorage.removeItem(chatKey); } catch { /* ignore */ }
  }

  function removeWidget() {
    setHidden(true);
    try { sessionStorage.setItem(HIDE_KEY, "1"); } catch { /* ignore */ }
  }

  // ---- Drag the launcher anywhere ----
  function onPointerDown(e: React.PointerEvent) {
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    const startX = pos?.x ?? window.innerWidth - FAB - 16;
    const startY = pos?.y ?? window.innerHeight - FAB - 100;
    dragRef.current = { active: true, moved: false, dx: e.clientX - startX, dy: e.clientY - startY };
  }
  function onPointerMove(e: React.PointerEvent) {
    const d = dragRef.current;
    if (!d.active) return;
    let nx = e.clientX - d.dx;
    let ny = e.clientY - d.dy;
    if (!d.moved && (Math.abs(nx - (pos?.x ?? nx)) > 4 || Math.abs(ny - (pos?.y ?? ny)) > 4)) d.moved = true;
    nx = Math.max(8, Math.min(window.innerWidth - FAB - 8, nx));
    ny = Math.max(8, Math.min(window.innerHeight - FAB - 8, ny));
    setPos({ x: nx, y: ny });
  }
  function onPointerUp() {
    const d = dragRef.current;
    dragRef.current = { ...d, active: false };
    if (d.moved) writeLocal(POS_KEY, JSON.stringify(pos));
    else openPanel();
  }

  if (hide) return null;

  const fabStyle: CSSProperties = pos ? { left: pos.x, top: pos.y, right: "auto", bottom: "auto" } : {};
  const bubbleLeft = pos ? pos.x < window.innerWidth / 2 : false;
  const last = msgs[msgs.length - 1];

  return (
    <>
      <style>{AZKA_CSS}</style>

      {!open && (
        <div style={fabStyle} data-support-fab="" className={cn("azk-fab-wrap", !pos && "azk-fab-home")}>
          {bubble && (
            <div className={cn("azk-bubble", bubbleLeft && "azk-bubble-r")} role="status">
              <button type="button" className="azk-bubble-x" aria-label="Dismiss" onClick={() => { setBubble(null); if (bubble === "intro") writeLocal(INTRO_KEY, "1"); }}>
                <X className="h-3 w-3" />
              </button>
              {bubble === "intro" ? (
                <>
                  <div className="azk-bubble-h">Hi {firstName}! I'm Miss Azka 👋</div>
                  <p>Ask me for short notes, a quiz on any chapter, flashcards — or anything on NEET Track. I'll open it for you.</p>
                  <button type="button" className="azk-bubble-cta" onClick={openPanel}>Try me <ArrowRight className="h-3.5 w-3.5" /></button>
                </>
              ) : (
                <button type="button" className="azk-bubble-line" onClick={openPanel}>{nudge}</button>
              )}
            </div>
          )}
          <button type="button" onClick={removeWidget} aria-label="Hide Miss Azka for this visit" className="azk-fab-x">
            <X className="h-3 w-3" />
          </button>
          <button
            type="button"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            className="azk-fab"
            aria-label="Ask Miss Azka"
          >
            <span className="azk-fab-halo" aria-hidden="true" />
            <span className="azk-fab-ring" aria-hidden="true" />
            <img src={AVATAR} alt="" className="azk-fab-img" draggable={false} />
            <span className="azk-online" aria-hidden="true" />
            <span className="azk-spark" aria-hidden="true"><Sparkles className="h-3 w-3" /></span>
          </button>
        </div>
      )}

      {open && (
        <>
          <div className="azk-scrim" onClick={() => setOpen(false)} aria-hidden="true" />
          <section className="azk-panel" role="dialog" aria-label="Miss Azka">
            <header className="azk-head">
              <div className="azk-head-av">
                <span className="azk-head-ring" aria-hidden="true" />
                <img src={AVATAR} alt="" />
                <span className="azk-online" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <div className="azk-head-name">Miss Azka</div>
                <div className="azk-head-sub">{thinking ? "typing…" : "Your NEET Track guide · online"}</div>
              </div>
              <div className="ml-auto flex items-center gap-1">
                {tab === "azka" && msgs.length > 0 && (
                  <button type="button" onClick={clearChat} className="azk-icon-btn" aria-label="New chat" title="New chat"><RotateCcw className="h-4 w-4" /></button>
                )}
                <button type="button" onClick={() => setOpen(false)} className="azk-icon-btn" aria-label="Close"><X className="h-4 w-4" /></button>
              </div>
              <div className="azk-tabs" role="tablist">
                <button type="button" role="tab" aria-selected={tab === "azka"} className={cn(tab === "azka" && "on")} onClick={() => setTab("azka")}>
                  <Sparkles className="h-3.5 w-3.5" /> Ask Azka
                </button>
                <button type="button" role="tab" aria-selected={tab === "team"} className={cn(tab === "team" && "on")} onClick={() => setTab("team")}>
                  <Users className="h-3.5 w-3.5" /> Talk to team
                </button>
              </div>
            </header>

            {tab === "azka" ? (
              <>
                <div ref={scrollRef} className="azk-body">
                  {msgs.length === 0 && (
                    <div className="azk-welcome">
                      <div className="azk-hero">
                        <img src="/azka-hero.webp" alt="" className="azk-hero-img" />
                      </div>
                      <h3>Hi {firstName}! 👋</h3>
                      <p>I'm Miss Azka. Tell me what you need and I'll open it for you — notes, quizzes, flashcards or any feature.</p>
                      <div className="azk-caps">
                        {CAPABILITIES.map((c, i) => (
                          <button key={c.title} type="button" className="azk-cap" style={{ animationDelay: `${120 + i * 70}ms` }} onClick={() => void send(c.ask)}>
                            <span className="azk-cap-e">{c.emoji}</span>
                            <span className="azk-cap-t">{c.title}</span>
                            <span className="azk-cap-s">{c.sub}</span>
                          </button>
                        ))}
                      </div>
                      <div className="azk-try">Try asking</div>
                      <div className="azk-chips">
                        {AZKA_STARTERS.map((s) => <button key={s} type="button" className="azk-chip" onClick={() => void send(s)}>{s}</button>)}
                      </div>
                    </div>
                  )}

                  {msgs.map((m) => (
                    <div key={m.id} className={cn("azk-row", m.role === "user" ? "azk-row-me" : "azk-row-az")}>
                      {m.role === "azka" && <img src={AVATAR} alt="" className="azk-mini" />}
                      <div className="azk-col">
                        <div className={cn("azk-msg", m.role === "user" ? "azk-msg-me" : "azk-msg-az", m.error && "azk-msg-err")}>{m.text}</div>
                        {m.cards?.map((c, i) => {
                          const key = `${m.id}-${i}`;
                          if (c.kind === "link") {
                            return (
                              <button key={key} type="button" className="azk-card" style={{ "--t": c.tint, animationDelay: `${i * 80}ms` } as CSSProperties} onClick={() => go(c.href)}>
                                <span className="azk-card-e">{c.emoji}</span>
                                <span className="azk-card-txt"><b>{c.title}</b><small>{c.sub}</small></span>
                                <ArrowRight className="azk-card-go h-4 w-4" />
                              </button>
                            );
                          }
                          const locked = !accessLoading && !hasFeature("generate_test");
                          return (
                            <div key={key} className="azk-quiz" style={{ animationDelay: `${i * 80}ms` }}>
                              <div className="azk-quiz-top"><span className="azk-quiz-badge">🎯 Quiz ready</span><span className="azk-quiz-n">{c.count} Qs</span></div>
                              <b>{c.title.replace(/^Quiz · /, "")}</b>
                              <small>{c.sub}</small>
                              <button type="button" className="azk-quiz-go" disabled={quizBusy === key} onClick={() => void startQuiz(c, key)}>
                                {quizBusy === key ? <><Loader2 className="h-4 w-4 animate-spin" /> Picking questions…</> : locked ? <><Lock className="h-4 w-4" /> Unlock with Premium</> : <><Play className="h-4 w-4" /> Start quiz</>}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}

                  {thinking && (
                    <div className="azk-row azk-row-az">
                      <img src={AVATAR} alt="" className="azk-mini" />
                      <div className="azk-msg azk-msg-az azk-typing" aria-label="Miss Azka is typing"><i /><i /><i /></div>
                    </div>
                  )}

                  {!thinking && last?.role === "azka" && (last.suggestions?.length ?? 0) > 0 && (
                    <div className="azk-chips azk-chips-after">
                      {last.suggestions!.map((s) => <button key={s} type="button" className="azk-chip" onClick={() => void send(s)}>{s}</button>)}
                    </div>
                  )}
                </div>

                <form className="azk-input" onSubmit={(e) => { e.preventDefault(); void send(); }}>
                  <textarea
                    ref={inputRef}
                    rows={1}
                    value={input}
                    maxLength={600}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
                    placeholder="Ask Miss Azka anything…"
                    aria-label="Message Miss Azka"
                  />
                  <button type="submit" className="azk-send" disabled={!input.trim() || thinking} aria-label="Send">
                    {thinking ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
                  </button>
                </form>
              </>
            ) : (
              <TeamChat />
            )}
          </section>
        </>
      )}
    </>
  );
}

/** The original human-support chat, now the "Talk to team" tab. */
function TeamChat() {
  const fetchTicket = useServerFn(getMyTicket);
  const sendMsg = useServerFn(sendSupportMessage);
  const setModeFn = useServerFn(setSupportMode);
  const [messages, setMessages] = useState<TeamMsg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  async function load() {
    try {
      const r = await fetchTicket();
      setMessages((r.messages ?? []) as TeamMsg[]);
      if (r.ticket?.mode !== "team") await setModeFn({ data: { mode: "team" } }).then(async () => {
        const again = await fetchTicket();
        setMessages((again.messages ?? []) as TeamMsg[]);
      });
    } catch { /* ignore */ }
    setReady(true);
  }

  useEffect(() => {
    void load();
    const t = setInterval(() => { fetchTicket().then((r) => setMessages((r.messages ?? []) as TeamMsg[])).catch(() => {}); }, 10_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setMessages((p) => [...p, { id: `tmp-${Date.now()}`, sender: "user", content: text, created_at: new Date().toISOString() }]);
    setBusy(true);
    try { await sendMsg({ data: { content: text } }); const r = await fetchTicket(); setMessages((r.messages ?? []) as TeamMsg[]); }
    catch { toast.error("Could not send. Please try again."); }
    finally { setBusy(false); }
  }

  return (
    <>
      <div ref={scrollRef} className="azk-body">
        <div className="azk-team-note">
          <Users className="h-4 w-4 shrink-0" />
          <span>Our team reads every message and replies here — usually within a few hours. For instant help, use <b>Ask Azka</b>.</span>
        </div>
        {!ready && <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>}
        {messages.map((m) => (
          <div key={m.id} className={cn("azk-row", m.sender === "user" ? "azk-row-me" : "azk-row-az")}>
            <div className="azk-col">
              <div className={cn("azk-msg", m.sender === "user" ? "azk-msg-me" : "azk-msg-az", m.sender === "admin" && "azk-msg-team")}>
                {m.sender !== "user" && <span className="azk-from">{m.sender === "admin" ? "NEET Track team" : "Auto reply"}</span>}
                {m.content}
              </div>
            </div>
          </div>
        ))}
      </div>
      <form className="azk-input" onSubmit={(e) => { e.preventDefault(); void send(); }}>
        <textarea
          rows={1}
          value={input}
          maxLength={2000}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
          placeholder="Message the team…"
          aria-label="Message the team"
        />
        <button type="submit" className="azk-send" disabled={!input.trim() || busy} aria-label="Send">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
        </button>
      </form>
    </>
  );
}
