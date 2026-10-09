// Admin navigation: tools grouped by job, a sidebar on large screens and a
// full-screen picker on phones. Plus the quick numbers shown on Overview.

import { useEffect, useState, type ComponentType } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  LayoutDashboard, Crown, UserSearch, Banknote, Wallet, Package, TicketPercent, Image as ImageIcon, Megaphone, Inbox, Sparkles,
  FilePlus2, ClipboardList, Bot, Trophy, ListChecks, Library, BookOpen, FileUp, Layers, Copy, Trash2, Brain, Highlighter,
  Swords, Star, Infinity as InfinityIcon, Settings, KeyRound, ChevronDown, Check, Search, Users, UserPlus, Activity, Timer,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { adminQuickStats } from "@/lib/admin-panel.functions";
import { cn } from "@/lib/utils";

export type AdminTool = { value: string; label: string; icon: ComponentType<{ className?: string }>; isNew?: boolean };
export type AdminGroup = { title: string; tools: AdminTool[] };

export const ADMIN_GROUPS: AdminGroup[] = [
  { title: "Home", tools: [{ value: "overview", label: "Overview", icon: LayoutDashboard }] },
  { title: "Members & money", tools: [
    { value: "premium", label: "Premium members", icon: Crown, isNew: true },
    { value: "journey", label: "Student journey", icon: Activity, isNew: true },
    { value: "userReport", label: "Find a student", icon: UserSearch },
    { value: "payments", label: "Withdrawals", icon: Banknote },
    { value: "topWallets", label: "Top wallets", icon: Wallet },
    { value: "batches", label: "Plans & batches", icon: Package },
    { value: "coupons", label: "Coupons", icon: TicketPercent },
  ] },
  { title: "Website", tools: [
    { value: "banners", label: "Home banners", icon: ImageIcon, isNew: true },
    { value: "announce", label: "Announcements", icon: Megaphone, isNew: true },
    { value: "reviews", label: "Student reviews", icon: Star, isNew: true },
  ] },
  { title: "Tests & quizzes", tools: [
    { value: "create", label: "Create test", icon: FilePlus2 },
    { value: "mock", label: "Mock tests", icon: ClipboardList },
    { value: "ai", label: "AI quizzes", icon: Bot },
    { value: "contestAi", label: "AI contest", icon: Trophy },
    { value: "list", label: "All tests", icon: ListChecks },
  ] },
  { title: "Question bank", tools: [
    { value: "questions", label: "Questions", icon: Library },
    { value: "chapters", label: "Chapters", icon: BookOpen },
    { value: "pyq", label: "PYQ import", icon: FileUp },
    { value: "bulk", label: "Chapter quiz import", icon: FileUp },
    { value: "bulkChapters", label: "Bulk chapters", icon: Layers },
    { value: "duplicates", label: "Duplicates", icon: Copy },
    { value: "bulkDelete", label: "Bulk delete", icon: Trash2 },
  ] },
  { title: "Study tools", tools: [
    { value: "flashcards", label: "Flashcards (AI)", icon: Brain },
    { value: "highlights", label: "NCERT highlights", icon: Highlighter },
  ] },
  { title: "Games", tools: [
    { value: "battleBots", label: "Battle bots", icon: Swords },
    { value: "infiniteRun", label: "Infinite Run", icon: InfinityIcon },
  ] },
  { title: "Settings", tools: [
    { value: "aiSettings", label: "AI settings", icon: Settings },
    { value: "aiKeys", label: "AI keys", icon: KeyRound },
  ] },
];

export const ALL_TOOLS = ADMIN_GROUPS.flatMap((g) => g.tools);

