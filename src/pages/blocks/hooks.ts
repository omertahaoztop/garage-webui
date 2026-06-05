import api from "@/lib/api";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { MultiResponse } from "../workers/hooks";

export type BlockError = {
  blockHash: string;
  refcount: number;
  errorCount: number;
  lastTrySecsAgo: number;
  nextTryInSecs: number;
};

export type BlockVersion = {
  versionId: string;
  refDeleted: boolean;
  versionDeleted: boolean;
  garbageCollected: boolean;
  backlink: unknown;
};

export type BlockInfo = {
  blockHash: string;
  refcount: number;
  versions: BlockVersion[];
};

export const useBlockErrors = (node = "*") =>
  useQuery({
    queryKey: ["block-errors", node],
    queryFn: () =>
      api.get<MultiResponse<BlockError[]>>("/blocks/errors", {
        admin: true,
        params: { node },
      }),
    refetchInterval: 10000,
  });

export const useBlockInfo = () =>
  useMutation({
    mutationFn: (vars: { node?: string; blockHash: string }) =>
      api.post<MultiResponse<BlockInfo>>("/blocks/info", {
        admin: true,
        params: { node: vars.node || "*" },
        body: { blockHash: vars.blockHash },
      }),
  });

export const useRetryBlockResync = () =>
  useMutation({
    mutationFn: (vars: { node?: string; all?: boolean; blockHashes?: string[] }) =>
      api.post("/blocks/retry", {
        admin: true,
        params: { node: vars.node || "*" },
        body: vars.all ? { all: true } : { blockHashes: vars.blockHashes ?? [] },
      }),
  });

export const usePurgeBlocks = () =>
  useMutation({
    mutationFn: (vars: { node?: string; blockHashes: string[] }) =>
      api.post("/blocks/purge", {
        admin: true,
        params: { node: vars.node || "*" },
        body: vars.blockHashes,
      }),
  });
