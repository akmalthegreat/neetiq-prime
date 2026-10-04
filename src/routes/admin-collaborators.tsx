import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { PageShell } from "@/components/page-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Loader2, Crown, Users, IndianRupee, TrendingUp, Wallet, ChevronLeft, ChevronRight, Pencil, Save, Link2, Tag } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import {
  adminListCollaborators,
  adminUpdateCollaboratorStatus,
  adminUpdateCollaboratorDetails,
} from "@/lib/collaborators.functions";

export const Route = createFileRoute("/admin-collaborators")({
  head: () => ({ meta: [{ title: "Admin · Collaborators — NEETIQ Prime" }] }),
  component: AdminCollaborators,
});

function AdminCollaborators() {
  const { user, isAdmin, loading } = useAuth();
  const nav = useNavigate();
  const list = useServerFn(adminListCollaborators);
  const update = useServerFn(adminUpdateCollaboratorStatus);
  const updateDetails = useServerFn(adminUpdateCollaboratorDetails);

  const [rows, setRows] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [idx, setIdx] = useState(0);
  const [notes, setNotes] = useState("");
  const [editingDetails, setEditingDetails] = useState(false);
  const [editName, setEditName] = useState("");
  const [editLink, setEditLink] = useState("");
  const [editCoupon, setEditCoupon] = useState("");
  const [busy, setBusy] = useState(false);

  const reload = async () => {
    const fresh = await list();
    setRows(fresh.rows);
    setLoaded(true);
  };

  useEffect(() => { if (!loading && !user) nav({ to: "/login" }); }, [user, loading, nav]);
  useEffect(() => {
    if (!user || !isAdmin) return;
    reload().catch((e) => toast.error(e?.message ?? "Failed"));
  }, [user?.id, isAdmin]);

  useEffect(() => {
    const c = rows[idx];
    setNotes(c?.admin_notes ?? "");
    setEditingDetails(false);
    setEditName(c?.name ?? "");
    setEditLink(c?.collaborator_link?.code ?? "");
    setEditCoupon(c?.collaborator_coupon?.code ?? "");
  }, [idx, rows]);

  if (loading || !loaded) {
    return <PageShell eyebrow="Admin" title="Collaborators"><div className="flex h-40 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div></PageShell>;
  }
  if (!isAdmin) {
    return <PageShell eyebrow="Admin" title="Restricted"><Card><CardContent className="p-5 text-sm">Admin only.</CardContent></Card></PageShell>;
  }
  if (rows.length === 0) {
    return <PageShell eyebrow="Admin" title="Collaborators"><Card><CardContent className="p-6 text-center text-sm text-muted-foreground">No collaborator applications yet.</CardContent></Card></PageShell>;
  }

  const c = rows[idx];

  const selectCollaborator = (value: string) => {
    const next = rows.findIndex((r) => r.id === value);
    if (next >= 0) setIdx(next);
  };

  const setStatus = async (status: "approved" | "rejected" | "pending" | "ended") => {
    setBusy(true);
    try {
      await update({ data: { id: c.id, status, admin_notes: notes || undefined } });
      toast.success("Updated");
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally { setBusy(false); }
  };

  const saveDetails = async () => {
    setBusy(true);
    try {
      const result = await updateDetails({
        data: {
          user_id: c.user_id,
          name: editName,
          link_code: editLink,
          coupon_code: editCoupon,
        },
      });
      toast.success("Collaborator name, link and coupon updated");
      setEditingDetails(false);
      await reload();
      const freshIndex = rows.findIndex((r) => r.id === c.id);
      if (freshIndex >= 0) setIdx(freshIndex);
      // Keep the returned values visible immediately even if the list refresh is delayed.
      setEditLink(result.link_code);
      setEditCoupon(result.coupon_code);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save changes");
    } finally { setBusy(false); }
  };

  const linkCode = c.collaborator_link?.code ?? "—";
  const couponCode = c.collaborator_coupon?.code ?? "—";

  return (
    <PageShell eyebrow="Admin" title="Collaborators" description="Choose a collaborator and manage their name, private link and coupon code.">
      <div className="mb-3 grid gap-2 sm:grid-cols-[1fr_auto]">
        <Select value={c.id} onValueChange={selectCollaborator}>
          <SelectTrigger><SelectValue placeholder="Choose collaborator" /></SelectTrigger>
          <SelectContent>
            {rows.map((r) => (
              <SelectItem key={r.id} value={r.id}>
                {r.name} · {r.profile?.email ?? r.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center justify-end gap-1.5 text-sm">
          <Button variant="outline" size="icon" disabled={idx === 0} onClick={() => setIdx(idx - 1)}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="px-2 text-xs text-muted-foreground">{idx + 1} / {rows.length}</span>
          <Button variant="outline" size="icon" disabled={idx >= rows.length - 1} onClick={() => setIdx(idx + 1)}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>

      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-base font-bold"><Crown className="h-4 w-4 text-amber-600" /> {c.name}</div>
              <div className="text-xs text-muted-foreground">{c.profile?.email ?? c.email}</div>
            </div>
            <Badge variant="outline">{c.status}</Badge>
          </div>

          <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <div className="text-sm font-bold">Collaborator identity & promotion codes</div>
                <div className="text-xs text-muted-foreground">Choose who owns this promotion and edit the public link/code.</div>
              </div>
              {!editingDetails ? (
                <Button variant="outline" size="sm" onClick={() => setEditingDetails(true)}>
                  <Pencil className="mr-1.5 h-4 w-4" /> Edit
                </Button>
              ) : null}
            </div>

            {editingDetails ? (
              <div className="space-y-3">
                <div>
                  <div className="mb-1 text-xs font-medium">Collaborator name</div>
                  <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="e.g. Sahil" />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <div className="mb-1 flex items-center gap-1 text-xs font-medium"><Link2 className="h-3.5 w-3.5" /> Private link code</div>
                    <Input value={editLink} onChange={(e) => setEditLink(e.target.value.toUpperCase())} placeholder="e.g. SAHIL2026" />
                    <div className="mt-1 text-[10px] text-muted-foreground">Link: neettrack.com/c/{editLink || "CODE"}</div>
                  </div>
                  <div>
                    <div className="mb-1 flex items-center gap-1 text-xs font-medium"><Tag className="h-3.5 w-3.5" /> Collaborator coupon</div>
                    <Input value={editCoupon} onChange={(e) => setEditCoupon(e.target.value.toUpperCase())} placeholder="e.g. SAHILNEET" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={saveDetails} disabled={busy || !editName.trim() || !editLink.trim() || !editCoupon.trim()}>
                    {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
                    Save changes
                  </Button>
                  <Button variant="ghost" onClick={() => setEditingDetails(false)} disabled={busy}>Cancel</Button>
                </div>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Name" value={c.name} />
                <Field label="Private link" value={linkCode === "—" ? "Not created" : `neettrack.com/c/${linkCode}`} />
                <Field label="Coupon code" value={couponCode} />
              </div>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Contact" value={c.contact} />
            <Field label="Email" value={c.email} />
            <Field label="Commitment" value={`${c.months} month(s)`} />
            <Field label="Plan" value={`${c.share_pct}% share · min ₹${Number(c.min_withdrawal).toFixed(0)}`} />
            <Field label="Applied" value={new Date(c.created_at).toLocaleString()} />
            <Field label="Account name" value={c.profile?.full_name ?? "—"} />
          </div>

          <div>
            <div className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Promotion asset</div>
            <div className="whitespace-pre-wrap rounded-lg border bg-secondary/40 p-3 text-sm">{c.promo_asset}</div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat icon={<Users className="h-4 w-4 text-blue-600" />} label="Invited" value={String(c.total_invited)} />
            <Stat icon={<IndianRupee className="h-4 w-4 text-emerald-600" />} label="Invested" value={`₹${c.total_invested.toFixed(2)}`} />
            <Stat icon={<TrendingUp className="h-4 w-4 text-violet-600" />} label="Revenue (30%)" value={`₹${c.total_revenue.toFixed(2)}`} />
            <Stat icon={<Wallet className="h-4 w-4 text-amber-600" />} label={`Earnings (${c.share_pct}%)`} value={`₹${c.collaborator_earnings.toFixed(2)}`} highlight />
          </div>

          <div className="space-y-1.5">
            <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Admin notes</div>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Internal notes…" maxLength={2000} />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select onValueChange={(v) => setStatus(v as any)} disabled={busy}>
              <SelectTrigger className="w-48"><SelectValue placeholder="Change status…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Mark pending</SelectItem>
                <SelectItem value="approved">Approve</SelectItem>
                <SelectItem value="rejected">Reject</SelectItem>
                <SelectItem value="ended">Mark ended</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={() => setStatus("approved")} disabled={busy} className="bg-emerald-600 text-white hover:bg-emerald-700">Approve</Button>
            <Button onClick={() => setStatus("rejected")} disabled={busy} variant="destructive">Reject</Button>
          </div>
        </CardContent>
      </Card>
    </PageShell>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="text-sm break-words">{value}</div>
    </div>
  );
}

function Stat({ icon, label, value, highlight }: { icon: React.ReactNode; label: string; value: string; highlight?: boolean }) {
  return (
    <Card className={highlight ? "border-amber-500/40 bg-gradient-to-br from-amber-500/10 to-transparent" : ""}>
      <CardContent className="space-y-1 p-3">
        <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{icon}{label}</div>
        <div className="text-lg font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}
