use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use thiserror::Error;

const APP_DIR: &str = ".goodboy";
const CRASH_FILE: &str = "last-crash.json";
const MAX_MESSAGE: usize = 1000;
const MAX_STACK: usize = 4000;
const MAX_SCREEN: usize = 120;
const MAX_FRAMES: usize = 8;
const MAX_ACTIONS: usize = 10;
const MAX_ACTION_NAME: usize = 64;
const EXPIRY_MS: u128 = 7 * 24 * 60 * 60 * 1000;
const OWN_CRATE: &str = "goodboy_desktop_lib::";
const SOURCES: [&str; 3] = ["window", "promise", "rust"];

static FILE_LOCK: Mutex<()> = Mutex::new(());

#[derive(Debug, Error)]
pub enum LastCrashError {
    #[error("home directory not available")]
    NoHomeDir,
    #[error("unknown crash source")]
    Source,
    #[error("crash io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("crash json error: {0}")]
    Json(#[from] serde_json::Error),
}

crate::util::impl_error_serialize!(LastCrashError);

impl LastCrashError {
    fn kind(&self) -> &'static str {
        match self {
            LastCrashError::NoHomeDir => "no_home_dir",
            LastCrashError::Source => "source",
            LastCrashError::Io(_) => "io",
            LastCrashError::Json(_) => "json",
        }
    }
}

const KIND_ERROR: &str = "error";
const KIND_PANIC: &str = "panic";

fn error_kind() -> String {
    KIND_ERROR.to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct LastCrash {
    #[serde(default = "error_kind")]
    pub kind: String,
    pub source: String,
    pub message: String,
    pub stack: String,
    pub screen: Option<String>,
    pub app_version: String,
    #[serde(default)]
    pub actions: Vec<String>,
    pub occurred_at: u64,
    #[serde(default)]
    pub shown: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LastCrashInput {
    source: String,
    message: String,
    stack: String,
    screen: Option<String>,
    #[serde(default)]
    actions: Vec<String>,
}

fn unix_millis() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
}

fn capped(text: &str, limit: usize) -> String {
    text.chars().take(limit).collect()
}

fn resolve_path() -> Result<PathBuf, LastCrashError> {
    let home = dirs::home_dir().ok_or(LastCrashError::NoHomeDir)?;
    let directory = home.join(APP_DIR);
    fs::create_dir_all(&directory)?;
    Ok(directory.join(CRASH_FILE))
}

fn write_to(path: &Path, crash: &LastCrash) -> Result<(), LastCrashError> {
    let body = serde_json::to_vec(crash)?;
    let mut options = OpenOptions::new();
    options.create(true).write(true).truncate(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o600);
    }
    let mut file = options.open(path)?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        file.set_permissions(fs::Permissions::from_mode(0o600))?;
    }
    file.write_all(&body)?;
    Ok(())
}

fn read_from(path: &Path) -> Option<LastCrash> {
    let body = fs::read(path).ok()?;
    serde_json::from_slice(&body).ok()
}

fn remove_at(path: &Path) -> Result<(), LastCrashError> {
    match fs::remove_file(path) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(LastCrashError::Io(error)),
    }
}

fn is_expired(crash: &LastCrash, now: u128) -> bool {
    now.saturating_sub(u128::from(crash.occurred_at)) > EXPIRY_MS
}

fn is_action_name(name: &str) -> bool {
    !name.is_empty()
        && name.len() <= MAX_ACTION_NAME
        && name
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '-' | '_'))
}

fn record_from_input(input: LastCrashInput, now: u128) -> Result<LastCrash, LastCrashError> {
    if !SOURCES.contains(&input.source.as_str()) || input.source == "rust" {
        return Err(LastCrashError::Source);
    }
    Ok(LastCrash {
        kind: error_kind(),
        source: input.source,
        message: capped(&input.message, MAX_MESSAGE),
        stack: capped(&input.stack, MAX_STACK),
        screen: input.screen.map(|screen| capped(&screen, MAX_SCREEN)),
        app_version: env!("CARGO_PKG_VERSION").to_string(),
        actions: input
            .actions
            .into_iter()
            .filter(|name| is_action_name(name))
            .take(MAX_ACTIONS)
            .collect(),
        occurred_at: u64::try_from(now).unwrap_or(u64::MAX),
        shown: false,
    })
}

fn write_first_at(path: &Path, crash: &LastCrash) -> Result<(), LastCrashError> {
    let _guard = FILE_LOCK.lock().unwrap_or_else(|error| error.into_inner());
    if let Some(existing) = read_from(path) {
        let outranks = crash.kind == KIND_PANIC && existing.kind != KIND_PANIC;
        if !existing.shown && !is_expired(&existing, unix_millis()) && !outranks {
            return Ok(());
        }
    }
    write_to(path, crash)
}

