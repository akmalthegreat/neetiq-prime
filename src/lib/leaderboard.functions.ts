import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const getLeaderboardData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: rows, error } = await supabaseAdmin
      .from("profiles")
      .select("id,full_name,xp_total")
      .order("xp_total", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: true })
      .limit(100);
    if (error) throw new Error(error.message);

    const { data: me, error: meError } = await supabaseAdmin
      .from("profiles")
      .select("xp_total")
      .eq("id", context.userId)
      .maybeSingle();
    if (meError) throw new Error(meError.message);

    let myRank: number | null = null;
    if (me) {
      const { count, error: rankError } = await supabaseAdmin
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .gt("xp_total", me.xp_total ?? 0);
      if (rankError) throw new Error(rankError.message);
      myRank = (count ?? 0) + 1;
    }

    return {
      rows: (rows ?? []).map((row) => ({ ...row, email: null as string | null })),
      myRank,
    };
  });

const IST = 330 * 60 * 1000;
const istDay = (d: Date) => new Date(d.getTime() + IST).toISOString().slice(0, 10);
/** Monday 00:00 IST of the week containing `d`, as a UTC Date. */
function weekStartIst(d: Date): Date {
  const ist = new Date(d.getTime() + IST);
  const dow = ist.getUTCDay() || 7;
  ist.setUTCHours(0, 0, 0, 0);
  ist.setUTCDate(ist.getUTCDate() - (dow - 1));
  return new Date(ist.getTime() - IST);
}
/** All completed attempts since `sinceIso`, paged past the 1,000-row API cap. */
async function fetchAll(cols: string, sinceIso: string): Promise<any[]> {
  const out: any[] = [];
  for (let off = 0; off < 200000; off += 1000) {
    const { data, error } = await (supabaseAdmin as any).from("attempts").select(cols)
      .eq("status", "completed").gte("submitted_at", sinceIso).not("submitted_at", "is", null)
      .order("submitted_at", { ascending: true }).range(off, off + 999);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

type WRow = { id: string; name: string; points: number; questions: number; correct: number };
function rankWeek(rows: any[]): Omit<WRow, "name">[] {
  const by = new Map<string, { points: number; questions: number; correct: number }>();
  for (const r of rows) {
    const c = Number(r.correct_count ?? 0), w = Number(r.wrong_count ?? 0);
    const cur = by.get(r.user_id) ?? { points: 0, questions: 0, correct: 0 };
    cur.points += 4 * c - w; cur.questions += c + w; cur.correct += c;
    by.set(r.user_id, cur);
  }
  return [...by.entries()].filter(([, v]) => v.questions > 0).map(([id, v]) => ({ id, ...v }))
    .sort((a, b) => b.points - a.points || b.questions - a.questions);
}

// Weekly leaderboard: NEET marks earned this week (+4 / −1), Monday 00:00 IST → Sunday 23:59 IST.
export const getWeeklyLeaderboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const uid = context.userId;
    const thisWeek = weekStartIst(new Date());
    const lastWeek = new Date(thisWeek.getTime() - 7 * 86400_000);
    const all = await fetchAll("user_id,correct_count,wrong_count,submitted_at", lastWeek.toISOString());
    const cur = rankWeek(all.filter((r) => new Date(r.submitted_at) >= thisWeek));
    const prev = rankWeek(all.filter((r) => new Date(r.submitted_at) < thisWeek));
    const top = cur.slice(0, 50), champs = prev.slice(0, 3);
    const myIdx = cur.findIndex((r) => r.id === uid);
    const myPrev = prev.findIndex((r) => r.id === uid);
    const ids = Array.from(new Set([...top, ...champs].map((r) => r.id).concat(uid)));
    const { data: profs } = await supabaseAdmin.from("profiles").select("id,full_name").in("id", ids);
    const names = new Map<string, string>((profs ?? []).map((p: any) => [p.id, (p.full_name || "Aspirant").trim()]));
    const named = (r: Omit<WRow, "name">): WRow => ({ ...r, name: names.get(r.id) ?? "Aspirant" });
    const me = myIdx >= 0 ? cur[myIdx] : null;
    return {
      weekStart: thisWeek.toISOString(),
      endsAt: new Date(thisWeek.getTime() + 7 * 86400_000).toISOString(),
      participants: cur.length,
      top: top.map(named),
      lastWeekChampions: champs.map(named),
      me: {
        rank: myIdx >= 0 ? myIdx + 1 : null,
        points: me?.points ?? 0,
        questions: me?.questions ?? 0,
        accuracy: me && me.questions ? Math.round((me.correct / me.questions) * 100) : null,
        lastWeekRank: myPrev >= 0 ? myPrev + 1 : null,
        gapToNext: myIdx > 0 ? cur[myIdx - 1].points - (me?.points ?? 0) + 1 : null,
      },
    };
  });

// Compute current daily streak per user from completed attempts in the last
// 60 days, then return the top streakers + the caller's streak/rank.
export const getStreakLeaderboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const since = new Date();
    since.setDate(since.getDate() - 60);
    since.setHours(0, 0, 0, 0);

    const rawAttempts = await fetchAll("user_id,submitted_at", since.toISOString());
    // Group dates per user.
    const byUser = new Map<string, Set<string>>();
    for (const row of rawAttempts ?? []) {
      const uid = (row as any).user_id as string;
      const s = (row as any).submitted_at as string | null;
      if (!uid || !s) continue;
      const day = istDay(new Date(s));
      let set = byUser.get(uid);
      if (!set) { set = new Set(); byUser.set(uid, set); }
      set.add(day);
    }

    function streakFor(days: Set<string>): number {
      let s = 0;
      let t = Date.now();
      if (!days.has(istDay(new Date(t)))) t -= 86400_000;
      while (days.has(istDay(new Date(t)))) { s++; t -= 86400_000; }
      return s;
    }

    const streaks: { user_id: string; streak: number }[] = [];
    for (const [uid, set] of byUser) {
      const s = streakFor(set);
      if (s > 0) streaks.push({ user_id: uid, streak: s });
    }
    streaks.sort((a, b) => b.streak - a.streak);

    const top = streaks.slice(0, 100);
    const ids = top.map((r) => r.user_id);

    let profiles: Record<string, { full_name: string | null }> = {};
    if (ids.length > 0) {
      const { data: pRows } = await supabaseAdmin
        .from("profiles")
        .select("id,full_name")
        .in("id", ids);
      profiles = Object.fromEntries((pRows ?? []).map((p: any) => [p.id, { full_name: p.full_name }]));
    }

    const rows = top.map((r) => ({
      id: r.user_id,
      full_name: profiles[r.user_id]?.full_name ?? null,
      streak: r.streak,
    }));

    const myStreak = streakFor(byUser.get(context.userId) ?? new Set());
    let myRank: number | null = null;
    if (myStreak > 0) {
      myRank = streaks.findIndex((s) => s.user_id === context.userId) + 1 || null;
    }

    return { rows, myStreak, myRank };
  });
