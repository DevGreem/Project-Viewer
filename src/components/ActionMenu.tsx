import {
  useEffect,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { strings } from "../i18n/es";
import {
  defaultEditor,
  defaultTerminal,
  effectiveEditor,
  effectiveTerminal,
  emptyAvailability,
} from "../lib/launchers";
import type {
  LauncherSettingsView,
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
  launcherSettings: LauncherSettingsView | null;
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
  launcherSettings,
  onClose,
  onEdit,
  onArchive,
  onAction,
}: ActionMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const availability = launcherSettings?.availability ?? emptyAvailability;
  const editor = effectiveEditor(
    project.editor,
    launcherSettings?.defaultEditor ?? defaultEditor,
    availability,
  );
  const terminal = effectiveTerminal(
    project.terminal,
    launcherSettings?.defaultTerminal ?? defaultTerminal,
    availability,
  );
  const hasPath = Boolean(project.path);
  const folderDisabled = !hasPath || !availability.folder;
  const editorDisabled = !hasPath || !editor.available;
  const terminalDisabled = !hasPath || !terminal.available;

  const left = clamp(anchor.left, 8, Math.max(8, window.innerWidth - 272));
  const top = clamp(
    anchor.bottom + 8,
    8,
    Math.max(8, window.innerHeight - 350),
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

  function disabledTitle(available: boolean, unavailableMessage: string) {
    if (!hasPath) return strings.noPathTooltip;
    if (!available) return unavailableMessage;
    return undefined;
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
          disabledTitle(availability.folder, strings.noToolTooltip) ??
          strings.openFolder
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
        disabled={editorDisabled}
        title={
          disabledTitle(
            editor.available,
            strings.launchEditorUnavailable,
          ) ?? strings.openEditor(editor.label)
        }
        onClick={() => run("editor")}
      >
        <CodeIcon />
        {strings.openEditor(editor.label)}
      </button>

      <button
        type="button"
        role="menuitem"
        className="menu-item"
        disabled={terminalDisabled}
        title={
          disabledTitle(
            terminal.available,
            strings.launchTerminalUnavailable,
          ) ?? strings.openTerminal(terminal.label)
        }
        onClick={() => run("terminal")}
      >
        <TerminalIcon />
        {strings.openTerminal(terminal.label)}
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
