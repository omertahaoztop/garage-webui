package router

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"khairul169/garage-webui/schema"
	"khairul169/garage-webui/utils"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/s3/types"
	"github.com/aws/smithy-go"
)

type Browse struct{}

func (b *Browse) GetObjects(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query()
	bucket := r.PathValue("bucket")
	prefix := query.Get("prefix")
	continuationToken := query.Get("next")
	// Defensive: some older frontend revisions accidentally serialized
	// JavaScript `undefined` into the URL as the literal string "undefined".
	// Treat that the same as an empty token so the S3 SDK never sees junk.
	if continuationToken == "undefined" || continuationToken == "null" {
		continuationToken = ""
	}

	user := utils.GetUserSession(r)
	if user != nil && !user.IsAdmin {
		hasAccess := false
		for _, accessibleBucket := range user.AccessibleBuckets {
			if accessibleBucket == bucket {
				hasAccess = true
				break
			}
		}
		if !hasAccess {
			utils.ResponseErrorStatus(w, errors.New("access denied to this bucket"), http.StatusForbidden)
			return
		}
	}

	limit, err := strconv.Atoi(query.Get("limit"))
	if err != nil || limit < 1 {
		limit = 500
	}
	if limit > 1000 {
		limit = 1000
	}

	client, err := getS3Client(r, bucket)
	if err != nil {
		utils.ResponseError(w, err)
		return
	}

	var ctok *string
	if continuationToken != "" {
		ctok = aws.String(continuationToken)
	}

	objects, err := client.ListObjectsV2(context.Background(), &s3.ListObjectsV2Input{
		Bucket:            aws.String(bucket),
		Prefix:            aws.String(prefix),
		Delimiter:         aws.String("/"),
		MaxKeys:           aws.Int32(int32(limit)),
		ContinuationToken: ctok,
	})

	if err != nil {
		utils.ResponseError(w, err)
		return
	}

	result := schema.BrowseObjectResult{
		Prefixes:  []string{},
		Objects:   []schema.BrowserObject{},
		Prefix:    prefix,
		NextToken: objects.NextContinuationToken,
	}

	for _, prefix := range objects.CommonPrefixes {
		result.Prefixes = append(result.Prefixes, *prefix.Prefix)
	}

	for _, object := range objects.Contents {
		key := strings.TrimPrefix(*object.Key, prefix)
		if key == "" {
			continue
		}

		result.Objects = append(result.Objects, schema.BrowserObject{
			ObjectKey:    &key,
			LastModified: object.LastModified,
			Size:         object.Size,
			Url:          fmt.Sprintf("/browse/%s/%s", bucket, *object.Key),
		})
	}

	utils.ResponseSuccess(w, result)
}

func (b *Browse) GetOneObject(w http.ResponseWriter, r *http.Request) {
	bucket := r.PathValue("bucket")
	key := r.PathValue("key")
	queryParams := r.URL.Query()
	view := queryParams.Get("view") == "1"
	thumbnail := queryParams.Get("thumb") == "1"
	download := queryParams.Get("dl") == "1"

	user := utils.GetUserSession(r)
	if user != nil && !user.IsAdmin {
		hasAccess := false
		for _, accessibleBucket := range user.AccessibleBuckets {
			if accessibleBucket == bucket {
				hasAccess = true
				break
			}
		}
		if !hasAccess {
			utils.ResponseErrorStatus(w, errors.New("access denied to this bucket"), http.StatusForbidden)
			return
		}
	}

	client, err := getS3Client(r, bucket)
	if err != nil {
		utils.ResponseError(w, err)
		return
	}

	if !view && !download && !thumbnail {
		object, err := client.HeadObject(context.Background(), &s3.HeadObjectInput{
			Bucket: aws.String(bucket),
			Key:    aws.String(key),
		})
		if err != nil {
			utils.ResponseError(w, err)
		}
		utils.ResponseSuccess(w, object)
		return
	}

	object, err := client.GetObject(context.Background(), &s3.GetObjectInput{
		Bucket: aws.String(bucket),
		Key:    aws.String(key),
	})

	if err != nil {
		var ae smithy.APIError
		if errors.As(err, &ae) && ae.ErrorCode() == "NoSuchKey" {
			utils.ResponseErrorStatus(w, err, http.StatusNotFound)
			return
		}

		utils.ResponseError(w, err)
		return
	}

	defer object.Body.Close()
	keys := strings.Split(key, "/")

	if download {
		w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=%s", keys[len(keys)-1]))
	} else if thumbnail {
		body, err := io.ReadAll(object.Body)
		if err != nil {
			utils.ResponseError(w, err)
			return
		}

		thumb, err := utils.CreateThumbnailImage(body, 64, 64)
		if err != nil {

			utils.ResponseError(w, err)
			return
		}

		w.Header().Set("Content-Type", "image/png")
		w.Write(thumb)
		return
	}

	w.Header().Set("Cache-Control", "max-age=86400")
	w.Header().Set("Last-Modified", object.LastModified.Format(time.RFC1123))

	if object.ContentType != nil {
		w.Header().Set("Content-Type", *object.ContentType)
	} else {
		w.Header().Set("Content-Type", "application/octet-stream")
	}
	if object.ContentLength != nil {
		w.Header().Set("Content-Length", strconv.FormatInt(*object.ContentLength, 10))
	}
	if object.ETag != nil {
		w.Header().Set("Etag", *object.ETag)
	}

	_, err = io.Copy(w, object.Body)

	if err != nil {
		utils.ResponseError(w, err)
		return
	}
}

