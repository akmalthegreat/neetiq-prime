import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Eye, EyeOff, Loader2, Lock, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset password — NEET Track" },
      { name: "description", content: "Choose a new password for your NEET Track account." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const nav = useNavigate();
  const [ready, setReady] = useState(false);
  const [expired, setExpired] = useState(false);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  // The email link signs the user in with a short-lived "recovery" session.
  // Wait for it; if it never arrives the link is invalid or expired.
  useEffect(() => {
    let done = false;
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
        done = true;
        setReady(true);
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) { done = true; setReady(true); }
    });
    const t = setTimeout(() => { if (!done) setExpired(true); }, 4000);
    return () => { sub.subscription.unsubscribe(); clearTimeout(t); };
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.length < 6) return toast.error("Password must be at least 6 characters.");
    if (pw !== pw2) return toast.error("The two passwords don't match.");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return toast.error(error.message || "Could not update your password. Please request a new link.");
    toast.success("Password updated. You're signed in.");
    nav({ to: "/dashboard" });
  };

  return (
    <div className="min-h-screen bg-[#050A16] text-[#E8EEFF] grid place-items-center px-4 py-10" style={{ colorScheme: "dark" }}>
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#0D1428] p-6 sm:p-8 shadow-2xl">
        <Link to="/" className="mb-6 flex items-center gap-2.5 font-extrabold text-lg text-white">
          <img src="/icons/icon-192.png" alt="" className="h-10 w-10 rounded-xl" />
          <span>NEET Track</span>
        </Link>

        <h1 className="text-2xl font-extrabold text-white">Set a new password</h1>
        <p className="mt-1 text-sm text-[#9AA6C8]">Choose a new password for your account.</p>

        {ready ? (
          <form onSubmit={onSubmit} className="mt-6 grid gap-4">
            <div>
              <label htmlFor="np" className="mb-1.5 block text-[12.5px] font-bold text-[#C7D0EA]">New password</label>
              <div className="relative flex h-12 items-center rounded-2xl border border-white/10 bg-white/5 focus-within:border-sky-400">
                <Lock className="absolute left-3.5 h-4 w-4 text-[#7F8BB0]" />
                <input id="np" type={show ? "text" : "password"} required minLength={6} autoComplete="new-password"
                  placeholder="At least 6 characters" value={pw} onChange={(e) => setPw(e.target.value)}
                  className="h-full w-full bg-transparent pl-10 pr-11 text-[15px] text-white outline-none placeholder:text-[#5B6788]" />
                <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? "Hide password" : "Show password"}
                  className="absolute right-2 grid h-8 w-8 place-items-center rounded-lg text-[#8F9BC0] hover:text-white">
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div>
              <label htmlFor="np2" className="mb-1.5 block text-[12.5px] font-bold text-[#C7D0EA]">Confirm new password</label>
              <div className="relative flex h-12 items-center rounded-2xl border border-white/10 bg-white/5 focus-within:border-sky-400">
                <Lock className="absolute left-3.5 h-4 w-4 text-[#7F8BB0]" />
                <input id="np2" type={show ? "text" : "password"} required minLength={6} autoComplete="new-password"
                  placeholder="Type it again" value={pw2} onChange={(e) => setPw2(e.target.value)}
                  className="h-full w-full bg-transparent pl-10 pr-4 text-[15px] text-white outline-none placeholder:text-[#5B6788]" />
              </div>
            </div>
            <button type="submit" disabled={busy}
              className="mt-1 flex h-12 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 via-blue-600 to-emerald-500 font-extrabold text-white disabled:opacity-70">
              {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : "Update password"}
            </button>
          </form>
        ) : expired ? (
          <div className="mt-6 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-100">
            This reset link is invalid or has expired. Please go back to the login page and tap
            <b> Forgot password?</b> to get a new link.
            <Link to="/login" className="mt-3 block font-bold underline">Back to log in</Link>
          </div>
        ) : (
          <div className="mt-8 flex items-center gap-2 text-sm text-[#9AA6C8]">
            <Loader2 className="h-4 w-4 animate-spin" /> Checking your link…
          </div>
        )}

        <div className="mt-6 flex items-center justify-center gap-1.5 text-[11.5px] text-[#7F8BB0]">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" /> Secure · your data stays private
        </div>
      </div>
    </div>
  );
}
