import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Board } from "@/types/board";
import { ProjectCard } from "../ProjectCard";

const NOW = Date.parse("2026-11-10T12:00:00Z");
const DAY = 24 * 60 * 60 * 1000;
const iso = (ms: number) => new Date(ms).toISOString();

function board(o: Partial<Board> = {}): Board {
  return {
    id: "b1",
    title: "Alpha",
    created_at: iso(NOW - 30 * DAY),
    updated_at: iso(NOW - 30 * DAY),
    last_accessed_at: null,
    total_cards: 0,
    done_cards: 0,
    members: [],
    ...o,
  };
}

describe("ProjectCard", () => {
  it("links to the board's tasks and rounds the done percentage", () => {
    render(<ProjectCard board={board({ total_cards: 3, done_cards: 2 })} viewMode="grid" now={NOW} />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/board/b1/tasks");
    expect(screen.getByText("67%")).toBeInTheDocument();
  });

  it("shows 0% for a board without cards instead of dividing by zero", () => {
    render(<ProjectCard board={board()} viewMode="list" now={NOW} />);
    expect(screen.getByText("0%")).toBeInTheDocument();
  });

  it("is Active when the user opened it within 7 days, and says 'เปิด'", () => {
    render(<ProjectCard board={board({ last_accessed_at: iso(NOW - 2 * DAY) })} viewMode="grid" now={NOW} />);
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText(/^เปิด /)).toBeInTheDocument();
  });

  it("falls back to updated_at for old memberships and is Inactive after 7 days", () => {
    render(<ProjectCard board={board({ updated_at: iso(NOW - 8 * DAY) })} viewMode="grid" now={NOW} />);
    expect(screen.getByText("Inactive")).toBeInTheDocument();
    expect(screen.getByText(/^อัปเดต /)).toBeInTheDocument();
  });

  it("shows three avatars and a +N chip for the rest", () => {
    const members = ["Ann", "Bob", "Cat", "Dan", "Eve"].map((n, i) => ({ user_id: `u${i}`, full_name: n }));
    render(<ProjectCard board={board({ members })} viewMode="grid" now={NOW} />);
    expect(screen.getByTitle("Ann")).toBeInTheDocument();
    expect(screen.queryByTitle("Dan")).not.toBeInTheDocument();
    expect(screen.getByText("+2")).toBeInTheDocument();
  });

  it("uses a placeholder when the description is blank", () => {
    render(<ProjectCard board={board({ description: "   " })} viewMode="grid" now={NOW} />);
    expect(screen.getByText("ยังไม่มีคำอธิบาย Project")).toBeInTheDocument();
  });
});
