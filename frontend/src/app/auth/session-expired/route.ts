import { NextRequest, NextResponse } from "next/server";
import { safeRedirectPath } from "@/lib/authForm";

/** Drops an auth_token the API rejected, then shows login; the proxy would bounce it otherwise. */
export function GET(request: NextRequest) {
  const login = new URL("/login", request.url);
  login.searchParams.set("redirect", safeRedirectPath(request.nextUrl.searchParams.get("redirect")));
  login.searchParams.set("error", "session_expired");
  const res = NextResponse.redirect(login);
  res.cookies.delete("auth_token");
  return res;
}
