import { Link } from "@tanstack/react-router";
import { Clock, Crown, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAccess } from "@/hooks/use-access";

export function TrialBanner() {
  const { access, loading } = useAccess();
  if (loading || !access) return null;
  if (access.subscriptionActive) return null;

  if (access.trialActive && access.trialExpiresAt) {
    const ms = new Date(access.trialExpiresAt).getTime() - Date.now();
    const hrs = Math.max(0, Math.ceil(ms / 3_600_000));
    return (
      <div className="mb-4 rounded-2xl border border-amber-300/50 bg-gradient-to-r from-amber-400/15 to-orange-400/15 p-4 shadow-soft">
        <div className="flex items-start gap-3">
          <Clock className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold text-amber-900 dark:text-amber-200">
              You're on Trial — {hrs}h left
            </div>
            <div className="text-xs text-amber-800/80 dark:text-amber-200/80">
              Upgrade to keep learning after your trial ends.
            </div>
          </div>
          <Button asChild size="sm" className="bg-amber-600 text-white hover:bg-amber-700">
            <Link to="/premium">
              <Crown className="mr-1 h-4 w-4" /> Upgrade
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-4 rounded-2xl border border-rose-300/50 bg-gradient-to-r from-rose-500/15 to-red-500/15 p-4 shadow-soft">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold text-rose-900 dark:text-rose-200">
            Trial ended
          </div>
          <div className="text-xs text-rose-800/80 dark:text-rose-200/80">
            Purchase a batch to continue using NEET Track.
          </div>
        </div>
        <Button asChild size="sm" className="bg-rose-600 text-white hover:bg-rose-700">
          <Link to="/premium">
            <Crown className="mr-1 h-4 w-4" /> Buy batch
          </Link>
        </Button>
      </div>
    </div>
  );
}
