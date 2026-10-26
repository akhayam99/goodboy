use super::error::WorktreeError;
use super::git::git;
use super::orphans::{worktrees_parent, WORKTREE_PARENT};
use std::path::{Path, PathBuf};

pub(crate) fn exclude_file_path(repo_path: &Path) -> Option<PathBuf> {
    let raw = git(repo_path, &["rev-parse", "--git-common-dir"]).ok()?;
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return None;
    }
    let dir = PathBuf::from(trimmed);
    let resolved = if dir.is_absolute() {
        dir
    } else {
        repo_path.join(dir)
    };
    Some(resolved.join("info").join("exclude"))
}

pub(crate) fn remove_goodboy_exclude_entry(repo_path: &Path) {
    let Some(file) = exclude_file_path(repo_path) else {
        return;
    };
    let _ = crate::ignore_file::remove_goodboy_entries(&file);
}

pub(crate) fn tidy_goodboy_dir(repo_path: &Path) {
    let _ = std::fs::remove_dir(worktrees_parent(repo_path));
    let goodboy_dir = repo_path.join(WORKTREE_PARENT[0]);
    let _ = std::fs::remove_dir(&goodboy_dir);
    if goodboy_dir.exists() {
        return;
    }
    remove_goodboy_exclude_entry(repo_path);
}

#[tauri::command]
pub async fn worktree_tidy_goodboy(repo_path: String) -> Result<(), WorktreeError> {
    tauri::async_runtime::spawn_blocking(move || worktree_tidy_goodboy_blocking(repo_path))
        .await
        .map_err(|e| WorktreeError::Io(std::io::Error::other(e.to_string())))?
}

fn worktree_tidy_goodboy_blocking(repo_path: String) -> Result<(), WorktreeError> {
    tidy_goodboy_dir(Path::new(&repo_path));
    crate::history::prune_backups(Path::new(&repo_path));
    Ok(())
}

pub(crate) fn ensure_goodboy_excluded(repo_path: &Path) {
    let Some(file) = exclude_file_path(repo_path) else {
        return;
    };
    let _ = crate::ignore_file::append_ignore_entries(
        &file,
        &[crate::ignore_file::GOODBOY_IGNORE_ENTRY],
    );
}

#[cfg(test)]
mod tests;
