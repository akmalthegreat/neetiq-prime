import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ChevronLeft, Eye, EyeOff, Loader2, RotateCcw, Star } from "lucide-react";
import { toast } from "sonner";
import { PageShell } from "@/components/page-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { adminListReviews, adminSetReviewStatus } from "@/lib/reviews.functions";

export const Route = createFileRoute("/admin-reviews")({
  head: () => ({ meta: [{ title: "Admin · Public reviews — NEET Track" }] }),
  component: AdminReviews,
});

type Row = {
  id: string; user_id: string; rating: number; body: string; display_name: string;
  target_year: number | null; status: "published" | "hidden"; created_at: string; email: string | null;
};

function AdminReviews() {
  const { user, isAdmin, loading } = useAuth();
  const nav = useNavigate();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const fnList = useServerFn(adminListReviews);
  const fnSet = useServerFn(adminSetReviewStatus);

  useEffect(() => {
    if (loading) return;
    if (!user) nav({ to: "/login" });
    else if (!isAdmin) nav({ to: "/dashboard" });
  }, [user, isAdmin, loading, nav]);

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

  const list = rows ?? [];
  const avg = list.length ? (list.reduce((a, r) => a + r.rating, 0) / list.length).toFixed(1) : "—";

  return (
    <PageShell>
      <div className="mb-4 flex items-center justify-between">
        <Button asChild variant="ghost" size="sm"><Link to="/admin/feedback"><ChevronLeft className="mr-1 h-4 w-4" /> Feedback</Link></Button>
        <Button variant="outline" size="sm" onClick={load}><RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Refresh</Button>
      </div>
      <div className="mb-4">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Admin</div>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">Public reviews</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Reviews shown on the home page. Hide only spam or abusive text — the student's star rating still counts.
        </p>
        <p className="mt-2 text-sm"><b>{list.length}</b> reviews · avg <b>{avg}</b> ★ · <b>{list.filter((r) => r.status === "hidden").length}</b> hidden</p>
      </div>
      {rows === null ? (
        <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
      ) : !list.length ? (
        <Card><CardContent className="p-10 text-center text-sm text-muted-foreground">No public reviews yet.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {list.map((r) => (
            <Card key={r.id} className={r.status === "hidden" ? "opacity-60" : ""}>
              <CardContent className="p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex">{[1, 2, 3, 4, 5].map((n) => (
                    <Star key={n} className={`h-4 w-4 ${n <= r.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`} />
                  ))}</span>
                  <span className="font-semibold">{r.display_name}</span>
                  {r.target_year && <span className="text-xs text-muted-foreground">NEET {r.target_year}</span>}
                  <Badge variant={r.status === "published" ? "default" : "secondary"}>{r.status}</Badge>
                  <span className="ml-auto text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString("en-IN")}</span>
                </div>
                <p className="mt-2 whitespace-pre-line text-sm">{r.body}</p>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <span className="truncate text-xs text-muted-foreground">{r.email ?? r.user_id}</span>
                  <Button size="sm" variant="outline" disabled={busy === r.id} onClick={() => toggle(r)}>
                    {busy === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : r.status === "published"
                      ? <><EyeOff className="mr-1.5 h-3.5 w-3.5" /> Hide text</>
                      : <><Eye className="mr-1.5 h-3.5 w-3.5" /> Publish</>}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </PageShell>
  );
}
