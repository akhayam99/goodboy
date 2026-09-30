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
    let Ok(existing) = std::fs::read_to_string(&file) else {
        return;
    };
    let next: String = existing
        .lines()
        .filter(|line| {
            let trimmed = line.trim();
            trimmed != ".goodboy/" && trimmed != "/.goodboy/" && trimmed != ".goodboy"
        })
        .map(|line| format!("{line}\n"))
        .collect();
    if next != existing {
        let _ = std::fs::write(&file, next);
    }
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
    let existing = std::fs::read_to_string(&file).unwrap_or_default();
    let has_entry = existing.lines().any(|line| {
        let trimmed = line.trim();
        trimmed == ".goodboy/" || trimmed == "/.goodboy/" || trimmed == ".goodboy"
    });
    if has_entry {
        return;
    }
    let mut next = existing;
    if !next.is_empty() && !next.ends_with('\n') {
        next.push('\n');
    }
    next.push_str(".goodboy/\n");
    if let Some(parent) = file.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    let _ = std::fs::write(&file, next);
}

#[cfg(test)]
mod tests;
