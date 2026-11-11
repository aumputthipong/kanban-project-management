// @vitest-environment node
import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "../proxy";

function run(path: string, token?: string) {
  const req = new NextRequest(new URL(path, "http://app.test"));
  if (token) req.cookies.set("auth_token", token);
  const res = proxy(req);
  return { status: res.status, location: res.headers.get("location") };
}

describe("proxy", () => {
  it("sends a signed-out visitor of a protected page to login, keeping where they were going", () => {
    const { status, location } = run("/board/b1/tasks?card=c9");
    expect(status).toBe(307);
    const url = new URL(location!);
    expect(url.pathname).toBe("/login");
    expect(url.searchParams.get("redirect")).toBe("/board/b1/tasks?card=c9");
  });

  it("encodes a query string with & so login gets it back intact", () => {
    const { location } = run("/board/b1/tasks?card=c9&view=list");
    expect(new URL(location!).searchParams.get("redirect")).toBe("/board/b1/tasks?card=c9&view=list");
  });

  it("protects the dashboard too", () => {
    expect(new URL(run("/dashboard").location!).searchParams.get("redirect")).toBe("/dashboard");
  });

  it("lets a signed-in user through to protected pages", () => {
    expect(run("/board/b1/tasks", "jwt").location).toBeNull();
  });

  it("sends a signed-in user away from login and register", () => {
    expect(new URL(run("/login", "jwt").location!).pathname).toBe("/dashboard");
    expect(new URL(run("/register", "jwt").location!).pathname).toBe("/dashboard");
  });

  it("leaves login and register alone for a signed-out visitor", () => {
    expect(run("/login").location).toBeNull();
    expect(run("/register").location).toBeNull();
  });
});
