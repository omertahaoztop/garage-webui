package utils

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"khairul169/garage-webui/schema"
	"log"
	"net/http"
	"os"
	"strings"
	"sync"

	"github.com/pelletier/go-toml/v2"
	"gopkg.in/yaml.v3"
)

// -----------------------------------------------------------------------------
// Cluster — a resolved Garage endpoint (admin + S3) plus its raw TOML config
// (only populated in single-cluster env-var/TOML mode, may be empty in YAML
// multi-cluster mode).
// -----------------------------------------------------------------------------

type Cluster struct {
	ID         string
	Name       string
	AdminURL   string
	AdminToken string // secret — never JSON-serialised
	S3Endpoint string
	S3Region   string
	// TomlConfig is only populated when the cluster was bootstrapped from a
	// local /etc/garage.toml in single-cluster mode. Multi-cluster YAML mode
	// leaves this zero-valued; the /api/admin/config endpoint will degrade
	// gracefully.
	TomlConfig schema.Config
}

// Public returns a redacted view safe for the API.
func (c *Cluster) Public(isDefault bool) schema.ClusterPublic {
	return schema.ClusterPublic{
		ID:         c.ID,
		Name:       c.Name,
		AdminURL:   c.AdminURL,
		S3Endpoint: c.S3Endpoint,
		S3Region:   c.S3Region,
		IsDefault:  isDefault,
		HasToken:   c.AdminToken != "",
	}
}

// FetchOptions mirrors the old utils.FetchOptions; kept here so multi-cluster
// code can stay self-contained.
type FetchOptions struct {
	Method  string
	Params  map[string]string
	Body    interface{}
	Headers map[string]string
}

// Fetch issues an HTTP request against the cluster's admin API.
func (c *Cluster) Fetch(url string, options *FetchOptions) ([]byte, error) {
	if options == nil {
		options = &FetchOptions{}
	}

	if c.AdminURL == "" {
		return nil, fmt.Errorf("cluster %q has no admin URL configured", c.ID)
	}

	var reqBody io.Reader
	reqURL := fmt.Sprintf("%s%s", strings.TrimRight(c.AdminURL, "/"), url)
	method := http.MethodGet

	if len(options.Method) > 0 {
		method = options.Method
	}

	if options.Body != nil {
		body, err := json.Marshal(options.Body)
		if err != nil {
			return nil, err
		}
		reqBody = bytes.NewBuffer(body)
	}

	req, err := http.NewRequest(method, reqURL, reqBody)
	if err != nil {
		return nil, err
	}

	if options.Params != nil {
		q := req.URL.Query()
		for k, v := range options.Params {
			q.Add(k, v)
		}
		req.URL.RawQuery = q.Encode()
	}

	if c.AdminToken != "" {
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", c.AdminToken))
	}

	if options.Headers != nil {
		for k, v := range options.Headers {
			req.Header.Add(k, v)
		}
	}

	client := &http.Client{}
	res, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	if res.Body != nil {
		defer res.Body.Close()
	}

	if res.StatusCode < 200 || res.StatusCode >= 300 {
		body, _ := io.ReadAll(res.Body)
		var data map[string]interface{}
		message := fmt.Sprintf("unexpected status code: %d", res.StatusCode)
		if len(body) > 0 {
			if err := json.Unmarshal(body, &data); err == nil {
				if data["message"] != nil {
					message = fmt.Sprintf("%v", data["message"])
				}
			}
		}
		return nil, errors.New(message)
	}

	body, err := io.ReadAll(res.Body)
	if err != nil {
		return nil, err
	}
	return body, nil
}

// GetAdminEndpoint returns the cluster's admin URL (compat shim).
func (c *Cluster) GetAdminEndpoint() string { return c.AdminURL }

// GetAdminKey returns the cluster's admin token (compat shim).
func (c *Cluster) GetAdminKey() string { return c.AdminToken }

// GetS3Endpoint returns the cluster's S3 endpoint (compat shim).
func (c *Cluster) GetS3Endpoint() string { return c.S3Endpoint }

// GetS3Region returns the cluster's S3 region (compat shim).
func (c *Cluster) GetS3Region() string {
	if c.S3Region != "" {
		return c.S3Region
	}
	return "garage"
}

// -----------------------------------------------------------------------------
// Registry — owns all loaded clusters and the default selection.
// -----------------------------------------------------------------------------

