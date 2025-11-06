import api from "@/lib/api";
import {
  useMutation,
  UseMutationOptions,
  useQuery,
} from "@tanstack/react-query";
import { Key } from "./types";
import { CreateKeySchema } from "./schema";

export const useKeys = () => {
  return useQuery({
    queryKey: ["keys"],
    queryFn: () => api.get<Key[]>("/v2/ListKeys", { admin: true }),
  });
};

export const useCreateKey = (
  options?: UseMutationOptions<any, Error, CreateKeySchema>
) => {
  return useMutation({
    mutationFn: async (body) => {
      if (body.isImport) {
        return api.post("/v2/ImportKey", { body, admin: true });
      }
      return api.post("/v2/CreateKey", { body, admin: true });
    },
    ...options,
  });
};

export const useRemoveKey = (
  options?: UseMutationOptions<any, Error, string>
) => {
  return useMutation({
    mutationFn: (id) => api.post("/v2/DeleteKey", { params: { id }, admin: true }),
    ...options,
  });
};
