package router

import (
	"encoding/json"
	"fmt"
	"khairul169/garage-webui/utils"
	"net/http"
	"strings"
)

type Workers struct{}

// node resolves the target node query param, defaulting to "*" (all nodes)
// for read operations. Garage worker/block ops require an explicit node param.
func workerNode(r *http.Request) string {
	node := strings.TrimSpace(r.URL.Query().Get("node"))
	if node == "" {
		return "*"
	}
	return node
}

// fanout issues a worker/block admin op against one or all nodes and returns
// the raw MultiResponse { success: {nodeId: ...}, error: {nodeId: ...} } body
// unchanged so the frontend can render per-node results.
func fanout(w http.ResponseWriter, r *http.Request, op, method, node string, body any) {
	cluster := utils.GetCluster(r)
	if cluster == nil {
		utils.ResponseErrorStatus(w, fmt.Errorf("no active cluster"), http.StatusBadRequest)
		return
	}

	data, err := cluster.Fetch(op, &utils.FetchOptions{
		Method: method,
		Params: map[string]string{"node": node},
		Body:   body,
	})
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

// List proxies POST /v2/ListWorkers?node=<n>. Optional busyOnly/errorOnly in body.
func (wk *Workers) List(w http.ResponseWriter, r *http.Request) {
	var filter struct {
		BusyOnly  bool `json:"busyOnly"`
		ErrorOnly bool `json:"errorOnly"`
	}
	if r.Body != nil && r.ContentLength != 0 {
		_ = json.NewDecoder(r.Body).Decode(&filter)
	}
	fanout(w, r, "/v2/ListWorkers", http.MethodPost, workerNode(r), filter)
}

// GetInfo proxies POST /v2/GetWorkerInfo?node=<n> with { id }.
func (wk *Workers) GetInfo(w http.ResponseWriter, r *http.Request) {
	var body struct {
		ID int `json:"id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		utils.ResponseError(w, fmt.Errorf("decode body: %w", err))
		return
	}
	fanout(w, r, "/v2/GetWorkerInfo", http.MethodPost, workerNode(r), body)
}

// GetVariable proxies POST /v2/GetWorkerVariable?node=<n> with { variable }.
func (wk *Workers) GetVariable(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Variable *string `json:"variable"`
	}
	if r.Body != nil && r.ContentLength != 0 {
		_ = json.NewDecoder(r.Body).Decode(&body)
	}
	fanout(w, r, "/v2/GetWorkerVariable", http.MethodPost, workerNode(r), body)
}

// SetVariable proxies POST /v2/SetWorkerVariable?node=<n> with { variable, value }.
func (wk *Workers) SetVariable(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Variable string `json:"variable"`
		Value    string `json:"value"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		utils.ResponseError(w, fmt.Errorf("decode body: %w", err))
		return
	}
	if strings.TrimSpace(body.Variable) == "" {
		utils.ResponseErrorStatus(w, fmt.Errorf("variable name is required"), http.StatusBadRequest)
		return
	}
	fanout(w, r, "/v2/SetWorkerVariable", http.MethodPost, workerNode(r), body)
}
