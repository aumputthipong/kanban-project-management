package websocket

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/aumputthipong/mini-erp-kanban/backend/internal/middleware"
	"github.com/gorilla/websocket"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Real sockets over httptest: ServeWs, ReadPump and WritePump run as in production.
type liveHub struct {
	*Hub
	url string
}

func startLiveHub(t *testing.T, allowedOrigin string) *liveHub {
	t.Helper()
	hub := NewHub(allowedOrigin)
	go hub.Run()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		user := r.URL.Query().Get("user")
		ctx := context.WithValue(r.Context(), middleware.UserIDKey, user)
		ServeWs(hub, w, r.WithContext(ctx), r.URL.Query().Get("board"))
	}))
	t.Cleanup(func() {
		hub.Shutdown()
		srv.Close()
	})
	return &liveHub{Hub: hub, url: "ws" + strings.TrimPrefix(srv.URL, "http")}
}

func (h *liveHub) dial(t *testing.T, boardID, userID string, header http.Header) (*websocket.Conn, *http.Response, error) {
	t.Helper()
	conn, resp, err := websocket.DefaultDialer.Dial(h.url+"?board="+boardID+"&user="+userID, header)
	if conn != nil {
		t.Cleanup(func() { conn.Close() })
	}
	return conn, resp, err
}

func (h *liveHub) join(t *testing.T, boardID, userID string) *websocket.Conn {
	t.Helper()
	conn, _, err := h.dial(t, boardID, userID, nil)
	require.NoError(t, err)
	h.waitUntilJoined(t, conn, boardID)
	return conn
}

const probe = "__probe__"

// Registration is async; probes are broadcast until this socket sees one. Gorilla
// poisons a conn after any read timeout, so only the final read of a test may time out.
func (h *liveHub) waitUntilJoined(t *testing.T, conn *websocket.Conn, boardID string) {
	t.Helper()
	stop := make(chan struct{})
	defer close(stop)
	go func() {
		for {
			select {
			case <-stop:
				return
			case <-time.After(10 * time.Millisecond):
				h.Broadcast(boardID, []byte(probe))
			}
		}
	}()
	_ = conn.SetReadDeadline(time.Now().Add(2 * time.Second))
	_, msg, err := conn.ReadMessage()
	require.NoError(t, err, "socket never joined the room")
	require.Equal(t, probe, string(msg))
}

// Skips join probes, which every socket in the room receives.
func read(t *testing.T, conn *websocket.Conn) (string, error) {
	t.Helper()
	for {
		_ = conn.SetReadDeadline(time.Now().Add(2 * time.Second))
		_, msg, err := conn.ReadMessage()
		if err != nil || string(msg) != probe {
			return string(msg), err
		}
	}
}

// Ends the conn's usable life (read timeout), so call it last on that conn.
func assertNothingArrives(t *testing.T, conn *websocket.Conn) {
	t.Helper()
	for {
		_ = conn.SetReadDeadline(time.Now().Add(150 * time.Millisecond))
		_, msg, err := conn.ReadMessage()
		if err == nil && string(msg) == probe {
			continue
		}
		require.Error(t, err, "unexpected message %q", msg)
		var netErr interface{ Timeout() bool }
		require.ErrorAs(t, err, &netErr)
		assert.True(t, netErr.Timeout(), "expected a quiet socket, got %v", err)
		return
	}
}

func TestServeWs_BroadcastReachesEveryTabInTheRoomOnly(t *testing.T) {
	h := startLiveHub(t, "")
	tabA := h.join(t, "board-1", "ann")
	tabB := h.join(t, "board-1", "bob")
	elsewhere := h.join(t, "board-2", "ann")

	h.Broadcast("board-1", []byte(`{"type":"CARD_CREATED"}`))

	for _, c := range []*websocket.Conn{tabA, tabB} {
		msg, err := read(t, c)
		require.NoError(t, err)
		assert.Equal(t, `{"type":"CARD_CREATED"}`, msg)
	}
	assertNothingArrives(t, elsewhere)
}

func TestServeWs_KeepsBroadcastOrder(t *testing.T) {
	h := startLiveHub(t, "")
	conn := h.join(t, "board-1", "ann")

	for _, m := range []string{"1", "2", "3"} {
		h.Broadcast("board-1", []byte(m))
	}

	for _, want := range []string{"1", "2", "3"} {
		got, err := read(t, conn)
		require.NoError(t, err)
		assert.Equal(t, want, got)
	}
}

func TestServeWs_EvictedUserIsDisconnected_OthersStay(t *testing.T) {
	h := startLiveHub(t, "")
	removed := h.join(t, "board-1", "removed")
	stays := h.join(t, "board-1", "stays")

	h.EvictUser("board-1", "removed")
	h.Broadcast("board-1", []byte("after"))

	assertClosed(t, removed)
	msg, err := read(t, stays)
	require.NoError(t, err)
	assert.Equal(t, "after", msg)
}

func TestServeWs_ClientHangUp_LeavesTheRoomWorking(t *testing.T) {
	h := startLiveHub(t, "")
	leaving := h.join(t, "board-1", "ann")
	stays := h.join(t, "board-1", "bob")

	require.NoError(t, leaving.Close())
	// The hub must survive sends to the dead socket while ReadPump unregisters it.
	for range 3 {
		h.Broadcast("board-1", []byte("tick"))
	}

	for range 3 {
		msg, err := read(t, stays)
		require.NoError(t, err)
		assert.Equal(t, "tick", msg)
	}
}

func TestServeWs_InboundFramesAreIgnored(t *testing.T) {
	h := startLiveHub(t, "")
	sender := h.join(t, "board-1", "ann")
	other := h.join(t, "board-1", "bob")

	require.NoError(t, sender.WriteMessage(websocket.TextMessage, []byte(`{"type":"CARD_DELETED"}`)))

	assertNothingArrives(t, other)
	h.Broadcast("board-1", []byte("still open"))
	msg, err := read(t, sender)
	require.NoError(t, err)
	assert.Equal(t, "still open", msg)
}

func TestServeWs_OversizedInboundFrame_ClosesThatSocket(t *testing.T) {
	h := startLiveHub(t, "")
	conn := h.join(t, "board-1", "ann")

	require.NoError(t, conn.WriteMessage(websocket.TextMessage, make([]byte, maxMessageSize+1)))

	assertClosed(t, conn)
}

func TestServeWs_Shutdown_ClosesOpenSockets(t *testing.T) {
	h := startLiveHub(t, "")
	conn := h.join(t, "board-1", "ann")

	h.Shutdown()

	assertClosed(t, conn)
}

func TestServeWs_RejectsForeignOrigin(t *testing.T) {
	h := startLiveHub(t, "https://app.example")

	_, resp, err := h.dial(t, "board-1", "ann", http.Header{"Origin": {"https://evil.example"}})
	require.Error(t, err)
	require.NotNil(t, resp)
	assert.Equal(t, http.StatusForbidden, resp.StatusCode)

	conn, _, err := h.dial(t, "board-1", "ann", http.Header{"Origin": {"https://app.example"}})
	require.NoError(t, err)
	h.waitUntilJoined(t, conn, "board-1")
}

// A timeout means the socket is still open; any other read error means it was closed.
func assertClosed(t *testing.T, conn *websocket.Conn) {
	t.Helper()
	_, err := read(t, conn)
	require.Error(t, err, "socket is still delivering messages")
	var netErr interface{ Timeout() bool }
	if errors.As(err, &netErr) {
		assert.False(t, netErr.Timeout(), "socket stayed open")
	}
}
