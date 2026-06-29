import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Headset, X, Send, Bot, Users, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { getMyTicket, sendSupportMessage, setSupportMode } from "@/lib/support.functions";
import { cn } from "@/lib/utils";

type Msg = { id: string; sender: "user" | "ai" | "admin"; content: string; created_at: string };

const POS_KEY = "neetiq_support_pos";
const HIDE_KEY = "neetiq_support_hidden"; // session-only: reappears on next visit
const FAB = 48; // launcher size in px

export function SupportWidget() {
  const { user, loading } = useAuth();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"ai" | "team" | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchTicket = useServerFn(getMyTicket);
  const sendMsg = useServerFn(sendSupportMessage);
  const setModeFn = useServerFn(setSupportMode);

  // Drag bookkeeping
  const dragRef = useRef({ active: false, moved: false, dx: 0, dy: 0 });

  // Load saved position; "hidden" is session-only so it reappears on revisit
  useEffect(() => {
    try {
      if (sessionStorage.getItem(HIDE_KEY) === "1") setHidden(true);
      const raw = localStorage.getItem(POS_KEY);
      if (raw) {
        const p = JSON.parse(raw);
        if (typeof p?.x === "number" && typeof p?.y === "number") setPos(p);
      }
    } catch { /* ignore */ }
  }, []);

  // Don't show on landing / login / admin pages
  const hide =
    !user || loading || hidden || path === "/" || path.startsWith("/login") || path.startsWith("/admin");

  async function load() {
    try {
      const r = await fetchTicket();
      setMessages((r.messages ?? []) as Msg[]);
      setMode((r.ticket?.mode ?? "ai") as "ai" | "team");
    } catch { /* ignore */ }
  }

  useEffect(() => { if (open && user) load(); }, [open, user?.id]);

  useEffect(() => {
    if (!open || !user || mode !== "team") return;
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, [open, user?.id, mode]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  async function pickMode(m: "ai" | "team") {
    setBusy(true);
    try { await setModeFn({ data: { mode: m } }); setMode(m); await load(); }
    finally { setBusy(false); }
  }

  async function send() {
    const text = input.trim();
    if (!text) return;
    setInput("");
    setMessages((p) => [...p, { id: `tmp-${Date.now()}`, sender: "user", content: text, created_at: new Date().toISOString() }]);
    setBusy(true);
    try { await sendMsg({ data: { content: text } }); await load(); }
    catch { /* ignore */ }
    finally { setBusy(false); }
  }

  function removeWidget() {
    setHidden(true);
    // session-only: it comes back when the user revisits the site
    try { sessionStorage.setItem(HIDE_KEY, "1"); } catch { /* ignore */ }
  }

  // ---- Drag handlers (pointer) ----
  function onPointerDown(e: React.PointerEvent) {
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    const startX = pos?.x ?? window.innerWidth - FAB - 16;
    const startY = pos?.y ?? window.innerHeight - FAB - 80;
    dragRef.current = { active: true, moved: false, dx: e.clientX - startX, dy: e.clientY - startY };
  }
  function onPointerMove(e: React.PointerEvent) {
    const d = dragRef.current;
    if (!d.active) return;
    let nx = e.clientX - d.dx;
    let ny = e.clientY - d.dy;
    // mark as moved once it travels a few px
    if (!d.moved && (Math.abs(nx - (pos?.x ?? nx)) > 4 || Math.abs(ny - (pos?.y ?? ny)) > 4)) d.moved = true;
    nx = Math.max(8, Math.min(window.innerWidth - FAB - 8, nx));
    ny = Math.max(8, Math.min(window.innerHeight - FAB - 8, ny));
    setPos({ x: nx, y: ny });
  }
  function onPointerUp() {
    const d = dragRef.current;
    dragRef.current = { ...d, active: false };
    if (d.moved) {
      try { localStorage.setItem(POS_KEY, JSON.stringify(pos)); } catch { /* ignore */ }
    } else {
      setOpen(true);
    }
  }

  if (hide) return null;

  const fabStyle: CSSProperties = pos
    ? { left: pos.x, top: pos.y, right: "auto", bottom: "auto" }
    : {};

  return (
    <>
      {!open && (
        <div
          style={fabStyle}
          className={cn(
            "fixed z-[90] select-none",
            !pos && "bottom-20 right-4 sm:bottom-6",
          )}
        >
          {/* remove button */}
          <button
            onClick={removeWidget}
            aria-label="Remove support button"
            className="absolute -right-1 -top-1 z-10 flex h-5 w-5 items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-sm hover:text-foreground"
          >
            <X className="h-3 w-3" />
          </button>
          <button
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            className="flex h-12 w-12 cursor-grab touch-none items-center justify-center rounded-full bg-gradient-primary text-primary-foreground shadow-elegant transition-transform hover:scale-105 active:cursor-grabbing"
            aria-label="Open support"
          >
            <Headset className="h-5 w-5" />
          </button>

        </div>
      )}

      {open && (
        <div className="fixed inset-x-3 bottom-3 z-[95] mx-auto flex max-h-[80vh] max-w-md flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl sm:bottom-6 sm:right-6 sm:left-auto sm:w-96">
          <div className="flex items-center gap-2 bg-gradient-primary px-4 py-3 text-primary-foreground">
            <Headset className="h-4 w-4" />
            <div className="text-sm font-bold">Support</div>
            <div className="ml-auto flex items-center gap-2">
              {mode && (
                <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] uppercase tracking-wider">
                  {mode === "ai" ? "AI" : "Team"}
                </span>
              )}
              <button onClick={() => setOpen(false)} className="rounded-md p-1 hover:bg-white/15"><X className="h-4 w-4" /></button>
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto p-3">
            {messages.length === 0 && (
              <div className="rounded-xl bg-secondary p-3 text-sm text-muted-foreground">
                Hi 👋 How can we help? Pick how you'd like us to answer:
              </div>
            )}
            {messages.map((m) => (
              <div key={m.id} className={cn("flex", m.sender === "user" ? "justify-end" : "justify-start")}>
                <div className={cn(
                  "max-w-[80%] rounded-2xl px-3 py-2 text-sm",
                  m.sender === "user"
                    ? "bg-gradient-primary text-primary-foreground"
                    : m.sender === "admin"
                      ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-100"
                      : "bg-secondary",
                )}>
                  {m.sender !== "user" && (
                    <div className="mb-0.5 text-[10px] font-bold uppercase tracking-wider opacity-70">
                      {m.sender === "admin" ? "Team" : "AI"}
                    </div>
                  )}
                  <div className="whitespace-pre-wrap leading-snug">{m.content}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Mode picker / handoff */}
          {(messages.length === 0 || mode === "ai") && (
            <div className="grid grid-cols-2 gap-2 border-t border-border bg-background p-3">
              <Button size="sm" variant="outline" onClick={() => pickMode("ai")} disabled={busy || mode === "ai"}>
                <Bot className="mr-1.5 h-4 w-4" /> Solve with AI
              </Button>
              <Button size="sm" className="bg-gradient-primary" onClick={() => pickMode("team")} disabled={busy}>
                <Users className="mr-1.5 h-4 w-4" /> Talk to Team
              </Button>
            </div>
          )}

          <div className="flex items-center gap-2 border-t border-border bg-background p-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder={mode === "team" ? "Message the team…" : "Ask anything…"}
              disabled={busy}
            />
            <Button size="icon" className="bg-gradient-primary shrink-0" onClick={send} disabled={busy || !input.trim()}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
