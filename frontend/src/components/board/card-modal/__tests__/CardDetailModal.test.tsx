import { describe, it, expect, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { CardDetailModal } from "@/components/board/card-modal/CardDetailModal";
import { useCardActions } from "@/hooks/useCardActions";
import { useBoardStore } from "@/store/useBoardStore";
import { server, apiUrl } from "@/test/server";
import { renderWithUser } from "@/test/render";
import { makeCard, makeColumn } from "@/test/factories";
import { findCard, toastMessages } from "@/test/board";

function Harness() {
  const { handleUpdateCard } = useCardActions();
  const card = useBoardStore((s) => s.columns[0]?.cards[0]);
  if (!card) return null;
  return (
    <CardDetailModal
      card={card}
      boardId="b1"
      isOpen
      onClose={() => {}}
      onUpdated={handleUpdateCard}
      onDelete={() => {}}
      canEdit
    />
  );
}

let patches: unknown[] = [];

beforeEach(() => {
  patches = [];
  useBoardStore.setState({
    columns: [makeColumn({ id: "todo", cards: [makeCard({ id: "c1", title: "Old" })] })],
  });
  server.use(
    http.get(apiUrl("/cards/c1/subtasks"), () => HttpResponse.json([])),
    http.get(apiUrl("/boards/b1/members"), () => HttpResponse.json([])),
    http.get(apiUrl("/boards/b1/tags"), () => HttpResponse.json([])),
    http.get(apiUrl("/cards/c1/source"), () => HttpResponse.json(null))
  );
});

const failPatches = () =>
  server.use(
    http.patch(apiUrl("/cards/c1"), async ({ request }) => {
      patches.push(await request.json());
      return HttpResponse.json({ error: "boom" }, { status: 500 });
    })
  );

async function renameTo(user: ReturnType<typeof renderWithUser>["user"], title: string) {
  const input = screen.getByRole("textbox", { name: "Title" });
  await user.clear(input);
  await user.type(input, `${title}{Enter}`);
  return input;
}

describe("CardDetailModal save failure", () => {
  it("puts the field back to the saved value and toasts", async () => {
    failPatches();
    const { user } = renderWithUser(<Harness />);
    const input = await renameTo(user, "New");
    await waitFor(() => expect(input).toHaveValue("Old"));
    expect(findCard("c1")?.title).toBe("Old");
    expect(toastMessages()).toEqual(["บันทึกการ์ดไม่สำเร็จ — ลองอีกครั้ง"]);
  });

  it("lets the user retry the same value", async () => {
    failPatches();
    const { user } = renderWithUser(<Harness />);
    const input = await renameTo(user, "New");
    await waitFor(() => expect(input).toHaveValue("Old"));
    await renameTo(user, "New");
    await waitFor(() => expect(patches).toHaveLength(2));
  });

  it("keeps the value after a successful save", async () => {
    server.use(http.patch(apiUrl("/cards/c1"), () => HttpResponse.json({})));
    const { user } = renderWithUser(<Harness />);
    const input = await renameTo(user, "New");
    await waitFor(() => expect(findCard("c1")?.title).toBe("New"));
    expect(input).toHaveValue("New");
  });
});
