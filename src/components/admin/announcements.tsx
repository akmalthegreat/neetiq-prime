// Admin: send a notification to all students or only premium members.
// It lands in every student's bell instantly, and as a phone notification
// on devices where they turned notifications on.

import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Bell, Loader2, Megaphone, Send, Smartphone, Users, Crown } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { adminSendAnnouncement, adminPushAnnouncementBatch, adminListAnnouncements } from "@/lib/admin-panel.functions";
import { cn } from "@/lib/utils";

const LINKS = [
  ["/dashboard", "Dashboard"], ["/mega-quiz", "Daily Mega Quiz"], ["/mocks", "Mock tests"], ["/contests", "Contests"],
  ["/batches", "Plans / batches"], ["/mentorship", "Mentorship"], ["/consult", "Dr. Azka Consult"], ["/generate", "Generate test"],
] as const;

export function Announcements() {
  const sendFn = useServerFn(adminSendAnnouncement);
  const pushFn = useServerFn(adminPushAnnouncementBatch);
  const listFn = useServerFn(adminListAnnouncements);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("/dashboard");
  const [audience, setAudience] = useState<"all" | "premium">("all");
  const [confirm, setConfirm] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [history, setHistory] = useState<Awaited<ReturnType<typeof adminListAnnouncements>> | null>(null);

  const load = () => listFn().then(setHistory).catch(() => {});
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const ready = title.trim().length >= 3 && body.trim().length >= 3;

  async function send() {
    setConfirm(false);
    setProgress("Adding to every student's notifications…");
    try {
      const r = await sendFn({ data: { title: title.trim(), body: body.trim(), url, audience } });
      let sent = 0;
      for (let i = 0; i < 500; i++) {
        setProgress(`Sent to ${r.inApp.toLocaleString("en-IN")} bells · phone notifications: ${sent}`);
        const b = await pushFn({ data: { job: r.job } });
        sent += b.sent;
        if (b.done) break;
      }
      toast.success(`Sent. ${r.inApp.toLocaleString("en-IN")} students notified, ${sent} phones.`);
      setTitle(""); setBody("");
      load();
    } catch (e: any) { toast.error(e?.message ?? "Could not send"); }
    finally { setProgress(null); }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Megaphone className="h-5 w-5 text-primary" /> Send an announcement</CardTitle>
          <CardDescription>Appears in the notification bell for every student instantly, and on phones that turned notifications on{history ? ` (${history.devices} device${history.devices === 1 ? "" : "s"} right now)` : ""}.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {([["all", "All students", Users], ["premium", "Premium only", Crown]] as const).map(([v, l, Icon]) => (
              <button key={v} type="button" onClick={() => setAudience(v)}
                className={cn("flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-semibold",
                  audience === v ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground")}>
                <Icon className="h-4 w-4" /> {l}
              </button>
            ))}
          </div>
          <div><Label>Title</Label><Input value={title} maxLength={70} onChange={(e) => setTitle(e.target.value)} placeholder="Mega Quiz tonight at 8:30 PM" /></div>
          <div>
            <Label>Message</Label>
            <Textarea value={body} maxLength={200} rows={3} onChange={(e) => setBody(e.target.value)} placeholder="80 questions, ₹21 for the top scorer. Entry closes 8:35 PM." />
            <div className="mt-1 text-right text-[11px] text-muted-foreground">{body.length}/200</div>
          </div>
          <div>
            <Label>Tapping it opens</Label>
            <select value={url} onChange={(e) => setUrl(e.target.value)} className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
              {LINKS.map(([p, l]) => <option key={p} value={p}>{l}</option>)}
            </select>
          </div>

          {(title || body) && (
            <div className="rounded-xl border border-border bg-secondary/30 p-3">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Phone preview</div>
              <div className="flex gap-3 rounded-xl bg-background p-3 shadow-sm">
                <img src="/icons/icon-192.png" alt="" className="h-9 w-9 rounded-lg" />
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">NEET Track · now</div>
                  <div className="truncate text-sm font-semibold">{title || "Title"}</div>
                  <div className="text-sm text-muted-foreground">{body || "Message"}</div>
                </div>
              </div>
            </div>
          )}

          {progress ? (
            <div className="flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-2 text-sm text-primary"><Loader2 className="h-4 w-4 animate-spin" /> {progress}</div>
          ) : (
            <Button onClick={() => setConfirm(true)} disabled={!ready} className="w-full gap-2 sm:w-auto"><Send className="h-4 w-4" /> Send to {audience === "all" ? "all students" : "premium members"}</Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Recently sent</CardTitle></CardHeader>
        <CardContent>
          {history === null ? <Loader2 className="h-5 w-5 animate-spin text-primary" />
            : history.jobs.length === 0 ? <p className="text-sm text-muted-foreground">Nothing sent yet.</p>
            : (
              <ul className="divide-y divide-border">
                {history.jobs.map((j) => (
                  <li key={j.id} className="py-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{j.title}</div>
                        <div className="truncate text-xs text-muted-foreground">{j.body}</div>
                      </div>
                      <span className="shrink-0 text-[11px] text-muted-foreground">{new Date(j.created_at).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1.5 text-[11px]">
                      <Badge variant="outline">{j.audience === "all" ? "All students" : j.audience === "premium" ? "Premium" : "Mega Quiz players"}</Badge>
                      <Badge variant="secondary">{j.kind === "announcement" ? "Announcement" : j.kind?.startsWith("mega") ? "Mega Quiz (automatic)" : j.kind}</Badge>
                      <span className="inline-flex items-center gap-1 text-muted-foreground"><Bell className="h-3 w-3" /> bell</span>
                      <span className="inline-flex items-center gap-1 text-muted-foreground"><Smartphone className="h-3 w-3" /> {j.sent ?? 0} phones</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
        </CardContent>
      </Card>

      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send to {audience === "all" ? "all students" : "premium members"}?</AlertDialogTitle>
            <AlertDialogDescription>“{title}”. This can't be unsent.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={send}>Send now</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