function ToolList({ current, onPick, filter = "" }: { current: string; onPick: (v: string) => void; filter?: string }) {
  const term = filter.trim().toLowerCase();
  return (
    <nav className="space-y-4">
      {ADMIN_GROUPS.map((g) => {
        const tools = g.tools.filter((t) => !term || t.label.toLowerCase().includes(term));
        if (!tools.length) return null;
        return (
          <div key={g.title}>
            <div className="mb-1 px-2 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{g.title}</div>
            <ul className="space-y-0.5">
              {tools.map((t) => (
                <li key={t.value}>
                  <button type="button" onClick={() => onPick(t.value)}
                    className={cn("flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm transition",
                      current === t.value ? "bg-primary/10 font-semibold text-primary" : "text-foreground/80 hover:bg-secondary")}>
                    <t.icon className="h-4 w-4 shrink-0" />
                    <span className="flex-1 truncate">{t.label}</span>
                    {t.isNew && <span className="rounded bg-emerald-500/15 px-1.5 py-px text-[9px] font-bold uppercase text-emerald-600 dark:text-emerald-400">New</span>}
                    {current === t.value && <Check className="h-3.5 w-3.5" />}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
      <div>
        <div className="mb-1 px-2 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Other pages</div>
        <Link to="/admin/inbox" className="flex items-center gap-2.5 rounded-lg px-2 py-2 text-sm text-foreground/80 hover:bg-secondary"><Inbox className="h-4 w-4" /> Inbox (support + feedback)</Link>
        <Link to="/admin-collaborators" className="flex items-center gap-2.5 rounded-lg px-2 py-2 text-sm text-foreground/80 hover:bg-secondary"><Sparkles className="h-4 w-4" /> Collaborators</Link>
      </div>
    </nav>
  );
}

/** Phone: a big button showing the current tool that opens the full grouped list. */
export function AdminMobilePicker({ current, onPick }: { current: string; onPick: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const tool = ALL_TOOLS.find((t) => t.value === current) ?? ALL_TOOLS[0];
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}
        className="flex w-full items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left shadow-sm lg:hidden">
        <tool.icon className="h-5 w-5 text-primary" />
        <span className="flex-1">
          <span className="block text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Admin tool</span>
          <span className="block font-semibold">{tool.label}</span>
        </span>
        <ChevronDown className="h-5 w-5 text-muted-foreground" />
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-[86vw] max-w-sm overflow-y-auto p-4">
          <SheetHeader className="mb-3"><SheetTitle>Admin tools</SheetTitle></SheetHeader>
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a tool" className="pl-9" />
          </div>
          <ToolList current={current} filter={q} onPick={(v) => { onPick(v); setOpen(false); setQ(""); }} />
        </SheetContent>
      </Sheet>
    </>
  );
}

/** Large screens: sticky sidebar. */
export function AdminSidebar({ current, onPick }: { current: string; onPick: (v: string) => void }) {
  return (
    <aside className="hidden lg:block">
      <div className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto rounded-2xl border border-border bg-card p-3">
        <ToolList current={current} onPick={onPick} />
      </div>
    </aside>
  );
}

/** Today's key numbers and shortcuts, shown at the top of Overview. */
export function AdminQuickStats({ onPick }: { onPick: (v: string) => void }) {
  const fn = useServerFn(adminQuickStats);
  const [s, setS] = useState<Awaited<ReturnType<typeof adminQuickStats>> | null>(null);
  useEffect(() => { fn().then(setS).catch(() => {}); }, [fn]);

  const tiles = [
    { label: "Premium members", value: s?.premium, icon: Crown, tone: "text-amber-600 dark:text-amber-400", go: "premium" },
    { label: "Active today", value: s?.activeToday, icon: Activity, tone: "text-emerald-600 dark:text-emerald-400" },
    { label: "New today", value: s?.signupsToday, icon: UserPlus, tone: "text-sky-600 dark:text-sky-400" },
    { label: "New this week", value: s?.signups7, icon: Users, tone: "text-violet-600 dark:text-violet-400" },
  ];
  const m = s?.mega;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((t) => (
          <Card key={t.label} className={cn(t.go && "cursor-pointer transition hover:border-primary/40")} onClick={() => t.go && onPick(t.go)}>
            <CardContent className="p-4">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"><t.icon className={cn("h-3.5 w-3.5", t.tone)} />{t.label}</div>
              <div className="mt-1 text-2xl font-bold tabular-nums">{t.value === undefined ? <span className="inline-block h-7 w-14 animate-pulse rounded bg-secondary" /> : t.value.toLocaleString("en-IN")}</div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400"><Timer className="h-5 w-5" /></span>
          <div className="min-w-0 flex-1 text-sm">
            <div className="font-semibold">Today's Mega Quiz</div>
            <div className="text-muted-foreground">
              {!s ? "Loading…" : !m ? "Not built yet. It's created automatically at 8:00 PM." :
                `${new Date(m.startsAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })} · ${m.players} player${m.players === 1 ? "" : "s"} · ` +
                (m.status === "finalized" ? (m.winner ? `Winner: ${m.winner} (₹${m.prize})` : "No eligible winner") : "Not finished yet")}
            </div>
          </div>
          <Link to="/mega-quiz" className="text-sm font-semibold text-primary">Open →</Link>
        </CardContent>
      </Card>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {([["premium", "Premium members", Crown], ["banners", "Edit banners", ImageIcon], ["announce", "Send announcement", Megaphone], ["userReport", "Find a student", UserSearch]] as const).map(([v, l, Icon]) => (
          <button key={v} type="button" onClick={() => onPick(v)}
            className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-3 text-left text-sm font-medium hover:border-primary/40">
            <Icon className="h-4 w-4 text-primary" /> {l}
          </button>
        ))}
      </div>
    </div>
  );
}