func (b *Browse) PutObject(w http.ResponseWriter, r *http.Request) {
	bucket := r.PathValue("bucket")
	key := r.PathValue("key")
	isDirectory := strings.HasSuffix(key, "/")

	user := utils.GetUserSession(r)
	if user != nil && !user.IsAdmin {
		hasAccess := false
		for _, accessibleBucket := range user.AccessibleBuckets {
			if accessibleBucket == bucket {
				hasAccess = true
				break
			}
		}
		if !hasAccess {
			utils.ResponseErrorStatus(w, errors.New("access denied to this bucket"), http.StatusForbidden)
			return
		}
	}

	file, headers, err := r.FormFile("file")
	if err != nil && !isDirectory {
		utils.ResponseError(w, err)
		return
	}

	if file != nil {
		defer file.Close()
	}

	client, err := getS3Client(r, bucket)
	if err != nil {
		utils.ResponseError(w, err)
		return
	}

	var contentType string = ""
	var size int64 = 0

	if file != nil {
		contentType = headers.Header.Get("Content-Type")
		size = headers.Size
	}

	result, err := client.PutObject(context.Background(), &s3.PutObjectInput{
		Bucket:        aws.String(bucket),
		Key:           aws.String(key),
		Body:          file,
		ContentLength: aws.Int64(size),
		ContentType:   aws.String(contentType),
	})

	if err != nil {
		utils.ResponseError(w, fmt.Errorf("cannot put object: %w", err))
		return
	}

	utils.ResponseSuccess(w, result)
}

func (b *Browse) DeleteObject(w http.ResponseWriter, r *http.Request) {
	bucket := r.PathValue("bucket")
	key := r.PathValue("key")
	recursive := r.URL.Query().Get("recursive") == "true"
	isDirectory := strings.HasSuffix(key, "/")

	user := utils.GetUserSession(r)
	if user != nil && !user.IsAdmin {
		hasAccess := false
		for _, accessibleBucket := range user.AccessibleBuckets {
			if accessibleBucket == bucket {
				hasAccess = true
				break
			}
		}
		if !hasAccess {
			utils.ResponseErrorStatus(w, errors.New("access denied to this bucket"), http.StatusForbidden)
			return
		}
	}

	client, err := getS3Client(r, bucket)
	if err != nil {
		utils.ResponseError(w, err)
		return
	}

	if isDirectory && recursive {
		objects, err := client.ListObjectsV2(context.Background(), &s3.ListObjectsV2Input{
			Bucket: aws.String(bucket),
			Prefix: aws.String(key),
		})

		if err != nil {
			utils.ResponseError(w, err)
			return
		}

		if len(objects.Contents) == 0 {
			utils.ResponseSuccess(w, true)
			return
		}

		keys := make([]types.ObjectIdentifier, 0, len(objects.Contents))

		for _, object := range objects.Contents {
			keys = append(keys, types.ObjectIdentifier{
				Key: object.Key,
			})
		}

		res, err := client.DeleteObjects(context.Background(), &s3.DeleteObjectsInput{
			Bucket: aws.String(bucket),
			Delete: &types.Delete{Objects: keys},
		})

		if err != nil {
			utils.ResponseError(w, fmt.Errorf("cannot delete object: %w", err))
			return
		}

		if len(res.Errors) > 0 {
			utils.ResponseError(w, fmt.Errorf("cannot delete object: %v", res.Errors[0]))
			return
		}

		utils.ResponseSuccess(w, res)
		return
	}

	res, err := client.DeleteObject(context.Background(), &s3.DeleteObjectInput{
		Bucket: aws.String(bucket),
		Key:    aws.String(key),
	})

	if err != nil {
		utils.ResponseError(w, fmt.Errorf("cannot delete object: %w", err))
		return
	}

	utils.ResponseSuccess(w, res)
}

