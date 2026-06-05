package schema

// OIDCMapping maps an IdP group claim value to a set of clusters and
// permission scopes. Used to derive per-session authorization from group
// membership returned in the ID token.
type OIDCMapping struct {
	Group       string   `yaml:"group" json:"group"`
	Clusters    []string `yaml:"clusters" json:"clusters"`
	Permissions []string `yaml:"permissions" json:"permissions"`
}

// OIDCConfig is the on-disk YAML schema parsed from OIDC_CONFIG (or the inline
// `oidc:` block). When Enabled is false the UI shows only bcrypt login.
type OIDCConfig struct {
	Enabled         bool          `yaml:"enabled" json:"enabled"`
	Issuer          string        `yaml:"issuer" json:"issuer"`
	ClientID        string        `yaml:"client_id" json:"clientId"`
	ClientSecret    string        `yaml:"client_secret" json:"-"`
	ClientSecretEnv string        `yaml:"client_secret_env" json:"-"`
	RedirectURL     string        `yaml:"redirect_url" json:"redirectUrl"`
	Scopes          []string      `yaml:"scopes" json:"scopes"`
	GroupClaim      string        `yaml:"group_claim" json:"groupClaim"`
	Mappings        []OIDCMapping `yaml:"mappings" json:"-"`
}

// OIDCFile wraps the top-level `oidc:` key for YAML parsing.
type OIDCFile struct {
	OIDC OIDCConfig `yaml:"oidc"`
}

// OIDCStatus is the safe-for-API view (no secrets) returned to the login page
// so it knows whether to render the "Sign in with SSO" button.
type OIDCStatus struct {
	Enabled bool   `json:"enabled"`
	Issuer  string `json:"issuer,omitempty"`
}
