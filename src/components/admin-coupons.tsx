import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { adminListCoupons, adminUpsertCoupon, adminDeleteCoupon, adminListBatches } from "@/lib/batches.functions";
import { toast } from "sonner";

export function AdminCouponsTab() {
  const [coupons, setCoupons] = useState<any[] | null>(null);
  const [batches, setBatches] = useState<any[]>([]);
  const [code, setCode] = useState("");
  const [kind, setKind] = useState<"percent" | "flat">("percent");
  const [value, setValue] = useState(10);
  const [maxUses, setMaxUses] = useState<string>("");
  const [expires, setExpires] = useState<string>("");
  const [batchId, setBatchId] = useState<string>("all");
  const [active, setActive] = useState(true);
  const [busy, setBusy] = useState(false);
  const listFn = useServerFn(adminListCoupons);
  const upsert = useServerFn(adminUpsertCoupon);
  const del = useServerFn(adminDeleteCoupon);
  const listB = useServerFn(adminListBatches);

  async function refresh() {
    const [c, b] = await Promise.all([listFn(), listB()]);
    setCoupons(c as any[]); setBatches(b as any[]);
  }
  useEffect(() => { refresh().catch((e) => toast.error(e.message)); }, []);

  async function create() {
    setBusy(true);
    try {
      await upsert({ data: {
        code, kind, value: Number(value),
        max_uses: maxUses ? Number(maxUses) : null,
        expires_at: expires ? new Date(expires).toISOString() : null,
        batch_id: batchId === "all" ? null : batchId,
        active,
      } });
      toast.success("Coupon created");
      setCode(""); setValue(10); setMaxUses(""); setExpires("");
      await refresh();
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="space-y-3 p-5">
          <h3 className="text-lg font-semibold">Create coupon</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label>Code</Label><Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="LAUNCH50" /></div>
            <div><Label>Type</Label>
              <Select value={kind} onValueChange={(v: any) => setKind(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="percent">Percent off</SelectItem>
                  <SelectItem value="flat">Flat ₹ off</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Value ({kind === "percent" ? "%" : "₹"})</Label><Input type="number" value={value} onChange={(e) => setValue(Number(e.target.value))} /></div>
            <div><Label>Max uses (blank = unlimited)</Label><Input type="number" value={maxUses} onChange={(e) => setMaxUses(e.target.value)} /></div>
            <div><Label>Expires</Label><Input type="datetime-local" value={expires} onChange={(e) => setExpires(e.target.value)} /></div>
            <div><Label>Applies to</Label>
              <Select value={batchId} onValueChange={setBatchId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All batches</SelectItem>
                  {batches.map((b) => <SelectItem key={b.id} value={b.id}>{b.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm"><Switch checked={active} onCheckedChange={setActive} /> Active</label>
            <Button onClick={create} disabled={busy || !code}><Plus className="mr-2 h-4 w-4" /> Create</Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Existing coupons</h3>
        {coupons === null ? <Loader2 className="h-5 w-5 animate-spin" /> : coupons.length === 0 ? <p className="text-sm text-muted-foreground">None yet.</p> : (
          <div className="grid gap-2">
            {coupons.map((c) => (
              <Card key={c.id}>
                <CardContent className="flex items-center justify-between p-3 text-sm">
                  <div>
                    <div className="font-mono font-bold">{c.code}</div>
                    <div className="text-xs text-muted-foreground">
                      {c.kind === "percent" ? `${c.value}%` : `₹${c.value}`} off • used {c.used_count}{c.max_uses ? `/${c.max_uses}` : ""} • {c.batch?.title ?? "all batches"}
                      {c.expires_at && ` • expires ${new Date(c.expires_at).toLocaleDateString()}`}
                      {!c.active && " • inactive"}
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" onClick={async () => { if (confirm("Delete?")) { await del({ data: { id: c.id } }); refresh(); } }}><Trash2 className="h-4 w-4" /></Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
