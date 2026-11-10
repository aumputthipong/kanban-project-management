import { describe, it, expect } from "vitest";
import { screen, within } from "@testing-library/react";
import { renderWithUser } from "@/test/render";
import type { Board } from "@/types/board";
import { useProjectViewStore } from "@/store/useProjectViewStore";
import { BoardsClient } from "../BoardsClient";

function board(o: Partial<Board> & { id: string; title: string }): Board {
  return {
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    last_accessed_at: null,
    total_cards: 0,
    done_cards: 0,
    members: [],
    ...o,
  };
}

// Backend order is "recent" (per-user last_accessed_at), deliberately not alphabetical.
const BOARDS = [
  board({ id: "b", title: "Beta launch", created_at: "2026-03-01T00:00:00Z", total_cards: 2 }),
  board({ id: "a", title: "alpha api", created_at: "2026-01-01T00:00:00Z", total_cards: 9 }),
  board({ id: "c", title: "Charlie docs", created_at: "2026-02-01T00:00:00Z", total_cards: 5 }),
  board({ id: "z", title: "Zeta idea", created_at: "2026-04-01T00:00:00Z", total_cards: 0 }),
];

const titles = () => screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);

describe("BoardsClient", () => {
  it("keeps the backend order for 'recent' and splits started from not-started", () => {
    renderWithUser(<BoardsClient boards={BOARDS} />);
    expect(titles()).toEqual(["Beta launch", "alpha api", "Charlie docs", "Zeta idea"]);

    const started = screen.getByText("กำลังทำงานอยู่").closest("section")!;
    const notStarted = screen.getByText("ยังไม่เริ่ม").closest("section")!;
    expect(within(started).getByText("3")).toBeInTheDocument();
    expect(within(notStarted).getByRole("heading", { name: "Zeta idea" })).toBeInTheDocument();
  });

  it.each([
    ["name_asc", ["alpha api", "Beta launch", "Charlie docs", "Zeta idea"]],
    ["name_desc", ["Charlie docs", "Beta launch", "alpha api", "Zeta idea"]],
    ["newest", ["Beta launch", "Charlie docs", "alpha api", "Zeta idea"]],
    ["oldest", ["alpha api", "Charlie docs", "Beta launch", "Zeta idea"]],
    ["most_tasks", ["alpha api", "Charlie docs", "Beta launch", "Zeta idea"]],
  ])("sorts by %s within each group", async (option, expected) => {
    const { user } = renderWithUser(<BoardsClient boards={BOARDS} />);
    await user.selectOptions(screen.getByRole("combobox"), option);
    expect(titles()).toEqual(expected);
  });

  it("searches titles case-insensitively and shows an empty state", async () => {
    const { user } = renderWithUser(<BoardsClient boards={BOARDS} />);
    const search = screen.getByPlaceholderText("ค้นหา Project...");

    await user.type(search, "bETA");
    expect(titles()).toEqual(["Beta launch"]);
    expect(screen.queryByText("ยังไม่เริ่ม")).not.toBeInTheDocument();

    await user.clear(search);
    await user.type(search, "nothing like this");
    expect(screen.getByText("ไม่พบ Project")).toBeInTheDocument();
  });

  it("switches between grid and list and remembers the choice in the store", async () => {
    const { user } = renderWithUser(<BoardsClient boards={BOARDS} />);
    expect(screen.getAllByText("ความคืบหน้า")).toHaveLength(4);

    await user.click(screen.getByTitle("มุมมองรายการ"));
    expect(useProjectViewStore.getState().viewMode).toBe("list");
    expect(screen.queryByText("ความคืบหน้า")).not.toBeInTheDocument();

    await user.click(screen.getByTitle("มุมมองตาราง"));
    expect(useProjectViewStore.getState().viewMode).toBe("grid");
  });
});
