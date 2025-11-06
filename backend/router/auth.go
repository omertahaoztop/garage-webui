package router

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"khairul169/garage-webui/schema"
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
		endpoint := utils.Garage.GetS3Endpoint()
		disableHTTPS := !strings.HasPrefix(endpoint, "https://")

		awsConfig := aws.Config{
			Credentials: creds,
			Region:      utils.Garage.GetS3Region(),
		}

		client := s3.NewFromConfig(awsConfig, func(o *s3.Options) {
			o.UsePathStyle = true
			o.EndpointOptions.DisableHTTPS = disableHTTPS
			o.EndpointResolver = s3.EndpointResolverFunc(func(region string, opts s3.EndpointResolverOptions) (aws.Endpoint, error) {
				return aws.Endpoint{
					URL:           endpoint,
					SigningRegion: utils.Garage.GetS3Region(),
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

		bodyData, err := utils.Garage.Fetch(fmt.Sprintf("/v2/GetKeyInfo?id=%s", accessKeyID), &utils.FetchOptions{})
		if err != nil {
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

		var keyInfo schema.KeyElement
		if err := json.Unmarshal(bodyData, &keyInfo); err == nil {
			isAdmin := false
			allBuckets, _ := utils.Garage.Fetch("/v2/ListBuckets", &utils.FetchOptions{})
			if allBuckets != nil {
				var buckets []schema.GetBucketsRes
				if json.Unmarshal(allBuckets, &buckets) == nil {
					for _, bucket := range buckets {
						bucketInfo, _ := utils.Garage.Fetch(fmt.Sprintf("/v2/GetBucketInfo?id=%s", bucket.ID), &utils.FetchOptions{})
						if bucketInfo != nil {
							var bucketData schema.Bucket
							if json.Unmarshal(bucketInfo, &bucketData) == nil {
								for _, k := range bucketData.Keys {
									if k.AccessKeyID == accessKeyID && k.Permissions.Owner {
										isAdmin = true
										break
									}
								}
							}
						}
						if isAdmin {
							break
						}
					}
				}
			}

			utils.Session.Set(r, "authenticated", true)
			utils.Session.SetUserSession(r, utils.UserSession{
				AccessKeyID:       accessKeyID,
				IsAdmin:           isAdmin,
				AccessibleBuckets: accessibleBuckets,
			})
			utils.ResponseSuccess(w, map[string]interface{}{
				"authenticated": true,
				"isAdmin":       isAdmin,
			})
			return
		}
	}

	utils.ResponseErrorStatus(w, errors.New("invalid credentials"), 401)
}

func (c *Auth) Logout(w http.ResponseWriter, r *http.Request) {
	utils.Session.Clear(r)
	utils.ResponseSuccess(w, true)
}

func (c *Auth) GetStatus(w http.ResponseWriter, r *http.Request) {
	isAuthenticated := false
	isAdmin := false
	authSession := utils.Session.Get(r, "authenticated")
	enabled := false

	if utils.GetEnv("AUTH_USER_PASS", "") != "" {
		enabled = true
	}

	if authSession != nil && authSession.(bool) {
		isAuthenticated = true
		user := utils.GetUserSession(r)
		if user != nil {
			isAdmin = user.IsAdmin
		}
	}

	utils.ResponseSuccess(w, map[string]interface{}{
		"enabled":       enabled,
		"authenticated": isAuthenticated,
		"isAdmin":       isAdmin,
	})
}
