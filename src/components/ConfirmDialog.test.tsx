import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ConfirmDialog } from "./ConfirmDialog";

describe("ConfirmDialog", () => {
  it("confirms and cancels the deletion", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    const onConfirm = vi.fn();

    render(
      <ConfirmDialog
        open
        projectName="My project"
        busy={false}
        onCancel={onCancel}
        onConfirm={onConfirm}
      />,
    );

    expect(screen.getByText("My project")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onCancel).toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Sí, eliminar" }));
    expect(onConfirm).toHaveBeenCalled();
  });

  it("shows a busy state while deleting", () => {
    render(
      <ConfirmDialog
        open
        projectName="My project"
        busy
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Eliminando…" })).toBeDisabled();
  });

  it("treats the dialog cancel event as cancel", async () => {
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        open
        projectName="My project"
        busy={false}
        onCancel={onCancel}
        onConfirm={vi.fn()}
      />,
    );

    fireEvent(
      screen.getByRole("dialog"),
      new Event("cancel", { bubbles: true, cancelable: true }),
    );
    expect(onCancel).toHaveBeenCalled();
  });
});
