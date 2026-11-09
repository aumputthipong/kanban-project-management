import { describe, it, expect } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { useBoardData } from "@/hooks/useBoardData";
import { useActivityFeed } from "@/hooks/useActivityFeed";
import { useBoardStore } from "@/store/useBoardStore";
import { useActivityStore } from "@/store/useActivityStore";
import { server, apiUrl } from "@/test/server";
import { makeCard, makeColumn, makeMember } from "@/test/factories";
import { toastMessages } from "@/test/board";

const fail = (status: number) => () => HttpResponse.json({ error: "x" }, { status });

function serveBoard(overrides: Partial<Record<"board" | "me" | "members" | "list", () => Response>> = {}) {
  server.use(
    http.get(apiUrl("/boards/b1"), overrides.board ?? (() =>
      HttpResponse.json([makeColumn({ id: "todo", cards: [makeCard({ id: "c1" })] })]))),
    http.get(apiUrl("/auth/me"), overrides.me ?? (() => HttpResponse.json({ user_id: "me" }))),
    http.get(apiUrl("/boards/b1/members"), overrides.members ?? (() =>
      HttpResponse.json([makeMember({ user_id: "me" }), null]))),
    http.get(apiUrl("/boards"), overrides.list ?? (() =>
      HttpResponse.json([{ id: "b1", title: "Alpha", color: "#1E40AF", icon: "folder" }])))
  );
}

describe("useBoardData", () => {
  it("hydrates columns, current user, members and board meta", async () => {
    serveBoard();
    const { result } = renderHook(() => useBoardData("b1"));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const s = useBoardStore.getState();
    expect(s.columns.map((c) => c.id)).toEqual(["todo"]);
    expect(s.currentUserId).toBe("me");
    expect(s.boardMembers.map((m) => m.user_id)).toEqual(["me"]);
    expect(s.boardMeta).toEqual({ title: "Alpha", color: "#1E40AF", icon: "folder" });
    expect(result.current.error).toBeNull();
  });

  it("reports NOT_FOUND for a board the user can't see (404, anti-enumeration)", async () => {
    serveBoard({ board: fail(404) });
    const { result } = renderHook(() => useBoardData("b1"));
    await waitFor(() => expect(result.current.error).toBe("NOT_FOUND"));
    expect(useBoardStore.getState().columns).toEqual([]);
  });

  it("still renders the board when only the side requests fail", async () => {
    serveBoard({ me: fail(500), members: fail(500), list: fail(500) });
    const { result } = renderHook(() => useBoardData("b1"));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBeNull();
    expect(useBoardStore.getState().columns).toHaveLength(1);
    expect(useBoardStore.getState().boardMembers).toEqual([]);
  });

  it("surfaces a board load failure other than 404", async () => {
    serveBoard({ board: fail(500) });
    const { result } = renderHook(() => useBoardData("b1"));
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.error).not.toBe("NOT_FOUND");
  });
});

describe("useActivityFeed", () => {
  const ACTIVITIES = apiUrl("/boards/b1/activities");

  it("loads the feed into the activity store with the limit", async () => {
    let limit: string | null = null;
    server.use(
      http.get(ACTIVITIES, ({ request }) => {
        limit = new URL(request.url).searchParams.get("limit");
        return HttpResponse.json([{ id: "a1", event_type: "card.created" }]);
      })
    );
    const { result } = renderHook(() => useActivityFeed("b1", 10));
    await waitFor(() => expect(result.current.activities).toHaveLength(1));
    expect(limit).toBe("10");
    expect(result.current.loading).toBe(false);
  });

  it("marks the feed as failed without a toast", async () => {
    server.use(http.get(ACTIVITIES, fail(500)));
    const { result } = renderHook(() => useActivityFeed("b1"));
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.loading).toBe(false);
    expect(toastMessages()).toEqual([]);
  });

  it("ignores a response for a board the user already left", async () => {
    let release: () => void = () => {};
    server.use(
      http.get(ACTIVITIES, async () => {
        await new Promise<void>((r) => (release = r));
        return HttpResponse.json([{ id: "stale" }]);
      }),
      http.get(apiUrl("/boards/b2/activities"), () => HttpResponse.json([{ id: "fresh" }]))
    );
    const { rerender } = renderHook(({ id }) => useActivityFeed(id), { initialProps: { id: "b1" } });
    rerender({ id: "b2" });
    await waitFor(() => expect(useActivityStore.getState().activities.map((a) => a.id)).toEqual(["fresh"]));
    release();
    await new Promise((r) => setTimeout(r, 20));
    expect(useActivityStore.getState().activities.map((a) => a.id)).toEqual(["fresh"]);
  });
});
