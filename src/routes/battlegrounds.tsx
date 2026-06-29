import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import {
  Loader2, Swords, Coins, ArrowRight, Flame, Users, Trophy, X, Zap, Crown, BookOpen, Clock, History,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase as supabaseTyped } from "@/integrations/supabase/client";
import { avatarUrl } from "@/lib/avatar";
import { avatarForName } from "@/lib/neetiq-avatars";
// Cast away types — battle_* tables and bg_* RPCs are pending DB type regen.
const supabase = supabaseTyped as unknown as {
  from: (t: string) => any;
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: any; error: any }>;
};

export const Route = createFileRoute("/battlegrounds")({
  head: () => ({ meta: [{ title: "Battlegrounds — 1v1 Quiz Battles" }] }),
  component: BattlegroundsPage,
});

type Stake = 0 | 2 | 5 | 10 | 25;
const STAKES: { value: Stake; prize: number | "Glory"; tint: string }[] = [
  { value: 0,  prize: "Glory", tint: "from-primary/20 to-accent/15" },
  { value: 2,  prize: 3.4,  tint: "from-primary/25 to-accent/20" },
  { value: 5,  prize: 8.5,  tint: "from-primary/30 to-accent/20" },
  { value: 10, prize: 17,   tint: "from-primary/35 to-accent/25" },
  { value: 25, prize: 42.5, tint: "from-primary/40 to-accent/30" },
];

// Chapter rotation — switches every 1 hour, deterministic from UTC time so all
// users see the same active chapter. Biology dominates the rotation (NEET focus).
const CHAPTER_ROTATION: { subject: string; chapter: string }[] = [
  { subject: "Biology",   chapter: "Cell: The Unit of Life" },
  { subject: "Biology",   chapter: "Human Physiology" },
  { subject: "Biology",   chapter: "Genetics & Evolution" },
  { subject: "Biology",   chapter: "Plant Physiology" },
  { subject: "Biology",   chapter: "Biomolecules" },
  { subject: "Biology",   chapter: "Reproduction" },
  { subject: "Biology",   chapter: "Ecology & Environment" },
  { subject: "Biology",   chapter: "Biotechnology" },
  { subject: "Physics",   chapter: "Kinematics" },
  { subject: "Physics",   chapter: "Laws of Motion" },
  { subject: "Chemistry", chapter: "Chemical Bonding" },
  { subject: "Chemistry", chapter: "Organic Chemistry Basics" },
];
const ROTATION_MS = 60 * 60 * 1000;
function getRotation(now = Date.now()) {
  const slot = Math.floor(now / ROTATION_MS);
  const idx = ((slot % CHAPTER_ROTATION.length) + CHAPTER_ROTATION.length) % CHAPTER_ROTATION.length;
  const nextChangeAt = (slot + 1) * ROTATION_MS;
  return { ...CHAPTER_ROTATION[idx], nextChangeAt };
}

type Opponent = { user_id: string; full_name: string | null; avatar_url: string | null; is_bot?: boolean } | null;
type QueueState =
  | { kind: "idle" }
  | { kind: "waiting"; stake: Stake; since: number }
  | { kind: "matched"; matchId: string; testId: string; stake: Stake; opponent: Opponent; countdownStartsAt: number };

const BOT_NAMES = ["Aarav Prime", "Meera Ace", "Vihaan Pro", "Isha Spark", "Kabir Nova", "Tara Flux"];
function fallbackBotName(matchId: string, preferred?: string | null) {
  const clean = preferred?.trim();
  if (clean && !["opponent", "bot opponent"].includes(clean.toLowerCase())) return clean;
  const n = Array.from(matchId).reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  return BOT_NAMES[n % BOT_NAMES.length];
}

function seededNumber(seed: string, min: number, max: number) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const r = (h >>> 0) / 4294967295;
  return Math.round(min + r * (max - min));
}

