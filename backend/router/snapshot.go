package router

import (
	"encoding/json"
	"fmt"
	"khairul169/garage-webui/utils"
	"net/http"
	"strings"
)

type Snapshot struct{}

// snapshotResponse mirrors the Garage v2 CreateMetadataSnapshot reply.
type snapshotResponse struct {
	Success map[string]any `json:"success"`
	Error   map[string]any `json:"error"`
}

type snapshotNode struct {
	ID       string `json:"id"`
	ShortID  string `json:"shortId"`
	Hostname string `json:"hostname,omitempty"`
	Zone     string `json:"zone,omitempty"`
	IsUp     bool   `json:"isUp"`
}

// Trigger fans out CreateMetadataSnapshot across one node (?node=<id|self>)
// or every node in the cluster (?node=* or no param). It always returns a
// summary { requestedNode, triggered[], failed{}, raw } so the UI can render
// per-node status even when some nodes fail.
func (s *Snapshot) Trigger(w http.ResponseWriter, r *http.Request) {
	cluster := utils.GetCluster(r)
	if cluster == nil {
		utils.ResponseErrorStatus(w, fmt.Errorf("no active cluster"), http.StatusBadRequest)
		return
	}

	node := strings.TrimSpace(r.URL.Query().Get("node"))
	if node == "" {
		node = "*"
	}

	body, err := cluster.Fetch("/v2/CreateMetadataSnapshot", &utils.FetchOptions{
		Method: http.MethodPost,
		Params: map[string]string{"node": node},
	})
	if err != nil {
		utils.ResponseError(w, fmt.Errorf("snapshot trigger failed: %w", err))
		return
	}

	var raw snapshotResponse
	if err := json.Unmarshal(body, &raw); err != nil {
		utils.ResponseError(w, fmt.Errorf("parse snapshot response: %w", err))
		return
	}

	triggered := make([]string, 0, len(raw.Success))
	for id := range raw.Success {
		triggered = append(triggered, id)
	}

	failed := raw.Error
	if failed == nil {
		failed = map[string]any{}
	}

	utils.ResponseSuccess(w, map[string]any{
		"requestedNode": node,
		"triggered":     triggered,
		"failed":        failed,
		"raw":           raw,
	})
}

// ListNodes returns the cluster nodes trimmed to fields the snapshot UI
// needs (id, shortId, hostname, zone, isUp). Mirrors a slice of
// GET /v2/GetClusterStatus so the frontend doesn't pull the heavy payload.
func (s *Snapshot) ListNodes(w http.ResponseWriter, r *http.Request) {
	cluster := utils.GetCluster(r)
	if cluster == nil {
		utils.ResponseErrorStatus(w, fmt.Errorf("no active cluster"), http.StatusBadRequest)
		return
	}

	body, err := cluster.Fetch("/v2/GetClusterStatus", &utils.FetchOptions{})
	if err != nil {
		utils.ResponseError(w, fmt.Errorf("get cluster status: %w", err))
		return
	}

	var status struct {
		Nodes []struct {
			ID       string `json:"id"`
			Hostname string `json:"hostname"`
			IsUp     bool   `json:"isUp"`
			Role     *struct {
				Zone string `json:"zone"`
			} `json:"role"`
		} `json:"nodes"`
	}
	if err := json.Unmarshal(body, &status); err != nil {
		utils.ResponseError(w, fmt.Errorf("parse cluster status: %w", err))
		return
	}

	nodes := make([]snapshotNode, 0, len(status.Nodes))
	for _, n := range status.Nodes {
		zone := ""
		if n.Role != nil {
			zone = n.Role.Zone
		}
		shortID := n.ID
		if len(shortID) > 16 {
			shortID = shortID[:16]
		}
		nodes = append(nodes, snapshotNode{
			ID:       n.ID,
			ShortID:  shortID,
			Hostname: n.Hostname,
			Zone:     zone,
			IsUp:     n.IsUp,
		})
	}

	utils.ResponseSuccess(w, map[string]any{"nodes": nodes})
}
