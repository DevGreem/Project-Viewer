use crate::error::{AppError, AppResult};
use crate::settings::SettingsStore;
use serde::Serialize;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};
use tauri_plugin_autostart::ManagerExt;

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AutostartState {
    pub available: bool,
    pub enabled: bool,
    pub dev_mode: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum InitialAutostartAction {
    Skip,
    EnableAndMarkInitialized,
    RefreshPath,
}

pub fn initial_action(dev_mode: bool, initialized: bool, enabled: bool) -> InitialAutostartAction {
    if dev_mode {
        InitialAutostartAction::Skip
    } else if !initialized {
        InitialAutostartAction::EnableAndMarkInitialized
    } else if enabled {
        InitialAutostartAction::RefreshPath
    } else {
        InitialAutostartAction::Skip
    }
}

pub fn initialize(app: &AppHandle, settings: &mut SettingsStore) -> AppResult<()> {
    let action = initial_action(
        cfg!(debug_assertions),
        settings.get().autostart_initialized,
        settings.get().autostart_enabled,
    );

    match action {
        InitialAutostartAction::Skip => Ok(()),
        InitialAutostartAction::EnableAndMarkInitialized => {
            match app.autolaunch().enable() {
                Ok(()) => {
                    if let Err(error) = quote_autostart_exec(app) {
                        eprintln!("Could not quote the autostart executable: {error}");
                    }
                    if let Err(error) = settings.mark_initialized(true) {
                        eprintln!("Could not persist the autostart preference: {error}");
                    }
                }
                Err(error) => {
                    eprintln!("Could not enable autostart: {error}");
                }
            }
            Ok(())
        }
        InitialAutostartAction::RefreshPath => {
            if let Err(error) = app.autolaunch().enable() {
                eprintln!("Could not refresh the autostart entry: {error}");
            }
            if let Err(error) = quote_autostart_exec(app) {
                eprintln!("Could not quote the autostart executable: {error}");
            }
            Ok(())
        }
    }
}

pub fn state(app: &AppHandle) -> AutostartState {
    if cfg!(debug_assertions) {
        return AutostartState {
            available: false,
            enabled: false,
            dev_mode: true,
        };
    }

    AutostartState {
        available: true,
        enabled: app.autolaunch().is_enabled().unwrap_or(false),
        dev_mode: false,
    }
}

pub fn set_enabled(
    app: &AppHandle,
    settings: &mut SettingsStore,
    enabled: bool,
) -> AppResult<AutostartState> {
    if cfg!(debug_assertions) {
        return Err(AppError::autostart_failed(
            "Autostart is only available in the installed application",
        ));
    }

    if enabled {
        app.autolaunch()
            .enable()
            .map_err(|error| AppError::autostart_failed(error.to_string()))?;
        quote_autostart_exec(app)?;
    } else {
        app.autolaunch()
            .disable()
            .map_err(|error| AppError::autostart_failed(error.to_string()))?;
    }

    settings.set_enabled(enabled)?;
    Ok(state(app))
}

fn quote_autostart_exec(app: &AppHandle) -> AppResult<()> {
    let Some(entry_path) = autostart_entry_path(app) else {
        return Ok(());
    };
    if !entry_path.exists() {
        return Ok(());
    }

    let executable = app
        .env()
        .appimage
        .clone()
        .map(PathBuf::from)
        .or_else(|| std::env::current_exe().ok())
        .ok_or_else(|| AppError::autostart_failed("Could not resolve the executable path"))?;
    let executable = executable.to_string_lossy();
    let contents = std::fs::read_to_string(&entry_path)
        .map_err(|error| AppError::autostart_failed(error.to_string()))?;
    let updated = rewrite_exec_line(&contents, &executable);

    std::fs::write(&entry_path, updated)
        .map_err(|error| AppError::autostart_failed(error.to_string()))?;
    Ok(())
}

fn autostart_entry_path(app: &AppHandle) -> Option<PathBuf> {
    let config_dir = app.path().config_dir().ok()?;
    Some(
        config_dir
            .join("autostart")
            .join(format!("{}.desktop", app.package_info().name)),
    )
}

pub fn rewrite_exec_line(contents: &str, executable: &str) -> String {
    let quoted = escape_desktop_exec_arg(executable);
    let mut found = false;

    let rewritten: Vec<String> = contents
        .lines()
        .map(|line| {
            if line.starts_with("Exec=") {
                found = true;
                format!("Exec={quoted} --autostart")
            } else {
                line.to_string()
            }
        })
        .collect();

    if found {
        format!("{}\n", rewritten.join("\n"))
    } else {
        contents.to_string()
    }
}

fn escape_desktop_exec_arg(value: &str) -> String {
    let escaped = value
        .replace('\\', "\\\\")
        .replace('"', "\\\"")
        .replace('`', "\\`")
        .replace('$', "\\$");
    format!("\"{escaped}\"")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn dev_mode_never_touches_autostart() {
        assert_eq!(
            initial_action(true, false, false),
            InitialAutostartAction::Skip
        );
        assert_eq!(
            initial_action(true, true, true),
            InitialAutostartAction::Skip
        );
    }

    #[test]
    fn packaged_first_run_enables_autostart_once() {
        assert_eq!(
            initial_action(false, false, false),
            InitialAutostartAction::EnableAndMarkInitialized
        );
        assert_eq!(
            initial_action(false, true, true),
            InitialAutostartAction::RefreshPath
        );
        assert_eq!(
            initial_action(false, true, false),
            InitialAutostartAction::Skip
        );
    }

    #[test]
    fn quotes_autostart_exec_paths_with_spaces() {
        let contents = "[Desktop Entry]\nType=Application\nName=Project Viewer\nExec=/home/ian/Apps/Project Viewer_0.1.0_amd64.AppImage --autostart\nTerminal=false";
        let updated = rewrite_exec_line(
            contents,
            "/home/ian/Apps/Project Viewer_0.1.0_amd64.AppImage",
        );

        assert!(updated
            .contains("Exec=\"/home/ian/Apps/Project Viewer_0.1.0_amd64.AppImage\" --autostart"));
        assert!(!updated.contains("Exec=/home/ian/Apps/Project Viewer"));
    }

    #[test]
    fn escapes_desktop_exec_special_characters() {
        let updated =
            rewrite_exec_line("Exec=/tmp/app --autostart", "/tmp/a \"quoted\" $HOME `cmd`");
        assert!(updated.contains("Exec=\"/tmp/a \\\"quoted\\\" \\$HOME \\`cmd\\`\" --autostart"));
    }

    #[test]
    fn leaves_entries_without_exec_unchanged() {
        let contents = "[Desktop Entry]\nType=Application\nName=Project Viewer";
        assert_eq!(
            rewrite_exec_line(contents, "/usr/bin/project-viewer"),
            contents
        );
    }
}
