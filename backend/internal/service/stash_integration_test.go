//go:build integration

package service_test

import (
	"context"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestHardDeleteBoard_LiveBoard_ReturnsErrNoRowsAndKeepsIt(t *testing.T) {
	ctx := context.Background()
	f := newBoardFixture(t)
	boardID := f.seed.Board(ctx, f.userID)

	err := f.svc.HardDeleteBoard(ctx, boardID)
	assert.ErrorIs(t, err, pgx.ErrNoRows)

	_, err = f.queries.GetBoardByID(ctx, boardID)
	assert.NoError(t, err, "a live board must survive a hard delete")
}

func TestHardDeleteBoard_StashedBoard_CascadesChildren(t *testing.T) {
	ctx := context.Background()
	f := newBoardFixture(t)
	boardID := f.seed.Board(ctx, f.userID)
	colID := f.seed.Column(ctx, boardID, "TODO", 1000)
	f.seed.Card(ctx, colID)
	require.NoError(t, f.svc.StashBoard(ctx, boardID))

	require.NoError(t, f.svc.HardDeleteBoard(ctx, boardID))

	_, err := f.queries.GetBoardByID(ctx, boardID)
	assert.ErrorIs(t, err, pgx.ErrNoRows)
	var leftover int
	require.NoError(t, f.pool.QueryRow(ctx,
		`SELECT (SELECT count(*) FROM columns WHERE board_id = $1)
		      + (SELECT count(*) FROM cards WHERE column_id = $2)
		      + (SELECT count(*) FROM board_members WHERE board_id = $1)`, boardID, colID).Scan(&leftover))
	assert.Zero(t, leftover)
}

func TestRestoreBoard_StashedBoard_ClearsDeletedAt(t *testing.T) {
	ctx := context.Background()
	f := newBoardFixture(t)
	boardID := f.seed.Board(ctx, f.userID)
	require.NoError(t, f.svc.StashBoard(ctx, boardID))

	require.NoError(t, f.svc.RestoreBoard(ctx, boardID))

	b, err := f.queries.GetBoardByID(ctx, boardID)
	require.NoError(t, err)
	assert.False(t, b.DeletedAt.Valid)
}

func TestRestoreBoard_LiveBoard_ReturnsErrNoRows(t *testing.T) {
	ctx := context.Background()
	f := newBoardFixture(t)
	boardID := f.seed.Board(ctx, f.userID)

	assert.ErrorIs(t, f.svc.RestoreBoard(ctx, boardID), pgx.ErrNoRows)
}
