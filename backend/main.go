package main

import (
	"fmt"
	"khairul169/garage-webui/router"
	"khairul169/garage-webui/ui"
	"khairul169/garage-webui/utils"
	"log"
	"net/http"
	"os"

	"github.com/joho/godotenv"
)

func main() {
	// Initialize app
	godotenv.Load()
	utils.InitCacheManager()
	sessionMgr := utils.InitSessionManager()

	// Initialise cluster registry. Falls back to single-cluster env-var mode
	// if CLUSTERS_CONFIG is not set; never fatal so the server can still
	// boot and report the misconfiguration via /api/clusters.
	if err := utils.LoadClusterRegistry(); err != nil {
		log.Printf("Cluster registry load error: %v", err)
	}

	// Initialise OIDC provider (optional). No-op unless OIDC_CONFIG is set and
	// the file enables OIDC. Never fatal so bcrypt login keeps working.
	if err := utils.LoadOIDC(); err != nil {
		log.Printf("OIDC load error: %v", err)
	}

	basePath := os.Getenv("BASE_PATH")
	mux := http.NewServeMux()

	// Serve API
	apiPrefix := basePath + "/api"
	mux.Handle(apiPrefix+"/", http.StripPrefix(apiPrefix, router.HandleApiRouter()))

	// Static files
	ui.ServeUI(mux)

	// Redirect to UI if BASE_PATH is set
	if basePath != "" {
		mux.Handle("/", http.RedirectHandler(basePath, http.StatusMovedPermanently))
	}

	host := utils.GetEnv("HOST", "0.0.0.0")
	port := utils.GetEnv("PORT", "3909")

	addr := fmt.Sprintf("%s:%s", host, port)
	log.Printf("Starting server on http://%s", addr)

	if err := http.ListenAndServe(addr, sessionMgr.LoadAndSave(mux)); err != nil {
		log.Fatal(err)
	}
}
