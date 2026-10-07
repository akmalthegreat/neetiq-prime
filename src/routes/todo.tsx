// Daily to-do: plan the day's tasks by subject, time them, tick them off,
// close the day with a short review, and see the last 30 days.

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Check, ChevronLeft, Clock, Flame, ListChecks, Lock, Pause, Play, Plus, Quote, Sparkles, Target, Trash2, Trophy, X,
  CalendarDays, BarChart3, ArrowRight,
} from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import {
  SUBJECTS, subjectOf, MISTAKE_TAGS, MOODS, localDay, addDays, taskSeconds, fmtDuration, fmtClock, quoteNow,
  type Subject, type StudyTask, type StudyDay,
} from "@/lib/study-plan";

export const Route = createFileRoute("/todo")({
  head: () => ({ meta: [{ title: "My To-Do & Targets — NEET Track" }] }),
  component: TodoPage,
});

const db = supabase as any;
const TARGETS = [null, 30, 60, 90, 120, 180] as const;
const IDEAS: Record<Subject, string[]> = {
  physics: ["Solve 40 MCQs", "Revise formulas", "Watch lecture + notes", "Solve PYQs"],
  chemistry: ["Read NCERT line by line", "Solve 40 MCQs", "Revise reactions", "Solve PYQs"],
  biology: ["Read NCERT chapter", "Solve 60 MCQs", "Revise diagrams", "Solve PYQs"],
  other: ["Full mock test", "Mock test analysis", "Revise mistakes notebook", "Mega Quiz 8:30 PM"],
};
const PRAISE = ["Nailed it!", "One more down!", "That's how toppers work!", "Great focus!", "Keep the streak alive!", "Superb, Doctor!"];

