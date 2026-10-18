use crate::error::{AppError, AppResult};
use serde::Serialize;
use std::env;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ProjectAction {
    Folder,
    Vscode,
    Terminal,
}

impl ProjectAction {
    pub fn parse(raw: &str) -> AppResult<Self> {
        match raw {
            "folder" => Ok(Self::Folder),
            "vscode" => Ok(Self::Vscode),
            "terminal" => Ok(Self::Terminal),
            other => Err(AppError::invalid_action(other)),
        }
    }
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ActionAvailability {
    pub folder: bool,
    pub vscode: bool,
    pub terminal: bool,
    pub terminal_name: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum TerminalArg {
    WorkingDirectoryEquals,
    WorkingDirectorySeparate,
    WorkdirSeparate,
    DirectorySeparate,
}

#[derive(Debug, Clone, Copy)]
struct TerminalCandidate {
    program: &'static str,
    arg: TerminalArg,
}

const TERMINALS: &[TerminalCandidate] = &[
    TerminalCandidate {
        program: "x-terminal-emulator",
        arg: TerminalArg::WorkingDirectoryEquals,
    },
    TerminalCandidate {
        program: "gnome-terminal",
        arg: TerminalArg::WorkingDirectoryEquals,
    },
    TerminalCandidate {
        program: "konsole",
        arg: TerminalArg::WorkdirSeparate,
    },
    TerminalCandidate {
        program: "xfce4-terminal",
        arg: TerminalArg::WorkingDirectoryEquals,
    },
    TerminalCandidate {
        program: "kitty",
        arg: TerminalArg::DirectorySeparate,
    },
    TerminalCandidate {
        program: "alacritty",
        arg: TerminalArg::WorkingDirectorySeparate,
    },
];

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CommandSpec {
    pub program: String,
    pub args: Vec<String>,
}

pub fn availability() -> ActionAvailability {
    availability_from_paths(&search_paths())
}

pub fn availability_from_paths(paths: &[PathBuf]) -> ActionAvailability {
    let terminal = find_terminal_in_paths(paths);

    ActionAvailability {
        folder: find_in_paths("xdg-open", paths).is_some(),
        vscode: find_in_paths("code", paths).is_some(),
        terminal: terminal.is_some(),
        terminal_name: terminal.map(|(_, candidate)| candidate.program.to_string()),
    }
}

pub fn spawn_action(action: ProjectAction, path: &Path) -> AppResult<()> {
    let spec = command_spec(action, path)?;
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

fn command_spec(action: ProjectAction, path: &Path) -> AppResult<CommandSpec> {
    command_spec_with_paths(action, path, &search_paths())
}

fn command_spec_with_paths(
    action: ProjectAction,
    path: &Path,
    paths: &[PathBuf],
) -> AppResult<CommandSpec> {
    let path = path.to_string_lossy().to_string();

    match action {
        ProjectAction::Folder => {
            let program = find_in_paths("xdg-open", paths)
                .ok_or_else(|| AppError::tool_not_found("xdg-open"))?;
            Ok(CommandSpec {
                program: program.to_string_lossy().to_string(),
                args: vec![path],
            })
        }
        ProjectAction::Vscode => {
            let program =
                find_in_paths("code", paths).ok_or_else(|| AppError::tool_not_found("code"))?;
            Ok(CommandSpec {
                program: program.to_string_lossy().to_string(),
                args: vec![path],
            })
        }
        ProjectAction::Terminal => {
            let (program, candidate) = find_terminal_in_paths(paths)
                .ok_or_else(|| AppError::tool_not_found("terminal"))?;
            Ok(terminal_spec(
                program.to_string_lossy().to_string(),
                candidate,
                &path,
            ))
        }
    }
}

fn terminal_spec(program: String, candidate: TerminalCandidate, path: &str) -> CommandSpec {
    let args = match candidate.arg {
        TerminalArg::WorkingDirectoryEquals => vec![format!("--working-directory={path}")],
        TerminalArg::WorkingDirectorySeparate => {
            vec!["--working-directory".to_string(), path.to_string()]
        }
        TerminalArg::WorkdirSeparate => vec!["--workdir".to_string(), path.to_string()],
        TerminalArg::DirectorySeparate => vec!["--directory".to_string(), path.to_string()],
    };

    CommandSpec { program, args }
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

fn find_terminal_in_paths(paths: &[PathBuf]) -> Option<(PathBuf, TerminalCandidate)> {
    TERMINALS.iter().find_map(|candidate| {
        find_in_paths(candidate.program, paths).map(|program| (program, *candidate))
    })
}

fn find_in_paths(program: &str, paths: &[PathBuf]) -> Option<PathBuf> {
    paths.iter().map(|path| path.join(program)).find(|path| {
        path.metadata()
            .map(|metadata| metadata.is_file() && is_executable(&metadata))
            .unwrap_or(false)
    })
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
            ProjectAction::parse("vscode").unwrap(),
            ProjectAction::Vscode
        );
        assert_eq!(
            ProjectAction::parse("terminal").unwrap(),
            ProjectAction::Terminal
        );
        assert_eq!(
            ProjectAction::parse("rm").unwrap_err().code,
            "INVALID_ACTION"
        );
    }

    #[test]
    fn availability_reports_missing_tools() {
        let availability = availability_from_paths(&[]);
        assert!(!availability.folder);
        assert!(!availability.vscode);
        assert!(!availability.terminal);
        assert_eq!(availability.terminal_name, None);
    }

    #[cfg(unix)]
    #[test]
    fn availability_detects_tools_and_ignores_non_executables() {
        let directory = tempfile::tempdir().expect("temp dir");
        executable(directory.path(), "xdg-open");
        executable(directory.path(), "code");
        executable(directory.path(), "gnome-terminal");
        fs::write(directory.path().join("not-executable"), b"text").expect("file");

        let availability = availability_from_paths(&[directory.path().to_path_buf()]);
        assert!(availability.folder);
        assert!(availability.vscode);
        assert!(availability.terminal);
        assert_eq!(
            availability.terminal_name.as_deref(),
            Some("gnome-terminal")
        );
    }

    #[cfg(unix)]
    #[test]
    fn terminal_arguments_keep_paths_as_a_single_argument() {
        let path = "/home/ian/My Projects/a;rm -rf $HOME";
        let spec = terminal_spec(
            "/usr/bin/gnome-terminal".to_string(),
            TerminalCandidate {
                program: "gnome-terminal",
                arg: TerminalArg::WorkingDirectoryEquals,
            },
            path,
        );
        assert_eq!(spec.args, vec![format!("--working-directory={path}")]);

        let spec = terminal_spec(
            "/usr/bin/konsole".to_string(),
            TerminalCandidate {
                program: "konsole",
                arg: TerminalArg::WorkdirSeparate,
            },
            path,
        );
        assert_eq!(spec.args, vec!["--workdir".to_string(), path.to_string()]);
    }

    #[cfg(unix)]
    #[test]
    fn command_spec_uses_the_detected_executable() {
        let directory = tempfile::tempdir().expect("temp dir");
        let fake = executable(directory.path(), "xdg-open");
        let spec = command_spec_with_paths(
            ProjectAction::Folder,
            Path::new("/tmp"),
            &[directory.path().to_path_buf()],
        )
        .expect("spec");

        assert_eq!(spec.program, fake.to_string_lossy());
        assert_eq!(spec.args, vec!["/tmp".to_string()]);
    }
}
