import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { PageShell } from "@/components/page-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Copy, Gift, Users, Sparkles, Crown, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { applyReferralCode, getMyReferralInfo, generateReferralCode } from "@/lib/referrals.functions";

export const Route = createFileRoute("/referrals")({
  head: () => ({ meta: [{ title: "Refer & Earn — NEET Track" }] }),
  component: ReferralsPage,
});

function ReferralsPage() {
  const { user, loading, refresh } = useAuth();
  const nav = useNavigate();
  const fetchInfo = useServerFn(getMyReferralInfo);
  const apply = useServerFn(applyReferralCode);
  const generate = useServerFn(generateReferralCode);
  const [info, setInfo] = useState<Awaited<ReturnType<typeof fetchInfo>> | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [generating, setGenerating] = useState(false);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const r = await generate();
      setInfo((prev) => (prev ? { ...prev, code: r.code } : prev));
      toast.success("Referral code ready!");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not generate code");
    } finally { setGenerating(false); }
  };

  useEffect(() => { if (!loading && !user) nav({ to: "/login" }); }, [user, loading, nav]);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    const reload = () => {
      fetchInfo().then((d) => { if (alive) setInfo(d); }).catch(() => {});
    };
    reload();
    // Live updates: when a new referral row mentioning me as the referrer is
    // inserted, refresh the dashboard immediately.
    const ch = supabase
      .channel(`referrals-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "referrals", filter: `referrer_id=eq.${user.id}` },
        () => reload(),
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${user.id}` },
        () => reload(),
      )
      .subscribe();
    const onFocus = () => reload();
    const onVis = () => { if (!document.hidden) reload(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);
    const poll = setInterval(reload, 30_000);
    return () => {
      alive = false;
      supabase.removeChannel(ch);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
      clearInterval(poll);
    };
  }, [user?.id, fetchInfo]);

  const link = info?.code ? `${typeof window !== "undefined" ? window.location.origin : ""}/login?ref=${info.code}` : "";

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied!");
  };

  const submit = async () => {
    setBusy(true);
    try {
      await apply({ data: { code } });
      toast.success("+10 bonus credited!");
      setCode("");
      await refresh();
      const fresh = await fetchInfo();
      setInfo(fresh);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally { setBusy(false); }
  };

  return (
    <PageShell eyebrow="Bonus" title="Refer & Earn" description="Share your code. Both you and your friend earn bonus.">
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="space-y-3 p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
              <Gift className="h-4 w-4 text-amber-600" /> Your referral code
            </div>
            {!info ? <Loader2 className="h-4 w-4 animate-spin" /> : !info.code ? (
              <>
                <div className="rounded-xl border border-dashed border-primary/30 bg-primary/5 p-4 text-center text-sm text-muted-foreground">
                  You don't have a referral code yet.
                </div>
                <Button onClick={handleGenerate} disabled={generating} className="w-full bg-gradient-primary">
                  {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Sparkles className="mr-1.5 h-4 w-4" /> Generate my code</>}
                </Button>
                <p className="text-xs text-muted-foreground">
                  Generate once and share to earn bonus when friends sign up.
                </p>
              </>
            ) : (
              <>
                <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 text-center">
                  <div className="text-3xl font-bold tracking-widest">{info.code}</div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => copy(info.code!)}>
                    <Copy className="mr-1.5 h-4 w-4" /> Copy code
                  </Button>
                  <Button className="flex-1 bg-gradient-primary" onClick={() => copy(link)}>
                    <Copy className="mr-1.5 h-4 w-4" /> Copy link
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Each friend who joins with your code: <b>+5 bonus</b> for you, <b>+10 bonus</b> for them.
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
              <Gift className="h-4 w-4 text-emerald-600" /> Got a code from a friend?
            </div>
            {info?.hasUsedCode ? (
              <div className="rounded-lg border bg-secondary/40 p-3 text-sm">You've already redeemed a referral code.</div>
            ) : (
              <>
                <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="ENTER CODE" maxLength={20} />
                <Button onClick={submit} disabled={busy || code.length < 4} className="w-full">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Claim +10 bonus"}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6 border-amber-500/40 bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-transparent">
        <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-amber-500/15 p-2.5"><Crown className="h-5 w-5 text-amber-600" /></div>
            <div>
              <div className="text-sm font-bold">Join Dedicated Programs</div>
              <p className="text-xs text-muted-foreground">
                Earn up to <b>80%</b> revenue share on users you bring in. Apply once, approved by admin.
              </p>
            </div>
          </div>
          <Button asChild className="bg-gradient-to-r from-amber-600 to-orange-600 text-white">
            <Link to="/dedicated-program">Join now <ArrowRight className="ml-1.5 h-4 w-4" /></Link>
          </Button>
        </CardContent>
      </Card>


      <div className="mt-6">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          <Users className="mr-1.5 inline h-4 w-4" /> Friends you've invited ({info?.invited.length ?? 0})
        </h3>
        {!info?.invited.length ? (
          <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">No referrals yet. Share your code above!</CardContent></Card>
        ) : (
          <div className="space-y-2">
            {info.invited.map((r) => (
              <Card key={r.id}>
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <div className="text-sm font-medium">{r.profiles?.full_name ?? r.profiles?.email ?? "User"}</div>
                    <div className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</div>
                  </div>
                  <div className="text-sm font-bold text-emerald-600">+{r.referrer_bonus} bonus</div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </PageShell>
  );
}
