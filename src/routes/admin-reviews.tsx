import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { ChevronLeft } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { ReviewsPanel } from "@/components/admin/reviews-panel";

export const Route = createFileRoute("/admin-reviews")({
  head: () => ({ meta: [{ title: "Admin · Student reviews — NEET Track" }] }),
  component: AdminReviews,
});

function AdminReviews() {
  const { user, isAdmin, loading } = useAuth();
  const nav = useNavigate();
  useEffect(() => {
    if (loading) return;
    if (!user) nav({ to: "/login" });
    else if (!isAdmin) nav({ to: "/dashboard" });
  }, [user, isAdmin, loading, nav]);

  return (
    <PageShell>
      <Button asChild variant="ghost" size="sm" className="mb-3">
        <Link to="/admin"><ChevronLeft className="mr-1 h-4 w-4" /> Admin panel</Link>
      </Button>
      <ReviewsPanel />
    </PageShell>
  );
}
