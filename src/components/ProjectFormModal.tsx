import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
} from "react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { discardCover, stageCover } from "../api";
import { strings } from "../i18n/es";
import { coverUrl, initials, toneFor } from "../lib/cover";
import { errorMessage } from "../lib/errors";
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
  EditorChoice,
  LauncherSettingsView,
  Project,
  ProjectInput,
  TerminalChoice,
} from "../types";
import { CloseIcon, FolderIcon, ImageIcon } from "./icons";

interface ProjectFormModalProps {
  open: boolean;
  project: Project | null;
  dataDir: string;
  launcherSettings: LauncherSettingsView | null;
  onClose: () => void;
  onCreate: (input: ProjectInput) => Promise<void>;
  onUpdate: (projectId: string, input: ProjectInput) => Promise<void>;
}

function optionLabel(label: string, available: boolean | undefined) {
  return available === false ? `${label} (${strings.notDetected})` : label;
}

function normalizeEditor(choice: EditorChoice | null): EditorChoice | null {
  if (!choice) return null;
  return {
    kind: choice.kind,
    command:
      choice.kind === "custom" ? choice.command?.trim() ?? "" : null,
  };
}

function normalizeTerminal(choice: TerminalChoice | null): TerminalChoice | null {
  if (!choice) return null;
  return {
    kind: choice.kind,
    command:
      choice.kind === "custom" ? choice.command?.trim() ?? "" : null,
  };
}

