package router

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"khairul169/garage-webui/schema"
	"khairul169/garage-webui/share"
	"khairul169/garage-webui/utils"
	"net/http"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

type Share struct{}

const (
	shareExpireMin = int64(60)               // 1 minute floor
	shareExpireMax = int64(7 * 24 * 60 * 60) // 7 day cap
)

// CreateShare creates a HMAC-signed share token. AUTH REQUIRED — mounted
// under userRouter so the standard auth+cluster middlewares run first.
//
// POST /api/share/create
// Body: { bucket, key, expires (seconds) }
// Returns: { token, url, expires }
func (s *Share) CreateShare(w http.ResponseWriter, r *http.Request) {
	cluster := utils.GetCluster(r)
	if cluster == nil {
		utils.ResponseError(w, errors.New("no cluster context"))
		return
	}

	var req schema.CreateShareRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.ResponseError(w, fmt.Errorf("bad request: %w", err))
		return
	}
	if req.Bucket == "" || req.Key == "" {
		utils.ResponseError(w, errors.New("bucket and key are required"))
		return
	}
	if req.Expires < shareExpireMin {
		req.Expires = shareExpireMin
	}
	if req.Expires > shareExpireMax {
		req.Expires = shareExpireMax
	}

	// Verify the caller actually has access to this bucket on this cluster
	// by attempting the same credentials lookup the /browse path uses.
	// Hides existence of inaccessible buckets behind a clean 403.
	if _, err := getBucketCredentials(cluster, req.Bucket); err != nil {
		utils.ResponseErrorStatus(w, fmt.Errorf("cannot access bucket %q: %w", req.Bucket, err), http.StatusForbidden)
		return
	}

	p := share.Payload{
		ClusterId: cluster.ID,
		Bucket:    req.Bucket,
		Key:       req.Key,
		ExpiresAt: time.Now().Unix() + req.Expires,
	}
	// Filename hint = last segment of key for browser-friendly Content-Disposition.
	if i := strings.LastIndex(req.Key, "/"); i >= 0 && i < len(req.Key)-1 {
		p.Filename = req.Key[i+1:]
	} else {
		p.Filename = req.Key
	}

	token, err := share.Sign(p)
	if err != nil {
		utils.ResponseError(w, fmt.Errorf("cannot sign token: %w", err))
		return
	}

	utils.ResponseSuccess(w, schema.CreateShareResult{
		Token:   token,
		Url:     "/api/share/" + token,
		Expires: req.Expires,
	})
}

// ServeShare resolves the HMAC token and streams the object content.
// PUBLIC ENDPOINT — registered on the top-level mux so it bypasses auth and
// cluster middlewares. The token itself embeds the cluster id so the route
// stays self-contained.
//
// GET /api/share/{token}
func (s *Share) ServeShare(w http.ResponseWriter, r *http.Request) {
	token := r.PathValue("token")
	p, err := share.Verify(token)
	if err != nil {
		http.Error(w, err.Error(), http.StatusForbidden)
		return
	}
	cluster, ok := utils.Clusters.Get(p.ClusterId)
	if !ok || cluster == nil {
		http.Error(w, "cluster not found", http.StatusNotFound)
		return
	}

	// Inject the cluster into the request context so getS3Client (which is
	// shared with /browse) can resolve credentials without a fresh dispatch.
	r2 := r.WithContext(utils.WithCluster(r.Context(), cluster))
	client, err := getS3Client(r2, p.Bucket)
	if err != nil {
		http.Error(w, "cannot build S3 client: "+err.Error(), http.StatusInternalServerError)
		return
	}

	out, err := client.GetObject(r.Context(), &s3.GetObjectInput{
		Bucket: aws.String(p.Bucket),
		Key:    aws.String(p.Key),
	})
	if err != nil {
		http.Error(w, "object not found or unavailable", http.StatusNotFound)
		return
	}
	defer out.Body.Close()

	// Forward useful S3 response headers (no Etag/range yet — keep minimal).
	if out.ContentType != nil {
		w.Header().Set("Content-Type", *out.ContentType)
	}
	if out.ContentLength != nil {
		w.Header().Set("Content-Length", fmt.Sprintf("%d", *out.ContentLength))
	}
	disposition := "inline"
	if shouldForceDownload(p.Filename) {
		disposition = "attachment"
	}
	w.Header().Set("Content-Disposition", fmt.Sprintf(`%s; filename="%s"`, disposition, escapeQuotes(p.Filename)))
	// Anonymous viewers may cache briefly. Adjust if you want zero-cache.
	w.Header().Set("Cache-Control", "private, max-age=3600")

	_, _ = io.Copy(w, out.Body)
}

// shouldForceDownload returns true for filename extensions that we don't want
// browsers to render inline (e.g. raw binaries). Viewable types stay inline.
func shouldForceDownload(filename string) bool {
	viewable := []string{".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".pdf", ".txt", ".json", ".html", ".htm", ".md", ".css", ".js", ".mp4", ".webm", ".ogg", ".mp3", ".wav", ".flac"}
	lower := strings.ToLower(filename)
	for _, ext := range viewable {
		if strings.HasSuffix(lower, ext) {
			return false
		}
	}
	return true
}

func escapeQuotes(s string) string {
	return strings.ReplaceAll(s, `"`, `\"`)
}
