use super::error::WorktreeError;
use super::git::git;
use serde::{Deserialize, Serialize};
use std::path::Path;

pub(super) const SNAPSHOT_FILE_LIMIT: usize = 2000;
const DELETED: &str = "deleted";

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SnapshotEntry {
    pub path: String,
    pub hash: String,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct WorktreeSnapshot {
    pub head: String,
    pub entries: Vec<SnapshotEntry>,
    pub is_partial: bool,
}

pub(super) fn dirty_paths(porcelain_z: &str) -> Vec<String> {
    let mut paths: Vec<String> = Vec::new();
    let mut fields = porcelain_z.split('\0');
    while let Some(field) = fields.next() {
        if field.len() < 4 {
            continue;
        }
        let status = &field[..2];
        let path = field[3..].to_string();
        if status.contains('R') || status.contains('C') {
            fields.next();
        }
        if !paths.contains(&path) {
            paths.push(path);
        }
    }
    paths.sort();
    paths
}

pub(super) fn hash_of(cwd: &Path, path: &str) -> String {
    if !cwd.join(path).is_file() {
        return DELETED.to_string();
    }
    git(cwd, &["hash-object", "--", path])
        .map(|out| out.trim().to_string())
        .unwrap_or_else(|_| DELETED.to_string())
}

pub(super) fn worktree_snapshot_blocking(
    worktree_path: String,
) -> Result<WorktreeSnapshot, WorktreeError> {
    let p = Path::new(&worktree_path);
    if !p.exists() {
        return Err(WorktreeError::RepoNotFound(worktree_path));
    }
    let head = git(p, &["rev-parse", "HEAD"])
        .map(|out| out.trim().to_string())
        .unwrap_or_default();
    let porcelain = git(
        p,
        &["status", "--porcelain=v1", "-z", "--untracked-files=all"],
    )?;
    let paths = dirty_paths(&porcelain);
    let is_partial = paths.len() > SNAPSHOT_FILE_LIMIT;
    let entries = paths
        .iter()
        .take(SNAPSHOT_FILE_LIMIT)
        .map(|path| SnapshotEntry {
            path: path.clone(),
            hash: hash_of(p, path),
        })
        .collect();
    Ok(WorktreeSnapshot {
        head,
        entries,
        is_partial,
    })
}

#[tauri::command]
pub async fn worktree_snapshot(worktree_path: String) -> Result<WorktreeSnapshot, WorktreeError> {
    tauri::async_runtime::spawn_blocking(move || worktree_snapshot_blocking(worktree_path))
        .await
        .map_err(|e| WorktreeError::Io(std::io::Error::other(e.to_string())))?
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::process::Command;

    fn sh(cwd: &Path, args: &[&str]) {
        let status = Command::new("git")
            .current_dir(cwd)
            .args(args)
            .env("GIT_AUTHOR_NAME", "Harborline")
            .env("GIT_AUTHOR_EMAIL", "dev@harborline.test")
            .env("GIT_COMMITTER_NAME", "Harborline")
            .env("GIT_COMMITTER_EMAIL", "dev@harborline.test")
            .status()
            .expect("git runs");
        assert!(status.success(), "git {args:?} failed");
    }

    fn repo(name: &str) -> std::path::PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "goodboy-snapshot-{name}-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|elapsed| elapsed.as_nanos())
                .unwrap_or_default()
        ));
        std::fs::create_dir_all(&dir).expect("dir");
        sh(&dir, &["init", "-q", "-b", "main"]);
        std::fs::write(dir.join("kept.txt"), "kept\n").expect("write");
        std::fs::write(dir.join("changed.txt"), "before\n").expect("write");
        sh(&dir, &["add", "-A"]);
        sh(&dir, &["commit", "-q", "-m", "first"]);
        dir
    }

    #[test]
    fn porcelain_paths_follow_renames_and_dedupe() {
        let raw = " M changed.txt\0?? new file.txt\0R  moved.txt\0old.txt\0";

        assert_eq!(
            dirty_paths(raw),
            vec![
                "changed.txt".to_string(),
                "moved.txt".to_string(),
                "new file.txt".to_string()
            ]
        );
        assert!(dirty_paths("").is_empty());
    }

    #[test]
    fn a_clean_tree_has_a_head_and_no_entries() {
        let dir = repo("clean");

        let snapshot = worktree_snapshot_blocking(dir.to_string_lossy().into_owned()).expect("ok");

        assert_eq!(snapshot.head.len(), 40);
        assert!(snapshot.entries.is_empty());
        assert!(!snapshot.is_partial);
        std::fs::remove_dir_all(&dir).expect("cleanup");
    }

    #[test]
    fn edits_new_files_and_deletions_each_get_a_hash_and_an_untouched_file_none() {
        let dir = repo("dirty");
        std::fs::write(dir.join("changed.txt"), "after\n").expect("write");
        std::fs::write(dir.join("fresh.txt"), "fresh\n").expect("write");
        std::fs::remove_file(dir.join("kept.txt")).expect("remove");

        let snapshot = worktree_snapshot_blocking(dir.to_string_lossy().into_owned()).expect("ok");

        let by_path: std::collections::BTreeMap<&str, &str> = snapshot
            .entries
            .iter()
            .map(|entry| (entry.path.as_str(), entry.hash.as_str()))
            .collect();
        assert_eq!(by_path.len(), 3);
        assert_eq!(by_path["kept.txt"], DELETED);
        assert_eq!(by_path["changed.txt"].len(), 40);
        assert_ne!(by_path["changed.txt"], by_path["fresh.txt"]);
        std::fs::remove_dir_all(&dir).expect("cleanup");
    }

    #[test]
    fn the_same_edit_hashes_the_same_and_a_second_edit_hashes_differently() {
        let dir = repo("stable");
        std::fs::write(dir.join("changed.txt"), "after\n").expect("write");
        let first = worktree_snapshot_blocking(dir.to_string_lossy().into_owned()).expect("ok");
        let again = worktree_snapshot_blocking(dir.to_string_lossy().into_owned()).expect("ok");
        std::fs::write(dir.join("changed.txt"), "after again\n").expect("write");
        let later = worktree_snapshot_blocking(dir.to_string_lossy().into_owned()).expect("ok");

        assert_eq!(first, again);
        assert_ne!(first.entries[0].hash, later.entries[0].hash);
        std::fs::remove_dir_all(&dir).expect("cleanup");
    }

    #[test]
    fn a_missing_folder_is_an_error() {
        assert!(worktree_snapshot_blocking("/no/such/worktree".to_string()).is_err());
    }
}
