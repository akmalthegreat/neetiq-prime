import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight, ArrowUpRight, Check, Star, Target, Layers, RotateCcw, NotebookPen, Gauge, Trophy,
  ShieldCheck, BookOpenCheck,
} from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";
import { getHomeStats, type HomeStats } from "@/lib/home-stats.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "NEET Track — NEET Preparation with Daily DPP, PYQs & Mock Tests" },
      { name: "description", content: "NEET Track is a complete NEET-UG preparation platform: a large bank of NEET-level questions, custom tests, an Improvement Zone for your mistakes, NCERT short notes and a NEET score predictor." },
      { property: "og:title", content: "NEET Track — NEET Preparation with Daily DPP, PYQs & Mock Tests" },
      { property: "og:description", content: "NEET-level question practice, custom tests, an Improvement Zone for mistakes, NCERT short notes and a score predictor for NEET-UG aspirants." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: async (): Promise<HomeStats | null> => {
    try { return await getHomeStats(); } catch { return null; }
  },
  staleTime: 10 * 60_000,
  component: LandingPage,
});

/** Highest rank achieved by a NEET Track mentorship student. */
const TOP_RANK = 125;

const roundDown = (n: number, step: number) => Math.floor(n / step) * step;
const fmt = (n: number) => n.toLocaleString("en-IN");

