import { useEffect, useRef, useState } from "react";
import { strings } from "../i18n/es";
import type { AutostartState } from "../types";
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
}

export function Header({
  view,
  archivedCount,
  onNewProject,
  onShowActive,
  onShowArchived,
  autostart,
  onAutostartChange,
}: HeaderProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [savingAutostart, setSavingAutostart] = useState(false);
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

  async function toggleAutostart() {
    if (!autostart?.available) return;
    setSavingAutostart(true);
    try {
      await onAutostartChange(!autostart.enabled);
    } finally {
      setSavingAutostart(false);
    }
  }

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
          ) : null}
        </div>
      </div>
    </header>
  );
}
