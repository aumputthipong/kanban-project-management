import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { StashTable } from "@/components/stash/StashTable";
import { server, apiUrl } from "@/test/server";
import { renderWithUser } from "@/test/render";
import { toastMessages } from "@/test/board";
import type { StashedBoard } from "@/app/(app)/stash/page";

const { router } = vi.hoisted(() => ({ router: { push: vi.fn(), refresh: vi.fn() } }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const alpha: StashedBoard = {
  id: "b1", title: "Alpha", description: "", color: "blue", icon: "folder", stashed_at: "2026-11-01T00:00:00Z",
};

beforeEach(() => router.refresh.mockClear());

const dialog = () => within(screen.getByRole("dialog"));

async function restore(user: ReturnType<typeof renderWithUser>["user"]) {
  await user.click(screen.getByRole("button", { name: "Restore" }));
  await user.click(dialog().getByRole("button", { name: "Restore" }));
}

async function deleteForever(user: ReturnType<typeof renderWithUser>["user"]) {
  await user.click(screen.getByRole("button", { name: "Delete permanently" }));
  await user.type(dialog().getByRole("textbox"), "Alpha");
  await user.click(dialog().getByRole("button", { name: "Delete permanently" }));
}

describe("StashTable restore", () => {
  it("removes the row and refreshes the server data", async () => {
    server.use(http.patch(apiUrl("/stash/b1/restore"), () => new HttpResponse(null, { status: 204 })));
    const { user } = renderWithUser(<StashTable boards={[alpha]} />);
    await restore(user);
    await waitFor(() => expect(screen.queryByText("Alpha")).not.toBeInTheDocument());
    expect(router.refresh).toHaveBeenCalled();
  });

  it("drops the row quietly when another tab already restored it", async () => {
    server.use(http.patch(apiUrl("/stash/b1/restore"), () => HttpResponse.json({ error: "x" }, { status: 404 })));
    const { user } = renderWithUser(<StashTable boards={[alpha]} />);
    await restore(user);
    await waitFor(() => expect(screen.queryByText("Alpha")).not.toBeInTheDocument());
    expect(toastMessages()).toEqual([]);
  });

  it("keeps the row and explains in Thai when the restore fails", async () => {
    server.use(http.patch(apiUrl("/stash/b1/restore"), () => HttpResponse.json({ error: "x" }, { status: 500 })));
    const { user } = renderWithUser(<StashTable boards={[alpha]} />);
    await restore(user);
    await waitFor(() => expect(toastMessages()).toEqual(["กู้คืน Project ไม่สำเร็จ"]));
    expect(screen.getByText("Alpha")).toBeInTheDocument();
  });
});

describe("StashTable permanent delete", () => {
  it("deletes after typing the title", async () => {
    server.use(http.delete(apiUrl("/stash/b1"), () => new HttpResponse(null, { status: 204 })));
    const { user } = renderWithUser(<StashTable boards={[alpha]} />);
    await deleteForever(user);
    await waitFor(() => expect(screen.queryByText("Alpha")).not.toBeInTheDocument());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("keeps the row and explains in Thai when the delete fails", async () => {
    server.use(http.delete(apiUrl("/stash/b1"), () => HttpResponse.json({ error: "x" }, { status: 500 })));
    const { user } = renderWithUser(<StashTable boards={[alpha]} />);
    await deleteForever(user);
    await waitFor(() => expect(toastMessages()).toEqual(["ลบ Project ไม่สำเร็จ"]));
    expect(screen.getAllByText("Alpha").length).toBeGreaterThan(0);
  });

  it("does not stack a second toast on 403", async () => {
    server.use(http.delete(apiUrl("/stash/b1"), () => HttpResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 })));
    const { user } = renderWithUser(<StashTable boards={[alpha]} />);
    await deleteForever(user);
    await waitFor(() => expect(toastMessages()).toEqual(["ไม่มีสิทธิ์"]));
  });
});