// BulkDelete accepts a JSON body {"keys":["a","b",...]} and removes the listed
// objects from the bucket using S3 DeleteObjects in batches of up to 1000
// (S3 hard limit). Keys are taken literally; callers must include any current
// prefix in each key. Partial failures are reported per-key in the response.
func (b *Browse) BulkDelete(w http.ResponseWriter, r *http.Request) {
	bucket := r.PathValue("bucket")

	user := utils.GetUserSession(r)
	if user != nil && !user.IsAdmin {
		hasAccess := false
		for _, accessibleBucket := range user.AccessibleBuckets {
			if accessibleBucket == bucket {
				hasAccess = true
				break
			}
		}
		if !hasAccess {
			utils.ResponseErrorStatus(w, errors.New("access denied to this bucket"), http.StatusForbidden)
			return
		}
	}

	var req schema.BulkDeleteRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.ResponseErrorStatus(w, fmt.Errorf("invalid request body: %w", err), http.StatusBadRequest)
		return
	}
	if len(req.Keys) == 0 {
		utils.ResponseErrorStatus(w, errors.New("keys array cannot be empty"), http.StatusBadRequest)
		return
	}

	client, err := getS3Client(r, bucket)
	if err != nil {
		utils.ResponseError(w, err)
		return
	}

	result := schema.BulkDeleteResult{
		Deleted: []string{},
		Errors:  []schema.BulkDeleteResultError{},
	}

	const maxBatch = 1000
	for i := 0; i < len(req.Keys); i += maxBatch {
		end := i + maxBatch
		if end > len(req.Keys) {
			end = len(req.Keys)
		}
		batch := req.Keys[i:end]
		identifiers := make([]types.ObjectIdentifier, 0, len(batch))
		for _, k := range batch {
			key := k
			identifiers = append(identifiers, types.ObjectIdentifier{Key: aws.String(key)})
		}

		res, err := client.DeleteObjects(context.Background(), &s3.DeleteObjectsInput{
			Bucket: aws.String(bucket),
			Delete: &types.Delete{Objects: identifiers, Quiet: aws.Bool(false)},
		})
		if err != nil {
			utils.ResponseError(w, fmt.Errorf("bulk delete failed: %w", err))
			return
		}

		for _, d := range res.Deleted {
			if d.Key != nil {
				result.Deleted = append(result.Deleted, *d.Key)
			}
		}
		for _, e := range res.Errors {
			result.Errors = append(result.Errors, schema.BulkDeleteResultError{
				Key:     aws.ToString(e.Key),
				Code:    aws.ToString(e.Code),
				Message: aws.ToString(e.Message),
			})
		}
	}

	utils.ResponseSuccess(w, result)
}

// PresignUrl returns a temporary GetObject URL signed with the bucket's
// access/secret key, suitable for direct browser download or sharing via link
// (no server proxying once issued). Expiry is clamped to [60, 604800] seconds
// (7 days, AWS Signature v4 hard cap).
func (b *Browse) PresignUrl(w http.ResponseWriter, r *http.Request) {
	bucket := r.PathValue("bucket")

	user := utils.GetUserSession(r)
	if user != nil && !user.IsAdmin {
		hasAccess := false
		for _, accessibleBucket := range user.AccessibleBuckets {
			if accessibleBucket == bucket {
				hasAccess = true
				break
			}
		}
		if !hasAccess {
			utils.ResponseErrorStatus(w, errors.New("access denied to this bucket"), http.StatusForbidden)
			return
		}
	}

	var req schema.PresignRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.ResponseErrorStatus(w, fmt.Errorf("invalid request body: %w", err), http.StatusBadRequest)
		return
	}
	if req.Key == "" {
		utils.ResponseErrorStatus(w, errors.New("key is required"), http.StatusBadRequest)
		return
	}
	if req.Expires < 60 {
		req.Expires = 3600
	}
	if req.Expires > 604800 {
		req.Expires = 604800
	}

	client, err := getS3PresignClient(r, bucket)
	if err != nil {
		utils.ResponseError(w, err)
		return
	}

	presigner := s3.NewPresignClient(client)
	presigned, err := presigner.PresignGetObject(
		context.Background(),
		&s3.GetObjectInput{
			Bucket: aws.String(bucket),
			Key:    aws.String(req.Key),
		},
		s3.WithPresignExpires(time.Duration(req.Expires)*time.Second),
	)
	if err != nil {
		utils.ResponseError(w, fmt.Errorf("cannot presign url: %w", err))
		return
	}

	utils.ResponseSuccess(w, schema.PresignResult{
		Url:     presigned.URL,
		Expires: req.Expires,
	})
}

