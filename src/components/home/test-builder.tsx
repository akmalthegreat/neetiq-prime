// "Create your own test" — 4-step builder on the home dashboard.
// Questions are picked through the signed-in student's own Supabase client (same rule
// as the Generate page) so every generated test only contains questions they can load.

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import type { ConsultData } from "@/components/consult/consult-ui";

type Snap = ConsultData["snapshot"];
type Subject = { id: string; name: string };
type Chapter = { id: string; name: string; subject_id: string; class: number | null };
type Mode = "practice" | "cbt" | "speed" | "revival";

const SUBJECT_STYLE: Record<string, { c: string; icon: ReactNode }> = {
  physics: { c: "#60A5FA", icon: <><circle cx="12" cy="12" r="1.6" fill="#60A5FA" /><ellipse cx="12" cy="12" rx="10" ry="4" /><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(60 12 12)" /><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(120 12 12)" /></> },
  chemistry: { c: "#34D399", icon: <path d="M9 3h6M10 3v6L4 19a2 2 0 0 0 1.7 3h12.6A2 2 0 0 0 20 19l-6-10V3M6.5 15h11" /> },
  biology: { c: "#C084FC", icon: <path d="M7 3c0 6 10 6 10 12s-10 3-10 6M17 3c0 6-10 6-10 12s10 3 10 6M8 7h8M8 17h8" /> },
};
const styleFor = (id: string) => SUBJECT_STYLE[id.toLowerCase()] ?? { c: "#93C5FD", icon: <circle cx="12" cy="12" r="8" /> };

const MODES: { id: Mode; t: string; d: string; c: string; ic: string; best?: boolean }[] = [
  { id: "practice", t: "Practice", d: "Instant answer + solution after each question", c: "#22D3EE", ic: "M9 11l3 3 8-8M20 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" },
  { id: "cbt", t: "NTA CBT Exam", d: "Real exam screen, timer, question palette", c: "#F59E0B", ic: "M9 3h6v4H9zM7 5H5v16h14V5h-2M9 12h6M9 16h4", best: true },
  { id: "speed", t: "Speed Run", d: "45 seconds per question, beat the clock", c: "#F43F5E", ic: "M12 22a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 9v4l2 2M10 2h4" },
  { id: "revival", t: "Mistake Revival", d: "Only questions you got wrong before", c: "#A78BFA", ic: "M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5" },
];
const STEP_NAMES = ["Subjects", "Chapters", "Questions", "Mode"];
const SUBJECT_ORDER = ["physics", "chemistry", "biology"];
/** Questions per subject in the real NEET paper. */
const NEET_SPLIT: Record<string, number> = { physics: 45, chemistry: 45, biology: 90 };
const TIMER_PRESETS = [30, 60, 90, 120, 180];
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

function shuffle<T>(a: T[]): T[] { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; }
const Tick = () => <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 5 5L20 7" /></svg>;

/**
 * `page` renders the full-page version used on /generate: the builder opens straight away,
 * the chapter list is taller and Back / Next stay above the phone navigation bar.
 */
