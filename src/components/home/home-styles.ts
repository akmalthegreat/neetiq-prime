// Scoped styles for the home dashboard (generated from the approved design; every rule is under .nth).
// Keyframes are prefixed nth- so nothing collides with the rest of the app.
export const HOME_CSS = `
.nth{color-scheme:dark;
  --bg:#050914; --card:#0B1222; --card2:#101A33; --line:rgba(148,178,255,.10); --line2:rgba(148,178,255,.18);
  --text:#EEF3FF; --mute:#9AA9C8; --dim:#6C7A99;
  --blue:#3B82F6; --cyan:#22D3EE; --green:#10B981; --amber:#F59E0B; --rose:#F43F5E; --violet:#8B5CF6; --gold:#FBBF24;
  --display:'Poppins',system-ui,sans-serif; --body:'Manrope','Poppins',system-ui,sans-serif;
  --ease:cubic-bezier(.2,.8,.2,1);}
.nth *{box-sizing:border-box}
.nth [hidden]{display:none!important}
.nth{background:var(--bg);color:var(--text);font-family:var(--body);-webkit-font-smoothing:antialiased}
.nth a{color:inherit;text-decoration:none}
.nth button, .nth input{font:inherit;color:inherit}
.nth button{cursor:pointer;border:0;background:none}
.nth button:focus-visible, .nth a:focus-visible, .nth input:focus-visible{outline:2px solid var(--cyan);outline-offset:2px;border-radius:10px}
  background:radial-gradient(600px 400px at 90% -5%,rgba(59,130,246,.16),transparent 60%),radial-gradient(500px 400px at -10% 40%,rgba(139,92,246,.09),transparent 60%),var(--bg)}
.nth .d{font-family:var(--display)}
.nth .rv{animation:nth-rvIn .8s var(--ease) both}
@keyframes nth-rvIn{from{opacity:0;transform:translateY(22px)}to{opacity:1;transform:none}}
.nth .nth-grid{padding:14px 14px 0;display:grid;grid-template-columns:minmax(0,1fr);gap:16px;align-items:start}
.nth .banner{position:relative}
.nth .viewport{overflow:hidden;border-radius:26px}
.nth .track{display:flex;gap:10px;transition:transform .85s cubic-bezier(.7,0,.25,1)}
.nth .slide{position:relative;flex:0 0 90%;height:226px;border-radius:26px;overflow:hidden;isolation:isolate;padding:18px;display:flex;gap:4px;color:#fff;transition:transform .6s var(--ease),opacity .6s;opacity:.55;transform:scale(.94)}
.nth .slide.on{opacity:1;transform:none;box-shadow:0 24px 50px -24px rgba(37,99,235,.7)}
.nth .slide .mesh{position:absolute;inset:-50%;z-index:-3;filter:blur(36px);animation:nth-mesh 14s ease-in-out infinite alternate}
@keyframes nth-mesh{0%{transform:rotate(0) scale(1)}100%{transform:rotate(35deg) scale(1.2)}}
.nth .slide .noise{position:absolute;inset:0;z-index:-2;background-image:radial-gradient(rgba(255,255,255,.14) 1px,transparent 1.2px);background-size:15px 15px;mask-image:linear-gradient(105deg,transparent 30%,#000 90%);opacity:.7}
.nth .slide .glare{position:absolute;inset:0;z-index:-1;background:linear-gradient(115deg,transparent 30%,rgba(255,255,255,.22) 45%,transparent 60%);transform:translateX(-120%);}
.nth .slide.on .glare{animation:nth-glare 2.4s .4s var(--ease) both}
@keyframes nth-glare{to{transform:translateX(120%)}}
.nth .slide .edge{position:absolute;inset:0;border-radius:26px;border:1px solid rgba(255,255,255,.22);pointer-events:none}
.nth .s-copy{flex:1;min-width:0;display:flex;flex-direction:column;z-index:1}
.nth .s-copy > *{transition:opacity .6s var(--ease),transform .6s var(--ease)}
.nth .slide.on .s-copy > :nth-child(2){transition-delay:.12s}
.nth .slide.on .s-copy > :nth-child(3){transition-delay:.2s}
.nth .slide.on .s-copy > :nth-child(4){transition-delay:.28s}
.nth .tag{align-self:flex-start;display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:999px;font:700 10.5px var(--display);letter-spacing:1.1px;background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.3);backdrop-filter:blur(6px)}
.nth .tag i{width:6px;height:6px;border-radius:50%;background:#fff;animation:nth-blink 1.2s infinite}
.nth .s-title{margin-top:10px;font:800 24px/1.1 var(--display);letter-spacing:-.8px;text-wrap:balance}
.nth .s-sub{margin-top:6px;font-size:12.5px;line-height:1.45;color:rgba(255,255,255,.85);max-width:30ch}
.nth .s-cta{margin-top:auto;align-self:flex-start;display:inline-flex;align-items:center;gap:8px;height:38px;padding:0 6px 0 14px;border-radius:13px;background:#fff;color:#0B1530;font:700 13px var(--display);box-shadow:0 10px 22px rgba(0,0,0,.28)}
.nth .s-cta span{width:26px;height:26px;border-radius:9px;display:grid;place-items:center;background:#0B1530;color:#fff}
.nth .s-art{position:relative;width:118px;flex-shrink:0;z-index:1}
.nth .dots{margin-top:12px;display:flex;justify-content:center;gap:6px}
.nth .dots button{position:relative;height:6px;width:6px;border-radius:3px;background:rgba(255,255,255,.2);overflow:hidden;transition:width .4s var(--ease)}
.nth .dots button.on{width:38px}
.nth .dots button.on i{position:absolute;inset:0;background:linear-gradient(90deg,#60A5FA,#22D3EE);transform-origin:left;animation:nth-fill 5.5s linear forwards}
@keyframes nth-fill{from{transform:scaleX(0)}to{transform:scaleX(1)}}
.nth .azka-art{position:absolute;right:-18px;bottom:-22px;width:150px;animation:nth-bob 3.4s ease-in-out infinite;filter:drop-shadow(0 14px 22px rgba(0,0,0,.4))}
.nth .badge3d{position:absolute;right:-4px;top:16px;text-align:center}
.nth .badge3d b{display:block;font:800 66px/1 var(--display);letter-spacing:-4px;background:linear-gradient(180deg,#FFF7D6 10%,#FBBF24 55%,#B45309);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 6px 0 rgba(120,53,15,.55)) drop-shadow(0 18px 24px rgba(0,0,0,.35));animation:nth-bob 3s ease-in-out infinite}
.nth .badge3d small{display:block;margin-top:4px;font:700 10px var(--display);letter-spacing:3px;color:#FDE68A}
.nth .ray{position:absolute;right:20px;top:20px;width:110px;height:110px;border-radius:50%;background:repeating-conic-gradient(rgba(255,255,255,.18) 0 8deg,transparent 8deg 22deg);animation:nth-spin 22s linear infinite;mask-image:radial-gradient(circle,#000 30%,transparent 70%)}
.nth .helix{position:absolute;right:6px;top:6px;width:110px;height:190px}
.nth .helix span{position:absolute;left:50%;width:84px;height:6px;margin-left:-42px;border-radius:3px;animation:nth-twist 3s ease-in-out infinite}
@keyframes nth-twist{0%,100%{transform:scaleX(1)}50%{transform:scaleX(-1)}}
.nth .helix span::before, .nth .helix span::after{content:"";position:absolute;top:-3px;width:12px;height:12px;border-radius:50%}
.nth .helix span::before{left:-4px;background:#A5F3FC;box-shadow:0 0 10px #22D3EE}
.nth .helix span::after{right:-4px;background:#FDE68A;box-shadow:0 0 10px #F59E0B}
.nth .mini-timer{display:flex;gap:4px;margin-top:8px}
.nth .mini-timer span{min-width:38px;padding:5px 0 3px;border-radius:9px;text-align:center;font:800 15px var(--display);background:rgba(0,0,0,.28);border:1px solid rgba(255,255,255,.18)}
.nth .mini-timer small{display:block;font:600 8px var(--display);letter-spacing:.5px;opacity:.75}
.nth .podium{position:absolute;right:4px;bottom:-2px;display:flex;align-items:flex-end;gap:5px}
.nth .podium i{display:block;width:28px;border-radius:8px 8px 0 0;background:linear-gradient(180deg,rgba(255,255,255,.55),rgba(255,255,255,.12));transform-origin:bottom;animation:nth-rise 1s var(--ease) both}
@keyframes nth-rise{from{transform:scaleY(0)}}
.nth .podium .c{position:absolute;left:33px;top:-34px;animation:nth-bob 2.6s ease-in-out infinite}
.nth .hero{position:relative;border-radius:28px;overflow:hidden;isolation:isolate;border:1px solid var(--line2);min-height:470px;display:flex;flex-direction:column;justify-content:flex-end;padding:214px 18px 18px;box-shadow:0 30px 60px -30px rgba(0,0,0,.9)}
.nth .hero .photo{position:absolute;inset:0;z-index:-3;overflow:hidden}
.nth .hero .photo img{width:100%;height:340px;object-fit:cover;object-position:52% 0%;transform-origin:50% 30%;animation:nth-kenburns 22s ease-in-out infinite alternate}
@keyframes nth-kenburns{from{transform:scale(1.04)}to{transform:scale(1.16) translateX(-2%)}}
.nth .hero .shade{position:absolute;inset:0;z-index:-2;background:
  linear-gradient(180deg,rgba(5,9,20,.05) 0%,rgba(5,9,20,.12) 22%,rgba(5,9,20,.75) 38%,rgba(6,11,24,.96) 52%,#060B18 100%),
  radial-gradient(120% 60% at 0% 0%,rgba(37,99,235,.35),transparent 60%)}
.nth .hero .scan{position:absolute;left:0;right:0;top:0;height:120px;z-index:-1;background:linear-gradient(180deg,transparent,rgba(34,211,238,.10),transparent);animation:nth-scan 6s linear infinite}
@keyframes nth-scan{from{transform:translateY(-120px)}to{transform:translateY(420px)}}
.nth .ecg{position:absolute;left:0;right:0;top:168px;z-index:-1;opacity:.9}
.nth .ecg path{stroke-dasharray:900;stroke-dashoffset:900;animation:nth-ecg 3.2s linear infinite}
@keyframes nth-ecg{0%{stroke-dashoffset:900}70%{stroke-dashoffset:0;opacity:1}100%{stroke-dashoffset:0;opacity:0}}
.nth .hero-top{position:absolute;top:16px;left:16px;right:16px;display:flex;justify-content:space-between;align-items:center}
.nth .glass{background:rgba(9,15,32,.55);backdrop-filter:blur(14px) saturate(1.4);-webkit-backdrop-filter:blur(14px) saturate(1.4);border:1px solid rgba(255,255,255,.12)}
.nth .target-pill{position:relative;overflow:hidden;display:inline-flex;align-items:center;gap:6px;height:30px;padding:0 11px;border-radius:999px;font:700 11px var(--display);letter-spacing:1px;color:#A7F3D0}
.nth .target-pill::after{content:"";position:absolute;top:0;bottom:0;width:30px;background:rgba(255,255,255,.35);filter:blur(6px);animation:nth-sheen 4s 1s ease-in-out infinite}
.nth .live-pill{display:inline-flex;align-items:center;gap:6px;height:30px;padding:0 10px;border-radius:999px;font:600 11px var(--display);color:#E2E8F0}
.nth .live-pill i{width:7px;height:7px;border-radius:50%;background:#22C55E;animation:nth-pulseG 1.8s infinite}
@keyframes nth-pulseG{0%{box-shadow:0 0 0 0 rgba(34,197,94,.7)}70%{box-shadow:0 0 0 8px rgba(34,197,94,0)}100%{box-shadow:0 0 0 0 rgba(34,197,94,0)}}
.nth .hi{margin:0;font:800 32px/1.05 var(--display);letter-spacing:-1px}
.nth .hi span{background:linear-gradient(90deg,#FFFFFF,#BFDBFE,#67E8F9,#FFFFFF);background-size:300% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;animation:nth-shimmer 6s linear infinite}
@keyframes nth-shimmer{to{background-position:300% 0}}
.nth .goal{margin-top:8px;display:flex;align-items:center;gap:8px;font-size:13.5px;color:#D7E1F7;flex-wrap:wrap}
.nth .goal .star{animation:nth-spin 8s linear infinite}
.nth .goal b{color:#fff;font-family:var(--display)}
.nth .aiims{display:inline-flex;align-items:center;gap:5px;padding:3px 8px;border-radius:8px;font-weight:700;font-size:12px;color:#FDE68A;background:rgba(245,158,11,.14);border:1px solid rgba(245,158,11,.35)}
.nth .chips{margin-top:12px;display:flex;gap:8px;flex-wrap:wrap}
.nth .chip{display:inline-flex;align-items:center;gap:7px;height:36px;padding:0 12px;border-radius:12px;font:600 12.5px var(--display);color:#E6EDFB}
.nth .chip.fire{color:#FCD34D;background:rgba(245,158,11,.16);border:1px solid rgba(245,158,11,.4)}
.nth .chip.fire svg{animation:nth-flicker 1.6s ease-in-out infinite;transform-origin:bottom}
@keyframes nth-flicker{0%,100%{transform:scale(1) rotate(0)}30%{transform:scale(1.12,.94) rotate(-4deg)}60%{transform:scale(.95,1.08) rotate(3deg)}}
.nth .chip.lb{background:linear-gradient(90deg,rgba(139,92,246,.28),rgba(59,130,246,.22));border:1px solid rgba(167,139,250,.5)}
.nth .chip.lb em{font-style:normal;font-size:11px;color:#86EFAC}
.nth .dash{margin-top:14px;border-radius:22px;padding:14px}
.nth .dash-row{display:flex;align-items:center;gap:14px}
.nth .ring{position:relative;width:86px;height:86px;flex-shrink:0}
.nth .ring svg{transform:rotate(-90deg)}
.nth .ring .v{position:absolute;inset:0;display:grid;place-items:center;text-align:center;line-height:1.05}
.nth .ring .v b{font:800 23px var(--display)}
.nth .ring .v small{display:block;font-size:10.5px;color:var(--mute);font-weight:700}
.nth .dash h3{margin:0;font:700 15px var(--display)}
.nth .dash p{margin:3px 0 0;font-size:12.5px;color:var(--mute)}
.nth .bar{display:block;height:7px;border-radius:4px;background:rgba(255,255,255,.1);overflow:hidden;margin-top:9px}
.nth .bar i{display:block;height:100%;border-radius:4px;transform-origin:left;animation:nth-barIn 1.6s var(--ease) .5s both}
@keyframes nth-barIn{from{transform:scaleX(0)}}
.nth .stats{margin-top:12px;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}
.nth .stat{padding:9px 6px;border-radius:14px;text-align:center;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08)}
.nth .stat small{display:block;font-size:10.5px;font-weight:700;color:var(--mute)}
.nth .stat b{display:block;margin-top:2px;font:800 19px var(--display);font-variant-numeric:tabular-nums}
.nth .sec-h{display:flex;align-items:center;justify-content:space-between;margin:2px 2px 12px;gap:8px}
.nth .sec-h h2{margin:0;display:flex;align-items:center;gap:9px;font:700 16.5px var(--display);letter-spacing:-.2px}
.nth .si{width:30px;height:30px;border-radius:10px;display:grid;place-items:center;flex-shrink:0}
.nth .sec-h a, .nth .sec-h .note{font:600 12.5px var(--display);display:flex;align-items:center;gap:4px;white-space:nowrap}
.nth .panel{border-radius:26px;padding:16px;background:var(--card);border:1px solid var(--line)}
.nth .lead{margin:-6px 2px 12px;font-size:12.5px;color:var(--mute)}
.nth .azka{position:relative;display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:22px;background:linear-gradient(110deg,#062A26,#081B22 60%,#0A1428);border:1px solid rgba(16,185,129,.35)}
.nth .azka img{width:62px;height:62px;object-fit:contain;flex-shrink:0;animation:nth-bob 3.2s ease-in-out infinite}
.nth .azka .ai{position:absolute;left:58px;bottom:12px;font-size:9px;font-weight:800;color:#fff;background:var(--green);border-radius:6px;padding:1px 5px}
.nth .azka small{font:700 10.5px var(--display);letter-spacing:1px;color:#5EEAD4}
.nth .typing{font-size:13px;font-weight:700;line-height:1.4;margin-top:2px;min-height:36px}
.nth .caret{display:inline-block;width:2px;height:14px;background:#5EEAD4;vertical-align:-2px;margin-left:2px;animation:nth-blink 1s steps(1) infinite}
.nth .btn-g{height:36px;padding:0 12px;border-radius:12px;font:700 12.5px var(--display);color:#5EEAD4;background:rgba(16,185,129,.14);border:1px solid rgba(16,185,129,.45);display:flex;align-items:center;white-space:nowrap}
.nth .lbp{position:relative;overflow:hidden;background:radial-gradient(400px 200px at 50% 0%,rgba(139,92,246,.25),transparent 70%),var(--card)}
.nth .lb-tabs{display:flex;gap:4px;padding:4px;border-radius:13px;background:#070D1B;border:1px solid var(--line);margin-bottom:14px}
.nth .lb-tabs button{flex:1;height:34px;border-radius:10px;font:600 12.5px var(--display);color:var(--mute);transition:all .25s var(--ease)}
.nth .lb-tabs button.on{background:linear-gradient(180deg,#2A2366,#1E1A4D);color:#fff;box-shadow:inset 0 1px 0 rgba(255,255,255,.12)}
.nth .pod{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));align-items:end;gap:8px;text-align:center}
.nth .pod .av{position:relative;margin:0 auto;border-radius:50%;display:grid;place-items:center;font:700 14px var(--display);color:#fff}
.nth .pod .av .cr{position:absolute;top:-20px;left:50%;margin-left:-11px;animation:nth-bob 2.4s ease-in-out infinite}
.nth .pod .nm{margin-top:7px;font:600 12.5px var(--display)}
.nth .pod .xp{font-size:11px;color:var(--mute);font-weight:700}
.nth .pod .blk{margin-top:8px;border-radius:12px 12px 4px 4px;display:grid;place-items:center;font:800 24px var(--display);transform-origin:bottom;animation:nth-rise 1.1s var(--ease) both}
.nth .lb-list{margin-top:12px;display:flex;flex-direction:column;gap:6px}
.nth .lb-row{display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:13px;background:rgba(255,255,255,.03);font-size:13px}
.nth .lb-row .r{width:28px;font:700 13px var(--display);color:var(--mute)}
.nth .lb-row .a{width:30px;height:30px;border-radius:50%;display:grid;place-items:center;font:700 11px var(--display)}
.nth .lb-row .n{flex:1;font-weight:700}
.nth .lb-row .x{font:600 12px var(--display);color:#C4B5FD}
.nth .lb-row.me{background:linear-gradient(90deg,rgba(59,130,246,.22),rgba(34,211,238,.10));border:1px solid rgba(96,165,250,.55);box-shadow:0 0 0 0 rgba(96,165,250,.5);animation:nth-meGlow 2.6s ease-in-out infinite}
@keyframes nth-meGlow{50%{box-shadow:0 0 22px -4px rgba(96,165,250,.6)}}
.nth .lb-row .up{font:700 11px var(--display);color:#4ADE80}
.nth .lb-foot{margin-top:10px;display:flex;justify-content:space-between;font-size:12px;color:var(--mute)}
.nth .lb-foot b{color:#E9D5FF}
.nth .subj{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}
.nth .sc{position:relative;overflow:hidden;border-radius:22px;padding:12px 8px;min-height:176px;border:1px solid;display:flex;flex-direction:column;align-items:center;text-align:center}
.nth .sc .halo{position:absolute;top:-40px;width:140px;height:140px;border-radius:50%;filter:blur(30px);opacity:.6}
.nth .sc .mini{position:relative;width:70px;height:70px;margin-top:4px}
.nth .sc .mini svg.r{transform:rotate(-90deg)}
.nth .sc .mini .ic{position:absolute;inset:0;display:grid;place-items:center}
.nth .sc circle.sr{animation:nth-ringIn 1.5s var(--ease) .5s both}
@keyframes nth-ringIn{from{stroke-dashoffset:182}}
.nth .sc h4{position:relative;margin:8px 0 0;font:700 14.5px var(--display)}
.nth .sc .pc{position:relative;font:700 12.5px var(--display);margin-top:2px}
.nth .sc .mcq{position:relative;margin-top:auto;font-size:11px;font-weight:700;padding:4px 8px;border-radius:999px;background:rgba(0,0,0,.25);border:1px solid rgba(255,255,255,.12)}
.nth .tb{position:relative;overflow:hidden;background:linear-gradient(160deg,#0D1A3A,#0A1328 55%,#081022);border:1px solid rgba(96,165,250,.3)}
.nth .tb-hero{display:flex;gap:12px;align-items:center}
.nth .tb-hero h3{margin:0;font:800 20px/1.15 var(--display);letter-spacing:-.4px}
.nth .tb-hero p{margin:6px 0 0;font-size:12.5px;color:var(--mute);line-height:1.45}
.nth .paper{position:relative;width:96px;height:104px;flex-shrink:0}
.nth .paper i{position:absolute;inset:0;border-radius:12px;background:#E9F0FF;box-shadow:0 10px 24px rgba(0,0,0,.35)}
.nth .paper i:nth-child(1){transform:rotate(-10deg) translate(-6px,4px);background:#93C5FD;animation:nth-paperA 4s ease-in-out infinite}
.nth .paper i:nth-child(2){transform:rotate(6deg) translate(6px,2px);background:#C7D2FE;animation:nth-paperB 4s ease-in-out infinite}
.nth .paper i:nth-child(3){padding:12px 10px;display:flex;flex-direction:column;gap:6px}
.nth .paper i:nth-child(3) span{display:block;height:5px;border-radius:3px;background:#C9D5EE}
.nth .paper i:nth-child(3) span.q{background:#3B82F6;width:60%}
.nth .paper i:nth-child(3) span.tick{width:12px;height:12px;border-radius:50%;background:#10B981;align-self:flex-end;animation:nth-pop2 2s ease-in-out infinite}
@keyframes nth-paperA{50%{transform:rotate(-16deg) translate(-12px,6px)}}
@keyframes nth-paperB{50%{transform:rotate(12deg) translate(12px,2px)}}
@keyframes nth-pop2{0%,40%{transform:scale(0)}55%{transform:scale(1.2)}70%,100%{transform:scale(1)}}
.nth .steps-mini{margin-top:14px;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}
.nth .steps-mini div{padding:8px 6px;border-radius:12px;text-align:center;font:600 10.5px var(--display);color:#C7D6F5;background:rgba(255,255,255,.04);border:1px solid var(--line)}
.nth .steps-mini b{display:block;margin:0 auto 4px;width:22px;height:22px;border-radius:50%;display:grid;place-items:center;font-size:11px;color:#fff;background:linear-gradient(135deg,#2563EB,#22D3EE)}
.nth .cta-main{position:relative;overflow:hidden;margin-top:14px;width:100%;height:52px;border-radius:16px;display:flex;align-items:center;justify-content:center;gap:10px;font:700 15px var(--display);color:#fff;background:linear-gradient(90deg,#2563EB,#0EA5E9);box-shadow:0 14px 30px -10px rgba(37,99,235,.8)}
.nth .cta-main::after{content:"";position:absolute;top:-20px;bottom:-20px;width:46px;background:rgba(255,255,255,.45);filter:blur(8px);animation:nth-sheen 3.4s ease-in-out infinite}
.nth .quick{margin-top:10px;display:flex;gap:8px;flex-wrap:wrap}
.nth .quick button{height:32px;padding:0 11px;border-radius:10px;font:600 11.5px var(--display);color:#BFD4FF;background:rgba(59,130,246,.1);border:1px solid rgba(96,165,250,.3)}
.nth .wiz{margin-top:14px;border-radius:20px;background:#070E1F;border:1px solid var(--line2);overflow:hidden}
.nth .wiz[hidden]{display:none}
.nth .wz-steps{display:flex;align-items:center;padding:14px 14px 0}
.nth .wz-steps .st{display:flex;flex-direction:column;align-items:center;gap:4px;font:600 10px var(--display);color:var(--dim);width:54px}
.nth .wz-steps .st b{width:28px;height:28px;border-radius:50%;display:grid;place-items:center;font-size:12px;background:#111B33;border:1px solid var(--line2);color:var(--mute);transition:all .3s var(--ease)}
.nth .wz-steps .st.done b{background:var(--green);border-color:var(--green);color:#04221A}
.nth .wz-steps .st.on b{background:linear-gradient(135deg,#2563EB,#22D3EE);border-color:transparent;color:#fff;box-shadow:0 0 0 4px rgba(59,130,246,.2)}
.nth .wz-steps .st.on{color:#fff}
.nth .wz-steps .ln{flex:1;height:2px;margin-bottom:16px;background:#1A2540;position:relative;overflow:hidden}
.nth .wz-steps .ln i{position:absolute;inset:0;background:var(--green);transform-origin:left;transform:scaleX(0);transition:transform .5s var(--ease)}
.nth .wz-steps .ln.done i{transform:scaleX(1)}
.nth .wz-body{padding:14px;min-height:240px}
.nth .wz-body h4{margin:0;font:700 16px var(--display)}
.nth .wz-body .hint{margin:4px 0 12px;font-size:12px;color:var(--mute)}
.nth .pane{animation:nth-paneIn .45s var(--ease) both}
@keyframes nth-paneIn{from{opacity:0;transform:translateX(18px)}}
.nth .subj-pick{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
.nth .sp{position:relative;padding:14px 8px;border-radius:16px;text-align:center;border:1.5px solid var(--line2);background:#0C1529;transition:all .25s var(--ease)}
.nth .sp b{display:block;margin-top:6px;font:600 13px var(--display)}
.nth .sp small{font-size:10.5px;color:var(--mute);font-weight:700}
.nth .sp .ck{position:absolute;top:8px;right:8px;width:18px;height:18px;border-radius:6px;border:1.5px solid #3A4A6B;display:grid;place-items:center}
.nth .sp.on{border-color:var(--c);background:color-mix(in srgb,var(--c) 14%,#0C1529);box-shadow:0 8px 20px -10px var(--c)}
.nth .sp.on .ck{background:var(--c);border-color:var(--c)}
.nth .presets{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px}
.nth .presets button{height:30px;padding:0 10px;border-radius:9px;font:600 11.5px var(--display);color:#C7D6F5;background:#111B33;border:1px solid var(--line2)}
.nth .presets button.ai{color:#E9D5FF;background:linear-gradient(90deg,rgba(139,92,246,.3),rgba(59,130,246,.2));border-color:rgba(167,139,250,.5)}
.nth .search{display:flex;align-items:center;gap:8px;height:40px;padding:0 12px;border-radius:12px;background:#0C1529;border:1px solid var(--line2);margin-bottom:10px}
.nth .search input{flex:1;min-width:0;border:0;outline:0;background:transparent;font-size:13px}
.nth .ch-list{max-height:208px;overflow:auto;display:flex;flex-direction:column;gap:6px;padding-right:2px}
.nth .ch{display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:12px;background:#0C1529;border:1px solid var(--line);font-size:13px;font-weight:600;text-align:left;width:100%}
.nth .ch .box{width:18px;height:18px;border-radius:6px;border:1.5px solid #3A4A6B;display:grid;place-items:center;flex-shrink:0;transition:all .2s}
.nth .ch.on{border-color:rgba(96,165,250,.55);background:#0F1D3A}
.nth .ch.on .box{background:var(--blue);border-color:var(--blue)}
.nth .ch .grow{flex:1;min-width:0}
.nth .ch .sub{font-size:10.5px;color:var(--dim);font-weight:700;display:block}
.nth .ch .acc{font:700 11px var(--display);padding:2px 6px;border-radius:6px}
.nth .sel-count{margin-top:10px;font-size:12px;color:var(--mute)}
.nth .sel-count b{color:#fff}
.nth .qnum{font:800 46px/1 var(--display);letter-spacing:-2px;text-align:center}
.nth .qnum small{font:600 13px var(--display);letter-spacing:0;color:var(--mute);margin-left:4px}
.nth .range{width:100%;margin:14px 0 6px;accent-color:#3B82F6;height:24px}
.nth .ticks{display:flex;justify-content:space-between;font-size:10.5px;color:var(--dim);font-weight:700}
.nth .seg{display:grid;gap:4px;padding:4px;border-radius:13px;background:#0C1529;border:1px solid var(--line);margin-top:12px}
.nth .seg button{height:34px;border-radius:9px;font:600 12.5px var(--display);color:var(--mute);transition:all .25s var(--ease)}
.nth .seg button.on{background:linear-gradient(180deg,#1E3A6E,#162B52);color:#fff}
.nth .toggle{margin-top:10px;display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border-radius:12px;background:#0C1529;border:1px solid var(--line);font-size:13px;font-weight:600}
.nth .toggle small{display:block;font-size:11px;color:var(--mute);font-weight:600}
.nth .sq-list{display:flex;flex-direction:column;gap:8px}
.nth .sq{padding:12px 12px 4px;border-radius:14px;background:#0C1529;border:1px solid var(--line);border-left:3px solid var(--c)}
.nth .sq-top{display:flex;align-items:center;gap:9px}
.nth .sq-top b{font:700 15px var(--display);flex:1}
.nth .sq .range{margin:8px 0 2px}
.nth .sq-total{margin-top:10px;text-align:right;font-size:13px;color:var(--mute);font-weight:600}
.nth .sq-total b{font:800 20px var(--display);color:#fff;margin:0 3px}
.nth .stepper{display:flex;align-items:center;border-radius:11px;background:#070E1F;border:1px solid var(--line2);overflow:hidden}
.nth .stepper button{width:36px;height:36px;font:600 19px var(--display);color:#C7D6F5}
.nth .stepper button:disabled{opacity:.3}
.nth .stepper input{width:46px;height:36px;text-align:center;background:transparent;border:0;color:#fff;font:800 16px var(--display);outline:none}
.nth .tm{margin-top:12px;padding:12px;border-radius:14px;background:#0C1529;border:1px solid var(--line)}
.nth .tm-head{display:flex;align-items:center;justify-content:space-between;gap:10px;font-size:14px;font-weight:700}
.nth .tm-head small{display:block;font-size:11.5px;color:var(--mute);font-weight:600;margin-top:2px}
.nth .tm-chips{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin-top:10px}
.nth .tm-chips button{height:34px;padding:0 6px;border-radius:9px;font:600 12.5px var(--display);color:#C7D6F5;background:#111B33;border:1px solid var(--line2);transition:all .2s var(--ease)}
.nth .tm-chips button.on{color:#fff;background:linear-gradient(180deg,#1E3A6E,#162B52);border-color:#3B82F6}
.nth .sw{width:42px;height:24px;border-radius:12px;background:#24314F;position:relative;transition:background .25s}
.nth .sw::after{content:"";position:absolute;top:3px;left:3px;width:18px;height:18px;border-radius:50%;background:#fff;transition:transform .25s var(--ease)}
.nth .sw.on{background:var(--green)}
.nth .sw.on::after{transform:translateX(18px)}
.nth .modes{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.nth .mode{position:relative;padding:12px;border-radius:16px;text-align:left;border:1.5px solid var(--line2);background:#0C1529;transition:all .25s var(--ease)}
.nth .mode .mi{width:34px;height:34px;border-radius:11px;display:grid;place-items:center;margin-bottom:8px}
.nth .mode b{display:block;font:600 13.5px var(--display)}
.nth .mode small{display:block;margin-top:2px;font-size:11px;color:var(--mute);line-height:1.35;font-weight:600}
.nth .mode.on{border-color:var(--c);background:color-mix(in srgb,var(--c) 12%,#0C1529)}
.nth .mode .rec{position:absolute;top:8px;right:8px;font:700 9px var(--display);padding:2px 6px;border-radius:6px;background:var(--gold);color:#2A1A04}
.nth .summary{margin-top:12px;padding:12px;border-radius:14px;background:linear-gradient(90deg,rgba(16,185,129,.12),rgba(34,211,238,.08));border:1px solid rgba(16,185,129,.35);font-size:12.5px;line-height:1.6}
.nth .summary b{color:#fff}
.nth .wz-foot{display:flex;gap:8px;padding:12px 14px 14px;border-top:1px solid var(--line)}
.nth .wz-foot .back{height:46px;padding:0 16px;border-radius:13px;font:600 13.5px var(--display);color:#C7D6F5;background:#111B33;border:1px solid var(--line2)}
.nth .wz-foot .next{position:relative;overflow:hidden;flex:1;height:46px;border-radius:13px;font:700 14px var(--display);color:#fff;background:linear-gradient(90deg,#2563EB,#0EA5E9)}
.nth .wz-foot .next.gen{color:#04221A;background:linear-gradient(90deg,#10B981,#22D3EE)}
.nth .wz-foot .next:disabled{opacity:.45}
.nth .wz-foot .next::after{content:"";position:absolute;top:-20px;bottom:-20px;width:40px;background:rgba(255,255,255,.4);filter:blur(8px);animation:nth-sheen 3.4s ease-in-out infinite}
.nth .toast{position:absolute;left:14px;right:14px;bottom:14px;padding:12px 14px;border-radius:14px;background:#052E22;border:1px solid rgba(16,185,129,.6);font:600 13px var(--display);color:#A7F3D0;display:flex;align-items:center;gap:8px;animation:nth-paneIn .4s var(--ease) both}
.nth .iz{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}
.nth .tile{position:relative;overflow:hidden;border-radius:20px;padding:12px;min-height:128px;display:flex;flex-direction:column;justify-content:flex-end;border:1px solid}
.nth .tile .art{position:absolute;top:10px;right:10px;transform:scale(.85);transform-origin:top right}
.nth .tile b{font:700 14px var(--display)}
.nth .tile small{display:block;font-size:11px;font-weight:600;opacity:.8;margin-top:1px}
.nth .cnt{position:absolute;top:10px;left:10px;font:700 11px var(--display);padding:2px 7px;border-radius:7px;color:#fff}
.nth .row-cta{margin-top:10px;display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:16px;background:rgba(255,255,255,.03);border:1px solid var(--line);font:600 13.5px var(--display)}
.nth .row-cta .grow{flex:1;min-width:0}
.nth .row-cta small{display:block;font:600 11.5px var(--body);color:var(--mute);margin-top:2px}
.nth .ex{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.nth .exc{position:relative;overflow:hidden;border-radius:22px;padding:14px;min-height:170px;display:flex;flex-direction:column;border:1px solid}
.nth .exc .pill{align-self:flex-end;font:700 10.5px var(--display);padding:4px 8px;border-radius:8px}
.nth .exc h4{margin:auto 0 0;font:700 16px var(--display)}
.nth .exc p{margin:3px 0 0;font-size:11.5px;opacity:.85;font-weight:600}
.nth .trophy{position:absolute;left:12px;top:14px;animation:nth-bob 3s ease-in-out infinite}
.nth .shine{position:absolute;inset:0;background:linear-gradient(115deg,transparent 35%,rgba(255,255,255,.18) 50%,transparent 65%);animation:nth-shine2 4s 1s ease-in-out infinite;transform:translateX(-100%)}
@keyframes nth-shine2{0%{transform:translateX(-100%)}50%,100%{transform:translateX(100%)}}
.nth .years{position:absolute;left:12px;top:14px;display:flex;flex-direction:column;gap:3px}
.nth .years span{font:700 9px var(--display);padding:2px 5px;border-radius:5px;background:rgba(255,255,255,.1);animation:nth-rvIn .5s var(--ease) both}
.nth .t700{margin-top:10px;position:relative;overflow:hidden;display:flex;align-items:center;gap:12px;padding:14px;border-radius:18px;background:linear-gradient(100deg,#2B1A05,#1A1206);border:1px solid rgba(245,158,11,.45)}
.nth .t700 .n{font:800 30px var(--display);letter-spacing:-1px;background:linear-gradient(180deg,#FDE68A,#F59E0B);-webkit-background-clip:text;background-clip:text;color:transparent}
.nth .t700 b{display:block;font:700 14.5px var(--display);color:#FFF4DB}
.nth .t700 small{font-size:11.5px;color:#E8C88A;font-weight:600}
.nth .go{margin-left:auto;width:38px;height:38px;border-radius:12px;display:grid;place-items:center;background:#F59E0B;color:#2A1A04;flex-shrink:0}
.nth .tools{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.nth .tool{position:relative;overflow:hidden;border-radius:20px;padding:12px;min-height:106px;border:1px solid;display:flex;flex-direction:column;justify-content:flex-end}
.nth .tool b{font:700 14px var(--display)}
.nth .tool small{font-size:11px;font-weight:600;opacity:.85}
.nth .tool .art{position:absolute;right:8px;top:8px}
.nth .fan{position:relative;display:block;width:56px;height:46px}
.nth .fan span{position:absolute;display:block;left:14px;top:4px;width:30px;height:38px;border-radius:7px;border:1px solid rgba(255,255,255,.35);transform-origin:50% 100%}
.nth .fan span:nth-child(1){background:#7C3AED;animation:nth-f1 3s ease-in-out infinite}
.nth .fan span:nth-child(2){background:#A855F7}
.nth .fan span:nth-child(3){background:#E9D5FF;animation:nth-f3 3s ease-in-out infinite}
@keyframes nth-f1{0%,100%{transform:rotate(-6deg)}50%{transform:rotate(-22deg)}}
@keyframes nth-f3{0%,100%{transform:rotate(6deg)}50%{transform:rotate(22deg)}}
.nth .scene{display:block;width:46px;height:46px;perspective:200px}
.nth .cube{position:relative;display:block;width:34px;height:34px;margin:6px;transform-style:preserve-3d;animation:nth-cube 7s linear infinite}
.nth .cube i{position:absolute;display:block;inset:0;border:1px solid rgba(165,243,252,.8);background:rgba(34,211,238,.18)}
.nth .cube i:nth-child(1){transform:translateZ(17px)}
.nth .cube i:nth-child(2){transform:rotateY(180deg) translateZ(17px)}
.nth .cube i:nth-child(3){transform:rotateY(90deg) translateZ(17px)}
.nth .cube i:nth-child(4){transform:rotateY(-90deg) translateZ(17px)}
.nth .cube i:nth-child(5){transform:rotateX(90deg) translateZ(17px)}
.nth .cube i:nth-child(6){transform:rotateX(-90deg) translateZ(17px)}
@keyframes nth-cube{from{transform:rotateX(-20deg) rotateY(0)}to{transform:rotateX(-20deg) rotateY(360deg)}}
.nth .hl{display:block;width:60px}
.nth .hl i{display:block;height:5px;border-radius:3px;background:rgba(255,255,255,.25);margin:5px 0}
.nth .hl i.m{position:relative;overflow:hidden}
.nth .hl i.m::after{content:"";position:absolute;inset:-2px 0;background:#FDE047;transform-origin:left;animation:nth-mark 2.6s ease-in-out infinite}
@keyframes nth-mark{0%{transform:scaleX(0)}40%,80%{transform:scaleX(1)}100%{transform:scaleX(1);opacity:0}}
.nth .bub{position:relative;display:block;width:58px;height:44px}
.nth .bub span{position:absolute;padding:4px 7px;border-radius:9px;font-size:8px;font-weight:800;color:#fff;opacity:0;animation:nth-pop 4s infinite}
.nth .bub span:nth-child(1){left:0;top:2px;background:#DB2777}
.nth .bub span:nth-child(2){right:0;top:20px;background:#6366F1;animation-delay:1s}
.nth .contest{display:flex;align-items:center;gap:12px;padding:14px;border-radius:22px;background:linear-gradient(100deg,#2A0A16,#16070F);border:1px solid rgba(244,63,94,.4)}
.nth .live{display:inline-flex;align-items:center;gap:6px;font:700 10.5px var(--display);letter-spacing:1px;color:#FDA4AF}
.nth .live i{width:7px;height:7px;border-radius:50%;background:var(--rose);animation:nth-pulseR 1.6s infinite}
@keyframes nth-pulseR{0%{box-shadow:0 0 0 0 rgba(244,63,94,.7)}70%{box-shadow:0 0 0 9px rgba(244,63,94,0)}100%{box-shadow:0 0 0 0 rgba(244,63,94,0)}}
.nth .timer{display:flex;gap:4px}
.nth .timer span{min-width:36px;padding:6px 0;border-radius:9px;text-align:center;font:800 15px var(--display);background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.1)}
.nth .timer small{display:block;font:600 8.5px var(--display);color:#FDA4AF;letter-spacing:.5px}
.nth .mentor{position:relative;overflow:hidden;border-radius:24px;padding:16px;background:linear-gradient(120deg,#2A0F45,#160A2E 60%,#0E0C24);border:1px solid rgba(168,85,247,.45)}
.nth .avs{display:flex}
.nth .avs span{width:30px;height:30px;border-radius:50%;margin-left:-8px;border:2px solid #1B0B33;display:grid;place-items:center;font:700 10px var(--display);color:#fff}
.nth .avs span:first-child{margin-left:0}
.nth .btn-v{display:inline-flex;align-items:center;gap:6px;height:40px;padding:0 16px;border-radius:13px;font:700 13.5px var(--display);color:#fff;background:linear-gradient(90deg,#7C3AED,#C026D3);box-shadow:0 10px 24px -8px rgba(192,38,211,.7)}
.nth .wa{display:inline-flex;align-items:center;gap:5px;font:700 11px var(--display);color:#4ADE80;padding:3px 8px;border-radius:8px;background:rgba(74,222,128,.12);border:1px solid rgba(74,222,128,.35)}
@keyframes nth-spin{to{transform:rotate(360deg)}}
@keyframes nth-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
@keyframes nth-blink{0%,100%{opacity:1}50%{opacity:.25}}
@keyframes nth-pop{0%,10%{opacity:0;transform:translateY(6px) scale(.8)}20%,70%{opacity:1;transform:none}85%,100%{opacity:0}}
@keyframes nth-sheen{0%{transform:translateX(-300px) skewX(-20deg)}55%,100%{transform:translateX(300px) skewX(-20deg)}}
@keyframes nth-grow1{0%,100%{transform:scaleY(.6)}50%{transform:scaleY(1)}}
@media (min-width:900px){.nth .app{max-width:1180px;padding-bottom:120px}
.nth .nth-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:20px;padding:20px 24px 0}
.nth .banner, .nth .hero, .nth .full{grid-column:1/-1}
.nth .slide{flex-basis:56%;height:250px}
.nth .hero{min-height:440px;justify-content:center;padding:84px 40px 36px}
.nth .hero .photo img{height:100%;object-position:center 35%}
.nth .hero .shade{background:linear-gradient(90deg,#060B18 0%,rgba(6,11,24,.92) 34%,rgba(6,11,24,.35) 62%,rgba(6,11,24,.1) 100%),radial-gradient(60% 80% at 0% 0%,rgba(37,99,235,.35),transparent 60%)}
.nth .hero-inner{max-width:520px}
.nth .ecg{top:auto;bottom:40px}
.nth .hi{font-size:44px}}
@media (prefers-reduced-motion:reduce){.nth *{animation:none!important;transition:none!important}}
.nth .hero3{min-height:0;height:262px;padding:14px;justify-content:flex-end}
.nth .hero3 .photo img{height:100%;object-position:50% 22%}
.nth .hero3 .shade{background:linear-gradient(180deg,rgba(5,9,20,.15) 0%,rgba(5,9,20,.1) 30%,rgba(5,9,20,.78) 62%,rgba(6,11,24,.97) 100%),radial-gradient(90% 70% at 0% 100%,rgba(37,99,235,.35),transparent 60%)}
.nth .hero3 .ecg{top:auto;bottom:96px;opacity:.75}
.nth .h3-top{position:absolute;top:12px;left:12px;right:12px;display:flex;justify-content:space-between;align-items:flex-start}
.nth .h3-ring{position:relative;width:66px;height:66px;border-radius:50%;padding:4px}
.nth .h3-ring svg{transform:rotate(-90deg)}
.nth .h3-ring .v{position:absolute;inset:0;display:grid;place-items:center;text-align:center;line-height:1}
.nth .h3-ring .v b{font:800 16px var(--display)}
.nth .h3-ring .v small{display:block;font:600 8.5px var(--display);color:#C7D6F5;margin-top:1px}
.nth .hello-s{font:600 12.5px var(--display);color:#BFD4FF;display:flex;align-items:center;gap:6px}
.nth .sun{flex-shrink:0;margin-right:2px;width:12px;height:12px;border-radius:50%;background:radial-gradient(circle,#FDE68A 40%,#F59E0B 70%);box-shadow:0 0 12px #F59E0B;animation:nth-spin 6s linear infinite}
.nth .name{margin:2px 0 0;font:800 29px/1.05 var(--display);letter-spacing:-1px;display:flex;flex-wrap:wrap}
.nth .name span{display:inline-block;animation:nth-letter .7s var(--ease) both;background:linear-gradient(180deg,#FFFFFF 30%,#BFDBFE);-webkit-background-clip:text;background-clip:text;color:transparent}
@keyframes nth-letter{from{opacity:0;transform:translateY(16px) rotateX(70deg);filter:blur(4px)}to{opacity:1;transform:none;filter:none}}
.nth .rot{position:relative;height:20px;margin-top:4px;overflow:hidden;font-size:13px;color:#D7E1F7;font-weight:600}
.nth .rot span{position:absolute;left:0;top:0;white-space:nowrap;opacity:0;transform:translateY(14px);transition:all .6s var(--ease)}
.nth .rot span.on{opacity:1;transform:none}
.nth .rot b{color:#fff;font-family:var(--display)}
.nth .h3-chips{margin-top:10px;display:flex;gap:8px;flex-wrap:wrap}
.nth .h3-chips .chip{height:32px;font-size:12px}
.nth .qp-line{position:relative;overflow:hidden;margin:0 0 12px;padding:12px 14px;border-radius:16px;background:linear-gradient(90deg,rgba(245,158,11,.14),rgba(244,63,94,.08));border:1px solid rgba(245,158,11,.35);font:600 13px/1.45 var(--display);color:#FDE68A;display:flex;gap:10px;align-items:center}
.nth .qp-line b{color:#fff}
.nth .qp-line::after{content:"";position:absolute;top:0;bottom:0;width:40px;background:rgba(255,255,255,.25);filter:blur(8px);animation:nth-sheen 4.5s 1s ease-in-out infinite}
.nth .subs{display:flex;flex-direction:column;gap:12px}
.nth .sx{position:relative;overflow:hidden;display:flex;align-items:stretch;min-height:150px;border-radius:24px;border:1px solid;isolation:isolate}
.nth .sx .grid{position:absolute;inset:0;z-index:-1;background-image:linear-gradient(rgba(255,255,255,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.05) 1px,transparent 1px);background-size:22px 22px;mask-image:linear-gradient(90deg,transparent 30%,#000)}
.nth .sx .info{flex:1;min-width:0;padding:16px 0 16px 16px;display:flex;flex-direction:column}
.nth .sx .lbl{font:700 10.5px var(--display);letter-spacing:1.2px;opacity:.85}
.nth .sx h3{margin:2px 0 0;font:800 22px var(--display);letter-spacing:-.5px}
.nth .sx .meta{margin-top:2px;font-size:12px;font-weight:600;opacity:.8}
.nth .sx .mbar{margin-top:10px;height:6px;border-radius:3px;background:rgba(255,255,255,.12);overflow:hidden;max-width:170px}
.nth .sx .mbar i{display:block;height:100%;border-radius:3px;transform-origin:left;animation:nth-barIn 1.5s var(--ease) .5s both}
.nth .sx .mrow{margin-top:5px;font:600 11.5px var(--display);opacity:.9}
.nth .sx .go2{margin-top:auto;align-self:flex-start;display:inline-flex;align-items:center;gap:6px;height:34px;padding:0 14px;border-radius:11px;font:700 12.5px var(--display);color:#0B1020;background:#fff}
.nth .sx .art{position:relative;width:148px;flex-shrink:0}
.nth .atom{position:absolute;left:50%;top:50%;width:110px;height:110px;margin:-62px 0 0 -55px}
.nth .atom .orb{position:absolute;inset:0;border:1.5px solid rgba(147,197,253,.6);border-radius:50%;}
.nth .atom .orb:nth-child(1){transform:rotateX(70deg) rotateZ(0deg)}
.nth .atom .orb:nth-child(2){transform:rotateY(70deg) rotateZ(60deg)}
.nth .atom .orb:nth-child(3){transform:rotateX(70deg) rotateY(60deg)}
.nth .atom .o{position:absolute;inset:0;border-radius:50%;animation:nth-spin 2.4s linear infinite}
.nth .atom .o::after{content:"";position:absolute;top:-4px;left:50%;width:8px;height:8px;margin-left:-4px;border-radius:50%;background:#E0F2FE;box-shadow:0 0 10px #60A5FA}
.nth .atom .w1{transform:rotate(0deg) scaleY(.36)}
.nth .atom .w2{transform:rotate(60deg) scaleY(.36)}
.nth .atom .w3{transform:rotate(120deg) scaleY(.36)}
.nth .atom .w1 .o{animation-duration:2.2s}
.nth .atom .w2 .o{animation-duration:2.9s}
.nth .atom .w3 .o{animation-duration:3.4s}
.nth .atom .ell{position:absolute;inset:0;border:1.5px solid rgba(147,197,253,.55);border-radius:50%}
.nth .atom .core{position:absolute;left:50%;top:50%;width:18px;height:18px;margin:-9px;border-radius:50%;background:radial-gradient(circle at 35% 35%,#fff,#60A5FA 55%,#1D4ED8);box-shadow:0 0 22px #3B82F6;animation:nth-corePulse 2s ease-in-out infinite}
@keyframes nth-corePulse{50%{transform:scale(1.25)}}
.nth .wave{position:absolute;left:8px;right:8px;bottom:12px;height:24px;overflow:hidden}
.nth .wave svg{width:200%;animation:nth-waveMove 2.4s linear infinite}
@keyframes nth-waveMove{to{transform:translateX(-50%)}}
.nth .flask{position:absolute;left:50%;top:50%;width:84px;height:104px;margin:-56px 0 0 -42px}
.nth .liq path{animation:nth-slosh 3s ease-in-out infinite}
@keyframes nth-slosh{0%,100%{transform:translateX(0)}50%{transform:translateX(-14px)}}
.nth .bub2{position:absolute;bottom:22px;width:7px;height:7px;border-radius:50%;background:rgba(209,250,229,.85);animation:nth-bubUp 2.4s ease-in infinite}
@keyframes nth-bubUp{0%{transform:translateY(0) scale(.6);opacity:0}15%{opacity:1}100%{transform:translateY(-90px) scale(1.1);opacity:0}}
.nth .hexa{position:absolute;right:10px;top:12px;animation:nth-spin 12s linear infinite}
.nth .dna{position:absolute;left:50%;top:16px;width:90px;height:132px;margin-left:-45px}
.nth .dna span{position:absolute;left:50%;width:70px;height:4px;margin-left:-35px;border-radius:2px;background:linear-gradient(90deg,rgba(233,213,255,.8),rgba(110,231,183,.8));animation:nth-twist 2.8s ease-in-out infinite}
.nth .dna span::before, .nth .dna span::after{content:"";position:absolute;top:-3px;width:10px;height:10px;border-radius:50%}
.nth .dna span::before{left:-4px;background:#E9D5FF;box-shadow:0 0 8px #A855F7}
.nth .dna span::after{right:-4px;background:#6EE7B7;box-shadow:0 0 8px #10B981}
.nth .cell{position:absolute;right:6px;bottom:10px;width:38px;height:38px;border-radius:50%;border:1.5px solid rgba(233,213,255,.6);background:radial-gradient(circle at 60% 40%,rgba(168,85,247,.35),transparent 70%);animation:nth-bob 3s ease-in-out infinite}
.nth .cell::after{content:"";position:absolute;left:12px;top:10px;width:14px;height:14px;border-radius:50%;background:#C084FC;animation:nth-corePulse 2.2s ease-in-out infinite}
.nth .imp{background:radial-gradient(420px 220px at 100% 0%,rgba(16,185,129,.18),transparent 70%),var(--card)}
.nth .recover{display:flex;align-items:center;gap:14px;padding:14px;border-radius:18px;background:linear-gradient(110deg,#052E22,#071A1C);border:1px solid rgba(16,185,129,.4)}
.nth .recover .big{font:800 38px/1 var(--display);letter-spacing:-1px;color:#34D399;text-shadow:0 0 24px rgba(52,211,153,.4)}
.nth .recover p{margin:2px 0 0;font-size:12px;color:#A7F3D0;font-weight:600}
.nth .recover h4{margin:0;font:700 14px var(--display)}
.nth .flow{margin-top:12px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;position:relative}
.nth .flow .fs{position:relative;padding:12px 10px;border-radius:16px;border:1px solid;text-align:left;min-height:132px;display:flex;flex-direction:column}
.nth .flow .n{width:22px;height:22px;border-radius:50%;display:grid;place-items:center;font:700 11px var(--display);color:#0B1020;margin-bottom:8px}
.nth .flow b{font:700 13px var(--display)}
.nth .flow .num{font:800 22px var(--display);margin-top:auto}
.nth .flow small{font-size:10.5px;font-weight:600;opacity:.85;line-height:1.3}
.nth .flow .arrow{position:absolute;top:24px;width:16px;height:2px;z-index:2;background:repeating-linear-gradient(90deg,#5EEAD4 0 4px,transparent 4px 7px);background-size:14px 2px;animation:nth-dash 1s linear infinite}
@keyframes nth-dash{to{background-position:14px 0}}
.nth .neg{margin-top:10px;font-size:13px;font-weight:600;display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:16px;background:rgba(244,63,94,.07);border:1px solid rgba(244,63,94,.3)}
.nth .neg .nv{font:800 20px var(--display);color:#FB7185}
.nth .neg small{display:block;font-size:11.5px;color:#FDA4AF;font-weight:600}
.nth .btn-fix{margin-top:12px;width:100%;height:48px;border-radius:15px;font:700 14px var(--display);color:#04221A;background:linear-gradient(90deg,#10B981,#5EEAD4);display:flex;align-items:center;justify-content:center;gap:8px;position:relative;overflow:hidden}
.nth .btn-fix::after{content:"";position:absolute;top:-20px;bottom:-20px;width:40px;background:rgba(255,255,255,.45);filter:blur(8px);animation:nth-sheen 3.6s ease-in-out infinite}
.nth .t7{position:relative;overflow:hidden;border-radius:26px;padding:18px;background:radial-gradient(300px 200px at 90% 10%,rgba(251,191,36,.35),transparent 70%),linear-gradient(150deg,#3A2405,#1C1206 60%,#120C05);border:1px solid rgba(251,191,36,.45);box-shadow:0 24px 50px -26px rgba(245,158,11,.6)}
.nth .t7 .ray{right:-10px;top:-10px;width:170px;height:170px;opacity:.6}
.nth .t7 .big7{position:absolute;right:14px;top:22px;font:800 72px/1 var(--display);letter-spacing:-5px;background:linear-gradient(180deg,#FFF7D6 10%,#FBBF24 55%,#B45309);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 6px 0 rgba(120,53,15,.6)) drop-shadow(0 18px 24px rgba(0,0,0,.4));animation:nth-bob 3.2s ease-in-out infinite}
.nth .t7 h3{position:relative;margin:8px 0 0;font:800 22px/1.1 var(--display);letter-spacing:-.5px;color:#FFF7E0;max-width:200px}
.nth .t7 .chips7{position:relative;margin-top:10px;display:flex;gap:6px;flex-wrap:wrap;max-width:240px}
.nth .t7 .chips7 span{font:600 11px var(--display);padding:4px 8px;border-radius:8px;background:rgba(0,0,0,.28);border:1px solid rgba(251,191,36,.3);color:#FDE68A}
.nth .t7 .prog{position:relative;margin-top:14px;padding:12px;border-radius:16px;background:rgba(0,0,0,.28);border:1px solid rgba(255,255,255,.08)}
.nth .t7 .dots7{display:grid;grid-template-columns:repeat(20,minmax(0,1fr));gap:3px;margin-top:8px}
.nth .t7 .dots7 i{display:block;height:8px;border-radius:2px;background:rgba(255,255,255,.12)}
.nth .t7 .dots7 i.d{background:#FBBF24;animation:nth-rvIn .4s var(--ease) both}
.nth .t7 .row7{display:flex;justify-content:space-between;font:600 12px var(--display);color:#FDE68A}
.nth .t7 .row7 b{color:#fff}
.nth .btn-gold{position:relative;overflow:hidden;margin-top:12px;width:100%;height:50px;border-radius:15px;font:700 15px var(--display);color:#2A1A04;background:linear-gradient(90deg,#F59E0B,#FDE68A,#F59E0B);background-size:200% 100%;animation:nth-shimmer 4s linear infinite;display:flex;align-items:center;justify-content:center;gap:8px;box-shadow:0 14px 28px -12px rgba(245,158,11,.8)}
.nth .next-live{margin-top:10px;display:flex;align-items:center;gap:8px;font:600 12px var(--display);color:#FCD34D}
.nth .tools3{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.nth .tl{position:relative;overflow:hidden;border-radius:22px;padding:14px;min-height:150px;border:1px solid;display:flex;flex-direction:column;justify-content:flex-end;transition:transform .3s var(--ease)}
.nth .tl:hover{transform:translateY(-3px)}
.nth .tl .art{position:absolute;right:10px;top:10px}
.nth .tl b{font:700 15px var(--display)}
.nth .tl small{display:block;margin-top:2px;font-size:11.5px;font-weight:600;opacity:.85}
.nth .tl .pill2{align-self:flex-start;margin-top:8px;font:700 10.5px var(--display);padding:3px 8px;border-radius:7px;background:rgba(0,0,0,.3);border:1px solid rgba(255,255,255,.15)}
.nth .tl .glowc{position:absolute;width:120px;height:120px;border-radius:50%;filter:blur(30px);opacity:.45;right:-30px;top:-30px}
.nth .mc{position:relative;overflow:hidden;border-radius:26px;padding:16px;background:radial-gradient(300px 180px at 100% 0%,rgba(244,63,94,.35),transparent 70%),linear-gradient(150deg,#2A0A16,#14060D);border:1px solid rgba(244,63,94,.45)}
.nth .mc h3{margin:6px 0 0;font:800 21px var(--display);letter-spacing:-.4px}
.nth .tonight{margin-top:10px;display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:14px;background:rgba(0,0,0,.28);border:1px solid rgba(255,255,255,.1)}
.nth .tonight .sb{width:38px;height:38px;border-radius:12px;display:grid;place-items:center;background:rgba(168,85,247,.2);color:#E9D5FF;flex-shrink:0}
.nth .tonight b{display:block;font:700 14px var(--display)}
.nth .tonight small{font-size:11.5px;color:#FDA4AF;font-weight:600}
.nth .tl3{margin-top:14px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));position:relative}
.nth .tl3::before{content:"";position:absolute;left:16%;right:16%;top:13px;height:2px;background:rgba(255,255,255,.12)}
.nth .tl3::after{content:"";position:absolute;left:16%;top:13px;height:2px;width:0;background:linear-gradient(90deg,#F43F5E,#FB7185);animation:nth-tlFill 2s var(--ease) .6s forwards}
@keyframes nth-tlFill{to{width:17%}}
.nth .tl3 div{position:relative;z-index:1;text-align:center;font:600 11px var(--display);color:#FDA4AF}
.nth .tl3 i{display:grid;place-items:center;margin:0 auto 6px;width:28px;height:28px;border-radius:50%;background:#2A0E18;border:2px solid rgba(255,255,255,.18);font-style:normal;font-size:11px;color:#fff}
.nth .tl3 .now i{background:#F43F5E;border-color:#FDA4AF;animation:nth-pulseR 1.6s infinite}
.nth .tl3 b{display:block;color:#fff;font-size:11.5px}
.nth .mc-foot{margin-top:14px;display:flex;align-items:center;gap:10px}
.nth .btn-red{flex:1;height:46px;border-radius:14px;font:700 14px var(--display);color:#fff;background:linear-gradient(90deg,#E11D48,#F43F5E);display:flex;align-items:center;justify-content:center;gap:6px;box-shadow:0 12px 24px -10px rgba(244,63,94,.8)}
.nth .mt{position:relative;overflow:hidden;border-radius:26px;padding:16px;background:radial-gradient(320px 220px at 100% 0%,rgba(37,211,102,.18),transparent 70%),linear-gradient(150deg,#0C2A1E,#0A1A18 55%,#0A1222);border:1px solid rgba(37,211,102,.4)}
.nth .mt-head{display:flex;align-items:center;gap:12px}
.nth .mt-av{position:relative;width:48px;height:48px;border-radius:16px;display:grid;place-items:center;font:800 15px var(--display);color:#fff;background:linear-gradient(135deg,#059669,#0EA5E9)}
.nth .mt-av .vf{position:absolute;right:-5px;bottom:-5px;width:20px;height:20px;border-radius:50%;background:#25D366;border:3px solid #0B231B;display:grid;place-items:center}
.nth .mt h3{margin:0;font:800 18px/1.2 var(--display)}
.nth .mt .sub{font-size:12px;color:#A7F3D0;font-weight:600}
.nth .chat{margin-top:14px;padding:12px;border-radius:18px;background:#0B1512 url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Ccircle cx='2' cy='2' r='1' fill='%23ffffff10'/%3E%3C/svg%3E");border:1px solid rgba(255,255,255,.08);display:flex;flex-direction:column;gap:8px;min-height:150px}
.nth .msg{max-width:82%;padding:8px 10px;border-radius:12px;font-size:12.5px;line-height:1.4;font-weight:600;opacity:0;transform:translateY(8px);animation:nth-msgIn 9s infinite}
.nth .msg.me{align-self:flex-end;background:#005C4B;color:#E9FFF7;border-bottom-right-radius:4px}
.nth .msg.them{align-self:flex-start;background:#1F2C34;color:#E6EDF0;border-bottom-left-radius:4px}
.nth .msg time{display:block;text-align:right;font-size:9.5px;opacity:.6;margin-top:2px;font-weight:600}
.nth .msg:nth-child(1){animation-delay:0s}
.nth .msg:nth-child(2){animation-delay:1.4s}
.nth .msg:nth-child(3){animation-delay:2.8s}
@keyframes nth-msgIn{0%{opacity:0;transform:translateY(8px)}6%,88%{opacity:1;transform:none}96%,100%{opacity:0}}
.nth .typing3{align-self:flex-start;display:flex;gap:4px;padding:9px 12px;border-radius:12px;background:#1F2C34;opacity:0;animation:nth-msgIn 9s 4.2s infinite}
.nth .typing3 i{width:6px;height:6px;border-radius:50%;background:#8696A0;animation:nth-blink 1s infinite}
.nth .typing3 i:nth-child(2){animation-delay:.2s}
.nth .typing3 i:nth-child(3){animation-delay:.4s}
.nth .perks{margin:12px 0 0;padding:0;list-style:none;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.nth .perks li{display:flex;gap:7px;align-items:flex-start;font-size:12px;font-weight:600;color:#D1FAE5}
.nth .perks svg{flex-shrink:0;margin-top:1px}
.nth .btn-wa{margin-top:14px;width:100%;height:50px;border-radius:15px;font:700 15px var(--display);color:#04210F;background:linear-gradient(90deg,#25D366,#5EEAD4);display:flex;align-items:center;justify-content:center;gap:8px;box-shadow:0 14px 28px -12px rgba(37,211,102,.7);position:relative;overflow:hidden}
.nth .btn-wa::after{content:"";position:absolute;top:-20px;bottom:-20px;width:40px;background:rgba(255,255,255,.45);filter:blur(8px);animation:nth-sheen 3.6s ease-in-out infinite}
.nth .banner .slide{height:200px}
@media (min-width:900px){.nth .hero3{height:320px;padding:28px 36px}
.nth .hero3 .photo img{object-position:center 30%}
.nth .hero3 .shade{background:linear-gradient(90deg,#060B18 0%,rgba(6,11,24,.88) 30%,rgba(6,11,24,.25) 60%,rgba(6,11,24,.05) 100%)}
.nth .name{font-size:46px}
.nth .hero3 .ecg{bottom:40px}
.nth .subs{display:grid;grid-template-columns:repeat(3,minmax(0,1fr))}
.nth .sx{flex-direction:column;min-height:300px}
.nth .sx .art{width:auto;height:150px;order:-1}
.nth .sx .info{padding:16px}}
.nth .w4{position:relative;overflow:hidden;isolation:isolate;border-radius:28px;min-height:292px;padding:16px;display:flex;flex-direction:column;border:1px solid var(--line2);background:#0B1630;box-shadow:0 24px 50px -28px rgba(37,99,235,.7)}
.nth .w4-photo{position:absolute;z-index:-4;width:122%;max-width:none;left:-2%;top:-17%;filter:saturate(1.08) brightness(.96);transform-origin:68% 38%;animation:nth-w5zoom 18s ease-in-out infinite alternate}
@keyframes nth-w5zoom{from{transform:scale(1)}to{transform:scale(1.08) translate(-1%,1%)}}
.nth .w4-tint{position:absolute;inset:0;z-index:-3;background:linear-gradient(160deg,rgba(37,99,235,.28),rgba(124,58,237,.12) 60%,rgba(236,72,153,.10));mix-blend-mode:soft-light}
.nth .w4-fade{position:absolute;inset:0;z-index:-2;background:
  linear-gradient(90deg,rgba(9,18,40,.95) 0%,rgba(9,18,40,.82) 30%,rgba(9,18,40,.3) 52%,rgba(9,18,40,0) 70%),
  linear-gradient(0deg,rgba(9,18,40,.92) 0%,rgba(9,18,40,.25) 26%,rgba(9,18,40,0) 40%),
  linear-gradient(180deg,rgba(9,18,40,.45) 0%,rgba(9,18,40,0) 22%)}
.nth .w4-glow{position:absolute;inset:0;z-index:-1;background:radial-gradient(240px 180px at 0% 0%,rgba(59,130,246,.38),transparent 70%);animation:nth-w4drift 10s ease-in-out infinite alternate;pointer-events:none}
@keyframes nth-w4drift{to{transform:translate(12px,-8px) scale(1.06)}}
.nth .w4-star{position:absolute;width:3px;height:3px;border-radius:50%;background:#fff;box-shadow:0 0 6px #fff;animation:nth-twinkle 2.4s infinite}
@keyframes nth-twinkle{0%,100%{opacity:.2;transform:scale(.6)}50%{opacity:1;transform:scale(1)}}
.nth .w4-text{position:relative;max-width:54%;display:flex;flex-direction:column}
.nth .w4-text .target-pill{align-self:flex-start}
.nth .w4 .name{font-size:28px;text-shadow:0 4px 24px rgba(0,0,0,.4)}
.nth .w4 .rot{height:36px;font-size:12.5px;line-height:1.4}
.nth .w4 .rot span{white-space:normal;text-shadow:0 2px 10px rgba(0,0,0,.6)}
.nth .ecg4{display:block;margin-top:6px;opacity:.95;filter:drop-shadow(0 0 4px #22D3EE)}
.nth .ecg4 path{stroke-dasharray:260;stroke-dashoffset:260;animation:nth-ecg4 3s linear infinite}
@keyframes nth-ecg4{0%{stroke-dashoffset:260}70%{stroke-dashoffset:0;opacity:1}100%{stroke-dashoffset:0;opacity:0}}
.nth .w4-ring{position:absolute;right:14px;top:14px;width:62px;height:62px;padding:2px}
.nth .w4-ring svg{width:58px;height:58px}
.nth .w4-chips{position:relative;margin-top:auto;padding-top:12px;flex-wrap:nowrap}
.nth .w4-chips .chip{height:32px;padding:0 10px;font-size:11.5px;white-space:nowrap}
@media (min-width:900px){.nth .w4{grid-column:1/-1;min-height:330px;padding:28px 32px}
.nth .w4-photo{width:62%;left:auto;right:-2%;top:50%;transform-origin:50% 40%;translate:0 -46%}
.nth .w4-fade{background:linear-gradient(90deg,#0B1630 0%,#0B1630 40%,rgba(11,22,48,.9) 45%,rgba(11,22,48,.6) 52%,rgba(11,22,48,.25) 60%,rgba(11,22,48,0) 72%),linear-gradient(0deg,rgba(11,22,48,.7) 0%,rgba(11,22,48,0) 30%),linear-gradient(180deg,rgba(11,22,48,.5) 0%,rgba(11,22,48,0) 20%)}
.nth .w4-text{max-width:46%}
.nth .w4 .name{font-size:48px}
.nth .w4 .rot{height:24px;font-size:14px}
.nth .w4-chips{max-width:none}}
@keyframes nth-ring3{from{stroke-dashoffset:151}}
`;

export const ANIM = (name: string) => `nth-${name}`;
