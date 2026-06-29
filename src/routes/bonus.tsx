import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { SiteHeader } from "@/components/site-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, KeyRound, Gift, ExternalLink, ClipboardPaste, ShoppingCart, Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { claimBonusKey } from "@/lib/bonus.functions";
import { createRazorpayOrder, verifyRazorpayPayment } from "@/lib/razorpay.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/bonus")({
  head: () => ({ meta: [{ title: "Bonus Keys — NEETIQ Prime" }] }),
  component: BonusPage,
});

declare global { interface Window { Razorpay?: any } }
function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(false);
    if (window.Razorpay) return resolve(true);
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

// Pricing: ₹10 → 100 bonus (i.e. ₹1 = 10 bonus). Minimum purchase is 100 bonus (₹10).
const BONUS_PER_RUPEE = 10;
const PACKS = [
  { rupees: 10, label: "Starter" },
  { rupees: 50, label: "Popular", highlight: true },
  { rupees: 100, label: "Value" },
  { rupees: 500, label: "Pro" },
];

function BonusPage() {
  const { user, profile, loading, refresh } = useAuth();
  const nav = useNavigate();
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "already_used" | "not_found" | "error">("idle");
  const [buying, setBuying] = useState<number | null>(null);
  const [customAmt, setCustomAmt] = useState<string>("");

  const claim = useServerFn(claimBonusKey);
  const createOrder = useServerFn(createRazorpayOrder);
  const verifyPayment = useServerFn(verifyRazorpayPayment);

  useEffect(() => { if (!loading && !user) nav({ to: "/login" }); }, [user, loading, nav]);

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setKey(text.trim().toUpperCase().replace(/[^A-F0-9]/g, "").slice(0, 12));
    } catch {
      toast.error("Could not paste. Please paste manually.");
    }
  };

  const handleClaim = async () => {
    const clean = key.trim().toUpperCase().replace(/[^A-F0-9]/g, "");
    if (clean.length !== 12) { toast.error("Key must be exactly 12 characters (0-9, A-F)."); return; }
    setBusy(true); setStatus("idle");
    try {
      const r = await claim({ data: { key: clean } });
      if (r.ok) { setStatus("success"); toast.success(`✅ Bonus unlocked! +${r.bonus} bonus credited.`); await refresh(); setKey(""); }
      else if (r.error === "already_used") { setStatus("already_used"); toast.error("❌ This key has already been used."); }
      else if (r.error === "not_found") { setStatus("not_found"); toast.error("❌ Invalid key, get one from the Telegram bot."); }
      else { setStatus("error"); toast.error("⚠️ Something went wrong, try again."); }
    } catch (e: any) { setStatus("error"); toast.error(e?.message ?? "⚠️ Something went wrong, try again."); }
    finally { setBusy(false); }
  };

  const handleBuy = async (rupees: number) => {
    if (!user) return;
    if (!Number.isFinite(rupees) || rupees < 10) {
      toast.error("Minimum purchase is ₹10 (100 bonus).");
      return;
    }
    const amount = Math.floor(rupees);
    setBuying(amount);
    try {
      const ok = await loadRazorpayScript();
      if (!ok) throw new Error("Could not load payment SDK");
      const order = await createOrder({ data: { amount, purpose: "bonus" } });
      await new Promise<void>((resolve) => {
        const rzp = new window.Razorpay({
          key: order.keyId, amount: order.amount, currency: order.currency,
          name: "NEETIQ Prime",
          description: `Bonus pack (₹${amount} → ${amount * BONUS_PER_RUPEE} bonus)`,
          order_id: order.orderId,
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
                toast.success(r.credited ? `+${(r as any).bonusAmount ?? amount * BONUS_PER_RUPEE} bonus credited` : "Already credited");
                await refresh();
              }
            } catch (e: any) { toast.error(e?.message ?? "Verification failed"); }
            resolve();
          },
          modal: { ondismiss: () => { toast.info("Payment cancelled"); resolve(); } },
        });
        rzp.on("payment.failed", (resp: any) => { toast.error(resp?.error?.description ?? "Payment failed"); resolve(); });
        rzp.open();
      });
    } catch (e: any) { toast.error(e?.message ?? "Purchase failed"); }
    finally { setBuying(null); }
  };

  if (loading || !user) {
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <div className="mx-auto max-w-md px-3 py-4">
      <div className="mb-3 text-center">
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">Rewards</div>
        <h1 className="mt-0.5 text-xl font-bold tracking-tight">Bonus</h1>
        <p className="text-[11px] text-muted-foreground">Buy bonus credits or redeem a key.</p>
      </div>

      <div className="space-y-3">
        {/* Buy bonus packs */}
        <Card className="border-0 shadow-elegant">
          <CardContent className="space-y-3 p-3.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
              <ShoppingCart className="h-3.5 w-3.5 text-primary" /> Buy Bonus
              <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary">₹10 = 100 bonus</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {PACKS.map((p) => (
                <button
                  key={p.rupees}
                  onClick={() => handleBuy(p.rupees)}
                  disabled={buying !== null}
                  className={`relative flex flex-col items-start gap-0.5 rounded-xl border p-2.5 text-left shadow-soft transition-transform hover:-translate-y-0.5 disabled:opacity-60 ${
                    p.highlight ? "border-primary/40 bg-gradient-to-br from-primary/10 to-blue-500/10" : "border-border bg-secondary/40"
                  }`}
                >
                  {p.highlight && (
                    <span className="absolute right-1.5 top-1.5 inline-flex items-center gap-1 rounded-full bg-primary px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-primary-foreground">
                      <Sparkles className="h-2 w-2" /> {p.label}
                    </span>
                  )}
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{!p.highlight ? p.label : "\u00A0"}</div>
                  <div className="text-xl font-extrabold leading-none">₹{p.rupees}</div>
                  <div className="text-[11px] text-foreground/70">+{p.rupees * BONUS_PER_RUPEE} bonus</div>
                  {buying === p.rupees ? <Loader2 className="mt-1 h-3.5 w-3.5 animate-spin text-primary" /> : null}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <Input
                value={customAmt}
                onChange={(e) => setCustomAmt(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
                placeholder="Custom ₹ (min 10)"
                inputMode="numeric"
                className="h-9 flex-1 text-sm"
              />
              <Button
                onClick={() => handleBuy(Number(customAmt))}
                disabled={buying !== null || !customAmt || Number(customAmt) < 10}
                className="h-9 shrink-0 bg-primary text-primary-foreground"
                size="sm"
              >
                {buying !== null && String(buying) === customAmt ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Buy"}
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground">Powered by Razorpay · Secure · Min 100 bonus per purchase</p>
          </CardContent>
        </Card>

        {/* Key input card */}
        <Card className="border-0 shadow-elegant">
          <CardContent className="space-y-2.5 p-3.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
              <KeyRound className="h-3.5 w-3.5 text-primary" /> Redeem Key
            </div>

            <div className="flex gap-2">
              <Input
                value={key}
                onChange={(e) => setKey(e.target.value.toUpperCase().replace(/[^A-F0-9]/g, "").slice(0, 12))}
                placeholder="Activation key"
                maxLength={12}
                className="h-9 flex-1 font-mono text-xs tracking-widest"
              />
              <Button onClick={handlePaste} variant="outline" size="sm" className="h-9 shrink-0 gap-1">
                <ClipboardPaste className="h-3.5 w-3.5" /> Paste
              </Button>
            </div>

            <Button
              onClick={handleClaim}
              disabled={busy || key.length !== 12}
              className="h-9 w-full gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"
              size="sm"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Gift className="h-3.5 w-3.5" />}
              Claim Bonus
            </Button>

            {status === "success" && <div className="rounded-md bg-emerald-50 p-2 text-xs font-medium text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">✅ Bonus unlocked!</div>}
            {status === "already_used" && <div className="rounded-md bg-rose-50 p-2 text-xs font-medium text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">❌ This key has already been used.</div>}
            {status === "not_found" && <div className="rounded-md bg-amber-50 p-2 text-xs font-medium text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">❌ Invalid key.</div>}
            {status === "error" && <div className="rounded-md bg-amber-50 p-2 text-xs font-medium text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">⚠️ Something went wrong.</div>}
          </CardContent>
        </Card>

        {/* Get free keys */}
        <Card className="border-0 shadow-soft">
          <CardContent className="p-3">
            <a
              href="https://t.me/NP_KEYGEN_BOT"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between rounded-lg border border-border bg-secondary/40 px-3 py-2 text-xs transition-colors hover:bg-secondary"
            >
              <span className="flex items-center gap-1.5"><Gift className="h-3.5 w-3.5 text-amber-600" /> Get free key from Telegram bot</span>
              <ExternalLink className="h-3 w-3 text-muted-foreground" />
            </a>
          </CardContent>
        </Card>
      </div>
      </div>
    </div>
  );
}
