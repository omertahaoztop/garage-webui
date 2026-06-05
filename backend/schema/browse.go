package schema

import "time"

// BrowseObjectResult is returned by GET /browse/{bucket}. Lists are paginated
// via the `nextToken` field. A non-empty value indicates more objects exist;
// pass it as the `next` query parameter on the following request.
type BrowseObjectResult struct {
	Prefixes  []string        `json:"prefixes"`
	Objects   []BrowserObject `json:"objects"`
	Prefix    string          `json:"prefix"`
	NextToken *string         `json:"nextToken"`
}

type BrowserObject struct {
	ObjectKey    *string    `json:"objectKey"`
	LastModified *time.Time `json:"lastModified"`
	Size         *int64     `json:"size"`
	Url          string     `json:"url"`
}

// BulkDeleteRequest is the body of POST /browse/{bucket}/bulk-delete.
// Keys are FULLY-QUALIFIED (i.e. include the current prefix); the backend
// does not prepend anything. Max ~1000 keys per batch is enforced server-side.
type BulkDeleteRequest struct {
	Keys []string `json:"keys"`
}

type BulkDeleteResult struct {
	Deleted []string                `json:"deleted"`
	Errors  []BulkDeleteResultError `json:"errors"`
}

type BulkDeleteResultError struct {
	Key     string `json:"key"`
	Code    string `json:"code"`
	Message string `json:"message"`
}

// PresignRequest is the body of POST /browse/{bucket}/presign. The backend
// clamps `expires` to [60, 604800] seconds (7 days, AWS Signature v4 hard cap).
type PresignRequest struct {
	Key     string `json:"key"`
	Expires int64  `json:"expires"`
}

type PresignResult struct {
	Url     string `json:"url"`
	Expires int64  `json:"expires"`
}

// CopyObjectRequest is the body of POST /browse/{bucket}/copy.
// SrcKey is the source object key (within the path-bucket). DstBucket defaults
// to the path-bucket when empty, enabling intra-bucket copies. DstKey is the
// destination key. When DeleteSource is true the operation is a move
// (S3 has no atomic move; backend performs CopyObject + DeleteObject of src).
type CopyObjectRequest struct {
	SrcKey       string `json:"srcKey"`
	DstKey       string `json:"dstKey"`
	DstBucket    string `json:"dstBucket"`
	DeleteSource bool   `json:"deleteSource"`
}

// CopyObjectResult mirrors the resolved source/destination back to the client
// and confirms whether the source was deleted (Move semantics).
type CopyObjectResult struct {
	SrcBucket string `json:"srcBucket"`
	SrcKey    string `json:"srcKey"`
	DstBucket string `json:"dstBucket"`
	DstKey    string `json:"dstKey"`
	Moved     bool   `json:"moved"`
}

// MultipartInitRequest is the body of POST /browse/{bucket}/multipart/init.
// Returns an uploadId that the client uses to upload parts and complete.
type MultipartInitRequest struct {
	Key         string `json:"key"`
	ContentType string `json:"contentType,omitempty"`
}

// MultipartInitResult carries the uploadId + recommended part size (8 MiB).
// Clients should use parts >= 5 MiB (S3 minimum, except last part).
type MultipartInitResult struct {
	UploadId string `json:"uploadId"`
	Key      string `json:"key"`
	PartSize int64  `json:"partSize"`
}

// MultipartUploadPartResult is returned by PUT /browse/{bucket}/multipart/{uploadId}/part/{partNumber}.
// The ETag MUST be passed back verbatim in the Complete request — it is the
// chunk's integrity hash that S3 uses to assemble the final object.
type MultipartUploadPartResult struct {
	PartNumber int32  `json:"partNumber"`
	ETag       string `json:"etag"`
	Size       int64  `json:"size"`
}

// MultipartUploadPart pairs a part number with its ETag for the Complete call.
type MultipartUploadPart struct {
	PartNumber int32  `json:"partNumber"`
	ETag       string `json:"etag"`
}

// MultipartCompleteRequest is the body of POST /browse/{bucket}/multipart/{uploadId}/complete.
// Parts must be in ascending PartNumber order; the backend re-sorts defensively.
type MultipartCompleteRequest struct {
	Key   string                `json:"key"`
	Parts []MultipartUploadPart `json:"parts"`
}

// MultipartCompleteResult returns the final object's ETag (different from
// part ETags — it's a hash-of-hashes computed by S3).
type MultipartCompleteResult struct {
	Key  string `json:"key"`
	ETag string `json:"etag"`
}
