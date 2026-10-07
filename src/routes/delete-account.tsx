import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { deleteMyAccount } from "@/lib/delete-account.functions";

export const Route = createFileRoute("/delete-account")({
  head: () => ({
    meta: [
      { title: "Delete your account — NEET Track" },
      { name: "description", content: "How to permanently delete your NEET Track account and the data linked to it." },
    ],
  }),
  component: DeleteAccountPage,
});

function DeleteAccountPage() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const del = useServerFn(deleteMyAccount);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const onDelete = async () => {
    if (text !== "DELETE") return;
    setBusy(true);
    try {
      const res = await del({ data: { confirm: "DELETE" } });
      if (!res.ok) {
        toast.error(res.message, { duration: 10000 });
        return;
      }
      await supabase.auth.signOut();
      toast.success("Your account has been deleted.");
      nav({ to: "/" });
    } catch (e: any) {
      toast.error(e?.message || "Could not delete your account. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageShell eyebrow="Account" title="Delete your account" description="Request deletion of your NEET Track account and data" showFooter>
      <div className="prose prose-sm dark:prose-invert mx-auto max-w-3xl text-foreground">
        <h2>What gets deleted</h2>
        <ul>
          <li>Your account, login and profile (name, email, phone, photo).</li>
          <li>Your study progress, quiz and test attempts, bookmarks, streaks, XP and leaderboard entries.</li>
          <li>Your support and feedback messages linked to your account.</li>
        </ul>
        <h2>What we may keep</h2>
        <p>
          Payment and wallet transaction records (order id, status, amount, date) may be kept for the period
          required by tax and financial regulations. They are no longer linked to a usable account.
        </p>
        <p>Deletion is permanent and cannot be undone. Wallet money must be withdrawn before deleting.</p>
      </div>

      <div className="mx-auto mt-6 max-w-3xl">
        <Card className="border-destructive/40">
          <CardContent className="space-y-4 p-5">
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
              </div>
            ) : user ? (
              <>
                <p className="text-sm">
                  You are signed in as <strong>{user.email}</strong>. To confirm, type <strong>DELETE</strong> below.
                </p>
                <div>
                  <Label htmlFor="confirm">Type DELETE to confirm</Label>
                  <Input id="confirm" value={text} onChange={(e) => setText(e.target.value)} autoComplete="off" />
                </div>
                <Button variant="destructive" className="gap-2" disabled={text !== "DELETE" || busy} onClick={onDelete}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  Delete my account permanently
                </Button>
              </>
            ) : (
              <>
                <p className="text-sm">
                  To delete your account, please <Link to="/login" className="font-semibold underline">sign in</Link> and
                  come back to this page. If you can't sign in, email{" "}
                  <a className="font-semibold underline" href="mailto:support@neetiq.app?subject=Delete%20my%20NEET%20Track%20account">support@neetiq.app</a>{" "}
                  from the email address you registered with, and we will delete your account.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
