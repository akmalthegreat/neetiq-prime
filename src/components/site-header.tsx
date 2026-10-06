import { Link, useRouterState } from "@tanstack/react-router";
import { Menu, X, LogOut, Sun, Moon, ChevronDown, User, Search } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";
import { NotificationBell } from "@/components/notification-bell";
import { avatarUrl } from "@/lib/avatar";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

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

type Item = { to: string; label: string };
type Group = { label: string; to?: string; items?: Item[] };

const GROUPS: Group[] = [
  { label: "Dashboard", to: "/dashboard" },
  {
    label: "Quick Practice",
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
    items: [
      { to: "/generate", label: "Custom Test" },
      { to: "/ai-path", label: "AI Path" },
      { to: "/score-predictor", label: "Score Predictor" },
    ],
  },
  {
    label: "Earn & Compete",
    items: [
      { to: "/contests", label: "Cash Contests" },
      { to: "/battlegrounds", label: "Battlegrounds (1v1)" },
    ],
  },
  { label: "Refer & Earn", to: "/referrals" },
  { label: "Leaderboard", to: "/leaderboard" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { user, profile, isAdmin, signOut } = useAuth();
  const displayName = (profile?.full_name?.trim() || (user?.email ? user.email.split("@")[0] : "")) ?? "";
  const avatar = user ? avatarUrl(displayName || user.id, profile?.avatar_url ?? null) : null;

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-3.5 sm:px-6 lg:px-8">
        {/* Brand Logo & Name matching screenshot */}
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

        {/* Desktop Navigation */}
        <nav className="hidden items-center gap-1 lg:flex">
          {GROUPS.map((g) => {
            if (g.to) {
              const active = path.startsWith(g.to);
              return (
                <Link
                  key={g.label}
                  to={g.to}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                    active
                      ? "bg-secondary text-foreground"
                      : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
                  )}
                >
                  {g.label}
                </Link>
              );
            }
            return (
              <DropdownMenu key={g.label}>
                <DropdownMenuTrigger className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground focus:outline-none">
                  {g.label} <ChevronDown className="h-3.5 w-3.5" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="min-w-44">
                  <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    {g.label}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {g.items!.map((i) => (
                    <DropdownMenuItem key={i.label} asChild>
                      <Link to={i.to}>{i.label}</Link>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            );
          })}
        </nav>

        {/* Right Action Icons matching screenshot */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Quick Search Button */}
          <Link
            to="/dpp"
            aria-label="Search questions"
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border/80 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <Search className="h-4 w-4" />
          </Link>

          <ThemeToggle />

          {user && <NotificationBell />}

          {/* Desktop User Profile / Auth */}
          <div className="hidden items-center gap-2 lg:flex">
            {user ? (
              <>
                {isAdmin && (
                  <Button asChild size="sm" variant="outline" className="h-8 rounded-xl text-xs">
                    <Link to="/admin">Admin</Link>
                  </Button>
                )}
                <Link
                  to="/profile"
                  className="flex items-center gap-2 rounded-full border border-border bg-secondary/60 py-1 pl-1 pr-3 transition-colors hover:bg-secondary"
                  title={displayName || "Profile"}
                >
                  {avatar ? (
                    <img src={avatar} alt={displayName || "Profile"} className="h-7 w-7 rounded-full object-cover" />
                  ) : (
                    <User className="h-4 w-4" />
                  )}
                  <span className="max-w-[7rem] truncate text-xs font-semibold">{displayName || "Profile"}</span>
                </Link>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => signOut()}
                  className="h-8 rounded-xl px-2 text-xs text-muted-foreground hover:text-foreground"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm" className="h-8 text-xs">
                  <Link to="/login">Log in</Link>
                </Button>
                <Button asChild size="sm" className="h-8 rounded-xl bg-primary text-xs font-bold text-primary-foreground">
                  <Link to="/login">Get started</Link>
                </Button>
              </>
            )}
          </div>

          {/* Mobile Menu Hamburger */}
          <button
            aria-label="Toggle menu"
            onClick={() => setOpen((v) => !v)}
            className="lg:hidden inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border/80 text-muted-foreground"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {open && (
        <div className="lg:hidden border-t border-border bg-background/95 backdrop-blur-xl animate-fade-in-up">
          <div className="mx-auto max-w-7xl px-4 py-3 flex flex-col gap-2 max-h-[75vh] overflow-y-auto">
            {user && (
              <Link
                to="/profile"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-xs"
              >
                {avatar ? (
                  <img src={avatar} alt={displayName || "Profile"} className="h-10 w-10 rounded-full object-cover" />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary">
                    <User className="h-5 w-5" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold">{displayName || "Your profile"}</div>
                  <div className="truncate text-xs text-muted-foreground">{user.email}</div>
                </div>
              </Link>
            )}

            {GROUPS.map((g) =>
              g.to ? (
                <Link
                  key={g.label}
                  to={g.to}
                  onClick={() => setOpen(false)}
                  className="rounded-xl px-3 py-2 text-sm font-semibold hover:bg-secondary"
                >
                  {g.label}
                </Link>
              ) : (
                <div key={g.label} className="rounded-xl border border-border/70 bg-card/60 p-2.5">
                  <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    {g.label}
                  </div>
                  <div className="mt-1 grid grid-cols-2 gap-1">
                    {g.items!.map((i) => (
                      <Link
                        key={i.label}
                        to={i.to}
                        onClick={() => setOpen(false)}
                        className="rounded-lg px-2.5 py-1.5 text-xs font-medium hover:bg-secondary truncate"
                      >
                        {i.label}
                      </Link>
                    ))}
                  </div>
                </div>
              ),
            )}

            <div className="mt-2 flex gap-2">
              {user ? (
                <>
                  {isAdmin && (
                    <Button asChild variant="outline" className="flex-1 rounded-xl text-xs">
                      <Link to="/admin" onClick={() => setOpen(false)}>Admin</Link>
                    </Button>
                  )}
                  <Button asChild variant="outline" className="flex-1 rounded-xl text-xs">
                    <Link to="/profile" onClick={() => setOpen(false)}>Profile</Link>
                  </Button>
                  <Button
                    variant="ghost"
                    className="flex-1 rounded-xl text-xs gap-1"
                    onClick={() => { setOpen(false); signOut(); }}
                  >
                    <LogOut className="h-3.5 w-3.5" /> Log out
                  </Button>
                </>
              ) : (
                <>
                  <Button asChild variant="outline" className="flex-1 rounded-xl text-xs">
                    <Link to="/login" onClick={() => setOpen(false)}>Log in</Link>
                  </Button>
                  <Button asChild className="flex-1 rounded-xl bg-primary text-xs font-bold text-primary-foreground">
                    <Link to="/login" onClick={() => setOpen(false)}>Get started</Link>
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
