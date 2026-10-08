import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { lazy, Suspense, useState } from "react";
import { PageShell } from "@/components/page-shell";
import { DrAzkaLoader } from "@/components/dr-akza-loader";
import { ArrowLeft, BookMarked, FlaskConical, Atom, Microscope, Box, Gauge, Clapperboard } from "lucide-react";
// NEETLab is one of the heaviest areas (3D/simulation code). Keep it out of
// the initial route bundle and load each subject experience only when opened.
const SubjectIndex = lazy(() => import("@/neetlab/components/SubjectIndex").then((m) => ({ default: m.SubjectIndex })));
const BioTopic = lazy(() => import("@/neetlab/components/BiologyTopic").then((m) => ({ default: m.BioTopic })));
const PhyTopic = lazy(() => import("@/neetlab/components/PhysicsTopic").then((m) => ({ default: m.PhyTopic })));
const ChemTopic = lazy(() => import("@/neetlab/components/ChemistryTopic").then((m) => ({ default: m.ChemTopic })));
import { subjects } from "@/neetlab/data/topics";
import { FeatureLock } from "@/components/feature-lock";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/neetlab")({
  head: () => ({ meta: [{ title: "NEETLab — 3D Models & Simulations | NEET Track" }] }),
  component: () => (<FeatureLock feature="neetlab"><NEETLabPage /></FeatureLock>),
});

type Subj = "biology" | "physics" | "chemistry";
const TABS: { k: Subj; label: string; icon: typeof Atom; a: string; b: string }[] = [
  { k: "biology", label: "Biology", icon: Microscope, a: "#A855F7", b: "#EC4899" },
  { k: "physics", label: "Physics", icon: Atom, a: "#3B82F6", b: "#22D3EE" },
  { k: "chemistry", label: "Chemistry", icon: FlaskConical, a: "#10B981", b: "#84CC16" },
];

const all = [...subjects.biology.topics, ...subjects.physics.topics, ...subjects.chemistry.topics];
const COUNT = {
  model: all.filter((t) => (t.kind ?? "model") === "model").length,
  sim: all.filter((t) => t.kind === "simulation").length,
  anim: all.filter((t) => t.kind === "animation" || t.kind === "game").length,
};

