import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageShell } from "@/components/page-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, Loader2, ShieldAlert, Sparkles, IndianRupee, Trophy, Check, X, MessageCircle, Infinity as InfinityIcon, ArrowRight, Bot, Search, User as UserIcon, Wallet as WalletIcon } from "lucide-react";
import { adminListTopWallets } from "@/lib/admin-top-wallets.functions";
import { getUserReport } from "@/lib/admin-user-report.functions";
import { adminSuspendUser, adminAdjustBalance } from "@/lib/admin-user-actions.functions";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { generateAiDailyQuizzes } from "@/lib/ai-quiz.functions";
import { bulkDeleteByChapter, bulkDeleteBySubject, scanDuplicateQuestions, dedupeQuestions } from "@/lib/admin-bulk.functions";
import { importPyqQuestions } from "@/lib/pyq-import.functions";
import { getAdminOverview } from "@/lib/admin-stats.functions";
import { createAdminTest, importChapterQuizzes, importChapters } from "@/lib/admin-import.functions";
import { adminListAiKeys, adminAddAiKey, adminToggleAiKey, adminDeleteAiKey } from "@/lib/ai-keys.functions";
import { adminListPendingWithdrawals, adminApproveWithdrawal, adminRejectWithdrawal } from "@/lib/wallet.functions";
import { adminCreateContest } from "@/lib/contests.functions";
import { parseLenientJson } from "@/lib/json-utils";
import { adminGenerateFlashcards, adminListChaptersForFlashcards, adminDeleteFlashcardsByChapter, adminGenerateFlashcardsBulk } from "@/lib/flashcards.functions";
import { adminGenerateHighlights, adminAddHighlight, adminDeleteHighlightsByChapter, adminGenerateHighlightsBulk } from "@/lib/ncert-highlights.functions";
import { getAppSettings, adminUpdateSetting } from "@/lib/app-settings.functions";
import { adminListBattleBots, adminAddBattleBot, adminToggleBattleBot, adminDeleteBattleBot } from "@/lib/battleground-bots.functions";

import { MockTestWizard } from "@/components/mock-test-wizard";
import { AiMockBatch } from "@/components/ai-mock-batch";
import { AdminBatchesTab } from "@/components/admin-batches";
import { AdminCouponsTab } from "@/components/admin-coupons";
import { PremiumMembers } from "@/components/admin/premium-members";
import { BannerManager } from "@/components/admin/banner-manager";
import { Announcements } from "@/components/admin/announcements";
import { StudentJourney } from "@/components/admin/student-journey";
import { ALL_TOOLS, AdminMobilePicker, AdminSidebar, AdminQuickStats } from "@/components/admin/admin-nav";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin — NEET Track" }] }),
  component: AdminPanel,
});

type QDraft = {
  text: string; options: string[]; correct_index: number;
  difficulty: string; source: string; marks_correct: number; marks_wrong: number; explanation: string;
  subject?: string; chapter?: string; topic?: string; type?: string;
  is_pyq?: boolean; pyq_year?: number | null;
};

const newQ = (): QDraft => ({ text: "", options: ["", "", "", ""], correct_index: 0, difficulty: "medium", source: "NCERT", marks_correct: 4, marks_wrong: -1, explanation: "" });

