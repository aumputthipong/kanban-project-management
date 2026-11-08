import { describe, it, expect, beforeEach, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { BoardMembersSection } from "@/components/board/members/BoardMembersSection";
import { useBoardStore } from "@/store/useBoardStore";
import { server, apiUrl } from "@/test/server";
import { renderWithUser } from "@/test/render";
import { makeMember } from "@/test/factories";
import { toastMessages } from "@/test/board";
import type { BoardRole } from "@/lib/permissions";
import type { BoardMember } from "@/types/board";

const { router } = vi.hoisted(() => ({ router: { push: vi.fn() } }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const owner = makeMember({ id: "m0", user_id: "me", full_name: "Me Owner", email: "me@x.com", role: "owner" });
const ann = makeMember({ id: "m1", user_id: "ann", full_name: "Ann", email: "ann@x.com", role: "member" });
const bob = makeMember({ id: "m2", user_id: "bob", full_name: "Bob", email: "bob@x.com", role: "manager" });

const MEMBERS = apiUrl("/boards/b1/members");

function serveMembers(rows: BoardMember[]) {
  server.use(http.get(MEMBERS, () => HttpResponse.json(rows)));
}

async function open(myRole: BoardRole = "owner", rows = [{ ...owner, role: myRole! }, ann, bob]) {
  useBoardStore.setState({ currentUserId: "me", boardMembers: rows });
  serveMembers(rows);
  const view = renderWithUser(<BoardMembersSection boardId="b1" />);
  await screen.findByText("Ann");
  return view;
}

const emailBox = () => screen.getByPlaceholderText("พิมพ์อีเมลผู้ใช้ที่ต้องการเชิญ…");

beforeEach(() => router.push.mockReset());

describe("listing", () => {
  it("groups members by role and filters by search", async () => {
    const { user } = await open();
    expect(screen.getByText("Bob")).toBeInTheDocument();
    await user.type(screen.getByPlaceholderText("ค้นหาด้วยชื่อหรืออีเมล…"), "ann@");
    expect(screen.queryByText("Bob")).not.toBeInTheDocument();
    expect(screen.getByText("Ann")).toBeInTheDocument();
  });

  it("says loading failed in Thai", async () => {
    useBoardStore.setState({ currentUserId: "me", boardMembers: [owner] });
    server.use(http.get(MEMBERS, () => HttpResponse.json({ error: "boom" }, { status: 500 })));
    renderWithUser(<BoardMembersSection boardId="b1" />);
    expect(await screen.findByText("โหลดรายชื่อสมาชิกไม่ได้ ลองรีเฟรชหน้า")).toBeInTheDocument();
  });
});

describe("inviting by email", () => {
  it("adds the member, refreshes the list and the board store, and clears the box", async () => {
    let body: unknown;
    const { user } = await open();
    const carl = makeMember({ id: "m3", user_id: "carl", full_name: "Carl", email: "carl@x.com" });
    server.use(
      http.post(MEMBERS, async ({ request }) => {
        body = await request.json();
        serveMembers([owner, ann, bob, carl]);
        return new HttpResponse(null, { status: 201 });
      })
    );
    await user.type(emailBox(), "carl@x.com");
    await user.click(screen.getByRole("button", { name: /Invite/ }));

    expect(await screen.findByText("Carl")).toBeInTheDocument();
    expect(body).toEqual({ email: "carl@x.com", role: "member" });
    expect(emailBox()).toHaveValue("");
    expect(useBoardStore.getState().boardMembers.map((m) => m.user_id)).toContain("carl");
  });

  it("counts the invite as done when only the list reload fails", async () => {
    const { user } = await open();
    server.use(
      http.post(MEMBERS, () => new HttpResponse(null, { status: 201 })),
      http.get(MEMBERS, () => HttpResponse.json({ error: "boom" }, { status: 500 }))
    );
    await user.type(emailBox(), "carl@x.com{Enter}");
    await waitFor(() =>
      expect(toastMessages()).toEqual(["เพิ่มสมาชิกแล้ว แต่โหลดรายชื่อใหม่ไม่ได้ ลองรีเฟรชหน้า"])
    );
    expect(emailBox()).toHaveValue("");
    expect(screen.queryByText("เพิ่มสมาชิกไม่สำเร็จ")).not.toBeInTheDocument();
  });

  it.each([
    [404, "ไม่พบผู้ใช้ที่มีอีเมลนี้"],
    [409, "ผู้ใช้นี้เป็นสมาชิกบอร์ดอยู่แล้ว"],
    [500, "เพิ่มสมาชิกไม่สำเร็จ"],
  ])("explains a %i in Thai and keeps the email", async (status, message) => {
    server.use(http.post(MEMBERS, () => HttpResponse.json({ error: "server text" }, { status })));
    const { user } = await open();
    await user.type(emailBox(), "who@x.com{Enter}");
    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(emailBox()).toHaveValue("who@x.com");
  });

  it("leaves a 403 to the apiClient toast without a second message", async () => {
    server.use(http.post(MEMBERS, () => HttpResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 })));
    const { user } = await open();
    await user.type(emailBox(), "who@x.com{Enter}");
    await waitFor(() => expect(toastMessages()).toEqual(["ไม่มีสิทธิ์"]));
    expect(screen.queryByText("ไม่มีสิทธิ์")).not.toBeInTheDocument();
    expect(emailBox()).toHaveValue("who@x.com");
  });

  it("hides the invite form from plain members", async () => {
    await open("member");
    expect(screen.queryByPlaceholderText("พิมพ์อีเมลผู้ใช้ที่ต้องการเชิญ…")).not.toBeInTheDocument();
  });
});

describe("changing a role", () => {
  it("sends the new role and shows it", async () => {
    let body: unknown;
    server.use(
      http.patch(apiUrl("/boards/b1/members/ann"), async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({});
      })
    );
    const { user } = await open();
    await user.selectOptions(screen.getByLabelText("role for Ann"), "manager");
    await waitFor(() => expect(body).toEqual({ role: "manager" }));
    await waitFor(() => expect(screen.getByLabelText("role for Ann")).toHaveValue("manager"));
  });

  it("keeps the old role and toasts in Thai when it fails", async () => {
    server.use(
      http.patch(apiUrl("/boards/b1/members/ann"), () =>
        HttpResponse.json({ error: "Failed to update role" }, { status: 500 })
      )
    );
    const { user } = await open();
    await user.selectOptions(screen.getByLabelText("role for Ann"), "manager");
    await waitFor(() => expect(toastMessages()).toEqual(["เปลี่ยน role ไม่สำเร็จ"]));
    expect(screen.getByLabelText("role for Ann")).toHaveValue("member");
  });
});

