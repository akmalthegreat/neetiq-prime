import { useMemo, useState, type ComponentType } from "react";
import {
  Search, Box, Clapperboard, Gauge, Gamepad2, ArrowRight, Dna, HeartPulse, Brain, Wind, Bone, Microscope, Droplets,
  Ear, Leaf, Bug, Baby, Atom, FlaskConical, Hexagon, Beaker, Zap, Flame, Orbit, Rocket, Waves, RotateCw, Triangle, CircleDot, Link2, Sparkles,
} from "lucide-react";
import type { Topic, TopicKind } from "../data/topics";

interface Props {
  subject: "biology" | "physics" | "chemistry";
  title: string;
  desc: string;
  topics: Topic[];
  onPick: (slug: string) => void;
}

type Icon = ComponentType<{ className?: string; strokeWidth?: number }>;

export const KIND: Record<TopicKind, { label: string; cta: string; icon: Icon }> = {
  model: { label: "3D model", cta: "Explore in 3D", icon: Box },
  animation: { label: "Animation", cta: "Watch process", icon: Clapperboard },
  simulation: { label: "Live simulation", cta: "Run simulation", icon: Gauge },
  game: { label: "Game", cta: "Play now", icon: Gamepad2 },
};

export const SUBJECT_THEME = {
  biology: { a: "#A855F7", b: "#EC4899", glow: "rgba(168,85,247,.35)" },
  physics: { a: "#3B82F6", b: "#22D3EE", glow: "rgba(59,130,246,.35)" },
  chemistry: { a: "#10B981", b: "#84CC16", glow: "rgba(16,185,129,.35)" },
} as const;

/** A picture for each topic, picked from its slug or tag. */
function iconFor(t: Topic): Icon {
  const s = t.slug.toLowerCase(), tag = t.tag.toLowerCase();
  const by: [RegExp, Icon][] = [
    [/dna|replication/, Dna], [/heart|cardiac/, HeartPulse], [/brain|neuron|spinal/, Brain], [/lung/, Wind], [/skeleton|tooth|mouth/, Bone],
    [/ear/, Ear], [/chloroplast|photosynthesis/, Leaf], [/influenza|covid/, Bug], [/sperm/, Baby], [/blood|kidney/, Droplets],
    [/mitosis|meiosis|cell/, Microscope], [/projectile/, Rocket], [/pendulum|spring/, Waves], [/circular/, Orbit], [/rotation/, RotateCw],
    [/incline/, Triangle], [/collision/, CircleDot], [/tension/, Link2], [/atom/, Atom], [/benzene|glucose|maltose/, Hexagon],
    [/titration/, Beaker], [/combustion/, Flame], [/electrolysis/, Zap], [/labgame|reactions/, FlaskConical],
  ];
  for (const [re, ic] of by) if (re.test(s)) return ic;
  if (/bond|molecule|hybrid/.test(tag)) return Hexagon;
  return Sparkles;
}

