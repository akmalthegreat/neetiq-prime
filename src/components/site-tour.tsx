// "How NEET Track works": a ~3 minute animated, narrated tour of the site.
// Narration uses the device's own speech voice (Indian English when available) with on-screen captions.
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Link } from "@tanstack/react-router";
import { Pause, Play, SkipForward, SkipBack, Volume2, VolumeX, X } from "lucide-react";

type Scene = { k: string; tag: string; title: string; say: string; href?: string; cta?: string; c1: string; c2: string; art: ReactNode };

const SCENES: Scene[] = [
  { k: "intro", tag: "WELCOME", title: "NEET Track: your 700+ plan", c1: "#2563EB", c2: "#22D3EE",
    say: "Hi doctor! Welcome to NEET Track. In the next three minutes, I will show you exactly how to use this app to score seven hundred plus in NEET, and get into a top government medical college. Let's begin.",
    art: <div className="tv-logo"><b>NT</b><span>NEET Track</span><em>Learn · Practice · Achieve</em></div> },
  { k: "bank", tag: "QUESTION PRACTICE", title: "46,000+ NEET questions", c1: "#3B82F6", c2: "#A855F7", href: "/dashboard", cta: "Start practising",
    say: "First, question practice. NEET Track has more than forty six thousand NEET level questions, including previous year questions, for Physics, Chemistry and Biology. Every question has a clear explanation.",
    art: <div className="tv-subj"><i style={{ ["--c" as string]: "#3B82F6" }}>Physics<b>180 marks</b></i><i style={{ ["--c" as string]: "#10B981" }}>Chemistry<b>180 marks</b></i><i style={{ ["--c" as string]: "#A855F7" }}>Biology<b>360 marks</b></i></div> },
  { k: "solve", tag: "CHAPTER-WISE", title: "Solve, check, understand", c1: "#10B981", c2: "#22D3EE",
    say: "Inside a chapter, choose practice mode for instant answers, or exam mode for real pressure. Your accuracy for every chapter is tracked automatically, so you know exactly which chapters need work.",
    art: <div className="tv-q"><p>Notochord is derived from which germ layer?</p><i>Ectoderm</i><i className="ok">Mesoderm ✓</i><i>Endoderm</i></div> },
  { k: "gen", tag: "GENERATE TEST", title: "Build your own test in 4 steps", c1: "#6366F1", c2: "#0EA5E9", href: "/generate", cta: "Generate a test",
    say: "Next, Generate Test. In four simple steps, choose subjects, choose chapters, set the number of questions and the timer, and pick practice or real N T A style C B T mode. One tap on My weak chapters builds a test on exactly what you need.",
    art: <div className="tv-steps">{["Subjects", "Chapters", "Questions", "Mode"].map((s, i) => <i key={s} style={{ animationDelay: `${i * 0.5}s` }}><b>{i + 1}</b>{s}</i>)}</div> },
  { k: "mock", tag: "TARGET 700 BATCH", title: "46 full NEET mock tests", c1: "#F59E0B", c2: "#EF4444", href: "/target-700", cta: "See the mocks",
    say: "Now the Target 700 Batch. Forty six mock tests in the exact N T A pattern, on the same C B T screen as the real exam. After every paper you get your score out of seven twenty, an all India rank, and full solutions.",
    art: <div className="tv-700"><b>700</b><span>720 marks · 3h 20m · CBT</span></div> },
  { k: "improve", tag: "IMPROVEMENT ZONE", title: "Turn mistakes into marks", c1: "#EF4444", c2: "#F59E0B", href: "/improve", cta: "Open Improvement Zone",
    say: "This is the most powerful part: the Improvement Zone. Every question you got wrong is saved in My Mistakes. Tag why you got it wrong, and fix it. Saved Questions keeps the ones you were unsure about. And Analytics shows your time per question, accuracy and your weakest chapters.",
    art: <div className="tv-tiles"><i style={{ ["--c" as string]: "#FBBF24" }}>Saved<b>24</b></i><i style={{ ["--c" as string]: "#FB7185" }}>Mistakes<b>74</b></i><i style={{ ["--c" as string]: "#5EEAD4" }}>Analytics<b>62%</b></i></div> },
  { k: "nuggets", tag: "NCERT NUGGETS", title: "Read NCERT lines, then solve", c1: "#10B981", c2: "#CA8A04", href: "/nuggets", cta: "Try a nugget",
    say: "NEET Biology comes from NCERT, line by line. NCERT Nuggets give you the most important NCERT lines of each topic, and right after reading, you solve questions on exactly those lines. All Biology chapters are covered.",
    art: <div className="tv-lines">{["Notochord: mesodermally derived rod", "Dorsal hollow nerve cord", "Paired pharyngeal gill slits"].map((l, i) => <i key={l} style={{ animationDelay: `${i * 0.6}s` }}><b>{i + 1}</b>{l}</i>)}<em>5 / 5 ✓</em></div> },
  { k: "flash", tag: "FLASHCARDS", title: "4,200+ flashcards, all 81 chapters", c1: "#7C3AED", c2: "#DB2777", href: "/flashcards", cta: "Revise flashcards",
    say: "For fast revision, use Flashcards. More than four thousand two hundred cards for Physics, Chemistry and Biology. Flip the card, recall the answer, and mark know it, or revise again. Ten minutes a day is enough.",
    art: <div className="tv-card"><div className="tv-flip"><i className="f">Q · Which enzyme seals Okazaki fragments?</i><i className="b">DNA ligase ✓</i></div></div> },
  { k: "notes", tag: "SHORT NOTES · 3D LAB", title: "Notes and 3D models", c1: "#0EA5E9", c2: "#8B5CF6", href: "/neetlab", cta: "Open NEETLab",
    say: "Short Notes give you chapter wise N C E R T notes with diagrams. And in NEET Lab, you can rotate real 3D models of the heart, brain, D N A and cells, run physics simulations, and watch chemistry reactions. When you see it once, you remember it in the exam.",
    art: <div className="tv-atom"><i /><i /><i /><b /></div> },
  { k: "todo", tag: "TO-DO & TARGETS", title: "Plan every day like a topper", c1: "#10B981", c2: "#22D3EE", href: "/todo", cta: "Plan my day",
    say: "Toppers plan their day. With To-Do and Targets, set your daily tasks for each subject, run a timer, tick them off. Your thirty day record shows your consistency.",
    art: <div className="tv-todo">{["Physics · 40 Qs", "Biology · 1 nugget chapter", "Chemistry · revise flashcards"].map((t, i) => <i key={t} style={{ animationDelay: `${i * 0.6}s` }}><b>✓</b>{t}</i>)}</div> },
  { k: "predict", tag: "SCORE PREDICTOR · DR. AZKA", title: "Know where you stand", c1: "#F97316", c2: "#FBBF24", href: "/consult", cta: "Meet Dr. Azka",
    say: "Want to know your expected NEET score? The Score Predictor uses your real answers to predict your marks. And Dr. Azka, your personal NEET mentor, gives you a full report and a study plan.",
    art: <div className="tv-gauge"><svg viewBox="0 0 120 70"><path d="M10 64a50 50 0 0 1 100 0" fill="none" stroke="rgba(255,255,255,.18)" strokeWidth="10" strokeLinecap="round" /><path className="arc" d="M10 64a50 50 0 0 1 100 0" fill="none" stroke="url(#tvg)" strokeWidth="10" strokeLinecap="round" /><defs><linearGradient id="tvg"><stop offset="0" stopColor="#FB923C" /><stop offset="1" stopColor="#FDE68A" /></linearGradient></defs></svg><b>642</b><span>predicted / 720</span></div> },
  { k: "compete", tag: "COMPETE DAILY", title: "Mega Quiz and weekly leaderboard", c1: "#EAB308", c2: "#DB2777", href: "/mega-quiz", cta: "See today's quiz",
    say: "Stay motivated every day. Join the Daily Mega Quiz at eight thirty P M and win real prizes, and climb the weekly all India leaderboard by solving questions all week.",
    art: <div className="tv-podium"><i style={{ height: 50 }}>2</i><i style={{ height: 78 }} className="g">1</i><i style={{ height: 38 }}>3</i></div> },
  { k: "end", tag: "START TODAY", title: "Your seat is waiting", c1: "#2563EB", c2: "#10B981", href: "/premium", cta: "See Premium plans",
    say: "Your daily formula: practise questions, read nuggets, revise flashcards, fix mistakes, and take a Target 700 mock every week. All features are free for your first twenty one days. To keep Generate Test, the Improvement Zone, mock tests and 3D models after that, choose a Premium batch. Start today. Your seat in a top government medical college is waiting. All the best, doctor!",
    art: <div className="tv-end"><b>700+</b><span>Practise · Revise · Fix · Test</span></div> },
];

