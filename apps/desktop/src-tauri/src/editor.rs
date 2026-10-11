use crate::util::MessageError;
use std::path::{Path, PathBuf};
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

#[tauri::command(async)]
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
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
}

impl EditorError {
    pub(crate) fn kind(&self) -> &'static str {
        match self {
            EditorError::NotFound(_) => "editor_missing",
            EditorError::Spawn { .. } => "spawn",
            EditorError::Io(_) => "io",
        }
    }
}

crate::util::impl_error_serialize!(EditorError);

#[tauri::command]
pub async fn open_in_editor(path: String, editor: Option<String>) -> Result<(), EditorError> {
    tauri::async_runtime::spawn_blocking(move || open_in_editor_blocking(path, editor))
        .await
        .map_err(|e| EditorError::Io(std::io::Error::other(e.to_string())))?
}

pub(crate) fn open_in_editor_blocking(
    path: String,
    editor: Option<String>,
) -> Result<(), EditorError> {
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
        Ok(child) => {
            crate::proc::detach::detach(child);
            Ok(())
        }
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
pub async fn open_file_in_workspace(
    workspace_path: String,
    file_path: String,
    editor: Option<String>,
) -> Result<(), EditorError> {
    tauri::async_runtime::spawn_blocking(move || {
        open_file_in_workspace_blocking(workspace_path, file_path, editor)
    })
    .await
    .map_err(|e| EditorError::Io(std::io::Error::other(e.to_string())))?
}

pub(crate) fn open_file_in_workspace_blocking(
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
        Ok(child) => {
            crate::proc::detach::detach(child);
            Ok(())
        }
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

pub const SETTING_BROWSER_APP: &str = "browser.app";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Platform {
    Mac,
    Linux,
    Windows,
}

impl Platform {
    const fn current() -> Self {
        if cfg!(target_os = "macos") {
            Platform::Mac
        } else if cfg!(target_os = "windows") {
            Platform::Windows
        } else {
            Platform::Linux
        }
    }
}

struct KnownBrowser {
    id: &'static str,
    label: &'static str,
    mac_app: &'static str,
    linux_binary: &'static str,
    windows_exe: &'static str,
}

const KNOWN_BROWSERS: &[KnownBrowser] = &[
    KnownBrowser {
        id: "safari",
        label: "Safari",
        mac_app: "Safari",
        linux_binary: "",
        windows_exe: "",
    },
    KnownBrowser {
        id: "chrome",
        label: "Chrome",
        mac_app: "Google Chrome",
        linux_binary: "google-chrome",
        windows_exe: "Google\\Chrome\\Application\\chrome.exe",
    },
    KnownBrowser {
        id: "arc",
        label: "Arc",
        mac_app: "Arc",
        linux_binary: "",
        windows_exe: "",
    },
    KnownBrowser {
        id: "firefox",
        label: "Firefox",
        mac_app: "Firefox",
        linux_binary: "firefox",
        windows_exe: "Mozilla Firefox\\firefox.exe",
    },
    KnownBrowser {
        id: "edge",
        label: "Edge",
        mac_app: "Microsoft Edge",
        linux_binary: "microsoft-edge",
        windows_exe: "Microsoft\\Edge\\Application\\msedge.exe",
    },
    KnownBrowser {
        id: "brave",
        label: "Brave",
        mac_app: "Brave Browser",
        linux_binary: "brave-browser",
        windows_exe: "BraveSoftware\\Brave-Browser\\Application\\brave.exe",
    },
];

#[derive(Debug, Clone, serde::Serialize)]
pub struct DetectedBrowser {
    pub id: String,
    pub label: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BrowserLaunch {
    pub program: String,
    pub args: Vec<String>,
}

const MAC_APP_DIRS: &[&str] = &[
    "/Applications",
    "/System/Applications",
    "/System/Cryptexes/App/System/Applications",
];

fn locate_browser(platform: Platform, browser: &KnownBrowser) -> Option<PathBuf> {
    match platform {
        Platform::Mac => {
            let bundle = format!("{}.app", browser.mac_app);
            let home_apps =
                std::env::var_os("HOME").map(|home| PathBuf::from(home).join("Applications"));
            MAC_APP_DIRS
                .iter()
                .map(PathBuf::from)
                .chain(home_apps)
                .map(|dir| dir.join(&bundle))
                .find(|candidate| candidate.exists())
        }
        Platform::Linux => {
            if browser.linux_binary.is_empty() {
                return None;
            }
            which_binary(browser.linux_binary).map(|_| PathBuf::from(browser.linux_binary))
        }
        Platform::Windows => {
            if browser.windows_exe.is_empty() {
                return None;
            }
            ["ProgramFiles", "ProgramFiles(x86)", "LOCALAPPDATA"]
                .iter()
                .filter_map(std::env::var_os)
                .map(|root| PathBuf::from(root).join(browser.windows_exe))
                .find(|candidate| candidate.exists())
        }
    }
}

fn launch_for(
    platform: Platform,
    browser: &KnownBrowser,
    located: &Path,
    target: &str,
) -> BrowserLaunch {
    match platform {
        Platform::Mac => BrowserLaunch {
            program: "open".to_string(),
            args: vec![
                "-a".to_string(),
                browser.mac_app.to_string(),
                target.to_string(),
            ],
        },
        Platform::Linux | Platform::Windows => BrowserLaunch {
            program: located.to_string_lossy().to_string(),
            args: vec![target.to_string()],
        },
    }
}

fn chosen_launch(
    platform: Platform,
    setting: Option<&str>,
    locate: impl Fn(&KnownBrowser) -> Option<PathBuf>,
    target: &str,
) -> Option<BrowserLaunch> {
    let id = setting?.trim();
    let browser = KNOWN_BROWSERS.iter().find(|known| known.id == id)?;
    let located = locate(browser)?;
    Some(launch_for(platform, browser, &located, target))
}

fn setting_value(conn: &rusqlite::Connection, key: &str) -> Option<String> {
    conn.query_row("SELECT value FROM settings WHERE key = ?1", [key], |row| {
        row.get::<_, String>(0)
    })
    .ok()
}

fn read_text_setting(app: &tauri::AppHandle, key: &str) -> Option<String> {
    use tauri::Manager;
    let database = app.try_state::<crate::db::Db>()?;
    let conn = database.0.lock().ok()?;
    setting_value(&conn, key)
}

pub fn chosen_browser_launch(app: &tauri::AppHandle, target: &str) -> Option<BrowserLaunch> {
    let setting = read_text_setting(app, SETTING_BROWSER_APP);
    let platform = Platform::current();
    chosen_launch(
        platform,
        setting.as_deref(),
        |browser| locate_browser(platform, browser),
        target,
    )
}

pub fn run_browser_launch(launch: &BrowserLaunch) -> bool {
    let mut command = Command::new(&launch.program);
    command.args(&launch.args);
    if cfg!(target_os = "macos") {
        return command.status().map(|s| s.success()).unwrap_or(false);
    }
    match command.spawn() {
        Ok(child) => {
            crate::proc::detach::detach(child);
            true
        }
        Err(_) => false,
    }
}

fn detected_browsers(platform: Platform) -> Vec<DetectedBrowser> {
    KNOWN_BROWSERS
        .iter()
        .filter(|browser| locate_browser(platform, browser).is_some())
        .map(|browser| DetectedBrowser {
            id: browser.id.to_string(),
            label: browser.label.to_string(),
        })
        .collect()
}

#[tauri::command(async)]
pub fn detect_browsers() -> Vec<DetectedBrowser> {
    detected_browsers(Platform::current())
}

#[tauri::command]
pub async fn open_url(app: tauri::AppHandle, url: String) -> Result<(), MessageError> {
    tauri::async_runtime::spawn_blocking(move || open_url_blocking(&app, url))
        .await
        .map_err(|e| MessageError::Failed(e.to_string()))?
}

fn open_url_blocking(app: &tauri::AppHandle, url: String) -> Result<(), MessageError> {
    if !is_openable_url(&url) {
        return Err(MessageError::Refused(
            "refused to open a url that is not a plain http(s) address".to_string(),
        ));
    }

    if let Some(launch) = chosen_browser_launch(app, &url) {
        if run_browser_launch(&launch) {
            return Ok(());
        }
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

    result
        .map(crate::proc::detach::detach)
        .map_err(|e| MessageError::Failed(e.to_string()))
}

#[cfg(test)]
mod tests {
    use super::{
        chosen_launch, is_openable_url, setting_value, BrowserLaunch, KnownBrowser, Platform,
        KNOWN_BROWSERS, MAX_URL_LEN, SETTING_BROWSER_APP,
    };
    use std::path::PathBuf;

    const URL: &str = "https://harborline.test/pay?id=1&x=2";

    fn installed(ids: &'static [&'static str]) -> impl Fn(&KnownBrowser) -> Option<PathBuf> {
        move |browser| {
            ids.contains(&browser.id)
                .then(|| PathBuf::from(format!("/found/{}", browser.id)))
        }
    }

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

    #[test]
    fn macos_opens_the_chosen_app_with_the_url_as_its_own_argument() {
        let launch = chosen_launch(Platform::Mac, Some("chrome"), installed(&["chrome"]), URL);
        assert_eq!(
            launch,
            Some(BrowserLaunch {
                program: "open".to_string(),
                args: vec![
                    "-a".to_string(),
                    "Google Chrome".to_string(),
                    URL.to_string()
                ],
            })
        );
    }

    #[test]
    fn linux_and_windows_run_the_located_binary_with_only_the_url() {
        let linux = chosen_launch(
            Platform::Linux,
            Some("firefox"),
            installed(&["firefox"]),
            URL,
        );
        assert_eq!(
            linux,
            Some(BrowserLaunch {
                program: "/found/firefox".to_string(),
                args: vec![URL.to_string()],
            })
        );
        let windows = chosen_launch(Platform::Windows, Some("edge"), installed(&["edge"]), URL);
        assert_eq!(
            windows,
            Some(BrowserLaunch {
                program: "/found/edge".to_string(),
                args: vec![URL.to_string()],
            })
        );
    }

    #[test]
    fn a_missing_browser_falls_back_to_the_system_one() {
        assert_eq!(
            chosen_launch(Platform::Mac, Some("arc"), installed(&["chrome"]), URL),
            None
        );
    }

    #[test]
    fn no_choice_or_the_system_choice_uses_the_system_browser() {
        assert_eq!(
            chosen_launch(Platform::Mac, None, installed(&["chrome"]), URL),
            None
        );
        assert_eq!(
            chosen_launch(Platform::Mac, Some("system"), installed(&["chrome"]), URL),
            None
        );
        assert_eq!(
            chosen_launch(Platform::Mac, Some(""), installed(&["chrome"]), URL),
            None
        );
    }

    #[test]
    fn an_unknown_id_never_becomes_a_program_name() {
        let everything = |_: &KnownBrowser| Some(PathBuf::from("/found/any"));
        assert_eq!(
            chosen_launch(Platform::Linux, Some("rm -rf /"), everything, URL),
            None
        );
        assert_eq!(
            chosen_launch(Platform::Linux, Some("/usr/bin/evil"), everything, URL),
            None
        );
    }

    #[test]
    fn known_browser_ids_are_unique_and_never_claim_the_system_id() {
        let mut ids: Vec<&str> = KNOWN_BROWSERS.iter().map(|b| b.id).collect();
        ids.sort_unstable();
        ids.dedup();
        assert_eq!(ids.len(), KNOWN_BROWSERS.len());
        assert!(!ids.contains(&"system"));
        assert!(KNOWN_BROWSERS.iter().all(|b| !b.mac_app.is_empty()));
    }

    #[test]
    fn the_saved_browser_choice_is_read_from_the_settings_table() {
        let conn = rusqlite::Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at INTEGER NOT NULL);",
        )
        .unwrap();
        assert_eq!(setting_value(&conn, SETTING_BROWSER_APP), None);
        conn.execute(
            "INSERT INTO settings (key, value, updated_at) VALUES (?1, 'arc', 1)",
            [SETTING_BROWSER_APP],
        )
        .unwrap();
        let saved = setting_value(&conn, SETTING_BROWSER_APP);
        assert_eq!(saved.as_deref(), Some("arc"));
        let launch = chosen_launch(Platform::Mac, saved.as_deref(), installed(&["arc"]), URL);
        assert_eq!(launch.map(|l| l.args[1].clone()).as_deref(), Some("Arc"));
    }
}