function AdminPanel() {
  const { user, isAdmin, loading } = useAuth();
  const nav = useNavigate();
  useEffect(() => { if (!loading && !user) nav({ to: "/login" }); }, [user, loading, nav]);

  if (loading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!user) return null;
  if (!isAdmin) {
    return (
      <PageShell eyebrow="Admin" title="Restricted area" description="You do not have admin access.">
        <Card className="border-destructive/30">
          <CardContent className="flex items-start gap-3 p-5">
            <ShieldAlert className="mt-0.5 h-5 w-5 text-destructive" />
            <div className="text-sm">
              <p className="font-semibold">Admin access required</p>
              <p className="mt-1 text-muted-foreground">Ask an existing admin to grant you the <code className="rounded bg-secondary px-1">admin</code> role, then refresh.</p>
              <Button asChild variant="link" className="px-0"><Link to="/dashboard">Back to dashboard</Link></Button>
            </div>
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  return <AdminWorkspace />;
}

const TOOL_KEY = "nt-admin-tool";

function AdminWorkspace() {
  // Remember the open tool in the address (?tool=…) so refresh and back keep your place.
  const [tool, setTool] = useState<string>(() => {
    if (typeof window === "undefined") return "overview";
    const fromUrl = new URLSearchParams(window.location.search).get("tool");
    const saved = fromUrl ?? (() => { try { return sessionStorage.getItem(TOOL_KEY); } catch { return null; } })();
    const v = saved === "grantPremium" ? "premium" : saved;
    return v && ALL_TOOLS.some((t) => t.value === v) ? v : "overview";
  });
  const pick = (v: string) => {
    setTool(v);
    try { sessionStorage.setItem(TOOL_KEY, v); } catch { /* ignore */ }
    const url = new URL(window.location.href);
    if (v === "overview") url.searchParams.delete("tool"); else url.searchParams.set("tool", v);
    window.history.replaceState(window.history.state, "", url.toString());
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const current = ALL_TOOLS.find((t) => t.value === tool) ?? ALL_TOOLS[0];

  const panel = (() => {
    switch (tool) {
      case "overview": return <><AdminQuickStats onPick={pick} /><div className="mt-6"><Overview /></div></>;
      case "premium": return <PremiumMembers />;
      case "banners": return <BannerManager />;
      case "announce": return <Announcements />;
      case "journey": return <StudentJourney />;
      case "userReport": return <UserReportPanel />;
      case "payments": return <WithdrawalsPanel />;
      case "batches": return <AdminBatchesTab />;
      case "coupons": return <AdminCouponsTab />;
      case "topWallets": return <TopWalletsPanel />;
      case "battleBots": return <BattleBotsManager />;
      case "contestAi": return <AiContestWizard />;
      case "create": return <CreateTest />;
      case "mock": return <><AiMockBatch /><MockTestWizard /></>;
      case "ai": return <AiQuizGenerator />;
      case "bulkDelete": return <BulkDelete />;
      case "pyq": return <PyqImport />;
      case "bulk": return <ChapterQuizBulkImport />;
      case "bulkChapters": return <BulkChaptersImport />;
      case "list": return <AllTests />;
      case "chapters": return <ChaptersManager />;
      case "questions": return <QuestionsManager />;
      case "duplicates": return <DuplicateManager />;
      case "flashcards": return <FlashcardsManager />;
      case "highlights": return <HighlightsManager />;
      case "infiniteRun": return <InfiniteRunPanel />;
      case "aiSettings": return <AiSettingsManager />;
      case "aiKeys": return <AiKeysManager />;
      default: return <Overview />;
    }
  })();

  return (
    <PageShell eyebrow="Admin" title="Admin panel" description="Members, money, website content and the question bank in one place.">
      <div className="grid gap-6 lg:grid-cols-[230px_minmax(0,1fr)]">
        <AdminSidebar current={tool} onPick={pick} />
        <div className="min-w-0 space-y-4">
          <AdminMobilePicker current={tool} onPick={pick} />
          <h2 className="hidden items-center gap-2 text-xl font-bold lg:flex"><current.icon className="h-5 w-5 text-primary" />{current.label}</h2>
          <div key={tool}>{panel}</div>
        </div>
      </div>
    </PageShell>
  );
}

function AiKeysManager() {
  const list = useServerFn(adminListAiKeys);
  const add = useServerFn(adminAddAiKey);
  const toggle = useServerFn(adminToggleAiKey);
  const del = useServerFn(adminDeleteAiKey);
  const [rows, setRows] = useState<Awaited<ReturnType<typeof adminListAiKeys>> | null>(null);
  const [label, setLabel] = useState("");
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const load = () => list().then(setRows).catch((e) => toast.error(e?.message ?? "Failed to load"));
  useEffect(() => { load(); }, []);
  const onAdd = async () => {
    if (!label.trim() || key.trim().length < 8) return toast.error("Label and API key required (min 8 chars)");
    setBusy(true);
    try { await add({ data: { label: label.trim(), key: key.trim() } }); toast.success("AI key added"); setLabel(""); setKey(""); load(); }
    catch (e: any) { toast.error(e?.message ?? "Failed"); }
    finally { setBusy(false); }
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle>Lovable AI API Keys</CardTitle>
        <CardDescription>Add multiple keys — they round-robin automatically when generating quizzes & contests. Falls back to the environment key if all are disabled.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
          <Input placeholder="Label (e.g. Key #1)" value={label} onChange={(e) => setLabel(e.target.value)} />
          <Input type="password" placeholder="sk-..." value={key} onChange={(e) => setKey(e.target.value)} className="font-mono text-xs" />
          <Button onClick={onAdd} disabled={busy} className="bg-gradient-primary">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="mr-1 h-4 w-4" />} Add
          </Button>
        </div>
        <div className="rounded-lg border border-border">
          {rows === null ? <div className="p-6 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-primary" /></div>
            : rows.length === 0 ? <p className="p-4 text-sm text-muted-foreground">No keys yet. The environment key is used by default.</p>
            : <ul className="divide-y divide-border">
                {rows.map((k: any) => (
                  <li key={k.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold truncate">{k.label}</span>
                        <Badge variant={k.is_active ? "default" : "outline"} className="text-[10px]">{k.is_active ? "active" : "off"}</Badge>
                      </div>
                      <div className="text-[11px] text-muted-foreground">…{k.last_four} · last used {k.last_used_at ? new Date(k.last_used_at).toLocaleString() : "never"}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch checked={k.is_active} onCheckedChange={async (v) => { await toggle({ data: { id: k.id, is_active: v } }); load(); }} />
                      <Button variant="ghost" size="icon" onClick={async () => { if (!confirm("Delete this key?")) return; await del({ data: { id: k.id } }); load(); }}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>}
        </div>
      </CardContent>
    </Card>
  );
}

function battleBotIconUrl(iconKey: number): string {
  const size = [26, 28, 24, 30, 25][(iconKey - 1) % 5];
  const hair = [
    "M25 31c8-15 38-15 46 0",
    "M24 28c10 7 38 7 48 0",
    "M30 24h36",
    "M26 34c10-9 34-13 44-1",
  ][(iconKey - 1) % 4];
  const mouth = ["M40 51c4 4 12 4 16 0", "M39 52h18", "M40 52c5-3 11-3 16 0"][(iconKey - 1) % 3];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><rect width="96" height="96" rx="18" fill="white"/><circle cx="48" cy="42" r="${size}" fill="white" stroke="black" stroke-width="4"/><path d="${hair}" fill="none" stroke="black" stroke-width="4" stroke-linecap="round"/><circle cx="38" cy="39" r="3" fill="black"/><circle cx="58" cy="39" r="3" fill="black"/><path d="${mouth}" fill="none" stroke="black" stroke-width="3" stroke-linecap="round"/><path d="M28 78c4-12 14-18 20-18s16 6 20 18" fill="none" stroke="black" stroke-width="4" stroke-linecap="round"/></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function BattleBotsManager() {
  const listBots = useServerFn(adminListBattleBots);
  const addBot = useServerFn(adminAddBattleBot);
  const toggleBot = useServerFn(adminToggleBattleBot);
  const deleteBot = useServerFn(adminDeleteBattleBot);
  const [bots, setBots] = useState<any[] | null>(null);
  const [name, setName] = useState("");
  const [iconKey, setIconKey] = useState(1);
  const [busy, setBusy] = useState(false);

  const load = () => listBots().then((rows) => setBots(rows as any[])).catch((e) => toast.error(e?.message ?? "Failed to load bots"));
  useEffect(() => { load(); }, []);

  const onAdd = async () => {
    if (!name.trim()) return toast.error("Enter a bot name");
    setBusy(true);
    try {
      await addBot({ data: { name: name.trim(), iconKey } });
      toast.success("Bot saved");
      setName("");
      load();
    } catch (e: any) {
      toast.error(e?.message ?? "Could not save bot");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Bot className="h-5 w-5 text-primary" /> Battleground bot names</CardTitle>
        <CardDescription>Manage the opponent names and black-and-white icons used in bot-first battlegrounds.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
          <div className="space-y-3">
            <div>
              <Label>Bot name</Label>
              <Input placeholder="Example: Aarav Sharma" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label>Black & white icon</Label>
              <div className="mt-2 grid grid-cols-5 gap-2 sm:grid-cols-10">
                {Array.from({ length: 20 }).map((_, i) => {
                  const key = i + 1;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setIconKey(key)}
                      className={`rounded-xl border p-1.5 transition ${iconKey === key ? "border-primary bg-primary/10" : "border-border bg-card hover:border-primary/50"}`}
                    >
                      <img src={battleBotIconUrl(key)} alt={`Bot icon ${key}`} className="h-11 w-11 rounded-lg object-cover" />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <Button onClick={onAdd} disabled={busy} className="self-end bg-gradient-primary">
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />} Save bot
          </Button>
        </div>

        <div className="rounded-xl border border-border">
          {bots === null ? (
            <div className="p-6 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-primary" /></div>
          ) : bots.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No bot names yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {bots.map((bot) => (
                <li key={bot.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                  <div className="flex min-w-0 items-center gap-3">
                    <img src={bot.avatar_url} alt={bot.name} className="h-11 w-11 rounded-xl border border-border object-cover" />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{bot.name}</div>
                      <div className="text-[11px] text-muted-foreground">{bot.is_active ? "Active" : "Hidden"}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={!!bot.is_active} onCheckedChange={async (v) => { await toggleBot({ data: { id: bot.id, isActive: v } }); load(); }} />
                    <Button variant="ghost" size="icon" onClick={async () => { if (!confirm("Delete this bot name?")) return; await deleteBot({ data: { id: bot.id } }); load(); }}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function Overview() {
  const fn = useServerFn(getAdminOverview);
  const [data, setData] = useState<Awaited<ReturnType<typeof getAdminOverview>> | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { fn().then(setData).catch((e) => setErr(e instanceof Error ? e.message : String(e))); }, [fn]);
  if (err) return <p className="text-sm text-destructive">{err}</p>;
  if (!data) return <Loader2 className="h-5 w-5 animate-spin text-primary" />;
  const t = data.totals;
  const cards = [
    { label: "Total users", value: t.users },
    { label: "Total questions", value: t.questions },
    { label: "Total subjects", value: t.subjects },
    { label: "Paid tests", value: t.paidTests },
    { label: "Total revenue", value: `₹${t.revenue.toLocaleString("en-IN")}` },
  ];
  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map((c) => (
          <Card key={c.label}><CardContent className="p-4">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">{c.label}</div>
            <div className="mt-1 text-2xl font-bold">{c.value}</div>
          </CardContent></Card>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card><CardHeader><CardTitle>Questions by subject</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {data.bySubject.map((s) => (
              <div key={s.name} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color ?? "#888" }} />{s.name}</span>
                <span className="font-semibold">{s.count}</span>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card><CardHeader><CardTitle>Recent admin actions</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {data.recentActions.length === 0 ? <p className="text-muted-foreground">No actions yet.</p> :
              data.recentActions.map((a) => (
                <div key={a.id} className="flex items-center justify-between">
                  <span className="capitalize">{a.action.replace(/_/g, " ")}</span>
                  <span className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString()}</span>
                </div>
              ))}
          </CardContent>
        </Card>
        <Card><CardHeader><CardTitle>Recent bug reports</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {data.recentBugs.length === 0 ? <p className="text-muted-foreground">No bugs reported.</p> :
              data.recentBugs.map((b) => (
                <div key={b.id} className="flex items-center justify-between gap-2">
                  <span className="truncate">{b.title}</span>
                  <Badge variant="outline" className="capitalize">{b.severity}</Badge>
                </div>
              ))}
          </CardContent>
        </Card>
        <Card><CardHeader><CardTitle>Daily AI quiz cron history</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {data.cronRuns.length === 0 ? <p className="text-muted-foreground">No runs yet. Will fire at 10:00 AM IST.</p> :
              data.cronRuns.map((r) => (
                <div key={r.id} className="flex items-center justify-between">
                  <span><Badge variant={r.status === "ok" ? "default" : "destructive"}>{r.status}</Badge></span>
                  <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</span>
                </div>
              ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function BulkDelete() {
  const [subjects, setSubjects] = useState<{ id: string; name: string }[]>([]);
  const [chapters, setChapters] = useState<{ id: string; name: string }[]>([]);
  const [subjectId, setSubjectId] = useState("");
  const [chapterId, setChapterId] = useState("");
  const [busy, setBusy] = useState(false);
  const delByChap = useServerFn(bulkDeleteByChapter);
  const delBySubj = useServerFn(bulkDeleteBySubject);
  useEffect(() => { supabase.from("subjects").select("id,name").order("name").then(({ data }) => setSubjects(data ?? [])); }, []);
  useEffect(() => {
    if (!subjectId) return setChapters([]);
    supabase.from("chapters").select("id,name").eq("subject_id", subjectId).order("name").then(({ data }) => setChapters(data ?? []));
  }, [subjectId]);
  const runChap = async () => {
    if (!chapterId) return toast.error("Pick a chapter");
    if (!confirm("Delete ALL questions in this chapter?")) return;
    setBusy(true);
    try { const r = await delByChap({ data: { chapterId } }); toast.success(`Deleted ${r.deleted} questions`); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  };
  const runSubj = async () => {
    if (!subjectId) return toast.error("Pick a subject");
    if (!confirm("Delete ALL questions in this subject?")) return;
    setBusy(true);
    try { const r = await delBySubj({ data: { subjectId, alsoDeleteTests: true } }); toast.success(`Deleted ${r.deleted} questions, ${r.testsDeleted} tests`); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  };
  return (
    <Card><CardHeader><CardTitle>Bulk delete</CardTitle><CardDescription>Delete all questions in a chapter or across an entire subject.</CardDescription></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div><Label>Subject</Label>
            <Select value={subjectId} onValueChange={(v) => { setSubjectId(v); setChapterId(""); }}>
              <SelectTrigger><SelectValue placeholder="Pick a subject" /></SelectTrigger>
              <SelectContent>{subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Chapter (optional for chapter-only delete)</Label>
            <Select value={chapterId} onValueChange={setChapterId} disabled={!subjectId}>
              <SelectTrigger><SelectValue placeholder="Pick a chapter" /></SelectTrigger>
              <SelectContent>{chapters.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="destructive" onClick={runChap} disabled={busy || !chapterId}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}Delete chapter questions</Button>
          <Button variant="destructive" onClick={runSubj} disabled={busy || !subjectId}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}Delete entire subject</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function PyqImport() {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const importFn = useServerFn(importPyqQuestions);
  const sample = `[
  {"text":"...?","options":["A","B","C","D"],"correct_index":2,"subject":"Physics","chapter":"Kinematics","year":2024,"explanation":"..."}
]`;
  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    setText(await f.text());
  };
  const run = async () => {
    let parsed: unknown;
    try { parsed = parseLenientJson(text); } catch (e) { return toast.error("Invalid JSON: " + (e instanceof Error ? e.message : "parse failed")); }
    const arr = Array.isArray(parsed) ? parsed : (parsed as { questions?: unknown[] }).questions;
    if (!Array.isArray(arr)) return toast.error("Expected an array (or { questions: [...] })");
    setBusy(true);
    try {
      const r = await importFn({ data: { questions: arr as never } });
      toast.success(`Imported ${r.inserted} · skipped ${r.skipped} duplicates${r.errors.length ? ` · ${r.errors.length} errors` : ""}`);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  };
  return (
    <Card><CardHeader><CardTitle>NEET PYQ import</CardTitle><CardDescription>Upload a .json file or paste an array. Duplicates are auto-skipped by the database.</CardDescription></CardHeader>
      <CardContent className="space-y-3">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-input bg-card px-3 py-2 text-sm font-medium hover:bg-accent">
          <Plus className="h-4 w-4" /> Choose JSON file
          <input type="file" accept="application/json,.json" className="hidden" onChange={onFile} />
        </label>
        <Textarea rows={10} value={text} onChange={(e) => setText(e.target.value)} placeholder={sample} className="font-mono text-xs" />
        <Button onClick={run} disabled={busy} className="bg-gradient-primary">{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}Import PYQs</Button>
      </CardContent>
    </Card>
  );
}

function AiQuizGenerator() {
  const [busy, setBusy] = useState(false);
  const [count, setCount] = useState(20);
  const generate = useServerFn(generateAiDailyQuizzes);
  const run = async () => {
    setBusy(true);
    try {
      const res = await generate({ data: { count } });
      toast.success(`Created ${res.created} AI quizzes${res.errors.length ? ` (${res.errors.length} failed)` : ""}`);
      if (res.errors.length) console.error("AI quiz errors:", res.errors);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" /> AI daily quiz generator</CardTitle>
        <CardDescription>
          Generate AI-written NEET quizzes. Each quiz has 10 questions and goes live 10 AM – 10 PM IST today. The scheduler runs automatically at 10 AM IST daily; use this button to top up.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label>Number of quizzes</Label>
          <Input type="number" min={1} max={20} value={count} onChange={(e) => setCount(Math.min(20, Math.max(1, Number(e.target.value) || 1)))} className="w-32" />
        </div>
        <Button onClick={run} disabled={busy}>
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
          Generate {count} quizzes
        </Button>
      </CardContent>
    </Card>
  );
}

function CreateTest() {
  const createTest = useServerFn(createAdminTest);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("quiz");
  const [difficulty, setDifficulty] = useState("medium");
  const [duration, setDuration] = useState(30);
  const [source, setSource] = useState("NCERT");
  const [isPaid, setIsPaid] = useState(false);
  const [entryFee, setEntryFee] = useState(0);
  const [prizePool, setPrizePool] = useState(0);
  const [marksCorrect, setMarksCorrect] = useState(4);
  const [marksWrong, setMarksWrong] = useState(-1);
  const [questions, setQuestions] = useState<QDraft[]>([newQ()]);
  const [busy, setBusy] = useState(false);

  const update = (i: number, p: Partial<QDraft>) => setQuestions((qs) => qs.map((q, idx) => idx === i ? { ...q, ...p } : q));
  const setOpt = (i: number, j: number, v: string) => setQuestions((qs) => qs.map((q, idx) => idx === i ? { ...q, options: q.options.map((o, k) => k === j ? v : o) } : q));

  const save = async () => {
    if (!title.trim()) return toast.error("Title required");
    if (questions.some((q) => !q.text.trim() || q.options.some((o) => !o.trim()))) return toast.error("Fill all question fields");
    setBusy(true);

    try {
      const res = await createTest({ data: {
        title, description, type, difficulty, duration_min: duration, source,
        is_paid: isPaid, entry_fee: entryFee, prize_pool: prizePool,
        marks_correct: marksCorrect, marks_wrong: marksWrong,
        questions,
      } });
      toast.success(`Test published 🎉 · ${res.inserted} questions${res.errors.length ? ` · ${res.errors.length} warnings` : ""}`);
      setTitle(""); setDescription(""); setQuestions([newQ()]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not publish test");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader><CardTitle>Test details</CardTitle><CardDescription>Set type, timer, marking and pricing.</CardDescription></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Title"><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="NEET Physics — Kinematics" /></Field>
          <Field label="Type">
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily Free Quiz</SelectItem>
                <SelectItem value="quiz">Quiz</SelectItem>
                <SelectItem value="mock">Mock Test</SelectItem>
                <SelectItem value="contest">Contest</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Description" className="sm:col-span-2"><Textarea value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
          <Field label="Overall difficulty">
            <Select value={difficulty} onValueChange={setDifficulty}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="easy">Easy</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="hard">Hard</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Source / tag">
            <Select value={source} onValueChange={setSource}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="NCERT">NCERT</SelectItem>
                <SelectItem value="PYQ">PYQ</SelectItem>
                <SelectItem value="Mixed">Mixed</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Duration (minutes)"><Input type="number" min={1} value={duration} onChange={(e) => setDuration(+e.target.value)} /></Field>
          <Field label="Marking — correct / wrong">
            <div className="flex gap-2"><Input type="number" value={marksCorrect} onChange={(e) => setMarksCorrect(+e.target.value)} /><Input type="number" value={marksWrong} onChange={(e) => setMarksWrong(+e.target.value)} /></div>
          </Field>
          <Field label="Paid test">
            <div className="flex h-10 items-center gap-3"><Switch checked={isPaid} onCheckedChange={setIsPaid} /><span className="text-sm text-muted-foreground">{isPaid ? "Paid" : "Free"}</span></div>
          </Field>
          {isPaid && <>
            <Field label="Entry fee (₹)"><Input type="number" min={0} value={entryFee} onChange={(e) => setEntryFee(+e.target.value)} /></Field>
            <Field label="Prize pool (₹)"><Input type="number" min={0} value={prizePool} onChange={(e) => setPrizePool(+e.target.value)} /></Field>
          </>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <div><CardTitle>Questions ({questions.length})</CardTitle><CardDescription>Add one-by-one or paste a JSON array for bulk import.</CardDescription></div>
          <div className="flex gap-2">
            <BulkImport onImport={(qs) => setQuestions((cur) => [...cur.filter((c) => c.text.trim() || c.options.some((o) => o.trim())), ...qs])} />
            <Button size="sm" onClick={() => setQuestions((qs) => [...qs, newQ()])} className="gap-1"><Plus className="h-4 w-4" /> Add</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {questions.map((q, i) => (
            <div key={i} className="rounded-2xl border p-4">
              <div className="mb-3 flex items-center justify-between">
                <Badge variant="secondary">Q {i + 1}</Badge>
                {questions.length > 1 && (
                  <Button size="icon" variant="ghost" onClick={() => setQuestions((qs) => qs.filter((_, x) => x !== i))}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                )}
              </div>
              <Field label="Question"><Textarea value={q.text} onChange={(e) => update(i, { text: e.target.value })} /></Field>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {q.options.map((o, j) => (
                  <div key={j} className="flex items-center gap-2">
                    <button onClick={() => update(i, { correct_index: j })} className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${q.correct_index === j ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>{String.fromCharCode(65 + j)}</button>
                    <Input value={o} onChange={(e) => setOpt(i, j, e.target.value)} placeholder={`Option ${String.fromCharCode(65 + j)}`} />
                  </div>
                ))}
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-4">
                <Field label="Difficulty">
                  <Select value={q.difficulty} onValueChange={(v) => update(i, { difficulty: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="easy">Easy</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="hard">Hard</SelectItem></SelectContent>
                  </Select>
                </Field>
                <Field label="Source">
                  <Select value={q.source} onValueChange={(v) => update(i, { source: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="NCERT">NCERT</SelectItem><SelectItem value="PYQ">PYQ</SelectItem></SelectContent>
                  </Select>
                </Field>
                <Field label="+ Marks"><Input type="number" value={q.marks_correct} onChange={(e) => update(i, { marks_correct: +e.target.value })} /></Field>
                <Field label="− Marks"><Input type="number" value={q.marks_wrong} onChange={(e) => update(i, { marks_wrong: +e.target.value })} /></Field>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <Field label="Subject"><Input value={q.subject ?? ""} onChange={(e) => update(i, { subject: e.target.value })} placeholder="Physics" /></Field>
                <Field label="Chapter"><Input value={q.chapter ?? ""} onChange={(e) => update(i, { chapter: e.target.value })} placeholder="Laws of Motion" /></Field>
                <Field label="PYQ year (optional)"><Input type="number" value={q.pyq_year ?? ""} onChange={(e) => update(i, { pyq_year: e.target.value ? +e.target.value : null })} placeholder="2024" /></Field>
              </div>
              <Field label="Explanation (optional). Supports \n, **bold**, and LaTeX $...$" className="mt-3"><Textarea value={q.explanation} onChange={(e) => update(i, { explanation: e.target.value })} /></Field>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} disabled={busy} className="gap-1.5 bg-gradient-primary shadow-elegant">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Publish test
        </Button>
      </div>
    </div>
  );
}

function AllTests() {
  const [tests, setTests] = useState<{ id: string; title: string; type: string; difficulty: string; total_questions: number; source: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const reload = async () => {
    setLoading(true);
    const { data } = await supabase.from("tests").select("id,title,type,difficulty,total_questions,source").order("created_at", { ascending: false });
    setTests(data ?? []); setLoading(false);
  };
  useEffect(() => { reload(); }, []);
  const remove = async (id: string) => {
    if (!confirm("Delete this test?")) return;
    const { error } = await supabase.from("tests").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted"); reload();
  };
  if (loading) return <Loader2 className="h-5 w-5 animate-spin text-primary" />;
  if (tests.length === 0) return <p className="text-sm text-muted-foreground">No tests yet.</p>;
  return (
    <div className="grid gap-3">
      {tests.map((t) => (
        <Card key={t.id}>
          <CardContent className="flex items-center justify-between gap-2 p-4">
            <div>
              <div className="font-semibold">{t.title}</div>
              <div className="mt-0.5 flex flex-wrap gap-1.5 text-xs">
                <Badge variant="secondary" className="capitalize">{t.type}</Badge>
                <Badge variant="outline" className="capitalize">{t.difficulty}</Badge>
                <Badge>{t.source}</Badge>
                <span className="text-muted-foreground">· {t.total_questions} Qs</span>
              </div>
            </div>
            <div className="flex gap-1">
              <Button asChild variant="outline" size="sm"><Link to="/quiz/$testId" params={{ testId: t.id }}>Preview</Link></Button>
              <Button size="icon" variant="ghost" onClick={() => remove(t.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function BulkImport({ onImport }: { onImport: (qs: QDraft[]) => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const sample = `[
  {
    "type": "mcq",
    "text": "If $f(x)=x^2$, find $f'(2)$.\\n\\nUse **first principles**.",
    "options": ["2", "4", "8", "16"],
    "correct_index": 1,
    "difficulty": "medium",
    "subject": "Physics",
    "chapter": "Motion in a Straight Line",
    "topic": "Differentiation",
    "source": "NCERT",
    "marks_correct": 4,
    "marks_wrong": -1,
    "explanation": "$f'(x)=2x$, so $f'(2)=4$."
  }
]`;
  const parseArray = (raw: string): QDraft[] => {
    const parsed = parseLenientJson(raw);
    const arr = Array.isArray(parsed) ? parsed : Array.isArray((parsed as { questions?: unknown }).questions) ? (parsed as { questions: unknown[] }).questions : null;
    if (!arr) throw new Error("JSON must be an array (or { questions: [...] })");
    return arr.map((p: Record<string, unknown>) => {
      const opts = Array.isArray(p.options) ? (p.options as unknown[]).map((o) => String(o)) : ["", "", "", ""];
      while (opts.length < 4) opts.push("");
      const src = String(p.source ?? "NCERT");
      const isPyq = String(p.type ?? "").toLowerCase().includes("pyq") || src.toUpperCase().includes("PYQ") || p.is_pyq === true || p.pyq_year !== undefined;
      return {
        text: String(p.text ?? ""),
        options: opts.slice(0, 4),
        correct_index: Number(p.correct_index ?? 0),
        difficulty: String(p.difficulty ?? "medium").toLowerCase(),
        source: src,
        marks_correct: Number(p.marks_correct ?? 4),
        marks_wrong: Number(p.marks_wrong ?? -1),
        explanation: String(p.explanation ?? ""),
        subject: p.subject ? String(p.subject) : undefined,
        chapter: p.chapter ? String(p.chapter) : undefined,
        topic: p.topic ? String(p.topic) : undefined,
        type: p.type ? String(p.type) : "mcq",
        is_pyq: isPyq,
        pyq_year: p.pyq_year !== undefined && p.pyq_year !== null ? Number(p.pyq_year) : (p.year !== undefined ? Number(p.year) : null),
      } as QDraft;
    });
  };
  const handle = (raw?: string) => {
    try {
      const qs = parseArray(raw ?? text);
      if (!qs.length) throw new Error("No questions in array");
      onImport(qs);
      toast.success(`Imported ${qs.length} questions`);
      setOpen(false); setText("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Invalid JSON");
    }
  };
  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    const raw = await f.text();
    setText(raw);
    handle(raw);
  };
  if (!open) return <Button size="sm" variant="outline" onClick={() => setOpen(true)} className="gap-1"><Plus className="h-4 w-4" /> Bulk import</Button>;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur" onClick={() => setOpen(false)}>
      <Card className="w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
        <CardHeader>
          <CardTitle>Bulk import questions</CardTitle>
          <CardDescription>Upload a .json file or paste a JSON array. Fields: text, options[], correct_index, difficulty, subject, chapter, topic, source, type, marks_correct, marks_wrong, explanation, pyq_year. Supports \\n, **bold**, LaTeX ($...$, $$...$$), and TikZ diagrams (\\begin&#123;tikzpicture&#125;…\\end&#123;tikzpicture&#125; or fenced ```tikz```).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-input bg-card px-3 py-2 text-sm font-medium hover:bg-accent">
              <Plus className="h-4 w-4" /> Choose JSON file
              <input type="file" accept="application/json,.json" className="hidden" onChange={onFile} />
            </label>
            <span className="text-xs text-muted-foreground">Supports thousands of questions per upload</span>
          </div>
          <Textarea rows={12} value={text} onChange={(e) => setText(e.target.value)} placeholder={sample} className="font-mono text-xs" />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="outline" onClick={() => setText(sample)}>Insert sample</Button>
            <Button onClick={() => handle()} className="bg-gradient-primary">Import</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ───────────────────────── Chapters Manager ─────────────────────────
type Subject = { id: string; name: string };
type Chapter = { id: string; subject_id: string; name: string; class: number | null; order_index: number };

function ChaptersManager() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectId, setSubjectId] = useState<string>("");
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [name, setName] = useState("");
  const [klass, setKlass] = useState<string>("11");
  const [order, setOrder] = useState<string>("0");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadSubjects = async () => {
    const { data } = await supabase.from("subjects").select("id,name").order("name");
    setSubjects((data ?? []) as Subject[]);
    if (!subjectId && data && data.length) setSubjectId(data[0].id);
  };
  const loadChapters = async (sid: string) => {
    if (!sid) return setChapters([]);
    const { data } = await supabase.from("chapters").select("*").eq("subject_id", sid).order("order_index").order("name");
    setChapters((data ?? []) as Chapter[]);
  };
  useEffect(() => { loadSubjects(); }, []);
  useEffect(() => { loadChapters(subjectId); }, [subjectId]);

  const reset = () => { setName(""); setKlass("11"); setOrder("0"); setEditingId(null); };

  const save = async () => {
    if (!subjectId) return toast.error("Pick a subject");
    if (!name.trim()) return toast.error("Chapter name required");
    setBusy(true);
    const payload = { subject_id: subjectId, name: name.trim(), class: klass ? parseInt(klass) : null, order_index: parseInt(order) || 0 };
    const { error } = editingId
      ? await supabase.from("chapters").update(payload).eq("id", editingId)
      : await supabase.from("chapters").insert(payload);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(editingId ? "Chapter updated" : "Chapter added");
    reset();
    loadChapters(subjectId);
  };

  const edit = (c: Chapter) => { setEditingId(c.id); setName(c.name); setKlass(String(c.class ?? "")); setOrder(String(c.order_index)); };

  const remove = async (id: string) => {
    if (!confirm("Delete this chapter? Its questions stay but become unlinked.")) return;
    const { error } = await supabase.from("chapters").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    loadChapters(subjectId);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <Card>
        <CardHeader><CardTitle>{editingId ? "Edit chapter" : "Add chapter"}</CardTitle><CardDescription>Choose subject, then add or edit chapters.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div><Label>Subject</Label>
            <Select value={subjectId} onValueChange={setSubjectId}>
              <SelectTrigger><SelectValue placeholder="Subject" /></SelectTrigger>
              <SelectContent>{subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Chapter name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Plant Kingdom" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Class</Label><Input type="number" value={klass} onChange={(e) => setKlass(e.target.value)} /></div>
            <div><Label>Order</Label><Input type="number" value={order} onChange={(e) => setOrder(e.target.value)} /></div>
          </div>
          <div className="flex gap-2">
            <Button onClick={save} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : editingId ? "Update" : "Add chapter"}</Button>
            {editingId && <Button variant="outline" onClick={reset}>Cancel</Button>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Chapters</CardTitle><CardDescription>{chapters.length} chapter{chapters.length === 1 ? "" : "s"}</CardDescription></CardHeader>
        <CardContent>
          {chapters.length === 0 ? <p className="text-sm text-muted-foreground">No chapters yet for this subject.</p> :
            <div className="divide-y">
              {chapters.map(c => (
                <div key={c.id} className="flex items-center justify-between gap-3 py-3">
                  <div>
                    <div className="font-medium">{c.name}</div>
                    <div className="text-xs text-muted-foreground">Class {c.class ?? "—"} · Order {c.order_index}</div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => edit(c)}>Edit</Button>
                    <Button size="sm" variant="outline" onClick={() => remove(c.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
              ))}
            </div>}
        </CardContent>
      </Card>
    </div>
  );
}

// ───────────────────────── Questions Manager ─────────────────────────
type QRow = {
  id: string; subject_id: string | null; chapter_id: string | null; text: string;
  options: string[]; correct_index: number; explanation: string | null;
  difficulty: string; source: string; marks_correct: number; marks_wrong: number;
  is_pyq: boolean; pyq_year: number | null;
};

function QuestionsManager() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [subjectId, setSubjectId] = useState<string>("");
  const [chapterId, setChapterId] = useState<string>("");
  const [rows, setRows] = useState<QRow[]>([]);
  const [editing, setEditing] = useState<QRow | null>(null);
  const [busy, setBusy] = useState(false);

  const empty: QRow = {
    id: "", subject_id: "", chapter_id: "", text: "", options: ["", "", "", ""], correct_index: 0,
    explanation: "", difficulty: "medium", source: "NCERT", marks_correct: 4, marks_wrong: -1, is_pyq: false, pyq_year: null,
  };

  useEffect(() => { (async () => {
    const { data } = await supabase.from("subjects").select("id,name").order("name");
    setSubjects((data ?? []) as Subject[]);
    if (data && data.length && !subjectId) setSubjectId(data[0].id);
  })(); }, []);

  // Load ALL chapters so the in-editor chapter dropdown stays correct
  // even when the user changes the subject inside the editor.
  useEffect(() => { (async () => {
    const { data } = await supabase.from("chapters").select("*").order("order_index").order("name");
    setChapters((data ?? []) as Chapter[]);
  })(); }, []);
  useEffect(() => { setChapterId(""); }, [subjectId]);

  const loadQuestions = async () => {
    let q = supabase.from("questions").select("*").order("created_at", { ascending: false }).limit(100);
    if (subjectId) q = q.eq("subject_id", subjectId);
    if (chapterId) q = q.eq("chapter_id", chapterId);
    const { data, error } = await q;
    if (error) return toast.error(error.message);
    setRows(((data ?? []) as any[]).map(r => ({ ...r, options: Array.isArray(r.options) ? r.options : [] })) as QRow[]);
  };
  useEffect(() => { loadQuestions(); }, [subjectId, chapterId]);

  const startNew = () => setEditing({ ...empty, subject_id: subjectId, chapter_id: chapterId || null });
  const startEdit = (r: QRow) => setEditing({ ...r, options: [...r.options, "", "", "", ""].slice(0, Math.max(4, r.options.length)) });

  const save = async () => {
    if (!editing) return;
    if (!editing.text.trim()) return toast.error("Question text required");
    if (editing.options.some(o => !o.trim())) return toast.error("Fill all options");
    if (!editing.subject_id) return toast.error("Pick a subject");
    setBusy(true);
    const payload = {
      subject_id: editing.subject_id, chapter_id: editing.chapter_id || null,
      text: editing.text.trim(), options: editing.options, correct_index: editing.correct_index,
      explanation: editing.explanation || null, difficulty: editing.difficulty, source: editing.source,
      marks_correct: editing.marks_correct, marks_wrong: editing.marks_wrong,
      is_pyq: editing.is_pyq, pyq_year: editing.is_pyq ? editing.pyq_year : null,
    };
    const { error } = editing.id
      ? await supabase.from("questions").update(payload).eq("id", editing.id)
      : await supabase.from("questions").insert(payload);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(editing.id ? "Updated" : "Added");
    setEditing(null);
    loadQuestions();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this question?")) return;
    const { error } = await supabase.from("questions").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    loadQuestions();
  };

  const updateEditing = (p: Partial<QRow>) => setEditing(e => e ? { ...e, ...p } : e);
  const setOpt = (i: number, v: string) => setEditing(e => e ? { ...e, options: e.options.map((o, k) => k === i ? v : o) } : e);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Question bank</CardTitle><CardDescription>Filter by subject and chapter, then add or edit questions.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div><Label>Subject</Label>
              <Select value={subjectId} onValueChange={setSubjectId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Chapter</Label>
              <Select value={chapterId || "all"} onValueChange={(v) => setChapterId(v === "all" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="All chapters" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All chapters</SelectItem>
                  {chapters.filter(c => !subjectId || c.subject_id === subjectId).map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end"><Button onClick={startNew} className="w-full"><Plus className="mr-1 h-4 w-4" />Add question</Button></div>
          </div>
        </CardContent>
      </Card>

      {editing && (
        <Card>
          <CardHeader><CardTitle>{editing.id ? "Edit question" : "New question"}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div><Label>Subject</Label>
                <Select value={editing.subject_id || ""} onValueChange={(v) => updateEditing({ subject_id: v, chapter_id: null })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Chapter</Label>
                <Select value={editing.chapter_id || "none"} onValueChange={(v) => updateEditing({ chapter_id: v === "none" ? null : v })}>
                  <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {chapters.filter(c => c.subject_id === editing.subject_id).map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Question</Label><Textarea rows={3} value={editing.text} onChange={(e) => updateEditing({ text: e.target.value })} /></div>
            <div className="grid gap-2">
              <Label>Options (select correct)</Label>
              {editing.options.map((o, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input type="radio" checked={editing.correct_index === i} onChange={() => updateEditing({ correct_index: i })} />
                  <Input value={o} onChange={(e) => setOpt(i, e.target.value)} placeholder={`Option ${String.fromCharCode(65 + i)}`} />
                </div>
              ))}
            </div>
            <div><Label>Explanation</Label><Textarea rows={2} value={editing.explanation ?? ""} onChange={(e) => updateEditing({ explanation: e.target.value })} /></div>
            <div className="grid gap-3 sm:grid-cols-4">
              <div><Label>Difficulty</Label>
                <Select value={editing.difficulty} onValueChange={(v) => updateEditing({ difficulty: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="easy">Easy</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="hard">Hard</SelectItem></SelectContent>
                </Select>
              </div>
              <div><Label>Source</Label><Input value={editing.source} onChange={(e) => updateEditing({ source: e.target.value })} /></div>
              <div><Label>+Marks</Label><Input type="number" value={editing.marks_correct} onChange={(e) => updateEditing({ marks_correct: parseInt(e.target.value) || 0 })} /></div>
              <div><Label>−Marks</Label><Input type="number" value={editing.marks_wrong} onChange={(e) => updateEditing({ marks_wrong: parseInt(e.target.value) || 0 })} /></div>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={editing.is_pyq} onCheckedChange={(v) => updateEditing({ is_pyq: v })} />
              <Label className="m-0">PYQ</Label>
              {editing.is_pyq && <Input className="w-32" type="number" placeholder="Year" value={editing.pyq_year ?? ""} onChange={(e) => updateEditing({ pyq_year: e.target.value ? parseInt(e.target.value) : null })} />}
            </div>
            <div className="flex gap-2">
              <Button onClick={save} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}</Button>
              <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Questions ({rows.length})</CardTitle></CardHeader>
        <CardContent>
          {rows.length === 0 ? <p className="text-sm text-muted-foreground">No questions match.</p> :
            <div className="divide-y">
              {rows.map(r => (
                <div key={r.id} className="flex items-start justify-between gap-3 py-3">
                  <div className="flex-1">
                    <div className="text-sm">{r.text}</div>
                    <div className="mt-1 flex flex-wrap gap-2">
                      <Badge variant="outline">{r.difficulty}</Badge>
                      <Badge variant="outline">+{r.marks_correct} / {r.marks_wrong}</Badge>
                      {r.is_pyq && <Badge>PYQ {r.pyq_year ?? ""}</Badge>}
                      <Badge variant="outline">Ans: {String.fromCharCode(65 + r.correct_index)}</Badge>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => startEdit(r)}>Edit</Button>
                    <Button size="sm" variant="outline" onClick={() => remove(r.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
              ))}
            </div>}
        </CardContent>
      </Card>
    </div>
  );
}

// ───────────────────── Chapter Quiz Bulk Import ─────────────────────
// Accepts JSON like:
//  { "subject": "Physics", "chapter": "Kinematics", "title": "Optional",
//    "duration_min": 20, "questions": [ ...QDraft ] }
// or an array of those for multi-chapter import.
function ChapterQuizBulkImport() {
  const importFn = useServerFn(importChapterQuizzes);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  const sample = `[
  {
    "subject": "Physics",
    "chapter": "Kinematics",
    "title": "Physics · Kinematics (Chapter Quiz)",
    "duration_min": 20,
    "difficulty": "medium",
    "source": "NCERT",
    "questions": [
      {
        "text": "A body starts from rest with acceleration 2 m/s². Distance in 5s?",
        "options": ["10 m", "25 m", "50 m", "5 m"],
        "correct_index": 1,
        "difficulty": "easy",
        "explanation": "s = ½ a t² = ½·2·25 = 25 m"
      }
    ]
  }
]`;

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    setText(await f.text());
  };

  const run = async () => {
    let parsed: unknown;
    try { parsed = parseLenientJson(text); } catch (e) { return toast.error("Invalid JSON: " + (e instanceof Error ? e.message : "parse failed")); }
    const groups = (Array.isArray(parsed) ? parsed : [parsed]) as Array<Record<string, unknown>>;
    if (!groups.length) return toast.error("Empty payload");
    setBusy(true); setLog([]);

    try {
      const res = await importFn({ data: { groups: groups as never } });
      setLog(res.logs);
      toast.success(`Imported ${res.created} chapter quiz${res.created === 1 ? "" : "zes"}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Bulk import chapter quizzes</CardTitle>
          <CardDescription>
            Upload a JSON file (or paste below) — one or many objects with <code>subject</code>, <code>chapter</code>, and <code>questions[]</code>. Missing chapters are auto-created. A test is published per object.
            <span className="mt-1 block text-xs">
              <strong>Rich text in question/explanation:</strong> Markdown (<code>**bold**</code>, <code>*italic*</code>, <code>`code`</code>), LaTeX
              (<code>$...$</code>, <code>$$...$$</code>), and TikZ diagrams
              (<code>\\begin&#123;tikzpicture&#125;...\\end&#123;tikzpicture&#125;</code> or fenced <code>```tikz ... ```</code>).
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-input bg-card px-3 py-2 text-sm font-medium hover:bg-accent">
              <Plus className="h-4 w-4" /> Choose JSON file
              <input type="file" accept="application/json,.json" className="hidden" onChange={onFile} />
            </label>
            <Button variant="outline" size="sm" onClick={() => setText(sample)}>Insert sample</Button>
          </div>
          <Textarea rows={14} value={text} onChange={(e) => setText(e.target.value)} placeholder={sample} className="font-mono text-xs" />
          <div className="flex justify-end">
            <Button onClick={run} disabled={busy || !text.trim()} className="gap-1.5 bg-gradient-primary">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Import
            </Button>
          </div>
          {log.length > 0 && (
            <div className="rounded-lg border bg-card p-3 text-xs font-mono space-y-0.5 max-h-64 overflow-auto">
              {log.map((line, i) => <div key={i}>{line}</div>)}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ───────────────────── Bulk Chapters Import ─────────────────────
// Accepts JSON array of { subject, name, class?, order_index? } — or an object
// with { subject, chapters: [{ name, class?, order_index? }, ...] }.
function BulkChaptersImport() {
  const importFn = useServerFn(importChapters);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  const sample = `[
  { "subject": "Physics", "name": "Kinematics", "class": 11, "order_index": 1 },
  { "subject": "Physics", "name": "Laws of Motion", "class": 11, "order_index": 2 },
  { "subject": "Botany", "name": "Plant Kingdom", "class": 11, "order_index": 1 }
]`;

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    setText(await f.text());
  };

  const run = async () => {
    let parsed: unknown;
    try { parsed = parseLenientJson(text); } catch (e) { return toast.error("Invalid JSON: " + (e instanceof Error ? e.message : "parse failed")); }

    // Normalize into a flat list of {subject, name, class?, order_index?}
    const flat: Array<{ subject: string; name: string; class?: number | null; order_index?: number }> = [];
    const arr = Array.isArray(parsed) ? parsed : [parsed];
    for (const entry of arr as Array<Record<string, unknown>>) {
      if (Array.isArray((entry as { chapters?: unknown }).chapters)) {
        const subj = String(entry.subject ?? "");
        for (const c of (entry as { chapters: Array<Record<string, unknown>> }).chapters) {
          flat.push({
            subject: subj || String(c.subject ?? ""),
            name: String(c.name ?? ""),
            class: c.class != null ? Number(c.class) : null,
            order_index: c.order_index != null ? Number(c.order_index) : 0,
          });
        }
      } else {
        flat.push({
          subject: String(entry.subject ?? ""),
          name: String(entry.name ?? ""),
          class: entry.class != null ? Number(entry.class) : null,
          order_index: entry.order_index != null ? Number(entry.order_index) : 0,
        });
      }
    }
    if (!flat.length) return toast.error("No chapters in payload");

    setBusy(true); setLog([]);
    try {
      const res = await importFn({ data: { chapters: flat } });
      setLog(res.logs);
      toast.success(`Created ${res.created}, skipped ${res.skipped}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Chapter import failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Bulk import chapter list</CardTitle>
          <CardDescription>
            Upload or paste a JSON array of <code>{`{ subject, name, class?, order_index? }`}</code>. Missing subjects are auto-created. Duplicate chapters are skipped.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-input bg-card px-3 py-2 text-sm font-medium hover:bg-accent">
              <Plus className="h-4 w-4" /> Choose JSON file
              <input type="file" accept="application/json,.json" className="hidden" onChange={onFile} />
            </label>
            <Button variant="outline" size="sm" onClick={() => setText(sample)}>Insert sample</Button>
          </div>
          <Textarea rows={12} value={text} onChange={(e) => setText(e.target.value)} placeholder={sample} className="font-mono text-xs" />
          <div className="flex justify-end">
            <Button onClick={run} disabled={busy || !text.trim()} className="gap-1.5 bg-gradient-primary">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Import chapters
            </Button>
          </div>
          {log.length > 0 && (
            <div className="rounded-lg border bg-card p-3 text-xs font-mono space-y-0.5 max-h-64 overflow-auto">
              {log.map((line, i) => <div key={i}>{line}</div>)}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function DuplicateManager() {
  const scanFn = useServerFn(scanDuplicateQuestions);
  const delFn = useServerFn(dedupeQuestions);
  const [stats, setStats] = useState<{ duplicateCount: number; groupCount: number; totalQuestions: number } | null>(null);
  const [busy, setBusy] = useState(false);

  const onScan = async () => {
    setBusy(true);
    try { setStats(await scanFn({})); toast.success("Scan complete"); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Scan failed"); }
    finally { setBusy(false); }
  };
  const onDelete = async () => {
    if (!confirm("Delete all duplicate questions? Oldest copy of each is kept.")) return;
    setBusy(true);
    try {
      const r = await delFn({});
      toast.success(`Deleted ${r.deleted} duplicates across ${r.groupCount} groups`);
      setStats(await scanFn({}));
    } catch (e) { toast.error(e instanceof Error ? e.message : "Delete failed"); }
    finally { setBusy(false); }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Duplicate questions</CardTitle>
        <CardDescription>Groups questions by text/hash. Keeps the oldest, removes the rest. Runs nightly via cron.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button onClick={onScan} disabled={busy} variant="outline">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Scan now"}
          </Button>
          <Button onClick={onDelete} disabled={busy || !stats || stats.duplicateCount === 0} variant="destructive">
            <Trash2 className="mr-2 h-4 w-4" /> Delete duplicates
          </Button>
        </div>
        {stats && (
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">Total questions</div><div className="text-2xl font-bold">{stats.totalQuestions}</div></div>
            <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">Duplicate rows</div><div className="text-2xl font-bold text-destructive">{stats.duplicateCount}</div></div>
            <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">Duplicate groups</div><div className="text-2xl font-bold">{stats.groupCount}</div></div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─────────────────── Withdrawals (manual payouts) ───────────────────
function WithdrawalsPanel() {
  const listFn = useServerFn(adminListPendingWithdrawals);
  const approveFn = useServerFn(adminApproveWithdrawal);
  const rejectFn = useServerFn(adminRejectWithdrawal);
  const [rows, setRows] = useState<Array<{ id: string; user_id: string; full_name: string | null; email: string | null; amount: number; upi_or_note: string; available_balance: number; created_at: string }> | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const reload = () => { setRows(null); listFn().then((d) => setRows(d as never)).catch((e) => { toast.error(e?.message ?? "Failed"); setRows([]); }); };
  useEffect(() => { reload(); }, []);
  const approve = async (id: string) => {
    if (!confirm("Mark this withdrawal as PAID? You should have already transferred via UPI.")) return;
    setBusyId(id);
    try { await approveFn({ data: { id, note: "Paid manually via UPI" } }); toast.success("Marked as paid"); reload(); }
    catch (e: any) { toast.error(e?.message ?? "Failed"); }
    finally { setBusyId(null); }
  };
  const reject = async (id: string) => {
    const note = prompt("Rejection reason?");
    if (!note) return;
    setBusyId(id);
    try { await rejectFn({ data: { id, note } }); toast.success("Rejected. Balance refunded."); reload(); }
    catch (e: any) { toast.error(e?.message ?? "Failed"); }
    finally { setBusyId(null); }
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><IndianRupee className="h-5 w-5 text-primary" /> Pending withdrawals</CardTitle>
        <CardDescription>Pay the user via UPI then click "Done" to mark paid. Reject to refund their balance.</CardDescription>
      </CardHeader>
      <CardContent>
        {rows === null ? <Loader2 className="h-5 w-5 animate-spin text-primary" />
          : rows.length === 0 ? <p className="text-sm text-muted-foreground">No pending withdrawals.</p>
          : <ul className="space-y-3">
              {rows.map((r) => (
                <li key={r.id} className="rounded-xl border border-border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold">{r.full_name ?? "—"} <span className="text-xs font-normal text-muted-foreground">({r.email})</span></div>
                      <div className="mt-1 text-xs text-muted-foreground">Requested {new Date(r.created_at).toLocaleString()}</div>
                      <div className="mt-2 grid gap-1 text-sm sm:grid-cols-3">
                        <div><div className="text-[10px] uppercase text-muted-foreground">Withdraw</div><div className="font-bold text-rose-600">₹{Number(r.amount).toFixed(2)}</div></div>
                        <div><div className="text-[10px] uppercase text-muted-foreground">Current balance</div><div className="font-bold">₹{Number(r.available_balance).toFixed(2)}</div></div>
                        <div className="sm:col-span-1"><div className="text-[10px] uppercase text-muted-foreground">UPI / Note</div><div className="font-mono text-xs break-all">{r.upi_or_note}</div></div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => approve(r.id)} disabled={busyId === r.id} className="bg-emerald-600 hover:bg-emerald-700">
                        {busyId === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="mr-1 h-4 w-4" /> Done</>}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => reject(r.id)} disabled={busyId === r.id}>
                        <X className="mr-1 h-4 w-4" /> Reject
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>}
      </CardContent>
    </Card>
  );
}

// ─────────────────── AI Contest creation wizard ───────────────────
function AiContestWizard() {
  const createFn = useServerFn(adminCreateContest);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [prize, setPrize] = useState(500);
  const [entryFee, setEntryFee] = useState(20);
  const [startsAt, setStartsAt] = useState(() => {
    const d = new Date(); d.setHours(19, 0, 0, 0);
    if (d.getTime() < Date.now()) d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 16);
  });
  const [duration, setDuration] = useState(30);
  const [numQs, setNumQs] = useState(20);
  const [subjects, setSubjects] = useState<{ id: string; name: string }[]>([]);
  const [chapters, setChapters] = useState<{ id: string; name: string; subject_id: string }[]>([]);
  const [pickedChapters, setPickedChapters] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"ai" | "manual">("ai");
  type MQ = { text: string; options: string[]; correct_index: number; explanation: string; difficulty: string; subject_id?: string | null; chapter_id?: string | null };
  const blankMQ = (): MQ => ({ text: "", options: ["", "", "", ""], correct_index: 0, explanation: "", difficulty: "medium", subject_id: null, chapter_id: null });
  const [manualQs, setManualQs] = useState<MQ[]>([blankMQ()]);

  useEffect(() => {
    supabase.from("subjects").select("id,name").order("name").then(({ data }) => setSubjects(data ?? []));
    supabase.from("chapters").select("id,name,subject_id").order("name").then(({ data }) => setChapters(data ?? []));
  }, []);

  const toggle = (id: string) => setPickedChapters((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const updateMQ = (i: number, p: Partial<MQ>) => setManualQs(qs => qs.map((q, idx) => idx === i ? { ...q, ...p } : q));
  const setMQOpt = (i: number, j: number, v: string) => setManualQs(qs => qs.map((q, idx) => idx === i ? { ...q, options: q.options.map((o, k) => k === j ? v : o) } : q));

  const submit = async () => {
    if (!title.trim()) return toast.error("Title required");
    if (mode === "ai" && pickedChapters.size === 0) return toast.error("Pick at least one chapter");
    if (mode === "manual") {
      if (manualQs.length === 0) return toast.error("Add at least one question");
      if (manualQs.some(q => !q.text.trim() || q.options.some(o => !o.trim()))) return toast.error("Fill all question fields");
    }
    setBusy(true);
    try {
      const r = await createFn({ data: {
        title: title.trim(), description: description.trim() || undefined,
        prize_pool: Number(prize), entry_fee: Number(entryFee),
        starts_at: new Date(startsAt).toISOString(),
        duration_min: Number(duration),
        total_questions: mode === "manual" ? manualQs.length : Number(numQs),
        chapter_ids: mode === "ai" ? Array.from(pickedChapters) : [],
        manual_questions: mode === "manual" ? manualQs.map(q => ({
          text: q.text.trim(), options: q.options, correct_index: q.correct_index,
          explanation: q.explanation || null, difficulty: q.difficulty,
          subject_id: q.subject_id || null, chapter_id: q.chapter_id || null,
        })) : [],
      }});
      toast.success(`Contest created with ${r.questions} questions 🎉`);
      setTitle(""); setDescription(""); setPickedChapters(new Set()); setManualQs([blankMQ()]);
    } catch (e: any) { toast.error(e?.message ?? "Could not create contest"); }
    finally { setBusy(false); }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Trophy className="h-5 w-5 text-primary" /> Create contest</CardTitle>
        <CardDescription>Generate questions with AI from chapters, or add them manually one by one.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs value={mode} onValueChange={(v) => setMode(v as "ai" | "manual")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="ai"><Sparkles className="mr-1 h-4 w-4" />AI generate</TabsTrigger>
            <TabsTrigger value="manual"><Plus className="mr-1 h-4 w-4" />Manual</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2"><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Daily Physics Sprint" /></div>
          <div className="space-y-1.5 sm:col-span-2"><Label>Description</Label><Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Live start (local)</Label><Input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Duration (min)</Label><Input type="number" min={5} max={180} value={duration} onChange={(e) => setDuration(+e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Prize pool (₹)</Label><Input type="number" min={0} value={prize} onChange={(e) => setPrize(+e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Entry fee (₹)</Label><Input type="number" min={0} value={entryFee} onChange={(e) => setEntryFee(+e.target.value)} /></div>
          {mode === "ai" && (
            <div className="space-y-1.5"><Label>Total questions</Label><Input type="number" min={5} max={50} value={numQs} onChange={(e) => setNumQs(+e.target.value)} /></div>
          )}
        </div>

        {mode === "ai" ? (
          <div className="space-y-2">
            <Label>Chapters ({pickedChapters.size} selected)</Label>
            <div className="max-h-72 space-y-3 overflow-y-auto rounded-xl border border-border p-3">
              {subjects.map((s) => {
                const subjChapters = chapters.filter((c) => c.subject_id === s.id);
                if (!subjChapters.length) return null;
                return (
                  <div key={s.id}>
                    <div className="mb-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">{s.name}</div>
                    <div className="flex flex-wrap gap-1.5">
                      {subjChapters.map((c) => (
                        <button key={c.id} type="button" onClick={() => toggle(c.id)}
                          className={`rounded-full border px-2.5 py-1 text-xs transition ${pickedChapters.has(c.id) ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-secondary"}`}>
                          {c.name}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Questions ({manualQs.length})</Label>
              <Button size="sm" variant="outline" onClick={() => setManualQs(qs => [...qs, blankMQ()])}><Plus className="mr-1 h-4 w-4" />Add question</Button>
            </div>
            {manualQs.map((q, i) => (
              <div key={i} className="space-y-3 rounded-xl border border-border p-3">
                <div className="flex items-center justify-between">
                  <Badge variant="secondary">Q {i + 1}</Badge>
                  {manualQs.length > 1 && (
                    <Button size="icon" variant="ghost" onClick={() => setManualQs(qs => qs.filter((_, x) => x !== i))}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  )}
                </div>
                <Textarea rows={2} placeholder="Question text" value={q.text} onChange={(e) => updateMQ(i, { text: e.target.value })} />
                <div className="grid gap-2 sm:grid-cols-2">
                  {q.options.map((o, j) => (
                    <div key={j} className="flex items-center gap-2">
                      <button type="button" onClick={() => updateMQ(i, { correct_index: j })}
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${q.correct_index === j ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>
                        {String.fromCharCode(65 + j)}
                      </button>
                      <Input value={o} onChange={(e) => setMQOpt(i, j, e.target.value)} placeholder={`Option ${String.fromCharCode(65 + j)}`} />
                    </div>
                  ))}
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  <Select value={q.difficulty} onValueChange={(v) => updateMQ(i, { difficulty: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="easy">Easy</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="hard">Hard</SelectItem></SelectContent>
                  </Select>
                  <Select value={q.subject_id ?? "none"} onValueChange={(v) => updateMQ(i, { subject_id: v === "none" ? null : v, chapter_id: null })}>
                    <SelectTrigger><SelectValue placeholder="Subject" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No subject</SelectItem>
                      {subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={q.chapter_id ?? "none"} onValueChange={(v) => updateMQ(i, { chapter_id: v === "none" ? null : v })}>
                    <SelectTrigger><SelectValue placeholder="Chapter" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No chapter</SelectItem>
                      {chapters.filter(c => !q.subject_id || c.subject_id === q.subject_id).map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <Textarea rows={2} placeholder="Explanation (optional)" value={q.explanation} onChange={(e) => updateMQ(i, { explanation: e.target.value })} />
              </div>
            ))}
          </div>
        )}

        <p className="text-[11px] text-muted-foreground">Prize distribution: 50% / 30% / 20% to top 3 — auto-credited to winnings when the contest ends.</p>
        <Button onClick={submit} disabled={busy} className="bg-gradient-primary">
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : mode === "ai" ? <Sparkles className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
          {mode === "ai" ? "Generate contest" : "Create contest"}
        </Button>
      </CardContent>
    </Card>
  );
}

function FlashcardsManager() {
  const listCh = useServerFn(adminListChaptersForFlashcards);
  const gen = useServerFn(adminGenerateFlashcards);
  const del = useServerFn(adminDeleteFlashcardsByChapter);
  const [chapters, setChapters] = useState<Array<{ id: string; name: string; subject_name: string; class: number | null }>>([]);
  const [chapterId, setChapterId] = useState<string>("");
  const [count, setCount] = useState<number>(20);
  const [busy, setBusy] = useState(false);
  useEffect(() => { listCh().then((d) => setChapters(d as any)).catch((e) => toast.error(e?.message ?? "Failed")); }, [listCh]);
  async function generate() {
    if (!chapterId) { toast.error("Pick a chapter"); return; }
    setBusy(true);
    try {
      const r = await gen({ data: { chapter_id: chapterId, count } });
      toast.success(`Created ${r.created} flashcards for ${r.chapter}`);
    } catch (e: any) { toast.error(e?.message ?? "Generation failed"); }
    finally { setBusy(false); }
  }
  async function remove() {
    if (!chapterId) return;
    if (!confirm("Delete ALL flashcards for this chapter?")) return;
    setBusy(true);
    try { const r = await del({ data: { chapter_id: chapterId } }); toast.success(`Deleted ${r.deleted} cards`); }
    catch (e: any) { toast.error(e?.message ?? "Delete failed"); }
    finally { setBusy(false); }
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> AI Flashcards</CardTitle>
        <CardDescription>Generate NEET-grade flashcards for any chapter using AI. They appear on the student Flashcards page.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <Label>Chapter</Label>
            <Select value={chapterId} onValueChange={setChapterId}>
              <SelectTrigger><SelectValue placeholder="Select chapter" /></SelectTrigger>
              <SelectContent>
                {chapters.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.subject_name} · {c.name}{c.class ? ` (Cls ${c.class})` : ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>How many?</Label>
            <Input type="number" min={5} max={60} value={count} onChange={(e) => setCount(Math.max(5, Math.min(60, Number(e.target.value) || 20)))} />
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={generate} disabled={busy || !chapterId} className="bg-gradient-primary">
            {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1.5 h-4 w-4" />} Generate flashcards
          </Button>
          <Button onClick={remove} disabled={busy || !chapterId} variant="outline" className="text-destructive">
            <Trash2 className="mr-1.5 h-4 w-4" /> Delete all for chapter
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">Tip: 20 cards per chapter is a good starting batch. Run again to add more.</p>
        <BulkAllChapters kind="flashcards" />
      </CardContent>
    </Card>
  );
}

// Generates content for EVERY chapter that has none yet, looping in small
// batches so each request stays within serverless limits.
function BulkAllChapters({ kind }: { kind: "flashcards" | "highlights" }) {
  const runFc = useServerFn(adminGenerateFlashcardsBulk);
  const runHl = useServerFn(adminGenerateHighlightsBulk);
  const run = kind === "flashcards" ? runFc : runHl;
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string>("");
  const [createdTotal, setCreatedTotal] = useState(0);

  async function go() {
    if (!confirm(`Generate AI ${kind} for ALL chapters that are still empty? This runs in batches and may take a while.`)) return;
    setBusy(true); setCreatedTotal(0); setLog("Starting…");
    let total = 0;
    try {
      // Loop until no chapters remain.
      // Guard against runaway loops with a hard cap.
      for (let i = 0; i < 60; i++) {
        const r = await run({ data: { per_chapter: kind === "flashcards" ? 15 : 12, max_chapters: 4 } });
        total += r.created;
        setCreatedTotal(total);
        setLog(`Batch ${i + 1}: +${r.created} items (${r.processed} chapters) · ${r.remaining} chapters remaining`);
        if (r.remaining <= 0) { setLog(`Done. Created ${total} ${kind} across all empty chapters.`); break; }
      }
      toast.success(`Generated ${total} ${kind}`);
    } catch (e: any) {
      toast.error(e?.message ?? "Bulk generation failed");
      setLog((l) => l + ` — stopped: ${e?.message ?? "error"}`);
    } finally { setBusy(false); }
  }

  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-semibold">Bulk generate across all chapters</div>
        <Button size="sm" onClick={go} disabled={busy} className="bg-gradient-primary">
          {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1.5 h-4 w-4" />}
          Generate all
        </Button>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Only fills chapters that have no {kind} yet. Safe to run repeatedly.
        {createdTotal > 0 && <span className="font-semibold text-foreground"> · {createdTotal} created</span>}
      </p>
      {log && <p className="mt-1 text-[11px] text-muted-foreground">{log}</p>}
    </div>
  );
}


function HighlightsManager() {
  const listCh = useServerFn(adminListChaptersForFlashcards);
  const gen = useServerFn(adminGenerateHighlights);
  const add = useServerFn(adminAddHighlight);
  const del = useServerFn(adminDeleteHighlightsByChapter);
  const [chapters, setChapters] = useState<Awaited<ReturnType<typeof adminListChaptersForFlashcards>> | null>(null);
  const [chapterId, setChapterId] = useState("");
  const [count, setCount] = useState(15);
  const [manualBody, setManualBody] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { listCh().then(setChapters).catch((e) => toast.error(e?.message ?? "Failed")); }, []);
  const onGen = async () => {
    if (!chapterId) return toast.error("Pick a chapter");
    setBusy(true);
    try { const r = await gen({ data: { chapter_id: chapterId, count } }); toast.success(`Created ${r.created} highlights for ${r.chapter}`); }
    catch (e: any) { toast.error(e?.message ?? "Failed"); } finally { setBusy(false); }
  };
  const onAdd = async () => {
    if (!chapterId || manualBody.trim().length < 3) return toast.error("Pick chapter & enter body");
    setBusy(true);
    try { await add({ data: { chapter_id: chapterId, body: manualBody.trim() } }); toast.success("Added"); setManualBody(""); }
    catch (e: any) { toast.error(e?.message ?? "Failed"); } finally { setBusy(false); }
  };
  const onDel = async () => {
    if (!chapterId || !confirm("Delete ALL highlights for this chapter?")) return;
    setBusy(true);
    try { const r = await del({ data: { chapter_id: chapterId } }); toast.success(`Deleted ${r.deleted}`); }
    catch (e: any) { toast.error(e?.message ?? "Failed"); } finally { setBusy(false); }
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> NCERT Highlights</CardTitle>
        <CardDescription>Generate AI highlights or add them manually. Appears on the public NCERT Highlights page.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-[2fr_1fr]">
          <Select value={chapterId} onValueChange={setChapterId}>
            <SelectTrigger><SelectValue placeholder={chapters ? "Pick a chapter" : "Loading..."} /></SelectTrigger>
            <SelectContent className="max-h-[300px]">
              {(chapters ?? []).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.subject_name} · {c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input type="number" min={5} max={40} value={count} onChange={(e) => setCount(Number(e.target.value) || 15)} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={onGen} disabled={busy || !chapterId} className="bg-gradient-primary">
            {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1.5 h-4 w-4" />} Generate
          </Button>
          <Button onClick={onDel} disabled={busy || !chapterId} variant="outline" className="text-destructive">
            <Trash2 className="mr-1.5 h-4 w-4" /> Delete all for chapter
          </Button>
        </div>
        <div className="space-y-2 border-t pt-3">
          <Label>Add highlight manually</Label>
          <Textarea rows={3} placeholder="Paste a NCERT line / fact / definition…" value={manualBody} onChange={(e) => setManualBody(e.target.value)} />
          <Button onClick={onAdd} disabled={busy || !chapterId} size="sm"><Plus className="mr-1.5 h-4 w-4" /> Add</Button>
        </div>
        <BulkAllChapters kind="highlights" />

      </CardContent>
    </Card>
  );
}

function AiSettingsManager() {
  const get = useServerFn(getAppSettings);
  const upd = useServerFn(adminUpdateSetting);
  const [flash, setFlash] = useState(15);
  const [ncert, setNcert] = useState(15);
  const [predict, setPredict] = useState(25);
  const [path, setPath] = useState(45);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    get().then((s) => {
      setFlash(s.flashcards_cost); setNcert(s.ncert_highlights_cost);
      setPredict(s.score_predictor_cost); setPath(s.ai_path_cost);
    });
  }, []);
  const save = async (
    key: "flashcards_cost" | "ncert_highlights_cost" | "score_predictor_cost" | "ai_path_cost",
    value: number,
  ) => {
    setBusy(true);
    try { await upd({ data: { key, value } }); toast.success("Saved"); }
    catch (e: any) { toast.error(e?.message ?? "Failed"); } finally { setBusy(false); }
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle>Feature Pricing</CardTitle>
        <CardDescription>Bonus coins charged to access each premium study tool.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <div><Label>Flashcards cost (bonus / day)</Label><Input type="number" min={0} max={10000} value={flash} onChange={(e) => setFlash(Number(e.target.value) || 0)} /></div>
          <Button onClick={() => save("flashcards_cost", flash)} disabled={busy} className="self-end">Save</Button>
        </div>
        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <div><Label>NCERT Highlights cost (bonus / day)</Label><Input type="number" min={0} max={10000} value={ncert} onChange={(e) => setNcert(Number(e.target.value) || 0)} /></div>
          <Button onClick={() => save("ncert_highlights_cost", ncert)} disabled={busy} className="self-end">Save</Button>
        </div>
        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <div><Label>Score Predictor cost (bonus)</Label><Input type="number" min={0} max={10000} value={predict} onChange={(e) => setPredict(Number(e.target.value) || 0)} /></div>
          <Button onClick={() => save("score_predictor_cost", predict)} disabled={busy} className="self-end">Save</Button>
        </div>
        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <div><Label>AI Path cost (bonus)</Label><Input type="number" min={0} max={10000} value={path} onChange={(e) => setPath(Number(e.target.value) || 0)} /></div>
          <Button onClick={() => save("ai_path_cost", path)} disabled={busy} className="self-end">Save</Button>
        </div>
      </CardContent>
    </Card>
  );
}


function InfiniteRunPanel() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <InfinityIcon className="h-5 w-5 text-primary" /> Infinite Run
        </CardTitle>
        <CardDescription>
          Admin-only auto-generated DPP engine. Runs until bonus credits are exhausted.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm text-muted-foreground">
          Infinite Run is now an admin feature only. Use it to generate continuous DPP sets
          for testing question pipelines, or to seed difficult-question pools.
        </div>
        <Button asChild className="bg-gradient-primary">
          <Link to="/infinite-run">
            Open Infinite Run console <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// User Report — admin lookup by email; shows balances, money flow, battle stats.
// ─────────────────────────────────────────────────────────────────────────────
function UserReportPanel() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<any | null>(null);
  const runReport = useServerFn(getUserReport);
  const runSuspend = useServerFn(adminSuspendUser);
  const runAdjust = useServerFn(adminAdjustBalance);

  // Adjust-balance form state
  const [adjAmount, setAdjAmount] = useState("");
  const [adjBucket, setAdjBucket] = useState<"deposit" | "winnings" | "bonus">("winnings");
  const [adjReason, setAdjReason] = useState("");
  const [actionBusy, setActionBusy] = useState(false);

  async function onSearch(e?: React.FormEvent) {
    e?.preventDefault();
    if (!email.trim()) { toast.error("Enter an email"); return; }
    setLoading(true);
    setReport(null);
    try {
      const data = await runReport({ data: { email: email.trim() } });
      setReport(data);
    } catch (err: any) {
      toast.error(err?.message ?? "Lookup failed");
    } finally {
      setLoading(false);
    }
  }

  async function onToggleSuspend() {
    if (!report) return;
    const currentlySuspended = !!report.profile?.suspended;
    const verb = currentlySuspended ? "UNSUSPEND" : "SUSPEND";
    const reason = currentlySuspended
      ? undefined
      : window.prompt("Reason for suspension (will be saved to audit log):") ?? undefined;
    if (!currentlySuspended && (!reason || reason.trim().length < 3)) {
      toast.error("Reason required to suspend");
      return;
    }
    if (!window.confirm(`${verb} ${report.profile.email}?\nThis will ${currentlySuspended ? "restore login access" : "block all future logins"}.`)) return;
    setActionBusy(true);
    try {
      await runSuspend({ data: { userId: report.profile.id, suspend: !currentlySuspended, reason } });
      toast.success(currentlySuspended ? "User unsuspended" : "User suspended");
      await onSearch();
    } catch (err: any) {
      toast.error(err?.message ?? "Action failed");
    } finally {
      setActionBusy(false);
    }
  }

  async function onAdjust(e: React.FormEvent) {
    e.preventDefault();
    if (!report) return;
    const amt = Number(adjAmount);
    if (!Number.isFinite(amt) || amt === 0) { toast.error("Enter a non-zero amount (negative to debit)"); return; }
    if (adjReason.trim().length < 3) { toast.error("Reason is required"); return; }
    if (!window.confirm(`${amt > 0 ? "Credit" : "Debit"} ₹${Math.abs(amt).toFixed(2)} to ${adjBucket} bucket of ${report.profile.email}?`)) return;
    setActionBusy(true);
    try {
      await runAdjust({ data: { userId: report.profile.id, amount: amt, bucket: adjBucket, reason: adjReason.trim() } });
      toast.success("Balance adjusted");
      setAdjAmount(""); setAdjReason("");
      await onSearch();
    } catch (err: any) {
      toast.error(err?.message ?? "Adjustment failed");
    } finally {
      setActionBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><UserIcon className="h-5 w-5" /> User Report</CardTitle>
        <CardDescription>Look up a user by email to see balances, deposits, withdrawals, battles, and full money flow. Admin actions are audited.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={onSearch} className="flex gap-2">
          <Input
            type="email"
            placeholder="user@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="flex-1"
          />
          <Button type="submit" disabled={loading} className="bg-gradient-primary">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            <span className="ml-2">Lookup</span>
          </Button>
        </form>

        {report && (
          <div className="space-y-4">
            {/* Profile card */}
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-3">
                {report.profile.avatar_url ? (
                  <img src={report.profile.avatar_url} alt="" className="h-12 w-12 rounded-full" />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <UserIcon className="h-6 w-6" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="font-semibold flex items-center gap-2">
                    {report.profile.full_name || "(no name)"}
                    {report.profile.suspended ? <Badge variant="destructive">Suspended</Badge> : null}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{report.profile.email}</div>
                  <div className="text-[10px] text-muted-foreground">ID: {report.profile.id}</div>
                </div>
                <div className="text-right text-xs">
                  <div>XP: <strong>{report.profile.xp_total}</strong></div>
                  <div>Joined: {new Date(report.profile.created_at).toLocaleDateString()}</div>
                  {report.profile.roles?.length ? <Badge variant="secondary" className="mt-1">{report.profile.roles.join(", ")}</Badge> : null}
                </div>
              </div>

              {/* Admin actions row */}
              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border/60 pt-3">
                <Button
                  size="sm"
                  variant={report.profile.suspended ? "secondary" : "destructive"}
                  disabled={actionBusy}
                  onClick={onToggleSuspend}
                >
                  {actionBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldAlert className="h-4 w-4" />}
                  <span className="ml-2">{report.profile.suspended ? "Unsuspend account" : "Suspend account"}</span>
                </Button>
                <span className="text-[10px] text-muted-foreground">Suspension blocks all future logins. Existing session expires within ~1 hour.</span>
              </div>

              {/* Adjust balance */}
              <form onSubmit={onAdjust} className="mt-3 grid gap-2 border-t border-border/60 pt-3 sm:grid-cols-[140px,140px,1fr,auto]">
                <Input
                  type="number"
                  step="0.01"
                  placeholder="Amount (₹, negative to debit)"
                  value={adjAmount}
                  onChange={(e) => setAdjAmount(e.target.value)}
                />
                <Select value={adjBucket} onValueChange={(v) => setAdjBucket(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="winnings">Winnings</SelectItem>
                    <SelectItem value="deposit">Deposit</SelectItem>
                    <SelectItem value="bonus">Bonus</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Reason (required, audited)"
                  value={adjReason}
                  onChange={(e) => setAdjReason(e.target.value)}
                />
                <Button type="submit" size="sm" disabled={actionBusy} className="bg-gradient-primary">
                  {actionBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <IndianRupee className="h-4 w-4" />}
                  <span className="ml-2">Adjust</span>
                </Button>
              </form>
            </div>

            {/* Balances grid */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatTile label="Wallet" value={`₹${report.profile.wallet_balance.toFixed(2)}`} />
              <StatTile label="Deposits" value={`₹${report.profile.deposit_balance.toFixed(2)}`} />
              <StatTile label="Winnings" value={`₹${report.profile.winnings_balance.toFixed(2)}`} accent />
              <StatTile label="Bonus" value={`₹${report.profile.bonus_balance.toFixed(2)}`} />
            </div>

            {/* Money flow */}
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Money flow</div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatTile label="Total deposits (Razorpay)" value={`₹${report.money.total_deposits.toFixed(2)}`} />
                <StatTile label="Total withdrawn" value={`₹${report.money.total_withdrawn.toFixed(2)}`} />
                <StatTile label="All credits" value={`₹${report.money.total_credit_txn.toFixed(2)}`} />
                <StatTile label="All debits" value={`₹${Math.abs(report.money.total_debit_txn).toFixed(2)}`} />
              </div>
              {Object.keys(report.money.sum_by_type ?? {}).length > 0 && (
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
                  {Object.entries(report.money.sum_by_type as Record<string, number>).map(([k, v]) => (
                    <div key={k} className="flex justify-between rounded-md bg-secondary/40 px-2 py-1">
                      <span className="text-muted-foreground">{k}</span>
                      <span className="font-semibold tabular-nums">₹{Number(v).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Battles */}
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Battlegrounds</div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                <StatTile label="Played" value={String(report.battles.played)} />
                <StatTile label="Won" value={String(report.battles.won)} accent />
                <StatTile label="Lost" value={String(report.battles.lost)} />
                <StatTile label="Tied" value={String(report.battles.tied)} />
                <StatTile label="Win rate" value={`${report.battles.win_rate}%`} />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                <StatTile label="Stake paid" value={`₹${report.battles.stake_paid.toFixed(2)}`} />
                <StatTile label="Prize received" value={`₹${report.battles.prize_received.toFixed(2)}`} accent />
                <StatTile label="Net battle P/L" value={`₹${report.battles.net_battle.toFixed(2)}`} />
              </div>
              {Object.keys(report.battles.by_stake ?? {}).length > 0 && (
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-5">
                  {Object.entries(report.battles.by_stake as Record<string, { played: number; won: number }>).map(([k, v]) => (
                    <div key={k} className="rounded-md bg-secondary/40 px-2 py-1">
                      <div className="text-muted-foreground">{k}</div>
                      <div className="font-semibold">{v.won}/{v.played} won</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Other counts */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <StatTile label="Test attempts" value={String(report.counts.test_attempts)} />
              <StatTile label="Referrals made" value={String(report.counts.referrals_made)} />
              <StatTile label="Subscription" value={report.subscription?.status ?? "None"} />
            </div>

            {/* Recent battles table */}
            {report.recent_battles.length > 0 && (
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Recent battles</div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="text-muted-foreground">
                      <tr className="border-b border-border">
                        <th className="py-1.5 text-left">When</th>
                        <th className="text-left">Stake</th>
                        <th className="text-left">Opp</th>
                        <th className="text-right">You</th>
                        <th className="text-right">Opp</th>
                        <th className="text-right">Result</th>
                        <th className="text-right">Prize</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.recent_battles.map((b: any) => {
                        // For bot matches, winner_user_id is NULL when bot wins (bots have no user_id).
                        // Use score comparison to determine outcome instead of winner_user_id == null → tie.
                        const myScore = Number(b.score ?? 0);
                        const oppScore = b.is_bot_match ? Number(b.bot_score ?? 0) : Number(b.opp_score ?? 0);
                        const youWon = b.is_bot_match ? myScore > oppScore : !!b.you_won;
                        const isTie = b.is_bot_match
                          ? myScore === oppScore
                          : b.winner_user_id == null;
                        const youLost = !youWon && !isTie;
                        return (
                        <tr key={b.match_id} className="border-b border-border/40">
                          <td className="py-1.5">{new Date(b.created_at).toLocaleString()}</td>
                          <td>{b.stake === 0 ? "Free" : `₹${b.stake}`}</td>
                          <td>{b.is_bot_match ? `🤖 ${b.bot_name ?? "Bot"}` : "Human"}</td>
                          <td className="text-right tabular-nums">{myScore}</td>
                          <td className="text-right tabular-nums">{b.is_bot_match ? oppScore : "—"}</td>
                          <td className="text-right">
                            {b.status !== "finished" ? <Badge variant="outline">{b.status}</Badge>
                              : youWon ? <Badge className="bg-emerald-600">Won</Badge>
                              : isTie ? <Badge variant="secondary">Tie</Badge>
                              : <Badge variant="destructive">Lost</Badge>}
                          </td>
                          <td className="text-right tabular-nums">₹{Number(b.prize_amount ?? 0).toFixed(2)}</td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Recent transactions */}
            {report.recent_transactions.length > 0 && (
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Recent transactions</div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="text-muted-foreground">
                      <tr className="border-b border-border">
                        <th className="py-1.5 text-left">When</th>
                        <th className="text-left">Type</th>
                        <th className="text-left">Bucket</th>
                        <th className="text-left">Status</th>
                        <th className="text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.recent_transactions.map((t: any) => (
                        <tr key={t.id} className="border-b border-border/40">
                          <td className="py-1.5">{new Date(t.created_at).toLocaleString()}</td>
                          <td>{t.type}</td>
                          <td>{t.bucket}</td>
                          <td>{t.status}</td>
                          <td className={`text-right tabular-nums ${Number(t.amount) >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                            ₹{Number(t.amount).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StatTile({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-lg border p-3 ${accent ? "border-emerald-500/40 bg-emerald-500/10" : "border-border bg-secondary/30"}`}>
      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-base font-extrabold tabular-nums">{value}</div>
    </div>
  );
}

function TopWalletsPanel() {
  const listTop = useServerFn(adminListTopWallets);
  const [sortBy, setSortBy] = useState<"wallet_balance" | "deposit_balance" | "winnings_balance" | "bonus_balance">("wallet_balance");
  const [limit, setLimit] = useState(50);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<any[]>([]);
  const [totals, setTotals] = useState<{ wallet: number; deposit: number; winnings: number; bonus: number } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const r: any = await listTop({ data: { sortBy, limit } });
      setRows(r?.users ?? []);
      setTotals(r?.totals ?? null);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to load top wallets");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, [sortBy, limit]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><WalletIcon className="h-4 w-4" /> Top wallets</CardTitle>
        <CardDescription>Users sorted by balance. Shows deposit, winnings, and bonus breakdowns.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <Label className="text-xs">Sort by</Label>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
              <SelectTrigger className="h-8 w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="wallet_balance">Total wallet</SelectItem>
                <SelectItem value="deposit_balance">Deposit</SelectItem>
                <SelectItem value="winnings_balance">Winnings</SelectItem>
                <SelectItem value="bonus_balance">Bonus</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Limit</Label>
            <Input
              type="number"
              className="h-8 w-[100px]"
              value={limit}
              min={1}
              max={200}
              onChange={(e) => setLimit(Math.max(1, Math.min(200, Number(e.target.value) || 50)))}
            />
          </div>
          <Button size="sm" variant="outline" onClick={load} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Refresh"}
          </Button>
        </div>

        {totals ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <StatTile label="Sum wallet" value={`₹${totals.wallet.toFixed(2)}`} accent />
            <StatTile label="Sum deposit" value={`₹${totals.deposit.toFixed(2)}`} />
            <StatTile label="Sum winnings" value={`₹${totals.winnings.toFixed(2)}`} />
            <StatTile label="Sum bonus" value={`₹${totals.bonus.toFixed(2)}`} />
          </div>
        ) : null}

        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-xs">
            <thead className="bg-secondary/40 text-muted-foreground">
              <tr>
                <th className="px-2 py-2 text-left">#</th>
                <th className="px-2 py-2 text-left">User</th>
                <th className="px-2 py-2 text-right">Wallet</th>
                <th className="px-2 py-2 text-right">Deposit</th>
                <th className="px-2 py-2 text-right">Winnings</th>
                <th className="px-2 py-2 text-right">Bonus</th>
                <th className="px-2 py-2 text-right">Joined</th>
              </tr>
            </thead>
            <tbody>
              {loading && rows.length === 0 ? (
                <tr><td colSpan={7} className="py-6 text-center text-muted-foreground"><Loader2 className="mx-auto h-4 w-4 animate-spin" /></td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={7} className="py-6 text-center text-muted-foreground">No users.</td></tr>
              ) : rows.map((u, i) => (
                <tr key={u.id} className="border-t border-border/40">
                  <td className="px-2 py-2 tabular-nums text-muted-foreground">{i + 1}</td>
                  <td className="px-2 py-2">
                    <div className="font-semibold">{u.full_name ?? "—"}</div>
                    <div className="truncate text-[11px] text-muted-foreground">{u.email ?? u.id}</div>
                  </td>
                  <td className="px-2 py-2 text-right font-bold tabular-nums text-emerald-600">₹{Number(u.wallet_balance ?? 0).toFixed(2)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">₹{Number(u.deposit_balance ?? 0).toFixed(2)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">₹{Number(u.winnings_balance ?? 0).toFixed(2)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">₹{Number(u.bonus_balance ?? 0).toFixed(2)}</td>
                  <td className="px-2 py-2 text-right text-[11px] text-muted-foreground">{u.created_at ? new Date(u.created_at).toLocaleDateString() : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