type ClusterRegistry struct {
	mu         sync.RWMutex
	clusters   []*Cluster
	byID       map[string]*Cluster
	defaultID  string
	loadedFile string // path of CLUSTERS_CONFIG file, empty in env-var mode
}

// Clusters is the process-wide registry. Populated by LoadClusterRegistry().
var Clusters = &ClusterRegistry{
	byID: map[string]*Cluster{},
}

// LoadClusterRegistry initialises the registry. Priority:
//  1. CLUSTERS_CONFIG env-var pointing at a YAML file → multi-cluster mode.
//  2. Otherwise → single-cluster mode synthesised from API_BASE_URL /
//     API_ADMIN_KEY / S3_ENDPOINT_URL / S3_REGION + optional CONFIG_PATH
//     TOML file (kept for backward compatibility).
func LoadClusterRegistry() error {
	Clusters.mu.Lock()
	defer Clusters.mu.Unlock()

	Clusters.clusters = nil
	Clusters.byID = map[string]*Cluster{}
	Clusters.defaultID = ""
	Clusters.loadedFile = ""

	if path := os.Getenv("CLUSTERS_CONFIG"); path != "" {
		return loadFromYAML(path)
	}
	return loadSingleClusterMode()
}

func loadFromYAML(path string) error {
	data, err := os.ReadFile(path)
	if err != nil {
		return fmt.Errorf("CLUSTERS_CONFIG=%q unreadable: %w", path, err)
	}

	var file schema.ClustersFile
	if err := yaml.Unmarshal(data, &file); err != nil {
		return fmt.Errorf("CLUSTERS_CONFIG=%q invalid YAML: %w", path, err)
	}

	if len(file.Clusters) == 0 {
		return fmt.Errorf("CLUSTERS_CONFIG=%q has no clusters", path)
	}

	seen := map[string]bool{}
	for i, c := range file.Clusters {
		if c.ID == "" {
			return fmt.Errorf("cluster #%d in %s has empty id", i, path)
		}
		if seen[c.ID] {
			return fmt.Errorf("cluster id %q in %s is duplicated", c.ID, path)
		}
		seen[c.ID] = true

		token := c.AdminToken
		if token == "" && c.AdminTokenEnv != "" {
			token = os.Getenv(c.AdminTokenEnv)
		}

		name := c.Name
		if name == "" {
			name = c.ID
		}

		region := c.S3Region
		if region == "" {
			region = "garage"
		}

		cl := &Cluster{
			ID:         c.ID,
			Name:       name,
			AdminURL:   strings.TrimRight(c.AdminURL, "/"),
			AdminToken: token,
			S3Endpoint: strings.TrimRight(c.S3Endpoint, "/"),
			S3Region:   region,
		}
		Clusters.clusters = append(Clusters.clusters, cl)
		Clusters.byID[c.ID] = cl
	}

	Clusters.defaultID = file.Default
	if Clusters.defaultID == "" {
		Clusters.defaultID = Clusters.clusters[0].ID
	} else if _, ok := Clusters.byID[Clusters.defaultID]; !ok {
		return fmt.Errorf("default cluster id %q in %s does not match any cluster", Clusters.defaultID, path)
	}

	Clusters.loadedFile = path
	log.Printf("Loaded %d cluster(s) from %s (default=%s)", len(Clusters.clusters), path, Clusters.defaultID)
	return nil
}

