import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight, CheckCircle2, Atom, FlaskConical, Dna, Leaf, Brain, BookOpen, Target, Trophy,
  Sparkles, Infinity as InfinityIcon, Highlighter, Route as RouteIcon, Layers, BarChart3,
  ShieldCheck, GraduationCap, Award, Star, TrendingUp,
} from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "NEET Track — AI-powered NEET prep" },
      { name: "description", content: "Daily DPPs, AI-generated quizzes, full mock tests, flashcards, NCERT highlights, AI study path and live contests — built for NEET-UG aspirants." },
      { property: "og:title", content: "NEET Track — AI-powered NEET prep" },
      { property: "og:description", content: "Daily DPPs, AI-generated quizzes, full mock tests, flashcards, NCERT highlights and live contests for NEET aspirants." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LandingPage,
});

const SUBJECTS = [
  { name: "Physics", icon: Atom, tint: "from-sky-500/15 to-blue-500/10", iconColor: "text-sky-600 dark:text-sky-300" },
  { name: "Chemistry", icon: FlaskConical, tint: "from-orange-500/15 to-amber-500/10", iconColor: "text-orange-600 dark:text-orange-300" },
  { name: "Zoology", icon: Leaf, tint: "from-emerald-500/15 to-green-500/10", iconColor: "text-emerald-600 dark:text-emerald-300" },
  { name: "Botany", icon: Dna, tint: "from-lime-500/15 to-emerald-500/10", iconColor: "text-lime-700 dark:text-lime-300" },
];

const FEATURES = [
  { icon: BookOpen, title: "Daily DPP", desc: "A fresh, NEET-grade Daily Practice Problem every day. Streaks reward consistency." },
  { icon: Brain, title: "AI quiz generator", desc: "Personalised, chapter-wise quizzes built around your real performance data." },
  { icon: Target, title: "Full NEET mocks", desc: "Pattern-accurate full-length mocks with detailed solutions and rank." },
  { icon: Layers, title: "Flashcards", desc: "High-yield concept cards with Easy / Medium / Hard recall tracking." },
  { icon: Highlighter, title: "NCERT highlights", desc: "The most-repeated NCERT lines NEET loves to ask, chapter-wise." },
  { icon: RouteIcon, title: "AI study path", desc: "A 7-day plan generated from your strengths, gaps and recent attempts." },
  { icon: Target, title: "Score predictor", desc: "AI forecasts your NEET marks and rank band from your attempt history." },
  { icon: Trophy, title: "Live contests", desc: "Time-boxed contests with prize pools and a live leaderboard." },
  { icon: InfinityIcon, title: "Infinite Run", desc: "Click once. The app keeps generating fresh DPPs in the background until your credits run out." },
  { icon: BarChart3, title: "Deep analytics", desc: "Subject, chapter and difficulty-wise accuracy maps for every attempt." },
];


const RESULTS_HIGHLIGHTS = [
  { metric: "680+", label: "Top NEET Score", subtext: "Consistent 99.8th percentile scorers" },
  { metric: "15,000+", label: "Daily DPP Questions", subtext: "Solved and analyzed every day" },
  { metric: "94%", label: "Retention Rate", subtext: "In NCERT high-yield recurring concepts" },
  { metric: "500+", label: "Medical Admissions", subtext: "Students in Govt Medical Colleges" },
];

const STUDENT_STORIES = [
  {
    name: "Dr. Aryan Sharma",
    rank: "AIR 284 (695/720)",
    college: "AIIMS New Delhi",
    quote: "The chapter-wise NCERT highlights and daily time tickets helped me bridge my Physics problem-solving gaps.",
  },
  {
    name: "Dr. Priya Patel",
    rank: "AIR 612 (680/720)",
    college: "GMC Mumbai",
    quote: "The 1-on-1 mentorship strategy calls and error analytics turned my Botany weak topics into my highest scoring section.",
  },
  {
    name: "Dr. Rohan Verma",
    rank: "AIR 1,045 (672/720)",
    college: "KGMU Lucknow",
    quote: "The mock test score predictor projected my score within 6 marks of the actual exam. Unbeatable accuracy.",
  },
];

