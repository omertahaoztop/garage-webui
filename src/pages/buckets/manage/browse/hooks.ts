import api, { API_URL } from "@/lib/api";
import clusterStore from "@/stores/cluster-store";
import {
  useInfiniteQuery,
  useMutation,
  UseMutationOptions,
  useQuery,
} from "@tanstack/react-query";
import {
  BulkDeleteResult,
  CopyObjectPayload,
  CopyObjectResult,
  CreateSharePayload,
  CreateShareResult,
  GetObjectsResult,
  MultipartCompleteResult,
  MultipartInitResult,
  MultipartUploadPart,
  MultipartUploadPartResult,
  ObjectMetadata,
  PresignResult,
  PutObjectPayload,
  UseBrowserObjectOptions,
} from "./types";

// Files >= MULTIPART_THRESHOLD switch from a single PUT to the multipart
// orchestration. 32 MiB is the smallest payload at which the network
// round-trip cost of init/complete becomes negligible.
const MULTIPART_THRESHOLD = 32 * 1024 * 1024;

// MULTIPART_PART_CONCURRENCY caps how many parts of a single file upload
// in parallel. Increases throughput on fast links without saturating the
// MAX_PARALLEL=3 file-level pool.
const MULTIPART_PART_CONCURRENCY = 4;

/**
 * uploadWithProgress streams a single file via XMLHttpRequest so the caller
 * receives real upload progress events. `fetch` cannot do this (no upload-side
 * progress API), so we keep this as a dedicated helper alongside the
 * fetch-based `api` wrapper. AbortSignal aborts the XHR mid-stream.
 *
 * Returns the parsed JSON body on 2xx, rejects on network/HTTP errors.
 */
export const uploadWithProgress = (opts: {
  bucket: string;
  key: string;
  file: File;
  onProgress?: (progress: number) => void;
  signal?: AbortSignal;
}): Promise<unknown> =>
  new Promise((resolve, reject) => {
    const fd = new FormData();
    fd.append("file", opts.file);

    const xhr = new XMLHttpRequest();
    xhr.open("PUT", `${API_URL}/browse/${opts.bucket}/${opts.key}`);
    xhr.withCredentials = true;

    // Forward the active cluster header so multi-cluster mode routes correctly.
    const clusterId = clusterStore.getActiveId();
    if (clusterId) xhr.setRequestHeader("X-Cluster-Id", clusterId);

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable && opts.onProgress) {
        opts.onProgress(e.loaded / e.total);
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(xhr.responseText ? JSON.parse(xhr.responseText) : {});
        } catch {
          resolve({});
        }
      } else {
        // The backend's error envelope is `{ message: string }`.
        let message = `HTTP ${xhr.status}`;
        try {
          const body = JSON.parse(xhr.responseText);
          if (body?.message) message = body.message;
        } catch {
          /* leave default */
        }
        reject(new Error(message));
      }
    });

    xhr.addEventListener("error", () => reject(new Error("Network error")));
    xhr.addEventListener("abort", () => reject(new Error("Aborted")));

    if (opts.signal) {
      if (opts.signal.aborted) {
        xhr.abort();
        return;
      }
      opts.signal.addEventListener("abort", () => xhr.abort());
    }

    xhr.send(fd);
  });

/**
 * uploadMultipart orchestrates the init → uploadPart × N → complete sequence
 * for large files. The backend hides actual S3 multipart calls; we just
 * sequence the HTTP requests and assemble the part-etag list for Complete.
 *
 *   POST /multipart/init                              → { uploadId, partSize }
 *   PUT  /multipart/{uploadId}/part/{N}?key=K        → { partNumber, etag }   (concurrent xN)
 *   POST /multipart/{uploadId}/complete              → { key, etag }
 *
 * On signal.abort or any part failure, DELETE /multipart/{uploadId}?key=K
 * is best-effort-fired so the source S3 doesn't accumulate orphan parts.
 */
