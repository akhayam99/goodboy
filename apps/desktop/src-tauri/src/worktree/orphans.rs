use super::error::WorktreeError;
use super::git::git;
use super::inspect::parse_porcelain;
use super::types::WorktreeDirectorySize;
use serde::Serialize;
use std::path::{Path, PathBuf};

pub(super) const WORKTREE_PARENT: [&str; 2] = [".goodboy", "worktrees"];

#[derive(Debug, Serialize, PartialEq, Eq)]
pub struct OrphanWorktree {
    pub path: String,
    pub name: String,
    #[serde(rename = "isRegistered")]
    pub is_registered: bool,
}

pub(super) fn worktrees_parent(repo_path: &Path) -> PathBuf {
    repo_path.join(WORKTREE_PARENT[0]).join(WORKTREE_PARENT[1])
}

fn canonical_key(path: &Path) -> String {
    std::fs::canonicalize(path)
        .unwrap_or_else(|_| path.to_path_buf())
        .to_string_lossy()
        .into_owned()
}

pub(crate) fn directory_size(path: &Path) -> (Option<u64>, bool) {
    let entries = match std::fs::read_dir(path) {
        Ok(found) => found,
        Err(_) => return (None, true),
    };
    let mut total = 0u64;
    let mut is_partial = false;
    for entry in entries {
        let entry = match entry {
            Ok(found) => found,
            Err(_) => {
                is_partial = true;
                continue;
            }
        };
        let file_type = match entry.file_type() {
            Ok(found) => found,
            Err(_) => {
                is_partial = true;
                continue;
            }
        };
        if file_type.is_symlink() {
            continue;
        }
        if file_type.is_dir() {
            let (size, child_partial) = directory_size(&entry.path());
            is_partial = is_partial || child_partial;
            if let Some(found) = size {
                total = total.saturating_add(found);
            }
            continue;
        }
        if !file_type.is_file() {
            continue;
        }
        match entry.metadata() {
            Ok(meta) => total = total.saturating_add(allocated_bytes(&meta)),
            Err(_) => is_partial = true,
        }
    }
    (Some(total), is_partial)
}

#[cfg(unix)]
pub(crate) fn allocated_bytes(meta: &std::fs::Metadata) -> u64 {
    use std::os::unix::fs::MetadataExt;
    meta.blocks().saturating_mul(512)
}

#[cfg(not(unix))]
pub(crate) fn allocated_bytes(meta: &std::fs::Metadata) -> u64 {
    meta.len()
}

pub(super) fn worktree_directory_size_blocking(path: String) -> WorktreeDirectorySize {
    let target = Path::new(&path);
    let metadata = match std::fs::symlink_metadata(target) {
        Ok(found) => found,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            return WorktreeDirectorySize {
                path,
                size_bytes: None,
                is_partial: false,
                exists: false,
            };
        }
        Err(_) => {
            return WorktreeDirectorySize {
                path,
                size_bytes: None,
                is_partial: true,
                exists: true,
            };
        }
    };
    if !metadata.is_dir() || metadata.file_type().is_symlink() {
        return WorktreeDirectorySize {
            path,
            size_bytes: None,
            is_partial: true,
            exists: true,
        };
    }
    let (size_bytes, is_partial) = directory_size(target);
    WorktreeDirectorySize {
        path,
        size_bytes,
        is_partial,
        exists: true,
    }
}

#[tauri::command]
pub async fn worktree_directory_size(path: String) -> Result<WorktreeDirectorySize, WorktreeError> {
    tauri::async_runtime::spawn_blocking(move || worktree_directory_size_blocking(path))
        .await
        .map_err(|e| WorktreeError::Io(std::io::Error::other(e.to_string())))
}

pub(crate) fn collect_orphans(
    repo_path: &Path,
    registered: &[String],
    known_paths: &[String],
) -> Vec<OrphanWorktree> {
    let parent = worktrees_parent(repo_path);
    let parent_key = canonical_key(&parent);
    let claimed: std::collections::HashSet<String> = known_paths
        .iter()
        .map(|p| canonical_key(Path::new(p)))
        .collect();
    let registered_keys: std::collections::HashSet<String> = registered
        .iter()
        .map(|p| canonical_key(Path::new(p)))
        .collect();
    let mut candidates: Vec<PathBuf> = std::fs::read_dir(&parent)
        .map(|entries| {
            entries
                .flatten()
                .map(|entry| entry.path())
                .filter(|path| path.is_dir())
                .collect()
        })
        .unwrap_or_default();
    for path in registered.iter().map(PathBuf::from) {
        let inside = path
            .parent()
            .map(|dir| canonical_key(dir) == parent_key)
            .unwrap_or(false);
        if !inside || !path.is_dir() {
            continue;
        }
        if candidates
            .iter()
            .any(|known| canonical_key(known) == canonical_key(&path))
        {
            continue;
        }
        candidates.push(path);
    }
    let mut orphans: Vec<OrphanWorktree> = candidates
        .into_iter()
        .filter(|path| !claimed.contains(&canonical_key(path)))
        .map(|path| OrphanWorktree {
            name: path
                .file_name()
                .map(|name| name.to_string_lossy().into_owned())
                .unwrap_or_default(),
            is_registered: registered_keys.contains(&canonical_key(&path)),
            path: path.to_string_lossy().into_owned(),
        })
        .collect();
    orphans.sort_by(|a, b| a.path.cmp(&b.path));
    orphans
}

#[tauri::command]
pub async fn worktree_orphans(
    repo_path: String,
    known_paths: Vec<String>,
) -> Result<Vec<OrphanWorktree>, WorktreeError> {
    tauri::async_runtime::spawn_blocking(move || {
        let repo = Path::new(&repo_path);
        if !worktrees_parent(repo).is_dir() {
            return Ok(Vec::new());
        }
        let registered: Vec<String> = git(repo, &["worktree", "list", "--porcelain"])
            .map(|stdout| {
                parse_porcelain(&stdout)
                    .into_iter()
                    .filter(|entry| !entry.is_main)
                    .map(|entry| entry.path)
                    .collect()
            })
            .unwrap_or_default();
        Ok(collect_orphans(repo, &registered, &known_paths))
    })
    .await
    .map_err(|e| WorktreeError::Git {
        message: e.to_string(),
    })?
}
