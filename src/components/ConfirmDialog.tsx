import { useEffect, useRef } from "react";
import { strings } from "../i18n/es";
import { AlertIcon } from "./icons";

interface ConfirmDialogProps {
  open: boolean;
  projectName: string;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmDialog({
  open,
  projectName,
  busy,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      previousFocusRef.current = document.activeElement as HTMLElement | null;
      dialog.showModal();
      window.setTimeout(() => cancelRef.current?.focus(), 0);
    } else if (!open && dialog.open) {
      dialog.close();
    }

    if (!open) {
      previousFocusRef.current?.focus();
    }
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className="modal confirm-dialog"
      aria-labelledby="confirm-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onCancel();
      }}
    >
      <div className="modal-header">
        <div className="confirm-heading">
          <span className="confirm-icon" aria-hidden="true">
            <AlertIcon />
          </span>
          <div>
            <h2 id="confirm-title">{strings.deleteTitle}</h2>
            <p>{strings.deleteBody}</p>
          </div>
        </div>
      </div>

      <div className="modal-body">
        <p className="confirm-project">{projectName}</p>
      </div>

      <div className="modal-footer">
        <button
          ref={cancelRef}
          type="button"
          className="button button-ghost"
          onClick={onCancel}
          disabled={busy}
        >
          {strings.cancel}
        </button>
        <button
          type="button"
          className="button button-danger"
          onClick={onConfirm}
          disabled={busy}
        >
          {busy ? strings.deleting : strings.deleteConfirm}
        </button>
      </div>
    </dialog>
  );
}
