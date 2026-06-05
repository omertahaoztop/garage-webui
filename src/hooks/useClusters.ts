import api from "@/lib/api";
import clusterStore from "@/stores/cluster-store";
import type {
  ClusterPublic,
  ClustersResponse,
  ClusterTestResult,
} from "@/types/garage";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";

/**
 * Lists all configured clusters from the backend. Refresh interval is
 * deliberately short (30 s) so newly-added clusters surface quickly during
 * development, but cached so navigation doesn't refetch on every page.
 */
export const useClusters = () => {
  return useQuery<ClustersResponse>({
    queryKey: ["clusters"],
    queryFn: () => api.get<ClustersResponse>("/clusters"),
    staleTime: 30_000,
    retry: false,
  });
};

/**
 * Resolves the active cluster:
 *   1. Persisted `activeId` from localStorage (if still present in the list).
 *   2. Backend `defaultId` (falls back automatically when stale id is dropped).
 *   3. First cluster in the list (last-resort safety net).
 *
 * Side effect: when persisted id is stale we self-heal by writing the
 * resolved id back into the store; this keeps subsequent requests stable
 * even after a cluster is removed from the registry.
 */
export const useActiveCluster = () => {
  const { data, isLoading, error, refetch } = useClusters();
  const persistedId = clusterStore.useStore((s) => s.activeId);

  const { active, fallbackUsed } = useMemo(() => {
    const list = data?.clusters ?? [];
    if (list.length === 0) {
      return { active: undefined as ClusterPublic | undefined, fallbackUsed: false };
    }

    const byId = (id: string) => list.find((c) => c.id === id);
    const persistedHit = persistedId ? byId(persistedId) : undefined;
    if (persistedHit) {
      return { active: persistedHit, fallbackUsed: false };
    }

    const defaultHit = data?.defaultId ? byId(data.defaultId) : undefined;
    return {
      active: defaultHit ?? list[0],
      fallbackUsed: !!persistedId, // had a stale id we ignored
    };
  }, [data, persistedId]);

  useEffect(() => {
    // Self-heal stale persisted id to whatever we actually picked.
    if (fallbackUsed && active && active.id !== persistedId) {
      clusterStore.setActiveId(active.id);
    }
  }, [fallbackUsed, active, persistedId]);

  const setActiveId = (id: string) => {
    clusterStore.setActiveId(id);
    // No need to refetch the cluster list, just bust API caches by toggling
    // queries; consumers (buckets, browse, config) are keyed on ["xxx"]
    // without cluster id so they'll automatically refetch on next mount.
  };

  return {
    isLoading,
    error,
    refetch,
    clusters: data?.clusters ?? [],
    defaultId: data?.defaultId,
    active,
    setActiveId,
  };
};

/**
 * One-shot health probe for a given cluster id. Useful for the switcher
 * dropdown badge. Refetches every 30 s while mounted.
 */
export const useClusterHealth = (id: string | undefined, enabled = true) => {
  return useQuery<ClusterTestResult>({
    queryKey: ["cluster-test", id],
    queryFn: () => api.get<ClusterTestResult>(`/clusters/${id}/test`),
    enabled: !!id && enabled,
    refetchInterval: 30_000,
    retry: false,
  });
};
