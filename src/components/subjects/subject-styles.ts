// Scoped styles for the subject practice page (/subjects/$subject).
// Same visual language as the home dashboard: deep navy, Poppins display, Manrope body.
// Every selector is under `.nsp`, keyframes are prefixed `nsp-`, so nothing leaks into the rest of the app.
// The subject accent comes from CSS variables set inline on `.nsp` (--c, --c2, --c-soft, --c-line, --deep).

export const SUBJECT_CSS = `
.nsp{--bg:#050914;--card:#0B1222;--line:rgba(148,178,255,.10);--line2:rgba(148,178,255,.18);--text:#EEF3FF;--mute:#9AA9C8;--dim:#6C7A99;
  --display:'Poppins',system-ui,sans-serif;--body:'Manrope','Poppins',system-ui,sans-serif;--ease:cubic-bezier(.2,.8,.2,1);
  color-scheme:dark;color:var(--text);font-family:var(--body);-webkit-font-smoothing:antialiased;
  margin:-2rem -1rem;padding:12px 16px 60px;min-height:calc(100vh - 4rem);
  background:radial-gradient(560px 360px at 100% -5%,var(--c-soft),transparent 60%),var(--bg)}
@media (min-width:640px){.nsp{margin:-2.5rem -1.5rem;padding:16px 24px 64px}}
@media (min-width:1024px){.nsp{margin:-2.5rem -2rem}}
.nsp *{box-sizing:border-box}
.nsp [hidden]{display:none!important}
.nsp button,.nsp input{font:inherit;color:inherit}
.nsp button{cursor:pointer;border:0;background:none;padding:0}
.nsp button:disabled{cursor:default}
.nsp button:focus-visible,.nsp input:focus-visible,.nsp a:focus-visible{outline:2px solid var(--c);outline-offset:2px}
.nsp .nsp-in{max-width:760px;margin:0 auto}
@keyframes nsp-rv{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}
@keyframes nsp-spin{to{transform:rotate(360deg)}}
@keyframes nsp-shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
@keyframes nsp-grow{from{transform:scaleX(0)}}
@keyframes nsp-pulse{50%{transform:scale(1.25)}}
@keyframes nsp-slosh{50%{transform:translateX(-14px)}}
@keyframes nsp-up{0%{transform:translateY(0) scale(.6);opacity:0}15%{opacity:1}100%{transform:translateY(-90px) scale(1.1);opacity:0}}
@keyframes nsp-twist{0%,100%{transform:scaleX(1)}50%{transform:scaleX(-1)}}
@keyframes nsp-fade{from{opacity:0}}
@keyframes nsp-sheet{from{transform:translate(-50%,100%)}}
.nsp .rv{animation:nsp-rv .7s var(--ease) both}
.nsp .back{display:inline-flex;align-items:center;gap:6px;font:600 12.5px var(--display);color:var(--mute);margin:4px 0 12px;text-decoration:none}
.nsp .back:hover{color:#fff}

/* hero */
.nsp .hero{position:relative;overflow:hidden;isolation:isolate;border-radius:28px;padding:18px;border:1px solid var(--c-line);background:linear-gradient(125deg,var(--deep),#0A1226 70%);min-height:220px;display:flex;flex-direction:column}
.nsp .hero .grid{position:absolute;inset:0;z-index:-1;background-image:linear-gradient(rgba(255,255,255,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.05) 1px,transparent 1px);background-size:24px 24px;-webkit-mask-image:linear-gradient(90deg,transparent 35%,#000);mask-image:linear-gradient(90deg,transparent 35%,#000)}
.nsp .hero .glow{position:absolute;right:-60px;top:-60px;width:240px;height:240px;border-radius:50%;background:radial-gradient(closest-side,var(--c-soft),transparent);z-index:-1;filter:blur(6px)}
.nsp .eyebrow{font:700 10.5px/1.5 var(--display);letter-spacing:1.4px;color:var(--c);max-width:60%;text-transform:uppercase}
.nsp .hero h1{margin:6px 0 0;font:800 34px/1.05 var(--display);letter-spacing:-1.2px;max-width:60%;color:#fff}
.nsp .hero p{margin:8px 0 0;font-size:13px;line-height:1.5;color:#C7D3EC;max-width:58%}
.nsp .art{position:absolute;right:2px;top:26px;opacity:.95;width:150px;height:160px;pointer-events:none}
.nsp .stats{position:relative;z-index:1;margin-top:auto;padding-top:16px;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}
.nsp .stat{padding:9px 6px;border-radius:14px;text-align:center;background:rgba(5,9,20,.6);border:1px solid rgba(255,255,255,.08);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}
.nsp .stat b{display:block;font:800 17px var(--display);font-variant-numeric:tabular-nums;color:#fff}
.nsp .stat small{font-size:10px;font-weight:700;color:var(--mute)}
.nsp .stat .skel{width:34px;height:14px;margin:2px auto 4px;display:block}
/* physics art */
.nsp .atom{position:absolute;left:50%;top:44%;width:112px;height:112px;margin:-56px}
.nsp .atom .ell{position:absolute;inset:0;border:1.5px solid rgba(147,197,253,.55);border-radius:50%}
.nsp .atom .w1{transform:rotate(0) scaleY(.36)}.nsp .atom .w2{transform:rotate(60deg) scaleY(.36)}.nsp .atom .w3{transform:rotate(120deg) scaleY(.36)}
.nsp .atom .o{position:absolute;inset:0;border-radius:50%;animation:nsp-spin 2.4s linear infinite}
.nsp .atom .o::after{content:"";position:absolute;top:-4px;left:50%;width:8px;height:8px;margin-left:-4px;border-radius:50%;background:#E0F2FE;box-shadow:0 0 10px #60A5FA}
.nsp .atom .w2 .o{animation-duration:3s}.nsp .atom .w3 .o{animation-duration:3.6s}
.nsp .atom .core{position:absolute;left:50%;top:50%;width:20px;height:20px;margin:-10px;border-radius:50%;background:radial-gradient(circle at 35% 35%,#fff,#60A5FA 55%,#1D4ED8);box-shadow:0 0 24px #3B82F6;animation:nsp-pulse 2s ease-in-out infinite}
/* chemistry art */
.nsp .flask{position:absolute;left:50%;top:6px;margin-left:-42px}
.nsp .liq path{animation:nsp-slosh 3s ease-in-out infinite}
.nsp .bub{position:absolute;bottom:22px;width:7px;height:7px;border-radius:50%;background:rgba(209,250,229,.85);animation:nsp-up 2.4s ease-in infinite}
.nsp .hexa{position:absolute;right:4px;top:4px;animation:nsp-spin 12s linear infinite}
/* biology art */
.nsp .dna{position:absolute;left:50%;top:6px;width:90px;height:150px;margin-left:-45px}
.nsp .dna span{position:absolute;left:50%;width:70px;height:4px;margin-left:-35px;border-radius:2px;background:linear-gradient(90deg,var(--dna-a),var(--dna-b));animation:nsp-twist 2.8s ease-in-out infinite}
.nsp .dna span::before,.nsp .dna span::after{content:"";position:absolute;top:-3px;width:10px;height:10px;border-radius:50%}
.nsp .dna span::before{left:-4px;background:var(--dna-a);box-shadow:0 0 8px var(--c2)}
.nsp .dna span::after{right:-4px;background:var(--dna-b);box-shadow:0 0 8px #10B981}

/* filter panel */
.nsp .panel{margin-top:14px;border-radius:24px;padding:16px;background:var(--card);border:1px solid var(--line)}
.nsp .ph{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:12px}
.nsp .ph h2{margin:0;font:700 16px var(--display);display:flex;align-items:center;gap:9px;color:#fff}
.nsp .ph .si{width:30px;height:30px;border-radius:10px;display:grid;place-items:center;background:var(--c-soft);color:var(--c)}
.nsp .reset{font:600 12px var(--display);color:var(--c)}
.nsp .flabel{display:flex;justify-content:space-between;font:600 11.5px var(--display);color:var(--mute);margin:2px 2px 8px;letter-spacing:.3px}
.nsp .seg{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:4px;padding:4px;border-radius:14px;background:#070D1B;border:1px solid var(--line)}
.nsp .seg button{height:38px;border-radius:10px;font:600 12.5px var(--display);color:var(--mute);display:flex;align-items:center;justify-content:center;gap:6px;transition:all .25s var(--ease)}
.nsp .seg button i{width:7px;height:7px;border-radius:50%}
.nsp .seg button.on{background:linear-gradient(180deg,#1E2E55,#16233F);color:#fff;box-shadow:inset 0 1px 0 rgba(255,255,255,.1),0 0 0 1px var(--c-line)}
.nsp .chips{display:flex;gap:8px;overflow-x:auto;padding-bottom:4px;scrollbar-width:none}
.nsp .chips::-webkit-scrollbar{display:none}
.nsp .chip{flex-shrink:0;display:flex;align-items:center;gap:8px;height:40px;padding:0 12px;border-radius:12px;font:600 12.5px var(--display);color:#C7D3EC;background:#0C1529;border:1px solid var(--line2);transition:all .25s var(--ease)}
.nsp .chip svg{color:var(--mute)}
.nsp .chip.on{background:var(--c-soft);border-color:var(--c-line);color:#fff}
.nsp .chip.on svg{color:var(--c)}
.nsp .summary{margin-top:12px;display:flex;align-items:center;gap:8px;padding:10px 12px;border-radius:12px;background:rgba(255,255,255,.03);border:1px solid var(--line);font-size:12.5px;color:var(--mute)}
.nsp .summary b{color:#fff;font-family:var(--display)}
.nsp .summary svg{flex-shrink:0}

/* chapter toolbar */
.nsp .toolbar{margin-top:14px;display:flex;gap:8px;align-items:center}
.nsp .search{flex:1;min-width:0;display:flex;align-items:center;gap:8px;height:44px;padding:0 12px;border-radius:14px;background:var(--card);border:1px solid var(--line2)}
.nsp .search input{flex:1;min-width:0;border:0;outline:0;background:transparent;font-size:13.5px}
.nsp .search input::placeholder{color:var(--dim)}
.nsp .sort{display:flex;padding:4px;border-radius:14px;background:var(--card);border:1px solid var(--line2);gap:2px}
.nsp .sort button{height:36px;padding:0 10px;border-radius:10px;font:600 11.5px var(--display);color:var(--mute);white-space:nowrap}
.nsp .sort button.on{background:var(--c-soft);color:#fff}
.nsp .listhead{display:flex;justify-content:space-between;align-items:baseline;gap:8px;margin:16px 4px 10px}
.nsp .listhead h3{margin:0;font:700 15px var(--display);color:#fff}
.nsp .listhead span{font-size:12px;color:var(--mute);text-align:right}

/* chapter cards */
.nsp .list{display:flex;flex-direction:column;gap:8px}
.nsp .ch{position:relative;overflow:hidden;width:100%;text-align:left;display:flex;align-items:center;gap:12px;padding:14px;border-radius:18px;background:var(--card);border:1px solid var(--line);transition:transform .25s var(--ease),border-color .25s;animation:nsp-rv .5s var(--ease) both}
.nsp .ch:hover:not(:disabled){border-color:var(--c-line);transform:translateY(-1px)}
.nsp .ch .no{width:36px;height:36px;flex-shrink:0;border-radius:12px;display:grid;place-items:center;font:700 13px var(--display);background:var(--c-soft);color:var(--c)}
.nsp .ch .mid{flex:1;min-width:0;display:block}
.nsp .ch .nm{display:block;font:600 14.5px/1.3 var(--display);color:#fff}
.nsp .ch .meta{margin-top:4px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:11.5px;color:var(--mute);font-weight:600}
.nsp .tagc{font:700 10px var(--display);padding:2px 6px;border-radius:6px;background:rgba(255,255,255,.06);color:#C7D3EC}
.nsp .ch .mbar{display:block;margin-top:8px;height:4px;border-radius:2px;background:rgba(255,255,255,.07);overflow:hidden}
.nsp .ch .mbar i{display:block;height:100%;border-radius:2px;transform-origin:left;background:linear-gradient(90deg,var(--c2),var(--c));animation:nsp-grow 1.2s var(--ease) .3s both}
.nsp .acc{flex-shrink:0;min-width:58px;text-align:center;padding:6px 8px;border-radius:10px;font:700 12px var(--display)}
.nsp .acc small{display:block;font:600 9px var(--display);letter-spacing:.4px;opacity:.8}
.nsp .spin{width:20px;height:20px;border-radius:50%;border:2px solid var(--c-soft);border-top-color:var(--c);animation:nsp-spin .8s linear infinite;flex-shrink:0;margin:0 19px}
.nsp .skel{display:inline-block;width:76px;height:10px;border-radius:5px;background:linear-gradient(90deg,#141E36,#22305A,#141E36);background-size:200% 100%;animation:nsp-shimmer 1.4s linear infinite}
.nsp .empty{padding:28px 16px;border-radius:18px;border:1px dashed var(--line2);text-align:center;font-size:13px;color:var(--mute)}
.nsp .loading{display:flex;flex-direction:column;gap:8px}
.nsp .loading .ph-card{height:76px;border-radius:18px;background:linear-gradient(90deg,#0B1222,#121C35,#0B1222);background-size:200% 100%;animation:nsp-shimmer 1.6s linear infinite;border:1px solid var(--line)}

/* chapter detail */
.nsp .detail{animation:nsp-rv .45s var(--ease) both}
.nsp .dh{border-radius:24px;padding:16px;background:linear-gradient(125deg,var(--deep),#0A1226 80%);border:1px solid var(--c-line)}
.nsp .dh .crumb{font:600 11px var(--display);color:var(--c);letter-spacing:1px;text-transform:uppercase}
.nsp .dh h2{margin:6px 0 0;font:800 22px/1.15 var(--display);letter-spacing:-.4px;color:#fff}
.nsp .dh .row{margin-top:12px;display:flex;gap:8px;flex-wrap:wrap}
.nsp .dh .row span{font:600 11.5px var(--display);padding:5px 9px;border-radius:9px;background:rgba(0,0,0,.25);border:1px solid rgba(255,255,255,.1)}
.nsp .sets{margin-top:12px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.nsp .set{position:relative;text-align:left;padding:14px;border-radius:18px;background:var(--card);border:1px solid var(--line);transition:all .25s var(--ease);animation:nsp-rv .45s var(--ease) both}
.nsp .set:hover{border-color:var(--c-line)}
.nsp .set .sn{font:800 20px var(--display);color:#fff}
.nsp .set .sr{font-size:11.5px;color:var(--mute);font-weight:600;margin-top:2px}
.nsp .set .go{position:absolute;right:12px;top:12px;width:28px;height:28px;border-radius:9px;display:grid;place-items:center;background:var(--c-soft);color:var(--c)}

/* mode sheet */
.nsp .scrim{position:fixed;inset:0;background:rgba(2,5,12,.7);-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px);z-index:60;animation:nsp-fade .25s both}
.nsp .sheet{position:fixed;left:50%;bottom:0;width:min(560px,100%);transform:translateX(-50%);z-index:61;border-radius:26px 26px 0 0;padding:10px 16px calc(18px + env(safe-area-inset-bottom,0px));background:#0B1222;border:1px solid var(--line2);animation:nsp-sheet .4s var(--ease) both}
.nsp .grab{width:40px;height:4px;border-radius:2px;background:#2A3858;margin:0 auto 12px}
.nsp .sheet h3{margin:0;font:700 18px var(--display);color:#fff}
.nsp .sheet .sub{margin:4px 0 14px;font-size:12.5px;color:var(--mute)}
.nsp .modes{display:grid;gap:10px}
.nsp .mode{display:flex;gap:12px;align-items:center;text-align:left;padding:14px;border-radius:18px;border:1.5px solid var(--line2);background:#0C1529;transition:all .25s var(--ease)}
.nsp .mode:hover:not(:disabled){border-color:var(--c-line)}
.nsp .mode:disabled{opacity:.6}
.nsp .mode .mi{width:44px;height:44px;border-radius:14px;display:grid;place-items:center;flex-shrink:0}
.nsp .mode b{display:block;font:700 15px var(--display);color:#fff}
.nsp .mode small{display:block;margin-top:2px;font-size:12px;color:var(--mute);line-height:1.4}
.nsp .mode .best{white-space:nowrap;margin-left:auto;font:700 9.5px var(--display);padding:3px 7px;border-radius:6px;background:#FBBF24;color:#2A1A04;align-self:flex-start}
.nsp .mode .spin{margin:0 0 0 auto}

@media (min-width:640px){
  .nsp .hero{padding:24px}
  .nsp .hero h1{font-size:44px}
  .nsp .hero p{max-width:60%;font-size:14px}
  .nsp .eyebrow{max-width:none}
  .nsp .art{right:30px;top:18px;transform:scale(1.1);transform-origin:top right}
  .nsp .sets{grid-template-columns:repeat(3,minmax(0,1fr))}
}
@media (prefers-reduced-motion:reduce){.nsp *,.nsp *::before,.nsp *::after{animation:none!important;transition:none!important}}
`;
