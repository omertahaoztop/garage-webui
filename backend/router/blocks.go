package router

import (
	"encoding/json"
	"fmt"
	"khairul169/garage-webui/utils"
	"net/http"
	"strings"
)

type Blocks struct{}

// ListErrors proxies GET /v2/ListBlockErrors?node=<n>.
func (b *Blocks) ListErrors(w http.ResponseWriter, r *http.Request) {
	fanout(w, r, "/v2/ListBlockErrors", http.MethodGet, workerNode(r), nil)
}

// GetInfo proxies POST /v2/GetBlockInfo?node=<n> with { blockHash }.
func (b *Blocks) GetInfo(w http.ResponseWriter, r *http.Request) {
	var body struct {
		BlockHash string `json:"blockHash"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		utils.ResponseError(w, fmt.Errorf("decode body: %w", err))
		return
	}
	if strings.TrimSpace(body.BlockHash) == "" {
		utils.ResponseErrorStatus(w, fmt.Errorf("blockHash is required"), http.StatusBadRequest)
		return
	}
	fanout(w, r, "/v2/GetBlockInfo", http.MethodPost, workerNode(r), body)
}

// RetryResync proxies POST /v2/RetryBlockResync?node=<n>.
// Body is either { all: true } or { blockHashes: [...] }.
func (b *Blocks) RetryResync(w http.ResponseWriter, r *http.Request) {
	var body map[string]any
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		utils.ResponseError(w, fmt.Errorf("decode body: %w", err))
		return
	}
	_, hasAll := body["all"]
	_, hasHashes := body["blockHashes"]
	if !hasAll && !hasHashes {
		utils.ResponseErrorStatus(w, fmt.Errorf("either 'all' or 'blockHashes' is required"), http.StatusBadRequest)
		return
	}
	fanout(w, r, "/v2/RetryBlockResync", http.MethodPost, workerNode(r), body)
}

// Purge proxies POST /v2/PurgeBlocks?node=<n> with a JSON array of block hashes.
// DESTRUCTIVE — frontend must gate this behind explicit type-to-confirm.
func (b *Blocks) Purge(w http.ResponseWriter, r *http.Request) {
	var hashes []string
	if err := json.NewDecoder(r.Body).Decode(&hashes); err != nil {
		utils.ResponseError(w, fmt.Errorf("decode body (expected array of block hashes): %w", err))
		return
	}
	if len(hashes) == 0 {
		utils.ResponseErrorStatus(w, fmt.Errorf("no block hashes provided"), http.StatusBadRequest)
		return
	}
	fanout(w, r, "/v2/PurgeBlocks", http.MethodPost, workerNode(r), hashes)
}
