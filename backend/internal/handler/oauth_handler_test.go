package handler

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"

	"github.com/aumputthipong/mini-erp-kanban/backend/internal/db"
	"github.com/aumputthipong/mini-erp-kanban/backend/internal/httputil"
	"github.com/aumputthipong/mini-erp-kanban/backend/internal/service/mock"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"golang.org/x/oauth2"
)

const testFrontendURL = "http://front.test"

type fakeGoogle struct {
	tokenStatus    int
	userInfoStatus int
	userInfo       googleUserInfo
}

func newFakeGoogle(t *testing.T, g *fakeGoogle) *httptest.Server {
	t.Helper()
	mux := http.NewServeMux()
	mux.HandleFunc("/token", func(w http.ResponseWriter, r *http.Request) {
		if g.tokenStatus != 0 {
			w.WriteHeader(g.tokenStatus)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{"access_token": "google-access", "token_type": "Bearer"})
	})
	mux.HandleFunc("/userinfo", func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "Bearer google-access", r.Header.Get("Authorization"))
		if g.userInfoStatus != 0 {
			w.WriteHeader(g.userInfoStatus)
			return
		}
		_ = json.NewEncoder(w).Encode(g.userInfo)
	})
	srv := httptest.NewServer(mux)
	t.Cleanup(srv.Close)
	return srv
}

func newTestOAuthHandler(svc *mock.MockAuthService, google *httptest.Server) *OAuthHandler {
	h := NewOAuthHandler("client-id", "client-secret", "http://api.test/callback", testFrontendURL, svc, false, false)
	if google != nil {
		h.googleConfig.Endpoint = oauth2.Endpoint{AuthURL: google.URL + "/auth", TokenURL: google.URL + "/token"}
		h.userInfoURL = google.URL + "/userinfo"
	}
	return h
}

func verifiedUser() googleUserInfo {
	return googleUserInfo{Sub: "g-123", Email: "jane@example.com", VerifiedEmail: true, Name: "Jane"}
}

func callbackRequest(state, cookieState, code string) *http.Request {
	q := url.Values{}
	if state != "" {
		q.Set("state", state)
	}
	if code != "" {
		q.Set("code", code)
	}
	req := httptest.NewRequest(http.MethodGet, "/api/auth/google/callback?"+q.Encode(), nil)
	if cookieState != "\x00" {
		req.AddCookie(&http.Cookie{Name: "oauth_state", Value: cookieState})
	}
	return req
}

func serveCallback(h *OAuthHandler, req *http.Request) *httptest.ResponseRecorder {
	w := httptest.NewRecorder()
	httputil.MakeHandler(h.HandleGoogleCallback)(w, req)
	return w
}

func TestRedirectToGoogle_SetsStateCookieMatchingURL(t *testing.T) {
	h := newTestOAuthHandler(&mock.MockAuthService{}, nil)
	w := httptest.NewRecorder()
	httputil.MakeHandler(h.RedirectToGoogle)(w, httptest.NewRequest(http.MethodGet, "/api/auth/google", nil))

	require.Equal(t, http.StatusTemporaryRedirect, w.Code)
	var stateCookie *http.Cookie
	for _, c := range w.Result().Cookies() {
		if c.Name == "oauth_state" {
			stateCookie = c
		}
	}
	require.NotNil(t, stateCookie)
	assert.NotEmpty(t, stateCookie.Value)
	assert.True(t, stateCookie.HttpOnly)
	assert.Equal(t, 300, stateCookie.MaxAge)

	loc, err := url.Parse(w.Header().Get("Location"))
	require.NoError(t, err)
	assert.Equal(t, stateCookie.Value, loc.Query().Get("state"))
}

func TestHandleGoogleCallback_BadState_Returns400(t *testing.T) {
	cases := map[string]*http.Request{
		"no cookie":        callbackRequest("abc", "\x00", "code"),
		"mismatched state": callbackRequest("abc", "xyz", "code"),
		"both empty":       callbackRequest("", "", "code"),
	}
	for name, req := range cases {
		t.Run(name, func(t *testing.T) {
			google := newFakeGoogle(t, &fakeGoogle{userInfo: verifiedUser()})
			svc := &mock.MockAuthService{
				UpsertOAuthUserFn: func(ctx context.Context, email, fullName, provider, providerID string) (db.User, error) {
					t.Fatal("a bad state must stop before login")
					return db.User{}, nil
				},
			}
			w := serveCallback(newTestOAuthHandler(svc, google), req)
			assert.Equal(t, http.StatusBadRequest, w.Code)
		})
	}
}