export function ProjectFormModal({
  open,
  project,
  dataDir,
  launcherSettings,
  onClose,
  onCreate,
  onUpdate,
}: ProjectFormModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const [name, setName] = useState("");
  const [path, setPath] = useState("");
  const [stagedCover, setStagedCover] = useState<string | null>(null);
  const [removeCover, setRemoveCover] = useState(false);
  const [editorChoice, setEditorChoice] = useState<EditorChoice | null>(null);
  const [terminalChoice, setTerminalChoice] =
    useState<TerminalChoice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [previewFailed, setPreviewFailed] = useState(false);

  const existingCover = project?.cover ?? null;
  const previewCover = removeCover ? null : stagedCover ?? existingCover;
  const previewUrl = coverUrl(dataDir, previewCover);
  const tone = toneFor(project?.id ?? (name || "new-project"));
  const editorOptions = launcherSettings?.availability.editors ?? [];
  const terminalOptions = launcherSettings?.availability.terminals ?? [];
  const globalEditor = launcherSettings?.defaultEditor ?? {
    kind: "auto" as const,
    command: null,
  };
  const globalTerminal = launcherSettings?.defaultTerminal ?? {
    kind: "auto" as const,
    command: null,
  };
  const editorValue = editorChoice?.kind ?? "inherit";
  const terminalValue = terminalChoice?.kind ?? "inherit";
  const editorUnavailable =
    editorChoice !== null &&
    editorChoice.kind !== "auto" &&
    editorChoice.kind !== "custom" &&
    findOption(editorOptions, editorChoice.kind)?.available === false;
  const terminalUnavailable =
    terminalChoice !== null &&
    terminalChoice.kind !== "auto" &&
    terminalChoice.kind !== "custom" &&
    findOption(terminalOptions, terminalChoice.kind)?.available === false;

  useEffect(() => {
    if (!open) return;
    setName(project?.name ?? "");
    setPath(project?.path ?? "");
    setStagedCover(null);
    setRemoveCover(false);
    setEditorChoice(project?.editor ?? null);
    setTerminalChoice(project?.terminal ?? null);
    setError(null);
    setPreviewFailed(false);
  }, [open, project]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      previousFocusRef.current = document.activeElement as HTMLElement | null;
      dialog.showModal();
      window.setTimeout(() => nameRef.current?.focus(), 0);
    } else if (!open && dialog.open) {
      dialog.close();
    }

    if (!open) {
      previousFocusRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    setPreviewFailed(false);
  }, [previewCover]);

  function closeAndDiscard() {
    if (stagedCover) {
      void discardCover(stagedCover).catch(() => undefined);
    }
    setStagedCover(null);
    onClose();
  }

  async function chooseFolder() {
    try {
      const selected = await openDialog({
        directory: true,
        multiple: false,
        title: strings.selectFolder,
      });
      if (typeof selected === "string") setPath(selected);
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  async function chooseCover() {
    try {
      const selected = await openDialog({
        multiple: false,
        directory: false,
        title: strings.selectCover,
        filters: [
          {
            name: "Imágenes",
            extensions: ["png", "jpg", "jpeg", "webp", "gif"],
          },
        ],
      });
      if (typeof selected !== "string") return;

      const staged = await stageCover(selected);
      if (stagedCover) {
        void discardCover(stagedCover).catch(() => undefined);
      }
      setStagedCover(staged.path);
      setRemoveCover(false);
      setError(null);
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  function clearCover() {
    if (stagedCover) {
      void discardCover(stagedCover).catch(() => undefined);
      setStagedCover(null);
    }
    setRemoveCover(Boolean(existingCover));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = name.trim();
    const trimmedPath = path.trim();

    if (!trimmedName) {
      setError("El nombre del proyecto es obligatorio.");
      nameRef.current?.focus();
      return;
    }
    if (trimmedPath && !trimmedPath.startsWith("/")) {
      setError("La ruta local debe ser una ruta absoluta.");
      return;
    }

    const launcherError =
      commandValidationError(editorChoice) ??
      commandValidationError(terminalChoice);
    if (launcherError) {
      setError(launcherError);
      return;
    }

    setSaving(true);
    setError(null);

    const input: ProjectInput = {
      name: trimmedName,
      path: trimmedPath || null,
      cover: removeCover ? null : stagedCover ?? existingCover,
      removeCover,
      editor: normalizeEditor(editorChoice),
      terminal: normalizeTerminal(terminalChoice),
    };

    try {
      if (project) {
        await onUpdate(project.id, input);
      } else {
        await onCreate(input);
      }
      setStagedCover(null);
      onClose();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="modal project-form"
      aria-labelledby="project-form-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!saving) closeAndDiscard();
      }}
    >
      <form noValidate onSubmit={(event) => void submit(event)}>
        <div className="modal-header">
          <div>
            <h2 id="project-form-title">
              {project ? strings.editProjectTitle : strings.newProjectTitle}
            </h2>
            <p>{strings.formSubtitle}</p>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label={strings.close}
            onClick={closeAndDiscard}
            disabled={saving}
          >
            <CloseIcon />
          </button>
        </div>

        <div className="modal-body">
          <label className="field">
            <span>{strings.nameLabel}</span>
            <input
              ref={nameRef}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={strings.namePlaceholder}
              aria-label={strings.nameLabel}
              maxLength={80}
              autoComplete="off"
              required
            />
          </label>

          <label className="field">
            <span>{strings.pathLabel}</span>
            <div className="input-with-button">
              <input
                value={path}
                onChange={(event) => setPath(event.target.value)}
                placeholder={strings.pathPlaceholder}
                aria-label={strings.pathLabel}
                autoComplete="off"
                spellCheck={false}
              />
              <button
                type="button"
                className="button button-ghost small"
                onClick={() => void chooseFolder()}
              >
                <FolderIcon />
                {strings.chooseFolder}
              </button>
            </div>
            <small className="field-hint">{strings.pathHint}</small>
          </label>

          <div className="field">
            <span>{strings.coverLabel}</span>
            <div className="cover-editor">
              <div className="cover-editor-preview">
                {previewUrl && !previewFailed ? (
                  <img
                    src={previewUrl}
                    alt={strings.coverPreviewAlt(project?.name ?? (name || "proyecto"))}
                    onError={() => setPreviewFailed(true)}
                  />
                ) : (
                  <span
                    className="cover-editor-placeholder"
                    style={
                      {
                        "--tone-a": tone.from,
                        "--tone-b": tone.to,
                      } as CSSProperties
                    }
                    aria-hidden="true"
                  >
                    {initials(name || "Nuevo proyecto")}
                  </span>
                )}
              </div>
              <div className="cover-editor-actions">
                <button
                  type="button"
                  className="button button-ghost small"
                  onClick={() => void chooseCover()}
                >
                  <ImageIcon />
                  {previewCover ? strings.changeCover : strings.chooseCover}
                </button>
                {previewCover ? (
                  <button
                    type="button"
                    className="link-button"
                    onClick={clearCover}
                  >
                    {strings.removeCover}
                  </button>
                ) : null}
                <small className="field-hint">{strings.coverHint}</small>
              </div>
            </div>
          </div>

          <div className="field launcher-section">
            <span>{strings.launchers}</span>
            <small className="field-hint">{strings.launchersHint}</small>

            <label className="field">
              <span>{strings.editorProject}</span>
              <select
                value={editorValue}
                aria-label={strings.editorProject}
                onChange={(event) => {
                  const next = editorChoiceForSelect(event.target.value);
                  setEditorChoice(next);
                }}
              >
                <option value="inherit">
                  {strings.inheritFrom(editorLabels[globalEditor.kind])}
                </option>
                <option value="auto">{strings.automatic}</option>
                {editorKinds
                  .filter((kind) => kind !== "auto" && kind !== "custom")
                  .map((kind) => (
                    <option key={kind} value={kind}>
                      {optionLabel(
                        editorLabels[kind],
                        findOption(editorOptions, kind)?.available,
                      )}
                    </option>
                  ))}
                <option value="custom">{strings.custom}</option>
              </select>
            </label>
            {editorChoice?.kind === "custom" ? (
              <label className="field">
                <span>{strings.customCommand}</span>
                <input
                  value={editorChoice.command ?? ""}
                  onChange={(event) =>
                    setEditorChoice({
                      ...editorChoice,
                      command: event.target.value,
                    })
                  }
                  placeholder="mi-editor --open {path}"
                  aria-label={`${strings.editorProject}: ${strings.customCommand}`}
                  spellCheck={false}
                />
              </label>
            ) : null}
            {editorUnavailable ? (
              <small className="field-hint warning">
                {strings.launchEditorUnavailable}
              </small>
            ) : null}

            <label className="field">
              <span>{strings.terminalProject}</span>
              <select
                value={terminalValue}
                aria-label={strings.terminalProject}
                onChange={(event) => {
                  const next = terminalChoiceForSelect(event.target.value);
                  setTerminalChoice(next);
                }}
              >
                <option value="inherit">
                  {strings.inheritFrom(terminalLabels[globalTerminal.kind])}
                </option>
                <option value="auto">{strings.automatic}</option>
                {terminalKinds
                  .filter((kind) => kind !== "auto" && kind !== "custom")
                  .map((kind) => (
                    <option key={kind} value={kind}>
                      {optionLabel(
                        terminalLabels[kind],
                        findOption(terminalOptions, kind)?.available,
                      )}
                    </option>
                  ))}
                <option value="custom">{strings.custom}</option>
              </select>
            </label>
            {terminalChoice?.kind === "custom" ? (
              <label className="field">
                <span>{strings.customCommand}</span>
                <input
                  value={terminalChoice.command ?? ""}
                  onChange={(event) =>
                    setTerminalChoice({
                      ...terminalChoice,
                      command: event.target.value,
                    })
                  }
                  placeholder="mi-terminal --cwd {path}"
                  aria-label={`${strings.terminalProject}: ${strings.customCommand}`}
                  spellCheck={false}
                />
              </label>
            ) : null}
            {terminalUnavailable ? (
              <small className="field-hint warning">
                {strings.launchTerminalUnavailable}
              </small>
            ) : null}
            <small className="field-hint">{strings.customCommandHint}</small>
          </div>

          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <div className="modal-footer">
          <button
            type="button"
            className="button button-ghost"
            onClick={closeAndDiscard}
            disabled={saving}
          >
            {strings.cancel}
          </button>
          <button type="submit" className="button button-primary" disabled={saving}>
            {saving ? strings.saving : strings.save}
          </button>
        </div>
      </form>
    </dialog>
  );
}
