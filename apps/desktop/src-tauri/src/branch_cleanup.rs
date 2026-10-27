use std::collections::{HashMap, HashSet};
use std::path::Path;
use std::sync::Mutex;

use serde::{Deserialize, Serialize};

use crate::github::{lease_argument, GhRunResult};
use crate::proc::git::GitError;
use crate::remote::resolve;
use crate::remote_auth::run_git_authenticated;
use crate::worktree::{
    branch_merge_state, git, parse_porcelain, redact_credentials, resolve_base_ref,
    BranchMergeState, WorktreeError,
};

const KEEP_REF_PREFIX: &str = "refs/goodboy/deleted/";
const NO_REMOTE_MESSAGE: &str = "this project has no origin remote";

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
    pub is_safe_to_delete: bool,
    pub behind: Option<u32>,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ProjectBranchScan {
    pub user_email: Option<String>,
    pub branches: Vec<ProjectBranch>,
}

type MergeCacheKey = (String, String, String, String, String);

static MERGE_STATE_CACHE: Mutex<Option<HashMap<MergeCacheKey, BranchMergeState>>> =
    Mutex::new(None);

const FIELD_SEPARATOR: char = '\u{1f}';
const FOR_EACH_REF_FORMAT: &str = "%(refname:short)%1f%(objectname)%1f%(authoremail)%1f%(committerdate:unix)%1f%(upstream:short)%1f%(upstream:track)";
const MERGE_STATE_CACHE_LIMIT: usize = 4096;

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

fn remote_branch_names(cwd: &Path) -> HashSet<String> {
    git(
        cwd,
        &[
            "for-each-ref",
            "--format=%(refname:lstrip=3)",
            "refs/remotes/origin",
        ],
    )
    .map(|raw| {
        raw.lines()
            .map(str::trim)
            .filter(|line| !line.is_empty())
            .map(str::to_string)
            .collect()
    })
    .unwrap_or_default()
}

fn behind_counts(cwd: &Path, base_ref: Option<&str>) -> HashMap<String, u32> {
    let Some(reference) = base_ref else {
        return HashMap::new();
    };
    let format = format!("--format=%(refname:short)%1f%(ahead-behind:{reference})");
    let Ok(raw) = git(cwd, &["for-each-ref", &format, "refs/heads"]) else {
        return HashMap::new();
    };
    raw.lines()
        .filter_map(|line| {
            let (name, counts) = line.split_once(FIELD_SEPARATOR)?;
            let behind = counts.split_whitespace().nth(1)?.parse::<u32>().ok()?;
            Some((name.to_string(), behind))
        })
        .collect()
}

fn branch_location(
    remote_names: &HashSet<String>,
    name: &str,
    upstream: &str,
    track: &str,
) -> BranchLocation {
    if track.contains("gone") {
        return BranchLocation::GoneOnOrigin;
    }
    match !upstream.trim().is_empty() || remote_names.contains(name) {
        true => BranchLocation::OnOrigin,
        false => BranchLocation::LocalOnly,
    }
}

fn insert_bounded(
    cache: &mut HashMap<MergeCacheKey, BranchMergeState>,
    key: MergeCacheKey,
    state: BranchMergeState,
    limit: usize,
) {
    if cache.len() >= limit {
        cache.clear();
    }
    cache.insert(key, state);
}

fn cached_merge_state(
    cwd: &Path,
    name: &str,
    sha: &str,
    base: Option<&str>,
    base_sha: &str,
    merged_head: Option<&str>,
) -> BranchMergeState {
    let key = (
        cwd.to_string_lossy().into_owned(),
        name.to_string(),
        sha.to_string(),
        base_sha.to_string(),
        merged_head.unwrap_or_default().to_string(),
    );
    if let Ok(guard) = MERGE_STATE_CACHE.lock() {
        if let Some(found) = guard.as_ref().and_then(|cache| cache.get(&key)) {
            return found.clone();
        }
    }
    let state = branch_merge_state(cwd, name, base, merged_head);
    if !matches!(state, BranchMergeState::Unknown) {
        if let Ok(mut guard) = MERGE_STATE_CACHE.lock() {
            insert_bounded(
                guard.get_or_insert_with(HashMap::new),
                key,
                state.clone(),
                MERGE_STATE_CACHE_LIMIT,
            );
        }
    }
    state
}

