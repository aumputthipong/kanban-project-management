import { describe, it, expect, beforeEach, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { useSessionItems } from "@/hooks/useSessionItems";
import { server, apiUrl } from "@/test/server";
import { toastMessages } from "@/test/board";
import type { PlanningItem, PlanningSessionDetail } from "@/types/planning";

const { push, router } = vi.hoisted(() => {
  const push = vi.fn();
  return { push, router: { push } };
});
vi.mock("next/navigation", () => ({ useRouter: () => router }));

function makeItem(overrides: Partial<PlanningItem> = {}): PlanningItem {
  return {
    id: "i1",
    session_id: "s1",
    type: "REQ",
    title: "Login page",
    description: null,
    status: "live",
    promoted_to_card_id: null,
    position: 1,
    created_at: "2026-11-07T09:00:00Z",
    ...overrides,
  };
}

const session = (items: PlanningItem[]): PlanningSessionDetail => ({
  id: "s1",
  board_id: "b1",
  title: "Kickoff",
  label: null,
  meeting_at: null,
  created_at: "2026-11-07T09:00:00Z",
  updated_at: "2026-11-07T09:30:00Z",
  items,
});

const fail = (status: number, error = "server says no") => () =>
  HttpResponse.json({ error }, { status });

async function setup(items = [makeItem(), makeItem({ id: "i2", title: "Signup", type: "Q" })]) {
  server.use(http.get(apiUrl("/planning/sessions/s1"), () => HttpResponse.json(session(items))));
  const hook = renderHook(() => useSessionItems("b1", "s1"));
  await waitFor(() => expect(hook.result.current.detail).not.toBeNull());
  return hook;
}

const ids = (r: { current: { items: PlanningItem[] } }) => r.current.items.map((i) => i.id);
const item = (r: { current: { items: PlanningItem[] } }, id: string) =>
  r.current.items.find((i) => i.id === id);

beforeEach(() => push.mockReset());

describe("loading", () => {
  it("loads the session and its items", async () => {
    const { result } = await setup();
    expect(ids(result)).toEqual(["i1", "i2"]);
    expect(result.current.savedAt).toBe("2026-11-07T09:30:00Z");
  });

  it("goes back to the session list with a toast when loading fails", async () => {
    server.use(http.get(apiUrl("/planning/sessions/s1"), fail(500)));
    renderHook(() => useSessionItems("b1", "s1"));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/board/b1/planning"));
    expect(toastMessages()).toEqual(["โหลดบันทึกไม่ได้"]);
  });

  it("leaves a 401 to the login redirect", async () => {
    server.use(
      http.get(apiUrl("/planning/sessions/s1"), fail(401)),
      http.post(apiUrl("/auth/refresh"), fail(401))
    );
    renderHook(() => useSessionItems("b1", "s1"));
    await new Promise((r) => setTimeout(r, 50));
    expect(push).not.toHaveBeenCalled();
    expect(toastMessages()).toEqual([]);
  });
});

describe("stats", () => {
  it("counts live items by type and keeps dropped/promoted apart", async () => {
    const { result } = await setup([
      makeItem({ id: "a", type: "REQ", status: "selected" }),
      makeItem({ id: "b", type: "DEC" }),
      makeItem({ id: "c", type: "Q", status: "dropped" }),
      makeItem({ id: "d", type: "REQ", status: "promoted" }),
    ]);
    expect(result.current.stats).toEqual({
      REQ: 1,
      DEC: 1,
      Q: 0,
      dropped: 1,
      promoted: 1,
      selected: 1,
    });
    expect(result.current.promotedItems.map((i) => i.id)).toEqual(["d"]);
  });
});

describe("commitNew", () => {
  it("shows a placeholder, then swaps in the saved item", async () => {
    let release!: () => void;
    server.use(
      http.post(apiUrl("/planning/sessions/s1/items"), async ({ request }) => {
        const body = (await request.json()) as { title: string; type: string };
        await new Promise<void>((r) => (release = r));
        return HttpResponse.json(makeItem({ id: "i3", title: body.title }), { status: 201 });
      })
    );
    const { result } = await setup();
    let done!: Promise<void>;
    act(() => {
      done = result.current.commitNew("  New note  ", "DEC");
    });
    expect(result.current.items.at(-1)).toMatchObject({ title: "New note", type: "DEC" });
    expect(result.current.items.at(-1)?.id).toMatch(/^__pending_/);
    await waitFor(() => expect(release).toBeDefined());
    release();
    await act(() => done);
    expect(ids(result)).toEqual(["i1", "i2", "i3"]);
  });

  it("ignores a blank title", async () => {
    const { result } = await setup();
    await act(() => result.current.commitNew("   ", "REQ"));
    expect(ids(result)).toEqual(["i1", "i2"]);
  });

  it("drops the placeholder and toasts when saving fails", async () => {
    server.use(http.post(apiUrl("/planning/sessions/s1/items"), fail(500)));
    const { result } = await setup();
    await act(() => result.current.commitNew("New note", "REQ"));
    expect(ids(result)).toEqual(["i1", "i2"]);
    expect(toastMessages()).toEqual(["เพิ่มไม่ได้ ลองอีกครั้ง"]);
  });

  it("does not stack a second toast on 403", async () => {
    server.use(http.post(apiUrl("/planning/sessions/s1/items"), fail(403, "ไม่มีสิทธิ์")));
    const { result } = await setup();
    await act(() => result.current.commitNew("New note", "REQ"));
    expect(toastMessages()).toEqual(["ไม่มีสิทธิ์"]);
  });
});

describe("patchItem / toggleStatus", () => {
  it("toggles to the target status and back to live", async () => {
    const bodies: unknown[] = [];
    server.use(
      http.patch(apiUrl("/planning/items/i1"), async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json({});
      })
    );
    const { result } = await setup();
    act(() => result.current.toggleStatus(item(result, "i1")!, "selected"));
    expect(item(result, "i1")?.status).toBe("selected");
    act(() => result.current.toggleStatus(item(result, "i1")!, "selected"));
    expect(item(result, "i1")?.status).toBe("live");
    await waitFor(() => expect(bodies).toEqual([{ status: "selected" }, { status: "live" }]));
  });

  it("keeps the edit on screen and toasts when saving fails (fire-and-forget by design)", async () => {
    server.use(http.patch(apiUrl("/planning/items/i1"), fail(500)));
    const { result } = await setup();
    act(() => result.current.patchItem("i1", { title: "Renamed" }, { title: "Renamed" }));
    await waitFor(() => expect(toastMessages()).toEqual(["บันทึกไม่สำเร็จ"]));
    expect(item(result, "i1")?.title).toBe("Renamed");
  });

  it("does not stack a second toast on 403", async () => {
    server.use(http.patch(apiUrl("/planning/items/i1"), fail(403, "ไม่มีสิทธิ์")));
    const { result } = await setup();
    act(() => result.current.patchItem("i1", { title: "x" }, { title: "x" }));
    await waitFor(() => expect(toastMessages()).toEqual(["ไม่มีสิทธิ์"]));
  });
});

