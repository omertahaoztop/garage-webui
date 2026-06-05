package router

import (
	"fmt"
	"io"
	"khairul169/garage-webui/utils"
	"net/http"
	"strings"
)

type Metrics struct{}

// Scrape proxies Garage's Prometheus /metrics endpoint and returns the raw
// text exposition format. Garage accepts either the dedicated metrics_token
// or a sufficiently-scoped admin token; we try the metrics token from the
// cluster's TOML config first, then fall back to the admin token.
func (m *Metrics) Scrape(w http.ResponseWriter, r *http.Request) {
	cluster := utils.GetCluster(r)
	if cluster == nil {
		utils.ResponseErrorStatus(w, fmt.Errorf("no active cluster"), http.StatusBadRequest)
		return
	}
	if cluster.AdminURL == "" {
		utils.ResponseErrorStatus(w, fmt.Errorf("cluster has no admin URL"), http.StatusBadRequest)
		return
	}

	token := cluster.TomlConfig.Admin.MetricsToken
	if token == "" {
		token = utils.GetEnv("API_METRICS_KEY", utils.GetEnv("METRICS_TOKEN", ""))
	}
	if token == "" {
		token = cluster.AdminToken
	}

	reqURL := strings.TrimRight(cluster.AdminURL, "/") + "/metrics"
	req, err := http.NewRequest(http.MethodGet, reqURL, nil)
	if err != nil {
		utils.ResponseError(w, fmt.Errorf("build metrics request: %w", err))
		return
	}
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}

	res, err := (&http.Client{}).Do(req)
	if err != nil {
		utils.ResponseError(w, fmt.Errorf("scrape metrics: %w", err))
		return
	}
	defer res.Body.Close()

	body, err := io.ReadAll(res.Body)
	if err != nil {
		utils.ResponseError(w, fmt.Errorf("read metrics: %w", err))
		return
	}
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		utils.ResponseErrorStatus(w, fmt.Errorf("metrics endpoint returned %d: %s", res.StatusCode, strings.TrimSpace(string(body))), res.StatusCode)
		return
	}

	w.Header().Set("Content-Type", "text/plain; version=0.0.4")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(body)
}
