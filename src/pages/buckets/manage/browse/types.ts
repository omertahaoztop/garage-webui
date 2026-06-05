export type UseBrowserObjectOptions = Partial<{
  prefix: string;
  limit: number;
  next: string;
}>;

export type GetObjectsResult = {
  prefixes: string[];
  objects: BrowserObject[];
  prefix: string;
  nextToken: string | null;
};

// BrowserObject mirrors backend `schema.BrowserObject`. The legacy alias
// `Object` is kept for backwards compatibility with existing imports.
export type BrowserObject = {
  objectKey: string;
  lastModified: string; // ISO 8601 from backend (time.Time)
  size: number;
  url: string;
};

// Legacy alias — prefer BrowserObject in new code.
export type Object = BrowserObject;

export type PutObjectPayload = {
  key: string;
  file: File | null;
};

export type BulkDeleteResult = {
  deleted: string[];
  errors: { key: string; code: string; message: string }[];
};

export type PresignResult = {
  url: string;
  expires: number;
};

// CopyObjectResult mirrors backend `schema.CopyObjectResult`. `moved=true`
// when the source was deleted after a successful copy (move semantics).
// CreateSharePayload is the body for useCreateShareToken mutation.
export type CreateSharePayload = {
  key: string;
  expires: number; // seconds
};

// CreateShareResult is returned by POST /share/create.
// `url` is the relative path (/api/share/<token>). Frontend should prepend
// `window.location.origin` for a fully-shareable URL.
export type CreateShareResult = {
  token: string;
  url: string;
  expires: number;
};

export type CopyObjectResult = {
  srcBucket: string;
  srcKey: string;
  dstBucket: string;
  dstKey: string;
  moved: boolean;
};

// CopyObjectPayload is the request body for POST /browse/{bucket}/copy.
// srcKey and dstKey are fully-qualified (prefix + filename). If dstBucket
// is omitted, the copy stays in the source bucket.
export type CopyObjectPayload = {
  srcKey: string;
  dstKey: string;
  dstBucket?: string;
  deleteSource?: boolean;
};

// ObjectMetadata is the response of HEAD /browse/{bucket}/{key}.
// Fields match S3 HeadObjectOutput JSON keys (PascalCase from AWS SDK Go).
export type ObjectMetadata = {
  ContentType?: string;
  ContentLength?: number;
  LastModified?: string;
  ETag?: string;
  Metadata?: Record<string, string>;
};

// MultipartInitResult is returned by POST /browse/{bucket}/multipart/init.
// `partSize` is the server-recommended chunk size (8 MiB default; S3 minimum
// per part is 5 MiB except for the last part).
export type MultipartInitResult = {
  uploadId: string;
  key: string;
  partSize: number;
};

// MultipartUploadPartResult comes back from each PUT /multipart/{uploadId}/part/{N}.
// The `etag` is the per-chunk integrity hash that S3 requires verbatim in
// the Complete call — don't trim/normalize the quotes around it.
export type MultipartUploadPartResult = {
  partNumber: number;
  etag: string;
  size: number;
};

// MultipartUploadPart is the part descriptor used in the Complete body.
export type MultipartUploadPart = {
  partNumber: number;
  etag: string;
};

// MultipartCompleteResult is returned by POST /multipart/{uploadId}/complete
// after all parts are uploaded. `etag` is the final object's hash-of-hashes
// (different from any individual part etag).
export type MultipartCompleteResult = {
  key: string;
  etag: string;
};
