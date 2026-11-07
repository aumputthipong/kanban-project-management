import { describe, it, expect } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { usePlanningComments } from "@/hooks/usePlanningComments";
import { server, apiUrl } from "@/test/server";
import { toastMessages } from "@/test/board";
import type { PlanningComment } from "@/types/planning";

function makeComment(overrides: Partial<PlanningComment> = {}): PlanningComment {
  return {
    id: "c1",
    item_id: "i1",
    author_id: "me",
    author_name: "Me",
    body: "First",
    created_at: "2026-11-07T09:00:00Z",
    updated_at: "2026-11-07T09:00:00Z",
    deleted_at: null,
    ...overrides,
  };
}

const fail = (status: number, error = "server says no") => () =>
  HttpResponse.json({ error }, { status });

async function loaded(rows = [makeComment()]) {
  server.use(http.get(apiUrl("/planning/items/i1/comments"), () => HttpResponse.json(rows)));
  const hook = renderHook(() => usePlanningComments("i1", "me"));
  await act(() => hook.result.current.load());
  return hook;
}

const bodies = (r: { current: { comments: PlanningComment[] } }) =>
  r.current.comments.map((c) => c.body);

function setVisibility(state: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", { value: state, configurable: true });
  document.dispatchEvent(new Event("visibilitychange"));
}

describe("load", () => {
  it("loads nothing until asked", () => {
    const { result } = renderHook(() => usePlanningComments("i1", "me"));
    expect(result.current).toMatchObject({ comments: [], loaded: false, isLoading: false });
  });

  it("loads the thread, soft-deleted rows included", async () => {
    const { result } = await loaded([makeComment(), makeComment({ id: "c2", body: null })]);
    expect(result.current.loaded).toBe(true);
    expect(bodies(result)).toEqual(["First", null]);
  });

  it("toasts when loading fails", async () => {
    server.use(http.get(apiUrl("/planning/items/i1/comments"), fail(500)));
    const { result } = renderHook(() => usePlanningComments("i1", "me"));
    await act(() => result.current.load());
    expect(result.current.isLoading).toBe(false);
    expect(toastMessages()).toEqual(["โหลดความคิดเห็นไม่ได้ ลองอีกครั้ง"]);
  });

  it("reloads when the tab becomes visible again", async () => {
    let calls = 0;
    server.use(
      http.get(apiUrl("/planning/items/i1/comments"), () => {
        calls++;
        return HttpResponse.json([makeComment({ body: `v${calls}` })]);
      })
    );
    const { result } = renderHook(() => usePlanningComments("i1", "me"));
    await act(() => result.current.load());
    act(() => setVisibility("visible"));
    await waitFor(() => expect(bodies(result)).toEqual(["v2"]));
  });

  it("keeps the newest result when an older load answers last", async () => {
    let release!: () => void;
    let calls = 0;
    server.use(
      http.get(apiUrl("/planning/items/i1/comments"), async () => {
        if (++calls === 1) {
          await new Promise<void>((r) => (release = r));
          return HttpResponse.json([makeComment({ body: "stale" })]);
        }
        return HttpResponse.json([makeComment({ body: "fresh" })]);
      })
    );
    const { result } = renderHook(() => usePlanningComments("i1", "me"));
    let first!: Promise<void>;
    act(() => {
      first = result.current.load();
    });
    await waitFor(() => expect(release).toBeDefined());
    await act(() => result.current.load());
    release();
    await act(() => first);
    expect(bodies(result)).toEqual(["fresh"]);
  });
});

describe("create", () => {
  it("shows the comment right away and swaps in the saved one", async () => {
    server.use(
      http.post(apiUrl("/planning/items/i1/comments"), async ({ request }) => {
        const { body } = (await request.json()) as { body: string };
        return HttpResponse.json(makeComment({ id: "c2", body }), { status: 201 });
      })
    );
    const { result } = await loaded();
    await act(() => result.current.create("  Second  "));
    expect(result.current.comments.map((c) => c.id)).toEqual(["c1", "c2"]);
    expect(bodies(result)).toEqual(["First", "Second"]);
  });

  it("removes the comment and toasts when sending fails", async () => {
    server.use(http.post(apiUrl("/planning/items/i1/comments"), fail(500)));
    const { result } = await loaded();
    await act(() => result.current.create("Second"));
    expect(bodies(result)).toEqual(["First"]);
    expect(toastMessages()).toEqual(["ส่งความคิดเห็นไม่สำเร็จ"]);
  });

  it("keeps a new comment when a tab-focus reload lands while it is sending", async () => {
    let release!: () => void;
    let listCalls = 0;
    server.use(
      http.get(apiUrl("/planning/items/i1/comments"), () => {
        listCalls++;
        return HttpResponse.json([makeComment()]);
      }),
      http.post(apiUrl("/planning/items/i1/comments"), async () => {
        await new Promise<void>((r) => (release = r));
        return HttpResponse.json(makeComment({ id: "c2", body: "Second" }), { status: 201 });
      })
    );
    const { result } = renderHook(() => usePlanningComments("i1", "me"));
    await act(() => result.current.load());
    let sending!: Promise<void>;
    act(() => {
      sending = result.current.create("Second");
    });
    await waitFor(() => expect(release).toBeDefined());
    act(() => setVisibility("visible"));
    await waitFor(() => expect(listCalls).toBe(2));
    release();
    await act(() => sending);
    expect(bodies(result)).toEqual(["First", "Second"]);
  });

  it("does not stack a second toast on 403", async () => {
    server.use(http.post(apiUrl("/planning/items/i1/comments"), fail(403, "ไม่มีสิทธิ์")));
    const { result } = await loaded();
    await act(() => result.current.create("Second"));
    expect(toastMessages()).toEqual(["ไม่มีสิทธิ์"]);
  });
});