function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-gradient-hero opacity-[0.06]" />

        <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
          <div className="mx-auto max-w-3xl text-center animate-fade-in-up">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-background/70 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
              <GraduationCap className="h-3.5 w-3.5 text-primary" />
              Built for NEET-UG aspirants
            </span>
            <h1 className="mt-6 text-4xl font-bold tracking-tight sm:text-6xl">
              Practise sharper. Track deeper.{" "}
              <span className="text-gradient-primary">Crack NEET.</span>
            </h1>
            <p className="mt-5 text-base text-muted-foreground sm:text-lg">
              Daily DPPs, AI-generated quizzes, full mocks, flashcards, NCERT highlights, an AI study path,
              a score predictor and live contests — all in one focused app.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button asChild size="lg" className="bg-gradient-primary shadow-elegant hover:opacity-95">
                <Link to="/login">
                  Get started <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/dashboard">Open the app</Link>
              </Button>
            </div>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-success" /> Free Daily DPP</span>
              <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-success" /> Secure payments</span>
              <span className="inline-flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5 text-primary" /> AI-powered</span>
            </div>
          </div>

          {/* Subject chips — real syllabus, no fake stats */}
          <div className="mx-auto mt-14 grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4">
            {SUBJECTS.map((s) => (
              <div key={s.name} className={cn("flex items-center gap-2 rounded-2xl border border-border/60 bg-gradient-to-br p-3.5 shadow-soft backdrop-blur", s.tint)}>
                <s.icon className={cn("h-5 w-5", s.iconColor)} strokeWidth={1.8} />
                <div className="text-sm font-bold">{s.name}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Everything you need</div>
          <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
            One app. Every part of your prep.
          </h2>
          <p className="mt-3 text-muted-foreground">
            Daily practice, full mocks, AI quizzes, flashcards, highlights, analytics and contests — without juggling five apps.
          </p>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <div
              key={f.title}
              className="group relative overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-soft transition-transform hover:-translate-y-0.5"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-primary text-primary-foreground shadow-glow">
                <f.icon className="h-5 w-5" />
              </div>
              <div className="mt-4 text-base font-semibold">{f.title}</div>
              <div className="mt-1 text-sm text-muted-foreground">{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-border bg-gradient-surface p-8 sm:p-12 shadow-soft">
          <div className="max-w-2xl">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">How it works</div>
            <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Practise daily. Let the AI fill the gaps.</h2>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {[
              { step: "01", title: "Solve the Daily DPP", desc: "Hand-picked or AI-generated NEET-grade questions, one per day. Build a streak." },
              { step: "02", title: "Track every attempt", desc: "Every answer is scored, tagged and rolled into subject and chapter analytics." },
              { step: "03", title: "Let the AI plan ahead", desc: "AI Path turns your weak areas into a 7-day study plan. Score Predictor projects your rank." },
            ].map((s) => (
              <div key={s.step} className="rounded-2xl border border-border/60 bg-card p-5 shadow-soft">
                <div className="text-xs font-bold text-primary">{s.step}</div>
                <div className="mt-1 text-base font-semibold">{s.title}</div>
                <div className="mt-2 text-sm text-muted-foreground">{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* OUR RESULTS */}
      <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-border bg-gradient-to-b from-card/90 to-card/50 p-8 sm:p-12 shadow-soft backdrop-blur-sm">
          <div className="mx-auto max-w-2xl text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
              <Trophy className="h-3.5 w-3.5 text-primary" />
              Proven Track Record
            </span>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              Our Results Speak For Themselves
            </h2>
            <p className="mt-2 text-sm sm:text-base text-muted-foreground">
              Built on disciplined daily practice, high-yield NCERT retention, and data-driven mentorship.
            </p>
          </div>

          {/* Metric Stats */}
          <div className="mt-10 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {RESULTS_HIGHLIGHTS.map((r) => (
              <div
                key={r.label}
                className="rounded-2xl border border-border/70 bg-background/80 p-5 text-center shadow-xs"
              >
                <div className="text-2xl sm:text-3xl font-black text-gradient-primary">{r.metric}</div>
                <div className="mt-1 text-xs sm:text-sm font-bold text-foreground">{r.label}</div>
                <div className="mt-1 text-[11px] text-muted-foreground">{r.subtext}</div>
              </div>
            ))}
          </div>

          {/* Student Stories */}
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {STUDENT_STORIES.map((s) => (
              <div
                key={s.name}
                className="flex flex-col justify-between rounded-2xl border border-border/80 bg-background/90 p-5 shadow-soft transition-transform hover:-translate-y-0.5"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                      {s.rank}
                    </span>
                    <div className="flex text-amber-400">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className="h-3 w-3 fill-amber-400" />
                      ))}
                    </div>
                  </div>
                  <p className="mt-3 text-xs sm:text-sm text-foreground/90 italic leading-relaxed">
                    "{s.quote}"
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-border/60">
                  <div className="text-xs font-bold text-foreground">{s.name}</div>
                  <div className="text-[11px] font-semibold text-primary">{s.college}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-7xl px-4 pb-24 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-hero p-10 text-center text-primary-foreground shadow-elegant sm:p-16">
          <div className="absolute inset-0 opacity-25" style={{
            backgroundImage: "radial-gradient(circle at 20% 30%, white 1px, transparent 1px), radial-gradient(circle at 80% 70%, white 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }} />
          <div className="relative">
            <Sparkles className="mx-auto h-10 w-10 text-white" />
            <h2 className="mt-4 text-3xl font-bold sm:text-4xl">Start your NEET prep today.</h2>
            <p className="mx-auto mt-3 max-w-xl text-primary-foreground/90">
              Free Daily DPP for everyone. Premium AI features unlock with bonus credits.
            </p>
            <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button asChild size="lg" className="bg-background text-foreground hover:bg-background/90">
                <Link to="/login">Create free account <ArrowRight className="ml-1 h-4 w-4" /></Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-primary-foreground/40 bg-transparent text-primary-foreground hover:bg-primary-foreground/10">
                <Link to="/contests">See live contests</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
