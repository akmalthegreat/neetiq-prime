// Home dashboard — extra real data that the Consult snapshot doesn't already cover:
// weekly leaderboard, bookmarks, mocks taken, negative marks this week, next contest
// and admin-managed announcement banners. Read-only.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const db = supabaseAdmin as any;
const IST = 330 * 60 * 1000;

/** Monday 00:00 IST of the week containing `d`, as a UTC Date. */
function weekStartIst(d: Date): Date {
  const ist = new Date(d.getTime() + IST);
  const dow = ist.getUTCDay() || 7;
  ist.setUTCHours(0, 0, 0, 0);
  ist.setUTCDate(ist.getUTCDate() - (dow - 1));
  return new Date(ist.getTime() - IST);
}

export type WeeklyRow = { id: string; name: string; points: number; questions: number };

export type HomeExtras = {
  weekly: {
    top: WeeklyRow[];
    me: { rank: number | null; points: number; questions: number; change: number | null; gapToNext: number | null };
    endsAt: string;
  };
  bookmarks: number;
  mocksTaken: number;
  wrongThisWeek: number;
  nextContest: null | { id: string; title: string; startsAt: string; endsAt: string; totalQuestions: number; durationMin: number; status: string };
  banners: { id: string; title: string; subtitle: string; tag: string; cta: string; href: string; imageUrl: string | null; theme: string }[];
  showBuiltInSlides: boolean;
};

function rankRows(rows: { user_id: string; correct_count: number | null; wrong_count: number | null }[]) {
  const by = new Map<string, { points: number; questions: number }>();
  for (const r of rows) {
    const c = Number(r.correct_count ?? 0), w = Number(r.wrong_count ?? 0);
    const cur = by.get(r.user_id) ?? { points: 0, questions: 0 };
    cur.points += 4 * c - w; // NEET marking: +4 / −1
    cur.questions += c + w;
    by.set(r.user_id, cur);
  }
  return [...by.entries()]
    .filter(([, v]) => v.questions > 0)
    .map(([id, v]) => ({ id, ...v }))
    .sort((a, b) => b.points - a.points || b.questions - a.questions);
}

export const getHomeExtras = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<HomeExtras> => {
    const uid = context.userId;
    const now = new Date();
    const thisWeek = weekStartIst(now);
    const lastWeek = new Date(thisWeek.getTime() - 7 * 86400_000);
    const nextWeek = new Date(thisWeek.getTime() + 7 * 86400_000);

    const [weekRes, bmRes, mockRes, contestRes, bannerRes] = await Promise.all([
      (async () => {
        // Page past the 1,000-row API cap so the weekly board counts every attempt.
        const out: any[] = [];
        for (let off = 0; off < 200000; off += 1000) {
          const { data, error } = await db.from("attempts").select("user_id,correct_count,wrong_count,submitted_at")
            .eq("status", "completed").gte("submitted_at", lastWeek.toISOString()).order("submitted_at").range(off, off + 999);
          if (error) return { data: out, error };
          out.push(...(data ?? []));
          if (!data || data.length < 1000) break;
        }
        return { data: out, error: null };
      })(),
      db.from("bookmarks").select("id", { count: "exact", head: true }).eq("user_id", uid),
      db.from("attempts").select("id,tests:test_id!inner(type)", { count: "exact", head: true })
        .eq("user_id", uid).eq("status", "completed").eq("tests.type", "mock"),
      db.from("contests").select("id,title,starts_at,ends_at,total_questions,duration_min,status")
        .gt("ends_at", now.toISOString()).order("starts_at", { ascending: true }).limit(1),
      db.from("dashboard_banners").select("*").limit(30),
    ]);
    const { data: builtInSetting } = await db.from("app_settings").select("value").eq("key", "home_builtin_slides").maybeSingle();

    const all = (weekRes.data ?? []) as any[];
    const thisRows = all.filter((r) => r.submitted_at && new Date(r.submitted_at) >= thisWeek);
    const lastRows = all.filter((r) => r.submitted_at && new Date(r.submitted_at) < thisWeek);
    const ranked = rankRows(thisRows);
    const rankedLast = rankRows(lastRows);

    const myIdx = ranked.findIndex((r) => r.id === uid);
    const myLastIdx = rankedLast.findIndex((r) => r.id === uid);
    const me = myIdx >= 0 ? ranked[myIdx] : null;

    const topIds = ranked.slice(0, 5).map((r) => r.id);
    const nameIds = Array.from(new Set([...topIds, uid]));
    const { data: profs } = nameIds.length
      ? await db.from("profiles").select("id,full_name").in("id", nameIds)
      : { data: [] };
    const names = new Map<string, string>((profs ?? []).map((p: any) => [p.id, p.full_name || "Aspirant"]));
    const short = (n: string) => {
      const parts = n.trim().split(/\s+/);
      return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : parts[0];
    };

    const wrongThisWeek = thisRows.filter((r) => r.user_id === uid).reduce((t, r) => t + Number(r.wrong_count ?? 0), 0);

    // Banners: accept whatever columns the admin table uses; fall back to built-in slides on the page.
    const nowMs = now.getTime();
    const banners = ((bannerRes.data ?? []) as any[])
      .filter((b) => b && (b.is_active ?? b.active ?? true) !== false && (b.title ?? b.heading))
      .filter((b) => (!b.starts_at || new Date(b.starts_at).getTime() <= nowMs) && (!b.ends_at || new Date(b.ends_at).getTime() > nowMs))
      .sort((a, b) => Number(a.sort_order ?? a.position ?? a.order_index ?? 0) - Number(b.sort_order ?? b.position ?? b.order_index ?? 0))
      .map((b) => ({
        id: String(b.id),
        title: String(b.title ?? b.heading),
        subtitle: String(b.subtitle ?? b.description ?? b.body ?? ""),
        tag: String(b.tag ?? b.badge ?? b.label ?? "NEW"),
        cta: String(b.cta_label ?? b.button_text ?? b.cta ?? "Open"),
        href: String(b.link_url ?? b.link_path ?? b.link ?? b.href ?? b.url ?? b.cta_url ?? "/dashboard"),
        imageUrl: (b.image_url ?? b.image ?? null) as string | null,
        theme: String(b.theme ?? "blue"),
      }));

    const c = (contestRes.data ?? [])[0];
    return {
      weekly: {
        top: ranked.slice(0, 5).map((r) => ({ id: r.id, name: short(names.get(r.id) ?? "Aspirant"), points: r.points, questions: r.questions })),
        me: {
          rank: myIdx >= 0 ? myIdx + 1 : null,
          points: me?.points ?? 0,
          questions: me?.questions ?? 0,
          change: myIdx >= 0 && myLastIdx >= 0 ? myLastIdx - myIdx : null,
          gapToNext: myIdx > 0 ? ranked[myIdx - 1].points - ranked[myIdx].points + 1 : null,
        },
        endsAt: nextWeek.toISOString(),
      },
      bookmarks: bmRes.count ?? 0,
      mocksTaken: mockRes.count ?? 0,
      wrongThisWeek,
      nextContest: c ? {
        id: c.id, title: c.title, startsAt: c.starts_at, endsAt: c.ends_at,
        totalQuestions: Number(c.total_questions ?? 0), durationMin: Number(c.duration_min ?? 0), status: String(c.status ?? ""),
      } : null,
      banners,
      showBuiltInSlides: builtInSetting?.value === false ? false : true,
    };
  });