export const uploadMultipart = async (opts: {
  bucket: string;
  key: string;
  file: File;
  onProgress?: (progress: number) => void;
  signal?: AbortSignal;
  concurrency?: number;
}): Promise<{ key: string; etag: string }> => {
  const concurrency = opts.concurrency ?? MULTIPART_PART_CONCURRENCY;

  const init = await api.post<MultipartInitResult>(
    `/browse/${opts.bucket}/multipart/init`,
    { body: { key: opts.key, contentType: opts.file.type || undefined } }
  );

  const totalSize = opts.file.size;
  const partSize = init.partSize || 8 * 1024 * 1024;
  const numParts = Math.max(1, Math.ceil(totalSize / partSize));

  // Running per-part progress so the overall % rises smoothly as parts upload
  // in parallel (not just step-jumps when each completes).
  const bytesPerPart: number[] = new Array(numParts).fill(0);
  const completed: MultipartUploadPart[] = [];

  const tickProgress = () => {
    if (!opts.onProgress) return;
    const total = bytesPerPart.reduce((a, b) => a + b, 0);
    opts.onProgress(Math.min(1, total / totalSize));
  };

  const uploadOnePart = (partNumber: number): Promise<void> => {
    const start = (partNumber - 1) * partSize;
    const end = Math.min(start + partSize, totalSize);
    const chunk = opts.file.slice(start, end);
    const partLen = end - start;

    return new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const clusterId = clusterStore.getActiveId();
      const url = `${API_URL}/browse/${opts.bucket}/multipart/${init.uploadId}/part/${partNumber}?key=${encodeURIComponent(opts.key)}`;
      xhr.open("PUT", url);
      xhr.withCredentials = true;
      if (clusterId) xhr.setRequestHeader("X-Cluster-Id", clusterId);

      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) {
          bytesPerPart[partNumber - 1] = e.loaded;
          tickProgress();
        }
      });
      xhr.addEventListener("load", () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const body = JSON.parse(
              xhr.responseText
            ) as MultipartUploadPartResult;
            completed.push({ partNumber: body.partNumber, etag: body.etag });
            bytesPerPart[partNumber - 1] = partLen;
            tickProgress();
            resolve();
          } catch {
            reject(new Error("Failed to parse upload-part response"));
          }
        } else {
          let msg = `HTTP ${xhr.status}`;
          try {
            msg = JSON.parse(xhr.responseText).message || msg;
          } catch {
            /* default */
          }
          reject(new Error(`Part ${partNumber}: ${msg}`));
        }
      });
      xhr.addEventListener("error", () =>
        reject(new Error(`Network error on part ${partNumber}`))
      );
      xhr.addEventListener("abort", () =>
        reject(new Error(`Aborted on part ${partNumber}`))
      );

      if (opts.signal) {
        if (opts.signal.aborted) {
          xhr.abort();
          return;
        }
        opts.signal.addEventListener("abort", () => xhr.abort());
      }

      xhr.send(chunk);
    });
  };

  // Worker-pool concurrency. Each worker pulls the next part number and
  // uploads it; we cap at min(concurrency, numParts) workers so single-part
  // files don't spawn idle promises.
  let nextPart = 1;
  const worker = async () => {
    while (nextPart <= numParts) {
      const partNumber = nextPart++;
      if (opts.signal?.aborted) throw new Error("Aborted");
      await uploadOnePart(partNumber);
    }
  };

  try {
    await Promise.all(
      Array.from({ length: Math.min(concurrency, numParts) }, () => worker())
    );
  } catch (err) {
    // Best-effort cleanup: tell the server to abort the S3 multipart so
    // dangling parts don't accumulate. Swallow errors — the upload already
    // failed and we want the original error to surface.
    try {
      await api.delete(
        `/browse/${opts.bucket}/multipart/${init.uploadId}`,
        { params: { key: opts.key } }
      );
    } catch {
      /* ignore */
    }
    throw err;
  }

  // S3 requires Parts in ascending PartNumber order.
  completed.sort((a, b) => a.partNumber - b.partNumber);

  const complete = await api.post<MultipartCompleteResult>(
    `/browse/${opts.bucket}/multipart/${init.uploadId}/complete`,
    { body: { key: opts.key, parts: completed } }
  );

  return { key: complete.key, etag: complete.etag };
};

/**
 * uploadAuto picks the right strategy based on file size: large files go
 * through uploadMultipart (chunked, resumable in principle), small files
 * use the single-PUT uploadWithProgress. Both producers (Actions toolbar
 * + UploadZone drag-drop) go through this so the threshold stays in one
 * place.
 */
export const uploadAuto = async (opts: {
  bucket: string;
  key: string;
  file: File;
  onProgress?: (progress: number) => void;
  signal?: AbortSignal;
}): Promise<void> => {
  if (opts.file.size > MULTIPART_THRESHOLD) {
    await uploadMultipart(opts);
  } else {
    await uploadWithProgress(opts);
  }
};

// PAGE_LIMIT controls how many keys/prefixes the server returns per request.
// 500 keeps the JSON payload <100KB on average while still giving react-window
// enough rows to fill a typical viewport without an immediate second fetch.
const PAGE_LIMIT = 500;

/**
 * useInfiniteBrowseObjects is the PRIMARY listing hook. It pages through
 * `/browse/{bucket}` using the backend's continuation-token pagination so the
 * UI can virtualize 10k+ object listings without a single huge response.
 *
 * The flat list of `.pages[*].objects` is intentionally NOT merged here —
 * callers (object-list.tsx) flatten and de-dupe prefixes themselves so they
 * keep control over ordering and the prefix/object split.
 */
