// Previous-year papers, grouped by exam and year. NEET papers first, then other medical exams,
// then state CETs / JEE. Big sets are split into papers of up to 180 questions (NEET order: P → C → B).
import { DrAzkaLoader } from "@/components/dr-akza-loader";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ChevronDown, FileText, Monitor, Play } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { FeatureLock } from "@/components/feature-lock";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/pyqs")({
  head: () => ({ meta: [{ title: "NEET PYQs — Year-wise Papers | NEET Track" }] }),
  component: () => (<FeatureLock feature="pyqs"><PyqPage /></FeatureLock>),
});

type Sum = { exam: string; year: number; total: number; physics: number; chemistry: number; biology: number };
const PART = 180;
const MEDICAL = ["AIPMT", "AIIMS"];
const db = supabase as any;

function PyqPage() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [rows, setRows] = useState<Sum[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [showOther, setShowOther] = useState(false);
  const [view, setView] = useState<"year" | "chapter">("year");

  useEffect(() => { if (!loading && !user) nav({ to: "/login" }); }, [user, loading, nav]);
  useEffect(() => {
    db.rpc("pyq_summary").then(({ data, error }: any) => {
      if (error) toast.error("Could not load PYQs");
      setRows(((data ?? []) as any[]).map((r) => ({ ...r, total: Number(r.total), physics: Number(r.physics), chemistry: Number(r.chemistry), biology: Number(r.biology) })));
    });
  }, []);

  const neet = useMemo(() => (rows ?? []).filter((r) => r.exam === "NEET" && r.total >= 50).sort((a, b) => b.year - a.year), [rows]);
  const neetOld = useMemo(() => (rows ?? []).filter((r) => r.exam === "NEET" && r.total < 50), [rows]);
  const byExam = (list: string[], not = false) => {
    const m = new Map<string, Sum[]>();
    (rows ?? []).filter((r) => r.exam !== "NEET" && (not ? !list.includes(r.exam) : list.includes(r.exam)))
      .forEach((r) => m.set(r.exam, [...(m.get(r.exam) ?? []), r]));
    return [...m.entries()].map(([exam, ys]) => ({ exam, years: ys.sort((a, b) => b.year - a.year), total: ys.reduce((t, y) => t + y.total, 0) }))
      .sort((a, b) => b.total - a.total);
  };
  const medical = useMemo(() => byExam(MEDICAL), [rows]); // eslint-disable-line react-hooks/exhaustive-deps
  const others = useMemo(() => byExam(MEDICAL, true), [rows]); // eslint-disable-line react-hooks/exhaustive-deps

  async function start(exam: string, years: number[], part: number, mode: "quiz" | "cbt", label: string) {
    if (!user) return;
    const key = `${exam}-${years.join(",")}-${part}-${mode}`;
    setBusy(key);
    try {
      let ids: string[] = [];
      for (const y of years) {
        const { data, error } = await db.rpc("pyq_paper_ids", { p_exam: exam, p_year: y });
        if (error) throw new Error(error.message);
        ids.push(...((data ?? []) as string[]));
      }
      ids = ids.slice(part * PART, part * PART + PART);
      if (!ids.length) throw new Error("No questions in this paper yet");
      const { data: t, error } = await supabase.from("tests").insert({
        title: label, type: "custom", difficulty: "medium",
        duration_min: Math.max(20, Math.round((ids.length * 200) / 180)), total_questions: ids.length,
        question_ids: ids, created_by: user.id, source: "PYQ", marks_correct: 4, marks_wrong: -1,
      } as never).select("id").maybeSingle();
      if (error || !t) throw new Error(error?.message ?? "Could not start");
      nav({ to: "/quiz/$testId", params: { testId: (t as { id: string }).id }, search: { mode } as never });
    } catch (e: any) { toast.error(e?.message ?? "Could not start"); }
    finally { setBusy(null); }
  }

  const parts = (n: number) => Math.max(1, Math.ceil(n / PART));

  return (
    <PageShell>
      <style>{PY_CSS}</style>
      <section className="py-hero">
        <div className="py-hero-bg" />
        <div className="relative">
          <span className="py-eyebrow"><span />PREVIOUS YEAR PAPERS</span>
          <h1 className="mt-1.5 text-[30px] font-extrabold leading-tight text-white sm:text-4xl">NEET <span className="py-grad">PYQs</span></h1>
          <p className="mt-1.5 max-w-xl text-sm text-slate-300">Solve real NEET papers year by year in the exact paper order (Physics → Chemistry → Biology), in practice mode or on the NTA CBT screen. +4 / −1 marking.</p>
        </div>
      </section>

      <div className="py-tabs">
        <button type="button" className={cn(view === "year" && "on")} onClick={() => setView("year")}>Year-wise papers</button>
        <button type="button" className={cn(view === "chapter" && "on")} onClick={() => setView("chapter")}>Chapter-wise PYQs</button>
      </div>

      {view === "chapter" ? <ChapterWise /> : rows === null ? <DrAzkaLoader size="sm" message="Loading previous year papers" className="py-12" /> : (
        <>
          <h2 className="py-h"><FileText className="h-4 w-4" />NEET papers</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {neet.map((r, i) => Array.from({ length: parts(r.total) }, (_, p) => {
              const n = Math.min(PART, r.total - p * PART);
              const label = `NEET ${r.year}${parts(r.total) > 1 ? ` · Paper ${p + 1}` : ""}`;
              return (
                <div key={`${r.year}-${p}`} className="py-card" style={{ animationDelay: `${Math.min(i, 10) * 40}ms` }}>
                  <div className="flex items-start gap-3">
                    <span className="py-year"><small>NEET</small>{r.year}</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[15px] font-extrabold">{label}</div>
                      <div className="text-xs text-muted-foreground">{n} questions · {Math.round((n * 200) / 180)} min · {n * 4} marks</div>
                      <div className="py-split" title="Physics · Chemistry · Biology">
                        <i style={{ flex: r.physics, background: "#3B82F6" }} /><i style={{ flex: r.chemistry, background: "#10B981" }} /><i style={{ flex: r.biology, background: "#A855F7" }} />
                      </div>
                      <div className="mt-1 flex gap-3 text-[10.5px] font-semibold text-muted-foreground"><span>P {r.physics}</span><span>C {r.chemistry}</span><span>B {r.biology}</span></div>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button type="button" disabled={!!busy} onClick={() => start("NEET", [r.year], p, "quiz", `${label} · PYQ`)} className="py-btn">
                      <Play className="h-4 w-4" />{busy === `NEET-${r.year}-${p}-quiz` ? "Opening…" : "Practice"}
                    </button>
                    <button type="button" disabled={!!busy} onClick={() => start("NEET", [r.year], p, "cbt", `${label} · PYQ`)} className="py-btn cbt">
                      <Monitor className="h-4 w-4" />{busy === `NEET-${r.year}-${p}-cbt` ? "Opening…" : "NTA CBT mode"}
                    </button>
                  </div>
                </div>
              );
            }))}
          </div>
          {neetOld.length > 0 && (
            <ExamRow exam="NEET (older, partial)" note="A few questions from earlier NEET years" years={neetOld} examKey="NEET" busy={busy} onStart={start} />
          )}

          {medical.length > 0 && <>
            <h2 className="py-h mt-7"><FileText className="h-4 w-4" />Other medical exams</h2>
            <div className="space-y-3">
              {medical.map((g) => <ExamRow key={g.exam} exam={g.exam} note={g.exam === "AIPMT" ? "Pre-NEET all-India medical exam" : "AIIMS MBBS entrance"} years={g.years} examKey={g.exam} busy={busy} onStart={start} />)}
            </div>
          </>}

          {others.length > 0 && <>
            <button type="button" onClick={() => setShowOther((v) => !v)} className="py-h mt-7 w-full justify-between">
              <span className="inline-flex items-center gap-2"><FileText className="h-4 w-4" />State CETs & JEE (extra practice)</span>
              <ChevronDown className={cn("h-4 w-4 transition", showOther && "rotate-180")} />
            </button>
            {showOther && <div className="space-y-3">
              {others.map((g) => <ExamRow key={g.exam} exam={g.exam} note="Physics & Chemistry practice from other entrance exams" years={g.years} examKey={g.exam} busy={busy} onStart={start} />)}
            </div>}
          </>}
        </>
      )}
    </PageShell>
  );
}

