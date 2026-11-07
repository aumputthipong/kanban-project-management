import { describe, it, expect, beforeEach, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { CreateTaskModal } from "@/components/board/task-board/CreateTaskModal";
import { useCardActions } from "@/hooks/useCardActions";
import { useBoardStore } from "@/store/useBoardStore";
import { server, apiUrl } from "@/test/server";
import { renderWithUser } from "@/test/render";
import { makeColumn, makeMember } from "@/test/factories";
import { findCard, toastMessages } from "@/test/board";

const onClose = vi.fn();

function Harness() {
  const { handleAddCard } = useCardActions();
  return <CreateTaskModal onClose={onClose} onCreate={handleAddCard} />;
}

let body: Record<string, unknown> | undefined;

beforeEach(() => {
  onClose.mockReset();
  body = undefined;
  useBoardStore.setState({
    currentUserId: "me",
    boardMembers: [
      makeMember({ user_id: "me", full_name: "Me Myself" }),
      makeMember({ id: "m-2", user_id: "bee", full_name: "Bee" }),
    ],
    columns: [
      makeColumn({ id: "todo", title: "Todo" }),
      makeColumn({ id: "doing", title: "Doing", position: 2 }),
      makeColumn({ id: "done", title: "Done", position: 3, category: "DONE" }),
    ],
  });
  server.use(
    http.post(apiUrl("/cards"), async ({ request }) => {
      body = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json({ id: "new" }, { status: 201 });
    })
  );
});

const createButton = () => screen.getByRole("button", { name: "Create Task" });

describe("CreateTaskModal", () => {
  it("needs a non-blank title before it can submit", async () => {
    const { user } = renderWithUser(<Harness />);
    expect(createButton()).toBeDisabled();
    await user.type(screen.getByRole("textbox", { name: "Title" }), "   ");
    expect(createButton()).toBeDisabled();
  });

  it("defaults to me as assignee and offers only non-DONE columns", () => {
    renderWithUser(<Harness />);
    expect(screen.getByRole("button", { name: /Me$/ })).toHaveAttribute("aria-pressed", "true");
    const column = screen.getByRole("combobox", { name: "Column" });
    expect(column).toHaveValue("todo");
    expect(screen.queryByRole("option", { name: "Done" })).not.toBeInTheDocument();
  });

  it("creates the card with every field the user filled in", async () => {
    const { user } = renderWithUser(<Harness />);
    await user.type(screen.getByRole("textbox", { name: "Title" }), "  Write docs  ");
    await user.type(screen.getByRole("textbox", { name: "Description" }), "For the API");
    await user.click(screen.getByRole("button", { name: "Add subtask" }));
    await user.type(screen.getByRole("textbox", { name: "Subtask 1" }), "Outline{Enter}");
    await user.type(screen.getByRole("textbox", { name: "Subtask 2" }), "   ");
    await user.click(screen.getByRole("button", { name: /Bee$/ }));
    await user.click(screen.getByRole("button", { name: /High/ }));
    await user.selectOptions(screen.getByRole("combobox", { name: "Column" }), "doing");
    await user.click(screen.getByRole("button", { name: /Pick date/ }));
    fireEvent.change(screen.getByLabelText("Due date", { selector: "input" }), {
      target: { value: "2026-12-24" },
    });
    await user.click(createButton());

    expect(onClose).toHaveBeenCalledOnce();
    await waitFor(() => expect(findCard("new")).toBeDefined());
    expect(body).toEqual({
      column_id: "doing",
      title: "Write docs",
      position: 65536,
      assignee_id: "bee",
      priority: "high",
      due_date: "2026-12-24",
      description: "For the API",
      subtasks: ["Outline"],
    });
    expect(findCard("new")).toMatchObject({
      assignee_name: "Bee",
      due_date: "2026-12-24",
      total_subtasks: 1,
    });
  });

  it("sends no assignee when Unassigned is picked, and Enter submits", async () => {
    const { user } = renderWithUser(<Harness />);
    await user.click(screen.getByRole("button", { name: /Unassigned$/ }));
    await user.type(screen.getByRole("textbox", { name: "Title" }), "Quick{Enter}");
    await waitFor(() => expect(body).toBeDefined());
    expect(body).not.toHaveProperty("assignee_id");
    expect(body).toMatchObject({ title: "Quick", column_id: "todo" });
  });

  it("clicking the chosen priority again clears it", async () => {
    const { user } = renderWithUser(<Harness />);
    const high = screen.getByRole("button", { name: /High/ });
    await user.click(high);
    expect(high).toHaveAttribute("aria-pressed", "true");
    await user.click(high);
    expect(high).toHaveAttribute("aria-pressed", "false");
  });

  it("toasts when the server rejects the card", async () => {
    server.use(http.post(apiUrl("/cards"), () => HttpResponse.json({}, { status: 500 })));
    const { user } = renderWithUser(<Harness />);
    await user.type(screen.getByRole("textbox", { name: "Title" }), "Doomed{Enter}");
    await waitFor(() => expect(toastMessages()).toEqual(["สร้างการ์ดไม่สำเร็จ"]));
    expect(useBoardStore.getState().columns.flatMap((c) => c.cards)).toEqual([]);
  });
});
