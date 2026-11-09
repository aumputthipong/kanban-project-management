import { describe, it, expect, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { TagSelector } from "@/components/board/card-modal/TagSelector";
import { server, apiUrl } from "@/test/server";
import { renderWithUser } from "@/test/render";
import { toastMessages } from "@/test/board";
import type { Tag } from "@/types/board";

const TAGS = apiUrl("/boards/b1/tags");
const bug: Tag = { id: "t1", board_id: "b1", name: "bug", color: "rose" };

function open(tags: Tag[] = [bug]) {
  server.use(http.get(TAGS, () => HttpResponse.json(tags)));
  const onChange = vi.fn();
  const onCommit = vi.fn();
  const view = renderWithUser(
    <TagSelector boardId="b1" selected={[]} onChange={onChange} onCommit={onCommit} canEdit />
  );
  return { ...view, onChange, onCommit };
}

async function startCreating(user: ReturnType<typeof open>["user"], name: string) {
  await user.type(screen.getByPlaceholderText("+ Add tag…"), name);
  await user.click(await screen.findByRole("button", { name: `Create “${name}”` }));
}

describe("TagSelector", () => {
  it("offers the board's tags and selects one", async () => {
    const { user, onChange } = open();
    await user.click(screen.getByPlaceholderText("+ Add tag…"));
    await user.click(await screen.findByRole("button", { name: "bug" }));
    expect(onChange).toHaveBeenCalledWith([bug]);
  });

  it("creates a tag through apiClient and selects it", async () => {
    let body: unknown;
    server.use(
      http.post(TAGS, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ id: "t2", board_id: "b1", name: "ui", color: "blue" }, { status: 201 });
      })
    );
    const { user, onChange } = open();
    await startCreating(user, "ui");
    await user.click(screen.getByRole("button", { name: "Create" }));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ id: "t2" })]));
    expect(body).toEqual({ name: "ui", color: expect.any(String) });
    expect(toastMessages()).toEqual([]);
  });

  it.each([
    [409, "tag_name_taken", "มี tag ชื่อนี้ในบอร์ดแล้ว"],
    [500, undefined, "สร้าง tag ไม่สำเร็จ"],
  ])("explains a failed create (%i) and keeps the form open", async (status, code, message) => {
    server.use(http.post(TAGS, () => HttpResponse.json({ error: "server text", code }, { status })));
    const { user, onChange } = open();
    await startCreating(user, "ui");
    await user.click(screen.getByRole("button", { name: "Create" }));
    await waitFor(() => expect(toastMessages()).toEqual([message]));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Create" })).toBeInTheDocument();
  });

  it("does not stack a second toast on 403", async () => {
    server.use(http.post(TAGS, () => HttpResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 })));
    const { user } = open();
    await startCreating(user, "ui");
    await user.click(screen.getByRole("button", { name: "Create" }));
    await waitFor(() => expect(toastMessages()).toEqual(["ไม่มีสิทธิ์"]));
  });

  it("still lets the user create a tag when loading the list fails", async () => {
    server.use(http.get(TAGS, () => HttpResponse.json({ error: "boom" }, { status: 500 })));
    const { user } = renderWithUser(
      <TagSelector boardId="b1" selected={[]} onChange={vi.fn()} canEdit />
    );
    await user.type(screen.getByPlaceholderText("+ Add tag…"), "ui");
    expect(await screen.findByRole("button", { name: "Create “ui”" })).toBeInTheDocument();
  });
});