fn claim_at(path: &Path, now: u128) -> Result<Option<LastCrash>, LastCrashError> {
    let _guard = FILE_LOCK.lock().unwrap_or_else(|error| error.into_inner());
    let Some(crash) = read_from(path) else {
        return Ok(None);
    };
    if is_expired(&crash, now) {
        remove_at(path)?;
        return Ok(None);
    }
    if crash.shown {
        return Ok(None);
    }
    write_to(
        path,
        &LastCrash {
            shown: true,
            ..crash.clone()
        },
    )?;
    Ok(Some(crash))
}

#[tauri::command(async)]
pub fn last_crash_write(crash: LastCrashInput) -> Result<(), LastCrashError> {
    let record = record_from_input(crash, unix_millis())?;
    write_first_at(&resolve_path()?, &record)
}

#[tauri::command(async)]
pub fn last_crash_claim() -> Result<Option<LastCrash>, LastCrashError> {
    claim_at(&resolve_path()?, unix_millis())
}

#[tauri::command(async)]
pub fn last_crash_delete() -> Result<(), LastCrashError> {
    let _guard = FILE_LOCK.lock().unwrap_or_else(|error| error.into_inner());
    remove_at(&resolve_path()?)
}

fn strip_symbol_hash(symbol: &str) -> &str {
    match symbol.rsplit_once("::h") {
        Some((head, hash)) if hash.len() == 16 && hash.chars().all(|c| c.is_ascii_hexdigit()) => {
            head
        }
        _ => symbol,
    }
}

fn own_frames(backtrace: &str) -> String {
    backtrace
        .lines()
        .map(str::trim)
        .filter_map(|line| {
            let symbol = line.split_once(": ").map_or(line, |(_, rest)| rest);
            symbol
                .starts_with(OWN_CRATE)
                .then(|| strip_symbol_hash(symbol).to_string())
        })
        .filter(|symbol| !symbol.contains("last_crash::"))
        .take(MAX_FRAMES)
        .collect::<Vec<_>>()
        .join("\n")
}

fn without_home(text: &str, home: Option<&str>) -> String {
    match home {
        Some(home) if !home.is_empty() => text.replace(home, "~"),
        _ => text.to_string(),
    }
}

fn panic_message(info: &std::panic::PanicHookInfo<'_>) -> String {
    let payload = info.payload();
    if let Some(text) = payload.downcast_ref::<&str>() {
        return (*text).to_string();
    }
    if let Some(text) = payload.downcast_ref::<String>() {
        return text.clone();
    }
    "panic".to_string()
}

fn panic_record(message: &str, backtrace: &str, home: Option<&str>, now: u128) -> LastCrash {
    let first_line = message.lines().next().unwrap_or("panic");
    LastCrash {
        kind: KIND_PANIC.to_string(),
        source: "rust".to_string(),
        message: capped(&without_home(first_line, home), MAX_MESSAGE),
        stack: own_frames(backtrace),
        screen: None,
        app_version: env!("CARGO_PKG_VERSION").to_string(),
        actions: Vec::new(),
        occurred_at: u64::try_from(now).unwrap_or(u64::MAX),
        shown: false,
    }
}

