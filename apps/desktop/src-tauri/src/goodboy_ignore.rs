use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use thiserror::Error;

use crate::worktree::{ensure_goodboy_excluded, exclude_file_path, remove_goodboy_exclude_entry};

const PROBE_PATH: &str = ".goodboy/worktrees/probe";
const GITIGNORE_ENTRY: &str = "/.goodboy/";

#[derive(Debug, Error)]
pub enum GoodboyIgnoreError {
    #[error("unknown git ignore target: {0}")]
    UnknownTarget(String),
    #[error("refusing to write through a symlinked .gitignore")]
    SymlinkRefused,
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
}

crate::util::impl_error_serialize!(GoodboyIgnoreError);

impl GoodboyIgnoreError {
    fn kind(&self) -> &'static str {
        match self {
            GoodboyIgnoreError::UnknownTarget(_) => "unknown_target",
            GoodboyIgnoreError::SymlinkRefused => "symlink_refused",
            GoodboyIgnoreError::Io(_) => "io",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum GoodboyIgnoreSource {
    Global,
    GitIgnore,
    InfoExclude,
    NotIgnored,
    Unknown,
}

impl GoodboyIgnoreSource {
    fn as_str(self) -> &'static str {
        match self {
            GoodboyIgnoreSource::Global => "global",
            GoodboyIgnoreSource::GitIgnore => "gitignore",
            GoodboyIgnoreSource::InfoExclude => "info-exclude",
            GoodboyIgnoreSource::NotIgnored => "not-ignored",
            GoodboyIgnoreSource::Unknown => "unknown",
        }
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct GoodboyIgnoreStatusDto {
    pub source: String,
    pub path: Option<String>,
    pub line: Option<u32>,
}

#[derive(Debug)]
pub(crate) struct GoodboyIgnoreStatus {
    pub(crate) source: GoodboyIgnoreSource,
    pub(crate) path: Option<PathBuf>,
    pub(crate) line: Option<u32>,
}

impl GoodboyIgnoreStatus {
    fn into_dto(self) -> GoodboyIgnoreStatusDto {
        GoodboyIgnoreStatusDto {
            source: self.source.as_str().to_string(),
            path: self.path.map(|value| value.to_string_lossy().into_owned()),
            line: self.line,
        }
    }

    pub(crate) fn is_ignored(&self) -> bool {
        !matches!(
            self.source,
            GoodboyIgnoreSource::NotIgnored | GoodboyIgnoreSource::Unknown
        )
    }
}

fn expand_home(raw: &str, home: &Path) -> PathBuf {
    if raw == "~" {
        return home.to_path_buf();
    }
    if let Some(rest) = raw.strip_prefix("~/") {
        return home.join(rest);
    }
    PathBuf::from(raw)
}

fn global_excludes_path(home: &Path) -> PathBuf {
    let configured = crate::path_env::command("git")
        .args(["config", "--global", "--get", "core.excludesFile"])
        .env("HOME", home)
        .env_remove("XDG_CONFIG_HOME")
        .output()
        .ok()
        .filter(|output| output.status.success())
        .map(|output| String::from_utf8_lossy(&output.stdout).trim().to_string())
        .filter(|value| !value.is_empty());
    if let Some(raw) = configured {
        return expand_home(&raw, home);
    }
    home.join(".config").join("git").join("ignore")
}

fn same_path(left: &Path, right: &Path) -> bool {
    let canonical_left = std::fs::canonicalize(left).unwrap_or_else(|_| left.to_path_buf());
    let canonical_right = std::fs::canonicalize(right).unwrap_or_else(|_| right.to_path_buf());
    canonical_left == canonical_right
}

fn parse_hit(stdout: &str, repo_root: &Path, home: &Path) -> GoodboyIgnoreStatus {
    let descriptor = stdout
        .lines()
        .next()
        .unwrap_or("")
        .split('\t')
        .next()
        .unwrap_or("");
    let mut parts = descriptor.rsplitn(3, ':');
    parts.next();
    let line = parts.next().and_then(|value| value.parse::<u32>().ok());
    let file = parts.next().unwrap_or("").trim();
    if file.is_empty() {
        return GoodboyIgnoreStatus {
            source: GoodboyIgnoreSource::Unknown,
            path: None,
            line: None,
        };
    }
    let raw_path = PathBuf::from(file);
    let file_path = if raw_path.is_absolute() {
        raw_path
    } else {
        repo_root.join(&raw_path)
    };
    let project_gitignore = repo_root.join(".gitignore");
    if same_path(&file_path, &project_gitignore) {
        return GoodboyIgnoreStatus {
            source: GoodboyIgnoreSource::GitIgnore,
            path: Some(file_path),
            line,
        };
    }
    if let Some(exclude_path) = exclude_file_path(repo_root) {
        if same_path(&file_path, &exclude_path) {
            return GoodboyIgnoreStatus {
                source: GoodboyIgnoreSource::InfoExclude,
                path: Some(file_path),
                line,
            };
        }
    }
    if same_path(&file_path, &global_excludes_path(home)) {
        return GoodboyIgnoreStatus {
            source: GoodboyIgnoreSource::Global,
            path: Some(file_path),
            line,
        };
    }
    GoodboyIgnoreStatus {
        source: GoodboyIgnoreSource::Unknown,
        path: Some(file_path),
        line,
    }
}

pub(crate) fn check_status(
    repo_root: &Path,
    home: &Path,
) -> Result<GoodboyIgnoreStatus, GoodboyIgnoreError> {
    let output = crate::path_env::command("git")
        .args(["check-ignore", "-v", "--no-index", PROBE_PATH])
        .current_dir(repo_root)
        .env("HOME", home)
        .env_remove("XDG_CONFIG_HOME")
        .output()?;
    match output.status.code() {
        Some(0) => Ok(parse_hit(
            &String::from_utf8_lossy(&output.stdout),
            repo_root,
            home,
        )),
        Some(1) => Ok(GoodboyIgnoreStatus {
            source: GoodboyIgnoreSource::NotIgnored,
            path: None,
            line: None,
        }),
        _ => Ok(GoodboyIgnoreStatus {
            source: GoodboyIgnoreSource::Unknown,
            path: None,
            line: None,
        }),
    }
}

fn refuse_symlink(path: &Path) -> Result<(), GoodboyIgnoreError> {
    let is_symlink = std::fs::symlink_metadata(path)
        .map(|meta| meta.file_type().is_symlink())
        .unwrap_or(false);
    if is_symlink {
        return Err(GoodboyIgnoreError::SymlinkRefused);
    }
    Ok(())
}

fn append_entry_once(path: &Path) -> Result<(), GoodboyIgnoreError> {
    let mut next = std::fs::read_to_string(path).unwrap_or_default();
    if next.lines().any(|line| line.trim() == GITIGNORE_ENTRY) {
        return Ok(());
    }
    if !next.is_empty() && !next.ends_with('\n') {
        next.push('\n');
    }
    next.push_str(GITIGNORE_ENTRY);
    next.push('\n');
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::write(path, next)?;
    Ok(())
}

fn write_project_gitignore(repo_root: &Path) -> Result<(), GoodboyIgnoreError> {
    let path = repo_root.join(".gitignore");
    refuse_symlink(&path)?;
    append_entry_once(&path)
}

fn write_global_ignore(home: &Path) -> Result<(), GoodboyIgnoreError> {
    append_entry_once(&global_excludes_path(home))
}

pub(crate) fn apply(
    repo_root: &Path,
    home: &Path,
    target: &str,
) -> Result<GoodboyIgnoreStatus, GoodboyIgnoreError> {
    match target {
        "this-mac" => ensure_goodboy_excluded(repo_root),
        "project" => {
            write_project_gitignore(repo_root)?;
            remove_goodboy_exclude_entry(repo_root);
        }
        "global" => {
            write_global_ignore(home)?;
            remove_goodboy_exclude_entry(repo_root);
        }
        other => return Err(GoodboyIgnoreError::UnknownTarget(other.to_string())),
    }
    check_status(repo_root, home)
}

pub(crate) fn probe_ignored(repo_root: &Path, home: &Path) -> bool {
    check_status(repo_root, home)
        .map(|status| status.is_ignored())
        .unwrap_or(false)
}

fn goodboy_ignore_status_blocking(
    repo_path: String,
    home: PathBuf,
) -> Result<GoodboyIgnoreStatusDto, GoodboyIgnoreError> {
    check_status(Path::new(&repo_path), &home).map(GoodboyIgnoreStatus::into_dto)
}

#[tauri::command]
pub async fn goodboy_ignore_status(
    repo_path: String,
) -> Result<GoodboyIgnoreStatusDto, GoodboyIgnoreError> {
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("/"));
    tauri::async_runtime::spawn_blocking(move || goodboy_ignore_status_blocking(repo_path, home))
        .await
        .map_err(|e| GoodboyIgnoreError::Io(std::io::Error::other(e.to_string())))?
}

#[derive(Debug, Deserialize)]
pub struct GoodboyIgnoreApplyArgs {
    #[serde(rename = "repoPath")]
    pub repo_path: String,
    pub target: String,
}

fn goodboy_ignore_apply_blocking(
    args: GoodboyIgnoreApplyArgs,
    home: PathBuf,
) -> Result<GoodboyIgnoreStatusDto, GoodboyIgnoreError> {
    apply(Path::new(&args.repo_path), &home, &args.target).map(GoodboyIgnoreStatus::into_dto)
}

#[tauri::command]
pub async fn goodboy_ignore_apply(
    args: GoodboyIgnoreApplyArgs,
) -> Result<GoodboyIgnoreStatusDto, GoodboyIgnoreError> {
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("/"));
    tauri::async_runtime::spawn_blocking(move || goodboy_ignore_apply_blocking(args, home))
        .await
        .map_err(|e| GoodboyIgnoreError::Io(std::io::Error::other(e.to_string())))?
}

#[cfg(test)]
mod tests {
    use super::{apply, check_status, GoodboyIgnoreSource};
    use std::path::PathBuf;