function realisticLiveCount(raw?: number | null) {
  const now = new Date();
  const istHour = (now.getUTCHours() + 5 + (now.getUTCMinutes() >= 30 ? 1 : 0)) % 24;
  const day = now.toISOString().slice(0, 10);
  const bucket = Math.floor(now.getUTCMinutes() / 5);
  const ranges = istHour >= 0 && istHour < 5 ? [7, 24]
    : istHour < 8 ? [18, 52]
      : istHour < 12 ? [65, 145]
        : istHour < 17 ? [90, 210]
          : istHour < 23 ? [120, 280]
            : [30, 80];
  const base = seededNumber(`${day}:${istHour}:${bucket}`, ranges[0], ranges[1]);
  const modestReal = Math.max(0, Math.min(35, Number(raw ?? 0)));
  return Math.min(ranges[1] + 18, base + Math.floor(modestReal * 0.35));
}

function syntheticLeaderboardRows() {
  const day = new Date().toISOString().slice(0, 10);
  // Vary by IST hour + 15-min bucket so EVERY bot's winnings tick up across
  // the day instead of just one row appearing to update.
  const istHour = (new Date().getUTCHours() + 5 + Math.floor((new Date().getUTCMinutes() + 30) / 60)) % 24;
  const bucket15 = Math.floor(new Date().getUTCMinutes() / 15);
  const dayProgress = istHour + bucket15 / 4; // 0..24
  return BOT_NAMES.concat(["Arjun Nair", "Anaya Verma", "Rohan Pillai", "Diya Khanna"]).map((name, i) => {
    const winsBase = seededNumber(`${day}:${name}:w`, Math.max(3, 13 - i), Math.max(6, 21 - i));
    const winsGrowth = seededNumber(`${day}:${name}:wg:${istHour}`, 0, 3);
    const wins = winsBase + winsGrowth;
    const battles = wins + seededNumber(`${day}:${name}:b:${istHour}`, 3, 9);
    const baseLo = Math.max(70, 340 - i * 24);
    const baseHi = Math.max(180, 1250 - i * 55);
    const winningsBase = seededNumber(`${day}:${name}:m`, baseLo, baseHi);
    // Each bot accumulates ₹4-22 every 15 min through the day — unique per bot.
    const perStep = seededNumber(`${day}:${name}:step`, 4, 22);
    const winnings = winningsBase + Math.round(perStep * dayProgress * 4) +
      seededNumber(`${day}:${name}:jit:${istHour}:${bucket15}`, 0, 35);
    return { display_name: name, avatar_url: avatarForName(name), wins, battles, winnings };
  });
}

async function fetchOpponent(matchId: string, _meId: string): Promise<Opponent> {
  // Use the SECURITY DEFINER RPC — direct `profiles` reads for the opponent are
  // blocked by RLS, which is why the matched banner kept showing "Player xxxx".
  const { data: oppRows, error } = await supabase.rpc("bg_get_opponent_profile", {
    _match_id: matchId,
  });
  if (error) {
    console.error("[bg] bg_get_opponent_profile failed", error);
    return null;
  }
  const opp = Array.isArray(oppRows) ? oppRows[0] : oppRows;
  if (!opp?.user_id) return null;
  const rawName = (opp.full_name as string | null)?.trim();
  const email = (opp.email as string | null) ?? undefined;
  const fallback = email ? email.split("@")[0] : `Player ${String(opp.user_id).slice(0, 4)}`;
  return {
    user_id: opp.user_id,
    full_name: rawName && rawName.length > 0 ? rawName : fallback,
    avatar_url: (opp.avatar_url as string | null) ?? null,
  };
}

