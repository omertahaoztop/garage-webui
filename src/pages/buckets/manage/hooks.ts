import api, { APIError } from "@/lib/api";
import {
  MutationOptions,
  useMutation,
  UseMutationOptions,
  useQuery,
} from "@tanstack/react-query";
import { Bucket, GetBucketRes, Permissions } from "../types";
import { useAuth } from "@/hooks/useAuth";

export const useBucket = (id?: string | null) => {
  const { isAdmin } = useAuth();

  return useQuery({
    queryKey: ["bucket", id, isAdmin],
    queryFn: async () => {
      if (!id) {
        throw new APIError("Bucket id is required", 400);
      }

      if (isAdmin) {
        return api.get<Bucket>("/v2/GetBucketInfo", {
          params: { id },
          admin: true,
        });
      }

      const buckets = await api.get<GetBucketRes>("/buckets");
      const bucket = buckets.find((item) => item.id === id);

      if (!bucket) {
        throw new APIError("Bucket not found", 404);
      }

      return bucket;
    },
    enabled: !!id,
  });
};

export const useUpdateBucket = (id?: string | null) => {
  return useMutation({
    mutationFn: (values: any) => {
      return api.post<any>("/v2/UpdateBucket", {
        params: { id },
        body: values,
        admin: true,
      });
    },
  });
};

export const useAddAlias = (
  bucketId?: string | null,
  options?: UseMutationOptions<any, Error, string>
) => {
  return useMutation({
    mutationFn: (alias: string) => {
      return api.post("/v2/AddBucketAlias", {
        body: { bucketId, globalAlias: alias },
        admin: true,
      });
    },
    ...options,
  });
};

export const useRemoveAlias = (
  bucketId?: string | null,
  options?: UseMutationOptions<any, Error, string>
) => {
  return useMutation({
    mutationFn: (alias: string) => {
      return api.post("/v2/RemoveBucketAlias", {
        body: { bucketId, globalAlias: alias },
        admin: true,
      });
    },
    ...options,
  });
};

export const useAllowKey = (
  bucketId?: string | null,
  options?: MutationOptions<
    any,
    Error,
    { keyId: string; permissions: Permissions }[]
  >
) => {
  return useMutation({
    mutationFn: async (payload) => {
      const promises = payload.map(async (key) => {
        return api.post("/v2/AllowBucketKey", {
          body: {
            bucketId,
            accessKeyId: key.keyId,
            permissions: key.permissions,
          },
          admin: true,
        });
      });
      const result = await Promise.all(promises);
      return result;
    },
    ...options,
  });
};

export const useDenyKey = (
  bucketId?: string | null,
  options?: MutationOptions<
    any,
    Error,
    { keyId: string; permissions: Permissions }
  >
) => {
  return useMutation({
    mutationFn: (payload) => {
      return api.post("/v2/DenyBucketKey", {
        body: {
          bucketId,
          accessKeyId: payload.keyId,
          permissions: payload.permissions,
        },
        admin: true,
      });
    },
    ...options,
  });
};

export const useRemoveBucket = (
  options?: MutationOptions<any, Error, string>
) => {
  return useMutation({
    mutationFn: (id) => api.post("/v2/DeleteBucket", { params: { id }, admin: true }),
    ...options,
  });
};
