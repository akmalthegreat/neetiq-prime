import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useConsultData, type ConsultData } from "@/components/consult/consult-ui";
import { getHomeExtras, type HomeExtras } from "@/lib/home-dashboard.functions";
import { HOME_CSS } from "@/components/home/home-styles";
import { TestBuilder } from "@/components/home/test-builder";
import { MegaQuizCard } from "@/components/home/mega-quiz-card";
import type { SectionKey } from "@/lib/insights-engine";

const WELCOME_IMG = "/assets/dashboard/welcome-study.jpg";
const AZKA_IMG = "/dr-azka.png";

type Today = { solved: number; correct: number; wrong: number };

/* ---------------------------------------------------------------- helpers */

function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(t); }, [ms]);
  return now;
}
const pad = (n: number) => String(Math.max(0, n)).padStart(2, "0");
function splitDuration(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
}
const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });

function CountUp({ to, ms = 1300 }: { to: number; ms?: number }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf = 0; const t0 = performance.now();
    const step = (t: number) => { const k = Math.min(1, (t - t0) / ms); setV(Math.round(to * (1 - Math.pow(1 - k, 3)))); if (k < 1) raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [to, ms]);
  return <>{v.toLocaleString("en-IN")}</>;
}

function SecHead({ icon, iconBg, title, right }: { icon: ReactNode; iconBg: string; title: string; right?: ReactNode }) {
  return (
    <div className="sec-h">
      <h2><span className="si" style={{ background: iconBg }}>{icon}</span>{title}</h2>
      {right}
    </div>
  );
}

const Ico = {
  bolt: <svg width="16" height="16" viewBox="0 0 24 24" fill="#FACC15"><path d="M13 2 3 14h9l-1 8 10-12h-9z" /></svg>,
  trend: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#34D399" strokeWidth="2" strokeLinecap="round"><path d="M22 7 13.5 15.5 8.5 10.5 2 17M16 7h6v6" /></svg>,
  trophy: (c: string) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3" /></svg>,
  layers: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#C4B5FD" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2 2 7l10 5 10-5zM2 17l10 5 10-5M2 12l10 5 10-5" /></svg>,
  arrow: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>,
  play: <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M7 5v14l12-7z" /></svg>,
  flame: <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2c1.2 4.6 6 6.4 6 11.5A6 6 0 0 1 6 13.5c0-2.4 1.2-4.2 2.4-5.4 0 2.4 1.2 3.6 2.4 3.6C10.8 8.1 9.6 5.2 12 2z" /></svg>,
  check: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#25D366" strokeWidth="3" strokeLinecap="round"><path d="m5 12 5 5L20 7" /></svg>,
  wa: <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2z" /></svg>,
  redo: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5" /></svg>,
};

/* ---------------------------------------------------------------- data */

function useTodayAndStreak(userId: string | undefined) {
  const [today, setToday] = useState<Today>({ solved: 0, correct: 0, wrong: 0 });
  const [streak, setStreak] = useState(0);
  useEffect(() => {
    if (!userId) return;
    const since = new Date(); since.setDate(since.getDate() - 60); since.setHours(0, 0, 0, 0);
    supabase.from("attempts").select("correct_count,wrong_count,submitted_at")
      .eq("user_id", userId).eq("status", "completed").gte("submitted_at", since.toISOString())
      .then(({ data }) => {
        const rows = (data ?? []) as { correct_count: number | null; wrong_count: number | null; submitted_at: string | null }[];
        const start = new Date(); start.setHours(0, 0, 0, 0);
        const t = rows.filter((r) => r.submitted_at && new Date(r.submitted_at) >= start);
        const correct = t.reduce((s, r) => s + (r.correct_count ?? 0), 0);
        const wrong = t.reduce((s, r) => s + (r.wrong_count ?? 0), 0);
        setToday({ solved: correct + wrong, correct, wrong });
        const days = new Set(rows.map((r) => r.submitted_at).filter(Boolean).map((s) => new Date(s as string).toISOString().slice(0, 10)));
        let n = 0; const cur = new Date(); cur.setHours(0, 0, 0, 0);
        if (!days.has(cur.toISOString().slice(0, 10))) cur.setDate(cur.getDate() - 1);
        while (days.has(cur.toISOString().slice(0, 10))) { n++; cur.setDate(cur.getDate() - 1); }
        setStreak(n);
      });
  }, [userId]);
  return { today, streak };
}

function useSubjectCounts() {
  const [counts, setCounts] = useState({ physics: 16047, chemistry: 15602, biology: 15146 });
  useEffect(() => {
    // Totals are pre-computed hourly in the database, so this is one tiny request.
    Promise.resolve((supabase as any).rpc("question_bank_counts"))
      .then(({ data }: { data: Record<string, number> | null }) => {
        if (!data) return;
        setCounts((old) => ({
          physics: Number(data.physics ?? old.physics),
          chemistry: Number(data.chemistry ?? old.chemistry),
          biology: Number(data.biology ?? old.biology),
        }));
      })
      .catch(() => { /* keep defaults */ });
  }, []);
  return counts;
}

/* ================================================================ PAGE */

