// "How NEET Track works": a ~3 minute narrated tour built from real NEET Track screens.
// Narration uses the device's most natural Indian English voice (Edge "Neerja (Natural)" first),
// one sentence at a time, with live captions, pause/resume, scene skip and 1×–2× speed.
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Link } from "@tanstack/react-router";
import { Pause, Play, SkipBack, SkipForward, Volume2, VolumeX, X, RotateCcw } from "lucide-react";

type Scene = { k: string; tag: string; title: string; lines: string[]; shots?: string[]; art?: ReactNode; href?: string; cta?: string; glow: string };

const S = (p: string) => `/tour/${p}.webp`;

const SCENES: Scene[] = [
  { k: "intro", tag: "WELCOME", title: "Your journey to 700+ starts here", glow: "#2563EB",
    lines: ["Hi doctors! Welcome to NEET Track.", "If your dream is a seat in a top government medical college, maybe even AIIMS Delhi, then the next three minutes are for you.", "Let me show you how this app will take your score to seven hundred plus."],
    art: <div className="tr-intro"><img src="/brand/nt-mark.webp" alt="" /><b>NEET <span>Track</span></b><em>Learn · Practice · Achieve</em></div> },
  { k: "practice", tag: "QUESTION PRACTICE", title: "46,000+ NEET questions", glow: "#3B82F6", shots: [S("practice")], href: "/dashboard", cta: "Start practising",
    lines: ["It all starts with practice.", "NEET Track has more than forty-six thousand NEET-level questions in Physics, Chemistry and Biology, including previous year questions.", "Choose a subject, open a chapter, and start solving.", "Every single question has a clear explanation, so no doubt stays a doubt."] },
  { k: "generate", tag: "GENERATE TEST", title: "A test made just for you", glow: "#6366F1", shots: [S("generate")], href: "/generate", cta: "Generate a test",
    lines: ["Want a test made just for you? Open Generate Test.", "Pick your subjects, select chapters, set the number of questions and the timer.", "Then choose practice mode, or the real N-T-A exam screen.", "One tap on My weak chapters, and your test is ready in seconds."] },
  { k: "target", tag: "TARGET 700 BATCH", title: "46 full NEET mock tests", glow: "#F59E0B", shots: [S("target700")], href: "/target-700", cta: "See the mocks",
    lines: ["Then comes the real exam feel: the Target 700 Batch.", "Forty-six full mock tests in the exact N-T-A pattern, on the same C-B-T screen you will see on exam day.", "After every paper, you get your score out of seven hundred and twenty, your all-India rank, and complete solutions."] },
  { k: "improve", tag: "IMPROVEMENT ZONE", title: "Turn every mistake into marks", glow: "#10B981", shots: [S("improve-home"), S("improve")], href: "/improve", cta: "Open Improvement Zone",
    lines: ["Now my favourite part: the Improvement Zone.", "Every question you get wrong is saved in My Mistakes.", "You mark why it went wrong, a silly mistake or a weak concept, and you fix it.", "Saved Questions keeps the ones you weren't sure about, and Analytics shows your time per question and your weakest chapters.", "This is where marks are really gained."] },
  { k: "nuggets", tag: "NCERT NUGGETS", title: "Read NCERT lines, then solve", glow: "#CA8A04", href: "/nuggets", cta: "Try a nugget",
    lines: ["Biology is NCERT, line by line.", "NCERT Nuggets give you the most important NCERT lines of every topic.", "Right after reading, you solve questions on exactly those lines.", "Read, recall, solve. That's how NCERT gets locked in your memory."],
    art: <div className="tr-nug"><div className="tr-nug-h">NCERT KEY LINES</div>{["Notochord is a <b>mesodermally derived</b> rod on the dorsal side.", "Chordates have a <b>dorsal, hollow</b> nerve cord.", "<b>Paired pharyngeal gill slits</b> are present."].map((l, i) => <p key={i} style={{ animationDelay: `${0.4 + i * 0.7}s` }}><i>{i + 1}</i><span dangerouslySetInnerHTML={{ __html: l }} /></p>)}<em>5 / 5 correct ✓</em></div> },
  { k: "flash", tag: "FLASHCARDS · SHORT NOTES", title: "Revise faster than ever", glow: "#A855F7", shots: [S("flashcards"), S("notes")], href: "/flashcards", cta: "Revise flashcards",
    lines: ["For quick revision, there are more than four thousand flashcards for all three subjects.", "Flip, recall, and mark what you know.", "And Short Notes give you crisp, chapter-wise NCERT notes with diagrams, perfect for the last few weeks before the exam."] },
  { k: "lab", tag: "NEETLAB 3D", title: "See it once, remember it forever", glow: "#0EA5E9", shots: [S("neetlab"), S("dna")], href: "/neetlab", cta: "Open NEETLab",
    lines: ["Some topics are hard to imagine, so we made them visible.", "In NEET Lab, you can rotate a real 3D heart, brain, DNA and cell, and run physics and chemistry simulations.", "See it once, and you'll remember it in the exam."] },
  { k: "todo", tag: "TO-DO & TARGETS", title: "Plan your day like a topper", glow: "#22C55E", href: "/todo", cta: "Plan my day",
    lines: ["Toppers don't study randomly.", "Plan your day in To-Do and Targets: set tasks for each subject, run the timer, and tick them off.", "Your thirty-day record shows how consistent you really are."],
    art: <div className="tr-todo"><div className="tr-todo-h">TODAY'S PLAN <span>3 / 3 done</span></div>{["Physics · 40 questions", "Biology · 2 NCERT nuggets", "Chemistry · revise 30 flashcards"].map((t, i) => <p key={t} style={{ animationDelay: `${0.5 + i * 0.8}s` }}><i>✓</i>{t}</p>)}<em>🎉 Day complete!</em></div> },
  { k: "azka", tag: "SCORE PREDICTOR · DR. AZKA", title: "Know exactly where you stand", glow: "#14B8A6", shots: [S("azka")], href: "/consult", cta: "Meet Dr. Azka",
    lines: ["Want to know where you stand?", "The Score Predictor estimates your NEET score from your real answers.", "And Dr. Azka, your personal NEET mentor, gives you a full report and a study plan, showing exactly where your next marks will come from."] },
  { k: "compete", tag: "MENTORSHIP · DAILY QUIZ", title: "You're never alone here", glow: "#EAB308", shots: [S("leaderboard")], href: "/mentorship", cta: "Meet a mentor",
    lines: ["You're never alone here.", "Get one-on-one mentorship, join the Daily Mega Quiz every evening at eight-thirty, and climb the weekly all-India leaderboard."] },
  { k: "missazka", tag: "MISS AZKA · YOUR GUIDE", title: "Just ask, and it opens", glow: "#0EA5E9", href: "/dashboard", cta: "Ask Miss Azka",
    lines: ["And whenever you're stuck, tap the round Miss Azka button in the corner of any page.", "Ask her in your own words, in English or Hinglish: short notes of Cell, flashcards for Evolution, or twenty hard questions on Chemical Bonding.", "She finds the exact chapter in our question bank and gives you a card. One tap, and it opens.", "She can take you to any feature of NEET Track, like your mistakes, mock tests or study path."],
    art: <div className="tr-azk"><div className="tr-azk-h"><img src="/azka-avatar.webp" alt="" />Miss Azka<span>online</span></div><p className="tr-azk-me">20 hard questions on Chemical Bonding</p><p className="tr-azk-her">Done! Tap to start ✨</p><div className="tr-azk-card"><b>🎯 Quiz · Chemical Bonding</b><small>20 questions · hard</small><em>Start quiz</em></div></div> },
  { k: "end", tag: "START TODAY", title: "That white coat will be yours", glow: "#10B981", href: "/dashboard", cta: "Start my journey",
    lines: ["So that's NEET Track: practice, tests, revision and analysis, all in one place, and free for your first twenty-one days.", "Start today, stay consistent, and that white coat will be yours.", "This app is made with love by Akmal MBBS, for every NEET aspirant.", "All the best, doctors!"],
    art: <div className="tr-end"><img src="/brand/nt-mark.webp" alt="" /><b>700<sup>+</sup></b><span>Practice · Revise · Fix · Test</span><div className="tr-sign">Made with <i>♥</i> by <strong>Akmal MBBS</strong></div></div> },
];

const SPEEDS = [1, 1.25, 1.5, 2];
const wordsOf = (s: string) => s.split(/\s+/).length;
const FEMALE = /neerja|heera|veena|kalpana|swara|female|aditi|raveena|priya/i;

function bestVoice(list: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const inIN = list.filter((v) => /en[-_]IN/i.test(v.lang));
  return list.find((v) => /neerja/i.test(v.name))
    ?? inIN.find((v) => /natural|online|neural/i.test(v.name) && FEMALE.test(v.name))
    ?? inIN.find((v) => /natural|online|neural/i.test(v.name))
    ?? inIN.find((v) => /google/i.test(v.name))
    ?? inIN.find((v) => FEMALE.test(v.name))
    ?? inIN[0]
    ?? list.find((v) => /en[-_]GB/i.test(v.lang) && /natural|google/i.test(v.name))
    ?? list.find((v) => v.lang.startsWith("en")) ?? null;
}

export function SiteTour({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [si, setSi] = useState(0);           // scene
  const [li, setLi] = useState(0);           // line within scene
  const [playing, setPlaying] = useState(true);
  const [muted, setMuted] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [ended, setEnded] = useState(false);
  const gen = useRef(0);
  const timer = useRef<number | null>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const [fh, setFh] = useState(500);
  const scene = SCENES[si];

  // Load voices (some browsers load them late).
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const load = () => setVoice(bestVoice(window.speechSynthesis.getVoices()));
    load(); window.speechSynthesis.addEventListener?.("voiceschanged", load);
    return () => window.speechSynthesis.removeEventListener?.("voiceschanged", load);
  }, []);

  const hush = useCallback(() => {
    gen.current++;
    if (timer.current) window.clearTimeout(timer.current);
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
  }, []);

  const goto = useCallback((s: number) => { hush(); setEnded(false); setSi(Math.max(0, Math.min(SCENES.length - 1, s))); setLi(0); }, [hush]);

  // Speak the current line, then move on.
  useEffect(() => {
    if (!open || !playing || ended) return;
    const my = ++gen.current;
    const line = scene.lines[li];
    const advance = () => {
      if (gen.current !== my) return;
      if (li + 1 < scene.lines.length) setLi(li + 1);
      else if (si + 1 < SCENES.length) timer.current = window.setTimeout(() => { if (gen.current === my) { setSi(si + 1); setLi(0); } }, 450);
      else { setEnded(true); setPlaying(false); }
    };
    const synth = "speechSynthesis" in window ? window.speechSynthesis : null;
    if (synth && !muted) {
      const u = new SpeechSynthesisUtterance(line);
      if (voice) { u.voice = voice; u.lang = voice.lang; } else u.lang = "en-IN";
      u.rate = 0.96 * speed; u.pitch = 1.02;
      u.onend = () => { timer.current = window.setTimeout(advance, 160); };
      u.onerror = () => { timer.current = window.setTimeout(advance, 300); };
      synth.cancel(); synth.speak(u);
      const guard = window.setTimeout(() => { if (gen.current === my && synth.speaking === false) advance(); }, (wordsOf(line) * 600) / speed + 5000);
      return () => window.clearTimeout(guard);
    }
    timer.current = window.setTimeout(advance, (wordsOf(line) * 400) / speed + 700);
  }, [open, playing, muted, speed, si, li, ended, voice]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (open) { setSi(0); setLi(0); setEnded(false); setPlaying(true); } else hush(); }, [open, hush]);
  useEffect(() => () => hush(), [hush]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { hush(); onClose(); }
      else if (e.key === "ArrowRight") goto(si + 1);
      else if (e.key === "ArrowLeft") goto(si - 1);
      else if (e.key === " ") { e.preventDefault(); setPlaying((p) => { if (p) hush(); return !p; }); }
    };
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
  }, [open, si, goto, hush, onClose]);
  useEffect(() => {
    const el = frameRef.current; if (!el) return;
    const ro = new ResizeObserver(() => setFh(el.clientHeight)); ro.observe(el); return () => ro.disconnect();
  }, [open, si]);

  if (!open || typeof document === "undefined") return null;
  const shots = scene.shots ?? [];
  const shot = shots.length ? shots[Math.min(shots.length - 1, Math.floor((li * shots.length) / scene.lines.length))] : null;
  const sceneSecs = scene.lines.reduce((n, l) => n + wordsOf(l), 0) * 0.42 / speed + 2;
  const togglePlay = () => { if (ended) { goto(0); setPlaying(true); return; } setPlaying((p) => { if (p) hush(); return !p; }); };

  return createPortal(
    <div className="tr-wrap" role="dialog" aria-modal="true" aria-label="NEET Track tour">
      <style>{TR_CSS}</style>
      <div className="tr-box" style={{ ["--glow" as string]: scene.glow }}>
        <div className="tr-glow" />
        <header className="tr-top">
          <img src="/brand/nt-mark.webp" alt="" className="tr-logo" />
          <div className="tr-brand"><b>NEET <span>Track</span></b><small>How it works</small></div>
          <button type="button" className="tr-x" onClick={() => { hush(); onClose(); }} aria-label="Close tour"><X className="h-5 w-5" /></button>
        </header>
        <div className="tr-bars">{SCENES.map((x, j) => (
          <button key={x.k} type="button" onClick={() => goto(j)} aria-label={`Go to ${x.tag}`}>
            <b style={{ width: j < si || ended ? "100%" : j === si ? `${((li + (playing ? 0.5 : 0)) / scene.lines.length) * 100}%` : "0%" }} />
          </button>
        ))}</div>

        <div key={scene.k} className="tr-stage">
          <div className="tr-visual">
            {shot ? (
              <div className="tr-phone" ref={frameRef}>
                <img key={shot} src={shot} alt={`${scene.tag} screen`} className="tr-shot"
                  style={{ ["--fh" as string]: `${fh}px`, ["--dur" as string]: `${sceneSecs / shots.length}s`, animationPlayState: playing ? "running" : "paused" }} />
                <span className="tr-notch" />
              </div>
            ) : <div className="tr-art">{scene.art}</div>}
          </div>
          <div className="tr-copy">
            <span className="tr-tag">{scene.tag}</span>
            <h2>{scene.title}</h2>
            <p key={`${si}-${li}`} className="tr-cap">{scene.lines[li]}</p>
            {scene.href && <Link to={scene.href as never} onClick={() => { hush(); onClose(); }} className="tr-cta">{scene.cta} →</Link>}
          </div>
        </div>

        <footer className="tr-ctl">
          <button type="button" onClick={() => goto(si - 1)} aria-label="Previous scene"><SkipBack className="h-5 w-5" /></button>
          <button type="button" className="main" onClick={togglePlay} aria-label={ended ? "Replay" : playing ? "Pause" : "Play"}>
            {ended ? <RotateCcw className="h-6 w-6" /> : playing ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
          </button>
          <button type="button" onClick={() => goto(si + 1)} aria-label="Next scene"><SkipForward className="h-5 w-5" /></button>
          <button type="button" className="tr-speed" onClick={() => { hush(); setSpeed((v) => SPEEDS[(SPEEDS.indexOf(v) + 1) % SPEEDS.length]); }} aria-label="Playback speed">{speed}×</button>
          <button type="button" onClick={() => { hush(); setMuted((m) => !m); }} aria-label={muted ? "Unmute" : "Mute"}>{muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}</button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}

const SEEN_KEY = "nt_tour_seen_v3";
const VIDEO_SRC = "/tour/how-to-use.mp4";
const VIDEO_POSTER = "/tour/how-to-use-poster.jpg";

/** Full-screen player for the narrated "how to use NEET Track" screen recording. */
export function VideoTour({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); ref.current?.pause(); };
  }, [open, onClose]);
  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className="tr-wrap" role="dialog" aria-modal="true" aria-label="How to use NEET Track" onClick={onClose}>
      <style>{TR_CSS}</style>
      <div className="tr-vbox" onClick={(e) => e.stopPropagation()}>
        <header className="tr-top">
          <img src="/brand/nt-mark.webp" alt="" className="tr-logo" />
          <div className="tr-brand"><b>NEET <span>Track</span></b><small>How to use the app</small></div>
          <button type="button" className="tr-x" onClick={onClose} aria-label="Close video"><X className="h-5 w-5" /></button>
        </header>
        <video ref={ref} className="tr-video" src={VIDEO_SRC} poster={VIDEO_POSTER}
          controls autoPlay playsInline preload="metadata" controlsList="nodownload" />
      </div>
    </div>,
    document.body,
  );
}

