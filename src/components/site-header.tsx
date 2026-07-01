import { Link, useRouterState } from "@tanstack/react-router";
import { Menu, X, LogOut, Sun, Moon, ChevronDown, User } from "lucide-react";
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
      className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
    >
      {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
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
      { to: "/daily", label: "Daily DPP" },
      { to: "/dpp", label: "Sub-wise Quiz" },
    ],
  },
  {
    label: "Study Tools",
    items: [
      { to: "/flashcards", label: "Flashcards" },
      { to: "/ncert-highlights", label: "NCERT Highlights" },
      { to: "/mocks", label: "Mock Tests" },
      { to: "/dpp", label: "All DPPs" },
      { to: "/bookmarks", label: "Bookmarks" },
    ],
  },
  {
    label: "AI Tools",
    items: [
      { to: "/generate", label: "Generate Test" },
      { to: "/ai-path", label: "AI Path" },
      { to: "/score-predictor", label: "Score Predictor" },
    ],
  },
  {
    label: "Earn",
    items: [
      { to: "/contests", label: "Contests" },
      { to: "/battlegrounds", label: "Battlegrounds" },
      { to: "/contests", label: "Tournaments (Soon)" },
    ],
  },
  {
    label: "Wallet",
    items: [
      { to: "/wallet", label: "Wallet" },
      { to: "/premium", label: "Batches" },
    ],
  },
  { label: "Refer & Earn", to: "/referrals" },
  { label: "Leaderboard", to: "/leaderboard" },
  { label: "Privacy", to: "/privacy" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { user, profile, isAdmin, signOut } = useAuth();
  const displayName = (profile?.full_name?.trim() || (user?.email ? user.email.split("@")[0] : "")) ?? "";
  const avatar = user ? avatarUrl(displayName || user.id, profile?.avatar_url ?? null) : null;

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to="/dashboard" className="flex items-center gap-2">
          <img src="/icons/icon-192.png" alt="NEETIQ Prime" className="h-9 w-9 rounded-xl shadow-glow" />
          <div className="leading-none">
            <div className="text-base font-bold tracking-tight">NEETIQ <span className="text-gradient-primary">Prime</span></div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Crack NEET, Smarter</div>
          </div>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          {GROUPS.map((g) => {
            if (g.to) {
              const active = path.startsWith(g.to);
              return (
                <Link
                  key={g.label}
                  to={g.to}
                  className={cn(
                    "rounded-full px-3 py-2 text-sm font-medium transition-colors",
                    active ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
                  )}
                >
                  {g.label}
                </Link>
              );
            }
            return (
              <DropdownMenu key={g.label}>
                <DropdownMenuTrigger className="inline-flex items-center gap-0.5 rounded-full px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground focus:outline-none">
                  {g.label} <ChevronDown className="h-3.5 w-3.5" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="min-w-44">
                  <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">{g.label}</DropdownMenuLabel>
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

        <div className="flex items-center gap-1 md:gap-2">
          <ThemeToggle />
          {user && <NotificationBell />}
          <div className="hidden items-center gap-2 lg:flex">
            {user ? (
              <>
                {isAdmin && <Button asChild size="sm" variant="outline"><Link to="/admin">Admin</Link></Button>}
                {isAdmin && <Button asChild size="sm" variant="outline"><Link to="/admin/inbox">Inbox</Link></Button>}
                <Link
                  to="/profile"
                  className="flex items-center gap-2 rounded-full border border-border bg-secondary/60 py-1 pl-1 pr-3 transition-colors hover:bg-secondary"
                  title={displayName || "Profile"}
                >
                  {avatar ? (
                    <img src={avatar} alt={displayName || "Profile"} className="h-7 w-7 rounded-full object-cover" />
                  ) : (
                    <User className="h-5 w-5" />
                  )}
                  <span className="max-w-[8rem] truncate text-sm font-semibold">{displayName || "Profile"}</span>
                </Link>
                <Button size="sm" variant="outline" onClick={() => signOut()} className="gap-1"><LogOut className="h-4 w-4" /> Log out</Button>
              </>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm"><Link to="/login">Log in</Link></Button>
                <Button asChild size="sm" className="bg-gradient-primary shadow-elegant hover:opacity-95"><Link to="/login">Get started</Link></Button>
              </>
            )}
          </div>
          <button
            aria-label="Toggle menu"
            onClick={() => setOpen((v) => !v)}
            className="lg:hidden inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="lg:hidden border-t border-border bg-background animate-fade-in-up">
          <div className="mx-auto max-w-7xl px-4 py-3 flex flex-col gap-2 max-h-[70vh] overflow-y-auto">
            {user && (
              <Link
                to="/profile"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 rounded-xl border border-border bg-card p-3"
              >
                {avatar ? (
                  <img src={avatar} alt={displayName || "Profile"} className="h-10 w-10 rounded-full object-cover" />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary"><User className="h-5 w-5" /></div>
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
                  className="rounded-lg px-3 py-2.5 text-sm font-semibold hover:bg-secondary"
                >
                  {g.label}
                </Link>
              ) : (
                <div key={g.label} className="rounded-lg border border-border bg-card/50 p-2">
                  <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{g.label}</div>
                  <div className="mt-1 grid gap-0.5">
                    {g.items!.map((i) => (
                      <Link
                        key={i.label}
                        to={i.to}
                        onClick={() => setOpen(false)}
                        className="rounded-md px-3 py-2 text-sm font-medium hover:bg-secondary"
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
                    <Button asChild variant="outline" className="flex-1">
                      <Link to="/admin" onClick={() => setOpen(false)}>Admin</Link>
                    </Button>
                  )}
                  {isAdmin && (
                    <Button asChild variant="outline" className="flex-1">
                      <Link to="/admin/inbox" onClick={() => setOpen(false)}>Inbox</Link>
                    </Button>
                  )}
                  <Button asChild variant="ghost" className="flex-1">
                    <Link to="/profile" onClick={() => setOpen(false)}>Profile</Link>
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 gap-1"
                    onClick={() => { setOpen(false); signOut(); }}
                  >
                    <LogOut className="h-4 w-4" /> Log out
                  </Button>
                </>
              ) : (
                <>
                  <Button asChild variant="outline" className="flex-1">
                    <Link to="/login" onClick={() => setOpen(false)}>Log in</Link>
                  </Button>
                  <Button asChild className="flex-1 bg-gradient-primary">
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
