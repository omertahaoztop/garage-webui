package middleware

import (
	"errors"
	"khairul169/garage-webui/utils"
	"net/http"
)

// authDisabled reports whether authentication is fully disabled.
//
// Auth is ENABLED (required) when ANY provider is configured:
//   - AUTH_USER_PASS  (bcrypt admin), or
//   - OIDC            (OIDC_CONFIG with enabled: true), or
//   - AUTH_REQUIRED=true (force fail-closed even with no provider).
//
// Only when NONE are set does the app run open (dev convenience). This
// prevents the footgun where a missing AUTH_USER_PASS silently exposes the
// entire admin API to anonymous callers.
func authDisabled() bool {
	if utils.GetEnv("AUTH_USER_PASS", "") != "" {
		return false
	}
	if utils.GetEnv("AUTH_REQUIRED", "") == "true" {
		return false
	}
	if utils.OIDC != nil && utils.OIDC.Enabled() {
		return false
	}
	return true
}

// AuthDisabled is the exported form so routers (e.g. /auth/status) report the
// same enabled/disabled verdict the middleware enforces.
func AuthDisabled() bool { return authDisabled() }

func AuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if authDisabled() {
			next.ServeHTTP(w, r)
			return
		}

		auth := utils.Session.Get(r, "authenticated")
		if auth == nil || !auth.(bool) {
			utils.ResponseErrorStatus(w, errors.New("unauthorized"), http.StatusUnauthorized)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func AdminMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if authDisabled() {
			next.ServeHTTP(w, r)
			return
		}

		auth := utils.Session.Get(r, "authenticated")
		if auth == nil || !auth.(bool) {
			utils.ResponseErrorStatus(w, errors.New("unauthorized"), http.StatusUnauthorized)
			return
		}

		isAdmin := false
		user := utils.GetUserSession(r)
		if user != nil {
			isAdmin = user.IsAdmin
		}

		if !isAdmin {
			utils.ResponseErrorStatus(w, errors.New("admin access required"), http.StatusForbidden)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func UserOrAdminMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if authDisabled() {
			next.ServeHTTP(w, r)
			return
		}

		auth := utils.Session.Get(r, "authenticated")
		if auth == nil || !auth.(bool) {
			utils.ResponseErrorStatus(w, errors.New("unauthorized"), http.StatusUnauthorized)
			return
		}

		next.ServeHTTP(w, r)
	})
}