    fn test_home(name: &str) -> PathBuf {
        let home = std::env::temp_dir().join(format!(
            "goodboy-ignore-home-{name}-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        std::fs::create_dir_all(home.join(".config").join("git")).unwrap();
        home
    }

    fn test_repo(name: &str) -> PathBuf {
        let root = std::env::temp_dir().join(format!(
            "goodboy-ignore-repo-{name}-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        std::fs::create_dir_all(&root).unwrap();
        crate::path_env::command("git")
            .args(["init", "-q"])
            .current_dir(&root)
            .output()
            .unwrap();
        root
    }

    #[test]
    fn reports_not_ignored_with_no_rule_anywhere() {
        let home = test_home("bare");
        let repo = test_repo("bare");

        let status = check_status(&repo, &home).unwrap();

        assert_eq!(status.source, GoodboyIgnoreSource::NotIgnored);
        std::fs::remove_dir_all(&home).unwrap();
        std::fs::remove_dir_all(&repo).unwrap();
    }

    #[test]
    fn reports_not_ignored_even_though_the_folder_does_not_exist_yet() {
        let home = test_home("absent-folder");
        let repo = test_repo("absent-folder");
        assert!(!repo.join(".goodboy").exists());

        let status = check_status(&repo, &home).unwrap();

        assert_eq!(status.source, GoodboyIgnoreSource::NotIgnored);
        std::fs::remove_dir_all(&home).unwrap();
        std::fs::remove_dir_all(&repo).unwrap();
    }

    #[test]
    fn detects_the_project_gitignore() {
        let home = test_home("gitignore");
        let repo = test_repo("gitignore");
        std::fs::write(repo.join(".gitignore"), "/.goodboy/\n").unwrap();

        let status = check_status(&repo, &home).unwrap();

        assert_eq!(status.source, GoodboyIgnoreSource::GitIgnore);
        assert_eq!(status.line, Some(1));
        std::fs::remove_dir_all(&home).unwrap();
        std::fs::remove_dir_all(&repo).unwrap();
    }

    #[test]
    fn detects_info_exclude_after_applying_this_mac() {
        let home = test_home("info-exclude");
        let repo = test_repo("info-exclude");

        let status = apply(&repo, &home, "this-mac").unwrap();

        assert_eq!(status.source, GoodboyIgnoreSource::InfoExclude);
        std::fs::remove_dir_all(&home).unwrap();
        std::fs::remove_dir_all(&repo).unwrap();
    }

    #[test]
    fn detects_the_global_ignore_file_after_applying_global() {
        let home = test_home("global");
        let repo = test_repo("global");

        let status = apply(&repo, &home, "global").unwrap();

        assert_eq!(status.source, GoodboyIgnoreSource::Global);
        std::fs::remove_dir_all(&home).unwrap();
        std::fs::remove_dir_all(&repo).unwrap();
    }

    #[test]
    fn switching_to_project_removes_the_this_mac_entry() {
        let home = test_home("switch");
        let repo = test_repo("switch");
        apply(&repo, &home, "this-mac").unwrap();

        let status = apply(&repo, &home, "project").unwrap();

        assert_eq!(status.source, GoodboyIgnoreSource::GitIgnore);
        let exclude = crate::worktree::exclude_file_path(&repo).unwrap();
        let contents = std::fs::read_to_string(&exclude).unwrap_or_default();
        assert!(!contents.lines().any(|line| line.trim() == "/.goodboy/"));
        std::fs::remove_dir_all(&home).unwrap();
        std::fs::remove_dir_all(&repo).unwrap();
    }

    #[test]
    fn refuses_a_symlinked_project_gitignore() {
        if !cfg!(unix) {
            return;
        }
        let home = test_home("symlink");
        let repo = test_repo("symlink");
        std::os::unix::fs::symlink(repo.join("missing"), repo.join(".gitignore")).unwrap();

        let err = apply(&repo, &home, "project").unwrap_err();

        assert!(matches!(err, super::GoodboyIgnoreError::SymlinkRefused));
        std::fs::remove_dir_all(&home).unwrap();
        std::fs::remove_dir_all(&repo).unwrap();
    }
}
