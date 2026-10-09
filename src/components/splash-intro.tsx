import { useEffect, useState } from "react";

/**
 * Cinematic opening intro, shown once per browser session when the site/app is opened.
 * Pure CSS + SVG, server-rendered, so it starts on the very first paint and never delays loading.
 * Timeline (3.5 s): aurora + stars → heartbeat sweep → light burst → 3D logo reveal with chrome
 * shine, rays and orbit → wordmark → tagline → "Created by Akmal MBBS" signature line → iris out.
 * A tap skips it. Repeat loads in the same session are hidden before paint by INTRO_HEAD_SCRIPT.
 */

export const INTRO_HEAD_SCRIPT = `try{if(sessionStorage.getItem('nt-intro')){document.documentElement.setAttribute('data-intro','seen')}else{sessionStorage.setItem('nt-intro','1')}}catch(e){}`;

/** Google Font used by the intro wordmark. Added to the root <head>. */
export const INTRO_FONTS_HREF = "https://fonts.googleapis.com/css2?family=Poppins:wght@600;700;800&display=swap";

const TOTAL_MS = 3500;

/** Runs inline right after the intro markup (before hydration). In the installed app, skip the first ~0.7 s. */
const APP_HANDOFF_SCRIPT = `try{if(matchMedia('(display-mode: standalone)').matches||navigator.standalone){var s=document.getElementById('nt-splash');if(s&&s.getAnimations){s.getAnimations({subtree:true}).forEach(function(a){a.currentTime=(Number(a.currentTime)||0)+700})}}}catch(e){}`;

// Deterministic star field (same on server and client, so hydration matches).
const STARS = (() => {
  let seed = 7;
  const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  return Array.from({ length: 38 }, () => ({
    x: +(r() * 100).toFixed(2),
    y: +(r() * 100).toFixed(2),
    s: +(1 + r() * 2.2).toFixed(2),
    d: +(r() * 2.4).toFixed(2),
    t: +(1.6 + r() * 2).toFixed(2),
  }));
})();

export function SplashIntro() {
  const [gone, setGone] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (document.documentElement.getAttribute("data-intro") === "seen") { setGone(true); return; }
    const t = window.setTimeout(() => setGone(true), TOTAL_MS + 150);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!leaving) return;
    const t = window.setTimeout(() => setGone(true), 520);
    return () => window.clearTimeout(t);
  }, [leaving]);

  if (gone) return null;

  const wm = ["N", "E", "E", "T", " ", "T", "r", "a", "c", "k"];
  return (
    <div id="nt-splash" className={leaving ? "out" : ""} aria-hidden="true" onClick={() => setLeaving(true)}>
      <style dangerouslySetInnerHTML={{ __html: INTRO_CSS }} />

      <div className="sky" />
      <div className="aur a1" /><div className="aur a2" /><div className="aur a3" />
      <div className="stars">
        {STARS.map((s, i) => (
          <i key={i} style={{ left: `${s.x}%`, top: `${s.y}%`, width: s.s, height: s.s, animationDelay: `${s.d}s`, animationDuration: `${s.t}s` }} />
        ))}
      </div>
      <div className="vig" />

      <div className="scene">
        <svg className="ecg" viewBox="0 0 1200 200" preserveAspectRatio="none">
          <defs>
            <linearGradient id="ntx-ecg" x1="0" x2="1">
              <stop offset="0" stopColor="#38BDF8" stopOpacity="0" />
              <stop offset=".3" stopColor="#38BDF8" />
              <stop offset=".7" stopColor="#5EEAD4" />
              <stop offset="1" stopColor="#34D399" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path className="line" pathLength={1} d={ECG} />
          <path className="spark" pathLength={1} d={ECG} />
        </svg>

        <div className="logo">
          <div className="rays" />
          <div className="flash" />
          <span className="ring r1" /><span className="ring r2" /><span className="ring r3" />
          <div className="orbit">
            <svg viewBox="0 0 300 300">
              <defs>
                <linearGradient id="ntx-orb" x1="0" x2="1" y1="0" y2="1">
                  <stop offset="0" stopColor="#7DD3FC" stopOpacity=".05" />
                  <stop offset=".5" stopColor="#7DD3FC" stopOpacity=".9" />
                  <stop offset="1" stopColor="#34D399" stopOpacity=".1" />
                </linearGradient>
              </defs>
              <ellipse cx="150" cy="150" rx="138" ry="46" fill="none" stroke="url(#ntx-orb)" strokeWidth="1.6" />
            </svg>
            <b className="dot" />
          </div>
          <div className="mark3d">
            <div className="glow3d"><img className="mark" src="/brand/nt-mark.webp" alt="" width={168} height={168} decoding="async" fetchPriority="high" /></div>
            <span className="shine" />
          </div>
        </div>

        <div className="word">
          {wm.map((ch, i) =>
            ch === " " ? <span key={i} className="sp" /> : (
              <span key={i} className={i > 4 ? "tr" : ""} style={{ animationDelay: `${1.2 + i * 0.045}s` }}>{ch}</span>
            ),
          )}
        </div>
        <div className="tag"><span>Learn</span><i /><span>Practice</span><i /><span>Achieve</span></div>

        <div className="credit">
          <em className="cl" />
          <span className="cby">Created by</span>
          <span className="cn">Akmal</span>
          <span className="cd">MBBS</span>
          <em className="cl cr" />
        </div>
      </div>
      {/* Installed app: Android already showed the logo on its launch screen, so jump straight to the logo burst. */}
      <script dangerouslySetInnerHTML={{ __html: APP_HANDOFF_SCRIPT }} />
    </div>
  );
}

