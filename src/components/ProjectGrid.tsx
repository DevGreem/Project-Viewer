import { strings } from "../i18n/es";
import type { Project } from "../types";
import { ProjectCard } from "./ProjectCard";

interface ProjectGridProps {
  projects: Project[];
  dataDir: string;
  openMenuProjectId: string | null;
  onOpenMenu: (project: Project, anchor: DOMRect) => void;
}

export function ProjectGrid({
  projects,
  dataDir,
  openMenuProjectId,
  onOpenMenu,
}: ProjectGridProps) {
  const active = projects
    .filter((project) => project.status === "active")
    .sort((left, right) => right.updatedAt - left.updatedAt);

  return (
    <section className="project-grid" aria-label={strings.activeProjects}>
      {active.map((project) => (
        <ProjectCard
          key={project.id}
          project={project}
          dataDir={dataDir}
          menuOpen={openMenuProjectId === project.id}
          onOpenMenu={onOpenMenu}
        />
      ))}
    </section>
  );
}
