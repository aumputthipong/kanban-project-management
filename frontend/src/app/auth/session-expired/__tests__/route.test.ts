// @vitest-environment node
import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "../route";

function run(query: string) {
  const req = new NextRequest(new URL(`/auth/session-expired${query}`, "http://app.test"));
  req.cookies.set("auth_token", "rejected-jwt");
  return GET(req);
}

describe("GET /auth/session-expired", () => {
  it("deletes the rejected auth_token and sends the visitor to login with a reason", () => {
    const res = run("?redirect=%2Fboard%2Fb1%2Fsettings");
    const url = new URL(res.headers.get("location")!);

    expect(url.pathname).toBe("/login");
    expect(url.searchParams.get("redirect")).toBe("/board/b1/settings");
    expect(url.searchParams.get("error")).toBe("session_expired");
    expect(res.headers.get("set-cookie")).toMatch(/auth_token=;.*(Max-Age=0|Expires=Thu, 01 Jan 1970)/i);
  });

  it("refuses an off-site redirect", () => {
    const url = new URL(run("?redirect=%2F%2Fevil.test").headers.get("location")!);
    expect(url.searchParams.get("redirect")).toBe("/dashboard");
  });
});
