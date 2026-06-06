package schema

// ClusterConfig describes a single Garage cluster entry, either loaded from
// a YAML registry file (CLUSTERS_CONFIG) or synthesised from env vars for
// backward-compatible single-cluster mode.
type ClusterConfig struct {
	ID               string `yaml:"id" json:"id"`
	Name             string `yaml:"name" json:"name"`
	AdminURL         string `yaml:"admin_url" json:"adminUrl"`
	AdminToken       string `yaml:"admin_token" json:"-"`
	AdminTokenEnv    string `yaml:"admin_token_env" json:"-"`
	S3Endpoint       string `yaml:"s3_endpoint" json:"s3Endpoint"`
	S3PublicEndpoint string `yaml:"s3_public_endpoint" json:"s3PublicEndpoint"`
	S3Region         string `yaml:"s3_region" json:"s3Region"`
}

// ClustersFile is the on-disk YAML schema parsed from CLUSTERS_CONFIG.
type ClustersFile struct {
	Clusters []ClusterConfig `yaml:"clusters"`
	Default  string          `yaml:"default"`
}

// ClusterPublic is the safe-for-API view of a cluster (no tokens).
type ClusterPublic struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	AdminURL   string `json:"adminUrl"`
	S3Endpoint       string `json:"s3Endpoint"`
	S3PublicEndpoint string `json:"s3PublicEndpoint"`
	S3Region   string `json:"s3Region"`
	IsDefault  bool   `json:"isDefault"`
	HasToken   bool   `json:"hasToken"`
}