export const useInfiniteBrowseObjects = (
  bucket: string,
  prefix: string = ""
) => {
  return useInfiniteQuery({
    queryKey: ["browse", bucket, prefix],
    queryFn: ({ pageParam }) =>
      api.get<GetObjectsResult>(`/browse/${bucket}`, {
        params: {
          prefix,
          limit: PAGE_LIMIT,
          // Only include `next` when there's a real token. Passing undefined
          // here used to serialize as the literal "undefined" string before the
          // api.ts defensive guard landed; conditional spread keeps the URL
          // clean regardless.
          ...(pageParam ? { next: pageParam } : {}),
        },
      }),
    getNextPageParam: (last) => last.nextToken || undefined,
    initialPageParam: "" as string,
    staleTime: 10_000,
  });
};

// Legacy single-page hook. Kept so any existing callers continue to compile;
// new code should use useInfiniteBrowseObjects above.
export const useBrowseObjects = (
  bucket: string,
  options?: UseBrowserObjectOptions
) => {
  return useQuery({
    queryKey: ["browse", bucket, options],
    queryFn: () =>
      api.get<GetObjectsResult>(`/browse/${bucket}`, { params: options }),
  });
};

export const usePutObject = (
  bucket: string,
  options?: UseMutationOptions<any, Error, PutObjectPayload>
) => {
  return useMutation({
    mutationFn: async (body) => {
      const formData = new FormData();
      if (body.file) {
        formData.append("file", body.file);
      }
      return api.put(`/browse/${bucket}/${body.key}`, { body: formData });
    },
    ...options,
  });
};

export const useDeleteObject = (
  bucket: string,
  options?: UseMutationOptions<any, Error, { key: string; recursive?: boolean }>
) => {
  return useMutation({
    mutationFn: (data) =>
      api.delete(`/browse/${bucket}/${data.key}`, {
        params: { recursive: data.recursive },
      }),
    ...options,
  });
};

/**
 * useBulkDelete posts a JSON body {"keys": string[]} to
 * POST /browse/{bucket}/bulk-delete which the backend chunks into 1000-key
 * batches and forwards to S3 DeleteObjects. Partial failures come back in
 * `result.errors` instead of throwing.
 */
export const useBulkDelete = (
  bucket: string,
  options?: UseMutationOptions<BulkDeleteResult, Error, string[]>
) => {
  return useMutation<BulkDeleteResult, Error, string[]>({
    mutationFn: (keys) =>
      api.post<BulkDeleteResult>(`/browse/${bucket}/bulk-delete`, {
        body: { keys },
      }),
    ...options,
  });
};

/**
 * usePresignUrl generates a temporary S3 GetObject signed URL. Expiry
 * is clamped server-side to [60, 604800] seconds.
 */
export const usePresignUrl = (
  bucket: string,
  options?: UseMutationOptions<
    PresignResult,
    Error,
    { key: string; expires: number }
  >
) => {
  return useMutation<PresignResult, Error, { key: string; expires: number }>({
    mutationFn: (body) =>
      api.post<PresignResult>(`/browse/${bucket}/presign`, { body }),
    ...options,
  });
};

/**
 * useCopyObject performs a server-side S3 CopyObject (and optionally
 * deletes the source for move semantics). Both source and destination
 * buckets must be accessible to the current user.
 */
export const useCopyObject = (
  bucket: string,
  options?: UseMutationOptions<CopyObjectResult, Error, CopyObjectPayload>
) => {
  return useMutation<CopyObjectResult, Error, CopyObjectPayload>({
    mutationFn: (body) =>
      api.post<CopyObjectResult>(`/browse/${bucket}/copy`, { body }),
    ...options,
  });
};

/**
 * useCreateShareToken creates a HMAC-signed Web Share token via the
 * backend. The returned `url` is the relative path /api/share/<token>;
 * frontend should prepend `window.location.origin` for a fully-clickable
 * link to paste into chat/mail clients.
 *
 * Differs from usePresignUrl in two ways:
 *   1. Anonymous viewer is served by the webui sidecar (not Garage directly),
 *      so the response can rewrite Content-Disposition and pin Cache-Control.
 *   2. Token is shorter and origin-agnostic — works behind a public-facing LB
 *      without leaking the internal S3 endpoint.
 */
export const useCreateShareToken = (
  bucket: string,
  options?: UseMutationOptions<CreateShareResult, Error, CreateSharePayload>
) => {
  return useMutation<CreateShareResult, Error, CreateSharePayload>({
    mutationFn: (body) =>
      api.post<CreateShareResult>(`/share/create`, {
        body: { bucket, ...body },
      }),
    ...options,
  });
};

/**
 * useObjectMetadata fires a HEAD-equivalent request (the backend's
 * GET /browse/{bucket}/{key} returns HeadObject when no view/dl/thumb query
 * is set). Used by the preview drawer to show content-type, etag, and
 * x-amz-meta-* user metadata without downloading the body.
 */
export const useObjectMetadata = (
  bucket: string,
  key: string,
  enabled = true
) => {
  return useQuery<ObjectMetadata>({
    queryKey: ["object-meta", bucket, key],
    queryFn: () => api.get<ObjectMetadata>(`/browse/${bucket}/${key}`),
    enabled: !!bucket && !!key && enabled,
    staleTime: 60_000,
    retry: false,
  });
};
