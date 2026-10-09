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

      {rows === null ? <DrAzkaLoader size="sm" message="Loading previous year papers" className="py-12" /> : (
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
