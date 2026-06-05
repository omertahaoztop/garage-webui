package utils

import (
	"context"
	"fmt"
	"khairul169/garage-webui/schema"
	"log"
	"os"
	"sync"

	gooidc "github.com/coreos/go-oidc/v3/oidc"
	"golang.org/x/oauth2"
	"gopkg.in/yaml.v3"
)

// -----------------------------------------------------------------------------
// OIDC provider — optional. Initialised by LoadOIDC(); when disabled all the
// accessors return false / nil so the bcrypt path stays untouched.
// -----------------------------------------------------------------------------

type OIDCProvider struct {
	mu       sync.RWMutex
	cfg      schema.OIDCConfig
	enabled  bool
	provider *gooidc.Provider
	verifier *gooidc.IDTokenVerifier
	oauth    *oauth2.Config
}

// OIDC is the process-wide provider. Always non-nil; check Enabled().
var OIDC = &OIDCProvider{}

// LoadOIDC initialises the provider from OIDC_CONFIG (YAML path). When the env
// var is unset, or the file disables OIDC, the provider stays disabled and the
// app behaves exactly as before.
func LoadOIDC() error {
	OIDC.mu.Lock()
	defer OIDC.mu.Unlock()

	OIDC.enabled = false
	OIDC.provider = nil
	OIDC.verifier = nil
	OIDC.oauth = nil

	path := os.Getenv("OIDC_CONFIG")
	if path == "" {
		return nil
	}

	data, err := os.ReadFile(path)
	if err != nil {
		return fmt.Errorf("OIDC_CONFIG=%q unreadable: %w", path, err)
	}
	var file schema.OIDCFile
	if err := yaml.Unmarshal(data, &file); err != nil {
		return fmt.Errorf("OIDC_CONFIG=%q invalid YAML: %w", path, err)
	}
	cfg := file.OIDC
	if !cfg.Enabled {
		log.Printf("OIDC config present but disabled")
		return nil
	}

	secret := cfg.ClientSecret
	if secret == "" && cfg.ClientSecretEnv != "" {
		secret = os.Getenv(cfg.ClientSecretEnv)
	}
	if cfg.Issuer == "" || cfg.ClientID == "" || cfg.RedirectURL == "" {
		return fmt.Errorf("OIDC config requires issuer, client_id and redirect_url")
	}
	if cfg.GroupClaim == "" {
		cfg.GroupClaim = "groups"
	}
	if len(cfg.Scopes) == 0 {
		cfg.Scopes = []string{gooidc.ScopeOpenID, "email", "profile"}
	}

	provider, err := gooidc.NewProvider(context.Background(), cfg.Issuer)
	if err != nil {
		return fmt.Errorf("OIDC provider discovery failed for %q: %w", cfg.Issuer, err)
	}

	OIDC.cfg = cfg
	OIDC.provider = provider
	OIDC.verifier = provider.Verifier(&gooidc.Config{ClientID: cfg.ClientID})
	OIDC.oauth = &oauth2.Config{
		ClientID:     cfg.ClientID,
		ClientSecret: secret,
		Endpoint:     provider.Endpoint(),
		RedirectURL:  cfg.RedirectURL,
		Scopes:       cfg.Scopes,
	}
	OIDC.enabled = true
	log.Printf("OIDC enabled (issuer=%s, client=%s)", cfg.Issuer, cfg.ClientID)
	return nil
}

func (o *OIDCProvider) Enabled() bool {
	o.mu.RLock()
	defer o.mu.RUnlock()
	return o.enabled
}

func (o *OIDCProvider) Status() schema.OIDCStatus {
	o.mu.RLock()
	defer o.mu.RUnlock()
	if !o.enabled {
		return schema.OIDCStatus{Enabled: false}
	}
	return schema.OIDCStatus{Enabled: true, Issuer: o.cfg.Issuer}
}

// AuthCodeURL builds the IdP redirect URL for the given state.
func (o *OIDCProvider) AuthCodeURL(state string) (string, error) {
	o.mu.RLock()
	defer o.mu.RUnlock()
	if !o.enabled {
		return "", fmt.Errorf("OIDC not enabled")
	}
	return o.oauth.AuthCodeURL(state), nil
}

// Exchange swaps an authorization code for an ID token and returns the parsed
// claims (raw map) plus the derived groups.
func (o *OIDCProvider) Exchange(ctx context.Context, code string) (map[string]any, []string, error) {
	o.mu.RLock()
	cfg := o.cfg
	oauth := o.oauth
	verifier := o.verifier
	enabled := o.enabled
	o.mu.RUnlock()

	if !enabled {
		return nil, nil, fmt.Errorf("OIDC not enabled")
	}

	tok, err := oauth.Exchange(ctx, code)
	if err != nil {
		return nil, nil, fmt.Errorf("code exchange failed: %w", err)
	}
	rawID, ok := tok.Extra("id_token").(string)
	if !ok {
		return nil, nil, fmt.Errorf("no id_token in token response")
	}
	idToken, err := verifier.Verify(ctx, rawID)
	if err != nil {
		return nil, nil, fmt.Errorf("id_token verification failed: %w", err)
	}

	var claims map[string]any
	if err := idToken.Claims(&claims); err != nil {
		return nil, nil, fmt.Errorf("parse id_token claims: %w", err)
	}

	groups := extractGroups(claims, cfg.GroupClaim)
	return claims, groups, nil
}

// ResolveScope derives (clusters, permissions, isAdmin) from the user's groups
// using the configured mappings. A mapping with clusters=["*"] and
// permissions containing "owner" is treated as admin.
func (o *OIDCProvider) ResolveScope(groups []string) (clusters []string, perms []string, isAdmin bool) {
	o.mu.RLock()
	mappings := o.cfg.Mappings
	o.mu.RUnlock()

	clusterSet := map[string]bool{}
	permSet := map[string]bool{}
	groupSet := map[string]bool{}
	for _, g := range groups {
		groupSet[g] = true
	}

	for _, m := range mappings {
		if !groupSet[m.Group] {
			continue
		}
		for _, c := range m.Clusters {
			clusterSet[c] = true
		}
		for _, p := range m.Permissions {
			permSet[p] = true
			if p == "owner" {
				isAdmin = true
			}
		}
	}
	if clusterSet["*"] {
		isAdmin = true
	}

	for c := range clusterSet {
		clusters = append(clusters, c)
	}
	for p := range permSet {
		perms = append(perms, p)
	}
	return clusters, perms, isAdmin
}

func extractGroups(claims map[string]any, claimKey string) []string {
	raw, ok := claims[claimKey]
	if !ok {
		return nil
	}
	switch v := raw.(type) {
	case []any:
		out := make([]string, 0, len(v))
		for _, item := range v {
			if s, ok := item.(string); ok {
				out = append(out, s)
			}
		}
		return out
	case []string:
		return v
	case string:
		return []string{v}
	}
	return nil
}