describe("changeType", () => {
  it("retypes and confirms", async () => {
    server.use(http.patch(apiUrl("/planning/items/i1"), () => HttpResponse.json({})));
    const { result } = await setup();
    act(() => result.current.changeType(item(result, "i1")!, "DEC"));
    expect(item(result, "i1")?.type).toBe("DEC");
    await waitFor(() => expect(toastMessages()).toEqual(["เปลี่ยนเป็น DEC แล้ว"]));
  });

  it("does nothing when the type is unchanged", async () => {
    const { result } = await setup();
    act(() => result.current.changeType(item(result, "i1")!, "REQ"));
    expect(toastMessages()).toEqual([]);
  });

  it("reverts with a Thai reason when the Note was already sent to the board", async () => {
    server.use(http.patch(apiUrl("/planning/items/i1"), fail(409, "Item already promoted")));
    const { result } = await setup();
    act(() => result.current.changeType(item(result, "i1")!, "DEC"));
    await waitFor(() =>
      expect(toastMessages()).toEqual(["Note นี้ส่งเข้า Board แล้ว เปลี่ยนประเภทไม่ได้"])
    );
    expect(item(result, "i1")?.type).toBe("REQ");
  });

  it("reverts with a Thai message, not the server's text, on other failures", async () => {
    server.use(http.patch(apiUrl("/planning/items/i1"), fail(500, "internal error")));
    const { result } = await setup();
    act(() => result.current.changeType(item(result, "i1")!, "DEC"));
    await waitFor(() => expect(toastMessages()).toEqual(["เปลี่ยนประเภทไม่ได้"]));
    expect(item(result, "i1")?.type).toBe("REQ");
  });
});