export function SubjectIndex({ subject, title, desc, topics, onPick }: Props) {
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<TopicKind | "all">("all");
  const th = SUBJECT_THEME[subject];

  const kinds = useMemo(() => {
    const m = new Map<TopicKind, number>();
    topics.forEach((t) => m.set(t.kind ?? "model", (m.get(t.kind ?? "model") ?? 0) + 1));
    return [...m.entries()];
  }, [topics]);

  const shown = topics.filter((t) => {
    if (kind !== "all" && (t.kind ?? "model") !== kind) return false;
    if (!q.trim()) return true;
    const needle = q.toLowerCase();
    return t.title.toLowerCase().includes(needle) || t.tag.toLowerCase().includes(needle) || t.blurb.toLowerCase().includes(needle);
  });

  return (
    <div className="py-2" style={{ ["--a" as string]: th.a, ["--b" as string]: th.b, ["--g" as string]: th.glow }}>
      <style>{NL_CSS}</style>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{title} <span className="nl-grad">Lab</span></h2>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">{desc}</p>
        </div>
        <label className="nl-search">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${title.toLowerCase()} topics`} aria-label={`Search ${title} topics`} />
        </label>
      </div>

      <div className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        <button type="button" onClick={() => setKind("all")} className={`nl-chip ${kind === "all" ? "on" : ""}`}>All <b>{topics.length}</b></button>
        {kinds.map(([k, n]) => {
          const K = KIND[k];
          return (
            <button key={k} type="button" onClick={() => setKind(k)} className={`nl-chip ${kind === k ? "on" : ""}`}>
              <K.icon className="h-3.5 w-3.5" />{K.label}{n > 1 && !K.label.endsWith("s") ? "s" : ""} <b>{n}</b>
            </button>
          );
        })}
      </div>

      {shown.length === 0 ? (
        <div className="rounded-3xl border border-dashed p-10 text-center text-sm text-muted-foreground">No topics match “{q}”.</div>
      ) : (
        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((t, i) => {
            const K = KIND[t.kind ?? "model"], Ic = iconFor(t);
            return (
              <button key={t.slug} type="button" onClick={() => onPick(t.slug)} className="nl-card group" style={{ animationDelay: `${Math.min(i, 12) * 40}ms` }}>
                <div className="nl-art">
                  <span className="nl-orbit" /><span className="nl-orbit o2" />
                  <span className="nl-ico"><Ic className="h-8 w-8" strokeWidth={1.6} /></span>
                  <span className="nl-kind"><K.icon className="h-3 w-3" />{K.label}</span>
                  <span className="nl-num">{String(i + 1).padStart(2, "0")}</span>
                </div>
                <div className="flex flex-1 flex-col p-4 pt-3.5">
                  <span className="nl-tag">{t.tag}</span>
                  <h3 className="mt-1.5 text-[17px] font-bold leading-snug">{t.title}</h3>
                  <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">{t.blurb}</p>
                  <span className="nl-cta">{K.cta}<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

const NL_CSS = `
.nl-grad{background:linear-gradient(90deg,var(--a),var(--b));-webkit-background-clip:text;background-clip:text;color:transparent}
.nl-search{display:flex;align-items:center;gap:8px;height:44px;min-width:0;width:100%;max-width:340px;padding:0 14px;border-radius:14px;border:1px solid var(--border);background:var(--card)}
.nl-search:focus-within{border-color:var(--a);box-shadow:0 0 0 3px var(--g)}
.nl-search input{flex:1;min-width:0;background:transparent;outline:none;font-size:14px}
.nl-chip{flex:none;display:inline-flex;align-items:center;gap:6px;height:34px;padding:0 13px;border-radius:999px;border:1px solid var(--border);background:var(--card);font-size:12.5px;font-weight:600;color:var(--muted-foreground);transition:all .2s}
.nl-chip b{font-weight:800;font-size:11px;opacity:.7}
.nl-chip.on{color:#fff;border-color:transparent;background:linear-gradient(90deg,var(--a),var(--b));box-shadow:0 8px 20px -10px var(--a)}
.nl-card{position:relative;display:flex;flex-direction:column;text-align:left;border-radius:22px;overflow:hidden;border:1px solid var(--border);background:var(--card);transition:transform .25s cubic-bezier(.2,.8,.2,1),box-shadow .25s,border-color .25s;animation:nl-up .45s cubic-bezier(.2,.8,.2,1) both}
.nl-card:hover{transform:translateY(-3px);border-color:color-mix(in oklab,var(--a) 55%,transparent);box-shadow:0 22px 44px -26px var(--a)}
.nl-card:active{transform:scale(.985)}
.nl-art{position:relative;height:118px;overflow:hidden;display:grid;place-items:center;
  background:radial-gradient(120% 140% at 85% 0%,color-mix(in oklab,var(--b) 55%,transparent),transparent 55%),radial-gradient(120% 140% at 0% 100%,color-mix(in oklab,var(--a) 70%,transparent),transparent 60%),#0B1022}
.nl-art::after{content:"";position:absolute;inset:0;background-image:radial-gradient(rgba(255,255,255,.16) 1px,transparent 1.2px);background-size:14px 14px;mask-image:linear-gradient(180deg,transparent,#000 60%);pointer-events:none}
.nl-orbit{position:absolute;width:150px;height:56px;border:1px solid rgba(255,255,255,.22);border-radius:50%;transform:rotate(-18deg);animation:nl-spin 16s linear infinite}
.nl-orbit.o2{width:110px;height:110px;transform:none;border-style:dashed;border-color:rgba(255,255,255,.14);animation-duration:24s;animation-direction:reverse}
.nl-ico{position:relative;z-index:1;display:grid;place-items:center;width:64px;height:64px;border-radius:20px;color:#fff;background:linear-gradient(140deg,rgba(255,255,255,.28),rgba(255,255,255,.06));border:1px solid rgba(255,255,255,.35);
  -webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);box-shadow:0 14px 30px -12px rgba(0,0,0,.6),inset 0 1px 0 rgba(255,255,255,.35);transition:transform .35s cubic-bezier(.2,.8,.2,1)}
.nl-card:hover .nl-ico{transform:translateY(-3px) rotate(-4deg) scale(1.05)}
.nl-kind{position:absolute;left:10px;top:10px;z-index:1;display:inline-flex;align-items:center;gap:5px;padding:4px 9px;border-radius:999px;font-size:10.5px;font-weight:700;color:#fff;background:rgba(0,0,0,.35);border:1px solid rgba(255,255,255,.2);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}
.nl-num{position:absolute;right:12px;bottom:6px;z-index:1;font-size:28px;font-weight:900;letter-spacing:-1px;color:rgba(255,255,255,.14)}
.nl-tag{align-self:flex-start;border-radius:999px;padding:2px 9px;font-size:10.5px;font-weight:700;letter-spacing:.02em;color:var(--a);background:color-mix(in oklab,var(--a) 13%,transparent)}
.nl-cta{margin-top:auto;padding-top:12px;display:inline-flex;align-items:center;gap:6px;font-size:13.5px;font-weight:700;color:var(--a)}
@keyframes nl-spin{to{rotate:360deg}}
@keyframes nl-up{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.nl-card,.nl-orbit{animation:none}}
`;
