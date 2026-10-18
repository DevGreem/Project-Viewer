import type {
  ActionAvailability,
  AutostartState,
  CatalogView,
  Project,
} from "../types";

export function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: "project-1",
    name: "Project One",
    path: "/home/ian/projects/project-one",
    cover: null,
    status: "active",
    createdAt: 1_000,
    updatedAt: 2_000,
    archivedAt: null,
    ...overrides,
  };
}

export function makeCatalog(projects: Project[]): CatalogView {
  return {
    dataDir: "/home/ian/.local/share/com.ian.projectviewer",
    projects,
    warning: null,
  };
}

export const actionsAvailable: ActionAvailability = {
  folder: true,
  vscode: true,
  terminal: true,
  terminalName: "gnome-terminal",
};

export const autostartAvailable: AutostartState = {
  available: true,
  enabled: false,
  devMode: false,
};
