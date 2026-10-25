use super::base::{normalized_base, resolve_base};
use super::error::WorktreeError;
use super::git::{commit_exists, git};
use super::snapshot::{dirty_paths, hash_of, SnapshotEntry, SNAPSHOT_FILE_LIMIT};
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BTreeSet};
use std::path::Path;

const COUNT_LIMIT_BYTES: u64 = 1_048_576;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TurnBefore {
    pub head: String,
    pub entries: Vec<SnapshotEntry>,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct TurnFile {
    pub path: String,
    pub status: &'static str,
    pub additions: Option<u32>,
    pub deletions: Option<u32>,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct TurnFiles {
    pub own: Vec<TurnFile>,
    pub from_base: Vec<String>,
    pub is_partial: bool,
}

fn split_paths(raw: &str) -> BTreeSet<String> {
    raw.split('\0')
        .filter(|path| !path.is_empty())
        .map(str::to_string)
        .collect()
}

fn committed_paths(cwd: &Path, before_head: &str, head: &str) -> BTreeSet<String> {
    if before_head.is_empty() || before_head == head || !commit_exists(cwd, before_head) {
        return BTreeSet::new();
    }
    git(cwd, &["diff", "--name-only", "-z", before_head, head])
        .map(|raw| split_paths(&raw))
        .unwrap_or_default()
}

fn branch_own_paths(cwd: &Path, base_branch: Option<&str>) -> Option<BTreeSet<String>> {
    let (_, merge_base) = resolve_base(cwd, normalized_base(base_branch))?;
    git(cwd, &["diff", "--name-only", "-z", &merge_base, "HEAD"])
        .ok()
        .map(|raw| split_paths(&raw))
}

fn dirty_changed(cwd: &Path, before: &TurnBefore) -> Result<BTreeSet<String>, WorktreeError> {
    let porcelain = git(
        cwd,
        &["status", "--porcelain=v1", "-z", "--untracked-files=all"],
    )?;
    let before_hashes: BTreeMap<&str, &str> = before
        .entries
        .iter()
        .map(|entry| (entry.path.as_str(), entry.hash.as_str()))
        .collect();
    Ok(dirty_paths(&porcelain)
        .into_iter()
        .filter(|path| before_hashes.get(path.as_str()) != Some(&hash_of(cwd, path).as_str()))
        .collect())
}

fn existed_before(cwd: &Path, before_head: &str, path: &str) -> bool {
    !before_head.is_empty()
        && git(cwd, &["cat-file", "-e", &format!("{before_head}:{path}")]).is_ok()
}

fn untracked_lines(path: &Path) -> Option<u32> {
    let meta = std::fs::symlink_metadata(path).ok()?;
    if !meta.is_file() || meta.len() > COUNT_LIMIT_BYTES {
        return None;
    }
    let bytes = std::fs::read(path).ok()?;
    if bytes.contains(&0) {
        return None;
    }
    Some(String::from_utf8_lossy(&bytes).lines().count() as u32)
}

fn counts_of(cwd: &Path, before_head: &str, path: &str) -> (Option<u32>, Option<u32>) {
    if before_head.is_empty() {
        return (untracked_lines(&cwd.join(path)), Some(0));
    }
    let tracked = git(cwd, &["diff", "--numstat", before_head, "--", path])
        .ok()
        .and_then(|raw| {
            let line = raw.lines().next()?;
            let mut parts = line.splitn(3, '\t');
            let added = parts.next()?.parse::<u32>().ok()?;
            let removed = parts.next()?.parse::<u32>().ok()?;
            Some((added, removed))
        });
    if let Some((added, removed)) = tracked {
        return (Some(added), Some(removed));
    }
    if git(cwd, &["ls-files", "--error-unmatch", "--", path]).is_ok() {
        return (None, None);
    }
    (untracked_lines(&cwd.join(path)), Some(0))
}

fn file_of(cwd: &Path, before_head: &str, path: &str) -> TurnFile {
    let is_present = cwd.join(path).is_file();
    let status = match (is_present, existed_before(cwd, before_head, path)) {
        (false, _) => "deleted",
        (true, false) => "added",
        (true, true) => "modified",
    };
    let (additions, deletions) = counts_of(cwd, before_head, path);
    TurnFile {
        path: path.to_string(),
        status,
        additions,
        deletions,
    }
}

pub(super) fn worktree_turn_files_blocking(
    worktree_path: String,
    before: TurnBefore,
    base_branch: Option<String>,
) -> Result<TurnFiles, WorktreeError> {
    let cwd = Path::new(&worktree_path);
    if !cwd.exists() {
        return Err(WorktreeError::RepoNotFound(worktree_path));
    }
    let head = git(cwd, &["rev-parse", "HEAD"])
        .map(|out| out.trim().to_string())
        .unwrap_or_default();
    let committed = committed_paths(cwd, &before.head, &head);
    let edited = dirty_changed(cwd, &before)?;
    let branch_own = branch_own_paths(cwd, base_branch.as_deref());
    let mut own_paths: BTreeSet<String> = edited.clone();
    let mut from_base: Vec<String> = Vec::new();
    for path in committed {
        let is_branch_own = branch_own
            .as_ref()
            .is_none_or(|owned| owned.contains(&path));
        if is_branch_own || edited.contains(&path) {
            own_paths.insert(path);
            continue;
        }
        from_base.push(path);
    }
    let is_partial = own_paths.len() > SNAPSHOT_FILE_LIMIT;
    let own = own_paths
        .iter()
        .take(SNAPSHOT_FILE_LIMIT)
        .map(|path| file_of(cwd, &before.head, path))
        .collect();
    Ok(TurnFiles {
        own,
        from_base,
        is_partial,
    })
}

#[tauri::command]
pub async fn worktree_turn_files(
    worktree_path: String,
    before: TurnBefore,
    base_branch: Option<String>,
) -> Result<TurnFiles, WorktreeError> {
    tauri::async_runtime::spawn_blocking(move || {
        worktree_turn_files_blocking(worktree_path, before, base_branch)
    })
    .await
    .map_err(|e| WorktreeError::Io(std::io::Error::other(e.to_string())))?
}

#[cfg(test)]
mod tests;