func loadSingleClusterMode() error {
	adminURL := os.Getenv("API_BASE_URL")
	adminToken := os.Getenv("API_ADMIN_KEY")
	s3Endpoint := os.Getenv("S3_ENDPOINT_URL")
	s3Region := GetEnv("S3_REGION", "")

	// Optional: try to load /etc/garage.toml for backward-compatible single
	// cluster mode. If it succeeds, env vars still take precedence.
	var tomlCfg schema.Config
	cfgPath := GetEnv("CONFIG_PATH", "/etc/garage.toml")
	if data, err := os.ReadFile(cfgPath); err == nil {
		if err := toml.Unmarshal(data, &tomlCfg); err != nil {
			log.Printf("Cannot parse %s: %v", cfgPath, err)
		}
	}

	if adminURL == "" && tomlCfg.RPCPublicAddr != "" && tomlCfg.Admin.APIBindAddr != "" {
		host := strings.Split(tomlCfg.RPCPublicAddr, ":")[0]
		parts := strings.Split(tomlCfg.Admin.APIBindAddr, ":")
		port := parts[len(parts)-1]
		adminURL = fmt.Sprintf("http://%s:%s", host, port)
	}
	if s3Endpoint == "" && tomlCfg.RPCPublicAddr != "" && tomlCfg.S3API.APIBindAddr != "" {
		host := strings.Split(tomlCfg.RPCPublicAddr, ":")[0]
		parts := strings.Split(tomlCfg.S3API.APIBindAddr, ":")
		port := parts[len(parts)-1]
		s3Endpoint = fmt.Sprintf("http://%s:%s", host, port)
	}
	if adminToken == "" {
		adminToken = tomlCfg.Admin.AdminToken
	}
	if s3Region == "" {
		s3Region = tomlCfg.S3API.S3Region
	}
	if s3Region == "" {
		s3Region = "garage"
	}

	cl := &Cluster{
		ID:         "default",
		Name:       "Default",
		AdminURL:   strings.TrimRight(adminURL, "/"),
		AdminToken: adminToken,
		S3Endpoint: strings.TrimRight(s3Endpoint, "/"),
		S3Region:   s3Region,
		TomlConfig: tomlCfg,
	}
	Clusters.clusters = append(Clusters.clusters, cl)
	Clusters.byID[cl.ID] = cl
	Clusters.defaultID = cl.ID

	if adminURL == "" {
		log.Printf("Single-cluster mode: API_BASE_URL not set and TOML config missing or incomplete; admin API unreachable")
	} else {
		log.Printf("Single-cluster mode: id=%s admin=%s s3=%s", cl.ID, cl.AdminURL, cl.S3Endpoint)
	}
	return nil
}

// All returns a snapshot of every registered cluster (pointer slice, safe to
// iterate while holding nothing).
func (r *ClusterRegistry) All() []*Cluster {
	r.mu.RLock()
	defer r.mu.RUnlock()
	out := make([]*Cluster, len(r.clusters))
	copy(out, r.clusters)
	return out
}

// Get returns the cluster with the given ID and a bool indicating found.
func (r *ClusterRegistry) Get(id string) (*Cluster, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	c, ok := r.byID[id]
	return c, ok
}

// Default returns the default cluster, or nil if the registry is empty.
func (r *ClusterRegistry) Default() *Cluster {
	r.mu.RLock()
	defer r.mu.RUnlock()
	if r.defaultID == "" {
		return nil
	}
	return r.byID[r.defaultID]
}

// DefaultID returns the configured default cluster id.
func (r *ClusterRegistry) DefaultID() string {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.defaultID
}

// Public returns the redacted JSON-safe list of clusters.
func (r *ClusterRegistry) Public() []schema.ClusterPublic {
	r.mu.RLock()
	defer r.mu.RUnlock()
	out := make([]schema.ClusterPublic, 0, len(r.clusters))
	for _, c := range r.clusters {
		out = append(out, c.Public(c.ID == r.defaultID))
	}
	return out
}

// -----------------------------------------------------------------------------
// Request-scoped cluster selection
// -----------------------------------------------------------------------------

type clusterContextKey struct{}

const ClusterHeader = "X-Cluster-Id"

// WithCluster attaches the resolved cluster to a request context.
func WithCluster(ctx context.Context, cl *Cluster) context.Context {
	return context.WithValue(ctx, clusterContextKey{}, cl)
}

// ClusterFromContext returns the cluster previously set via WithCluster, or
// nil if none was attached (callers should fall back to the default).
func ClusterFromContext(ctx context.Context) *Cluster {
	if v := ctx.Value(clusterContextKey{}); v != nil {
		if cl, ok := v.(*Cluster); ok {
			return cl
		}
	}
	return nil
}

// GetCluster returns the cluster associated with the request. Resolution
// order:
//  1. Cluster attached via middleware (context).
//  2. X-Cluster-Id header on the request itself (defensive — middleware
//     should normally do this).
//  3. Default cluster.
func GetCluster(r *http.Request) *Cluster {
	if cl := ClusterFromContext(r.Context()); cl != nil {
		return cl
	}
	if id := r.Header.Get(ClusterHeader); id != "" {
		if cl, ok := Clusters.Get(id); ok {
			return cl
		}
	}
	return Clusters.Default()
}
