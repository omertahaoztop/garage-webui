package router

import (
	"encoding/json"
	"fmt"
	"khairul169/garage-webui/schema"
	"khairul169/garage-webui/utils"
	"net/http"
	"strings"
)

type Inspect struct{}

// resolveBucketID maps a global bucket alias to its Garage bucket id. If the
// caller already passed a 64-hex id it is returned unchanged.
func resolveBucketID(cluster *utils.Cluster, bucket string) (string, error) {
	bucket = strings.TrimSpace(bucket)
	if bucket == "" {
		return "", fmt.Errorf("bucket is required")
	}
	// Already a bucket id (Garage ids are 32-byte hex = 64 chars).
	if len(bucket) == 64 && isHex(bucket) {
		return bucket, nil
	}

	body, err := cluster.Fetch("/v2/GetBucketInfo?globalAlias="+bucket, &utils.FetchOptions{})
	if err != nil {
		return "", fmt.Errorf("resolve bucket %q: %w", bucket, err)
	}
	var info schema.Bucket
	if err := json.Unmarshal(body, &info); err != nil {
		return "", fmt.Errorf("parse bucket info: %w", err)
	}
	if info.ID == "" {
		return "", fmt.Errorf("bucket %q not found", bucket)
	}
	return info.ID, nil
}

func isHex(s string) bool {
	for _, c := range s {
		if (c < '0' || c > '9') && (c < 'a' || c > 'f') && (c < 'A' || c > 'F') {
			return false
		}
	}
	return true
}

// Object proxies GET /v2/InspectObject?bucketId=<id>&key=<key>. Accepts either
// a bucket id or a global alias via the `bucket` query param for convenience.
func (in *Inspect) Object(w http.ResponseWriter, r *http.Request) {
	cluster := utils.GetCluster(r)
	if cluster == nil {
		utils.ResponseErrorStatus(w, fmt.Errorf("no active cluster"), http.StatusBadRequest)
		return
	}

	key := r.URL.Query().Get("key")
	if strings.TrimSpace(key) == "" {
		utils.ResponseErrorStatus(w, fmt.Errorf("key is required"), http.StatusBadRequest)
		return
	}

	bucketRef := r.URL.Query().Get("bucketId")
	if bucketRef == "" {
		bucketRef = r.URL.Query().Get("bucket")
	}
	bucketID, err := resolveBucketID(cluster, bucketRef)
	if err != nil {
		utils.ResponseErrorStatus(w, err, http.StatusBadRequest)
		return
	}

	body, err := cluster.Fetch("/v2/InspectObject", &utils.FetchOptions{
		Params: map[string]string{
			"bucketId": bucketID,
			"key":      key,
		},
	})
	if err != nil {
		status := http.StatusInternalServerError
		if strings.Contains(strings.ToLower(err.Error()), "not found") {
			status = http.StatusNotFound
		}
		utils.ResponseErrorStatus(w, fmt.Errorf("inspect object: %w", err), status)
		return
	}

	var raw json.RawMessage = json.RawMessage(body)
	if len(body) == 0 {
		raw = json.RawMessage("{}")
	}
	utils.ResponseSuccess(w, raw)
}
