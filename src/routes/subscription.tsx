import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Check, Crown, Loader2, Sparkles, Infinity as InfinityIcon, ShieldCheck } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { createRazorpayOrder, verifyRazorpayPayment } from "@/lib/razorpay.functions";
import { getMySubscription } from "@/lib/subscriptions.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/subscription")({
  head: () => ({ meta: [{ title: "Buy Premium — NEETIQ Prime" }, { name: "description", content: "Unlock unlimited AI tests, all mock tests, contests and analytics." }] }),
  component: BuyPremiumPage,
});

declare global { interface Window { Razorpay?: any } }
function loadRazorpay(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(false);
    if (window.Razorpay) return resolve(true);
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true); s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

const PLANS = [
  { id: "monthly" as const, name: "Premium Monthly", price: 49, period: "/ month", tagline: "Try it for a month", highlight: false },
  { id: "yearly" as const, name: "Premium Yearly", price: 299, period: "/ year", tagline: "Save 49% — best value", highlight: true },
];

const PERKS = [
  { icon: InfinityIcon, text: "Unlimited AI generated tests" },
  { icon: Check, text: "Access to ALL paid mock tests" },
  { icon: InfinityIcon, text: "Infinite bonus — unlock Flashcards & NCERT Highlights every day at zero cost" },
  { icon: Check, text: "Full analytics & weak-chapter map" },
  { icon: Check, text: "Priority support" },
  { icon: ShieldCheck, text: "Cancel anytime" },
];

function BuyPremiumPage() {
  const { user, profile, loading } = useAuth();
  const nav = useNavigate();
  const [busy, setBusy] = useState<null | "monthly" | "yearly">(null);
  const [isPremium, setIsPremium] = useState(false);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const create = useServerFn(createRazorpayOrder);
  const verify = useServerFn(verifyRazorpayPayment);
  const getSub = useServerFn(getMySubscription);

  useEffect(() => {
    if (!user) return;
    getSub().then((r) => {
      setIsPremium(r.isPremium);
      setExpiresAt(r.subscription?.expires_at ?? null);
    }).catch(() => {});
  }, [user]);

  async function buy(plan: "monthly" | "yearly", amount: number) {
    if (!user) { nav({ to: "/login" }); return; }
    setBusy(plan);
    try {
      const ok = await loadRazorpay();
      if (!ok) throw new Error("Could not load Razorpay");
      const order = await create({ data: { amount, purpose: "subscription" as any, plan } as any });
      await new Promise<void>((resolve) => {
        const rzp = new window.Razorpay({
          key: order.keyId, amount: order.amount, currency: order.currency,
          name: "NEETIQ Prime", description: `Premium ${plan}`, order_id: order.orderId,
          prefill: { name: profile?.full_name ?? "", email: user.email ?? "" },
          theme: { color: "#0ea5e9" },
          handler: async (resp: any) => {
            try {
              const r = await verify({ data: {
                razorpay_order_id: resp.razorpay_order_id,
                razorpay_payment_id: resp.razorpay_payment_id,
                razorpay_signature: resp.razorpay_signature,
              }});
              if (r.success) {
                toast.success("Welcome to Premium! 🎉");
                const sub = await getSub();
                setIsPremium(sub.isPremium);
                setExpiresAt(sub.subscription?.expires_at ?? null);
              }
            } catch (e: any) { toast.error(e?.message ?? "Verification failed"); }
            resolve();
          },
          modal: { ondismiss: () => { toast.info("Payment cancelled"); resolve(); } },
        });
        rzp.on("payment.failed", (resp: any) => { toast.error(resp?.error?.description ?? "Payment failed"); resolve(); });
        rzp.open();
      });
    } catch (e: any) { toast.error(e?.message ?? "Could not start payment"); }
    finally { setBusy(null); }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center animate-fade-in-up">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15 text-primary shadow-soft">
              <Crown className="h-7 w-7" />
            </div>
            <h1 className="mt-4 text-4xl font-bold tracking-tight">Buy Premium</h1>
            <p className="mt-3 text-muted-foreground">Unlimited AI tests, every paid mock, every contest — one subscription.</p>
          </div>

          {isPremium && (
              <Card className="mx-auto mt-8 max-w-2xl border-success/30 bg-success/10">
              <CardContent className="flex items-center gap-3 p-5">
                <Sparkles className="h-5 w-5 text-emerald-600" />
                <div className="text-sm">
                  <div className="font-semibold text-emerald-700 dark:text-emerald-400">You're Premium 👑</div>
                  {expiresAt && <div className="text-xs text-emerald-700/80 dark:text-emerald-400/80">Valid till {new Date(expiresAt).toLocaleDateString()}</div>}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Perks */}
          <div className="mx-auto mt-10 max-w-3xl rounded-2xl border border-border bg-card p-6 shadow-soft">
            <div className="text-sm font-semibold uppercase tracking-widest text-primary">What you unlock</div>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {PERKS.map((p) => (
                <li key={p.text} className="flex items-start gap-2 text-sm">
                  <p.icon className="mt-0.5 h-4 w-4 text-success shrink-0" />
                  {p.text}
                </li>
              ))}
            </ul>
          </div>

          {/* Plans */}
          <div className="mt-10 grid gap-5 md:grid-cols-2">
            {PLANS.map((p) => (
              <div key={p.id} className={cn(
                "relative rounded-3xl border p-7 shadow-soft hover-lift",
                p.highlight ? "border-primary/35 bg-gradient-to-br from-primary/10 via-card to-accent/10 shadow-soft ring-1 ring-primary/15" : "border-border bg-card",
              )}>
                {p.highlight && (
                  <span className="absolute -top-3 left-7 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground shadow-soft">
                    Best value
                  </span>
                )}
                <div className="text-sm font-semibold">{p.name}</div>
                <div className="mt-1 text-xs text-muted-foreground">{p.tagline}</div>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-4xl font-bold">₹{p.price}</span>
                  <span className="text-sm text-muted-foreground">{p.period}</span>
                </div>
                <Button
                  className={cn("mt-6 w-full", p.highlight && "bg-gradient-primary shadow-elegant hover:opacity-95")}
                  disabled={busy !== null || loading || isPremium}
                  onClick={() => buy(p.id, p.price)}
                >
                  {busy === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : isPremium ? "Already Premium" : `Buy for ₹${p.price}`}
                </Button>
                <p className="mt-3 text-center text-[11px] text-muted-foreground">Powered by Razorpay · Secure checkout</p>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
