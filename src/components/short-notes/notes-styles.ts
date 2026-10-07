// Styles for NEET Track short notes. Two scopes:
//   .snr  — the dark reader / hub chrome (same visual language as the dashboard)
//   .sn-doc — the paper "PDF" pages and the note content vocabulary (sn-* classes)
// Keyframes are prefixed `snr-`. Nothing here leaks outside those scopes.

export const NOTES_DOC_CSS = `
.sn-doc{--ink:#14182B;--ink2:#3A4160;--mute:#6B7391;--rule:#E6E8F0;--paper:#FFFFFF;--cream:#FBFAF6;
  --acc:#6D28D9;--acc2:#059669;--acc-soft:#F3EEFF;--acc2-soft:#E8F8F1;--gold:#B45309;--gold-soft:#FFF7E0;--rose:#BE123C;--rose-soft:#FFF0F3;--sky:#0369A1;--sky-soft:#EAF5FD;
  font-family:'Manrope','Inter',system-ui,sans-serif;color:var(--ink);font-size:14.5px;line-height:1.62;-webkit-font-smoothing:antialiased}
.sn-doc *{box-sizing:border-box}
.sn-doc .sn-page{position:relative;background:var(--paper);border-radius:6px;box-shadow:0 1px 0 rgba(255,255,255,.04),0 18px 50px -18px rgba(0,0,0,.6);padding:34px 30px 46px;margin:0 auto 18px;max-width:820px;overflow:hidden;isolation:isolate}
.sn-doc .sn-page::before{content:"";position:absolute;inset:0 0 auto 0;height:5px;background:linear-gradient(90deg,var(--acc),var(--acc2))}
.sn-doc .sn-wm{position:absolute;inset:0;z-index:-1;pointer-events:none;opacity:.07;background-repeat:repeat;background-size:300px 190px}
.sn-doc .sn-run{display:flex;justify-content:space-between;gap:12px;font:600 10.5px 'Poppins','Inter',sans-serif;letter-spacing:.6px;text-transform:uppercase;color:var(--mute);padding-bottom:10px;margin-bottom:18px;border-bottom:1px solid var(--rule)}
.sn-doc .sn-run b{color:var(--acc)}
.sn-doc .sn-foot{position:absolute;left:30px;right:30px;bottom:16px;display:flex;justify-content:space-between;font:600 10.5px 'Poppins','Inter',sans-serif;color:#9AA0B8}

/* cover */
.sn-doc .sn-cover{padding:0;background:linear-gradient(150deg,#1B0B3F 0%,#2E1065 45%,#064E3B 120%);color:#fff;min-height:430px}
.sn-doc .sn-cover::before{display:none}
.sn-doc .sn-cover .in{position:relative;z-index:1;padding:34px 30px 30px;display:flex;flex-direction:column;min-height:430px}
.sn-doc .sn-cover .brand{font:700 12px 'Poppins','Inter',sans-serif;letter-spacing:2px;text-transform:uppercase;color:#C4B5FD}
.sn-doc .sn-cover .kick{margin-top:auto;font:700 12px 'Poppins','Inter',sans-serif;letter-spacing:1.6px;color:#6EE7B7;text-transform:uppercase}
.sn-doc .sn-cover h1{margin:8px 0 0;font:800 38px/1.08 'Poppins','Inter',sans-serif;letter-spacing:-1px;color:#fff}
.sn-doc .sn-cover .sub{margin-top:10px;font-size:14.5px;color:#DDD6FE;max-width:520px}
.sn-doc .sn-cover .chips{margin-top:18px;display:flex;gap:8px;flex-wrap:wrap}
.sn-doc .sn-cover .chips span{font:600 11.5px 'Poppins','Inter',sans-serif;padding:6px 10px;border-radius:999px;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.18);color:#fff}
.sn-doc .sn-cover .orb{position:absolute;right:-70px;top:-70px;width:300px;height:300px;border-radius:50%;background:radial-gradient(closest-side,rgba(167,139,250,.55),transparent);z-index:0}
.sn-doc .sn-cover .orb2{position:absolute;left:-90px;bottom:-110px;width:320px;height:320px;border-radius:50%;background:radial-gradient(closest-side,rgba(16,185,129,.35),transparent);z-index:0}
.sn-doc .sn-cover .bignum{position:absolute;right:26px;top:24px;font:800 120px/1 'Poppins','Inter',sans-serif;color:rgba(255,255,255,.07);z-index:0}
.sn-doc .sn-toc{margin-top:22px;padding:14px 16px;border-radius:14px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.14)}
.sn-doc .sn-toc b{display:block;font:700 11px 'Poppins','Inter',sans-serif;letter-spacing:1.4px;color:#C4B5FD;text-transform:uppercase;margin-bottom:6px}
.sn-doc .sn-toc ol{margin:0;padding-left:18px;columns:2;column-gap:24px;font-size:13px;color:#EDE9FE}
.sn-doc .sn-toc li{break-inside:avoid;margin:2px 0}
.sn-doc .sn-toc li::marker{color:#C4B5FD;font-weight:800}

/* headings */
.sn-doc h2{display:flex;align-items:center;gap:10px;margin:0 0 14px;font:800 22px/1.2 'Poppins','Inter',sans-serif;letter-spacing:-.4px;color:var(--ink)}
.sn-doc h2 .sn-num{flex-shrink:0;display:inline-grid;place-items:center;min-width:38px;height:30px;padding:0 8px;border-radius:9px;background:var(--acc);color:#fff;font-size:13px;letter-spacing:0}
.sn-doc h3{margin:20px 0 8px;font:700 16.5px/1.3 'Poppins','Inter',sans-serif;color:var(--acc);display:flex;align-items:center;gap:8px}
.sn-doc h3::before{content:"";width:6px;height:16px;border-radius:3px;background:var(--acc2);flex-shrink:0}
.sn-doc h4{margin:14px 0 6px;font:700 14.5px 'Poppins','Inter',sans-serif;color:var(--ink2)}
.sn-doc p{margin:6px 0 10px}
.sn-doc b,.sn-doc strong{color:var(--ink);font-weight:800}
.sn-doc i,.sn-doc em{font-style:italic}
.sn-doc .sn-sci{font-style:italic;font-weight:700;color:var(--acc2)}
.sn-doc mark{background:#E6F9B0;color:var(--ink);padding:1px 3px;border-radius:4px;box-decoration-break:clone;-webkit-box-decoration-break:clone;-webkit-print-color-adjust:exact;print-color-adjust:exact}

/* bullet lists */
.sn-doc ul,.sn-doc ol{margin:6px 0 12px;padding-left:20px}
.sn-doc ul li{margin:4px 0}
.sn-doc ul li::marker{color:var(--acc)}
.sn-doc ol li::marker{color:var(--acc);font-weight:800}
.sn-doc ul ul{margin:4px 0}

/* callout boxes */
.sn-doc .sn-box{position:relative;margin:14px 0;padding:12px 14px 12px 16px;border-radius:12px;border:1px solid;font-size:14px}
.sn-doc .sn-box > :first-child{margin-top:0}.sn-doc .sn-box > :last-child{margin-bottom:0}
.sn-doc .sn-tag{display:table;margin-bottom:6px;font:800 10.5px 'Poppins','Inter',sans-serif;letter-spacing:1px;text-transform:uppercase;padding:3px 8px;border-radius:6px;color:#fff}
.sn-doc .sn-hl{background:var(--gold-soft);border-color:#F6D58A}.sn-doc .sn-hl .sn-tag{background:#D97706}
.sn-doc .sn-ex{background:var(--rose-soft);border-color:#F9C2CF}.sn-doc .sn-ex .sn-tag{background:var(--rose)}
.sn-doc .sn-tip{background:var(--acc2-soft);border-color:#A7E3C9}.sn-doc .sn-tip .sn-tag{background:var(--acc2)}
.sn-doc .sn-def{background:var(--sky-soft);border-color:#B5DBF3}.sn-doc .sn-def .sn-tag{background:var(--sky)}
.sn-doc .sn-key{background:var(--acc-soft);border-color:#D9C9FB}.sn-doc .sn-key .sn-tag{background:var(--acc)}

/* tables */
.sn-doc .sn-tw{margin:12px 0 16px;overflow-x:auto;border-radius:12px;border:1px solid var(--rule)}
.sn-doc table.sn-tbl{width:100%;border-collapse:collapse;font-size:13.2px;line-height:1.45}
.sn-doc .sn-tbl th{background:linear-gradient(180deg,#2E1065,#3B1580);color:#fff;font:700 12.5px 'Poppins','Inter',sans-serif;text-align:left;padding:9px 10px;vertical-align:bottom}
.sn-doc .sn-tbl td{padding:8px 10px;border-top:1px solid var(--rule);vertical-align:top}
.sn-doc .sn-tbl tr:nth-child(even) td{background:#FAF8FF}
.sn-doc .sn-tbl td:first-child{font-weight:700;color:var(--ink)}

/* figures */
.sn-doc figure.sn-fig{margin:16px 0;padding:14px;border-radius:14px;background:var(--cream);border:1px solid var(--rule);text-align:center}
.sn-doc figure.sn-fig svg{max-width:100%;height:auto;display:block;margin:0 auto}
.sn-doc figure.sn-fig figcaption{margin-top:8px;font:600 12px 'Poppins','Inter',sans-serif;color:var(--mute)}
.sn-doc figure.sn-fig figcaption b{color:var(--acc)}
.sn-doc .sn-diag{margin:14px 0;padding:12px 14px;border-radius:12px;border:1.5px dashed #C9B8F5;background:#FCFAFF}
.sn-doc .sn-diag .sn-tag{background:#7C3AED}

/* two-column compare + flow */
.sn-doc .sn-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;margin:12px 0}
.sn-doc .sn-card{padding:12px 13px;border-radius:12px;border:1px solid var(--rule);background:#fff}
.sn-doc .sn-card h4{margin:0 0 6px;color:var(--acc)}
.sn-doc .sn-card ul{margin:0;padding-left:18px;font-size:13.5px}
.sn-doc .sn-flow{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin:12px 0;font:700 12.5px 'Poppins','Inter',sans-serif}
.sn-doc .sn-flow span{padding:6px 10px;border-radius:9px;background:var(--acc-soft);color:var(--acc);border:1px solid #D9C9FB}
.sn-doc .sn-flow i{font-style:normal;color:var(--mute)}

/* quick revision */
.sn-doc .sn-rev ol{counter-reset:r;list-style:none;padding:0}
.sn-doc .sn-rev ol li{counter-increment:r;position:relative;padding:9px 12px 9px 46px;margin:7px 0;border-radius:11px;background:#FAF8FF;border:1px solid #ECE4FD}
.sn-doc .sn-rev ol li::before{content:counter(r);position:absolute;left:10px;top:8px;width:26px;height:26px;border-radius:8px;display:grid;place-items:center;background:var(--acc);color:#fff;font:800 12px 'Poppins','Inter',sans-serif}

@media (max-width:560px){
  .sn-doc{font-size:14px}
  .sn-doc .sn-page{padding:26px 16px 42px;border-radius:4px}
  .sn-doc .sn-foot{left:16px;right:16px}
  .sn-doc .sn-cover .in{padding:26px 18px 22px}
  .sn-doc .sn-cover h1{font-size:30px}
  .sn-doc .sn-toc ol{columns:1}
  .sn-doc h2{font-size:19px}
  .sn-doc .sn-run span:last-child{display:none}
}
@media print{.sn-doc .sn-page{box-shadow:none;margin:0;max-width:none;break-after:page;border-radius:0}.sn-doc .sn-box,.sn-doc figure.sn-fig,.sn-doc .sn-card,.sn-doc .sn-diag,.sn-doc tr,.sn-doc .sn-rev li,.sn-doc .sn-flow{break-inside:avoid}.sn-doc h2,.sn-doc h3,.sn-doc h4{break-after:avoid}.sn-doc .sn-cover,.sn-doc .sn-cover .in{min-height:272mm}}
`;

