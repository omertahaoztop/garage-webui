import api from "@/lib/api";
import { useMutation, useQuery } from "@tanstack/react-query";

export type MultiResponse<T> = {
  success: Record<string, T>;
  error: Record<string, string>;
};

export type WorkerInfo = {
  id: number;
  name: string;
  state: unknown;
  errors: number;
  consecutiveErrors: number;
  persistentErrors: number | null;
  lastError: unknown;
  tranquility: number | null;
  progress: string | null;
  queueLength: number | null;
  freeform: string[];
};

type WorkerFilter = {
  busyOnly?: boolean;
  errorOnly?: boolean;
};

export const useWorkers = (node = "*", filter: WorkerFilter = {}) =>
  useQuery({
    queryKey: ["workers", node, filter],
    queryFn: () =>
      api.post<MultiResponse<WorkerInfo[]>>("/workers", {
        admin: true,
        params: { node },
        body: filter,
      }),
    refetchInterval: 5000,
  });

export const useSetWorkerVariable = () =>
  useMutation({
    mutationFn: (vars: { node?: string; variable: string; value: string }) =>
      api.post("/workers/variable/set", {
        admin: true,
        params: { node: vars.node || "*" },
        body: { variable: vars.variable, value: vars.value },
      }),
  });

export const useGetWorkerVariable = () =>
  useMutation({
    mutationFn: (vars: { node?: string; variable?: string }) =>
      api.post<MultiResponse<Record<string, string>>>("/workers/variable/get", {
        admin: true,
        params: { node: vars.node || "*" },
        body: { variable: vars.variable ?? null },
      }),
  });

// Common worker tuning variables (preset list for the UI).
export const WORKER_VARIABLE_PRESETS = [
  "resync-tranquility",
  "resync-worker-count",
  "scrub-tranquility",
];
