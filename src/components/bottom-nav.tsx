// Phone bottom navigation: Home · Tests · Study · Tools · Mentor.
// Tests, Study and Tools open a bottom panel of shortcuts.

import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ComponentType } from "react";
import { createPortal } from "react-dom";
import {
  Home, ClipboardCheck, BookOpen, Sparkles, GraduationCap, X, Trophy, Target, SlidersHorizontal, Zap, LayoutList,
  History, Layers, Gem, NotebookPen, Gauge, ListChecks, Route as RouteIcon, RotateCcw, Atom,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Item = { to: string; label: string; sub: string; icon: ComponentType<{ className?: string }>; tint: string; badge?: string; match?: string[] };
type Group = { key: "tests" | "study" | "tools"; label: string; title: string; blurb: string; icon: ComponentType<{ className?: string }>; items: Item[] };

const GROUPS: Group[] = [
  {
    key: "tests", label: "Tests", title: "Tests & Practice", blurb: "Exam-pattern papers, daily practice and live competition.", icon: ClipboardCheck,
    items: [
      { to: "/target-700", label: "Target 700 Batch", sub: "46 NEET-pattern mock tests", icon: Target, tint: "#F59E0B", badge: "NEW", match: ["/mocks", "/target-700"] },
      { to: "/mega-quiz", label: "Daily Mega Quiz", sub: "8:30 PM · win ₹21", icon: Trophy, tint: "#EAB308", badge: "LIVE" },
      { to: "/generate", label: "Generate a Test", sub: "Your chapters, your timer", icon: SlidersHorizontal, tint: "#6366F1" },
      { to: "/daily", label: "Daily DPP", sub: "Today's practice set", icon: Zap, tint: "#06B6D4" },
      { to: "/dpp", label: "Chapter-wise Practice", sub: "Physics · Chemistry · Biology", icon: LayoutList, tint: "#10B981", match: ["/subjects/"] },
      { to: "/pyqs", label: "Previous Year Qs", sub: "Real NEET questions", icon: History, tint: "#EC4899" },
    ],
  },
  {
    key: "study", label: "Study", title: "Study Material", blurb: "Revise faster with crisp notes and active recall.", icon: BookOpen,
    items: [
      { to: "/nuggets", label: "NCERT Nuggets", sub: "Read lines, solve Qs", icon: Gem, tint: "#10B981", badge: "NEW" },
      { to: "/short-notes", label: "Short Notes", sub: "NCERT, chapter by chapter", icon: NotebookPen, tint: "#0EA5E9", match: ["/notes/"] },
      { to: "/flashcards", label: "Flashcards", sub: "Quick active recall", icon: Layers, tint: "#8B5CF6" },
    ],
  },
  {
    key: "tools", label: "Tools", title: "Smart Tools", blurb: "Plan, predict and fix your weak spots.", icon: Sparkles,
    items: [
      { to: "/todo", label: "To-Do & Targets", sub: "Plan and track your day", icon: ListChecks, tint: "#10B981" },
      { to: "/score-predictor", label: "Score Predictor", sub: "Where you stand today", icon: Gauge, tint: "#F97316" },
      { to: "/consult", label: "Dr. Azka Consult", sub: "Your personal analysis", icon: Sparkles, tint: "#14B8A6", match: ["/consult"] },
      { to: "/improve", label: "Improvement Zone", sub: "Saved · Mistakes · Analytics", icon: RotateCcw, tint: "#EF4444", match: ["/improve", "/mistakes", "/bookmarks", "/analytics"] },
      { to: "/ai-path", label: "Study Path", sub: "What to study next", icon: RouteIcon, tint: "#6366F1" },
      { to: "/neetlab", label: "NEETLab 3D", sub: "See concepts in 3D", icon: Atom, tint: "#0EA5E9" },
    ],
  },
];

/** Routes where the bar should not appear (full-screen exam screens). */
const HIDE_ON = ["/quiz/", "/battle/", "/login", "/signup", "/onboarding", "/target-700-test/"];

const isIn = (path: string, item: Item) => path === item.to || path.startsWith(item.to + "/") || (item.match ?? []).some((m) => path.startsWith(m));

/**
 * Rendered into <body> so it stays pinned to the screen. (Pages fade in with a
 * transform, which would otherwise pin "fixed" elements to the page instead.)
 */
export function BottomNav() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  useOverlayWatch();
  if (!mounted) return null;
  return createPortal(<BottomNavInner />, document.body);
}


