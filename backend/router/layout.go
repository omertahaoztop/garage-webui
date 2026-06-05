package router

import (
	"encoding/json"
	"fmt"
	"khairul169/garage-webui/utils"
	"net/http"
)

type Layout struct{}

// passthrough fetches an admin operation and returns its raw JSON body to the
// client unchanged. Used for layout operations whose Garage v2 response shape
// is already exactly what the frontend consumes.
func (l *Layout) passthrough(w http.ResponseWriter, r *http.Request, op, method string, body any) {
	cluster := utils.GetCluster(r)
	if cluster == nil {
		utils.ResponseErrorStatus(w, fmt.Errorf("no active cluster"), http.StatusBadRequest)
		return
	}

	data, err := cluster.Fetch(op, &utils.FetchOptions{Method: method, Body: body})
	if err != nil {
		utils.ResponseError(w, fmt.Errorf("%s: %w", op, err))
		return
	}

	var raw json.RawMessage
	if len(data) == 0 {
		raw = json.RawMessage("{}")
	} else {
		raw = json.RawMessage(data)
	}
	utils.ResponseSuccess(w, raw)
}

func (l *Layout) decodeBody(r *http.Request) (map[string]any, error) {
	if r.Body == nil || r.ContentLength == 0 {
		return map[string]any{}, nil
	}
	var body map[string]any
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		return nil, err
	}
	return body, nil
}

// Get returns the current cluster layout including staged changes.
func (l *Layout) Get(w http.ResponseWriter, r *http.Request) {
	l.passthrough(w, r, "/v2/GetClusterLayout", http.MethodGet, nil)
}

// Update stages role changes (UpdateClusterLayout).
func (l *Layout) Update(w http.ResponseWriter, r *http.Request) {
	body, err := l.decodeBody(r)
	if err != nil {
		utils.ResponseError(w, fmt.Errorf("decode body: %w", err))
		return
	}
	l.passthrough(w, r, "/v2/UpdateClusterLayout", http.MethodPost, body)
}

// Preview runs PreviewClusterLayoutChanges (what-if calculator).
func (l *Layout) Preview(w http.ResponseWriter, r *http.Request) {
	l.passthrough(w, r, "/v2/PreviewClusterLayoutChanges", http.MethodPost, nil)
}

// Apply commits staged changes (ApplyClusterLayout) — requires target version.
func (l *Layout) Apply(w http.ResponseWriter, r *http.Request) {
	body, err := l.decodeBody(r)
	if err != nil {
		utils.ResponseError(w, fmt.Errorf("decode body: %w", err))
		return
	}
	if _, ok := body["version"]; !ok {
		utils.ResponseErrorStatus(w, fmt.Errorf("version is required to apply layout"), http.StatusBadRequest)
		return
	}
	l.passthrough(w, r, "/v2/ApplyClusterLayout", http.MethodPost, body)
}

// Revert discards staged changes (RevertClusterLayout).
func (l *Layout) Revert(w http.ResponseWriter, r *http.Request) {
	l.passthrough(w, r, "/v2/RevertClusterLayout", http.MethodPost, nil)
}

// History returns the layout version timeline.
func (l *Layout) History(w http.ResponseWriter, r *http.Request) {
	l.passthrough(w, r, "/v2/GetClusterLayoutHistory", http.MethodGet, nil)
}

// SkipDeadNodes forces a layout transition past unresponsive nodes (DANGEROUS).
func (l *Layout) SkipDeadNodes(w http.ResponseWriter, r *http.Request) {
	body, err := l.decodeBody(r)
	if err != nil {
		utils.ResponseError(w, fmt.Errorf("decode body: %w", err))
		return
	}
	l.passthrough(w, r, "/v2/ClusterLayoutSkipDeadNodes", http.MethodPost, body)
}
