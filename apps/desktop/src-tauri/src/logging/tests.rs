use super::*;
use log::Log;
use std::fs;
use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};

static NEXT_DIRECTORY: AtomicU64 = AtomicU64::new(0);

fn unique_directory(name: &str) -> PathBuf {
    let sequence = NEXT_DIRECTORY.fetch_add(1, Ordering::Relaxed);
    std::env::temp_dir().join(format!(
        "goodboy-logging-{name}-{}-{sequence}",
        std::process::id()
    ))
}

fn file_logger(dir: &Path) -> Box<dyn Log> {
    let app = tauri::test::mock_app();
    let targets = vec![Target::new(TargetKind::Folder {
        path: dir.to_path_buf(),
        file_name: Some(LOG_FILE_NAME.to_string()),
    })];
    let (_, _, logger) = builder(targets)
        .split(app.handle())
        .expect("the logger builds against a mock app");
    logger
}

fn write_line(logger: &dyn Log, level: log::Level, message: &str) {
    logger.log(
        &log::Record::builder()
            .args(format_args!("{message}"))
            .level(level)
            .target("goodboy_desktop_lib::logging::tests")
            .build(),
    );
    logger.flush();
}

fn folder_files(dir: &Path) -> Vec<(String, u64)> {
    fs::read_dir(dir)
        .unwrap()
        .map(|entry| {
            let entry = entry.unwrap();
            (
                entry.file_name().to_string_lossy().into_owned(),
                entry.metadata().unwrap().len(),
            )
        })
        .collect()
}

#[test]
fn a_log_flood_keeps_the_folder_under_its_size_cap() {
    let dir = unique_directory("flood");
    let logger = file_logger(&dir);
    let line = "x".repeat(1024);

    for _ in 0..8192 {
        write_line(logger.as_ref(), log::Level::Warn, &line);
    }

    let files = folder_files(&dir);
    let total: u64 = files.iter().map(|(_, size)| size).sum();
    let per_file = MAX_LOG_FILE_BYTES as u64 + 2048;
    let most_files = KEPT_LOG_FILES + 2;
    assert!(files.iter().any(|(name, _)| name == "goodboy.log"));
    assert!(files.len() <= most_files, "kept {} files", files.len());
    assert!(total <= per_file * most_files as u64, "kept {total} bytes");
    assert!(files.iter().all(|(_, size)| *size <= per_file));
    fs::remove_dir_all(&dir).unwrap();
}

#[test]
fn old_archives_beyond_the_kept_count_are_deleted_when_the_logger_opens() {
    let dir = unique_directory("archives");
    fs::create_dir_all(&dir).unwrap();
    for day in 1..=10 {
        fs::write(
            dir.join(format!("goodboy_2026-01-{day:02}_00-00-00.log")),
            "old",
        )
        .unwrap();
    }

    let _logger = file_logger(&dir);

    let mut archives: Vec<String> = folder_files(&dir)
        .into_iter()
        .map(|(name, _)| name)
        .filter(|name| name != "goodboy.log")
        .collect();
    archives.sort();
    assert_eq!(archives.len(), KEPT_LOG_FILES);
    assert_eq!(archives[0], "goodboy_2026-01-08_00-00-00.log");
    fs::remove_dir_all(&dir).unwrap();
}

#[test]
fn a_release_logger_writes_warnings_and_info_but_not_debug() {
    let dir = unique_directory("levels");
    let logger = file_logger(&dir);

    write_line(logger.as_ref(), log::Level::Warn, "socket unavailable");
    write_line(logger.as_ref(), log::Level::Info, "phone synced");

    let text = fs::read_to_string(dir.join("goodboy.log")).unwrap();
    assert!(text.contains("socket unavailable"));
    assert!(text.contains("phone synced"));
    assert!(text.contains("WARN"));
    let metadata = log::Metadata::builder().level(log::Level::Debug).build();
    assert!(!logger.enabled(&metadata));
    fs::remove_dir_all(&dir).unwrap();
}

#[cfg(unix)]
#[test]
fn the_log_folder_is_narrowed_to_the_owner() {
    use std::os::unix::fs::PermissionsExt;
    let dir = unique_directory("mode");
    fs::create_dir_all(&dir).unwrap();
    fs::set_permissions(&dir, fs::Permissions::from_mode(0o755)).unwrap();

    restrict_to_owner(&dir);

    let mode = fs::metadata(&dir).unwrap().permissions().mode() & 0o777;
    assert_eq!(mode, 0o700);
    fs::remove_dir_all(&dir).unwrap();
}

#[test]
fn a_failure_detail_drops_credentials_extra_lines_and_length() {
    let leaky = "fatal: unable to access 'https://someone:ghp_secretvalue@github.com/acme/widgets.git/'\nhint: the second line stays out";

    let text = detail(&leaky);

    assert!(!text.contains("ghp_secretvalue"));
    assert!(!text.contains("someone"));
    assert!(!text.contains("second line"));
    assert!(text.contains("https://***@github.com/acme/widgets.git/"));
    let long = "y".repeat(5000);
    let clipped = detail(&long);
    assert_eq!(clipped.chars().count(), MAX_DETAIL_CHARS + 3);
    assert!(clipped.ends_with("..."));
    assert_eq!(detail(&"a\tb\u{7}c"), "a b c");
}

#[test]
fn early_lines_are_kept_for_the_logger_and_capped() {
    let lines = EarlyLines::new();
    for index in 0..(MAX_EARLY_LINES + 5) {
        lines.push(format!("line {index}"));
    }

    let kept = lines.take();

    assert_eq!(kept.len(), MAX_EARLY_LINES);
    assert_eq!(kept[0], "line 0");
    assert!(lines.take().is_empty());
}

#[test]
fn an_unwritable_log_folder_turns_logging_off_without_failing_startup() {
    let blocker = unique_directory("blocked");
    fs::write(&blocker, "a file where the folder should be").unwrap();
    let app = tauri::test::mock_app();
    let targets = vec![Target::new(TargetKind::Folder {
        path: blocker.clone(),
        file_name: Some(LOG_FILE_NAME.to_string()),
    })];
    let sink = EarlyLines::new();

    install(app.handle(), targets, &sink);

    let reported = sink.take();
    assert_eq!(reported.len(), 1);
    assert!(reported[0].contains("logging is off"));
    fs::remove_file(&blocker).unwrap();
}

#[test]
fn stale_backup_files_are_swept_keeping_only_the_newest() {
    let dir = unique_directory("backups");
    fs::create_dir_all(&dir).unwrap();
    for day in 1..=6 {
        fs::write(
            dir.join(format!("goodboy_2026-02-{day:02}_10-00-00.log.bak")),
            "old",
        )
        .unwrap();
    }
    fs::write(dir.join("goodboy.log"), "active").unwrap();
    fs::write(dir.join("goodboy_2026-02-01_10-00-00.log"), "archive").unwrap();
    fs::write(dir.join("other.log.bak"), "not ours").unwrap();

    sweep_backups(&dir);

    let mut names: Vec<String> = folder_files(&dir)
        .into_iter()
        .map(|(name, _)| name)
        .collect();
    names.sort();
    assert_eq!(
        names,
        vec![
            "goodboy.log",
            "goodboy_2026-02-01_10-00-00.log",
            "goodboy_2026-02-06_10-00-00.log.bak",
            "other.log.bak",
        ]
    );
    fs::remove_dir_all(&dir).unwrap();
}
