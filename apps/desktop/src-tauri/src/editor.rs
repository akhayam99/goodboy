use std::process::Command;
use thiserror::Error;

const DEFAULT_EDITOR: &str = "code";

#[derive(Debug, Error)]
pub enum EditorError {
    #[error("editor binary '{0}' not found in PATH")]
    NotFound(String),
    #[error("failed to spawn editor '{binary}': {source}")]
    Spawn {
        binary: String,
        #[source]
        source: std::io::Error,
    },
}

impl serde::Serialize for EditorError {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_str(&self.to_string())
    }
}

#[tauri::command]
pub fn open_in_editor(path: String, editor: Option<String>) -> Result<(), EditorError> {
    let binary = editor.unwrap_or_else(|| DEFAULT_EDITOR.to_string());

    match Command::new(&binary).arg(&path).spawn() {
        Ok(_) => Ok(()),
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => {
            Err(EditorError::NotFound(binary))
        }
        Err(source) => Err(EditorError::Spawn { binary, source }),
    }
}
