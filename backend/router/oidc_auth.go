package router

import (
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"khairul169/garage-webui/utils"
	"net/http"
)

type OIDCAuth struct{}

// Status reports whether OIDC is enabled so the login page can render the
// "Sign in with SSO" button alongside (or instead of) the bcrypt form.
func (o *OIDCAuth) Status(w http.ResponseWriter, r *http.Request) {
	utils.ResponseSuccess(w, utils.OIDC.Status())
}

// Login generates a state, stores it in the session, and redirects to the IdP.
func (o *OIDCAuth) Login(w http.ResponseWriter, r *http.Request) {
	if !utils.OIDC.Enabled() {
		utils.ResponseErrorStatus(w, fmt.Errorf("OIDC not enabled"), http.StatusBadRequest)
		return
	}

	state, err := randomState()
	if err != nil {
		utils.ResponseError(w, fmt.Errorf("generate state: %w", err))
		return
	}
	utils.Session.Set(r, "oidc_state", state)

	url, err := utils.OIDC.AuthCodeURL(state)
	if err != nil {
		utils.ResponseError(w, err)
		return
	}
	http.Redirect(w, r, url, http.StatusFound)
}

// Callback handles the IdP redirect: validates state, exchanges the code,
// derives scope from group claims, and establishes the session.
func (o *OIDCAuth) Callback(w http.ResponseWriter, r *http.Request) {
	if !utils.OIDC.Enabled() {
		utils.ResponseErrorStatus(w, fmt.Errorf("OIDC not enabled"), http.StatusBadRequest)
		return
	}

	q := r.URL.Query()
	if errMsg := q.Get("error"); errMsg != "" {
		redirectWithError(w, r, errMsg)
		return
	}

	state := q.Get("state")
	savedState := utils.Session.Get(r, "oidc_state")
	if savedState == nil || state == "" || state != savedState.(string) {
		redirectWithError(w, r, "invalid OIDC state")
		return
	}

	claims, groups, err := utils.OIDC.Exchange(r.Context(), q.Get("code"))
	if err != nil {
		redirectWithError(w, r, err.Error())
		return
	}

	_, _, isAdmin := utils.OIDC.ResolveScope(groups)

	// Identify the user for the session (email preferred, then sub).
	identity := ""
	if v, ok := claims["email"].(string); ok {
		identity = v
	} else if v, ok := claims["sub"].(string); ok {
		identity = v
	}

	utils.Session.Set(r, "authenticated", true)
	utils.Session.SetUserSession(r, utils.UserSession{
		AccessKeyID: identity,
		IsAdmin:     isAdmin,
	})

	// Land on the SPA root; the session cookie carries auth.
	http.Redirect(w, r, utils.GetEnv("BASE_PATH", "")+"/", http.StatusFound)
}

func redirectWithError(w http.ResponseWriter, r *http.Request, msg string) {
	base := utils.GetEnv("BASE_PATH", "")
	http.Redirect(w, r, base+"/auth/login?error="+base64.RawURLEncoding.EncodeToString([]byte(msg)), http.StatusFound)
}

func randomState() (string, error) {
	b := make([]byte, 24)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}
