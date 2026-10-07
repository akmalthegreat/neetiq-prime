// Home dashboard strip for the Daily Mega Quiz: countdown, join status and a
// one-tap way to turn on reminders.

import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PushOptIn } from "@/components/push-opt-in";

type Today = {
  server_now: string;
  next_starts_at: string;
  prize: number;
  quiz: null | { starts_at: string; ends_at: string; entry_closes_at: string; players: number };
  me: null | { status: string };
};

export function MegaQuizCard() {
  const q = useQuery({
    queryKey: ["mega-today"],
    queryFn: async () => {
      const t0 = Date.now();
      const { data, error } = await (supabase as any).rpc("mega_today");
      if (error) throw error;
      return { t: data as Today, offset: new Date((data as Today).server_now).getTime() - (t0 + Date.now()) / 2 };
    },
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
  const [, tick] = useState(0);
  useEffect(() => { const i = setInterval(() => tick((n) => n + 1), 1000); return () => clearInterval(i); }, []);
  if (!q.data) return null;

  const { t, offset } = q.data;
  const now = Date.now() + offset;
  const start = new Date(t.quiz?.starts_at ?? t.next_starts_at).getTime();
  const end = t.quiz ? new Date(t.quiz.ends_at).getTime() : 0;
  const live = !!t.quiz && now >= start && now < end;
  const done = !!t.quiz && now >= end;
  const left = Math.max(0, start - now);
  const hh = Math.floor(left / 3.6e6), mm = Math.floor(left / 6e4) % 60, ss = Math.floor(left / 1000) % 60;
  const p2 = (n: number) => String(n).padStart(2, "0");

  const line = live ? (t.me ? "You're in. The quiz is live now." : "The quiz is live now.")
    : done ? "Today's results are out."
    : t.me ? "You're in for 6:00 PM."
    : t.quiz ? "Entry is open. Join before 6:05 PM."
    : "Entry opens at 5:30 PM.";

  return (
    <div className="full" style={{ display: "grid", gap: 10 }}>
      <Link to="/mega-quiz" className="block overflow-hidden rounded-[22px] border border-amber-400/45 p-4 sm:p-5"
        style={{ background: "radial-gradient(120% 120% at 100% 0%, rgba(245,184,65,.22), transparent 55%), linear-gradient(160deg,#1C1607,#0B1222 65%)", color: "#FFF8E8" }}>
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl" style={{ background: "rgba(245,184,65,.18)", color: "#F5B841" }}>
            <Trophy className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-bold uppercase tracking-[0.16em]" style={{ color: "#F5B841" }}>Daily Mega Quiz · 6 PM</div>
            <div className="mt-0.5 text-[17px] font-bold leading-tight">Win ₹{t.prize} today</div>
            <div className="mt-0.5 text-[13px]" style={{ color: "#D9CFB8" }}>{line}</div>
          </div>
          {!live && !done ? (
            <div className="text-right font-bold tabular-nums" style={{ fontSize: 20 }}>{p2(hh)}:{p2(mm)}:{p2(ss)}</div>
          ) : (
            <ArrowRight className="h-5 w-5" style={{ color: "#F5B841" }} />
          )}
        </div>
      </Link>
      <div className="dark text-foreground"><PushOptIn compact dismissible /></div>
    </div>
  );
}
