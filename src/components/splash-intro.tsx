import { useEffect, useState } from "react";

/**
 * Opening intro shown once per browser session when the site is opened.
 * Pure CSS animation, server-rendered, so it starts on the very first paint (before the
 * app hydrates) and never delays loading. Total ~1.9 s; a tap skips it.
 * Repeat loads in the same session are hidden before paint by INTRO_HEAD_SCRIPT.
 */

/** Runs in <head> before paint: skip the intro if it already played in this session. */
export const INTRO_HEAD_SCRIPT = `try{if(sessionStorage.getItem('nt-intro')){document.documentElement.setAttribute('data-intro','seen')}else{sessionStorage.setItem('nt-intro','1')}}catch(e){}`;

const TOTAL_MS = 1950;

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
    const t = window.setTimeout(() => setGone(true), 380);
    return () => window.clearTimeout(t);
  }, [leaving]);

  if (gone) return null;

  const word = "NEET";
  const word2 = "Track";
  return (
    <div id="nt-splash" className={leaving ? "out" : ""} aria-hidden="true" onClick={() => setLeaving(true)}>
      <style dangerouslySetInnerHTML={{ __html: INTRO_CSS }} />
      <div className="bg" />
      <div className="grid" />

      <svg className="ecg" viewBox="0 0 1200 200" preserveAspectRatio="none">
        <defs>
          <linearGradient id="nt-ecg-g" x1="0" x2="1">
            <stop offset="0" stopColor="#38BDF8" stopOpacity="0" />
            <stop offset=".35" stopColor="#38BDF8" />
            <stop offset=".65" stopColor="#2DD4BF" />
            <stop offset="1" stopColor="#34D399" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path className="line" pathLength={1} d="M0 100 H470 L500 100 L520 70 L540 100 L560 100 L578 18 L600 182 L622 100 L648 100 L668 84 L688 100 H1200" />
        <path className="spark" pathLength={1} d="M0 100 H470 L500 100 L520 70 L540 100 L560 100 L578 18 L600 182 L622 100 L648 100 L668 84 L688 100 H1200" />
      </svg>

      <div className="stage">
        <div className="mark">
          <span className="ring r1" /><span className="ring r2" />
          <span className="halo" />
          <img src="/brand/nt-mark.webp" alt="" width={136} height={136} decoding="async" fetchPriority="high" />
        </div>
        <div className="word">
          {word.split("").map((ch, i) => <span key={`a${i}`} style={{ animationDelay: `${0.62 + i * 0.045}s` }}>{ch}</span>)}
          <span className="sp" />
          {word2.split("").map((ch, i) => <span key={`b${i}`} className="tr" style={{ animationDelay: `${0.8 + i * 0.045}s` }}>{ch}</span>)}
        </div>
        <div className="tag">Learn <i>·</i> Practice <i>·</i> Achieve</div>
        <div className="bar"><span /></div>
      </div>

      <div className="credit">
        <small>Crafted by</small>
        <b>Akmal<em>, MBBS</em></b>
        <svg className="sig" viewBox="0 0 160 14" aria-hidden="true"><path pathLength={1} d="M4 9 C 30 2, 52 13, 80 7 S 132 3, 156 8" /></svg>
      </div>
    </div>
  );
}

