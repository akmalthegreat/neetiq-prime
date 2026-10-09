import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type PublicReview = {
  id: string;
  rating: number;
  body: string;
  name: string;
  avatar: string | null;
  targetYear: number | null;
  date: string;
};

export type HomeStats = {
  questions: number;
  students: number;
  ratingAvg: number;
  ratingCount: number;
  /** counts for 5, 4, 3, 2, 1 stars */
  ratingBars: [number, number, number, number, number];
  /** latest published public reviews (newest first) */
  reviews: PublicReview[];
  reviewCount: number;
};

/**
 * Public numbers + published reviews for the landing page.
 * Rating = one rating per student: their approved public review if they have one, otherwise their latest
 * in-app feedback rating (the private feedback text itself is never exposed). Pending reviews don't count.
 */
export const getHomeStats = createServerFn({ method: "GET" }).handler(async (): Promise<HomeStats> => {
  const db = supabaseAdmin as any;
  const [q, p, f, r] = await Promise.all([
    db.rpc("question_bank_counts"),
    db.from("profiles").select("id", { count: "exact", head: true }),
    db.from("feedback").select("user_id,rating,created_at").order("created_at", { ascending: true }),
    db.from("site_reviews")
      .select("id,user_id,rating,body,display_name,target_year,created_at,status")
      .order("created_at", { ascending: false })
      .limit(500),
  ]);

  const perUser = new Map<string, number>();
  let anon: number[] = [];
  for (const row of (f.data ?? []) as { user_id: string | null; rating: number }[]) {
    if (!(row.rating >= 1 && row.rating <= 5)) continue;
    if (row.user_id) perUser.set(row.user_id, row.rating); // ascending order -> latest wins
    else anon.push(row.rating);
  }
  const reviewRows = (r.error ? [] : (r.data ?? [])) as Array<{
    id: string; user_id: string; rating: number; body: string; display_name: string;
    target_year: number | null; created_at: string; status: string;
  }>;
  const published = reviewRows.filter((x) => x.status === "published");
  // Only reviews the admin has approved (published) count publicly.
  for (const x of published) perUser.set(x.user_id, x.rating);

  const top = published.slice(0, 12);
  let avatars: Record<string, string | null> = {};
  if (top.length) {
    const { data: pa } = await db.from("profiles").select("id,avatar_url").in("id", top.map((x) => x.user_id));
    avatars = Object.fromEntries((pa ?? []).map((x: any) => [x.id, x.avatar_url ?? null]));
  }

  const ratings = [...perUser.values(), ...anon];
  const bars = [5, 4, 3, 2, 1].map((s) => ratings.filter((v) => v === s).length) as HomeStats["ratingBars"];
  const avg = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;

  return {
    questions: Number(q.data?.total ?? 0),
    students: p.count ?? 0,
    ratingAvg: Math.round(avg * 10) / 10,
    ratingCount: ratings.length,
    ratingBars: bars,
    reviewCount: published.length,
    reviews: top.map((x) => ({
      id: x.id,
      rating: x.rating,
      body: x.body,
      name: x.display_name,
      avatar: avatars[x.user_id] ?? null,
      targetYear: x.target_year,
      date: x.created_at,
    })),
  };
});
