use crate::error::{AppError, AppResult};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "kebab-case")]
pub enum EditorKind {
    #[default]
    Auto,
    Vscode,
    Godot,
    Custom,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct EditorChoice {
    #[serde(default)]
    pub kind: EditorKind,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub command: Option<String>,
}

impl Default for EditorChoice {
    fn default() -> Self {
        Self {
            kind: EditorKind::Auto,
            command: None,
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "kebab-case")]
pub enum TerminalKind {
    #[default]
    Auto,
    GnomeTerminal,
    Konsole,
    Xfce4Terminal,
    Kitty,
    Alacritty,
    Custom,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct TerminalChoice {
    #[serde(default)]
    pub kind: TerminalKind,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub command: Option<String>,
}

impl Default for TerminalChoice {
    fn default() -> Self {
        Self {
            kind: TerminalKind::Auto,
            command: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LauncherOption {
    pub id: String,
    pub label: String,
    pub available: bool,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LauncherAvailability {
    pub folder: bool,
    pub editors: Vec<LauncherOption>,
    pub terminals: Vec<LauncherOption>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LauncherSettingsView {
    pub default_editor: EditorChoice,
    pub default_terminal: TerminalChoice,
    pub availability: LauncherAvailability,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CommandTemplate {
    pub program: String,
    pub args: Vec<String>,
}

pub fn normalize_editor_choice(choice: EditorChoice) -> AppResult<EditorChoice> {
    let mut choice = choice;
    if choice.kind == EditorKind::Custom {
        let command = choice.command.as_deref().unwrap_or_default().trim();
        if command.is_empty() {
            return Err(AppError::invalid_command_template(
                "El editor personalizado necesita un comando",
            ));
        }
        parse_command_template(command, "/tmp/project")?;
        choice.command = Some(command.to_string());
    } else {
        choice.command = None;
    }
    Ok(choice)
}

pub fn normalize_terminal_choice(choice: TerminalChoice) -> AppResult<TerminalChoice> {
    let mut choice = choice;
    if choice.kind == TerminalKind::Custom {
        let command = choice.command.as_deref().unwrap_or_default().trim();
        if command.is_empty() {
            return Err(AppError::invalid_command_template(
                "La terminal personalizada necesita un comando",
            ));
        }
        parse_command_template(command, "/tmp/project")?;
        choice.command = Some(command.to_string());
    } else {
        choice.command = None;
    }
    Ok(choice)
}

pub fn parse_command_template(template: &str, path: &str) -> AppResult<CommandTemplate> {
    if !template.contains("{path}") {
        return Err(AppError::invalid_command_template(
            "El comando personalizado debe incluir {path}",
        ));
    }

    let tokens = tokenize(template)?;
    if tokens.is_empty() {
        return Err(AppError::invalid_command_template(
            "El comando personalizado no puede estar vacío",
        ));
    }

    let mut tokens: Vec<String> = tokens
        .into_iter()
        .map(|token| token.replace("{path}", path))
        .collect();

    let program = tokens.remove(0);
    if program.trim().is_empty() {
        return Err(AppError::invalid_command_template(
            "El comando personalizado necesita un ejecutable",
        ));
    }

    Ok(CommandTemplate {
        program,
        args: tokens,
    })
}

fn tokenize(template: &str) -> AppResult<Vec<String>> {
    let mut tokens = Vec::new();
    let mut current = String::new();
    let mut quote: Option<char> = None;
    let mut has_token = false;
    let mut chars = template.chars();

    while let Some(character) = chars.next() {
        match quote {
            Some(delimiter) => {
                if character == delimiter {
                    quote = None;
                } else if delimiter == '"' && character == '\\' {
                    let Some(escaped) = chars.next() else {
                        return Err(AppError::invalid_command_template(
                            "El comando personalizado termina con un escape incompleto",
                        ));
                    };
                    current.push(escaped);
                } else {
                    current.push(character);
                }
            }
            None => match character {
                '\'' | '"' => {
                    quote = Some(character);
                    has_token = true;
                }
                '\\' => {
                    let Some(escaped) = chars.next() else {
                        return Err(AppError::invalid_command_template(
                            "El comando personalizado termina con un escape incompleto",
                        ));
                    };
                    current.push(escaped);
                    has_token = true;
                }
                value if value.is_whitespace() => {
                    if has_token || !current.is_empty() {
                        tokens.push(std::mem::take(&mut current));
                        has_token = false;
                    }
                }
                value => {
                    current.push(value);
                    has_token = true;
                }
            },
        }
    }

    if quote.is_some() {
        return Err(AppError::invalid_command_template(
            "El comando personalizado tiene comillas sin cerrar",
        ));
    }
    if has_token || !current.is_empty() {
        tokens.push(current);
    }
    if tokens.is_empty() {
        return Err(AppError::invalid_command_template(
            "El comando personalizado no puede estar vacío",
        ));
    }
    Ok(tokens)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn defaults_to_auto() {
        assert_eq!(EditorChoice::default().kind, EditorKind::Auto);
        assert_eq!(TerminalChoice::default().kind, TerminalKind::Auto);
    }

    #[test]
    fn parses_simple_templates_and_substitutes_the_path() {
        let command = parse_command_template("mi-editor --open {path}", "/tmp/My Project").unwrap();
        assert_eq!(command.program, "mi-editor");
        assert_eq!(command.args, vec!["--open", "/tmp/My Project"]);
    }

    #[test]
    fn keeps_quoted_arguments_together() {
        let command = parse_command_template(
            "mi-editor --title 'My project' --path={path}",
            "/tmp/My Project",
        )
        .unwrap();
        assert_eq!(command.program, "mi-editor");
        assert_eq!(
            command.args,
            vec!["--title", "My project", "--path=/tmp/My Project"]
        );
    }

    #[test]
    fn preserves_metacharacters_in_the_path() {
        let path = "/tmp/My Project; rm -rf $HOME &";
        let command = parse_command_template("mi-editor {path}", path).unwrap();
        assert_eq!(command.args, vec![path]);
    }

    #[test]
    fn rejects_missing_path_empty_and_unterminated_templates() {
        for template in ["mi-editor", "", "mi-editor 'unterminated"] {
            let error = parse_command_template(template, "/tmp/project").unwrap_err();
            assert_eq!(error.code, "INVALID_COMMAND_TEMPLATE");
        }
    }

    #[test]
    fn validates_custom_choices() {
        let editor = normalize_editor_choice(EditorChoice {
            kind: EditorKind::Custom,
            command: Some("mi-editor {path}".to_string()),
        })
        .unwrap();
        assert_eq!(editor.command.as_deref(), Some("mi-editor {path}"));

        let error = normalize_editor_choice(EditorChoice {
            kind: EditorKind::Custom,
            command: Some("mi-editor".to_string()),
        })
        .unwrap_err();
        assert_eq!(error.code, "INVALID_COMMAND_TEMPLATE");
    }

    #[test]
    fn clears_commands_for_builtin_choices() {
        let editor = normalize_editor_choice(EditorChoice {
            kind: EditorKind::Godot,
            command: Some("ignored".to_string()),
        })
        .unwrap();
        assert_eq!(editor.command, None);
    }
}
