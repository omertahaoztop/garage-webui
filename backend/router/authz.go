package router

import (
	"errors"
	"khairul169/garage-webui/utils"
	"net/http"
)

// errBucketAccessDenied is returned when a non-admin user touches a bucket
// that is not in their AccessibleBuckets list.
var errBucketAccessDenied = errors.New("access denied to this bucket")

// assertBucketAccess is the single authorization gate for every user-facing
// bucket operation. Admins (AUTH_USER_PASS identity) pass unconditionally.
// Non-admin S3 users may only touch buckets present in their session's
// AccessibleBuckets list (the buckets their own S3 key can list).
//
// SECURITY: this is the ONLY thing standing between a tenant and cross-tenant
// access, because the backend performs S3/admin calls with privileged
// credentials (bucket owner key / cluster admin token), not the user's own
// key. Every user-router handler that accepts a bucket parameter MUST call
// this before doing any work. Do not inline the check — route it here so the
// policy stays in one auditable place.
func assertBucketAccess(r *http.Request, bucket string) error {
	user := utils.GetUserSession(r)

	// No session user resolved. In auth-disabled mode middleware already
	// allowed the request through; treat as permitted (deployment choice).
	// When auth is enabled, middleware guarantees a session exists before
	// reaching here.
	if user == nil {
		return nil
	}
	if user.IsAdmin {
		return nil
	}
	for _, b := range user.AccessibleBuckets {
		if b == bucket {
			return nil
		}
	}
	return errBucketAccessDenied
}

// requireBucketAccess writes a 403 and returns false if access is denied, so
// handlers can early-return in one line:
//
//	if !requireBucketAccess(w, r, bucket) { return }
func requireBucketAccess(w http.ResponseWriter, r *http.Request, bucket string) bool {
	if err := assertBucketAccess(r, bucket); err != nil {
		utils.ResponseErrorStatus(w, err, http.StatusForbidden)
		return false
	}
	return true
}
