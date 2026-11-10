// Browser: same-origin "/api" via Next rewrites (first-party cookie). SSR: backend directly.
export const API_URL =
  typeof window === "undefined" ? process.env.NEXT_PUBLIC_API_URL : "/api";

// Same on server and client: the OAuth state cookie must land on the origin the callback returns to.
export const GOOGLE_SIGN_IN_URL = "/api/auth/google";

/** Login via a route that first drops a rejected auth_token; a bare /login would bounce back. */
export const sessionExpiredPath = (back?: string) =>
  back ? `/auth/session-expired?redirect=${encodeURIComponent(back)}` : "/auth/session-expired";

export const WS_URL = process.env.NEXT_PUBLIC_WS_URL;
