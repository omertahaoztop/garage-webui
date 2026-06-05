import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { loginSchema } from "./schema";
import api from "@/lib/api";
import { toast } from "sonner";

export const useLogin = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: z.infer<typeof loginSchema>) => {
      return api.post("/auth/login", { body });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auth"] });
    },
    onError: (err) => {
      toast.error(err?.message || "Unknown error");
    },
  });
};

export type OIDCStatus = {
  enabled: boolean;
  issuer?: string;
};

export const useOIDCStatus = () =>
  useQuery({
    queryKey: ["oidc-status"],
    queryFn: () => api.get<OIDCStatus>("/auth/oidc/status"),
    staleTime: Infinity,
    retry: false,
  });
