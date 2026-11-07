import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { useState } from "react";
import { http, HttpResponse } from "msw";
import { useMyWorkActions } from "@/hooks/useMyWorkActions";
import { useToastStore } from "@/store/useToastStore";
import { server, apiUrl } from "@/test/server";
import { toastMessages } from "@/test/board";
import type { MyWorkCard, MyWorkCounts, MyWorkResponse } from "@/types/myWork";

function makeWorkCard(overrides: Partial<MyWorkCard> = {}): MyWorkCard {
  return {
    id: "w1",
    title: "Ship it",
    board_id: "b1",
    board_name: "Board",
    column_name: "Todo",
    priority: null,
    due_date: "2026-11-07",
    estimated_hours: null,
    status: "todo",
    group: "today",
    total_subtasks: 0,
    completed_subtasks: 0,
    ...overrides,
  };
}

const counts = (o: Partial<MyWorkCounts> = {}): MyWorkCounts => ({
  overdue: 0,
  today: 2,
  this_week: 0,
  later: 0,
  no_date: 0,
  total: 2,
  ...o,
});

const initial: MyWorkResponse = {
  cards: [makeWorkCard(), makeWorkCard({ id: "w2", title: "Second" })],
  counts: counts(),
};

function setup(start: MyWorkResponse = initial) {
  return renderHook(() => {
    const [data, setData] = useState<MyWorkResponse | null>(start);
    const [count, setCounts] = useState<MyWorkCounts | null>(start.counts);
    const [error, setError] = useState<string | null>(null);
    const actions = useMyWorkActions({ data, setData, setCounts, setError });
    return { ...actions, data, counts: count, error };
  });
}

const ids = (r: { current: { data: MyWorkResponse | null } }) =>
  r.current.data?.cards.map((c) => c.id);

const fail = (status: number) => () => HttpResponse.json({ error: "server says no" }, { status });

// Unmount commits pending completions; do it while this handler is still registered.
beforeEach(() =>
  server.use(
    http.post(apiUrl("/my-tasks/:id/complete"), () => new HttpResponse(null, { status: 204 }))
  )
);
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("handleComplete", () => {
  it("hides the card, updates counts and offers undo", () => {
    vi.useFakeTimers({ toFake: ["setTimeout"] });
    const { result } = setup();
    act(() => result.current.handleComplete("w1"));
    expect(ids(result)).toEqual(["w2"]);
    expect(result.current.counts).toMatchObject({ today: 1, total: 1 });
    expect(result.current.doneToday).toBe(1);
    expect(useToastStore.getState().toasts[0]).toMatchObject({
      message: 'ทำ "Ship it" เสร็จแล้ว',
      actionLabel: "ย้อนกลับ",
    });
  });

  it("commits to the server only after the undo window", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout"] });
    let completed = 0;
    server.use(
      http.post(apiUrl("/my-tasks/w1/complete"), () => {
        completed++;
        return new HttpResponse(null, { status: 204 });
      })
    );
    const { result } = setup();
    act(() => result.current.handleComplete("w1"));
    await act(() => vi.advanceTimersByTimeAsync(4999));
    expect(completed).toBe(0);
    await act(() => vi.advanceTimersByTimeAsync(1));
    vi.useRealTimers();
    await waitFor(() => expect(completed).toBe(1));
  });

  it("puts the card back on undo and never calls the server", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout"] });
    const { result } = setup();
    act(() => result.current.handleComplete("w1"));
    act(() => useToastStore.getState().toasts[0].onAction?.());
    expect(ids(result)).toContain("w1");
    expect(result.current.counts).toMatchObject({ today: 2, total: 2 });
    expect(result.current.doneToday).toBe(0);
    await act(() => vi.advanceTimersByTimeAsync(5000));
  });

  it("ignores a second click while the first is pending", () => {
    vi.useFakeTimers({ toFake: ["setTimeout"] });
    const { result } = setup();
    act(() => result.current.handleComplete("w1"));
    act(() => result.current.handleComplete("w1"));
    expect(result.current.counts).toMatchObject({ today: 1, total: 1 });
    expect(useToastStore.getState().toasts).toHaveLength(1);
  });

  it("restores the card with a Thai message when the server fails", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout"] });
    server.use(http.post(apiUrl("/my-tasks/w1/complete"), fail(500)));
    const { result } = setup();
    act(() => result.current.handleComplete("w1"));
    await act(() => vi.advanceTimersByTimeAsync(5000));
    vi.useRealTimers();
    await waitFor(() => expect(ids(result)).toContain("w1"));
    expect(result.current.counts).toMatchObject({ today: 2, total: 2 });
    expect(result.current.error).toBe("ทำเครื่องหมายเสร็จไม่สำเร็จ");
  });

  it("restores the card without a second message on 403", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout"] });
    server.use(http.post(apiUrl("/my-tasks/w1/complete"), fail(403)));
    const { result } = setup();
    act(() => result.current.handleComplete("w1"));
    await act(() => vi.advanceTimersByTimeAsync(5000));
    vi.useRealTimers();
    await waitFor(() => expect(ids(result)).toContain("w1"));
    expect(result.current.error).toBeNull();
  });

  it("commits pending completions when the page unmounts", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout"] });
    let completed = 0;
    server.use(
      http.post(apiUrl("/my-tasks/w1/complete"), () => {
        completed++;
        return new HttpResponse(null, { status: 204 });
      })
    );
    const { result, unmount } = setup();
    act(() => result.current.handleComplete("w1"));
    unmount();
    vi.useRealTimers();
    await waitFor(() => expect(completed).toBe(1));
  });

  it("hides pending cards from a refetch", () => {
    vi.useFakeTimers({ toFake: ["setTimeout"] });
    const { result } = setup();
    act(() => result.current.handleComplete("w1"));
    expect(result.current.filterPending(initial.cards).map((c) => c.id)).toEqual(["w2"]);
  });
});

