import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { PageShell } from "@/components/page-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Loader2,
  Users,
  IndianRupee,
  TrendingUp,
  Wallet,
  Crown,
  Link2,
  Tag,
  Pencil,
  Copy,
  Clock,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Share2,
  ShieldCheck,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import {
  applyForCollaboratorProgram,
  getMyCollaboratorProgram,
} from "@/lib/collaborators.functions";

export const Route = createFileRoute("/collaborators")({
  head: () => ({ meta: [{ title: "Collaboration & Partner Program — NEET Track" }] }),
  component: CollaboratorsPage,
});

const SHARES = [
  { pct: 80, min: 100, label: "80% Revenue Share", desc: "Top tier · Min withdrawal ₹100" },
  { pct: 60, min: 50,  label: "60% Revenue Share", desc: "Standard tier · Min withdrawal ₹50" },
  { pct: 40, min: 25,  label: "40% Revenue Share", desc: "Starter tier · Min withdrawal ₹25" },
] as const;

function CollaboratorsPage() {
  const { user, isAdmin, loading } = useAuth();
  const nav = useNavigate();
  const fetch = useServerFn(getMyCollaboratorProgram);
  const applyFn = useServerFn(applyForCollaboratorProgram);

  const [data, setData] = useState<Awaited<ReturnType<typeof fetch>> | null>(null);

  // Application form state
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [email, setEmail] = useState("");
  const [promoAsset, setPromoAsset] = useState("");
  const [months, setMonths] = useState(12);
  const [sharePct, setSharePct] = useState<40 | 60 | 80>(80);
  const [terms, setTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && !user) nav({ to: "/login" });
  }, [user, loading, nav]);

  useEffect(() => {
    if (user?.email && !email) setEmail(user.email);
  }, [user, email]);

  const reload = async () => {
    try {
      const d = await fetch();
      setData(d);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    if (!user) return;
    reload();
    const interval = setInterval(reload, 30_000);
    return () => clearInterval(interval);
  }, [user?.id]);

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!terms) {
      toast.error("Please accept the program terms to proceed.");
      return;
    }
    setSubmitting(true);
    try {
      await applyFn({
        data: {
          name: name.trim(),
          contact: contact.trim(),
          email: email.trim(),
          promo_asset: promoAsset.trim(),
          months,
          share_pct: sharePct,
          accepted_terms: true,
        },
      });
      toast.success("Application submitted successfully! Our team will review and approve it shortly.");
      await reload();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to submit application");
    } finally {
      setSubmitting(false);
    }
  };

  const copyText = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied to clipboard`);
    } catch {
      toast.error("Could not copy");
    }
  };

  if (!data) {
    return (
      <PageShell eyebrow="Partnership" title="Collaborators">
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </PageShell>
    );
  }

  const p = data.program;

  // Case 1: No application submitted yet
  if (!p) {
    return (
      <PageShell
        eyebrow="Partnership"
        title="Become a NEET Track Collaborator"
        description="Earn up to 80% revenue share by introducing NEET aspirants, coaching communities, and students to NEET Track."
      >
        <div className="mx-auto max-w-3xl space-y-6">
          {/* Hero Banner */}
          <Card className="overflow-hidden border-teal-500/30 bg-gradient-to-br from-teal-500/10 via-emerald-500/5 to-transparent shadow-sm">
            <CardContent className="p-6 sm:p-8">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-teal-600 text-white shadow-md">
                  <Crown className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-xl font-black tracking-tight text-slate-900 dark:text-white sm:text-2xl">
                    High-Yield Partnership &amp; Affiliate Program
                  </h2>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                    Get custom referral links, branded discount coupons for your audience, real-time analytics, and guaranteed payouts.
                  </p>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-teal-200/60 bg-white/70 p-3 dark:border-teal-900/40 dark:bg-slate-900/60">
                  <div className="text-xs font-bold text-teal-600 dark:text-teal-400">Up to 80% Share</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">Highest payout rate on student subscriptions.</div>
                </div>
                <div className="rounded-xl border border-emerald-200/60 bg-white/70 p-3 dark:border-emerald-900/40 dark:bg-slate-900/60">
                  <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400">Branded Coupons</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">Special student discounts under your channel name.</div>
                </div>
                <div className="rounded-xl border border-sky-200/60 bg-white/70 p-3 dark:border-sky-900/40 dark:bg-slate-900/60">
                  <div className="text-xs font-bold text-sky-600 dark:text-sky-400">Instant Admin Review</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">Quick approval and dedicated dashboard access.</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Application Form */}
          <Card className="border-border shadow-md">
            <CardContent className="p-6 sm:p-8">
              <form onSubmit={handleApply} className="space-y-5">
                <div>
                  <h3 className="text-lg font-bold">Collaborator Application Form</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Fill in your details below. Once submitted, our team will review and activate your dashboard.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="collab-name" className="text-xs font-bold">Full Name *</Label>
                    <Input
                      id="collab-name"
                      required
                      placeholder="e.g. Dr. Aryan Sharma"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="collab-email" className="text-xs font-bold">Email Address *</Label>
                    <Input
                      id="collab-email"
                      type="email"
                      required
                      placeholder="you@domain.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="collab-contact" className="text-xs font-bold">
                    WhatsApp / Telegram / Phone Number *
                  </Label>
                  <Input
                    id="collab-contact"
                    required
                    placeholder="+91 9876543210 or @telegram_handle"
                    value={contact}
                    onChange={(e) => setContact(e.target.value)}
                  />
                  <p className="text-[10px] text-muted-foreground">Used for admin communication, approval updates, and payment coordination.</p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="collab-asset" className="text-xs font-bold">
                    Promotion Channel / Social Profiles / Audience Details *
                  </Label>
                  <Textarea
                    id="collab-asset"
                    required
                    rows={3}
                    placeholder="e.g. YouTube channel link, Telegram group (5k+ NEET students), Instagram page, coaching institute, or mentor community..."
                    value={promoAsset}
                    onChange={(e) => setPromoAsset(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-bold">Preferred Revenue Share Tier *</Label>
                  <RadioGroup
                    value={String(sharePct)}
                    onValueChange={(v) => setSharePct(Number(v) as 40 | 60 | 80)}
                    className="grid grid-cols-1 gap-2.5 sm:grid-cols-3"
                  >
                    {SHARES.map((s) => (
                      <label
                        key={s.pct}
                        className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-all ${
                          sharePct === s.pct
                            ? "border-teal-500 bg-teal-50/50 shadow-xs dark:border-teal-500/80 dark:bg-teal-950/40"
                            : "border-border hover:border-slate-300 dark:hover:border-slate-700"
                        }`}
                      >
                        <RadioGroupItem value={String(s.pct)} className="mt-0.5" />
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-900 dark:text-white">{s.label}</div>
                          <div className="text-[10px] text-muted-foreground">{s.desc}</div>
                        </div>
                      </label>
                    ))}
                  </RadioGroup>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="collab-months" className="text-xs font-bold">Program Term (Months)</Label>
                  <Input
                    id="collab-months"
                    type="number"
                    min={1}
                    max={60}
                    value={months}
                    onChange={(e) => setMonths(Math.max(1, Math.min(60, Number(e.target.value) || 12)))}
                  />
                </div>

                <div className="flex items-start gap-2.5 pt-2">
                  <Checkbox
                    id="collab-terms"
                    checked={terms}
                    onCheckedChange={(c) => setTerms(Boolean(c))}
                    className="mt-0.5"
                  />
                  <Label htmlFor="collab-terms" className="text-xs font-normal text-muted-foreground leading-snug cursor-pointer">
                    I agree to ethical promotion guidelines, accurate representation of NEET Track study tools, and the collaborator terms.
                  </Label>
                </div>

                <Button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-xl bg-gradient-to-r from-teal-600 via-emerald-600 to-teal-600 hover:from-teal-500 hover:to-emerald-500 text-white font-bold shadow-md shadow-teal-500/20 py-2.5 transition-all"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting Application...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" /> Submit Application for Approval
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </PageShell>
    );
  }

  // Case 2: Application is Pending
  if (p.status === "pending") {
    return (
      <PageShell
        eyebrow="Partnership"
        title="Application Under Review"
        description="Thank you for applying to the NEET Track Collaborator Program."
      >
        <div className="mx-auto max-w-2xl space-y-4">
          <Card className="border-amber-400/40 bg-gradient-to-br from-amber-500/10 via-amber-400/5 to-transparent shadow-sm">
            <CardContent className="space-y-4 p-6 sm:p-8 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400">
                <Clock className="h-7 w-7" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Your Application is Being Reviewed</h2>
                <p className="mt-1 text-sm text-muted-foreground max-w-md mx-auto">
                  Our admin team is reviewing your profile and promotion channels. Once approved, your custom referral link, coupon code, and commission tracking will become active here.
                </p>
              </div>

              <div className="rounded-xl border border-amber-200 bg-white/80 p-4 text-left dark:border-amber-900/40 dark:bg-slate-900/80 space-y-2 text-xs">
                <div className="flex justify-between border-b pb-1.5">
                  <span className="text-muted-foreground">Applicant Name:</span>
                  <span className="font-bold">{p.name}</span>
                </div>
                <div className="flex justify-between border-b pb-1.5">
                  <span className="text-muted-foreground">Contact:</span>
                  <span className="font-semibold">{p.contact}</span>
                </div>
                <div className="flex justify-between border-b pb-1.5">
                  <span className="text-muted-foreground">Requested Share:</span>
                  <span className="font-bold text-amber-600 dark:text-amber-400">{p.share_pct}% Revenue Share</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status:</span>
                  <Badge variant="outline" className="border-amber-400 bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                    Pending Admin Approval
                  </Badge>
                </div>
              </div>

              <div className="pt-2 text-xs text-muted-foreground">
                Need priority approval? Reach out through the Support widget or email support.
              </div>
            </CardContent>
          </Card>
        </div>
      </PageShell>
    );
  }

  // Case 3: Rejected application
  if (p.status === "rejected") {
    return (
      <PageShell
        eyebrow="Partnership"
        title="Application Status"
        description="Your collaborator application was not approved at this time."
      >
        <div className="mx-auto max-w-xl">
          <Card className="border-rose-400/40 bg-gradient-to-br from-rose-500/10 to-transparent">
            <CardContent className="space-y-4 p-6 text-center">
              <AlertCircle className="mx-auto h-12 w-12 text-rose-600" />
              <div>
                <h2 className="text-lg font-bold">Application Not Approved</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {p.admin_notes || "Your application could not be approved at this time. You can update your audience details and apply again."}
                </p>
              </div>
              <Button asChild variant="outline">
                <Link to="/dedicated-program">Update Details &amp; Reapply</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </PageShell>
    );
  }

  // Case 4: Approved active collaborator dashboard
  const s = data.stats;
  const privateLink = data.link?.code ? `https://neettrack.com/c/${data.link.code}` : null;
  const couponCode = data.coupon?.code ?? null;
  const couponDiscount = data.coupon
    ? data.coupon.kind === "flat"
      ? `₹${Number(data.coupon.value).toFixed(2)} off`
      : `${Number(data.coupon.value).toFixed(2)}% off`
    : null;

  return (
    <PageShell
      eyebrow="Partner Dashboard"
      title="Collaborator Hub"
      description={`Welcome ${p.name}! Your program: ${p.share_pct}% revenue share for ${p.months} month(s).`}
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30">
          <CheckCircle2 className="mr-1 h-3 w-3" /> Active Partner
        </Badge>
        <Badge variant="outline">Min withdrawal ₹{Number(p.min_withdrawal).toFixed(0)}</Badge>
        {isAdmin && (
          <Button asChild size="sm" variant="outline" className="ml-auto">
            <Link to="/admin-collaborators">
              <Pencil className="mr-1.5 h-3.5 w-3.5" /> Manage All Collaborators
            </Link>
          </Button>
        )}
      </div>

      {/* Referral & Promo Link Banner */}
      <Card className="mb-5 border-teal-500/30 bg-gradient-to-br from-teal-500/10 via-emerald-500/5 to-transparent">
        <CardContent className="space-y-3 p-5">
          <div>
            <div className="text-sm font-bold">Your Official Promotion Links &amp; Coupons</div>
            <div className="text-xs text-muted-foreground">
              Share these with your students or followers. Any batch purchase via your link or coupon earns you commission.
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {privateLink ? (
              <div className="rounded-xl border bg-background/80 p-3.5">
                <div className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400">
                  <Link2 className="h-3.5 w-3.5" /> Your Tracking Link
                </div>
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1 truncate text-xs font-mono font-medium">{privateLink}</div>
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => copyText(privateLink, "Link")}>
                    <Copy className="mr-1 h-3 w-3" /> Copy
                  </Button>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed p-3.5 text-xs text-muted-foreground flex items-center justify-center">
                Link assignment pending admin setup.
              </div>
            )}

            {couponCode ? (
              <div className="rounded-xl border bg-background/80 p-3.5">
                <div className="mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                    <Tag className="h-3.5 w-3.5" /> Student Discount Coupon
                  </span>
                  {couponDiscount && (
                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                      {couponDiscount}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1 font-mono text-base font-extrabold tracking-wider">{couponCode}</div>
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => copyText(couponCode, "Coupon")}>
                    <Copy className="mr-1 h-3 w-3" /> Copy
                  </Button>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed p-3.5 text-xs text-muted-foreground flex items-center justify-center">
                Coupon code pending admin assignment.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Metrics Row */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<Users className="h-4 w-4 text-blue-600" />}
          label="Students Invited"
          value={String(s?.total_invited ?? 0)}
        />
        <StatCard
          icon={<IndianRupee className="h-4 w-4 text-emerald-600" />}
          label="Total Student Spend"
          value={`₹${Number(s?.total_invested ?? 0).toFixed(2)}`}
        />
        <StatCard
          icon={<TrendingUp className="h-4 w-4 text-violet-600" />}
          label="Commission Base"
          value={`₹${Number(s?.total_revenue ?? 0).toFixed(2)}`}
        />
        <StatCard
          icon={<Wallet className="h-4 w-4 text-amber-600" />}
          label={`Your Payout (${p.share_pct}%)`}
          value={`₹${Number(s?.my_earnings ?? 0).toFixed(2)}`}
          highlight
        />
      </div>

      {/* Invited List */}
      <h3 className="mb-2 mt-6 text-sm font-bold uppercase tracking-wider text-muted-foreground">
        Referred Students ({data.invited.length})
      </h3>
      {data.invited.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            No students have joined via your link or coupon yet. Share your promo link to start earning!
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {data.invited.map((u: any) => (
            <Card key={u.user_id}>
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <div className="text-sm font-medium">{u.full_name ?? u.email ?? "Student"}</div>
                  <div className="text-xs text-muted-foreground">
                    Joined {new Date(u.joined_at).toLocaleDateString()}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-emerald-600">
                    ₹{Number(u.invested || 0).toFixed(2)}
                  </div>
                  <div className="text-[10px] uppercase text-muted-foreground">Invested</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </PageShell>
  );
}

function StatCard({
  icon,
  label,
  value,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <Card className={highlight ? "border-amber-500/40 bg-gradient-to-br from-amber-500/10 to-transparent" : ""}>
      <CardContent className="space-y-1 p-4">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {icon}
          {label}
        </div>
        <div className="text-2xl font-black">{value}</div>
      </CardContent>
    </Card>
  );
}