const ECG = "M0 100 H460 L492 100 L512 74 L532 100 L552 100 L574 14 L600 186 L626 100 L652 100 L672 82 L694 100 H1200";

const INTRO_CSS = `
html[data-intro="seen"] #nt-splash{display:none!important}
#nt-splash{position:fixed;inset:0;z-index:2147483000;overflow:hidden;cursor:pointer;color:#EAF2FF;-webkit-tap-highlight-color:transparent;
  font-family:'Poppins',ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;
  animation:ntx-iris .45s cubic-bezier(.76,0,.24,1) 3.05s both}
#nt-splash.out{animation:ntx-iris .45s cubic-bezier(.76,0,.24,1) both}
#nt-splash *{box-sizing:border-box}

#nt-splash .sky{position:absolute;inset:0;background:radial-gradient(120% 80% at 50% 38%,#0A1F5C 0%,#041033 45%,#010718 100%)}
#nt-splash .aur{position:absolute;border-radius:50%;filter:blur(46px);opacity:0;will-change:transform,opacity}
#nt-splash .a1{width:70vmax;height:42vmax;left:-20vmax;top:6%;background:radial-gradient(closest-side,rgba(37,99,235,.55),transparent);animation:ntx-in 1.2s ease-out .05s both,ntx-drift1 6s ease-in-out infinite alternate}
#nt-splash .a2{width:60vmax;height:40vmax;right:-22vmax;top:30%;background:radial-gradient(closest-side,rgba(20,184,166,.38),transparent);animation:ntx-in 1.4s ease-out .2s both,ntx-drift2 7s ease-in-out infinite alternate}
#nt-splash .a3{width:56vmax;height:34vmax;left:10%;bottom:-16vmax;background:radial-gradient(closest-side,rgba(124,58,237,.32),transparent);animation:ntx-in 1.4s ease-out .35s both,ntx-drift1 8s ease-in-out infinite alternate-reverse}
#nt-splash .stars i{position:absolute;border-radius:50%;background:#DCEBFF;box-shadow:0 0 6px rgba(186,230,253,.9);opacity:0;animation-name:ntx-twinkle;animation-timing-function:ease-in-out;animation-iteration-count:infinite}
#nt-splash .vig{position:absolute;inset:0;background:radial-gradient(closest-side at 50% 45%,transparent 60%,rgba(0,3,12,.75))}

#nt-splash .scene{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding-bottom:4vh}
#nt-splash .ecg{position:absolute;left:0;top:calc(50% - 168px);width:100%;height:120px;overflow:visible}
#nt-splash .ecg path{fill:none;stroke-linecap:round;stroke-linejoin:round;vector-effect:non-scaling-stroke}
#nt-splash .ecg .line{stroke:url(#ntx-ecg);stroke-width:2.6;stroke-dasharray:1;stroke-dashoffset:1;filter:drop-shadow(0 0 7px rgba(56,189,248,.85));
  animation:ntx-draw .7s cubic-bezier(.5,0,.2,1) .15s both,ntx-ecgout .3s ease-in .82s both}
#nt-splash .ecg .spark{stroke:#fff;stroke-width:3.6;stroke-dasharray:.03 1;stroke-dashoffset:.03;filter:drop-shadow(0 0 8px #BAE6FD) drop-shadow(0 0 18px #38BDF8);
  animation:ntx-spark .7s cubic-bezier(.5,0,.2,1) .15s both}

#nt-splash .logo{position:relative;width:168px;height:168px;display:grid;place-items:center;perspective:700px}
#nt-splash .rays{position:absolute;left:50%;top:50%;width:440px;height:440px;margin:-220px;border-radius:50%;
  background:repeating-conic-gradient(from 0deg,rgba(125,211,252,.16) 0deg 4deg,transparent 4deg 18deg);
  -webkit-mask-image:radial-gradient(closest-side,#000 20%,transparent 72%);mask-image:radial-gradient(closest-side,#000 20%,transparent 72%);
  opacity:0;animation:ntx-raysin .8s ease-out .8s both,ntx-spin 18s linear .8s infinite}
#nt-splash .flash{position:absolute;left:50%;top:50%;width:260px;height:260px;margin:-130px;border-radius:50%;
  background:radial-gradient(closest-side,#fff 0%,rgba(186,230,253,.85) 18%,rgba(56,189,248,.35) 45%,transparent 72%);opacity:0;
  animation:ntx-flash .65s ease-out .75s both}
#nt-splash .ring{position:absolute;left:50%;top:50%;width:150px;height:150px;margin:-75px;border-radius:50%;border:1.5px solid rgba(125,211,252,.75);opacity:0}
#nt-splash .r1{animation:ntx-ring 1s cubic-bezier(.2,.7,.3,1) .77s both}
#nt-splash .r2{animation:ntx-ring 1s cubic-bezier(.2,.7,.3,1) .9s both;border-color:rgba(94,234,212,.65)}
#nt-splash .r3{animation:ntx-ring 1s cubic-bezier(.2,.7,.3,1) 1.03s both;border-color:rgba(167,139,250,.5)}
#nt-splash .orbit{position:absolute;left:50%;top:50%;width:300px;height:300px;margin:-150px;transform:rotate(-16deg);opacity:0;animation:ntx-in .7s ease-out 1.15s both}
#nt-splash .orbit svg{width:100%;height:100%;overflow:visible}
#nt-splash .orbit .dot{position:absolute;left:0;top:0;width:9px;height:9px;border-radius:50%;background:#E0F2FE;box-shadow:0 0 10px #7DD3FC,0 0 22px #38BDF8;
  offset-path:path("M 12 150 A 138 46 0 1 1 288 150 A 138 46 0 1 1 12 150");offset-rotate:0deg;animation:ntx-orbit 3.2s linear 1.15s infinite}
#nt-splash .mark3d{position:relative;width:168px;height:168px;animation:ntx-turn 1s cubic-bezier(.16,1,.3,1) .75s both}
#nt-splash .glow3d{position:absolute;inset:0;filter:drop-shadow(0 10px 30px rgba(37,99,235,.6)) drop-shadow(0 0 2px rgba(186,230,253,.6))}
#nt-splash .mark{width:100%;height:100%;display:block;animation:ntx-reveal .6s cubic-bezier(.6,0,.2,1) .77s both}
#nt-splash .shine{position:absolute;inset:0;pointer-events:none;
  background:linear-gradient(105deg,transparent 35%,rgba(255,255,255,.95) 48%,rgba(255,255,255,.2) 54%,transparent 62%);background-size:260% 100%;background-position:130% 0;
  -webkit-mask:url(/brand/nt-mark.webp) center/contain no-repeat;mask:url(/brand/nt-mark.webp) center/contain no-repeat;mix-blend-mode:screen;
  animation:ntx-shine .9s ease-in-out 1.35s both,ntx-shine2 .8s ease-in-out 2.45s both}

#nt-splash .word{position:relative;margin-top:22px;display:flex;align-items:baseline;font-weight:800;font-size:40px;letter-spacing:-.6px;line-height:1.05;padding:2px 6px}
#nt-splash .word span{display:inline-block;opacity:0;transform:translateY(26px) scale(.9);filter:blur(8px);color:#F4F8FF;animation:ntx-letter .55s cubic-bezier(.16,1,.3,1) both}
#nt-splash .word .sp{width:12px;animation:none;opacity:1;filter:none;transform:none}
#nt-splash .word .tr{background:linear-gradient(180deg,#7DD3FC 0%,#38BDF8 40%,#2DD4BF 75%,#34D399 100%);-webkit-background-clip:text;background-clip:text;color:transparent}
#nt-splash .tag{margin-top:12px;display:flex;align-items:center;gap:10px;font-size:11px;font-weight:600;letter-spacing:4px;text-transform:uppercase;color:#A9BCE6;
  animation:ntx-track .7s cubic-bezier(.16,1,.3,1) 1.62s both}
#nt-splash .tag i{width:4px;height:4px;border-radius:50%;background:#2DD4BF;box-shadow:0 0 8px #2DD4BF}

#nt-splash .credit{margin-top:20px;display:flex;align-items:center;gap:9px;white-space:nowrap;font-size:11px;line-height:1;letter-spacing:3px;text-transform:uppercase;
  animation:ntx-credit .75s cubic-bezier(.16,1,.3,1) 2.0s both}
#nt-splash .credit .cl{display:block;width:30px;height:1px;background:linear-gradient(90deg,transparent,rgba(125,211,252,.7));transform-origin:right;animation:ntx-line .6s cubic-bezier(.16,1,.3,1) 2.1s both}
#nt-splash .credit .cr{background:linear-gradient(90deg,rgba(125,211,252,.7),transparent);transform-origin:left}
#nt-splash .credit .cby{font-weight:600;color:#7F93BF;letter-spacing:2.6px}
#nt-splash .credit .cn,#nt-splash .credit .cd{position:relative;font-weight:800;letter-spacing:3.4px;-webkit-background-clip:text;background-clip:text;color:transparent;background-size:250% 100%;
  animation:ntx-cshine .8s ease-in-out 2.25s both}
#nt-splash .credit .cn{background-image:linear-gradient(100deg,#DCE7F7 0%,#FFFFFF 38%,#FFFFFF 46%,#9FB6D9 60%,#E6EEFA 100%)}
#nt-splash .credit .cd{background-image:linear-gradient(100deg,#38BDF8 0%,#7DD3FC 38%,#E0F2FE 46%,#2563EB 62%,#38BDF8 100%)}
#nt-splash .credit .cdot{width:4px;height:4px;border-radius:50%;background:#38BDF8;box-shadow:0 0 8px #38BDF8}

@keyframes ntx-in{from{opacity:0}to{opacity:1}}
@keyframes ntx-out{to{opacity:0}}
@keyframes ntx-drift1{from{transform:translate(0,0) scale(1)}to{transform:translate(6vmax,3vmax) scale(1.12)}}
@keyframes ntx-drift2{from{transform:translate(0,0) scale(1.05)}to{transform:translate(-7vmax,-2vmax) scale(.95)}}
@keyframes ntx-twinkle{0%,100%{opacity:0;transform:scale(.6)}50%{opacity:.9;transform:scale(1)}}
@keyframes ntx-draw{to{stroke-dashoffset:0}}
@keyframes ntx-spark{0%{stroke-dashoffset:.03;opacity:1}88%{opacity:1}100%{stroke-dashoffset:-.97;opacity:0}}
@keyframes ntx-ecgout{to{opacity:0;transform:scaleY(.1)}}
@keyframes ntx-flash{0%{opacity:0;transform:scale(.2)}30%{opacity:1}100%{opacity:0;transform:scale(1.9)}}
@keyframes ntx-ring{0%{opacity:0;transform:scale(.5)}12%{opacity:.9}100%{opacity:0;transform:scale(2.4)}}
@keyframes ntx-raysin{from{opacity:0;transform:scale(.6)}to{opacity:1;transform:scale(1)}}
@keyframes ntx-spin{to{rotate:360deg}}
@keyframes ntx-orbit{from{offset-distance:0%}to{offset-distance:100%}}
@keyframes ntx-turn{0%{transform:rotateY(-62deg) rotateX(14deg) scale(.6);opacity:0}25%{opacity:1}100%{transform:none;opacity:1}}
@keyframes ntx-reveal{0%{clip-path:inset(-20% 100% -20% -20%);filter:brightness(2.4) blur(4px)}100%{clip-path:inset(-20% -20% -20% -20%);filter:brightness(1) blur(0)}}
@keyframes ntx-shine{from{background-position:130% 0}to{background-position:-30% 0}}
@keyframes ntx-shine2{from{background-position:130% 0}to{background-position:-30% 0}}
@keyframes ntx-letter{to{opacity:1;transform:none;filter:blur(0)}}
@keyframes ntx-track{from{opacity:0;letter-spacing:12px;filter:blur(4px)}to{opacity:1;letter-spacing:4px;filter:blur(0)}}
@keyframes ntx-credit{from{opacity:0;letter-spacing:7px;filter:blur(4px);transform:translateY(6px)}to{opacity:1;letter-spacing:3px;filter:blur(0);transform:none}}
@keyframes ntx-cshine{from{background-position:100% 0}to{background-position:0 0}}
@keyframes ntx-fadeup{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
@keyframes ntx-line{from{transform:scaleX(0)}to{transform:scaleX(1)}}
@keyframes ntx-iris{0%{clip-path:circle(150% at 50% 42%)}100%{clip-path:circle(0% at 50% 42%);visibility:hidden;pointer-events:none}}

@media (min-width:768px){
  #nt-splash .logo,#nt-splash .mark3d,#nt-splash .mark{width:196px;height:196px}
  #nt-splash .word{font-size:54px}
  #nt-splash .tag{font-size:13px}
  #nt-splash .ecg{top:calc(50% - 190px)}
  #nt-splash .credit{font-size:12.5px;margin-top:24px}
  #nt-splash .credit .cl{width:44px}
}
@media (max-width:360px){#nt-splash .credit{gap:7px;letter-spacing:2px}#nt-splash .credit .cl{display:none}}
@media (max-height:640px){#nt-splash .credit{margin-top:14px}#nt-splash .logo,#nt-splash .mark3d,#nt-splash .mark{width:136px;height:136px}}
@media (prefers-reduced-motion:reduce){
  #nt-splash *,#nt-splash *::before,#nt-splash *::after{animation-duration:.01s!important;animation-delay:0s!important;animation-iteration-count:1!important}
  #nt-splash{animation:ntx-rmout .6s ease 2.2s both!important}
  @keyframes ntx-rmout{to{opacity:0;visibility:hidden;pointer-events:none}}
}
`;
