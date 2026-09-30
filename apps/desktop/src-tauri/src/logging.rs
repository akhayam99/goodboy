use std::fmt::Display;
use std::path::Path;
use std::sync::Mutex;
use tauri::{AppHandle, Manager, Runtime};
use tauri_plugin_log::{RotationStrategy, Target, TargetKind};

pub(crate) const LOG_FILE_NAME: &str = "goodboy";
pub(crate) const MAX_LOG_FILE_BYTES: u128 = 512 * 1024;
pub(crate) const KEPT_LOG_FILES: usize = 3;
const MAX_DETAIL_CHARS: usize = 200;
const MAX_EARLY_LINES: usize = 16;
const BACKUP_SUFFIX: &str = ".log.bak";

pub(crate) struct EarlyLines(Mutex<Vec<String>>);

impl EarlyLines {
    pub(crate) const fn new() -> Self {
        Self(Mutex::new(Vec::new()))
    }

    fn push(&self, line: String) {
        let Ok(mut pending) = self.0.lock() else {
            return;
        };
        if pending.len() < MAX_EARLY_LINES {
            pending.push(line);
        }
    }

    fn take(&self) -> Vec<String> {
        match self.0.lock() {
            Ok(mut pending) => std::mem::take(&mut *pending),
            Err(_) => Vec::new(),
        }
    }
}

static EARLY: EarlyLines = EarlyLines::new();

pub(crate) fn init<R: Runtime>(app: &AppHandle<R>) {
    let dir = app.path().app_log_dir().ok();
    if let Some(dir) = &dir {
        sweep_backups(dir);
    }
    install(app, default_targets(), &EARLY);
    if let Some(dir) = &dir {
        restrict_to_owner(dir);
    }
    flush_early();
}

fn default_targets() -> Vec<Target> {
    let mut targets = vec![Target::new(TargetKind::LogDir {
        file_name: Some(LOG_FILE_NAME.to_string()),
    })];
    if cfg!(debug_assertions) {
        targets.push(Target::new(TargetKind::Stdout));
    }
    targets
}

fn install<R: Runtime>(app: &AppHandle<R>, targets: Vec<Target>, sink: &EarlyLines) {
    let attached = builder(targets)
        .split(app)
        .map_err(|error| error.to_string())
        .and_then(|(_, level, logger)| {
            tauri_plugin_log::attach_logger(level, logger).map_err(|error| error.to_string())
        });
    if let Err(reason) = attached {
        let line = format!(
            "[goodboy] the log file is unavailable, logging is off: {}",
            detail(&reason)
        );
        eprintln!("{line}");
        sink.push(line);
    }
}

pub(crate) fn sweep_backups(dir: &Path) {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return;
    };
    let mut backups: Vec<_> = entries
        .filter_map(Result::ok)
        .map(|entry| entry.path())
        .filter(|path| {
            path.file_name()
                .and_then(|name| name.to_str())
                .is_some_and(|name| {
                    name.starts_with(LOG_FILE_NAME) && name.ends_with(BACKUP_SUFFIX)
                })
        })
        .collect();
    backups.sort();
    backups.pop();
    for stale in backups {
        let _ = std::fs::remove_file(stale);
    }
}

fn builder(targets: Vec<Target>) -> tauri_plugin_log::Builder {
    tauri_plugin_log::Builder::new()
        .clear_targets()
        .targets(targets)
        .level(log::LevelFilter::Info)
        .max_file_size(MAX_LOG_FILE_BYTES)
        .rotation_strategy(RotationStrategy::KeepSome(KEPT_LOG_FILES))
}

pub(crate) fn restrict_to_owner(dir: &Path) {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        if let Err(error) = std::fs::set_permissions(dir, std::fs::Permissions::from_mode(0o700)) {
            log::warn!("log folder permissions not narrowed: {error}");
        }
    }
    #[cfg(not(unix))]
    let _ = dir;
}

pub(crate) fn detail(error: &dyn Display) -> String {
    let text = error.to_string();
    let first_line = text
        .lines()
        .find(|line| !line.trim().is_empty())
        .unwrap_or("");
    let redacted = crate::worktree::redact_credentials(first_line.trim());
    let mut clean: String = redacted
        .chars()
        .map(|c| if c.is_control() { ' ' } else { c })
        .take(MAX_DETAIL_CHARS + 1)
        .collect();
    if clean.chars().count() > MAX_DETAIL_CHARS {
        clean = clean.chars().take(MAX_DETAIL_CHARS).collect();
        clean.push_str("...");
    }
    clean
}

pub(crate) fn note_failure<T, E: Display>(step: &str, result: Result<T, E>) {
    if let Err(error) = result {
        log::warn!("[cleanup] {step} failed: {}", detail(&error));
    }
}

pub(crate) fn note_kill_failure(step: &str, result: std::io::Result<()>) {
    if let Err(error) = result {
        if error.kind() != std::io::ErrorKind::InvalidInput {
            log::warn!("[teardown] {step} failed: {}", detail(&error));
        }
    }
}

pub(crate) fn early(line: String) {
    eprintln!("{line}");
    EARLY.push(line);
}

fn flush_early() {
    for line in EARLY.take() {
        log::warn!("{line}");
    }
}

#[cfg(test)]
mod tests;
