import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse, type JsonBodyType } from "msw";
import { DndContext } from "@dnd-kit/core";
import { CardDetailModal } from "@/components/board/card-modal/CardDetailModal";
import { KanbanColumn } from "@/components/board/task-board/Column";
import { useCanEdit } from "@/hooks/useCanEdit";
import { useBoardStore } from "@/store/useBoardStore";
import { server, apiUrl } from "@/test/server";
import { makeCard, makeColumn, makeMember } from "@/test/factories";
import type { BoardRole } from "@/lib/permissions";
import type { Card } from "@/types/board";

const noop = () => {};

function seed(role: BoardRole, card: Partial<Card> = {}) {
  useBoardStore.setState({
    currentUserId: "me",
    boardMembers: [makeMember({ user_id: "me", role })],
    columns: [makeColumn({ cards: [makeCard({ id: "c1", created_by: "other", ...card })] })],
  });
}

function ModalFor({ card }: { card: Card }) {
  const canEdit = useCanEdit(card);
  return (
    <CardDetailModal
      card={card}
      boardId="b1"
      isOpen
      onClose={noop}
      onUpdated={noop}
      onDelete={noop}
      canEdit={canEdit}
    />
  );
}

function CardModalAsMe() {
  const card = useBoardStore((s) => s.columns[0]?.cards[0]);
  return card ? <ModalFor card={card} /> : null;
}

// The modal loads subtasks, members, tags and source on mount; let them land in-test.
let answered = 0;
const settled = () => waitFor(() => expect(answered).toBe(4));
const answer = (body: JsonBodyType) => () => {
  answered++;
  return HttpResponse.json(body);
};

beforeEach(() => {
  answered = 0;
  server.use(
    http.get(apiUrl("/cards/c1/subtasks"), answer([])),
    http.get(apiUrl("/boards/b1/members"), answer([])),
    http.get(apiUrl("/boards/b1/tags"), answer([])),
    http.get(apiUrl("/cards/c1/source"), answer(null))
  );
});

const titleIsEditable = () => screen.queryByRole("textbox", { name: "Title" }) !== null;
const hasDelete = () => screen.queryByRole("button", { name: "Delete" }) !== null;

describe("card modal by role", () => {
  it.each([
    { who: "member, not involved", role: "member", card: {}, edit: false, del: false },
    { who: "member, assignee", role: "member", card: { assignee_id: "me" }, edit: true, del: false },
    { who: "member, creator", role: "member", card: { created_by: "me" }, edit: true, del: true },
    { who: "manager", role: "manager", card: {}, edit: true, del: true },
    { who: "owner", role: "owner", card: {}, edit: true, del: true },
  ] as const)("$who: edit=$edit delete=$del", async ({ role, card, edit, del }) => {
    seed(role, card);
    render(<CardModalAsMe />);
    expect(titleIsEditable()).toBe(edit);
    expect(hasDelete()).toBe(del);
    await settled();
  });

  it("shows the title read-only when editing is not allowed", async () => {
    seed("member", { title: "Locked" });
    render(<CardModalAsMe />);
    expect(screen.getByRole("heading", { name: "Locked" })).toBeInTheDocument();
    await settled();
  });
});

describe("column options by role", () => {
  function renderColumn() {
    return render(
      <DndContext>
        <KanbanColumn
          id="col-1"
          boardId="b1"
          title="Todo"
          category="TODO"
          cards={[]}
          onAddCard={noop}
          onDeleteCard={noop}
          onSaveCard={noop}
          onDeleteColumn={noop}
          onUpdateColumn={noop}
        />
      </DndContext>
    );
  }

  it.each([
    ["member", false],
    ["manager", true],
    ["owner", true],
  ] as const)("%s sees column options: %s", (role, visible) => {
    seed(role);
    renderColumn();
    expect(screen.queryByRole("button", { name: "Column options" }) !== null).toBe(visible);
  });

  it("hides column options from someone who is not a member", () => {
    useBoardStore.setState({ currentUserId: "me", boardMembers: [] });
    renderColumn();
    expect(screen.queryByRole("button", { name: "Column options" })).not.toBeInTheDocument();
  });
});