// CopyObject implements POST /browse/{bucket}/copy. Body:
//
//	{ "srcKey": "...", "dstKey": "...", "dstBucket": "...", "deleteSource": false }
//
// Source bucket is the path parameter. Destination bucket defaults to the
// source if omitted. When deleteSource=true the operation becomes a move —
// the copy is performed first, then the source is deleted with a separate
// S3 DeleteObject call (so a failed delete still leaves the destination
// in place; callers can retry or clean up manually).
//
// Per-bucket access is checked for BOTH source and destination when the
// authenticated user is non-admin.
func (b *Browse) CopyObject(w http.ResponseWriter, r *http.Request) {
	srcBucket := r.PathValue("bucket")

	user := utils.GetUserSession(r)
	if user != nil && !user.IsAdmin {
		hasSrc := false
		for _, accessibleBucket := range user.AccessibleBuckets {
			if accessibleBucket == srcBucket {
				hasSrc = true
				break
			}
		}
		if !hasSrc {
			utils.ResponseErrorStatus(w, errors.New("access denied to source bucket"), http.StatusForbidden)
			return
		}
	}

	var req schema.CopyObjectRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.ResponseErrorStatus(w, fmt.Errorf("invalid request body: %w", err), http.StatusBadRequest)
		return
	}
	if req.SrcKey == "" || req.DstKey == "" {
		utils.ResponseErrorStatus(w, errors.New("srcKey and dstKey are required"), http.StatusBadRequest)
		return
	}
	if req.DstBucket == "" {
		req.DstBucket = srcBucket
	}

	if user != nil && !user.IsAdmin && req.DstBucket != srcBucket {
		hasDst := false
		for _, accessibleBucket := range user.AccessibleBuckets {
			if accessibleBucket == req.DstBucket {
				hasDst = true
				break
			}
		}
		if !hasDst {
			utils.ResponseErrorStatus(w, errors.New("access denied to destination bucket"), http.StatusForbidden)
			return
		}
	}

	// Reject no-op copies (same bucket + same key) — S3 would fail anyway,
	// but a clean 400 is friendlier than a cryptic "InvalidRequest".
	if req.DstBucket == srcBucket && req.DstKey == req.SrcKey {
		utils.ResponseErrorStatus(w, errors.New("destination must differ from source"), http.StatusBadRequest)
		return
	}

	// Use the destination bucket's S3 client. CopyObject is initiated against
	// the destination; CopySource header carries the source. This lets the
	// SDK pick the right credentials in cross-bucket scenarios.
	dstClient, err := getS3Client(r, req.DstBucket)
	if err != nil {
		utils.ResponseError(w, fmt.Errorf("cannot get destination client: %w", err))
		return
	}

	copySource := fmt.Sprintf("%s/%s", srcBucket, req.SrcKey)
	_, err = dstClient.CopyObject(context.Background(), &s3.CopyObjectInput{
		Bucket:     aws.String(req.DstBucket),
		Key:        aws.String(req.DstKey),
		CopySource: aws.String(copySource),
	})
	if err != nil {
		utils.ResponseError(w, fmt.Errorf("cannot copy object: %w", err))
		return
	}

	if req.DeleteSource {
		srcClient, err := getS3Client(r, srcBucket)
		if err != nil {
			utils.ResponseError(w, fmt.Errorf("copy succeeded but cannot get source client for delete: %w", err))
			return
		}
		_, err = srcClient.DeleteObject(context.Background(), &s3.DeleteObjectInput{
			Bucket: aws.String(srcBucket),
			Key:    aws.String(req.SrcKey),
		})
		if err != nil {
			utils.ResponseError(w, fmt.Errorf("copy succeeded but source delete failed: %w", err))
			return
		}
	}

	utils.ResponseSuccess(w, schema.CopyObjectResult{
		SrcBucket: srcBucket,
		SrcKey:    req.SrcKey,
		DstBucket: req.DstBucket,
		DstKey:    req.DstKey,
		Moved:     req.DeleteSource,
	})
}

