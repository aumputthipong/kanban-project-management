import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server, apiUrl } from "@/test/server";
import { renderWithUser } from "@/test/render";
import { makeCard, makeColumn } from "@/test/factories";
import { useBoardStore } from "@/store/useBoardStore";
import { ProjectCalendar } from "../ProjectCalendar";

// A zone behind UTC is where date-only strings parsed as UTC land on the previous day.
const originalTZ = process.env.TZ;
beforeAll(() => {
  process.env.TZ = "America/Los_Angeles";
});
afterAll(() => {
  process.env.TZ = originalTZ;
});

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const cardUrl = (id: string) => apiUrl(`/cards/${id}`);

function seed(cards: Parameters<typeof makeCard>[0][]) {
  useBoardStore.setState({
    currentUserId: "me",
    columns: [
      makeColumn({
        id: "col-1",
        title: "Doing",
        cards: cards.map((c, i) => makeCard({ id: `c${i}`, column_id: "col-1", ...c })),
      }),
    ],
  });
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 10, 18, 12, 0, 0));
});
afterEach(() => vi.useRealTimers());

const cellOf = (title: string) => screen.getByTitle(title).parentElement!.parentElement!;

describe("ProjectCalendar", () => {
  it("places a card on its due date cell", () => {
    seed([{ title: "Ship it", due_date: "2026-11-20" }]);
    renderWithUser(<ProjectCalendar boardId="b1" />);
    expect(within(cellOf("Ship it")).getByText("20")).toBeInTheDocument();
  });

  it("does not render cards without a due date", () => {
    seed([{ title: "No date", due_date: null }]);
    renderWithUser(<ProjectCalendar boardId="b1" />);
    expect(screen.queryByTitle("No date")).not.toBeInTheDocument();
  });

  it("collapses pills beyond three into a +N more button", () => {
    seed([1, 2, 3, 4].map((n) => ({ title: `T${n}`, due_date: "2026-11-25" })));
    renderWithUser(<ProjectCalendar boardId="b1" />);
    expect(screen.queryByTitle("T4")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "+ 1 more" })).toBeInTheDocument();
  });

  it("filters to my cards when My tasks is on", async () => {
    seed([
      { title: "Mine", due_date: "2026-11-20", assignee_id: "me" },
      { title: "Theirs", due_date: "2026-11-21", assignee_id: "other" },
    ]);
    const { user } = renderWithUser(<ProjectCalendar boardId="b1" />);
    await user.click(screen.getByRole("button", { name: "My tasks" }));
    expect(screen.getByTitle("Mine")).toBeInTheDocument();
    expect(screen.queryByTitle("Theirs")).not.toBeInTheDocument();
  });

  it("filters by status and clears the filter again", async () => {
    seed([
      { title: "Late", due_date: "2026-11-10" },
      { title: "Finished", due_date: "2026-11-12", is_done: true },
      { title: "Upcoming", due_date: "2026-11-22" },
    ]);
    const { user } = renderWithUser(<ProjectCalendar boardId="b1" />);
    await user.click(screen.getByRole("button", { name: "Status" }));
    await user.click(screen.getByRole("button", { name: /^Overdue/ }));
    expect(screen.getByTitle("Late")).toBeInTheDocument();
    expect(screen.queryByTitle("Finished")).not.toBeInTheDocument();
    expect(screen.queryByTitle("Upcoming")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^Overdue/ }));
    expect(screen.getByTitle("Finished")).toBeInTheDocument();
    expect(screen.getByTitle("Upcoming")).toBeInTheDocument();
  });

  it("opens the quick view with the card title when a pill is clicked", async () => {
    server.use(
      http.get(cardUrl("c0"), () =>
        HttpResponse.json(makeCard({ id: "c0", title: "Ship it", due_date: "2026-11-20" })),
      ),
    );
    seed([{ title: "Ship it", due_date: "2026-11-20" }]);
    const { user } = renderWithUser(<ProjectCalendar boardId="b1" />);
    await user.click(screen.getByTitle("Ship it"));
    expect(await screen.findByRole("heading", { name: "Ship it" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "เปิด task" })).toBeInTheDocument();
  });
});
