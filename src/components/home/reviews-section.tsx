import { useEffect, useState } from "react";
import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Star, Loader2, PenLine, Quote, BadgeCheck, ChevronDown, Globe, Send, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
        {r.avatar ? (
          <img src={r.avatar} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-9 w-9 shrink-0 rounded-full object-cover ring-2 ring-background" />
        ) : (
          <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br ${tint} text-sm font-bold text-white`}>
            {r.name.charAt(0).toUpperCase()}
          </span>
        )}
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

/* ───────── shared: my review status ───────── */

export function useMyReview() {
  const { user } = useAuth();
  const fetchMine = useServerFn(getMyReview);
  return useQuery({
    queryKey: ["my-review", user?.id ?? "anon"],
    queryFn: () => fetchMine(),
    enabled: !!user,
    staleTime: 10 * 60_000,
  });
}

const MOODS = ["", "😞", "😕", "🙂", "😊", "🤩"];
const CHIPS = ["Short notes", "Mock tests", "PYQ practice", "Important NEET questions", "Flashcards", "Explanations", "Progress tracking"];

/* ───────── write / edit dialog ───────── */

export function ReviewDialog({ open, onOpenChange, initialRating = 0, greeting }: {
  open: boolean; onOpenChange: (v: boolean) => void; initialRating?: number; greeting?: string;
}) {
  const router = useRouter();
  const qc = useQueryClient();
  const { user } = useAuth();
  const mine = useMyReview();
  const save = useServerFn(submitReview);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [body, setBody] = useState("");

  const existing = mine.data?.review ?? null;
  const name = mine.data?.name ?? "";

  useEffect(() => {
    if (!open) return;
    setDone(false);
    if (existing) { setRating(initialRating || existing.rating); setBody(existing.body); }
    else { setRating(initialRating); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, existing?.updated_at]);

  function addChip(c: string) {
    setBody((b) => {
      if (b.toLowerCase().includes(c.toLowerCase())) return b;
      const t = b.trim();
      return t ? `${t}${/[.!?]$/.test(t) ? "" : ","} ${c.toLowerCase()}` : `I really like the ${c.toLowerCase()}`;
    });
  }

  async function onSave() {
    if (!rating) return toast.error("Tap a star to rate");
    if (body.trim().length < 10) return toast.error("Please write at least 10 characters");
    setBusy(true);
    try {
      await save({ data: { rating, body: body.trim() } });
      setDone(true);
      qc.invalidateQueries({ queryKey: ["my-review"] });
      router.invalidate();
    } catch (e: any) {
      toast.error(e?.message ?? "Could not save your review");
    } finally { setBusy(false); }
  }

  const shown = hover || rating;
  const avatar = (user?.user_metadata as { avatar_url?: string } | undefined)?.avatar_url;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-md overflow-y-auto border-0 p-0">
        <div className="relative overflow-hidden rounded-t-lg bg-gradient-to-br from-violet-600 via-indigo-600 to-emerald-500 px-6 pb-6 pt-7 text-white">
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/15 blur-2xl" aria-hidden="true" />
          <DialogHeader className="relative space-y-1 text-left">
            <DialogTitle className="text-xl font-bold text-white">
              {done ? "Thank you! 💜" : greeting ?? (existing ? "Update your review" : "How is NEET Track for you?")}
            </DialogTitle>
            <DialogDescription className="text-sm text-white/85">
              {done
                ? "Your review has been sent. It will appear on the NEET Track home page once it is approved."
                : "Your rating helps us improve and helps other NEET students choose the right app."}
            </DialogDescription>
          </DialogHeader>
        </div>

        {done ? (
          <div className="flex flex-col items-center gap-3 px-6 pb-6 pt-5 text-center">
            <div className="grid h-16 w-16 place-items-center rounded-full bg-emerald-500/15 text-emerald-500"><CheckCircle2 className="h-9 w-9" /></div>
            <StarRow value={rating} size="h-6 w-6" />
            <p className="text-sm text-muted-foreground">Keep practising — we're rooting for your NEET rank!</p>
            <Button className="mt-1 w-full" onClick={() => onOpenChange(false)}>Done</Button>
          </div>
        ) : mine.isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
        ) : (
          <div className="space-y-5 px-6 pb-6 pt-5">
            <div className="flex flex-col items-center gap-1">
              <div className="h-9 text-3xl leading-none transition-transform" aria-hidden="true">{MOODS[shown] || "⭐"}</div>
              <div className="flex gap-1" onMouseLeave={() => setHover(0)}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" aria-label={`${n} star${n > 1 ? "s" : ""}`}
                    onClick={() => setRating(n)} onMouseEnter={() => setHover(n)}
                    className="rounded-md p-0.5 transition-transform hover:scale-110 active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <Star className={cn("h-10 w-10 transition-colors", shown >= n ? "fill-amber-400 text-amber-400 drop-shadow-[0_2px_6px_rgba(251,191,36,.45)]" : "text-muted-foreground/30")} />
                  </button>
                ))}
              </div>
              <div className="h-4 text-xs font-semibold text-muted-foreground">{shown ? LABELS[shown] : "Tap a star"}</div>
            </div>

            <div>
              <div className="mb-2 text-xs font-medium text-muted-foreground">What do you like? <span className="font-normal">(tap to add)</span></div>
              <div className="flex flex-wrap gap-1.5">
                {CHIPS.map((c) => {
                  const on = body.toLowerCase().includes(c.toLowerCase());
                  return (
                    <button key={c} type="button" onClick={() => addChip(c)}
                      className={cn("rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                        on ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-secondary")}>
                      {on ? "✓ " : "+ "}{c}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium" htmlFor="rv-body">Your review</label>
              <Textarea id="rv-body" value={body} onChange={(e) => setBody(e.target.value)} rows={4} maxLength={600}
                placeholder="Share your experience — what helped you the most?" className="resize-none" />
              <div className="flex justify-between text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1"><Globe className="h-3 w-3" /> Shown on the home page after approval</span>
                <span>{body.length}/600</span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 rounded-xl bg-muted/60 px-3 py-2.5">
              {avatar ? <img src={avatar} alt="" className="h-8 w-8 rounded-full object-cover" referrerPolicy="no-referrer" />
                : <span className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-violet-500 to-emerald-500 text-sm font-bold text-white">{(name || "S").charAt(0).toUpperCase()}</span>}
              <div className="min-w-0 text-xs">
                <div className="text-muted-foreground">Posting as</div>
                <div className="truncate font-semibold">{name || "NEET Track Student"}</div>
              </div>
              {existing && (
                <span className={cn("ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold",
                  existing.status === "published" ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-amber-500/15 text-amber-600 dark:text-amber-400")}>
                  {existing.status === "published" ? "Live" : "Awaiting approval"}
                </span>
              )}
            </div>

            <Button className="h-12 w-full bg-gradient-primary text-[15px] font-semibold shadow-elegant" onClick={onSave} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="mr-2 h-4 w-4" />{existing ? "Update review" : "Submit review"}</>}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ───────── dashboard card ───────── */

export function RateUsCard() {
  const { user } = useAuth();
  const mine = useMyReview();
  const [open, setOpen] = useState(false);
  const [pick, setPick] = useState(0);
  const [hover, setHover] = useState(0);
  if (!user) return null;
  const r = mine.data?.review ?? null;

  return (
    <div className="relative overflow-hidden rounded-[20px] border border-amber-300/25 bg-gradient-to-br from-[#2A1B4A] via-[#1E1B4B] to-[#0B3B33] p-4 text-white shadow-lg sm:p-5">
      <div className="pointer-events-none absolute -right-8 -top-10 h-36 w-36 rounded-full bg-amber-400/25 blur-2xl" aria-hidden="true" />
      <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-300">Rate NEET Track</div>
          {r ? (
            <>
              <div className="mt-1 flex items-center gap-2 text-base font-bold">
                You rated us <StarRow value={r.rating} />
              </div>
              <div className="mt-0.5 text-xs text-white/70">
                {r.status === "published" ? "Your review is live on the home page. Thank you! 💜" : "Thanks! Your review is awaiting approval."}
              </div>
            </>
          ) : (
            <>
              <div className="mt-1 text-base font-bold sm:text-lg">How's your experience with NEET Track?</div>
              <div className="mt-0.5 text-xs text-white/70">Tap a star — your review helps other NEET students.</div>
            </>
          )}
        </div>
        {r ? (
          <button type="button" onClick={() => { setPick(0); setOpen(true); }}
            style={{ background: "rgba(255,255,255,.12)", border: "1px solid rgba(255,255,255,.22)" }}
            className="inline-flex h-9 shrink-0 items-center self-start rounded-xl px-3.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 sm:self-auto">
            <PenLine className="mr-1.5 h-3.5 w-3.5" /> Edit review
          </button>
        ) : (
          <div className="flex shrink-0 gap-1" onMouseLeave={() => setHover(0)}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" aria-label={`Rate ${n} star${n > 1 ? "s" : ""}`}
                onMouseEnter={() => setHover(n)} onClick={() => { setPick(n); setOpen(true); }}
                className="rounded-md p-0.5 transition-transform hover:scale-110 active:scale-90">
                <Star className={cn("h-8 w-8 transition-colors", hover >= n ? "fill-amber-400 text-amber-400" : "text-white/35")} />
              </button>
            ))}
          </div>
        )}
      </div>
      <ReviewDialog open={open} onOpenChange={setOpen} initialRating={pick} />
    </div>
  );
}

/* ───────── friendly reminder (max 4 times a day, until the student reviews) ───────── */

const PROMPT_PAGES = [
  "/dashboard", "/progress", "/short-notes", "/notes", "/flashcards", "/analytics", "/profile", "/leaderboard",
  "/subjects", "/bookmarks", "/mistakes", "/improve", "/todo", "/nuggets", "/highlighted-ncert", "/ncert-highlights",
];
const MAX_PER_DAY = 4;
const MIN_GAP_MS = 2 * 60 * 60_000; // at least 2 hours between reminders
const SHOW_AFTER_MS = 25_000;       // let the student settle in first

export function RatePrompt() {
  const { user, profile } = useAuth();
  const mine = useMyReview();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const [rateOpen, setRateOpen] = useState(false);
  const [pick, setPick] = useState(0);
  const [hover, setHover] = useState(0);

  const eligible = !!user && mine.isSuccess && mine.data?.ready !== false && !mine.data?.review
    && PROMPT_PAGES.some((p) => path === p || path.startsWith(p + "/"));

  useEffect(() => {
    if (!eligible || open || rateOpen) return;
    const key = `nt-rate-prompt:${user!.id}`;
    const today = new Date().toLocaleDateString("en-CA");
    let st = { day: today, count: 0, last: 0 };
    try { const raw = localStorage.getItem(key); if (raw) { const j = JSON.parse(raw); if (j.day === today) st = j; } } catch { /* storage blocked */ }
    if (st.count >= MAX_PER_DAY || Date.now() - st.last < MIN_GAP_MS) return;
    const t = setTimeout(() => {
      setOpen(true);
      try { localStorage.setItem(key, JSON.stringify({ day: today, count: st.count + 1, last: Date.now() })); } catch { /* ignore */ }
    }, SHOW_AFTER_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eligible, path]);

  if (!user) return null;
  const first = profile?.full_name?.trim().split(/\s+/)[0] || "dear student";

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm overflow-hidden border-0 p-0">
          <div className="relative bg-gradient-to-br from-violet-600 via-indigo-600 to-emerald-500 px-6 pb-5 pt-7 text-center text-white">
            <div className="pointer-events-none absolute -left-8 -top-8 h-32 w-32 rounded-full bg-white/15 blur-2xl" aria-hidden="true" />
            <div className="relative mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-white/15 text-3xl backdrop-blur">👋</div>
            <DialogHeader className="relative mt-3 space-y-1 text-center sm:text-center">
              <DialogTitle className="text-xl font-bold text-white">Hey {first}! How's it going?</DialogTitle>
              <DialogDescription className="text-sm text-white/85">
                How is your experience with NEET Track so far? Please rate us and tell us what you think.
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="px-6 pb-6 pt-5 text-center">
            <div className="h-9 text-3xl leading-none" aria-hidden="true">{MOODS[hover] || "⭐"}</div>
            <div className="flex justify-center gap-1.5" onMouseLeave={() => setHover(0)}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" aria-label={`Rate ${n} star${n > 1 ? "s" : ""}`}
                  onMouseEnter={() => setHover(n)}
                  onClick={() => { setPick(n); setOpen(false); setRateOpen(true); }}
                  className="rounded-md p-0.5 transition-transform hover:scale-110 active:scale-90">
                  <Star className={cn("h-10 w-10 transition-colors", hover >= n ? "fill-amber-400 text-amber-400" : "text-amber-400/40")} />
                </button>
              ))}
            </div>
            <div className="mt-1 h-4 text-xs text-muted-foreground">{hover ? LABELS[hover] : "Tap a star to rate"}</div>
            <Button variant="ghost" className="mt-4 w-full text-muted-foreground" onClick={() => setOpen(false)}>Maybe later</Button>
          </div>
        </DialogContent>
      </Dialog>
      <ReviewDialog open={rateOpen} onOpenChange={setRateOpen} initialRating={pick} greeting={`Thanks, ${first}! Tell us a little more`} />
    </>
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
        <p className="mt-2 max-w-lg text-sm text-muted-foreground">Ratings and reviews from signed-in NEET Track students.</p>
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
