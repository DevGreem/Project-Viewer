import type { ComponentProps } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ActionMenu } from "./ActionMenu";
import { actionsAvailable, makeProject } from "../test/fixtures";

const anchor = {
  left: 20,
  top: 80,
  right: 240,
  bottom: 190,
  width: 220,
  height: 110,
  x: 20,
  y: 80,
  toJSON: () => ({}),
} as DOMRect;

function renderMenu(
  overrides: Partial<ComponentProps<typeof ActionMenu>> = {},
) {
  const onClose = vi.fn();
  const onEdit = vi.fn();
  const onArchive = vi.fn();
  const onAction = vi.fn();

  render(
    <ActionMenu
      project={makeProject()}
      anchor={anchor}
      availability={actionsAvailable}
      onClose={onClose}
      onEdit={onEdit}
      onArchive={onArchive}
      onAction={onAction}
      {...overrides}
    />,
  );

  return { onClose, onEdit, onArchive, onAction };
}

describe("ActionMenu", () => {
  it("offers folder, editor, terminal, edit and close actions", () => {
    renderMenu();

    expect(screen.getByRole("menuitem", { name: "Abrir carpeta" })).toBeEnabled();
    expect(
      screen.getByRole("menuitem", { name: "Abrir en VS Code" }),
    ).toBeEnabled();
    expect(
      screen.getByRole("menuitem", { name: /Abrir terminal/ }),
    ).toBeEnabled();
    expect(screen.getByRole("menuitem", { name: "Editar" })).toBeEnabled();
    expect(
      screen.getByRole("menuitem", { name: "Cerrar proyecto" }),
    ).toBeEnabled();
  });

  it("disables opening actions when the project has no path", () => {
    renderMenu({ project: makeProject({ path: null }) });

    expect(screen.getByRole("menuitem", { name: "Abrir carpeta" })).toBeDisabled();
    expect(
      screen.getByRole("menuitem", { name: "Abrir en VS Code" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("menuitem", { name: /Abrir terminal/ }),
    ).toBeDisabled();
    expect(
      screen.getByRole("menuitem", { name: "Abrir carpeta" }),
    ).toHaveAttribute("title", "Asigna una ruta local para abrir este proyecto.");
  });

  it("disables actions when the tool is not available", () => {
    renderMenu({
      availability: {
        folder: false,
        vscode: false,
        terminal: false,
        terminalName: null,
      },
    });

    expect(screen.getByRole("menuitem", { name: "Abrir carpeta" })).toBeDisabled();
    expect(
      screen.getByRole("menuitem", { name: "Abrir en VS Code" }),
    ).toBeDisabled();
  });

  it("focuses the first enabled action and supports arrow navigation", async () => {
    renderMenu();
    const folder = screen.getByRole("menuitem", { name: "Abrir carpeta" });
    const vscode = screen.getByRole("menuitem", { name: "Abrir en VS Code" });

    await waitFor(() => expect(document.activeElement).toBe(folder));
    fireEvent.keyDown(screen.getByRole("menu"), { key: "ArrowDown" });
    expect(document.activeElement).toBe(vscode);
  });

  it("closes on Escape", () => {
    const { onClose } = renderMenu();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("closes on an outside click", () => {
    const { onClose } = renderMenu();
    fireEvent.mouseDown(document.body);
    expect(onClose).toHaveBeenCalled();
  });

  it("runs an opening action and closes", async () => {
    const user = userEvent.setup();
    const { onAction, onClose } = renderMenu();

    await user.click(screen.getByRole("menuitem", { name: "Abrir carpeta" }));

    expect(onAction).toHaveBeenCalledWith("folder");
    expect(onClose).toHaveBeenCalled();
  });

  it("triggers edit and close actions", async () => {
    const user = userEvent.setup();
    const { onEdit, onArchive } = renderMenu();

    await user.click(screen.getByRole("menuitem", { name: "Editar" }));
    await user.click(
      screen.getByRole("menuitem", { name: "Cerrar proyecto" }),
    );

    expect(onEdit).toHaveBeenCalled();
    expect(onArchive).toHaveBeenCalled();
  });
});
