import { describe, it, expect, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { InviteLinkModal } from "@/components/board/members/InviteLinkModal";
import { server, apiUrl } from "@/test/server";
import { renderWithUser } from "@/test/render";
import { toastMessages } from "@/test/board";

const INVITES = apiUrl("/boards/b1/invites");
const link = (token: string) => ({ token, expires_at: "2026-11-15T00:00:00Z" });
const fail = (status: number, error = "boom") => () => HttpResponse.json({ error }, { status });

function open() {
  return renderWithUser(<InviteLinkModal boardId="b1" onClose={vi.fn()} />);
}

const linkBox = () => screen.findByRole("textbox", { name: "Invite link" });
const urlFor = (token: string) => `${window.location.origin}/invite/${token}`;

describe("InviteLinkModal", () => {
  it("shows the board's active link without making a new one", async () => {
    server.use(http.get(INVITES, () => HttpResponse.json(link("abc"))));
    open();
    expect(await linkBox()).toHaveValue(urlFor("abc"));
  });

  it("creates a link when the board has none", async () => {
    server.use(
      http.get(INVITES, () => new HttpResponse(null, { status: 204 })),
      http.post(INVITES, () => HttpResponse.json(link("fresh"), { status: 201 }))
    );
    open();
    expect(await linkBox()).toHaveValue(urlFor("fresh"));
  });

  it("copies the full URL", async () => {
    server.use(http.get(INVITES, () => HttpResponse.json(link("abc"))));
    const { user } = open();
    await linkBox();
    await user.click(screen.getByRole("button", { name: "Copy" }));
    expect(await navigator.clipboard.readText()).toBe(urlFor("abc"));
    expect(screen.getByRole("button", { name: "Copied" })).toBeInTheDocument();
  });

  it("swaps in a new link", async () => {
    server.use(
      http.get(INVITES, () => HttpResponse.json(link("old"))),
      http.post(INVITES, () => HttpResponse.json(link("new"), { status: 201 }))
    );
    const { user } = open();
    await linkBox();
    await user.click(screen.getByRole("button", { name: "New link" }));
    await waitFor(async () => expect(await linkBox()).toHaveValue(urlFor("new")));
  });

  it("keeps the old link and toasts when a new one cannot be made", async () => {
    server.use(http.get(INVITES, () => HttpResponse.json(link("old"))), http.post(INVITES, fail(500)));
    const { user } = open();
    await linkBox();
    await user.click(screen.getByRole("button", { name: "New link" }));
    await waitFor(() => expect(toastMessages()).toEqual(["สร้างลิงก์ใหม่ไม่สำเร็จ"]));
    expect(await linkBox()).toHaveValue(urlFor("old"));
  });

  it("offers a retry when loading fails, and keeps offering it if the retry fails", async () => {
    server.use(http.get(INVITES, fail(500)), http.post(INVITES, fail(500)));
    const { user } = open();
    await user.click(await screen.findByRole("button", { name: /ลองใหม่/ }));
    await waitFor(() => expect(toastMessages()).toEqual(["สร้างลิงก์ใหม่ไม่สำเร็จ"]));
    expect(screen.getByRole("button", { name: /ลองใหม่/ })).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Invite link" })).not.toBeInTheDocument();
  });

  it("recovers when the retry works", async () => {
    server.use(
      http.get(INVITES, fail(500)),
      http.post(INVITES, () => HttpResponse.json(link("fresh"), { status: 201 }))
    );
    const { user } = open();
    await user.click(await screen.findByRole("button", { name: /ลองใหม่/ }));
    expect(await linkBox()).toHaveValue(urlFor("fresh"));
  });

  it("does not stack a second toast on 403", async () => {
    server.use(
      http.get(INVITES, () => HttpResponse.json(link("old"))),
      http.post(INVITES, fail(403, "ไม่มีสิทธิ์"))
    );
    const { user } = open();
    await linkBox();
    await user.click(screen.getByRole("button", { name: "New link" }));
    await waitFor(() => expect(toastMessages()).toEqual(["ไม่มีสิทธิ์"]));
  });
});
