import { strings } from "../i18n/es";
import { ArchiveIcon, FolderIcon, PlusIcon } from "./icons";

interface EmptyStateProps {
  mode: "active" | "archived";
  archivedCount: number;
  onNewProject: () => void;
  onShowArchived: () => void;
}

export function EmptyState({
  mode,
  archivedCount,
  onNewProject,
  onShowArchived,
}: EmptyStateProps) {
  if (mode === "archived") {
    return (
      <section className="empty-state" aria-label={strings.archivedProjects}>
        <div className="empty-card">
          <div className="empty-icon" aria-hidden="true">
            <ArchiveIcon width={30} height={30} />
          </div>
          <h2>{strings.noArchivedTitle}</h2>
          <p>{strings.noArchivedBody}</p>
        </div>
      </section>
    );
  }

  return (
    <section className="empty-state" aria-label={strings.activeProjects}>
      <div className="empty-card">
        <div className="empty-icon" aria-hidden="true">
          <FolderIcon width={30} height={30} />
        </div>
        <h2>{strings.noActiveTitle}</h2>
        <p>{strings.noActiveBody}</p>
        <button type="button" className="button button-primary" onClick={onNewProject}>
          <PlusIcon />
          {strings.createFirstProject}
        </button>
        {archivedCount > 0 ? (
          <button type="button" className="link-button" onClick={onShowArchived}>
            {strings.openArchived}
          </button>
        ) : null}
      </div>
    </section>
  );
}
