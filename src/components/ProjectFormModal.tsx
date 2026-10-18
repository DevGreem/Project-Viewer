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
import type { Project, ProjectInput } from "../types";
import { CloseIcon, FolderIcon, ImageIcon } from "./icons";

interface ProjectFormModalProps {
  open: boolean;
  project: Project | null;
  dataDir: string;
  onClose: () => void;
  onCreate: (input: ProjectInput) => Promise<void>;
  onUpdate: (projectId: string, input: ProjectInput) => Promise<void>;
}

export function ProjectFormModal({
  open,
  project,
  dataDir,
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
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [previewFailed, setPreviewFailed] = useState(false);

  const existingCover = project?.cover ?? null;
  const previewCover = removeCover ? null : stagedCover ?? existingCover;
  const previewUrl = coverUrl(dataDir, previewCover);
  const tone = toneFor(project?.id ?? (name || "new-project"));

  useEffect(() => {
    if (!open) return;
    setName(project?.name ?? "");
    setPath(project?.path ?? "");
    setStagedCover(null);
    setRemoveCover(false);
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

    setSaving(true);
    setError(null);

    const input: ProjectInput = {
      name: trimmedName,
      path: trimmedPath || null,
      cover: removeCover ? null : stagedCover ?? existingCover,
      removeCover,
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
