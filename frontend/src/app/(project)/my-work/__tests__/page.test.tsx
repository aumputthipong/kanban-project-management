import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import MyWorkPage from "@/app/(project)/my-work/page";
import { ToastContainer } from "@/components/ui/ToastContainer";
import { server, apiUrl } from "@/test/server";
import { renderWithUser } from "@/test/render";
import { relativeDueDate } from "@/lib/myWorkApi";
import type { MyWorkCard } from "@/types/myWork";

beforeEach(() => {
  server.use(
    http.get(apiUrl("/boards"), () => HttpResponse.json([])),
    http.get(apiUrl("/auth/me"), () => HttpResponse.json({ full_name: "Ann" }))
  );
});

describe("My Work page load failure", () => {
  it("shows a Thai message instead of the server's text", async () => {
    server.use(
      http.get(apiUrl("/my-tasks"), () =>
        HttpResponse.json({ error: "internal server error" }, { status: 500 })
      )
    );
    render(<MyWorkPage />);
    expect(await screen.findByText("โหลดงานไม่สำเร็จ")).toBeInTheDocument();
    expect(screen.queryByText("internal server error")).not.toBeInTheDocument();
  });
});

const todayCard = (id: string, title: string): MyWorkCard => ({
  id,
  title,
  board_id: "b1",
  board_name: "Board",
  column_name: "Todo",
  priority: null,
  due_date: relativeDueDate(0),
  estimated_hours: null,
  status: "todo",
  group: "today",
  total_subtasks: 0,
  completed_subtasks: 0,
});

describe("My Work tick-off", () => {
  beforeEach(() => {
    server.use(
      http.get(apiUrl("/my-tasks"), () =>
        HttpResponse.json({
          cards: [todayCard("w1", "Ship it"), todayCard("w2", "Review PR")],
          counts: { overdue: 0, today: 2, this_week: 0, later: 0, no_date: 0, total: 2 },
        })
      )
    );
  });

  it("ticks a task off and brings it back on undo", async () => {
    const { user } = renderWithUser(
      <>
        <MyWorkPage />
        <ToastContainer />
      </>
    );
    await user.click(await screen.findByRole("button", { name: "ทำเสร็จ: Ship it" }));

    expect(screen.queryByRole("button", { name: "ทำเสร็จ: Ship it" })).not.toBeInTheDocument();
    expect(screen.getByText("วันนี้เหลืออีก 1 งาน จากทั้งหมด 2 งาน")).toBeInTheDocument();
    expect(screen.getByText('ทำ "Ship it" เสร็จแล้ว')).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "ย้อนกลับ" }));

    expect(await screen.findByRole("button", { name: "ทำเสร็จ: Ship it" })).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByText("วันนี้เหลืออีก 2 งาน จากทั้งหมด 2 งาน")).toBeInTheDocument()
    );
  });
});
