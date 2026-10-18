import type { CSSProperties } from "react";
import { coverUrl, initials, toneFor } from "../lib/cover";
import { strings } from "../i18n/es";
import type { Project } from "../types";
import { RestoreIcon, TrashIcon } from "./icons";

interface ArchivedViewProps {
  projects: Project[];
  dataDir: string;
  onRestore: (project: Project) => void;
  onDelete: (project: Project) => void;
}

export function ArchivedView({
  projects,
  dataDir,
  onRestore,
  onDelete,
}: ArchivedViewProps) {
  const archived = projects
    .filter((project) => project.status === "archived")
    .sort((left, right) => right.updatedAt - left.updatedAt);

  return (
    <section className="archived-view" aria-label={strings.archivedProjects}>
      <div className="section-heading">
        <div>
          <h2>{strings.archivedProjects}</h2>
          <p>{strings.archivedCount(archived.length)}</p>
        </div>
      </div>

      {archived.length === 0 ? (
        <div className="empty-card compact">
          <div className="empty-icon" aria-hidden="true">
            <RestoreIcon width={28} height={28} />
          </div>
          <h3>{strings.noArchivedTitle}</h3>
          <p>{strings.noArchivedBody}</p>
        </div>
      ) : (
        <div className="archived-grid">
          {archived.map((project) => {
            const url = coverUrl(dataDir, project.cover);
            const tone = toneFor(project.id);
            return (
              <article className="archived-card" key={project.id}>
                <div className="archived-cover-wrap">
                  {url ? (
                    <img
                      className="project-cover"
                      src={url}
                      alt={strings.coverPreviewAlt(project.name)}
                      loading="lazy"
                    />
                  ) : (
                    <span
                      className="project-placeholder"
                      style={
                        {
                          "--tone-a": tone.from,
                          "--tone-b": tone.to,
                        } as CSSProperties
                      }
                      aria-hidden="true"
                    >
                      {initials(project.name)}
                    </span>
                  )}
                </div>
                <div className="archived-body">
                  <h3>{project.name}</h3>
                  <p className="project-path" title={project.path ?? strings.noPath}>
                    {project.path ?? strings.noPath}
                  </p>
                  <div className="archived-actions">
                    <button
                      type="button"
                      className="button button-ghost small"
                      onClick={() => onRestore(project)}
                    >
                      <RestoreIcon />
                      {strings.restore}
                    </button>
                    <button
                      type="button"
                      className="button button-danger small"
                      onClick={() => onDelete(project)}
                    >
                      <TrashIcon />
                      {strings.delete}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
