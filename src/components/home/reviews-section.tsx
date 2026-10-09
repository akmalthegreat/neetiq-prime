import { useEffect, useState } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Star, Loader2, PenLine, Quote, BadgeCheck, ChevronDown, Globe } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";
import { getMyReview, submitReview } from "@/lib/reviews.functions";
import type { HomeStats, PublicReview } from "@/lib/home-stats.functions";
import { cn } from "@/lib/utils";

const LABELS = ["", "Needs work", "Not great", "It's okay", "Really good", "Loved it!"];

export function StarRow({ value, size = "h-4 w-4" }: { value: number; size?: string }) {
  return (
    <span className="inline-flex" aria-label={`${value.toFixed(1)} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => {
        const fill = Math.max(0, Math.min(1, value - (n - 1)));
        return (
          <span key={n} className={`relative ${size}`}>
            <Star className={`absolute inset-0 ${size} text-amber-400/30`} fill="currentColor" strokeWidth={0} />
            <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
              <Star className={`${size} text-amber-400`} fill="currentColor" strokeWidth={0} />
            </span>
          </span>
        );
      })}
    </span>
  );
}

function timeAgo(iso: string) {
  const d = (Date.now() - new Date(iso).getTime()) / 86_400_000;
  if (d < 1) return "Today";
  if (d < 2) return "Yesterday";
  if (d < 30) return `${Math.floor(d)} days ago`;
  if (d < 365) return `${Math.floor(d / 30)} mo ago`;
  return new Date(iso).toLocaleDateString("en-IN", { month: "short", year: "numeric" });
}

const AVATAR_TINTS = [
  "from-violet-500 to-fuchsia-500", "from-emerald-500 to-teal-500", "from-sky-500 to-indigo-500",
  "from-amber-500 to-orange-500", "from-rose-500 to-pink-500",
];

function ReviewCard({ r, className = "" }: { r: PublicReview; className?: string }) {
  const [open, setOpen] = useState(false);
  const long = r.body.length > 220;
  const tint = AVATAR_TINTS[(r.name.charCodeAt(0) || 0) % AVATAR_TINTS.length];
  return (
    <figure className={`${className} relative flex h-full w-[82vw] max-w-[340px] shrink-0 snap-start flex-col rounded-2xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md sm:w-auto sm:max-w-none`}>
      <Quote className="absolute right-4 top-4 h-6 w-6 text-primary/10" aria-hidden="true" />
      <StarRow value={r.rating} />
      <blockquote className={cn("mt-3 whitespace-pre-line text-[14px] leading-relaxed text-foreground/90", !open && long && "line-clamp-5")}>
        {r.body}
      </blockquote>
      {long && (
        <button type="button" onClick={() => setOpen((v) => !v)} className="mt-1 self-start text-xs font-semibold text-primary hover:underline">
          {open ? "Show less" : "Read more"}
        </button>
      )}
      <figcaption className="mt-auto flex items-center gap-3 pt-4">
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br ${tint} text-sm font-bold text-white`}>
          {r.name.charAt(0).toUpperCase()}
        </span>
        <span className="min-w-0">
          <span className="flex items-center gap-1 truncate text-sm font-semibold">
            {r.name} <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-primary" aria-label="Signed-in student" />
          </span>
          <span className="block text-xs text-muted-foreground">
            {r.targetYear ? `NEET ${r.targetYear} aspirant · ` : "NEET aspirant · "}{timeAgo(r.date)}
          </span>
        </span>
      </figcaption>
    </figure>
  );
}

/* ───────── write / edit dialog ───────── */

export function ReviewDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const router = useRouter();
  const fetchMine = useServerFn(getMyReview);
  const save = useServerFn(submitReview);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [existing, setExisting] = useState<{ hidden: boolean } | null>(null);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setLoading(true);
    fetchMine()
      .then((res) => {
        if (!alive) return;
        if (res.review) {
          setRating(res.review.rating); setBody(res.review.body); setName(res.review.display_name);
          setExisting({ hidden: res.review.status === "hidden" });
        } else {
          setName((n) => n || res.suggestedName); setExisting(null);
        }
      })
      .catch(() => {})
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function onSave() {
    if (!rating) return toast.error("Tap a star to rate");
    if (body.trim().length < 10) return toast.error("Please write at least 10 characters");
    if (!name.trim()) return toast.error("Please add the name to show");
    setBusy(true);
    try {
      await save({ data: { rating, body: body.trim(), displayName: name.trim() } });
      toast.success(existing ? "Your review was updated" : "Thank you! Your review is live on the home page.");
      onOpenChange(false);
      router.invalidate();
    } catch (e: any) {
      toast.error(e?.message ?? "Could not save your review");
    } finally { setBusy(false); }
  }

  const shown = hover || rating;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit your review" : "Rate NEET Track"}</DialogTitle>
          <DialogDescription>Your rating and review will be shown on the NEET Track home page to help other NEET students.</DialogDescription>
        </DialogHeader>
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-1.5 rounded-2xl bg-muted/50 py-4">
              <div className="flex gap-1" onMouseLeave={() => setHover(0)}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" aria-label={`${n} star${n > 1 ? "s" : ""}`}
                    onClick={() => setRating(n)} onMouseEnter={() => setHover(n)}
                    className="rounded-md p-0.5 transition-transform hover:scale-110 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <Star className={cn("h-9 w-9 transition-colors", shown >= n ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30")} />
                  </button>
                ))}
              </div>
              <div className="h-4 text-xs font-semibold text-muted-foreground">{LABELS[shown]}</div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium" htmlFor="rv-body">Your review</label>
              <Textarea id="rv-body" value={body} onChange={(e) => setBody(e.target.value)} rows={5} maxLength={600}
                placeholder="What helped you most — short notes, mock tests, PYQs, flashcards…?" className="resize-none" />
              <div className="text-right text-[11px] text-muted-foreground">{body.length}/600</div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium" htmlFor="rv-name">Name to show</label>
              <Input id="rv-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="e.g. Riya S." />
            </div>
            {existing?.hidden && (
              <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
                Your review text is currently not shown publicly. Your star rating still counts.
              </p>
            )}
            <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><Globe className="h-3 w-3" /> Public. Please don't include phone numbers or links.</p>
            <Button className="h-11 w-full bg-gradient-primary text-[15px] font-semibold" onClick={onSave} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : existing ? "Update review" : "Post review"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ───────── landing section ───────── */

