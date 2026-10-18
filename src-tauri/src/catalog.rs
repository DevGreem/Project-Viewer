use crate::error::{AppError, AppResult};
use crate::launchers::{
    normalize_editor_choice, normalize_terminal_choice, EditorChoice, TerminalChoice,
};
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};
use uuid::Uuid;

pub const CATALOG_FILE: &str = "projects.json";
pub const COVERS_DIR: &str = "covers";
pub const CATALOG_VERSION: u32 = 1;
pub const MAX_COVER_BYTES: u64 = 5 * 1024 * 1024;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CatalogFile {
    #[serde(default = "default_version")]
    pub version: u32,
    #[serde(default)]
    pub projects: Vec<Project>,
}

impl Default for CatalogFile {
    fn default() -> Self {
        Self {
            version: CATALOG_VERSION,
            projects: Vec::new(),
        }
    }
}

fn default_version() -> u32 {
    CATALOG_VERSION
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ProjectStatus {
    Active,
    Archived,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Project {
    pub id: String,
    pub name: String,
    pub path: Option<String>,
    pub cover: Option<String>,
    pub status: ProjectStatus,
    pub created_at: u64,
    pub updated_at: u64,
    pub archived_at: Option<u64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub editor: Option<EditorChoice>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub terminal: Option<TerminalChoice>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectInput {
    pub name: String,
    #[serde(default)]
    pub path: Option<String>,
    #[serde(default)]
    pub cover: Option<String>,
    #[serde(default)]
    pub remove_cover: bool,
    #[serde(default)]
    pub editor: Option<EditorChoice>,
    #[serde(default)]
    pub terminal: Option<TerminalChoice>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CatalogView {
    pub data_dir: String,
    pub projects: Vec<Project>,
    pub warning: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StagedCover {
    pub path: String,
}

pub struct CatalogStore {
    data_dir: PathBuf,
    catalog: CatalogFile,
    warning: Option<String>,
}

impl CatalogStore {
    pub fn load(data_dir: PathBuf) -> AppResult<Self> {
        fs::create_dir_all(&data_dir).map_err(|error| {
            AppError::catalog_read_failed(format!("Could not create the data directory: {error}"))
        })?;
        fs::create_dir_all(data_dir.join(COVERS_DIR)).map_err(|error| {
            AppError::catalog_read_failed(format!("Could not create the covers directory: {error}"))
        })?;

        let catalog_path = data_dir.join(CATALOG_FILE);
        let mut warning = None;

        let catalog = if catalog_path.exists() {
            match fs::read(&catalog_path) {
                Ok(bytes) => match serde_json::from_slice::<CatalogFile>(&bytes) {
                    Ok(catalog) if catalog.version == CATALOG_VERSION => catalog,
                    Ok(catalog) => {
                        backup_corrupt_catalog(&catalog_path);
                        warning = Some(format!(
                            "Unsupported catalog version {}; started with an empty catalog.",
                            catalog.version
                        ));
                        CatalogFile::default()
                    }
                    Err(error) => {
                        backup_corrupt_catalog(&catalog_path);
                        warning = Some(format!(
                            "The project catalog was corrupt; a backup was kept and an empty catalog was loaded. ({error})"
                        ));
                        CatalogFile::default()
                    }
                },
                Err(error) => {
                    backup_corrupt_catalog(&catalog_path);
                    warning = Some(format!(
                        "The project catalog could not be read; a backup was kept and an empty catalog was loaded. ({error})"
                    ));
                    CatalogFile::default()
                }
            }
        } else {
            CatalogFile::default()
        };

        let store = Self {
            data_dir,
            catalog,
            warning,
        };
        store.cleanup_staged_covers();
        Ok(store)
    }

    pub fn view(&self) -> CatalogView {
        CatalogView {
            data_dir: self.data_dir.display().to_string(),
            projects: self.catalog.projects.clone(),
            warning: self.warning.clone(),
        }
    }

    pub fn project_launchers(
        &self,
        project_id: &str,
    ) -> AppResult<(PathBuf, Option<EditorChoice>, Option<TerminalChoice>)> {
        let project = self
            .catalog
            .projects
            .iter()
            .find(|project| project.id == project_id)
            .ok_or_else(|| AppError::project_not_found(project_id))?;

        let path = project.path.as_ref().ok_or_else(|| {
            AppError::path_unavailable("This project does not have a local path configured")
        })?;

        Ok((
            PathBuf::from(path),
            project.editor.clone(),
            project.terminal.clone(),
        ))
    }

    pub fn create_project(&mut self, input: ProjectInput) -> AppResult<CatalogView> {
        let name = validate_name(&input.name)?;
        let path = validate_path(input.path.as_deref())?;
        validate_unique_path(&self.catalog, path.as_deref(), None)?;

        let id = Uuid::new_v4().to_string();
        let now = now_ms();
        let cover = match input.cover.as_deref() {
            Some(staged) => Some(promote_staged_cover(&self.data_dir, &id, staged, now)?),
            None => None,
        };
        let editor = input.editor.map(normalize_editor_choice).transpose()?;
        let terminal = input.terminal.map(normalize_terminal_choice).transpose()?;

        let project = Project {
            id,
            name,
            path,
            cover: cover.clone(),
            status: ProjectStatus::Active,
            created_at: now,
            updated_at: now,
            archived_at: None,
            editor,
            terminal,
        };

        let previous = self.catalog.clone();
        self.catalog.projects.push(project);

        if let Err(error) = self.save() {
            self.catalog = previous;
            if let Some(cover) = cover {
                let _ = remove_cover_file(&self.data_dir, &cover);
            }
            return Err(error);
        }

        Ok(self.view())
    }

    pub fn update_project(
        &mut self,
        project_id: &str,
        input: ProjectInput,
    ) -> AppResult<CatalogView> {
        let index = self.index_of(project_id)?;
        let existing = self.catalog.projects[index].clone();
        let name = validate_name(&input.name)?;
        let path = validate_path(input.path.as_deref())?;
        validate_unique_path(&self.catalog, path.as_deref(), Some(project_id))?;

        let mut promoted_cover = None;
        let mut old_cover_to_delete = None;

        let cover = if input.remove_cover {
            old_cover_to_delete = existing.cover.clone();
            None
        } else {
            match input.cover.as_deref() {
                Some(cover) if Some(cover) == existing.cover.as_deref() => existing.cover.clone(),
                Some(cover) if is_staged_cover(cover) => {
                    let promoted =
                        promote_staged_cover(&self.data_dir, project_id, cover, now_ms())?;
                    promoted_cover = Some(promoted.clone());
                    old_cover_to_delete = existing.cover.clone();
                    Some(promoted)
                }
                Some(_) => {
                    return Err(AppError::cover_unsupported(
                        "The selected cover is not a staged image for this project",
                    ))
                }
                None => existing.cover.clone(),
            }
        };

        let editor = input.editor.map(normalize_editor_choice).transpose()?;
        let terminal = input.terminal.map(normalize_terminal_choice).transpose()?;

        let updated = Project {
            id: existing.id.clone(),
            name,
            path,
            cover,
            status: existing.status,
            created_at: existing.created_at,
            updated_at: now_ms(),
            archived_at: existing.archived_at,
            editor,
            terminal,
        };

        let previous = self.catalog.clone();
        self.catalog.projects[index] = updated;

        if let Err(error) = self.save() {
            self.catalog = previous;
            if let Some(cover) = promoted_cover {
                let _ = remove_cover_file(&self.data_dir, &cover);
            }
            return Err(error);
        }

        if let Some(old_cover) = old_cover_to_delete {
            if Some(old_cover.as_str()) != self.catalog.projects[index].cover.as_deref() {
                let _ = remove_cover_file(&self.data_dir, &old_cover);
            }
        }

        Ok(self.view())
    }

    pub fn archive_project(&mut self, project_id: &str) -> AppResult<CatalogView> {
        self.change_status(project_id, ProjectStatus::Archived)
    }

    pub fn restore_project(&mut self, project_id: &str) -> AppResult<CatalogView> {
        self.change_status(project_id, ProjectStatus::Active)
    }

    pub fn delete_project(&mut self, project_id: &str) -> AppResult<CatalogView> {
        let index = self.index_of(project_id)?;
        if self.catalog.projects[index].status != ProjectStatus::Archived {
            return Err(AppError::project_not_archived());
        }

        let previous = self.catalog.clone();
        let removed = self.catalog.projects.remove(index);

        if let Err(error) = self.save() {
            self.catalog = previous;
            return Err(error);
        }

        if let Some(cover) = removed.cover {
            let _ = remove_cover_file(&self.data_dir, &cover);
        }

        Ok(self.view())
    }

    pub fn stage_cover(&self, source_path: &str) -> AppResult<StagedCover> {
        let source = Path::new(source_path);
        if !source.is_absolute() {
            return Err(AppError::invalid_path(
                "The cover source path must be absolute",
            ));
        }

        let metadata = fs::metadata(source).map_err(|error| {
            AppError::cover_unsupported(format!("Could not read the selected image: {error}"))
        })?;
        if !metadata.is_file() {
            return Err(AppError::cover_unsupported(
                "The selected cover is not a file",
            ));
        }
        if metadata.len() > MAX_COVER_BYTES {
            return Err(AppError::cover_too_large());
        }

        let extension = detect_image_extension(source)?;
        let covers_dir = self.data_dir.join(COVERS_DIR);
        fs::create_dir_all(&covers_dir)?;

        let filename = format!("staged-{}.{}", Uuid::new_v4(), extension);
        let destination = covers_dir.join(&filename);
        fs::copy(source, &destination).map_err(|error| {
            AppError::cover_unsupported(format!("Could not copy the selected image: {error}"))
        })?;

        Ok(StagedCover {
            path: format!("{COVERS_DIR}/{filename}"),
        })
    }

    pub fn discard_staged_cover(&self, cover_path: &str) -> AppResult<()> {
        if !is_staged_cover(cover_path) {
            return Err(AppError::cover_unsupported(
                "Only staged covers can be discarded",
            ));
        }
        remove_cover_file(&self.data_dir, cover_path)
    }

    fn change_status(&mut self, project_id: &str, status: ProjectStatus) -> AppResult<CatalogView> {
        let index = self.index_of(project_id)?;
        if self.catalog.projects[index].status == status {
            return Ok(self.view());
        }

        let previous = self.catalog.clone();
        let now = now_ms();
        self.catalog.projects[index].status = status;
        self.catalog.projects[index].updated_at = now;
        self.catalog.projects[index].archived_at = match status {
            ProjectStatus::Archived => Some(now),
            ProjectStatus::Active => None,
        };

        if let Err(error) = self.save() {
            self.catalog = previous;
            return Err(error);
        }

        Ok(self.view())
    }

    fn index_of(&self, project_id: &str) -> AppResult<usize> {
        self.catalog
            .projects
            .iter()
            .position(|project| project.id == project_id)
            .ok_or_else(|| AppError::project_not_found(project_id))
    }

    fn save(&self) -> AppResult<()> {
        write_json_atomic(&self.data_dir, CATALOG_FILE, &self.catalog)
    }

    fn cleanup_staged_covers(&self) {
        let covers_dir = self.data_dir.join(COVERS_DIR);
        let Ok(entries) = fs::read_dir(covers_dir) else {
            return;
        };

        for entry in entries.flatten() {
            let name = entry.file_name();
            if name.to_string_lossy().starts_with("staged-") {
                let _ = fs::remove_file(entry.path());
            }
        }
    }
}

pub(crate) fn write_json_atomic<T: Serialize>(
    directory: &Path,
    filename: &str,
    value: &T,
) -> AppResult<()> {
    fs::create_dir_all(directory)?;
    let final_path = directory.join(filename);
    let temp_path = directory.join(format!("{filename}.tmp"));

    if temp_path.exists() {
        fs::remove_file(&temp_path)?;
    }

    let data = serde_json::to_vec_pretty(value)
        .map_err(|error| AppError::internal(format!("Could not serialize data: {error}")))?;

    {
        let mut file = fs::File::create(&temp_path)?;
        file.write_all(&data)?;
        file.sync_all()?;
    }

    if let Err(error) = fs::rename(&temp_path, &final_path) {
        let _ = fs::remove_file(&temp_path);
        return Err(AppError::with_details(
            "INTERNAL",
            "Could not replace the data file atomically",
            error.to_string(),
        ));
    }

    #[cfg(unix)]
    if let Ok(directory_handle) = fs::File::open(directory) {
        let _ = directory_handle.sync_all();
    }

    Ok(())
}

pub(crate) fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or_default()
}

fn validate_name(raw_name: &str) -> AppResult<String> {
    let name = raw_name.trim();
    let length = name.chars().count();
    if length == 0 {
        return Err(AppError::invalid_name("The project name is required"));
    }
    if length > 80 {
        return Err(AppError::invalid_name(
            "The project name must be 80 characters or fewer",
        ));
    }
    Ok(name.to_string())
}

fn validate_path(raw_path: Option<&str>) -> AppResult<Option<String>> {
    let Some(raw_path) = raw_path else {
        return Ok(None);
    };
    let raw_path = raw_path.trim();
    if raw_path.is_empty() {
        return Ok(None);
    }

    let path = PathBuf::from(raw_path);
    if !path.is_absolute() {
        return Err(AppError::invalid_path(
            "The local path must be absolute (for example, /home/user/project)",
        ));
    }

    let metadata = fs::metadata(&path).map_err(|_| {
        AppError::invalid_path("The local path does not exist or cannot be accessed")
    })?;
    if !metadata.is_dir() {
        return Err(AppError::invalid_path(
            "The local path must point to a directory",
        ));
    }

    let canonical = fs::canonicalize(&path)
        .map_err(|error| AppError::invalid_path(format!("Could not resolve the path: {error}")))?;

    Ok(Some(canonical.to_string_lossy().to_string()))
}

fn validate_unique_path(
    catalog: &CatalogFile,
    path: Option<&str>,
    exclude_project_id: Option<&str>,
) -> AppResult<()> {
    let Some(path) = path else {
        return Ok(());
    };

    if let Some(existing) = catalog.projects.iter().find(|project| {
        project.status == ProjectStatus::Active
            && project.path.as_deref() == Some(path)
            && Some(project.id.as_str()) != exclude_project_id
    }) {
        return Err(AppError::duplicate_path(&existing.name));
    }

    Ok(())
}

fn detect_image_extension(path: &Path) -> AppResult<&'static str> {
    let mut file = fs::File::open(path).map_err(|error| {
        AppError::cover_unsupported(format!("Could not open the selected image: {error}"))
    })?;
    let mut bytes = [0u8; 16];
    let read = file.read(&mut bytes).map_err(|error| {
        AppError::cover_unsupported(format!("Could not read the selected image: {error}"))
    })?;
    let bytes = &bytes[..read];

    if bytes.starts_with(&[0x89, b'P', b'N', b'G', 0x0d, 0x0a, 0x1a, 0x0a]) {
        return Ok("png");
    }
    if bytes.starts_with(&[0xff, 0xd8, 0xff]) {
        return Ok("jpg");
    }
    if bytes.starts_with(b"GIF87a") || bytes.starts_with(b"GIF89a") {
        return Ok("gif");
    }
    if bytes.len() >= 12 && &bytes[0..4] == b"RIFF" && &bytes[8..12] == b"WEBP" {
        return Ok("webp");
    }

    Err(AppError::cover_unsupported(
        "Covers must be PNG, JPEG, WebP or GIF images",
    ))
}

fn is_staged_cover(cover_path: &str) -> bool {
    let path = Path::new(cover_path);
    path.parent() == Some(Path::new(COVERS_DIR))
        && path
            .file_name()
            .map(|name| name.to_string_lossy().starts_with("staged-"))
            .unwrap_or(false)
}

fn promote_staged_cover(
    data_dir: &Path,
    project_id: &str,
    staged_path: &str,
    timestamp: u64,
) -> AppResult<String> {
    if !is_staged_cover(staged_path) {
        return Err(AppError::cover_unsupported(
            "The cover must be a staged image",
        ));
    }

    let staged_absolute = data_dir.join(staged_path);
    if !staged_absolute.exists() {
        return Err(AppError::cover_unsupported(
            "The staged cover is no longer available",
        ));
    }

    let extension = detect_image_extension(&staged_absolute)?;
    let unique_suffix = &Uuid::new_v4().to_string()[..8];
    let final_filename = format!("{project_id}-{timestamp}-{unique_suffix}.{extension}");
    let final_relative = format!("{COVERS_DIR}/{final_filename}");
    let final_absolute = data_dir.join(&final_relative);

    fs::rename(&staged_absolute, &final_absolute).map_err(|error| {
        AppError::cover_unsupported(format!("Could not finalize the selected image: {error}"))
    })?;

    Ok(final_relative)
}

fn remove_cover_file(data_dir: &Path, cover_path: &str) -> AppResult<()> {
    let path = Path::new(cover_path);
    if path.parent() != Some(Path::new(COVERS_DIR)) {
        return Err(AppError::cover_unsupported(
            "Refusing to delete a file outside the covers directory",
        ));
    }

    let absolute = data_dir.join(path);
    match fs::remove_file(absolute) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(AppError::internal(format!(
            "Could not delete the cover image: {error}"
        ))),
    }
}

fn backup_corrupt_catalog(path: &Path) -> Option<PathBuf> {
    let timestamp = now_ms();
    let parent = path.parent()?;
    let backup = parent.join(format!("projects.corrupt-{timestamp}.json"));
    fs::rename(path, &backup).ok().map(|_| backup)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn store() -> (tempfile::TempDir, CatalogStore) {
        let directory = tempfile::tempdir().expect("temp dir");
        let store = CatalogStore::load(directory.path().to_path_buf()).expect("catalog store");
        (directory, store)
    }

    fn project_input(name: &str) -> ProjectInput {
        ProjectInput {
            name: name.to_string(),
            path: None,
            cover: None,
            remove_cover: false,
            editor: None,
            terminal: None,
        }
    }

    fn png_file(directory: &Path) -> PathBuf {
        let path = directory.join("cover.png");
        fs::write(
            &path,
            [0x89, b'P', b'N', b'G', 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0],
        )
        .expect("png file");
        path
    }

    #[test]
    fn creates_and_persists_a_project() {
        let (directory, mut store) = store();
        let view = store
            .create_project(project_input("My project"))
            .expect("create project");

        assert_eq!(view.projects.len(), 1);
        assert_eq!(view.projects[0].status, ProjectStatus::Active);
        assert!(view.projects[0].path.is_none());
        assert!(directory.path().join(CATALOG_FILE).exists());

        let reloaded = CatalogStore::load(directory.path().to_path_buf()).expect("reload");
        assert_eq!(reloaded.view().projects.len(), 1);
    }

    #[test]
    fn loads_legacy_projects_without_launcher_fields() {
        let (directory, _store) = store();
        let legacy = r#"{
          "version": 1,
          "projects": [{
            "id": "11111111-1111-4111-8111-111111111111",
            "name": "Legacy",
            "path": null,
            "cover": null,
            "status": "active",
            "createdAt": 1,
            "updatedAt": 2,
            "archivedAt": null
          }]
        }"#;
        fs::write(directory.path().join(CATALOG_FILE), legacy).expect("legacy catalog");

        let reloaded = CatalogStore::load(directory.path().to_path_buf()).expect("reload");
        let project = &reloaded.view().projects[0];
        assert!(project.editor.is_none());
        assert!(project.terminal.is_none());
    }

    #[test]
    fn persists_project_launcher_overrides() {
        let (directory, mut store) = store();
        let view = store
            .create_project(ProjectInput {
                editor: Some(EditorChoice {
                    kind: crate::launchers::EditorKind::Godot,
                    command: None,
                }),
                terminal: Some(TerminalChoice {
                    kind: crate::launchers::TerminalKind::GnomeTerminal,
                    command: None,
                }),
                ..project_input("With launchers")
            })
            .expect("create");

        let id = view.projects[0].id.clone();
        let reloaded = CatalogStore::load(directory.path().to_path_buf()).expect("reload");
        let project = &reloaded.view().projects[0];
        assert_eq!(
            project.editor.as_ref().map(|choice| choice.kind),
            Some(crate::launchers::EditorKind::Godot)
        );
        assert_eq!(
            project.terminal.as_ref().map(|choice| choice.kind),
            Some(crate::launchers::TerminalKind::GnomeTerminal)
        );

        let updated = store
            .update_project(
                &id,
                ProjectInput {
                    editor: None,
                    terminal: None,
                    ..project_input("With launchers")
                },
            )
            .expect("update");
        assert!(updated.projects[0].editor.is_none());
        assert!(updated.projects[0].terminal.is_none());
    }

    #[test]
    fn rejects_empty_names() {
        let (_directory, mut store) = store();
        let error = store.create_project(project_input("   ")).unwrap_err();
        assert_eq!(error.code, "INVALID_NAME");
    }

    #[test]
    fn rejects_relative_nonexistent_and_file_paths() {
        let (directory, mut store) = store();
        let file = directory.path().join("file.txt");
        fs::write(&file, b"not a directory").expect("file");

        for path in [
            "./relative".to_string(),
            directory.path().join("missing").display().to_string(),
            file.display().to_string(),
        ] {
            let input = ProjectInput {
                path: Some(path),
                ..project_input("Project")
            };
            let error = store.create_project(input).unwrap_err();
            assert_eq!(error.code, "INVALID_PATH");
        }
    }

    #[test]
    fn rejects_duplicate_active_paths_but_allows_archived_reuse() {
        let (directory, mut store) = store();
        let first = store
            .create_project(ProjectInput {
                path: Some(directory.path().display().to_string()),
                ..project_input("First")
            })
            .expect("first project");
        let first_id = first.projects[0].id.clone();

        let error = store
            .create_project(ProjectInput {
                path: Some(directory.path().display().to_string()),
                ..project_input("Second")
            })
            .unwrap_err();
        assert_eq!(error.code, "DUPLICATE_PATH");

        store.archive_project(&first_id).expect("archive");
        store
            .create_project(ProjectInput {
                path: Some(directory.path().display().to_string()),
                ..project_input("Second")
            })
            .expect("reuse path");
    }

    #[test]
    fn updates_archives_restores_and_deletes_a_project() {
        let (directory, mut store) = store();
        let project_folder = directory.path().join("project-folder");
        fs::create_dir_all(&project_folder).expect("project folder");
        let view = store
            .create_project(ProjectInput {
                path: Some(project_folder.display().to_string()),
                ..project_input("Original")
            })
            .expect("create");
        let id = view.projects[0].id.clone();

        let error = store.delete_project(&id).unwrap_err();
        assert_eq!(error.code, "PROJECT_NOT_ARCHIVED");

        let updated = store
            .update_project(
                &id,
                ProjectInput {
                    name: "Renamed".to_string(),
                    ..project_input("Renamed")
                },
            )
            .expect("update");
        assert_eq!(updated.projects[0].name, "Renamed");

        let archived = store.archive_project(&id).expect("archive");
        assert_eq!(archived.projects[0].status, ProjectStatus::Archived);
        assert!(archived.projects[0].archived_at.is_some());

        let restored = store.restore_project(&id).expect("restore");
        assert_eq!(restored.projects[0].status, ProjectStatus::Active);
        assert!(restored.projects[0].archived_at.is_none());

        store.archive_project(&id).expect("archive again");
        let deleted = store.delete_project(&id).expect("delete archived");
        assert!(deleted.projects.is_empty());
        assert!(project_folder.exists());
    }

    #[test]
    fn backs_up_a_corrupt_catalog_and_starts_empty() {
        let (directory, _store) = store();
        let catalog_path = directory.path().join(CATALOG_FILE);
        fs::write(&catalog_path, b"{ not valid json").expect("corrupt catalog");

        let reloaded = CatalogStore::load(directory.path().to_path_buf()).expect("load");
        let view = reloaded.view();
        assert!(view.projects.is_empty());
        assert!(view.warning.is_some());
        assert!(!catalog_path.exists());

        let backups = fs::read_dir(directory.path())
            .expect("read dir")
            .flatten()
            .filter(|entry| {
                entry
                    .file_name()
                    .to_string_lossy()
                    .starts_with("projects.corrupt-")
            })
            .count();
        assert_eq!(backups, 1);
    }

    #[test]
    fn failed_atomic_write_keeps_the_previous_catalog() {
        let (directory, mut store) = store();
        store
            .create_project(project_input("Existing"))
            .expect("create");

        let temp_path = directory.path().join(format!("{CATALOG_FILE}.tmp"));
        fs::create_dir(&temp_path).expect("blocking temp directory");

        let error = store.create_project(project_input("New")).unwrap_err();
        assert_eq!(error.code, "INTERNAL");

        let reloaded = CatalogStore::load(directory.path().to_path_buf()).expect("reload");
        assert_eq!(reloaded.view().projects.len(), 1);
    }

    #[test]
    fn stages_promotes_replaces_and_removes_cover_images() {
        let (directory, mut store) = store();
        let source = png_file(directory.path());

        let staged = store
            .stage_cover(&source.display().to_string())
            .expect("stage cover");
        assert!(staged.path.starts_with("covers/staged-"));
        assert!(directory.path().join(&staged.path).exists());

        let view = store
            .create_project(ProjectInput {
                cover: Some(staged.path.clone()),
                ..project_input("With cover")
            })
            .expect("create with cover");
        let id = view.projects[0].id.clone();
        let first_cover = view.projects[0].cover.clone().expect("cover");
        assert!(first_cover.starts_with(&format!("covers/{id}-")));
        assert!(!directory.path().join(&staged.path).exists());
        assert!(directory.path().join(&first_cover).exists());

        let next_staged = store
            .stage_cover(&source.display().to_string())
            .expect("stage second cover");
        let updated = store
            .update_project(
                &id,
                ProjectInput {
                    cover: Some(next_staged.path),
                    ..project_input("With cover")
                },
            )
            .expect("replace cover");
        let second_cover = updated.projects[0].cover.clone().expect("cover");
        assert_ne!(first_cover, second_cover);
        assert!(!directory.path().join(&first_cover).exists());
        assert!(directory.path().join(&second_cover).exists());

        let removed = store
            .update_project(
                &id,
                ProjectInput {
                    remove_cover: true,
                    ..project_input("With cover")
                },
            )
            .expect("remove cover");
        assert!(removed.projects[0].cover.is_none());
        assert!(!directory.path().join(&second_cover).exists());
    }

    #[test]
    fn rejects_invalid_and_oversized_covers() {
        let (directory, store) = store();
        let svg = directory.path().join("cover.svg");
        fs::write(&svg, b"<svg></svg>").expect("svg");
        let error = store.stage_cover(&svg.display().to_string()).unwrap_err();
        assert_eq!(error.code, "COVER_UNSUPPORTED");

        let large = directory.path().join("large.png");
        let mut bytes = vec![0u8; (MAX_COVER_BYTES + 1) as usize];
        bytes[0..4].copy_from_slice(&[0x89, b'P', b'N', b'G']);
        fs::write(&large, bytes).expect("large file");
        let error = store.stage_cover(&large.display().to_string()).unwrap_err();
        assert_eq!(error.code, "COVER_TOO_LARGE");
    }

    #[test]
    fn cleans_staged_covers_on_load() {
        let (directory, store) = store();
        let staged = store
            .stage_cover(&png_file(directory.path()).display().to_string())
            .expect("stage");
        assert!(directory.path().join(&staged.path).exists());

        let reloaded = CatalogStore::load(directory.path().to_path_buf()).expect("reload");
        let _ = reloaded;
        assert!(!directory.path().join(&staged.path).exists());
    }
}