export function HomeDashboard({ top }: { top?: ReactNode }) {
  const { user, profile } = useAuth();
  const consult = useConsultData();
  const extrasFn = useServerFn(getHomeExtras);
  const extras = useQuery<HomeExtras>({
    queryKey: ["home-extras", user?.id ?? "anon"],
    queryFn: () => extrasFn() as Promise<HomeExtras>,
    enabled: !!user, staleTime: 60_000,
  });
  const { today, streak } = useTodayAndStreak(user?.id);
  const counts = useSubjectCounts();

  const firstName = profile?.full_name?.trim()?.split(" ")[0] || user?.email?.split("@")[0] || "Doctor";
  const dailyGoal = profile?.daily_goal ?? 20;
  const targetYear = (profile as { target_year?: number | null } | null)?.target_year ?? 2027;
  const snap = consult.data?.snapshot;
  const ex = extras.data;

  return (
    <div className="nth nth-wrap">
      <style dangerouslySetInnerHTML={{ __html: HOME_CSS + WRAP_CSS }} />
      <div className="nth-grid">
        {top ? <div className="full">{top}</div> : null}
        <Welcome firstName={firstName} targetYear={targetYear} today={today} dailyGoal={dailyGoal} streak={streak} weekly={ex?.weekly} />
        <MegaQuizCard />
        <AzkaStrip tips={(consult.data?.recommendations ?? []).map((r) => (r.detail.length <= 110 ? r.detail : r.title))} />
        <Banner banners={ex?.banners ?? []} showBuiltIn={ex?.showBuiltInSlides ?? true} nextContest={ex?.nextContest ?? null} />
        <QuickPractice counts={counts} snapshot={snap} />
        <Improvement snapshot={snap} prediction={consult.data?.prediction} wrongThisWeek={ex?.wrongThisWeek ?? 0} bookmarks={ex?.bookmarks ?? 0} />
        <Leaderboard weekly={ex?.weekly} loading={extras.isLoading} />
        <ExamSimulation mocksTaken={ex?.mocksTaken ?? 0} lastMock={snap?.mocks.last ?? null} />
        <TestBuilder snapshot={snap} />
        <Tools />
        <Contest contest={ex?.nextContest ?? null} loading={extras.isLoading} />
        <Mentorship />
      </div>
    </div>
  );
}

const WRAP_CSS = `
.nth.nth-wrap{border-radius:0;margin:-2rem -1rem;padding:6px 0 48px;min-height:calc(100vh - 4rem);
  background:radial-gradient(600px 400px at 90% -5%,rgba(59,130,246,.16),transparent 60%),radial-gradient(500px 400px at -10% 40%,rgba(139,92,246,.09),transparent 60%),var(--bg)}
@media (min-width:640px){.nth.nth-wrap{margin:-2.5rem -1.5rem}}
@media (min-width:1024px){.nth.nth-wrap{margin:-2.5rem -2rem}}
.nth .nth-grid{max-width:1180px;margin:0 auto}
.nth .quick .quick-link{height:32px;padding:0 11px;border-radius:10px;font:600 11.5px var(--display);color:#BFD4FF;background:rgba(59,130,246,.1);border:1px solid rgba(96,165,250,.3);display:inline-flex;align-items:center}
.nth .full:empty{display:none}
@media (min-width:900px){.nth .nth-grid > .azka,.nth .nth-grid > section[aria-label="Quick practice"],.nth .nth-grid > section[aria-label="Exam simulation"],.nth .nth-grid > section[aria-label="1-on-1 mentorship"]{grid-column:1/-1}}
.nth .nth-empty{padding:14px;border-radius:16px;border:1px dashed var(--line2);font-size:13px;color:var(--mute);text-align:center}
`;

/* ---------------------------------------------------------------- 1 · Welcome */

