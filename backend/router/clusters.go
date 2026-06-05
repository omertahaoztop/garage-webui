package router

import (
	"encoding/json"
	"khairul169/garage-webui/utils"
	"net/http"
)

type Clusters struct{}

// GetAll returns the redacted list of configured clusters.
func (c *Clusters) GetAll(w http.ResponseWriter, r *http.Request) {
	utils.ResponseSuccess(w, map[string]interface{}{
		"clusters":  utils.Clusters.Public(),
		"defaultId": utils.Clusters.DefaultID(),
	})
}

// TestConnection probes a cluster's admin API to ensure the token + endpoint
// are usable. Calls GetClusterHealth and returns its payload (or the error).
func (c *Clusters) TestConnection(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	cl, ok := utils.Clusters.Get(id)
	if !ok {
		utils.ResponseErrorStatus(w, errClusterNotFound(id), http.StatusNotFound)
		return
	}

	body, err := cl.Fetch("/v2/GetClusterHealth", &utils.FetchOptions{})
	if err != nil {
		utils.ResponseSuccess(w, map[string]interface{}{
			"id":    cl.ID,
			"ok":    false,
			"error": err.Error(),
		})
		return
	}

	var health map[string]interface{}
	if err := json.Unmarshal(body, &health); err != nil {
		utils.ResponseSuccess(w, map[string]interface{}{
			"id":    cl.ID,
			"ok":    true,
			"raw":   string(body),
			"error": "could not parse GetClusterHealth response",
		})
		return
	}

	utils.ResponseSuccess(w, map[string]interface{}{
		"id":     cl.ID,
		"ok":     true,
		"health": health,
	})
}

type clusterNotFoundErr struct{ id string }

func (e *clusterNotFoundErr) Error() string { return "cluster not found: " + e.id }

func errClusterNotFound(id string) error { return &clusterNotFoundErr{id: id} }
