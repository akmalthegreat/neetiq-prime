import { Link, useRouterState } from "@tanstack/react-router";
import { Menu, X, LogOut, Sun, Moon, User, Search, LayoutDashboard, Zap, Wrench, Sparkles, Trophy, Users, Crown, GraduationCap } from "lucide-react";
import { useState } from "react";
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

type Item = { to: string; label: string; icon?: React.ComponentType<{ className?: string }> };
type Group = { label: string; to?: string; icon?: React.ComponentType<{ className?: string }>; items?: Item[] };

const GROUPS: Group[] = [
  { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
  {
    label: "Quick Practice",
    icon: Zap,
    items: [
      { to: "/daily", label: "DPP HUB" },
      { to: "/dpp", label: "ALL DPP" },
      { to: "/subjects/Physics", label: "Physics DPP" },
      { to: "/subjects/Chemistry", label: "Chemistry DPP" },
      { to: "/subjects/Zoology", label: "Zoology DPP" },
      { to: "/subjects/Botany", label: "Botany DPP" },
    ],
  },
  {
    label: "Study Tools",
    icon: Wrench,
    items: [
      { to: "/flashcards", label: "Flashcards" },
      { to: "/ncert-highlights", label: "NCERT Highlights" },
      { to: "/highlighted-ncert", label: "Highlighted NCERT" },
      { to: "/neetlab", label: "NEETLab 3D" },
      { to: "/mocks", label: "Mock Tests" },
      { to: "/bookmarks", label: "Bookmarks" },
      { to: "/mistakes", label: "My Mistakes" },
    ],
  },
  {
    label: "AI Tools",
    icon: Sparkles,
    items: [
      { to: "/generate", label: "Custom Test" },
      { to: "/ai-path", label: "AI Path" },
      { to: "/score-predictor", label: "Score Predictor" },
    ],
  },
  {
    label: "Earn & Compete",
    icon: Trophy,
    items: [
      { to: "/contests", label: "Cash Contests" },
      { to: "/battlegrounds", label: "Battlegrounds (1v1)" },
    ],
  },
  { label: "Refer & Earn", to: "/referrals", icon: Users },
  { label: "Leaderboard", to: "/leaderboard", icon: Crown },
];

function NavLinks({ path, onNavigate }: { path: string; onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-0.5">
      {GROUPS.map((g) => {
        if (g.to) {
          const active = (path || "").startsWith(g.to);
          const Icon = g.icon;
          return (
            <Link
              key={g.label}
              to={g.to}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-semibold transition-colors",
                active
                  ? "bg-gradient-to-r from-teal-500/15 to-emerald-500/15 text-foreground ring-1 ring-teal-500/30"
                  : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
              )}
            >
              {Icon && <Icon className={cn("h-4 w-4", active ? "text-teal-600 dark:text-teal-400" : "")} />}
              <span>{g.label}</span>
            </Link>
          );
        }
        return (
          <div key={g.label} className="mt-3">
            <div className="flex items-center gap-1.5 px-3 pb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground/70">
              {g.icon && <g.icon className="h-3 w-3" />}
              {g.label}
            </div>
            <div className="flex flex-col gap-0.5">
              {g.items!.map((i) => {
                const active = path === i.to || (i.to.startsWith("/subjects/") && path === i.to);
                return (
                  <Link
                    key={i.label}
                    to={i.to}
                    onClick={onNavigate}
                    className={cn(
                      "rounded-lg px-3 py-1.5 pl-8 text-xs font-medium transition-colors",
                      active
                        ? "bg-secondary text-foreground"
                        : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
                    )}
                  >
                    {i.label}
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}
    </nav>
  );
}

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const path = useRouterState({ select: (s) => s.location.pathname });
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
          <NavLinks path={path} />
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
          <div className="border-t border-border bg-background/95 backdrop-blur-xl animate-fade-in-up">
            <div className="max-h-[75vh] overflow-y-auto px-4 py-3">
              {user && (
                <Link
                  to="/profile"
                  onClick={() => setOpen(false)}
                  className="mb-3 flex items-center gap-2 rounded-full border border-border bg-secondary/60 py-1 pl-1 pr-3"
                >
                  {avatar ? (
                    <img src={avatar} alt={displayName || "Profile"} className="h-7 w-7 rounded-full object-cover" />
                  ) : (
                    <User className="h-4 w-4" />
                  )}
                  <span className="truncate text-xs font-semibold">{displayName || "Profile"}</span>
                </Link>
              )}
              {isAdmin && (
                <Link
                  to="/admin"
                  onClick={() => setOpen(false)}
                  className="mb-3 flex items-center justify-between rounded-xl border border-amber-500/40 bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-transparent px-3.5 py-2.5 text-xs font-bold text-amber-600 shadow-2xs hover:bg-amber-500/20 dark:text-amber-400"
                >
                  <span className="flex items-center gap-2">
                    <span className="flex h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                    Admin Control Panel
                  </span>
                  <span className="text-[10px] uppercase tracking-wider font-mono">Open →</span>
                </Link>
              )}
              <NavLinks path={path} onNavigate={() => setOpen(false)} />
              {user ? (
                <Button
                  variant="ghost"
                  onClick={() => signOut()}
                  className="mt-3 h-9 w-full rounded-xl text-xs text-muted-foreground hover:text-foreground"
                >
                  <LogOut className="h-4 w-4" /> Log out
                </Button>
              ) : (
                <Button asChild size="sm" className="mt-3 h-9 w-full rounded-xl bg-primary text-xs font-bold text-primary-foreground">
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
