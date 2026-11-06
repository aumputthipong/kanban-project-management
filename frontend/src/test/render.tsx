import type { ReactElement } from "react";
import { render, type RenderOptions } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/** `render` plus a `user` from `userEvent.setup()`, the preferred way to drive interactions. */
export function renderWithUser(ui: ReactElement, options?: RenderOptions) {
  return { user: userEvent.setup(), ...render(ui, options) };
}
