package router

import (
	"encoding/json"
	"fmt"
	"khairul169/garage-webui/utils"
	"net/http"
	"strings"
)

type Repair struct{}

// repairTypes mirrors the Garage v2 RepairType enum (string variants only;
// the scrub variant is an object handled separately by the frontend).
var repairTypes = map[string]bool{
	"tables":           true,
	"blocks":           true,
	"versions":         true,
	"multipartUploads": true,
	"blockRefs":        true,
	"blockRc":          true,
	"rebalance":        true,
	"aliases":          true,
	"clearResyncQueue": true,
}

// Launch proxies POST /v2/LaunchRepairOperation?node=<n>.
// Body: { repairType: <string> } or { repairType: { scrub: <ScrubCommand> } }.
func (rp *Repair) Launch(w http.ResponseWriter, r *http.Request) {
	var body struct {
		RepairType json.RawMessage `json:"repairType"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		utils.ResponseError(w, fmt.Errorf("decode body: %w", err))
		return
	}
	if len(body.RepairType) == 0 {
		utils.ResponseErrorStatus(w, fmt.Errorf("repairType is required"), http.StatusBadRequest)
		return
	}

	// If repairType is a bare string, validate it against the known enum.
	var asString string
	if err := json.Unmarshal(body.RepairType, &asString); err == nil {
		if !repairTypes[asString] {
			utils.ResponseErrorStatus(w, fmt.Errorf("unknown repairType %q", asString), http.StatusBadRequest)
			return
		}
	}

	node := strings.TrimSpace(r.URL.Query().Get("node"))
	if node == "" {
		node = "*"
	}

	fanout(w, r, "/v2/LaunchRepairOperation", http.MethodPost, node, map[string]any{
		"repairType": body.RepairType,
	})
}

// Types returns the available repair types so the frontend doesn't hardcode them.
func (rp *Repair) Types(w http.ResponseWriter, r *http.Request) {
	types := make([]string, 0, len(repairTypes))
	for t := range repairTypes {
		types = append(types, t)
	}
	utils.ResponseSuccess(w, map[string]any{
		"types":    types,
		"hasScrub": true,
	})
}
