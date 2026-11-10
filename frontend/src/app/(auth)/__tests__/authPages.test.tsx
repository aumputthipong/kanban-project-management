import { describe, it, expect, beforeEach, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server, apiUrl } from "@/test/server";
import { renderWithUser } from "@/test/render";
import LoginPage from "../login/page";
import RegisterPage from "../register/page";

const push = vi.fn();
const refresh = vi.fn();
let search = "";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
  useSearchParams: () => new URLSearchParams(search),
}));

beforeEach(() => {
  push.mockReset();
  refresh.mockReset();
  search = "";
  server.use(http.get(apiUrl("/health"), () => HttpResponse.json({})));
});

type User = ReturnType<typeof renderWithUser>["user"];

async function fillLogin(user: User) {
  await user.type(screen.getByLabelText("Email"), "a@b.com");
  await user.type(screen.getByLabelText("Password"), "secret123");
  await user.click(screen.getByRole("button", { name: "Sign in" }));
}

describe("LoginPage", () => {
  it("posts credentials and goes to the dashboard on success", async () => {
    let body: unknown;
    server.use(
      http.post(apiUrl("/auth/login"), async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ id: "u1" });
      }),
    );
    const { user } = renderWithUser(<LoginPage />);
    await fillLogin(user);
    await waitFor(() => expect(push).toHaveBeenCalledWith("/dashboard"));
    expect(body).toEqual({ email: "a@b.com", password: "secret123" });
    expect(refresh).toHaveBeenCalled();
  });

  it("honours a same-origin redirect param", async () => {
    search = "redirect=%2Finvite%2Fabc";
    server.use(http.post(apiUrl("/auth/login"), () => HttpResponse.json({})));
    const { user } = renderWithUser(<LoginPage />);
    await fillLogin(user);
    await waitFor(() => expect(push).toHaveBeenCalledWith("/invite/abc"));
  });

  it.each(["https://evil.com", "//evil.com", "/\\evil.com"])(
    "ignores external redirect %s",
    async (target) => {
      search = `redirect=${encodeURIComponent(target)}`;
      server.use(http.post(apiUrl("/auth/login"), () => HttpResponse.json({})));
      const { user } = renderWithUser(<LoginPage />);
      await fillLogin(user);
      await waitFor(() => expect(push).toHaveBeenCalledWith("/dashboard"));
    },
  );

  it.each([
    [401, "อีเมลหรือรหัสผ่านไม่ถูกต้อง"],
    [429, "ลองบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่"],
    [500, "เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง"],
  ])("shows a Thai message for %i and does not navigate", async (status, message) => {
    server.use(
      http.post(apiUrl("/auth/login"), () => HttpResponse.json({ error: "raw english" }, { status })),
      http.post(apiUrl("/auth/refresh"), () => new HttpResponse(null, { status: 401 })),
    );
    const { user } = renderWithUser(<LoginPage />);
    await fillLogin(user);
    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(screen.queryByText("raw english")).not.toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled();
  });

  it("shows the OAuth failure message from the error param", () => {
    search = "error=access_denied";
    renderWithUser(<LoginPage />);
    expect(screen.getByText("ยกเลิกการเข้าสู่ระบบด้วย Google แล้ว")).toBeInTheDocument();
  });

  it("explains an unverified Google email in Thai", () => {
    search = "error=google_email_unverified";
    renderWithUser(<LoginPage />);
    expect(screen.getByText(/อีเมล Google นี้ยังไม่ได้ยืนยัน/)).toBeInTheDocument();
  });

  it("requires both fields", () => {
    renderWithUser(<LoginPage />);
    expect(screen.getByLabelText("Email")).toBeRequired();
    expect(screen.getByLabelText("Password")).toBeRequired();
  });
});

describe("RegisterPage", () => {
  async function fillRegister(user: User) {
    await user.type(screen.getByLabelText("Full Name"), "Ann Lee");
    await user.type(screen.getByLabelText("Email"), "ann@b.com");
    await user.type(screen.getByLabelText("Password"), "longenough1");
    await user.click(screen.getByRole("button", { name: "Create account" }));
  }

  it("posts the form and goes to the dashboard on success", async () => {
    let body: unknown;
    server.use(
      http.post(apiUrl("/auth/register"), async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ id: "u1" }, { status: 201 });
      }),
    );
    const { user } = renderWithUser(<RegisterPage />);
    await fillRegister(user);
    await waitFor(() => expect(push).toHaveBeenCalledWith("/dashboard"));
    expect(body).toEqual({ email: "ann@b.com", full_name: "Ann Lee", password: "longenough1" });
  });

  it.each([
    [409, "อีเมลนี้ถูกใช้งานแล้ว"],
    [429, "ลองบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่"],
    [500, "สมัครสมาชิกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง"],
  ])("shows a Thai message for %i and does not navigate", async (status, message) => {
    server.use(
      http.post(apiUrl("/auth/register"), () => HttpResponse.json({ error: "raw english" }, { status })),
    );
    const { user } = renderWithUser(<RegisterPage />);
    await fillRegister(user);
    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("enforces the 8 character password minimum on the input", () => {
    renderWithUser(<RegisterPage />);
    expect(screen.getByLabelText("Password")).toHaveAttribute("minlength", "8");
  });
});
