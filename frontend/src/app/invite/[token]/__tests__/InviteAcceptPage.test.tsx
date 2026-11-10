import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server, apiUrl } from "@/test/server";
import { toastMessages } from "@/test/board";
import InviteAcceptPage from "../page";

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  useParams: () => ({ token: "tok 1" }),
}));

const acceptUrl = () => apiUrl("/invites/tok%201/accept");

beforeEach(() => replace.mockReset());
afterEach(() => vi.unstubAllGlobals());

describe("InviteAcceptPage", () => {
  it("joins and navigates to the board tasks on success", async () => {
    server.use(http.post(acceptUrl(), () => HttpResponse.json({ board_id: "b1" })));
    render(<InviteAcceptPage />);
    expect(screen.getByText("กำลังเข้าร่วม Project…")).toBeInTheDocument();
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/board/b1/tasks"));
    expect(toastMessages()).toEqual(["เข้าร่วม Project แล้ว"]);
  });

  it("treats an already-member 200 the same as a fresh join", async () => {
    server.use(http.post(acceptUrl(), () => HttpResponse.json({ board_id: "b-existing" })));
    render(<InviteAcceptPage />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/board/b-existing/tasks"));
  });

  it("shows the expired message on 410", async () => {
    server.use(http.post(acceptUrl(), () => HttpResponse.json({ error: "x" }, { status: 410 })));
    render(<InviteAcceptPage />);
    expect(await screen.findByText("ลิงก์เชิญนี้หมดอายุแล้ว")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
    expect(screen.getByRole("link", { name: "ไปหน้า Project ของฉัน" })).toHaveAttribute("href", "/dashboard");
  });

  it("shows the invalid-link message on 404", async () => {
    server.use(http.post(acceptUrl(), () => HttpResponse.json({ error: "raw english" }, { status: 404 })));
    render(<InviteAcceptPage />);
    expect(await screen.findByText("ลิงก์เชิญไม่ถูกต้องหรือถูกปิดแล้ว")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it("shows a Thai generic message on 500 instead of the server text", async () => {
    server.use(http.post(acceptUrl(), () => HttpResponse.json({ error: "Failed to accept invite" }, { status: 500 })));
    render(<InviteAcceptPage />);
    expect(await screen.findByText("เข้าร่วม Project ไม่สำเร็จ")).toBeInTheDocument();
    expect(screen.queryByText("Failed to accept invite")).not.toBeInTheDocument();
  });

  it("bounces to login with a return path on 401 without an error screen or toast", async () => {
    const assign = vi.fn();
    vi.stubGlobal("location", {
      ...window.location,
      origin: window.location.origin,
      pathname: "/invite/tok%201",
      search: "",
      assign,
    });
    server.use(
      http.post(acceptUrl(), () => HttpResponse.json({ error: "Unauthorized" }, { status: 401 })),
      http.post(apiUrl("/auth/refresh"), () => new HttpResponse(null, { status: 401 })),
    );
    render(<InviteAcceptPage />);
    await waitFor(() => expect(assign).toHaveBeenCalledWith("/auth/session-expired?redirect=%2Finvite%2Ftok%25201"));
    expect(screen.queryByText("เข้าร่วม Project ไม่ได้")).not.toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
    expect(toastMessages()).toEqual([]);
  });
});
