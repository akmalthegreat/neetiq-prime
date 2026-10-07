// "Turn on notifications" card. Subscribes this device to Web Push so the student
// gets the 8:15 PM Mega Quiz reminder and their result, even with the app closed.

import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Bell, BellOff, BellRing, X } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { savePushSubscription, removePushSubscription } from "@/lib/push.functions";
import { VAPID_PUBLIC_KEY } from "@/lib/push-key";
import { cn } from "@/lib/utils";

type Status = "checking" | "unsupported" | "ios-install" | "denied" | "off" | "on";

const DISMISS_KEY = "push-optin-dismissed";

function keyBytes(b64: string) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

const isIos = () => typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent);
const isStandalone = () =>
  typeof window !== "undefined" && (window.matchMedia?.("(display-mode: standalone)").matches || (navigator as any).standalone === true);

async function currentSubscription() {
  const reg = await navigator.serviceWorker.getRegistration("/");
  return reg ? reg.pushManager.getSubscription() : null;
}

export function PushOptIn({ compact = false, dismissible = false }: { compact?: boolean; dismissible?: boolean }) {
  const { user } = useAuth();
  const save = useServerFn(savePushSubscription);
  const remove = useServerFn(removePushSubscription);
  const [status, setStatus] = useState<Status>("checking");
  const [busy, setBusy] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (dismissible) { try { if (localStorage.getItem(DISMISS_KEY)) setHidden(true); } catch { /* ignore */ } }
    const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    if (!supported) { setStatus(isIos() && !isStandalone() ? "ios-install" : "unsupported"); return; }
    if (Notification.permission === "denied") { setStatus("denied"); return; }
    currentSubscription()
      .then((sub) => {
        setStatus(sub && Notification.permission === "granted" ? "on" : "off");
        // Keep the server copy fresh (subscriptions can rotate).
        if (sub && user) void save({ data: sub.toJSON() as any }).catch(() => {});
      })
      .catch(() => setStatus("off"));
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  async function turnOn() {
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") { setStatus(perm === "denied" ? "denied" : "off"); return; }
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription())
        ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC_KEY) }));
      await save({ data: sub.toJSON() as any });
      setStatus("on");
      toast.success("Notifications are on");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not turn on notifications");
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    setBusy(true);
    try {
      const sub = await currentSubscription();
      if (sub) { await remove({ data: { endpoint: sub.endpoint } }).catch(() => {}); await sub.unsubscribe(); }
      setStatus("off");
    } finally {
      setBusy(false);
    }
  }

  function dismiss() {
    setHidden(true);
    try { localStorage.setItem(DISMISS_KEY, "1"); } catch { /* ignore */ }
  }

  if (!user || hidden || status === "checking" || status === "unsupported") return null;
  if (compact && status === "on") return null;

  if (status === "on") {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm">
        <BellRing className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
        <span className="flex-1 font-medium">Notifications are on for this device.</span>
        <button type="button" onClick={turnOff} disabled={busy} className="text-xs font-semibold text-muted-foreground underline">Turn off</button>
      </div>
    );
  }

  return (
    <div className={cn("relative rounded-2xl border border-border bg-card", compact ? "p-4" : "p-5")}>
      {dismissible && (
        <button type="button" onClick={dismiss} aria-label="Hide" className="absolute right-3 top-3 text-muted-foreground"><X className="h-4 w-4" /></button>
      )}
      <div className="flex items-start gap-3 pr-6">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
          {status === "denied" ? <BellOff className="h-5 w-5" /> : <Bell className="h-5 w-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-semibold">
            {status === "denied" ? "Notifications are blocked" : status === "ios-install" ? "Get Mega Quiz reminders" : "Never miss the 8:30 PM Mega Quiz"}
          </div>
          <p className="mt-0.5 text-sm leading-snug text-muted-foreground">
            {status === "denied"
              ? "Allow notifications for neettrack.com in your browser's site settings, then come back here."
              : status === "ios-install"
                ? "On iPhone, first add NEET Track to your Home Screen (Share, then Add to Home Screen). Open it from there to turn on notifications."
                : "Get a reminder at 8:15 PM and your result after the quiz, even when the app is closed."}
          </p>
          {status === "off" && (
            <button type="button" onClick={turnOn} disabled={busy}
              className="mt-3 inline-flex h-10 items-center gap-2 rounded-xl bg-amber-400 px-4 text-sm font-bold text-amber-950 disabled:opacity-50">
              <Bell className="h-4 w-4" /> {busy ? "Turning on…" : "Turn on notifications"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
