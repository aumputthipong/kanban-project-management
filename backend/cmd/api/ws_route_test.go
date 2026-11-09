package main

import (
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	"github.com/aumputthipong/mini-erp-kanban/backend/internal/service/mock"
	"github.com/aumputthipong/mini-erp-kanban/backend/internal/token"
	"github.com/aumputthipong/mini-erp-kanban/backend/internal/websocket"
	gorilla "github.com/gorilla/websocket"
	"github.com/jackc/pgx/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const (
	wsBoardID  = "452ae618-9e69-49f5-88a9-47728a5f17ac"
	wsMemberID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
	wsOutsider = "11111111-2222-3333-4444-555555555555"
)

// The real router: ticket auth, then the membership gate, then the upgrade.
func startWSRouter(t *testing.T) string {
	t.Helper()
	if os.Getenv("JWT_SECRET") == "" {
		t.Setenv("JWT_SECRET", "test-secret-do-not-use-in-prod-0123456789")
	}
	hub := websocket.NewHub("")
	go hub.Run()
	boards := &mock.MockBoardService{
		GetBoardMemberRoleFn: func(ctx context.Context, boardID, userID string) (string, error) {
			if boardID == wsBoardID && userID == wsMemberID {
				return "member", nil
			}
			return "", pgx.ErrNoRows
		},
	}
	srv := httptest.NewServer(setupRoutes(routerDeps{boardService: boards, hub: hub, rateLimitOff: true}))
	t.Cleanup(func() {
		hub.Shutdown()
		srv.Close()
	})
	return "ws" + strings.TrimPrefix(srv.URL, "http")
}

func dialWS(t *testing.T, base, boardID, ticket string) (int, error) {
	t.Helper()
	url := base + "/ws/" + boardID
	if ticket != "" {
		url += "?ticket=" + ticket
	}
	conn, resp, err := gorilla.DefaultDialer.Dial(url, nil)
	if conn != nil {
		conn.Close()
	}
	if resp == nil {
		return 0, err
	}
	return resp.StatusCode, err
}

func ticketFor(t *testing.T, userID string) string {
	t.Helper()
	ticket, err := token.GenerateWSTicket(userID)
	require.NoError(t, err)
	return ticket
}

func TestWSRoute_MemberWithTicket_Upgrades(t *testing.T) {
	base := startWSRouter(t)

	status, err := dialWS(t, base, wsBoardID, ticketFor(t, wsMemberID))

	require.NoError(t, err)
	assert.Equal(t, http.StatusSwitchingProtocols, status)
}

func TestWSRoute_NonMember_Gets404NotForbidden(t *testing.T) {
	base := startWSRouter(t)

	status, err := dialWS(t, base, wsBoardID, ticketFor(t, wsOutsider))

	require.Error(t, err)
	assert.Equal(t, http.StatusNotFound, status)
}

func TestWSRoute_MalformedBoardID_Gets404(t *testing.T) {
	base := startWSRouter(t)

	status, _ := dialWS(t, base, "not-a-uuid", ticketFor(t, wsMemberID))

	assert.Equal(t, http.StatusNotFound, status)
}

func TestWSRoute_WithoutTicket_Gets401(t *testing.T) {
	base := startWSRouter(t)

	status, _ := dialWS(t, base, wsBoardID, "")

	assert.Equal(t, http.StatusUnauthorized, status)
}

// A session token leaked into a URL must not open the socket, and vice versa.
func TestWSRoute_SessionTokenAsTicket_Gets401(t *testing.T) {
	base := startWSRouter(t)
	session, err := token.Generate(wsMemberID, "member@example.com")
	require.NoError(t, err)

	status, _ := dialWS(t, base, wsBoardID, session)

	assert.Equal(t, http.StatusUnauthorized, status)
}

func TestWSRoute_ForgedTicket_Gets401(t *testing.T) {
	base := startWSRouter(t)
	forged := ticketFor(t, wsMemberID) + "x"

	status, _ := dialWS(t, base, wsBoardID, forged)

	assert.Equal(t, http.StatusUnauthorized, status)
}
