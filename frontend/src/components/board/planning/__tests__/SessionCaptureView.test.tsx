import { describe, it, expect, beforeEach, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { SessionCaptureView } from "@/components/board/planning/SessionCaptureView";
import { ToastContainer } from "@/components/ui/ToastContainer";
import { server, apiUrl } from "@/test/server";
import { renderWithUser } from "@/test/render";
import type { PlanningItem } from "@/types/planning";

const { router } = vi.hoisted(() => ({ router: { push: vi.fn() } }));
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
    created_at: "2026-11-08T09:00:00Z",
    ...overrides,
  };
}

function serve(items: PlanningItem[]) {
  server.use(
    http.get(apiUrl("/planning/sessions/s1"), () =>
      HttpResponse.json({
        id: "s1",
        board_id: "b1",
        title: "Sprint kickoff",
        label: null,
        meeting_at: null,
        created_at: "2026-11-08T09:00:00Z",
        updated_at: "2026-11-08T09:30:00Z",
        items,
      })
    )
  );
}

async function open(items: PlanningItem[] = []) {
  serve(items);
  const view = renderWithUser(
    <>
      <SessionCaptureView boardId="b1" sessionId="s1" />
      <ToastContainer />
    </>
  );
  await screen.findByRole("heading", { name: "Sprint kickoff" });
  return view;
}

const captureBox = () => screen.getByPlaceholderText("พิมพ์ที่นี่ แล้วกด Enter เพื่อเพิ่ม");
const row = (id: string) => document.getElementById(`item-${id}`)!;

beforeEach(() => {
  router.push.mockReset();
  window.history.replaceState(null, "", "/board/b1/planning/s1");
});

describe("capturing Notes", () => {
  it("shows the empty hint before anything is captured", async () => {
    await open();
    expect(screen.getByText("ลองเริ่มที่ช่องด้านบน · พิมพ์แล้วกด Enter")).toBeInTheDocument();
  });

  it("adds a Note of the chosen type with Enter and clears the box", async () => {
    let body: unknown;
    server.use(
      http.post(apiUrl("/planning/sessions/s1/items"), async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(makeItem({ id: "n1", type: "DEC", title: "Ship Friday" }), {
          status: 201,
        });
      })
    );
    const { user } = await open();
    await user.click(screen.getByRole("button", { name: "Decision" }));
    await user.type(captureBox(), "Ship Friday{Enter}");

    expect(captureBox()).toHaveValue("");
    expect(await screen.findByText("Ship Friday")).toBeInTheDocument();
    await waitFor(() => expect(body).toEqual({ type: "DEC", title: "Ship Friday" }));
  });

  it("ignores Enter on an empty box", async () => {
    const { user } = await open();
    await user.type(captureBox(), "   {Enter}");
    expect(screen.getByText("ลองเริ่มที่ช่องด้านบน · พิมพ์แล้วกด Enter")).toBeInTheDocument();
  });
});

describe("filters", () => {
  it("shows only Questions under the Q filter and keeps it in the URL", async () => {
    const { user } = await open([
      makeItem({ id: "a", title: "Need SSO" }),
      makeItem({ id: "b", type: "Q", title: "Who owns billing?" }),
    ]);
    await user.click(screen.getByRole("tab", { name: /คำถามค้าง/ }));
    expect(row("a")).toBeNull();
    expect(row("b")).not.toBeNull();
    expect(window.location.search).toBe("?filter=q");
  });
});

