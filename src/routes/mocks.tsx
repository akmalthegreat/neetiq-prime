// Mock tests: the entry point to NEET Track's test series.

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { ArrowRight, CheckCircle2, Clock, Download, FileText, Layers, Target } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { useAuth } from "@/hooks/use-auth";
import { T700, T700_PHASES } from "@/lib/target700";

export const Route = createFileRoute("/mocks")({
  head: () => ({
    meta: [
      { title: "Mock Tests — Target 700 Batch | NEET Track" },
      { name: "description", content: "Target 700 Batch: 46 NEET-pattern mock tests with part tests, combined tests and 30 full syllabus papers." },
    ],
  }),
  component: MocksPage,
});

function MocksPage() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  useEffect(() => { if (!loading && !user) nav({ to: "/login" }); }, [user, loading, nav]);

  return (
    <PageShell eyebrow="Practice" title="Mock tests" description="NEET-pattern test series on the exam's CBT screen. 180 questions, 180 minutes, with full solutions and analysis.">
      <Link to="/target-700" className="group relative block overflow-hidden rounded-3xl bg-[#050B1F] text-white shadow-[0_30px_60px_-30px_rgba(37,99,235,.6)]">
        <div className="absolute inset-0 bg-[radial-gradient(90%_80%_at_100%_0%,rgba(250,204,21,.25),transparent_60%),radial-gradient(70%_70%_at_0%_100%,rgba(37,99,235,.4),transparent_60%)]" />
        <div className="absolute -right-6 -top-6 select-none text-[150px] font-black leading-none text-white/[.05] sm:text-[200px]">700</div>
        <div className="relative p-6 sm:p-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-amber-200">
            <Target className="h-3.5 w-3.5" /> Flagship test series
          </div>
          <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-5xl">
            Target <span className="bg-gradient-to-r from-amber-200 via-amber-300 to-yellow-500 bg-clip-text text-transparent">700</span> Batch
          </h2>
          <p className="mt-2 max-w-lg text-white/75">The must-solve test series if you are aiming for 700+ and a top government medical college.</p>

          <div className="mt-5 flex flex-wrap gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 font-semibold"><Layers className="h-3.5 w-3.5 text-amber-200" />{T700.totalTests} tests</span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 font-semibold"><FileText className="h-3.5 w-3.5 text-amber-200" />8,280 questions</span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 font-semibold"><Clock className="h-3.5 w-3.5 text-amber-200" />180 Q · 180 min each</span>
          </div>

          <ul className="mt-5 grid gap-2 sm:grid-cols-3">
            {T700_PHASES.map((p) => (
              <li key={p.group} className="rounded-2xl border border-white/10 bg-white/[.04] p-3">
                <div className="text-[10px] font-bold uppercase tracking-wider text-amber-200">{p.range}</div>
                <div className="mt-0.5 text-sm font-bold">{p.title.replace(/^Phase \d · /, "")}</div>
              </li>
            ))}
          </ul>

          <span className="mt-6 inline-flex h-12 items-center gap-2 rounded-xl bg-gradient-to-r from-amber-300 to-yellow-500 px-5 text-sm font-extrabold text-slate-950 transition group-hover:gap-3">
            Enter the test series <ArrowRight className="h-4 w-4" />
          </span>
        </div>
      </Link>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5 text-sm">
          <div className="font-semibold">What you get</div>
          <ul className="mt-2 space-y-1.5 text-muted-foreground">
            {["Exact NEET pattern on an NTA-style CBT screen", "Statement, assertion-reason, match-the-column and figure questions", "Score, accuracy, time analysis and solutions after every test"].map((x) => (
              <li key={x} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />{x}</li>
            ))}
          </ul>
        </div>
        <a href={T700.pdf} target="_blank" rel="noopener" className="flex items-center gap-4 rounded-2xl border border-border bg-card p-5 hover:border-primary/40">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-400/15 text-amber-600 dark:text-amber-400"><Download className="h-5 w-5" /></span>
          <span className="text-sm"><span className="block font-semibold">Test schedule & syllabus (PDF)</span><span className="text-muted-foreground">All 46 tests in order with chapter-wise syllabus.</span></span>
        </a>
      </div>
    </PageShell>
  );
}
