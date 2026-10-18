import type { ComponentProps } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { discardCover, stageCover } from "../api";
import { ProjectFormModal } from "./ProjectFormModal";
import { launcherSettings, makeProject } from "../test/fixtures";

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
}));

vi.mock("../api", () => ({
  stageCover: vi.fn(),
  discardCover: vi.fn(),
}));

const mockedOpenDialog = vi.mocked(openDialog);
const mockedStageCover = vi.mocked(stageCover);
const mockedDiscardCover = vi.mocked(discardCover);

function renderModal(
  overrides: Partial<ComponentProps<typeof ProjectFormModal>> = {},
) {
  const onCreate = vi.fn().mockResolvedValue(undefined);
  const onUpdate = vi.fn().mockResolvedValue(undefined);
  const onClose = vi.fn();

  render(
    <ProjectFormModal
      open
      project={null}
      dataDir="/data"
      launcherSettings={launcherSettings}
      onClose={onClose}
      onCreate={onCreate}
      onUpdate={onUpdate}
      {...overrides}
    />,
  );

  return { onCreate, onUpdate, onClose };
}

describe("ProjectFormModal", () => {
  beforeEach(() => {
    mockedOpenDialog.mockReset();
    mockedStageCover.mockReset();
    mockedDiscardCover.mockReset();
  });

  it("creates a project from the form", async () => {
    const user = userEvent.setup();
    const { onCreate, onClose } = renderModal();

    await screen.findByRole("dialog");
    await user.type(screen.getByLabelText("Nombre"), "My new project");
    await user.click(screen.getByRole("button", { name: "Guardar proyecto" }));

    await waitFor(() =>
      expect(onCreate).toHaveBeenCalledWith({
        name: "My new project",
        path: null,
        cover: null,
        removeCover: false,
        editor: null,
        terminal: null,
      }),
    );
    expect(onClose).toHaveBeenCalled();
  });

  it("rejects an empty name", async () => {
    const user = userEvent.setup();
    const { onCreate } = renderModal();

    await screen.findByRole("dialog");
    await user.click(screen.getByRole("button", { name: "Guardar proyecto" }));

    expect(
      screen.getByText("El nombre del proyecto es obligatorio."),
    ).toBeInTheDocument();
    expect(onCreate).not.toHaveBeenCalled();
  });

  it("preloads and updates an existing project", async () => {
    const user = userEvent.setup();
    const project = makeProject({ name: "Original" });
    const { onUpdate, onClose } = renderModal({ project });

    const nameInput = await screen.findByDisplayValue("Original");
    await user.clear(nameInput);
    await user.type(nameInput, "Renamed");
    await user.click(screen.getByRole("button", { name: "Guardar proyecto" }));

    await waitFor(() =>
      expect(onUpdate).toHaveBeenCalledWith(project.id, {
        name: "Renamed",
        path: project.path,
        cover: null,
        removeCover: false,
        editor: null,
        terminal: null,
      }),
    );
    expect(onClose).toHaveBeenCalled();
  });

  it("rejects a relative local path before calling the backend", async () => {
    const user = userEvent.setup();
    const { onCreate } = renderModal();

    await screen.findByRole("dialog");
    await user.type(screen.getByLabelText("Nombre"), "Project");
    await user.type(screen.getByLabelText("Ruta local"), "./relative");
    await user.click(screen.getByRole("button", { name: "Guardar proyecto" }));

    expect(
      screen.getByText("La ruta local debe ser una ruta absoluta."),
    ).toBeInTheDocument();
    expect(onCreate).not.toHaveBeenCalled();
  });

  it("closes and discards a staged cover on cancel", async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal();
    mockedOpenDialog.mockResolvedValue("/tmp/cover.png");
    mockedStageCover.mockResolvedValue({ path: "covers/staged-1.png" });
    mockedDiscardCover.mockResolvedValue(undefined);

    await screen.findByRole("dialog");
    await user.click(screen.getByRole("button", { name: "Elegir imagen" }));
    await waitFor(() =>
      expect(mockedStageCover).toHaveBeenCalledWith("/tmp/cover.png"),
    );

    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(mockedDiscardCover).toHaveBeenCalledWith("covers/staged-1.png");
    expect(onClose).toHaveBeenCalled();
  });

  it("closes with the dialog cancel event", async () => {
    const { onClose } = renderModal();
    const dialog = await screen.findByRole("dialog");

    fireEvent(
      dialog,
      new Event("cancel", { bubbles: true, cancelable: true }),
    );

    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("picks a folder with the native dialog", async () => {
    const user = userEvent.setup();
    renderModal();
    mockedOpenDialog.mockResolvedValue("/home/ian/My Projects/App");

    await screen.findByRole("dialog");
    await user.click(screen.getByRole("button", { name: "Elegir carpeta" }));

    await waitFor(() =>
      expect(screen.getByLabelText("Ruta local")).toHaveValue(
        "/home/ian/My Projects/App",
      ),
    );
  });

  it("saves per-project editor and terminal overrides", async () => {
    const user = userEvent.setup();
    const { onCreate } = renderModal();

    await screen.findByRole("dialog");
    await user.type(screen.getByLabelText("Nombre"), "Godot game");
    await user.selectOptions(
      screen.getByLabelText("Editor del proyecto"),
      "godot",
    );
    await user.selectOptions(
      screen.getByLabelText("Terminal del proyecto"),
      "gnome-terminal",
    );
    await user.click(screen.getByRole("button", { name: "Guardar proyecto" }));

    await waitFor(() =>
      expect(onCreate).toHaveBeenCalledWith({
        name: "Godot game",
        path: null,
        cover: null,
        removeCover: false,
        editor: { kind: "godot", command: null },
        terminal: { kind: "gnome-terminal", command: null },
      }),
    );
  });

  it("validates a custom editor command with {path}", async () => {
    const user = userEvent.setup();
    const { onCreate } = renderModal();

    await screen.findByRole("dialog");
    await user.type(screen.getByLabelText("Nombre"), "Custom");
    await user.selectOptions(
      screen.getByLabelText("Editor del proyecto"),
      "custom",
    );
    await user.type(
      screen.getByLabelText("Editor del proyecto: Comando personalizado"),
      "mi-editor --open",
    );
    await user.click(screen.getByRole("button", { name: "Guardar proyecto" }));

    expect(
      screen.getByText("El comando personalizado debe incluir {path}."),
    ).toBeInTheDocument();
    expect(onCreate).not.toHaveBeenCalled();
  });
});
