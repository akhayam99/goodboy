use super::error::WorktreeError;
use super::git::{git, resolve_commit};
use super::slug::sanitize_slug;
use std::path::{Path, PathBuf};

#[tauri::command]
pub async fn worktree_scratch_add(
    worktree_path: String,
    sha: String,
    slug: String,
) -> Result<String, WorktreeError> {
    tauri::async_runtime::spawn_blocking(move || {
        worktree_scratch_add_blocking(worktree_path, sha, slug)
    })
    .await
    .map_err(|e| WorktreeError::Io(std::io::Error::other(e.to_string())))?
}

fn scratch_path_of(slug: &str) -> PathBuf {
    std::env::temp_dir().join(format!("goodboy-check-{}", sanitize_slug(slug)))
}

fn discard_scratch(cwd: &Path, path: &str) {
    crate::logging::note_failure(
        "scratch worktree remove",
        git(cwd, &["worktree", "remove", "--force", path]),
    );
    if Path::new(path).exists() {
        crate::logging::note_failure("scratch folder delete", std::fs::remove_dir_all(path));
    }
    crate::logging::note_failure("scratch worktree prune", git(cwd, &["worktree", "prune"]));
}

fn worktree_scratch_add_blocking(
    worktree_path: String,
    sha: String,
    slug: String,
) -> Result<String, WorktreeError> {
    let p = Path::new(&worktree_path);
    if !p.exists() {
        return Err(WorktreeError::RepoNotFound(worktree_path));
    }
    let commit = resolve_commit(p, sha.trim())?;
    let dir = scratch_path_of(&slug);
    let dir_path = dir.to_string_lossy().to_string();
    discard_scratch(p, &dir_path);
    git(
        p,
        &["worktree", "add", "--detach", "--quiet", &dir_path, &commit],
    )?;
    Ok(dir_path)
}

#[tauri::command]
pub async fn worktree_scratch_remove(
    worktree_path: String,
    scratch_path: String,
) -> Result<(), WorktreeError> {
    tauri::async_runtime::spawn_blocking(move || {
        worktree_scratch_remove_blocking(worktree_path, scratch_path)
    })
    .await
    .map_err(|e| WorktreeError::Io(std::io::Error::other(e.to_string())))?
}

fn worktree_scratch_remove_blocking(
    worktree_path: String,
    scratch_path: String,
) -> Result<(), WorktreeError> {
    let p = Path::new(&worktree_path);
    if !p.exists() {
        return Err(WorktreeError::RepoNotFound(worktree_path));
    }
    discard_scratch(p, &scratch_path);
    Ok(())
}
