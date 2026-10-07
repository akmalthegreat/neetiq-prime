import { Link, useRouterState } from "@tanstack/react-router";
import {
  Menu, X, LogOut, Sun, Moon, User, Search, LayoutDashboard, Zap, Trophy, Crown, ArrowRight, ChevronRight,
  LayoutList, History, Timer, SlidersHorizontal, Infinity as InfinityIcon, NotebookPen, Highlighter, Layers, Atom,
  RotateCcw, Bookmark, Route as RouteIcon, Gauge, Swords, Gift, Handshake,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";
import { NotificationBell } from "@/components/notification-bell";
import { avatarUrl } from "@/lib/avatar";

function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <button
      aria-label="Toggle dark mode"
      onClick={toggle}
      className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border/80 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
    >
      {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}

type Tone = "sky" | "emerald" | "amber" | "pink" | "violet";
type Item = { to: string; label: string; icon: React.ComponentType<{ className?: string }>; match?: string[] };
type Section = { label: string; tone: Tone; items: Item[] };

const SECTIONS: Section[] = [
  {
    label: "Practice",
    tone: "sky",
    items: [
      { to: "/daily", label: "Daily DPP", icon: Zap },
      { to: "/dpp", label: "Subject DPPs", icon: LayoutList, match: ["/subjects/"] },
      { to: "/pyqs", label: "PYQs", icon: History },
      { to: "/mocks", label: "Mock Tests", icon: Timer },
      { to: "/generate", label: "Custom Test", icon: SlidersHorizontal },
      { to: "/infinite-run", label: "Infinite Run", icon: InfinityIcon },
    ],
  },
  {
    label: "Study",
    tone: "emerald",
    items: [
      { to: "/short-notes", label: "Short Notes", icon: NotebookPen, match: ["/notes/"] },
      { to: "/highlighted-ncert", label: "NCERT Highlights", icon: Highlighter },
      { to: "/flashcards", label: "Flashcards", icon: Layers },
      { to: "/neetlab", label: "NEETLab 3D", icon: Atom },
    ],
  },
  {
    label: "Improve",
    tone: "amber",
    items: [
      { to: "/mistakes", label: "My Mistakes", icon: RotateCcw },
      { to: "/bookmarks", label: "Bookmarks", icon: Bookmark },
      { to: "/ai-path", label: "Study Path", icon: RouteIcon },
      { to: "/score-predictor", label: "Score Predictor", icon: Gauge },
    ],
  },
  {
    label: "Compete",
    tone: "pink",
    items: [
      { to: "/contests", label: "Contests", icon: Trophy, match: ["/contest/"] },
      { to: "/battlegrounds", label: "1v1 Battles", icon: Swords, match: ["/battle/"] },
      { to: "/leaderboard", label: "Leaderboard", icon: Crown },
      { to: "/referrals", label: "Refer & Earn", icon: Gift },
    ],
  },
  {
    label: "Work with us",
    tone: "violet",
    items: [{ to: "/collaborators", label: "Collaborate with NEET Track", icon: Handshake }],
  },
];

const TONE: Record<Tone, string> = {
  sky: "bg-sky-500/12 text-sky-600 dark:bg-sky-400/12 dark:text-sky-300",
  emerald: "bg-emerald-500/12 text-emerald-600 dark:bg-emerald-400/12 dark:text-emerald-300",
  amber: "bg-amber-500/12 text-amber-600 dark:bg-amber-400/12 dark:text-amber-300",
  pink: "bg-pink-500/12 text-pink-600 dark:bg-pink-400/12 dark:text-pink-300",
  violet: "bg-violet-500/12 text-violet-600 dark:bg-violet-400/12 dark:text-violet-300",
};

const isActive = (path: string, i: Item) =>
  path === i.to || path.startsWith(i.to + "/") || !!i.match?.some((m) => path.startsWith(m));

/** Gold card that opens the personal mentorship page. */
function MentorshipCard({ onNavigate, compact }: { onNavigate?: () => void; compact?: boolean }) {
  return (
    <Link
      to="/mentorship"
      onClick={onNavigate}
      className={cn(
        "group relative block overflow-hidden rounded-2xl border border-amber-500/45 bg-gradient-to-br from-amber-100 via-amber-50 to-background dark:from-[#2A1E06] dark:via-[#16120A] dark:to-card",
        compact ? "p-3.5" : "p-[18px]",
      )}
    >
      <span className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-amber-400/20 blur-2xl" aria-hidden="true" />
      <span className="relative block text-[11px] font-bold uppercase tracking-[0.16em] text-amber-700 dark:text-amber-400">Personal mentorship</span>
      <span className={cn("relative mt-1.5 block font-bold text-foreground", compact ? "text-[15px]" : "text-lg")}>1-on-1 with Akmal, MBBS</span>
      {!compact && (
        <span className="relative mt-1 block text-sm leading-snug text-muted-foreground">
          Your own study plan, daily doubt support and progress reviews.
        </span>
      )}
      <span className={cn(
        "relative inline-flex items-center gap-1 font-bold",
        compact ? "mt-1.5 text-xs text-amber-700 dark:text-amber-400" : "mt-3.5 rounded-xl bg-amber-400 px-4 py-2 text-sm text-amber-950",
      )}>
        Know more <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}

function DashboardLink({ path, onNavigate, big }: { path: string; onNavigate?: () => void; big?: boolean }) {
  const active = path.startsWith("/dashboard");
  return (
    <Link
      to="/dashboard"
      onClick={onNavigate}
      className={cn(
        "flex items-center gap-3 rounded-2xl border font-bold transition-colors",
        big ? "px-4 py-3.5 text-base" : "px-3 py-2.5 text-[15px]",
        active
          ? "border-emerald-500/40 bg-gradient-to-r from-emerald-500/15 to-emerald-500/[0.03]"
          : "border-border bg-card hover:border-emerald-500/40",
      )}
    >
      <span className={cn("flex h-8 w-8 items-center justify-center rounded-[10px]", TONE.emerald)}>
        <LayoutDashboard className="h-[18px] w-[18px]" />
      </span>
      Dashboard
    </Link>
  );
}

/** Phone menu: sections of two-column tiles. */
function MobileNav({ path, onNavigate }: { path: string; onNavigate: () => void }) {
  return (
    <nav aria-label="Main">
      {SECTIONS.map((s) => (
        <div key={s.label}>
          <h4 className="mx-1 mb-2.5 mt-6 text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">{s.label}</h4>
          <div className={cn("grid gap-2", s.items.length > 1 ? "grid-cols-2" : "grid-cols-1")}>
            {s.items.map((i) => {
              const active = isActive(path, i);
              return (
                <Link
                  key={i.to}
                  to={i.to}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-[54px] items-center gap-2.5 rounded-[14px] border px-3 py-2.5 text-[15px] font-semibold leading-tight transition-colors",
                    active ? "border-primary/50 bg-primary/10" : "border-border bg-card active:bg-secondary",
                  )}
                >
                  <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px]", TONE[s.tone])}>
                    <i.icon className="h-[17px] w-[17px]" />
                  </span>
                  {i.label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

/** Desktop sidebar: same sections as a list. */
function SidebarNav({ path }: { path: string }) {
  return (
    <nav aria-label="Main">
      {SECTIONS.map((s) => (
        <div key={s.label} className="mt-5">
          <div className="px-3 pb-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground/80">{s.label}</div>
          <div className="flex flex-col gap-0.5">
            {s.items.map((i) => {
              const active = isActive(path, i);
              return (
                <Link
                  key={i.to}
                  to={i.to}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-sm font-medium transition-colors",
                    active ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
                  )}
                >
                  <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg", TONE[s.tone])}>
                    <i.icon className="h-4 w-4" />
                  </span>
                  <span className="truncate">{s.label === "Work with us" ? "Collaborate" : i.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  // While the mobile menu is open, freeze the page behind it; close it when the route changes.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);
  const path = useRouterState({ select: (s) => s.location.pathname });
  useEffect(() => { setOpen(false); }, [path]);
  const { user, profile, isAdmin, signOut } = useAuth();
  const displayName = (profile?.full_name?.trim() || (user?.email ? user.email.split("@")[0] : "")) ?? "";
  const avatar = user ? avatarUrl(displayName || user.id, profile?.avatar_url ?? null) : null;

  return (
    <>
      {/* Desktop Left Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-border/60 bg-background/80 backdrop-blur-xl lg:flex">
        <div className="flex items-center gap-2.5 px-4 py-5">
          <Link to="/dashboard" className="flex items-center gap-2.5">
            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-sky-400/40 bg-[#060b18] p-0.5 shadow-md shadow-sky-500/10">
              <img src="/logo.jpg" alt="NEET Track" className="h-full w-full rounded-full object-cover" />
            </div>
            <div className="leading-tight">
              <div className="text-[17px] font-black tracking-tight text-foreground">
                NEET <span className="bg-gradient-to-r from-sky-400 via-teal-400 to-emerald-400 bg-clip-text text-transparent font-black">Track</span>
              </div>
              <div className="text-[10px] font-medium tracking-wider text-muted-foreground">
                Learn <span className="opacity-40">•</span> Practice <span className="opacity-40">•</span> Achieve
              </div>
            </div>
          </Link>
        </div>

        <div className="flex-1 overflow-y-auto px-3 pb-4">
          <DashboardLink path={path} />
          <div className="mt-3"><MentorshipCard compact /></div>
          <SidebarNav path={path} />
        </div>

        {/* Sidebar bottom actions */}
        <div className="border-t border-border/60 px-3 py-3">
          <div className="flex items-center gap-1.5">
            <Link
              to="/dpp"
              aria-label="Search questions"
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border/80 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <Search className="h-4 w-4" />
            </Link>
            <ThemeToggle />
            {user && <NotificationBell />}
            {isAdmin && (
              <Button asChild size="sm" variant="outline" className="h-8 rounded-xl text-xs">
                <Link to="/admin">Admin</Link>
              </Button>
            )}
          </div>

          {user ? (
            <div className="mt-3 flex items-center gap-2">
              <Link
                to="/profile"
                className="flex min-w-0 flex-1 items-center gap-2 rounded-full border border-border bg-secondary/60 py-1 pl-1 pr-3 transition-colors hover:bg-secondary"
                title={displayName || "Profile"}
              >
                {avatar ? (
                  <img src={avatar} alt={displayName || "Profile"} className="h-7 w-7 rounded-full object-cover" />
                ) : (
                  <User className="h-4 w-4" />
                )}
                <span className="min-w-0 truncate text-xs font-semibold">{displayName || "Profile"}</span>
              </Link>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => signOut()}
                className="h-8 shrink-0 rounded-xl px-2 text-xs text-muted-foreground hover:text-foreground"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="mt-3 flex items-center gap-2">
              <Button asChild variant="ghost" size="sm" className="h-8 flex-1 text-xs">
                <Link to="/login">Log in</Link>
              </Button>
              <Button asChild size="sm" className="h-8 flex-1 rounded-xl bg-primary text-xs font-bold text-primary-foreground">
                <Link to="/login">Get started</Link>
              </Button>
            </div>
          )}
        </div>
      </aside>

      {/* Mobile Top Bar */}
      <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/80 backdrop-blur-xl lg:hidden">
        <div className="flex h-16 items-center justify-between px-3.5 sm:px-6">
          <Link to="/dashboard" className="flex items-center gap-2.5">
            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-sky-400/40 bg-[#060b18] p-0.5 shadow-md shadow-sky-500/10">
              <img src="/logo.jpg" alt="NEET Track" className="h-full w-full rounded-full object-cover" />
            </div>
            <div className="leading-tight">
              <div className="text-[17px] font-black tracking-tight text-foreground">
                NEET <span className="bg-gradient-to-r from-sky-400 via-teal-400 to-emerald-400 bg-clip-text text-transparent font-black">Track</span>
              </div>
              <div className="text-[10px] font-medium tracking-wider text-muted-foreground">
                Learn <span className="opacity-40">•</span> Practice <span className="opacity-40">•</span> Achieve
              </div>
            </div>
          </Link>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <ThemeToggle />
            {user && <NotificationBell />}
            {isAdmin && (
              <Button asChild size="sm" variant="outline" className="h-8 rounded-xl border-amber-500/40 bg-amber-500/10 px-2 text-xs font-bold text-amber-600 hover:bg-amber-500/20 dark:text-amber-400">
                <Link to="/admin">Admin</Link>
              </Button>
            )}
            <button
              aria-label="Toggle menu"
              onClick={() => setOpen((v) => !v)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border/80 text-muted-foreground"
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Drawer */}
        {open && (
          <div className="absolute inset-x-0 top-full h-[calc(100dvh-4rem)] border-t border-border bg-background animate-fade-in-up">
            <div className="h-full overflow-y-auto overscroll-contain px-4 pt-3 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
              {user && (
                <Link
                  to="/profile"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 rounded-[20px] border border-border bg-card p-3.5"
                >
                  {avatar ? (
                    <img src={avatar} alt="" className="h-12 w-12 rounded-full border-2 border-primary/40 object-cover" />
                  ) : (
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary"><User className="h-5 w-5" /></span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[17px] font-bold">{displayName || "Your profile"}</span>
                    <span className="block text-[13px] text-muted-foreground">View profile · Settings</span>
                  </span>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </Link>
              )}
              {isAdmin && (
                <Link
                  to="/admin"
                  onClick={() => setOpen(false)}
                  className="mt-2.5 flex items-center gap-2 rounded-[14px] border border-amber-500/40 px-3.5 py-2.5 text-sm font-semibold text-amber-700 dark:text-amber-400"
                >
                  <span className="h-2 w-2 rounded-full bg-amber-500" />
                  Admin Control Panel
                  <span className="ml-auto text-xs opacity-80">Open →</span>
                </Link>
              )}
              <div className="mt-3.5"><MentorshipCard onNavigate={() => setOpen(false)} /></div>
              <div className="mt-3.5"><DashboardLink path={path} big onNavigate={() => setOpen(false)} /></div>
              <MobileNav path={path} onNavigate={() => setOpen(false)} />
              {user ? (
                <Button
                  variant="ghost"
                  onClick={() => signOut()}
                  className="mt-6 h-11 w-full rounded-xl text-[15px] text-muted-foreground hover:text-foreground"
                >
                  <LogOut className="h-4 w-4" /> Log out
                </Button>
              ) : (
                <Button asChild size="lg" className="mt-6 h-12 w-full rounded-xl bg-primary text-[15px] font-bold text-primary-foreground">
                  <Link to="/login" onClick={() => setOpen(false)}>Log in / Get started</Link>
                </Button>
              )}
            </div>
          </div>
        )}
      </header>
    </>
  );
}
