import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server, apiUrl } from "@/test/server";
import { renderWithUser } from "@/test/render";
import { useBoardStore } from "@/store/useBoardStore";
import { TagFilterDropdown } from "../TagFilterDropdown";

const TAGS = apiUrl("/boards/b1/tags");

function serveTags(tags: { id: string; name: string; color: string }[]) {
  server.use(http.get(TAGS, () => HttpResponse.json(tags.map((t) => ({ ...t, board_id: "b1" })))));
}

const tagFilter = () => useBoardStore.getState().filterTagIds;

describe("TagFilterDropdown", () => {
  it("multi-selects the board's tags and shows the count on the chip", async () => {
    serveTags([
      { id: "t1", name: "frontend", color: "blue" },
      { id: "t2", name: "urgent", color: "red" },
    ]);
    const { user } = renderWithUser(<TagFilterDropdown boardId="b1" />);
    await user.click(screen.getByRole("button", { name: /Tags/ }));
    await user.click(await screen.findByRole("button", { name: "frontend" }));
    await user.click(screen.getByRole("button", { name: "urgent" }));

    expect(tagFilter()).toEqual(["t1", "t2"]);
    expect(screen.getByRole("button", { name: /Tags/ })).toHaveTextContent("2");
    expect(screen.getByRole("button", { name: "urgent" })).toHaveAttribute("aria-pressed", "true");

    await user.click(screen.getByRole("button", { name: "frontend" }));
    expect(tagFilter()).toEqual(["t2"]);
  });

  it("clears every selected tag and closes", async () => {
    serveTags([{ id: "t1", name: "frontend", color: "blue" }]);
    useBoardStore.setState({ filterTagIds: ["t1"] });
    const { user } = renderWithUser(<TagFilterDropdown boardId="b1" />);
    await user.click(screen.getByRole("button", { name: /Tags/ }));
    await screen.findByRole("button", { name: "frontend" });
    await user.click(screen.getByRole("button", { name: "Clear filter" }));

    expect(tagFilter()).toEqual([]);
    expect(screen.queryByRole("button", { name: "frontend" })).not.toBeInTheDocument();
  });

  it("says the board has no tags when the list is empty", async () => {
    serveTags([]);
    const { user } = renderWithUser(<TagFilterDropdown boardId="b1" />);
    await user.click(screen.getByRole("button", { name: /Tags/ }));
    expect(await screen.findByText("Board นี้ยังไม่มี Tag")).toBeInTheDocument();
  });

  it("falls back to the empty message when loading tags fails", async () => {
    server.use(http.get(TAGS, () => HttpResponse.json({ error: "x" }, { status: 500 })));
    const { user } = renderWithUser(<TagFilterDropdown boardId="b1" />);
    await user.click(screen.getByRole("button", { name: /Tags/ }));
    expect(await screen.findByText("Board นี้ยังไม่มี Tag")).toBeInTheDocument();
  });
});