function TodoPage() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [today, setToday] = useState(localDay());
  const [tasks, setTasks] = useState<StudyTask[] | null>(null);
  const [days, setDays] = useState<StudyDay[]>([]);
  const [tab, setTab] = useState<"today" | "record">("today");
  const [now, setNow] = useState(Date.now());
  const [burst, setBurst] = useState(0);
  const [victory, setVictory] = useState(false);
  const victoryShown = useRef(false);

  useEffect(() => { if (!loading && !user) nav({ to: "/login" }); }, [user, loading, nav]);

  const from = addDays(today, -29);
  const load = useCallback(async () => {
    if (!user) return;
    await importOldTodos(user.id, from);
    const [t, d] = await Promise.all([
      db.from("study_tasks").select("*").eq("user_id", user.id).gte("day", from).lte("day", today).order("sort").order("created_at"),
      db.from("study_days").select("*").eq("user_id", user.id).gte("day", from).lte("day", today),
    ]);
    if (t.error) { toast.error("Could not load your tasks"); setTasks([]); return; }
    setTasks(t.data ?? []);
    setDays(d.data ?? []);
  }, [user, from, today]);
  useEffect(() => { load(); }, [load]);

  // Tick every second while a timer runs; roll over at midnight.
  const running = tasks?.find((t) => t.timer_started_at && t.day === today) ?? null;
  useEffect(() => {
    const id = setInterval(() => {
      setNow(Date.now());
      const d = localDay();
      if (d !== today) setToday(d);
    }, running ? 1000 : 30000);
    return () => clearInterval(id);
  }, [running, today]);

  const todays = useMemo(() => (tasks ?? []).filter((t) => t.day === today), [tasks, today]);
  const todayDay = days.find((d) => d.day === today) ?? null;
  const done = todays.filter((t) => t.done).length;
  const studiedSec = todays.reduce((s, t) => s + taskSeconds(t, now), 0);

  // Celebrate once when every task of the day is complete.
  const armed = useRef(false); // only celebrate right after the student ticks a task
  useEffect(() => {
    if (armed.current && todays.length >= 2 && done === todays.length && !victoryShown.current) {
      victoryShown.current = true;
      setVictory(true);
      setBurst((b) => b + 1);
    }
    if (done < todays.length) victoryShown.current = false;
  }, [done, todays.length]);

  const patch = (id: string, p: Partial<StudyTask>) => setTasks((ts) => (ts ?? []).map((t) => (t.id === id ? { ...t, ...p } : t)));

  async function stopTimer(t: StudyTask): Promise<Partial<StudyTask>> {
    if (!t.timer_started_at) return {};
    const p = { spent_sec: taskSeconds(t), timer_started_at: null };
    patch(t.id, p);
    await db.from("study_tasks").update(p).eq("id", t.id);
    return p;
  }

  async function toggleTimer(t: StudyTask) {
    if (t.timer_started_at) { await stopTimer(t); return; }
    if (running && running.id !== t.id) await stopTimer(running);
    const p = { timer_started_at: new Date().toISOString() };
    patch(t.id, p);
    const { error } = await db.from("study_tasks").update(p).eq("id", t.id);
    if (error) { toast.error("Could not start the timer"); load(); }
  }

  async function toggleDone(t: StudyTask) {
    const stopP = t.timer_started_at ? await stopTimer(t) : {};
    const p = { done: !t.done, done_at: !t.done ? new Date().toISOString() : null, ...stopP };
    patch(t.id, p);
    const { error } = await db.from("study_tasks").update({ done: p.done, done_at: p.done_at }).eq("id", t.id);
    if (error) { toast.error("Could not update"); load(); return; }
    if (p.done) {
      armed.current = true;
      setBurst((b) => b + 1);
      toast.success(PRAISE[Math.floor(Math.random() * PRAISE.length)], { description: t.title });
    }
  }

  async function remove(t: StudyTask) {
    setTasks((ts) => (ts ?? []).filter((x) => x.id !== t.id));
    const { error } = await db.from("study_tasks").delete().eq("id", t.id);
    if (error) { toast.error("Could not delete"); load(); }
  }

  async function add(subject: Subject, title: string, target: number | null) {
    if (!user) return;
    const row = { user_id: user.id, day: today, subject, title: title.trim(), target_min: target, sort: todays.length };
    const { data, error } = await db.from("study_tasks").insert(row).select("*").single();
    if (error) { toast.error("Could not add the task"); return; }
    setTasks((ts) => [...(ts ?? []), data]);
  }

  async function saveDay(p: Partial<StudyDay>) {
    if (!user) return;
    const row = { user_id: user.id, day: today, ...(todayDay ?? {}), ...p, updated_at: new Date().toISOString() };
    const { data, error } = await db.from("study_days").upsert(row).select("*").single();
    if (error) { toast.error("Could not save"); return false; }
    setDays((ds) => [...ds.filter((d) => d.day !== today), data]);
    return true;
  }

  async function carryOver(list: StudyTask[]) {
    if (!user || !list.length) return;
    const rows = list.map((t, i) => ({ user_id: user.id, day: today, subject: t.subject, title: t.title, target_min: t.target_min, sort: todays.length + i }));
    const { data, error } = await db.from("study_tasks").insert(rows).select("*");
    if (error) { toast.error("Could not move the tasks"); return; }
    setTasks((ts) => [...(ts ?? []), ...(data ?? [])]);
    toast.success(`${list.length} task${list.length === 1 ? "" : "s"} moved to today`);
  }

  const yesterdayLeft = useMemo(() => (tasks ?? []).filter((t) => t.day === addDays(today, -1) && !t.done), [tasks, today]);
  const quote = quoteNow(new Date(now));

  return (
    <PageShell>
      <Confetti fire={burst} />
      {victory && <Victory done={done} studied={studiedSec} onClose={() => setVictory(false)} />}

      <div className="mx-auto max-w-3xl space-y-5">
        {/* Quote */}
        <section className="relative overflow-hidden rounded-3xl bg-[#071233] p-6 text-white sm:p-8">
          <div className="absolute inset-0 bg-[radial-gradient(80%_80%_at_100%_0%,rgba(250,204,21,.18),transparent_60%),radial-gradient(70%_70%_at_0%_100%,rgba(37,99,235,.35),transparent_60%)]" />
          <Quote className="absolute right-5 top-5 h-16 w-16 text-white/[.07]" />
          <div className="relative">
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-amber-200">{quote.slot} thought · {new Date(now).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}</div>
            <p className="mt-3 text-lg font-semibold leading-snug sm:text-2xl">“{quote.q}”</p>
            <p className="mt-2 text-sm text-white/70">— {quote.a}</p>
          </div>
        </section>

        {/* Tabs */}
        <div className="grid grid-cols-2 gap-1 rounded-2xl bg-secondary/60 p-1">
          {([["today", "Today", ListChecks], ["record", "30-day record", BarChart3]] as const).map(([k, l, Icon]) => (
            <button key={k} type="button" onClick={() => setTab(k)}
              className={cn("flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition", tab === k ? "bg-background shadow-sm" : "text-muted-foreground")}>
              <Icon className="h-4 w-4" /> {l}
            </button>
          ))}
        </div>

        {tasks === null ? (
          <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-secondary/60" />)}</div>
        ) : tab === "today" ? (
          <TodayView
            tasks={todays} day={todayDay} now={now} studiedSec={studiedSec} done={done}
            onAdd={add} onToggle={toggleDone} onTimer={toggleTimer} onRemove={remove} onSaveDay={saveDay}
            yesterdayLeft={todays.length === 0 ? yesterdayLeft : []} onCarry={() => carryOver(yesterdayLeft)}
          />
        ) : (
          <RecordView tasks={tasks} days={days} today={today} />
        )}
      </div>
    </PageShell>
  );
}

