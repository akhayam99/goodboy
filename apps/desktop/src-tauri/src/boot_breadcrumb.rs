use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};
use std::time::{SystemTime, UNIX_EPOCH};

use thiserror::Error;

const APP_DIR: &str = ".goodboy";
const BREADCRUMB_FILE: &str = "boot-breadcrumbs.log";
const MAX_FILE_SIZE: u64 = 64 * 1024;
const PHASES: [&str; 13] = [
    "process-start",
    "window-created",
    "webview-attached",
    "pending",
    "migrating",
    "loading-settings",
    "detecting-cli",
    "loading-workspaces",
    "restoring-session",
    "ready",
    "error",
    "retry",
    "slow",
];
const OUTCOMES: [&str; 5] = ["start", "ok", "error", "slow", "timeout"];

static LAUNCH_ID: OnceLock<String> = OnceLock::new();
static WRITE_LOCK: Mutex<()> = Mutex::new(());

#[derive(Debug, Error)]
pub enum BreadcrumbError {
    #[error("invalid breadcrumb phase")]
    Phase,
    #[error("home directory not available")]
    NoHomeDir,
    #[error("breadcrumb io error: {0}")]
    Io(#[from] std::io::Error),
}

crate::util::impl_error_serialize!(BreadcrumbError);

impl BreadcrumbError {
    fn kind(&self) -> &'static str {
        match self {
            BreadcrumbError::Phase => "phase",
            BreadcrumbError::NoHomeDir => "no_home_dir",
            BreadcrumbError::Io(_) => "io",
        }
    }
}

pub fn record(phase: &str, detail: Option<&str>) {
    let _ = record_result(phase, detail);
}

#[tauri::command(async)]
pub fn boot_breadcrumb(phase: String, detail: Option<String>) -> Result<(), BreadcrumbError> {
    record_result(&phase, detail.as_deref())
}

fn record_result(phase: &str, detail: Option<&str>) -> Result<(), BreadcrumbError> {
    validate_phase(phase)?;
    let path = resolve_path()?;
    let line = format_line(phase, sanitize_detail(detail));
    write_line_to(&path, &line)?;
    Ok(())
}

fn validate_phase(phase: &str) -> Result<(), BreadcrumbError> {
    if PHASES.contains(&phase) {
        return Ok(());
    }
    Err(BreadcrumbError::Phase)
}

fn sanitize_detail(detail: Option<&str>) -> Option<&str> {
    let value = detail?;
    if value.is_empty() {
        return None;
    }
    let is_valid = value.split(',').all(|token| {
        if OUTCOMES.contains(&token) {
            return true;
        }
        let Some(digits) = token.strip_prefix("ms=") else {
            return false;
        };
        !digits.is_empty() && digits.len() <= 9 && digits.bytes().all(|byte| byte.is_ascii_digit())
    });
    if is_valid {
        return Some(value);
    }
    None
}

fn resolve_path() -> Result<PathBuf, BreadcrumbError> {
    let home = dirs::home_dir().ok_or(BreadcrumbError::NoHomeDir)?;
    let directory = home.join(APP_DIR);
    fs::create_dir_all(&directory)?;
    Ok(directory.join(BREADCRUMB_FILE))
}

fn unix_millis() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
}

fn launch_id() -> &'static str {
    LAUNCH_ID
        .get_or_init(|| format!("{}-{}", unix_millis(), std::process::id()))
        .as_str()
}

fn format_line(phase: &str, detail: Option<&str>) -> String {
    match detail {
        Some(value) => format!("{} {} {} {}\n", unix_millis(), launch_id(), phase, value),
        None => format!("{} {} {}\n", unix_millis(), launch_id(), phase),
    }
}

fn write_line_to(path: &Path, line: &str) -> Result<(), std::io::Error> {
    let _guard = WRITE_LOCK.lock().unwrap_or_else(|error| error.into_inner());
    if path.metadata().map(|metadata| metadata.len()).unwrap_or(0) > MAX_FILE_SIZE {
        let rotated = PathBuf::from(format!("{}.1", path.display()));
        if rotated.exists() {
            fs::remove_file(&rotated)?;
        }
        fs::rename(path, rotated)?;
    }
    let mut options = OpenOptions::new();
    options.create(true).append(true);
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
    file.write_all(line.as_bytes())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_path(name: &str) -> PathBuf {
        std::env::temp_dir().join(format!(
            "goodboy-breadcrumb-{}-{}-{}",
            name,
            std::process::id(),
            unix_millis()
        ))
    }

    #[cfg(unix)]
    #[test]
    fn the_sink_file_is_owner_only() {
        use std::os::unix::fs::PermissionsExt;

        let directory = temp_path("permissions");
        fs::create_dir_all(&directory).expect("create temp directory");
        let path = directory.join(BREADCRUMB_FILE);
        write_line_to(&path, "0 launch process-start start\n").expect("append breadcrumb");
        let mode = fs::metadata(&path)
            .expect("read breadcrumb metadata")
            .permissions()
            .mode();
        assert_eq!(mode & 0o777, 0o600);
        fs::remove_dir_all(directory).expect("remove temp directory");
    }

    #[test]
    fn allowlisted_phase_passes() {
        assert!(validate_phase("process-start").is_ok());
    }

    #[test]
    fn non_allowlisted_phase_is_rejected() {
        assert!(matches!(
            validate_phase("secret"),
            Err(BreadcrumbError::Phase)
        ));
    }

    #[test]
    fn valid_detail_survives() {
        assert_eq!(sanitize_detail(Some("ms=1234,ok")), Some("ms=1234,ok"));
    }

    #[test]
    fn unsafe_detail_is_dropped() {
        assert_eq!(
            sanitize_detail(Some("--dangerously-skip x=/Users/me/tok")),
            None
        );
    }

    #[test]
    fn rotates_past_size_cap() {
        let directory = temp_path("rotation");
        fs::create_dir_all(&directory).expect("create temp directory");
        let path = directory.join(BREADCRUMB_FILE);
        fs::write(&path, vec![b'x'; MAX_FILE_SIZE as usize + 1]).expect("write oversized file");
        write_line_to(&path, "new line\n").expect("append breadcrumb");
        assert_eq!(
            fs::read_to_string(&path).expect("read breadcrumb"),
            "new line\n"
        );
        assert!(PathBuf::from(format!("{}.1", path.display())).exists());
        fs::remove_dir_all(directory).expect("remove temp directory");
    }
}
