import api from "@/lib/api";
import { GetHealthResult } from "./types";
import { useMutation, useQuery } from "@tanstack/react-query";

type UseNodesHealthOptions = {
  enabled?: boolean;
};

export const useNodesHealth = (options?: UseNodesHealthOptions) => {
  return useQuery({
    queryKey: ["health"],
    queryFn: () =>
      api.get<GetHealthResult>("/v2/GetClusterHealth", { admin: true }),
    enabled: options?.enabled !== undefined ? options.enabled : true,
  });
};

// ----- Snapshots -----

export type SnapshotNode = {
  id: string;
  shortId: string;
  hostname?: string;
  zone?: string;
  isUp: boolean;
};

export type SnapshotResult = {
  requestedNode: string;
  triggered: string[];
  failed: Record<string, unknown>;
  raw?: unknown;
};

type UseSnapshotNodesOptions = {
  enabled?: boolean;
};

export const useSnapshotNodes = (options?: UseSnapshotNodesOptions) =>
  useQuery({
    queryKey: ["snapshot-nodes"],
    queryFn: () =>
      api.get<{ nodes: SnapshotNode[] }>("/snapshot/nodes", { admin: true }),
    enabled: options?.enabled !== undefined ? options.enabled : true,
    staleTime: 30_000,
  });

export const useTriggerSnapshot = () =>
  useMutation({
    mutationFn: (vars: { node?: string } = {}) =>
      api.post<SnapshotResult>("/snapshot", {
        admin: true,
        params: { node: vars.node || "*" },
      }),
  });
