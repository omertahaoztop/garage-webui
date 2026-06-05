package router

import (
	"encoding/json"
	"fmt"
	"khairul169/garage-webui/utils"
	"net/http"
	"strings"
)

type AdminTokens struct{}

// adminTokenInfo mirrors Garage v2 GetAdminTokenInfoResponse.
type adminTokenInfo struct {
	ID         *string  `json:"id"`
	Name       string   `json:"name"`
	Created    *string  `json:"created"`
	Expiration *string  `json:"expiration"`
	Expired    bool     `json:"expired"`
	Scope      []string `json:"scope"`
}

// updateAdminTokenBody mirrors Garage v2 UpdateAdminTokenRequestBody.
type updateAdminTokenBody struct {
	Name         *string  `json:"name"`
	Expiration   *string  `json:"expiration"`
	NeverExpires bool     `json:"neverExpires"`
	Scope        []string `json:"scope"`
}

// List proxies GET /v2/ListAdminTokens.
func (a *AdminTokens) List(w http.ResponseWriter, r *http.Request) {
	cluster := utils.GetCluster(r)
	if cluster == nil {
		utils.ResponseErrorStatus(w, fmt.Errorf("no active cluster"), http.StatusBadRequest)
		return
	}

	body, err := cluster.Fetch("/v2/ListAdminTokens", &utils.FetchOptions{})
	if err != nil {
		utils.ResponseError(w, fmt.Errorf("list admin tokens: %w", err))
		return
	}

	var tokens []adminTokenInfo
	if err := json.Unmarshal(body, &tokens); err != nil {
		utils.ResponseError(w, fmt.Errorf("parse admin tokens: %w", err))
		return
	}
	utils.ResponseSuccess(w, map[string]any{"tokens": tokens})
}

// Create proxies POST /v2/CreateAdminToken. Returns the secret exactly once.
func (a *AdminTokens) Create(w http.ResponseWriter, r *http.Request) {
	cluster := utils.GetCluster(r)
	if cluster == nil {
		utils.ResponseErrorStatus(w, fmt.Errorf("no active cluster"), http.StatusBadRequest)
		return
	}

	var in updateAdminTokenBody
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		utils.ResponseError(w, fmt.Errorf("decode body: %w", err))
		return
	}
	if in.Name == nil || strings.TrimSpace(*in.Name) == "" {
		utils.ResponseErrorStatus(w, fmt.Errorf("token name is required"), http.StatusBadRequest)
		return
	}

	body, err := cluster.Fetch("/v2/CreateAdminToken", &utils.FetchOptions{
		Method: http.MethodPost,
		Body:   in,
	})
	if err != nil {
		utils.ResponseError(w, fmt.Errorf("create admin token: %w", err))
		return
	}

	var raw map[string]any
	if err := json.Unmarshal(body, &raw); err != nil {
		utils.ResponseError(w, fmt.Errorf("parse create response: %w", err))
		return
	}
	utils.ResponseSuccess(w, raw)
}

// Update proxies POST /v2/UpdateAdminToken?id=<id>.
func (a *AdminTokens) Update(w http.ResponseWriter, r *http.Request) {
	cluster := utils.GetCluster(r)
	if cluster == nil {
		utils.ResponseErrorStatus(w, fmt.Errorf("no active cluster"), http.StatusBadRequest)
		return
	}

	id := r.PathValue("id")
	if id == "" {
		utils.ResponseErrorStatus(w, fmt.Errorf("token id is required"), http.StatusBadRequest)
		return
	}

	var in updateAdminTokenBody
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		utils.ResponseError(w, fmt.Errorf("decode body: %w", err))
		return
	}

	body, err := cluster.Fetch("/v2/UpdateAdminToken", &utils.FetchOptions{
		Method: http.MethodPost,
		Params: map[string]string{"id": id},
		Body:   in,
	})
	if err != nil {
		utils.ResponseError(w, fmt.Errorf("update admin token: %w", err))
		return
	}

	var raw map[string]any
	if err := json.Unmarshal(body, &raw); err != nil {
		utils.ResponseError(w, fmt.Errorf("parse update response: %w", err))
		return
	}
	utils.ResponseSuccess(w, raw)
}

// Delete proxies POST /v2/DeleteAdminToken?id=<id>.
func (a *AdminTokens) Delete(w http.ResponseWriter, r *http.Request) {
	cluster := utils.GetCluster(r)
	if cluster == nil {
		utils.ResponseErrorStatus(w, fmt.Errorf("no active cluster"), http.StatusBadRequest)
		return
	}

	id := r.PathValue("id")
	if id == "" {
		utils.ResponseErrorStatus(w, fmt.Errorf("token id is required"), http.StatusBadRequest)
		return
	}

	if _, err := cluster.Fetch("/v2/DeleteAdminToken", &utils.FetchOptions{
		Method: http.MethodPost,
		Params: map[string]string{"id": id},
	}); err != nil {
		utils.ResponseError(w, fmt.Errorf("delete admin token: %w", err))
		return
	}
	utils.ResponseSuccess(w, map[string]any{"deleted": id})
}

// Current proxies GET /v2/GetCurrentAdminTokenInfo (whoami).
func (a *AdminTokens) Current(w http.ResponseWriter, r *http.Request) {
	cluster := utils.GetCluster(r)
	if cluster == nil {
		utils.ResponseErrorStatus(w, fmt.Errorf("no active cluster"), http.StatusBadRequest)
		return
	}

	body, err := cluster.Fetch("/v2/GetCurrentAdminTokenInfo", &utils.FetchOptions{})
	if err != nil {
		utils.ResponseError(w, fmt.Errorf("get current admin token: %w", err))
		return
	}

	var info adminTokenInfo
	if err := json.Unmarshal(body, &info); err != nil {
		utils.ResponseError(w, fmt.Errorf("parse current admin token: %w", err))
		return
	}
	utils.ResponseSuccess(w, info)
}
