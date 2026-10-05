import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Lock, Crown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAccess } from "@/hooks/use-access";
import { FEATURE_LABELS_UI } from "@/lib/access-shared";

export function FeatureLock({ feature, children }: { feature: string; children: ReactNode }) {
  const { hasFeature, loading, trialActive } = useAccess();
  if (loading) {
    return (
      <div className="mx-auto max-w-2xl space-y-3 p-6">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }
  if (hasFeature(feature)) return <>{children}</>;
  const label = FEATURE_LABELS_UI[feature] ?? feature;
  return (
    <div className="mx-auto max-w-md p-6">
      <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-fuchsia-500/5">
        <CardContent className="space-y-4 p-6 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-primary to-fuchsia-500 text-white shadow-lg">
            <Lock className="h-8 w-8" />
          </div>
          <div>
            <h2 className="text-lg font-bold">{label} is locked</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {trialActive
                ? "This feature isn't part of your trial. Purchase a batch to unlock it."
                : "Your trial has ended. Purchase a batch to continue using NEET Track."}
            </p>
          </div>
          <Button asChild className="w-full bg-gradient-to-r from-primary to-fuchsia-500 text-white">
            <Link to="/premium">
              <Crown className="mr-2 h-4 w-4" />
              Unlock with a batch
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export function locked<P extends object>(feature: string, Component: React.ComponentType<P>) {
  return function LockedComponent(props: P) {
    return (
      <FeatureLock feature={feature}>
        <Component {...props} />
      </FeatureLock>
    );
  };
}
