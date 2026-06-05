package router

import (
	"khairul169/garage-webui/utils"
	"net/http"
)

type Config struct{}

// GetAll returns the raw TOML-parsed Garage config for the active cluster.
// Only populated in single-cluster mode where the webui can read
// /etc/garage.toml. Multi-cluster YAML mode returns the zero value.
func (c *Config) GetAll(w http.ResponseWriter, r *http.Request) {
	cluster := utils.GetCluster(r)
	if cluster == nil {
		utils.ResponseSuccess(w, map[string]interface{}{})
		return
	}
	utils.ResponseSuccess(w, cluster.TomlConfig)
}
