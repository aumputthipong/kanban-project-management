import { describe, expect, it } from "vitest";
import type { Card } from "@/types/board";
import { hasBoardFilters, matchesBoardFilters } from "../boardFilters";
import { UNASSIGNED_FILTER } from "@/store/useBoardStore";

const card = (overrides: Partial<Card> = {}) =>
  ({ id: "c1", assignee_id: "u1", priority: "high", tags: [{ id: "t1" }], ...overrides }) as Card;

describe("hasBoardFilters", () => {
  it("is false when nothing is set", () => {
    expect(hasBoardFilters({ assigneeId: null, priorities: [], tagIds: [] })).toBe(false);
  });

  it("is true for any one filter", () => {
    expect(hasBoardFilters({ assigneeId: "u1" })).toBe(true);
    expect(hasBoardFilters({ priorities: ["low"] })).toBe(true);
    expect(hasBoardFilters({ tagIds: ["t1"] })).toBe(true);
  });
});

describe("matchesBoardFilters", () => {
  it("matches every card when no filter is set", () => {
    expect(matchesBoardFilters(card(), {})).toBe(true);
  });

  it("filters by assignee, including unassigned", () => {
    expect(matchesBoardFilters(card(), { assigneeId: "u1" })).toBe(true);
    expect(matchesBoardFilters(card(), { assigneeId: "u2" })).toBe(false);
    expect(matchesBoardFilters(card({ assignee_id: null }), { assigneeId: UNASSIGNED_FILTER })).toBe(true);
    expect(matchesBoardFilters(card(), { assigneeId: UNASSIGNED_FILTER })).toBe(false);
  });

  it("filters by priority and by any matching tag", () => {
    expect(matchesBoardFilters(card(), { priorities: ["high", "low"] })).toBe(true);
    expect(matchesBoardFilters(card(), { priorities: ["low"] })).toBe(false);
    expect(matchesBoardFilters(card(), { tagIds: ["t2", "t1"] })).toBe(true);
    expect(matchesBoardFilters(card({ tags: [] }), { tagIds: ["t1"] })).toBe(false);
  });
});
