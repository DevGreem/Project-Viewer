export type ProjectStatus = "active" | "archived";

export interface Project {
  id: string;
  name: string;
  path: string | null;
  cover: string | null;
  status: ProjectStatus;
  createdAt: number;
  updatedAt: number;
  archivedAt: number | null;
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
}

export interface StagedCover {
  path: string;
}

export interface ActionAvailability {
  folder: boolean;
  vscode: boolean;
  terminal: boolean;
  terminalName: string | null;
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

export type ProjectAction = "folder" | "vscode" | "terminal";

export type ToastKind = "success" | "error" | "info";

export interface ToastMessage {
  id: number;
  kind: ToastKind;
  message: string;
}
