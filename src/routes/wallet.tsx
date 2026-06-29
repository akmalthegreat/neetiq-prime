import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { PageShell } from "@/components/page-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Loader2, Wallet as WalletIcon, Plus, ArrowDownToLine, ArrowUpFromLine, Trophy, Gift, PiggyBank, Crown } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { createRazorpayOrder, verifyRazorpayPayment } from "@/lib/razorpay.functions";
import { requestWithdrawal, listMyWithdrawals } from "@/lib/wallet.functions";

export const Route = createFileRoute("/wallet")({
  head: () => ({ meta: [{ title: "Wallet — NEETIQ Prime" }] }),
  component: WalletPage,
});

type Txn = { id: string; amount: number; type: string; bucket?: string; status: string; reference: string | null; created_at: string; meta?: { reason?: string | null } | null };
type Wd = { id: string; amount: number; status: string; upi_or_note: string; admin_note: string | null; created_at: string; processed_at: string | null };

const PRESETS = [10, 20, 50, 100, 250];
const MIN_DEPOSIT = 10;
const MIN_WITHDRAW = 20;

declare global { interface Window { Razorpay?: any } }
function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(false);
    if (window.Razorpay) return resolve(true);
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true); s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

function WalletPage() {
  const { user, profile, loading, refresh } = useAuth();
  const nav = useNavigate();
  const [txns, setTxns] = useState<Txn[] | null>(null);
  const [wds, setWds] = useState<Wd[] | null>(null);
  const [rechargeOpen, setRechargeOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [amount, setAmount] = useState<number>(100);
  const [wdAmount, setWdAmount] = useState<number>(50);
  const [upi, setUpi] = useState("");
  const [paying, setPaying] = useState(false);
  const [buyingBonus, setBuyingBonus] = useState(false);
  const [submittingWd, setSubmittingWd] = useState(false);

  const createOrder = useServerFn(createRazorpayOrder);
  const verifyPayment = useServerFn(verifyRazorpayPayment);
  const reqWd = useServerFn(requestWithdrawal);
  const listWd = useServerFn(listMyWithdrawals);

  useEffect(() => { if (!loading && !user) nav({ to: "/login" }); }, [user, loading, nav]);

  const loadAll = async () => {
    if (!user) return;
    const [{ data }, wdRes] = await Promise.all([
      supabase.from("wallet_transactions").select("id,amount,type,bucket,status,reference,created_at,meta")
        .eq("user_id", user.id).order("created_at", { ascending: false }).limit(30),
      listWd().catch(() => []),
    ]);
    setTxns((data ?? []) as Txn[]);
    setWds(wdRes as Wd[]);
  };
  useEffect(() => { loadAll(); }, [user?.id]);

  const deposit = Number(profile?.deposit_balance ?? 0);
  const winnings = Number(profile?.winnings_balance ?? 0);
  const bonus = Number(profile?.bonus_balance ?? 0);
  // Wallet balance excludes bonus (matches server-side `wallet_balance` used for joins/checks).
  const total = deposit + winnings;
  const withdrawable = deposit + winnings;

  const handleRecharge = async () => {
    if (!user) return;
    const amt = Math.round(amount);
    if (!amt || amt < MIN_DEPOSIT) return toast.error(`Minimum recharge is ₹${MIN_DEPOSIT}`);
    setPaying(true);
    try {
      const ok = await loadRazorpayScript();
      if (!ok) throw new Error("Could not load Razorpay");
      const order = await createOrder({ data: { amount: amt } });
      await new Promise<void>((resolve) => {
        const rzp = new window.Razorpay({
          key: order.keyId, amount: order.amount, currency: order.currency,
          name: "NEETIQ Prime", description: "Wallet recharge", order_id: order.orderId,
          prefill: { name: profile?.full_name ?? "", email: user.email ?? "" },
          theme: { color: "#0ea5e9" },
          handler: async (resp: any) => {
            try {
              const r = await verifyPayment({ data: {
                razorpay_order_id: resp.razorpay_order_id,
                razorpay_payment_id: resp.razorpay_payment_id,
                razorpay_signature: resp.razorpay_signature,
              }});
              if (r.success) {
                toast.success(r.credited ? `₹${r.amount} added to deposits` : "Already credited");
                await refresh(); await loadAll(); setRechargeOpen(false);
              }
            } catch (e: any) { toast.error(e?.message ?? "Verification failed"); }
            resolve();
          },
          modal: { ondismiss: () => { toast.info("Payment cancelled"); resolve(); } },
        });
        rzp.on("payment.failed", (resp: any) => { toast.error(resp?.error?.description ?? "Payment failed"); resolve(); });
        rzp.open();
      });
    } catch (e: any) { toast.error(e?.message ?? "Recharge failed"); }
    finally { setPaying(false); }
  };

  const handleBuyBonus = async () => {
    if (!user) return;
    setBuyingBonus(true);
    try {
      const ok = await loadRazorpayScript();
      if (!ok) throw new Error("Could not load Razorpay");
      const order = await createOrder({ data: { amount: 10, purpose: "bonus" } });
      await new Promise<void>((resolve) => {
        const rzp = new window.Razorpay({
          key: order.keyId, amount: order.amount, currency: order.currency,
          name: "NEETIQ Prime", description: "Bonus pack (₹10 → 100 bonus)", order_id: order.orderId,
          prefill: { name: profile?.full_name ?? "", email: user.email ?? "" },
          theme: { color: "#0ea5e9" },
          handler: async (resp: any) => {
            try {
              const r = await verifyPayment({ data: {
                razorpay_order_id: resp.razorpay_order_id,
                razorpay_payment_id: resp.razorpay_payment_id,
                razorpay_signature: resp.razorpay_signature,
              }});
              if (r.success) {
                toast.success(r.credited ? `+${(r as any).bonusAmount ?? 100} bonus credited` : "Already credited");
                await refresh(); await loadAll();
              }
            } catch (e: any) { toast.error(e?.message ?? "Verification failed"); }
            resolve();
          },
          modal: { ondismiss: () => { toast.info("Payment cancelled"); resolve(); } },
        });
        rzp.on("payment.failed", (resp: any) => { toast.error(resp?.error?.description ?? "Payment failed"); resolve(); });
        rzp.open();
      });
    } catch (e: any) { toast.error(e?.message ?? "Bonus pack purchase failed"); }
    finally { setBuyingBonus(false); }
  };

  const handleWithdraw = async () => {
    const amt = Math.round(wdAmount);
    if (amt < MIN_WITHDRAW) return toast.error(`Minimum withdrawal is ₹${MIN_WITHDRAW}`);
    if (amt > withdrawable) return toast.error("Amount exceeds withdrawable balance");
    if (upi.trim().length < 3) return toast.error("Enter UPI ID");
    setSubmittingWd(true);
    try {
      await reqWd({ data: { amount: amt, upi_or_note: upi.trim() } });
      toast.success("Withdrawal requested. Admin will pay shortly.");
      setWithdrawOpen(false); setUpi(""); await refresh(); await loadAll();
    } catch (e: any) { toast.error(e?.message ?? "Could not request"); }
    finally { setSubmittingWd(false); }
  };

  if (loading || !user) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <PageShell eyebrow="Your money" title="Wallet" description="Recharge, withdraw winnings, and track every rupee.">
      {/* Main balance card */}
      <Card className="overflow-hidden border-0 shadow-elegant">
        <div className="bg-gradient-to-br from-primary to-blue-600 p-6 text-primary-foreground">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15"><WalletIcon className="h-6 w-6" /></div>
              <div>
                <div className="text-xs uppercase tracking-widest opacity-80">Total balance</div>
                <div className="text-3xl font-extrabold">₹{total.toFixed(2)}</div>
              </div>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-3 gap-2 text-xs">
            <BucketChip icon={PiggyBank} label="Deposits" value={deposit} />
            <BucketChip icon={Trophy} label="Winnings" value={winnings} />
            <BucketChip icon={Gift} label="Bonus" value={bonus} />
          </div>
          <div className="mt-5 grid grid-cols-2 gap-2">
            <Dialog open={rechargeOpen} onOpenChange={setRechargeOpen}>
              <DialogTrigger asChild>
                <Button className="bg-white text-primary hover:bg-white/90"><ArrowDownToLine className="mr-1.5 h-4 w-4" /> Recharge</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Add money</DialogTitle></DialogHeader>
                <div className="grid grid-cols-5 gap-1.5">
                  {PRESETS.map((v) => (
                    <button key={v} onClick={() => setAmount(v)}
                      className={`rounded-lg border px-2 py-2 text-sm font-semibold ${amount === v ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-secondary"}`}>₹{v}</button>
                  ))}
                </div>
                <Input type="number" min={MIN_DEPOSIT} max={100000} value={amount}
                  onChange={(e) => setAmount(Math.max(0, +e.target.value))} placeholder="Amount in ₹" />
                <p className="text-[11px] text-muted-foreground">Min ₹{MIN_DEPOSIT}. Powered by Razorpay.</p>
                <DialogFooter>
                  <Button onClick={handleRecharge} disabled={paying} className="bg-gradient-primary">
                    {paying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="mr-1 h-4 w-4" />} Pay ₹{amount}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
              <DialogTrigger asChild>
                <Button variant="secondary" className="bg-white/20 text-white hover:bg-white/30 border-0">
                  <ArrowUpFromLine className="mr-1.5 h-4 w-4" /> Withdraw
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Withdraw winnings</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div className="rounded-lg bg-secondary p-3 text-xs">
                    <div className="flex justify-between"><span className="text-muted-foreground">Withdrawable</span><span className="font-bold">₹{withdrawable.toFixed(2)}</span></div>
                    <div className="mt-1 text-[10px] text-muted-foreground">Bonus ₹{bonus.toFixed(0)} cannot be withdrawn (use for contests).</div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Amount (min ₹{MIN_WITHDRAW})</Label>
                    <Input type="number" min={MIN_WITHDRAW} max={withdrawable} value={wdAmount}
                      onChange={(e) => setWdAmount(Math.max(0, +e.target.value))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>UPI ID</Label>
                    <Input value={upi} onChange={(e) => setUpi(e.target.value)} placeholder="yourname@upi" />
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={handleWithdraw} disabled={submittingWd} className="bg-gradient-primary">
                    {submittingWd ? <Loader2 className="h-4 w-4 animate-spin" /> : "Request withdrawal"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </Card>

      {/* Earn / Buy bonus */}
      <Card className="mt-4 border-0 shadow-elegant">
        <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
              <Gift className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-bold">Earn Bonus</div>
              <div className="text-xs text-muted-foreground">Claim free keys, buy bonus packs, and unlock contests &amp; mocks.</div>
            </div>
          </div>
          <Button asChild className="bg-gradient-primary">
            <Link to="/bonus"><Gift className="mr-1 h-4 w-4" /> Earn Bonus</Link>
          </Button>
        </CardContent>
      </Card>

      {/* Premium CTA */}
      <Card className="mt-4 overflow-hidden border-0 shadow-elegant">
        <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950/30 dark:to-amber-900/20">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-primary text-primary-foreground shadow-glow">
              <Crown className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-bold">Go Premium 👑</div>
              <div className="text-xs text-muted-foreground">Unlimited AI tests + all paid mocks. From ₹299/mo.</div>
            </div>
          </div>
          <Button asChild className="bg-gradient-primary">
            <Link to="/subscription">Subscribe</Link>
          </Button>
        </CardContent>
      </Card>


      {wds && wds.length > 0 && (
        <section className="mt-6">
          <div className="mb-2 text-sm font-bold">Withdrawals</div>
          <Card><CardContent className="p-0">
            <ul className="divide-y divide-border">
              {wds.map((w) => (
                <li key={w.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold">₹{Number(w.amount).toFixed(2)} → {w.upi_or_note}</div>
                    <div className="text-[11px] text-muted-foreground">{new Date(w.created_at).toLocaleString()}</div>
                    {w.admin_note && <div className="mt-0.5 text-[11px] italic text-muted-foreground">"{w.admin_note}"</div>}
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                    w.status === "paid" ? "bg-emerald-100 text-emerald-700"
                    : w.status === "rejected" ? "bg-rose-100 text-rose-700"
                    : "bg-amber-100 text-amber-700"
                  }`}>{w.status}</span>
                </li>
              ))}
            </ul>
          </CardContent></Card>
        </section>
      )}

      {/* Transactions */}
      <section className="mt-6">
        <div className="mb-2 text-sm font-bold">Recent transactions</div>
        <Card><CardContent className="p-0">
          {txns === null ? <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
            : txns.length === 0 ? <div className="py-8 text-center text-sm text-muted-foreground">No transactions yet</div>
            : <ul className="divide-y divide-border">
                {txns.map((t) => {
                  const reason = t.meta?.reason?.trim();
                  return (
                  <li key={t.id} className="flex items-start justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold capitalize">{t.type.replace(/_/g, " ")}</div>
                      <div className="truncate text-[11px] text-muted-foreground">{new Date(t.created_at).toLocaleString()} · {t.status}</div>
                      {reason ? (
                        <div className="mt-1 break-words text-[12px] italic text-muted-foreground">"{reason}"</div>
                      ) : null}
                    </div>
                    <div className={`text-sm font-bold ${Number(t.amount) >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                      {Number(t.amount) >= 0 ? "+" : ""}₹{Number(t.amount).toFixed(2)}
                    </div>
                  </li>
                  );
                })}
              </ul>}
        </CardContent></Card>
      </section>
    </PageShell>
  );
}

function BucketChip({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number }) {
  return (
    <div className="rounded-xl bg-white/15 px-2 py-2 backdrop-blur">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide opacity-80"><Icon className="h-3 w-3" /> {label}</div>
      <div className="mt-0.5 text-base font-bold">₹{Number(value).toFixed(0)}</div>
    </div>
  );
}