/** One-time import of the old browser-only to-do lists (last 30 days) into the database. */
async function importOldTodos(uid: string, from: string) {
  try {
    const flag = `nt_todo_imported_${uid}`;
    if (localStorage.getItem(flag)) return;
    const prefix = `neetiq_todos_${uid}_`;
    const map: Record<string, Subject> = { Physics: "physics", Chemistry: "chemistry", Biology: "biology" };
    const rows: any[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k?.startsWith(prefix)) continue;
      const day = k.slice(prefix.length);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || day < from) continue;
      const items = JSON.parse(localStorage.getItem(k) || "[]");
      if (!Array.isArray(items)) continue;
      items.forEach((it: any, n: number) => {
        const title = String(it?.title ?? "").trim().slice(0, 140);
        if (!title) return;
        const mins = Number(it?.timeMinutes);
        rows.push({
          user_id: uid, day, subject: map[it?.subject] ?? "other", title,
          target_min: Number.isFinite(mins) && mins >= 5 ? Math.min(720, Math.round(mins)) : null,
          done: !!it?.completed, done_at: it?.completed ? new Date(day + "T20:00:00").toISOString() : null, sort: n,
        });
      });
    }
    if (rows.length) {
      const { error } = await db.from("study_tasks").insert(rows);
      if (error) return; // try again next visit
    }
    localStorage.setItem(flag, "1");
  } catch { /* storage unavailable: nothing to import */ }
}

/* ================================================================ TODAY */

function TodayView({ tasks, day, now, studiedSec, done, onAdd, onToggle, onTimer, onRemove, onSaveDay, yesterdayLeft, onCarry }: {
  tasks: StudyTask[]; day: StudyDay | null; now: number; studiedSec: number; done: number;
  onAdd: (s: Subject, title: string, t: number | null) => Promise<void>;
  onToggle: (t: StudyTask) => void; onTimer: (t: StudyTask) => void; onRemove: (t: StudyTask) => void;
  onSaveDay: (p: Partial<StudyDay>) => Promise<boolean | undefined>;
  yesterdayLeft: StudyTask[]; onCarry: () => void;
}) {
  const total = tasks.length;
  const pct = total ? done / total : 0;
  const targetSec = tasks.reduce((s, t) => s + (t.target_min ?? 0) * 60, 0);
  const locked = !!day?.locked_at;

  return (
    <div className="space-y-5">
      {/* Summary */}
      <section className="grid grid-cols-[auto_1fr] items-center gap-4 rounded-3xl border border-border bg-card p-4 sm:p-5">
        <Ring pct={pct} size={92}>
          <div className="text-center leading-none"><div className="text-2xl font-black">{done}<span className="text-sm font-bold text-muted-foreground">/{total}</span></div><div className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">done</div></div>
        </Ring>
        <div className="grid grid-cols-2 gap-2">
          <Stat icon={<Clock className="h-4 w-4 text-sky-500" />} label="Studied today" value={fmtDuration(studiedSec)} sub={targetSec ? `of ${fmtDuration(targetSec)} planned` : "Use the timers"} />
          <Stat icon={<Target className="h-4 w-4 text-emerald-500" />} label="Completion" value={`${Math.round(pct * 100)}%`} sub={total ? (done === total ? "All done 🎉" : `${total - done} to go`) : "Add your tasks"} />
        </div>
      </section>

      {yesterdayLeft.length > 0 && (
        <button type="button" onClick={onCarry} className="flex w-full items-center gap-3 rounded-2xl border border-dashed border-amber-400/60 bg-amber-400/5 p-4 text-left text-sm">
          <ArrowRight className="h-4 w-4 text-amber-500" />
          <span className="flex-1"><b>{yesterdayLeft.length} unfinished task{yesterdayLeft.length === 1 ? "" : "s"}</b> from yesterday. Move them to today?</span>
          <span className="font-semibold text-amber-600 dark:text-amber-400">Move</span>
        </button>
      )}

      <AddTask onAdd={onAdd} />

      {/* Tasks */}
      {total === 0 ? (
        <div className="rounded-3xl border border-dashed border-border p-8 text-center">
          <div className="text-3xl">📝</div>
          <p className="mt-2 font-semibold">Plan your day</p>
          <p className="mt-1 text-sm text-muted-foreground">Add what you will study in Physics, Chemistry and Biology today. Small, clear tasks work best.</p>
        </div>
      ) : (
        <section className="space-y-4">
          {SUBJECTS.map((s) => {
            const list = tasks.filter((t) => t.subject === s.key);
            if (!list.length) return null;
            return (
              <div key={s.key}>
                <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider" style={{ color: s.color }}>
                  <span>{s.emoji}</span>{s.label}<span className="font-medium text-muted-foreground">· {list.filter((t) => t.done).length}/{list.length}</span>
                </div>
                <ul className="space-y-2">
                  {list.map((t) => <TaskRow key={t.id} t={t} now={now} onToggle={onToggle} onTimer={onTimer} onRemove={onRemove} />)}
                </ul>
              </div>
            );
          })}
          {!locked ? (
            <button type="button" onClick={async () => { if (await onSaveDay({ locked_at: new Date().toISOString() })) toast.success("Today's plan is set. Now execute it!"); }}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 text-sm font-bold text-white shadow-lg shadow-blue-500/20">
              <Lock className="h-4 w-4" /> Submit today's plan ({total} task{total === 1 ? "" : "s"})
            </button>
          ) : (
            <p className="text-center text-xs text-muted-foreground"><Lock className="mr-1 inline h-3 w-3" />Plan submitted at {new Date(day!.locked_at!).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}. You can still add tasks.</p>
          )}
        </section>
      )}

      <DayReview day={day} total={total} done={done} studiedSec={studiedSec} onSave={onSaveDay} />
    </div>
  );
}

