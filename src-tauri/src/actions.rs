use crate::error::{AppError, AppResult};
use crate::launchers::{
    parse_command_template, EditorChoice, EditorKind, LauncherAvailability, LauncherOption,
    TerminalChoice, TerminalKind,
};
use std::env;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ProjectAction {
    Folder,
    Editor,
    Terminal,
}

impl ProjectAction {
    pub fn parse(raw: &str) -> AppResult<Self> {
        match raw {
            "folder" => Ok(Self::Folder),
            "editor" => Ok(Self::Editor),
            "terminal" => Ok(Self::Terminal),
            other => Err(AppError::invalid_action(other)),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CommandSpec {
    pub program: String,
    pub args: Vec<String>,
}

pub fn availability() -> LauncherAvailability {
    availability_from_paths(&search_paths())
}

pub fn availability_from_paths(paths: &[PathBuf]) -> LauncherAvailability {
    LauncherAvailability {
        folder: find_in_paths("xdg-open", paths).is_some(),
        editors: vec![
            option("vscode", "VS Code", find_in_paths("code", paths).is_some()),
            option("godot", "Godot", find_godot(paths).is_some()),
            option("custom", "Personalizado", true),
        ],
        terminals: vec![
            option(
                "gnome-terminal",
                "GNOME Terminal",
                find_in_paths("gnome-terminal", paths).is_some(),
            ),
            option(
                "konsole",
                "Konsole",
                find_in_paths("konsole", paths).is_some(),
            ),
            option(
                "xfce4-terminal",
                "Xfce Terminal",
                find_in_paths("xfce4-terminal", paths).is_some(),
            ),
            option("kitty", "kitty", find_in_paths("kitty", paths).is_some()),
            option(
                "alacritty",
                "Alacritty",
                find_in_paths("alacritty", paths).is_some(),
            ),
            option("custom", "Personalizado", true),
        ],
    }
}

pub fn open_action(
    action: ProjectAction,
    path: &Path,
    editor: &EditorChoice,
    terminal: &TerminalChoice,
) -> AppResult<()> {
    let paths = search_paths();
    let spec = match action {
        ProjectAction::Folder => folder_spec(path, &paths)?,
        ProjectAction::Editor => editor_spec(editor, path, &paths)?,
        ProjectAction::Terminal => terminal_spec(terminal, path, &paths)?,
    };
    spawn_spec(&spec)
}

fn folder_spec(path: &Path, paths: &[PathBuf]) -> AppResult<CommandSpec> {
    let program = find_in_paths("xdg-open", paths)
        .ok_or_else(|| AppError::launcher_not_available("No se detectó xdg-open"))?;
    Ok(CommandSpec {
        program: program.to_string_lossy().to_string(),
        args: vec![path.to_string_lossy().to_string()],
    })
}

fn editor_spec(choice: &EditorChoice, path: &Path, paths: &[PathBuf]) -> AppResult<CommandSpec> {
    let path = path.to_string_lossy().to_string();
    match choice.kind {
        EditorKind::Auto => {
            if let Some(program) = find_in_paths("code", paths) {
                return Ok(CommandSpec {
                    program: program.to_string_lossy().to_string(),
                    args: vec![path],
                });
            }
            if let Some(program) = find_godot(paths) {
                return Ok(CommandSpec {
                    program: program.to_string_lossy().to_string(),
                    args: vec!["--editor".to_string(), "--path".to_string(), path],
                });
            }
            Err(AppError::launcher_not_available(
                "No se detectó ningún editor compatible",
            ))
        }
        EditorKind::Vscode => {
            let program = find_in_paths("code", paths)
                .ok_or_else(|| AppError::launcher_not_available("VS Code no está instalado"))?;
            Ok(CommandSpec {
                program: program.to_string_lossy().to_string(),
                args: vec![path],
            })
        }
        EditorKind::Godot => {
            let program = find_godot(paths)
                .ok_or_else(|| AppError::launcher_not_available("Godot no está instalado"))?;
            Ok(CommandSpec {
                program: program.to_string_lossy().to_string(),
                args: vec!["--editor".to_string(), "--path".to_string(), path],
            })
        }
        EditorKind::Custom => {
            let template = choice.command.as_deref().ok_or_else(|| {
                AppError::invalid_launcher_config("El editor personalizado no tiene comando")
            })?;
            custom_spec(template, &path, paths)
        }
    }
}

fn terminal_spec(
    choice: &TerminalChoice,
    path: &Path,
    paths: &[PathBuf],
) -> AppResult<CommandSpec> {
    let path = path.to_string_lossy().to_string();
    match choice.kind {
        TerminalKind::Auto => {
            let (program, kind) = find_direct_terminal(paths).ok_or_else(|| {
                AppError::launcher_not_available(
                    "No se detectó una terminal directa compatible; x-terminal-emulator no se usa porque ignora el directorio de trabajo",
                )
            })?;
            Ok(terminal_spec_for(program, kind, &path))
        }
        TerminalKind::GnomeTerminal => Ok(terminal_spec_for(
            find_required("gnome-terminal", paths, "GNOME Terminal")?,
            TerminalKind::GnomeTerminal,
            &path,
        )),
        TerminalKind::Konsole => Ok(terminal_spec_for(
            find_required("konsole", paths, "Konsole")?,
            TerminalKind::Konsole,
            &path,
        )),
        TerminalKind::Xfce4Terminal => Ok(terminal_spec_for(
            find_required("xfce4-terminal", paths, "Xfce Terminal")?,
            TerminalKind::Xfce4Terminal,
            &path,
        )),
        TerminalKind::Kitty => Ok(terminal_spec_for(
            find_required("kitty", paths, "kitty")?,
            TerminalKind::Kitty,
            &path,
        )),
        TerminalKind::Alacritty => Ok(terminal_spec_for(
            find_required("alacritty", paths, "Alacritty")?,
            TerminalKind::Alacritty,
            &path,
        )),
        TerminalKind::Custom => {
            let template = choice.command.as_deref().ok_or_else(|| {
                AppError::invalid_launcher_config("La terminal personalizada no tiene comando")
            })?;
            custom_spec(template, &path, paths)
        }
    }
}

fn terminal_spec_for(program: PathBuf, kind: TerminalKind, path: &str) -> CommandSpec {
    let args = match kind {
        TerminalKind::GnomeTerminal | TerminalKind::Xfce4Terminal => {
            vec![format!("--working-directory={path}")]
        }
        TerminalKind::Konsole => vec!["--workdir".to_string(), path.to_string()],
        TerminalKind::Kitty => vec!["--directory".to_string(), path.to_string()],
        TerminalKind::Alacritty => {
            vec!["--working-directory".to_string(), path.to_string()]
        }
        TerminalKind::Auto | TerminalKind::Custom => Vec::new(),
    };
    CommandSpec {
        program: program.to_string_lossy().to_string(),
        args,
    }
}

fn custom_spec(template: &str, path: &str, paths: &[PathBuf]) -> AppResult<CommandSpec> {
    let parsed = parse_command_template(template, path)?;
    let program = resolve_program(&parsed.program, paths)?;
    Ok(CommandSpec {
        program,
        args: parsed.args,
    })
}

fn resolve_program(program: &str, paths: &[PathBuf]) -> AppResult<String> {
    let path = Path::new(program);
    if path.is_absolute() {
        return if is_executable_path(path) {
            Ok(program.to_string())
        } else {
            Err(AppError::launcher_not_available(format!(
                "El ejecutable {program} no existe o no es ejecutable"
            )))
        };
    }
    find_in_paths(program, paths)
        .map(|path| path.to_string_lossy().to_string())
        .ok_or_else(|| AppError::launcher_not_available(format!("No se encontró {program}")))
}

fn find_required(program: &str, paths: &[PathBuf], label: &str) -> AppResult<PathBuf> {
    find_in_paths(program, paths)
        .ok_or_else(|| AppError::launcher_not_available(format!("{label} no está instalado")))
}

fn find_godot(paths: &[PathBuf]) -> Option<PathBuf> {
    find_in_paths("godot", paths).or_else(|| find_in_paths("godot4", paths))
}

fn find_direct_terminal(paths: &[PathBuf]) -> Option<(PathBuf, TerminalKind)> {
    [
        ("gnome-terminal", TerminalKind::GnomeTerminal),
        ("konsole", TerminalKind::Konsole),
        ("xfce4-terminal", TerminalKind::Xfce4Terminal),
        ("kitty", TerminalKind::Kitty),
        ("alacritty", TerminalKind::Alacritty),
    ]
    .into_iter()
    .find_map(|(program, kind)| find_in_paths(program, paths).map(|path| (path, kind)))
}

fn spawn_spec(spec: &CommandSpec) -> AppResult<()> {
    let mut command = Command::new(&spec.program);
    command
        .args(&spec.args)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());

    command.spawn().map_err(|error| {
        AppError::spawn_failed(format!("Could not launch {}: {error}", spec.program))
    })?;
    Ok(())
}

fn option(id: &str, label: &str, available: bool) -> LauncherOption {
    LauncherOption {
        id: id.to_string(),
        label: label.to_string(),
        available,
    }
}

fn search_paths() -> Vec<PathBuf> {
    let mut paths = Vec::new();

    if let Some(value) = env::var_os("PATH") {
        paths.extend(env::split_paths(&value));
    }
    for extra in ["/usr/bin", "/usr/local/bin", "/snap/bin"] {
        paths.push(PathBuf::from(extra));
    }
    if let Some(home) = env::var_os("HOME") {
        paths.push(PathBuf::from(home).join(".local/bin"));
    }

    let mut unique = Vec::new();
    for path in paths {
        if !unique.contains(&path) {
            unique.push(path);
        }
    }
    unique
}

fn find_in_paths(program: &str, paths: &[PathBuf]) -> Option<PathBuf> {
    paths.iter().map(|path| path.join(program)).find(|path| {
        path.metadata()
            .map(|metadata| metadata.is_file() && is_executable(&metadata))
            .unwrap_or(false)
    })
}

fn is_executable_path(path: &Path) -> bool {
    path.metadata()
        .map(|metadata| metadata.is_file() && is_executable(&metadata))
        .unwrap_or(false)
}

#[cfg(unix)]
fn is_executable(metadata: &std::fs::Metadata) -> bool {
    use std::os::unix::fs::PermissionsExt;
    metadata.permissions().mode() & 0o111 != 0
}

#[cfg(not(unix))]
fn is_executable(_metadata: &std::fs::Metadata) -> bool {
    true
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[cfg(unix)]
    fn executable(directory: &Path, name: &str) -> PathBuf {
        use std::os::unix::fs::PermissionsExt;
        let path = directory.join(name);
        fs::write(&path, b"#!/bin/sh\nexit 0\n").expect("fake executable");
        let mut permissions = fs::metadata(&path).expect("metadata").permissions();
        permissions.set_mode(0o755);
        fs::set_permissions(&path, permissions).expect("permissions");
        path
    }

    #[test]
    fn parses_only_known_actions() {
        assert_eq!(
            ProjectAction::parse("folder").unwrap(),
            ProjectAction::Folder
        );
        assert_eq!(
            ProjectAction::parse("editor").unwrap(),
            ProjectAction::Editor
        );
        assert_eq!(
            ProjectAction::parse("terminal").unwrap(),
            ProjectAction::Terminal
        );
        assert_eq!(
            ProjectAction::parse("vscode").unwrap_err().code,
            "INVALID_ACTION"
        );
    }

    #[test]
    fn availability_reports_missing_tools() {
        let availability = availability_from_paths(&[]);
        assert!(!availability.folder);
        assert!(availability
            .editors
            .iter()
            .any(|option| option.id == "custom" && option.available));
        assert!(!availability
            .terminals
            .iter()
            .any(|option| option.available && option.id != "custom"));
    }

    #[cfg(unix)]
    #[test]
    fn availability_detects_editors_and_direct_terminals() {
        let directory = tempfile::tempdir().expect("temp dir");
        executable(directory.path(), "xdg-open");
        executable(directory.path(), "code");
        executable(directory.path(), "godot");
        executable(directory.path(), "gnome-terminal");
        executable(directory.path(), "x-terminal-emulator");

        let availability = availability_from_paths(&[directory.path().to_path_buf()]);
        assert!(availability.folder);
        assert!(availability
            .editors
            .iter()
            .any(|option| option.id == "vscode" && option.available));
        assert!(availability
            .editors
            .iter()
            .any(|option| option.id == "godot" && option.available));
        assert!(availability
            .terminals
            .iter()
            .any(|option| option.id == "gnome-terminal" && option.available));
        assert!(!availability
            .terminals
            .iter()
            .any(|option| option.id == "x-terminal-emulator"));
    }

    #[cfg(unix)]
    #[test]
    fn resolves_godot_as_an_editor() {
        let directory = tempfile::tempdir().expect("temp dir");
        executable(directory.path(), "godot");
        let paths = [directory.path().to_path_buf()];
        let spec = editor_spec(
            &EditorChoice {
                kind: EditorKind::Godot,
                command: None,
            },
            Path::new("/tmp/My Project"),
            &paths,
        )
        .expect("godot spec");

        assert!(spec.program.ends_with("godot"));
        assert_eq!(spec.args, vec!["--editor", "--path", "/tmp/My Project"]);
    }

    #[cfg(unix)]
    #[test]
    fn resolves_terminal_with_working_directory() {
        let directory = tempfile::tempdir().expect("temp dir");
        executable(directory.path(), "gnome-terminal");
        let paths = [directory.path().to_path_buf()];
        let spec = terminal_spec(
            &TerminalChoice {
                kind: TerminalKind::GnomeTerminal,
                command: None,
            },
            Path::new("/tmp/My Project"),
            &paths,
        )
        .expect("terminal spec");

        assert!(spec.program.ends_with("gnome-terminal"));
        assert_eq!(spec.args, vec!["--working-directory=/tmp/My Project"]);
    }

    #[cfg(unix)]
    #[test]
    fn wrapper_only_does_not_open_a_terminal_from_home() {
        let directory = tempfile::tempdir().expect("temp dir");
        executable(directory.path(), "x-terminal-emulator");
        let paths = [directory.path().to_path_buf()];
        let error = terminal_spec(
            &TerminalChoice {
                kind: TerminalKind::Auto,
                command: None,
            },
            Path::new("/tmp/project"),
            &paths,
        )
        .unwrap_err();

        assert_eq!(error.code, "LAUNCHER_NOT_AVAILABLE");
        assert!(error.message.contains("x-terminal-emulator"));
    }

    #[cfg(unix)]
    #[test]
    fn resolves_custom_editor_with_spaces() {
        let directory = tempfile::tempdir().expect("temp dir");
        executable(directory.path(), "mi-editor");
        let paths = [directory.path().to_path_buf()];
        let spec = editor_spec(
            &EditorChoice {
                kind: EditorKind::Custom,
                command: Some("mi-editor --open {path}".to_string()),
            },
            Path::new("/tmp/My Project; test"),
            &paths,
        )
        .expect("custom spec");

        assert!(spec.program.ends_with("mi-editor"));
        assert_eq!(spec.args, vec!["--open", "/tmp/My Project; test"]);
    }
}
