use std::collections::HashMap;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::worktree::{
    canonical_path, contained_worktrees_parent, git, in_progress_operation,
    local_only_commit_count, parse_porcelain, parse_working_tree, GitWorkingTree, WorktreeError,
    WorktreeRemovalReason,
};

#[derive(Debug, Deserialize)]
pub struct FolderFactsRequest {
    #[serde(rename = "repoRoot")]
    pub repo_root: String,
    pub path: String,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
pub struct WorktreeFolderFacts {
    pub path: String,
    pub exists: bool,
    #[serde(rename = "isRegistered")]
    pub is_registered: bool,
    pub branch: Option<String>,
    #[serde(rename = "lastCommitAt")]
    pub last_commit_at: Option<i64>,
    #[serde(rename = "localOnlyCommits")]
    pub local_only_commits: Option<u32>,
    #[serde(rename = "changedFiles")]
    pub changed_files: u32,
    #[serde(rename = "changedSample")]
    pub changed_sample: Option<String>,
    pub reasons: Vec<WorktreeRemovalReason>,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
pub struct DiskFree {
    #[serde(rename = "freeBytes")]
    pub free_bytes: Option<u64>,
    #[serde(rename = "totalBytes")]
    pub total_bytes: Option<u64>,
}

type RunGit<'a> = &'a mut dyn FnMut(&Path, &[&str]) -> Result<String, WorktreeError>;

fn empty_facts(
    path: &str,
    exists: bool,
    reasons: Vec<WorktreeRemovalReason>,
) -> WorktreeFolderFacts {
    WorktreeFolderFacts {
        path: path.to_string(),
        exists,
        is_registered: false,
        branch: None,
        last_commit_at: None,
        local_only_commits: None,
        changed_files: 0,
        changed_sample: None,
        reasons,
    }
}

fn registered_worktrees(repo_root: &Path, run_git: RunGit) -> Vec<(PathBuf, Option<String>)> {
    run_git(repo_root, &["worktree", "list", "--porcelain"])
        .map(|stdout| {
            parse_porcelain(&stdout)
                .into_iter()
                .filter(|entry| !entry.is_main)
                .filter_map(|entry| {
                    let branch = entry
                        .branch
                        .map(|name| name.trim_start_matches("refs/heads/").to_string());
                    canonical_path(Path::new(&entry.path)).map(|path| (path, branch))
                })
                .collect()
        })
        .unwrap_or_default()
}

fn status_facts(
    folder: &Path,
    run_git: RunGit,
) -> (u32, Option<String>, Vec<WorktreeRemovalReason>) {
    let Ok(raw) = run_git(folder, &["status", "--porcelain=v1"]) else {
        return (0, None, vec![WorktreeRemovalReason::StatusUnavailable]);
    };
    let sample = raw
        .lines()
        .find(|line| line.len() > 3)
        .map(|line| line[3..].trim().to_string());
    let mut reasons = Vec::new();
    let mut changed_files = 0;
    if let GitWorkingTree::Known {
        staged,
        unstaged,
        untracked,
        unmerged,
        changed,
    } = parse_working_tree(&raw)
    {
        changed_files = changed;
        if staged > 0 {
            reasons.push(WorktreeRemovalReason::StagedChanges);
        }
        if unstaged > 0 {
            reasons.push(WorktreeRemovalReason::UnstagedChanges);
        }
        if untracked > 0 {
            reasons.push(WorktreeRemovalReason::UntrackedFiles);
        }
        if unmerged > 0 {
            reasons.push(WorktreeRemovalReason::UnmergedConflicts);
        }
    }
    if in_progress_operation(folder).is_some() {
        reasons.push(WorktreeRemovalReason::OperationInProgress);
    }
    (changed_files, sample, reasons)
}

fn last_commit_at(folder: &Path, run_git: RunGit) -> Option<i64> {
    run_git(folder, &["log", "-1", "--format=%ct"])
        .ok()
        .and_then(|raw| raw.trim().parse::<i64>().ok())
        .map(|seconds| seconds.saturating_mul(1000))
}

pub(crate) fn folder_facts_with(
    repo_root: &Path,
    path: &str,
    registered: &[(PathBuf, Option<String>)],
    run_git: RunGit,
    is_lease_live: &mut dyn FnMut(&Path) -> bool,
    local_only: &mut dyn FnMut(&Path) -> Option<u32>,
) -> WorktreeFolderFacts {
    let target = Path::new(path);
    let Some(parent) = contained_worktrees_parent(repo_root) else {
        return empty_facts(
            path,
            target.exists(),
            vec![WorktreeRemovalReason::OutsideWorktreeFolder],
        );
    };
    let is_symlink = std::fs::symlink_metadata(target)
        .map(|meta| meta.file_type().is_symlink())
        .unwrap_or(false);
    let Some(folder) = canonical_path(target).filter(|_| !is_symlink) else {
        let reasons = match target.exists() || is_symlink {
            true => vec![WorktreeRemovalReason::OutsideWorktreeFolder],
            false => Vec::new(),
        };
        return empty_facts(path, target.exists(), reasons);
    };
    if folder.parent() != Some(parent.as_path()) || !folder.is_dir() {
        return empty_facts(
            path,
            true,
            vec![WorktreeRemovalReason::OutsideWorktreeFolder],
        );
    }
    let mut reasons = Vec::new();
    if is_lease_live(&folder) {
        reasons.push(WorktreeRemovalReason::WriterLeaseHeld);
    }
    let Some((_, branch)) = registered.iter().find(|(entry, _)| entry == &folder) else {
        reasons.push(WorktreeRemovalReason::NotRegistered);
        return WorktreeFolderFacts {
            reasons,
            ..empty_facts(path, true, Vec::new())
        };
    };
    let (changed_files, changed_sample, status_reasons) = status_facts(&folder, run_git);
    reasons.extend(status_reasons);
    WorktreeFolderFacts {
        path: path.to_string(),
        exists: true,
        is_registered: true,
        branch: branch.clone(),
        last_commit_at: last_commit_at(&folder, run_git),
        local_only_commits: local_only(&folder),
        changed_files,
        changed_sample,
        reasons,
    }
}

fn folder_facts_blocking(
    requests: Vec<FolderFactsRequest>,
    is_lease_live: &mut dyn FnMut(&Path) -> bool,
) -> Vec<WorktreeFolderFacts> {
    let mut run_git = |cwd: &Path, args: &[&str]| git(cwd, args);
    let mut local_only = |folder: &Path| local_only_commit_count(folder);
    let mut registered: HashMap<String, Vec<(PathBuf, Option<String>)>> = HashMap::new();
    requests
        .iter()
        .map(|request| {
            let repo_root = Path::new(&request.repo_root);
            let entries = registered
                .entry(request.repo_root.clone())
                .or_insert_with(|| registered_worktrees(repo_root, &mut run_git));
            folder_facts_with(
                repo_root,
                &request.path,
                entries,
                &mut run_git,
                is_lease_live,
                &mut local_only,
            )
        })
        .collect()
}

#[tauri::command]
pub async fn worktree_folder_facts(
    leases: tauri::State<'_, crate::worktree_writer::WriterLeases>,
    requests: Vec<FolderFactsRequest>,
) -> Result<Vec<WorktreeFolderFacts>, WorktreeError> {
    let registry = leases.0.clone();
    tauri::async_runtime::spawn_blocking(move || {
        folder_facts_blocking(requests, &mut |target| {
            crate::worktree_writer::is_lease_live(&registry, target.to_string_lossy().as_ref())
        })
    })
    .await
    .map_err(|e| WorktreeError::Io(std::io::Error::other(e.to_string())))
}

#[cfg(unix)]
pub(crate) fn disk_free_blocking(path: &Path) -> DiskFree {
    use std::ffi::CString;
    use std::os::unix::ffi::OsStrExt;

    let unknown = DiskFree {
        free_bytes: None,
        total_bytes: None,
    };
    let Ok(c_path) = CString::new(path.as_os_str().as_bytes()) else {
        return unknown;
    };
    let mut stats: libc::statvfs = unsafe { std::mem::zeroed() };
    let status = unsafe { libc::statvfs(c_path.as_ptr(), &mut stats) };
    if status != 0 {
        return unknown;
    }
    let fragment = stats.f_frsize as u64;
    DiskFree {
        free_bytes: Some((stats.f_bavail as u64).saturating_mul(fragment)),
        total_bytes: Some((stats.f_blocks as u64).saturating_mul(fragment)),
    }
}

#[cfg(not(unix))]
pub(crate) fn disk_free_blocking(_path: &Path) -> DiskFree {
    DiskFree {
        free_bytes: None,
        total_bytes: None,
    }
}

#[tauri::command]
pub async fn disk_free(path: String) -> Result<DiskFree, WorktreeError> {
    tauri::async_runtime::spawn_blocking(move || disk_free_blocking(Path::new(&path)))
        .await
        .map_err(|e| WorktreeError::Io(std::io::Error::other(e.to_string())))
}

#[derive(Debug, Serialize, PartialEq, Eq)]
pub struct AppDataUsage {
    pub folder: String,
    #[serde(rename = "databaseBytes")]
    pub database_bytes: u64,
    #[serde(rename = "snapshotBytes")]
    pub snapshot_bytes: u64,
    #[serde(rename = "snapshotCount")]
    pub snapshot_count: u32,
}

fn file_bytes(path: &Path) -> u64 {
    std::fs::metadata(path)
        .map(|meta| crate::worktree::allocated_bytes(&meta))
        .unwrap_or(0)
}

pub(crate) fn app_data_usage_blocking(db_path: &Path) -> AppDataUsage {
    let folder = db_path
        .parent()
        .map(|parent| parent.to_string_lossy().into_owned())
        .unwrap_or_default();
    let database_bytes = ["", "-wal", "-shm"]
        .iter()
        .map(|suffix| {
            let mut name = db_path.as_os_str().to_os_string();
            name.push(suffix);
            file_bytes(Path::new(&name))
        })
        .sum();
    let snapshots =
        crate::db::db_list_migration_snapshots_blocking(db_path.to_path_buf()).unwrap_or_default();
    AppDataUsage {
        folder,
        database_bytes,
        snapshot_bytes: snapshots
            .iter()
            .map(|snapshot| file_bytes(Path::new(snapshot)))
            .sum(),
        snapshot_count: u32::try_from(snapshots.len()).unwrap_or(u32::MAX),
    }
}

#[tauri::command]
pub async fn app_data_usage(
    state: tauri::State<'_, crate::db::Db>,
) -> Result<AppDataUsage, WorktreeError> {
    let db_path = state.1.clone();
    tauri::async_runtime::spawn_blocking(move || app_data_usage_blocking(&db_path))
        .await
        .map_err(|e| WorktreeError::Io(std::io::Error::other(e.to_string())))
}

fn reveal_blocking(path: &Path) -> Result<(), WorktreeError> {
    if !path.exists() {
        return Err(WorktreeError::RepoNotFound(
            path.to_string_lossy().into_owned(),
        ));
    }
    #[cfg(target_os = "macos")]
    let result = std::process::Command::new("open")
        .arg("-R")
        .arg(path)
        .spawn();
    #[cfg(target_os = "linux")]
    let result = std::process::Command::new("xdg-open")
        .arg(path.parent().unwrap_or(path))
        .spawn();
    #[cfg(target_os = "windows")]
    let result = std::process::Command::new("explorer")
        .arg(format!("/select,{}", path.to_string_lossy()))
        .spawn();
    result.map(|_| ()).map_err(WorktreeError::Io)
}

#[tauri::command]
pub async fn reveal_in_file_manager(path: String) -> Result<(), WorktreeError> {
    tauri::async_runtime::spawn_blocking(move || reveal_blocking(Path::new(&path)))
        .await
        .map_err(|e| WorktreeError::Io(std::io::Error::other(e.to_string())))?
}

#[cfg(test)]
mod tests {
    use super::{
        app_data_usage_blocking, disk_free_blocking, folder_facts_with, registered_worktrees,
    };
    use crate::worktree::{git, WorktreeRemovalReason};
    use std::path::{Path, PathBuf};