export function ReviewsSection({ stats }: { stats: HomeStats | null }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [more, setMore] = useState(false);
  const reviews = stats?.reviews ?? [];
  const hasRating = !!stats && stats.ratingCount > 0;

  const rateBtn = user ? (
    <Button onClick={() => setOpen(true)} className="h-11 w-full rounded-xl bg-gradient-primary text-[15px] font-semibold shadow-elegant">
      <PenLine className="mr-2 h-4 w-4" /> Rate &amp; review NEET Track
    </Button>
  ) : (
    <Button asChild className="h-11 w-full rounded-xl bg-gradient-primary text-[15px] font-semibold shadow-elegant">
      <Link to="/login"><PenLine className="mr-2 h-4 w-4" /> Sign in to rate &amp; review</Link>
    </Button>
  );

  return (
    <section id="reviews" className="relative mx-auto w-full max-w-6xl scroll-mt-20 px-5 py-14 sm:px-6 sm:py-16">
      <div className="mb-8 flex flex-col items-center text-center lg:mb-10">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Student ratings &amp; reviews</p>
        <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">What NEET students say about us</h2>
        <p className="mt-2 max-w-lg text-sm text-muted-foreground">Real ratings from signed-in NEET Track students. Every review is shown as written.</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
        {/* summary */}
        <div className="h-fit rounded-3xl border border-border bg-card p-6 shadow-sm lg:sticky lg:top-24">
          {hasRating ? (
            <>
              <div className="flex items-center gap-4">
                <span className="text-6xl font-bold leading-none tracking-tight">{stats!.ratingAvg.toFixed(1)}</span>
                <div>
                  <StarRow value={stats!.ratingAvg} size="h-5 w-5" />
                  <div className="mt-1 text-sm text-muted-foreground">
                    {stats!.ratingCount} student rating{stats!.ratingCount === 1 ? "" : "s"}
                    {stats!.reviewCount ? ` · ${stats!.reviewCount} review${stats!.reviewCount === 1 ? "" : "s"}` : ""}
                  </div>
                </div>
              </div>
              <div className="mt-5 space-y-1.5">
                {stats!.ratingBars.map((n, i) => {
                  const pct = stats!.ratingCount ? (n / stats!.ratingCount) * 100 : 0;
                  return (
                    <div key={i} className="flex items-center gap-2.5 text-xs text-muted-foreground">
                      <span className="flex w-6 items-center justify-end gap-0.5 tabular-nums">{5 - i}<Star className="h-3 w-3 fill-amber-400 text-amber-400" /></span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-amber-400" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="w-6 tabular-nums">{n}</span>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="py-2 text-center">
              <StarRow value={0} size="h-6 w-6" />
              <p className="mt-3 text-sm text-muted-foreground">No ratings yet. Be the first to rate NEET Track.</p>
            </div>
          )}
          <div className="mt-6">{rateBtn}</div>
          <p className="mt-3 text-center text-[11px] text-muted-foreground">Used NEET Track? Your review helps other aspirants.</p>
        </div>

        {/* reviews */}
        {reviews.length ? (
          <div>
            <div className="-mx-5 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-2 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0 [&::-webkit-scrollbar]:hidden">
              {reviews.map((r, i) => <ReviewCard key={r.id} r={r} className={!more && i >= 4 ? "sm:hidden" : ""} />)}
            </div>
            {reviews.length > 4 && (
              <div className="mt-5 hidden justify-center sm:flex">
                <Button variant="outline" className="rounded-xl" onClick={() => setMore((v) => !v)}>
                  {more ? "Show fewer reviews" : `Show more reviews`} <ChevronDown className={cn("ml-1.5 h-4 w-4 transition-transform", more && "rotate-180")} />
                </Button>
              </div>
            )}
            {reviews.length > 1 && <p className="mt-2 text-center text-[11px] text-muted-foreground sm:hidden">Swipe to see more →</p>}
          </div>
        ) : (
          <div className="grid place-items-center rounded-3xl border border-dashed border-border bg-card/40 p-10 text-center">
            <Quote className="h-8 w-8 text-primary/30" />
            <p className="mt-3 font-semibold">Written reviews will appear here</p>
            <p className="mt-1 max-w-xs text-sm text-muted-foreground">Share what helped you — short notes, mock tests, PYQs or flashcards.</p>
          </div>
        )}
      </div>

      {user && <ReviewDialog open={open} onOpenChange={setOpen} />}
    </section>
  );
}
