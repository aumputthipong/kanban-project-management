import { describe, it, expect, vi, beforeEach } from "vitest";
import { Suspense } from "react";
import { screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server, apiUrl } from "@/test/server";
import { renderWithUser } from "@/test/render";
import { makeMember } from "@/test/factories";
import type { BoardMember } from "@/types/board";
import { useBoardStore } from "@/store/useBoardStore";
import { useCardHighlightStore } from "@/store/useCardHighlightStore";
import KanbanPage from "../page";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
// Drag-and-drop board is covered by Playwright; this file tests the toolbar and page wiring.
vi.mock("@/components/board/task-board/KanbanBoard", () => ({ KanbanBoard: () => <div>board</div> }));

function seed(role: BoardMember["role"]) {
  useBoardStore.setState({
    currentUserId: "me",
    boardMembers: [makeMember({ user_id: "me", role, full_name: "Me" })],
  });
}

// A settled thenable lets React's use() read params without suspending.
function settled<T>(value: T): Promise<T> {
  return Object.assign(Promise.resolve(value), { status: "fulfilled", value });
}

async function renderPage() {
  const result = renderWithUser(
    <Suspense>
      <KanbanPage params={settled({ boardId: "b1" })} />
    </Suspense>,
  );
  await screen.findByText("board");
  return result;
}

beforeEach(() => {
  server.use(http.get(apiUrl("/boards/b1/tags"), () => HttpResponse.json([])));
  window.history.replaceState(null, "", "/board/b1/tasks");
});

describe("Kanban page", () => {
  it("highlights a deep-linked card and strips only ?card from the URL", async () => {
    seed("member");
    window.history.replaceState(null, "", "/board/b1/tasks?card=c42&view=compact");
    await renderPage();

    expect(useCardHighlightStore.getState().targetId).toBe("c42");
    expect(window.location.search).toBe("?view=compact");
  });

  it("leaves the highlight alone without a deep link", async () => {
    seed("member");
    await renderPage();
    expect(useCardHighlightStore.getState().targetId).toBeNull();
  });

  it("shows Clear filters only while a filter is on, and clears all of them", async () => {
    seed("member");
    const { user } = await renderPage();
    expect(screen.queryByRole("button", { name: /Clear filters/ })).not.toBeInTheDocument();

    useBoardStore.setState({ filterAssigneeId: "me", filterPriorities: ["high"], filterTagIds: ["t1"] });
    await user.click(await screen.findByRole("button", { name: /Clear filters/ }));

    const s = useBoardStore.getState();
    expect([s.filterAssigneeId, s.filterPriorities, s.filterTagIds]).toEqual([null, [], []]);
    expect(screen.queryByRole("button", { name: /Clear filters/ })).not.toBeInTheDocument();
  });

  it.each<[BoardMember["role"], boolean]>([
    ["member", false],
    ["manager", true],
    ["owner", true],
  ])("Add column for a %s: %s", async (role, visible) => {
    seed(role);
    await renderPage();
    expect(screen.queryByRole("button", { name: /Add column/ }) !== null).toBe(visible);
    expect(screen.getByRole("button", { name: /New Task/ })).toBeInTheDocument();
  });
});
