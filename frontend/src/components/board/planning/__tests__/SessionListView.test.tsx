import { describe, it, expect, beforeEach, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { SessionListView } from "@/components/board/planning/SessionListView";
import { server, apiUrl } from "@/test/server";
import { renderWithUser } from "@/test/render";
import { toastMessages } from "@/test/board";
import type { PlanningSessionSummary } from "@/types/planning";

const { router } = vi.hoisted(() => ({ router: { push: vi.fn() } }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const summary = (o: Partial<PlanningSessionSummary>): PlanningSessionSummary =>
  ({
    id: "s1",
    board_id: "b1",
    title: "Kickoff",
    label: null,
    meeting_at: null,
    created_at: "2026-11-08T09:00:00Z",
    updated_at: "2026-11-08T09:00:00Z",
    req_count: 0,
    dec_count: 0,
    q_count: 0,
    promoted_count: 0,
    dropped_count: 0,
    ...o,
  });

const list = (rows: PlanningSessionSummary[] | (() => Response)) =>
  server.use(
    http.get(apiUrl("/boards/b1/planning/sessions"), typeof rows === "function" ? rows : () => HttpResponse.json(rows))
  );

beforeEach(() => router.push.mockReset());

describe("SessionListView", () => {
  it("lists sessions with totals across them", async () => {
    list([
      summary({ id: "s1", title: "Kickoff", q_count: 2, promoted_count: 1 }),
      summary({ id: "s2", title: "Retro", q_count: 1 }),
    ]);
    renderWithUser(<SessionListView boardId="b1" />);
    expect(await screen.findByText("Kickoff")).toBeInTheDocument();
    expect(screen.getByText("Retro")).toBeInTheDocument();
    expect(screen.getByText(/คำถามค้าง ·/).textContent).toMatch(/^3 /);
    expect(screen.getByText(/ส่งเข้า Board แล้ว$/).textContent).toMatch(/^1 /);
  });

  it("shows the empty state when the board has no sessions", async () => {
    list([]);
    renderWithUser(<SessionListView boardId="b1" />);
    expect(await screen.findByText("No notes yet")).toBeInTheDocument();
  });

  it("says loading failed instead of pretending there are no sessions", async () => {
    list(() => HttpResponse.json({ error: "boom" }, { status: 500 }));
    renderWithUser(<SessionListView boardId="b1" />);
    expect(await screen.findByText("โหลดรายการบันทึกไม่ได้ ลองรีเฟรชหน้า")).toBeInTheDocument();
    expect(screen.queryByText("No notes yet")).not.toBeInTheDocument();
  });

  it("creates a session and opens it", async () => {
    list([]);
    server.use(
      http.post(apiUrl("/boards/b1/planning/sessions"), () =>
        HttpResponse.json(summary({ id: "new" }), { status: 201 })
      )
    );
    const { user } = renderWithUser(<SessionListView boardId="b1" />);
    await screen.findByText("No notes yet");
    await user.click(screen.getAllByRole("button", { name: /New Note/ })[0]);
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/board/b1/planning/new"));
  });

  it("toasts and lets the user retry when creating fails", async () => {
    list([]);
    server.use(
      http.post(apiUrl("/boards/b1/planning/sessions"), () =>
        HttpResponse.json({ error: "boom" }, { status: 500 })
      )
    );
    const { user } = renderWithUser(<SessionListView boardId="b1" />);
    await screen.findByText("No notes yet");
    const button = screen.getAllByRole("button", { name: /New Note/ })[0];
    await user.click(button);
    await waitFor(() => expect(toastMessages()).toEqual(["สร้างบันทึกใหม่ไม่ได้"]));
    expect(button).toBeEnabled();
  });

  it("does not stack a second toast when creating is forbidden", async () => {
    list([]);
    server.use(
      http.post(apiUrl("/boards/b1/planning/sessions"), () =>
        HttpResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 })
      )
    );
    const { user } = renderWithUser(<SessionListView boardId="b1" />);
    await screen.findByText("No notes yet");
    await user.click(screen.getAllByRole("button", { name: /New Note/ })[0]);
    await waitFor(() => expect(toastMessages()).toEqual(["ไม่มีสิทธิ์"]));
  });

  it.each([
    [403, "คุณไม่มีสิทธิ์ดูบันทึกของบอร์ดนี้"],
    [404, "ไม่พบบอร์ดนี้ หรือคุณไม่ได้เป็นสมาชิกแล้ว"],
  ])("says why on %i instead of asking for a refresh", async (status, message) => {
    list(() => HttpResponse.json({ error: "no" }, { status }));
    renderWithUser(<SessionListView boardId="b1" />);
    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(screen.queryByText("โหลดรายการบันทึกไม่ได้ ลองรีเฟรชหน้า")).not.toBeInTheDocument();
  });

  it("asks to sign in again on a 401 instead of loading forever", async () => {
    list(() => HttpResponse.json({ error: "expired" }, { status: 401 }));
    server.use(
      http.post(apiUrl("/auth/refresh"), () => HttpResponse.json({}, { status: 401 }))
    );
    renderWithUser(<SessionListView boardId="b1" />);
    expect(await screen.findByText("เซสชันหมดอายุ เข้าสู่ระบบใหม่อีกครั้ง")).toBeInTheDocument();
  });
});

