import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { useCardActions } from "@/hooks/useCardActions";
import { useBoardStore } from "@/store/useBoardStore";
import { server, apiUrl } from "@/test/server";
import { makeCard, makeColumn, makeMember } from "@/test/factories";
import { findCard, columnOf, toastMessages } from "@/test/board";
import type { CardUpdateForm } from "@/types/board";

const notMember = () =>
  HttpResponse.json({ error: "server text", code: "assignee_not_member" }, { status: 422 });
const fail = (status: number) => () => HttpResponse.json({ error: "nope" }, { status });

beforeEach(() => {
  useBoardStore.setState({
    columns: [
      makeColumn({ id: "todo", cards: [makeCard({ id: "c1", column_id: "todo", title: "Old" })] }),
      makeColumn({ id: "done", position: 2, category: "DONE" }),
    ],
    boardMembers: [makeMember({ user_id: "u-2", full_name: "Bee" })],
    currentUserId: "u-1",
  });
});

const actions = () => renderHook(() => useCardActions()).result.current;

describe("handleToggleDone", () => {
  it("marks done immediately and keeps it when the server agrees", async () => {
    let body: unknown;
    server.use(
      http.patch(apiUrl("/cards/c1/done"), async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({});
      })
    );
    actions().handleToggleDone(findCard("c1")!);
    expect(findCard("c1")?.is_done).toBe(true);
    await waitFor(() => expect(body).toEqual({ is_done: true }));
    expect(findCard("c1")?.is_done).toBe(true);
  });

  it("reverts and toasts when the server fails", async () => {
    server.use(http.patch(apiUrl("/cards/c1/done"), fail(500)));
    actions().handleToggleDone(findCard("c1")!);
    await waitFor(() => expect(toastMessages()).toEqual(["อัปเดตสถานะไม่สำเร็จ"]));
    expect(findCard("c1")?.is_done).toBe(false);
  });

  it("reverts without a second toast on 403", async () => {
    server.use(http.patch(apiUrl("/cards/c1/done"), fail(403)));
    actions().handleToggleDone(findCard("c1")!);
    await waitFor(() => expect(findCard("c1")?.is_done).toBe(false));
    expect(toastMessages()).toEqual(["nope"]);
  });
});

describe("handleAddCard", () => {
  it("adds the card after the server returns its id", async () => {
    let body: Record<string, unknown> = {};
    server.use(
      http.post(apiUrl("/cards"), async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ id: "new" }, { status: 201 });
      })
    );
    actions().handleAddCard("todo", "Write tests", { assigneeId: "u-2", subtasks: ["a", "b"] });
    expect(findCard("new")).toBeUndefined();
    await waitFor(() => expect(findCard("new")).toBeDefined());
    expect(body).toMatchObject({
      column_id: "todo",
      title: "Write tests",
      position: 65536 * 2,
      assignee_id: "u-2",
      subtasks: ["a", "b"],
    });
    expect(body).not.toHaveProperty("priority");
    expect(findCard("new")).toMatchObject({
      assignee_name: "Bee",
      created_by: "u-1",
      total_subtasks: 2,
    });
  });

  it("toasts and adds nothing when the server fails", async () => {
    server.use(http.post(apiUrl("/cards"), fail(500)));
    actions().handleAddCard("todo", "x");
    await waitFor(() => expect(toastMessages()).toEqual(["สร้างการ์ดไม่สำเร็จ"]));
    expect(useBoardStore.getState().columns[0].cards).toHaveLength(1);
  });

  it("says the assignee left when the server refuses them", async () => {
    server.use(http.post(apiUrl("/cards"), notMember));
    actions().handleAddCard("todo", "x", { assigneeId: "u-2" });
    await waitFor(() =>
      expect(toastMessages()).toEqual(["ผู้รับผิดชอบคนนี้ไม่ได้อยู่ใน Project แล้ว — เลือกคนอื่น"])
    );
  });
});

describe("handleChangeColumn", () => {
  it("moves the card to the end of the target column", async () => {
    let body: unknown;
    server.use(
      http.patch(apiUrl("/cards/c1/move"), async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({});
      })
    );
    actions().handleChangeColumn("c1", "done");
    expect(columnOf("c1")).toBe("done");
    await waitFor(() => expect(body).toEqual({ column_id: "done", position: 65536 }));
  });

  it("moves the card back when the server fails", async () => {
    server.use(http.patch(apiUrl("/cards/c1/move"), fail(500)));
    actions().handleChangeColumn("c1", "done");
    await waitFor(() => expect(toastMessages()).toEqual(["ย้ายการ์ดไม่สำเร็จ"]));
    expect(columnOf("c1")).toBe("todo");
  });

  it("does nothing for the card's own column", () => {
    actions().handleChangeColumn("c1", "todo");
    expect(columnOf("c1")).toBe("todo");
  });
});