// MultipartInit implements POST /browse/{bucket}/multipart/init. Starts an
// S3 multipart upload and returns the uploadId the client must reuse for
// every subsequent UploadPart + Complete/Abort call. Returns 8 MiB as the
// recommended part size (well above S3's 5 MiB minimum, comfortable for
// resumable uploads of >5 GB files).
func (b *Browse) MultipartInit(w http.ResponseWriter, r *http.Request) {
	bucket := r.PathValue("bucket")

	user := utils.GetUserSession(r)
	if user != nil && !user.IsAdmin {
		hasAccess := false
		for _, accessibleBucket := range user.AccessibleBuckets {
			if accessibleBucket == bucket {
				hasAccess = true
				break
			}
		}
		if !hasAccess {
			utils.ResponseErrorStatus(w, errors.New("access denied to this bucket"), http.StatusForbidden)
			return
		}
	}

	var req schema.MultipartInitRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.ResponseErrorStatus(w, err, http.StatusBadRequest)
		return
	}
	if req.Key == "" {
		utils.ResponseErrorStatus(w, errors.New("key is required"), http.StatusBadRequest)
		return
	}

	client, err := getS3Client(r, bucket)
	if err != nil {
		utils.ResponseError(w, err)
		return
	}

	input := &s3.CreateMultipartUploadInput{
		Bucket: aws.String(bucket),
		Key:    aws.String(req.Key),
	}
	if req.ContentType != "" {
		input.ContentType = aws.String(req.ContentType)
	}

	out, err := client.CreateMultipartUpload(context.Background(), input)
	if err != nil {
		utils.ResponseError(w, fmt.Errorf("cannot init multipart upload: %w", err))
		return
	}

	utils.ResponseSuccess(w, schema.MultipartInitResult{
		UploadId: aws.ToString(out.UploadId),
		Key:      req.Key,
		PartSize: 8 * 1024 * 1024,
	})
}

// MultipartUploadPart implements PUT /browse/{bucket}/multipart/{uploadId}/part/{partNumber}.
// Body is the raw bytes of the part (NOT multipart-form). Client passes the
// object key via the `key` query string. Returns the part's ETag — client
// MUST collect every part's (number, etag) pair and pass them to Complete.
func (b *Browse) MultipartUploadPart(w http.ResponseWriter, r *http.Request) {
	bucket := r.PathValue("bucket")
	uploadId := r.PathValue("uploadId")
	partNumberStr := r.PathValue("partNumber")
	key := r.URL.Query().Get("key")

	if uploadId == "" || key == "" {
		utils.ResponseErrorStatus(w, errors.New("uploadId and key are required"), http.StatusBadRequest)
		return
	}
	partNumber, err := strconv.Atoi(partNumberStr)
	if err != nil || partNumber < 1 || partNumber > 10000 {
		utils.ResponseErrorStatus(w, errors.New("partNumber must be in [1, 10000]"), http.StatusBadRequest)
		return
	}

	user := utils.GetUserSession(r)
	if user != nil && !user.IsAdmin {
		hasAccess := false
		for _, accessibleBucket := range user.AccessibleBuckets {
			if accessibleBucket == bucket {
				hasAccess = true
				break
			}
		}
		if !hasAccess {
			utils.ResponseErrorStatus(w, errors.New("access denied to this bucket"), http.StatusForbidden)
			return
		}
	}

	client, err := getS3Client(r, bucket)
	if err != nil {
		utils.ResponseError(w, err)
		return
	}

	// AWS SDK v2 UploadPart computes a SHA256 payload signature that requires the
	// Body to be an io.ReadSeeker. http.Request.Body is stream-only (no Seek), so
	// we buffer the part in memory first. With 8 MiB parts and frontend
	// concurrency=4, worst case is ~32 MiB resident per active upload per sidecar.
	defer r.Body.Close()
	body, err := io.ReadAll(r.Body)
	if err != nil {
		utils.ResponseError(w, fmt.Errorf("cannot read part %d body: %w", partNumber, err))
		return
	}

	out, err := client.UploadPart(context.Background(), &s3.UploadPartInput{
		Bucket:        aws.String(bucket),
		Key:           aws.String(key),
		UploadId:      aws.String(uploadId),
		PartNumber:    aws.Int32(int32(partNumber)),
		Body:          bytes.NewReader(body),
		ContentLength: aws.Int64(int64(len(body))),
	})
	if err != nil {
		utils.ResponseError(w, fmt.Errorf("cannot upload part %d: %w", partNumber, err))
		return
	}

	utils.ResponseSuccess(w, schema.MultipartUploadPartResult{
		PartNumber: int32(partNumber),
		ETag:       aws.ToString(out.ETag),
		Size:       int64(len(body)),
	})
}