/** Home page: a one-time pop-up for students who haven't seen the tour, and a replay card. */
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
      <style>{TR_CSS}</style>
      <button type="button" onClick={start} className="tr-entry">
        <span className="tr-play"><Play className="h-5 w-5" /></span>
        <span className="min-w-0 flex-1 text-left"><b>How to use NEET Track</b><small>Video tour of every feature · by Akmal MBBS</small></span>
        <span className="tr-entry-go">Watch</span>
      </button>
      {prompt && typeof document !== "undefined" && createPortal(
        <div className="tr-pop-wrap" onClick={() => { mark(); setPrompt(false); }}>
          <style>{TR_CSS}</style>
          <div className="tr-pop" onClick={(e) => e.stopPropagation()}>
            <div className="tr-pop-art"><img src={VIDEO_POSTER} alt="" /><span className="tr-play big"><Play className="h-8 w-8" /></span></div>
            <h3>Welcome to NEET Track 👋</h3>
            <p>Watch this short video tour and see how to use every feature to reach 700+ in NEET.</p>
            <button type="button" onClick={start} className="tr-cta tr-cta-full">▶ Watch the tour</button>
            <button type="button" onClick={() => { mark(); setPrompt(false); }} className="tr-later">Maybe later</button>
          </div>
        </div>, document.body)}
      <VideoTour open={open} onClose={() => setOpen(false)} />
    </>
  );
}

