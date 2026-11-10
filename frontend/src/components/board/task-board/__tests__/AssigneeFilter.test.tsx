import { describe, it, expect } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { renderWithUser } from "@/test/render";
import { makeMember } from "@/test/factories";
import { useBoardStore, UNASSIGNED_FILTER } from "@/store/useBoardStore";
import { AssigneeFilterDropdown, MyTasksToggle } from "../AssigneeFilter";

function seed(currentUserId = "me") {
  useBoardStore.setState({
    currentUserId,
    boardMembers: [
      makeMember({ id: "m0", user_id: "me", full_name: "Me Myself" }),
      makeMember({ id: "m1", user_id: "ann", full_name: "Ann Lee" }),
      makeMember({ id: "m2", user_id: "bob", full_name: "Bob Kim" }),
    ],
  });
}

const filter = () => useBoardStore.getState().filterAssigneeId;

// Menu rows carry aria-pressed; the chip that opens the menu carries aria-expanded instead.
const menuItem = (name: RegExp) =>
  screen.getAllByRole("button", { name }).find((b) => b.hasAttribute("aria-pressed"))!;

describe("MyTasksToggle", () => {
  it("renders nothing until the current user is known", () => {
    seed("");
    renderWithUser(<MyTasksToggle />);
    expect(screen.queryByRole("button", { name: /My Tasks/ })).not.toBeInTheDocument();
  });

  it("toggles the filter to me and back on click", async () => {
    seed();
    const { user } = renderWithUser(<MyTasksToggle />);
    const btn = screen.getByRole("button", { name: /My Tasks/ });

    await user.click(btn);
    expect(filter()).toBe("me");
    expect(btn).toHaveAttribute("aria-pressed", "true");

    await user.click(btn);
    expect(filter()).toBeNull();
  });

  it("M toggles the filter from anywhere on the page", () => {
    seed();
    renderWithUser(<MyTasksToggle />);
    fireEvent.keyDown(window, { key: "m" });
    expect(filter()).toBe("me");
    fireEvent.keyDown(window, { key: "M" });
    expect(filter()).toBeNull();
  });

  it("holding M down toggles once, not at the key-repeat rate", () => {
    seed();
    renderWithUser(<MyTasksToggle />);
    fireEvent.keyDown(window, { key: "m" });
    fireEvent.keyDown(window, { key: "m", repeat: true });
    expect(filter()).toBe("me");
  });

  it("ignores M while typing, with a modifier, or with a dialog open", () => {
    seed();
    renderWithUser(
      <>
        <input aria-label="search" />
        <MyTasksToggle />
      </>,
    );
    fireEvent.keyDown(screen.getByLabelText("search"), { key: "m" });
    fireEvent.keyDown(window, { key: "m", ctrlKey: true });
    fireEvent.keyDown(window, { key: "m", metaKey: true });
    expect(filter()).toBeNull();

    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog");
    document.body.appendChild(dialog);
    try {
      fireEvent.keyDown(window, { key: "m" });
      expect(filter()).toBeNull();
    } finally {
      dialog.remove();
    }
  });
});

describe("AssigneeFilterDropdown", () => {
  it("lists everyone but me, plus Unassigned", async () => {
    seed();
    const { user } = renderWithUser(<AssigneeFilterDropdown />);
    await user.click(screen.getByRole("button", { name: /Assignee/ }));
    expect(screen.getByRole("button", { name: /Ann Lee/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Bob Kim/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Unassigned/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Me Myself/ })).not.toBeInTheDocument();
  });

  it("picking a member filters, closes the menu and shows their name on the chip", async () => {
    seed();
    const { user } = renderWithUser(<AssigneeFilterDropdown />);
    await user.click(screen.getByRole("button", { name: /Assignee/ }));
    await user.click(screen.getByRole("button", { name: /Ann Lee/ }));

    expect(filter()).toBe("ann");
    const trigger = screen.getByRole("button", { name: /Ann Lee/ });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("picking the selected member again clears the filter", async () => {
    seed();
    useBoardStore.setState({ filterAssigneeId: "ann" });
    const { user } = renderWithUser(<AssigneeFilterDropdown />);
    await user.click(screen.getByRole("button", { name: /Ann Lee/ }));
    await user.click(menuItem(/Ann Lee/));
    expect(filter()).toBeNull();
  });

  it("filters to unassigned cards and clears from the menu", async () => {
    seed();
    const { user } = renderWithUser(<AssigneeFilterDropdown />);
    await user.click(screen.getByRole("button", { name: /Assignee/ }));
    await user.click(menuItem(/Unassigned/));
    expect(filter()).toBe(UNASSIGNED_FILTER);

    const trigger = screen.getByRole("button", { name: /Unassigned/, expanded: false });
    await user.click(trigger);
    await user.click(screen.getByRole("button", { name: "Clear filter" }));
    expect(filter()).toBeNull();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("closes on Escape and on an outside click", async () => {
    seed();
    const { user } = renderWithUser(
      <>
        <p>outside</p>
        <AssigneeFilterDropdown />
      </>,
    );
    const trigger = screen.getByRole("button", { name: /Assignee/ });

    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    await user.keyboard("{Escape}");
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    await user.click(trigger);
    await user.click(screen.getByText("outside"));
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });
});
