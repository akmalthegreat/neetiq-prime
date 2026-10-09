import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Check, EyeOff, Loader2, RotateCcw, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { adminDeleteReview, adminListReviews, adminSetReviewStatus } from "@/lib/reviews.functions";

type Row = {
  id: string; user_id: string; rating: number; body: string; display_name: string;
  target_year: number | null; status: "published" | "hidden"; created_at: string; email: string | null;
};

/** Admin tool: approve, unpost or delete student reviews shown on the home page. */
export function ReviewsPanel() {
  const { user, isAdmin } = useAuth();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [tab, setTab] = useState<"pending" | "posted">("pending");
  const fnList = useServerFn(adminListReviews);
  const fnSet = useServerFn(adminSetReviewStatus);
  const fnDel = useServerFn(adminDeleteReview);

  async function load() {
    try { setRows((await fnList()).rows as Row[]); }
    catch (e: any) { toast.error(e?.message ?? "Could not load reviews"); setRows([]); }
  }
  useEffect(() => { if (user && isAdmin) load(); /* eslint-disable-next-line */ }, [user?.id, isAdmin]);

  async function toggle(r: Row) {
    const status = r.status === "published" ? "hidden" : "published";
    setBusy(r.id);
    try {
      await fnSet({ data: { id: r.id, status } });
      setRows((rs) => rs?.map((x) => (x.id === r.id ? { ...x, status } : x)) ?? null);
    } catch (e: any) { toast.error(e?.message ?? "Update failed"); }
    finally { setBusy(null); }
  }

  async function remove(r: Row) {
    if (!confirm(`Delete ${r.display_name}'s review permanently? This cannot be undone.`)) return;
    setBusy(r.id);
    try {
      await fnDel({ data: { id: r.id } });
      setRows((rs) => rs?.filter((x) => x.id !== r.id) ?? null);
      toast.success("Review deleted");
    } catch (e: any) { toast.error(e?.message ?? "Delete failed"); }
    finally { setBusy(null); }
  }

  const all = rows ?? [];
  const pending = all.filter((r) => r.status === "hidden");
  const posted = all.filter((r) => r.status === "published");
  const list = tab === "pending" ? pending : posted;

  return (
    <div>
      <div className="mb-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-2xl font-bold tracking-tight">Student reviews</h2>
          <Button variant="outline" size="sm" onClick={load}><RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Refresh</Button>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          New reviews wait here until you approve them. Only approved reviews (and their ratings) appear on the home page.
        </p>
      </div>
      <div className="mb-4 inline-flex rounded-xl border border-border bg-muted/40 p-1">
        {([["pending", `Pending (${pending.length})`], ["posted", `Posted (${posted.length})`]] as const).map(([k, label]) => (
          <button key={k} type="button" onClick={() => setTab(k)}
            className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors ${tab === k ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
            {label}
          </button>
        ))}
      </div>
      {rows === null ? (
        <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
      ) : !list.length ? (
        <Card><CardContent className="p-10 text-center text-sm text-muted-foreground">{tab === "pending" ? "No reviews waiting for approval." : "No reviews posted yet."}</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {list.map((r) => (
            <Card key={r.id}>
              <CardContent className="p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex">{[1, 2, 3, 4, 5].map((n) => (
                    <Star key={n} className={`h-4 w-4 ${n <= r.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`} />
                  ))}</span>
                  <span className="font-semibold">{r.display_name}</span>
                  {r.target_year && <span className="text-xs text-muted-foreground">NEET {r.target_year}</span>}
                  <Badge variant={r.status === "published" ? "default" : "secondary"}>{r.status === "published" ? "Posted" : "Pending"}</Badge>
                  <span className="ml-auto text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString("en-IN")}</span>
                </div>
                <p className="mt-2 whitespace-pre-line text-sm">{r.body}</p>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <span className="truncate text-xs text-muted-foreground">{r.email ?? r.user_id}</span>
                  <div className="flex shrink-0 gap-2">
                  <Button size="sm" variant="outline" disabled={busy === r.id} onClick={() => remove(r)}
                    className="text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-500/10">
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete
                  </Button>
                  <Button size="sm" variant={r.status === "published" ? "outline" : "default"} disabled={busy === r.id} onClick={() => toggle(r)}
                    className={r.status === "published" ? "" : "bg-emerald-600 text-white hover:bg-emerald-700"}>
                    {busy === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : r.status === "published"
                      ? <><EyeOff className="mr-1.5 h-3.5 w-3.5" /> Unpost</>
                      : <><Check className="mr-1.5 h-3.5 w-3.5" /> Approve &amp; post</>}
                  </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
