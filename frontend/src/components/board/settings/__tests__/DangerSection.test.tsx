import { describe, it, expect, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { DangerSection } from "@/components/board/settings/DangerSection";
import { useBoardStore } from "@/store/useBoardStore";
import { server, apiUrl } from "@/test/server";
import { renderWithUser } from "@/test/render";
import { makeMember } from "@/test/factories";
import { toastMessages } from "@/test/board";
import type { BoardMember } from "@/types/board";

const me = makeMember({ id: "m0", user_id: "me", full_name: "Me", role: "owner" });
const ann = makeMember({ id: "m1", user_id: "ann", full_name: "Ann", role: "member" });

function open(members: BoardMember[] = [me, ann], onArchive = vi.fn()) {
  useBoardStore.setState({ currentUserId: "me", boardMembers: members });
  return { ...renderWithUser(<DangerSection boardId="b1" onArchive={onArchive} isArchiving={false} />), onArchive };
}

const dialog = () => within(screen.getByRole("dialog"));
const TRANSFER = apiUrl("/boards/b1/members/transfer-ownership");

async function pickAndConfirm(user: ReturnType<typeof open>["user"]) {
  await user.selectOptions(screen.getByLabelText("new owner"), "ann");
  await user.click(screen.getByRole("button", { name: "Transfer" }));
  await user.click(dialog().getByRole("button", { name: "Transfer" }));
}

describe("stash", () => {
  it("stashes only after confirming", async () => {
    const { user, onArchive } = open();
    await user.click(screen.getByRole("button", { name: "Stash" }));
    expect(onArchive).not.toHaveBeenCalled();
    await user.click(dialog().getByRole("button", { name: "Stash" }));
    expect(onArchive).toHaveBeenCalledOnce();
  });
});

describe("transfer ownership", () => {
  it("asks to invite someone first when the owner is alone", () => {
    open([me]);
    expect(screen.getByText("เชิญสมาชิกเข้า Project ก่อน จึงจะโอนสิทธิ์ได้")).toBeInTheDocument();
    expect(screen.queryByLabelText("new owner")).not.toBeInTheDocument();
  });

  it("keeps Transfer disabled until someone is picked", () => {
    open();
    expect(screen.getByRole("button", { name: "Transfer" })).toBeDisabled();
  });

  it("transfers, reloads members into the store and says what changed", async () => {
    let body: unknown;
    server.use(
      http.post(TRANSFER, async ({ request }) => {
        body = await request.json();
        return new HttpResponse(null, { status: 204 });
      }),
      http.get(apiUrl("/boards/b1/members"), () =>
        HttpResponse.json([{ ...me, role: "manager" }, { ...ann, role: "owner" }])
      )
    );
    const { user } = open();
    await pickAndConfirm(user);
    await waitFor(() =>
      expect(toastMessages()).toEqual(["โอนสิทธิ์ Owner ให้ Ann แล้ว — ตอนนี้คุณเป็น Manager"])
    );
    expect(body).toEqual({ user_id: "ann" });
    const roles = Object.fromEntries(useBoardStore.getState().boardMembers.map((m) => [m.user_id, m.role]));
    expect(roles).toEqual({ me: "manager", ann: "owner" });
  });

  it("reports the transfer as done when only the member reload fails", async () => {
    server.use(
      http.post(TRANSFER, () => new HttpResponse(null, { status: 204 })),
      http.get(apiUrl("/boards/b1/members"), () => HttpResponse.json({ error: "boom" }, { status: 500 }))
    );
    const { user } = open();
    await pickAndConfirm(user);
    await waitFor(() =>
      expect(toastMessages()).toEqual([
        "โอนสิทธิ์ Owner ให้ Ann แล้ว — ตอนนี้คุณเป็น Manager",
        "โหลดรายชื่อสมาชิกใหม่ไม่ได้ ลองรีเฟรชหน้า",
      ])
    );
  });

  it.each([
    [404, "ไม่พบสมาชิกคนนี้ในบอร์ดแล้ว"],
    [409, "สิทธิ์ Owner ถูกเปลี่ยนไปแล้ว ลองรีเฟรชหน้า"],
    [500, "โอนสิทธิ์ไม่สำเร็จ"],
  ])("explains a %i in Thai and changes nothing", async (status, message) => {
    server.use(http.post(TRANSFER, () => HttpResponse.json({ error: "server text" }, { status })));
    const { user } = open();
    await pickAndConfirm(user);
    await waitFor(() => expect(toastMessages()).toEqual([message]));
    expect(useBoardStore.getState().boardMembers.find((m) => m.user_id === "me")?.role).toBe("owner");
    expect(screen.getByRole("button", { name: "Transfer" })).toBeEnabled();
  });

  it("does not stack a second toast on 403", async () => {
    server.use(http.post(TRANSFER, () => HttpResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 })));
    const { user } = open();
    await pickAndConfirm(user);
    await waitFor(() => expect(toastMessages()).toEqual(["ไม่มีสิทธิ์"]));
  });

  it("cancelling the dialog sends nothing", async () => {
    const { user } = open();
    await user.selectOptions(screen.getByLabelText("new owner"), "ann");
    await user.click(screen.getByRole("button", { name: "Transfer" }));
    await user.click(dialog().getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