export function TestBuilder({ snapshot, page = false, start }: { snapshot?: Snap; page?: boolean; start?: "weak" | "pyq" }) {
  const { user } = useAuth();
  const nav = useNavigate();
  const [open, setOpen] = useState(page);
  const [step, setStep] = useState(1);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [subs, setSubs] = useState<string[]>([]);
  const [chs, setChs] = useState<string[]>([]);
  const [filter, setFilter] = useState("");
  const [count, setCount] = useState(45);
  const [split, setSplit] = useState<Record<string, number>>({});
  const [timer, setTimer] = useState<number | null>(null); // null = automatic
  const [lvl, setLvl] = useState<"Mixed" | "Easy" | "Medium" | "Hard">("Mixed");
  const [pyq, setPyq] = useState(false);
  const [neg, setNeg] = useState(true);
  const [mode, setMode] = useState<Mode>("cbt");
  const [busy, setBusy] = useState(false);

  // chapter accuracy from the student's own answers
  const accById = useMemo(() => {
    const m = new Map<string, number | null>();
    snapshot?.chapters.forEach((c) => m.set(c.chapterId, c.answered >= 5 ? c.accuracy : null));
    return m;
  }, [snapshot]);
  const weakIds = useMemo(() => new Set([...(snapshot?.weaknesses ?? []), ...(snapshot?.watchlist ?? [])].map((c) => c.chapterId)), [snapshot]);

  useEffect(() => {
    if (!open || subjects.length) return;
    supabase.from("subjects").select("id,name").order("name").then(({ data }) => {
      const list = ((data ?? []) as Subject[]).filter((s) => ["physics", "chemistry", "biology"].includes(String(s.id).toLowerCase()));
      setSubjects(list.length ? list : [{ id: "physics", name: "Physics" }, { id: "chemistry", name: "Chemistry" }, { id: "biology", name: "Biology" }]);
    });
  }, [open, subjects.length]);

  async function loadChapters(ids: string[]) {
    if (!ids.length) { setChapters([]); return []; }
    const { data } = await supabase.from("chapters").select("id,name,subject_id,class").in("subject_id", ids).order("order_index").order("name");
    const list = (data ?? []) as Chapter[];
    setChapters(list);
    return list;
  }
  useEffect(() => { if (open && step === 2) void loadChapters(subs); }, [open, step, subs.join(",")]);

  function openWith(fn?: () => Promise<void> | void) { setOpen(true); void fn?.(); }

  // Shortcuts from links (/generate?start=weak|pyq). Weak chapters wait for the student's data.
  const [started, setStarted] = useState(false);
  useEffect(() => {
    if (!page || !start || started) return;
    if (start === "pyq") { setStarted(true); setPyq(true); return; }
    if (snapshot) { setStarted(true); void quickWeak(); }
  }, [page, start, started, snapshot]);

  async function quickWeak() {
    const all = ["physics", "chemistry", "biology"];
    setSubs(all); setOpen(true);
    const list = await loadChapters(all);
    const weak = list.filter((c) => weakIds.has(c.id)).map((c) => c.id);
    if (!weak.length) { toast.message("Take a few tests first", { description: "Dr. Azka needs your answers to find your weak chapters." }); setStep(2); return; }
    setChs(weak); setStep(3);
  }

  async function generate() {
    if (!user || busy) return;
    setBusy(true);
    try {
      const subjOf = new Map(chapters.map((c) => [c.id, c.subject_id]));
      // How many questions from which chapters: one bucket per subject, or one bucket for everything.
      const buckets = perSubject
        ? activeSubs.map((id) => ({ id, n: split[id] ?? 0, chapters: chs.filter((c) => subjOf.get(c) === id) })).filter((b) => b.n > 0)
        : [{ id: "all", n: count, chapters: chs }];
      const want = buckets.reduce((n, b) => n + b.n, 0);
      let ids: string[] = [];
      const short: string[] = [];

      if (mode === "revival") {
        let q = supabase.from("wrong_questions").select("question_id,chapter_id").eq("user_id", user.id).limit(2000);
        if (chs.length) q = q.in("chapter_id", chs);
        const { data, error } = await q;
        if (error) throw new Error(error.message);
        const rows = (data ?? []) as { question_id: string; chapter_id: string }[];
        for (const b of buckets) {
          const inB = new Set(b.chapters);
          const got = shuffle(Array.from(new Set(rows.filter((r) => inB.has(r.chapter_id)).map((r) => r.question_id)))).slice(0, b.n);
          if (perSubject && got.length < b.n) short.push(`${subjName(b.id)} ${got.length}/${b.n}`);
          ids.push(...got);
        }
        if (!ids.length) throw new Error("No saved mistakes in these chapters yet. Try another mode.");
      } else {
        const cap = lvl === "Mixed" ? null : lvl;
        const pick = async (cid: string, per: number, strict: boolean) => {
          let q = supabase.from("questions").select("id").eq("chapter_id", cid);
          if (strict && cap) q = q.eq("difficulty", cap);
          if (pyq) q = q.eq("is_pyq", true);
          const { data } = await q.limit(per * 3);
          return shuffle((data ?? []).map((r: { id: string }) => r.id)).slice(0, per);
        };
        for (const b of buckets) {
          const per = Math.max(1, Math.ceil(b.n / b.chapters.length));
          let got: string[] = [];
          for (let i = 0; i < b.chapters.length; i += 8) {
            const part = await Promise.all(b.chapters.slice(i, i + 8).map((c) => pick(c, per, true)));
            part.forEach((g) => got.push(...g));
          }
          if (got.length < b.n && cap) {
            const more = await Promise.all(b.chapters.slice(0, 8).map((c) => pick(c, per, false)));
            got = Array.from(new Set([...got, ...more.flat()]));
          }
          got = shuffle(got).slice(0, b.n);
          if (perSubject && got.length < b.n) short.push(`${subjName(b.id)} ${got.length}/${b.n}`);
          ids.push(...got); // subject by subject, like the real paper
        }
        if (!ids.length) throw new Error(pyq ? "No PYQs found in these chapters. Turn off \"PYQs only\" or pick other chapters." : "No questions match. Pick other chapters or difficulty.");
      }
      ids = Array.from(new Set(ids));
      const subjNames = subjects.filter((s) => subs.includes(s.id)).map((s) => s.name).join(" + ") || "Custom";
      const modeName = MODES.find((m) => m.id === mode)!.t;
      const duration = timer ?? Math.max(5, mode === "speed" ? Math.ceil(ids.length * 0.75) : ids.length);
      const { data: t, error } = await supabase.from("tests").insert({
        title: `${subjNames} · ${modeName} (${ids.length} Qs)`,
        type: "custom",
        difficulty: lvl === "Mixed" ? "mix" : lvl,
        duration_min: duration,
        total_questions: ids.length,
        question_ids: ids,
        created_by: user.id,
        source: pyq ? "PYQ" : "NCERT",
        marks_correct: 4,
        marks_wrong: neg ? -1 : 0,
      }).select("id").maybeSingle();
      if (error || !t) throw new Error(error?.message ?? "Could not create the test");
      if (ids.length < want) toast.message(`Found ${ids.length} of ${want} questions`, { description: short.length ? `Not enough matching questions in ${short.join(", ")}.` : "Your test uses all of them." });
      toast.success("Your test is ready");
      await nav({ to: "/quiz/$testId", params: { testId: t.id }, search: { mode: mode === "practice" ? "quiz" : "cbt" } as never });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create the test");
    } finally {
      setBusy(false);
    }
  }

  // Subjects that actually have chosen chapters, in NEET paper order.
  const activeSubs = useMemo(() => {
    const has = new Set(chapters.filter((c) => chs.includes(c.id)).map((c) => c.subject_id));
    return subs.filter((id) => has.has(id)).sort((a, b) => SUBJECT_ORDER.indexOf(a.toLowerCase()) - SUBJECT_ORDER.indexOf(b.toLowerCase()));
  }, [chapters, chs, subs]);
  const perSubject = activeSubs.length > 1;
  const total = perSubject ? activeSubs.reduce((n, id) => n + (split[id] ?? 0), 0) : count;
  const autoMin = Math.max(5, mode === "speed" ? Math.ceil(total * 0.75) : total);
  const minutes = timer ?? autoMin;

  // Start every newly added subject at its NEET share.
  useEffect(() => {
    if (!perSubject) return;
    setSplit((prev) => {
      const next: Record<string, number> = {};
      activeSubs.forEach((id) => { next[id] = prev[id] ?? NEET_SPLIT[id.toLowerCase()] ?? 45; });
      return next;
    });
  }, [perSubject, activeSubs.join(",")]);

  const setSub = (id: string, n: number) => setSplit((p) => ({ ...p, [id]: clamp(n, 0, 180) }));
  const subjName = (id: string) => subjects.find((s) => s.id === id)?.name ?? id;

  const canNext = step === 1 ? subs.length > 0 : step === 2 ? chs.length > 0 : step === 3 ? total > 0 : true;
  const visible = chapters.filter((c) => !filter || c.name.toLowerCase().includes(filter.toLowerCase()));
  const toggle = (arr: string[], v: string) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  return (
    <section className={`panel tb rv full ${page ? "pg" : ""}`} aria-label="Create your own test">
      <div className="tb-hero">
        <div style={{ flex: 1, minWidth: 0 }}>
          <span className="tag" style={{ background: "rgba(59,130,246,.16)", borderColor: "rgba(96,165,250,.4)", color: "#BFDBFE" }}><i style={{ background: "#60A5FA" }} />CREATE YOUR OWN TEST</span>
          <h3 style={{ marginTop: 10 }}>Build a test that targets exactly what you need</h3>
          <p>Pick chapters, set the number of questions and choose how you want to be tested.</p>
        </div>
        <div className="paper" aria-hidden="true"><i /><i /><i><span className="q" /><span /><span style={{ width: "80%" }} /><span className="q" style={{ width: "45%" }} /><span /><span className="tick" /></i></div>
      </div>

      {!open && (
        <>
          <div className="steps-mini">{STEP_NAMES.map((n, i) => <div key={n}><b>{i + 1}</b>{n}</div>)}</div>
          <button type="button" className="cta-main" onClick={() => openWith()}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.8 4.7 4.7 1.8-4.7 1.8L12 16l-1.8-4.7-4.7-1.8 4.7-1.8z" /></svg>Start building
          </button>
          <div className="quick">
            <button type="button" onClick={() => void quickWeak()}>✦ My weak chapters</button>
            <button type="button" onClick={() => { setPyq(true); setOpen(true); }}>PYQs only</button>
            <Link to="/target-700" className="quick-link">Full syllabus mock</Link>
          </div>
        </>
      )}

      {page && (
        <div className="quick">
          <button type="button" onClick={() => void quickWeak()}>✦ My weak chapters</button>
          <button type="button" className={pyq ? "on" : ""} onClick={() => { setPyq(!pyq); setStep(1); }}>{pyq ? "✓ PYQs only" : "PYQs only"}</button>
          <Link to="/improve" search={{ tab: "mistakes" } as never} className="quick-link">Fix my mistakes</Link>
          <Link to="/target-700" className="quick-link">Target 700 mocks</Link>
        </div>
      )}

      {open && (
        <div className="wiz">
          <div className="wz-steps">
            {STEP_NAMES.map((n, i) => {
              const k = i + 1;
              return (
                <div key={n} style={{ display: "contents" }}>
                  {i > 0 && <div className={`ln ${k <= step ? "done" : ""}`}><i /></div>}
                  <div className={`st ${k < step ? "done" : k === step ? "on" : ""}`}><b>{k < step ? "✓" : k}</b>{n}</div>
                </div>
              );
            })}
          </div>

          <div className="wz-body">
            {step === 1 && (
              <div className="pane" key="s1">
                <h4>Which subjects?</h4><p className="hint">Pick one or more. You can mix subjects in one test.</p>
                <div className="subj-pick">
                  {subjects.map((s) => {
                    const st = styleFor(s.id), on = subs.includes(s.id);
                    return (
                      <button type="button" key={s.id} className={`sp ${on ? "on" : ""}`} style={{ ["--c" as string]: st.c }} onClick={() => setSubs(toggle(subs, s.id))} aria-pressed={on}>
                        <span className="ck">{on && <Tick />}</span>
                        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={st.c} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">{st.icon}</svg>
                        <b>{s.name}</b>
                      </button>
                    );
                  })}
                </div>
                <div className="toggle" style={{ marginTop: 12 }}>
                  <span>Previous-year questions only<small>Use NEET PYQs from the question bank</small></span>
                  <button type="button" className={`sw ${pyq ? "on" : ""}`} aria-pressed={pyq} aria-label="PYQs only" onClick={() => setPyq(!pyq)} />
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="pane" key="s2">
                <h4>Choose chapters</h4><p className="hint">Your accuracy is shown next to each chapter.</p>
                <div className="presets">
                  <button type="button" className="ai" onClick={() => setChs(chapters.filter((c) => weakIds.has(c.id)).map((c) => c.id))}>✦ My weak chapters</button>
                  <button type="button" onClick={() => setChs(chapters.map((c) => c.id))}>Select all</button>
                  <button type="button" onClick={() => setChs(chapters.filter((c) => c.class === 11).map((c) => c.id))}>Class 11</button>
                  <button type="button" onClick={() => setChs(chapters.filter((c) => c.class === 12).map((c) => c.id))}>Class 12</button>
                  <button type="button" onClick={() => setChs([])}>Clear</button>
                </div>
                <label className="search">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9AA9C8" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
                  <input id="nth-chapter-search" placeholder="Search chapters" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Search chapters" />
                </label>
                <div className="ch-list">
                  {chapters.length === 0 && <div className="nth-empty">Loading chapters…</div>}
                  {visible.map((c) => {
                    const on = chs.includes(c.id), a = accById.get(c.id), st = styleFor(c.subject_id);
                    const tone = a == null ? ["#1A2540", "#9AA9C8"] : a >= 75 ? ["#052E22", "#34D399"] : a >= 50 ? ["#3A2406", "#FBBF24"] : ["#3B0D1A", "#FB7185"];
                    return (
                      <button type="button" key={c.id} className={`ch ${on ? "on" : ""}`} onClick={() => setChs(toggle(chs, c.id))} aria-pressed={on}>
                        <span className="box">{on && <Tick />}</span>
                        <span className="grow">{c.name}<span className="sub" style={{ color: st.c }}>{subjects.find((s) => s.id === c.subject_id)?.name ?? c.subject_id}</span></span>
                        <span className="acc" style={{ background: tone[0], color: tone[1] }}>{a == null ? "New" : `${a}%`}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="sel-count"><b>{chs.length}</b> chapters selected</div>
              </div>
            )}

            {step === 3 && (
              <div className="pane" key="s3">
                {perSubject ? (
                  <>
                    <h4>Questions from each subject</h4><p className="hint">Set how many questions you want from each subject.</p>
                    <div className="presets">
                      <button type="button" onClick={() => setSplit(Object.fromEntries(activeSubs.map((id) => [id, NEET_SPLIT[id.toLowerCase()] ?? 45])))}>NEET pattern</button>
                      <button type="button" onClick={() => setSplit(Object.fromEntries(activeSubs.map((id) => [id, 30])))}>30 each</button>
                      <button type="button" onClick={() => setSplit(Object.fromEntries(activeSubs.map((id) => [id, 15])))}>Quick 15 each</button>
                    </div>
                    <div className="sq-list">
                      {activeSubs.map((id) => {
                        const st = styleFor(id), n = split[id] ?? 0;
                        return (
                          <div key={id} className="sq" style={{ ["--c" as string]: st.c }}>
                            <div className="sq-top">
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={st.c} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{st.icon}</svg>
                              <b>{subjName(id)}</b>
                              <div className="stepper">
                                <button type="button" onClick={() => setSub(id, n - 5)} aria-label={`Fewer ${subjName(id)} questions`} disabled={n <= 0}>−</button>
                                <input inputMode="numeric" value={n} aria-label={`${subjName(id)} questions`}
                                  onChange={(e) => setSub(id, Number(e.target.value.replace(/\D/g, "")) || 0)} />
                                <button type="button" onClick={() => setSub(id, n + 5)} aria-label={`More ${subjName(id)} questions`} disabled={n >= 180}>+</button>
                              </div>
                            </div>
                            <input className="range" type="range" min={0} max={180} step={5} value={n} onChange={(e) => setSub(id, Number(e.target.value))} aria-label={`${subjName(id)} questions`} style={{ accentColor: st.c }} />
                          </div>
                        );
                      })}
                    </div>
                    <div className="sq-total">Total <b>{total}</b> questions</div>
                  </>
                ) : (
                  <>
                    <h4>How many questions?</h4><p className="hint">{activeSubs[0] ? `All from ${subjName(activeSubs[0])}.` : "Pick a number."} Choose 2 or more subjects to set a count for each.</p>
                    <div className="qnum">{count}<small>questions</small></div>
                    <input id="nth-q-range" className="range" type="range" min={10} max={180} step={5} value={count} onChange={(e) => setCount(Number(e.target.value))} aria-label="Number of questions" />
                    <div className="ticks"><span>10</span><span>45</span><span>90</span><span>135</span><span>180</span></div>
                  </>
                )}

                <div className="tm">
                  <div className="tm-head">
                    <span>Test timer<small>{timer == null ? `Automatic: ${autoMin} min (${mode === "speed" ? "45 sec" : "1 min"} per question)` : "Your own time limit, in minutes"}</small></span>
                    <div className="stepper">
                      <button type="button" onClick={() => setTimer(clamp(minutes - 5, 5, 300))} aria-label="Less time" disabled={minutes <= 5}>−</button>
                      <input inputMode="numeric" value={minutes} aria-label="Test time in minutes"
                        onChange={(e) => setTimer(clamp(Number(e.target.value.replace(/\D/g, "")) || 5, 5, 300))} />
                      <button type="button" onClick={() => setTimer(clamp(minutes + 5, 5, 300))} aria-label="More time" disabled={minutes >= 300}>+</button>
                    </div>
                  </div>
                  <div className="tm-chips">
                    <button type="button" className={timer == null ? "on" : ""} onClick={() => setTimer(null)}>Auto</button>
                    {TIMER_PRESETS.map((m) => (
                      <button type="button" key={m} className={timer === m ? "on" : ""} onClick={() => setTimer(m)}>{m >= 60 && m % 60 === 0 ? `${m / 60} hr` : m === 90 ? "1.5 hr" : `${m} min`}</button>
                    ))}
                  </div>
                </div>

                <div className="seg" style={{ gridTemplateColumns: "repeat(4,minmax(0,1fr))" }}>
                  {(["Mixed", "Easy", "Medium", "Hard"] as const).map((l) => <button type="button" key={l} className={lvl === l ? "on" : ""} onClick={() => setLvl(l)}>{l}</button>)}
                </div>
                <div className="toggle">
                  <span>Negative marking (−1)<small>Exactly like the real NEET</small></span>
                  <button type="button" className={`sw ${neg ? "on" : ""}`} aria-pressed={neg} aria-label="Negative marking" onClick={() => setNeg(!neg)} />
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="pane" key="s4">
                <h4>Choose your test mode</h4><p className="hint">How do you want to attempt it?</p>
                <div className="modes">
                  {MODES.map((m) => (
                    <button type="button" key={m.id} className={`mode ${mode === m.id ? "on" : ""}`} style={{ ["--c" as string]: m.c }} onClick={() => setMode(m.id)} aria-pressed={mode === m.id}>
                      {m.best && <span className="rec">BEST</span>}
                      <span className="mi" style={{ background: `${m.c}22`, color: m.c }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={m.ic} /></svg></span>
                      <b>{m.t}</b><small>{m.d}</small>
                    </button>
                  ))}
                </div>
                <div className="summary">
                  Your test: <b>{total} questions</b>{perSubject ? <> ({activeSubs.filter((id) => (split[id] ?? 0) > 0).map((id) => `${subjName(id)} ${split[id]}`).join(" · ")})</> : <> from {activeSubs.map(subjName).join(", ")}</>} · <b>{chs.length} chapters</b> · <b>{lvl}</b> level · <b>{MODES.find((m) => m.id === mode)!.t}</b> · {neg ? "−1 negative marking" : "no negative marking"}{pyq ? " · PYQs only" : ""} · <b>{minutes} min</b>{timer == null ? " (auto)" : ""}
                </div>
              </div>
            )}
          </div>

          <div className="wz-foot">
            {!(page && step === 1) && <button type="button" className="back" onClick={() => (step === 1 ? setOpen(false) : setStep(step - 1))}>{step === 1 ? "Close" : "Back"}</button>}
            <button type="button" className={`next ${step === 4 ? "gen" : ""}`} disabled={!canNext || busy}
              onClick={() => (step < 4 ? setStep(step + 1) : void generate())}>
              {step < 4 ? "Next" : busy ? "Generating…" : "✦ Generate my test"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
