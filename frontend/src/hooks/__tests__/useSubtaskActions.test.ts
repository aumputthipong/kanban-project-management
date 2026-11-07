import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { useSubtaskActions } from "@/hooks/useSubtaskActions";
import { useBoardStore } from "@/store/useBoardStore";
import { useToastStore } from "@/store/useToastStore";
import { server, apiUrl } from "@/test/server";
import { makeCard, makeColumn, makeSubtask } from "@/test/factories";
import { findCard, toastMessages } from "@/test/board";

const fail = (status: number) => () => HttpResponse.json({ error: "nope" }, { status });
const subtasks = () => findCard("c1")?.subtasks ?? [];
const actions = () => renderHook(() => useSubtaskActions()).result.current;

beforeEach(() => {
  useBoardStore.setState({
    columns: [
      makeColumn({
        cards: [makeCard({ id: "c1", subtasks: [makeSubtask({ id: "s1", card_id: "c1" })] })],
      }),
    ],
  });
});

afterEach(() => vi.useRealTimers());

describe("fetchSubtasks", () => {
  it("loads the card's subtasks into the store", async () => {
    server.use(
      http.get(apiUrl("/cards/c1/subtasks"), () =>
        HttpResponse.json([makeSubtask({ id: "s1" }), makeSubtask({ id: "s2" })])
      )
    );
    await actions().fetchSubtasks("c1");
    expect(subtasks().map((s) => s.id)).toEqual(["s1", "s2"]);
  });

  it("toasts when loading fails", async () => {
    server.use(http.get(apiUrl("/cards/c1/subtasks"), fail(500)));
    await actions().fetchSubtasks("c1");
    expect(toastMessages()).toEqual(["โหลด subtask ไม่สำเร็จ"]);
  });
});

describe("handleAddSubtask", () => {
  it("appends the created subtask", async () => {
    let body: unknown;
    server.use(
      http.post(apiUrl("/cards/c1/subtasks"), async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(makeSubtask({ id: "s2", title: "New" }), { status: 201 });
      })
    );
    await actions().handleAddSubtask("c1", "New");
    expect(body).toEqual({ title: "New" });
    expect(subtasks().map((s) => s.id)).toEqual(["s1", "s2"]);
  });

  it("does not duplicate a subtask the broadcast already added", async () => {
    server.use(
      http.post(apiUrl("/cards/c1/subtasks"), () => {
        useBoardStore
          .getState()
          .setSubtasksToCard("c1", [...subtasks(), makeSubtask({ id: "s2" })]);
        return HttpResponse.json(makeSubtask({ id: "s2" }), { status: 201 });
      })
    );
    await actions().handleAddSubtask("c1", "New");
    expect(subtasks().map((s) => s.id)).toEqual(["s1", "s2"]);
  });

  it("toasts when the server fails", async () => {
    server.use(http.post(apiUrl("/cards/c1/subtasks"), fail(500)));
    await actions().handleAddSubtask("c1", "New");
    expect(toastMessages()).toEqual(["เพิ่ม subtask ไม่สำเร็จ"]);
    expect(subtasks()).toHaveLength(1);
  });

  it("leaves the 403 toast to apiClient", async () => {
    server.use(http.post(apiUrl("/cards/c1/subtasks"), fail(403)));
    await actions().handleAddSubtask("c1", "New");
    expect(toastMessages()).toEqual(["nope"]);
  });
});

describe("handleToggleSubtask", () => {
  it("ticks immediately and sends the new state", async () => {
    let body: unknown;
    server.use(
      http.patch(apiUrl("/cards/c1/subtasks/s1"), async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({});
      })
    );
    const done = actions().handleToggleSubtask("c1", "s1", false);
    expect(subtasks()[0].is_done).toBe(true);
    await done;
    expect(body).toEqual({ is_done: true });
  });

  it("unticks and toasts when the server fails", async () => {
    server.use(http.patch(apiUrl("/cards/c1/subtasks/s1"), fail(500)));
    await actions().handleToggleSubtask("c1", "s1", false);
    expect(subtasks()[0].is_done).toBe(false);
    expect(toastMessages()).toEqual(["อัปเดต subtask ไม่สำเร็จ"]);
  });
});

describe("handleUpdateSubtaskTitle", () => {
  it("saves the trimmed title", async () => {
    let body: unknown;
    server.use(
      http.patch(apiUrl("/cards/c1/subtasks/s1"), async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({});
      })
    );
    await actions().handleUpdateSubtaskTitle("c1", "s1", "  Renamed  ");
    expect(subtasks()[0].title).toBe("Renamed");
    expect(body).toEqual({ title: "Renamed" });
  });

  it("reloads the server's subtasks and toasts when saving fails", async () => {
    server.use(
      http.patch(apiUrl("/cards/c1/subtasks/s1"), fail(500)),
      http.get(apiUrl("/cards/c1/subtasks"), () =>
        HttpResponse.json([makeSubtask({ id: "s1", title: "Sub" })])
      )
    );
    await actions().handleUpdateSubtaskTitle("c1", "s1", "Renamed");
    await waitFor(() => expect(subtasks()[0].title).toBe("Sub"));
    expect(toastMessages()).toEqual(["เปลี่ยนชื่อ subtask ไม่สำเร็จ"]);
  });

  it("ignores a blank title", async () => {
    await actions().handleUpdateSubtaskTitle("c1", "s1", "   ");
    expect(subtasks()[0].title).toBe("Sub");
  });
});

describe("handleDeleteSubtask", () => {
  it("removes now and deletes on the server after the undo window", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout"] });
    let deleted = false;
    server.use(
      http.delete(apiUrl("/cards/c1/subtasks/s1"), () => {
        deleted = true;
        return new HttpResponse(null, { status: 204 });
      })
    );
    actions().handleDeleteSubtask("c1", "s1");
    expect(subtasks()).toHaveLength(0);
    expect(deleted).toBe(false);
    await act(() => vi.advanceTimersByTimeAsync(5000));
    vi.useRealTimers();
    await waitFor(() => expect(deleted).toBe(true));
  });

  it("restores from the server on undo and never deletes", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout"] });
    let deleted = false;
    server.use(
      http.delete(apiUrl("/cards/c1/subtasks/s1"), () => {
        deleted = true;
        return new HttpResponse(null, { status: 204 });
      }),
      http.get(apiUrl("/cards/c1/subtasks"), () => HttpResponse.json([makeSubtask({ id: "s1" })]))
    );
    actions().handleDeleteSubtask("c1", "s1");
    useToastStore.getState().toasts[0].onAction?.();
    await act(() => vi.advanceTimersByTimeAsync(5000));
    vi.useRealTimers();
    await waitFor(() => expect(subtasks()).toHaveLength(1));
    expect(deleted).toBe(false);
  });

  it("restores and toasts when the delete fails", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout"] });
    server.use(
      http.delete(apiUrl("/cards/c1/subtasks/s1"), fail(500)),
      http.get(apiUrl("/cards/c1/subtasks"), () => HttpResponse.json([makeSubtask({ id: "s1" })]))
    );
    actions().handleDeleteSubtask("c1", "s1");
    await act(() => vi.advanceTimersByTimeAsync(5000));
    vi.useRealTimers();
    await waitFor(() => expect(subtasks()).toHaveLength(1));
    expect(toastMessages()).toEqual(["ลบ subtask ไม่สำเร็จ"]);
  });
});