function LandingPage() {
  const stats = Route.useLoaderData();
  const questions = stats?.questions ? `${fmt(roundDown(stats.questions, 5000))}+` : "45,000+";
  const students = stats?.students && stats.students >= 100 ? `${fmt(roundDown(stats.students, 100))}+` : null;
  const rated = stats && stats.ratingCount >= 5 ? stats : null;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />

      {/* ───────── HERO ───────── */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div className="absolute -top-40 left-1/2 h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-primary/10 blur-[120px]" />
          <div className="absolute inset-0 bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] bg-[size:56px_56px] opacity-[0.25] [mask-image:radial-gradient(ellipse_at_top,black_20%,transparent_70%)]" />
        </div>

        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 pb-16 pt-14 sm:px-6 sm:pt-20 lg:grid-cols-[1.1fr_0.9fr] lg:gap-10 lg:pb-24">
          <div className="text-center lg:text-left">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 py-1 pl-1 pr-3 text-xs font-medium text-muted-foreground backdrop-blur">
              <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-semibold text-primary">AIR {TOP_RANK}</span>
              Top rank from our mentorship
            </div>

            <h1 className="mt-6 text-[2.5rem] font-bold leading-[1.05] tracking-tight sm:text-6xl">
              <span className="sr-only">NEET Track — NEET preparation platform. </span>
              Practise sharper.
              <br />
              <span className="text-gradient-primary">Crack NEET.</span>
            </h1>

            <p className="mx-auto mt-5 max-w-md text-base leading-relaxed text-muted-foreground sm:text-lg lg:mx-0">
              {questions} hand-picked NEET-level questions, tests built around your weak chapters, and every mistake
              saved so you never repeat it.
            </p>

            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start">
              <Button asChild size="lg" className="h-12 w-full rounded-xl bg-gradient-primary px-7 text-[15px] shadow-elegant hover:opacity-95 sm:w-auto">
                <Link to="/login">Start practising free <ArrowRight className="ml-1.5 h-4 w-4" /></Link>
              </Button>
              <Button asChild size="lg" variant="ghost" className="h-12 w-full rounded-xl px-6 text-[15px] sm:w-auto">
                <Link to="/dashboard">I already have an account</Link>
              </Button>
            </div>

            {rated && (
              <div className="mt-7 flex items-center justify-center gap-3 text-sm text-muted-foreground lg:justify-start">
                <Stars value={rated.ratingAvg} />
                <span><b className="font-semibold text-foreground">{rated.ratingAvg.toFixed(1)}</b> from student ratings</span>
              </div>
            )}
          </div>

          <HeroPreview />
        </div>
      </section>

      {/* ───────── NUMBERS ───────── */}
      <section className="border-y border-border/70 bg-card/40">
        <div className="mx-auto grid max-w-6xl grid-cols-2 divide-border/70 px-5 sm:px-6 lg:grid-cols-4 lg:divide-x">
          <Stat value={`AIR ${TOP_RANK}`} label="Highest rank from our mentorship" />
          <Stat value={questions} label="NEET-level questions" />
          {students ? <Stat value={students} label="Students preparing" /> : <Stat value="4" label="Subjects, NCERT-aligned" />}
          {rated ? <Stat value={`${rated.ratingAvg.toFixed(1)} ★`} label="Average student rating" /> : <Stat value="Daily" label="Fresh practice every day" />}
        </div>
      </section>

      {/* ───────── FEATURES ───────── */}
      <section className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">What you get</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Five tools. Nothing you don't need.</h2>
        </div>

        <div className="mt-12 grid gap-4 md:grid-cols-6">
          <Feature
            className="md:col-span-4"
            icon={BookOpenCheck}
            title="The question bank NEET deserves"
            desc={`${questions} questions written to NEET's level, chapter by chapter across Physics, Chemistry, Botany and Zoology, each with a clear solution.`}
            to="/dpp"
            big
          />
          <Feature
            className="md:col-span-2"
            icon={Layers}
            title="Custom tests"
            desc="Pick chapters, difficulty and length. Take it as a quiz or in the real NTA screen."
            to="/generate"
          />
          <Feature
            className="md:col-span-2"
            icon={RotateCcw}
            title="Improvement Zone"
            desc="Every question you get wrong is saved. Re-attempt until it's right."
            to="/mistakes"
          />
          <Feature
            className="md:col-span-2"
            icon={NotebookPen}
            title="Short notes"
            desc="Strictly NCERT, with diagrams and highlights. Revise a chapter in minutes."
            to="/short-notes"
          />
          <Feature
            className="md:col-span-2"
            icon={Gauge}
            title="Score predictor"
            desc="See where your marks and rank are heading, based on your own attempts."
            to="/score-predictor"
          />
        </div>
      </section>

      {/* ───────── RESULTS + RATINGS ───────── */}
      <section className="mx-auto w-full max-w-6xl px-5 pb-20 sm:px-6 sm:pb-24">
        <div className="grid gap-4 lg:grid-cols-5">
          <div className="relative overflow-hidden rounded-3xl border border-border bg-card p-8 sm:p-10 lg:col-span-3">
            <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-amber-400/10 blur-3xl" aria-hidden="true" />
            <div className="relative">
              <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-amber-500">
                <Trophy className="h-4 w-4" /> Our results
              </div>
              <div className="mt-6 flex items-end gap-3">
                <span className="text-7xl font-bold leading-none tracking-tight sm:text-8xl">{TOP_RANK}</span>
                <span className="pb-2 text-lg font-semibold text-muted-foreground">AIR</span>
              </div>
              <p className="mt-4 max-w-md text-muted-foreground">
                The highest All India Rank achieved by a student in NEET Track mentorship this year, built on the same
                daily practice and mistake review you get in the app.
              </p>
              <Link to="/mentorship" className="mt-6 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
                About mentorship <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <div className="rounded-3xl border border-border bg-card p-8 sm:p-10 lg:col-span-2">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Student ratings</div>
            {rated ? (
              <>
                <div className="mt-6 flex items-center gap-4">
                  <span className="text-6xl font-bold leading-none tracking-tight">{rated.ratingAvg.toFixed(1)}</span>
                  <div>
                    <Stars value={rated.ratingAvg} size="h-5 w-5" />
                    <div className="mt-1 text-sm text-muted-foreground">from {rated.ratingCount} in-app ratings</div>
                  </div>
                </div>
                <div className="mt-6 space-y-2">
                  {rated.ratingBars.map((n, i) => {
                    const pct = rated.ratingCount ? (n / rated.ratingCount) * 100 : 0;
                    return (
                      <div key={i} className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="w-3 text-right tabular-nums">{5 - i}</span>
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full bg-amber-400" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="w-6 tabular-nums">{n}</span>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <p className="mt-6 text-sm text-muted-foreground">Ratings from students appear here as they come in.</p>
            )}
            <p className="mt-6 text-xs text-muted-foreground">Ratings are submitted by signed-in students from inside the app.</p>
          </div>
        </div>
      </section>

      {/* ───────── CTA ───────── */}
      <section className="mx-auto w-full max-w-6xl px-5 pb-24 sm:px-6">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-hero px-6 py-14 text-center text-primary-foreground shadow-elegant sm:px-16 sm:py-16">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.18),transparent_60%)]" aria-hidden="true" />
          <div className="relative">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Your next question is waiting.</h2>
            <p className="mx-auto mt-3 max-w-md text-primary-foreground/85">Free to start. The Daily DPP is free for everyone, every day.</p>
            <Button asChild size="lg" className="mt-8 h-12 rounded-xl bg-white px-8 text-[15px] text-slate-900 hover:bg-white/90">
              <Link to="/login">Create free account <ArrowRight className="ml-1.5 h-4 w-4" /></Link>
            </Button>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-xs text-primary-foreground/80">
              <span className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5" /> No card needed</span>
              <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> Secure payments</span>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}

/* ───────── pieces ───────── */

function Stars({ value, size = "h-4 w-4" }: { value: number; size?: string }) {
  return (
    <span className="inline-flex" aria-label={`${value.toFixed(1)} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => {
        const fill = Math.max(0, Math.min(1, value - (n - 1)));
        return (
          <span key={n} className={`relative ${size}`}>
            <Star className={`absolute inset-0 ${size} text-amber-400/30`} fill="currentColor" strokeWidth={0} />
            <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
              <Star className={`${size} text-amber-400`} fill="currentColor" strokeWidth={0} />
            </span>
          </span>
        );
      })}
    </span>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="px-2 py-7 text-center sm:py-9">
      <div className="text-2xl font-bold tracking-tight sm:text-3xl">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground sm:text-sm">{label}</div>
    </div>
  );
}

function Feature({ icon: Icon, title, desc, to, big, className = "" }: {
  icon: typeof Target; title: string; desc: string; to: string; big?: boolean; className?: string;
}) {
  return (
    <Link
      to={to as never}
      className={`group relative overflow-hidden rounded-3xl border border-border bg-card transition-colors hover:border-primary/40 ${big ? "flex flex-col p-7" : "flex items-start gap-4 p-5 pr-12 md:flex-col md:gap-0 md:p-7"} ${className}`}
    >
      {big && <div className="pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-primary/10 blur-3xl" aria-hidden="true" />}
      <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-background text-primary">
        <Icon className="h-5 w-5" strokeWidth={1.8} />
      </div>
      <div className="relative">
        <h3 className={`font-semibold tracking-tight ${big ? "mt-6 text-2xl sm:text-[1.7rem]" : "text-lg md:mt-6"}`}>{title}</h3>
        <p className={`mt-1.5 leading-relaxed text-muted-foreground ${big ? "max-w-lg text-[15px]" : "text-sm"}`}>{desc}</p>
      </div>
      {big && (
        <div className="relative mt-6 flex flex-wrap gap-2">
          {["Physics", "Chemistry", "Botany", "Zoology"].map((s) => (
            <span key={s} className="rounded-full border border-border bg-background/60 px-3 py-1 text-xs font-medium text-muted-foreground">{s}</span>
          ))}
        </div>
      )}
      <ArrowUpRight className="absolute right-5 top-5 h-5 w-5 md:right-6 md:top-6 text-muted-foreground/50 transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary" />
    </Link>
  );
}

/** A small, static glimpse of the practice screen. */
function HeroPreview() {
  const opts = [
    { k: "A", t: "Mitochondria" },
    { k: "B", t: "Ribosome", ok: true },
    { k: "C", t: "Lysosome" },
    { k: "D", t: "Golgi body" },
  ];
  return (
    <div className="relative mx-auto w-full max-w-sm" aria-hidden="true">
      <div className="absolute -inset-6 rounded-[2.5rem] bg-gradient-primary opacity-20 blur-2xl" />
      <div className="relative rounded-3xl border border-border bg-card p-5 shadow-elegant">
        <div className="flex items-center justify-between text-xs">
          <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 font-semibold text-emerald-600 dark:text-emerald-400">Botany · Cell</span>
          <span className="font-medium tabular-nums text-muted-foreground">Q 12 / 45</span>
        </div>
        <p className="mt-4 text-[15px] font-medium leading-snug">Which cell organelle is the site of protein synthesis?</p>
        <div className="mt-4 space-y-2">
          {opts.map((o) => (
            <div
              key={o.k}
              className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm ${o.ok ? "border-emerald-500/50 bg-emerald-500/10 font-medium" : "border-border"}`}
            >
              <span className={`flex h-6 w-6 items-center justify-center rounded-md text-xs font-semibold ${o.ok ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground"}`}>
                {o.ok ? <Check className="h-3.5 w-3.5" /> : o.k}
              </span>
              {o.t}
            </div>
          ))}
        </div>
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted">
          <div className="h-full w-[27%] rounded-full bg-gradient-primary" />
        </div>
      </div>

      <div className="absolute -bottom-5 -left-3 flex items-center gap-2 rounded-2xl border border-border bg-card px-3.5 py-2.5 text-xs font-medium shadow-elegant sm:-left-8">
        <RotateCcw className="h-4 w-4 text-amber-500" /> Saved to Improvement Zone
      </div>
      <div className="absolute -right-2 -top-4 flex items-center gap-1.5 rounded-2xl border border-border bg-card px-3 py-2 text-xs font-semibold shadow-elegant sm:-right-6">
        <Target className="h-4 w-4 text-primary" /> 91% accuracy
      </div>
    </div>
  );
}