pub(crate) fn scan_project_branches(
    repo_root: &str,
    base: Option<&str>,
    merged_heads: &HashMap<String, String>,
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
    let remote_names = remote_branch_names(cwd);
    let batched_behind = behind_counts(cwd, base_ref.as_deref());
    let branches = raw
        .lines()
        .filter_map(|line| {
            let parts: Vec<&str> = line.split(FIELD_SEPARATOR).collect();
            let [name, sha, email, date, upstream, track] = parts.as_slice() else {
                return None;
            };
            let merged_head = merged_heads.get(*name).map(String::as_str);
            let merge_state = cached_merge_state(cwd, name, sha, base, &base_sha, merged_head);
            let behind = match (&merge_state, base_ref.as_deref()) {
                (BranchMergeState::NotMerged { .. }, Some(reference)) => {
                    batched_behind.get(*name).copied().or_else(|| {
                        git(
                            cwd,
                            &["rev-list", "--count", &format!("{name}..{reference}")],
                        )
                        .ok()
                        .and_then(|count| count.trim().parse::<u32>().ok())
                    })
                }
                _ => None,
            };
            Some(ProjectBranch {
                name: name.to_string(),
                sha: sha.to_string(),
                author_email: trim_email(email),
                last_commit_at: date.trim().parse::<i64>().ok(),
                location: branch_location(&remote_names, name, upstream, track),
                is_safe_to_delete: merge_state.is_safe_to_delete(),
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

#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum BranchCleanupError {
    #[error("the repository folder was not found")]
    RepoNotFound,
    #[error("the branch no longer exists")]
    BranchMissing,
    #[error("the branch moved to {actual} while it was being checked")]
    ShaMoved { actual: String },
    #[error("the branch is checked out in {path}")]
    HeldByWorktree { path: String },
    #[error("a branch with that name already exists")]
    BranchExists,
    #[error("{message}")]
    Git { message: String },
}

impl BranchCleanupError {
    fn kind(&self) -> &'static str {
        match self {
            BranchCleanupError::RepoNotFound => "repo-not-found",
            BranchCleanupError::BranchMissing => "branch-missing",
            BranchCleanupError::ShaMoved { .. } => "sha-moved",
            BranchCleanupError::HeldByWorktree { .. } => "held-by-worktree",
            BranchCleanupError::BranchExists => "branch-exists",
            BranchCleanupError::Git { .. } => "git",
        }
    }
}

impl Serialize for BranchCleanupError {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        let mut map = serde_json::Map::new();
        map.insert("kind".to_string(), self.kind().into());
        map.insert("message".to_string(), self.to_string().into());
        match self {
            BranchCleanupError::ShaMoved { actual } => {
                map.insert("actual".to_string(), actual.as_str().into());
            }
            BranchCleanupError::HeldByWorktree { path } => {
                map.insert("path".to_string(), path.as_str().into());
            }
            _ => {}
        }
        serde_json::Value::Object(map).serialize(serializer)
    }
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
    #[serde(default)]
    pub workspace_id: Option<String>,
    #[serde(default)]
    pub project_id: Option<String>,
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
    #[serde(default)]
    pub workspace_id: Option<String>,
    #[serde(default)]
    pub project_id: Option<String>,
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

type PushRunner<'a> =
    &'a mut dyn FnMut(&[&str], &str, Option<&str>) -> Result<GhRunResult, GitError>;

fn push_token(workspace_id: Option<&str>, project_id: Option<&str>) -> Option<String> {
    workspace_id.filter(|id| !id.is_empty())?;
    crate::github::read_token(workspace_id, project_id)
        .ok()
        .flatten()
}

fn push_to_remote(
    cwd: &Path,
    args: &[&str],
    token: Option<&str>,
    run: PushRunner<'_>,
) -> Result<(), String> {
    let run = run(args, &cwd.to_string_lossy(), token).map_err(|error| error.to_string())?;
    match run.exit_code {
        0 => Ok(()),
        _ => Err(redact_credentials(run.stderr.trim())),
    }
}

pub(crate) fn delete_checked(
    args: &BranchDeleteArgs,
) -> Result<BranchDeleteOutcome, BranchCleanupError> {
    let token = push_token(args.workspace_id.as_deref(), args.project_id.as_deref());
    delete_checked_with(args, token.as_deref(), &mut |argv, cwd, token| {
        run_git_authenticated(argv, cwd, token)
    })
}

fn delete_checked_with(
    args: &BranchDeleteArgs,
    token: Option<&str>,
    run: PushRunner<'_>,
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
    let Some(remote) = resolve(cwd) else {
        return Ok(BranchDeleteOutcome {
            keep_ref,
            deleted_on_origin: false,
            origin_error: Some(NO_REMOTE_MESSAGE.to_string()),
        });
    };
    let lease = lease_argument(&args.branch, Some(lease_sha));
    let pushed = push_to_remote(
        cwd,
        &["push", &remote, "--delete", &args.branch, &lease],
        token,
        run,
    );
    Ok(BranchDeleteOutcome {
        keep_ref,
        deleted_on_origin: pushed.is_ok(),
        origin_error: pushed.err(),
    })
}

pub(crate) fn restore(
    args: &BranchRestoreArgs,
) -> Result<BranchRestoreOutcome, BranchCleanupError> {
    let token = push_token(args.workspace_id.as_deref(), args.project_id.as_deref());
    restore_with(args, token.as_deref(), &mut |argv, cwd, token| {
        run_git_authenticated(argv, cwd, token)
    })
}

fn restore_with(
    args: &BranchRestoreArgs,
    token: Option<&str>,
    run: PushRunner<'_>,
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
    let Some(remote) = resolve(cwd) else {
        return Ok(BranchRestoreOutcome {
            pushed_to_origin: false,
            origin_error: Some(NO_REMOTE_MESSAGE.to_string()),
        });
    };
    let pushed = push_to_remote(cwd, &["push", &remote, &args.branch], token, run);
    Ok(BranchRestoreOutcome {
        pushed_to_origin: pushed.is_ok(),
        origin_error: pushed.err(),
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
    merged_heads: Option<HashMap<String, String>>,
) -> Result<ProjectBranchScan, BranchCleanupError> {
    tauri::async_runtime::spawn_blocking(move || {
        scan_project_branches(
            &repo_root,
            base.as_deref(),
            &merged_heads.unwrap_or_default(),
        )
    })
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
            workspace_id: None,
            project_id: None,
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

    fn run_result(exit_code: i32, stderr: &str) -> GhRunResult {
        GhRunResult {
            stdout: String::new(),
            stderr: stderr.to_string(),
            exit_code,
        }
    }

    fn with_remote(root: &Path, name: &str) {
        git_ok(
            root,
            &[
                "remote",
                "add",
                name,
                "https://harborline.test/ledger-core.git",
            ],
        );
    }

    #[test]
    fn the_push_that_deletes_on_origin_carries_the_token_and_a_qualified_lease_ref() {
        let root = init_repo("origin-credentials");
        with_remote(&root, "origin");
        let sha = feature_branch(&root, "goodboy/gone");
        let mut calls: Vec<(Vec<String>, Option<String>)> = Vec::new();

        let outcome = delete_checked_with(
            &delete_args(&root, "goodboy/gone", &sha, true),
            Some("ghp_fixture"),
            &mut |argv, _cwd, token| {
                calls.push((
                    argv.iter().map(|arg| (*arg).to_string()).collect(),
                    token.map(str::to_string),
                ));
                Ok(run_result(0, ""))
            },
        )
        .unwrap();

        assert!(outcome.deleted_on_origin);
        assert_eq!(calls.len(), 1);
        assert_eq!(
            calls[0].0,
            vec![
                "push".to_string(),
                "origin".to_string(),
                "--delete".to_string(),
                "goodboy/gone".to_string(),
                format!("--force-with-lease=refs/heads/goodboy/gone:{sha}"),
            ]
        );
        assert_eq!(calls[0].1.as_deref(), Some("ghp_fixture"));
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn a_refused_cleanup_push_reports_the_remote_stderr_without_credentials() {
        let root = init_repo("origin-refused");
        with_remote(&root, "origin");
        let sha = feature_branch(&root, "goodboy/refused");

        let outcome = delete_checked_with(
            &delete_args(&root, "goodboy/refused", &sha, true),
            None,
            &mut |_argv, _cwd, _token| {
                Ok(run_result(
                    1,
                    "fatal: unable to access 'https://ci-user:s3cret@harborline.test/ledger-core.git/'\n",
                ))
            },
        )
        .unwrap();

        assert!(!outcome.deleted_on_origin);
        let message = outcome.origin_error.unwrap();
        assert!(message.contains("unable to access"));
        assert!(!message.contains("s3cret"));
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn a_project_whose_only_remote_is_upstream_never_pushes_to_a_guessed_origin() {
        let root = init_repo("only-upstream");
        with_remote(&root, "upstream");
        let sha = feature_branch(&root, "goodboy/orphan");
        let mut calls = 0;

        let outcome = delete_checked_with(
            &delete_args(&root, "goodboy/orphan", &sha, true),
            None,
            &mut |_argv, _cwd, _token| {
                calls += 1;
                Ok(run_result(0, ""))
            },
        )
        .unwrap();

        assert_eq!(calls, 0);
        assert!(!outcome.deleted_on_origin);
        assert_eq!(
            outcome.origin_error.as_deref(),
            Some("this project has no origin remote")
        );
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn restoring_a_branch_pushes_it_through_the_authenticated_runner() {
        let root = init_repo("restore-credentials");
        with_remote(&root, "origin");
        let sha = feature_branch(&root, "goodboy/back");
        let deleted = delete_checked(&delete_args(&root, "goodboy/back", &sha, false)).unwrap();
        let mut seen: Vec<(Vec<String>, Option<String>)> = Vec::new();

        let outcome = restore_with(
            &BranchRestoreArgs {
                repo_root: root.to_string_lossy().into_owned(),
                branch: "goodboy/back".to_string(),
                sha: sha.clone(),
                keep_ref: deleted.keep_ref,
                push_to_origin: true,
                workspace_id: None,
                project_id: None,
            },
            Some("ghp_fixture"),
            &mut |argv, _cwd, token| {
                seen.push((
                    argv.iter().map(|arg| (*arg).to_string()).collect(),
                    token.map(str::to_string),
                ));
                Ok(run_result(0, ""))
            },
        )
        .unwrap();

        assert!(outcome.pushed_to_origin);
        assert_eq!(
            seen,
            vec![(
                vec![
                    "push".to_string(),
                    "origin".to_string(),
                    "goodboy/back".to_string()
                ],
                Some("ghp_fixture".to_string())
            )]
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
    fn scan_uses_the_develop_branch_as_base_when_no_base_is_configured() {
        let root = init_repo("scan-develop");
        git_ok(&root, &["branch", "-m", "main", "develop"]);
        git_ok(&root, &["checkout", "-b", "goodboy/fx"]);
        std::fs::write(root.join("b.txt"), "fx").unwrap();
        git_ok(&root, &["add", "b.txt"]);
        git_ok(&root, &["commit", "-m", "feature"]);
        git_ok(&root, &["checkout", "-b", "scratch", "develop"]);

        let scan = scan_project_branches(&root.to_string_lossy(), None, &HashMap::new()).unwrap();
        let find = |name: &str| {
            scan.branches
                .iter()
                .find(|branch| branch.name == name)
                .unwrap_or_else(|| panic!("missing {name}"))
        };

        assert_eq!(
            find("goodboy/fx").merge_state,
            BranchMergeState::NotMerged { ahead: 1 }
        );
        assert_eq!(find("develop").merge_state, BranchMergeState::Protected);
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn scan_keeps_a_branch_whose_name_holds_a_pipe() {
        let root = init_repo("scan-pipe");
        feature_branch(&root, "goodboy/fx|rates");
        feature_branch(&root, "goodboy/plain");

        let scan =
            scan_project_branches(&root.to_string_lossy(), Some("main"), &HashMap::new()).unwrap();

        let names: Vec<&str> = scan
            .branches
            .iter()
            .map(|branch| branch.name.as_str())
            .collect();
        assert!(names.contains(&"goodboy/fx|rates"), "{names:?}");
        assert!(names.contains(&"goodboy/plain"), "{names:?}");
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn scan_counts_how_far_each_branch_is_behind_the_base_in_one_pass() {
        let root = init_repo("scan-behind");
        feature_branch(&root, "goodboy/old");
        std::fs::write(root.join("c.txt"), "one").unwrap();
        git_ok(&root, &["add", "c.txt"]);
        git_ok(&root, &["commit", "-m", "base one"]);
        std::fs::write(root.join("d.txt"), "two").unwrap();
        git_ok(&root, &["add", "d.txt"]);
        git_ok(&root, &["commit", "-m", "base two"]);

        let scan =
            scan_project_branches(&root.to_string_lossy(), Some("main"), &HashMap::new()).unwrap();

        let old = scan
            .branches
            .iter()
            .find(|branch| branch.name == "goodboy/old")
            .unwrap();
        assert_eq!(old.behind, Some(2));
        let batched = behind_counts(&root, Some("main"));
        assert_eq!(batched.get("goodboy/old"), Some(&2));
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn a_branch_only_on_origin_is_found_without_one_lookup_per_branch() {
        let root = init_repo("scan-remote-names");
        let remote = root.join("remote.git");
        git_ok(&root, &["init", "--bare", remote.to_str().unwrap()]);
        git_ok(
            &root,
            &["remote", "add", "origin", remote.to_str().unwrap()],
        );
        git_ok(&root, &["push", "origin", "main"]);
        feature_branch(&root, "goodboy/shared");
        git_ok(&root, &["push", "origin", "goodboy/shared"]);
        git_ok(&root, &["fetch", "origin"]);

        let names = remote_branch_names(&root);

        assert!(names.contains("goodboy/shared"));
        assert!(names.contains("main"));
        assert_eq!(
            branch_location(&names, "goodboy/shared", "", ""),
            BranchLocation::OnOrigin
        );
        assert_eq!(
            branch_location(&names, "goodboy/local-only", "", ""),
            BranchLocation::LocalOnly
        );
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn a_base_git_cannot_batch_leaves_the_per_branch_count_to_answer() {
        let root = init_repo("scan-behind-fallback");

        assert!(behind_counts(&root, Some("no-such-base")).is_empty());
        assert!(behind_counts(&root, None).is_empty());
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn the_merge_state_cache_never_grows_past_its_limit() {
        let mut cache = HashMap::new();
        for index in 0..10 {
            insert_bounded(
                &mut cache,
                (
                    "/repo".to_string(),
                    format!("goodboy/branch-{index}"),
                    "sha".to_string(),
                    "base".to_string(),
                    String::new(),
                ),
                BranchMergeState::Protected,
                3,
            );
            assert!(cache.len() <= 3, "{}", cache.len());
        }

        assert_eq!(cache.len(), 1);
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

        let merged_heads = HashMap::from([(
            "goodboy/pushed".to_string(),
            git_ok(&root, &["rev-parse", "goodboy/pushed"]),
        )]);
        let scan =
            scan_project_branches(&root.to_string_lossy(), Some("main"), &merged_heads).unwrap();
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
            find("goodboy/pushed").merge_state,
            BranchMergeState::MergedViaPr
        );
        assert_eq!(
            find("goodboy/unused").merge_state,
            BranchMergeState::NoOwnCommits
        );
        assert_eq!(find("main").merge_state, BranchMergeState::Protected);
        assert!(find("goodboy/pushed").is_safe_to_delete);
        assert!(find("goodboy/unused").is_safe_to_delete);
        assert!(!find("goodboy/local").is_safe_to_delete);
        assert!(!find("goodboy/gone").is_safe_to_delete);
        assert!(!find("main").is_safe_to_delete);
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
            workspace_id: None,
            project_id: None,
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
            workspace_id: None,
            project_id: None,
        });

        assert_eq!(refused, Err(BranchCleanupError::BranchExists));
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn a_cleanup_error_serializes_with_a_kind_a_message_and_its_extras() {
        let moved = serde_json::to_value(BranchCleanupError::ShaMoved {
            actual: "abc123".to_string(),
        })
        .unwrap();
        let held = serde_json::to_value(BranchCleanupError::HeldByWorktree {
            path: "/work/ledger-core".to_string(),
        })
        .unwrap();
        let missing = serde_json::to_value(BranchCleanupError::RepoNotFound).unwrap();

        assert_eq!(moved["kind"], "sha-moved");
        assert_eq!(moved["actual"], "abc123");
        assert_eq!(
            moved["message"],
            "the branch moved to abc123 while it was being checked"
        );
        assert_eq!(held["kind"], "held-by-worktree");
        assert_eq!(held["path"], "/work/ledger-core");
        assert_eq!(
            missing,
            serde_json::json!({
                "kind": "repo-not-found",
                "message": "the repository folder was not found"
            })
        );
    }
}