describe("removing a member", () => {
  it("asks first, then removes", async () => {
    let calls = 0;
    server.use(
      http.delete(apiUrl("/boards/b1/members/ann"), () => {
        calls++;
        return new HttpResponse(null, { status: 204 });
      })
    );
    const { user } = await open();
    await user.click(screen.getByRole("button", { name: "นำ Ann ออกจาก Project" }));
    expect(calls).toBe(0);
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "นำออก" }));
    await waitFor(() => expect(screen.queryByText("Ann")).not.toBeInTheDocument());
    expect(calls).toBe(1);
  });

  it("keeps the member and toasts in Thai when it fails", async () => {
    server.use(
      http.delete(apiUrl("/boards/b1/members/ann"), () =>
        HttpResponse.json({ error: "Failed to remove member" }, { status: 500 })
      )
    );
    const { user } = await open();
    await user.click(screen.getByRole("button", { name: "นำ Ann ออกจาก Project" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "นำออก" }));
    await waitFor(() => expect(toastMessages()).toEqual(["นำสมาชิกออกไม่สำเร็จ"]));
    expect(screen.getByText("Ann")).toBeInTheDocument();
  });

  it("does not stack a second toast on 403", async () => {
    server.use(
      http.delete(apiUrl("/boards/b1/members/ann"), () =>
        HttpResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 })
      )
    );
    const { user } = await open();
    await user.click(screen.getByRole("button", { name: "นำ Ann ออกจาก Project" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "นำออก" }));
    await waitFor(() => expect(toastMessages()).toEqual(["ไม่มีสิทธิ์"]));
    expect(screen.queryByText("ไม่มีสิทธิ์")).not.toBeInTheDocument();
  });

  it("a manager cannot remove the owner or another manager", async () => {
    await open("manager");
    expect(screen.queryByRole("button", { name: "นำ Bob ออกจาก Project" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "นำ Ann ออกจาก Project" })).toBeInTheDocument();
  });
});

describe("leaving", () => {
  it("leaves after confirming and goes to the dashboard", async () => {
    server.use(http.delete(apiUrl("/boards/b1/members/me"), () => new HttpResponse(null, { status: 204 })));
    const { user } = await open("member");
    await user.click(screen.getByRole("button", { name: "ออกจาก Project" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "ออกจาก Project" }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/dashboard"));
  });

  it("stays and toasts in Thai when leaving fails", async () => {
    server.use(
      http.delete(apiUrl("/boards/b1/members/me"), () =>
        HttpResponse.json({ error: "Failed to leave board" }, { status: 500 })
      )
    );
    const { user } = await open("member");
    await user.click(screen.getByRole("button", { name: "ออกจาก Project" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "ออกจาก Project" }));
    await waitFor(() => expect(toastMessages()).toEqual(["ออกจาก Project ไม่สำเร็จ"]));
    expect(router.push).not.toHaveBeenCalled();
  });

  it("the owner gets no leave button", async () => {
    await open("owner");
    expect(screen.queryByRole("button", { name: "ออกจาก Project" })).not.toBeInTheDocument();
  });
});
