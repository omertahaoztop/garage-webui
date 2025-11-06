package router

import (
	"khairul169/garage-webui/middleware"
	"net/http"
)

func HandleApiRouter() *http.ServeMux {
	mux := http.NewServeMux()

	auth := &Auth{}
	mux.HandleFunc("POST /auth/login", auth.Login)

	userRouter := http.NewServeMux()
	userRouter.HandleFunc("POST /auth/logout", auth.Logout)
	userRouter.HandleFunc("GET /auth/status", auth.GetStatus)

	buckets := &Buckets{}
	userRouter.HandleFunc("GET /buckets", buckets.GetAll)

	browse := &Browse{}
	userRouter.HandleFunc("GET /browse/{bucket}", browse.GetObjects)
	userRouter.HandleFunc("GET /browse/{bucket}/{key...}", browse.GetOneObject)
	userRouter.HandleFunc("PUT /browse/{bucket}/{key...}", browse.PutObject)
	userRouter.HandleFunc("DELETE /browse/{bucket}/{key...}", browse.DeleteObject)

	adminRouter := http.NewServeMux()
	config := &Config{}
	adminRouter.HandleFunc("GET /config", config.GetAll)
	adminRouter.HandleFunc("/", ProxyHandler)
	mux.Handle("/admin/", http.StripPrefix("/admin", middleware.AdminMiddleware(adminRouter)))
	mux.Handle("/", middleware.UserOrAdminMiddleware(userRouter))

	return mux
}