// MultipartComplete implements POST /browse/{bucket}/multipart/{uploadId}/complete.
// Body: { key, parts: [{partNumber, etag}, ...] }. Parts must list every part
// uploaded; S3 reassembles them in PartNumber order. Returns the final object
// ETag (note this is NOT the md5 of the content — it's a hash-of-hashes).
func (b *Browse) MultipartComplete(w http.ResponseWriter, r *http.Request) {
	bucket := r.PathValue("bucket")
	uploadId := r.PathValue("uploadId")

	if uploadId == "" {
		utils.ResponseErrorStatus(w, errors.New("uploadId is required"), http.StatusBadRequest)
		return
	}

	user := utils.GetUserSession(r)
	if user != nil && !user.IsAdmin {
		hasAccess := false
		for _, accessibleBucket := range user.AccessibleBuckets {
			if accessibleBucket == bucket {
				hasAccess = true
				break
			}
		}
		if !hasAccess {
			utils.ResponseErrorStatus(w, errors.New("access denied to this bucket"), http.StatusForbidden)
			return
		}
	}

	var req schema.MultipartCompleteRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.ResponseErrorStatus(w, err, http.StatusBadRequest)
		return
	}
	if req.Key == "" || len(req.Parts) == 0 {
		utils.ResponseErrorStatus(w, errors.New("key and parts are required"), http.StatusBadRequest)
		return
	}

	client, err := getS3Client(r, bucket)
	if err != nil {
		utils.ResponseError(w, err)
		return
	}

	completed := make([]types.CompletedPart, 0, len(req.Parts))
	for _, p := range req.Parts {
		completed = append(completed, types.CompletedPart{
			ETag:       aws.String(p.ETag),
			PartNumber: aws.Int32(p.PartNumber),
		})
	}

	out, err := client.CompleteMultipartUpload(context.Background(), &s3.CompleteMultipartUploadInput{
		Bucket:          aws.String(bucket),
		Key:             aws.String(req.Key),
		UploadId:        aws.String(uploadId),
		MultipartUpload: &types.CompletedMultipartUpload{Parts: completed},
	})
	if err != nil {
		utils.ResponseError(w, fmt.Errorf("cannot complete multipart upload: %w", err))
		return
	}

	utils.ResponseSuccess(w, schema.MultipartCompleteResult{
		Key:  req.Key,
		ETag: aws.ToString(out.ETag),
	})
}

// MultipartAbort implements DELETE /browse/{bucket}/multipart/{uploadId}.
// Client passes the key via the `key` query string. Cleans up the pending
// multipart upload so it doesn't accumulate storage in Garage (or trigger
// S3 lifecycle fees in real AWS).
func (b *Browse) MultipartAbort(w http.ResponseWriter, r *http.Request) {
	bucket := r.PathValue("bucket")
	uploadId := r.PathValue("uploadId")
	key := r.URL.Query().Get("key")

	if uploadId == "" || key == "" {
		utils.ResponseErrorStatus(w, errors.New("uploadId and key are required"), http.StatusBadRequest)
		return
	}

	user := utils.GetUserSession(r)
	if user != nil && !user.IsAdmin {
		hasAccess := false
		for _, accessibleBucket := range user.AccessibleBuckets {
			if accessibleBucket == bucket {
				hasAccess = true
				break
			}
		}
		if !hasAccess {
			utils.ResponseErrorStatus(w, errors.New("access denied to this bucket"), http.StatusForbidden)
			return
		}
	}

	client, err := getS3Client(r, bucket)
	if err != nil {
		utils.ResponseError(w, err)
		return
	}

	_, err = client.AbortMultipartUpload(context.Background(), &s3.AbortMultipartUploadInput{
		Bucket:   aws.String(bucket),
		Key:      aws.String(key),
		UploadId: aws.String(uploadId),
	})
	if err != nil {
		utils.ResponseError(w, fmt.Errorf("cannot abort multipart upload: %w", err))
		return
	}

	utils.ResponseSuccess(w, map[string]bool{"ok": true})
}

