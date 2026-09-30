use super::plan::plan_error;
use super::reservation::{
    created_admin_dir, discard_copy, held_locks, is_held, is_owned_copy, is_real_dir,
    is_regular_file, open_lock, owner_repo, owner_text, recorded_admin_dir, remove_reservation,
    reservation_root_of, reservations_dir, COPY_PREFIX, RESERVATION_FILE,
};
use super::trial::TRIAL_SLUG_PREFIX;
use crate::worktree::{git, WorktreeError};
use serde::Serialize;
use std::path::{Path, PathBuf};

const STALE_TRIAL_SECS: u64 = 10 * 60;

const STALE_REWRITER_SECS: u64 = 24 * 60 * 60;

pub(super) struct CopyGuard {
    pub(super) root: PathBuf,
    pub(super) lock: Option<std::fs::File>,
    pub(super) is_kept: bool,
}

impl Drop for CopyGuard {
    fn drop(&mut self) {
        let lock = self.lock.take();
        if !self.is_kept {
            remove_reservation(&self.root, lock);
            return;
        }
        if let (Some(lock), Ok(mut held)) = (lock, held_locks().lock()) {
            held.insert(self.root.clone(), lock);
        }
    }
}

fn common_dir_of(cwd: &Path) -> Result<PathBuf, WorktreeError> {
    let raw = git(cwd, &["rev-parse", "--git-common-dir"])?;
    let path = PathBuf::from(raw.trim());
    let absolute = if path.is_absolute() {
        path
    } else {
        cwd.join(path)
    };
    Ok(std::fs::canonicalize(absolute)?)
}

pub(super) fn create_copy(
    cwd: &Path,
    copy: &Path,
    start: &str,
) -> Result<CopyGuard, WorktreeError> {
    let root = reservation_root_of(copy)
        .filter(|root| root.is_absolute())
        .ok_or_else(|| plan_error("the temporary copy has no reserved folder"))?;
    let repo = common_dir_of(cwd)?;
    if let Some(parent) = root.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::create_dir(&root).map_err(|_| {
        plan_error("a folder already sits where the temporary copy goes, so nothing was changed")
    })?;
    let written = std::fs::write(root.join(RESERVATION_FILE), owner_text(&repo, None));
    let lock = open_lock(&root);
    if written.is_err() || lock.is_none() {
        let _ = std::fs::remove_dir_all(&root);
        return Err(plan_error("couldn't reserve the temporary copy"));
    }
    let guard = CopyGuard {
        root,
        lock,
        is_kept: false,
    };
    let copy_text = copy.to_string_lossy().to_string();
    let added = git(
        cwd,
        &[
            "-c",
            "worktree.useRelativePaths=false",
            "worktree",
            "add",
            "--detach",
            "--quiet",
            &copy_text,
            start,
        ],
    );
    let recorded = created_admin_dir(copy, &repo).is_some_and(|admin| {
        let staged = guard.root.join(format!("{RESERVATION_FILE}.next"));
        std::fs::write(&staged, owner_text(&repo, Some(&admin))).is_ok()
            && std::fs::rename(&staged, guard.root.join(RESERVATION_FILE)).is_ok()
            && recorded_admin_dir(&guard.root).as_deref() == Some(admin.as_path())
    });
    if !recorded {
        let _ = git(cwd, &["worktree", "remove", "--force", &copy_text]);
    }
    added?;
    if !recorded {
        return Err(plan_error("couldn't record the temporary copy"));
    }
    Ok(guard)
}

fn age_secs(path: &Path) -> u64 {
    std::fs::metadata(path)
        .and_then(|meta| meta.modified())
        .ok()
        .and_then(|modified| modified.elapsed().ok())
        .map(|elapsed| elapsed.as_secs())
        .unwrap_or_default()
}

pub(crate) fn clean_stale_copies_in(
    dir: &Path,
    trial_after_secs: u64,
    other_after_secs: u64,
) -> usize {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return 0;
    };
    let mut cleaned = 0;
    for entry in entries.flatten() {
        let name = entry.file_name().to_string_lossy().to_string();
        let Some(slug) = name.strip_prefix(COPY_PREFIX) else {
            continue;
        };
        let root = entry.path();
        if owner_repo(&root).is_none() || is_held(&root) {
            continue;
        }
        let limit = if slug.starts_with(TRIAL_SLUG_PREFIX) {
            trial_after_secs
        } else {
            other_after_secs
        };
        if age_secs(&root.join(RESERVATION_FILE)) < limit {
            continue;
        }
        let Some(lock) = open_lock(&root) else {
            continue;
        };
        if remove_reservation(&root, Some(lock)) {
            cleaned += 1;
        }
    }
    cleaned
}

pub(crate) fn clean_stale_copies() {
    let dir = reservations_dir();
    if dir.is_absolute() {
        clean_stale_copies_in(&dir, STALE_TRIAL_SECS, STALE_REWRITER_SECS);
    }
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CopyGitDirs {
    pub git_dir: String,
    pub objects_dir: String,
    pub packed_refs_lock: String,
}

pub(crate) fn copy_git_dirs(copy: &Path) -> Option<CopyGitDirs> {
    let root = reservation_root_of(copy)?;
    let repo = owner_repo(&root)?;
    if !is_regular_file(&copy.join(".git")) {
        return None;
    }
    let admin = recorded_admin_dir(&root)?;
    let objects = repo.join("objects");
    if !is_real_dir(&objects) {
        return None;
    }
    Some(CopyGitDirs {
        git_dir: admin.to_string_lossy().to_string(),
        objects_dir: objects.to_string_lossy().to_string(),
        packed_refs_lock: repo.join("packed-refs.lock").to_string_lossy().to_string(),
    })
}

#[tauri::command]
pub async fn history_copy_git_dirs(copy_path: String) -> Option<CopyGitDirs> {
    tauri::async_runtime::spawn_blocking(move || copy_git_dirs(Path::new(&copy_path)))
        .await
        .ok()
        .flatten()
}

#[tauri::command]
pub async fn history_copy_discard(
    worktree_path: String,
    copy_path: String,
) -> Result<(), WorktreeError> {
    tauri::async_runtime::spawn_blocking(move || {
        let cwd = PathBuf::from(&worktree_path);
        if !cwd.exists() {
            return Err(WorktreeError::RepoNotFound(worktree_path));
        }
        if !is_owned_copy(Path::new(&copy_path)) {
            return Err(plan_error("that folder is not a history copy Goodboy made"));
        }
        discard_copy(&copy_path);
        Ok(())
    })
    .await
    .map_err(|e| WorktreeError::Io(std::io::Error::other(e.to_string())))?
}

#[cfg(test)]
mod tests;
