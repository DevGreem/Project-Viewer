import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProjectGrid } from "../components/ProjectGrid";
import { makeCatalog, makeProject } from "../test/fixtures";

describe("ProjectGrid", () => {
  it("renders only active projects in recent-first order", () => {
    const projects = [
      makeProject({ id: "old", name: "Old project", updatedAt: 1_000 }),
      makeProject({ id: "new", name: "New project", updatedAt: 3_000 }),
      makeProject({
        id: "archived",
        name: "Archived project",
        status: "archived",
        archivedAt: 4_000,
      }),
    ];
    const catalog = makeCatalog(projects);

    render(
      <ProjectGrid
        projects={catalog.projects}
        dataDir={catalog.dataDir}
        openMenuProjectId={null}
        onOpenMenu={vi.fn()}
      />,
    );

    const cards = screen.getAllByRole("button", {
      name: /Acciones del proyecto/,
    });
    expect(cards).toHaveLength(2);
    expect(cards[0]).toHaveAccessibleName(/New project/);
    expect(cards[1]).toHaveAccessibleName(/Old project/);
    expect(screen.queryByText("Archived project")).not.toBeInTheDocument();
  });

  it("shows initials and a truncated path when there is no cover", () => {
    render(
      <ProjectGrid
        projects={[
          makeProject({
            name: "Project One",
            path: "/home/ian/a/very/long/path/to/a/project",
          }),
        ]}
        dataDir="/data"
        openMenuProjectId={null}
        onOpenMenu={vi.fn()}
      />,
    );

    expect(screen.getByText("PO")).toBeInTheDocument();
    expect(
      screen.getByTitle("/home/ian/a/very/long/path/to/a/project"),
    ).toBeInTheDocument();
  });

  it("shows the no-path label", () => {
    render(
      <ProjectGrid
        projects={[makeProject({ path: null })]}
        dataDir="/data"
        openMenuProjectId={null}
        onOpenMenu={vi.fn()}
      />,
    );

    expect(screen.getByText("Sin ruta")).toBeInTheDocument();
  });
});
