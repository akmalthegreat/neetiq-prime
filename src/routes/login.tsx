import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft, ArrowRight, Loader2, Mail, Lock, User, Gift, Eye, EyeOff, Dna, Atom, FlaskConical, Brain, HeartPulse,
  Microscope, NotebookPen, Trophy, Layers, History, ShieldCheck, Sparkles,
} from "lucide-react";
import { useEffect, useMemo, useState, type ComponentType, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Log in — NEET Track" }, { name: "description", content: "Sign up or log in to NEET Track." }] }),
  component: LoginPage,
});

function LoginPage() {
  const nav = useNavigate();
  const { user, loading } = useAuth();
  const [tab, setTab] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [refCode, setRefCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [oauthBusy, setOauthBusy] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [last, setLast] = useState<LastUser | null>(null);
  const [quote, setQuote] = useState(0);

  // "Welcome back, <name>" for students who have signed in on this device before.
  useEffect(() => {
    const u = readLastUser();
    if (u) { setLast(u); if (u.email) setEmail((e) => e || u.email!); }
  }, []);
  useEffect(() => {
    const t = setInterval(() => setQuote((q) => (q + 1) % QUOTES.length), 5200);
    return () => clearInterval(t);
  }, []);
  const forgetMe = () => {
    try { localStorage.removeItem(LAST_USER_KEY); } catch { /* noop */ }
    setLast(null); setEmail("");
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const r = new URLSearchParams(window.location.search).get("ref");
    if (r) {
      const code = r.toUpperCase();
      setRefCode(code); setTab("signup");
      // Persist so Google OAuth or email-confirm round-trips still credit later.
      try { localStorage.setItem("pending_ref_code", code); } catch { /* noop */ }
    }
  }, []);

  useEffect(() => { if (!loading && user) nav({ to: "/dashboard" }); }, [user, loading, nav]);

  const onGoogle = async () => {
    setOauthBusy(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/dashboard` },
    });
    if (error) {
      setOauthBusy(false);
      toast.error(error.message || "Google sign-in failed");
    }
  };

  const onLogin = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setBusy(false);
      // Banned/suspended → fetch the admin-set reason so the user sees
      // exactly why instead of a generic "User banned" string.
      if (/ban|suspend|disabl/i.test(error.message)) {
        try {
          const { getSuspensionReasonByEmail } = await import("@/lib/auth-status.functions");
          const info = await getSuspensionReasonByEmail({ data: { email } });
          if (info && (info as any).suspended) {
            const reason = (info as any).reason as string | null;
            toast.error(
              reason
                ? `Account suspended: ${reason}`
                : "Your account has been suspended. Contact support if you think this is a mistake.",
              { duration: 10000 },
            );
            return;
          }
        } catch { /* fall through to generic */ }
      }
      const msg = /confirm|verif/i.test(error.message)
        ? "Please verify your email first. Check your inbox for the confirmation link."
        : error.message;
      return toast.error(msg);
    }
    // Apply any pending referral code captured during signup.
    try {
      const pending = localStorage.getItem("pending_ref_code");
      if (pending) {
        const { applyReferralCode } = await import("@/lib/referrals.functions");
        await applyReferralCode({ data: { code: pending } }).catch(() => {});
        localStorage.removeItem("pending_ref_code");
      }
    } catch { /* noop */ }
    setBusy(false);
    toast.success(last?.name ? `Welcome back, ${last.name}! 🎉` : "Welcome back! 🎉");
    nav({ to: "/dashboard" });
  };

  const onSignup = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true);
    // Stash referral BEFORE signup so SIGNED_IN listener can apply it
    // immediately if auto-confirm is enabled.
    if (refCode.trim()) {
      try { localStorage.setItem("pending_ref_code", refCode.trim().toUpperCase()); } catch { /* noop */ }
    }
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { emailRedirectTo: `${window.location.origin}/dashboard`, data: { full_name: name } },
    });
    if (error) { setBusy(false); return toast.error(error.message); }

    // If Supabase returned a session (email confirmations disabled at project level),
    // proceed straight to dashboard. Otherwise, ask the user to verify by email.
    if (data.session) {
      setBusy(false);
      toast.success("Account created!");
      nav({ to: "/dashboard" });
      return;
    }
    setBusy(false);
    toast.success("Check your email to verify your account before logging in.", { duration: 8000 });
    setTab("login");
  };

  const greet = useMemo(() => {
    const h = new Date().getHours();
    return h < 5 ? "Burning the midnight oil" : h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  }, []);
  const isLogin = tab === "login";

  return (
    <div className="lg-root">
      <style>{LOGIN_CSS}</style>

      {/* animated backdrop */}
      <div className="lg-bg" aria-hidden="true">
        <span className="lg-blob b1" /><span className="lg-blob b2" /><span className="lg-blob b3" />
        <span className="lg-grid" />
        {FLOATERS.map(({ Icon, x, y, d, s }, i) => (
          <span key={i} className="lg-float" style={{ left: x, top: y, animationDelay: `${d}s`, ["--s" as string]: s }}><Icon className="h-full w-full" /></span>
        ))}
      </div>

      <div className="lg-wrap">
        {/* ── left: brand story (desktop) ── */}
        <aside className="lg-story">
          <Link to="/" className="lg-brand">
            <img src="/icons/icon-192.png" alt="" className="lg-logo" />
            <span>NEET <b>Track</b></span>
          </Link>
          <h2 className="lg-h">Every question today<br />is a <span>mark on exam day.</span></h2>
          <p className="lg-sub">Your NEET preparation, all in one place — practise, revise and track every step.</p>
          <ul className="lg-feats">
            {FEATURES.map(({ Icon, t, d, c }, i) => (
              <li key={t} style={{ animationDelay: `${0.25 + i * 0.08}s`, ["--c" as string]: c }}>
                <span className="ic"><Icon className="h-4 w-4" /></span>
                <span><b>{t}</b><em>{d}</em></span>
              </li>
            ))}
          </ul>
          <div className="lg-proof">
            <div><b>AIR 125</b><span>Top rank from our mentorship</span></div>
            <div><b>45,000+</b><span>NEET-level questions</span></div>
            <div><b>Free</b><span>Short notes for every chapter</span></div>
          </div>
        </aside>

        {/* ── right: auth card ── */}
        <main className="lg-main">
          <Link to="/" className="lg-brand lg-brand-m">
            <img src="/icons/icon-192.png" alt="" className="lg-logo" />
            <span>NEET <b>Track</b></span>
          </Link>

          <div className="lg-card-wrap">
            <div className="lg-card">
              {/* greeting */}
              <div className="lg-greet" key={`${tab}-${last ? "r" : "n"}`}>
                {isLogin && last ? (
                  <>
                    <div className="lg-ava">
                      {last.avatar
                        ? <img src={last.avatar} alt="" referrerPolicy="no-referrer" />
                        : <span>{last.name.charAt(0).toUpperCase()}</span>}
                      <i aria-hidden="true">👋</i>
                    </div>
                    <h1>Welcome back, <span>{last.name}</span>!</h1>
                    <p>{greet}! Ready to pick up where you left off?</p>
                    <button type="button" className="lg-notyou" onClick={forgetMe}>Not {last.name}? Use another account</button>
                  </>
                ) : isLogin ? (
                  <>
                    <div className="lg-spark"><Sparkles className="h-6 w-6" /></div>
                    <h1>Welcome back, <span>future doctor</span>!</h1>
                    <p>{greet}! Log in to continue your NEET prep.</p>
                  </>
                ) : (
                  <>
                    <div className="lg-spark"><HeartPulse className="h-6 w-6" /></div>
                    <h1>Start your <span>NEET journey</span></h1>
                    <p>Create your free account — no card needed.</p>
                  </>
                )}
              </div>

              {/* google */}
              <button type="button" className="lg-google" onClick={onGoogle} disabled={oauthBusy}>
                {oauthBusy ? <Loader2 className="h-5 w-5 animate-spin" /> : <>
                  <svg className="h-5 w-5" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.4 29.3 35.5 24 35.5c-6.4 0-11.5-5.1-11.5-11.5S17.6 12.5 24 12.5c2.9 0 5.6 1.1 7.6 2.9l5.7-5.7C33.9 6.5 29.2 4.5 24 4.5 13.2 4.5 4.5 13.2 4.5 24S13.2 43.5 24 43.5 43.5 34.8 43.5 24c0-1.2-.1-2.3-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 12.5 24 12.5c2.9 0 5.6 1.1 7.6 2.9l5.7-5.7C33.9 6.5 29.2 4.5 24 4.5 16.3 4.5 9.7 8.8 6.3 14.7z"/><path fill="#4CAF50" d="M24 43.5c5.1 0 9.7-1.9 13.2-5.1l-6.1-5c-2 1.4-4.4 2.2-7.1 2.2-5.3 0-9.7-3.4-11.3-8.1l-6.5 5C9.7 39.1 16.2 43.5 24 43.5z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.4l6.1 5c-.4.4 6.7-4.9 6.7-14.4 0-1.2-.1-2.3-.4-3.5z"/></svg>
                  <span>Continue with Google</span>
                </>}
              </button>

              <div className="lg-or"><span /><em><Mail className="h-3 w-3" /> or use email</em><span /></div>

              {/* segmented tabs */}
              <div className="lg-tabs" role="tablist">
                <span className="lg-pill" style={{ transform: isLogin ? "translateX(0)" : "translateX(100%)" }} aria-hidden="true" />
                <button type="button" role="tab" aria-selected={isLogin} className={isLogin ? "on" : ""} onClick={() => setTab("login")}>Log in</button>
                <button type="button" role="tab" aria-selected={!isLogin} className={!isLogin ? "on" : ""} onClick={() => setTab("signup")}>Sign up</button>
              </div>

              {isLogin ? (
                <form key="login" className="lg-form" onSubmit={onLogin}>
                  <Field id="le" label="Email" icon={Mail} i={0}>
                    <input id="le" type="email" required autoComplete="email" inputMode="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                  </Field>
                  <Field id="lp" label="Password" icon={Lock} i={1}
                    after={<button type="button" className="lg-eye" onClick={() => setShowPw((v) => !v)} aria-label={showPw ? "Hide password" : "Show password"}>{showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>}>
                    <input id="lp" type={showPw ? "text" : "password"} required autoComplete="current-password" placeholder="Your password" value={password} onChange={(e) => setPassword(e.target.value)} />
                  </Field>
                  <button type="submit" disabled={busy} className="lg-cta" style={{ animationDelay: ".16s" }}>
                    {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <>Log in <ArrowRight className="h-4 w-4" /></>}
                  </button>
                </form>
              ) : (
                <form key="signup" className="lg-form" onSubmit={onSignup}>
                  <Field id="sn" label="Full name" icon={User} i={0}>
                    <input id="sn" required autoComplete="name" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />
                  </Field>
                  <Field id="se" label="Email" icon={Mail} i={1}>
                    <input id="se" type="email" required autoComplete="email" inputMode="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                  </Field>
                  <Field id="sp" label="Password" icon={Lock} i={2}
                    after={<button type="button" className="lg-eye" onClick={() => setShowPw((v) => !v)} aria-label={showPw ? "Hide password" : "Show password"}>{showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>}>
                    <input id="sp" type={showPw ? "text" : "password"} required minLength={6} autoComplete="new-password" placeholder="At least 6 characters" value={password} onChange={(e) => setPassword(e.target.value)} />
                  </Field>
                  <Field id="rc" label="Referral code" hint="optional · +10 bonus" icon={Gift} i={3}>
                    <input id="rc" value={refCode} onChange={(e) => setRefCode(e.target.value.toUpperCase())} placeholder="FRIEND'S CODE" maxLength={20} />
                  </Field>
                  <button type="submit" disabled={busy} className="lg-cta" style={{ animationDelay: ".3s" }}>
                    {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <>Create free account <ArrowRight className="h-4 w-4" /></>}
                  </button>
                  <p className="lg-fine">By signing up you agree to our terms &amp; privacy policy.</p>
                </form>
              )}

              <div className="lg-safe"><ShieldCheck className="h-3.5 w-3.5" /> Secure sign-in · your data stays private</div>
            </div>
          </div>

          {/* rotating motivation */}
          <div className="lg-quote" aria-live="polite">
            <span key={quote}>{QUOTES[quote]}</span>
          </div>

          <Link to="/" className="lg-back"><ArrowLeft className="h-4 w-4" /> Back to home</Link>
        </main>
      </div>
    </div>
  );
}

/* ───────── pieces ───────── */

function Field({ id, label, hint, icon: Icon, i, after, children }: {
  id: string; label: string; hint?: string; icon: ComponentType<{ className?: string }>; i: number; after?: ReactNode; children: ReactNode;
}) {
  return (
    <div className="lg-field" style={{ animationDelay: `${i * 0.06}s` }}>
      <label htmlFor={id}>{label}{hint && <em> ({hint})</em>}</label>
      <div className="lg-input">
        <Icon className="lg-ic h-4 w-4" />
        {children}
        {after}
      </div>
    </div>
  );
}

const LAST_USER_KEY = "nt-last-user";
type LastUser = { name: string; avatar: string | null; email: string | null };
function readLastUser(): LastUser | null {
  try {
    const raw = localStorage.getItem(LAST_USER_KEY);
    if (!raw) return null;
    const j = JSON.parse(raw);
    return j && typeof j.name === "string" && j.name ? { name: j.name, avatar: j.avatar ?? null, email: j.email ?? null } : null;
  } catch { return null; }
}

const QUOTES = [
  "“Small steps every day add up to a big rank.”",
  "“Consistency beats intensity. Show up today.”",
  "“One more chapter today, one step closer to the white coat.”",
  "“Mistakes are just questions you'll never get wrong again.”",
  "“Your future patients are counting on today's you.”",
];

const FEATURES = [
  { Icon: NotebookPen, t: "Free short notes", d: "Every Biology chapter, with diagrams", c: "#38BDF8" },
  { Icon: Trophy, t: "Mock tests", d: "NEET-pattern papers with analysis", c: "#F59E0B" },
  { Icon: History, t: "PYQs & important questions", d: "Practise what NEET actually asks", c: "#F472B6" },
  { Icon: Layers, t: "Flashcards & progress", d: "Revise fast, track every week", c: "#34D399" },
];

const FLOATERS = [
  { Icon: Dna, x: "6%", y: "14%", d: 0, s: "38px" },
  { Icon: Atom, x: "86%", y: "10%", d: -3, s: "44px" },
  { Icon: FlaskConical, x: "90%", y: "72%", d: -6, s: "36px" },
  { Icon: Brain, x: "4%", y: "78%", d: -2, s: "40px" },
  { Icon: HeartPulse, x: "48%", y: "92%", d: -8, s: "30px" },
  { Icon: Microscope, x: "52%", y: "4%", d: -5, s: "30px" },
];

const LOGIN_CSS = `
.lg-root{position:relative;min-height:100vh;min-height:100dvh;overflow:hidden;background:#050A16;color:#E8EEFF;color-scheme:dark;font-family:inherit}
.lg-bg{position:absolute;inset:0;pointer-events:none;overflow:hidden}
.lg-blob{position:absolute;border-radius:50%;filter:blur(80px);opacity:.55;animation:lg-drift 18s ease-in-out infinite alternate}
.lg-blob.b1{width:520px;height:520px;left:-140px;top:-160px;background:radial-gradient(closest-side,#7C3AED,transparent)}
.lg-blob.b2{width:560px;height:560px;right:-180px;top:20%;background:radial-gradient(closest-side,#0EA5E9,transparent);animation-delay:-6s}
.lg-blob.b3{width:480px;height:480px;left:25%;bottom:-220px;background:radial-gradient(closest-side,#10B981,transparent);animation-delay:-11s;opacity:.45}
.lg-grid{position:absolute;inset:0;background-image:linear-gradient(rgba(148,163,255,.06) 1px,transparent 1px),linear-gradient(90deg,rgba(148,163,255,.06) 1px,transparent 1px);background-size:44px 44px;-webkit-mask-image:radial-gradient(ellipse at 50% 40%,#000 25%,transparent 75%);mask-image:radial-gradient(ellipse at 50% 40%,#000 25%,transparent 75%)}
.lg-float{position:absolute;width:var(--s);height:var(--s);color:rgba(165,180,252,.16);animation:lg-bob 12s ease-in-out infinite}
@keyframes lg-drift{0%{transform:translate(0,0) scale(1)}50%{transform:translate(40px,30px) scale(1.08)}100%{transform:translate(-30px,50px) scale(.95)}}
@keyframes lg-bob{0%,100%{transform:translateY(0) rotate(0)}50%{transform:translateY(-22px) rotate(10deg)}}

.lg-wrap{position:relative;z-index:1;min-height:100vh;min-height:100dvh;display:grid;grid-template-columns:1fr;max-width:1160px;margin:0 auto;padding:28px 16px calc(28px + env(safe-area-inset-bottom))}
@media (min-width:1024px){.lg-wrap{grid-template-columns:1.05fr .95fr;gap:56px;align-items:center;padding:40px 32px}}

.lg-brand{display:inline-flex;align-items:center;gap:10px;font-weight:800;font-size:19px;letter-spacing:-.3px;color:#fff}
.lg-brand b{background:linear-gradient(90deg,#38BDF8,#2DD4BF,#34D399);-webkit-background-clip:text;background-clip:text;color:transparent}
.lg-logo{width:42px;height:42px;border-radius:13px;box-shadow:0 0 0 1px rgba(255,255,255,.12),0 10px 30px -8px rgba(56,189,248,.6)}

.lg-story{display:none}
@media (min-width:1024px){.lg-story{display:block;animation:lg-in .7s cubic-bezier(.2,.9,.2,1) both}}
.lg-h{margin:34px 0 0;font-size:46px;line-height:1.06;font-weight:800;letter-spacing:-1.4px;color:#fff}
.lg-h span{background:linear-gradient(100deg,#A78BFA,#38BDF8 45%,#34D399);-webkit-background-clip:text;background-clip:text;color:transparent;background-size:200% 100%;animation:lg-shimmer 6s linear infinite}
.lg-sub{margin:14px 0 0;max-width:430px;color:#A5B0D0;font-size:15.5px;line-height:1.6}
.lg-feats{list-style:none;margin:28px 0 0;padding:0;display:grid;gap:10px;max-width:440px}
.lg-feats li{display:flex;align-items:center;gap:12px;padding:11px 14px;border-radius:16px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);animation:lg-in .6s cubic-bezier(.2,.9,.2,1) both;transition:transform .25s,border-color .25s,background .25s}
.lg-feats li:hover{transform:translateX(6px);border-color:color-mix(in oklab,var(--c) 50%,transparent);background:rgba(255,255,255,.06)}
.lg-feats .ic{flex:none;display:grid;place-items:center;width:34px;height:34px;border-radius:11px;color:#fff;background:linear-gradient(135deg,var(--c),color-mix(in oklab,var(--c) 55%,#000));box-shadow:0 8px 18px -8px var(--c)}
.lg-feats b{display:block;font-size:14px;color:#fff}
.lg-feats em{display:block;font-style:normal;font-size:12.5px;color:#93A0C4}
.lg-proof{display:flex;gap:26px;margin-top:30px}
.lg-proof b{display:block;font-size:22px;font-weight:800;color:#fff;letter-spacing:-.4px}
.lg-proof span{font-size:12px;color:#8E9AC0}

.lg-main{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px}
.lg-brand-m{animation:lg-in .5s both}
@media (min-width:1024px){.lg-brand-m{display:none}}

.lg-card-wrap{position:relative;width:100%;max-width:440px;border-radius:28px;padding:1.5px;animation:lg-pop .7s cubic-bezier(.2,.9,.2,1) .05s both;overflow:hidden;isolation:isolate}
.lg-card-wrap::before{content:"";position:absolute;inset:-60%;z-index:-1;background:conic-gradient(from 0deg,transparent 0 55%,#38BDF8 66%,#A78BFA 76%,#34D399 86%,transparent 96%);animation:lg-spin 6s linear infinite}
.lg-card{position:relative;border-radius:27px;padding:26px 22px 20px;background:linear-gradient(180deg,#0D1428,#0A1020);box-shadow:0 40px 80px -30px rgba(0,0,0,.8),inset 0 1px 0 rgba(255,255,255,.06)}
@media (min-width:400px){.lg-card{padding:30px 28px 22px}}

.lg-greet{text-align:center;animation:lg-in .5s both}
.lg-greet h1{margin:12px 0 0;font-size:24px;line-height:1.2;font-weight:800;letter-spacing:-.5px;color:#fff}
.lg-greet h1 span{background:linear-gradient(90deg,#A78BFA,#38BDF8,#34D399);-webkit-background-clip:text;background-clip:text;color:transparent}
.lg-greet p{margin:6px 0 0;font-size:13.5px;color:#9AA6C8}
.lg-ava{position:relative;width:72px;height:72px;margin:0 auto;border-radius:50%;padding:3px;background:conic-gradient(#38BDF8,#A78BFA,#34D399,#38BDF8);animation:lg-glow 2.6s ease-in-out infinite}
.lg-ava img,.lg-ava span{width:100%;height:100%;border-radius:50%;object-fit:cover;display:grid;place-items:center;background:#0B1224;border:3px solid #0B1224;font-size:28px;font-weight:800;color:#fff}
.lg-ava i{position:absolute;right:-6px;bottom:-2px;font-style:normal;font-size:24px;transform-origin:70% 70%;animation:lg-wave 2.2s ease-in-out infinite}
.lg-spark{width:56px;height:56px;margin:0 auto;border-radius:18px;display:grid;place-items:center;color:#fff;background:linear-gradient(135deg,#7C3AED,#0EA5E9 60%,#10B981);box-shadow:0 14px 30px -10px rgba(14,165,233,.7);animation:lg-glow 2.6s ease-in-out infinite}
.lg-notyou{margin-top:8px;font-size:12px;font-weight:600;color:#7DD3FC;background:none;border:0;cursor:pointer;text-decoration:underline;text-underline-offset:3px}

.lg-google{position:relative;margin-top:20px;width:100%;height:50px;display:flex;align-items:center;justify-content:center;gap:10px;border-radius:15px;background:#fff;color:#0F172A;font-weight:700;font-size:15px;border:0;cursor:pointer;box-shadow:0 10px 24px -12px rgba(255,255,255,.4);transition:transform .2s,box-shadow .2s}
.lg-google:hover{transform:translateY(-1px);box-shadow:0 16px 30px -12px rgba(255,255,255,.5)}
.lg-google:active{transform:scale(.98)}
.lg-google:disabled{opacity:.7}

.lg-or{display:flex;align-items:center;gap:10px;margin:18px 0 14px}
.lg-or span{flex:1;height:1px;background:linear-gradient(90deg,transparent,rgba(255,255,255,.14),transparent)}
.lg-or em{display:inline-flex;align-items:center;gap:6px;font-style:normal;font-size:10.5px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#7F8BB0}

.lg-tabs{position:relative;display:grid;grid-template-columns:1fr 1fr;padding:4px;border-radius:14px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08)}
.lg-pill{position:absolute;top:4px;bottom:4px;left:4px;width:calc(50% - 4px);border-radius:11px;background:linear-gradient(135deg,rgba(124,58,237,.55),rgba(14,165,233,.5));box-shadow:0 6px 18px -6px rgba(56,189,248,.6),inset 0 1px 0 rgba(255,255,255,.15);transition:transform .4s cubic-bezier(.34,1.3,.5,1)}
.lg-tabs button{position:relative;z-index:1;height:40px;border:0;background:none;color:#8F9BC0;font-weight:700;font-size:14px;cursor:pointer;transition:color .25s}
.lg-tabs button.on{color:#fff}

.lg-form{margin-top:16px;display:grid;gap:13px}
.lg-field{animation:lg-in .45s cubic-bezier(.2,.9,.2,1) both}
.lg-field label{display:block;margin:0 0 6px 2px;font-size:12.5px;font-weight:700;color:#C7D0EA}
.lg-field label em{font-style:normal;font-weight:500;color:#7F8BB0}
.lg-input{position:relative;display:flex;align-items:center;height:50px;border-radius:14px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);transition:border-color .2s,box-shadow .25s,background .2s}
.lg-input:focus-within{border-color:#38BDF8;background:rgba(56,189,248,.06);box-shadow:0 0 0 4px rgba(56,189,248,.15),0 10px 30px -14px rgba(56,189,248,.6)}
.lg-ic{position:absolute;left:14px;color:#7F8BB0;transition:color .2s}
.lg-input:focus-within .lg-ic{color:#38BDF8}
.lg-input input{width:100%;height:100%;padding:0 44px 0 42px;background:none;border:0;outline:none;color:#fff;font-size:15px}
.lg-input input::placeholder{color:#5B6788}
.lg-input input:-webkit-autofill{-webkit-text-fill-color:#fff;-webkit-box-shadow:0 0 0 100px #0E1830 inset;caret-color:#fff}
.lg-eye{position:absolute;right:8px;display:grid;place-items:center;width:34px;height:34px;border-radius:10px;border:0;background:none;color:#8F9BC0;cursor:pointer}
.lg-eye:hover{color:#fff;background:rgba(255,255,255,.06)}

.lg-cta{position:relative;overflow:hidden;margin-top:4px;height:52px;display:flex;align-items:center;justify-content:center;gap:8px;border-radius:15px;border:0;cursor:pointer;color:#fff;font-weight:800;font-size:15.5px;letter-spacing:.1px;
  background:linear-gradient(110deg,#7C3AED,#2563EB 45%,#0EA5E9 70%,#10B981);background-size:180% 100%;box-shadow:0 18px 36px -14px rgba(37,99,235,.8),inset 0 1px 0 rgba(255,255,255,.2);
  transition:background-position .6s,transform .2s,box-shadow .2s;animation:lg-in .45s both}
.lg-cta::after{content:"";position:absolute;top:0;left:-60%;width:40%;height:100%;background:linear-gradient(100deg,transparent,rgba(255,255,255,.35),transparent);transform:skewX(-20deg);animation:lg-shine 3.2s ease-in-out infinite}
.lg-cta:hover{background-position:100% 0;transform:translateY(-1px);box-shadow:0 22px 40px -14px rgba(16,185,129,.7)}
.lg-cta:active{transform:scale(.985)}
.lg-cta:disabled{opacity:.75;cursor:default}
.lg-cta svg{transition:transform .25s}
.lg-cta:hover svg{transform:translateX(3px)}
.lg-fine{margin:2px 0 0;text-align:center;font-size:11px;color:#6E7A9E}
.lg-safe{margin-top:16px;display:flex;align-items:center;justify-content:center;gap:6px;font-size:11.5px;color:#7F8BB0}
.lg-safe svg{color:#34D399}

.lg-quote{min-height:22px;max-width:420px;text-align:center;font-size:13px;font-style:italic;color:#A5B4FC}
.lg-quote span{display:inline-block;animation:lg-quote 5.2s ease-in-out both}
.lg-back{display:inline-flex;align-items:center;gap:6px;padding:8px 14px;border-radius:12px;font-size:13.5px;font-weight:600;color:#C7D0EA;transition:background .2s,color .2s}
.lg-back:hover{background:rgba(255,255,255,.06);color:#fff}

@keyframes lg-in{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
@keyframes lg-pop{from{opacity:0;transform:translateY(22px) scale(.97)}to{opacity:1;transform:none}}
@keyframes lg-spin{to{transform:rotate(360deg)}}
@keyframes lg-shimmer{to{background-position:200% 0}}
@keyframes lg-shine{0%,55%{left:-60%}100%{left:130%}}
@keyframes lg-glow{0%,100%{box-shadow:0 0 0 0 rgba(56,189,248,.35),0 14px 30px -12px rgba(56,189,248,.6)}50%{box-shadow:0 0 0 10px rgba(56,189,248,0),0 14px 30px -12px rgba(167,139,250,.7)}}
@keyframes lg-wave{0%,60%,100%{transform:rotate(0)}10%,30%{transform:rotate(16deg)}20%,40%{transform:rotate(-8deg)}}
@keyframes lg-quote{0%{opacity:0;transform:translateY(6px)}12%,85%{opacity:1;transform:none}100%{opacity:0;transform:translateY(-6px)}}
@media (prefers-reduced-motion:reduce){
  .lg-root *,.lg-root *::before,.lg-root *::after{animation:none!important;transition:none!important}
}
`;