pub fn install_panic_hook() {
    let previous = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |info| {
        let backtrace = std::backtrace::Backtrace::force_capture().to_string();
        let home = dirs::home_dir().map(|path| path.to_string_lossy().to_string());
        let record = panic_record(
            &panic_message(info),
            &backtrace,
            home.as_deref(),
            unix_millis(),
        );
        if let Ok(path) = resolve_path() {
            let _ = write_first_at(&path, &record);
        }
        previous(info);
    }));
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_path(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "goodboy-last-crash-{}-{}-{}",
            name,
            std::process::id(),
            unix_millis()
        ));
        fs::create_dir_all(&dir).unwrap();
        dir.join(CRASH_FILE)
    }

    fn crash_at(occurred_at: u64) -> LastCrash {
        LastCrash {
            kind: error_kind(),
            source: "window".to_string(),
            message: "TypeError: x is undefined".to_string(),
            stack: "at Row (Row.tsx:4)".to_string(),
            screen: Some("Board".to_string()),
            app_version: "0.11.1".to_string(),
            actions: Vec::new(),
            occurred_at,
            shown: false,
        }
    }

    #[test]
    fn a_panic_replaces_an_unshown_error_but_not_the_reverse() {
        let path = temp_path("rank");
        let now = u64::try_from(unix_millis()).unwrap();
        write_first_at(&path, &crash_at(now)).unwrap();
        let panic = panic_record("boom", "", None, u128::from(now));
        write_first_at(&path, &panic).unwrap();
        write_first_at(&path, &crash_at(now)).unwrap();

        let kept = read_from(&path).unwrap();
        assert_eq!(kept.kind, "panic");
        assert_eq!(kept.message, "boom");
    }

    #[test]
    fn a_record_without_a_kind_reads_as_an_error() {
        let path = temp_path("legacy");
        fs::write(
            &path,
            br#"{"source":"window","message":"m","stack":"","screen":null,"appVersion":"0.11.1","occurredAt":1}"#,
        )
        .unwrap();

        assert_eq!(read_from(&path).unwrap().kind, "error");
    }

    #[test]
    fn claim_returns_a_crash_once_then_nothing() {
        let path = temp_path("once");
        let now = unix_millis();
        write_to(&path, &crash_at(u64::try_from(now).unwrap())).unwrap();

        let first = claim_at(&path, now).unwrap();
        let second = claim_at(&path, now).unwrap();

        assert_eq!(
            first.map(|crash| crash.message),
            Some("TypeError: x is undefined".to_string())
        );
        assert!(second.is_none());
        assert!(path.exists());
    }

    #[test]
    fn claim_deletes_a_crash_older_than_seven_days() {
        let path = temp_path("expired");
        write_to(&path, &crash_at(1)).unwrap();

        assert!(claim_at(&path, EXPIRY_MS + 10).unwrap().is_none());
        assert!(!path.exists());
    }

    #[test]
    fn the_first_unshown_crash_is_kept() {
        let path = temp_path("first");
        let now = u64::try_from(unix_millis()).unwrap();
        write_first_at(&path, &crash_at(now)).unwrap();
        let mut later = crash_at(now);
        later.message = "later".to_string();
        write_first_at(&path, &later).unwrap();

        assert_eq!(
            read_from(&path).unwrap().message,
            "TypeError: x is undefined"
        );
    }

    #[cfg(unix)]
    #[test]
    fn the_file_is_owner_only() {
        use std::os::unix::fs::PermissionsExt;
        let path = temp_path("mode");
        write_to(&path, &crash_at(1)).unwrap();

        assert_eq!(
            fs::metadata(&path).unwrap().permissions().mode() & 0o777,
            0o600
        );
    }

    #[test]
    fn input_is_capped_and_filtered() {
        let record = record_from_input(
            LastCrashInput {
                source: "promise".to_string(),
                message: "m".repeat(5000),
                stack: String::new(),
                screen: Some("Board".to_string()),
                actions: vec![
                    "navigate".to_string(),
                    "send prompt fix the refund".to_string(),
                    "agent.retry".to_string(),
                ],
            },
            5,
        )
        .unwrap();

        assert_eq!(record.message.chars().count(), MAX_MESSAGE);
        assert_eq!(
            record.actions,
            vec!["navigate".to_string(), "agent.retry".to_string()]
        );
        assert_eq!(record.occurred_at, 5);
        assert_eq!(record.kind, "error");
    }

    #[test]
    fn input_cannot_pose_as_a_rust_panic() {
        let result = record_from_input(
            LastCrashInput {
                source: "rust".to_string(),
                message: "m".to_string(),
                stack: String::new(),
                screen: None,
                actions: Vec::new(),
            },
            5,
        );

        assert!(matches!(result, Err(LastCrashError::Source)));
    }

    #[test]
    fn a_panic_keeps_only_our_frames_and_drops_the_home_folder() {
        let backtrace = [
            "   0: std::backtrace::Backtrace::force_capture",
            "             at /rustc/abc/library/std/src/backtrace.rs:312:9",
            "   1: goodboy_desktop_lib::last_crash::install_panic_hook::{{closure}}::h0123456789abcdef",
            "   2: goodboy_desktop_lib::turn::spawn_turn::h0123456789abcdef",
            "             at /Users/rowan/code/goodboy/src/turn.rs:12:5",
            "   3: tokio::runtime::task::raw::poll",
        ]
        .join("\n");

        let record = panic_record(
            "could not open /Users/rowan/.goodboy/data.db\nsecond line",
            &backtrace,
            Some("/Users/rowan"),
            7,
        );

        assert_eq!(record.message, "could not open ~/.goodboy/data.db");
        assert_eq!(record.stack, "goodboy_desktop_lib::turn::spawn_turn");
        assert_eq!(record.source, "rust");
        assert_eq!(record.kind, "panic");
    }
}