function BattlegroundsPage() {
  const { user, profile, loading } = useAuth();
  const nav = useNavigate();
  const [state, setState] = useState<QueueState>({ kind: "idle" });
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);
  const [liveCount, setLiveCount] = useState<number | null>(null);
  const [rotation, setRotation] = useState(() => getRotation());
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [leaderboard, setLeaderboard] = useState<
    { rank: number; display_name: string; avatar_url: string | null; wins: number; battles: number; winnings: number }[]
  >([]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data, error } = await supabase.rpc("bg_daily_leaderboard", { _limit: 10 });
      if (cancelled || error || !Array.isArray(data)) return;
      // Normalise: clamp negatives, enforce battles >= wins, dedupe by name,
      // sort by winnings desc, then pad to 10 with believable synthetic players
      // so the board never looks empty/inconsistent. Bots are NEVER flagged.
      const seen = new Set<string>();
      const cleaned = (data as any[])
        .map((r) => {
          const wins = Math.max(0, Number(r.wins ?? 0));
          const battles = Math.max(wins, Number(r.battles ?? 0));
          const winnings = Math.max(0, Number(r.winnings ?? 0));
          return {
            display_name: String(r.display_name ?? "Player"),
            avatar_url: (r.avatar_url as string | null) ?? null,
            wins, battles, winnings,
          };
        })
        .filter((r) => {
          const k = r.display_name.toLowerCase();
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        })
        .sort((a, b) => b.winnings - a.winnings || b.wins - a.wins);

      const FILLERS = syntheticLeaderboardRows();
      for (const f of FILLERS) {
        if (cleaned.length >= 10) break;
        if (seen.has(f.display_name.toLowerCase())) continue;
        cleaned.push({ ...f, avatar_url: null });
        seen.add(f.display_name.toLowerCase());
      }
      cleaned.sort((a, b) => b.winnings - a.winnings || b.wins - a.wins);
      const ranked = cleaned.slice(0, 10).map((r, i) => ({ rank: i + 1, ...r }));
      setLeaderboard(ranked);
    };
    load();
    const id = setInterval(load, 30_000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);


  const balance =
    Number(profile?.deposit_balance ?? 0) + Number(profile?.winnings_balance ?? 0);

  useEffect(() => { if (!loading && !user) nav({ to: "/login" }); }, [user, loading, nav]);

  // Tick chapter rotation + waiting timer every second.
  useEffect(() => {
    const id = setInterval(() => {
      setRotation(getRotation());
      setTick((t) => t + 1);
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // Poll live players count + current chapter every 5s via public RPCs.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const fetchLive = async () => {
      const [{ data: live }, { data: ch }] = await Promise.all([
        supabase.rpc("bg_live_count"),
        supabase.rpc("bg_current_chapter"),
      ]);
      if (cancelled) return;
      setLiveCount(realisticLiveCount((live as any)?.players));
      const row = Array.isArray(ch) ? (ch as any[])[0] : ch;
      if (row?.subject && row?.chapter) {
        setRotation({
          subject: row.subject,
          chapter: row.chapter,
          nextChangeAt: row.ends_at ? new Date(row.ends_at).getTime() : getRotation().nextChangeAt,
        });
      }
    };
    fetchLive();
    const id = setInterval(fetchLive, 5000);
    return () => { cancelled = true; clearInterval(id); };
  }, [user?.id]);

  // Bot-first flow: show a short search pause, then create a managed opponent.
  useEffect(() => {
    if (state.kind !== "waiting" || !user) return;
    let botTriggered = false;
    pollRef.current = setInterval(async () => {
      const elapsed = (Date.now() - state.since) / 1000;

      if (elapsed >= 4 && !botTriggered) {
        botTriggered = true;
        const { data: botRes, error: botErr } = await supabase.rpc("bg_match_with_bot");
        if (botErr) {
          console.error("bg_match_with_bot failed", botErr);
          toast.error("Could not find an opponent", { description: botErr.message });
          botTriggered = false; // allow another attempt next tick
        }
        const r = botRes as { status?: string; match_id?: string; test_id?: string; is_bot?: boolean; bot_name?: string; bot_avatar_url?: string } | null;
        if (r?.status === "matched" && r.match_id && r.test_id) {
          const { data: m } = await supabase
            .from("battle_matches")
            .select("countdown_starts_at,bot_name,bot_avatar_url")
            .eq("id", r.match_id)
            .maybeSingle();
          const anchor = m?.countdown_starts_at ? new Date(m.countdown_starts_at).getTime() : Date.now() + 10_000;
          const botName = fallbackBotName(r.match_id, m?.bot_name ?? r.bot_name);
          const botAvatar = m?.bot_avatar_url ?? r.bot_avatar_url ?? avatarForName(botName);
          setState({
            kind: "matched",
            matchId: r.match_id,
            testId: r.test_id,
            stake: state.stake,
            opponent: { user_id: "__bot__", full_name: botName, avatar_url: botAvatar, is_bot: true },
            countdownStartsAt: anchor,
          });
          return;
        }
      }

      const { data } = await supabase
        .from("battle_queue")
        .select("status,match_id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!data) return;
      if (data.status === "matched" && data.match_id) {
        const { data: m } = await supabase
          .from("battle_matches")
          .select("test_id,stake,countdown_starts_at")
          .eq("id", data.match_id)
          .maybeSingle();
        if (m?.test_id) {
          const opp = await fetchOpponent(data.match_id, user.id);
          const anchor = m.countdown_starts_at ? new Date(m.countdown_starts_at).getTime() : Date.now() + 10_000;
          setState({
            kind: "matched",
            matchId: data.match_id,
            testId: m.test_id as string,
            stake: Number(m.stake) as Stake,
            opponent: opp,
            countdownStartsAt: anchor,
          });
        }
      }
    }, 2000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [state.kind, user?.id, state.kind === "waiting" ? state.since : 0, state.kind === "waiting" ? state.stake : 0]);

  // Auto-navigate to the dedicated battle play page when countdown hits zero.
  useEffect(() => {
    if (state.kind !== "matched") return;
    const tickId = setInterval(() => {
      if (Date.now() >= state.countdownStartsAt) {
        clearInterval(tickId);
        nav({ to: "/battle/$matchId/play", params: { matchId: state.matchId } });
      }
    }, 250);
    return () => clearInterval(tickId);
  }, [state.kind, state.kind === "matched" ? state.countdownStartsAt : 0, state.kind === "matched" ? state.matchId : ""]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  async function joinStake(stake: Stake) {
    if (stake > 0 && balance < stake) {
      toast.error("Insufficient wallet balance", { description: "Add money to play this stake." });
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.rpc("bg_join_queue", { _stake: stake });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    if (stake > 0) {
      toast.success(`₹${stake} deducted from wallet`, {
        description: "Entry locked. Win 85% of the pool — tie refunds both stakes.",
      });
    }
    const res = data as { status: string; match_id?: string; test_id?: string } | null;
    if (res?.status === "matched" && res.match_id && res.test_id) {
      try {
        const opp = await fetchOpponent(res.match_id, user!.id);
        const { data: m } = await supabase
          .from("battle_matches")
          .select("countdown_starts_at")
          .eq("id", res.match_id)
          .maybeSingle();
        const anchor = m?.countdown_starts_at ? new Date(m.countdown_starts_at).getTime() : Date.now() + 10_000;
        setState({ kind: "matched", matchId: res.match_id, testId: res.test_id, stake, opponent: opp, countdownStartsAt: anchor });
      } catch (e) {
        // If post-join hydration fails we still navigate — the play page reloads
        // the match itself. Worst case the user lands there and resumes.
        console.error("[bg] post-join hydration failed; navigating to play page", e);
        nav({ to: "/battle/$matchId/play", params: { matchId: res.match_id } });
      }
    } else {
      setState({ kind: "waiting", stake, since: Date.now() });
    }
  }

  async function cancelQueue() {
    setBusy(true);
    await supabase.rpc("bg_leave_queue");
    setBusy(false);
    setState({ kind: "idle" });
  }

  return (
    <PageShell>
      {/* Hero */}
      <div className="overflow-hidden rounded-3xl border border-primary/25 bg-gradient-to-br from-primary/90 via-accent/75 to-primary/80 p-6 text-primary-foreground shadow-soft sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-[11px] font-bold uppercase tracking-wider backdrop-blur">
              <Flame className="h-3.5 w-3.5" /> 1v1 Battles
            </div>
            <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">Battlegrounds</h1>
            <p className="mt-2 max-w-sm text-sm text-white/90">
              Pick a stake. We match you with a competitive opponent. Highest score wins.
            </p>
          </div>
          <div className="hidden h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-white/15 backdrop-blur sm:flex">
            <Swords className="h-10 w-10" strokeWidth={1.5} />
          </div>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-3 py-1.5 font-semibold backdrop-blur">
            <Coins className="h-3.5 w-3.5" /> Wallet: ₹{balance.toFixed(0)}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/30 px-3 py-1.5 font-semibold backdrop-blur">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            {liveCount === null ? "…" : liveCount} live now
          </span>
          <Link to="/wallet" className="inline-flex items-center gap-1 rounded-full bg-black/30 px-3 py-1.5 font-semibold backdrop-blur hover:bg-black/40">
            Add money <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {/* Current chapter — rotates every 1 hour */}
      <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-gradient-to-r from-primary/10 via-card to-primary/5 p-4 shadow-soft">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <BookOpen className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
              Current chapter · auto-rotates every 1h
            </div>
            <div className="truncate text-base font-extrabold">
              {rotation.subject} · {rotation.chapter}
            </div>
          </div>
          <div className="hidden shrink-0 items-center gap-1 rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold text-muted-foreground sm:inline-flex">
            <Clock className="h-3.5 w-3.5" />
            {(() => {
              const ms = Math.max(0, rotation.nextChangeAt - Date.now());
              const h = Math.floor(ms / 3600000);
              const m = Math.floor((ms % 3600000) / 60000);
              const s = Math.floor((ms % 60000) / 1000);
              return `${h}h ${m}m ${s}s`;
            })()}
          </div>
        </div>
      </div>

      {/* How it works */}
      <div className="mt-6 grid grid-cols-3 gap-2 text-center">
        {[
          { icon: Coins,  label: "Pick stake" },
          { icon: Users,  label: "Find opponent" },
          { icon: Trophy, label: "Win pot 2×" },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-border bg-card p-3 shadow-soft">
            <s.icon className="mx-auto h-5 w-5 text-primary" />
            <div className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {s.label}
            </div>
          </div>
        ))}
      </div>

      {/* Matched banner — animated VS reveal with opponent's name + avatar */}
      {state.kind === "matched" && (
        <div className="mt-6 overflow-hidden rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500 via-teal-600 to-emerald-700 p-6 text-white shadow-elegant">
          <div className="text-center">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-[11px] font-bold uppercase tracking-wider backdrop-blur">
              <Zap className="h-3.5 w-3.5" /> Opponent found
            </div>
            <div className="mt-4 flex items-center justify-center gap-4">
              {/* You */}
              <div className="flex flex-col items-center">
                <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border-4 border-white/40 bg-white/15 text-xl font-extrabold backdrop-blur">
                  <img
                    src={avatarUrl(profile?.full_name ?? user?.id ?? "you", profile?.avatar_url ?? null)}
                    alt="You"
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="mt-1 max-w-[6rem] truncate text-xs font-bold">You</div>
              </div>
              <div className="text-3xl font-black tracking-tighter opacity-90">VS</div>
              {/* Opponent — show name + avatar so the matchup feels real */}
              <div className="flex flex-col items-center">
                <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border-4 border-white/40 bg-white/15 text-xl font-extrabold backdrop-blur">
                  <img
                    src={avatarUrl(
                      state.opponent?.full_name ?? state.opponent?.user_id ?? "opp",
                      state.opponent?.avatar_url ?? null,
                    )}
                    alt={state.opponent?.full_name ?? "Opponent"}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="mt-1 max-w-[6rem] truncate text-xs font-bold">
                  {state.opponent?.full_name ?? "Opponent"}
                </div>
              </div>
            </div>
            {(() => {
              const secs = Math.max(0, Math.ceil((state.countdownStartsAt - Date.now()) / 1000));
              return (
                <>
                  <div className="mt-5 flex items-baseline justify-center gap-2">
                    <span className="text-6xl font-black tabular-nums tracking-tighter animate-scale-in">{secs}</span>
                    <span className="text-sm font-bold uppercase tracking-wider opacity-90">starting in</span>
                  </div>
                  <div className="mt-3 text-sm font-semibold">
                    Stake {state.stake === 0 ? "Free" : `₹${state.stake}`} · {state.stake >= 10 ? 10 : 5} questions · Best score wins
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* Waiting state */}
      {state.kind === "waiting" && (
        <div className="mt-6 overflow-hidden rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card to-primary/5 p-6 shadow-elegant">
          <div className="flex items-center gap-3">
            <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-lg font-extrabold">Searching opponent…</div>
              <div className="text-xs text-muted-foreground">
                Stake {state.stake === 0 ? "Free" : `₹${state.stake}`} ·
                {" "}{Math.floor((Date.now() + tick * 0 - state.since) / 1000)}s elapsed
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={cancelQueue} disabled={busy}>
              <X className="mr-1 h-4 w-4" /> Cancel
            </Button>
          </div>
        </div>
      )}

      {state.kind === "idle" && (
        <div className="mt-4 flex gap-2">
          <Button asChild variant="outline" className="flex-1">
            <Link to="/battlegrounds/history">
              <History className="mr-2 h-4 w-4" /> View all battlegrounds
            </Link>
          </Button>
        </div>
      )}

      {/* Stakes grid */}
      {state.kind === "idle" && (
        <section className="mt-8">
          <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
            Choose your stake
          </h2>
          <div className="grid gap-3">
            {STAKES.map((s) => (
              <button
                key={s.value}
                onClick={() => joinStake(s.value)}
                disabled={busy}
                className="group relative overflow-hidden rounded-2xl border border-border bg-card p-0 text-left shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-elegant disabled:opacity-60"
              >
                <div className="flex items-center gap-4 p-4">
                  <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${s.tint} text-primary shadow-sm`}>
                    {s.value === 0 ? <Crown className="h-7 w-7" /> : <Swords className="h-7 w-7" strokeWidth={1.8} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-base font-extrabold">
                      {s.value === 0 ? "Free Battle" : `₹${s.value} Battle`}
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {s.value >= 10 ? "10 questions" : "Best of 5 questions"} · winner takes all
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Win</div>
                    <div className="text-base font-extrabold text-emerald-600 dark:text-emerald-400">
                      {s.prize === "Glory" ? "XP" : `₹${s.prize}`}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
          <p className="mt-3 text-center text-[11px] text-muted-foreground">
            15% rake on paid battles · Tie refunds both stakes
          </p>
        </section>
      )}

      {/* Daily leaderboard — updates live, includes bots */}
      <section className="mt-8">
        <div className="mb-3 flex items-end justify-between">
          <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
            Today's Leaderboard
          </h2>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Last 24h · resets daily
          </span>
        </div>
        {leaderboard.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-center text-xs text-muted-foreground">
            No battles in the last 24h yet. Be the first — pick a stake above.
          </div>
        ) : (
          <ol className="space-y-2">
            {leaderboard.map((row) => {
              const medal =
                row.rank === 1 ? "bg-amber-400/20 text-amber-700 border-amber-400/40" :
                row.rank === 2 ? "bg-zinc-300/30 text-zinc-700 border-zinc-300/40" :
                row.rank === 3 ? "bg-orange-400/20 text-orange-700 border-orange-400/40" :
                "bg-card text-muted-foreground border-border";
              return (
                <li key={`${row.rank}-${row.display_name}`} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-soft">
                  <span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-extrabold ${medal}`}>
                    {row.rank}
                  </span>
                  <img
                    src={row.avatar_url ?? avatarUrl(row.display_name, null)}
                    alt={row.display_name}
                    className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-border"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 truncate text-sm font-bold">
                      {row.display_name}
                    </div>

                    <div className="text-[11px] text-muted-foreground">
                      {row.wins}W · {row.battles} battles
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400">
                      ₹{Number(row.winnings || 0).toFixed(0)}
                    </div>
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">won</div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </PageShell>

  );
}