describe("handleSnooze", () => {
  const refreshed: MyWorkResponse = {
    cards: [makeWorkCard({ id: "w2" })],
    counts: counts({ today: 1, this_week: 1, total: 2 }),
  };

  it("saves the new date as a one-field PATCH and refreshes", async () => {
    let body: unknown;
    server.use(
      http.patch(apiUrl("/cards/w1"), async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({});
      }),
      http.get(apiUrl("/my-tasks"), () => HttpResponse.json(refreshed))
    );
    const { result } = setup();
    await act(() => result.current.handleSnooze("w1", "2026-11-08", "พรุ่งนี้"));
    expect(body).toEqual({ due_date: "2026-11-08", changed_fields: ["due_date"] });
    expect(result.current.counts).toEqual(refreshed.counts);
    expect(toastMessages()).toEqual(["เลื่อนไปพรุ่งนี้แล้ว"]);
  });

  it("undo restores the original date", async () => {
    const dates: unknown[] = [];
    server.use(
      http.patch(apiUrl("/cards/w1"), async ({ request }) => {
        dates.push(((await request.json()) as { due_date: string }).due_date);
        return HttpResponse.json({});
      }),
      http.get(apiUrl("/my-tasks"), () => HttpResponse.json(refreshed))
    );
    const { result } = setup();
    await act(() => result.current.handleSnooze("w1", "2026-11-08", "พรุ่งนี้"));
    await act(async () => useToastStore.getState().toasts[0].onAction?.());
    await waitFor(() => expect(dates).toEqual(["2026-11-08", "2026-11-07"]));
  });

  it("puts the card back with a Thai message when the save fails", async () => {
    server.use(http.patch(apiUrl("/cards/w1"), fail(500)));
    const { result } = setup();
    await act(() => result.current.handleSnooze("w1", "2026-11-08", "พรุ่งนี้"));
    expect(ids(result)).toEqual(["w1", "w2"]);
    expect(result.current.error).toBe("เลื่อนวันไม่สำเร็จ");
  });

  it("puts the card back without a second message on 403", async () => {
    server.use(http.patch(apiUrl("/cards/w1"), fail(403)));
    const { result } = setup();
    await act(() => result.current.handleSnooze("w1", "2026-11-08", "พรุ่งนี้"));
    expect(ids(result)).toEqual(["w1", "w2"]);
    expect(result.current.error).toBeNull();
  });
});
