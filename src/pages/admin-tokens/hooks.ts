import api from "@/lib/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type AdminTokenInfo = {
  id: string | null;
  name: string;
  created: string | null;
  expiration: string | null;
  expired: boolean;
  scope: string[];
};

export type CreateTokenResult = AdminTokenInfo & { secretToken: string };

export type CreateTokenBody = {
  name: string;
  scope: string[];
  expiration?: string | null;
  neverExpires?: boolean;
};

export const useAdminTokens = () =>
  useQuery({
    queryKey: ["admin-tokens"],
    queryFn: () =>
      api.get<{ tokens: AdminTokenInfo[] }>("/admin-tokens", { admin: true }),
  });

export const useCurrentToken = () =>
  useQuery({
    queryKey: ["admin-tokens", "current"],
    queryFn: () => api.get<AdminTokenInfo>("/admin-tokens/current"),
    retry: false,
  });

export const useCreateToken = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateTokenBody) =>
      api.post<CreateTokenResult>("/admin-tokens", { admin: true, body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-tokens"] }),
  });
};

export const useUpdateToken = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; body: Partial<CreateTokenBody> }) =>
      api.post(`/admin-tokens/${vars.id}`, { admin: true, body: vars.body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-tokens"] }),
  });
};

export const useDeleteToken = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.delete(`/admin-tokens/${id}`, { admin: true }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-tokens"] }),
  });
};

// Expiry presets → ISO timestamp (or null for never).
export const expiryToISO = (preset: string): { expiration: string | null; neverExpires: boolean } => {
  if (preset === "never") return { expiration: null, neverExpires: true };
  const days = { "7d": 7, "30d": 30, "90d": 90 }[preset];
  if (days) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return { expiration: d.toISOString(), neverExpires: false };
  }
  // custom: preset is already an ISO date string (YYYY-MM-DD)
  return { expiration: new Date(preset).toISOString(), neverExpires: false };
};
