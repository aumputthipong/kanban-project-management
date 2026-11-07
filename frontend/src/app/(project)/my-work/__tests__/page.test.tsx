import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import MyWorkPage from "@/app/(project)/my-work/page";
import { server, apiUrl } from "@/test/server";

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
