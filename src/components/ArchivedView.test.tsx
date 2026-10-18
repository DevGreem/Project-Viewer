import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ArchivedView } from "./ArchivedView";
import { makeProject } from "../test/fixtures";

describe("ArchivedView", () => {
  it("lists archived projects and lets the user restore or delete them", async () => {
    const user = userEvent.setup();
    const project = makeProject({
      id: "archived-1",
      name: "Archived project",
      status: "archived",
      archivedAt: 3_000,
    });
    const onRestore = vi.fn();
    const onDelete = vi.fn();

    render(
      <ArchivedView
        projects={[project]}
        dataDir="/data"
        onRestore={onRestore}
        onDelete={onDelete}
      />,
    );

    expect(screen.getByText("Archived project")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Restaurar" }));
    expect(onRestore).toHaveBeenCalledWith(project);

    await user.click(screen.getByRole("button", { name: "Eliminar" }));
    expect(onDelete).toHaveBeenCalledWith(project);
  });

  it("shows the empty archived state", () => {
    render(
      <ArchivedView
        projects={[]}
        dataDir="/data"
        onRestore={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByText("No hay proyectos archivados")).toBeInTheDocument();
  });
});
