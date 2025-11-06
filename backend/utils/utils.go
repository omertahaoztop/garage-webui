package utils

import (
	"encoding/json"
	"net/http"
	"os"
)

// UserSession represents user session data
type UserSession struct {
	AccessKeyID       string   `json:"accessKeyId"`
	IsAdmin           bool     `json:"isAdmin"`
	AccessibleBuckets []string `json:"accessibleBuckets"`
}

// GetUserSession is a helper to get user session from request
func GetUserSession(r *http.Request) *UserSession {
	return Session.GetUserSession(r)
}

func GetEnv(key, defaultValue string) string {
	value := os.Getenv(key)
	if len(value) == 0 {
		return defaultValue
	}
	return value
}

func LastString(str []string) string {
	return str[len(str)-1]
}

func ResponseError(w http.ResponseWriter, err error) {
	w.WriteHeader(http.StatusInternalServerError)
	w.Write([]byte(err.Error()))
}

func ResponseErrorStatus(w http.ResponseWriter, err error, status int) {
	w.WriteHeader(status)
	w.Write([]byte(err.Error()))
}

func ResponseSuccess(w http.ResponseWriter, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(data)
}
