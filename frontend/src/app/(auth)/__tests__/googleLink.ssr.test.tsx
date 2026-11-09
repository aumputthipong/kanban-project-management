// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { renderToString } from "react-dom/server";
import LoginPage from "../login/page";
import RegisterPage from "../register/page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

// Server HTML must match the browser, and the OAuth state cookie must land on the callback's origin.
describe.each([
  ["login", LoginPage],
  ["register", RegisterPage],
])("%s page server render", (_name, Page) => {
  it("links Google sign-in through the same-origin /api rewrite", () => {
    const html = renderToString(<Page />);
    expect(html).toContain('href="/api/auth/google"');
  });
});
