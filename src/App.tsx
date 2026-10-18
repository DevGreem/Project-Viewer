import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  archiveProject,
  createProject,
  deleteProject,
  openProjectAction,
  restoreProject,
  setAutostartEnabled,
  updateProject,
} from "./api";
import { strings } from "./i18n/es";
import { errorMessage } from "./lib/errors";
import type {
  Project,
  ProjectAction,
  ProjectInput,
  ToastKind,
  ToastMessage,
} from "./types";
import { useActionAvailability } from "./hooks/useActionAvailability";
import { useAutostart } from "./hooks/useAutostart";
import { useCatalog } from "./hooks/useCatalog";
import { ActionMenu } from "./components/ActionMenu";
import { ArchivedView } from "./components/ArchivedView";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { EmptyState } from "./components/EmptyState";
import { Header } from "./components/Header";
import { ProjectFormModal } from "./components/ProjectFormModal";
import { ProjectGrid } from "./components/ProjectGrid";
import { Toast } from "./components/Toast";
import { AlertIcon, FolderIcon } from "./components/icons";
import "./App.css";

type View = "active" | "archived";

type ModalState =
  | { mode: "create" }
  | { mode: "edit"; project: Project }
  | null;

export default function App() {
  const { catalog, loading, error, reload, setCatalog } = useCatalog();
  const availability = useActionAvailability();
  const { autostart, setAutostart } = useAutostart();

  const [view, setView] = useState<View>("active");
  const [modal, setModal] = useState<ModalState>(null);
  const [menu, setMenu] = useState<{
    project: Project;
    anchor: DOMRect;
  } | null>(null);
  const [confirmProject, setConfirmProject] = useState<Project | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const toastId = useRef(0);
  const shownWarning = useRef<string | null>(null);

  const showToast = useCallback((kind: ToastKind, message: string) => {
    toastId.current += 1;
    setToast({ id: toastId.current, kind, message });
  }, []);

  const activeProjects = useMemo(
    () => catalog?.projects.filter((project) => project.status === "active") ?? [],
    [catalog],
  );
  const archivedProjects = useMemo(
    () =>
      catalog?.projects.filter((project) => project.status === "archived") ?? [],
    [catalog],
  );

  useEffect(() => {
    if (!catalog?.warning || shownWarning.current === catalog.warning) return;
    shownWarning.current = catalog.warning;
    showToast("info", strings.catalogWarning);
  }, [catalog?.warning, showToast]);

  useEffect(() => {
    setMenu(null);
  }, [view]);

  const handleCreate = useCallback(
    async (input: ProjectInput) => {
      const next = await createProject(input);
      setCatalog(next);
      showToast("success", strings.projectCreated);
    },
    [setCatalog, showToast],
  );

  const handleUpdate = useCallback(
    async (projectId: string, input: ProjectInput) => {
      const next = await updateProject(projectId, input);
      setCatalog(next);
      showToast("success", strings.projectUpdated);
    },
    [setCatalog, showToast],
  );

  const handleArchive = useCallback(
    async (project: Project) => {
      setMenu(null);
      try {
        const next = await archiveProject(project.id);
        setCatalog(next);
        showToast("success", strings.projectArchived);
      } catch (caught) {
        showToast("error", errorMessage(caught));
      }
    },
    [setCatalog, showToast],
  );

  const handleRestore = useCallback(
    async (project: Project) => {
      try {
        const next = await restoreProject(project.id);
        setCatalog(next);
        showToast("success", strings.projectRestored);
      } catch (caught) {
        showToast("error", errorMessage(caught));
      }
    },
    [setCatalog, showToast],
  );

  const handleConfirmDelete = useCallback(async () => {
    if (!confirmProject) return;
    setDeleteBusy(true);
    try {
      const next = await deleteProject(confirmProject.id);
      setCatalog(next);
      setConfirmProject(null);
      showToast("success", strings.projectDeleted);
    } catch (caught) {
      showToast("error", errorMessage(caught));
    } finally {
      setDeleteBusy(false);
    }
  }, [confirmProject, setCatalog, showToast]);

  const handleAction = useCallback(
    async (project: Project, action: ProjectAction) => {
      setMenu(null);
      try {
        await openProjectAction(project.id, action);
      } catch (caught) {
        showToast("error", errorMessage(caught));
      }
    },
    [showToast],
  );

  const handleAutostartChange = useCallback(
    async (enabled: boolean) => {
      try {
        const next = await setAutostartEnabled(enabled);
        setAutostart(next);
        showToast(
          "success",
          enabled ? strings.autostartEnabled : strings.autostartDisabled,
        );
      } catch (caught) {
        showToast("error", errorMessage(caught));
      }
    },
    [setAutostart, showToast],
  );

  const header = (
    <Header
      view={view}
      archivedCount={archivedProjects.length}
      onNewProject={() => setModal({ mode: "create" })}
      onShowActive={() => setView("active")}
      onShowArchived={() => setView("archived")}
      autostart={autostart}
      onAutostartChange={handleAutostartChange}
    />
  );

  if (loading && !catalog) {
    return (
      <div className="app-shell">
        {header}
        <main className="app-main">
          <div className="loading-state" role="status">
            <span className="spinner" aria-hidden="true" />
            <p>{strings.loading}</p>
          </div>
        </main>
      </div>
    );
  }

  if (error && !catalog) {
    return (
      <div className="app-shell">
        {header}
        <main className="app-main">
          <section className="empty-state">
            <div className="empty-card">
              <div className="empty-icon error" aria-hidden="true">
                <AlertIcon width={30} height={30} />
              </div>
              <h2>{strings.loadError}</h2>
              <p>{errorMessage(error)}</p>
              <button type="button" className="button button-primary" onClick={() => void reload()}>
                {strings.retry}
              </button>
            </div>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="app-shell">
      {header}

      <main className="app-main">
        {view === "archived" ? (
          <ArchivedView
            projects={catalog?.projects ?? []}
            dataDir={catalog?.dataDir ?? ""}
            onRestore={(project) => void handleRestore(project)}
            onDelete={(project) => setConfirmProject(project)}
          />
        ) : null}

        {view === "active" && activeProjects.length === 0 ? (
          <EmptyState
            mode="active"
            archivedCount={archivedProjects.length}
            onNewProject={() => setModal({ mode: "create" })}
            onShowArchived={() => setView("archived")}
          />
        ) : null}

        {view === "active" && activeProjects.length > 0 ? (
          <ProjectGrid
            projects={catalog?.projects ?? []}
            dataDir={catalog?.dataDir ?? ""}
            openMenuProjectId={menu?.project.id ?? null}
            onOpenMenu={(project, anchor) => setMenu({ project, anchor })}
          />
        ) : null}
      </main>

      {menu ? (
        <ActionMenu
          project={menu.project}
          anchor={menu.anchor}
          availability={availability}
          onClose={() => setMenu(null)}
          onEdit={() => {
            setMenu(null);
            setModal({ mode: "edit", project: menu.project });
          }}
          onArchive={() => void handleArchive(menu.project)}
          onAction={(action) => void handleAction(menu.project, action)}
        />
      ) : null}

      <ProjectFormModal
        open={modal !== null}
        project={modal?.mode === "edit" ? modal.project : null}
        dataDir={catalog?.dataDir ?? ""}
        onClose={() => setModal(null)}
        onCreate={handleCreate}
        onUpdate={handleUpdate}
      />

      <ConfirmDialog
        open={confirmProject !== null}
        projectName={confirmProject?.name ?? ""}
        busy={deleteBusy}
        onCancel={() => {
          if (!deleteBusy) setConfirmProject(null);
        }}
        onConfirm={() => void handleConfirmDelete()}
      />

      {toast ? (
        <Toast toast={toast} onClose={() => setToast(null)} />
      ) : null}

      <footer className="app-footer">
        <span className="footer-mark" aria-hidden="true">
          <FolderIcon width={14} height={14} />
        </span>
        <span>{strings.projectCount(activeProjects.length)}</span>
        <span className="footer-dot" aria-hidden="true" />
        <span>{strings.archivedCount(archivedProjects.length)}</span>
      </footer>
    </div>
  );
}