describe("edit", () => {
  it("restores the old text and toasts when saving fails", async () => {
    server.use(http.patch(apiUrl("/planning/comments/c1"), fail(500)));
    const { result } = await loaded();
    await act(() => result.current.edit("c1", "Changed"));
    expect(bodies(result)).toEqual(["First"]);
    expect(toastMessages()).toEqual(["แก้ไม่สำเร็จ"]);
  });

  it("keeps the server's copy after a successful edit", async () => {
    server.use(
      http.patch(apiUrl("/planning/comments/c1"), () =>
        HttpResponse.json(makeComment({ body: "Changed", updated_at: "2026-11-07T10:00:00Z" }))
      )
    );
    const { result } = await loaded();
    await act(() => result.current.edit("c1", "Changed"));
    expect(result.current.comments[0]).toMatchObject({
      body: "Changed",
      updated_at: "2026-11-07T10:00:00Z",
    });
  });
});

describe("remove", () => {
  it("blanks the comment in place so the thread does not shift", async () => {
    server.use(http.delete(apiUrl("/planning/comments/c1"), () => new HttpResponse(null, { status: 204 })));
    const { result } = await loaded([makeComment(), makeComment({ id: "c2", body: "Second" })]);
    await act(() => result.current.remove("c1"));
    expect(bodies(result)).toEqual([null, "Second"]);
    expect(result.current.comments[0].deleted_at).not.toBeNull();
  });

  it("restores the comment and toasts when deleting fails", async () => {
    server.use(http.delete(apiUrl("/planning/comments/c1"), fail(500)));
    const { result } = await loaded();
    await act(() => result.current.remove("c1"));
    expect(bodies(result)).toEqual(["First"]);
    expect(toastMessages()).toEqual(["ลบไม่สำเร็จ"]);
  });

  it("does not stack a second toast on 403", async () => {
    server.use(http.delete(apiUrl("/planning/comments/c1"), fail(403, "ไม่มีสิทธิ์")));
    const { result } = await loaded();
    await act(() => result.current.remove("c1"));
    expect(toastMessages()).toEqual(["ไม่มีสิทธิ์"]);
  });
});

describe("ordering between reloads and writes", () => {
  it("ignores a reload that was sent before a comment finished saving", async () => {
    let releaseList!: () => void;
    let listCalls = 0;
    server.use(
      http.get(apiUrl("/planning/items/i1/comments"), async () => {
        if (++listCalls === 2) await new Promise<void>((r) => (releaseList = r));
        return HttpResponse.json([makeComment()]);
      }),
      http.post(apiUrl("/planning/items/i1/comments"), () =>
        HttpResponse.json(makeComment({ id: "c2", body: "Second" }), { status: 201 })
      )
    );
    const { result } = renderHook(() => usePlanningComments("i1", "me"));
    await act(() => result.current.load());
    let reload!: Promise<void>;
    act(() => {
      reload = result.current.load();
    });
    await waitFor(() => expect(releaseList).toBeDefined());
    await act(() => result.current.create("Second"));
    releaseList();
    await act(() => reload);
    expect(bodies(result)).toEqual(["First", "Second"]);
    expect(result.current.isLoading).toBe(false);
  });

  it("leaves a saved comment where the reload put it", async () => {
    let release!: () => void;
    server.use(
      http.get(apiUrl("/planning/items/i1/comments"), () =>
        HttpResponse.json([
          makeComment(),
          makeComment({ id: "c2", body: "Mine" }),
          makeComment({ id: "c3", body: "Theirs" }),
        ])
      ),
      http.post(apiUrl("/planning/items/i1/comments"), async () => {
        await new Promise<void>((r) => (release = r));
        return HttpResponse.json(makeComment({ id: "c2", body: "Mine" }), { status: 201 });
      })
    );
    const { result } = renderHook(() => usePlanningComments("i1", "me"));
    let sending!: Promise<void>;
    act(() => {
      sending = result.current.create("Mine");
    });
    await waitFor(() => expect(release).toBeDefined());
    await act(() => result.current.load());
    release();
    await act(() => sending);
    expect(bodies(result)).toEqual(["First", "Mine", "Theirs"]);
  });

  it("a failed second edit restores the first edit, not the original text", async () => {
    let calls = 0;
    server.use(
      http.patch(apiUrl("/planning/comments/c1"), () =>
        ++calls === 1
          ? HttpResponse.json(makeComment({ body: "A" }))
          : HttpResponse.json({ error: "boom" }, { status: 500 })
      )
    );
    const { result } = await loaded();
    await act(async () => {
      const first = result.current.edit("c1", "A");
      const second = result.current.edit("c1", "B");
      await Promise.all([first, second]);
    });
    expect(bodies(result)).toEqual(["A"]);
  });

  it("keeps edit and remove stable across list changes", async () => {
    server.use(
      http.post(apiUrl("/planning/items/i1/comments"), () =>
        HttpResponse.json(makeComment({ id: "c2", body: "Second" }), { status: 201 })
      )
    );
    const { result } = await loaded();
    const { edit, remove } = result.current;
    await act(() => result.current.create("Second"));
    expect(result.current.edit).toBe(edit);
    expect(result.current.remove).toBe(remove);
  });
});

