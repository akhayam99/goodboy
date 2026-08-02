use std::cmp::Ordering;
use std::fs::{self, File, Metadata};
use std::io::Read;
use std::path::{Component, Path, PathBuf};
use std::process::Command;
use std::time::UNIX_EPOCH;

use base64::engine::general_purpose::STANDARD;
use base64::Engine as _;
use serde::Serialize;
use thiserror::Error;

const TEXT_MAX_BYTES: usize = 256 * 1024;

#[derive(Debug, Error)]
pub enum ExploreError {
    #[error("path escapes the session directory")]
    OutsideSession,
    #[error("path is not a directory")]
    NotDirectory,
    #[error("path is not a file")]
    NotFile,
    #[error("file exceeds {0} byte limit")]
    TooLarge(usize),
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
}

crate::util::impl_error_serialize!(ExploreError);

impl ExploreError {
    fn kind(&self) -> &'static str {
        match self {
            ExploreError::OutsideSession => "outside_session",
            ExploreError::NotDirectory => "not_directory",
            ExploreError::NotFile => "not_file",
            ExploreError::TooLarge(_) => "too_large",
            ExploreError::Io(_) => "io",
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExploreEntry {
    name: String,
    rel_path: String,
    is_dir: bool,
    size_bytes: u64,
    modified_at: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum ExploreContent {
    Text { text: String, truncated: bool },
    DataUrl { url: String },
}

fn resolve_path(session_dir: &str, rel_path: &str) -> Result<PathBuf, ExploreError> {
    let relative = Path::new(rel_path);
    if relative.is_absolute()
        || relative
            .components()
            .any(|component| !matches!(component, Component::Normal(_)))
    {
        return Err(ExploreError::OutsideSession);
    }
    let base = fs::canonicalize(session_dir)?;
    let target = fs::canonicalize(base.join(relative))?;
    if !target.starts_with(&base) {
        return Err(ExploreError::OutsideSession);
    }
    Ok(target)
}

fn modified_at(metadata: &Metadata) -> Option<String> {
    let seconds = metadata
        .modified()
        .ok()?
        .duration_since(UNIX_EPOCH)
        .ok()?
        .as_secs() as i64;
    let (year, month, day, hour, minute, second) = crate::util::epoch_secs_to_datetime(seconds);
    Some(format!(
        "{year:04}-{month:02}-{day:02}T{hour:02}:{minute:02}:{second:02}Z"
    ))
}

fn entry_order(left: &ExploreEntry, right: &ExploreEntry) -> Ordering {
    right
        .is_dir
        .cmp(&left.is_dir)
        .then_with(|| left.name.to_lowercase().cmp(&right.name.to_lowercase()))
        .then_with(|| left.name.cmp(&right.name))
}

fn is_text_path(path: &Path) -> bool {
    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .map(str::to_ascii_lowercase);
    if matches!(
        extension.as_deref(),
        Some(
            "bash"
                | "c"
                | "cc"
                | "cfg"
                | "conf"
                | "cpp"
                | "cs"
                | "css"
                | "csv"
                | "env"
                | "fish"
                | "go"
                | "gql"
                | "graphql"
                | "h"
                | "hpp"
                | "htm"
                | "html"
                | "ini"
                | "java"
                | "js"
                | "json"
                | "jsonl"
                | "jsx"
                | "kt"
                | "kts"
                | "less"
                | "lock"
                | "log"
                | "markdown"
                | "md"
                | "mjs"
                | "properties"
                | "py"
                | "rb"
                | "rs"
                | "sass"
                | "scss"
                | "sh"
                | "sql"
                | "svg"
                | "swift"
                | "toml"
                | "ts"
                | "tsv"
                | "tsx"
                | "txt"
                | "xml"
                | "yaml"
                | "yml"
                | "zsh"
        )
    ) {
        return true;
    }
    matches!(
        path.file_name().and_then(|value| value.to_str()),
        Some("Dockerfile" | "Gemfile" | "Makefile" | "Procfile")
    )
}

fn mime_for(path: &Path) -> &'static str {
    match path
        .extension()
        .and_then(|value| value.to_str())
        .map(str::to_ascii_lowercase)
        .as_deref()
    {
        Some("bmp") => "image/bmp",
        Some("gif") => "image/gif",
        Some("ico") => "image/x-icon",
        Some("jpeg") | Some("jpg") => "image/jpeg",
        Some("pdf") => "application/pdf",
        Some("png") => "image/png",
        Some("webp") => "image/webp",
        Some("zip") => "application/zip",
        _ => "application/octet-stream",
    }
}

fn read_text(path: &Path) -> Result<ExploreContent, ExploreError> {
    let mut bytes = Vec::with_capacity(TEXT_MAX_BYTES + 1);
    File::open(path)?
        .take((TEXT_MAX_BYTES + 1) as u64)
        .read_to_end(&mut bytes)?;
    let truncated = bytes.len() > TEXT_MAX_BYTES;
    bytes.truncate(TEXT_MAX_BYTES);
    Ok(ExploreContent::Text {
        text: String::from_utf8_lossy(&bytes).into_owned(),
        truncated,
    })
}

fn read_binary(path: &Path, metadata: &Metadata) -> Result<ExploreContent, ExploreError> {
    if metadata.len() > crate::attachment::MAX_BYTES as u64 {
        return Err(ExploreError::TooLarge(crate::attachment::MAX_BYTES));
    }
    let bytes = fs::read(path)?;
    if bytes.len() > crate::attachment::MAX_BYTES {
        return Err(ExploreError::TooLarge(crate::attachment::MAX_BYTES));
    }
    Ok(ExploreContent::DataUrl {
        url: format!("data:{};base64,{}", mime_for(path), STANDARD.encode(bytes)),
    })
}

fn spawn_open(path: &Path, reveal: bool) -> Result<(), ExploreError> {
    #[cfg(target_os = "macos")]
    let mut command = Command::new("open");
    #[cfg(target_os = "macos")]
    if reveal {
        command.arg("-R");
    }
    #[cfg(target_os = "macos")]
    command.arg(path);

    #[cfg(target_os = "linux")]
    let mut command = Command::new("xdg-open");
    #[cfg(target_os = "linux")]
    command.arg(if reveal {
        path.parent().unwrap_or(path)
    } else {
        path
    });

    #[cfg(target_os = "windows")]
    let mut command = if reveal {
        let mut command = Command::new("explorer.exe");
        command.arg("/select,");
        command
    } else {
        let mut command = Command::new("rundll32.exe");
        command.arg("url.dll,FileProtocolHandler");
        command
    };
    #[cfg(target_os = "windows")]
    command.arg(path);

    command.spawn()?;
    Ok(())
}

#[tauri::command]
pub fn explore_list(
    session_dir: String,
    rel_path: String,
) -> Result<Vec<ExploreEntry>, ExploreError> {
    let path = resolve_path(&session_dir, &rel_path)?;
    if !path.is_dir() {
        return Err(ExploreError::NotDirectory);
    }
    let mut entries = fs::read_dir(path)?
        .filter_map(|result| result.ok())
        .filter_map(|entry| {
            let name = entry.file_name().to_string_lossy().into_owned();
            if name.starts_with('.') {
                return None;
            }
            let metadata = entry.metadata().ok()?;
            let rel_path = Path::new(&rel_path)
                .join(&name)
                .to_string_lossy()
                .into_owned();
            Some(ExploreEntry {
                name,
                rel_path,
                is_dir: metadata.is_dir(),
                size_bytes: metadata.len(),
                modified_at: modified_at(&metadata),
            })
        })
        .collect::<Vec<_>>();
    entries.sort_by(entry_order);
    Ok(entries)
}

#[tauri::command]
pub fn explore_read(session_dir: String, rel_path: String) -> Result<ExploreContent, ExploreError> {
    let path = resolve_path(&session_dir, &rel_path)?;
    let metadata = fs::metadata(&path)?;
    if !metadata.is_file() {
        return Err(ExploreError::NotFile);
    }
    if is_text_path(&path) {
        return read_text(&path);
    }
    read_binary(&path, &metadata)
}

#[tauri::command]
pub fn explore_open(
    session_dir: String,
    rel_path: String,
    reveal: bool,
) -> Result<(), ExploreError> {
    let path = resolve_path(&session_dir, &rel_path)?;
    if !path.is_file() {
        return Err(ExploreError::NotFile);
    }
    spawn_open(&path, reveal)
}

#[cfg(test)]
mod tests {
    use std::fs;

    use super::{explore_list, explore_read, ExploreContent, ExploreError, TEXT_MAX_BYTES};

    fn test_root(name: &str) -> std::path::PathBuf {
        std::env::temp_dir().join(format!(
            "goodboy-explore-{name}-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ))
    }

    #[test]
    fn lists_directories_first_and_skips_dotfiles() {
        let root = test_root("list");
        fs::create_dir_all(root.join("Beta")).unwrap();
        fs::write(root.join("zeta.txt"), "zeta").unwrap();
        fs::write(root.join("alpha.txt"), "alpha").unwrap();
        fs::write(root.join(".goodboy"), "marker").unwrap();

        let entries = explore_list(root.to_string_lossy().into_owned(), String::new()).unwrap();

        assert_eq!(
            entries
                .iter()
                .map(|entry| entry.name.as_str())
                .collect::<Vec<_>>(),
            vec!["Beta", "alpha.txt", "zeta.txt"]
        );
        assert!(entries[0].is_dir);
        assert!(!entries[1].is_dir);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn rejects_parent_and_absolute_paths() {
        let root = test_root("invalid-paths");
        fs::create_dir_all(&root).unwrap();

        let parent = explore_list(root.to_string_lossy().into_owned(), "..".to_string());
        let absolute = explore_list(
            root.to_string_lossy().into_owned(),
            root.to_string_lossy().into_owned(),
        );

        assert!(matches!(parent, Err(ExploreError::OutsideSession)));
        assert!(matches!(absolute, Err(ExploreError::OutsideSession)));
        fs::remove_dir_all(root).unwrap();
    }

    #[cfg(unix)]
    #[test]
    fn rejects_symlinks_that_point_outside_the_session() {
        let root = test_root("symlink-root");
        let outside = test_root("symlink-outside");
        fs::create_dir_all(&root).unwrap();
        fs::create_dir_all(&outside).unwrap();
        fs::write(outside.join("secret.txt"), "secret").unwrap();
        std::os::unix::fs::symlink(outside.join("secret.txt"), root.join("linked.txt")).unwrap();

        let result = explore_read(
            root.to_string_lossy().into_owned(),
            "linked.txt".to_string(),
        );

        assert!(matches!(result, Err(ExploreError::OutsideSession)));
        fs::remove_dir_all(root).unwrap();
        fs::remove_dir_all(outside).unwrap();
    }

    #[test]
    fn truncates_text_over_the_limit() {
        let root = test_root("text-limit");
        fs::create_dir_all(&root).unwrap();
        fs::write(root.join("large.txt"), vec![b'a'; TEXT_MAX_BYTES + 1]).unwrap();

        let content =
            explore_read(root.to_string_lossy().into_owned(), "large.txt".to_string()).unwrap();

        match content {
            ExploreContent::Text { text, truncated } => {
                assert_eq!(text.len(), TEXT_MAX_BYTES);
                assert!(truncated);
            }
            ExploreContent::DataUrl { .. } => panic!("expected text content"),
        }
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn rejects_reading_directories_and_listing_files() {
        let root = test_root("wrong-kind");
        fs::create_dir_all(&root).unwrap();
        fs::write(root.join("file.txt"), "text").unwrap();

        let read = explore_read(root.to_string_lossy().into_owned(), String::new());
        let list = explore_list(root.to_string_lossy().into_owned(), "file.txt".to_string());

        assert!(matches!(read, Err(ExploreError::NotFile)));
        assert!(matches!(list, Err(ExploreError::NotDirectory)));
        fs::remove_dir_all(root).unwrap();
    }
}