function NEETLabPage() {
  const nav = useNavigate();
  const [tab, setTab] = useState<Subj>("biology");
  const [open, setOpen] = useState<Record<Subj, string | null>>({ biology: null, physics: null, chemistry: null });
  const topic = open[tab];
  const pick = (slug: string | null) => { setOpen((o) => ({ ...o, [tab]: slug })); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const cur = TABS.find((t) => t.k === tab)!;

  return (
    <PageShell>
      <style>{PAGE_CSS}</style>
      {/* Hero */}
      <section className="nlh">
        <div className="nlh-bg" />
        <div className="nlh-atom" aria-hidden="true"><i /><i /><i /><b /></div>
        <div className="relative max-w-xl">
          <span className="nlh-eyebrow"><span />Interactive science lab</span>
          <h1 className="mt-2 text-[34px] font-extrabold leading-[1.05] tracking-tight text-white sm:text-5xl">NEET<span className="nlh-grad">Lab</span></h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-300 sm:text-[15px]">Rotate real 3D anatomy, run physics experiments and watch reactions happen. See it once, remember it in the exam.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="nlh-stat"><Box className="h-3.5 w-3.5" /><b>{COUNT.model}</b> 3D models</span>
            <span className="nlh-stat"><Gauge className="h-3.5 w-3.5" /><b>{COUNT.sim}</b> simulations</span>
            <span className="nlh-stat"><Clapperboard className="h-3.5 w-3.5" /><b>{COUNT.anim}</b> animations &amp; games</span>
          </div>
          <button type="button" onClick={() => nav({ to: "/pyqs" })} className="nlh-pyq"><BookMarked className="h-4 w-4" />Practise NEET PYQs</button>
        </div>
      </section>

      {/* Subject switcher */}
      <div className="sticky top-0 z-20 -mx-4 mt-4 bg-background/85 px-4 py-2.5 backdrop-blur sm:mx-0 sm:px-0">
        <div className="nls" role="tablist" aria-label="Subject">
          {TABS.map((t) => (
            <button key={t.k} type="button" role="tab" aria-selected={tab === t.k} onClick={() => setTab(t.k)}
              className={cn("nls-btn", tab === t.k && "on")} style={{ ["--a" as string]: t.a, ["--b" as string]: t.b }}>
              <t.icon className="h-4 w-4" />{t.label}<em>{subjects[t.k].topics.length}</em>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3">
        <Suspense fallback={<DrAzkaLoader size="sm" message="Setting up the lab" className="py-12" />}>
          {topic ? (
            <>
              <button type="button" onClick={() => pick(null)} className="nl-back" style={{ ["--a" as string]: cur.a }}>
                <ArrowLeft className="h-4 w-4" />All {cur.label.toLowerCase()} topics
              </button>
              {tab === "biology" && <BioTopic topic={topic} />}
              {tab === "physics" && <PhyTopic topic={topic} />}
              {tab === "chemistry" && <ChemTopic topic={topic} />}
            </>
          ) : (
            <SubjectIndex key={tab} subject={tab} title={subjects[tab].title} desc={subjects[tab].desc} topics={subjects[tab].topics as any} onPick={pick} />
          )}
        </Suspense>
      </div>
    </PageShell>
  );
}

const PAGE_CSS = `
.nlh{position:relative;overflow:hidden;border-radius:28px;padding:24px 20px 22px;background:#070B1A;border:1px solid rgba(148,163,184,.18);box-shadow:0 30px 60px -36px rgba(37,99,235,.6)}
@media (min-width:640px){.nlh{padding:36px 34px}}
.nlh-bg{position:absolute;inset:0;background:radial-gradient(420px 260px at 92% 8%,rgba(168,85,247,.38),transparent 70%),radial-gradient(380px 260px at 70% 100%,rgba(34,211,238,.24),transparent 70%),radial-gradient(360px 240px at 0% 0%,rgba(16,185,129,.18),transparent 70%)}
.nlh-bg::after{content:"";position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.05) 1px,transparent 1px);background-size:28px 28px;mask-image:radial-gradient(ellipse at 80% 30%,#000,transparent 70%)}
.nlh-atom{position:absolute;right:-46px;top:-34px;width:170px;height:170px;opacity:.5}
@media (min-width:640px){.nlh-atom{opacity:.95;right:40px;top:50%;margin-top:-110px;width:220px;height:220px}}
.nlh-atom i{position:absolute;inset:0;margin:auto;width:100%;height:36%;border-radius:50%;border:1.5px solid rgba(147,197,253,.55);animation:nlh-sp 12s linear infinite}
.nlh-atom i:nth-child(2){rotate:60deg;border-color:rgba(216,180,254,.55);animation-duration:15s}
.nlh-atom i:nth-child(3){rotate:-60deg;border-color:rgba(110,231,183,.55);animation-duration:18s}
.nlh-atom i::after{content:"";position:absolute;left:50%;top:-4px;width:8px;height:8px;border-radius:50%;background:#fff;box-shadow:0 0 12px #fff,0 0 22px #60A5FA}
.nlh-atom b{position:absolute;inset:0;margin:auto;width:26px;height:26px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#FDE68A,#F59E0B 60%,#B45309);box-shadow:0 0 28px rgba(251,191,36,.8)}
@keyframes nlh-sp{to{transform:rotate(360deg)}}
.nlh-eyebrow{display:inline-flex;align-items:center;gap:8px;font-size:11px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;color:#A5B4FC}
.nlh-eyebrow span{width:7px;height:7px;border-radius:50%;background:#22D3EE;box-shadow:0 0 0 4px rgba(34,211,238,.2)}
.nlh-grad{background:linear-gradient(90deg,#A78BFA,#22D3EE 55%,#34D399);-webkit-background-clip:text;background-clip:text;color:transparent}
.nlh-stat{display:inline-flex;align-items:center;gap:6px;height:30px;padding:0 11px;border-radius:999px;font-size:12px;color:#CBD5E1;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12)}
.nlh-stat b{color:#fff}
.nlh-pyq{margin-top:16px;display:inline-flex;align-items:center;gap:8px;height:42px;padding:0 16px;border-radius:13px;font-size:13.5px;font-weight:700;color:#0B1022;background:linear-gradient(90deg,#FDE68A,#FBBF24);box-shadow:0 12px 26px -12px rgba(251,191,36,.8)}
.nls{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;padding:5px;border-radius:18px;border:1px solid var(--border);background:var(--card);max-width:560px}
.nls-btn{display:flex;align-items:center;justify-content:center;gap:6px;height:42px;border-radius:13px;font-size:13.5px;font-weight:700;color:var(--muted-foreground);transition:all .25s}
.nls-btn em{font-style:normal;font-size:10.5px;font-weight:800;padding:1px 6px;border-radius:999px;background:var(--secondary)}
.nls-btn.on{color:#fff;background:linear-gradient(120deg,var(--a),var(--b));box-shadow:0 10px 22px -12px var(--a)}
.nls-btn.on em{background:rgba(255,255,255,.22)}
.nl-back{display:inline-flex;align-items:center;gap:6px;height:36px;padding:0 13px;border-radius:999px;border:1px solid var(--border);background:var(--card);font-size:13px;font-weight:700;color:var(--a)}
@media (prefers-reduced-motion:reduce){.nlh-atom i{animation:none}}
`;