func TestHandleGoogleCallback_MissingCode_Returns400(t *testing.T) {
	h := newTestOAuthHandler(&mock.MockAuthService{}, nil)
	w := serveCallback(h, callbackRequest("s1", "s1", ""))
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestHandleGoogleCallback_ExchangeFails_Returns400(t *testing.T) {
	google := newFakeGoogle(t, &fakeGoogle{tokenStatus: http.StatusBadRequest})
	h := newTestOAuthHandler(&mock.MockAuthService{}, google)
	w := serveCallback(h, callbackRequest("s1", "s1", "code"))
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestHandleGoogleCallback_UserInfoFails_Returns500(t *testing.T) {
	google := newFakeGoogle(t, &fakeGoogle{userInfoStatus: http.StatusUnauthorized})
	h := newTestOAuthHandler(&mock.MockAuthService{}, google)
	w := serveCallback(h, callbackRequest("s1", "s1", "code"))
	assert.Equal(t, http.StatusInternalServerError, w.Code)
}

func TestHandleGoogleCallback_UnverifiedEmail_RedirectsWithoutLogin(t *testing.T) {
	unverified := verifiedUser()
	unverified.VerifiedEmail = false
	google := newFakeGoogle(t, &fakeGoogle{userInfo: unverified})
	svc := &mock.MockAuthService{
		UpsertOAuthUserFn: func(ctx context.Context, email, fullName, provider, providerID string) (db.User, error) {
			t.Fatal("unverified email must not reach UpsertOAuthUser")
			return db.User{}, nil
		},
	}
	h := newTestOAuthHandler(svc, google)
	w := serveCallback(h, callbackRequest("s1", "s1", "code"))

	assert.Equal(t, http.StatusTemporaryRedirect, w.Code)
	assert.Equal(t, testFrontendURL+"/login?error=google_email_unverified", w.Header().Get("Location"))
	_, hasAuth := findCookie(w, "auth_token")
	assert.False(t, hasAuth)
}

func TestHandleGoogleCallback_VerifiedButNoEmail_RedirectsWithoutLogin(t *testing.T) {
	noEmail := verifiedUser()
	noEmail.Email = ""
	google := newFakeGoogle(t, &fakeGoogle{userInfo: noEmail})
	svc := &mock.MockAuthService{
		UpsertOAuthUserFn: func(ctx context.Context, email, fullName, provider, providerID string) (db.User, error) {
			t.Fatal("an empty email must not reach UpsertOAuthUser")
			return db.User{}, nil
		},
	}
	w := serveCallback(newTestOAuthHandler(svc, google), callbackRequest("s1", "s1", "code"))
	assert.Equal(t, testFrontendURL+"/login?error=google_email_unverified", w.Header().Get("Location"))
}

func TestHandleGoogleCallback_UpsertFails_Returns500(t *testing.T) {
	google := newFakeGoogle(t, &fakeGoogle{userInfo: verifiedUser()})
	svc := &mock.MockAuthService{
		UpsertOAuthUserFn: func(ctx context.Context, email, fullName, provider, providerID string) (db.User, error) {
			return db.User{}, errors.New("db down")
		},
	}
	h := newTestOAuthHandler(svc, google)
	w := serveCallback(h, callbackRequest("s1", "s1", "code"))
	assert.Equal(t, http.StatusInternalServerError, w.Code)
}

func TestHandleGoogleCallback_Success_SetsCookiesAndRedirects(t *testing.T) {
	google := newFakeGoogle(t, &fakeGoogle{userInfo: verifiedUser()})
	svc := &mock.MockAuthService{
		UpsertOAuthUserFn: func(ctx context.Context, email, fullName, provider, providerID string) (db.User, error) {
			assert.Equal(t, "jane@example.com", email)
			assert.Equal(t, "google", provider)
			assert.Equal(t, "g-123", providerID)
			return db.User{ID: validUserID, Email: email, FullName: fullName}, nil
		},
	}
	h := newTestOAuthHandler(svc, google)
	w := serveCallback(h, callbackRequest("s1", "s1", "code"))

	require.Equal(t, http.StatusTemporaryRedirect, w.Code)
	assert.Equal(t, testFrontendURL+"/auth/callback", w.Header().Get("Location"))
	_, hasAuth := findCookie(w, "auth_token")
	_, hasRefresh := findCookie(w, "refresh_token")
	assert.True(t, hasAuth)
	assert.True(t, hasRefresh)
}

func TestHandleGoogleCallback_RefreshIssueFails_StillLogsIn(t *testing.T) {
	google := newFakeGoogle(t, &fakeGoogle{userInfo: verifiedUser()})
	svc := &mock.MockAuthService{
		UpsertOAuthUserFn: func(ctx context.Context, email, fullName, provider, providerID string) (db.User, error) {
			return db.User{ID: validUserID, Email: email}, nil
		},
		IssueRefreshTokenFn: func(ctx context.Context, userID, ua, ip string) (string, error) {
			return "", errors.New("db down")
		},
	}
	h := newTestOAuthHandler(svc, google)
	w := serveCallback(h, callbackRequest("s1", "s1", "code"))

	require.Equal(t, http.StatusTemporaryRedirect, w.Code)
	_, hasAuth := findCookie(w, "auth_token")
	_, hasRefresh := findCookie(w, "refresh_token")
	assert.True(t, hasAuth)
	assert.False(t, hasRefresh)
}
