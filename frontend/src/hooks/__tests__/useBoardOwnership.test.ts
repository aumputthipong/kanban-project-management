import { describe, it, expect } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useBoardOwnership } from "@/hooks/useBoardOwnership";
import { useBoardStore } from "@/store/useBoardStore";
import { makeCard, makeColumn, makeMember } from "@/test/factories";

const alice = makeMember({ user_id: "alice", full_name: "Alice" });
const bob = makeMember({ id: "m-2", user_id: "bob", full_name: "Bob" });

function seed(columns: ReturnType<typeof makeColumn>[], members = [alice, bob]) {
  useBoardStore.setState({ columns, boardMembers: members });
}

describe("useBoardOwnership", () => {
  it("lists non-DONE columns by position as headers", () => {
    seed([
      makeColumn({ id: "done", title: "Done", position: 1, category: "DONE" }),
      makeColumn({ id: "doing", title: "Doing", position: 3 }),
      makeColumn({ id: "todo", title: "Todo", position: 2 }),
    ]);
    const { result } = renderHook(() => useBoardOwnership());
    expect(result.current.columns.map((c) => c.id)).toEqual(["todo", "doing"]);
  });

  it("counts held cards per column, skipping done, unassigned and DONE columns", () => {
    seed([
      makeColumn({
        id: "todo",
        cards: [
          makeCard({ id: "c1", assignee_id: "alice" }),
          makeCard({ id: "c2", assignee_id: "alice", is_done: true }),
          makeCard({ id: "c3", assignee_id: null }),
        ],
      }),
      makeColumn({
        id: "doing",
        position: 2,
        cards: [makeCard({ id: "c4", assignee_id: "alice" })],
      }),
      makeColumn({
        id: "done",
        position: 3,
        category: "DONE",
        cards: [makeCard({ id: "c5", assignee_id: "alice" })],
      }),
    ]);
    const { result } = renderHook(() => useBoardOwnership());
    const a = result.current.members.find((m) => m.userId === "alice")!;
    expect(a.totalHeld).toBe(2);
    expect(a.countByColumn).toEqual({ todo: 1, doing: 1 });
    expect(a.cards.map((c) => c.id)).toEqual(["c1", "c4"]);
  });

  it("keeps idle members and sorts by load, then name", () => {
    seed(
      [makeColumn({ cards: [makeCard({ assignee_id: "bob" })] })],
      [alice, bob, makeMember({ id: "m-3", user_id: "cara", full_name: "Cara" })]
    );
    const { result } = renderHook(() => useBoardOwnership());
    expect(result.current.members.map((m) => [m.name, m.totalHeld])).toEqual([
      ["Bob", 1],
      ["Alice", 0],
      ["Cara", 0],
    ]);
  });

  it("keeps an assignee who left the board, using the card's name", () => {
    seed(
      [makeColumn({ cards: [makeCard({ assignee_id: "gone", assignee_name: "Gone" })] })],
      []
    );
    const { result } = renderHook(() => useBoardOwnership());
    expect(result.current.members).toMatchObject([{ userId: "gone", name: "Gone", totalHeld: 1 }]);
  });

  it("orders a member's cards by due date, undated last", () => {
    seed([
      makeColumn({
        cards: [
          makeCard({ id: "none", assignee_id: "alice" }),
          makeCard({ id: "late", assignee_id: "alice", due_date: "2026-12-20" }),
          makeCard({ id: "soon", assignee_id: "alice", due_date: "2026-12-01" }),
        ],
      }),
    ]);
    const { result } = renderHook(() => useBoardOwnership());
    expect(result.current.members[0].cards.map((c) => c.id)).toEqual(["soon", "late", "none"]);
  });

  it("recomputes when the store changes", () => {
    seed([makeColumn()]);
    const { result } = renderHook(() => useBoardOwnership());
    expect(result.current.members.every((m) => m.totalHeld === 0)).toBe(true);
    act(() => useBoardStore.getState().addCardToStore(makeCard({ assignee_id: "bob" })));
    expect(result.current.members[0]).toMatchObject({ userId: "bob", totalHeld: 1 });
  });
});
