package utils

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/alexedwards/scs/v2"
)

type SessionManager struct {
	mgr *scs.SessionManager
}

var Session *SessionManager

func InitSessionManager() *scs.SessionManager {
	sessMgr := scs.New()
	sessMgr.Lifetime = 24 * time.Hour
	Session = &SessionManager{mgr: sessMgr}
	return sessMgr
}

func (s *SessionManager) Get(r *http.Request, key string) interface{} {
	return s.mgr.Get(r.Context(), key)
}

func (s *SessionManager) Set(r *http.Request, key string, value interface{}) {
	s.mgr.Put(r.Context(), key, value)
}

func (s *SessionManager) SetUserSession(r *http.Request, user UserSession) error {
	data, err := json.Marshal(user)
	if err != nil {
		return err
	}
	s.mgr.Put(r.Context(), "user", string(data))
	return nil
}

func (s *SessionManager) GetUserSession(r *http.Request) *UserSession {
	data := s.mgr.Get(r.Context(), "user")
	if data == nil {
		return nil
	}
	
	if str, ok := data.(string); ok {
		var user UserSession
		if err := json.Unmarshal([]byte(str), &user); err == nil {
			return &user
		}
	}
	
	if user, ok := data.(UserSession); ok {
		return &user
	}
	
	return nil
}

func (s *SessionManager) Clear(r *http.Request) error {
	return s.mgr.Clear(r.Context())
}