const SINCE = new Date().getFullYear() - 15;
const SET = 50;
const SUBJ = [["physics", "Physics", "#3B82F6"], ["chemistry", "Chemistry", "#10B981"], ["biology", "Biology", "#A855F7"]] as const;
type ChSum = { chapter_id: string; subject_id: string; total: number; neet: number; min_year: number; max_year: number; name: string; cls: number | null; order: number };

/** Every PYQ of a chapter from the last 15 years, all exams combined (each question shows its exam and year). */
function ChapterWise() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [list, setList] = useState<ChSum[] | null>(null);
  const [subj, setSubj] = useState<string>("biology");
  const [neetOnly, setNeetOnly] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([db.rpc("pyq_chapter_summary", { p_since: SINCE }), db.from("chapters").select("id,name,class,order_index")]).then(([a, b]: any[]) => {
      const ch = new Map<string, any>(((b.data ?? []) as any[]).map((c) => [String(c.id), c]));
      setList(((a.data ?? []) as any[]).map((r) => {
        const c = ch.get(String(r.chapter_id));
        return { ...r, total: Number(r.total), neet: Number(r.neet), name: c?.name ?? "Chapter", cls: c?.class ?? null, order: c?.order_index ?? 0 };
      }));
    });
  }, []);

  const shown = (list ?? []).filter((c) => c.subject_id === subj && (neetOnly ? c.neet > 0 : c.total > 0))
    .sort((a, b) => (a.cls ?? 0) - (b.cls ?? 0) || a.name.localeCompare(b.name));

  async function open(c: ChSum, set: number, mode: "quiz" | "cbt") {
    if (!user) return;
    const key = `${c.chapter_id}-${set}-${mode}`;
    setBusy(key);
    try {
      const { data, error } = await db.rpc("pyq_chapter_ids", { p_chapter: c.chapter_id, p_neet_only: neetOnly, p_since: SINCE });
      if (error) throw new Error(error.message);
      const ids = ((data ?? []) as string[]).slice(set * SET, set * SET + SET);
      if (!ids.length) throw new Error("No PYQs here yet");
      const sets = Math.ceil((neetOnly ? c.neet : c.total) / SET);
      const { data: t, error: e2 } = await supabase.from("tests").insert({
        title: `${c.name} · PYQs${neetOnly ? " (NEET)" : ""}${sets > 1 ? ` · Set ${set + 1}` : ""}`, type: "custom", difficulty: "medium",
        duration_min: Math.max(10, Math.round((ids.length * 200) / 180)), total_questions: ids.length,
        question_ids: ids, created_by: user.id, source: "PYQ", marks_correct: 4, marks_wrong: -1,
      } as never).select("id").maybeSingle();
      if (e2 || !t) throw new Error(e2?.message ?? "Could not start");
      nav({ to: "/quiz/$testId", params: { testId: (t as { id: string }).id }, search: { mode } as never });
    } catch (e: any) { toast.error(e?.message ?? "Could not start"); }
    finally { setBusy(null); }
  }

  if (list === null) return <DrAzkaLoader size="sm" message="Loading chapter-wise PYQs" className="py-12" />;
  return (
    <div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {SUBJ.map(([k, l, c]) => (
          <button key={k} type="button" onClick={() => setSubj(k)} className="py-sub" style={subj === k ? { background: c, color: "#fff", borderColor: "transparent" } : undefined}>{l}</button>
        ))}
        <label className="ml-auto inline-flex items-center gap-2 text-xs font-bold">
          <input type="checkbox" checked={neetOnly} onChange={(e) => setNeetOnly(e.target.checked)} className="h-4 w-4 accent-emerald-500" />NEET only
        </label>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Last 15 years ({SINCE}–{new Date().getFullYear()}), newest first. {neetOnly ? "NEET papers only." : "NEET, AIPMT, AIIMS, JEE Main and state CET questions combined; each question shows its exam and year."}</p>
      <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
        {shown.map((c, i) => {
          const n = neetOnly ? c.neet : c.total, sets = Math.ceil(n / SET);
          return (
            <div key={c.chapter_id} className="py-card" style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[10.5px] font-extrabold uppercase tracking-wider text-muted-foreground">Class {c.cls ?? "—"}</div>
                  <div className="text-[15px] font-extrabold leading-snug">{c.name}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">{n} PYQs · {c.min_year}–{c.max_year}</div>
                </div>
                {!neetOnly && <span className="py-neet">{c.neet} NEET</span>}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {Array.from({ length: sets }, (_, s) => (
                  <span key={s} className="inline-flex overflow-hidden rounded-xl border">
                    <button type="button" disabled={!!busy} onClick={() => open(c, s, "quiz")} className="px-3 py-2 text-xs font-extrabold hover:bg-secondary">
                      {busy === `${c.chapter_id}-${s}-quiz` ? "…" : sets > 1 ? `Set ${s + 1}` : "Practice"} <span className="font-semibold text-muted-foreground">({Math.min(SET, n - s * SET)})</span>
                    </button>
                    <button type="button" disabled={!!busy} onClick={() => open(c, s, "cbt")} className="border-l px-2.5 py-2 text-[11px] font-extrabold text-primary hover:bg-secondary">CBT</button>
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ExamRow({ exam, note, years, examKey, busy, onStart }: {
  exam: string; note: string; years: Sum[]; examKey: string; busy: string | null;
  onStart: (exam: string, years: number[], part: number, mode: "quiz" | "cbt", label: string) => void;
}) {
  // Small years are bundled together so every paper has a useful number of questions.
  const papers = useMemo(() => {
    const out: { label: string; years: number[]; n: number; part: number }[] = [];
    let bucket: Sum[] = [];
    const flush = () => {
      if (!bucket.length) return;
      const ys = bucket.map((b) => b.year), n = bucket.reduce((t, b) => t + b.total, 0);
      out.push({ label: ys.length > 1 ? `${Math.min(...ys)}–${Math.max(...ys)}` : `${ys[0]}`, years: ys, n, part: 0 });
      bucket = [];
    };
    for (const y of years) {
      if (y.total >= 40) {
        flush();
        for (let p = 0; p * PART < y.total; p++) out.push({ label: `${y.year}${y.total > PART ? ` · P${p + 1}` : ""}`, years: [y.year], n: Math.min(PART, y.total - p * PART), part: p });
      } else {
        bucket.push(y);
        if (bucket.reduce((t, b) => t + b.total, 0) >= 40) flush();
      }
    }
    flush();
    return out;
  }, [years]);
  return (
    <div className="py-exam">
      <div className="flex items-baseline justify-between gap-2">
        <div><div className="text-[15px] font-extrabold">{exam}</div><div className="text-xs text-muted-foreground">{note}</div></div>
        <span className="text-xs font-semibold text-muted-foreground">{years.reduce((t, y) => t + y.total, 0)} Qs</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {papers.map((p) => (
          <button key={p.label} type="button" disabled={!!busy} onClick={() => onStart(examKey, p.years, p.part, "quiz", `${exam} ${p.label} · PYQ`)} className="py-chip">
            <b>{p.label}</b><small>{p.n} Qs</small>
          </button>
        ))}
      </div>
    </div>
  );
}

const PY_CSS = `
.py-hero{position:relative;overflow:hidden;border-radius:26px;padding:22px 20px;background:#071226;border:1px solid rgba(96,165,250,.25)}
.py-hero-bg{position:absolute;inset:0;background:radial-gradient(360px 220px at 95% 0%,rgba(59,130,246,.35),transparent 70%),radial-gradient(320px 220px at 0% 100%,rgba(168,85,247,.25),transparent 70%)}
.py-eyebrow{display:inline-flex;align-items:center;gap:7px;font-size:11px;font-weight:800;letter-spacing:.18em;color:#93C5FD}
.py-eyebrow span{width:7px;height:7px;border-radius:50%;background:#22D3EE}
.py-grad{background:linear-gradient(90deg,#60A5FA,#C084FC);-webkit-background-clip:text;background-clip:text;color:transparent}
.py-tabs{position:sticky;top:0;z-index:10;display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-top:14px;padding:5px;border-radius:16px;border:1px solid var(--border);background:color-mix(in oklab,var(--card) 92%,transparent);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px)}
.py-tabs button{height:40px;border-radius:12px;font-size:13.5px;font-weight:800;color:var(--muted-foreground)}
.py-tabs button.on{color:#fff;background:linear-gradient(90deg,#3B82F6,#7C3AED)}
.py-sub{height:34px;padding:0 14px;border-radius:999px;border:1px solid var(--border);background:var(--card);font-size:13px;font-weight:800}
.py-neet{flex:none;border-radius:999px;padding:3px 9px;font-size:10.5px;font-weight:800;color:#059669;background:rgba(16,185,129,.14)}
.py-h{display:flex;align-items:center;gap:8px;margin:20px 0 10px;font-size:15px;font-weight:800}
.py-card{border-radius:20px;padding:14px;border:1px solid var(--border);background:var(--card);animation:py-up .4s cubic-bezier(.2,.8,.2,1) both}
@keyframes py-up{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
.py-year{flex:none;display:grid;place-items:center;width:58px;height:58px;border-radius:16px;font-size:17px;font-weight:900;line-height:1;color:#fff;background:linear-gradient(135deg,#2563EB,#7C3AED);box-shadow:0 10px 22px -12px #2563EB}
.py-year small{display:block;font-size:9px;font-weight:800;letter-spacing:.1em;opacity:.8;margin-bottom:-6px}
.py-split{display:flex;gap:2px;height:6px;margin-top:8px;border-radius:6px;overflow:hidden}
.py-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;height:40px;border-radius:12px;font-size:13px;font-weight:800;color:#fff;background:linear-gradient(90deg,#3B82F6,#22D3EE)}
.py-btn.cbt{color:var(--foreground);background:var(--secondary);border:1px solid var(--border)}
.py-btn:disabled{opacity:.6}
.py-exam{border-radius:20px;padding:14px;border:1px solid var(--border);background:var(--card)}
.py-chip{display:inline-flex;flex-direction:column;align-items:flex-start;padding:7px 12px;border-radius:12px;border:1px solid var(--border);background:var(--background);line-height:1.2}
.py-chip b{font-size:13px}.py-chip small{font-size:10.5px;color:var(--muted-foreground)}
.py-chip:disabled{opacity:.6}
`;
