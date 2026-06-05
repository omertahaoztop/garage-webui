package middleware

import (
	"errors"
	"khairul169/garage-webui/utils"
	"net/http"
)

// authDisabled reports whether the operator has disabled authentication by
// leaving AUTH_USER_PASS unset. In that mode every request is treated as
// authenticated and admin-capable. OIDC integration in Faz 1 Sprint 2 will
// extend this with claims-based authorization.
func authDisabled() bool {
	return utils.GetEnv("AUTH_USER_PASS", "") == ""
}

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
