// Admin: home-page banner slides. Add, edit, reorder, schedule, switch off,
// and choose whether the built-in slides also show.

import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, ImagePlus, Loader2, Pencil, Plus, Trash2, Eye, EyeOff, X } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import {
  adminListBanners, adminSaveBanner, adminDeleteBanner, adminReorderBanners, adminSetBuiltInSlides, adminBannerUploadUrl,
} from "@/lib/admin-panel.functions";
import { cn } from "@/lib/utils";

const THEMES = {
  blue: "conic-gradient(from 0deg at 30% 40%,#1D4ED8,#7C3AED,#0EA5E9,#4338CA,#1D4ED8)",
  amber: "conic-gradient(from 90deg at 60% 50%,#92400E,#DC2626,#F59E0B,#B45309,#92400E)",
  green: "conic-gradient(from 180deg at 40% 60%,#065F46,#0E7490,#10B981,#155E75,#065F46)",
  pink: "conic-gradient(from 270deg at 50% 40%,#9F1239,#7C3AED,#DB2777,#BE123C,#9F1239)",
  violet: "conic-gradient(from 45deg at 50% 50%,#3730A3,#6D28D9,#2563EB,#4C1D95,#3730A3)",
} as const;
type Theme = keyof typeof THEMES;

const PAGES = [
  ["/mega-quiz", "Daily Mega Quiz"], ["/mocks", "Mock tests"], ["/contests", "Contests"], ["/batches", "Plans / batches"],
  ["/mentorship", "Mentorship"], ["/consult", "Dr. Azka Consult"], ["/generate", "Generate test"], ["/flashcards", "Flashcards"],
  ["/ncert-key-points", "NCERT key points"], ["/chapter-pyqs", "Chapter PYQs"], ["/wallet", "Wallet"], ["/dashboard", "Dashboard"],
] as const;

type Draft = {
  id?: string; tag: string; title: string; subtitle: string; cta_label: string; link_url: string;
  image_url: string | null; theme: Theme; active: boolean; starts_at: string; ends_at: string;
};

const empty = (): Draft => ({ tag: "NEW", title: "", subtitle: "", cta_label: "Open", link_url: "/mega-quiz", image_url: null, theme: "blue", active: true, starts_at: "", ends_at: "" });

// <input type="datetime-local"> works in local time; the server stores ISO.
const toLocal = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
const toIso = (local: string) => (local ? new Date(local).toISOString() : null);

