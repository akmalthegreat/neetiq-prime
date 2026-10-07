import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { PageShell } from "@/components/page-shell";
import { HOME_CSS } from "@/components/home/home-styles";
import { TestBuilder } from "@/components/home/test-builder";
import { useConsultData } from "@/components/consult/consult-ui";
import { DrAkzaLoader } from "@/components/dr-akza-loader";
import { useAuth } from "@/hooks/use-auth";

type Search = { start?: "weak" | "pyq" };

export const Route = createFileRoute("/generate")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    start: s.start === "weak" || s.start === "pyq" ? s.start : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Generate Test & CBT — NEET Track" },
      { name: "description", content: "Build your own NEET test: pick subjects and chapters, set questions per subject and the timer, then attempt it in practice, NTA CBT, speed or mistake-revival mode." },
      { property: "og:title", content: "Generate Test & CBT — NEET Track" },
      { property: "og:description", content: "Build your own NEET test in four steps." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GeneratePage,
});

const STATS: { v: string; l: string; c: string }[] = [
  { v: "4", l: "test modes", c: "#22D3EE" },
  { v: "180", l: "Qs per subject", c: "#FBBF24" },
  { v: "−1", l: "NEET marking", c: "#FB7185" },
];

function GeneratePage() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const { start } = Route.useSearch();
  const consult = useConsultData();

  useEffect(() => {
    if (!loading && !user) void nav({ to: "/login" });
  }, [user, loading, nav]);

  if (loading || !user) return <PageShell><DrAkzaLoader message="Opening the test builder" /></PageShell>;

  return (
    <PageShell>
      <div className="nth nth-wrap gen-wrap">
        <style dangerouslySetInnerHTML={{ __html: HOME_CSS + GEN_CSS }} />
        <div className="gen-grid">
          <header className="gen-head rv">
            <span className="gen-eyebrow"><i />TEST BUILDER</span>
            <h1>Generate <em>your</em> test</h1>
            <p>Choose subjects and chapters, set questions and time, then attempt it the way you want: practice, real NTA CBT, speed run or mistake revival.</p>
            <div className="gen-stats">
              {STATS.map((s) => <div key={s.l}><b style={{ color: s.c }}>{s.v}</b><span>{s.l}</span></div>)}
            </div>
          </header>
          <TestBuilder page start={start} snapshot={consult.data?.snapshot} />
        </div>
      </div>
    </PageShell>
  );
}

const GEN_CSS = `
.nth.gen-wrap{border-radius:0;margin:-2rem -1rem;padding:18px 14px 40px;min-height:calc(100vh - 4rem);
  background:radial-gradient(620px 380px at 95% -8%,rgba(59,130,246,.20),transparent 60%),radial-gradient(520px 420px at -12% 35%,rgba(139,92,246,.12),transparent 60%),radial-gradient(500px 300px at 50% 105%,rgba(16,185,129,.08),transparent 60%),var(--bg)}
@media (min-width:640px){.nth.gen-wrap{margin:-2.5rem -1.5rem;padding:28px 22px 48px}}
@media (min-width:1024px){.nth.gen-wrap{margin:-2.5rem -2rem;padding:36px 32px 56px}}
.nth .gen-grid{max-width:860px;margin:0 auto;display:flex;flex-direction:column;gap:16px}
.nth .gen-head{padding:4px 2px 0}
.nth .gen-eyebrow{display:inline-flex;align-items:center;gap:8px;font:700 11px var(--display);letter-spacing:.18em;color:#93C5FD}
.nth .gen-eyebrow i{width:7px;height:7px;border-radius:50%;background:#22D3EE;animation:nth-pulseG 1.8s infinite}
.nth .gen-head h1{margin:10px 0 0;font:800 32px/1.08 var(--display);letter-spacing:-.8px}
.nth .gen-head h1 em{font-style:normal;background:linear-gradient(90deg,#60A5FA,#22D3EE 50%,#34D399);-webkit-background-clip:text;background-clip:text;color:transparent}
@media (min-width:640px){.nth .gen-head h1{font-size:40px}}
.nth .gen-head p{margin:10px 0 0;max-width:620px;font-size:14px;line-height:1.55;color:var(--mute)}
.nth .gen-stats{margin-top:16px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;max-width:520px}
.nth .gen-stats div{padding:10px 12px;border-radius:14px;background:rgba(255,255,255,.035);border:1px solid var(--line2)}
.nth .gen-stats b{display:block;font:800 20px/1 var(--display)}
.nth .gen-stats span{display:block;margin-top:5px;font:600 11px var(--display);color:var(--mute)}

/* Full-page builder */
.nth .quick .quick-link{height:32px;padding:0 11px;border-radius:10px;font:600 11.5px var(--display);color:#BFD4FF;background:rgba(59,130,246,.1);border:1px solid rgba(96,165,250,.3);display:inline-flex;align-items:center}
.nth .tb.pg{overflow:clip;padding:18px}
.nth .tb.pg .wiz{overflow:clip}
.nth .tb.pg .quick button.on{background:rgba(16,185,129,.16);border-color:rgba(52,211,153,.5);color:#A7F3D0}
.nth .tb.pg .wz-body{min-height:320px;padding:18px}
.nth .tb.pg .ch-list{max-height:min(54vh,520px)}
.nth .tb.pg .wz-steps .st{width:auto;min-width:54px}
.nth .tb.pg .wz-foot{position:sticky;bottom:calc(84px + env(safe-area-inset-bottom));z-index:3;background:rgba(7,14,31,.94);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px)}
@media (min-width:1024px){.nth .tb.pg .wz-foot{bottom:0}}
`;