// getBucketCredentials resolves a (read+write) access key for a bucket on the
// given cluster. Results are cached per (cluster, bucket) for 1h.
func getBucketCredentials(cluster *utils.Cluster, bucket string) (aws.CredentialsProvider, error) {
	cacheKey := fmt.Sprintf("key:%s:%s", cluster.ID, bucket)
	cacheData := utils.Cache.Get(cacheKey)

	if cacheData != nil {
		return cacheData.(aws.CredentialsProvider), nil
	}

	body, err := cluster.Fetch("/v2/GetBucketInfo?globalAlias="+bucket, &utils.FetchOptions{})
	if err != nil {
		return nil, err
	}

	var bucketData schema.Bucket
	if err := json.Unmarshal(body, &bucketData); err != nil {
		return nil, err
	}

	var key schema.KeyElement

	for _, k := range bucketData.Keys {
		if !k.Permissions.Read || !k.Permissions.Write {
			continue
		}

		body, err := cluster.Fetch(fmt.Sprintf("/v2/GetKeyInfo?id=%s&showSecretKey=true", k.AccessKeyID), &utils.FetchOptions{})
		if err != nil {
			return nil, err
		}
		if err := json.Unmarshal(body, &key); err != nil {
			return nil, err
		}
		break
	}

	if key.AccessKeyID == "" || key.SecretAccessKey == "" {
		return nil, fmt.Errorf("no read+write key found for bucket %s on cluster %s", bucket, cluster.ID)
	}

	credential := credentials.NewStaticCredentialsProvider(key.AccessKeyID, key.SecretAccessKey, "")
	utils.Cache.Set(cacheKey, credential, time.Hour)

	return credential, nil
}

// getS3Client builds an S3 client targeting the cluster's INTERNAL S3
// endpoint (used for all server-side proxying: list, get, put, copy, delete).
func getS3Client(r *http.Request, bucket string) (*s3.Client, error) {
	cluster := utils.GetCluster(r)
	if cluster == nil {
		return nil, fmt.Errorf("no cluster selected")
	}
	return buildS3Client(cluster, bucket, cluster.GetS3Endpoint())
}

// getS3PresignClient builds an S3 client signed against the PUBLIC S3 endpoint
// (e.g. https://garage.mono.tr) so the resulting presigned URLs are reachable
// from a user's browser through the edge load balancer, not the internal
// per-node address. Falls back to the internal endpoint when no public
// endpoint is configured.
func getS3PresignClient(r *http.Request, bucket string) (*s3.Client, error) {
	cluster := utils.GetCluster(r)
	if cluster == nil {
		return nil, fmt.Errorf("no cluster selected")
	}
	return buildS3Client(cluster, bucket, cluster.GetS3PublicEndpoint())
}

// buildS3Client constructs an S3 client for `bucket` against `endpoint` using
// the bucket's resolved read+write credentials.
func buildS3Client(cluster *utils.Cluster, bucket, endpoint string) (*s3.Client, error) {
	creds, err := getBucketCredentials(cluster, bucket)
	if err != nil {
		return nil, fmt.Errorf("cannot get credentials for bucket %s: %w", bucket, err)
	}

	disableHTTPS := !strings.HasPrefix(endpoint, "https://")

	awsConfig := aws.Config{
		Credentials: creds,
		Region:      cluster.GetS3Region(),
	}

	client := s3.NewFromConfig(awsConfig, func(o *s3.Options) {
		o.UsePathStyle = true
		o.EndpointOptions.DisableHTTPS = disableHTTPS
		o.EndpointResolver = s3.EndpointResolverFunc(func(region string, opts s3.EndpointResolverOptions) (aws.Endpoint, error) {
			return aws.Endpoint{
				URL:           endpoint,
				SigningRegion: cluster.GetS3Region(),
			}, nil
		})
	})

	return client, nil
}
