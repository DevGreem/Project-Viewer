import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import * as api from "./api";
import { strings } from "./i18n/es";
import {
  autostartAvailable,
  launcherSettings,
  makeCatalog,
  makeProject,
} from "./test/fixtures";

vi.mock("./api", () => ({
  getCatalog: vi.fn(),
  createProject: vi.fn(),
  updateProject: vi.fn(),
  archiveProject: vi.fn(),
  restoreProject: vi.fn(),
  deleteProject: vi.fn(),
  stageCover: vi.fn(),
  discardCover: vi.fn(),
  getLauncherAvailability: vi.fn(),
  getLauncherSettings: vi.fn(),
  setLauncherSettings: vi.fn(),
  openProjectAction: vi.fn(),
  getAutostartState: vi.fn(),
  setAutostartEnabled: vi.fn(),
}));

const mockedApi = vi.mocked(api);

describe("App", () => {
  beforeEach(() => {
    const active = makeProject({ id: "alpha", name: "Alpha", updatedAt: 2_000 });
    const archived = makeProject({
      id: "old",
      name: "Old project",
      status: "archived",
      archivedAt: 3_000,
    });

    mockedApi.getCatalog.mockResolvedValue(makeCatalog([active, archived]));
    mockedApi.getLauncherSettings.mockResolvedValue(launcherSettings);
    mockedApi.getAutostartState.mockResolvedValue(autostartAvailable);
    mockedApi.archiveProject.mockResolvedValue(
      makeCatalog([
        makeProject({
          id: "alpha",
          name: "Alpha",
          status: "archived",
          archivedAt: 4_000,
        }),
        archived,
      ]),
    );
    mockedApi.restoreProject.mockResolvedValue(
      makeCatalog([active, { ...archived, status: "active", archivedAt: null }]),
    );
    mockedApi.deleteProject.mockResolvedValue(makeCatalog([active]));
  });

  it("shows active projects and archives one from its menu", async () => {
    const user = userEvent.setup();
    render(<App />);

    const card = await screen.findByRole("button", {
      name: /Acciones del proyecto: Alpha/,
    });
    expect(screen.queryByText("Old project")).not.toBeInTheDocument();

    await user.click(card);
    await user.click(screen.getByRole("menuitem", { name: "Cerrar proyecto" }));

    expect(mockedApi.archiveProject).toHaveBeenCalledWith("alpha");
    await waitFor(() =>
      expect(screen.queryByText("Alpha")).not.toBeInTheDocument(),
    );
    expect(await screen.findByText(strings.projectArchived)).toBeInTheDocument();
  });

  it("restores an archived project from the archived view", async () => {
    const user = userEvent.setup();
    render(<App />);

    await screen.findByText("Alpha");
    await user.click(screen.getByRole("button", { name: /Archivados/ }));
    expect(screen.getByText("Old project")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Restaurar" }));

    expect(mockedApi.restoreProject).toHaveBeenCalledWith("old");
    await waitFor(() =>
      expect(screen.queryByText("Old project")).not.toBeInTheDocument(),
    );
    expect(await screen.findByText(strings.projectRestored)).toBeInTheDocument();
  });
});
