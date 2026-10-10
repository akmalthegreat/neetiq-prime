// Styles for Miss Azka. Uses the app's theme variables so light and dark mode
// both work; every animation is switched off for reduced-motion users.
export const AZKA_CSS = `
.azk-fab-wrap{position:fixed;z-index:90;user-select:none;-webkit-user-select:none}
.azk-fab-home{right:16px;bottom:calc(96px + env(safe-area-inset-bottom))}
@media (min-width:1024px){.azk-fab-home{bottom:24px;right:24px}}

.azk-fab{position:relative;display:block;width:60px;height:60px;border-radius:999px;padding:0;border:0;background:transparent;cursor:grab;touch-action:none;animation:azk-bob 3.6s ease-in-out infinite;-webkit-tap-highlight-color:transparent}
.azk-fab:active{cursor:grabbing}
.azk-fab:focus-visible{outline:3px solid var(--ring);outline-offset:4px}
.azk-fab-img{position:absolute;inset:4px;width:52px;height:52px;border-radius:999px;object-fit:cover;background:#fdf2ec;box-shadow:0 0 0 2px var(--card)}
.azk-fab-ring{position:absolute;inset:0;border-radius:999px;background:conic-gradient(from 0deg,#14B8A6,#0EA5E9,#6366F1,#EC4899,#14B8A6);animation:azk-spin 4s linear infinite}
.azk-fab-halo{position:absolute;inset:-6px;border-radius:999px;background:radial-gradient(circle,rgba(20,184,166,.45),rgba(14,165,233,0) 70%);animation:azk-pulse 2.4s ease-out infinite}
.azk-fab:hover .azk-fab-img{transform:scale(1.04)}
.azk-fab-img{transition:transform .25s ease}
.azk-online{position:absolute;right:2px;bottom:3px;width:13px;height:13px;border-radius:999px;background:#22C55E;box-shadow:0 0 0 2.5px var(--card)}
.azk-online::after{content:"";position:absolute;inset:0;border-radius:999px;background:#22C55E;animation:azk-ping 2s cubic-bezier(0,0,.2,1) infinite}
.azk-spark{position:absolute;left:-4px;top:-2px;display:grid;place-items:center;width:20px;height:20px;border-radius:999px;color:#fff;background:linear-gradient(135deg,#F59E0B,#EC4899);box-shadow:0 2px 8px rgba(236,72,153,.45);animation:azk-twinkle 2.8s ease-in-out infinite}
.azk-fab-x{position:absolute;right:-4px;top:-6px;z-index:2;display:grid;place-items:center;width:20px;height:20px;border-radius:999px;border:1px solid var(--border);background:var(--background);color:var(--muted-foreground);box-shadow:0 1px 3px rgba(0,0,0,.15)}
.azk-fab-x:hover{color:var(--foreground)}

.azk-bubble{position:absolute;right:calc(100% + 12px);bottom:4px;width:min(260px,calc(100vw - 110px));padding:12px 14px;border-radius:18px 18px 4px 18px;background:var(--card);color:var(--foreground);border:1px solid var(--border);box-shadow:0 12px 32px -8px rgba(15,23,42,.28);animation:azk-pop .45s cubic-bezier(.2,1.4,.4,1) both;transform-origin:bottom right}
.azk-bubble-r{right:auto;left:calc(100% + 12px);border-radius:18px 18px 18px 4px;transform-origin:bottom left}
.azk-bubble-h{font-weight:800;font-size:14px;margin-bottom:4px;padding-right:14px}
.azk-bubble p{font-size:12.5px;line-height:1.45;color:var(--muted-foreground);margin:0}
.azk-bubble-x{position:absolute;right:6px;top:6px;display:grid;place-items:center;width:20px;height:20px;border-radius:999px;color:var(--muted-foreground)}
.azk-bubble-x:hover{background:var(--secondary);color:var(--foreground)}
.azk-bubble-cta{margin-top:10px;display:inline-flex;align-items:center;gap:6px;padding:7px 14px;border-radius:999px;font-size:12.5px;font-weight:700;color:#fff;background:linear-gradient(135deg,#14B8A6,#0EA5E9 60%,#6366F1);box-shadow:0 6px 16px -6px rgba(14,165,233,.7)}
.azk-bubble-line{display:block;text-align:left;font-size:13px;font-weight:700;padding-right:14px}

.azk-scrim{position:fixed;inset:0;z-index:94;background:rgba(2,6,23,.35);backdrop-filter:blur(2px);animation:azk-fade .25s ease both}
@media (min-width:640px){.azk-scrim{background:rgba(2,6,23,.12);backdrop-filter:none}}
.azk-panel{position:fixed;z-index:95;left:0;right:0;bottom:0;height:min(88dvh,720px);display:flex;flex-direction:column;overflow:hidden;background:var(--background);color:var(--foreground);border-radius:24px 24px 0 0;box-shadow:0 -12px 48px -12px rgba(15,23,42,.35);animation:azk-up .38s cubic-bezier(.2,.9,.3,1) both;padding-bottom:env(safe-area-inset-bottom)}
@media (min-width:640px){.azk-panel{left:auto;right:24px;bottom:24px;width:408px;height:min(700px,calc(100dvh - 48px));border-radius:24px;border:1px solid var(--border);box-shadow:0 24px 64px -16px rgba(15,23,42,.4);padding-bottom:0}}

.azk-head{position:relative;display:flex;flex-wrap:wrap;align-items:center;gap:10px;padding:14px 14px 0;color:#fff;background:linear-gradient(130deg,#0F766E 0%,#0EA5E9 55%,#6366F1 100%);overflow:hidden}
.azk-head::before{content:"";position:absolute;inset:-40% -10% auto auto;width:220px;height:220px;border-radius:999px;background:radial-gradient(circle,rgba(255,255,255,.28),rgba(255,255,255,0) 65%);animation:azk-drift 9s ease-in-out infinite alternate;pointer-events:none}
.azk-head-av{position:relative;width:44px;height:44px;flex:none}
.azk-head-av img{position:absolute;inset:3px;width:38px;height:38px;border-radius:999px;object-fit:cover;background:#fdf2ec}
.azk-head-ring{position:absolute;inset:0;border-radius:999px;background:conic-gradient(from 0deg,#fff,rgba(255,255,255,.2),#fff);animation:azk-spin 5s linear infinite}
.azk-head .azk-online{box-shadow:0 0 0 2.5px #0EA5E9;width:11px;height:11px;right:0;bottom:1px}
.azk-head-name{font-weight:800;font-size:16px;letter-spacing:.01em;line-height:1.1}
.azk-head-sub{font-size:11.5px;opacity:.85;margin-top:2px}
.azk-icon-btn{display:grid;place-items:center;width:32px;height:32px;border-radius:10px;color:#fff;transition:background .2s}
.azk-icon-btn:hover{background:rgba(255,255,255,.18)}
.azk-tabs{flex-basis:100%;display:flex;gap:4px;margin-top:4px}
.azk-tabs button{flex:1;display:flex;align-items:center;justify-content:center;gap:6px;padding:9px 0 11px;font-size:12.5px;font-weight:700;color:rgba(255,255,255,.72);border-bottom:2.5px solid transparent;transition:color .2s,border-color .2s}
.azk-tabs button.on{color:#fff;border-color:#fff}

.azk-body{flex:1;overflow-y:auto;overscroll-behavior:contain;padding:14px 12px 8px;display:flex;flex-direction:column;gap:10px;scroll-behavior:smooth}

.azk-welcome{display:flex;flex-direction:column;align-items:center;text-align:center;padding:4px 4px 8px}
.azk-hero{position:relative;width:118px;height:118px;border-radius:999px;display:grid;place-items:end center;overflow:hidden;background:radial-gradient(circle at 50% 60%,rgba(20,184,166,.25),rgba(14,165,233,.12) 55%,transparent 72%);animation:azk-pop .5s cubic-bezier(.2,1.4,.4,1) both}
.azk-hero-img{width:96px;height:auto;animation:azk-bob 4s ease-in-out infinite}
.azk-welcome h3{margin:10px 0 4px;font-size:20px;font-weight:800}
.azk-welcome>p{margin:0 0 14px;font-size:13.5px;line-height:1.5;color:var(--muted-foreground);max-width:300px}
.azk-caps{display:grid;grid-template-columns:1fr 1fr;gap:8px;width:100%}
.azk-cap{display:flex;flex-direction:column;align-items:flex-start;gap:2px;padding:12px;border-radius:16px;text-align:left;background:var(--card);border:1px solid var(--border);transition:transform .18s,box-shadow .18s,border-color .18s;animation:azk-rise .45s ease both}
.azk-cap:hover{transform:translateY(-2px);border-color:#14B8A6;box-shadow:0 10px 24px -14px rgba(20,184,166,.8)}
.azk-cap-e{font-size:22px;line-height:1;margin-bottom:4px}
.azk-cap-t{font-size:13.5px;font-weight:800}
.azk-cap-s{font-size:11.5px;color:var(--muted-foreground)}
.azk-try{align-self:flex-start;margin:16px 2px 8px;font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--muted-foreground)}
.azk-chips{display:flex;flex-wrap:wrap;gap:6px;justify-content:flex-start;width:100%}
.azk-chips-after{padding-left:36px;animation:azk-rise .35s ease both}
.azk-chip{padding:7px 12px;border-radius:999px;font-size:12.5px;font-weight:600;text-align:left;color:var(--foreground);background:var(--secondary);border:1px solid var(--border);transition:background .15s,border-color .15s,transform .15s}
.azk-chip:hover{border-color:#0EA5E9;transform:translateY(-1px)}

.azk-row{display:flex;gap:8px;align-items:flex-end;animation:azk-rise .3s ease both}
.azk-row-me{justify-content:flex-end}
.azk-mini{width:28px;height:28px;border-radius:999px;object-fit:cover;flex:none;background:#fdf2ec;box-shadow:0 0 0 2px var(--card),0 0 0 3.5px rgba(20,184,166,.6)}
.azk-col{display:flex;flex-direction:column;gap:6px;max-width:86%;min-width:0}
.azk-row-me .azk-col{align-items:flex-end}
.azk-msg{padding:10px 13px;border-radius:18px;font-size:14px;line-height:1.5;white-space:pre-wrap;word-break:break-word}
.azk-msg-az{background:var(--card);border:1px solid var(--border);border-bottom-left-radius:6px}
.azk-msg-me{color:#fff;background:linear-gradient(135deg,#0EA5E9,#6366F1);border-bottom-right-radius:6px;box-shadow:0 6px 16px -10px rgba(99,102,241,.8)}
.azk-msg-err{border-color:rgba(239,68,68,.5)}
.azk-msg-team{background:rgba(16,185,129,.1);border-color:rgba(16,185,129,.35)}
.azk-from{display:block;font-size:10.5px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;opacity:.7;margin-bottom:2px}
.azk-typing{display:flex;gap:5px;align-items:center;padding:14px 16px}
.azk-typing i{width:7px;height:7px;border-radius:999px;background:#14B8A6;animation:azk-dot 1.2s ease-in-out infinite}
.azk-typing i:nth-child(2){animation-delay:.15s;background:#0EA5E9}
.azk-typing i:nth-child(3){animation-delay:.3s;background:#6366F1}

.azk-card{--t:#0EA5E9;display:flex;align-items:center;gap:11px;width:100%;padding:10px 12px;border-radius:16px;text-align:left;background:var(--card);border:1px solid var(--border);border-left:4px solid var(--t);box-shadow:0 8px 20px -16px var(--t);transition:transform .18s,box-shadow .18s;animation:azk-rise .4s ease both}
.azk-card:hover{transform:translateY(-2px);box-shadow:0 14px 26px -14px var(--t)}
.azk-card:active{transform:scale(.99)}
.azk-card-e{display:grid;place-items:center;width:38px;height:38px;flex:none;border-radius:12px;font-size:19px;background:color-mix(in oklab,var(--t) 16%,transparent)}
.azk-card-txt{display:flex;flex-direction:column;min-width:0;flex:1}
.azk-card-txt b{font-size:13.5px;font-weight:800;line-height:1.25}
.azk-card-txt small{font-size:11.5px;color:var(--muted-foreground);line-height:1.35;margin-top:2px}
.azk-card-go{flex:none;color:var(--t);transition:transform .18s}
.azk-card:hover .azk-card-go{transform:translateX(3px)}

.azk-quiz{position:relative;display:flex;flex-direction:column;gap:3px;width:100%;padding:12px 13px 13px;border-radius:18px;overflow:hidden;color:#fff;background:linear-gradient(135deg,#7C3AED,#6366F1 45%,#0EA5E9);box-shadow:0 14px 30px -16px rgba(99,102,241,.9);animation:azk-rise .4s ease both}
.azk-quiz::after{content:"";position:absolute;right:-30px;top:-30px;width:110px;height:110px;border-radius:999px;background:radial-gradient(circle,rgba(255,255,255,.3),transparent 70%)}
.azk-quiz-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:4px}
.azk-quiz-badge{font-size:11px;font-weight:800;letter-spacing:.04em;padding:3px 8px;border-radius:999px;background:rgba(255,255,255,.2)}
.azk-quiz-n{font-size:12px;font-weight:800;opacity:.9}
.azk-quiz b{font-size:15px;font-weight:800;line-height:1.25}
.azk-quiz small{font-size:11.5px;opacity:.85}
.azk-quiz-go{position:relative;z-index:1;margin-top:9px;display:flex;align-items:center;justify-content:center;gap:7px;padding:10px;border-radius:12px;font-size:13.5px;font-weight:800;color:#4338CA;background:#fff;transition:transform .15s}
.azk-quiz-go:hover{transform:translateY(-1px)}
.azk-quiz-go:disabled{opacity:.85}

.azk-team-note{display:flex;gap:8px;align-items:flex-start;padding:10px 12px;border-radius:14px;font-size:12.5px;line-height:1.45;color:var(--muted-foreground);background:var(--secondary)}

.azk-input{display:flex;align-items:flex-end;gap:8px;padding:10px 12px 12px;border-top:1px solid var(--border);background:var(--background)}
.azk-input textarea{flex:1;resize:none;font:inherit;max-height:110px;min-height:44px;padding:11px 14px;border-radius:22px;font-size:14.5px;line-height:1.4;color:var(--foreground);background:var(--card);border:1.5px solid var(--border);outline:none;transition:border-color .2s,box-shadow .2s}
.azk-input textarea:focus{border-color:#0EA5E9;box-shadow:0 0 0 3px rgba(14,165,233,.18)}
.azk-send{display:grid;place-items:center;width:44px;height:44px;flex:none;border-radius:999px;color:#fff;background:linear-gradient(135deg,#14B8A6,#0EA5E9 55%,#6366F1);box-shadow:0 8px 18px -8px rgba(14,165,233,.8);transition:transform .15s,opacity .15s}
.azk-send:hover:not(:disabled){transform:scale(1.06)}
.azk-send:disabled{opacity:.45;box-shadow:none}

@keyframes azk-spin{to{transform:rotate(360deg)}}
@keyframes azk-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
@keyframes azk-pulse{0%{transform:scale(.85);opacity:.9}100%{transform:scale(1.35);opacity:0}}
@keyframes azk-ping{75%,100%{transform:scale(2);opacity:0}}
@keyframes azk-twinkle{0%,100%{transform:scale(1) rotate(0)}50%{transform:scale(1.15) rotate(15deg)}}
@keyframes azk-pop{0%{opacity:0;transform:scale(.6)}100%{opacity:1;transform:scale(1)}}
@keyframes azk-fade{from{opacity:0}to{opacity:1}}
@keyframes azk-up{from{opacity:.4;transform:translateY(40px)}to{opacity:1;transform:translateY(0)}}
@keyframes azk-rise{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
@keyframes azk-dot{0%,80%,100%{transform:translateY(0);opacity:.5}40%{transform:translateY(-5px);opacity:1}}
@keyframes azk-drift{from{transform:translate(0,0)}to{transform:translate(-60px,30px)}}

@media (prefers-reduced-motion:reduce){
  .azk-fab,.azk-fab-ring,.azk-fab-halo,.azk-online::after,.azk-spark,.azk-head-ring,.azk-head::before,.azk-hero-img{animation:none!important}
  .azk-bubble,.azk-panel,.azk-row,.azk-card,.azk-quiz,.azk-cap,.azk-hero,.azk-scrim,.azk-chips-after{animation-duration:.01ms!important}
}
`;
