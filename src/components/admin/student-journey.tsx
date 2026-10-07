// Admin: one student's journey: premium, questions solved, tests,
// Mega Quiz, and their 30-day to-do record with daily reviews.

import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Crown, Loader2, Search, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { adminFindUser, adminStudentJourney } from "@/lib/admin-panel.functions";
import { MOODS, fmtDuration, subjectOf } from "@/lib/study-plan";
import { cn } from "@/lib/utils";

type Journey = Awaited<ReturnType<typeof adminStudentJourney>>;

export function StudentJourney() {
  const findFn = useServerFn(adminFindUser);
  const journeyFn = useServerFn(adminStudentJourney);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<{ id: string; name: string; email: string }[] | null>(null);
  const [j, setJ] = useState<Journey | null>(null);
  const [busy, setBusy] = useState(false);
  const [openDay, setOpenDay] = useState<string | null>(null);

  useEffect(() => {
    if (q.trim().length < 2) { setResults(null); return; }
    const t = setTimeout(() => { findFn({ data: { q } }).then(setResults).catch(() => setResults([])); }, 300);
    return () => clearTimeout(t);
  }, [q]); // eslint-disable-line react-hooks/exhaustive-deps

  async function open(id: string) {
    setBusy(true); setResults(null); setOpenDay(null);
    try { setJ(await journeyFn({ data: { user_id: id } })); }
    catch (e: any) { toast.error(e?.message ?? "Could not load"); }
    finally { setBusy(false); }
  }

  return (
    <div className="space-y-4">
      <Card><CardContent className="p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a student by name or email" className="pl-9" />
          {results && (
            <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-border bg-popover shadow-lg">
              {results.length === 0 ? <div className="p-3 text-sm text-muted-foreground">No student found.</div> :
                results.map((r) => (
                  <button key={r.id} type="button" onClick={() => { setQ(""); open(r.id); }} className="block w-full px-3 py-2 text-left text-sm hover:bg-secondary">
                    <div className="font-medium">{r.name}</div><div className="text-xs text-muted-foreground">{r.email}</div>
                  </button>
                ))}
            </div>
          )}
        </div>
      </CardContent></Card>

      {busy && <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}

      {!busy && j && (
        <>
          <Card><CardContent className="flex flex-wrap items-start justify-between gap-3 p-4">
            <div>
              <div className="text-lg font-bold">{j.profile.full_name || "—"}</div>
              <div className="text-sm text-muted-foreground">{j.profile.email}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                Joined {new Date(j.profile.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                {j.profile.last_seen_at ? ` · Last active ${new Date(j.profile.last_seen_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}` : ""}
                {j.profile.target_year ? ` · NEET ${j.profile.target_year}` : ""}
              </div>
            </div>
            {j.premium
              ? <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-3 py-1 text-xs font-bold text-amber-700 dark:text-amber-400"><Crown className="h-3.5 w-3.5" />{j.premium.plan} · until {new Date(j.premium.expiresAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
              : <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-muted-foreground">Free plan</span>}
            <button type="button" onClick={() => setJ(null)} className="p-1 text-muted-foreground" aria-label="Close"><X className="h-4 w-4" /></button>
          </CardContent></Card>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Tile label="Questions solved" value={j.questions.solved.toLocaleString("en-IN")} sub={`${j.questions.solved30.toLocaleString("en-IN")} in last 30 days`} />
            <Tile label="Accuracy" value={`${j.questions.accuracy}%`} sub={`${j.questions.attempts} tests/quizzes done`} />
            <Tile label="To-do completion" value={`${j.todo.completion}%`} sub={`${j.todo.plannedDays} days planned (30d)`} />
            <Tile label="Study time (30d)" value={fmtDuration(j.todo.studySec)} sub={`Consistency ${j.todo.consistency}%`} />
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <Card><CardContent className="p-4">
              <div className="mb-2 text-sm font-bold">To-do record · last 30 days</div>
              {j.todo.days.length === 0 ? <p className="text-sm text-muted-foreground">No to-do lists yet.</p> : (
                <ul className="divide-y divide-border">
                  {j.todo.days.map((r) => {
                    const rev = j.todo.reviews.find((x: any) => x.day === r.day);
                    const p = r.total ? r.done / r.total : 0;
                    const isOpen = openDay === r.day;
                    return (
                      <li key={r.day} className="py-2">
                        <button type="button" onClick={() => setOpenDay(isOpen ? null : r.day)} className="flex w-full items-center gap-3 text-left text-sm">
                          <span className="w-24 shrink-0 text-xs text-muted-foreground">{new Date(r.day + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}</span>
                          <span className="h-2 flex-1 overflow-hidden rounded-full bg-secondary"><span className={cn("block h-full rounded-full", p >= 1 ? "bg-emerald-500" : p >= 0.6 ? "bg-emerald-400" : p > 0 ? "bg-amber-400" : "bg-rose-400")} style={{ width: `${Math.max(4, p * 100)}%` }} /></span>
                          <span className="w-12 shrink-0 text-right text-xs font-semibold">{r.done}/{r.total}</span>
                          <span className="w-6 shrink-0 text-center">{rev?.mood ? MOODS.find((m) => m.v === rev.mood)?.emoji : ""}</span>
                        </button>
                        {isOpen && (
                          <div className="mt-2 space-y-1 rounded-lg bg-secondary/40 p-2.5 text-xs">
                            {j.todo.tasks.filter((t: any) => t.day === r.day).map((t: any, i: number) => (
                              <div key={i} className="flex items-center gap-2">
                                <span>{t.done ? "✅" : "⬜"}</span>
                                <span className="flex-1">{t.title}</span>
                                <span style={{ color: subjectOf(t.subject).color }}>{subjectOf(t.subject).label}</span>
                                {t.spent_sec ? <span className="text-muted-foreground">{fmtDuration(t.spent_sec)}</span> : null}
                              </div>
                            ))}
                            {rev?.went_well && <div className="pt-1"><b>Went well:</b> {rev.went_well}</div>}
                            {(rev?.mistakes || rev?.mistake_tags?.length) && <div><b>Mistakes:</b> {(rev.mistake_tags ?? []).join(", ")}{rev.mistakes ? ` — ${rev.mistakes}` : ""}</div>}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent></Card>

            <div className="space-y-3">
              <Card><CardContent className="p-4">
                <div className="mb-2 text-sm font-bold">Recent tests</div>
                {j.tests.length === 0 ? <p className="text-sm text-muted-foreground">No mock or contest tests yet.</p> : (
                  <ul className="space-y-1.5 text-sm">
                    {j.tests.map((t) => (
                      <li key={t.id} className="flex justify-between gap-2"><span className="truncate">{t.title}</span><span className="shrink-0 font-semibold">{t.score}</span></li>
                    ))}
                  </ul>
                )}
              </CardContent></Card>
              <Card><CardContent className="p-4 text-sm">
                <div className="mb-1 font-bold">Daily Mega Quiz</div>
                <p className="text-muted-foreground">Played {j.mega.played} · Won {j.mega.wins} · Best score {j.mega.best}</p>
              </CardContent></Card>
            </div>
          </div>
        </>
      )}

      {!busy && !j && <p className="text-center text-sm text-muted-foreground">Search a student to see their progress, to-do record and reviews.</p>}
    </div>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <Card><CardContent className="p-4">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-bold tabular-nums">{value}</div>
      <div className="text-xs text-muted-foreground">{sub}</div>
    </CardContent></Card>
  );
}
