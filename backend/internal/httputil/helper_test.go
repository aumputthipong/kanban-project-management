package httputil

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
)

func respond(err error) *httptest.ResponseRecorder {
	w := httptest.NewRecorder()
	MakeHandler(func(http.ResponseWriter, *http.Request) error { return err })(w, httptest.NewRequest(http.MethodGet, "/", nil))
	return w
}

func TestMakeHandler_APIErrorWithCode_SendsCode(t *testing.T) {
	w := respond(NewAPIError(http.StatusUnprocessableEntity, "nope", nil).WithCode("no_todo_column"))
	assert.Equal(t, http.StatusUnprocessableEntity, w.Code)
	assert.JSONEq(t, `{"error":"nope","code":"no_todo_column"}`, w.Body.String())
}

func TestMakeHandler_APIErrorWithoutCode_OmitsCode(t *testing.T) {
	w := respond(NewAPIError(http.StatusBadRequest, "bad", nil))
	assert.JSONEq(t, `{"error":"bad"}`, w.Body.String())
}

func TestMakeHandler_PlainError_Returns500WithoutDetail(t *testing.T) {
	w := respond(errors.New("db exploded"))
	assert.Equal(t, http.StatusInternalServerError, w.Code)
	assert.JSONEq(t, `{"error":"Internal server error"}`, w.Body.String())
}
