package router

import (
	"errors"
	"fmt"
	"khairul169/garage-webui/utils"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"
)

func ProxyHandler(w http.ResponseWriter, r *http.Request) {
	cluster := utils.GetCluster(r)
	if cluster == nil {
		utils.ResponseErrorStatus(w, errors.New("no cluster configured"), http.StatusInternalServerError)
		return
	}

	target, err := url.Parse(cluster.GetAdminEndpoint())
	if err != nil {
		utils.ResponseError(w, err)
		return
	}

	token := cluster.GetAdminKey()
	proxy := &httputil.ReverseProxy{
		Rewrite: func(pr *httputil.ProxyRequest) {
			pr.SetURL(target)
			pr.Out.URL.Path = strings.TrimPrefix(pr.In.URL.Path, "/api")
			if token != "" {
				pr.Out.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
			}
		},
	}

	proxy.ServeHTTP(w, r)
}
