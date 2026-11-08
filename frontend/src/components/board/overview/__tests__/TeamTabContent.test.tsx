import { describe, it, expect, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server, apiUrl } from "@/test/server";
import { renderWithUser } from "@/test/render";
import { makeCard, makeColumn, makeMember } from "@/test/factories";
import { useBoardStore } from "@/store/useBoardStore";
import { TeamTabContent } from "../TeamTabContent";

function seedBoard() {
  useBoardStore.setState({
    currentUserId: "u-1",
    boardMembers: [
      makeMember({ id: "m1", user_id: "u-1", full_name: "Alice" }),
      makeMember({ id: "m2", user_id: "u-2", full_name: "Bob" }),
    ],
    columns: [
      makeColumn({
        id: "todo",
        title: "To Do",
        position: 1,
        cards: [
          makeCard({ id: "c1", column_id: "todo", title: "Alice one", assignee_id: "u-1", assignee_name: "Alice" }),
          makeCard({ id: "c2", column_id: "todo", title: "Alice two", assignee_id: "u-1", assignee_name: "Alice" }),
          makeCard({ id: "c3", column_id: "todo", title: "Nobody's", assignee_id: null }),
        ],
      }),
      makeColumn({
        id: "doing",
        title: "Doing",
        position: 2,
        cards: [makeCard({ id: "c4", column_id: "doing", title: "Alice three", assignee_id: "u-1", assignee_name: "Alice", is_done: false })],
      }),
      makeColumn({
        id: "done",
        title: "Done",
        position: 3,
        category: "DONE",
        cards: [makeCard({ id: "c5", column_id: "done", title: "Shipped", assignee_id: "u-2", assignee_name: "Bob", is_done: true })],
      }),
    ],
  });
}

describe("TeamTabContent", () => {
  it("counts only open assigned cards per member and marks idle members", async () => {
    server.use(http.get(apiUrl("/boards/b1/activities"), () => HttpResponse.json([])));
    seedBoard();
    renderWithUser(<TeamTabContent boardId="b1" onSelectCard={vi.fn()} />);

    const alice = screen.getByText("Alice").closest("tr")!;
    expect(within(alice).getByText("3")).toBeInTheDocument();
    expect(within(alice).getByText("2")).toBeInTheDocument();
    expect(within(alice).getByText("คุณ")).toBeInTheDocument();

    const bob = screen.getByText("Bob").closest("tr")!;
    expect(within(bob).getByText("ว่าง")).toBeInTheDocument();
  });

  it("hides done columns from the status headers", () => {
    server.use(http.get(apiUrl("/boards/b1/activities"), () => HttpResponse.json([])));
    seedBoard();
    renderWithUser(<TeamTabContent boardId="b1" onSelectCard={vi.fn()} />);
    const headers = screen.getAllByRole("columnheader").map((h) => h.textContent);
    expect(headers).toEqual(expect.arrayContaining(["To Do", "Doing"]));
    expect(headers).not.toContain("Done");
  });

  it("expands a member and selects a held card", async () => {
    server.use(http.get(apiUrl("/boards/b1/activities"), () => HttpResponse.json([])));
    seedBoard();
    const onSelectCard = vi.fn();
    const { user } = renderWithUser(<TeamTabContent boardId="b1" onSelectCard={onSelectCard} />);

    await user.click(screen.getByText("Alice"));
    await user.click(screen.getByRole("button", { name: /Alice two/ }));
    expect(onSelectCard).toHaveBeenCalledWith(expect.objectContaining({ id: "c2" }));
  });

  it("shows the feed entry rendered from the activities endpoint", async () => {
    server.use(
      http.get(apiUrl("/boards/b1/activities"), () =>
        HttpResponse.json([
          {
            id: "a1", board_id: "b1", actor_id: "u-2", actor_name: "Bob",
            event_type: "card.created", entity_type: "card", entity_id: "c1",
            payload: { title: "Fresh card" }, created_at: new Date().toISOString(),
          },
        ]),
      ),
    );
    seedBoard();
    renderWithUser(<TeamTabContent boardId="b1" onSelectCard={vi.fn()} />);
    expect(await screen.findByText("Fresh card")).toBeInTheDocument();
    expect(screen.getByText("created card")).toBeInTheDocument();
  });
});
