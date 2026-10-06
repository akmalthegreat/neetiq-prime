import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyAccess, type MyAccess } from "@/lib/access.functions";
import { useAuth } from "@/hooks/use-auth";

export function useAccess() {
  const { user } = useAuth();
  const fn = useServerFn(getMyAccess);
  const q = useQuery<MyAccess>({
    queryKey: ["my-access", user?.id ?? "anon"],
    queryFn: () => fn(),
    enabled: !!user,
    staleTime: 60_000,
  });
  const access = q.data;
  const hasFeature = (key: string) => {
    if (!access) return false;
    if (access.isAdmin) return true;
    return access.features?.includes("*") || access.features?.includes(key) || false;
  };
  return {
    access,
    loading: q.isLoading,
    hasFeature,
    trialActive: !!access?.trialActive,
    trialExpiresAt: access?.trialExpiresAt ?? null,
    subscriptionActive: !!access?.subscriptionActive,
    tier: access?.tier ?? "none",
    refetch: q.refetch,
  };
}
