import { useState, type CSSProperties } from "react";
import { coverUrl, initials, toneFor } from "../lib/cover";
import { strings } from "../i18n/es";
import type { Project } from "../types";
import { MoreIcon } from "./icons";

interface ProjectCardProps {
  project: Project;
  dataDir: string;
  menuOpen: boolean;
  onOpenMenu: (project: Project, anchor: DOMRect) => void;
}

export function ProjectCard({
  project,
  dataDir,
  menuOpen,
  onOpenMenu,
}: ProjectCardProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const url = coverUrl(dataDir, project.cover);
  const tone = toneFor(project.id);
  const showImage = Boolean(url) && !imageFailed;

  return (
    <button
      type="button"
      className="project-card"
      aria-haspopup="menu"
      aria-expanded={menuOpen}
      aria-label={`${strings.menuLabel}: ${project.name}`}
      onClick={(event) =>
        onOpenMenu(project, event.currentTarget.getBoundingClientRect())
      }
    >
      <span className="project-cover-wrap">
        {showImage ? (
          <img
            className="project-cover"
            src={url ?? undefined}
            alt={strings.coverPreviewAlt(project.name)}
            loading="lazy"
            onError={() => setImageFailed(true)}
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
        <span className="card-more" aria-hidden="true">
          <MoreIcon />
        </span>
      </span>

      <span className="project-body">
        <span className="project-name">{project.name}</span>
        <span
          className={`project-path ${project.path ? "" : "project-path-empty"}`}
          title={project.path ?? strings.noPath}
        >
          {project.path ?? strings.noPath}
        </span>
      </span>
    </button>
  );
}
