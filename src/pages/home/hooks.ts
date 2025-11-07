import api from "@/lib/api";
import { GetHealthResult } from "./types";
import { useQuery } from "@tanstack/react-query";

type UseNodesHealthOptions = {
  enabled?: boolean;
};

export const useNodesHealth = (options?: UseNodesHealthOptions) => {
  return useQuery({
    queryKey: ["health"],
    queryFn: () => api.get<GetHealthResult>("/v2/GetClusterHealth", { admin: true }),
    enabled: options?.enabled !== undefined ? options.enabled : true,
  });
};
