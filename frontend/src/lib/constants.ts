// Browser: same-origin "/api" via Next rewrites (first-party cookie). SSR: backend directly.
export const API_URL =
  typeof window === "undefined" ? process.env.NEXT_PUBLIC_API_URL : "/api";

// Same on server and client: the OAuth state cookie must land on the origin the callback returns to.
export const GOOGLE_SIGN_IN_URL = "/api/auth/google";

export const WS_URL = process.env.NEXT_PUBLIC_WS_URL;
