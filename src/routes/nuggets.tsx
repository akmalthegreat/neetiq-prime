// NCERT Nuggets: read the key NCERT lines of a topic, then solve questions from the bank on exactly those lines.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, BookOpenCheck, Check, ChevronRight, Lightbulb, RotateCcw, Sparkles, Trophy, X } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { DrAzkaLoader } from "@/components/dr-akza-loader";
import { CardText } from "@/components/card-text";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/nuggets")({
  head: () => ({ meta: [{ title: "NCERT Nuggets — NEET Track" }, { name: "description", content: "Read the most important NCERT lines, then solve NEET questions on them. Chapter-wise Biology nuggets." }] }),
  component: NuggetsPage,
});

const db = supabase as any;
type Meta = { id: string; chapter_id: string; class: number; chapter_title: string; chapter_order: number; position: number; title: string };
type Full = Meta & { lines: string[]; tip: string | null; questions: { id: string; why: string }[] };
type Q = { id: string; text: string; options: string[]; correct_index: number };
type Prog = Record<string, { correct: number; total: number }>;

function NuggetsPage() {
  const { user, loading: authLoading } = useAuth();
  const [all, setAll] = useState<Meta[] | null>(null);
  const [prog, setProg] = useState<Prog>({});
  const [chapter, setChapter] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [cls, setCls] = useState<0 | 11 | 12>(0);

  useEffect(() => {
    if (authLoading) return;
    db.from("ncert_nuggets").select("id,chapter_id,class,chapter_title,chapter_order,position,title").eq("is_active", true)
      .order("chapter_order").order("position").limit(2000)
      .then(({ data, error }: any) => { if (error) toast.error("Could not load nuggets"); setAll((data ?? []) as Meta[]); });
    if (user) db.from("nugget_progress").select("nugget_id,correct,total").eq("user_id", user.id).limit(5000)
      .then(({ data }: any) => { const p: Prog = {}; (data ?? []).forEach((r: any) => { p[r.nugget_id] = { correct: r.correct, total: r.total }; }); setProg(p); });
  }, [authLoading, user]);

  const chapters = useMemo(() => {
    const m = new Map<string, { id: string; title: string; cls: number; order: number; items: Meta[] }>();
    (all ?? []).forEach((n) => {
      const c = m.get(n.chapter_id) ?? { id: n.chapter_id, title: n.chapter_title, cls: n.class, order: n.chapter_order, items: [] };
      c.items.push(n); m.set(n.chapter_id, c);
    });
    return [...m.values()].sort((a, b) => a.order - b.order);
  }, [all]);

  const totals = useMemo(() => {
    const n = all?.length ?? 0; const done = (all ?? []).filter((x) => prog[x.id]).length;
    return { n, done, pct: n ? Math.round((done / n) * 100) : 0 };
  }, [all, prog]);

  const onSaved = (id: string, correct: number, total: number) => setProg((p) => ({ ...p, [id]: { correct, total } }));

  if (all === null) return <PageShell><DrAzkaLoader message="Opening NCERT Nuggets" /></PageShell>;

  const ch = chapters.find((c) => c.id === chapter) ?? null;

  if (ch && openId) {
    const idx = ch.items.findIndex((x) => x.id === openId);
    return (
      <PageShell>
        <style>{NG_CSS}</style>
        <Player key={openId} meta={ch.items[idx]} index={idx} count={ch.items.length} user={user?.id ?? null}
          onBack={() => setOpenId(null)} onSaved={onSaved}
          onNext={idx + 1 < ch.items.length ? () => setOpenId(ch.items[idx + 1].id) : null} />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <style>{NG_CSS}</style>
      {ch ? (
        <div className="mx-auto max-w-3xl">
          <button type="button" onClick={() => setChapter(null)} className="ng-back"><ArrowLeft className="h-4 w-4" />All chapters</button>
          <div className="ng-chhead">
            <div className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-emerald-300">Class {ch.cls} · Biology</div>
            <h1 className="mt-1 text-2xl font-extrabold text-white sm:text-3xl">{ch.title}</h1>
            <p className="mt-1 text-sm text-slate-300">{ch.items.length} nuggets · read the lines, then solve the questions.</p>
          </div>
          <ol className="mt-4 space-y-2.5">
            {ch.items.map((n, i) => {
              const p = prog[n.id]; const perfect = p && p.correct === p.total;
              return (
                <li key={n.id}>
                  <button type="button" onClick={() => { setOpenId(n.id); window.scrollTo({ top: 0 }); }} className="ng-row group" style={{ animationDelay: `${Math.min(i, 14) * 30}ms` }}>
                    <span className={cn("ng-idx", p && (perfect ? "ok" : "part"))}>{p ? (perfect ? <Check className="h-4 w-4" /> : `${p.correct}/${p.total}`) : i + 1}</span>
                    <span className="min-w-0 flex-1 text-left">
                      <span className="block truncate text-[15px] font-bold">{n.title}</span>
                      <span className="text-xs text-muted-foreground">{p ? `Solved · ${p.correct} of ${p.total} correct` : "Read + solve"}</span>
                    </span>
                    <ChevronRight className="h-5 w-5 text-muted-foreground transition group-hover:translate-x-0.5" />
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      ) : (
        <>
          <section className="ng-hero">
            <div className="ng-hero-bg" />
            <div className="ng-gems" aria-hidden="true"><i /><i /><i /><i /></div>
            <div className="relative max-w-xl">
              <span className="ng-eyebrow"><span />Read · Recall · Solve</span>
              <h1 className="mt-2 text-[32px] font-extrabold leading-[1.05] tracking-tight text-white sm:text-5xl">NCERT <span className="ng-grad">Nuggets</span></h1>
              <p className="mt-3 text-sm leading-relaxed text-slate-300 sm:text-[15px]">The NCERT lines NEET asks from, topic by topic. Read 4–6 key lines, then solve questions on exactly those lines with clear explanations.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="ng-stat"><b>{chapters.length}</b> Biology chapters</span>
                <span className="ng-stat"><b>{totals.n}</b> nuggets</span>
                <span className="ng-stat"><b>{totals.done}</b> solved · {totals.pct}%</span>
              </div>
            </div>
          </section>
          <div className="mt-4 flex gap-2">
            {([0, 11, 12] as const).map((c) => (
              <button key={c} type="button" onClick={() => setCls(c)} className={cn("ng-chip", cls === c && "on")}>{c ? `Class ${c}` : "All"}</button>
            ))}
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {chapters.filter((c) => !cls || c.cls === cls).map((c, i) => {
              const done = c.items.filter((x) => prog[x.id]).length; const pct = Math.round((done / c.items.length) * 100);
              return (
                <button key={c.id} type="button" onClick={() => { setChapter(c.id); window.scrollTo({ top: 0 }); }} className="ng-card group" style={{ animationDelay: `${Math.min(i, 12) * 35}ms` }}>
                  <div className="flex items-start gap-3">
                    <span className="ng-num">{String(i + 1).padStart(2, "0")}</span>
                    <span className="min-w-0 flex-1 text-left">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-300">Class {c.cls}</span>
                      <span className="block text-[15px] font-bold leading-snug">{c.title}</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">{c.items.length} nuggets · {done} solved</span>
                    </span>
                    <ArrowRight className="mt-1 h-4 w-4 text-muted-foreground transition group-hover:translate-x-0.5" />
                  </div>
                  <span className="ng-bar"><i style={{ width: `${pct}%` }} /></span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </PageShell>
  );
}

function Player({ meta, index, count, user, onBack, onNext, onSaved }: {
  meta: Meta; index: number; count: number; user: string | null;
  onBack: () => void; onNext: (() => void) | null; onSaved: (id: string, c: number, t: number) => void;
}) {
  const [full, setFull] = useState<Full | null>(null);
  const [qs, setQs] = useState<Q[] | null>(null);
  const [phase, setPhase] = useState<"read" | "solve" | "done">("read");
  const [qi, setQi] = useState(0);
  const [picked, setPicked] = useState<Record<string, number>>({});

  useEffect(() => {
    let live = true;
    (async () => {
      const { data } = await db.from("ncert_nuggets").select("id,chapter_id,class,chapter_title,chapter_order,position,title,lines,tip,questions").eq("id", meta.id).maybeSingle();
      if (!live || !data) return;
      setFull(data as Full);
      const ids = ((data as Full).questions ?? []).map((q) => q.id);
      const { data: rows } = await db.from("questions").select("id,text,options,correct_index").in("id", ids);
      if (!live) return;
      const byId = new Map(((rows ?? []) as Q[]).map((r) => [r.id, r]));
      setQs(ids.map((id) => byId.get(id)).filter(Boolean) as Q[]);
    })();
    return () => { live = false; };
  }, [meta.id]);

  if (!full) return <DrAzkaLoader size="sm" message="Loading nugget" className="py-12" />;
  const why = new Map(full.questions.map((q) => [q.id, q.why]));
  const q = qs?.[qi];
  const correct = (qs ?? []).filter((x) => picked[x.id] === x.correct_index).length;

  async function finish() {
    setPhase("done");
    const total = qs?.length ?? 0;
    onSaved(meta.id, correct, total);
    if (user) {
      await db.from("nugget_progress").upsert({ user_id: user, nugget_id: meta.id, chapter_id: meta.chapter_id, answers: picked, correct, total, completed_at: new Date().toISOString(), updated_at: new Date().toISOString() }, { onConflict: "user_id,nugget_id" });
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-3 flex items-center gap-3">
        <button type="button" onClick={onBack} className="grid h-10 w-10 shrink-0 place-items-center rounded-full border bg-card" aria-label="Back"><ArrowLeft className="h-4 w-4" /></button>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[11px] font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-300">{meta.chapter_title} · Nugget {index + 1}/{count}</div>
          <div className="truncate text-base font-bold">{full.title}</div>
        </div>
      </div>
      <div className="ng-steps">
        <span className={cn(phase === "read" && "on", phase !== "read" && "done")}><BookOpenCheck className="h-3.5 w-3.5" />Read</span>
        <i className={cn(phase !== "read" && "done")} />
        <span className={cn(phase === "solve" && "on", phase === "done" && "done")}><Sparkles className="h-3.5 w-3.5" />Solve</span>
        <i className={cn(phase === "done" && "done")} />
        <span className={cn(phase === "done" && "on")}><Trophy className="h-3.5 w-3.5" />Score</span>
      </div>

      {phase === "read" && (
        <div className="ng-sheet">
          <div className="ng-sheet-head"><span>NCERT key lines</span><em>{full.lines.length} lines</em></div>
          <ol className="space-y-3">
            {full.lines.map((l, i) => (
              <li key={i} className="ng-line" style={{ animationDelay: `${120 + i * 160}ms` }}>
                <span className="ng-ln">{i + 1}</span><span className="ng-lt"><CardText>{l}</CardText></span>
              </li>
            ))}
          </ol>
          {full.tip && <div className="ng-tip" style={{ animationDelay: `${200 + full.lines.length * 160}ms` }}><Lightbulb className="mt-0.5 h-4 w-4 shrink-0" /><span><CardText>{full.tip}</CardText></span></div>}
          <button type="button" disabled={!qs} onClick={() => { setPhase("solve"); setQi(0); window.scrollTo({ top: 0 }); }} className="ng-cta mt-5 w-full justify-center">
            {qs ? <>I've read it · Solve {qs.length} questions<ArrowRight className="h-4 w-4" /></> : "Loading questions…"}
          </button>
        </div>
      )}

      {phase === "solve" && q && (
        <div key={q.id} className="ng-q">
          <div className="mb-2 flex items-center justify-between text-xs font-bold text-muted-foreground">
            <span>Question {qi + 1} of {qs!.length}</span>
            <span className="flex gap-1">{qs!.map((x, i) => <i key={x.id} className={cn("ng-dot", i === qi && "cur", picked[x.id] !== undefined && (picked[x.id] === x.correct_index ? "ok" : "bad"))} />)}</span>
          </div>
          <div className="text-[16.5px] font-semibold leading-relaxed"><CardText>{q.text}</CardText></div>
          <div className="mt-4 space-y-2">
            {q.options.map((o, i) => {
              const sel = picked[q.id]; const shown = sel !== undefined;
              const state = !shown ? "" : i === q.correct_index ? "ok" : i === sel ? "bad" : "dim";
              return (
                <button key={i} type="button" disabled={shown} onClick={() => setPicked((p) => ({ ...p, [q.id]: i }))} className={cn("ng-opt", state)}>
                  <span className="ng-ol">{shown && i === q.correct_index ? <Check className="h-4 w-4" /> : shown && i === sel ? <X className="h-4 w-4" /> : String.fromCharCode(65 + i)}</span>
                  <span className="min-w-0 flex-1 text-left"><CardText>{o}</CardText></span>
                </button>
              );
            })}
          </div>
          {picked[q.id] !== undefined && (
            <div className={cn("ng-why", picked[q.id] === q.correct_index ? "ok" : "bad")}>
              <div className="mb-1 text-xs font-extrabold uppercase tracking-wider">{picked[q.id] === q.correct_index ? "Correct!" : `Answer: ${String.fromCharCode(65 + q.correct_index)}`}</div>
              <CardText>{why.get(q.id) ?? ""}</CardText>
            </div>
          )}
          {picked[q.id] !== undefined && (
            <button type="button" onClick={() => (qi + 1 < qs!.length ? setQi(qi + 1) : void finish())} className="ng-cta mt-4 w-full justify-center">
              {qi + 1 < qs!.length ? <>Next question<ArrowRight className="h-4 w-4" /></> : <>See my score<Trophy className="h-4 w-4" /></>}
            </button>
          )}
        </div>
      )}

      {phase === "done" && (
        <div className="ng-done">
          {correct === qs!.length && <div className="ng-confetti" aria-hidden="true">{Array.from({ length: 24 }, (_, i) => <i key={i} style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i % 8) * 0.08}s`, background: ["#34D399", "#FBBF24", "#60A5FA", "#F472B6"][i % 4] }} />)}</div>}
          <div className="ng-score"><b>{correct}</b><span>/ {qs!.length}</span></div>
          <div className="mt-2 text-lg font-extrabold">{correct === qs!.length ? "Perfect! Nugget mastered" : correct >= qs!.length / 2 ? "Good work. Re-read the lines you missed" : "Read the lines once more, then retry"}</div>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
            {onNext && <button type="button" onClick={onNext} className="ng-cta justify-center">Next nugget<ArrowRight className="h-4 w-4" /></button>}
            <button type="button" onClick={() => { setPicked({}); setQi(0); setPhase("read"); }} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-semibold"><RotateCcw className="h-4 w-4" />Read & retry</button>
            <button type="button" onClick={onBack} className="inline-flex h-11 items-center justify-center rounded-xl border px-4 text-sm font-semibold">All nuggets</button>
          </div>
        </div>
      )}
      <p className="mt-6 text-center text-xs text-muted-foreground">Stuck on a line? <Link to="/flashcards" className="font-semibold text-primary">Revise with flashcards</Link></p>
    </div>
  );
}

const NG_CSS = `
.ng-hero{position:relative;overflow:hidden;border-radius:28px;padding:24px 20px;background:#05140F;border:1px solid rgba(52,211,153,.22);box-shadow:0 30px 60px -36px rgba(16,185,129,.7)}
@media (min-width:640px){.ng-hero{padding:36px 34px}}
.ng-hero-bg{position:absolute;inset:0;background:radial-gradient(420px 260px at 90% 0%,rgba(250,204,21,.25),transparent 70%),radial-gradient(420px 280px at 70% 100%,rgba(16,185,129,.35),transparent 70%),radial-gradient(300px 200px at 0% 0%,rgba(59,130,246,.18),transparent 70%)}
.ng-gems{position:absolute;right:-10px;top:10px;width:170px;height:170px;opacity:.55}
@media (min-width:640px){.ng-gems{right:50px;top:50%;margin-top:-90px;opacity:1}}
.ng-gems i{position:absolute;width:44px;height:44px;border-radius:12px;transform:rotate(45deg);background:linear-gradient(135deg,#FDE68A,#F59E0B);box-shadow:0 0 24px rgba(251,191,36,.6),inset 0 1px 0 rgba(255,255,255,.6);animation:ng-float 4s ease-in-out infinite}
.ng-gems i:nth-child(1){left:60px;top:10px}
.ng-gems i:nth-child(2){left:10px;top:70px;width:34px;height:34px;background:linear-gradient(135deg,#6EE7B7,#059669);box-shadow:0 0 22px rgba(16,185,129,.6);animation-delay:-1s}
.ng-gems i:nth-child(3){left:110px;top:80px;width:30px;height:30px;background:linear-gradient(135deg,#93C5FD,#2563EB);box-shadow:0 0 22px rgba(59,130,246,.6);animation-delay:-2s}
.ng-gems i:nth-child(4){left:60px;top:120px;width:24px;height:24px;background:linear-gradient(135deg,#F9A8D4,#DB2777);animation-delay:-3s}
@keyframes ng-float{0%,100%{translate:0 0}50%{translate:0 -8px}}
.ng-eyebrow{display:inline-flex;align-items:center;gap:8px;font-size:11px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;color:#6EE7B7}
.ng-eyebrow span{width:7px;height:7px;border-radius:50%;background:#FBBF24;box-shadow:0 0 0 4px rgba(251,191,36,.2)}
.ng-grad{background:linear-gradient(90deg,#FDE68A,#34D399);-webkit-background-clip:text;background-clip:text;color:transparent}
.ng-stat{display:inline-flex;align-items:center;gap:6px;height:30px;padding:0 11px;border-radius:999px;font-size:12px;color:#CBD5E1;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12)}
.ng-stat b{color:#fff}
.ng-chip{height:34px;padding:0 14px;border-radius:999px;border:1px solid var(--border);background:var(--card);font-size:13px;font-weight:700;color:var(--muted-foreground)}
.ng-chip.on{color:#04221A;border-color:transparent;background:linear-gradient(90deg,#34D399,#FDE68A)}
.ng-card{display:block;width:100%;border-radius:20px;padding:14px;border:1px solid var(--border);background:var(--card);transition:transform .2s,border-color .2s,box-shadow .2s;animation:ng-up .4s cubic-bezier(.2,.8,.2,1) both}
.ng-card:hover{transform:translateY(-2px);border-color:rgba(16,185,129,.5);box-shadow:0 18px 36px -24px rgba(16,185,129,.8)}
.ng-num{flex:none;display:grid;place-items:center;width:40px;height:40px;border-radius:12px;font-weight:900;font-size:14px;color:#04221A;background:linear-gradient(135deg,#6EE7B7,#FDE68A)}
.ng-bar{display:block;margin-top:12px;height:5px;border-radius:99px;background:var(--secondary);overflow:hidden}
.ng-bar i{display:block;height:100%;border-radius:99px;background:linear-gradient(90deg,#10B981,#FBBF24);transition:width .6s}
.ng-back{display:inline-flex;align-items:center;gap:6px;height:36px;padding:0 13px;border-radius:999px;border:1px solid var(--border);background:var(--card);font-size:13px;font-weight:700;color:#10B981}
.ng-chhead{margin-top:12px;border-radius:24px;padding:20px;background:radial-gradient(400px 200px at 100% 0%,rgba(251,191,36,.22),transparent 70%),linear-gradient(140deg,#064E3B,#05140F);border:1px solid rgba(52,211,153,.25)}
.ng-row{display:flex;width:100%;align-items:center;gap:12px;padding:12px 14px;border-radius:18px;border:1px solid var(--border);background:var(--card);transition:border-color .2s,transform .2s;animation:ng-up .35s cubic-bezier(.2,.8,.2,1) both}
.ng-row:hover{border-color:rgba(16,185,129,.5);transform:translateX(2px)}
.ng-idx{flex:none;display:grid;place-items:center;min-width:36px;height:36px;padding:0 6px;border-radius:12px;font-size:12px;font-weight:800;background:var(--secondary)}
.ng-idx.ok{color:#fff;background:linear-gradient(135deg,#10B981,#059669)}
.ng-idx.part{color:#92400E;background:rgba(251,191,36,.25)}
.ng-steps{display:flex;align-items:center;gap:6px;margin-bottom:14px}
.ng-steps span{display:inline-flex;align-items:center;gap:5px;height:28px;padding:0 10px;border-radius:999px;font-size:11.5px;font-weight:800;color:var(--muted-foreground);border:1px solid var(--border);background:var(--card)}
.ng-steps span.on{color:#04221A;border-color:transparent;background:linear-gradient(90deg,#34D399,#FDE68A)}
.ng-steps span.done{color:#10B981;border-color:rgba(16,185,129,.4)}
.ng-steps i{flex:1;height:2px;border-radius:2px;background:var(--border)}
.ng-steps i.done{background:#10B981}
.ng-sheet{border-radius:24px;padding:18px;border:1px solid var(--border);background:radial-gradient(500px 220px at 100% 0%,rgba(16,185,129,.10),transparent 60%),var(--card)}
.ng-sheet-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;font-size:11px;font-weight:900;letter-spacing:.16em;text-transform:uppercase;color:#10B981}
.ng-sheet-head em{font-style:normal;letter-spacing:0;color:var(--muted-foreground)}
.ng-line{display:flex;gap:12px;align-items:flex-start;opacity:0;animation:ng-in .5s cubic-bezier(.2,.8,.2,1) forwards}
.ng-ln{flex:none;display:grid;place-items:center;width:26px;height:26px;margin-top:1px;border-radius:9px;font-size:12px;font-weight:900;color:#04221A;background:linear-gradient(135deg,#6EE7B7,#FDE68A)}
.ng-lt{font-size:15.5px;line-height:1.6}
.ng-lt b{color:#059669;font-weight:800;background:linear-gradient(transparent 62%,rgba(251,191,36,.35) 62%);padding:0 1px}
.dark .ng-lt b{color:#6EE7B7}
.ng-tip{display:flex;gap:8px;margin-top:14px;border-radius:14px;padding:10px 12px;font-size:13.5px;line-height:1.45;color:#92400E;background:rgba(245,158,11,.12);border:1px solid rgba(245,158,11,.3);opacity:0;animation:ng-in .5s forwards}
.dark .ng-tip{color:#FCD34D}
.ng-cta{display:inline-flex;align-items:center;gap:8px;height:48px;padding:0 18px;border-radius:14px;font-weight:800;font-size:14.5px;color:#04221A;background:linear-gradient(90deg,#34D399,#FDE68A);box-shadow:0 14px 28px -14px rgba(16,185,129,.9)}
.ng-cta:disabled{opacity:.5}
.ng-q{border-radius:24px;padding:18px;border:1px solid var(--border);background:var(--card);animation:ng-up .35s cubic-bezier(.2,.8,.2,1) both}
.ng-dot{display:block;width:8px;height:8px;border-radius:50%;background:var(--border)}
.ng-dot.cur{outline:2px solid #10B981;outline-offset:1px}
.ng-dot.ok{background:#10B981}.ng-dot.bad{background:#F43F5E}
.ng-opt{display:flex;width:100%;align-items:center;gap:12px;padding:11px 12px;border-radius:14px;border:1.5px solid var(--border);background:var(--background);font-size:14.5px;transition:all .2s}
.ng-opt:not(:disabled):hover{border-color:#10B981}
.ng-ol{flex:none;display:grid;place-items:center;width:30px;height:30px;border-radius:10px;font-size:13px;font-weight:800;background:var(--secondary)}
.ng-opt.ok{border-color:#10B981;background:rgba(16,185,129,.1);animation:ng-pop .35s}
.ng-opt.ok .ng-ol{color:#fff;background:#10B981}
.ng-opt.bad{border-color:#F43F5E;background:rgba(244,63,94,.08);animation:ng-shake .35s}
.ng-opt.bad .ng-ol{color:#fff;background:#F43F5E}
.ng-opt.dim{opacity:.55}
.ng-why{margin-top:12px;border-radius:14px;padding:12px 14px;font-size:14px;line-height:1.55;animation:ng-up .3s both}
.ng-why.ok{background:rgba(16,185,129,.1);border:1px solid rgba(16,185,129,.35)}
.ng-why.ok > div{color:#059669}
.ng-why.bad{background:rgba(244,63,94,.07);border:1px solid rgba(244,63,94,.3)}
.ng-why.bad > div{color:#E11D48}
.ng-done{position:relative;overflow:hidden;border-radius:26px;padding:30px 20px;text-align:center;border:1px solid var(--border);background:radial-gradient(400px 220px at 50% 0%,rgba(16,185,129,.18),transparent 70%),var(--card)}
.ng-score{display:inline-flex;align-items:baseline;gap:6px;animation:ng-pop .5s}
.ng-score b{font-size:64px;font-weight:900;line-height:1;background:linear-gradient(180deg,#34D399,#059669);-webkit-background-clip:text;background-clip:text;color:transparent}
.ng-score span{font-size:22px;font-weight:800;color:var(--muted-foreground)}
.ng-confetti i{position:absolute;top:-10px;width:8px;height:14px;border-radius:2px;animation:ng-fall 1.8s ease-in forwards}
@keyframes ng-fall{to{transform:translateY(340px) rotate(540deg);opacity:0}}
@keyframes ng-in{from{opacity:0;transform:translateX(-10px)}to{opacity:1;transform:none}}
@keyframes ng-up{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
@keyframes ng-pop{0%{transform:scale(.96)}60%{transform:scale(1.02)}100%{transform:none}}
@keyframes ng-shake{0%,100%{transform:none}25%{transform:translateX(-4px)}75%{transform:translateX(4px)}}
@media (prefers-reduced-motion:reduce){.ng-line,.ng-tip{opacity:1;animation:none}.ng-gems i,.ng-card,.ng-row{animation:none}}
`;
