import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { UserMenu } from "@/components/layout/UserMenu";
import { server, apiUrl } from "@/test/server";
import { renderWithUser } from "@/test/render";
import { toastMessages } from "@/test/board";

const { router } = vi.hoisted(() => ({ router: { push: vi.fn(), refresh: vi.fn() } }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const ME = apiUrl("/auth/me");
const LOGOUT = apiUrl("/auth/logout");

beforeEach(() => {
  router.push.mockClear();
  server.use(http.get(ME, () => HttpResponse.json({ user_id: "u1", email: "ann@x.com", full_name: "Ann Lee" })));
});

async function signOut() {
  const view = renderWithUser(<UserMenu fallbackEmail="fallback@x.com" />);
  await view.user.click(await screen.findByRole("button", { name: /Ann Lee/ }));
  await view.user.click(screen.getByRole("menuitem", { name: "Sign out" }));
  return view;
}

describe("UserMenu", () => {
  it("shows the signed-in user's name", async () => {
    renderWithUser(<UserMenu fallbackEmail="fallback@x.com" />);
    expect(await screen.findByText("Ann Lee")).toBeInTheDocument();
  });

  it("falls back to the email when /auth/me fails", async () => {
    server.use(http.get(ME, () => HttpResponse.json({ error: "x" }, { status: 500 })));
    renderWithUser(<UserMenu fallbackEmail="fallback@x.com" />);
    expect(await screen.findByText("fallback@x.com")).toBeInTheDocument();
    expect(toastMessages()).toEqual([]);
  });

  it("goes to login after signing out", async () => {
    server.use(http.post(LOGOUT, () => new HttpResponse(null, { status: 204 })));
    await signOut();
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/login"));
  });

  it("treats an already-expired session as signed out", async () => {
    server.use(
      http.post(LOGOUT, () => HttpResponse.json({ error: "x" }, { status: 401 })),
      http.post(apiUrl("/auth/refresh"), () => HttpResponse.json({ error: "x" }, { status: 401 }))
    );
    await signOut();
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/login"));
    expect(toastMessages()).toEqual([]);
  });

  it("stays signed in and says so when the logout request fails", async () => {
    server.use(http.post(LOGOUT, () => HttpResponse.error()));
    await signOut();
    await waitFor(() => expect(toastMessages()).toEqual(["ออกจากระบบไม่สำเร็จ ลองอีกครั้ง"]));
    expect(router.push).not.toHaveBeenCalled();
    expect(screen.getByRole("menuitem", { name: "Sign out" })).toBeEnabled();
  });
});
