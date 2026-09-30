use std::fmt::Display;
use std::path::Path;
use std::sync::Mutex;
use tauri::plugin::TauriPlugin;
use tauri::Runtime;
use tauri_plugin_log::{RotationStrategy, Target, TargetKind};

pub(crate) const LOG_FILE_NAME: &str = "goodboy";
pub(crate) const MAX_LOG_FILE_BYTES: u128 = 512 * 1024;
pub(crate) const KEPT_LOG_FILES: usize = 3;
const MAX_DETAIL_CHARS: usize = 200;
const MAX_EARLY_LINES: usize = 16;

static EARLY: Mutex<Vec<String>> = Mutex::new(Vec::new());

pub(crate) fn plugin<R: Runtime>() -> TauriPlugin<R> {
    let mut targets = vec![Target::new(TargetKind::LogDir {
        file_name: Some(LOG_FILE_NAME.to_string()),
    })];
    if cfg!(debug_assertions) {
        targets.push(Target::new(TargetKind::Stdout));
    }
    builder(targets).build()
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
    let Ok(mut pending) = EARLY.lock() else {
        return;
    };
    if pending.len() < MAX_EARLY_LINES {
        pending.push(line);
    }
}

pub(crate) fn flush_early() {
    let lines = match EARLY.lock() {
        Ok(mut pending) => std::mem::take(&mut *pending),
        Err(_) => return,
    };
    for line in lines {
        log::warn!("{line}");
    }
}

#[cfg(test)]
mod tests;
