// Dr. Azka loader: the one loading screen used across NEET Track.
// Pure CSS + SVG (no libraries), light and dark aware, honours reduced motion.

interface DrAkzaLoaderProps {
  message?: string;
  text?: string;
  subMessage?: string;
  fullScreen?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const ORB = { sm: 120, md: 176, lg: 208 } as const;

export function DrAzkaLoader({ message, text, subMessage, fullScreen = false, size = "md", className = "" }: DrAkzaLoaderProps) {
  const orb = ORB[size];
  const raw = (message || text || "Preparing your session").trim();
  // "Dr. Azka is …" reads twice under the name, so drop that prefix and trailing dots.
  const msg = raw.replace(/^Dr\.?\s*Azka\s+is\s+/i, "").replace(/[.…\s]+$/, "");
  const label = msg.charAt(0).toUpperCase() + msg.slice(1);

  const content = (
    <div className={`azl ${fullScreen ? "azl-full" : ""} ${className}`} role="status" aria-live="polite" aria-label={`Dr. Azka: ${label}`}>
      <style>{AZL_CSS}</style>
      <div className="azl-stage" style={{ width: orb, height: orb }}>
        <div className="azl-halo" />
        <div className="azl-ring azl-ring-a" />
        <div className="azl-ring azl-ring-b" />
        <div className="azl-comet"><i /></div>
        <div className="azl-disc">
          <img className="azl-img" src="/brand/dr-azka-loader.webp" alt="" width={orb} height={orb} decoding="async" fetchPriority="high" />
          <span className="azl-gloss" />
        </div>
      </div>

      <svg className="azl-ecg" viewBox="0 0 220 34" aria-hidden="true">
        <defs>
          <linearGradient id="azl-ecg-g" x1="0" x2="1">
            <stop offset="0" stopColor="#2DD4BF" stopOpacity="0" />
            <stop offset=".35" stopColor="#2DD4BF" />
            <stop offset=".7" stopColor="#F5D27A" />
            <stop offset="1" stopColor="#F5D27A" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path pathLength={1} d="M0 18 H70 L80 18 L86 8 L92 26 L100 2 L108 32 L114 18 L124 18 L130 13 L136 18 H220" />
      </svg>

      <div className="azl-name">Dr. Azka</div>
      <div className="azl-msg">{label}<span className="azl-ell"><i>.</i><i>.</i><i>.</i></span></div>
      <div className="azl-bar"><i /><b /></div>
      {subMessage && <div className="azl-sub">{subMessage}</div>}
    </div>
  );

  return fullScreen ? <div className="azl-screen">{content}</div> : content;
}

export const DrAkzaLoader = DrAzkaLoader;

const AZL_CSS = `
.azl{--azl-gold:#C08A22;--azl-gold2:#7A5410;--azl-hi:#E7B95A;--azl-teal:#14B8A6;--azl-text:var(--foreground,#0F172A);--azl-muted:var(--muted-foreground,#64748B);
  display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:24px;user-select:none;
  font-family:'Poppins',ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;animation:azl-in .35s cubic-bezier(.2,.8,.2,1) both}
.azl-screen{min-height:100dvh;width:100%;display:flex;align-items:center;justify-content:center;
  background:radial-gradient(60% 45% at 50% 42%,rgba(45,212,191,.10),transparent 70%),radial-gradient(50% 40% at 50% 60%,rgba(245,210,122,.07),transparent 70%),var(--background,#fff)}
.dark .azl-screen,.azl-screen:where(.dark *){background:radial-gradient(60% 45% at 50% 42%,rgba(45,212,191,.16),transparent 70%),radial-gradient(50% 40% at 50% 62%,rgba(245,210,122,.09),transparent 70%),#040B14}
.dark .azl{--azl-text:#F1F5FB;--azl-muted:#93A4BF;--azl-gold:#F5D27A;--azl-gold2:#C9973B;--azl-hi:#FFF6DA;--azl-teal:#2DD4BF}

.azl-stage{position:relative;display:grid;place-items:center;margin-bottom:6px}
.azl-halo{position:absolute;inset:-22%;border-radius:50%;background:radial-gradient(closest-side,rgba(45,212,191,.32),rgba(245,210,122,.12) 55%,transparent 72%);filter:blur(6px);animation:azl-breathe 2.4s ease-in-out infinite}
.azl-ring{position:absolute;inset:0;border-radius:50%}
.azl-ring-a{background:conic-gradient(from 0deg,transparent 0deg,rgba(45,212,191,.0) 40deg,var(--azl-teal) 200deg,var(--azl-gold) 330deg,#fff 356deg,transparent 360deg);
  -webkit-mask:radial-gradient(farthest-side,transparent calc(100% - 3px),#000 calc(100% - 2.5px));mask:radial-gradient(farthest-side,transparent calc(100% - 3px),#000 calc(100% - 2.5px));
  animation:azl-spin 1.25s linear infinite;filter:drop-shadow(0 0 6px rgba(45,212,191,.55))}
.azl-ring-b{inset:7%;border:1px dashed rgba(245,210,122,.35);animation:azl-spin 7s linear infinite reverse}
.azl-comet{position:absolute;inset:0;animation:azl-spin 1.25s linear infinite}
.azl-comet i{position:absolute;left:50%;top:-3px;width:8px;height:8px;margin-left:-4px;border-radius:50%;background:#fff;box-shadow:0 0 8px #fff,0 0 16px var(--azl-gold),0 0 28px var(--azl-teal)}
.azl-disc{position:absolute;inset:11%;border-radius:50%;overflow:hidden;
  background:radial-gradient(120% 120% at 30% 20%,#123247 0%,#0A1B2B 45%,#06111C 100%);
  box-shadow:inset 0 0 0 1px rgba(255,255,255,.08),inset 0 -18px 40px rgba(0,0,0,.45),0 18px 40px -16px rgba(0,0,0,.6)}
.azl-img{position:absolute;left:50%;bottom:-6%;width:96%;height:96%;object-fit:contain;transform:translateX(-50%);animation:azl-float 3s ease-in-out infinite;
  -webkit-mask:linear-gradient(#000 78%,transparent 100%);mask:linear-gradient(#000 78%,transparent 100%)}
.azl-gloss{position:absolute;inset:0;border-radius:50%;background:linear-gradient(145deg,rgba(255,255,255,.16),transparent 38%);pointer-events:none}

.azl-ecg{width:200px;height:30px;margin-top:6px;overflow:visible}
.azl-ecg path{fill:none;stroke:url(#azl-ecg-g);stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:1;stroke-dashoffset:1;
  filter:drop-shadow(0 0 4px rgba(45,212,191,.7));animation:azl-trace 1.6s cubic-bezier(.55,.1,.3,1) infinite}

.azl-name{margin-top:4px;font-weight:800;font-size:22px;letter-spacing:.01em;line-height:1.2;
  background:linear-gradient(100deg,var(--azl-gold2) 0%,var(--azl-gold) 30%,var(--azl-hi) 46%,var(--azl-gold) 60%,var(--azl-gold2) 100%);background-size:220% 100%;
  -webkit-background-clip:text;background-clip:text;color:transparent;animation:azl-sheen 2.2s ease-in-out infinite}
.azl-msg{margin-top:4px;font-weight:600;font-size:15px;color:var(--azl-text);max-width:320px}
.azl-ell i{font-style:normal;animation:azl-dot 1.2s infinite}
.azl-ell i:nth-child(2){animation-delay:.2s}.azl-ell i:nth-child(3){animation-delay:.4s}
.azl-bar{position:relative;width:168px;height:3px;margin-top:14px;border-radius:99px;overflow:hidden;background:rgba(148,163,184,.22)}
.azl-bar i,.azl-bar b{position:absolute;top:0;bottom:0;border-radius:99px;background:linear-gradient(90deg,var(--azl-teal),var(--azl-gold));box-shadow:0 0 8px rgba(45,212,191,.8)}
.azl-bar i{animation:azl-bar1 1.15s cubic-bezier(.65,.05,.35,1) infinite}
.azl-bar b{animation:azl-bar2 1.15s cubic-bezier(.65,.05,.35,1) .45s infinite}
.azl-sub{margin-top:10px;font-size:12.5px;line-height:1.45;color:var(--azl-muted);max-width:300px}

@keyframes azl-in{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:none}}
@keyframes azl-spin{to{transform:rotate(360deg)}}
@keyframes azl-breathe{0%,100%{opacity:.7;transform:scale(.96)}50%{opacity:1;transform:scale(1.04)}}
@keyframes azl-float{0%,100%{transform:translateX(-50%) translateY(0)}50%{transform:translateX(-50%) translateY(-5px)}}
@keyframes azl-trace{0%{stroke-dashoffset:1;opacity:1}70%{stroke-dashoffset:0;opacity:1}100%{stroke-dashoffset:0;opacity:0}}
@keyframes azl-sheen{0%{background-position:120% 0}100%{background-position:-120% 0}}
@keyframes azl-dot{0%,20%{opacity:.15}50%{opacity:1}100%{opacity:.15}}
@keyframes azl-bar1{0%{left:-40%;width:40%}100%{left:100%;width:40%}}
@keyframes azl-bar2{0%{left:-20%;width:20%}100%{left:105%;width:20%}}
@media (prefers-reduced-motion:reduce){.azl *,.azl{animation-duration:0s!important;animation-iteration-count:1!important}.azl-ecg path{stroke-dashoffset:0}}
`;