const words = (s: string) => s.split(/\s+/).length;

function pickVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  const v = window.speechSynthesis.getVoices();
  return v.find((x) => x.lang === "en-IN") ?? v.find((x) => /en[-_]IN/i.test(x.lang)) ?? v.find((x) => /india/i.test(x.name)) ?? v.find((x) => x.lang.startsWith("en")) ?? null;
}

export function SiteTour({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [muted, setMuted] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const timer = useRef<number | null>(null);
  const tick = useRef<number | null>(null);
  const s = SCENES[i];
  const dur = Math.max(9000, words(s.say) * 410 + 1200); // fallback timing when no voice

  const stopAll = useCallback(() => {
    if (timer.current) window.clearTimeout(timer.current);
    if (tick.current) window.clearInterval(tick.current);
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
  }, []);

  const next = useCallback(() => setI((x) => (x + 1 < SCENES.length ? x + 1 : x)), []);

  useEffect(() => {
    if (!open) { stopAll(); return; }
    setElapsed(0);
    if (!playing) return;
    const start = Date.now();
    tick.current = window.setInterval(() => setElapsed(Date.now() - start), 200);
    const last = i === SCENES.length - 1;
    const advance = () => { if (!last) next(); else setPlaying(false); };
    const synth = "speechSynthesis" in window ? window.speechSynthesis : null;
    if (synth && !muted) {
      const u = new SpeechSynthesisUtterance(s.say);
      const v = pickVoice(); if (v) { u.voice = v; u.lang = v.lang; } else u.lang = "en-IN";
      u.rate = 1.02; u.pitch = 1;
      let done = false;
      u.onend = () => { if (done) return; done = true; timer.current = window.setTimeout(advance, 700); };
      synth.cancel(); synth.speak(u);
      // Safety net if the device never fires onend.
      timer.current = window.setTimeout(() => { if (!done) { done = true; advance(); } }, words(s.say) * 520 + 6000);
    } else {
      timer.current = window.setTimeout(advance, dur);
    }
    return stopAll;
  }, [open, i, playing, muted]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (open) { setI(0); setPlaying(true); } }, [open]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); if (e.key === "ArrowRight") next(); if (e.key === "ArrowLeft") setI((x) => Math.max(0, x - 1)); };
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, next]);
  // Voices load late on some browsers.
  useEffect(() => { if ("speechSynthesis" in window) window.speechSynthesis.onvoiceschanged = () => {}; }, []);

  if (!open || typeof document === "undefined") return null;
  const frac = Math.min(1, elapsed / (muted ? dur : words(s.say) * 400 + 800));

  return createPortal(
    <div className="tv-wrap" role="dialog" aria-modal="true" aria-label="NEET Track tour">
      <style>{TV_CSS}</style>
      <div className="tv-box" style={{ ["--c1" as string]: s.c1, ["--c2" as string]: s.c2 }}>
        <div className="tv-bars">{SCENES.map((x, j) => <i key={x.k} onClick={() => setI(j)}><b style={{ width: j < i ? "100%" : j === i ? `${frac * 100}%` : "0%" }} /></i>)}</div>
        <button type="button" className="tv-x" onClick={() => { stopAll(); onClose(); }} aria-label="Close tour"><X className="h-5 w-5" /></button>
        <div key={s.k} className="tv-scene">
          <div className="tv-bg" />
          <div className="tv-art">{s.art}</div>
          <div className="tv-copy">
            <span className="tv-tag">{s.tag}</span>
            <h2>{s.title}</h2>
            <p className="tv-cap">{s.say}</p>
            {s.href && <Link to={s.href as never} onClick={() => { stopAll(); onClose(); }} className="tv-cta">{s.cta} →</Link>}
          </div>
        </div>
        <div className="tv-ctl">
          <button type="button" onClick={() => setI((x) => Math.max(0, x - 1))} aria-label="Previous"><SkipBack className="h-5 w-5" /></button>
          <button type="button" className="main" onClick={() => setPlaying((p) => !p)} aria-label={playing ? "Pause" : "Play"}>{playing ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}</button>
          <button type="button" onClick={next} aria-label="Next"><SkipForward className="h-5 w-5" /></button>
          <button type="button" onClick={() => setMuted((m) => !m)} aria-label={muted ? "Unmute" : "Mute"}>{muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}</button>
          <span className="tv-count">{i + 1} / {SCENES.length}</span>
        </div>
      </div>
    </div>,
    document.body,
  );
}

