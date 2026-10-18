export type ProjectStatus = "active" | "archived";

export type EditorKind = "auto" | "vscode" | "godot" | "custom";

export type TerminalKind =
  | "auto"
  | "gnome-terminal"
  | "konsole"
  | "xfce4-terminal"
  | "kitty"
  | "alacritty"
  | "custom";

export interface EditorChoice {
  kind: EditorKind;
  command?: string | null;
}

export interface TerminalChoice {
  kind: TerminalKind;
  command?: string | null;
}

export interface Project {
  id: string;
  name: string;
  path: string | null;
  cover: string | null;
  status: ProjectStatus;
  createdAt: number;
  updatedAt: number;
  archivedAt: number | null;
  editor?: EditorChoice | null;
  terminal?: TerminalChoice | null;
}

export interface CatalogView {
  dataDir: string;
  projects: Project[];
  warning: string | null;
}

export interface ProjectInput {
  name: string;
  path: string | null;
  cover: string | null;
  removeCover: boolean;
  editor: EditorChoice | null;
  terminal: TerminalChoice | null;
}

export interface StagedCover {
  path: string;
}

export interface LauncherOption {
  id: string;
  label: string;
  available: boolean;
}

export interface LauncherAvailability {
  folder: boolean;
  editors: LauncherOption[];
  terminals: LauncherOption[];
}

export interface LauncherSettingsView {
  defaultEditor: EditorChoice;
  defaultTerminal: TerminalChoice;
  availability: LauncherAvailability;
}

export interface AutostartState {
  available: boolean;
  enabled: boolean;
  devMode: boolean;
}

export interface AppError {
  code: string;
  message: string;
  details?: string | null;
}

export type ProjectAction = "folder" | "editor" | "terminal";

export type ToastKind = "success" | "error" | "info";

export interface ToastMessage {
  id: number;
  kind: ToastKind;
  message: string;
}