function TaskRow({ t, now, onToggle, onTimer, onRemove }: { t: StudyTask; now: number; onToggle: (t: StudyTask) => void; onTimer: (t: StudyTask) => void; onRemove: (t: StudyTask) => void }) {
  const s = subjectOf(t.subject);
  const sec = taskSeconds(t, now);
  const run = !!t.timer_started_at;
  const pct = t.target_min ? Math.min(1, sec / (t.target_min * 60)) : 0;
  return (
    <li className={cn("group relative overflow-hidden rounded-2xl border bg-card p-3 transition", t.done ? "border-emerald-500/30 bg-emerald-500/[.04]" : run ? "border-sky-400/60 shadow-[0_0_0_3px_rgba(56,189,248,.12)]" : "border-border")}>
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => onToggle(t)} aria-label={t.done ? "Mark not done" : "Mark done"}
          className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition active:scale-90",
            t.done ? "border-emerald-500 bg-emerald-500 text-white" : "border-muted-foreground/40 hover:border-emerald-500")}>
          {t.done && <Check className="h-4 w-4" strokeWidth={3} />}
        </button>
        <div className="min-w-0 flex-1">
          <div className={cn("truncate font-medium", t.done && "text-muted-foreground line-through")}>{t.title}</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
            <span className={cn("font-mono tabular-nums", run && "font-bold text-sky-600 dark:text-sky-400")}>{fmtClock(sec)}</span>
            {t.target_min ? <span>/ {fmtDuration(t.target_min * 60)} target</span> : null}
          </div>
        </div>
        {!t.done && (
          <button type="button" onClick={() => onTimer(t)} aria-label={run ? "Pause timer" : "Start timer"}
            className={cn("inline-flex h-9 items-center gap-1 rounded-xl px-3 text-xs font-bold", run ? "bg-sky-500 text-white" : "bg-secondary text-foreground")}>
            {run ? <><Pause className="h-3.5 w-3.5" />Pause</> : <><Play className="h-3.5 w-3.5" />Start</>}
          </button>
        )}
        <button type="button" onClick={() => onRemove(t)} aria-label="Delete task" className="p-1.5 text-muted-foreground/60 hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
      </div>
      {t.target_min ? <div className="absolute inset-x-0 bottom-0 h-1 bg-transparent"><div className="h-full transition-all" style={{ width: `${pct * 100}%`, background: s.color }} /></div> : null}
    </li>
  );
}

