package router

import (
	"context"
	"encoding/json"
	"errors"
	"khairul169/garage-webui/middleware"
	"khairul169/garage-webui/utils"
	"net/http"
	"strings"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"golang.org/x/crypto/bcrypt"
)

type Auth struct{}

func (c *Auth) Login(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Username        string `json:"username"`
		Password        string `json:"password"`
		AccessKeyID     string `json:"accessKeyId"`
		SecretAccessKey string `json:"secretAccessKey"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		utils.ResponseError(w, err)
		return
	}

	cluster := utils.GetCluster(r)
	if cluster == nil {
		utils.ResponseErrorStatus(w, errors.New("no cluster configured"), http.StatusInternalServerError)
		return
	}

	userPass := strings.Split(utils.GetEnv("AUTH_USER_PASS", ""), ":")
	accessKeyID := body.AccessKeyID
	secretAccessKey := body.SecretAccessKey

	if accessKeyID == "" && secretAccessKey == "" && body.Username != "" && body.Password != "" {
		accessKeyID = body.Username
		secretAccessKey = body.Password
	}

	if len(userPass) >= 2 && body.Username != "" && body.Password != "" {
		if strings.TrimSpace(body.Username) == userPass[0] && bcrypt.CompareHashAndPassword([]byte(userPass[1]), []byte(body.Password)) == nil {
			utils.Session.Set(r, "authenticated", true)
			utils.Session.SetUserSession(r, utils.UserSession{
				IsAdmin: true,
			})
			utils.ResponseSuccess(w, map[string]interface{}{
				"authenticated": true,
				"isAdmin":       true,
			})
			return
		}
	}
	if accessKeyID != "" && secretAccessKey != "" {
		creds := credentials.NewStaticCredentialsProvider(accessKeyID, secretAccessKey, "")
		endpoint := cluster.GetS3Endpoint()
		disableHTTPS := !strings.HasPrefix(endpoint, "https://")

		awsConfig := aws.Config{
			Credentials: creds,
			Region:      cluster.GetS3Region(),
		}

		client := s3.NewFromConfig(awsConfig, func(o *s3.Options) {
			o.UsePathStyle = true
			o.EndpointOptions.DisableHTTPS = disableHTTPS
			o.EndpointResolver = s3.EndpointResolverFunc(func(region string, opts s3.EndpointResolverOptions) (aws.Endpoint, error) {
				return aws.Endpoint{
					URL:           endpoint,
					SigningRegion: cluster.GetS3Region(),
				}, nil
			})
		})

		result, err := client.ListBuckets(context.Background(), &s3.ListBucketsInput{})
		if err != nil {
			utils.ResponseErrorStatus(w, errors.New("invalid access key or secret key"), 401)
			return
		}

		accessibleBuckets := make([]string, 0)
		for _, bucket := range result.Buckets {
			if bucket.Name != nil {
				accessibleBuckets = append(accessibleBuckets, *bucket.Name)
			}
		}

		// S3-key login NEVER grants cluster-admin. Admin is reserved exclusively
		// for the AUTH_USER_PASS identity (checked above). A bucket Owner is a
		// data-plane owner, NOT a control-plane admin — promoting them would let
		// any tenant reach /admin/* (layout, repair, admin-tokens, etc.).
		utils.Session.Set(r, "authenticated", true)
		utils.Session.SetUserSession(r, utils.UserSession{
			AccessKeyID:       accessKeyID,
			IsAdmin:           false,
			AccessibleBuckets: accessibleBuckets,
		})
		utils.ResponseSuccess(w, map[string]interface{}{
			"authenticated": true,
			"isAdmin":       false,
		})
		return
	}

	utils.ResponseErrorStatus(w, errors.New("invalid credentials"), 401)
}

func (c *Auth) Logout(w http.ResponseWriter, r *http.Request) {
	utils.Session.Clear(r)
	utils.ResponseSuccess(w, true)
}

func (c *Auth) GetStatus(w http.ResponseWriter, r *http.Request) {
	enabled := !middleware.AuthDisabled()

	// Auth-disabled mode: treat every caller as an authenticated admin so that
	// the SPA's main-layout auth gate does not bounce them to /auth/login.
	if !enabled {
		utils.ResponseSuccess(w, map[string]interface{}{
			"enabled":       false,
			"authenticated": true,
			"isAdmin":       true,
		})
		return
	}

	isAuthenticated := false
	isAdmin := false
	if authSession := utils.Session.Get(r, "authenticated"); authSession != nil {
		if v, ok := authSession.(bool); ok && v {
			isAuthenticated = true
			if user := utils.GetUserSession(r); user != nil {
				isAdmin = user.IsAdmin
			}
		}
	}

	utils.ResponseSuccess(w, map[string]interface{}{
		"enabled":       true,
		"authenticated": isAuthenticated,
		"isAdmin":       isAdmin,
	})
}
