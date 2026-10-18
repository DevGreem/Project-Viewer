import { useEffect } from "react";
import { strings } from "../i18n/es";
import type { ToastMessage } from "../types";
import { AlertIcon, CheckIcon, CloseIcon, InfoIcon } from "./icons";

interface ToastProps {
  toast: ToastMessage;
  onClose: () => void;
}

export function Toast({ toast, onClose }: ToastProps) {
  useEffect(() => {
    const timer = window.setTimeout(onClose, 4800);
    return () => window.clearTimeout(timer);
  }, [toast.id, onClose]);

  const Icon =
    toast.kind === "success"
      ? CheckIcon
      : toast.kind === "error"
        ? AlertIcon
        : InfoIcon;

  return (
    <div
      className={`toast toast-${toast.kind}`}
      role="status"
      aria-live="polite"
    >
      <span className="toast-icon" aria-hidden="true">
        <Icon />
      </span>
      <span className="toast-message">{toast.message}</span>
      <button
        type="button"
        className="icon-button toast-close"
        aria-label={strings.close}
        onClick={onClose}
      >
        <CloseIcon />
      </button>
    </div>
  );
}