const TR_CSS = `
.tr-vbox{position:relative;display:flex;flex-direction:column;width:min(480px,100vw);height:100dvh;background:#040814;color:#fff;overflow:hidden}
@media (min-width:700px){.tr-vbox{height:min(900px,calc(100dvh - 32px));border-radius:24px;border:1px solid rgba(255,255,255,.1)}}
.tr-video{flex:1;min-height:0;width:100%;background:#000;object-fit:contain}
.tr-wrap{position:fixed;inset:0;z-index:80;display:grid;place-items:center;background:rgba(2,6,23,.88);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px)}
.tr-box{position:relative;display:grid;grid-template-rows:auto auto minmax(0,1fr) auto;width:min(1000px,100vw);height:100dvh;overflow:hidden;color:#fff;background:#040814;font-family:'Poppins',system-ui,sans-serif}
@media (min-width:700px){.tr-box{height:min(680px,calc(100dvh - 32px));border-radius:28px;border:1px solid rgba(255,255,255,.1);box-shadow:0 50px 100px -40px rgba(0,0,0,.9)}}
.tr-glow{position:absolute;inset:-30%;z-index:0;pointer-events:none;background:radial-gradient(35% 30% at 70% 35%,color-mix(in oklab,var(--glow) 55%,transparent),transparent 70%),radial-gradient(30% 30% at 20% 85%,color-mix(in oklab,var(--glow) 30%,transparent),transparent 70%);filter:blur(40px);transition:background 1s;animation:tr-drift 12s ease-in-out infinite alternate}
@keyframes tr-drift{to{transform:translate(3%,-2%) scale(1.06)}}
.tr-top{position:relative;z-index:2;display:flex;align-items:center;gap:10px;padding:12px 14px 8px}
.tr-logo{width:36px;height:36px;border-radius:50%;box-shadow:0 0 16px rgba(56,189,248,.5)}
.tr-brand{flex:1;min-width:0;line-height:1.1}
.tr-brand b{font-size:16px;font-weight:800}.tr-brand b span{color:#2DD4BF}
.tr-brand small{display:block;font-size:11px;color:rgba(255,255,255,.6)}
.tr-x{display:grid;place-items:center;width:38px;height:38px;border-radius:50%;background:rgba(255,255,255,.1)}
.tr-bars{position:relative;z-index:2;display:flex;gap:4px;padding:0 14px 6px}
.tr-bars button{flex:1;height:14px;display:flex;align-items:center}
.tr-bars b{display:block;height:3px;border-radius:3px;background:#fff;transition:width .6s ease}
.tr-bars button{position:relative}
.tr-bars button::after{content:"";position:absolute;left:0;right:0;top:50%;height:3px;margin-top:-1.5px;border-radius:3px;background:rgba(255,255,255,.22);z-index:-1}
.tr-stage{position:relative;z-index:1;display:grid;grid-template-rows:minmax(0,1fr) auto;gap:12px;min-height:0;padding:6px 18px 4px;animation:tr-in .55s cubic-bezier(.2,.8,.2,1) both}
@media (min-width:700px){.tr-stage{grid-template-rows:none;grid-template-columns:minmax(0,1fr) minmax(0,1.1fr);align-items:center;gap:36px;padding:8px 44px}}
.tr-visual{min-height:0;height:100%;display:grid;place-items:center}
.tr-phone{position:relative;height:100%;max-height:520px;aspect-ratio:9/17.5;border-radius:26px;overflow:hidden;background:#0A0F1C;border:6px solid #1F2937;box-shadow:0 0 0 1px rgba(255,255,255,.12),0 30px 60px -20px rgba(0,0,0,.8),0 0 60px -10px var(--glow)}
.tr-notch{position:absolute;left:50%;top:6px;width:64px;height:16px;margin-left:-32px;border-radius:10px;background:#000;z-index:2}
.tr-shot{display:block;width:100%;height:auto;animation:tr-pan var(--dur,12s) ease-in-out .6s both,tr-fade .5s both}
@keyframes tr-pan{from{transform:translateY(0)}to{transform:translateY(min(0px,calc(-100% + var(--fh,500px))))}}
@keyframes tr-fade{from{opacity:0}to{opacity:1}}
.tr-copy{min-width:0}
.tr-tag{display:inline-block;font-size:10.5px;font-weight:800;letter-spacing:.18em;padding:5px 10px;border-radius:999px;color:#fff;background:color-mix(in oklab,var(--glow) 35%,transparent);border:1px solid color-mix(in oklab,var(--glow) 60%,transparent);animation:tr-up .5s .05s both}
.tr-copy h2{margin:8px 0 0;font-size:clamp(21px,4.6vw,38px);font-weight:800;line-height:1.12;letter-spacing:-.02em;animation:tr-up .5s .12s both}
.tr-cap{margin:8px 0 0;min-height:4.6em;font-size:clamp(14px,2.6vw,17px);line-height:1.55;color:rgba(255,255,255,.9);animation:tr-cap .45s both}
@keyframes tr-cap{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
.tr-cta{display:inline-flex;align-items:center;gap:6px;margin-top:6px;height:40px;padding:0 16px;border-radius:12px;font-size:13.5px;font-weight:800;color:#0B1022;background:#fff}
.tr-cta-full{display:flex;justify-content:center;width:100%;height:46px;margin-top:16px}
.tr-ctl{position:relative;z-index:2;display:flex;align-items:center;justify-content:center;gap:10px;padding:10px 14px calc(14px + env(safe-area-inset-bottom))}
.tr-ctl button{display:grid;place-items:center;width:44px;height:44px;border-radius:50%;background:rgba(255,255,255,.1)}
.tr-ctl button.main{width:58px;height:58px;color:#0B1022;background:#fff;box-shadow:0 0 30px -4px var(--glow)}
.tr-ctl .tr-speed{width:auto;min-width:52px;padding:0 10px;border-radius:999px;font-size:13px;font-weight:800}
@keyframes tr-in{from{opacity:0;transform:translateY(10px) scale(.99)}to{opacity:1;transform:none}}
@keyframes tr-up{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
.tr-art{display:grid;place-items:center;width:100%;height:100%}
.tr-intro{text-align:center}
.tr-intro img{width:120px;height:120px;border-radius:50%;box-shadow:0 0 0 10px rgba(255,255,255,.04),0 0 70px rgba(56,189,248,.6);animation:tr-pulse 2.4s ease-in-out infinite,tr-up .8s both}
.tr-intro b{display:block;margin-top:18px;font-size:34px;font-weight:800;animation:tr-up .8s .3s both}.tr-intro b span{color:#2DD4BF}
.tr-intro em{display:block;font-style:normal;font-size:12px;letter-spacing:.22em;color:rgba(255,255,255,.65);animation:tr-up .8s .5s both}
@keyframes tr-pulse{50%{box-shadow:0 0 0 18px rgba(255,255,255,.02),0 0 90px rgba(56,189,248,.8)}}
.tr-azk{width:min(330px,100%);padding:14px;border-radius:22px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.14);display:flex;flex-direction:column;gap:8px}
.tr-azk-h{display:flex;align-items:center;gap:8px;font-weight:900;font-size:14px}
.tr-azk-h img{width:32px;height:32px;border-radius:999px;object-fit:cover;box-shadow:0 0 0 2px #0EA5E9}
.tr-azk-h span{margin-left:auto;font-size:10px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#4ADE80}
.tr-azk p{margin:0;padding:8px 12px;border-radius:16px;font-size:13px;line-height:1.4;max-width:85%;opacity:0;animation:tr-up .5s forwards}
.tr-azk-me{align-self:flex-end;background:linear-gradient(135deg,#0EA5E9,#6366F1);animation-delay:.4s!important}
.tr-azk-her{align-self:flex-start;background:rgba(255,255,255,.12);animation-delay:1.2s!important}
.tr-azk-card{display:flex;flex-direction:column;gap:2px;padding:12px;border-radius:16px;background:linear-gradient(135deg,#7C3AED,#6366F1 45%,#0EA5E9);opacity:0;animation:tr-up .5s 1.9s forwards}
.tr-azk-card b{font-size:14px}.tr-azk-card small{font-size:11.5px;opacity:.85}
.tr-azk-card em{margin-top:8px;align-self:stretch;text-align:center;font-style:normal;font-weight:900;font-size:13px;padding:8px;border-radius:10px;background:#fff;color:#4338CA}
.tr-nug,.tr-todo{width:min(340px,100%);padding:16px;border-radius:22px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.14)}
.tr-nug-h,.tr-todo-h{display:flex;justify-content:space-between;margin-bottom:10px;font-size:11px;font-weight:900;letter-spacing:.16em;color:#FDE68A}
.tr-todo-h{color:#86EFAC}.tr-todo-h span{letter-spacing:0;color:rgba(255,255,255,.7)}
.tr-nug p,.tr-todo p{display:flex;gap:10px;align-items:flex-start;margin:8px 0 0;font-size:14px;line-height:1.5;opacity:0;animation:tr-up .5s forwards}
.tr-nug i,.tr-todo i{flex:none;display:grid;place-items:center;width:24px;height:24px;border-radius:8px;font-style:normal;font-size:12px;font-weight:900;color:#04221A;background:linear-gradient(135deg,#6EE7B7,#FDE68A)}
.tr-nug b{color:#FDE68A}
.tr-nug em,.tr-todo em{display:block;margin-top:12px;width:max-content;font-style:normal;font-size:12px;font-weight:900;color:#052E16;background:#86EFAC;padding:5px 12px;border-radius:999px;opacity:0;animation:tr-up .5s 2.6s forwards}
.tr-end{text-align:center}
.tr-end img{width:80px;height:80px;border-radius:50%;box-shadow:0 0 50px rgba(56,189,248,.6)}
.tr-end b{display:block;margin-top:10px;font-size:clamp(72px,16vw,120px);font-weight:900;line-height:1;background:linear-gradient(90deg,#60A5FA,#34D399,#FDE68A);-webkit-background-clip:text;background-clip:text;color:transparent;animation:tr-up .8s both}
.tr-end sup{font-size:.45em}
.tr-end span{display:block;font-size:12px;letter-spacing:.16em;color:rgba(255,255,255,.75)}
.tr-sign{margin-top:16px;display:inline-block;padding:8px 16px;border-radius:999px;font-size:13px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.18);animation:tr-up .8s .6s both}
.tr-sign i{font-style:normal;color:#F472B6}
.tr-entry{display:flex;width:100%;align-items:center;gap:12px;padding:12px 14px;border-radius:20px;color:#fff;background:linear-gradient(110deg,#1E3A8A,#4C1D95 55%,#0F766E);border:1px solid rgba(255,255,255,.15);box-shadow:0 18px 36px -24px rgba(76,29,149,.9);font-family:'Poppins',system-ui,sans-serif}
.tr-entry b{display:block;font-size:15px}.tr-entry small{display:block;font-size:11.5px;color:rgba(255,255,255,.75)}
.tr-play{flex:none;position:relative;display:grid;place-items:center;width:44px;height:44px;border-radius:50%;color:#1E1B4B;background:#fff}
.tr-play::after{content:"";position:absolute;inset:-4px;border-radius:50%;border:2px solid rgba(255,255,255,.6);animation:tr-ring 1.8s infinite}
.tr-play.big{position:absolute;left:50%;top:50%;width:68px;height:68px;margin:-34px 0 0 -34px}
@keyframes tr-ring{from{transform:scale(1);opacity:1}to{transform:scale(1.5);opacity:0}}
.tr-entry-go{flex:none;font-size:12px;font-weight:800;padding:7px 12px;border-radius:999px;background:rgba(255,255,255,.16)}
.tr-pop-wrap{position:fixed;inset:0;z-index:79;display:grid;place-items:center;padding:16px;background:rgba(2,6,23,.7);-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px)}
.tr-pop{width:min(380px,100%);border-radius:26px;padding:18px;text-align:center;color:#fff;background:linear-gradient(160deg,#111a3a,#060b18);border:1px solid rgba(255,255,255,.14);animation:tr-up .45s both;font-family:'Poppins',system-ui,sans-serif}
.tr-pop-art{position:relative;height:150px;border-radius:18px;overflow:hidden;margin-bottom:14px}
.tr-pop-art img{width:100%;opacity:.55;filter:blur(1px)}
.tr-pop h3{margin:0;font-size:21px;font-weight:800}
.tr-pop p{margin:6px 0 0;font-size:14px;line-height:1.5;color:rgba(255,255,255,.78)}
.tr-later{margin-top:6px;height:38px;width:100%;font-size:13px;color:rgba(255,255,255,.65)}
@media (prefers-reduced-motion:reduce){.tr-stage,.tr-glow,.tr-shot,.tr-intro img{animation:none}}
`;
