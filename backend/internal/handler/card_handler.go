package handler

import (
	"context"
	"database/sql"
	"errors"
	"log/slog"
	"net/http"

	"github.com/aumputthipong/mini-erp-kanban/backend/internal/core"
	"github.com/aumputthipong/mini-erp-kanban/backend/internal/db"
	"github.com/aumputthipong/mini-erp-kanban/backend/internal/dto"
	"github.com/aumputthipong/mini-erp-kanban/backend/internal/httputil"
	"github.com/aumputthipong/mini-erp-kanban/backend/internal/mapper"
	"github.com/aumputthipong/mini-erp-kanban/backend/internal/middleware"
	"github.com/aumputthipong/mini-erp-kanban/backend/internal/service"
	"github.com/aumputthipong/mini-erp-kanban/backend/internal/util"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// Mirrors RequireBoardMember: non-members get 404, never 403.
func boardMembership(ctx context.Context, svc service.BoardServicer, boardID, userID string) (core.BoardRole, *httputil.APIError) {
	role, err := svc.GetBoardMemberRole(ctx, boardID, userID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", httputil.NewAPIError(http.StatusNotFound, "Not found", nil)
		}
		return "", httputil.NewAPIError(http.StatusInternalServerError, "Failed to check board access", err)
	}
	return core.BoardRole(role), nil
}

// An outsider as assignee would see the card in My Work without being on the board.
func requireAssignableMember(ctx context.Context, svc service.BoardServicer, boardID string, assigneeID *string) *httputil.APIError {
	if assigneeID == nil || *assigneeID == "" {
		return nil
	}
	if _, err := svc.GetBoardMemberRole(ctx, boardID, *assigneeID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return httputil.NewAPIError(http.StatusUnprocessableEntity, "Assignee is not a member of this board", nil).WithCode("assignee_not_member")
		}
		return httputil.NewAPIError(http.StatusInternalServerError, "Failed to check assignee", err)
	}
	return nil
}

func canEditCard(card db.Card, userID string, role core.BoardRole) bool {
	isCreator := card.CreatedBy != nil && *card.CreatedBy == userID
	isAssignee := card.AssigneeID != nil && *card.AssigneeID == userID
	return core.CanEditCard(role, isCreator, isAssignee)
}

func (h *BoardHandler) requireBoardMembership(r *http.Request, boardID, userID string) (core.BoardRole, *httputil.APIError) {
	return boardMembership(r.Context(), h.boardService, boardID, userID)
}