    fn temp_root(name: &str) -> PathBuf {
        let root = std::env::temp_dir().join(format!(
            "goodboy-storage-{name}-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        std::fs::create_dir_all(&root).unwrap();
        root
    }

    fn git_ok(cwd: &Path, args: &[&str]) -> String {
        git(cwd, args)
            .unwrap_or_else(|error| panic!("git {} failed: {error}", args.join(" ")))
            .trim()
            .to_string()
    }

    fn init_repo(name: &str) -> PathBuf {
        let root = temp_root(name);
        git_ok(&root, &["init", "-b", "main"]);
        git_ok(&root, &["config", "user.email", "test@example.com"]);
        git_ok(&root, &["config", "user.name", "test"]);
        std::fs::write(root.join("tracked.txt"), "base\n").unwrap();
        git_ok(&root, &["add", "tracked.txt"]);
        git_ok(&root, &["commit", "-m", "base"]);
        std::fs::canonicalize(root).unwrap()
    }

    fn add_goodboy_worktree(root: &Path, name: &str) -> PathBuf {
        let target = root.join(".goodboy").join("worktrees").join(name);
        git_ok(
            root,
            &[
                "worktree",
                "add",
                "-b",
                &format!("goodboy/{name}"),
                target.to_str().unwrap(),
            ],
        );
        std::fs::canonicalize(target).unwrap()
    }

    fn facts(root: &Path, path: &Path, leased: bool) -> super::WorktreeFolderFacts {
        let mut run_git = |cwd: &Path, args: &[&str]| git(cwd, args);
        let registered = registered_worktrees(root, &mut run_git);
        folder_facts_with(
            root,
            path.to_str().unwrap(),
            &registered,
            &mut run_git,
            &mut |_| leased,
            &mut |_| Some(2),
        )
    }

    #[test]
    fn a_clean_registered_folder_reports_its_branch_and_last_commit() {
        let root = init_repo("facts-clean");
        let folder = add_goodboy_worktree(&root, "rounding-drift");

        let found = facts(&root, &folder, false);

        assert!(found.is_registered);
        assert_eq!(found.branch.as_deref(), Some("goodboy/rounding-drift"));
        assert!(found.last_commit_at.unwrap() > 0);
        assert_eq!(found.local_only_commits, Some(2));
        assert!(found.reasons.is_empty());
    }

    #[test]
    fn a_dirty_folder_counts_its_changes_and_names_one() {
        let root = init_repo("facts-dirty");
        let folder = add_goodboy_worktree(&root, "ledger-close");
        std::fs::write(folder.join("tracked.txt"), "changed\n").unwrap();
        std::fs::write(folder.join("new.txt"), "new\n").unwrap();

        let found = facts(&root, &folder, false);

        assert_eq!(found.changed_files, 2);
        assert!(found.changed_sample.is_some());
        assert!(found
            .reasons
            .contains(&WorktreeRemovalReason::UnstagedChanges));
        assert!(found
            .reasons
            .contains(&WorktreeRemovalReason::UntrackedFiles));
    }

    #[test]
    fn a_folder_git_forgot_is_not_registered_and_a_lease_is_reported() {
        let root = init_repo("facts-unregistered");
        let folder = root.join(".goodboy").join("worktrees").join("fx-rates");
        std::fs::create_dir_all(folder.join("src")).unwrap();

        let found = facts(&root, &folder, true);

        assert!(!found.is_registered);
        assert_eq!(
            found.reasons,
            vec![
                WorktreeRemovalReason::WriterLeaseHeld,
                WorktreeRemovalReason::NotRegistered
            ]
        );
    }

    #[test]
    fn a_folder_outside_goodboy_worktrees_is_refused() {
        let root = init_repo("facts-contained");
        let sibling = root.join(".claude").join("worktrees").join("x");
        std::fs::create_dir_all(&sibling).unwrap();

        let found = facts(&root, &sibling, false);

        assert_eq!(
            found.reasons,
            vec![WorktreeRemovalReason::OutsideWorktreeFolder]
        );
        assert!(!found.is_registered);
    }

    #[test]
    fn a_missing_folder_has_no_reasons() {
        let root = init_repo("facts-missing");
        std::fs::create_dir_all(root.join(".goodboy").join("worktrees")).unwrap();
        let gone = root.join(".goodboy").join("worktrees").join("gone");

        let found = facts(&root, &gone, false);

        assert!(!found.exists);
        assert!(found.reasons.is_empty());
    }

    #[test]
    fn app_data_usage_counts_the_database_and_its_safety_copies() {
        let root = temp_root("app-data");
        let db = root.join("goodboy.db");
        std::fs::write(&db, vec![1u8; 5000]).unwrap();
        std::fs::write(root.join("goodboy.db-wal"), vec![1u8; 100]).unwrap();
        std::fs::write(root.join("goodboy.db.pre-m182-1.bak"), vec![1u8; 3000]).unwrap();
        std::fs::write(root.join("other.bak"), vec![1u8; 3000]).unwrap();

        let usage = app_data_usage_blocking(&db);

        assert_eq!(usage.folder, root.to_string_lossy());
        assert!(usage.database_bytes >= 5100);
        assert!(usage.snapshot_bytes >= 3000);
        assert_eq!(usage.snapshot_count, 1);
    }

    #[cfg(unix)]
    #[test]
    fn disk_free_reads_the_volume() {
        let root = temp_root("disk-free");

        let found = disk_free_blocking(&root);

        assert!(found.total_bytes.unwrap() > 0);
        assert!(found.free_bytes.unwrap() <= found.total_bytes.unwrap());
    }
}
