import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { PageShell } from "@/components/page-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, ShieldCheck, IndianRupee, Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import {
  joinContest,
  getContestDetail,
  ENTRY_FEE_OPTIONS,
} from "@/lib/contests.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/contest/$contestId/join")({
  head: () => ({ meta: [{ title: "Confirm join — NEETIQ Prime" }] }),
  component: JoinPage,
});

function JoinPage() {
  const { contestId } = Route.useParams();
  const { user, profile, loading } = useAuth();
  const nav = useNavigate();
  const fetchDetail = useServerFn(getContestDetail);
  const join = useServerFn(joinContest);
  const [detail, setDetail] = useState<Awaited<ReturnType<typeof getContestDetail>> | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  // Each user picks their OWN stake when joining a battleground.
  const [stake, setStake] = useState<number>(0);

  useEffect(() => {
    if (!loading && !user) nav({ to: "/login" });
  }, [user, loading, nav]);

  useEffect(() => {
    fetchDetail({ data: { contest_id: contestId } })
      .then(setDetail)
      .catch((e) => setErr(e?.message ?? "Failed to load"));
  }, [fetchDetail, contestId]);

  if (loading || (!detail && !err))
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );

  if (err || !detail)
    return (
      <PageShell>
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-sm text-destructive">{err ?? "Contest not found."}</p>
            <Button asChild variant="link">
              <Link to="/contests">Back to contests</Link>
            </Button>
          </CardContent>
        </Card>
      </PageShell>
    );

  const c = detail.contest;
  const balance = Number(profile?.deposit_balance ?? 0) + Number(profile?.winnings_balance ?? 0);
  const after = Math.max(0, balance - stake);
  const insufficient = stake > balance;
  const alreadyJoined = !!detail.my_entry;

  return (
    <PageShell>
      <Button asChild variant="ghost" size="sm" className="mb-3">
        <Link to="/contest/$contestId" params={{ contestId }}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Back to contest
        </Link>
      </Button>

      <Card className="overflow-hidden border-0 shadow-elegant">
        <div className="bg-gradient-to-br from-primary to-blue-600 p-6 text-primary-foreground">
          <div className="text-[11px] font-bold uppercase tracking-wider opacity-90">
            Pick your stake
          </div>
          <h1 className="mt-1 text-2xl font-extrabold leading-tight">{c.title}</h1>
          <p className="mt-2 text-sm text-white/90">
            Choose how much you want to wager. The total prize pool is the sum of every
            player&apos;s stake — bigger stakes, bigger pool.
          </p>
        </div>
        <CardContent className="space-y-4 p-5">
          {/* Stake picker — Free / ₹2 / ₹5 / ₹10 / ₹25 */}
          <div>
            <div className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Your entry fee
            </div>
            <div className="grid grid-cols-5 gap-2">
              {(ENTRY_FEE_OPTIONS as readonly number[]).map((opt) => {
                const active = stake === opt;
                const cannot = opt > balance;
                return (
                  <button
                    key={opt}
                    type="button"
                    disabled={alreadyJoined}
                    onClick={() => setStake(opt)}
                    className={cn(
                      "relative flex flex-col items-center justify-center rounded-2xl border px-1 py-3 text-sm font-bold transition-all",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                      active
                        ? "border-primary bg-gradient-to-br from-primary to-blue-600 text-primary-foreground shadow-md"
                        : "border-border bg-card text-foreground hover:border-primary/40",
                      cannot && !active && "opacity-50",
                      alreadyJoined && "cursor-not-allowed opacity-60",
                    )}
                  >
                    <span className="text-base">
                      {opt === 0 ? "Free" : `₹${opt}`}
                    </span>
                    {opt === 0 && (
                      <span className="mt-0.5 inline-flex items-center gap-0.5 text-[9px] font-semibold uppercase tracking-wider opacity-80">
                        <Sparkles className="h-2.5 w-2.5" /> practice
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2 rounded-2xl bg-secondary/40 p-4">
            <Row label="Your stake" value={stake > 0 ? `₹${stake}` : "Free"} />
            <Row label="Wallet balance" value={`₹${balance.toFixed(0)}`} />
            <div className="my-1 h-px bg-border" />
            <Row label="After joining" value={`₹${after.toFixed(0)}`} bold />
          </div>

          <div className="flex items-start gap-2 rounded-xl bg-secondary/40 p-3 text-xs text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>
              Fair-play monitored. Prize pool is split among the top finishers
              (30/20/12/10/8/6/5/4/3/2 weights, auto-normalised).
            </span>
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" asChild disabled={joining} className="sm:min-w-[120px]">
              <Link to="/contest/$contestId" params={{ contestId }}>Cancel</Link>
            </Button>
            {alreadyJoined ? (
              <Button asChild className="bg-gradient-primary sm:min-w-[200px]">
                <Link to="/contest/$contestId" params={{ contestId }}>You&apos;re already in</Link>
              </Button>
            ) : insufficient ? (
              <Button asChild className="bg-gradient-primary sm:min-w-[200px]">
                <Link to="/wallet">
                  <IndianRupee className="mr-1 h-4 w-4" />
                  Add ₹{(stake - balance).toFixed(0)} to join
                </Link>
              </Button>
            ) : (
              <Button
                disabled={joining}
                onClick={async () => {
                  setJoining(true);
                  try {
                    const res = await join({ data: { contest_id: contestId, entry_fee: stake } });
                    toast.success(
                      stake > 0
                        ? `Joined for ₹${stake}!`
                        : "Joined Free battleground!",
                    );
                    // If the contest is currently LIVE, jump straight into the test
                    // instead of bouncing back to the contest page.
                    const now = Date.now();
                    const startsAt = new Date(c.starts_at).getTime();
                    const endsAt = new Date(c.ends_at).getTime();
                    const liveNow = now >= startsAt && now < endsAt;
                    const testId = res?.test_id ?? c.test_id;
                    if (liveNow && testId) {
                      nav({ to: "/quiz/$testId", params: { testId }, search: { mode: "exam" } });
                    } else {
                      nav({ to: "/contest/$contestId", params: { contestId } });
                    }
                  } catch (e) {
                    toast.error((e as Error)?.message ?? "Could not join");
                  } finally {
                    setJoining(false);
                  }
                }}
                className="bg-gradient-primary sm:min-w-[200px]"
              >
                {joining ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>Confirm &amp; Join {stake > 0 ? `· ₹${stake}` : "· Free"}</>
                )}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </PageShell>
  );
}

function Row({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn(bold && "text-base font-extrabold")}>{value}</span>
    </div>
  );
}