const SEEN_KEY = "nt_tour_seen_v1";

/** Home-page pieces: a one-time pop-up for students who haven't seen the tour, and a replay card. */
export function TourEntry() {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState(false);
  useEffect(() => {
    try { if (!localStorage.getItem(SEEN_KEY)) { const t = window.setTimeout(() => setPrompt(true), 1800); return () => window.clearTimeout(t); } } catch { /* storage blocked */ }
  }, []);
  const mark = () => { try { localStorage.setItem(SEEN_KEY, "1"); } catch { /* ignore */ } };
  const start = () => { mark(); setPrompt(false); setOpen(true); };

  return (
    <>
      <style>{TV_CSS}</style>
      <button type="button" onClick={start} className="tv-entry">
        <span className="tv-entry-play"><Play className="h-5 w-5" /></span>
        <span className="min-w-0 flex-1 text-left">
          <b>How NEET Track works</b>
          <small>3-minute tour of every feature · with voice</small>
        </span>
        <span className="tv-entry-go">Watch</span>
      </button>
      {prompt && typeof document !== "undefined" && createPortal(
        <div className="tv-pop-wrap" onClick={() => { mark(); setPrompt(false); }}>
          <style>{TV_CSS}</style>
          <div className="tv-pop" onClick={(e) => e.stopPropagation()}>
            <div className="tv-pop-art"><span className="tv-entry-play big"><Play className="h-8 w-8" /></span></div>
            <h3>New to NEET Track?</h3>
            <p>Watch this 3-minute tour and learn how to use every feature to reach 700+ in NEET.</p>
            <button type="button" onClick={start} className="tv-cta w-full justify-center">▶ Watch the tour</button>
            <button type="button" onClick={() => { mark(); setPrompt(false); }} className="tv-later">Maybe later</button>
          </div>
        </div>, document.body)}
      <SiteTour open={open} onClose={() => setOpen(false)} />
    </>
  );
}

