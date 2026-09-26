use std::collections::HashMap;
use std::path::Path;
use std::sync::Mutex;

use serde::{Deserialize, Serialize};

use crate::worktree::{
    branch_merge_state, git, parse_porcelain, resolve_base_ref, BranchMergeState, WorktreeError,
};

const KEEP_REF_PREFIX: &str = "refs/goodboy/deleted/";

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum BranchLocation {
    OnOrigin,
    LocalOnly,
    GoneOnOrigin,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ProjectBranch {
    pub name: String,
    pub sha: String,
    pub author_email: Option<String>,
    pub last_commit_at: Option<i64>,
    pub location: BranchLocation,
    pub merge_state: BranchMergeState,
    pub behind: Option<u32>,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ProjectBranchScan {
    pub user_email: Option<String>,
    pub branches: Vec<ProjectBranch>,
}

type MergeCacheKey = (String, String, String, String);

static MERGE_STATE_CACHE: Mutex<Option<HashMap<MergeCacheKey, BranchMergeState>>> =
    Mutex::new(None);

const FOR_EACH_REF_FORMAT: &str = "%(refname:short)|%(objectname)|%(authoremail)|%(committerdate:unix)|%(upstream:short)|%(upstream:track)";

fn trim_email(raw: &str) -> Option<String> {
    let trimmed = raw
        .trim()
        .trim_start_matches('<')
        .trim_end_matches('>')
        .trim();
    match trimmed.is_empty() {
        true => None,
        false => Some(trimmed.to_lowercase()),
    }
}

fn branch_location(cwd: &Path, name: &str, upstream: &str, track: &str) -> BranchLocation {
    if track.contains("gone") {
        return BranchLocation::GoneOnOrigin;
    }
    let has_remote = !upstream.trim().is_empty()
        || git(
            cwd,
            &[
                "rev-parse",
                "--verify",
                "--quiet",
                &format!("refs/remotes/origin/{name}"),
            ],
        )
        .is_ok();
    match has_remote {
        true => BranchLocation::OnOrigin,
        false => BranchLocation::LocalOnly,
    }
}

fn cached_merge_state(
    cwd: &Path,
    name: &str,
    sha: &str,
    base: Option<&str>,
    base_sha: &str,
) -> BranchMergeState {
    let key = (
        cwd.to_string_lossy().into_owned(),
        name.to_string(),
        sha.to_string(),
        base_sha.to_string(),
    );
    if let Ok(guard) = MERGE_STATE_CACHE.lock() {
        if let Some(found) = guard.as_ref().and_then(|cache| cache.get(&key)) {
            return found.clone();
        }
    }
    let state = branch_merge_state(cwd, name, base);
    if !matches!(state, BranchMergeState::Unknown) {
        if let Ok(mut guard) = MERGE_STATE_CACHE.lock() {
            guard
                .get_or_insert_with(HashMap::new)
                .insert(key, state.clone());
        }
    }
    state
}

pub(crate) fn scan_project_branches(
    repo_root: &str,
    base: Option<&str>,
) -> Result<ProjectBranchScan, BranchCleanupError> {
    let cwd = repo_path(repo_root)?;
    let user_email = git(cwd, &["config", "user.email"])
        .ok()
        .and_then(|raw| trim_email(&raw));
    let base_ref = resolve_base_ref(cwd, base);
    let base_sha = base_ref
        .as_deref()
        .and_then(|reference| git(cwd, &["rev-parse", reference]).ok())
        .map(|raw| raw.trim().to_string())
        .unwrap_or_default();
    let raw = git(
        cwd,
        &[
            "for-each-ref",
            &format!("--format={FOR_EACH_REF_FORMAT}"),
            "refs/heads",
        ],
    )?;
    let branches = raw
        .lines()
        .filter_map(|line| {
            let parts: Vec<&str> = line.split('|').collect();
            let [name, sha, email, date, upstream, track] = parts.as_slice() else {
                return None;
            };
            let merge_state = cached_merge_state(cwd, name, sha, base, &base_sha);
            let behind = match (&merge_state, base_ref.as_deref()) {
                (BranchMergeState::NotMerged { .. }, Some(reference)) => git(
                    cwd,
                    &["rev-list", "--count", &format!("{name}..{reference}")],
                )
                .ok()
                .and_then(|count| count.trim().parse::<u32>().ok()),
                _ => None,
            };
            Some(ProjectBranch {
                name: name.to_string(),
                sha: sha.to_string(),
                author_email: trim_email(email),
                last_commit_at: date.trim().parse::<i64>().ok(),
                location: branch_location(cwd, name, upstream, track),
                merge_state,
                behind,
            })
        })
        .collect();
    Ok(ProjectBranchScan {
        user_email,
        branches,
    })
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(tag = "kind", rename_all = "kebab-case")]
pub enum BranchCleanupError {
    RepoNotFound,
    BranchMissing,
    ShaMoved { actual: String },
    HeldByWorktree { path: String },
    BranchExists,
    Git { message: String },
}

impl From<WorktreeError> for BranchCleanupError {
    fn from(error: WorktreeError) -> Self {
        BranchCleanupError::Git {
            message: error.to_string(),
        }
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BranchDeleteArgs {
    pub repo_root: String,
    pub branch: String,
    pub expected_sha: String,
    #[serde(default)]
    pub also_origin: bool,
    #[serde(default)]
    pub origin_lease_sha: Option<String>,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct BranchDeleteOutcome {
    pub keep_ref: String,
    pub deleted_on_origin: bool,
    pub origin_error: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BranchRestoreArgs {
    pub repo_root: String,
    pub branch: String,
    pub sha: String,
    pub keep_ref: String,
    #[serde(default)]
    pub push_to_origin: bool,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct BranchRestoreOutcome {
    pub pushed_to_origin: bool,
    pub origin_error: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BranchForgetArgs {
    pub repo_root: String,
    pub keep_ref: String,
    pub sha: String,
}

fn keep_ref_for(branch: &str) -> String {
    format!("{KEEP_REF_PREFIX}{branch}")
}

fn repo_path(repo_root: &str) -> Result<&Path, BranchCleanupError> {
    let path = Path::new(repo_root);
    match path.exists() {
        true => Ok(path),
        false => Err(BranchCleanupError::RepoNotFound),
    }
}

fn worktree_holding(cwd: &Path, branch: &str) -> Option<String> {
    let raw = git(cwd, &["worktree", "list", "--porcelain"]).ok()?;
    parse_porcelain(&raw)
        .into_iter()
        .find(|entry| entry.branch.as_deref() == Some(branch))
        .map(|entry| entry.path)
}

fn local_sha(cwd: &Path, branch: &str) -> Option<String> {
    git(
        cwd,
        &[
            "rev-parse",
            "--verify",
            "--quiet",
            &format!("refs/heads/{branch}"),
        ],
    )
    .ok()
    .map(|raw| raw.trim().to_string())
    .filter(|sha| !sha.is_empty())
}

pub(crate) fn delete_checked(
    args: &BranchDeleteArgs,
) -> Result<BranchDeleteOutcome, BranchCleanupError> {
    let cwd = repo_path(&args.repo_root)?;
    let Some(actual) = local_sha(cwd, &args.branch) else {
        return Err(BranchCleanupError::BranchMissing);
    };
    if actual != args.expected_sha {
        return Err(BranchCleanupError::ShaMoved { actual });
    }
    if let Some(path) = worktree_holding(cwd, &args.branch) {
        return Err(BranchCleanupError::HeldByWorktree { path });
    }
    let keep_ref = keep_ref_for(&args.branch);
    git(cwd, &["update-ref", &keep_ref, &args.expected_sha])?;
    git(
        cwd,
        &[
            "update-ref",
            "-d",
            &format!("refs/heads/{}", args.branch),
            &args.expected_sha,
        ],
    )?;
    if !args.also_origin {
        return Ok(BranchDeleteOutcome {
            keep_ref,
            deleted_on_origin: false,
            origin_error: None,
        });
    }
    let lease_sha = args
        .origin_lease_sha
        .as_deref()
        .unwrap_or(&args.expected_sha);
    let lease = format!("--force-with-lease={}:{lease_sha}", args.branch);
    let pushed = git(cwd, &["push", "origin", "--delete", &args.branch, &lease]);
    Ok(BranchDeleteOutcome {
        keep_ref,
        deleted_on_origin: pushed.is_ok(),
        origin_error: pushed.err().map(|error| error.to_string()),
    })
}

pub(crate) fn restore(
    args: &BranchRestoreArgs,
) -> Result<BranchRestoreOutcome, BranchCleanupError> {
    let cwd = repo_path(&args.repo_root)?;
    if local_sha(cwd, &args.branch).is_some() {
        return Err(BranchCleanupError::BranchExists);
    }
    git(
        cwd,
        &[
            "update-ref",
            &format!("refs/heads/{}", args.branch),
            &args.sha,
            "",
        ],
    )?;
    if args.keep_ref.starts_with(KEEP_REF_PREFIX) {
        let _ = git(cwd, &["update-ref", "-d", &args.keep_ref, &args.sha]);
    }
    if !args.push_to_origin {
        return Ok(BranchRestoreOutcome {
            pushed_to_origin: false,
            origin_error: None,
        });
    }
    let pushed = git(cwd, &["push", "origin", &args.branch]);
    Ok(BranchRestoreOutcome {
        pushed_to_origin: pushed.is_ok(),
        origin_error: pushed.err().map(|error| error.to_string()),
    })
}

pub(crate) fn forget_deleted(args: &BranchForgetArgs) -> Result<(), BranchCleanupError> {
    let cwd = repo_path(&args.repo_root)?;
    if !args.keep_ref.starts_with(KEEP_REF_PREFIX) {
        return Ok(());
    }
    git(cwd, &["update-ref", "-d", &args.keep_ref, &args.sha])?;
    Ok(())
}

#[tauri::command]
pub async fn branch_head_sha(
    repo_root: String,
    branch: String,
) -> Result<Option<String>, BranchCleanupError> {
    tauri::async_runtime::spawn_blocking(move || {
        let cwd = repo_path(&repo_root)?;
        Ok(local_sha(cwd, &branch))
    })
    .await
    .map_err(join_error)?
}

#[tauri::command]
pub async fn project_branches(
    repo_root: String,
    base: Option<String>,
) -> Result<ProjectBranchScan, BranchCleanupError> {
    tauri::async_runtime::spawn_blocking(move || scan_project_branches(&repo_root, base.as_deref()))
        .await
        .map_err(join_error)?
}

fn join_error(error: tauri::Error) -> BranchCleanupError {
    BranchCleanupError::Git {
        message: error.to_string(),
    }
}

#[tauri::command]
pub async fn branch_delete_checked(
    args: BranchDeleteArgs,
) -> Result<BranchDeleteOutcome, BranchCleanupError> {
    tauri::async_runtime::spawn_blocking(move || delete_checked(&args))
        .await
        .map_err(join_error)?
}

#[tauri::command]
pub async fn branch_restore(
    args: BranchRestoreArgs,
) -> Result<BranchRestoreOutcome, BranchCleanupError> {
    tauri::async_runtime::spawn_blocking(move || restore(&args))
        .await
        .map_err(join_error)?
}

#[tauri::command]
pub async fn branch_forget_deleted(args: BranchForgetArgs) -> Result<(), BranchCleanupError> {
    tauri::async_runtime::spawn_blocking(move || forget_deleted(&args))
        .await
        .map_err(join_error)?
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    fn git_ok(cwd: &Path, args: &[&str]) -> String {
        git(cwd, args)
            .unwrap_or_else(|err| panic!("git {} failed: {err}", args.join(" ")))
            .trim()
            .to_string()
    }

    fn temp_root(name: &str) -> PathBuf {
        let root = std::env::temp_dir().join(format!(
            "goodboy-branch-cleanup-{name}-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        std::fs::create_dir_all(&root).unwrap();
        root
    }

    fn init_repo(name: &str) -> PathBuf {
        let root = temp_root(name);
        git_ok(&root, &["init", "-b", "main"]);
        git_ok(&root, &["config", "user.email", "test@example.com"]);
        git_ok(&root, &["config", "user.name", "test"]);
        git_ok(&root, &["config", "commit.gpgsign", "false"]);
        std::fs::write(root.join("a.txt"), "hello").unwrap();
        git_ok(&root, &["add", "a.txt"]);
        git_ok(&root, &["commit", "-m", "init"]);
        root
    }

    fn feature_branch(root: &Path, branch: &str) -> String {
        git_ok(root, &["checkout", "-b", branch]);
        std::fs::write(root.join("b.txt"), branch).unwrap();
        git_ok(root, &["add", "b.txt"]);
        git_ok(root, &["commit", "-m", "feature"]);
        let sha = git_ok(root, &["rev-parse", "HEAD"]);
        git_ok(root, &["checkout", "main"]);
        sha
    }

    fn delete_args(root: &Path, branch: &str, sha: &str, also_origin: bool) -> BranchDeleteArgs {
        BranchDeleteArgs {
            repo_root: root.to_string_lossy().into_owned(),
            branch: branch.to_string(),
            expected_sha: sha.to_string(),
            also_origin,
            origin_lease_sha: None,
        }
    }

    #[test]
    fn deletes_the_branch_and_keeps_its_commits_under_a_goodboy_ref() {
        let root = init_repo("delete");
        let sha = feature_branch(&root, "goodboy/fx-rates");

        let outcome = delete_checked(&delete_args(&root, "goodboy/fx-rates", &sha, false)).unwrap();

        assert_eq!(outcome.keep_ref, "refs/goodboy/deleted/goodboy/fx-rates");
        assert_eq!(local_sha(&root, "goodboy/fx-rates"), None);
        assert_eq!(git_ok(&root, &["rev-parse", &outcome.keep_ref]), sha);
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn refuses_when_the_branch_moved_since_the_check() {
        let root = init_repo("moved");
        feature_branch(&root, "goodboy/fx-rates");
        let stale = git_ok(&root, &["rev-parse", "main"]);

        let refused = delete_checked(&delete_args(&root, "goodboy/fx-rates", &stale, false));

        assert!(matches!(refused, Err(BranchCleanupError::ShaMoved { .. })));
        assert!(local_sha(&root, "goodboy/fx-rates").is_some());
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn refuses_a_branch_another_worktree_holds() {
        let root = init_repo("held");
        let sha = feature_branch(&root, "goodboy/held");
        let other = root.join("held-worktree");
        git_ok(
            &root,
            &["worktree", "add", other.to_str().unwrap(), "goodboy/held"],
        );

        let refused = delete_checked(&delete_args(&root, "goodboy/held", &sha, false));

        assert!(matches!(
            refused,
            Err(BranchCleanupError::HeldByWorktree { .. })
        ));
        git_ok(
            &root,
            &["worktree", "remove", "--force", other.to_str().unwrap()],
        );
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn origin_refuses_a_stale_lease_and_keeps_the_remote_branch() {
        let root = init_repo("lease");
        let remote = root.join("remote.git");
        git_ok(&root, &["init", "--bare", remote.to_str().unwrap()]);
        git_ok(
            &root,
            &["remote", "add", "origin", remote.to_str().unwrap()],
        );
        let sha = feature_branch(&root, "goodboy/leased");
        git_ok(&root, &["push", "origin", "goodboy/leased"]);
        let main_sha = git_ok(&root, &["rev-parse", "main"]);
        let mut args = delete_args(&root, "goodboy/leased", &sha, true);
        args.origin_lease_sha = Some(main_sha);

        let outcome = delete_checked(&args).unwrap();

        assert!(!outcome.deleted_on_origin);
        assert!(outcome.origin_error.is_some());
        assert_eq!(
            git_ok(&remote, &["rev-parse", "refs/heads/goodboy/leased"]),
            sha
        );
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn deletes_on_origin_when_the_lease_matches() {
        let root = init_repo("origin");
        let remote = root.join("remote.git");
        git_ok(&root, &["init", "--bare", remote.to_str().unwrap()]);
        git_ok(
            &root,
            &["remote", "add", "origin", remote.to_str().unwrap()],
        );
        let sha = feature_branch(&root, "goodboy/gone");
        git_ok(&root, &["push", "origin", "goodboy/gone"]);

        let outcome = delete_checked(&delete_args(&root, "goodboy/gone", &sha, true)).unwrap();

        assert!(outcome.deleted_on_origin);
        assert!(git(
            &remote,
            &["rev-parse", "--verify", "refs/heads/goodboy/gone"]
        )
        .is_err());
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn scan_says_where_each_branch_lives_and_whether_it_merged() {
        let root = init_repo("scan");
        let remote = root.join("remote.git");
        git_ok(&root, &["init", "--bare", remote.to_str().unwrap()]);
        git_ok(
            &root,
            &["remote", "add", "origin", remote.to_str().unwrap()],
        );
        git_ok(&root, &["push", "-u", "origin", "main"]);
        feature_branch(&root, "goodboy/local");
        feature_branch(&root, "goodboy/pushed");
        git_ok(&root, &["push", "-u", "origin", "goodboy/pushed"]);
        feature_branch(&root, "goodboy/gone");
        git_ok(&root, &["push", "-u", "origin", "goodboy/gone"]);
        git_ok(&root, &["push", "origin", "--delete", "goodboy/gone"]);
        git_ok(&root, &["fetch", "--prune", "origin"]);
        git_ok(&root, &["branch", "goodboy/unused"]);

        let scan = scan_project_branches(&root.to_string_lossy(), Some("main")).unwrap();
        let find = |name: &str| {
            scan.branches
                .iter()
                .find(|branch| branch.name == name)
                .unwrap_or_else(|| panic!("missing {name}"))
        };

        assert_eq!(scan.user_email.as_deref(), Some("test@example.com"));
        assert_eq!(find("goodboy/local").location, BranchLocation::LocalOnly);
        assert_eq!(find("goodboy/pushed").location, BranchLocation::OnOrigin);
        assert_eq!(find("goodboy/gone").location, BranchLocation::GoneOnOrigin);
        assert_eq!(
            find("goodboy/local").merge_state,
            BranchMergeState::NotMerged { ahead: 1 }
        );
        assert_eq!(find("goodboy/local").behind, Some(0));
        assert_eq!(
            find("goodboy/unused").merge_state,
            BranchMergeState::NoOwnCommits
        );
        assert_eq!(find("main").merge_state, BranchMergeState::Protected);
        assert_eq!(
            find("goodboy/local").author_email.as_deref(),
            Some("test@example.com")
        );
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn restore_brings_the_branch_back_and_drops_the_keep_ref() {
        let root = init_repo("restore");
        let sha = feature_branch(&root, "goodboy/back");
        let outcome = delete_checked(&delete_args(&root, "goodboy/back", &sha, false)).unwrap();

        restore(&BranchRestoreArgs {
            repo_root: root.to_string_lossy().into_owned(),
            branch: "goodboy/back".to_string(),
            sha: sha.clone(),
            keep_ref: outcome.keep_ref.clone(),
            push_to_origin: false,
        })
        .unwrap();

        assert_eq!(local_sha(&root, "goodboy/back"), Some(sha));
        assert!(git(&root, &["rev-parse", "--verify", &outcome.keep_ref]).is_err());
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn restore_refuses_when_a_branch_with_that_name_exists_again() {
        let root = init_repo("restore-taken");
        let sha = feature_branch(&root, "goodboy/taken");

        let refused = restore(&BranchRestoreArgs {
            repo_root: root.to_string_lossy().into_owned(),
            branch: "goodboy/taken".to_string(),
            sha,
            keep_ref: keep_ref_for("goodboy/taken"),
            push_to_origin: false,
        });

        assert_eq!(refused, Err(BranchCleanupError::BranchExists));
        std::fs::remove_dir_all(root).unwrap();
    }
}
