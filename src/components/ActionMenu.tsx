import {
  useEffect,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { strings } from "../i18n/es";
import type {
  ActionAvailability,
  Project,
  ProjectAction,
} from "../types";
import {
  ArchiveIcon,
  CodeIcon,
  EditIcon,
  FolderIcon,
  TerminalIcon,
} from "./icons";

interface ActionMenuProps {
  project: Project;
  anchor: DOMRect;
  availability: ActionAvailability;
  onClose: () => void;
  onEdit: () => void;
  onArchive: () => void;
  onAction: (action: ProjectAction) => void;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(value, max));
}

export function ActionMenu({
  project,
  anchor,
  availability,
  onClose,
  onEdit,
  onArchive,
  onAction,
}: ActionMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const hasPath = Boolean(project.path);
  const folderDisabled = !hasPath || !availability.folder;
  const vscodeDisabled = !hasPath || !availability.vscode;
  const terminalDisabled = !hasPath || !availability.terminal;

  const left = clamp(anchor.left, 8, Math.max(8, window.innerWidth - 272));
  const top = clamp(
    anchor.bottom + 8,
    8,
    Math.max(8, window.innerHeight - 338),
  );

  useEffect(() => {
    const first = menuRef.current?.querySelector<HTMLButtonElement>(
      '[role="menuitem"]:not(:disabled)',
    );
    first?.focus();

    const closeOnOutside = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) onClose();
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };

    document.addEventListener("mousedown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    window.addEventListener("resize", onClose);
    window.addEventListener("scroll", onClose, true);
    return () => {
      document.removeEventListener("mousedown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("resize", onClose);
      window.removeEventListener("scroll", onClose, true);
    };
  }, [onClose]);

  function handleMenuKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();

    const items = Array.from(
      menuRef.current?.querySelectorAll<HTMLButtonElement>(
        '[role="menuitem"]:not(:disabled)',
      ) ?? [],
    );
    if (items.length === 0) return;

    const currentIndex = items.indexOf(document.activeElement as HTMLButtonElement);
    let nextIndex = currentIndex;

    if (event.key === "ArrowDown") nextIndex = (currentIndex + 1) % items.length;
    if (event.key === "ArrowUp") {
      nextIndex = (currentIndex - 1 + items.length) % items.length;
    }
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = items.length - 1;

    items[nextIndex]?.focus();
  }

  function run(action: ProjectAction) {
    onAction(action);
    onClose();
  }

  function withoutPathTitle(base: string) {
    return hasPath ? base : strings.noPathTooltip;
  }

  function withoutToolTitle(base: string) {
    return hasPath ? base : strings.noPathTooltip;
  }

  return createPortal(
    <div
      className="action-menu"
      style={{ left, top }}
      role="menu"
      aria-label={`${strings.menuLabel}: ${project.name}`}
      ref={menuRef}
      onKeyDown={handleMenuKeyDown}
    >
      <p className="action-menu-title">{project.name}</p>

      <button
        type="button"
        role="menuitem"
        className="menu-item"
        disabled={folderDisabled}
        title={
          !hasPath
            ? withoutPathTitle(strings.openFolder)
            : !availability.folder
              ? strings.noToolTooltip
              : strings.openFolder
        }
        onClick={() => run("folder")}
      >
        <FolderIcon />
        {strings.openFolder}
      </button>

      <button
        type="button"
        role="menuitem"
        className="menu-item"
        disabled={vscodeDisabled}
        title={
          !hasPath
            ? withoutToolTitle(strings.openVscode)
            : !availability.vscode
              ? strings.noToolTooltip
              : strings.openVscode
        }
        onClick={() => run("vscode")}
      >
        <CodeIcon />
        {strings.openVscode}
      </button>

      <button
        type="button"
        role="menuitem"
        className="menu-item"
        disabled={terminalDisabled}
        title={
          !hasPath
            ? withoutToolTitle(strings.openTerminal)
            : !availability.terminal
              ? strings.noToolTooltip
              : strings.openTerminal
        }
        onClick={() => run("terminal")}
      >
        <TerminalIcon />
        {strings.openTerminal}
        {availability.terminalName ? (
          <span className="menu-hint">{availability.terminalName}</span>
        ) : null}
      </button>

      <div className="menu-separator" role="separator" />

      <button
        type="button"
        role="menuitem"
        className="menu-item"
        onClick={onEdit}
      >
        <EditIcon />
        {strings.edit}
      </button>

      <button
        type="button"
        role="menuitem"
        className="menu-item menu-item-danger"
        onClick={onArchive}
      >
        <ArchiveIcon />
        {strings.archive}
      </button>
    </div>,
    document.body,
  );
}
