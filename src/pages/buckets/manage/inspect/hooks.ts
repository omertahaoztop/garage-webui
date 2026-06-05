import api from "@/lib/api";
import { useMutation } from "@tanstack/react-query";

export type InspectBlock = {
  partNumber: number;
  offset: number;
  hash: string;
  size: number;
};

export type InspectVersion = {
  uuid: string;
  timestamp: string;
  encrypted: boolean;
  uploading: boolean;
  aborted: boolean;
  deleteMarker: boolean;
  inline: boolean;
  size: number | null;
  etag: string | null;
  headers: [string, string][];
  blocks: InspectBlock[];
};

export type InspectResult = {
  bucketId: string;
  key: string;
  versions: InspectVersion[];
};

export const useInspectObject = () =>
  useMutation({
    mutationFn: (vars: { bucket: string; key: string }) =>
      api.get<InspectResult>("/inspect/object", {
        params: { bucket: vars.bucket, key: vars.key },
      }),
  });