describe("handleDeleteCard", () => {
  it("restores the card when the server fails", async () => {
    server.use(http.delete(apiUrl("/cards/c1"), fail(500)));
    actions().handleDeleteCard("c1");
    expect(findCard("c1")).toBeUndefined();
    await waitFor(() => expect(toastMessages()).toEqual(["ลบการ์ดไม่สำเร็จ"]));
    expect(findCard("c1")).toBeDefined();
  });
});

describe("handleUpdateCard", () => {
  const form = { title: "New" } as CardUpdateForm;

  it("sends only the changed field", async () => {
    let body: unknown;
    server.use(
      http.patch(apiUrl("/cards/c1"), async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({});
      })
    );
    actions().handleUpdateCard("c1", form, "title");
    expect(findCard("c1")?.title).toBe("New");
    await waitFor(() => expect(body).toEqual({ title: "New", changed_fields: ["title"] }));
  });

  it("restores the old value and toasts when the server fails", async () => {
    server.use(http.patch(apiUrl("/cards/c1"), fail(500)));
    actions().handleUpdateCard("c1", form, "title");
    await waitFor(() => expect(toastMessages()).toEqual(["บันทึกการ์ดไม่สำเร็จ — ลองอีกครั้ง"]));
    expect(findCard("c1")?.title).toBe("Old");
  });

  it("says the assignee left and restores the old assignee when the server refuses them", async () => {
    server.use(http.patch(apiUrl("/cards/c1"), notMember));
    actions().handleUpdateCard("c1", { assignee_id: "u-2" } as CardUpdateForm, "assignee_id");
    await waitFor(() =>
      expect(toastMessages()).toEqual(["ผู้รับผิดชอบคนนี้ไม่ได้อยู่ใน Project แล้ว — เลือกคนอื่น"])
    );
    expect(findCard("c1")?.assignee_id).toBeNull();
  });

  it("keeps fields that changed elsewhere while reverting", async () => {
    let release!: () => void;
    server.use(
      http.patch(apiUrl("/cards/c1"), async () => {
        await new Promise<void>((r) => (release = r));
        return HttpResponse.json({ error: "boom" }, { status: 500 });
      })
    );
    actions().handleUpdateCard("c1", form, "title");
    await waitFor(() => expect(release).toBeDefined());
    useBoardStore.getState().updateCard({ ...findCard("c1")!, priority: "high" });
    release();
    await waitFor(() => expect(findCard("c1")?.title).toBe("Old"));
    expect(findCard("c1")?.priority).toBe("high");
  });

  it("resolves true when saved and false when reverted", async () => {
    server.use(http.patch(apiUrl("/cards/c1"), () => HttpResponse.json({})));
    await expect(actions().handleUpdateCard("c1", form, "title")).resolves.toBe(true);
    server.use(http.patch(apiUrl("/cards/c1"), fail(500)));
    await expect(actions().handleUpdateCard("c1", form, "title")).resolves.toBe(false);
  });

  it("does not undo a newer edit of the same field when an older save fails", async () => {
    let release!: () => void;
    let calls = 0;
    server.use(
      http.patch(apiUrl("/cards/c1"), async () => {
        if (++calls === 1) {
          await new Promise<void>((r) => (release = r));
          return HttpResponse.json({ error: "boom" }, { status: 500 });
        }
        return HttpResponse.json({});
      })
    );
    const first = actions().handleUpdateCard("c1", { title: "B" } as CardUpdateForm, "title");
    await waitFor(() => expect(release).toBeDefined());
    await actions().handleUpdateCard("c1", { title: "C" } as CardUpdateForm, "title");
    release();
    await first;
    await waitFor(() => expect(toastMessages()).toHaveLength(1));
    expect(findCard("c1")?.title).toBe("C");
  });

  it("stays quiet when the session expired and the user is sent to login", async () => {
    server.use(
      http.patch(apiUrl("/cards/c1"), fail(401)),
      http.post(apiUrl("/auth/refresh"), fail(401))
    );
    await actions().handleUpdateCard("c1", form, "title");
    expect(findCard("c1")?.title).toBe("Old");
    expect(toastMessages()).toEqual([]);
  });
});
