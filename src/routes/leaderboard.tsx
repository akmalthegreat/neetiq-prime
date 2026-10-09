// Weekly leaderboard: NEET marks earned this week (+4 / −1). Resets every Monday 12:00 AM IST.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ChevronLeft, Crown, Flame, Info, Trophy, TrendingUp, Zap } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { DrAzkaLoader } from "@/components/dr-akza-loader";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { getWeeklyLeaderboard, getStreakLeaderboard, getLeaderboardData } from "@/lib/leaderboard.functions";

export const Route = createFileRoute("/leaderboard")({
  head: () => ({ meta: [{ title: "Weekly Leaderboard — NEET Track" }, { name: "description", content: "All-India weekly NEET leaderboard. Earn NEET marks all week, climb the ranks, resets every Monday." }] }),
  component: LeaderboardPage,
});

type Weekly = Awaited<ReturnType<typeof getWeeklyLeaderboard>>;
type StreakRow = { id: string; full_name: string | null; streak: number };
type XpRow = { id: string; full_name: string | null; xp_total: number };

const initials = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0]?.toUpperCase()).join("") || "A";
const shortName = (n: string) => { const p = n.trim().split(/\s+/); return p.length > 1 ? `${p[0]} ${p[p.length - 1][0]}.` : p[0]; };
const AV = ["#F59E0B", "#3B82F6", "#10B981", "#EC4899", "#8B5CF6", "#06B6D4", "#EF4444", "#84CC16"];
const avColor = (id: string) => AV[[...id].reduce((t, c) => t + c.charCodeAt(0), 0) % AV.length];

function useCountdown(endIso?: string) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(t); }, []);
  const ms = Math.max(0, (endIso ? new Date(endIso).getTime() : 0) - now);
  return { d: Math.floor(ms / 86400000), h: Math.floor(ms / 3600000) % 24, m: Math.floor(ms / 60000) % 60, s: Math.floor(ms / 1000) % 60 };
}
const pad = (n: number) => String(n).padStart(2, "0");