/**
 * Marks <body> while anything should sit above the bar:
 *  - data-nt-overlay: a dialog / sheet / alert is open (Radix sets data-state="open" on role=dialog)
 *  - data-nt-kb: the on-screen keyboard is likely up (a text field is focused on a phone)
 * CSS in styles.css then slides the bar and the support button out of the way.
 */
function useOverlayWatch() {
  useEffect(() => {
    const body = document.body;
    const check = () => {
      const open = !!document.querySelector('[role="dialog"][data-state="open"],[role="alertdialog"][data-state="open"]');
      body.toggleAttribute("data-nt-overlay", open);
    };
    check();
    const mo = new MutationObserver(check);
    mo.observe(body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-state"] });

    const isField = (el: EventTarget | null) =>
      el instanceof HTMLElement && (el.isContentEditable || /^(TEXTAREA|SELECT)$/.test(el.tagName) ||
        (el.tagName === "INPUT" && !/^(checkbox|radio|button|submit|range|file|color|reset|image)$/i.test((el as HTMLInputElement).type)));
    const onIn = (e: FocusEvent) => { if (window.innerWidth < 1024 && isField(e.target)) body.setAttribute("data-nt-kb", ""); };
    const onOut = () => { setTimeout(() => { if (!isField(document.activeElement)) body.removeAttribute("data-nt-kb"); }, 60); };
    document.addEventListener("focusin", onIn);
    document.addEventListener("focusout", onOut);
    return () => {
      mo.disconnect();
      document.removeEventListener("focusin", onIn);
      document.removeEventListener("focusout", onOut);
      body.removeAttribute("data-nt-overlay");
      body.removeAttribute("data-nt-kb");
    };
  }, []);
}

function BottomNavInner() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState<Group["key"] | null>(null);
  useEffect(() => { setOpen(null); }, [path]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Slide away while scrolling down to read, come back on any scroll up (and near the top).
  const [away, setAway] = useState(false);
  useEffect(() => {
    let last = window.scrollY, ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY, d = y - last;
        if (y < 80) setAway(false);
        else if (d > 8) setAway(true);
        else if (d < -8) setAway(false);
        if (Math.abs(d) > 8) last = y;
        ticking = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => { setAway(false); }, [path]);

  if (HIDE_ON.some((p) => path.startsWith(p))) return null;

  const activeGroup = GROUPS.find((g) => g.items.some((i) => isIn(path, i)))?.key ?? null;
  const homeActive = path === "/" || path === "/dashboard";
  const mentorActive = path.startsWith("/mentorship");
  const group = GROUPS.find((g) => g.key === open) ?? null;
  const groupIdx = (k: Group["key"] | null) => (k ? GROUPS.findIndex((g) => g.key === k) + 1 : -1);
  const activeIdx = open ? groupIdx(open) : homeActive ? 0 : activeGroup ? groupIdx(activeGroup) : mentorActive ? 4 : -1;

  return (
    <>
      <style>{BN_CSS}</style>

      {/* Panel */}
      <div className={cn("bn-scrim lg:hidden", group && "on")} onClick={() => setOpen(null)} aria-hidden="true" />
      <div className={cn("bn-sheet lg:hidden", group && "on")} role="dialog" aria-modal="true" aria-label={group?.title} aria-hidden={!group}>
        {group && (
          <>
            <div className="bn-grab" />
            <div className="flex items-start justify-between gap-3 px-5 pt-1">
              <div>
                <div className="text-lg font-bold leading-tight">{group.title}</div>
                <div className="mt-0.5 text-[13px] text-muted-foreground">{group.blurb}</div>
              </div>
              <button type="button" onClick={() => setOpen(null)} aria-label="Close" className="rounded-full bg-secondary p-2 text-muted-foreground"><X className="h-4 w-4" /></button>
            </div>
            <div className={cn("grid gap-2.5 px-4 pb-4 pt-4", group.items.length <= 2 ? "grid-cols-2" : "grid-cols-2")}>
              {group.items.map((it, i) => {
                const on = isIn(path, it);
                return (
                  <Link key={it.to} to={it.to as never} className={cn("bn-tile", on && "on")} style={{ ["--t" as string]: it.tint, animationDelay: `${i * 35}ms` }}>
                    <span className="bn-ico"><it.icon className="h-5 w-5" /></span>
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5 text-[13.5px] font-semibold leading-tight">{it.label}{it.badge && <em className="bn-badge">{it.badge}</em>}</span>
                      <span className="mt-0.5 block text-[11.5px] leading-snug text-muted-foreground">{it.sub}</span>
                    </span>
                  </Link>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Bar */}
      <nav className={cn("bn lg:hidden", away && !open && "away")} aria-label="Main">
        <span className="bn-ind" aria-hidden="true" style={{ transform: `translateX(${Math.max(activeIdx, 0) * 100}%)`, opacity: activeIdx < 0 ? 0 : 1 }} />
        <Link to="/dashboard" className={cn("bn-btn", homeActive && !open && "on")} aria-current={homeActive ? "page" : undefined}>
          <span className="bn-pill"><Home className="h-[21px] w-[21px]" /></span><span className="bn-lbl">Home</span>
        </Link>
        {GROUPS.map((g) => {
          const on = open ? open === g.key : activeGroup === g.key;
          return (
            <button key={g.key} type="button" className={cn("bn-btn", on && "on")} aria-expanded={open === g.key} onClick={() => setOpen(open === g.key ? null : g.key)}>
              <span className="bn-pill"><g.icon className="h-[21px] w-[21px]" /></span><span className="bn-lbl">{g.label}</span>
            </button>
          );
        })}
        <Link to="/mentorship" className={cn("bn-btn", mentorActive && !open && "on")}>
          <span className="bn-pill"><GraduationCap className="h-[21px] w-[21px]" /></span><span className="bn-lbl">Mentor</span>
        </Link>
      </nav>
    </>
  );
}

const BN_CSS = `
.bn{position:fixed;left:10px;right:10px;bottom:calc(10px + env(safe-area-inset-bottom));z-index:45;display:grid;grid-template-columns:repeat(5,1fr);
  height:64px;padding:0 4px;border-radius:22px;background:color-mix(in oklab,var(--card,#fff) 80%,transparent);
  -webkit-backdrop-filter:saturate(1.7) blur(20px);backdrop-filter:saturate(1.7) blur(20px);
  border:1px solid color-mix(in oklab,var(--border,#e5e7eb) 85%,transparent);
  box-shadow:0 18px 40px -18px rgba(2,6,23,.6),0 2px 8px -2px rgba(2,6,23,.14),inset 0 1px 0 rgba(255,255,255,.06);
  transition:transform .38s cubic-bezier(.2,.9,.25,1),opacity .25s ease;will-change:transform}
.bn.away{transform:translateY(calc(100% + 28px));opacity:0;pointer-events:none}
.bn-ind{position:absolute;top:6px;bottom:6px;left:4px;width:calc((100% - 8px) / 5);border-radius:17px;pointer-events:none;z-index:0;
  background:linear-gradient(180deg,color-mix(in oklab,var(--primary,#2563eb) 20%,transparent),color-mix(in oklab,var(--primary,#2563eb) 8%,transparent));
  box-shadow:inset 0 0 0 1px color-mix(in oklab,var(--primary,#2563eb) 22%,transparent);
  transition:transform .45s cubic-bezier(.34,1.36,.5,1),opacity .2s}
.bn-ind::before{content:"";position:absolute;top:-1px;left:50%;width:22px;height:3px;margin-left:-11px;border-radius:0 0 4px 4px;
  background:var(--primary,#2563eb);box-shadow:0 0 12px var(--primary,#2563eb)}
.bn-btn{position:relative;z-index:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;color:var(--muted-foreground,#64748b);
  -webkit-tap-highlight-color:transparent;transition:color .25s;outline:none}
.bn-btn:focus-visible .bn-pill{box-shadow:0 0 0 2px var(--ring,#2563eb)}
.bn-pill{display:grid;place-items:center;width:44px;height:26px;border-radius:999px;transition:transform .3s cubic-bezier(.2,.8,.2,1)}
.bn-lbl{font-size:10.5px;font-weight:600;letter-spacing:.01em;line-height:1;transition:font-weight .2s,letter-spacing .2s}
.bn-btn:active .bn-pill{transform:scale(.86)}
.bn-btn.on{color:var(--primary,#2563eb)}
.bn-btn.on .bn-pill{transform:translateY(-1px)}
.bn-btn.on .bn-pill svg{animation:bn-pop .5s cubic-bezier(.3,1.5,.5,1)}
.bn-btn.on .bn-lbl{font-weight:800}
@keyframes bn-pop{0%{transform:scale(.8)}55%{transform:scale(1.18) translateY(-2px)}100%{transform:none}}
.bn-scrim{position:fixed;inset:0;z-index:43;background:rgba(2,6,23,.45);-webkit-backdrop-filter:blur(2px);backdrop-filter:blur(2px);opacity:0;pointer-events:none;transition:opacity .25s}
.bn-scrim.on{opacity:1;pointer-events:auto}
.bn-sheet{position:fixed;left:8px;right:8px;bottom:calc(84px + env(safe-area-inset-bottom));z-index:44;max-height:min(70vh,calc(100dvh - 170px));overflow-y:auto;overscroll-behavior:contain;border-radius:24px;
  background:var(--card,#fff);border:1px solid var(--border,#e5e7eb);box-shadow:0 30px 60px -20px rgba(2,6,23,.5);
  transform:translateY(16px) scale(.98);opacity:0;pointer-events:none;transition:transform .3s cubic-bezier(.2,.9,.2,1),opacity .2s}
.bn-sheet.on{transform:none;opacity:1;pointer-events:auto}
.bn-grab{width:40px;height:4px;border-radius:99px;background:var(--border,#e5e7eb);margin:10px auto 8px}
.bn-tile{position:relative;display:flex;align-items:center;gap:10px;padding:12px;border-radius:16px;border:1px solid var(--border,#e5e7eb);
  background:linear-gradient(135deg,color-mix(in oklab,var(--t) 9%,transparent),transparent 70%);animation:bn-up .3s cubic-bezier(.2,.9,.2,1) both;transition:transform .15s}
.bn-tile:active{transform:scale(.97)}
.bn-tile.on{border-color:color-mix(in oklab,var(--t) 60%,transparent);box-shadow:0 0 0 3px color-mix(in oklab,var(--t) 15%,transparent)}
.bn-ico{flex:none;display:grid;place-items:center;width:38px;height:38px;border-radius:12px;color:#fff;background:linear-gradient(135deg,var(--t),color-mix(in oklab,var(--t) 65%,#000));box-shadow:0 8px 16px -8px var(--t)}
.bn-badge{position:absolute;top:7px;right:7px;font-style:normal;font-size:8px;font-weight:800;letter-spacing:.06em;padding:2px 5px;border-radius:6px;color:#fff;background:var(--t)}
@keyframes bn-up{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.bn,.bn-ind,.bn-sheet,.bn-tile,.bn-pill{transition:none;animation:none}.bn-btn.on .bn-pill svg{animation:none}}
`;

