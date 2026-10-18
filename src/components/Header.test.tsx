import type { ComponentProps } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Header } from "./Header";
import { autostartAvailable, launcherSettings } from "../test/fixtures";

function renderHeader(
  overrides: Partial<ComponentProps<typeof Header>> = {},
) {
  const onNewProject = vi.fn();
  const onShowActive = vi.fn();
  const onShowArchived = vi.fn();
  const onAutostartChange = vi.fn().mockResolvedValue(undefined);
  const onLauncherSettingsChange = vi.fn().mockResolvedValue(undefined);

  render(
    <Header
      view="active"
      archivedCount={2}
      onNewProject={onNewProject}
      onShowActive={onShowActive}
      onShowArchived={onShowArchived}
      autostart={autostartAvailable}
      onAutostartChange={onAutostartChange}
      launcherSettings={launcherSettings}
      onLauncherSettingsChange={onLauncherSettingsChange}
      {...overrides}
    />,
  );

  return {
    onNewProject,
    onShowActive,
    onShowArchived,
    onAutostartChange,
    onLauncherSettingsChange,
  };
}

describe("Header", () => {
  it("opens the project form and archived view", async () => {
    const user = userEvent.setup();
    const { onNewProject, onShowArchived } = renderHeader();

    await user.click(screen.getByRole("button", { name: "Nuevo proyecto" }));
    expect(onNewProject).toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /Archivados/ }));
    expect(onShowArchived).toHaveBeenCalled();
  });

  it("toggles autostart from the settings panel", async () => {
    const user = userEvent.setup();
    const { onAutostartChange } = renderHeader();

    await user.click(screen.getByRole("button", { name: "Ajustes" }));
    const checkbox = screen.getByRole("checkbox", {
      name: /Iniciar al iniciar sesión/,
    });
    expect(checkbox).toBeEnabled();
    await user.click(checkbox);
    expect(onAutostartChange).toHaveBeenCalledWith(true);
  });

  it("explains that autostart is unavailable in dev mode", async () => {
    const user = userEvent.setup();
    renderHeader({
      autostart: { available: false, enabled: false, devMode: true },
    });

    await user.click(screen.getByRole("button", { name: "Ajustes" }));
    expect(
      screen.getByRole("checkbox", { name: /Iniciar al iniciar sesión/ }),
    ).toBeDisabled();
    expect(
      screen.getByText(/El arranque automático se configura en la app instalada/),
    ).toBeInTheDocument();
  });

  it("saves the global launcher settings", async () => {
    const user = userEvent.setup();
    const { onLauncherSettingsChange } = renderHeader();

    await user.click(screen.getByRole("button", { name: "Ajustes" }));
    await user.selectOptions(
      screen.getByLabelText("Editor por defecto"),
      "godot",
    );
    await user.click(screen.getByRole("button", { name: "Guardar lanzadores" }));

    expect(onLauncherSettingsChange).toHaveBeenCalledWith(
      { kind: "godot", command: null },
      { kind: "gnome-terminal", command: null },
    );
  });

  it("rejects global custom commands without {path}", async () => {
    const user = userEvent.setup();
    const { onLauncherSettingsChange } = renderHeader();

    await user.click(screen.getByRole("button", { name: "Ajustes" }));
    await user.selectOptions(
      screen.getByLabelText("Editor por defecto"),
      "custom",
    );
    await user.type(screen.getByLabelText("Comando personalizado"), "mi-editor");
    await user.click(screen.getByRole("button", { name: "Guardar lanzadores" }));

    expect(
      screen.getByText("El comando personalizado debe incluir {path}."),
    ).toBeInTheDocument();
    expect(onLauncherSettingsChange).not.toHaveBeenCalled();
  });

  it("returns to the active view from archived", async () => {
    const user = userEvent.setup();
    const { onShowActive } = renderHeader({ view: "archived" });

    await user.click(screen.getByRole("button", { name: "Volver a proyectos" }));
    expect(onShowActive).toHaveBeenCalled();
  });
});
