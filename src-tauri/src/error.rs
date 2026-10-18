use serde::Serialize;

pub type AppResult<T> = Result<T, AppError>;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppError {
    pub code: String,
    pub message: String,
    pub details: Option<String>,
}

impl AppError {
    pub fn new(code: impl Into<String>, message: impl Into<String>) -> Self {
        Self {
            code: code.into(),
            message: message.into(),
            details: None,
        }
    }

    pub fn with_details(
        code: impl Into<String>,
        message: impl Into<String>,
        details: impl Into<String>,
    ) -> Self {
        Self {
            code: code.into(),
            message: message.into(),
            details: Some(details.into()),
        }
    }

    pub fn invalid_name(message: impl Into<String>) -> Self {
        Self::new("INVALID_NAME", message)
    }

    pub fn invalid_path(message: impl Into<String>) -> Self {
        Self::new("INVALID_PATH", message)
    }

    pub fn duplicate_path(name: &str) -> Self {
        Self::with_details(
            "DUPLICATE_PATH",
            "Another active project already uses this path",
            name,
        )
    }

    pub fn cover_unsupported(message: impl Into<String>) -> Self {
        Self::new("COVER_UNSUPPORTED", message)
    }

    pub fn cover_too_large() -> Self {
        Self::new("COVER_TOO_LARGE", "Cover images must be 5 MB or smaller")
    }

    pub fn project_not_found(id: &str) -> Self {
        Self::with_details("PROJECT_NOT_FOUND", "Project not found", id)
    }

    pub fn project_not_archived() -> Self {
        Self::new(
            "PROJECT_NOT_ARCHIVED",
            "Only archived projects can be deleted",
        )
    }

    pub fn catalog_read_failed(message: impl Into<String>) -> Self {
        Self::new("CATALOG_READ_FAILED", message)
    }

    pub fn path_unavailable(message: impl Into<String>) -> Self {
        Self::new("PATH_UNAVAILABLE", message)
    }

    pub fn spawn_failed(message: impl Into<String>) -> Self {
        Self::new("SPAWN_FAILED", message)
    }

    pub fn invalid_action(action: &str) -> Self {
        Self::with_details("INVALID_ACTION", "Unknown project action", action)
    }

    pub fn invalid_launcher_config(message: impl Into<String>) -> Self {
        Self::new("INVALID_LAUNCHER_CONFIG", message)
    }

    pub fn invalid_command_template(message: impl Into<String>) -> Self {
        Self::new("INVALID_COMMAND_TEMPLATE", message)
    }

    pub fn launcher_not_available(message: impl Into<String>) -> Self {
        Self::new("LAUNCHER_NOT_AVAILABLE", message)
    }

    pub fn autostart_failed(message: impl Into<String>) -> Self {
        Self::new("AUTOSTART_FAILED", message)
    }

    pub fn internal(message: impl Into<String>) -> Self {
        Self::new("INTERNAL", message)
    }
}

impl std::fmt::Display for AppError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}: {}", self.code, self.message)
    }
}

impl std::error::Error for AppError {}

impl From<std::io::Error> for AppError {
    fn from(error: std::io::Error) -> Self {
        Self::with_details("INTERNAL", "Filesystem operation failed", error.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn serializes_stable_error_contract() {
        let error = AppError::duplicate_path("Existing project");
        let value = serde_json::to_value(error).expect("error must serialize");

        assert_eq!(value["code"], "DUPLICATE_PATH");
        assert_eq!(
            value["message"],
            "Another active project already uses this path"
        );
        assert_eq!(value["details"], "Existing project");
    }
}
