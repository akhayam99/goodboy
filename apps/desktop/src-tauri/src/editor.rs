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
    let status = crate::path_env::command("which")
        .arg(binary)
        .output()
        .ok()?;
    if status.status.success() {
        Some(())
    } else {
        None
    }
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

    // Resolve to absolute canonical path so editors load it as a workspace folder
    // rather than treating it as a relative-to-cwd file. Falls back to the input
    // string when canonicalize fails (e.g. path does not exist yet).
    let abs_path = std::fs::canonicalize(&path)
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|_| path.clone());

    let mut cmd = crate::path_env::command(&binary);
    if binary == "cursor" || binary == "code" {
        cmd.arg("--new-window");
    }
    cmd.arg(&abs_path);

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

const MAX_URL_LEN: usize = 4096;
const URL_FORBIDDEN: &[char] = &['"', '<', '>', '`', '|', '\\', '^', '{', '}'];

fn is_openable_url(url: &str) -> bool {
    if url.is_empty() || url.len() > MAX_URL_LEN {
        return false;
    }
    let lower = url.to_ascii_lowercase();
    if !lower.starts_with("http://") && !lower.starts_with("https://") {
        return false;
    }
    !url.chars()
        .any(|c| c.is_whitespace() || c.is_control() || URL_FORBIDDEN.contains(&c))
}

#[tauri::command]
pub fn open_url(url: String) -> Result<(), String> {
    if !is_openable_url(&url) {
        return Err("refused to open a url that is not a plain http(s) address".to_string());
    }

    #[cfg(target_os = "macos")]
    let result = Command::new("open").arg(&url).spawn();
    #[cfg(target_os = "linux")]
    let result = Command::new("xdg-open").arg(&url).spawn();
    #[cfg(target_os = "windows")]
    let result = Command::new("rundll32.exe")
        .arg("url.dll,FileProtocolHandler")
        .arg(&url)
        .spawn();

    result.map(|_| ()).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::{is_openable_url, MAX_URL_LEN};

    #[test]
    fn accepts_a_real_oauth_url_with_query_parameters() {
        assert!(is_openable_url(
            "https://claude.ai/oauth/authorize?code=1&client_id=abc&redirect_uri=http%3A%2F%2Flocalhost"
        ));
    }

    #[test]
    fn rejects_characters_no_url_may_carry() {
        assert!(!is_openable_url("https://x.test/a\u{60}whoami\u{60}"));
        assert!(!is_openable_url("https://x.test/a|calc.exe"));
        assert!(!is_openable_url("https://x.test/a\"b"));
        assert!(!is_openable_url("https://x.test/a b"));
        assert!(!is_openable_url("https://x.test/a\nb"));
        assert!(!is_openable_url(&format!(
            "https://x.test/{}",
            "a".repeat(MAX_URL_LEN)
        )));
    }

    #[test]
    fn rejects_every_scheme_but_http_and_https() {
        assert!(!is_openable_url("file:///etc/passwd"));
        assert!(!is_openable_url("javascript:alert(1)"));
        assert!(!is_openable_url("ftp://x.test/a"));
        assert!(!is_openable_url(""));
    }
}
