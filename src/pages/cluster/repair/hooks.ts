import api from "@/lib/api";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { MultiResponse } from "../../workers/hooks";

export type RepairTypes = {
  types: string[];
  hasScrub: boolean;
};

export const useRepairTypes = () =>
  useQuery({
    queryKey: ["repair-types"],
    queryFn: () => api.get<RepairTypes>("/repair/types", { admin: true }),
    staleTime: Infinity,
  });

export const useLaunchRepair = () =>
  useMutation({
    mutationFn: (vars: { node?: string; repairType: unknown }) =>
      api.post<MultiResponse<unknown>>("/repair", {
        admin: true,
        params: { node: vars.node || "*" },
        body: { repairType: vars.repairType },
      }),
  });