function AddTask({ onAdd }: { onAdd: (s: Subject, title: string, t: number | null) => Promise<void> }) {
  const [subject, setSubject] = useState<Subject>("physics");
  const [title, setTitle] = useState("");
  const [target, setTarget] = useState<number | null>(60);
  const [busy, setBusy] = useState(false);
  async function submit() {
    if (!title.trim()) { toast("Write the task first"); return; }
    setBusy(true);
    await onAdd(subject, title, target);
    setBusy(false);
    setTitle("");
  }
  const s = subjectOf(subject);
  return (
    <section className="rounded-3xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-bold"><Plus className="h-4 w-4 text-primary" /> Add a task</div>
      <div className="grid grid-cols-4 gap-1.5">
        {SUBJECTS.map((x) => (
          <button key={x.key} type="button" onClick={() => setSubject(x.key)}
            className={cn("rounded-xl border px-1 py-2 text-xs font-bold transition", subject === x.key ? "text-white" : "border-border text-muted-foreground")}
            style={subject === x.key ? { background: x.color, borderColor: x.color } : undefined}>
            <span className="mr-0.5">{x.emoji}</span>{x.label}
          </button>
        ))}
      </div>
      <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={140}
          placeholder={`e.g. ${IDEAS[subject][0]}`} className="h-11 min-w-0 flex-1 rounded-xl border border-input bg-background px-3 text-sm outline-none focus:border-primary" />
        <button type="submit" disabled={busy} className="h-11 rounded-xl px-4 text-sm font-bold text-white disabled:opacity-60" style={{ background: s.color }}>Add</button>
      </form>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {IDEAS[subject].map((idea) => (
          <button key={idea} type="button" onClick={() => setTitle(idea)} className="rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground hover:text-foreground">{idea}</button>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
        <span className="mr-1 text-muted-foreground">Target time</span>
        {TARGETS.map((m) => (
          <button key={String(m)} type="button" onClick={() => setTarget(m)}
            className={cn("rounded-lg border px-2.5 py-1 font-semibold", target === m ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground")}>
            {m === null ? "None" : fmtDuration(m * 60)}
          </button>
        ))}
      </div>
    </section>
  );
}

function DayReview({ day, total, done, studiedSec, onSave }: { day: StudyDay | null; total: number; done: number; studiedSec: number; onSave: (p: Partial<StudyDay>) => Promise<boolean | undefined> }) {
  const [editing, setEditing] = useState(false);
  const [mood, setMood] = useState<number | null>(day?.mood ?? null);
  const [well, setWell] = useState(day?.went_well ?? "");
  const [mist, setMist] = useState(day?.mistakes ?? "");
  const [tags, setTags] = useState<string[]>(day?.mistake_tags ?? []);
  useEffect(() => { setMood(day?.mood ?? null); setWell(day?.went_well ?? ""); setMist(day?.mistakes ?? ""); setTags(day?.mistake_tags ?? []); }, [day?.day, day?.closed_at]);
  const closed = !!day?.closed_at && !editing;

  if (closed) {
    const m = MOODS.find((x) => x.v === day!.mood);
    return (
      <section className="rounded-3xl border border-emerald-500/30 bg-emerald-500/[.04] p-5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 font-bold"><Sparkles className="h-4 w-4 text-emerald-500" /> Day closed {m ? `· ${m.emoji} ${m.label}` : ""}</div>
          <button type="button" onClick={() => setEditing(true)} className="text-xs font-semibold text-primary">Edit</button>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{done}/{total} tasks · {fmtDuration(studiedSec)} studied</p>
        {day!.went_well && <p className="mt-3 text-sm"><b>Went well:</b> {day!.went_well}</p>}
        {(day!.mistakes || day!.mistake_tags.length > 0) && (
          <p className="mt-2 text-sm"><b>Mistakes:</b> {day!.mistake_tags.join(", ")}{day!.mistakes ? `${day!.mistake_tags.length ? " — " : ""}${day!.mistakes}` : ""}</p>
        )}
      </section>
    );
  }

  return (
    <section className="rounded-3xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 font-bold"><Flame className="h-4 w-4 text-amber-500" /> End-of-day review</div>
      <p className="mt-1 text-sm text-muted-foreground">Before you sleep: tick what you finished, then reflect for one minute. This is how toppers improve every day.</p>

      <div className="mt-4 text-xs font-semibold text-muted-foreground">How did today go?</div>
      <div className="mt-2 grid grid-cols-5 gap-1.5">
        {MOODS.map((m) => (
          <button key={m.v} type="button" onClick={() => setMood(m.v)}
            className={cn("rounded-xl border py-2 text-center transition", mood === m.v ? "border-primary bg-primary/10" : "border-border")}>
            <div className="text-xl">{m.emoji}</div><div className="mt-0.5 text-[10px] text-muted-foreground">{m.label}</div>
          </button>
        ))}
      </div>

      <label className="mt-4 block text-xs font-semibold text-muted-foreground">What went well today?</label>
      <textarea value={well} onChange={(e) => setWell(e.target.value)} maxLength={1000} rows={2} placeholder="e.g. Finished Thermodynamics PYQs with 85% accuracy"
        className="mt-1.5 w-full rounded-xl border border-input bg-background p-3 text-sm outline-none focus:border-primary" />

      <div className="mt-4 text-xs font-semibold text-muted-foreground">What mistakes did you make?</div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {MISTAKE_TAGS.map((tg) => {
          const on = tags.includes(tg);
          return (
            <button key={tg} type="button" onClick={() => setTags((x) => (on ? x.filter((y) => y !== tg) : [...x, tg]))}
              className={cn("rounded-full border px-3 py-1 text-xs font-medium", on ? "border-rose-500 bg-rose-500/10 text-rose-600 dark:text-rose-400" : "border-border text-muted-foreground")}>
              {tg}
            </button>
          );
        })}
      </div>
      <textarea value={mist} onChange={(e) => setMist(e.target.value)} maxLength={1000} rows={2} placeholder="e.g. Kept checking my phone after lunch; mixed up sign conventions in optics"
        className="mt-2 w-full rounded-xl border border-input bg-background p-3 text-sm outline-none focus:border-primary" />

      <button type="button" disabled={!mood}
        onClick={async () => {
          const ok = await onSave({ mood, went_well: well.trim() || null, mistakes: mist.trim() || null, mistake_tags: tags, closed_at: new Date().toISOString() });
          if (ok) { setEditing(false); toast.success("Day closed. See you tomorrow, Doctor!"); }
        }}
        className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-foreground text-sm font-bold text-background disabled:opacity-40">
        <Check className="h-4 w-4" /> Close my day
      </button>
    </section>
  );
}

/* ================================================================ 30-DAY RECORD */

function RecordView({ tasks, days, today }: { tasks: StudyTask[]; days: StudyDay[]; today: string }) {
  const [pick, setPick] = useState<string | null>(null);
  const list = useMemo(() => Array.from({ length: 30 }, (_, i) => addDays(today, i - 29)), [today]);
  const byDay = useMemo(() => {
    const m = new Map<string, { total: number; done: number; sec: number }>();
    for (const d of list) m.set(d, { total: 0, done: 0, sec: 0 });
    for (const t of tasks) {
      const r = m.get(t.day);
      if (!r) continue;
      r.total++; if (t.done) r.done++; r.sec += taskSeconds(t);
    }
    return m;
  }, [tasks, list]);

  const planned = list.filter((d) => byDay.get(d)!.total > 0);
  const totalTasks = planned.reduce((s, d) => s + byDay.get(d)!.total, 0);
  const doneTasks = planned.reduce((s, d) => s + byDay.get(d)!.done, 0);
  const totalSec = list.reduce((s, d) => s + byDay.get(d)!.sec, 0);
  const goodDay = (d: string) => { const r = byDay.get(d)!; return r.total > 0 && r.done / r.total >= 0.6; };
  let streak = 0;
  for (let i = list.length - 1; i >= 0; i--) {
    if (goodDay(list[i])) streak++;
    else if (i === list.length - 1) continue; // today may still be in progress
    else break;
  }
  let best = 0, cur = 0;
  for (const d of list) { cur = goodDay(d) ? cur + 1 : 0; best = Math.max(best, cur); }
  const consistency = Math.round((list.filter(goodDay).length / 30) * 100);
  const accuracy = totalTasks ? Math.round((doneTasks / totalTasks) * 100) : 0;

  const subj = SUBJECTS.map((s) => ({ ...s, sec: tasks.filter((t) => t.subject === s.key).reduce((a, t) => a + taskSeconds(t), 0) }));
  const maxSubj = Math.max(1, ...subj.map((s) => s.sec));
  const tagCount = new Map<string, number>();
  for (const d of days) for (const tg of d.mistake_tags ?? []) tagCount.set(tg, (tagCount.get(tg) ?? 0) + 1);
  const topTags = [...tagCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  const sel = pick ? { day: pick, r: byDay.get(pick)!, tasks: tasks.filter((t) => t.day === pick), rev: days.find((d) => d.day === pick) } : null;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat icon={<Target className="h-4 w-4 text-emerald-500" />} label="Task completion" value={`${accuracy}%`} sub={`${doneTasks}/${totalTasks} tasks`} />
        <Stat icon={<CalendarDays className="h-4 w-4 text-violet-500" />} label="Consistency" value={`${consistency}%`} sub="days with 60%+ done" />
        <Stat icon={<Flame className="h-4 w-4 text-amber-500" />} label="Current streak" value={`${streak} day${streak === 1 ? "" : "s"}`} sub={`Best: ${best}`} />
        <Stat icon={<Clock className="h-4 w-4 text-sky-500" />} label="Study time" value={fmtDuration(totalSec)} sub={planned.length ? `${fmtDuration(Math.round(totalSec / planned.length))} per study day` : "last 30 days"} />
      </div>

      <section className="rounded-3xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center justify-between text-sm font-bold"><span>Last 30 days</span><span className="text-xs font-normal text-muted-foreground">Tap a day</span></div>
        <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
          {list.map((d) => {
            const r = byDay.get(d)!;
            const p = r.total ? r.done / r.total : -1;
            const bg = p < 0 ? "bg-secondary/50" : p >= 1 ? "bg-emerald-500" : p >= 0.6 ? "bg-emerald-400/70" : p > 0 ? "bg-amber-400/70" : "bg-rose-400/50";
            const dt = new Date(d + "T00:00:00");
            return (
              <button key={d} type="button" onClick={() => setPick(d === pick ? null : d)}
                className={cn("flex aspect-square flex-col items-center justify-center rounded-lg text-[11px] font-semibold", bg, p >= 0.6 && "text-white", d === pick && "ring-2 ring-primary ring-offset-2 ring-offset-background", d === today && "outline outline-2 outline-primary/50")}>
                {dt.getDate()}
                {r.total > 0 && <span className="text-[9px] font-medium opacity-80">{r.done}/{r.total}</span>}
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded bg-emerald-500" />All done</span>
          <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded bg-emerald-400/70" />60%+</span>
          <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded bg-amber-400/70" />Some</span>
          <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded bg-rose-400/50" />None done</span>
          <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded bg-secondary" />No plan</span>
        </div>
      </section>

      {sel && (
        <section className="rounded-3xl border border-primary/30 bg-card p-4">
          <div className="flex items-center justify-between">
            <div className="font-bold">{new Date(sel.day + "T00:00:00").toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}</div>
            <button type="button" onClick={() => setPick(null)} className="p-1 text-muted-foreground"><X className="h-4 w-4" /></button>
          </div>
          <p className="text-xs text-muted-foreground">{sel.r.done}/{sel.r.total} tasks · {fmtDuration(sel.r.sec)} studied {sel.rev?.mood ? `· ${MOODS.find((m) => m.v === sel.rev!.mood)?.emoji}` : ""}</p>
          {sel.tasks.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">No tasks planned this day.</p> : (
            <ul className="mt-3 space-y-1.5 text-sm">
              {sel.tasks.map((t) => (
                <li key={t.id} className="flex items-center gap-2">
                  <span className={cn("flex h-5 w-5 items-center justify-center rounded-full text-[10px]", t.done ? "bg-emerald-500 text-white" : "border border-muted-foreground/40")}>{t.done ? "✓" : ""}</span>
                  <span className={cn("flex-1", !t.done && "text-muted-foreground")}>{t.title}</span>
                  <span className="text-xs" style={{ color: subjectOf(t.subject).color }}>{subjectOf(t.subject).label}</span>
                </li>
              ))}
            </ul>
          )}
          {sel.rev?.went_well && <p className="mt-3 text-sm"><b>Went well:</b> {sel.rev.went_well}</p>}
          {(sel.rev?.mistakes || (sel.rev?.mistake_tags?.length ?? 0) > 0) && <p className="mt-1 text-sm"><b>Mistakes:</b> {sel.rev!.mistake_tags.join(", ")}{sel.rev!.mistakes ? ` — ${sel.rev!.mistakes}` : ""}</p>}
        </section>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <section className="rounded-3xl border border-border bg-card p-4">
          <div className="mb-3 text-sm font-bold">Study time by subject</div>
          <div className="space-y-2.5">
            {subj.map((s) => (
              <div key={s.key}>
                <div className="flex justify-between text-xs"><span>{s.emoji} {s.label}</span><span className="font-semibold">{fmtDuration(s.sec)}</span></div>
                <div className="mt-1 h-2 rounded-full bg-secondary"><div className="h-full rounded-full" style={{ width: `${(s.sec / maxSubj) * 100}%`, background: s.color }} /></div>
              </div>
            ))}
          </div>
        </section>
        <section className="rounded-3xl border border-border bg-card p-4">
          <div className="mb-3 text-sm font-bold">Your most common mistakes</div>
          {topTags.length === 0 ? <p className="text-sm text-muted-foreground">Close your days with a review to see patterns here.</p> : (
            <ul className="space-y-2 text-sm">
              {topTags.map(([tg, n]) => (
                <li key={tg} className="flex items-center justify-between"><span>{tg}</span><span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-xs font-bold text-rose-600 dark:text-rose-400">{n} day{n === 1 ? "" : "s"}</span></li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

/* ================================================================ BITS */

function Stat({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{icon}{label}</div>
      <div className="mt-1 text-xl font-black tabular-nums">{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

function Ring({ pct, size, children }: { pct: number; size: number; children: React.ReactNode }) {
  const r = size / 2 - 7, c = 2 * Math.PI * r;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" className="text-secondary" strokeWidth="8" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="url(#todoRing)" strokeWidth="8" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct)} style={{ transition: "stroke-dashoffset .8s cubic-bezier(.2,.8,.2,1)" }} />
        <defs><linearGradient id="todoRing" x1="0" x2="1"><stop offset="0" stopColor="#10B981" /><stop offset="1" stopColor="#22D3EE" /></linearGradient></defs>
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
}

function Victory({ done, studied, onClose }: { done: number; studied: number; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="relative w-full max-w-sm overflow-hidden rounded-[28px] bg-gradient-to-b from-[#0B1A45] to-[#050B1F] p-7 text-center text-white shadow-2xl" onClick={(e) => e.stopPropagation()}
        style={{ animation: "todo-pop .5s cubic-bezier(.2,1.4,.4,1) both" }}>
        <style>{`@keyframes todo-pop{from{opacity:0;transform:scale(.7)}to{opacity:1;transform:none}}@keyframes todo-shine{to{transform:rotate(360deg)}}`}</style>
        <div className="absolute left-1/2 top-16 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[conic-gradient(from_0deg,transparent,rgba(250,204,21,.25),transparent_30%)]" style={{ animation: "todo-shine 6s linear infinite" }} />
        <div className="relative mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-amber-200 to-yellow-500 shadow-[0_15px_40px_-10px_rgba(250,204,21,.8)]"><Trophy className="h-10 w-10 text-slate-900" /></div>
        <div className="relative mt-5 text-[11px] font-bold uppercase tracking-[0.2em] text-amber-200">Victory</div>
        <h2 className="relative mt-1 text-2xl font-black">Every task done!</h2>
        <p className="relative mt-2 text-sm text-white/75">{done} tasks completed · {fmtDuration(studied)} of focused study. This is how 700+ is built, one day at a time.</p>
        <button type="button" onClick={onClose} className="relative mt-6 h-12 w-full rounded-2xl bg-gradient-to-r from-amber-300 to-yellow-500 text-sm font-extrabold text-slate-950">Keep going 💪</button>
      </div>
    </div>
  );
}

/** Lightweight confetti burst; fires whenever `fire` changes (and is > 0). */
function Confetti({ fire }: { fire: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!fire || !ref.current) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const cv = ref.current, ctx = cv.getContext("2d")!;
    const dpr = window.devicePixelRatio || 1;
    cv.width = innerWidth * dpr; cv.height = innerHeight * dpr; ctx.scale(dpr, dpr);
    const colors = ["#F59E0B", "#10B981", "#3B82F6", "#EC4899", "#8B5CF6", "#FDE68A"];
    const parts = Array.from({ length: 140 }, () => ({
      x: innerWidth / 2, y: innerHeight * 0.4, vx: (Math.random() - 0.5) * 16, vy: -Math.random() * 15 - 4,
      w: 6 + Math.random() * 6, h: 8 + Math.random() * 8, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, c: colors[(Math.random() * colors.length) | 0],
    }));
    let raf = 0; const start = performance.now();
    const step = (t: number) => {
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      for (const p of parts) {
        p.vy += 0.42; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); ctx.restore();
      }
      if (t - start < 2600) raf = requestAnimationFrame(step); else ctx.clearRect(0, 0, innerWidth, innerHeight);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [fire]);
  return <canvas ref={ref} className="pointer-events-none fixed inset-0 z-[80] h-full w-full" aria-hidden="true" />;
}

// Keep the unused-import checker quiet for icons used only conditionally.
void ChevronLeft;