const INTRO_CSS = `
html[data-intro="seen"] #nt-splash{display:none!important}
#nt-splash{position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;overflow:hidden;cursor:pointer;
  font-family:'Poppins',ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#EAF2FF;
  -webkit-tap-highlight-color:transparent;
  animation:ntx-exit .42s cubic-bezier(.7,0,.3,1) 1.53s both}
#nt-splash.out{animation:ntx-exit .36s cubic-bezier(.7,0,.3,1) both}
#nt-splash .bg{position:absolute;inset:0;background:
  radial-gradient(520px 380px at 50% 42%,rgba(37,99,235,.38),transparent 70%),
  radial-gradient(420px 320px at 50% 100%,rgba(16,185,129,.18),transparent 70%),
  radial-gradient(700px 500px at 50% 0%,rgba(14,165,233,.12),transparent 70%),#010B26}
#nt-splash .grid{position:absolute;inset:0;opacity:.35;background-image:linear-gradient(rgba(148,178,255,.07) 1px,transparent 1px),linear-gradient(90deg,rgba(148,178,255,.07) 1px,transparent 1px);background-size:32px 32px;
  -webkit-mask-image:radial-gradient(closest-side at 50% 45%,#000,transparent);mask-image:radial-gradient(closest-side at 50% 45%,#000,transparent);animation:ntx-fade .5s ease-out both}

/* ECG sweep */
#nt-splash .ecg{position:absolute;left:0;top:calc(50% - 86px);width:100%;height:120px;overflow:visible}
#nt-splash .ecg path{fill:none;stroke-linecap:round;stroke-linejoin:round;vector-effect:non-scaling-stroke}
#nt-splash .ecg .line{stroke:url(#nt-ecg-g);stroke-width:2.4;stroke-dasharray:1;stroke-dashoffset:1;filter:drop-shadow(0 0 6px rgba(56,189,248,.8));
  animation:ntx-draw .6s cubic-bezier(.45,0,.2,1) .04s both,ntx-ecgout .22s ease-in .56s both}
#nt-splash .ecg .spark{stroke:#fff;stroke-width:3.4;stroke-dasharray:.035 1;stroke-dashoffset:.035;filter:drop-shadow(0 0 8px #7DD3FC) drop-shadow(0 0 16px #38BDF8);
  animation:ntx-spark .6s cubic-bezier(.45,0,.2,1) .04s both}

/* logo */
#nt-splash .stage{display:flex;flex-direction:column;align-items:center;margin-top:-28px}
#nt-splash .mark{position:relative;width:136px;height:136px;display:grid;place-items:center}
#nt-splash .mark img{position:relative;width:136px;height:136px;filter:drop-shadow(0 6px 22px rgba(37,99,235,.55));
  animation:ntx-logo .55s cubic-bezier(.2,1.25,.3,1) .42s both}
#nt-splash .halo{position:absolute;inset:-26px;border-radius:50%;background:radial-gradient(closest-side,rgba(56,189,248,.45),rgba(37,99,235,.15) 55%,transparent);
  animation:ntx-halo .7s ease-out .42s both}
#nt-splash .ring{position:absolute;left:50%;top:50%;width:120px;height:120px;margin:-60px;border-radius:50%;border:1.5px solid rgba(125,211,252,.7);opacity:0}
#nt-splash .r1{animation:ntx-ring .8s cubic-bezier(.2,.7,.3,1) .45s both}
#nt-splash .r2{animation:ntx-ring .8s cubic-bezier(.2,.7,.3,1) .6s both;border-color:rgba(52,211,153,.6)}

/* wordmark */
#nt-splash .word{margin-top:18px;display:flex;align-items:baseline;font-weight:800;font-size:36px;letter-spacing:-.5px;line-height:1}
#nt-splash .word span{display:inline-block;opacity:0;transform:translateY(16px);animation:ntx-up .42s cubic-bezier(.2,.9,.25,1) both}
#nt-splash .word .sp{width:10px}
#nt-splash .word .tr{background:linear-gradient(100deg,#38BDF8 0%,#2DD4BF 40%,#ffffff 50%,#34D399 60%,#34D399 100%);background-size:300% 100%;background-position:100% 0;
  -webkit-background-clip:text;background-clip:text;color:transparent;
  animation:ntx-up .42s cubic-bezier(.2,.9,.25,1) both,ntx-shine .7s ease-in-out 1.05s both}
#nt-splash .tag{margin-top:10px;font-size:11.5px;font-weight:600;letter-spacing:3.2px;text-transform:uppercase;color:#93A8D6;
  animation:ntx-tag .5s ease-out .95s both}
#nt-splash .tag i{font-style:normal;color:#2DD4BF;margin:0 2px}
#nt-splash .bar{margin-top:20px;width:132px;height:3px;border-radius:3px;background:rgba(148,178,255,.15);overflow:hidden;animation:ntx-fade .3s ease-out .5s both}
#nt-splash .bar span{display:block;height:100%;border-radius:3px;background:linear-gradient(90deg,#38BDF8,#2DD4BF,#34D399);transform-origin:left;
  animation:ntx-load 1s cubic-bezier(.4,0,.2,1) .5s both;box-shadow:0 0 10px rgba(45,212,191,.7)}

/* credit */
#nt-splash .credit{position:absolute;left:0;right:0;bottom:calc(34px + env(safe-area-inset-bottom,0px));display:flex;flex-direction:column;align-items:center;gap:3px;
  animation:ntx-tag .5s ease-out 1s both}
#nt-splash .credit small{font-size:10px;font-weight:600;letter-spacing:2.6px;text-transform:uppercase;color:#6F84B3}
#nt-splash .credit b{font-size:16px;font-weight:700;letter-spacing:.3px;color:#F1F6FF}
#nt-splash .credit em{font-style:normal;font-weight:600;color:#5EEAD4}
#nt-splash .sig{width:120px;height:12px;margin-top:-1px}
#nt-splash .sig path{fill:none;stroke:#2DD4BF;stroke-width:2;stroke-linecap:round;stroke-dasharray:1;stroke-dashoffset:1;animation:ntx-draw .5s ease-out 1.12s both}

@keyframes ntx-fade{from{opacity:0}}
@keyframes ntx-draw{to{stroke-dashoffset:0}}
@keyframes ntx-spark{0%{stroke-dashoffset:.035;opacity:1}90%{opacity:1}100%{stroke-dashoffset:-.965;opacity:0}}
@keyframes ntx-ecgout{to{opacity:0;transform:scaleY(.2)}}
@keyframes ntx-logo{0%{opacity:0;transform:scale(.45) rotate(-8deg);filter:blur(10px) drop-shadow(0 6px 22px rgba(37,99,235,.55))}100%{opacity:1;transform:none;filter:blur(0) drop-shadow(0 6px 22px rgba(37,99,235,.55))}}
@keyframes ntx-halo{0%{opacity:0;transform:scale(.3)}45%{opacity:1}100%{opacity:.75;transform:scale(1)}}
@keyframes ntx-ring{0%{opacity:0;transform:scale(.55)}12%{opacity:.9}100%{opacity:0;transform:scale(2.3)}}
@keyframes ntx-up{to{opacity:1;transform:none}}
@keyframes ntx-shine{from{background-position:100% 0}to{background-position:0 0}}
@keyframes ntx-tag{from{opacity:0;transform:translateY(8px);letter-spacing:6px}to{opacity:1;transform:none}}
@keyframes ntx-load{from{transform:scaleX(0)}to{transform:scaleX(1)}}
@keyframes ntx-exit{0%{clip-path:circle(150% at 50% 46%);opacity:1}70%{opacity:1}100%{clip-path:circle(0% at 50% 46%);opacity:0;visibility:hidden;pointer-events:none}}
@media (min-width:768px){#nt-splash .word{font-size:46px}#nt-splash .mark,#nt-splash .mark img{width:160px;height:160px}#nt-splash .ecg{top:calc(50% - 96px)}}
@media (prefers-reduced-motion:reduce){
  #nt-splash,#nt-splash *{animation-duration:.01s!important;animation-delay:0s!important}
  #nt-splash{animation:ntx-fadeout .5s ease .9s both!important}
  @keyframes ntx-fadeout{to{opacity:0;visibility:hidden;pointer-events:none}}
}
`;
