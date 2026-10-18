import { invoke } from "@tauri-apps/api/core";
import type {
  AutostartState,
  CatalogView,
  EditorChoice,
  LauncherAvailability,
  LauncherSettingsView,
  ProjectAction,
  ProjectInput,
  StagedCover,
  TerminalChoice,
} from "./types";

export function getCatalog(): Promise<CatalogView> {
  return invoke<CatalogView>("get_catalog");
}

export function createProject(input: ProjectInput): Promise<CatalogView> {
  return invoke<CatalogView>("create_project", { input });
}

export function updateProject(
  projectId: string,
  input: ProjectInput,
): Promise<CatalogView> {
  return invoke<CatalogView>("update_project", { projectId, input });
}

export function archiveProject(projectId: string): Promise<CatalogView> {
  return invoke<CatalogView>("archive_project", { projectId });
}

export function restoreProject(projectId: string): Promise<CatalogView> {
  return invoke<CatalogView>("restore_project", { projectId });
}

export function deleteProject(projectId: string): Promise<CatalogView> {
  return invoke<CatalogView>("delete_project", { projectId });
}

export function stageCover(sourcePath: string): Promise<StagedCover> {
  return invoke<StagedCover>("stage_cover", { sourcePath });
}

export function discardCover(coverPath: string): Promise<void> {
  return invoke<void>("discard_cover", { coverPath });
}

export function getLauncherAvailability(): Promise<LauncherAvailability> {
  return invoke<LauncherAvailability>("get_launcher_availability");
}

export function getLauncherSettings(): Promise<LauncherSettingsView> {
  return invoke<LauncherSettingsView>("get_launcher_settings");
}

export function setLauncherSettings(
  editor: EditorChoice,
  terminal: TerminalChoice,
): Promise<LauncherSettingsView> {
  return invoke<LauncherSettingsView>("set_launcher_settings", {
    editor,
    terminal,
  });
}

export function openProjectAction(
  projectId: string,
  action: ProjectAction,
): Promise<void> {
  return invoke<void>("open_project_action", { projectId, action });
}

export function getAutostartState(): Promise<AutostartState> {
  return invoke<AutostartState>("get_autostart_state");
}

export function setAutostartEnabled(enabled: boolean): Promise<AutostartState> {
  return invoke<AutostartState>("set_autostart_enabled", { enabled });
}
