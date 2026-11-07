import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { useColumnActions } from "@/hooks/useColumnActions";
import { useBoardStore } from "@/store/useBoardStore";
import { server, apiUrl } from "@/test/server";
import { makeCard, makeColumn } from "@/test/factories";
import { toastMessages } from "@/test/board";

const fail = (status: number) => () => HttpResponse.json({ error: "nope" }, { status });
const column = (id: string) => useBoardStore.getState().columns.find((c) => c.id === id);
const actions = () => renderHook(() => useColumnActions("b1")).result.current;

beforeEach(() => {
  useBoardStore.setState({
    columns: [makeColumn({ id: "todo", title: "Todo", color: "blue", cards: [makeCard()] })],
  });
});

describe("handleRenameColumn", () => {
  it("renames and resends category and color", async () => {
    let body: unknown;
    server.use(
      http.patch(apiUrl("/columns/todo"), async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({});
      })
    );
    actions().handleRenameColumn("todo", "Backlog");
    expect(column("todo")?.title).toBe("Backlog");
    await waitFor(() =>
      expect(body).toEqual({ title: "Backlog", category: "TODO", color: "blue" })
    );
  });

  it("restores the old name when the server fails", async () => {
    server.use(http.patch(apiUrl("/columns/todo"), fail(500)));
    actions().handleRenameColumn("todo", "Backlog");
    await waitFor(() => expect(toastMessages()).toEqual(["เปลี่ยนชื่อคอลัมน์ไม่สำเร็จ"]));
    expect(column("todo")?.title).toBe("Todo");
  });
});

describe("handleDeleteColumn", () => {
  it("restores the column and its cards when the server fails", async () => {
    server.use(http.delete(apiUrl("/columns/todo"), fail(500)));
    actions().handleDeleteColumn("todo");
    expect(column("todo")).toBeUndefined();
    await waitFor(() => expect(toastMessages()).toEqual(["ลบคอลัมน์ไม่สำเร็จ"]));
    expect(column("todo")?.cards).toHaveLength(1);
  });

  it("reverts without a second toast on 403", async () => {
    server.use(http.delete(apiUrl("/columns/todo"), fail(403)));
    actions().handleDeleteColumn("todo");
    await waitFor(() => expect(column("todo")).toBeDefined());
    expect(toastMessages()).toEqual(["nope"]);
  });
});

describe("handleUpdateColumn", () => {
  it("restores title, category and color when the server fails", async () => {
    server.use(http.patch(apiUrl("/columns/todo"), fail(500)));
    actions().handleUpdateColumn("todo", "Shipped", "DONE", null);
    expect(column("todo")).toMatchObject({ title: "Shipped", category: "DONE", color: null });
    await waitFor(() => expect(toastMessages()).toEqual(["แก้ไขคอลัมน์ไม่สำเร็จ"]));
    expect(column("todo")).toMatchObject({ title: "Todo", category: "TODO", color: "blue" });
  });
});

describe("handleAddColumn", () => {
  it("adds the server's column with an empty card list", async () => {
    let body: unknown;
    server.use(
      http.post(apiUrl("/boards/b1/columns"), async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(makeColumn({ id: "new", title: "Review", position: 2 }), {
          status: 201,
        });
      })
    );
    await actions().handleAddColumn("  Review  ");
    expect(body).toEqual({ title: "Review", category: "TODO" });
    expect(column("new")).toMatchObject({ title: "Review", cards: [] });
  });

  it("ignores a blank title", async () => {
    await actions().handleAddColumn("   ");
    expect(useBoardStore.getState().columns).toHaveLength(1);
  });

  it("toasts when the server fails", async () => {
    server.use(http.post(apiUrl("/boards/b1/columns"), fail(500)));
    await actions().handleAddColumn("Review");
    expect(toastMessages()).toEqual(["สร้างคอลัมน์ไม่สำเร็จ"]);
  });
});
