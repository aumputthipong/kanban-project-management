import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { BoardSettingsForm } from "@/components/board/settings/BoardSettingsForm";
import { useBoardStore } from "@/store/useBoardStore";
import { server, apiUrl } from "@/test/server";
import { renderWithUser } from "@/test/render";
import { makeMember } from "@/test/factories";
import { toastMessages } from "@/test/board";
import type { Board } from "@/types/board";

const { router } = vi.hoisted(() => ({ router: { push: vi.fn(), refresh: vi.fn() } }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const BOARD = apiUrl("/boards/b1");
const board: Board = {
  id: "b1", title: "Alpha", description: "old", color: "#1E40AF", icon: "folder",
  created_at: "", updated_at: "", total_cards: 0, done_cards: 0, members: [],
};

beforeAll(() => {
  vi.stubGlobal("IntersectionObserver", class {
    observe() {}
    disconnect() {}
  });
});

beforeEach(() => {
  router.push.mockClear();
  useBoardStore.setState({
    currentUserId: "me",
    boardMembers: [makeMember({ user_id: "me", role: "owner" })],
    boardMeta: { title: "Alpha", color: "#1E40AF", icon: "folder" },
  });
});

const open = () => renderWithUser(<BoardSettingsForm boardId="b1" board={board} />);
const failPatch = (status: number) =>
  server.use(http.patch(BOARD, () => HttpResponse.json({ error: "server text" }, { status })));

async function rename(user: ReturnType<typeof open>["user"], to: string) {
  const input = screen.getByDisplayValue("Alpha");
  await user.clear(input);
  await user.type(input, to);
  await user.click(screen.getByTitle("Save name"));
}

describe("renaming", () => {
  it("saves and keeps the new title in the header", async () => {
    let body: unknown;
    server.use(
      http.patch(BOARD, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({});
      })
    );
    const { user } = open();
    await rename(user, "Beta");
    await waitFor(() => expect(body).toEqual({ title: "Beta" }));
    expect(useBoardStore.getState().boardMeta?.title).toBe("Beta");
    await waitFor(() => expect(router.refresh).toHaveBeenCalled());
  });

  it("puts the header title back and explains inline when the save fails", async () => {
    failPatch(500);
    const { user } = open();
    await rename(user, "Beta");
    expect(await screen.findByText("บันทึกไม่สำเร็จ ลองอีกครั้ง")).toBeInTheDocument();
    expect(useBoardStore.getState().boardMeta?.title).toBe("Alpha");
  });

  it("does not add an inline error on top of the 403 toast", async () => {
    failPatch(403);
    const { user } = open();
    await rename(user, "Beta");
    await waitFor(() => expect(toastMessages()).toEqual(["server text"]));
    expect(screen.queryByText("บันทึกไม่สำเร็จ ลองอีกครั้ง")).not.toBeInTheDocument();
    expect(useBoardStore.getState().boardMeta?.title).toBe("Alpha");
  });
});

it("keeps a newer header title when an older save fails afterwards", async () => {
  let release: () => void = () => {};
  server.use(
    http.patch(BOARD, async () => {
      await new Promise<void>((r) => (release = r));
      return HttpResponse.json({ error: "x" }, { status: 500 });
    })
  );
  const { user } = open();
  await rename(user, "Beta");
  // A later save (e.g. another settings tab) already put "Gamma" in the header.
  useBoardStore.getState().patchBoardMeta({ title: "Gamma" });
  release();
  expect(await screen.findByText("บันทึกไม่สำเร็จ ลองอีกครั้ง")).toBeInTheDocument();
  expect(useBoardStore.getState().boardMeta?.title).toBe("Gamma");
});

describe("description and appearance", () => {
  it("explains a failed description save instead of failing silently", async () => {
    failPatch(500);
    const { user } = open();
    await user.type(screen.getByDisplayValue("old"), " text");
    await user.click(screen.getByRole("button", { name: "Save description" }));
    await waitFor(() => expect(toastMessages()).toEqual(["บันทึกคำอธิบายไม่สำเร็จ ลองอีกครั้ง"]));
    expect(screen.getByRole("button", { name: "Save description" })).toBeEnabled();
  });

  it("puts the header colour back when picking a colour fails", async () => {
    failPatch(500);
    const { user } = open();
    const other = screen.getAllByTitle("เลือกสีนี้").find((b) => b.style.background !== "rgb(30, 64, 175)")!;
    await user.click(other);
    await waitFor(() => expect(toastMessages()).toEqual(["เปลี่ยนสีไม่สำเร็จ"]));
    expect(useBoardStore.getState().boardMeta?.color).toBe("#1E40AF");
  });
});

describe("stash", () => {
  it("goes to the dashboard after stashing", async () => {
    server.use(http.delete(BOARD, () => new HttpResponse(null, { status: 204 })));
    const { user } = open();
    await user.click(screen.getByRole("button", { name: "Stash" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Stash" }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/dashboard"));
  });

  it("stays and explains in Thai when stashing fails", async () => {
    server.use(http.delete(BOARD, () => HttpResponse.json({ error: "x" }, { status: 500 })));
    const { user } = open();
    await user.click(screen.getByRole("button", { name: "Stash" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Stash" }));
    await waitFor(() => expect(toastMessages()).toEqual(["ย้าย Project เข้า Stash ไม่สำเร็จ"]));
    expect(router.push).not.toHaveBeenCalled();
  });
});
