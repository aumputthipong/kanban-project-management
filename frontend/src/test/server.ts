import { setupServer } from "msw/node";

export const server = setupServer();

/** Absolute URL for an API path as the browser-side client builds it (`/api` + path). */
export const apiUrl = (path: string) => `${window.location.origin}/api${path}`;
