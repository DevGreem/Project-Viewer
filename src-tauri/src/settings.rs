use crate::catalog::write_json_atomic;
use crate::error::AppResult;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

pub const SETTINGS_FILE: &str = "settings.json";
const SETTINGS_VERSION: u32 = 1;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SettingsFile {
    #[serde(default = "default_version")]
    pub version: u32,
    #[serde(default)]
    pub autostart_initialized: bool,
    #[serde(default)]
    pub autostart_enabled: bool,
}

impl Default for SettingsFile {
    fn default() -> Self {
        Self {
            version: SETTINGS_VERSION,
            autostart_initialized: false,
            autostart_enabled: false,
        }
    }
}

fn default_version() -> u32 {
    SETTINGS_VERSION
}

pub struct SettingsStore {
    data_dir: PathBuf,
    settings: SettingsFile,
}

impl SettingsStore {
    pub fn load(data_dir: PathBuf) -> AppResult<Self> {
        fs::create_dir_all(&data_dir)?;
        let path = data_dir.join(SETTINGS_FILE);

        let settings = if path.exists() {
            match fs::read(&path) {
                Ok(bytes) => match serde_json::from_slice::<SettingsFile>(&bytes) {
                    Ok(settings) if settings.version == SETTINGS_VERSION => settings,
                    Ok(_) | Err(_) => {
                        backup_corrupt_settings(&path);
                        SettingsFile::default()
                    }
                },
                Err(_) => {
                    backup_corrupt_settings(&path);
                    SettingsFile::default()
                }
            }
        } else {
            SettingsFile::default()
        };

        Ok(Self { data_dir, settings })
    }

    pub fn get(&self) -> &SettingsFile {
        &self.settings
    }

    pub fn mark_initialized(&mut self, enabled: bool) -> AppResult<()> {
        self.settings.autostart_initialized = true;
        self.settings.autostart_enabled = enabled;
        self.save()
    }

    pub fn set_enabled(&mut self, enabled: bool) -> AppResult<()> {
        self.settings.autostart_initialized = true;
        self.settings.autostart_enabled = enabled;
        self.save()
    }

    fn save(&self) -> AppResult<()> {
        write_json_atomic(&self.data_dir, SETTINGS_FILE, &self.settings)
    }
}

fn backup_corrupt_settings(path: &Path) -> Option<PathBuf> {
    let timestamp = crate::catalog::now_ms();
    let parent = path.parent()?;
    let backup = parent.join(format!("settings.corrupt-{timestamp}.json"));
    fs::rename(path, &backup).ok().map(|_| backup)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn defaults_to_autostart_disabled_and_uninitialized() {
        let directory = tempfile::tempdir().expect("temp dir");
        let store = SettingsStore::load(directory.path().to_path_buf()).expect("settings");
        assert!(!store.get().autostart_initialized);
        assert!(!store.get().autostart_enabled);
    }

    #[test]
    fn persists_the_autostart_preference() {
        let directory = tempfile::tempdir().expect("temp dir");
        let mut store = SettingsStore::load(directory.path().to_path_buf()).expect("settings");
        store.mark_initialized(true).expect("mark initialized");

        let reloaded = SettingsStore::load(directory.path().to_path_buf()).expect("reload");
        assert!(reloaded.get().autostart_initialized);
        assert!(reloaded.get().autostart_enabled);

        let mut store = reloaded;
        store.set_enabled(false).expect("disable");
        let reloaded = SettingsStore::load(directory.path().to_path_buf()).expect("reload again");
        assert!(reloaded.get().autostart_initialized);
        assert!(!reloaded.get().autostart_enabled);
    }

    #[test]
    fn backs_up_corrupt_settings() {
        let directory = tempfile::tempdir().expect("temp dir");
        fs::write(directory.path().join(SETTINGS_FILE), b"not json").expect("corrupt");
        let store = SettingsStore::load(directory.path().to_path_buf()).expect("settings");
        assert!(!store.get().autostart_initialized);
        assert!(!directory.path().join(SETTINGS_FILE).exists());
        assert!(fs::read_dir(directory.path())
            .expect("read dir")
            .flatten()
            .any(|entry| entry
                .file_name()
                .to_string_lossy()
                .starts_with("settings.corrupt-")));
    }
}
