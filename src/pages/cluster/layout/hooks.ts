import api from "@/lib/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type LayoutNodeRole = {
  id: string;
  zone: string;
  capacity: number | null;
  usableCapacity: number | null;
  storedPartitions: number | null;
  tags: string[];
};

export type ZoneRedundancy = "maximum" | { atLeast: number };

export type LayoutParameters = {
  zoneRedundancy: ZoneRedundancy;
};

export type NodeRoleChange =
  | { id: string; remove: true }
  | {
      id: string;
      zone: string;
      capacity: number | null;
      tags: string[];
    };

export type ClusterLayout = {
  version: number;
  roles: LayoutNodeRole[];
  partitionSize: number;
  parameters: LayoutParameters;
  stagedRoleChanges: NodeRoleChange[];
  stagedParameters: LayoutParameters | null;
};

export type ComputationStat = {
  replicationFactor: number;
  partitionSize: number;
  previousPartitionSize: number | null;
  effectiveCapacity: number;
  effectiveZoneRedundancy: number;
  totalCapacity: number;
  usableCapacity: number;
  totalMovedPartitions: number | null;
  lowPartitionSize: boolean;
  lowUsableCapacity: boolean;
};

export type PreviewResult =
  | { error: string }
  | {
      message: string[];
      newLayout: ClusterLayout;
      statistics: ComputationStat | null;
    };

export type LayoutHistoryVersion = {
  version: number;
  status: string;
  storageNodes: number;
  gatewayNodes: number;
};

export type LayoutHistory = {
  currentVersion: number;
  minAck: number;
  versions: LayoutHistoryVersion[];
  updateTrackers: unknown;
};

export const useClusterLayout = () =>
  useQuery({
    queryKey: ["layout"],
    queryFn: () => api.get<ClusterLayout>("/layout", { admin: true }),
  });

export const useLayoutHistory = () =>
  useQuery({
    queryKey: ["layout-history"],
    queryFn: () => api.get<LayoutHistory>("/layout/history", { admin: true }),
  });

type UpdateLayoutBody = {
  roles?: NodeRoleChange[];
  parameters?: LayoutParameters | null;
};

export const useStageLayout = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateLayoutBody) =>
      api.post<ClusterLayout>("/layout", { admin: true, body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["layout"] });
    },
  });
};

export const usePreviewLayout = () =>
  useMutation({
    mutationFn: () =>
      api.post<PreviewResult>("/layout/preview", { admin: true }),
  });

export const useApplyLayout = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (version: number) =>
      api.post("/layout/apply", { admin: true, body: { version } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["layout"] });
      qc.invalidateQueries({ queryKey: ["layout-history"] });
    },
  });
};

export const useRevertLayout = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post("/layout/revert", { admin: true }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["layout"] });
    },
  });
};

export type SkipDeadNodesResult = {
  ackUpdated: string[];
  syncUpdated: string[];
};

export const useSkipDeadNodes = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { version: number; allowMissingData: boolean }) =>
      api.post<SkipDeadNodesResult>("/layout/skip-dead-nodes", {
        admin: true,
        body: vars,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["layout"] });
      qc.invalidateQueries({ queryKey: ["layout-history"] });
    },
  });
};