describe("sending to the board", () => {
  it("sends one Note and stops offering the button", async () => {
    server.use(
      http.post(apiUrl("/planning/items/i1/promote"), () =>
        HttpResponse.json({ item: makeItem({ status: "promoted" }), card_id: "card-1" })
      )
    );
    const { user } = await open([makeItem()]);
    await user.click(within(row("i1")).getByRole("button", { name: /ส่งขึ้น Board/ }));
    expect(await screen.findByText("ส่งเข้า Board แล้ว")).toBeInTheDocument();
    expect(within(row("i1")).queryByRole("button", { name: /ส่งขึ้น Board/ })).toBeNull();
  });

  it("sends the selected Notes in select mode and leaves it", async () => {
    const sent: string[] = [];
    server.use(
      http.post(apiUrl("/planning/items/:id/promote"), ({ params }) => {
        sent.push(String(params.id));
        return HttpResponse.json({
          item: makeItem({ id: String(params.id), status: "promoted" }),
          card_id: `card-${params.id}`,
        });
      })
    );
    const { user } = await open([
      makeItem({ id: "a", title: "First" }),
      makeItem({ id: "b", title: "Second" }),
      makeItem({ id: "c", title: "Third" }),
    ]);
    await user.click(screen.getByRole("button", { name: /Select to send/ }));
    await user.click(screen.getByText("First"));
    await user.click(screen.getByText("Third"));
    expect(screen.getByText("เลือกแล้ว 2")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Send to Board/ }));

    expect(await screen.findByText("ส่งเข้า Board แล้ว 2 รายการ")).toBeInTheDocument();
    expect(sent).toEqual(["a", "c"]);
    expect(screen.getByRole("button", { name: /Select to send/ })).toBeInTheDocument();
  });

  it("explains a board without a TODO column once, not per Note", async () => {
    const msg = "บอร์ดยังไม่มีคอลัมน์ TODO เพิ่มคอลัมน์ก่อนแล้วค่อยส่งเข้า Board";
    server.use(
      http.post(apiUrl("/planning/items/:id/promote"), () =>
        HttpResponse.json({ error: msg, code: "no_todo_column" }, { status: 422 })
      )
    );
    const { user } = await open([
      makeItem({ id: "a", title: "First" }),
      makeItem({ id: "b", title: "Second" }),
      makeItem({ id: "c", title: "Third" }),
    ]);
    await user.click(screen.getByRole("button", { name: /Select to send/ }));
    await user.click(screen.getByText("First"));
    await user.click(screen.getByText("Second"));
    await user.click(screen.getByText("Third"));
    await user.click(screen.getByRole("button", { name: /Send to Board/ }));
    expect(await screen.findAllByText(msg)).toHaveLength(1);
  });
});

describe("row menu", () => {
  it("changes the type from the menu", async () => {
    let body: unknown;
    server.use(
      http.patch(apiUrl("/planning/items/i1"), async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({});
      })
    );
    const { user } = await open([makeItem()]);
    await user.click(within(row("i1")).getByRole("button", { name: "ตัวเลือกเพิ่มเติม" }));
    await user.click(within(row("i1")).getByRole("button", { name: /DEC/ }));
    expect(await screen.findByText("เปลี่ยนเป็น DEC แล้ว")).toBeInTheDocument();
    expect(body).toEqual({ type: "DEC" });
  });

  it("deletes a Note from the menu", async () => {
    server.use(
      http.delete(apiUrl("/planning/items/i1"), () => new HttpResponse(null, { status: 204 }))
    );
    const { user } = await open([makeItem(), makeItem({ id: "i2", title: "Keep me" })]);
    await user.click(within(row("i1")).getByRole("button", { name: "ตัวเลือกเพิ่มเติม" }));
    await user.click(screen.getByRole("button", { name: /Delete item/ }));
    await waitFor(() => expect(row("i1")).toBeNull());
    expect(screen.getByText("Keep me")).toBeInTheDocument();
  });
});

describe("comments on a Note", () => {
  it("loads the thread on first open and posts with Ctrl+Enter", async () => {
    let listed = 0;
    server.use(
      http.get(apiUrl("/planning/items/i1/comments"), () => {
        listed++;
        return HttpResponse.json([]);
      }),
      http.post(apiUrl("/planning/items/i1/comments"), async ({ request }) => {
        const { body } = (await request.json()) as { body: string };
        return HttpResponse.json(
          {
            id: "c1",
            item_id: "i1",
            author_id: "me",
            author_name: "Me",
            body,
            created_at: "2026-11-08T10:00:00Z",
            updated_at: "2026-11-08T10:00:00Z",
            deleted_at: null,
          },
          { status: 201 }
        );
      })
    );
    const { user } = await open([makeItem()]);
    const toggle = within(row("i1")).getByRole("button", { name: "ความคิดเห็น" });
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    await waitFor(() => expect(listed).toBe(1));

    const box = await screen.findByPlaceholderText("เพิ่มความคิดเห็น... (Cmd/Ctrl+Enter เพื่อส่ง)");
    await user.type(box, "Ask legal first{Control>}{Enter}{/Control}");

    expect(await screen.findByText("Ask legal first")).toBeInTheDocument();
    expect(box).toHaveValue("");
  });
});

