package router

import (
	"khairul169/garage-webui/middleware"
	"net/http"
)

func HandleApiRouter() *http.ServeMux {
	mux := http.NewServeMux()

	auth := &Auth{}
	mux.HandleFunc("POST /auth/login", auth.Login)

	// Public share endpoint — token embeds cluster + object info, no auth required.
	// Registered on the top-level mux so it bypasses UserOrAdminMiddleware.
	share := &Share{}
	mux.HandleFunc("GET /share/{token}", share.ServeShare)

	// OIDC SSO — public: status, IdP redirect, and callback all bypass auth
	// middleware (the callback IS the thing that establishes auth).
	oidcAuth := &OIDCAuth{}
	mux.HandleFunc("GET /auth/oidc/status", oidcAuth.Status)
	mux.HandleFunc("GET /auth/oidc/login", oidcAuth.Login)
	mux.HandleFunc("GET /auth/oidc/callback", oidcAuth.Callback)

	userRouter := http.NewServeMux()
	userRouter.HandleFunc("POST /auth/logout", auth.Logout)
	userRouter.HandleFunc("GET /auth/status", auth.GetStatus)

	// Cluster discovery (read-only — every authenticated user can list).
	clusters := &Clusters{}
	userRouter.HandleFunc("GET /clusters", clusters.GetAll)
	userRouter.HandleFunc("GET /clusters/{id}/test", clusters.TestConnection)

	buckets := &Buckets{}
	userRouter.HandleFunc("GET /buckets", buckets.GetAll)

	browse := &Browse{}
	userRouter.HandleFunc("GET /browse/{bucket}", browse.GetObjects)
	userRouter.HandleFunc("POST /browse/{bucket}/bulk-delete", browse.BulkDelete)
	userRouter.HandleFunc("POST /browse/{bucket}/presign", browse.PresignUrl)
	userRouter.HandleFunc("POST /browse/{bucket}/copy", browse.CopyObject)
	userRouter.HandleFunc("POST /browse/{bucket}/multipart/init", browse.MultipartInit)
	userRouter.HandleFunc("PUT /browse/{bucket}/multipart/{uploadId}/part/{partNumber}", browse.MultipartUploadPart)
	userRouter.HandleFunc("POST /browse/{bucket}/multipart/{uploadId}/complete", browse.MultipartComplete)
	userRouter.HandleFunc("DELETE /browse/{bucket}/multipart/{uploadId}", browse.MultipartAbort)
	userRouter.HandleFunc("GET /browse/{bucket}/{key...}", browse.GetOneObject)
	userRouter.HandleFunc("PUT /browse/{bucket}/{key...}", browse.PutObject)
	userRouter.HandleFunc("DELETE /browse/{bucket}/{key...}", browse.DeleteObject)

	// Share token creation requires auth + bucket access.
	userRouter.HandleFunc("POST /share/create", share.CreateShare)

	// Admin tokens — current-token info is readable by any authenticated user;
	// list/create/update/delete are admin-gated below via adminRouter aliases.
	adminTokens := &AdminTokens{}
	userRouter.HandleFunc("GET /admin-tokens/current", adminTokens.Current)

	// Object inspector (forensic) — read-only, available to authenticated users
	// who can already browse the bucket.
	inspect := &Inspect{}
	userRouter.HandleFunc("GET /inspect/object", inspect.Object)

	// Speedtest — S3 throughput probe, reuses bucket read+write credentials.
	speedtest := &Speedtest{}
	userRouter.HandleFunc("POST /speedtest", speedtest.Run)

	adminRouter := http.NewServeMux()
	config := &Config{}
	adminRouter.HandleFunc("GET /config", config.GetAll)

	// Cluster ops — explicit handlers registered before the catch-all proxy
	// so they take precedence over a generic /admin/* forward to Garage.
	snapshot := &Snapshot{}
	adminRouter.HandleFunc("POST /snapshot", snapshot.Trigger)
	adminRouter.HandleFunc("GET /snapshot/nodes", snapshot.ListNodes)

	// Admin token CRUD (admin only).
	adminRouter.HandleFunc("GET /admin-tokens", adminTokens.List)
	adminRouter.HandleFunc("POST /admin-tokens", adminTokens.Create)
	adminRouter.HandleFunc("POST /admin-tokens/{id}", adminTokens.Update)
	adminRouter.HandleFunc("DELETE /admin-tokens/{id}", adminTokens.Delete)

	// Cluster layout staging editor.
	layout := &Layout{}
	adminRouter.HandleFunc("GET /layout", layout.Get)
	adminRouter.HandleFunc("POST /layout", layout.Update)
	adminRouter.HandleFunc("POST /layout/preview", layout.Preview)
	adminRouter.HandleFunc("POST /layout/apply", layout.Apply)
	adminRouter.HandleFunc("POST /layout/revert", layout.Revert)
	adminRouter.HandleFunc("GET /layout/history", layout.History)
	adminRouter.HandleFunc("POST /layout/skip-dead-nodes", layout.SkipDeadNodes)

	// Workers.
	workers := &Workers{}
	adminRouter.HandleFunc("POST /workers", workers.List)
	adminRouter.HandleFunc("POST /workers/info", workers.GetInfo)
	adminRouter.HandleFunc("POST /workers/variable/get", workers.GetVariable)
	adminRouter.HandleFunc("POST /workers/variable/set", workers.SetVariable)

	// Block errors + forensic block ops.
	blocks := &Blocks{}
	adminRouter.HandleFunc("GET /blocks/errors", blocks.ListErrors)
	adminRouter.HandleFunc("POST /blocks/info", blocks.GetInfo)
	adminRouter.HandleFunc("POST /blocks/retry", blocks.RetryResync)
	adminRouter.HandleFunc("POST /blocks/purge", blocks.Purge)

	// Repair operations.
	repair := &Repair{}
	adminRouter.HandleFunc("GET /repair/types", repair.Types)
	adminRouter.HandleFunc("POST /repair", repair.Launch)

	// Prometheus metrics scrape proxy.
	metrics := &Metrics{}
	adminRouter.HandleFunc("GET /metrics", metrics.Scrape)

	adminRouter.HandleFunc("/", ProxyHandler)

	// ClusterMiddleware resolves X-Cluster-Id (or default) and attaches the
	// cluster to the request context for both admin and user routes.
	mux.Handle(
		"/admin/",
		http.StripPrefix("/admin",
			middleware.ClusterMiddleware(
				middleware.AdminMiddleware(adminRouter),
			),
		),
	)
	mux.Handle("/", middleware.ClusterMiddleware(middleware.UserOrAdminMiddleware(userRouter)))

	return mux
}
