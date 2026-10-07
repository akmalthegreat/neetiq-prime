import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { DrAzkaLoader } from "@/components/dr-akza-loader";
import { PageShell } from "@/components/page-shell";
import { TrialBanner } from "@/components/dashboard/trial-banner";
import { HomeDashboard } from "@/components/home/home-dashboard";
import { LegacyDashboard } from "@/components/dashboard/legacy-dashboard";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/dashboard")({
  validateSearch: (s: Record<string, unknown>): { legacy?: 1 } => (s.legacy ? { legacy: 1 } : {}),
  head: () => ({
    meta: [{ title: "Dashboard — NEET Track" }],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Poppins:wght@500;600;700;800&family=Manrope:wght@400;500;600;700;800&display=swap" },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const { legacy } = Route.useSearch();
  const { user, loading, refresh } = useAuth();
  const nav = useNavigate();

  useEffect(() => { if (!loading && !user) nav({ to: "/login" }); }, [user, loading, nav]);
  useEffect(() => { if (user) refresh(); }, [user?.id]);

  // Fallback to the previous design: /dashboard?legacy=1
  if (legacy) return <LegacyDashboard />;

  if (loading || !user) {
    return (
      <DrAzkaLoader
        fullScreen
        message="Dr. Azka is preparing your dashboard..."
        subMessage="Syncing your NEET goals, streaks & high-yield progress"
      />
    );
  }

  return (
    <PageShell>
      <HomeDashboard top={<TrialBanner />} />
    </PageShell>
  );
}