export function BannerManager() {
  const listFn = useServerFn(adminListBanners);
  const saveFn = useServerFn(adminSaveBanner);
  const delFn = useServerFn(adminDeleteBanner);
  const orderFn = useServerFn(adminReorderBanners);
  const builtInFn = useServerFn(adminSetBuiltInSlides);
  const [rows, setRows] = useState<any[] | null>(null);
  const [showBuiltIn, setShowBuiltIn] = useState(true);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => listFn().then((r) => { setRows(r.banners); setShowBuiltIn(r.showBuiltIn); }).catch((e) => toast.error(e?.message ?? "Could not load banners"));
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const slides = (rows ?? []).filter((b) => b.title);
  const legacy = (rows ?? []).filter((b) => !b.title);

  async function save() {
    if (!draft) return;
    if (draft.title.trim().length < 2) return toast.error("Add a title");
    if (!draft.link_url.trim()) return toast.error("Add where the button goes");
    setBusy(true);
    try {
      await saveFn({ data: { ...draft, starts_at: toIso(draft.starts_at), ends_at: toIso(draft.ends_at) } });
      toast.success(draft.id ? "Banner updated" : "Banner added to the home page");
      setDraft(null);
      await load();
    } catch (e: any) { toast.error(e?.message ?? "Could not save"); }
    finally { setBusy(false); }
  }

  async function quick(b: any, patch: Partial<Draft>) {
    try {
      await saveFn({ data: {
        id: b.id, tag: b.tag ?? "", title: b.title, subtitle: b.subtitle ?? "", cta_label: b.cta_label ?? "Open", link_url: b.link_url ?? "/dashboard",
        image_url: b.image_url, theme: (b.theme ?? "blue") as Theme, active: b.active, starts_at: b.starts_at, ends_at: b.ends_at, ...patch,
      } as any });
      await load();
    } catch (e: any) { toast.error(e?.message ?? "Could not update"); }
  }

  async function move(i: number, dir: -1 | 1) {
    const ids = slides.map((b) => b.id);
    const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    setRows([...ids.map((id) => slides.find((b) => b.id === id)), ...legacy]);
    try { await orderFn({ data: { ids } }); } catch (e: any) { toast.error(e?.message ?? "Could not reorder"); load(); }
  }

  async function remove(b: any) {
    if (!window.confirm(`Delete the banner “${b.title ?? "image banner"}”?`)) return;
    try { await delFn({ data: { id: b.id } }); toast.success("Banner deleted"); load(); }
    catch (e: any) { toast.error(e?.message ?? "Could not delete"); }
  }

  const status = (b: any) => {
    const now = Date.now();
    if (!b.active) return { label: "Off", cls: "text-muted-foreground" };
    if (b.starts_at && new Date(b.starts_at).getTime() > now) return { label: `Starts ${new Date(b.starts_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}`, cls: "text-sky-600 dark:text-sky-400" };
    if (b.ends_at && new Date(b.ends_at).getTime() <= now) return { label: "Ended", cls: "text-muted-foreground" };
    return { label: b.ends_at ? `Live until ${new Date(b.ends_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}` : "Live", cls: "text-emerald-600 dark:text-emerald-400" };
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
          <div>
            <CardTitle>Home page banners</CardTitle>
            <CardDescription>Slides at the top of every student's dashboard. Yours show first, in this order.</CardDescription>
          </div>
          {!draft && <Button onClick={() => setDraft(empty())} className="gap-1.5"><Plus className="h-4 w-4" /> New banner</Button>}
        </CardHeader>
        <CardContent className="space-y-4">
          {draft && <Editor draft={draft} setDraft={setDraft} onSave={save} onCancel={() => setDraft(null)} busy={busy} />}

          <label className="flex items-center justify-between gap-3 rounded-xl border border-border bg-secondary/30 px-4 py-3">
            <span className="text-sm">
              <span className="font-medium">Also show the built-in slides</span>
              <span className="block text-xs text-muted-foreground">Dr. Azka Consult, Mock series, NEETLab, Contests, Weekly leaderboard</span>
            </span>
            <Switch checked={showBuiltIn} onCheckedChange={async (v) => {
              setShowBuiltIn(v);
              try { await builtInFn({ data: { show: v } }); toast.success(v ? "Built-in slides on" : "Only your banners will show"); }
              catch (e: any) { setShowBuiltIn(!v); toast.error(e?.message ?? "Could not change"); }
            }} />
          </label>

          {rows === null ? <div className="flex justify-center p-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
            : slides.length === 0 ? <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">No custom banners yet. Students see the built-in slides.</p>
            : (
              <ul className="space-y-3">
                {slides.map((b, i) => {
                  const st = status(b);
                  return (
                    <li key={b.id} className="overflow-hidden rounded-xl border border-border">
                      <MiniSlide b={{ tag: b.tag ?? "", title: b.title, subtitle: b.subtitle ?? "", cta_label: b.cta_label ?? "Open", image_url: b.image_url, theme: (b.theme ?? "blue") as Theme }} dim={!b.active} />
                      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                        <div className="min-w-0 text-xs">
                          <span className={cn("font-semibold", st.cls)}>{st.label}</span>
                          <span className="ml-2 text-muted-foreground">→ {b.link_url}</span>
                        </div>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" className="h-8 w-8" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up"><ArrowUp className="h-4 w-4" /></Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8" disabled={i === slides.length - 1} onClick={() => move(i, 1)} aria-label="Move down"><ArrowDown className="h-4 w-4" /></Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => quick(b, { active: !b.active })} aria-label={b.active ? "Turn off" : "Turn on"}>
                            {b.active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Edit" onClick={() => {
                            setDraft({ id: b.id, tag: b.tag ?? "", title: b.title, subtitle: b.subtitle ?? "", cta_label: b.cta_label ?? "Open", link_url: b.link_url ?? "/dashboard",
                              image_url: b.image_url, theme: (b.theme ?? "blue") as Theme, active: b.active, starts_at: toLocal(b.starts_at), ends_at: toLocal(b.ends_at) });
                            window.scrollTo({ top: 0, behavior: "smooth" });
                          }}><Pencil className="h-4 w-4" /></Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => remove(b)} aria-label="Delete"><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

          {legacy.length > 0 && (
            <details className="rounded-xl border border-border p-3 text-sm">
              <summary className="cursor-pointer font-medium">Old image-only banners ({legacy.length}) <span className="font-normal text-muted-foreground">· not shown on the new home page</span></summary>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {legacy.map((b) => (
                  <li key={b.id} className="flex items-center gap-2 rounded-lg border border-border p-2">
                    {b.image_url && <img src={b.image_url} alt="" className="h-12 w-20 rounded object-cover" />}
                    <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{b.link_url}</span>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => remove(b)} aria-label="Delete"><Trash2 className="h-4 w-4" /></Button>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Editor({ draft, setDraft, onSave, onCancel, busy }: { draft: Draft; setDraft: (d: Draft) => void; onSave: () => void; onCancel: () => void; busy: boolean }) {
  const uploadFn = useServerFn(adminBannerUploadUrl);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const set = (p: Partial<Draft>) => setDraft({ ...draft, ...p });

  async function upload(f: File) {
    if (f.size > 3 * 1024 * 1024) return toast.error("Image must be under 3 MB");
    setUploading(true);
    try {
      const r = await uploadFn({ data: { filename: f.name } });
      const { error } = await supabase.storage.from("banner-images").uploadToSignedUrl(r.path, r.token, f, { contentType: f.type });
      if (error) throw error;
      set({ image_url: r.public_url });
    } catch (e: any) { toast.error(e?.message ?? "Upload failed"); }
    finally { setUploading(false); }
  }

  return (
    <div className="space-y-4 rounded-xl border border-primary/30 bg-primary/5 p-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">{draft.id ? "Edit banner" : "New banner"}</div>
        <button type="button" onClick={onCancel} className="p-1 text-muted-foreground" aria-label="Close"><X className="h-4 w-4" /></button>
      </div>

      <div>
        <div className="mb-1.5 text-xs font-medium text-muted-foreground">Preview</div>
        <MiniSlide b={draft} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div><Label>Small label</Label><Input value={draft.tag} maxLength={40} onChange={(e) => set({ tag: e.target.value })} placeholder="NEW · TONIGHT 8:30 PM" /></div>
        <div><Label>Title</Label><Input value={draft.title} maxLength={80} onChange={(e) => set({ title: e.target.value })} placeholder="Daily Mega Quiz: win ₹21" /></div>
        <div className="sm:col-span-2"><Label>Description</Label><Input value={draft.subtitle} maxLength={160} onChange={(e) => set({ subtitle: e.target.value })} placeholder="80 questions, live every evening. Top scorer wins." /></div>
        <div><Label>Button text</Label><Input value={draft.cta_label} maxLength={30} onChange={(e) => set({ cta_label: e.target.value })} placeholder="Join now" /></div>
        <div>
          <Label>Button opens</Label>
          <div className="flex gap-2">
            <select value={PAGES.some(([p]) => p === draft.link_url) ? draft.link_url : "custom"} onChange={(e) => e.target.value !== "custom" && set({ link_url: e.target.value })}
              className="h-10 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-sm">
              {PAGES.map(([p, l]) => <option key={p} value={p}>{l}</option>)}
              <option value="custom">Other link…</option>
            </select>
          </div>
          <Input className="mt-2" value={draft.link_url} onChange={(e) => set({ link_url: e.target.value })} placeholder="/page or https://…" />
        </div>
      </div>

      <div>
        <Label>Colour</Label>
        <div className="mt-1.5 flex gap-2">
          {(Object.keys(THEMES) as Theme[]).map((t) => (
            <button key={t} type="button" onClick={() => set({ theme: t })} aria-label={t}
              className={cn("h-9 w-9 rounded-full ring-offset-2 ring-offset-background", draft.theme === t && "ring-2 ring-primary")}
              style={{ background: THEMES[t] }} />
          ))}
        </div>
      </div>

      <div>
        <Label>Picture (optional)</Label>
        <div className="mt-1.5 flex items-center gap-3">
          {draft.image_url ? <img src={draft.image_url} alt="" className="h-14 w-14 rounded-lg object-cover" /> : <div className="flex h-14 w-14 items-center justify-center rounded-lg border border-dashed border-border text-muted-foreground"><ImagePlus className="h-5 w-5" /></div>}
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />
          <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <ImagePlus className="mr-1 h-4 w-4" />} {draft.image_url ? "Change" : "Upload"}
          </Button>
          {draft.image_url && <Button type="button" variant="ghost" size="sm" onClick={() => set({ image_url: null })}>Remove</Button>}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">Square PNG with a transparent background looks best. Under 3 MB.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div><Label>Show from (optional)</Label><Input type="datetime-local" value={draft.starts_at} onChange={(e) => set({ starts_at: e.target.value })} /></div>
        <div><Label>Hide after (optional)</Label><Input type="datetime-local" value={draft.ends_at} onChange={(e) => set({ ends_at: e.target.value })} /></div>
      </div>

      <label className="flex items-center gap-2 text-sm"><Switch checked={draft.active} onCheckedChange={(v) => set({ active: v })} /> Show on the home page</label>

      <div className="flex gap-2">
        <Button onClick={onSave} disabled={busy} className="gap-1.5">{busy && <Loader2 className="h-4 w-4 animate-spin" />}{draft.id ? "Save changes" : "Publish banner"}</Button>
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}

function MiniSlide({ b, dim }: { b: { tag: string; title: string; subtitle: string; cta_label: string; image_url: string | null; theme: Theme }; dim?: boolean }) {
  return (
    <div className={cn("relative flex min-h-[132px] items-center gap-3 overflow-hidden rounded-xl p-4 text-white", dim && "opacity-50 grayscale")}
      style={{ background: THEMES[b.theme] ?? THEMES.blue }}>
      <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_0%_0%,rgba(255,255,255,.18),transparent_60%)]" />
      <div className="relative min-w-0 flex-1">
        {b.tag && <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"><i className="h-1.5 w-1.5 rounded-full bg-white" />{b.tag}</span>}
        <div className="mt-1.5 text-lg font-extrabold leading-tight">{b.title || "Your title"}</div>
        {b.subtitle && <div className="mt-0.5 text-[13px] leading-snug text-white/85">{b.subtitle}</div>}
        <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-900">{b.cta_label || "Open"} →</span>
      </div>
      {b.image_url && <img src={b.image_url} alt="" className="relative h-24 w-24 shrink-0 rounded-xl object-contain" />}
    </div>
  );
}
