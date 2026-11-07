import { describe, it, expect, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { DragEndEvent, DragOverEvent } from "@dnd-kit/core";
import { useDragActions } from "@/hooks/useDragActions";
import { useBoardStore } from "@/store/useBoardStore";
import { server, apiUrl } from "@/test/server";
import { makeCard, makeColumn } from "@/test/factories";
import { columnOf, findCard, toastMessages } from "@/test/board";

const rect = (top: number) => ({
  top,
  height: 40,
  left: 0,
  width: 200,
  bottom: top + 40,
  right: 200,
});

function dragEvent(activeId: string, overId: string, activeTop = 0, overTop = 0) {
  return {
    active: { id: activeId, rect: { current: { translated: rect(activeTop), initial: null } } },
    over: { id: overId, rect: rect(overTop) },
  } as unknown as DragEndEvent & DragOverEvent;
}

beforeEach(() => {
  useBoardStore.setState({
    columns: [
      makeColumn({ id: "todo", cards: [makeCard({ id: "a", column_id: "todo", position: 100 })] }),
      makeColumn({
        id: "doing",
        position: 2,
        cards: [
          makeCard({ id: "b", column_id: "doing", position: 100 }),
          makeCard({ id: "c", column_id: "doing", position: 200 }),
        ],
      }),
    ],
  });
});

describe("useDragActions", () => {
  it("drops onto a column and saves the move", async () => {
    let body: { column_id: string; position: number } | undefined;
    server.use(
      http.patch(apiUrl("/cards/a/move"), async ({ request }) => {
        body = (await request.json()) as typeof body;
        return HttpResponse.json({});
      })
    );
    const { result } = renderHook(() => useDragActions());
    act(() => result.current.handleDragEnd(dragEvent("a", "doing")));
    expect(columnOf("a")).toBe("doing");
    await waitFor(() => expect(body?.column_id).toBe("doing"));
    expect(body!.position).toBe(findCard("a")!.position);
  });

  it("places the card between neighbours when dropped below one", async () => {
    let position = 0;
    server.use(
      http.patch(apiUrl("/cards/a/move"), async ({ request }) => {
        position = ((await request.json()) as { position: number }).position;
        return HttpResponse.json({});
      })
    );
    const { result } = renderHook(() => useDragActions());
    act(() => result.current.handleDragEnd(dragEvent("a", "b", 30, 0)));
    await waitFor(() => expect(position).toBeGreaterThan(100));
    expect(position).toBeLessThan(200);
  });

  it("previews the column on drag over without saving", () => {
    const { result } = renderHook(() => useDragActions());
    act(() => result.current.handleDragOver(dragEvent("a", "c")));
    expect(columnOf("a")).toBe("doing");
  });

  it("moves the card back and toasts when saving fails", async () => {
    server.use(http.patch(apiUrl("/cards/a/move"), () => HttpResponse.json({}, { status: 500 })));
    const { result } = renderHook(() => useDragActions());
    act(() => result.current.handleDragEnd(dragEvent("a", "doing")));
    await waitFor(() => expect(toastMessages()).toEqual(["ย้ายการ์ดไม่สำเร็จ"]));
    expect(columnOf("a")).toBe("todo");
  });

  it("ignores a drop outside any column", () => {
    const { result } = renderHook(() => useDragActions());
    act(() => result.current.handleDragEnd(dragEvent("a", "nowhere")));
    expect(columnOf("a")).toBe("todo");
  });
});