describe("removeItem", () => {
  it("removes right away", async () => {
    server.use(http.delete(apiUrl("/planning/items/i1"), () => new HttpResponse(null, { status: 204 })));
    const { result } = await setup();
    await act(() => result.current.removeItem(item(result, "i1")!));
    expect(ids(result)).toEqual(["i2"]);
  });

  it("puts the item back and toasts when deleting fails", async () => {
    server.use(http.delete(apiUrl("/planning/items/i1"), fail(500)));
    const { result } = await setup();
    await act(() => result.current.removeItem(item(result, "i1")!));
    expect(ids(result).sort()).toEqual(["i1", "i2"]);
    expect(toastMessages()).toEqual(["ลบไม่ได้ ลองอีกครั้ง"]);
  });
});

describe("promote", () => {
  const promoted = (id: string) =>
    HttpResponse.json({ item: makeItem({ id, status: "promoted" }), card_id: `card-${id}` });

  it("promoteOne marks the item promoted", async () => {
    server.use(http.post(apiUrl("/planning/items/i1/promote"), () => promoted("i1")));
    const { result } = await setup();
    await act(() => result.current.promoteOne(item(result, "i1")!));
    expect(item(result, "i1")?.status).toBe("promoted");
    expect(toastMessages()).toEqual(["ส่งเข้า Board แล้ว"]);
  });

  it("promoteOne names the item when it fails", async () => {
    server.use(http.post(apiUrl("/planning/items/i1/promote"), fail(500)));
    const { result } = await setup();
    await act(() => result.current.promoteOne(item(result, "i1")!));
    expect(toastMessages()).toEqual(["ส่งเข้า Board ไม่ได้: Login page"]);
  });

  it("promoteMany sends them one at a time and skips already-promoted items", async () => {
    const order: string[] = [];
    server.use(
      http.post(apiUrl("/planning/items/:id/promote"), ({ params }) => {
        order.push(String(params.id));
        return promoted(String(params.id));
      })
    );
    const { result } = await setup([
      makeItem({ id: "a" }),
      makeItem({ id: "b", status: "promoted" }),
      makeItem({ id: "c" }),
    ]);
    await act(() => result.current.promoteMany(["a", "b", "c"]));
    expect(order).toEqual(["a", "c"]);
    expect(toastMessages()).toEqual(["ส่งเข้า Board แล้ว 2 รายการ"]);
  });

  it("promoteMany counts only the items that actually went through", async () => {
    server.use(
      http.post(apiUrl("/planning/items/a/promote"), () => promoted("a")),
      http.post(apiUrl("/planning/items/c/promote"), fail(500))
    );
    const { result } = await setup([
      makeItem({ id: "a", title: "First" }),
      makeItem({ id: "c", title: "Third" }),
    ]);
    await act(() => result.current.promoteMany(["a", "c"]));
    expect(toastMessages()).toEqual(["ส่งเข้า Board ไม่ได้: Third", "ส่งเข้า Board แล้ว 1 รายการ"]);
  });

  it("promoteMany shows no success toast when nothing went through", async () => {
    server.use(http.post(apiUrl("/planning/items/:id/promote"), fail(500)));
    const { result } = await setup([makeItem({ id: "a", title: "First" })]);
    await act(() => result.current.promoteMany(["a"]));
    expect(toastMessages()).toEqual(["ส่งเข้า Board ไม่ได้: First"]);
  });

  it("promoteMany stops after a 403 instead of failing every item the same way", async () => {
    const tried: string[] = [];
    server.use(
      http.post(apiUrl("/planning/items/:id/promote"), ({ params }) => {
        tried.push(String(params.id));
        return HttpResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });
      })
    );
    const { result } = await setup([makeItem({ id: "a" }), makeItem({ id: "c" })]);
    await act(() => result.current.promoteMany(["a", "c"]));
    expect(tried).toEqual(["a"]);
    expect(toastMessages()).toEqual(["ไม่มีสิทธิ์"]);
  });
});