const TV_CSS = `
.tv-wrap{position:fixed;inset:0;z-index:80;display:grid;place-items:center;padding:12px;background:rgba(2,6,23,.82);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}
.tv-box{position:relative;width:min(960px,100%);height:min(640px,calc(100dvh - 24px));border-radius:28px;overflow:hidden;background:#050A18;border:1px solid rgba(255,255,255,.12);box-shadow:0 40px 80px -30px rgba(0,0,0,.8);color:#fff;font-family:'Poppins',system-ui,sans-serif;display:flex;flex-direction:column}
.tv-bars{position:absolute;left:14px;right:60px;top:14px;z-index:3;display:flex;gap:4px}
.tv-bars i{flex:1;height:3px;border-radius:3px;background:rgba(255,255,255,.2);overflow:hidden;cursor:pointer}
.tv-bars b{display:block;height:100%;background:#fff;transition:width .2s linear}
.tv-x{position:absolute;right:12px;top:6px;z-index:4;display:grid;place-items:center;width:38px;height:38px;border-radius:50%;background:rgba(255,255,255,.1)}
.tv-scene{position:relative;flex:1;display:flex;flex-direction:column;justify-content:flex-end;padding:56px 22px 8px;animation:tv-in .6s cubic-bezier(.2,.8,.2,1) both;min-height:0}
@media (min-width:760px){.tv-scene{flex-direction:row-reverse;align-items:center;justify-content:space-between;gap:30px;padding:60px 48px 10px}}
.tv-bg{position:absolute;inset:-20%;z-index:-1;background:radial-gradient(40% 40% at 75% 30%,color-mix(in oklab,var(--c1) 70%,transparent),transparent 70%),radial-gradient(40% 40% at 20% 80%,color-mix(in oklab,var(--c2) 55%,transparent),transparent 70%);filter:blur(30px);animation:tv-drift 10s ease-in-out infinite alternate}
.tv-art{flex:1;display:grid;place-items:center;min-height:180px}
.tv-copy{max-width:460px}
.tv-tag{display:inline-block;font-size:11px;font-weight:800;letter-spacing:.2em;padding:5px 10px;border-radius:999px;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.2);animation:tv-up .5s .1s both}
.tv-copy h2{margin:10px 0 0;font-size:clamp(24px,5vw,40px);font-weight:800;line-height:1.08;letter-spacing:-.02em;animation:tv-up .5s .2s both}
.tv-cap{margin:10px 0 0;font-size:14px;line-height:1.55;color:rgba(255,255,255,.82);animation:tv-up .5s .3s both;max-height:9.5em;overflow:auto}
.tv-cta{display:inline-flex;align-items:center;gap:8px;margin-top:14px;height:44px;padding:0 18px;border-radius:14px;font-weight:800;font-size:14px;color:#0B1022;background:linear-gradient(90deg,#fff,#E0F2FE);animation:tv-up .5s .4s both}
.tv-ctl{display:flex;align-items:center;justify-content:center;gap:10px;padding:10px 14px 16px}
.tv-ctl button{display:grid;place-items:center;width:44px;height:44px;border-radius:50%;background:rgba(255,255,255,.1)}
.tv-ctl button.main{width:56px;height:56px;color:#0B1022;background:#fff}
.tv-count{position:absolute;right:18px;bottom:28px;font-size:12px;color:rgba(255,255,255,.6)}
@keyframes tv-in{from{opacity:0;transform:scale(.98)}to{opacity:1;transform:none}}
@keyframes tv-up{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
@keyframes tv-drift{to{transform:translate(4%,-3%) scale(1.08)}}
@keyframes tv-pop{0%{opacity:0;transform:translateY(16px) scale(.9)}100%{opacity:1;transform:none}}
@keyframes tv-spin{to{transform:rotate(360deg)}}
.tv-logo{text-align:center;animation:tv-pop .8s both}
.tv-logo b{display:grid;place-items:center;margin:0 auto;width:110px;height:110px;border-radius:32px;font-size:44px;font-weight:900;background:linear-gradient(135deg,#1D4ED8,#22D3EE);box-shadow:0 0 60px rgba(34,211,238,.5)}
.tv-logo span{display:block;margin-top:14px;font-size:30px;font-weight:800}
.tv-logo em{display:block;font-style:normal;font-size:13px;letter-spacing:.2em;color:rgba(255,255,255,.7)}
.tv-subj{display:flex;gap:10px;flex-wrap:wrap;justify-content:center}
.tv-subj i,.tv-tiles i{font-style:normal;display:flex;flex-direction:column;justify-content:flex-end;width:110px;height:130px;padding:12px;border-radius:20px;font-weight:800;background:linear-gradient(160deg,color-mix(in oklab,var(--c) 70%,#000),rgba(0,0,0,.4));border:1px solid color-mix(in oklab,var(--c) 60%,transparent);animation:tv-pop .6s both}
.tv-subj i:nth-child(2),.tv-tiles i:nth-child(2){animation-delay:.25s}.tv-subj i:nth-child(3),.tv-tiles i:nth-child(3){animation-delay:.5s}
.tv-subj b,.tv-tiles b{font-size:12px;opacity:.8}
.tv-tiles b{font-size:28px;opacity:1}
.tv-q{width:min(320px,100%);padding:16px;border-radius:20px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.18)}
.tv-q p{margin:0 0 10px;font-weight:700}
.tv-q i{display:block;font-style:normal;margin-top:8px;padding:10px 12px;border-radius:12px;background:rgba(255,255,255,.08);animation:tv-up .5s both}
.tv-q i.ok{animation:tv-up .5s .9s both,tv-glow 1.4s 1.5s infinite alternate;background:rgba(16,185,129,.3);border:1px solid #34D399}
@keyframes tv-glow{to{box-shadow:0 0 22px rgba(52,211,153,.7)}}
.tv-steps{display:grid;gap:8px;width:min(280px,100%)}
.tv-steps i,.tv-lines i,.tv-todo i{display:flex;align-items:center;gap:10px;font-style:normal;padding:12px;border-radius:14px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.16);font-weight:700;animation:tv-up .5s both}
.tv-steps b,.tv-lines b,.tv-todo b{display:grid;place-items:center;width:28px;height:28px;border-radius:9px;color:#0B1022;background:linear-gradient(135deg,#fff,#BAE6FD)}
.tv-700{text-align:center}
.tv-700 b{display:block;font-size:clamp(90px,18vw,150px);font-weight:900;line-height:1;letter-spacing:-6px;background:linear-gradient(180deg,#FFF7D6,#FBBF24 55%,#B45309);-webkit-background-clip:text;background-clip:text;color:transparent;animation:tv-pop .8s both}
.tv-700 span{font-size:13px;letter-spacing:.12em;color:#FDE68A}
.tv-lines{display:grid;gap:8px;width:min(320px,100%)}
.tv-lines b{background:linear-gradient(135deg,#6EE7B7,#FDE68A)}
.tv-lines em{justify-self:end;font-style:normal;font-weight:900;color:#052E16;background:#86EFAC;padding:5px 12px;border-radius:999px;animation:tv-pop .5s 2.2s both}
.tv-card{perspective:800px}
.tv-flip{position:relative;width:220px;height:150px;transform-style:preserve-3d;animation:tv-flip 4s 1s infinite}
.tv-flip i{position:absolute;inset:0;display:grid;place-items:center;padding:16px;text-align:center;font-style:normal;font-weight:800;border-radius:18px;backface-visibility:hidden;-webkit-backface-visibility:hidden}
.tv-flip .f{color:#3B0764;background:linear-gradient(160deg,#fff,#EDE9FE)}
.tv-flip .b{transform:rotateY(180deg);background:linear-gradient(150deg,#22C55E,#0EA5E9)}
@keyframes tv-flip{0%,35%{transform:rotateY(0)}50%,85%{transform:rotateY(180deg)}100%{transform:rotateY(360deg)}}
.tv-atom{position:relative;width:200px;height:200px}
.tv-atom i{position:absolute;inset:0;margin:auto;height:36%;border-radius:50%;border:2px solid rgba(147,197,253,.7);animation:tv-spin 8s linear infinite}
.tv-atom i:nth-child(2){rotate:60deg;border-color:rgba(216,180,254,.7)}.tv-atom i:nth-child(3){rotate:-60deg;border-color:rgba(110,231,183,.7)}
.tv-atom b{position:absolute;inset:0;margin:auto;width:30px;height:30px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#FDE68A,#F59E0B);box-shadow:0 0 30px rgba(251,191,36,.8)}
.tv-todo{display:grid;gap:8px;width:min(300px,100%)}
.tv-todo b{background:linear-gradient(135deg,#34D399,#22D3EE);color:#04221A}
.tv-gauge{position:relative;width:240px;text-align:center}
.tv-gauge svg{width:100%}
.tv-gauge .arc{stroke-dasharray:158;stroke-dashoffset:158;animation:tv-arc 1.6s .4s forwards}
@keyframes tv-arc{to{stroke-dashoffset:22}}
.tv-gauge b{display:block;margin-top:-34px;font-size:44px;font-weight:900}
.tv-gauge span{font-size:12px;color:#FDE68A}
.tv-podium{display:flex;align-items:flex-end;gap:8px;height:120px}
.tv-podium i{display:grid;place-items:start center;padding-top:6px;width:60px;font-style:normal;font-weight:900;border-radius:12px 12px 4px 4px;background:rgba(255,255,255,.18);animation:tv-pop .6s both}
.tv-podium i.g{background:linear-gradient(180deg,#FDE68A,#F59E0B);color:#422006}
.tv-end{text-align:center}
.tv-end b{display:block;font-size:clamp(70px,15vw,120px);font-weight:900;line-height:1;background:linear-gradient(90deg,#60A5FA,#34D399,#FDE68A);-webkit-background-clip:text;background-clip:text;color:transparent;animation:tv-pop .8s both}
.tv-end span{font-size:13px;letter-spacing:.14em;color:rgba(255,255,255,.75)}
.tv-entry{display:flex;width:100%;align-items:center;gap:12px;padding:12px 14px;border-radius:20px;color:#fff;background:linear-gradient(110deg,#1E3A8A,#4C1D95 55%,#0F766E);border:1px solid rgba(255,255,255,.15);box-shadow:0 18px 36px -24px rgba(76,29,149,.9);font-family:'Poppins',system-ui,sans-serif}
.tv-entry b{display:block;font-size:15px}
.tv-entry small{display:block;font-size:11.5px;color:rgba(255,255,255,.75)}
.tv-entry-play{flex:none;position:relative;display:grid;place-items:center;width:44px;height:44px;border-radius:50%;color:#1E1B4B;background:#fff}
.tv-entry-play::after{content:"";position:absolute;inset:-4px;border-radius:50%;border:2px solid rgba(255,255,255,.6);animation:tv-ring 1.8s infinite}
.tv-entry-play.big{width:72px;height:72px}
@keyframes tv-ring{from{transform:scale(1);opacity:1}to{transform:scale(1.5);opacity:0}}
.tv-entry-go{flex:none;font-size:12px;font-weight:800;padding:7px 12px;border-radius:999px;background:rgba(255,255,255,.16)}
.tv-pop-wrap{position:fixed;inset:0;z-index:79;display:grid;place-items:center;padding:16px;background:rgba(2,6,23,.65);-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px)}
.tv-pop{width:min(380px,100%);border-radius:26px;padding:22px;text-align:center;color:#fff;background:linear-gradient(160deg,#1E1B4B,#0B1022);border:1px solid rgba(255,255,255,.14);animation:tv-pop .45s both;font-family:'Poppins',system-ui,sans-serif}
.tv-pop-art{display:grid;place-items:center;height:130px;border-radius:18px;margin-bottom:14px;background:radial-gradient(60% 70% at 50% 40%,rgba(59,130,246,.5),transparent 70%),radial-gradient(50% 60% at 80% 80%,rgba(16,185,129,.4),transparent 70%)}
.tv-pop h3{margin:0;font-size:22px;font-weight:800}
.tv-pop p{margin:6px 0 0;font-size:14px;line-height:1.5;color:rgba(255,255,255,.78)}
.tv-pop .tv-cta{display:flex}
.tv-later{margin-top:8px;height:38px;width:100%;font-size:13px;color:rgba(255,255,255,.65)}
@media (prefers-reduced-motion:reduce){.tv-scene,.tv-bg,.tv-flip,.tv-atom i{animation:none}}
`;
