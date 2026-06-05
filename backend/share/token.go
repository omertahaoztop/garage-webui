// Package share implements stateless HMAC-signed share tokens.
//
// A share token is a base64url-encoded JSON payload containing the cluster id,
// bucket, key, expiry and an optional filename hint, concatenated with a "."
// separator and a HMAC-SHA256 signature over the payload. Verification is
// purely cryptographic — no DB, no token table — so anyone who possesses the
// signing secret can validate a token and resolve the object behind it.
//
// Configure the secret via the SHARE_SECRET environment variable on every
// webui sidecar. The fallback default is intentionally weak and meant only
// for development; production deployments MUST override it.
package share

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"khairul169/garage-webui/utils"
	"strings"
	"time"
)

// Payload is the JSON-encoded body of a share token. Field names are kept
// short (single character) so URLs stay manageable.
type Payload struct {
	ClusterId string `json:"c"`
	Bucket    string `json:"b"`
	Key       string `json:"k"`
	ExpiresAt int64  `json:"e"`           // unix seconds
	Filename  string `json:"f,omitempty"` // optional download hint
}

// Sign returns a "<base64url(payload)>.<base64url(sig)>" token.
func Sign(p Payload) (string, error) {
	body, err := json.Marshal(p)
	if err != nil {
		return "", err
	}
	payload := base64.RawURLEncoding.EncodeToString(body)
	mac := hmac.New(sha256.New, getSecret())
	mac.Write([]byte(payload))
	sig := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
	return payload + "." + sig, nil
}

// Verify parses the token, checks signature and expiry, and returns the
// payload on success.
func Verify(token string) (*Payload, error) {
	parts := strings.SplitN(token, ".", 2)
	if len(parts) != 2 {
		return nil, errors.New("malformed token")
	}
	mac := hmac.New(sha256.New, getSecret())
	mac.Write([]byte(parts[0]))
	expected := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
	if !hmac.Equal([]byte(expected), []byte(parts[1])) {
		return nil, errors.New("invalid signature")
	}
	body, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		return nil, fmt.Errorf("malformed payload: %w", err)
	}
	var p Payload
	if err := json.Unmarshal(body, &p); err != nil {
		return nil, fmt.Errorf("malformed payload: %w", err)
	}
	if time.Now().Unix() > p.ExpiresAt {
		return nil, errors.New("token expired")
	}
	return &p, nil
}

func getSecret() []byte {
	s := utils.GetEnv("SHARE_SECRET", "")
	if s == "" {
		// Development-only default. Override via SHARE_SECRET in production.
		s = "garage-webui-default-share-secret-please-override-in-prod-2024"
	}
	return []byte(s)
}
