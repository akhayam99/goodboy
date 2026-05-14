use std::process::Command;
use std::sync::OnceLock;
use thiserror::Error;

const DEFAULT_EDITOR: &str = "code";

/// Explicit allowlist of known editors. No auto-discovery of unknown binaries.
const KNOWN_EDITORS: &[(&str, &str)] = &[
    ("code", "VS Code"),
    ("cursor", "Cursor"),
    ("webstorm", "WebStorm"),
    ("idea", "IntelliJ IDEA"),
    ("zed", "Zed"),
    ("subl", "Sublime Text"),
    ("vim", "Vim"),
    ("nvim", "Neovim"),
];

#[derive(Debug, Clone, serde::Serialize)]
pub struct DetectedEditor {
    pub binary: String,
    pub label: String,
}

static DETECTED_EDITORS: OnceLock<Vec<DetectedEditor>> = OnceLock::new();

fn detect_editors_inner() -> Vec<DetectedEditor> {
    KNOWN_EDITORS
        .iter()
        .filter_map(|(binary, label)| {
            which_binary(binary).map(|_| DetectedEditor {
                binary: binary.to_string(),
                label: label.to_string(),
            })
        })
        .collect()
}

fn which_binary(binary: &str) -> Option<()> {
    let status = crate::path_env::command("which").arg(binary).output().ok()?;
    if status.status.success() { Some(()) } else { None }
}

#[tauri::command]
pub fn detect_editors() -> Vec<DetectedEditor> {
    DETECTED_EDITORS.get_or_init(detect_editors_inner).clone()
}

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

    // On macOS, cursor's CLI shim opens paths inside the current window which can
    // resolve to a single file rather than the workspace folder. Use `open -a Cursor`
    // when targeting a directory so the folder loads as a workspace.
    #[cfg(target_os = "macos")]
    {
        if binary == "cursor" && std::path::Path::new(&path).is_dir() {
            return match Command::new("open")
                .args(["-a", "Cursor", "-n", &path])
                .spawn()
            {
                Ok(_) => Ok(()),
                Err(err) if err.kind() == std::io::ErrorKind::NotFound => {
                    Err(EditorError::NotFound(binary))
                }
                Err(source) => Err(EditorError::Spawn { binary, source }),
            };
        }
    }

    let mut cmd = crate::path_env::command(&binary);
    if binary == "cursor" || binary == "code" {
        cmd.arg("--new-window");
    }
    cmd.arg(&path);

    match cmd.spawn() {
        Ok(_) => Ok(()),
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => {
            Err(EditorError::NotFound(binary))
        }
        Err(source) => Err(EditorError::Spawn { binary, source }),
    }
}

/// Opens a single file inside an existing workspace window of the editor.
/// For VS Code / Cursor this means passing the workspace path first so the
/// existing window is focused, then `-g <file>` to navigate to the file —
/// avoiding the "new standalone window per file" behavior of `open_in_editor`,
/// which forces `--new-window`.
#[tauri::command]
pub fn open_file_in_workspace(
    workspace_path: String,
    file_path: String,
    editor: Option<String>,
) -> Result<(), EditorError> {
    let binary = editor.unwrap_or_else(|| DEFAULT_EDITOR.to_string());

    let mut cmd = crate::path_env::command(&binary);
    if binary == "code" || binary == "cursor" {
        cmd.arg(&workspace_path);
        cmd.arg("-g");
        cmd.arg(&file_path);
    } else {
        cmd.arg(&file_path);
    }

    match cmd.spawn() {
        Ok(_) => Ok(()),
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => {
            Err(EditorError::NotFound(binary))
        }
        Err(source) => Err(EditorError::Spawn { binary, source }),
    }
}

#[tauri::command]
pub fn open_url(url: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    let result = Command::new("open").arg(&url).spawn();
    #[cfg(target_os = "linux")]
    let result = Command::new("xdg-open").arg(&url).spawn();
    #[cfg(target_os = "windows")]
    let result = Command::new("cmd").args(["/c", "start", "", &url]).spawn();

    result.map(|_| ()).map_err(|e| e.to_string())
}
