package middleware

import (
	"errors"
	"khairul169/garage-webui/utils"
	"net/http"
)

// ClusterMiddleware resolves the cluster for each request from the
// X-Cluster-Id header (falling back to the default cluster) and attaches it
// to the request context. Downstream handlers should use utils.GetCluster(r)
// to retrieve it.
func ClusterMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var cl *utils.Cluster

		if id := r.Header.Get(utils.ClusterHeader); id != "" {
			found, ok := utils.Clusters.Get(id)
			if !ok {
				utils.ResponseErrorStatus(w, errors.New("unknown cluster id: "+id), http.StatusBadRequest)
				return
			}
			cl = found
		} else {
			cl = utils.Clusters.Default()
		}

		if cl == nil {
			utils.ResponseErrorStatus(w, errors.New("no cluster configured"), http.StatusInternalServerError)
			return
		}

		ctx := utils.WithCluster(r.Context(), cl)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}