function LeaderboardPage() {
  const { user } = useAuth();
  const loadWeek = useServerFn(getWeeklyLeaderboard);
  const loadStreak = useServerFn(getStreakLeaderboard);
  const loadXp = useServerFn(getLeaderboardData);
  const [tab, setTab] = useState<"week" | "streak" | "xp">("week");
  const [week, setWeek] = useState<Weekly | null>(null);
  const [streak, setStreak] = useState<{ rows: StreakRow[]; myStreak: number; myRank: number | null } | null>(null);
  const [xp, setXp] = useState<{ rows: XpRow[]; myRank: number | null } | null>(null);
  const [info, setInfo] = useState(false);

  useEffect(() => { if (user) loadWeek().then(setWeek).catch(() => setWeek(null)); }, [user, loadWeek]);
  useEffect(() => { if (user && tab === "streak" && !streak) loadStreak().then((d) => setStreak(d as never)); }, [user, tab, streak, loadStreak]);
  useEffect(() => { if (user && tab === "xp" && !xp) loadXp().then((d) => setXp(d as never)); }, [user, tab, xp, loadXp]);

  const cd = useCountdown(week?.endsAt);
  const range = useMemo(() => {
    if (!week) return "";
    const s = new Date(week.weekStart), e = new Date(new Date(week.endsAt).getTime() - 1);
    const f = (d: Date) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });
    return `${f(s)} – ${f(e)}`;
  }, [week]);

  const top3 = week?.top.slice(0, 3) ?? [];
  const rest = week?.top.slice(3) ?? [];
  const me = week?.me;
  const moved = me?.rank && me.lastWeekRank ? me.lastWeekRank - me.rank : null;

  return (
    <PageShell>
      <style>{LB_CSS}</style>
      <div className="-mt-2 mb-3 flex items-center justify-between">
        <button type="button" onClick={() => history.back()} className="inline-flex items-center gap-1.5 text-sm font-semibold hover:text-primary"><ChevronLeft className="h-5 w-5" />Back</button>
        <button type="button" onClick={() => setInfo((v) => !v)} aria-label="How points work" className="grid h-9 w-9 place-items-center rounded-full border bg-card"><Info className="h-4 w-4" /></button>
      </div>
      {info && (
        <div className="lb-info">
          <b>How it works</b>
          <p>Points are the NEET marks you earn this week across practice, tests, DPPs and quizzes: <b>+4</b> for a correct answer, <b>−1</b> for a wrong one. The board resets every <b>Monday at 12:00 AM IST</b>. Skip what you can't solve; wrong guesses cost points, just like NEET.</p>
        </div>
      )}

      {/* Hero */}
      <section className="lb-hero">
        <div className="lb-hero-bg" />
        <div className="lb-trophy" aria-hidden="true"><Trophy className="h-9 w-9" /><i /><i /><i /></div>
        <div className="relative">
          <span className="lb-eyebrow"><span />ALL-INDIA · WEEKLY</span>
          <h1 className="mt-1.5 text-[28px] font-extrabold leading-tight text-white sm:text-4xl">Weekly <span className="lb-grad">Leaderboard</span></h1>
          <p className="mt-1 text-sm text-slate-300">{range ? `Week of ${range}` : "This week"}{week ? ` · ${week.participants.toLocaleString("en-IN")} aspirants competing` : ""}</p>
          <div className="lb-cd" aria-label="Time left this week">
            {[["DAYS", cd.d], ["HRS", cd.h], ["MIN", cd.m], ["SEC", cd.s]].map(([l, v]) => (
              <span key={l as string}><b>{pad(v as number)}</b><small>{l}</small></span>
            ))}
            <em>until reset</em>
          </div>
        </div>
      </section>

      {/* My standing */}
      {week && (
        <section className="lb-me">
          <div className="lb-me-rank"><small>YOUR RANK</small><b>{me?.rank ? `#${me.rank}` : "—"}</b>
            {moved !== null && moved !== 0 && <span className={moved > 0 ? "up" : "down"}>{moved > 0 ? `▲ ${moved}` : `▼ ${-moved}`} vs last week</span>}
          </div>
          <div className="lb-me-grid">
            <span><b>{me?.points ?? 0}</b><small>points</small></span>
            <span><b>{me?.questions ?? 0}</b><small>questions</small></span>
            <span><b>{me?.accuracy ?? "—"}{me?.accuracy != null ? "%" : ""}</b><small>accuracy</small></span>
          </div>
          <div className="lb-me-msg">
            <Zap className="h-4 w-4 shrink-0" />
            {!me?.rank ? <span>Solve your first question this week to enter the board.</span>
              : me.rank === 1 ? <span>You're #1 in India this week. Keep the crown!</span>
              : <span>Just <b>{me.gapToNext}</b> more points to overtake <b>#{me.rank - 1}</b>. That's about {Math.ceil((me.gapToNext ?? 0) / 4)} correct answers.</span>}
          </div>
          <Link to="/dashboard" className="lb-cta">Earn points now →</Link>
        </section>
      )}

      {/* Tabs */}
      <div className="lb-tabs" role="tablist">
        {([["week", "This week", Trophy], ["streak", "Streak", Flame], ["xp", "All-time XP", TrendingUp]] as const).map(([k, l, Ic]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={cn(tab === k && "on")}><Ic className="h-4 w-4" />{l}</button>
        ))}
      </div>

      {tab === "week" && (week === null ? <DrAzkaLoader size="sm" message="Loading this week's ranks" className="py-10" /> : week.top.length === 0 ? (
        <div className="lb-empty">No one has scored this week yet. Solve a set now and take the #1 spot.</div>
      ) : (
        <>
          {/* Podium */}
          <div className="lb-podium">
            {[1, 0, 2].map((i) => {
              const r = top3[i]; if (!r) return <div key={i} />;
              const place = i + 1;
              return (
                <div key={r.id} className={cn("lb-pod", `p${place}`, r.id === user?.id && "me")} style={{ animationDelay: `${[0.25, 0, 0.45][i]}s` }}>
                  {place === 1 && <Crown className="lb-crown h-7 w-7" />}
                  <span className="lb-av" style={{ background: avColor(r.id) }}>{initials(r.name)}</span>
                  <b className="lb-name">{shortName(r.name)}</b>
                  <span className="lb-pts">{r.points.toLocaleString("en-IN")} pts</span>
                  <div className="lb-block"><span>{place}</span></div>
                </div>
              );
            })}
          </div>
          {/* List */}
          <ol className="lb-list">
            {rest.map((r, i) => {
              const rank = i + 4, mine = r.id === user?.id;
              const pct = top3[0] ? Math.max(4, Math.round((r.points / top3[0].points) * 100)) : 0;
              return (
                <li key={r.id} className={cn("lb-row", mine && "me")} style={{ animationDelay: `${Math.min(i, 15) * 35}ms` }}>
                  <span className="lb-rk">{rank}</span>
                  <span className="lb-av sm" style={{ background: avColor(r.id) }}>{initials(r.name)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold">{mine ? "You" : shortName(r.name)}</span>
                    <span className="lb-bar"><i style={{ width: `${pct}%` }} /></span>
                  </span>
                  <span className="text-right"><b className="block text-sm">{r.points.toLocaleString("en-IN")}</b><small className="text-[10.5px] text-muted-foreground">{r.questions} Qs</small></span>
                </li>
              );
            })}
          </ol>
          {me?.rank && me.rank > week.top.length && (
            <div className="lb-row me mt-2"><span className="lb-rk">{me.rank}</span><span className="lb-av sm" style={{ background: avColor(user!.id) }}>You</span><span className="flex-1 text-sm font-bold">You</span><b className="text-sm">{me.points}</b></div>
          )}
          {week.lastWeekChampions.length > 0 && (
            <section className="lb-champs">
              <div className="lb-champs-h"><Crown className="h-4 w-4" />LAST WEEK'S CHAMPIONS</div>
              <div className="flex flex-wrap gap-2">
                {week.lastWeekChampions.map((c, i) => <span key={c.id} className="lb-chip"><em>{["🥇", "🥈", "🥉"][i]}</em>{shortName(c.name)} · {c.points}</span>)}
              </div>
            </section>
          )}
        </>
      ))}

      {tab === "streak" && (streak === null ? <DrAzkaLoader size="sm" message="Loading streaks" className="py-10" /> : (
        <>
          <div className="lb-note"><Flame className="h-4 w-4 text-orange-500" />Your streak: <b>{streak.myStreak} days</b>{streak.myRank ? ` · rank #${streak.myRank}` : ""}. Practise every day to keep it alive.</div>
          <ol className="lb-list">
            {streak.rows.map((r, i) => (
              <li key={r.id} className={cn("lb-row", r.id === user?.id && "me")} style={{ animationDelay: `${Math.min(i, 15) * 35}ms` }}>
                <span className={cn("lb-rk", i < 3 && "top")}>{i + 1}</span>
                <span className="lb-av sm" style={{ background: avColor(r.id) }}>{initials(r.full_name ?? "A")}</span>
                <span className="flex-1 truncate text-sm font-bold">{r.id === user?.id ? "You" : shortName(r.full_name ?? "Aspirant")}</span>
                <span className="lb-flame"><Flame className="h-4 w-4" />{r.streak} days</span>
              </li>
            ))}
          </ol>
        </>
      ))}

      {tab === "xp" && (xp === null ? <DrAzkaLoader size="sm" message="Loading all-time XP" className="py-10" /> : (
        <>
          <div className="lb-note"><TrendingUp className="h-4 w-4 text-sky-500" />All-time XP never resets.{xp.myRank ? ` Your rank: #${xp.myRank}.` : ""}</div>
          <ol className="lb-list">
            {xp.rows.map((r, i) => (
              <li key={r.id} className={cn("lb-row", r.id === user?.id && "me")} style={{ animationDelay: `${Math.min(i, 15) * 35}ms` }}>
                <span className={cn("lb-rk", i < 3 && "top")}>{i + 1}</span>
                <span className="lb-av sm" style={{ background: avColor(r.id) }}>{initials(r.full_name ?? "A")}</span>
                <span className="flex-1 truncate text-sm font-bold">{r.id === user?.id ? "You" : shortName(r.full_name ?? "Aspirant")}</span>
                <b className="text-sm">{(r.xp_total ?? 0).toLocaleString("en-IN")} XP</b>
              </li>
            ))}
          </ol>
        </>
      ))}
    </PageShell>
  );
}

const LB_CSS = `
.lb-info{margin-bottom:12px;border-radius:18px;padding:14px;border:1px solid var(--border);background:var(--card);font-size:13.5px;line-height:1.55}
.lb-info p{margin:4px 0 0;color:var(--muted-foreground)}
.lb-hero{position:relative;overflow:hidden;border-radius:28px;padding:22px 20px;background:#0B0820;border:1px solid rgba(250,204,21,.25);box-shadow:0 30px 60px -36px rgba(234,179,8,.6)}
.lb-hero-bg{position:absolute;inset:0;background:radial-gradient(380px 240px at 95% 0%,rgba(250,204,21,.35),transparent 70%),radial-gradient(360px 240px at 0% 100%,rgba(139,92,246,.35),transparent 70%)}
.lb-trophy{position:absolute;right:18px;top:20px;display:grid;place-items:center;width:76px;height:76px;border-radius:24px;color:#422006;background:linear-gradient(135deg,#FDE68A,#F59E0B);box-shadow:0 0 40px rgba(251,191,36,.6);animation:lb-bob 3s ease-in-out infinite}
.lb-trophy i{position:absolute;width:6px;height:6px;border-radius:50%;background:#FDE68A;box-shadow:0 0 10px #FDE68A;animation:lb-spark 2.4s ease-in-out infinite}
.lb-trophy i:nth-child(2){left:-8px;top:10px}.lb-trophy i:nth-child(3){right:-6px;top:-4px;animation-delay:.8s}.lb-trophy i:nth-child(4){right:6px;bottom:-8px;animation-delay:1.6s}
@keyframes lb-bob{50%{transform:translateY(-6px) rotate(-4deg)}}
@keyframes lb-spark{0%,100%{opacity:.2;transform:scale(.6)}50%{opacity:1;transform:scale(1.2)}}
.lb-eyebrow{display:inline-flex;align-items:center;gap:7px;font-size:11px;font-weight:800;letter-spacing:.18em;color:#FDE68A}
.lb-eyebrow span{width:7px;height:7px;border-radius:50%;background:#22C55E;box-shadow:0 0 0 4px rgba(34,197,94,.25);animation:lb-spark 1.6s infinite}
.lb-grad{background:linear-gradient(90deg,#FDE68A,#F59E0B,#F472B6);-webkit-background-clip:text;background-clip:text;color:transparent}
.lb-cd{display:flex;align-items:flex-end;gap:6px;margin-top:14px;flex-wrap:wrap}
.lb-cd span{display:grid;place-items:center;min-width:52px;padding:7px 6px;border-radius:13px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.14)}
.lb-cd b{font-size:22px;font-weight:900;color:#fff;font-variant-numeric:tabular-nums;line-height:1}
.lb-cd small{margin-top:3px;font-size:9px;font-weight:800;letter-spacing:.14em;color:#CBD5E1}
.lb-cd em{font-style:normal;font-size:12px;color:#CBD5E1;margin:0 0 6px 4px}
.lb-me{margin-top:12px;border-radius:24px;padding:16px;border:1px solid rgba(59,130,246,.35);background:radial-gradient(400px 200px at 100% 0%,rgba(59,130,246,.18),transparent 70%),var(--card)}
.lb-me-rank{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}
.lb-me-rank small{font-size:11px;font-weight:800;letter-spacing:.14em;color:var(--muted-foreground)}
.lb-me-rank b{font-size:34px;font-weight:900;line-height:1;background:linear-gradient(90deg,#60A5FA,#22D3EE);-webkit-background-clip:text;background-clip:text;color:transparent}
.lb-me-rank .up{font-size:12px;font-weight:800;color:#22C55E}.lb-me-rank .down{font-size:12px;font-weight:800;color:#F43F5E}
.lb-me-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:12px}
.lb-me-grid span{border-radius:14px;padding:10px;text-align:center;background:var(--secondary)}
.lb-me-grid b{display:block;font-size:18px;font-weight:900}
.lb-me-grid small{font-size:11px;color:var(--muted-foreground)}
.lb-me-msg{display:flex;gap:8px;align-items:flex-start;margin-top:12px;border-radius:14px;padding:10px 12px;font-size:13px;line-height:1.45;color:#92400E;background:rgba(245,158,11,.12);border:1px solid rgba(245,158,11,.3)}
.dark .lb-me-msg{color:#FCD34D}
.lb-cta{display:flex;align-items:center;justify-content:center;margin-top:12px;height:44px;border-radius:13px;font-weight:800;font-size:14px;color:#0B1022;background:linear-gradient(90deg,#FDE68A,#F59E0B)}
.lb-tabs{position:sticky;top:0;z-index:10;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px;margin:14px 0 10px;padding:5px;border-radius:16px;border:1px solid var(--border);background:color-mix(in oklab,var(--card) 92%,transparent);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px)}
.lb-tabs button{display:flex;align-items:center;justify-content:center;gap:6px;height:40px;border-radius:12px;font-size:13px;font-weight:800;color:var(--muted-foreground)}
.lb-tabs button.on{color:#0B1022;background:linear-gradient(90deg,#FDE68A,#F59E0B)}
.lb-empty{border-radius:20px;border:1px dashed var(--border);padding:32px;text-align:center;font-size:14px;color:var(--muted-foreground)}
.lb-podium{display:grid;grid-template-columns:1fr 1.1fr 1fr;align-items:end;gap:8px;margin:18px 0 12px}
.lb-pod{position:relative;display:flex;flex-direction:column;align-items:center;text-align:center;animation:lb-rise .7s cubic-bezier(.2,1.2,.4,1) both}
@keyframes lb-rise{from{opacity:0;transform:translateY(30px)}to{opacity:1;transform:none}}
.lb-crown{color:#FBBF24;filter:drop-shadow(0 0 10px rgba(251,191,36,.8));animation:lb-bob 2.4s ease-in-out infinite;margin-bottom:-2px}
.lb-av{display:grid;place-items:center;flex:none;width:58px;height:58px;border-radius:50%;font-weight:900;font-size:18px;color:#fff;border:3px solid rgba(255,255,255,.85);box-shadow:0 10px 24px -10px rgba(0,0,0,.6)}
.lb-pod.p1 .lb-av{width:72px;height:72px;font-size:22px;border-color:#FBBF24;box-shadow:0 0 0 5px rgba(251,191,36,.25),0 0 30px rgba(251,191,36,.55)}
.lb-pod.p2 .lb-av{border-color:#CBD5E1}.lb-pod.p3 .lb-av{border-color:#D97706}
.lb-pod.me .lb-av{outline:3px solid #3B82F6;outline-offset:2px}
.lb-name{margin-top:6px;font-size:13.5px;font-weight:800;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lb-pts{font-size:12px;font-weight:700;color:var(--muted-foreground)}
.lb-block{display:grid;place-items:start center;width:100%;margin-top:8px;padding-top:8px;border-radius:16px 16px 6px 6px;font-size:28px;font-weight:900;color:#fff}
.lb-pod.p1 .lb-block{height:108px;background:linear-gradient(180deg,#F59E0B,#92400E)}
.lb-pod.p2 .lb-block{height:80px;background:linear-gradient(180deg,#64748B,#1E293B)}
.lb-pod.p3 .lb-block{height:62px;background:linear-gradient(180deg,#C2410C,#7C2D12)}
.lb-list{display:flex;flex-direction:column;gap:8px}
.lb-row{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:16px;border:1px solid var(--border);background:var(--card);animation:lb-in .4s cubic-bezier(.2,.8,.2,1) both}
@keyframes lb-in{from{opacity:0;transform:translateX(-8px)}to{opacity:1;transform:none}}
.lb-row.me{border-color:#3B82F6;background:color-mix(in oklab,#3B82F6 10%,var(--card));box-shadow:0 0 0 3px rgba(59,130,246,.15)}
.lb-rk{display:grid;place-items:center;flex:none;width:30px;height:30px;border-radius:10px;font-size:13px;font-weight:900;background:var(--secondary)}
.lb-rk.top{color:#422006;background:linear-gradient(135deg,#FDE68A,#F59E0B)}
.lb-av.sm{width:34px;height:34px;font-size:12px;border-width:2px}
.lb-bar{display:block;margin-top:5px;height:4px;border-radius:4px;background:var(--secondary);overflow:hidden}
.lb-bar i{display:block;height:100%;border-radius:4px;background:linear-gradient(90deg,#F59E0B,#F472B6);transform-origin:left;animation:lb-grow .9s .2s cubic-bezier(.2,.8,.2,1) both}
@keyframes lb-grow{from{transform:scaleX(0)}to{transform:scaleX(1)}}
.lb-flame{display:inline-flex;align-items:center;gap:4px;font-size:13px;font-weight:800;color:#F97316}
.lb-note{display:flex;align-items:center;gap:8px;margin-bottom:10px;border-radius:14px;padding:10px 12px;font-size:13px;border:1px solid var(--border);background:var(--card)}
.lb-champs{margin-top:16px;border-radius:20px;padding:14px;border:1px solid rgba(250,204,21,.3);background:linear-gradient(135deg,rgba(250,204,21,.08),transparent)}
.lb-champs-h{display:flex;align-items:center;gap:6px;margin-bottom:10px;font-size:11px;font-weight:900;letter-spacing:.16em;color:#D97706}
.dark .lb-champs-h{color:#FCD34D}
.lb-chip{display:inline-flex;align-items:center;gap:6px;padding:6px 11px;border-radius:999px;font-size:12.5px;font-weight:700;background:var(--card);border:1px solid var(--border)}
.lb-chip em{font-style:normal}
@media (prefers-reduced-motion:reduce){.lb-pod,.lb-row,.lb-trophy,.lb-crown,.lb-bar i{animation:none}}
`;
