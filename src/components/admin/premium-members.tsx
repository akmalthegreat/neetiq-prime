// Admin: every premium member with email, plan and expiry. Search, filter,
// extend, remove premium, grant premium by name/email, and export CSV.

import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Crown, Download, Loader2, Search, UserPlus, X, CalendarPlus, Ban, Copy } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  adminListPremium, adminRevokePremium, adminExtendPremium, adminFindUser, adminGrantPremiumTo, type PremiumMember,
} from "@/lib/admin-panel.functions";
import { adminListBatches } from "@/lib/batches.functions";
import { cn } from "@/lib/utils";

type Filter = "active" | "expiring" | "expired" | "all";

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

export function PremiumMembers() {
  const listFn = useServerFn(adminListPremium);
  const revokeFn = useServerFn(adminRevokePremium);
  const extendFn = useServerFn(adminExtendPremium);
  const [data, setData] = useState<Awaited<ReturnType<typeof adminListPremium>> | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("active");
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<PremiumMember | null>(null);
  const [showGrant, setShowGrant] = useState(false);

  const load = () => listFn().then((d) => { setData(d); setErr(null); }).catch((e) => setErr(e?.message ?? "Could not load members"));
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const rows = useMemo(() => {
    if (!data) return [];
    const term = q.trim().toLowerCase();
    return data.members.filter((m) => {
      if (filter === "active" && !m.active) return false;
      if (filter === "expiring" && !(m.active && m.daysLeft <= 7)) return false;
      if (filter === "expired" && m.active) return false;
      return !term || m.email.toLowerCase().includes(term) || m.name.toLowerCase().includes(term);
    });
  }, [data, q, filter]);

  async function extend(m: PremiumMember, days: number) {
    setBusy(m.userId);
    try {
      const r = await extendFn({ data: { user_id: m.userId, days } });
      toast.success(`${m.name !== "—" ? m.name : m.email}: premium until ${fmtDate(r.expires_at)}`);
      await load();
    } catch (e: any) { toast.error(e?.message ?? "Could not extend"); }
    finally { setBusy(null); }
  }

  async function revoke(m: PremiumMember) {
    setBusy(m.userId);
    try {
      await revokeFn({ data: { user_id: m.userId } });
      toast.success(`Premium removed for ${m.email}`);
      await load();
    } catch (e: any) { toast.error(e?.message ?? "Could not remove"); }
    finally { setBusy(null); setConfirm(null); }
  }

  function exportCsv() {
    const head = ["Name", "Email", "Plan", "How", "Status", "Started", "Expires", "Days left"];
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const lines = [head.join(","), ...rows.map((m) => [m.name, m.email, m.plan, m.source, m.active ? "Active" : "Expired", fmtDate(m.startedAt), fmtDate(m.expiresAt), m.daysLeft].map(esc).join(","))];
    const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url; a.download = `premium-members-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  if (err) return <Card><CardContent className="p-5 text-sm text-destructive">{err} <Button size="sm" variant="link" onClick={load}>Retry</Button></CardContent></Card>;
  if (!data) return <div className="flex justify-center p-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  const s = data.stats;
  const chips: { key: Filter; label: string; n: number }[] = [
    { key: "active", label: "Active", n: s.active },
    { key: "expiring", label: "Ending in 7 days", n: s.expiringSoon },
    { key: "expired", label: "Expired / removed", n: s.expired },
    { key: "all", label: "All", n: data.members.length },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Active premium" value={s.active} tone="amber" />
        <Stat label="Ending in 7 days" value={s.expiringSoon} tone={s.expiringSoon ? "rose" : "muted"} />
        <Stat label="New in 30 days" value={s.newThisMonth} tone="emerald" />
        <Stat label="Expired / removed" value={s.expired} tone="muted" />
      </div>

      <Card>
        <CardContent className="space-y-4 p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[220px] flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or email" className="pl-9" />
              {q && <button type="button" onClick={() => setQ("")} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground" aria-label="Clear"><X className="h-4 w-4" /></button>}
            </div>
            <Button onClick={() => setShowGrant((v) => !v)} className="gap-1.5 bg-amber-500 text-amber-950 hover:bg-amber-400"><UserPlus className="h-4 w-4" /> Give premium</Button>
            <Button variant="outline" onClick={exportCsv} disabled={!rows.length} className="gap-1.5"><Download className="h-4 w-4" /> CSV</Button>
          </div>

          {showGrant && <GrantPanel onDone={() => { setShowGrant(false); load(); }} />}

          <div className="flex flex-wrap gap-1.5">
            {chips.map((c) => (
              <button key={c.key} type="button" onClick={() => setFilter(c.key)}
                className={cn("rounded-full border px-3 py-1 text-xs font-semibold transition",
                  filter === c.key ? "border-primary bg-primary text-primary-foreground" : "border-border bg-secondary/40 text-muted-foreground hover:text-foreground")}>
                {c.label} <span className="opacity-70">{c.n}</span>
              </button>
            ))}
          </div>

          {rows.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No members match.</p>
          ) : (
            <ul className="divide-y divide-border rounded-xl border border-border">
              {rows.map((m) => (
                <li key={m.userId} className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:gap-4">
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <span className={cn("mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full", m.active ? "bg-amber-500/15 text-amber-600 dark:text-amber-400" : "bg-secondary text-muted-foreground")}>
                      <Crown className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <div className="truncate font-semibold">{m.name}</div>
                      <button type="button" className="flex max-w-full items-center gap-1 truncate text-sm text-muted-foreground hover:text-foreground"
                        onClick={() => { navigator.clipboard?.writeText(m.email).then(() => toast.success("Email copied"), () => {}); }}>
                        <span className="truncate">{m.email}</span><Copy className="h-3 w-3 shrink-0" />
                      </button>
                      <div className="mt-1 flex flex-wrap gap-1.5 text-[11px]">
                        <Badge variant="secondary">{m.plan}</Badge>
                        <Badge variant="outline">{m.source}</Badge>
                        {m.active
                          ? <Badge className={cn(m.daysLeft <= 7 ? "bg-rose-500/15 text-rose-600 dark:text-rose-400" : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400", "border-0")}>
                              {m.daysLeft} day{m.daysLeft === 1 ? "" : "s"} left · until {fmtDate(m.expiresAt)}
                            </Badge>
                          : <Badge variant="outline" className="text-muted-foreground">Ended {fmtDate(m.expiresAt)}</Badge>}
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-1.5 sm:justify-end">
                    {busy === m.userId ? <Loader2 className="m-2 h-4 w-4 animate-spin" /> : (
                      <>
                        <Button size="sm" variant="outline" className="gap-1" onClick={() => extend(m, 30)}><CalendarPlus className="h-3.5 w-3.5" />+30d</Button>
                        <Button size="sm" variant="outline" onClick={() => extend(m, 365)}>+1yr</Button>
                        {m.active && (
                          <Button size="sm" variant="outline" className="gap-1 border-destructive/40 text-destructive hover:bg-destructive/10" onClick={() => setConfirm(m)}>
                            <Ban className="h-3.5 w-3.5" />Remove
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-muted-foreground">Showing {rows.length} of {data.members.length}. Every change is saved in the admin log.</p>
        </CardContent>
      </Card>

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove premium?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.name} ({confirm?.email}) will lose premium access immediately. You can give it back any time with “Give premium” or +30d.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep premium</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => confirm && revoke(confirm)}>
              Remove premium
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: "amber" | "rose" | "emerald" | "muted" }) {
  const color = { amber: "text-amber-600 dark:text-amber-400", rose: "text-rose-600 dark:text-rose-400", emerald: "text-emerald-600 dark:text-emerald-400", muted: "text-foreground" }[tone];
  return (
    <Card><CardContent className="p-4">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn("mt-1 text-2xl font-bold tabular-nums", color)}>{value.toLocaleString("en-IN")}</div>
    </CardContent></Card>
  );
}

function GrantPanel({ onDone }: { onDone: () => void }) {
  const findFn = useServerFn(adminFindUser);
  const grantFn = useServerFn(adminGrantPremiumTo);
  const batchesFn = useServerFn(adminListBatches);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<{ id: string; name: string; email: string }[] | null>(null);
  const [pick, setPick] = useState<{ id: string; name: string; email: string } | null>(null);
  const [days, setDays] = useState(30);
  const [batch, setBatch] = useState<string>("");
  const [batches, setBatches] = useState<{ id: string; title: string }[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => { batchesFn().then((b: any) => setBatches((b ?? []).map((x: any) => ({ id: x.id, title: x.title })))).catch(() => {}); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (pick || q.trim().length < 2) { setResults(null); return; }
    const t = setTimeout(() => { findFn({ data: { q } }).then(setResults).catch(() => setResults([])); }, 300);
    return () => clearTimeout(t);
  }, [q, pick]); // eslint-disable-line react-hooks/exhaustive-deps

  async function grant() {
    if (!pick) return;
    setBusy(true);
    try {
      const r = await grantFn({ data: { user_id: pick.id, days, batch_id: batch || null, note: "Admin panel" } });
      toast.success(`Premium given to ${pick.email} until ${fmtDate(r.expires_at)}`);
      onDone();
    } catch (e: any) { toast.error(e?.message ?? "Could not give premium"); }
    finally { setBusy(false); }
  }

  return (
    <div className="space-y-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
      <div className="text-sm font-semibold">Give premium to a student</div>
      {pick ? (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm">
          <div className="min-w-0"><div className="truncate font-medium">{pick.name}</div><div className="truncate text-muted-foreground">{pick.email}</div></div>
          <Button size="sm" variant="ghost" onClick={() => { setPick(null); setQ(""); }}>Change</Button>
        </div>
      ) : (
        <div className="relative">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Type the student's name or email" autoFocus />
          {results && (
            <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-border bg-popover shadow-lg">
              {results.length === 0 ? <div className="p-3 text-sm text-muted-foreground">No student found.</div> :
                results.map((r) => (
                  <button key={r.id} type="button" onClick={() => setPick(r)} className="block w-full px-3 py-2 text-left text-sm hover:bg-secondary">
                    <div className="font-medium">{r.name}</div><div className="text-xs text-muted-foreground">{r.email}</div>
                  </button>
                ))}
            </div>
          )}
        </div>
      )}
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex gap-1">
          {[30, 90, 180, 365].map((d) => (
            <button key={d} type="button" onClick={() => setDays(d)}
              className={cn("rounded-lg border px-3 py-1.5 text-xs font-semibold", days === d ? "border-amber-500 bg-amber-500 text-amber-950" : "border-border bg-background")}>
              {d === 365 ? "1 year" : `${d} days`}
            </button>
          ))}
        </div>
        <Input type="number" min={1} max={3650} value={days} onChange={(e) => setDays(Math.max(1, Number(e.target.value) || 1))} className="w-24" aria-label="Days" />
        {batches.length > 0 && (
          <select value={batch} onChange={(e) => setBatch(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
            <option value="">Full premium (all features)</option>
            {batches.map((b) => <option key={b.id} value={b.id}>{b.title}</option>)}
          </select>
        )}
        <Button onClick={grant} disabled={!pick || busy} className="gap-1.5">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crown className="h-4 w-4" />} Give premium</Button>
      </div>
    </div>
  );
}
