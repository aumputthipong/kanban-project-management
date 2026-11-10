package main

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/aumputthipong/mini-erp-kanban/backend/internal/service/mock"
	"github.com/stretchr/testify/assert"
)

// A body-supplied email must never mint a session: the only OAuth entry is the Google redirect flow.
func TestAuthRoutes_NoProgrammaticOAuthLogin(t *testing.T) {
	srv := httptest.NewServer(setupRoutes(routerDeps{boardService: &mock.MockBoardService{}, rateLimitOff: true}))
	t.Cleanup(srv.Close)

	body := strings.NewReader(`{"email":"victim@example.com","full_name":"X","provider":"google","provider_id":"x"}`)
	resp, err := http.Post(srv.URL+"/api/auth/oauth", "application/json", body)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()

	assert.Equal(t, http.StatusNotFound, resp.StatusCode)
	for _, c := range resp.Cookies() {
		assert.NotEqual(t, "auth_token", c.Name)
	}
}
