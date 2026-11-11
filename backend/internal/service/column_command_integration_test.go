//go:build integration

package service_test

import (
	"context"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/aumputthipong/mini-erp-kanban/backend/internal/service"
)

func (f *commandFixture) cardDone(ctx context.Context, t *testing.T, cardID string) (bool, bool) {
	t.Helper()
	c, err := f.queries.GetCard(ctx, cardID)
	require.NoError(t, err)
	return c.IsDone, c.CompletedAt.Valid
}

func TestVerifyColumnInBoard_SameBoard_NoError(t *testing.T) {
	ctx := context.Background()
	f := newCommandFixture(t)
	col := f.seed.Column(ctx, f.boardID, "TODO", 1)
	assert.NoError(t, f.svc.VerifyColumnInBoard(ctx, col, f.boardID))
}

func TestVerifyColumnInBoard_OtherBoardOrMissing_ErrEntityBoardMismatch(t *testing.T) {
	ctx := context.Background()
	f := newCommandFixture(t)
	other := f.seed.Board(ctx, f.seed.User(ctx))
	foreignCol := f.seed.Column(ctx, other, "TODO", 1)

	assert.ErrorIs(t, f.svc.VerifyColumnInBoard(ctx, foreignCol, f.boardID), service.ErrEntityBoardMismatch)
	assert.ErrorIs(t, f.svc.VerifyColumnInBoard(ctx, "00000000-0000-4000-8000-000000000000", f.boardID), service.ErrEntityBoardMismatch)
}

func TestRenameColumn_ChangesOnlyTitle(t *testing.T) {
	ctx := context.Background()
	f := newCommandFixture(t)
	col := f.seed.Column(ctx, f.boardID, "DONE", 7)

	require.NoError(t, f.svc.RenameColumn(ctx, col, "Shipped"))

	var title, category string
	require.NoError(t, f.pool.QueryRow(ctx, `SELECT title, category FROM columns WHERE id = $1`, col).Scan(&title, &category))
	assert.Equal(t, "Shipped", title)
	assert.Equal(t, "DONE", category)
	assert.Equal(t, 7.0, f.columnPosition(ctx, t, col))
}

func TestDeleteColumn_RemovesItsCards(t *testing.T) {
	ctx := context.Background()
	f := newCommandFixture(t)
	col := f.seed.Column(ctx, f.boardID, "TODO", 1)
	keep := f.seed.Column(ctx, f.boardID, "TODO", 2)
	gone := f.seed.Card(ctx, col)
	kept := f.seed.Card(ctx, keep)

	require.NoError(t, f.svc.DeleteColumn(ctx, col))

	_, err := f.queries.GetCard(ctx, gone)
	assert.ErrorIs(t, err, pgx.ErrNoRows)
	_, err = f.queries.GetCard(ctx, kept)
	assert.NoError(t, err)
}

func TestDeleteCard_ReturnsTitleForTheActivityLog(t *testing.T) {
	ctx := context.Background()
	f := newCommandFixture(t)
	card := f.seed.Card(ctx, f.seed.Column(ctx, f.boardID, "TODO", 1))
	want, err := f.queries.GetCard(ctx, card)
	require.NoError(t, err)

	title, err := f.svc.DeleteCard(ctx, card)
	require.NoError(t, err)
	assert.Equal(t, want.Title, title)
	_, err = f.queries.GetCard(ctx, card)
	assert.ErrorIs(t, err, pgx.ErrNoRows)
}

func TestUpdateColumn_TodoToDone_MarksItsCardsDone(t *testing.T) {
	ctx := context.Background()
	f := newCommandFixture(t)
	col := f.seed.Column(ctx, f.boardID, "TODO", 1)
	card := f.seed.Card(ctx, col)

	require.NoError(t, f.svc.UpdateColumn(ctx, service.UpdateColumnParams{ID: col, Title: "Released", Category: "DONE"}))

	done, hasCompletedAt := f.cardDone(ctx, t, card)
	assert.True(t, done, "a card in a DONE column must be done, or it stays in the assignee's My Work")
	assert.True(t, hasCompletedAt)
}

func TestUpdateColumn_DoneToTodo_ReopensItsCards(t *testing.T) {
	ctx := context.Background()
	f := newCommandFixture(t)
	todo := f.seed.Column(ctx, f.boardID, "TODO", 1)
	done := f.seed.Column(ctx, f.boardID, "DONE", 2)
	card := f.seed.Card(ctx, todo)
	_, err := f.svc.MoveCard(ctx, card, done, 1)
	require.NoError(t, err)

	require.NoError(t, f.svc.UpdateColumn(ctx, service.UpdateColumnParams{ID: done, Title: "Review", Category: "TODO"}))

	isDone, hasCompletedAt := f.cardDone(ctx, t, card)
	assert.False(t, isDone)
	assert.False(t, hasCompletedAt)
}

func TestUpdateColumn_StillDone_KeepsCompletedAt(t *testing.T) {
	ctx := context.Background()
	f := newCommandFixture(t)
	todo := f.seed.Column(ctx, f.boardID, "TODO", 1)
	done := f.seed.Column(ctx, f.boardID, "DONE", 2)
	card := f.seed.Card(ctx, todo)
	_, err := f.svc.MoveCard(ctx, card, done, 1)
	require.NoError(t, err)
	before, err := f.queries.GetCard(ctx, card)
	require.NoError(t, err)

	require.NoError(t, f.svc.UpdateColumn(ctx, service.UpdateColumnParams{ID: done, Title: "Shipped", Category: "DONE"}))

	after, err := f.queries.GetCard(ctx, card)
	require.NoError(t, err)
	assert.True(t, after.IsDone)
	assert.True(t, before.CompletedAt.Time.Equal(after.CompletedAt.Time), "renaming a DONE column must not re-date finished work")
}
