package router

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/json"
	"fmt"
	"io"
	"khairul169/garage-webui/utils"
	"net/http"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

type Speedtest struct{}

type speedtestResult struct {
	SizeBytes    int64   `json:"sizeBytes"`
	PutSeconds   float64 `json:"putSeconds"`
	GetSeconds   float64 `json:"getSeconds"`
	PutMBps      float64 `json:"putMBps"`
	GetMBps      float64 `json:"getMBps"`
	PutLatencyMs float64 `json:"putLatencyMs"`
	GetLatencyMs float64 `json:"getLatencyMs"`
}

// allowedSizes caps the speedtest payload to protect the cluster from abuse.
var allowedSizes = map[int64]bool{
	1 << 10:   true, // 1 KiB
	1 << 20:   true, // 1 MiB
	10 << 20:  true, // 10 MiB
	100 << 20: true, // 100 MiB
}

// Run uploads a random payload, downloads it back, measures throughput, then
// deletes it. Requires ?bucket=<name> with a read+write key (reuses the same
// credential resolution as the object browser).
func (st *Speedtest) Run(w http.ResponseWriter, r *http.Request) {
	bucket := r.URL.Query().Get("bucket")
	if bucket == "" {
		utils.ResponseErrorStatus(w, fmt.Errorf("bucket is required"), http.StatusBadRequest)
		return
	}

	var size int64 = 1 << 20
	if s := r.URL.Query().Get("size"); s != "" {
		var parsed int64
		if _, err := fmt.Sscan(s, &parsed); err == nil {
			size = parsed
		}
	}
	if !allowedSizes[size] {
		utils.ResponseErrorStatus(w, fmt.Errorf("size must be one of 1024, 1048576, 10485760, 104857600 bytes"), http.StatusBadRequest)
		return
	}

	client, err := getS3Client(r, bucket)
	if err != nil {
		utils.ResponseError(w, err)
		return
	}

	payload := make([]byte, size)
	if _, err := rand.Read(payload); err != nil {
		utils.ResponseError(w, fmt.Errorf("generate payload: %w", err))
		return
	}

	key := fmt.Sprintf(".speedtest/%d-%d.bin", time.Now().UnixNano(), size)
	ctx, cancel := context.WithTimeout(r.Context(), 2*time.Minute)
	defer cancel()

	// PUT
	putStart := time.Now()
	_, err = client.PutObject(ctx, &s3.PutObjectInput{
		Bucket: aws.String(bucket),
		Key:    aws.String(key),
		Body:   bytes.NewReader(payload),
	})
	putDur := time.Since(putStart)
	if err != nil {
		utils.ResponseError(w, fmt.Errorf("speedtest PUT failed: %w", err))
		return
	}

	// GET
	getStart := time.Now()
	out, err := client.GetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(bucket),
		Key:    aws.String(key),
	})
	if err != nil {
		_ = st.cleanup(ctx, client, bucket, key)
		utils.ResponseError(w, fmt.Errorf("speedtest GET failed: %w", err))
		return
	}
	n, _ := io.Copy(io.Discard, out.Body)
	out.Body.Close()
	getDur := time.Since(getStart)

	_ = st.cleanup(ctx, client, bucket, key)

	mib := float64(size) / (1 << 20)
	result := speedtestResult{
		SizeBytes:    size,
		PutSeconds:   putDur.Seconds(),
		GetSeconds:   getDur.Seconds(),
		PutLatencyMs: float64(putDur.Microseconds()) / 1000.0,
		GetLatencyMs: float64(getDur.Microseconds()) / 1000.0,
	}
	if putDur.Seconds() > 0 {
		result.PutMBps = mib / putDur.Seconds()
	}
	if getDur.Seconds() > 0 {
		result.GetMBps = (float64(n) / (1 << 20)) / getDur.Seconds()
	}

	b, _ := json.Marshal(result)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(b)
}

func (st *Speedtest) cleanup(ctx context.Context, client *s3.Client, bucket, key string) error {
	_, err := client.DeleteObject(ctx, &s3.DeleteObjectInput{
		Bucket: aws.String(bucket),
		Key:    aws.String(key),
	})
	return err
}
