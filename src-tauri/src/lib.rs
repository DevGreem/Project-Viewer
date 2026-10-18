mod actions;
mod autostart;
mod catalog;
mod error;
mod settings;

use actions::{ActionAvailability, ProjectAction};
use autostart::AutostartState;
use catalog::{CatalogStore, CatalogView, ProjectInput, StagedCover};
use error::{AppError, AppResult};
use settings::SettingsStore;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Manager, State};

pub struct AppState {
    catalog: Mutex<CatalogStore>,
    settings: Mutex<SettingsStore>,
}

#[tauri::command]
fn get_catalog(state: State<'_, AppState>) -> AppResult<CatalogView> {
    let store = state
        .catalog
        .lock()
        .map_err(|_| AppError::internal("The project catalog lock is poisoned"))?;
    Ok(store.view())
}

#[tauri::command]
fn create_project(state: State<'_, AppState>, input: ProjectInput) -> AppResult<CatalogView> {
    let mut store = state
        .catalog
        .lock()
        .map_err(|_| AppError::internal("The project catalog lock is poisoned"))?;
    store.create_project(input)
}

#[tauri::command]
fn update_project(
    state: State<'_, AppState>,
    project_id: String,
    input: ProjectInput,
) -> AppResult<CatalogView> {
    let mut store = state
        .catalog
        .lock()
        .map_err(|_| AppError::internal("The project catalog lock is poisoned"))?;
    store.update_project(&project_id, input)
}

#[tauri::command]
fn archive_project(state: State<'_, AppState>, project_id: String) -> AppResult<CatalogView> {
    let mut store = state
        .catalog
        .lock()
        .map_err(|_| AppError::internal("The project catalog lock is poisoned"))?;
    store.archive_project(&project_id)
}

#[tauri::command]
fn restore_project(state: State<'_, AppState>, project_id: String) -> AppResult<CatalogView> {
    let mut store = state
        .catalog
        .lock()
        .map_err(|_| AppError::internal("The project catalog lock is poisoned"))?;
    store.restore_project(&project_id)
}

#[tauri::command]
fn delete_project(state: State<'_, AppState>, project_id: String) -> AppResult<CatalogView> {
    let mut store = state
        .catalog
        .lock()
        .map_err(|_| AppError::internal("The project catalog lock is poisoned"))?;
    store.delete_project(&project_id)
}

#[tauri::command]
fn stage_cover(state: State<'_, AppState>, source_path: String) -> AppResult<StagedCover> {
    let store = state
        .catalog
        .lock()
        .map_err(|_| AppError::internal("The project catalog lock is poisoned"))?;
    store.stage_cover(&source_path)
}

#[tauri::command]
fn discard_cover(state: State<'_, AppState>, cover_path: String) -> AppResult<()> {
    let store = state
        .catalog
        .lock()
        .map_err(|_| AppError::internal("The project catalog lock is poisoned"))?;
    store.discard_staged_cover(&cover_path)
}

#[tauri::command]
fn get_action_availability() -> ActionAvailability {
    actions::availability()
}

#[tauri::command]
fn open_project_action(
    state: State<'_, AppState>,
    project_id: String,
    action: String,
) -> AppResult<()> {
    let path = {
        let store = state
            .catalog
            .lock()
            .map_err(|_| AppError::internal("The project catalog lock is poisoned"))?;
        store.project_path(&project_id)?
    };

    if !path.is_dir() {
        return Err(AppError::path_unavailable(
            "The project folder no longer exists or is not a directory",
        ));
    }

    actions::spawn_action(ProjectAction::parse(&action)?, &path)
}

#[tauri::command]
fn get_autostart_state(app: AppHandle) -> AutostartState {
    autostart::state(&app)
}

#[tauri::command]
fn set_autostart_enabled(
    app: AppHandle,
    state: State<'_, AppState>,
    enabled: bool,
) -> AppResult<AutostartState> {
    let mut settings = state
        .settings
        .lock()
        .map_err(|_| AppError::internal("The settings lock is poisoned"))?;
    autostart::set_enabled(&app, &mut settings, enabled)
}

fn resolve_data_dir(app: &AppHandle) -> AppResult<PathBuf> {
    if cfg!(debug_assertions) {
        if let Some(path) = std::env::var_os("PROJECT_VIEWER_DATA_DIR") {
            let path = PathBuf::from(path);
            std::fs::create_dir_all(&path)?;
            return Ok(path);
        }
    }

    let path = app.path().app_data_dir().map_err(|error| {
        AppError::internal(format!("Could not resolve the app data dir: {error}"))
    })?;
    std::fs::create_dir_all(&path)?;
    Ok(path)
}

fn focus_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            focus_main_window(app);
        }))
        .plugin(tauri_plugin_dialog::init())
        .plugin(
            tauri_plugin_autostart::Builder::new()
                .arg("--autostart")
                .build(),
        )
        .setup(|app| {
            let data_dir = resolve_data_dir(app.handle())?;
            let catalog = CatalogStore::load(data_dir.clone())?;
            let mut settings = SettingsStore::load(data_dir.clone())?;
            autostart::initialize(app.handle(), &mut settings)?;

            app.manage(AppState {
                catalog: Mutex::new(catalog),
                settings: Mutex::new(settings),
            });

            if let Some(window) = app.get_webview_window("main") {
                window.show()?;
                window.set_focus()?;
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_catalog,
            create_project,
            update_project,
            archive_project,
            restore_project,
            delete_project,
            stage_cover,
            discard_cover,
            get_action_availability,
            open_project_action,
            get_autostart_state,
            set_autostart_enabled
        ])
        .run(tauri::generate_context!())
        .expect("error while running the application");
}
