package middleware

import (
	"testing"
)

func TestAuthDisabled_OpenByDefault(t *testing.T) {
	t.Setenv("AUTH_USER_PASS", "")
	t.Setenv("AUTH_REQUIRED", "")
	if !AuthDisabled() {
		t.Errorf("with no provider and AUTH_REQUIRED unset, auth should be disabled (dev mode)")
	}
}

func TestAuthDisabled_EnabledByUserPass(t *testing.T) {
	t.Setenv("AUTH_USER_PASS", "admin:$2a$10$hash")
	t.Setenv("AUTH_REQUIRED", "")
	if AuthDisabled() {
		t.Errorf("AUTH_USER_PASS set must enable auth")
	}
}

func TestAuthDisabled_ForcedByAuthRequired(t *testing.T) {
	t.Setenv("AUTH_USER_PASS", "")
	t.Setenv("AUTH_REQUIRED", "true")
	if AuthDisabled() {
		t.Errorf("AUTH_REQUIRED=true must fail closed even with no provider")
	}
}