export const NOTES_CHROME_CSS = `
.snr{--bg:#050914;--card:#0B1222;--line:rgba(148,178,255,.10);--line2:rgba(148,178,255,.18);--text:#EEF3FF;--mute:#9AA9C8;--dim:#6C7A99;
  --display:'Poppins','Inter',system-ui,sans-serif;--body:'Manrope','Inter',system-ui,sans-serif;--ease:cubic-bezier(.2,.8,.2,1);
  color-scheme:dark;color:var(--text);font-family:var(--body);-webkit-font-smoothing:antialiased;
  margin:-2rem -1rem;padding:12px 16px 60px;min-height:calc(100vh - 4rem);
  background:radial-gradient(560px 360px at 100% -5%,rgba(139,92,246,.16),transparent 60%),radial-gradient(480px 360px at -10% 40%,rgba(16,185,129,.08),transparent 60%),var(--bg)}
@media (min-width:640px){.snr{margin:-2.5rem -1.5rem;padding:16px 24px 64px}}
@media (min-width:1024px){.snr{margin:-2.5rem -2rem}}
.snr *{box-sizing:border-box}
.snr button{font:inherit;color:inherit;cursor:pointer;border:0;background:none;padding:0}
.snr a{color:inherit;text-decoration:none}
.snr button:focus-visible,.snr a:focus-visible{outline:2px solid #A78BFA;outline-offset:2px}
.snr .snr-in{max-width:860px;margin:0 auto}
@keyframes snr-rv{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
@keyframes snr-shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
@keyframes snr-float{0%,100%{transform:translateY(0) rotate(-6deg)}50%{transform:translateY(-8px) rotate(-4deg)}}
.snr .rv{animation:snr-rv .6s var(--ease) both}
.snr .back{display:inline-flex;align-items:center;gap:6px;font:600 12.5px var(--display);color:var(--mute);margin:4px 0 12px}
.snr .back:hover{color:#fff}

/* hub hero */
.snr .hero{position:relative;overflow:hidden;isolation:isolate;border-radius:28px;padding:20px 18px;border:1px solid rgba(167,139,250,.35);background:linear-gradient(130deg,#24104F,#0B1226 62%,#06291F)}
.snr .hero .eyebrow{font:700 10.5px/1.5 var(--display);letter-spacing:1.4px;color:#C4B5FD;text-transform:uppercase}
.snr .hero h1{margin:6px 0 0;font:800 32px/1.05 var(--display);letter-spacing:-1px;color:#fff;max-width:62%}
.snr .hero p{margin:8px 0 0;font-size:13px;line-height:1.5;color:#D5DBF0;max-width:60%}
.snr .hero .stack{position:absolute;right:16px;top:22px;width:118px;height:140px;pointer-events:none}
.snr .hero .sheet{position:absolute;inset:0;border-radius:10px;background:#fff;box-shadow:0 14px 30px -12px rgba(0,0,0,.6)}
.snr .hero .sheet:nth-child(1){transform:rotate(8deg) translate(10px,6px);background:#E9E3FF}
.snr .hero .sheet:nth-child(2){transform:rotate(2deg) translate(4px,2px);background:#F4F1FF}
.snr .hero .sheet:nth-child(3){animation:snr-float 5s ease-in-out infinite;padding:12px 11px;overflow:hidden}
.snr .hero .sheet:nth-child(3)::before{content:"";display:block;height:4px;margin:-12px -11px 10px;background:linear-gradient(90deg,#6D28D9,#059669)}
.snr .hero .sheet i{display:block;height:5px;border-radius:3px;background:#D9DCEA;margin:6px 0}
.snr .hero .sheet i.t{height:8px;width:70%;background:#6D28D9}
.snr .hero .sheet i.m{background:#D9F99D}
.snr .hero .sheet i.s{width:60%}
.snr .hero .feats{margin-top:16px;display:flex;flex-wrap:wrap;gap:6px}
.snr .hero .feats span{font:600 11px var(--display);padding:5px 9px;border-radius:999px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.14);color:#EDE9FE}

.snr .tabs{margin-top:14px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:4px;padding:4px;border-radius:14px;background:#070D1B;border:1px solid var(--line)}
.snr .tabs button{height:40px;border-radius:10px;font:600 13px var(--display);color:var(--mute);display:flex;flex-direction:column;align-items:center;justify-content:center;line-height:1.1}
.snr .tabs button small{font:600 9.5px var(--display);color:var(--dim);margin-top:2px}
.snr .tabs button.on{background:linear-gradient(180deg,#2A1A5E,#1B1240);color:#fff;box-shadow:inset 0 1px 0 rgba(255,255,255,.1),0 0 0 1px rgba(167,139,250,.45)}

.snr .grp{margin:18px 4px 8px;display:flex;justify-content:space-between;align-items:baseline}
.snr .grp h2{margin:0;font:700 15px var(--display);color:#fff}
.snr .grp span{font-size:12px;color:var(--mute)}
.snr .list{display:flex;flex-direction:column;gap:8px}
.snr .nc{position:relative;display:flex;align-items:center;gap:12px;padding:13px 14px;border-radius:18px;background:var(--card);border:1px solid var(--line);transition:transform .25s var(--ease),border-color .25s;animation:snr-rv .5s var(--ease) both}
.snr a.nc:hover{border-color:rgba(167,139,250,.5);transform:translateY(-1px)}
.snr .nc .no{width:40px;height:46px;flex-shrink:0;border-radius:8px;display:grid;place-items:center;font:800 14px var(--display);background:#fff;color:#6D28D9;box-shadow:0 6px 14px -8px rgba(0,0,0,.8);position:relative;overflow:hidden}
.snr .nc .no::before{content:"";position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,#6D28D9,#059669)}
.snr .nc.soon .no{background:#141C33;color:var(--dim)}
.snr .nc.soon .no::before{background:#25304F}
.snr .nc .mid{flex:1;min-width:0}
.snr .nc .t{display:block;font:600 14.5px/1.3 var(--display);color:#fff}
.snr .nc.soon .t{color:#B7C1DA}
.snr .nc .u{display:block;margin-top:3px;font-size:11.5px;color:var(--mute);font-weight:600}
.snr .nc .go{flex-shrink:0;font:700 11.5px var(--display);padding:7px 11px;border-radius:10px;background:rgba(139,92,246,.16);color:#DDD6FE;border:1px solid rgba(167,139,250,.35)}
.snr .nc .lock{flex-shrink:0;font:700 10px var(--display);letter-spacing:.5px;padding:5px 8px;border-radius:8px;background:rgba(255,255,255,.05);color:var(--dim)}
.snr .empty{padding:26px 16px;border-radius:18px;border:1px dashed var(--line2);text-align:center;font-size:13px;color:var(--mute)}
.snr .note{margin-top:14px;display:flex;gap:8px;align-items:flex-start;padding:10px 12px;border-radius:12px;background:rgba(255,255,255,.03);border:1px solid var(--line);font-size:12.5px;color:var(--mute)}

/* reader */
.snr .bar{position:sticky;top:65px;z-index:20;margin:-12px -16px 14px;padding:10px 16px;display:flex;align-items:center;gap:10px;background:rgba(5,9,20,.86);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);border-bottom:1px solid var(--line)}
@media (min-width:640px){.snr .bar{margin:-16px -24px 16px;padding:10px 24px}}
@media (min-width:1024px){.snr .bar{top:0}}
.snr .bar .bk{width:36px;height:36px;border-radius:11px;display:grid;place-items:center;background:var(--card);border:1px solid var(--line2);flex-shrink:0}
.snr .bar .ttl{flex:1;min-width:0}
.snr .bar .ttl b{display:block;font:700 13.5px var(--display);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#fff}
.snr .bar .ttl small{font:600 11px var(--display);color:var(--mute)}
.snr .bar .pg{flex-shrink:0;font:700 11.5px var(--display);padding:7px 10px;border-radius:10px;background:rgba(139,92,246,.16);color:#DDD6FE;border:1px solid rgba(167,139,250,.35)}
.snr .prog{position:absolute;left:0;bottom:-1px;height:2px;background:linear-gradient(90deg,#8B5CF6,#10B981);transition:width .2s}
.snr .protect{-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}
.snr .protect img,.snr .protect svg{-webkit-user-drag:none;pointer-events:none}
.snr .skel-page{max-width:820px;margin:0 auto 18px;height:420px;border-radius:6px;background:linear-gradient(90deg,#0B1222,#141E36,#0B1222);background-size:200% 100%;animation:snr-shimmer 1.5s linear infinite}
.snr .scrim{position:fixed;inset:0;background:rgba(2,5,12,.7);-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px);z-index:60}
.snr .toc{position:fixed;left:50%;bottom:0;transform:translateX(-50%);width:min(560px,100%);max-height:78vh;overflow:auto;z-index:61;border-radius:24px 24px 0 0;padding:10px 16px calc(18px + env(safe-area-inset-bottom,0px));background:#0B1222;border:1px solid var(--line2)}
.snr .toc .grab{width:40px;height:4px;border-radius:2px;background:#2A3858;margin:0 auto 12px}
.snr .toc h3{margin:0 0 10px;font:700 16px var(--display);color:#fff}
.snr .toc button{width:100%;display:flex;gap:10px;align-items:center;text-align:left;padding:10px 8px;border-radius:12px;font:600 13.5px var(--display);color:#D5DBF0}
.snr .toc button:hover,.snr .toc button.on{background:rgba(139,92,246,.14);color:#fff}
.snr .toc button span{width:28px;height:28px;flex-shrink:0;border-radius:8px;display:grid;place-items:center;background:rgba(139,92,246,.18);color:#C4B5FD;font-size:11.5px}
.snr .protect figure.sn-fig{position:relative;cursor:zoom-in}
.snr .protect figure.sn-fig::before{content:"Tap to zoom";display:table;margin:-4px -4px 8px auto;font:700 10px 'Poppins','Inter',sans-serif;letter-spacing:.3px;padding:4px 7px;border-radius:7px;background:rgba(109,40,217,.1);color:#6D28D9}
.snr .zoomwrap{position:fixed;inset:0;z-index:70;display:flex;flex-direction:column;background:#050914}
.snr .zbar{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 16px;font:600 12.5px var(--display);color:var(--mute)}
.snr .zbar button{width:38px;height:38px;border-radius:12px;background:#0B1222;border:1px solid var(--line2);color:#fff;font-size:15px}
.snr .zscroll{flex:1;overflow:auto;padding:8px 16px 40px;-webkit-overflow-scrolling:touch}
.snr .zscroll figure.sn-fig{width:720px;max-width:none;margin:0 auto;cursor:default;background:#fff}
.snr .zscroll figure.sn-fig::before{display:none}
.snr .fineprint{max-width:820px;margin:6px auto 0;text-align:center;font-size:11.5px;color:var(--dim)}

@media (min-width:640px){.snr .hero{padding:26px 24px}.snr .hero h1{font-size:42px}.snr .hero p{font-size:14px}.snr .hero .stack{right:40px;width:140px;height:168px}}
@media (prefers-reduced-motion:reduce){.snr *,.snr *::before,.snr *::after{animation:none!important;transition:none!important}}
@media print{body *{visibility:hidden!important}body::after{content:"Printing is disabled for NEET Track notes.";visibility:visible;position:fixed;top:40%;left:0;right:0;text-align:center;font:600 16px sans-serif}}
`;
