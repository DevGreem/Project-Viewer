import { useEffect, useRef, useState } from "react";
import { strings } from "../i18n/es";
import {
  commandValidationError,
  editorChoiceForSelect,
  editorLabels,
  editorKinds,
  findOption,
  terminalChoiceForSelect,
  terminalLabels,
  terminalKinds,
} from "../lib/launchers";
import type {
  AutostartState,
  EditorChoice,
  LauncherOption,
  LauncherSettingsView,
  TerminalChoice,
} from "../types";
import {
  ArchiveIcon,
  ChevronLeftIcon,
  FolderIcon,
  PlusIcon,
  SettingsIcon,
} from "./icons";

interface HeaderProps {
  view: "active" | "archived";
  archivedCount: number;
  onNewProject: () => void;
  onShowActive: () => void;
  onShowArchived: () => void;
  autostart: AutostartState | null;
  onAutostartChange: (enabled: boolean) => Promise<void>;
  launcherSettings: LauncherSettingsView | null;
  onLauncherSettingsChange: (
    editor: EditorChoice,
    terminal: TerminalChoice,
  ) => Promise<void>;
}

function optionLabel(label: string, option: LauncherOption | undefined) {
  return option?.available === false ? `${label} (${strings.notDetected})` : label;
}

export function Header({
  view,
  archivedCount,
  onNewProject,
  onShowActive,
  onShowArchived,
  autostart,
  onAutostartChange,
  launcherSettings,
  onLauncherSettingsChange,
}: HeaderProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [savingAutostart, setSavingAutostart] = useState(false);
  const [savingLaunchers, setSavingLaunchers] = useState(false);
  const [launcherError, setLauncherError] = useState<string | null>(null);
  const [draftEditor, setDraftEditor] = useState<EditorChoice>({
    kind: "auto",
    command: null,
  });
  const [draftTerminal, setDraftTerminal] = useState<TerminalChoice>({
    kind: "auto",
    command: null,
  });
  const settingsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!settingsOpen) return;

    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!settingsRef.current?.contains(event.target as Node)) {
        setSettingsOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSettingsOpen(false);
    };

    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [settingsOpen]);

  useEffect(() => {
    if (!settingsOpen || !launcherSettings) return;
    setDraftEditor(launcherSettings.defaultEditor);
    setDraftTerminal(launcherSettings.defaultTerminal);
    setLauncherError(null);
  }, [settingsOpen, launcherSettings]);

  async function toggleAutostart() {
    if (!autostart?.available) return;
    setSavingAutostart(true);
    try {
      await onAutostartChange(!autostart.enabled);
    } finally {
      setSavingAutostart(false);
    }
  }

  async function saveLaunchers() {
    const error =
      commandValidationError(draftEditor) ??
      commandValidationError(draftTerminal);
    if (error) {
      setLauncherError(error);
      return;
    }

    const editor = {
      ...draftEditor,
      command:
        draftEditor.kind === "custom"
          ? draftEditor.command?.trim() ?? ""
          : null,
    };
    const terminal = {
      ...draftTerminal,
      command:
        draftTerminal.kind === "custom"
          ? draftTerminal.command?.trim() ?? ""
          : null,
    };

    setSavingLaunchers(true);
    setLauncherError(null);
    try {
      await onLauncherSettingsChange(editor, terminal);
    } finally {
      setSavingLaunchers(false);
    }
  }

  const editorOptions = launcherSettings?.availability.editors ?? [];
  const terminalOptions = launcherSettings?.availability.terminals ?? [];
  const selectedEditorOption = findOption(editorOptions, draftEditor.kind);
  const selectedTerminalOption = findOption(
    terminalOptions,
    draftTerminal.kind,
  );
  const editorUnavailable =
    draftEditor.kind !== "auto" &&
    draftEditor.kind !== "custom" &&
    selectedEditorOption?.available === false;
  const terminalUnavailable =
    draftTerminal.kind !== "auto" &&
    draftTerminal.kind !== "custom" &&
    selectedTerminalOption?.available === false;

  return (
    <header className="app-header">
      <div className="brand">
        <div className="brand-mark" aria-hidden="true">
          <FolderIcon width={26} height={26} />
        </div>
        <div>
          <h1>{strings.appTitle}</h1>
          <p className="subtitle">{strings.tagline}</p>
        </div>
      </div>

      <div className="header-actions">
        {view === "archived" ? (
          <button type="button" className="button button-ghost" onClick={onShowActive}>
            <ChevronLeftIcon />
            {strings.backToProjects}
          </button>
        ) : (
          <>
            <button type="button" className="button button-primary" onClick={onNewProject}>
              <PlusIcon />
              {strings.newProject}
            </button>
            <button
              type="button"
              className="button button-ghost"
              onClick={onShowArchived}
              aria-label={`${strings.archived} (${archivedCount})`}
            >
              <ArchiveIcon />
              {strings.archived}
              <span className="count-badge">{archivedCount}</span>
            </button>
          </>
        )}

        <div className="settings" ref={settingsRef}>
          <button
            type="button"
            className="icon-button"
            aria-label={strings.settings}
            aria-haspopup="true"
            aria-expanded={settingsOpen}
            onClick={() => setSettingsOpen((open) => !open)}
          >
            <SettingsIcon />
          </button>

          {settingsOpen ? (
            <div className="settings-panel" role="dialog" aria-label={strings.settings}>
              <div className="settings-section">
                <p className="settings-title">{strings.settings}</p>
                <label className="settings-toggle">
                  <input
                    type="checkbox"
                    checked={autostart?.enabled ?? false}
                    disabled={
                      !autostart?.available || autostart.devMode || savingAutostart
                    }
                    onChange={() => void toggleAutostart()}
                  />
                  <span>
                    <strong>{strings.autostart}</strong>
                    <small>{strings.autostartHint}</small>
                  </span>
                </label>
                {autostart?.devMode ? (
                  <p className="settings-note">{strings.autostartDev}</p>
                ) : null}
                {autostart && !autostart.available && !autostart.devMode ? (
                  <p className="settings-note">{strings.autostartDev}</p>
                ) : null}
              </div>

              <div className="settings-section">
                <p className="settings-title">{strings.settingsLaunchTitle}</p>
                <p className="settings-note">{strings.settingsLaunchHint}</p>

                <label className="settings-field">
                  <span>{strings.editorDefault}</span>
                  <select
                    value={draftEditor.kind}
                    onChange={(event) =>
                      setDraftEditor(
                        editorChoiceForSelect(event.target.value) ?? {
                          kind: "auto",
                          command: null,
                        },
                      )
                    }
                  >
                    <option value="auto">{strings.automatic}</option>
                    {editorKinds
                      .filter((kind) => kind !== "auto" && kind !== "custom")
                      .map((kind) => (
                        <option key={kind} value={kind}>
                          {optionLabel(
                            editorLabels[kind],
                            findOption(editorOptions, kind),
                          )}
                        </option>
                      ))}
                    <option value="custom">{strings.custom}</option>
                  </select>
                </label>

                {draftEditor.kind === "custom" ? (
                  <label className="settings-field">
                    <span>{strings.customCommand}</span>
                    <input
                      value={draftEditor.command ?? ""}
                      onChange={(event) =>
                        setDraftEditor({
                          ...draftEditor,
                          command: event.target.value,
                        })
                      }
                      placeholder="mi-editor --open {path}"
                      aria-label={strings.customCommand}
                      spellCheck={false}
                    />
                    <small className="field-hint">
                      {strings.customCommandHint}
                    </small>
                  </label>
                ) : null}
                {editorUnavailable ? (
                  <p className="settings-note warning">
                    {strings.launchEditorUnavailable}
                  </p>
                ) : null}

                <label className="settings-field">
                  <span>{strings.terminalDefault}</span>
                  <select
                    value={draftTerminal.kind}
                    onChange={(event) =>
                      setDraftTerminal(
                        terminalChoiceForSelect(event.target.value) ?? {
                          kind: "auto",
                          command: null,
                        },
                      )
                    }
                  >
                    <option value="auto">{strings.automatic}</option>
                    {terminalKinds
                      .filter((kind) => kind !== "auto" && kind !== "custom")
                      .map((kind) => (
                        <option key={kind} value={kind}>
                          {optionLabel(
                            terminalLabels[kind],
                            findOption(terminalOptions, kind),
                          )}
                        </option>
                      ))}
                    <option value="custom">{strings.custom}</option>
                  </select>
                </label>

                {draftTerminal.kind === "custom" ? (
                  <label className="settings-field">
                    <span>{strings.customCommand}</span>
                    <input
                      value={draftTerminal.command ?? ""}
                      onChange={(event) =>
                        setDraftTerminal({
                          ...draftTerminal,
                          command: event.target.value,
                        })
                      }
                      placeholder="mi-terminal --cwd {path}"
                      aria-label={strings.customCommand}
                      spellCheck={false}
                    />
                    <small className="field-hint">
                      {strings.customCommandHint}
                    </small>
                  </label>
                ) : null}
                {terminalUnavailable ? (
                  <p className="settings-note warning">
                    {strings.launchTerminalUnavailable}
                  </p>
                ) : null}

                {launcherError ? (
                  <p className="settings-error" role="alert">
                    {launcherError}
                  </p>
                ) : null}

                <button
                  type="button"
                  className="button button-primary small settings-save"
                  onClick={() => void saveLaunchers()}
                  disabled={!launcherSettings || savingLaunchers}
                >
                  {savingLaunchers ? strings.savingLaunchers : strings.saveLaunchers}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