function Welcome({ firstName, targetYear, today, dailyGoal, streak, weekly }: {
  firstName: string; targetYear: number; today: Today; dailyGoal: number; streak: number; weekly?: HomeExtras["weekly"];
}) {
  const left = Math.max(0, dailyGoal - today.solved);
  const pct = dailyGoal > 0 ? Math.min(1, today.solved / dailyGoal) : 0;
  const rank = weekly?.me.rank ?? null;
  const change = weekly?.me.change ?? null;
  const lines = useMemo(() => {
    const l: ReactNode[] = ["AIIMS New Delhi is waiting."];
    l.push(left > 0 ? <><b>{left} Qs</b> left for today.</> : <>Today's target is done. <b>Great work!</b></>);
    if (rank && change && change > 0) l.push(<>Up <b>{change} ranks</b> this week.</>);
    else if (rank) l.push(<>You're <b>#{rank}</b> this week.</>);
    else l.push(<>Solve a few Qs to join <b>this week's ranks</b>.</>);
    return l;
  }, [left, rank, change]);
  const [li, setLi] = useState(0);
  useEffect(() => { const t = setInterval(() => setLi((i) => (i + 1) % lines.length), 3200); return () => clearInterval(t); }, [lines.length]);
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const name = `Dr. ${firstName}`;

  return (
    <section className="w4 rv" aria-label="Welcome">
      <img className="w4-photo" src={WELCOME_IMG} alt="" />
      <div className="w4-tint" /><div className="w4-fade" /><div className="w4-glow" />
      <span className="w4-star" style={{ left: "30%", top: 22 }} /><span className="w4-star" style={{ left: "10%", top: "58%", animationDelay: ".8s" }} /><span className="w4-star" style={{ left: "44%", top: "46%", animationDelay: "1.5s" }} />
      <div className="w4-text">
        <span className="target-pill glass">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></svg>
          NEET {targetYear} · 700+
        </span>
        <div className="hello-s" style={{ marginTop: 14 }}><span className="sun" />{greet}</div>
        <h1 className="name" aria-label={name}>
          {name.split("").map((ch, i) => <span key={i} style={{ animationDelay: `${0.25 + i * 0.05}s` }}>{ch === " " ? " " : ch}</span>)}
        </h1>
        <div className="rot" aria-live="polite">
          {lines.map((l, i) => <span key={i} className={i === li ? "on" : ""}>{l}</span>)}
        </div>
        <svg className="ecg4" width="150" height="24" viewBox="0 0 200 26" preserveAspectRatio="none" aria-hidden="true"><path d="M0 14 H62 L68 14 L72 5 L78 23 L84 1 L90 20 L94 14 H138 L143 14 L146 9 L150 19 L154 14 H200" fill="none" stroke="#22D3EE" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </div>
      <Link to="/progress" className="h3-ring glass w4-ring" aria-label={`Today's target: ${today.solved} of ${dailyGoal} questions`}>
        <svg width="58" height="58" viewBox="0 0 58 58">
          <defs><linearGradient id="nthRing" x1="0" x2="1"><stop offset="0" stopColor="#3B82F6" /><stop offset="1" stopColor="#22D3EE" /></linearGradient></defs>
          <circle cx="29" cy="29" r="24" fill="none" stroke="rgba(255,255,255,.18)" strokeWidth="5" />
          <circle cx="29" cy="29" r="24" fill="none" stroke="url(#nthRing)" strokeWidth="5" strokeLinecap="round" strokeDasharray="151" strokeDashoffset={151 - 151 * pct} style={{ animation: "nth-ring3 1.6s cubic-bezier(.2,.8,.2,1) .5s both" }} />
        </svg>
        <span className="v"><span><b><CountUp to={today.solved} /></b><small>/{dailyGoal} today</small></span></span>
      </Link>
      <div className="h3-chips w4-chips">
        <Link to="/progress" className="chip fire">{Ico.flame}{streak > 0 ? `${streak}-day streak` : "Start a streak"}</Link>
        <a href="#weekly-leaderboard" className="chip lb glass">
          {Ico.trophy("#E9D5FF")}
          {rank ? <>Weekly rank #{rank} {change ? <em>{change > 0 ? `▲${change}` : `▼${Math.abs(change)}`}</em> : null}</> : "Weekly ranks"}
        </a>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- 2 · Dr. Azka */

function AzkaStrip({ tips }: { tips: string[] }) {
  const list = tips.length ? tips : ["Take a test and I'll tell you exactly which chapter to fix first."];
  const [text, setText] = useState("");
  const idx = useRef(0);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>; let j = 0; let cancelled = false;
    const run = () => {
      const str = list[idx.current % list.length]; j = 0;
      const step = () => {
        if (cancelled) return;
        setText(str.slice(0, ++j));
        if (j < str.length) timer = setTimeout(step, 26);
        else timer = setTimeout(() => { idx.current++; run(); }, 4200);
      };
      step();
    };
    run();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [list.join("|")]);
  return (
    <Link to="/consult" className="azka rv">
      <img src={AZKA_IMG} alt="Dr. Azka" /><span className="ai">LIVE</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <small>DR. AZKA · NEET MENTOR</small>
        <div className="typing"><span>{text}</span><span className="caret" /></div>
      </div>
      <span className="btn-g">Consult →</span>
    </Link>
  );
}

/* ---------------------------------------------------------------- 3 · Banner */

type Slide = { id: string; tag: string; title: string; sub: ReactNode; cta: string; href: string; mesh: string; art: ReactNode };

function Banner({ banners, showBuiltIn, nextContest }: { banners: HomeExtras["banners"]; showBuiltIn: boolean; nextContest: HomeExtras["nextContest"] }) {
  const now = useNow();
  const contestIn = nextContest ? new Date(nextContest.startsAt).getTime() - now : -1;
  const ct = splitDuration(contestIn);
  const meshes = [
    "conic-gradient(from 0deg at 30% 40%,#1D4ED8,#7C3AED,#0EA5E9,#4338CA,#1D4ED8)",
    "conic-gradient(from 90deg at 60% 50%,#92400E,#DC2626,#F59E0B,#B45309,#92400E)",
    "conic-gradient(from 180deg at 40% 60%,#065F46,#0E7490,#10B981,#155E75,#065F46)",
    "conic-gradient(from 270deg at 50% 40%,#9F1239,#7C3AED,#DB2777,#BE123C,#9F1239)",
    "conic-gradient(from 45deg at 50% 50%,#3730A3,#6D28D9,#2563EB,#4C1D95,#3730A3)",
  ];
  const THEME_MESH: Record<string, number> = { blue: 0, amber: 1, green: 2, pink: 3, violet: 4 };
  // Slides added in the admin panel come first, then the built-in ones (unless the admin hid them).
  const custom: Slide[] = banners.map((b, i) => ({
    id: b.id, tag: b.tag, title: b.title, sub: b.subtitle, cta: b.cta, href: b.href,
    mesh: meshes[THEME_MESH[b.theme] ?? i % meshes.length],
    art: b.imageUrl ? <img className="azka-art" src={b.imageUrl} alt="" style={{ width: 140, borderRadius: 16 }} /> : <div className="ray" />,
  }));
  const builtIn: Slide[] = [
        { id: "consult", tag: "NEW · NEET MENTOR", title: "Dr. Azka Consult is live", sub: "Predicted score, 12-hour study plan and your full report.", cta: "Consult now", href: "/consult", mesh: meshes[0], art: <img className="azka-art" src={AZKA_IMG} alt="" /> },
        { id: "mocks", tag: "MOCK SERIES", title: "Target 700 Full Mocks", sub: "NTA-style CBT, 720 marks and an all-India rank after every paper.", cta: "Start a mock", href: "/mocks", mesh: meshes[1], art: <><div className="ray" /><div className="badge3d"><b>700</b><small>TARGET</small></div></> },
        { id: "neetlab", tag: "3D STUDY TOOLS", title: "See biology in 3D", sub: "Explore models and simulations in NEETLab.", cta: "Open NEETLab", href: "/neetlab", mesh: meshes[2], art: <div className="helix">{Array.from({ length: 11 }, (_, i) => <span key={i} style={{ top: i * 17 + 4, animationDelay: `${-i * 0.27}s`, background: "linear-gradient(90deg,rgba(165,243,252,.75),rgba(253,230,138,.75))" }} />)}</div> },
        { id: "contest", tag: nextContest && contestIn > 0 ? `LIVE · ${fmtTime(nextContest.startsAt)}` : "DAILY CONTESTS", title: nextContest?.title ?? "Daily Mega Contest",
          sub: nextContest && contestIn > 0
            ? <span className="mini-timer"><span><b>{pad(ct.h + ct.d * 24)}</b><small>HRS</small></span><span><b>{pad(ct.m)}</b><small>MIN</small></span><span><b>{pad(ct.s)}</b><small>SEC</small></span></span>
            : "Compete live with aspirants across India.",
          cta: "Join contest", href: "/contests", mesh: meshes[3],
          art: <svg style={{ position: "absolute", right: 4, top: 20, animation: "nth-bob 3s ease-in-out infinite" }} width="104" height="104" viewBox="0 0 24 24" fill="none" stroke="#FDE68A" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3" /></svg> },
        { id: "weekly", tag: "EVERY WEEK", title: "Weekly Leaderboard", sub: "Earn NEET marks all week and climb the all-India board.", cta: "See rankings", href: "#weekly-leaderboard", mesh: meshes[4],
          art: <div className="podium"><svg className="c" width="26" height="22" viewBox="0 0 24 20" fill="#FDE68A"><path d="M2 18h20L19 6l-5 4-2-7-2 7-5-4z" /></svg><i style={{ height: 46, animationDelay: ".2s" }} /><i style={{ height: 74, background: "linear-gradient(180deg,#FDE68A,rgba(251,191,36,.25))" }} /><i style={{ height: 34, animationDelay: ".35s" }} /></div> },
      ];
  const slides: Slide[] = custom.length && !showBuiltIn ? custom : [...custom, ...builtIn];

  const [cur, setCur] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const [slideW, setSlideW] = useState(0);
  useEffect(() => {
    const measure = () => { const el = trackRef.current?.firstElementChild as HTMLElement | null; if (el) setSlideW(el.getBoundingClientRect().width + 10); };
    measure(); window.addEventListener("resize", measure); return () => window.removeEventListener("resize", measure);
  }, [slides.length]);
  useEffect(() => { const t = setTimeout(() => setCur((c) => (c + 1) % slides.length), 5500); return () => clearTimeout(t); }, [cur, slides.length]);
  const sx = useRef<number | null>(null);

  return (
    <section className="banner rv" aria-label="What's new on NEET Track">
      <div className="viewport">
        <div className="track" ref={trackRef} style={{ transform: `translateX(${-cur * slideW}px)` }}
          onTouchStart={(e) => { sx.current = e.touches[0].clientX; }}
          onTouchEnd={(e) => { if (sx.current === null) return; const dx = e.changedTouches[0].clientX - sx.current; if (Math.abs(dx) > 40) setCur((c) => (c + (dx < 0 ? 1 : -1) + slides.length) % slides.length); sx.current = null; }}>
          {slides.map((s, i) => {
            const inner = (
              <>
                <div className="mesh" style={{ background: s.mesh }} /><div className="noise" /><div className="glare" /><div className="edge" />
                <div className="s-copy">
                  <span className="tag"><i />{s.tag}</span>
                  <div className="s-title">{s.title}</div>
                  <div className="s-sub">{s.sub}</div>
                  <span className="s-cta">{s.cta}<span>→</span></span>
                </div>
                <div className="s-art">{s.art}</div>
              </>
            );
            const cls = `slide${i === cur ? " on" : ""}`;
            return s.href.startsWith("/")
              ? <Link key={s.id} to={s.href as never} className={cls}>{inner}</Link>
              : <a key={s.id} href={s.href} className={cls}>{inner}</a>;
          })}
        </div>
      </div>
      <div className="dots">
        {slides.map((s, i) => (
          <button key={s.id} type="button" aria-label={`Show ${s.title}`} className={i === cur ? "on" : ""} onClick={() => setCur(i)}>
            {i === cur && <i key={cur} />}
          </button>
        ))}
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- 4 · Quick practice */

function QuickPractice({ counts, snapshot }: { counts: { physics: number; chemistry: number; biology: number }; snapshot?: Snap }) {
  const sec = (k: SectionKey) => snapshot?.sections.find((s) => s.key === k);
  const weakest = (k: SectionKey) => [...(snapshot?.weaknesses ?? []), ...(snapshot?.watchlist ?? [])].find((c) => c.section === k);
  const strongest = (k: SectionKey) => snapshot?.strengths.find((c) => c.section === k);
  const line = (k: SectionKey) => {
    const s = sec(k);
    if (!s || s.accuracy === null) return "Not started yet · your first set unlocks your mastery";
    const w = weakest(k), st = strongest(k);
    return `${s.accuracy}% mastery${w ? ` · weakest: ${w.name}` : st ? ` · strongest: ${st.name}` : ""}`;
  };
  const cards = [
    { k: "Physics" as SectionKey, label: "PHYSICS · 180 MARKS", n: counts.physics, cls: { background: "linear-gradient(120deg,#0E1E4A,#0A1430 70%)", borderColor: "rgba(96,165,250,.4)", color: "#EAF2FF" }, lc: "#93C5FD", bar: "linear-gradient(90deg,#3B82F6,#93C5FD)",
      art: <><div className="atom"><div className="ell w1"><div className="o" /></div><div className="ell w2"><div className="o" /></div><div className="ell w3"><div className="o" /></div><div className="core" /></div>
        <div className="wave"><svg viewBox="0 0 240 24" height="24" preserveAspectRatio="none"><path d="M0 12 Q15 0 30 12 T60 12 T90 12 T120 12 T150 12 T180 12 T210 12 T240 12" fill="none" stroke="#60A5FA" strokeWidth="2" opacity=".7" /></svg></div></> },
    { k: "Chemistry" as SectionKey, label: "CHEMISTRY · 180 MARKS", n: counts.chemistry, cls: { background: "linear-gradient(120deg,#063A31,#06201B 70%)", borderColor: "rgba(16,185,129,.4)", color: "#E7FFF6" }, lc: "#6EE7B7", bar: "linear-gradient(90deg,#10B981,#6EE7B7)",
      art: <><svg className="hexa" width="40" height="40" viewBox="0 0 40 40" fill="none" stroke="#6EE7B7" strokeWidth="1.6"><path d="M20 4 34 12v16l-14 8-14-8V12z" /><circle cx="20" cy="4" r="2.5" fill="#6EE7B7" /><circle cx="34" cy="28" r="2.5" fill="#6EE7B7" /><circle cx="6" cy="28" r="2.5" fill="#6EE7B7" /></svg>
        <div className="flask"><svg width="84" height="104" viewBox="0 0 84 104"><defs><clipPath id="nthFlask"><path d="M32 4h20v30l26 56a8 8 0 0 1-7 12H13a8 8 0 0 1-7-12l26-56z" /></clipPath></defs>
          <g clipPath="url(#nthFlask)" className="liq"><path d="M-20 62 Q0 54 20 62 T60 62 T100 62 T140 62 V110 H-20z" fill="#10B981" opacity=".75" /></g>
          <path d="M32 4h20v30l26 56a8 8 0 0 1-7 12H13a8 8 0 0 1-7-12l26-56z" fill="none" stroke="#A7F3D0" strokeWidth="2.5" /><path d="M28 4h28" stroke="#A7F3D0" strokeWidth="3" strokeLinecap="round" /></svg>
          <span className="bub2" style={{ left: 30 }} /><span className="bub2" style={{ left: 46, animationDelay: ".8s", width: 5, height: 5 }} /><span className="bub2" style={{ left: 38, animationDelay: "1.6s" }} /></div></> },
    { k: "Biology" as SectionKey, label: "BIOLOGY · 360 MARKS", n: counts.biology, cls: { background: "linear-gradient(120deg,#33114F,#1B0B30 70%)", borderColor: "rgba(192,132,252,.4)", color: "#F7EEFF" }, lc: "#D8B4FE", bar: "linear-gradient(90deg,#A855F7,#E9D5FF)",
      art: <><div className="dna">{Array.from({ length: 9 }, (_, i) => <span key={i} style={{ top: i * 15 + 4, animationDelay: `${-i * 0.3}s` }} />)}</div><div className="cell" /></> },
  ];
  return (
    <section className="rv" aria-label="Quick practice">
      <SecHead icon={Ico.bolt} iconBg="rgba(250,204,21,.12)" title="Quick Practice" right={<Link to="/generate" style={{ color: "#5EEAD4" }}>Question bank →</Link>} />
      <div className="qp-line">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="#FBBF24" style={{ flexShrink: 0, animation: "nth-bob 2.4s ease-in-out infinite" }}><path d="M12 2l2.4 7.2H22l-6 4.6 2.3 7.2L12 16.6 5.7 21l2.3-7.2-6-4.6h7.6z" /></svg>
        <span>The best NEET questions you'll ever practise. <b>Solve them if you're aiming for 700+.</b></span>
      </div>
      <div className="subs">
        {cards.map((c) => {
          const acc = sec(c.k)?.accuracy ?? 0;
          return (
            <Link key={c.k} to="/subjects/$subject" params={{ subject: c.k }} className="sx" style={c.cls}>
              <span className="grid" />
              <div className="info">
                <span className="lbl" style={{ color: c.lc }}>{c.label}</span>
                <h3>{c.k}</h3>
                <span className="meta">{c.n.toLocaleString("en-IN")} MCQs</span>
                <span className="mbar"><i style={{ width: `${acc}%`, background: c.bar }} /></span>
                <span className="mrow">{line(c.k)}</span>
                <span className="go2" style={{ marginTop: 12 }}>Practise {Ico.arrow}</span>
              </div>
              <div className="art">{c.art}</div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- 5 · Improvement zone */

type Snap = ConsultData["snapshot"];
type Pred = ConsultData["prediction"];

function Improvement({ snapshot, prediction, wrongThisWeek, bookmarks }: { snapshot?: Snap; prediction?: Pred; wrongThisWeek: number; bookmarks: number }) {
  const mistakes = snapshot?.mistakes.total ?? 0;
  const last7 = snapshot?.mistakes.last7 ?? 0;
  const weak = snapshot?.weaknesses.length ?? 0;
  const recover = prediction?.ready ? prediction.levers.reduce((t, l) => t + l.gain, 0) : 0;
  return (
    <section className="panel imp rv" aria-label="Improvement zone">
      <SecHead icon={Ico.trend} iconBg="rgba(16,185,129,.16)" title="Improvement Zone" right={<Link to="/analytics" style={{ color: "#34D399" }}>Analytics →</Link>} />
      <p className="lead">Turn mistakes into marks. Every wrong answer you fix here is a mark you won't lose in NEET.</p>
      {recover > 0 ? (
        <div className="recover">
          <div className="big">+<CountUp to={recover} /></div>
          <div><h4>Marks you can recover</h4><p>by fixing your mistakes and {weak || "your"} weakest chapter{weak === 1 ? "" : "s"}</p></div>
        </div>
      ) : (
        <div className="recover">
          <div className="big"><CountUp to={mistakes} /></div>
          <div><h4>Questions in your Mistake Book</h4><p>Re-solve them to stop losing the same marks twice</p></div>
        </div>
      )}
      <div className="flow">
        <Link to="/mistakes" className="fs" style={{ background: "linear-gradient(160deg,#3B0D1A,#1C0910)", borderColor: "rgba(244,63,94,.4)", color: "#FFE4EA" }}>
          <span className="n" style={{ background: "#FB7185" }}>1</span><b>Review</b><small>Wrong answers saved in your Mistake Book</small>
          <span className="num" style={{ color: "#FB7185" }}><CountUp to={mistakes} /></span></Link>
        <Link to="/mistakes" className="fs" style={{ background: "linear-gradient(160deg,#3A2406,#1C1306)", borderColor: "rgba(245,158,11,.4)", color: "#FFF4DB" }}>
          <span className="n" style={{ background: "#FBBF24" }}>2</span><b>Re-solve</b><small>Answer them again without hints</small>
          <span className="num" style={{ color: "#FBBF24" }}>{last7}<span style={{ fontSize: 12, opacity: 0.75 }}> new</span></span></Link>
        <Link to="/analytics" className="fs" style={{ background: "linear-gradient(160deg,#06302E,#071A1C)", borderColor: "rgba(20,184,166,.4)", color: "#E6FFFB" }}>
          <span className="n" style={{ background: "#5EEAD4" }}>3</span><b>Track</b><small>Watch weak chapters turn green</small>
          <span className="num" style={{ color: "#5EEAD4" }}>{weak}<span style={{ fontSize: 12, opacity: 0.75 }}> weak</span></span></Link>
        <span className="arrow" style={{ left: "calc(33.3% - 8px)" }} /><span className="arrow" style={{ left: "calc(66.6% - 8px)" }} />
      </div>
      <div className="neg">
        <span className="nv">−{wrongThisWeek}</span>
        <span style={{ flex: 1 }}>Marks lost to wrong answers this week<small>Skip when you can't rule out two options.</small></span>
        <Link to="/bookmarks" style={{ font: "600 12px var(--display)", color: "#FDA4AF", whiteSpace: "nowrap" }}>Bookmarks · {bookmarks}</Link>
      </div>
      <Link to="/mistakes" className="btn-fix">{Ico.redo}Start fixing · 10 minutes</Link>
    </section>
  );
}

/* ---------------------------------------------------------------- 6 · Weekly leaderboard */

const AV = ["#475569", "#78350F", "#7C2D12", "#1E3A8A", "#065F46"];
const initials = (n: string) => n.split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase();

function Leaderboard({ weekly, loading }: { weekly?: HomeExtras["weekly"]; loading: boolean }) {
  const now = useNow(60_000);
  const left = weekly ? splitDuration(new Date(weekly.endsAt).getTime() - now) : null;
  const top = weekly?.top ?? [];
  const me = weekly?.me;
  const order = [top[1], top[0], top[2]];
  const podium = [
    { h: 62, bg: "linear-gradient(180deg,#334155,#1E293B)", c: "#E2E8F0", ring: "#CBD5E1", size: 52, delay: ".2s" },
    { h: 86, bg: "linear-gradient(180deg,#B45309,#78350F)", c: "#FEF3C7", ring: "#FBBF24", size: 62, delay: "0s" },
    { h: 48, bg: "linear-gradient(180deg,#9A3412,#431407)", c: "#FFEDD5", ring: "#FB923C", size: 52, delay: ".35s" },
  ];
  return (
    <section className="panel lbp rv" id="weekly-leaderboard" aria-label="Weekly leaderboard">
      <SecHead icon={Ico.trophy("#C4B5FD")} iconBg="rgba(139,92,246,.18)" title="Weekly Leaderboard"
        right={left ? <span className="note" style={{ color: "#C4B5FD" }}>Ends in {left.d}d {left.h}h</span> : undefined} />
      <p className="lead" style={{ marginTop: -4 }}>Points are the NEET marks you earn this week (+4 right, −1 wrong).</p>
      {loading ? <div className="nth-empty">Loading this week's ranks…</div> : top.length === 0 ? (
        <div className="nth-empty">No one has scored this week yet. Solve a set now and take the #1 spot.</div>
      ) : (
        <>
          <div className="pod">
            {order.map((r, i) => r ? (
              <div key={r.id}>
                <div className="av" style={{ width: podium[i].size, height: podium[i].size, background: AV[i], border: `${i === 1 ? 3 : 2}px solid ${podium[i].ring}`, boxShadow: i === 1 ? "0 0 24px rgba(251,191,36,.45)" : undefined }}>
                  {i === 1 && <svg className="cr" width="22" height="18" viewBox="0 0 24 20" fill="#FBBF24"><path d="M2 18h20L19 6l-5 4-2-7-2 7-5-4z" /></svg>}
                  {initials(r.name)}
                </div>
                <div className="nm">{r.name}</div><div className="xp">{r.points.toLocaleString("en-IN")} pts</div>
                <div className="blk" style={{ height: podium[i].h, background: podium[i].bg, color: podium[i].c, animationDelay: podium[i].delay }}>{i === 1 ? 1 : i === 0 ? 2 : 3}</div>
              </div>
            ) : <div key={`e${i}`} />)}
          </div>
          <div className="lb-list">
            {top.slice(3, 5).map((r, i) => (
              <div key={r.id} className="lb-row"><span className="r">{i + 4}</span><span className="a" style={{ background: AV[(i + 3) % AV.length] }}>{initials(r.name)}</span><span className="n">{r.name}</span><span className="x">{r.points.toLocaleString("en-IN")} pts</span></div>
            ))}
            {me && me.rank && (
              <div className="lb-row me"><span className="r" style={{ color: "#93C5FD" }}>{me.rank}</span><span className="a" style={{ background: "linear-gradient(135deg,#2563EB,#22D3EE)" }}>YOU</span>
                <span className="n">You {me.change ? <span className="up" style={{ color: me.change > 0 ? "#4ADE80" : "#FB7185" }}>{me.change > 0 ? `▲${me.change}` : `▼${Math.abs(me.change)}`}</span> : null}</span>
                <span className="x" style={{ color: "#BFDBFE" }}>{me.points.toLocaleString("en-IN")} pts</span></div>
            )}
          </div>
        </>
      )}
      <div className="lb-foot">
        <span>{me?.gapToNext ? <><b>{me.gapToNext} pts</b> more to move up a rank</> : me?.rank === 1 ? <b>You're #1 this week</b> : <>Solve questions to <b>climb</b></>}</span>
        <Link to="/leaderboard" style={{ color: "#C4B5FD", fontWeight: 700 }}>All-time board →</Link>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- 7 · Exam simulation */

function ExamSimulation({ mocksTaken, lastMock }: { mocksTaken: number; lastMock: Snap["mocks"]["last"] | null }) {
  const filled = Math.min(10, mocksTaken);
  return (
    <section className="rv" aria-label="Exam simulation">
      <SecHead icon={Ico.trophy("#FBBF24")} iconBg="rgba(245,158,11,.14)" title="Exam Simulation"
        right={<span className="note" style={{ font: "700 10.5px var(--display)", padding: "4px 8px", borderRadius: 8, color: "#FBBF24", background: "rgba(245,158,11,.12)", border: "1px solid rgba(245,158,11,.35)" }}>NTA PATTERN</span>} />
      <div className="t7">
        <div className="ray" /><div className="big7">700</div><div className="shine" />
        <span className="tag" style={{ position: "relative", background: "rgba(0,0,0,.25)", borderColor: "rgba(251,191,36,.45)", color: "#FDE68A" }}><i style={{ background: "#FBBF24" }} />MOCK SERIES</span>
        <h3>Target 700 Full Mocks</h3>
        <div className="chips7"><span>180 Qs</span><span>3 hours</span><span>NTA CBT screen</span><span>All-India rank</span></div>
        <div className="prog">
          <div className="row7"><span>Mocks taken: <b>{mocksTaken}</b></span><span>{lastMock ? <>Last score <b>{lastMock.score}</b>/{lastMock.outOf}</> : "No mock yet"}</span></div>
          <div className="dots7" style={{ gridTemplateColumns: "repeat(10,minmax(0,1fr))" }}>
            {Array.from({ length: 10 }, (_, i) => <i key={i} className={i < filled ? "d" : ""} style={i < filled ? { animationDelay: `${0.3 + i * 0.12}s` } : undefined} />)}
          </div>
        </div>
        <Link to="/mocks" className="btn-gold">{Ico.play}{mocksTaken ? `Start mock ${mocksTaken + 1}` : "Start your first mock"}</Link>
      </div>
      <div className="ex" style={{ marginTop: 10 }}>
        <Link to="/pyqs" className="exc" style={{ minHeight: 140, background: "linear-gradient(160deg,#10204E,#0A1330)", borderColor: "rgba(96,165,250,.4)", color: "#E8F0FF" }}>
          <div className="years"><span style={{ animationDelay: ".2s" }}>2025</span><span style={{ animationDelay: ".4s" }}>2024</span><span style={{ animationDelay: ".6s" }}>…2010</span></div>
          <span className="pill" style={{ background: "rgba(96,165,250,.2)", color: "#BFDBFE" }}>PAST PAPERS</span><h4>NEET PYQs</h4><p>Chapter &amp; year-wise</p></Link>
        <Link to="/mocks" className="exc" style={{ minHeight: 140, background: "linear-gradient(160deg,#2B1A46,#150D26)", borderColor: "rgba(167,139,250,.4)", color: "#F3EEFF" }}>
          <svg className="trophy" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#C4B5FD" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M9 3h6v4H9zM7 5H5v16h14V5h-2M9 12h6M9 16h4" /></svg>
          <span className="pill" style={{ background: "rgba(167,139,250,.2)", color: "#DDD6FE" }}>720 MARKS</span><h4>Full Mocks</h4><p>CBT mode · All-India rank</p></Link>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- 9 · Tools */

function Tools() {
  return (
    <section className="panel rv" aria-label="High-yield tools">
      <SecHead icon={Ico.layers} iconBg="rgba(139,92,246,.16)" title="High-Yield Tools" right={<Link to="/flashcards" style={{ color: "#C4B5FD" }}>Flashcards →</Link>} />
      <p className="lead">Revise faster with tools built around the NCERT.</p>
      <div className="tools3">
        <Link to="/flashcards" className="tl" style={{ background: "linear-gradient(160deg,#2E1065,#160A33)", borderColor: "rgba(167,139,250,.4)", color: "#F3EEFF" }}>
          <span className="glowc" style={{ background: "#8B5CF6" }} /><span className="art"><span className="fan"><span /><span /><span /></span></span>
          <b>Flashcards</b><small>Spaced recall that sticks</small><span className="pill2" style={{ color: "#DDD6FE" }}>Revise fast</span></Link>
        <Link to="/short-notes" className="tl" style={{ background: "linear-gradient(160deg,#3B3205,#1C1806)", borderColor: "rgba(250,204,21,.38)", color: "#FFFBE6" }}>
          <span className="glowc" style={{ background: "#FACC15" }} /><span className="art"><span className="hl"><i /><i className="m" /><i style={{ width: "70%" }} /><i className="m" style={{ width: "85%" }} /></span></span>
          <b>Short Notes</b><small>NCERT notes with diagrams</small><span className="pill2" style={{ color: "#FDE68A" }}>New · Biology</span></Link>
        <Link to="/neetlab" className="tl" style={{ background: "linear-gradient(160deg,#083344,#061A26)", borderColor: "rgba(34,211,238,.4)", color: "#E6FBFF" }}>
          <span className="glowc" style={{ background: "#22D3EE" }} /><span className="art"><span className="scene"><span className="cube"><i /><i /><i /><i /><i /><i /></span></span></span>
          <b>3D Models</b><small>Models and simulations</small><span className="pill2" style={{ color: "#A5F3FC" }}>NEETLab</span></Link>
        <Link to="/community" className="tl" style={{ background: "linear-gradient(160deg,#4A0D2E,#200A18)", borderColor: "rgba(236,72,153,.4)", color: "#FFEAF5" }}>
          <span className="glowc" style={{ background: "#EC4899" }} /><span className="art"><span className="bub"><span>Doubt?</span><span>Solved!</span></span></span>
          <b>Community</b><small>Ask doubts, help others</small><span className="pill2" style={{ color: "#FBCFE8" }}>Ask &amp; answer</span></Link>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- 10 · Contest */

function Contest({ contest, loading }: { contest: HomeExtras["nextContest"]; loading: boolean }) {
  const now = useNow();
  if (loading) return null;
  if (!contest) {
    return (
      <section className="mc rv" aria-label="Daily mega contest">
        <span className="live"><i />DAILY MEGA CONTEST</span>
        <h3>No contest scheduled right now</h3>
        <p style={{ margin: "6px 0 0", fontSize: 13, color: "#FDA4AF" }}>New contests are announced here. Meanwhile, see past results and rankings.</p>
        <div className="mc-foot"><Link to="/contests" className="btn-red">View contests →</Link></div>
      </section>
    );
  }
  const start = new Date(contest.startsAt).getTime(), end = new Date(contest.endsAt).getTime();
  const live = now >= start && now < end;
  const t = splitDuration((live ? end : start) - now);
  const stage = live ? 2 : 1;
  return (
    <section className="mc rv" aria-label="Daily mega contest">
      <span className="live"><i />{live ? "LIVE NOW" : `DAILY MEGA CONTEST · ${fmtTime(contest.startsAt)}`}</span>
      <h3>{contest.title}</h3>
      <div className="tonight">
        <span className="sb">{Ico.trophy("#E9D5FF")}</span>
        <span style={{ flex: 1, minWidth: 0 }}><b>{contest.totalQuestions} Qs · {contest.durationMin} min</b><small>Same paper for everyone, all-India ranks</small></span>
      </div>
      <div style={{ marginTop: 10, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <span style={{ font: "600 12px var(--display)", color: "#FDA4AF" }}>{live ? "Ends in" : "Goes live in"}</span>
        <span className="timer"><span><b>{pad(t.h + t.d * 24)}</b><small>HRS</small></span><span><b>{pad(t.m)}</b><small>MIN</small></span><span><b>{pad(t.s)}</b><small>SEC</small></span></span>
      </div>
      <div className="tl3">
        <div className={stage === 1 ? "now" : ""}><i>1</i><b>Register</b>now</div>
        <div className={stage === 2 ? "now" : ""}><i>2</i><b>Live</b>{fmtTime(contest.startsAt)}–{fmtTime(contest.endsAt)}</div>
        <div><i>3</i><b>Results</b>after {fmtTime(contest.endsAt)}</div>
      </div>
      <div className="mc-foot">
        <Link to="/contest/$contestId" params={{ contestId: contest.id }} className="btn-red">{live ? "Enter now →" : "Register →"}</Link>
        <Link to="/contests" style={{ font: "600 12.5px var(--display)", color: "#FDA4AF", whiteSpace: "nowrap" }}>All contests</Link>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- 11 · Mentorship */

function Mentorship() {
  return (
    <section className="mt rv" aria-label="1-on-1 mentorship">
      <div className="mt-head">
        <div className="mt-av">DR<span className="vf"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round"><path d="m5 12 5 5L20 7" /></svg></span></div>
        <div style={{ flex: 1, minWidth: 0 }}><span className="wa" style={{ marginBottom: 4 }}>{Ico.wa}1-ON-1 ON WHATSAPP</span><h3>A personal mentor, one message away</h3></div>
      </div>
      <div className="chat" aria-label="Example conversation">
        <div className="msg me">Sir, I keep getting Rotational Motion wrong<time>9:41 PM ✓✓</time></div>
        <div className="msg them">Send me your last 5 mistakes. We'll fix the concept tonight.<time>9:42 PM</time></div>
        <div className="msg them">Then do 20 Qs from today's DPP. I'll check them.<time>9:42 PM</time></div>
        <div className="typing3"><i /><i /><i /></div>
      </div>
      <ul className="perks">
        <li>{Ico.check}Doubts cleared daily on WhatsApp</li>
        <li>{Ico.check}Strategy built on your weak chapters</li>
        <li>{Ico.check}Weekly progress review</li>
        <li>{Ico.check}Mock analysis with your mentor</li>
      </ul>
      <Link to="/mentorship" className="btn-wa">{Ico.wa}Get my mentor</Link>
    </section>
  );
}