// @Summary  Update card
// @Tags     cards
// @Accept   json
// @Produce  json
// @Security CookieAuth
// @Param    cardID  path     string                true  "Card UUID"
// @Param    payload body     dto.UpdateCardRequest true  "Fields to update"
// @Success  200     {object} dto.CardResponse
// @Failure  400     {object} httputil.ErrorResponse
// @Failure  404     {object} httputil.ErrorResponse
// @Failure  422     {object} httputil.ErrorResponse "code: assignee_not_member | too_many_tags | tag_not_on_board"
// @Router   /api/cards/{cardID} [patch]
func (h *BoardHandler) UpdateCard(w http.ResponseWriter, r *http.Request) error {
	cardIDStr := chi.URLParam(r, "cardID")
	if _, err := uuid.Parse(cardIDStr); err != nil {
		return httputil.NewAPIError(http.StatusBadRequest, "Invalid card ID format", err)
	}

	var req dto.UpdateCardRequest
	if err := httputil.DecodeAndValidate(r, &req); err != nil {
		return err
	}
	if req.Title != nil && *req.Title == "" {
		return httputil.NewAPIError(http.StatusBadRequest, "Title cannot be empty", nil)
	}

	userIDStr, ok := r.Context().Value(middleware.UserIDKey).(string)
	if !ok || userIDStr == "" {
		return httputil.NewAPIError(http.StatusUnauthorized, "Unauthorized", nil)
	}

	existing, err := h.boardService.GetCard(r.Context(), cardIDStr)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) || errors.Is(err, pgx.ErrNoRows) {
			return httputil.NewAPIError(http.StatusNotFound, "Not found", nil)
		}
		return httputil.NewAPIError(http.StatusInternalServerError, "Failed to load card", err)
	}

	boardID, err := h.boardService.GetBoardIDByColumn(r.Context(), existing.ColumnID)
	if err != nil {
		return httputil.NewAPIError(http.StatusInternalServerError, "Failed to resolve board", err)
	}
	role, apiErr := h.requireBoardMembership(r, boardID, userIDStr)
	if apiErr != nil {
		return apiErr
	}

	if !canEditCard(existing, userIDStr, role) {
		return httputil.NewAPIError(http.StatusForbidden, "You do not have permission to edit this card", nil)
	}
	if apiErr := requireAssignableMember(r.Context(), h.boardService, boardID, req.AssigneeID); apiErr != nil {
		return apiErr
	}

	updated, err := h.boardService.UpdateCard(r.Context(), service.UpdateCardParams{
		ID:                 cardIDStr,
		Title:              req.Title,
		Description:        req.Description,
		DueDate:            clearablePatch(req.DueDate, util.PtrStringToTimePtr),
		AssigneeID:         clearablePatch(req.AssigneeID, emptyToNil),
		Priority:           clearablePatch(req.Priority, emptyToNil),
		EstimatedHours:     clearablePatch(req.EstimatedHours, zeroToNil),
		TagIDs:             req.TagIDs,
		AcceptanceCriteria: req.AcceptanceCriteria,
		ImplementationNote: req.ImplementationNote,
	})
	if err != nil {
		switch {
		case errors.Is(err, service.ErrTooManyTags):
			return httputil.NewAPIError(http.StatusUnprocessableEntity, err.Error(), nil).WithCode("too_many_tags")
		case errors.Is(err, service.ErrTagNotOnBoard):
			return httputil.NewAPIError(http.StatusUnprocessableEntity, err.Error(), nil).WithCode("tag_not_on_board")
		}
		return httputil.NewAPIError(http.StatusInternalServerError, "Failed to update card", err)
	}

	if h.activity != nil {
		act, aerr := h.activity.Record(r.Context(), service.RecordParams{
			BoardID: boardID, ActorID: userIDStr,
			EventType: service.EventCardUpdated, EntityType: service.EntityCard, EntityID: &cardIDStr,
			Payload: service.CardUpdatedPayload{Title: updated.Card.Title, Fields: req.ChangedFields},
		})
		if aerr != nil {
			slog.Error("record activity failed", "card_id", cardIDStr, "err", aerr)
		} else {
			emitTo(h.broadcaster, boardID, core.WSActivityCreated, activityPayload(act))
		}
	}

	// Broadcast from resp, never req — an omitted field would be null and wipe other clients.
	resp := mapper.ToCardResponseFromUpdate(updated)

	emitTo(h.broadcaster, boardID, core.WSCardUpdated, map[string]any{
		"card_id":             cardIDStr,
		"title":               resp.Title,
		"description":         resp.Description,
		"due_date":            resp.DueDate,
		"assignee_id":         resp.AssigneeID,
		"priority":            resp.Priority,
		"estimated_hours":     resp.EstimatedHours,
		"tags":                resp.Tags,
		"acceptance_criteria": resp.AcceptanceCriteria,
		"implementation_note": resp.ImplementationNote,
	})

	httputil.RespondJSON(w, http.StatusOK, resp)
	return nil
}

// @Summary  Get card detail
// @Tags     cards
// @Produce  json
// @Security CookieAuth
// @Param    cardID path     string true "Card UUID"
// @Success  200    {object} dto.CardResponse
// @Failure  404    {object} httputil.ErrorResponse
// @Router   /api/cards/{cardID} [get]
func (h *BoardHandler) GetCard(w http.ResponseWriter, r *http.Request) error {
	cardIDStr := chi.URLParam(r, "cardID")
	if _, err := uuid.Parse(cardIDStr); err != nil {
		return httputil.NewAPIError(http.StatusBadRequest, "Invalid card ID format", err)
	}

	detail, err := h.boardService.GetCardDetail(r.Context(), cardIDStr)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) || errors.Is(err, sql.ErrNoRows) {
			return httputil.NewAPIError(http.StatusNotFound, "Not found", nil)
		}
		return httputil.NewAPIError(http.StatusInternalServerError, "Internal server error", err)
	}

	userID, ok := r.Context().Value(middleware.UserIDKey).(string)
	if !ok || userID == "" {
		return httputil.NewAPIError(http.StatusUnauthorized, "Unauthorized", nil)
	}
	boardID, err := h.boardService.GetBoardIDByColumn(r.Context(), detail.Card.ColumnID)
	if err != nil {
		return httputil.NewAPIError(http.StatusInternalServerError, "Failed to resolve board", err)
	}
	if _, apiErr := h.requireBoardMembership(r, boardID, userID); apiErr != nil {
		return apiErr
	}

	httputil.RespondJSON(w, http.StatusOK, mapper.ToCardDetailResponse(detail))
	return nil
}

func emptyToNil(s *string) *string {
	if s == nil || *s == "" {
		return nil
	}
	return s
}

// JSON null decodes like omitted, so "" / 0 are the clear sentinels (docs/adr/0009).
func clearablePatch[In, Out any](field *In, toValue func(*In) *Out) service.FieldPatch[Out] {
	if field == nil {
		return service.FieldPatch[Out]{}
	}
	return service.FieldPatch[Out]{Set: true, Value: toValue(field)}
}

func zeroToNil(f *float64) *float64 {
	if f == nil || *f == 0 {
		return nil
	}
	return f
}
