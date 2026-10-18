import type {
  AutostartState,
  CatalogView,
  EditorChoice,
  LauncherSettingsView,
  Project,
  TerminalChoice,
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
    editor: null,
    terminal: null,
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

export const vscodeEditor: EditorChoice = { kind: "vscode", command: null };
export const godotEditor: EditorChoice = { kind: "godot", command: null };
export const gnomeTerminal: TerminalChoice = {
  kind: "gnome-terminal",
  command: null,
};

export const launcherSettings: LauncherSettingsView = {
  defaultEditor: vscodeEditor,
  defaultTerminal: gnomeTerminal,
  availability: {
    folder: true,
    editors: [
      { id: "vscode", label: "VS Code", available: true },
      { id: "godot", label: "Godot", available: true },
      { id: "custom", label: "Personalizado", available: true },
    ],
    terminals: [
      { id: "gnome-terminal", label: "GNOME Terminal", available: true },
      { id: "konsole", label: "Konsole", available: false },
      { id: "xfce4-terminal", label: "Xfce Terminal", available: false },
      { id: "kitty", label: "kitty", available: false },
      { id: "alacritty", label: "Alacritty", available: false },
      { id: "custom", label: "Personalizado", available: true },
    ],
  },
};

export const autostartAvailable: AutostartState = {
  available: true,
  enabled: false,
  devMode: false,
};
