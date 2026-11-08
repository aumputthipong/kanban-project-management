import { describe, it, expect } from "vitest";
import { safeRedirectPath } from "@/lib/authForm";

describe("safeRedirectPath", () => {
  it.each(["/board/b1/tasks", "/dashboard?x=1", "/invite/abc"])("keeps same-origin path %s", (p) => {
    expect(safeRedirectPath(p)).toBe(p);
  });

  it.each([
    null,
    "",
    "https://evil.com",
    "//evil.com",
    "/\\evil.com",
    "/\t/evil.com",
    "/\n/evil.com",
    "javascript:alert(1)",
    "evil.com",
  ])("falls back to dashboard for %j", (p) => {
    expect(safeRedirectPath(p)).toBe("/dashboard");
  });
});
