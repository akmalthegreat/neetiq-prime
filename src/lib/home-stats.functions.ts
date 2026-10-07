import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type HomeStats = {
  questions: number;
  students: number;
  ratingAvg: number;
  ratingCount: number;
  /** counts for 5, 4, 3, 2, 1 stars */
  ratingBars: [number, number, number, number, number];
};

/** Public, aggregate-only numbers for the landing page. No personal data leaves the server. */
export const getHomeStats = createServerFn({ method: "GET" }).handler(async (): Promise<HomeStats> => {
  const db = supabaseAdmin as any;
  const [q, p, f] = await Promise.all([
    db.from("questions").select("id", { count: "exact", head: true }),
    db.from("profiles").select("id", { count: "exact", head: true }),
    db.from("feedback").select("rating"),
  ]);
  const ratings: number[] = ((f.data ?? []) as { rating: number }[]).map((r) => r.rating).filter((r) => r >= 1 && r <= 5);
  const bars = [5, 4, 3, 2, 1].map((s) => ratings.filter((r) => r === s).length) as HomeStats["ratingBars"];
  const avg = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;
  return {
    questions: q.count ?? 0,
    students: p.count ?? 0,
    ratingAvg: Math.round(avg * 10) / 10,
    ratingCount: ratings.length,
    ratingBars: bars,
  };
});
