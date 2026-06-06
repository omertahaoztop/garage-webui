package router

import (
	"khairul169/garage-webui/utils"
	"net/http"
	"net/http/httptest"
	"testing"
)

// runWithUser executes fn inside a request whose scs session carries `user`,
// exercising the real assertBucketAccess production path (session-backed).
func runWithUser(t *testing.T, user *utils.UserSession, fn func(r *http.Request)) {
	t.Helper()
	mgr := utils.InitSessionManager() // also wires the package-global utils.Session
	h := mgr.LoadAndSave(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if user != nil {
			utils.Session.Set(r, "authenticated", true)
			utils.Session.SetUserSession(r, *user)
		}
		fn(r)
	}))
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	h.ServeHTTP(httptest.NewRecorder(), req)
}

func TestAssertBucketAccess_AdminAlwaysAllowed(t *testing.T) {
	runWithUser(t, &utils.UserSession{IsAdmin: true}, func(r *http.Request) {
		if err := assertBucketAccess(r, "any-bucket"); err != nil {
			t.Errorf("admin must access any bucket, got %v", err)
		}
	})
}

func TestAssertBucketAccess_NonAdminScopedAllow(t *testing.T) {
	runWithUser(t, &utils.UserSession{AccessibleBuckets: []string{"mine"}}, func(r *http.Request) {
		if err := assertBucketAccess(r, "mine"); err != nil {
			t.Errorf("user should access own bucket, got %v", err)
		}
	})
}

func TestAssertBucketAccess_NonAdminCrossTenantDenied(t *testing.T) {
	runWithUser(t, &utils.UserSession{AccessibleBuckets: []string{"mine"}}, func(r *http.Request) {
		if err := assertBucketAccess(r, "someone-elses"); err == nil {
			t.Errorf("user must NOT access another tenant's bucket")
		}
	})
}

func TestAssertBucketAccess_NonAdminEmptyListDeniesAll(t *testing.T) {
	runWithUser(t, &utils.UserSession{AccessibleBuckets: []string{}}, func(r *http.Request) {
		if err := assertBucketAccess(r, "anything"); err == nil {
			t.Errorf("user with no accessible buckets must be denied")
		}
	})
}

func TestRequireBucketAccess_Writes403OnDeny(t *testing.T) {
	runWithUser(t, &utils.UserSession{AccessibleBuckets: []string{"mine"}}, func(r *http.Request) {
		rec := httptest.NewRecorder()
		if requireBucketAccess(rec, r, "not-mine") {
			t.Errorf("requireBucketAccess should return false on deny")
		}
		if rec.Code != http.StatusForbidden {
			t.Errorf("expected 403, got %d", rec.Code)
		}
	})
}
