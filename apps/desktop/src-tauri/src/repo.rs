use std::path::{Path, PathBuf};

use crate::proc::git::Git;
use crate::worktree::{GitDistance, GitOperation, GitUnknownReason, GitWorkingTree};
use serde::{Deserialize, Serialize};
use thiserror::Error;

use crate::ignore_file::GOODBOY_IGNORE_ENTRY;
const CONVERSION_IGNORE_ENTRIES: [&str; 2] = [GOODBOY_IGNORE_ENTRY, "/sessions/"];

const IGNORE_PROBE_PATHS: [&str; 2] = [".goodboy/worktrees/probe", "sessions/probe"];

const INITIAL_COMMIT_MESSAGE: &str = "chore: track this project with git";
const FALLBACK_AUTHOR_NAME: &str = "Goodboy";
const FALLBACK_AUTHOR_EMAIL: &str = "goodboy@localhost";
const DEFAULT_BRANCH: &str = "main";

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum GitRepoErrorKind {
    NotFound,
    PermissionDenied,
    NotADirectory,
    NotARepository,
    GitFailed,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitRepoCheck {
    pub is_repo: bool,
    pub root_path: Option<String>,
    pub resolved_path: Option<String>,
    pub default_branch: Option<String>,
    pub error: Option<String>,
    pub error_kind: Option<GitRepoErrorKind>,
}

impl GitRepoCheck {
    fn failed(
        resolved_path: Option<String>,
        kind: GitRepoErrorKind,
        message: String,
    ) -> GitRepoCheck {
        GitRepoCheck {
            is_repo: false,
            root_path: None,
            resolved_path,
            default_branch: None,
            error: Some(message),
            error_kind: Some(kind),
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceGitStatus {
    pub state: &'static str,
    pub branch: Option<String>,
    pub head_subject: Option<String>,
    pub upstream_distance: GitDistance,
    pub working_tree: GitWorkingTree,
    pub upstream: Option<String>,
    pub in_progress: Option<GitOperation>,
}

#[derive(Debug, Error)]
pub enum RepoInitError {
    #[error("directory not found: {0}")]
    DirNotFound(String),
    #[error("already a git repository: {0}")]
    AlreadyRepo(String),
    #[error("this folder is already inside the git repository at {0}. open that repository as the workspace instead")]
    NestedRepo(String),
    #[error("{0} is not a usable folder name")]
    InvalidName(String),
    #[error("{0} already exists")]
    AlreadyExists(String),
    #[error("git still does not ignore {0}, so the first commit could carry session data")]
    IgnoreNotApplied(String),
    #[error("{message}")]
    RollbackFailed { message: String },
    #[error("git failed: {message}")]
    Git { message: String },
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
}

crate::util::impl_error_serialize!(RepoInitError);

impl RepoInitError {
    fn kind(&self) -> &'static str {
        match self {
            RepoInitError::DirNotFound(_) => "dir_not_found",
            RepoInitError::AlreadyRepo(_) => "already_repo",
            RepoInitError::NestedRepo(_) => "nested_repo",
            RepoInitError::InvalidName(_) => "invalid_name",
            RepoInitError::AlreadyExists(_) => "already_exists",
            RepoInitError::IgnoreNotApplied(_) => "ignore_not_applied",
            RepoInitError::RollbackFailed { .. } => "rollback_failed",
            RepoInitError::Git { .. } => "git",
            RepoInitError::Io(_) => "io",
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InitializedRepo {
    pub root_path: String,
    pub remote_url: String,
    pub branch: String,
}

pub(crate) enum RepoState {
    Absent,
    AtRoot,
    Nested(String),
}

struct GitignoreSnapshot {
    existed: bool,
    content: Option<Vec<u8>>,
}

#[tauri::command]
pub async fn validate_git_repo(path: String) -> GitRepoCheck {
    let fallback_path = path.clone();
    tauri::async_runtime::spawn_blocking(move || validate_git_repo_blocking(path))
        .await
        .unwrap_or_else(|error| {
            GitRepoCheck::failed(
                None,
                GitRepoErrorKind::GitFailed,
                format!("git repository check failed for {fallback_path}: {error}"),
            )
        })
}

fn folder_problem(candidate: &Path, path: &str) -> Option<(GitRepoErrorKind, String)> {
    let metadata = match std::fs::metadata(candidate) {
        Ok(found) => found,
        Err(error) => return Some(access_problem(&error, path)),
    };
    if !metadata.is_dir() {
        return Some((
            GitRepoErrorKind::NotADirectory,
            format!("not a folder: {path}"),
        ));
    }
    match std::fs::read_dir(candidate) {
        Ok(_) => None,
        Err(error) => Some(access_problem(&error, path)),
    }
}

fn access_problem(error: &std::io::Error, path: &str) -> (GitRepoErrorKind, String) {
    match error.kind() {
        std::io::ErrorKind::PermissionDenied => (
            GitRepoErrorKind::PermissionDenied,
            format!("permission denied: {path}"),
        ),
        std::io::ErrorKind::NotFound => (
            GitRepoErrorKind::NotFound,
            format!("path does not exist: {path}"),
        ),
        std::io::ErrorKind::NotADirectory => (
            GitRepoErrorKind::NotADirectory,
            format!("not a folder: {path}"),
        ),
        _ => (GitRepoErrorKind::NotFound, format!("{path}: {error}")),
    }
}

pub(crate) fn local_default_branch(root: &Path) -> Option<String> {
    crate::worktree::resolve_origin_head(root)
        .or_else(|| crate::worktree::current_branch_name(root))
}

fn validate_git_repo_blocking(path: String) -> GitRepoCheck {
    let check = check_folder(&path);
    let default_branch = check
        .root_path
        .as_deref()
        .and_then(|root| local_default_branch(Path::new(root)));
    GitRepoCheck {
        default_branch,
        ..check
    }
}

fn check_folder(path: &str) -> GitRepoCheck {
    let candidate = Path::new(path);
    if let Some((kind, message)) = folder_problem(candidate, path) {
        return GitRepoCheck::failed(None, kind, message);
    }
    let resolved_path = std::fs::canonicalize(candidate)
        .map(|found| found.to_string_lossy().into_owned())
        .ok();
    let output = match Git::new()
        .args(["rev-parse", "--show-toplevel"])
        .cwd(candidate)
        .output()
    {
        Ok(out) => out,
        Err(err) => {
            return GitRepoCheck::failed(
                resolved_path,
                GitRepoErrorKind::GitFailed,
                err.to_string(),
            );
        }
    };
    if !output.status.success() {
        return GitRepoCheck::failed(
            resolved_path,
            GitRepoErrorKind::NotARepository,
            "not a git repository".to_string(),
        );
    }
    let root = String::from_utf8(output.stdout)
        .unwrap_or_default()
        .trim()
        .to_string();
    GitRepoCheck {
        is_repo: true,
        default_branch: None,
        root_path: Some(root),
        resolved_path,
        error: None,
        error_kind: None,
    }
}

pub(crate) fn is_inside_repo(path: &Path) -> bool {
    check_folder(&path.to_string_lossy())
        .root_path
        .is_some_and(|found| !found.is_empty())
}

#[derive(Debug, Serialize, PartialEq, Eq, PartialOrd, Ord)]
#[serde(rename_all = "camelCase")]
pub struct ChildRepo {
    pub name: String,
    pub path: String,
    pub default_branch: Option<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RepoIdentity {
    pub root_commits: Vec<String>,
    pub remote_url: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MovedProjectInput {
    pub id: String,
    pub name: String,
    pub root_commit: Option<String>,
    pub remote_url: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct FindMovedProjectsArgs {
    pub parent: String,
    pub projects: Vec<MovedProjectInput>,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum MovedProjectVerdict {
    SameRepository,
    SameNameUnconfirmed,
    DifferentRepository,
    NotFound,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct MovedProjectMatch {
    pub project_id: String,
    pub path: Option<String>,
    pub verdict: MovedProjectVerdict,
    pub identity: Option<RepoIdentity>,
}

fn normalize_remote_url(remote: &str) -> Option<String> {
    let trimmed = remote.trim().trim_end_matches('/').trim_end_matches(".git");
    if trimmed.is_empty() {
        return None;
    }
    let scheme_separator = format!(":{}", "/".repeat(2));
    let scheme = trimmed.split_once(&scheme_separator);
    let without_scheme = scheme.map(|(_, value)| value).unwrap_or(trimmed);
    let without_credentials = without_scheme
        .rsplit_once('@')
        .map(|(_, value)| value)
        .unwrap_or(without_scheme);
    let normalized = if scheme.is_some() {
        without_credentials.to_string()
    } else {
        without_credentials.replacen(':', "/", 1)
    };
    Some(normalized.trim_end_matches('/').to_lowercase())
}

pub(crate) fn repo_identity_blocking(path: &Path) -> Result<RepoIdentity, RepoInitError> {
    if !path.is_dir() || !is_repo_root(path) {
        return Err(RepoInitError::DirNotFound(
            path.to_string_lossy().into_owned(),
        ));
    }
    let roots = run_git(path, &["rev-list", "--max-parents=0", "HEAD"])?;
    let mut root_commits: Vec<String> = roots
        .lines()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
        .collect();
    root_commits.sort();
    let remote_url = run_git(path, &["config", "--get", "remote.origin.url"])
        .ok()
        .and_then(|value| normalize_remote_url(&value));
    Ok(RepoIdentity {
        root_commits,
        remote_url,
    })
}

#[tauri::command]
pub async fn repo_identity(path: String) -> Result<RepoIdentity, RepoInitError> {
    tauri::async_runtime::spawn_blocking(move || repo_identity_blocking(Path::new(&path)))
        .await
        .map_err(|error| RepoInitError::Git {
            message: error.to_string(),
        })?
}

fn candidate_directories(parent: &Path) -> Vec<PathBuf> {
    let mut candidates = Vec::new();
    if is_repo_root(parent) {
        candidates.push(parent.to_path_buf());
    }
    let Ok(entries) = std::fs::read_dir(parent) else {
        return candidates;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() && is_repo_root(&path) {
            candidates.push(path);
        }
    }
    candidates.sort();
    candidates
}

fn identities_match(project: &MovedProjectInput, identity: &RepoIdentity) -> bool {
    let root_matches = project
        .root_commit
        .as_ref()
        .map(|root| identity.root_commits.contains(root))
        .unwrap_or(false);
    let remote_matches = project
        .remote_url
        .as_ref()
        .zip(identity.remote_url.as_ref())
        .map(|(expected, actual)| expected == actual)
        .unwrap_or(false);
    root_matches && remote_matches
}

pub(crate) fn find_moved_projects_blocking(args: FindMovedProjectsArgs) -> Vec<MovedProjectMatch> {
    let candidates: Vec<(PathBuf, RepoIdentity)> = candidate_directories(Path::new(&args.parent))
        .into_iter()
        .filter_map(|path| {
            repo_identity_blocking(&path)
                .ok()
                .map(|identity| (path, identity))
        })
        .collect();
    args.projects
        .into_iter()
        .map(|project| {
            if let Some((path, identity)) = candidates
                .iter()
                .find(|(_, identity)| identities_match(&project, identity))
            {
                return MovedProjectMatch {
                    project_id: project.id,
                    path: Some(path.to_string_lossy().into_owned()),
                    verdict: MovedProjectVerdict::SameRepository,
                    identity: Some(identity.clone()),
                };
            }
            let named = candidates.iter().find(|(path, _)| {
                path.file_name()
                    .map(|name| name.to_string_lossy() == project.name)
                    .unwrap_or(false)
            });
            let Some((path, identity)) = named else {
                return MovedProjectMatch {
                    project_id: project.id,
                    path: None,
                    verdict: MovedProjectVerdict::NotFound,
                    identity: None,
                };
            };
            let has_saved_identity = project.root_commit.is_some() && project.remote_url.is_some();
            MovedProjectMatch {
                project_id: project.id,
                path: Some(path.to_string_lossy().into_owned()),
                verdict: if has_saved_identity {
                    MovedProjectVerdict::DifferentRepository
                } else {
                    MovedProjectVerdict::SameNameUnconfirmed
                },
                identity: Some(identity.clone()),
            }
        })
        .collect()
}

#[tauri::command]
pub async fn find_moved_projects(args: FindMovedProjectsArgs) -> Vec<MovedProjectMatch> {
    tauri::async_runtime::spawn_blocking(move || find_moved_projects_blocking(args))
        .await
        .unwrap_or_default()
}

#[tauri::command]
pub async fn scan_child_repos(path: String) -> Vec<ChildRepo> {
    tauri::async_runtime::spawn_blocking(move || scan_child_repos_blocking(path))
        .await
        .unwrap_or_default()
}

fn scan_child_repos_blocking(path: String) -> Vec<ChildRepo> {
    let parent = Path::new(path.trim());
    let Ok(entries) = std::fs::read_dir(parent) else {
        return Vec::new();
    };
    let mut repos: Vec<ChildRepo> = Vec::new();
    for entry in entries.flatten() {
        let name = entry.file_name().to_string_lossy().into_owned();
        if name.starts_with('.') {
            continue;
        }
        let Ok(resolved) = std::fs::canonicalize(entry.path()) else {
            continue;
        };
        if !resolved.is_dir() || !resolved.join(".git").exists() {
            continue;
        }
        if !is_repo_root(&resolved) {
            continue;
        }
        repos.push(ChildRepo {
            name,
            default_branch: local_default_branch(&resolved),
            path: resolved.to_string_lossy().into_owned(),
        });
    }
    repos.sort();
    repos
}

#[tauri::command]
pub async fn project_git_status(project_path: String) -> WorkspaceGitStatus {
    tauri::async_runtime::spawn_blocking(move || project_git_status_blocking(project_path))
        .await
        .unwrap_or_else(|_| blank_status("missing"))
}

fn project_git_status_blocking(project_path: String) -> WorkspaceGitStatus {
    let root = Path::new(project_path.trim());
    if !root.is_dir() {
        return blank_status("missing");
    }
    if !is_repo_root(root) {
        return blank_status("absent");
    }
    let working_tree = crate::worktree::read_working_tree(root);
    let branch = crate::worktree::current_branch_name(root);
    if !has_commit(root) {
        return WorkspaceGitStatus {
            state: "unborn",
            branch,
            head_subject: None,
            upstream_distance: GitDistance::Unknown {
                reason: GitUnknownReason::NoUpstream,
            },
            working_tree,
            upstream: None,
            in_progress: crate::worktree::in_progress_operation(root),
        };
    }
    let configured = crate::worktree::resolve_upstream(root);
    let remote = crate::branch_remote::branch_remote(
        root,
        branch.as_deref(),
        configured
            .as_deref()
            .map(|name| crate::branch_remote::ConfiguredUpstream {
                name,
                distance: None,
            }),
    );
    let upstream = remote.tracking;
    let upstream_distance = remote.distance;
    WorkspaceGitStatus {
        state: "ready",
        branch,
        head_subject: run_git(root, &["log", "-1", "--format=%s"])
            .ok()
            .map(|found| found.trim().to_string())
            .filter(|found| !found.is_empty()),
        upstream_distance,
        working_tree,
        upstream,
        in_progress: crate::worktree::in_progress_operation(root),
    }
}

#[tauri::command]
pub async fn project_fetch(
    project_path: String,
    workspace_id: Option<String>,
    project_id: Option<String>,
) -> Result<(), crate::github::GithubError> {
    tauri::async_runtime::spawn_blocking(move || {
        project_fetch_blocking(project_path, workspace_id, project_id)
    })
    .await
    .unwrap_or(Ok(()))
}

fn project_fetch_blocking(
    project_path: String,
    workspace_id: Option<String>,
    project_id: Option<String>,
) -> Result<(), crate::github::GithubError> {
    let root = Path::new(project_path.trim());
    if !root.is_dir() || !is_repo_root(root) {
        return Ok(());
    }
    let Some(remote) = crate::remote::resolve(root) else {
        return Ok(());
    };
    let token = crate::github::read_token(workspace_id.as_deref(), project_id.as_deref())?;
    let result = crate::remote_auth::run_git_authenticated(
        &["fetch", "--no-tags", "--prune", &remote],
        &project_path,
        token.as_deref(),
    )?;
    if result.exit_code != 0 {
        return Err(crate::github::GithubError::Validation(
            result.stderr.trim().to_string(),
        ));
    }
    Ok(())
}

fn blank_status(state: &'static str) -> WorkspaceGitStatus {
    WorkspaceGitStatus {
        state,
        branch: None,
        head_subject: None,
        upstream_distance: GitDistance::Unknown {
            reason: GitUnknownReason::NoUpstream,
        },
        working_tree: GitWorkingTree::Unknown {
            reason: GitUnknownReason::StatusReadFailed,
        },
        upstream: None,
        in_progress: None,
    }
}

pub(crate) fn is_repo_root(root: &Path) -> bool {
    let check = check_folder(&root.to_string_lossy());
    let Some(toplevel) = check.root_path.filter(|found| !found.is_empty()) else {
        return false;
    };
    let resolved = std::fs::canonicalize(&toplevel).unwrap_or_else(|_| PathBuf::from(&toplevel));
    let canonical_root = std::fs::canonicalize(root).unwrap_or_else(|_| root.to_path_buf());
    resolved == canonical_root
}

pub fn is_supported_remote_url(url: &str) -> bool {
    let trimmed = url.trim();
    if trimmed.is_empty() || trimmed.starts_with('-') {
        return false;
    }
    if trimmed.chars().any(|c| c.is_whitespace() || c.is_control()) {
        return false;
    }
    for scheme in ["https://", "http://", "ssh://", "git://"] {
        if let Some(rest) = trimmed.strip_prefix(scheme) {
            let Some((authority, path)) = rest.split_once('/') else {
                return false;
            };
            return is_supported_authority(authority) && !path.is_empty();
        }
    }
    let Some((user_host, path)) = trimmed.split_once(':') else {
        return false;
    };
    let Some((user, host)) = user_host.split_once('@') else {
        return false;
    };
    !user.is_empty()
        && !path.is_empty()
        && !user_host.contains('/')
        && is_supported_authority(user_host)
        && !host.is_empty()
}

fn is_supported_authority(authority: &str) -> bool {
    if authority.is_empty() || authority.starts_with('-') {
        return false;
    }
    let host = authority.rsplit('@').next().unwrap_or(authority);
    !host.is_empty() && !host.starts_with('-')
}

#[tauri::command]
pub async fn repo_init(path: String) -> Result<InitializedRepo, RepoInitError> {
    tauri::async_runtime::spawn_blocking(move || repo_init_blocking(path))
        .await
        .map_err(|error| RepoInitError::Io(std::io::Error::other(error.to_string())))?
}

fn repo_init_blocking(path: String) -> Result<InitializedRepo, RepoInitError> {
    init_repo_at(&path)
}

pub(crate) fn init_repo_at(path: &str) -> Result<InitializedRepo, RepoInitError> {
    let root = PathBuf::from(path.trim());
    if !root.is_dir() {
        return Err(RepoInitError::DirNotFound(path.to_string()));
    }
    let root = std::fs::canonicalize(&root)?;

    match repo_state(&root)? {
        RepoState::Nested(toplevel) => Err(RepoInitError::NestedRepo(toplevel)),
        RepoState::AtRoot => adopt_repo(&root),
        RepoState::Absent => create_repo(&root),
    }
}

pub(crate) fn repo_state(root: &Path) -> Result<RepoState, RepoInitError> {
    let check = check_folder(&root.to_string_lossy());
    let Some(toplevel) = check.root_path.filter(|found| !found.is_empty()) else {
        if root.join(".git").exists() {
            return Err(RepoInitError::AlreadyRepo(
                root.to_string_lossy().into_owned(),
            ));
        }
        return Ok(RepoState::Absent);
    };
    let resolved = std::fs::canonicalize(&toplevel).unwrap_or_else(|_| PathBuf::from(&toplevel));
    if resolved == root {
        return Ok(RepoState::AtRoot);
    }
    Ok(RepoState::Nested(toplevel))
}

fn create_repo(root: &Path) -> Result<InitializedRepo, RepoInitError> {
    let snapshot = GitignoreSnapshot::capture(root);
    run_git(root, &["init"])?;
    match scaffold_repo(root) {
        Ok(()) => Ok(InitializedRepo {
            root_path: root.to_string_lossy().into_owned(),
            remote_url: String::new(),
            branch: DEFAULT_BRANCH.to_string(),
        }),
        Err(err) => Err(undo_creation(root, &snapshot, err)),
    }
}

fn scaffold_repo(root: &Path) -> Result<(), RepoInitError> {
    run_git(root, &["symbolic-ref", "HEAD", "refs/heads/main"])?;
    apply_ignore_entries(root)?;
    commit_ignore_file(root)?;
    Ok(())
}

fn adopt_repo(root: &Path) -> Result<InitializedRepo, RepoInitError> {
    if !has_commit(root) {
        let snapshot = GitignoreSnapshot::capture(root);
        if let Err(err) = apply_ignore_entries(root) {
            return Err(undo_ignore(root, &snapshot, err));
        }
        run_git(root, &["symbolic-ref", "HEAD", "refs/heads/main"])?;
        commit_ignore_file(root)?;
    }
    Ok(InitializedRepo {
        root_path: root.to_string_lossy().into_owned(),
        remote_url: current_origin(root).unwrap_or_default(),
        branch: current_branch(root),
    })
}

fn apply_ignore_entries(root: &Path) -> Result<(), RepoInitError> {
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("/"));
    let skip_goodboy = crate::goodboy_ignore::probe_ignored(root, &home);
    write_ignore_entries(root, skip_goodboy)?;
    for probe in IGNORE_PROBE_PATHS {
        if !is_path_ignored(root, probe)? {
            return Err(RepoInitError::IgnoreNotApplied(probe.to_string()));
        }
    }
    Ok(())
}

fn write_ignore_entries(root: &Path, skip_goodboy: bool) -> Result<(), RepoInitError> {
    let entries: Vec<&str> = CONVERSION_IGNORE_ENTRIES
        .iter()
        .copied()
        .filter(|entry| !(skip_goodboy && *entry == GOODBOY_IGNORE_ENTRY))
        .collect();
    crate::ignore_file::append_ignore_entries(&root.join(".gitignore"), &entries).map_err(
        |error| match error {
            crate::ignore_file::IgnoreWriteError::Io(inner) => RepoInitError::Io(inner),
            other => RepoInitError::Io(std::io::Error::other(other.to_string())),
        },
    )?;
    Ok(())
}

fn is_path_ignored(root: &Path, probe: &str) -> Result<bool, RepoInitError> {
    let output = Git::new()
        .args(["check-ignore", "--no-index", "-q", "--", probe])
        .cwd(root)
        .output()
        .map_err(std::io::Error::from)?;
    match output.status.code() {
        Some(0) => Ok(true),
        Some(1) => Ok(false),
        _ => Err(RepoInitError::Git {
            message: format!(
                "git check-ignore {probe} failed: {}",
                String::from_utf8_lossy(&output.stderr).trim()
            ),
        }),
    }
}

fn commit_ignore_file(root: &Path) -> Result<(), RepoInitError> {
    run_git(root, &["add", "--", ".gitignore"])?;
    let plain = run_git(
        root,
        &[
            "commit",
            "--only",
            "--allow-empty",
            "-m",
            INITIAL_COMMIT_MESSAGE,
            "--",
            ".gitignore",
        ],
    );
    if plain.is_ok() {
        return Ok(());
    }
    run_git(
        root,
        &[
            "-c",
            "commit.gpgsign=false",
            "-c",
            &format!("user.name={FALLBACK_AUTHOR_NAME}"),
            "-c",
            &format!("user.email={FALLBACK_AUTHOR_EMAIL}"),
            "commit",
            "--only",
            "--allow-empty",
            "-m",
            INITIAL_COMMIT_MESSAGE,
            "--",
            ".gitignore",
        ],
    )?;
    Ok(())
}

pub(crate) fn has_commit(root: &Path) -> bool {
    run_git(root, &["rev-parse", "--verify", "HEAD"]).is_ok()
}

fn current_origin(root: &Path) -> Option<String> {
    let found = run_git(root, &["config", "--get", "remote.origin.url"]).ok()?;
    let trimmed = found.trim().to_string();
    if trimmed.is_empty() {
        return None;
    }
    Some(trimmed)
}

fn current_branch(root: &Path) -> String {
    let Ok(found) = run_git(root, &["rev-parse", "--abbrev-ref", "HEAD"]) else {
        return DEFAULT_BRANCH.to_string();
    };
    let trimmed = found.trim();
    if trimmed.is_empty() || trimmed == "HEAD" {
        return DEFAULT_BRANCH.to_string();
    }
    trimmed.to_string()
}

impl GitignoreSnapshot {
    fn capture(root: &Path) -> Self {
        let path = root.join(".gitignore");
        Self {
            existed: path.exists(),
            content: std::fs::read(&path).ok(),
        }
    }

    fn restore(&self, root: &Path) -> std::io::Result<()> {
        let path = root.join(".gitignore");
        if !self.existed {
            return match std::fs::remove_file(&path) {
                Err(err) if err.kind() != std::io::ErrorKind::NotFound => Err(err),
                _ => Ok(()),
            };
        }
        let Some(previous) = self.content.as_ref() else {
            return Ok(());
        };
        if std::fs::read(&path).ok().as_ref() == Some(previous) {
            return Ok(());
        }
        std::fs::write(&path, previous)
    }
}

fn undo_creation(root: &Path, snapshot: &GitignoreSnapshot, cause: RepoInitError) -> RepoInitError {
    let mut failures: Vec<String> = Vec::new();
    if let Err(err) = std::fs::remove_dir_all(root.join(".git")) {
        if err.kind() != std::io::ErrorKind::NotFound {
            failures.push(format!("could not remove .git: {err}"));
        }
    }
    if let Err(err) = snapshot.restore(root) {
        failures.push(format!("could not restore .gitignore: {err}"));
    }
    if failures.is_empty() {
        return cause;
    }
    RepoInitError::RollbackFailed {
        message: format!("{cause}. {} left behind", failures.join(", ")),
    }
}

fn undo_ignore(root: &Path, snapshot: &GitignoreSnapshot, cause: RepoInitError) -> RepoInitError {
    let Err(err) = snapshot.restore(root) else {
        return cause;
    };
    RepoInitError::RollbackFailed {
        message: format!("{cause}. could not restore .gitignore: {err}"),
    }
}

fn run_git(cwd: &Path, args: &[&str]) -> Result<String, RepoInitError> {
    crate::worktree::git(cwd, args).map_err(|err| RepoInitError::Git {
        message: err.to_string(),
    })
}

#[cfg(test)]
mod wire_shape;

#[cfg(test)]
mod tests {
    use super::{
        init_repo_at, is_supported_remote_url, project_git_status_blocking, RepoInitError,
    };
    use crate::worktree::{GitDistance, GitWorkingTree};

    fn test_root(name: &str) -> std::path::PathBuf {
        let root = std::env::temp_dir().join(format!(
            "goodboy-{name}-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        std::fs::create_dir_all(&root).unwrap();
        root
    }

    fn git_output(cwd: &std::path::Path, args: &[&str]) -> String {
        let out = crate::path_env::command("git")
            .args(args)
            .current_dir(cwd)
            .output()
            .unwrap();
        String::from_utf8(out.stdout).unwrap().trim().to_string()
    }

    fn git_ignores(cwd: &std::path::Path, path: &str) -> bool {
        crate::path_env::command("git")
            .args(["check-ignore", "--no-index", "-q", "--", path])
            .current_dir(cwd)
            .output()
            .unwrap()
            .status
            .success()
    }

    fn convert(root: &std::path::Path) -> Result<super::InitializedRepo, RepoInitError> {
        init_repo_at(&root.to_string_lossy())
    }

    fn add_origin(root: &std::path::Path, url: &str) {
        git_run(root, &["remote", "add", "origin", url]);
    }

    #[test]
    fn commits_only_the_ignore_file_and_leaves_the_folder_untracked() {
        let root = test_root("repo-init");
        std::fs::write(root.join("notes.md"), "hello").unwrap();
        std::fs::write(root.join(".env"), "SECRET=1").unwrap();
        std::fs::create_dir_all(root.join("sessions").join("plan-1")).unwrap();
        std::fs::write(root.join("sessions").join("plan-1").join(".goodboy"), "{}").unwrap();

        let created = convert(&root).unwrap();

        assert_eq!(created.branch, "main");
        assert_eq!(git_output(&root, &["ls-files"]), ".gitignore");
        assert!(git_output(&root, &["status", "--porcelain"]).contains("?? notes.md"));
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn anchors_the_ignore_entries_to_the_workspace_root() {
        let root = test_root("repo-init-ignore");
        std::fs::write(root.join(".gitignore"), "node_modules\n").unwrap();

        convert(&root).unwrap();

        let ignore = std::fs::read_to_string(root.join(".gitignore")).unwrap();
        let lines: Vec<&str> = ignore.lines().collect();
        assert!(lines.contains(&"node_modules"));
        assert!(lines.contains(&"/sessions/"));
        assert!(git_ignores(&root, "sessions/plan-1/.goodboy"));
        assert!(git_ignores(&root, ".goodboy/worktrees/probe"));
        assert!(!git_ignores(&root, "src/app/sessions/page.ts"));
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn a_gitignore_that_is_not_utf_8_keeps_its_bytes_through_the_conversion() {
        let root = test_root("repo-init-bytes");
        let original: Vec<u8> = b"caf\xe9/\nnode_modules\n".to_vec();
        std::fs::write(root.join(".gitignore"), &original).unwrap();

        convert(&root).unwrap();

        let written = std::fs::read(root.join(".gitignore")).unwrap();
        assert!(written.starts_with(&original));
        assert!(written.ends_with(b"/sessions/\n"));
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn a_failed_conversion_puts_back_a_gitignore_that_is_not_utf_8() {
        let root = test_root("repo-init-bytes-rollback");
        let original: Vec<u8> = b"caf\xe9/\n/sessions/\n!/sessions/\n".to_vec();
        std::fs::write(root.join(".gitignore"), &original).unwrap();

        let err = convert(&root).unwrap_err();

        assert!(matches!(err, RepoInitError::IgnoreNotApplied(_)));
        assert_eq!(std::fs::read(root.join(".gitignore")).unwrap(), original);
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn initializes_a_repository_without_a_remote() {
        let root = test_root("repo-init-plain");
        std::fs::write(root.join("notes.md"), "hello").unwrap();

        let created = super::repo_init_blocking(root.to_string_lossy().into_owned()).unwrap();

        assert_eq!(created.branch, "main");
        assert_eq!(created.remote_url, "");
        assert_eq!(git_output(&root, &["ls-files"]), ".gitignore");
        assert_eq!(git_output(&root, &["rev-list", "--count", "HEAD"]), "1");
        assert!(git_output(&root, &["remote"]).is_empty());
        assert!(git_ignores(&root, ".goodboy/worktrees/probe"));
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn plain_init_adopts_an_existing_repository_and_keeps_its_remote() {
        let root = test_root("repo-init-plain-adopt");
        convert(&root).unwrap();
        add_origin(&root, "https://github.com/acme/widgets.git");

        let adopted = super::repo_init_blocking(root.to_string_lossy().into_owned()).unwrap();

        assert_eq!(adopted.remote_url, "https://github.com/acme/widgets.git");
        assert_eq!(git_output(&root, &["rev-list", "--count", "HEAD"]), "1");
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn plain_init_refuses_a_folder_nested_inside_another_repository() {
        let root = test_root("repo-init-plain-nested");
        crate::path_env::command("git")
            .args(["init"])
            .current_dir(&root)
            .output()
            .unwrap();
        let nested = root.join("notes");
        std::fs::create_dir_all(&nested).unwrap();

        let err = super::repo_init_blocking(nested.to_string_lossy().into_owned()).unwrap_err();

        assert!(matches!(err, RepoInitError::NestedRepo(_)));
        assert!(!nested.join(".git").exists());
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn refuses_a_directory_that_already_has_a_git_dir() {
        let root = test_root("repo-init-existing");
        std::fs::create_dir_all(root.join(".git")).unwrap();

        let err = convert(&root).unwrap_err();

        assert!(matches!(err, RepoInitError::AlreadyRepo(_)));
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn refuses_a_folder_nested_inside_another_repository() {
        let root = test_root("repo-init-nested");
        crate::path_env::command("git")
            .args(["init"])
            .current_dir(&root)
            .output()
            .unwrap();
        let nested = root.join("notes");
        std::fs::create_dir_all(&nested).unwrap();

        let err = convert(&nested).unwrap_err();

        assert!(matches!(err, RepoInitError::NestedRepo(_)));
        assert!(!nested.join(".git").exists());
        assert!(!nested.join(".gitignore").exists());
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn adopts_a_repository_a_failed_conversion_left_behind() {
        let root = test_root("repo-init-adopt");
        convert(&root).unwrap();
        add_origin(&root, "https://github.com/acme/widgets.git");

        let adopted = convert(&root).unwrap();

        assert_eq!(adopted.remote_url, "https://github.com/acme/widgets.git");
        assert_eq!(adopted.branch, "main");
        assert_eq!(git_output(&root, &["rev-list", "--count", "HEAD"]), "1");
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn adopts_a_repository_the_user_created_without_a_remote() {
        let root = test_root("repo-init-adopt-plain");
        crate::path_env::command("git")
            .args(["init"])
            .current_dir(&root)
            .output()
            .unwrap();
        std::fs::write(root.join("notes.md"), "hello").unwrap();
        crate::path_env::command("git")
            .args(["add", "--", "notes.md"])
            .current_dir(&root)
            .output()
            .unwrap();

        let adopted = convert(&root).unwrap();

        assert_eq!(adopted.remote_url, "");
        assert_eq!(
            git_output(&root, &["ls-tree", "--name-only", "HEAD"]),
            ".gitignore"
        );
        assert!(git_output(&root, &["status", "--porcelain"]).contains("A  notes.md"));
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn refuses_to_commit_when_git_still_does_not_ignore_session_data() {
        let root = test_root("repo-init-unignored");
        std::fs::write(root.join(".gitignore"), "/sessions/\n!/sessions/\n").unwrap();

        let err = convert(&root).unwrap_err();

        assert!(matches!(err, RepoInitError::IgnoreNotApplied(_)));
        assert!(!root.join(".git").exists());
        assert_eq!(
            std::fs::read_to_string(root.join(".gitignore")).unwrap(),
            "/sessions/\n!/sessions/\n"
        );
        std::fs::remove_dir_all(root).unwrap();
    }

    #[cfg(unix)]
    #[test]
    fn removes_the_ignore_file_it_created_when_the_conversion_fails() {
        let root = test_root("repo-init-rollback");
        std::os::unix::fs::symlink(root.join("missing").join("target"), root.join(".gitignore"))
            .unwrap();

        let err = convert(&root).unwrap_err();

        assert!(matches!(err, RepoInitError::Io(_)));
        assert!(!root.join(".git").exists());
        assert!(std::fs::symlink_metadata(root.join(".gitignore")).is_err());
        std::fs::remove_dir_all(root).unwrap();
    }

    fn git_run(cwd: &std::path::Path, args: &[&str]) {
        crate::path_env::command("git")
            .args(args)
            .current_dir(cwd)
            .output()
            .unwrap();
    }

    fn status_of(root: &std::path::Path) -> super::WorkspaceGitStatus {
        project_git_status_blocking(root.to_string_lossy().into_owned())
    }

    #[test]
    fn reports_a_plain_folder_as_having_no_repository() {
        let root = test_root("status-absent");
        std::fs::write(root.join("notes.md"), "hello").unwrap();

        let absent = status_of(&root);
        let missing = project_git_status_blocking(root.join("gone").to_string_lossy().into_owned());

        assert_eq!(absent.state, "absent");
        assert_eq!(absent.branch, None);
        assert_eq!(missing.state, "missing");
        assert!(!root.join(".git").exists());
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn reports_a_repository_without_commits_as_unborn() {
        let root = test_root("status-unborn");
        git_run(&root, &["init", "-b", "main"]);
        std::fs::write(root.join("notes.md"), "hello").unwrap();

        let unborn = status_of(&root);

        assert_eq!(unborn.state, "unborn");
        assert_eq!(unborn.branch.as_deref(), Some("main"));
        assert_eq!(
            unborn.working_tree,
            GitWorkingTree::Known {
                staged: 0,
                unstaged: 0,
                untracked: 1,
                unmerged: 0,
                changed: 1
            }
        );
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn reports_branch_dirt_and_distance_from_upstream() {
        let root = test_root("status-ready");
        git_run(&root, &["init", "-b", "main"]);
        git_run(&root, &["config", "user.email", "test@example.com"]);
        git_run(&root, &["config", "user.name", "test"]);
        git_run(&root, &["config", "commit.gpgsign", "false"]);
        std::fs::write(root.join("base.txt"), "base").unwrap();
        git_run(&root, &["add", "--", "base.txt"]);
        git_run(&root, &["commit", "-m", "base"]);
        let remote = test_root("status-ready-remote").join("origin.git");
        git_run(&root, &["init", "--bare", remote.to_str().unwrap()]);
        git_run(
            &root,
            &["remote", "add", "origin", remote.to_str().unwrap()],
        );
        git_run(&root, &["push", "-u", "origin", "main"]);
        std::fs::write(root.join("next.txt"), "next").unwrap();
        git_run(&root, &["add", "--", "next.txt"]);
        git_run(&root, &["commit", "-m", "next"]);
        std::fs::write(root.join("dirty.txt"), "dirty").unwrap();

        let ready = status_of(&root);

        assert_eq!(ready.state, "ready");
        assert_eq!(ready.branch.as_deref(), Some("main"));
        assert_eq!(ready.head_subject.as_deref(), Some("next"));
        assert_eq!(
            ready.upstream_distance,
            GitDistance::Known {
                ahead: 1,
                behind: 0
            }
        );
        assert_eq!(ready.upstream.as_deref(), Some("origin/main"));
        assert_eq!(
            ready.working_tree,
            GitWorkingTree::Known {
                staged: 0,
                unstaged: 0,
                untracked: 1,
                unmerged: 0,
                changed: 1
            }
        );
        std::fs::remove_dir_all(root).unwrap();
        std::fs::remove_dir_all(remote.parent().unwrap()).unwrap();
    }

    #[test]
    fn accepts_only_remote_urls_git_understands() {
        assert!(is_supported_remote_url(
            "https://github.com/acme/widgets.git"
        ));
        assert!(is_supported_remote_url(
            "ssh://git@example.com/acme/widgets"
        ));
        assert!(is_supported_remote_url("git@github.com:acme/widgets.git"));
        assert!(!is_supported_remote_url(""));
        assert!(!is_supported_remote_url("acme/widgets"));
        assert!(!is_supported_remote_url("https://github.com"));
        assert!(!is_supported_remote_url("https://github.com/acme/wid gets"));
    }

    #[test]
    fn rejects_a_remote_url_whose_host_looks_like_a_flag() {
        assert!(!is_supported_remote_url("ssh://-oProxyCommand=x/y"));
        assert!(!is_supported_remote_url("ssh://git@-oProxyCommand=x/y"));
        assert!(!is_supported_remote_url(
            "git@-oProxyCommand=x:acme/widgets.git"
        ));
        assert!(!is_supported_remote_url("https:///acme/widgets.git"));
    }

    #[test]
    fn scans_only_direct_visible_children_for_repositories() {
        let root = test_root("scan-children");
        for name in ["beta", "alpha"] {
            let child = root.join(name);
            std::fs::create_dir_all(&child).unwrap();
            git_run(&child, &["init"]);
        }
        let plain = root.join("plain");
        std::fs::create_dir_all(&plain).unwrap();
        let deep = plain.join("deep");
        std::fs::create_dir_all(&deep).unwrap();
        git_run(&deep, &["init"]);
        let hidden = root.join(".hidden");
        std::fs::create_dir_all(&hidden).unwrap();
        git_run(&hidden, &["init"]);
        std::fs::write(root.join("notes.md"), "hello").unwrap();

        let found = super::scan_child_repos_blocking(root.to_string_lossy().into_owned());

        let names: Vec<&str> = found.iter().map(|repo| repo.name.as_str()).collect();
        assert_eq!(names, vec!["alpha", "beta"]);
        let canonical_alpha = std::fs::canonicalize(root.join("alpha")).unwrap();
        assert_eq!(found[0].path, canonical_alpha.to_string_lossy());
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn scan_returns_nothing_for_a_missing_or_repo_free_folder() {
        let root = test_root("scan-empty");
        std::fs::create_dir_all(root.join("plain")).unwrap();

        let empty = super::scan_child_repos_blocking(root.to_string_lossy().into_owned());
        let missing =
            super::scan_child_repos_blocking(root.join("gone").to_string_lossy().into_owned());

        assert!(empty.is_empty());
        assert!(missing.is_empty());
        std::fs::remove_dir_all(root).unwrap();
    }

    #[cfg(unix)]
    #[test]
    fn scan_resolves_a_symlinked_repository_and_skips_a_broken_link() {
        let root = test_root("scan-symlink");
        let target = test_root("scan-symlink-target");
        git_run(&target, &["init"]);
        std::os::unix::fs::symlink(&target, root.join("linked")).unwrap();
        std::os::unix::fs::symlink(root.join("gone"), root.join("broken")).unwrap();

        let found = super::scan_child_repos_blocking(root.to_string_lossy().into_owned());

        assert_eq!(found.len(), 1);
        assert_eq!(found[0].name, "linked");
        let canonical_target = std::fs::canonicalize(&target).unwrap();
        assert_eq!(found[0].path, canonical_target.to_string_lossy());
        std::fs::remove_dir_all(root).unwrap();
        std::fs::remove_dir_all(target).unwrap();
    }

    #[test]
    fn identity_normalizes_credentials_and_git_suffix() {
        let root = test_root("repo-identity");
        git_run(&root, &["init"]);
        git_run(&root, &["config", "user.name", "Goodboy Test"]);
        git_run(&root, &["config", "user.email", "goodboy@localhost"]);
        std::fs::write(root.join("README.md"), "ledger").unwrap();
        git_run(&root, &["add", "README.md"]);
        git_run(&root, &["commit", "-m", "initial"]);
        git_run(
            &root,
            &[
                "remote",
                "add",
                "origin",
                &format!(
                    "https:{}token@github.com/acme/ledger-core.git",
                    "/".repeat(2)
                ),
            ],
        );

        let identity = super::repo_identity_blocking(&root).unwrap();

        assert_eq!(identity.root_commits.len(), 1);
        assert_eq!(
            identity.remote_url.as_deref(),
            Some("github.com/acme/ledger-core")
        );
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn moved_project_search_distinguishes_history_from_name() {
        let parent = test_root("moved-projects");
        let matching = parent.join("ledger-core");
        let different = parent.join("payments-api");
        for root in [&matching, &different] {
            std::fs::create_dir_all(root).unwrap();
            git_run(root, &["init"]);
            git_run(root, &["config", "user.name", "Goodboy Test"]);
            git_run(root, &["config", "user.email", "goodboy@localhost"]);
            std::fs::write(root.join("README.md"), root.to_string_lossy().as_bytes()).unwrap();
            git_run(root, &["add", "README.md"]);
            git_run(root, &["commit", "-m", "initial"]);
            git_run(
                root,
                &[
                    "remote",
                    "add",
                    "origin",
                    &format!(
                        "git@github.com:acme/{}.git",
                        root.file_name().unwrap().to_string_lossy()
                    ),
                ],
            );
        }
        let identity = super::repo_identity_blocking(&matching).unwrap();
        let found = super::find_moved_projects_blocking(super::FindMovedProjectsArgs {
            parent: parent.to_string_lossy().into_owned(),
            projects: vec![
                super::MovedProjectInput {
                    id: "matching".to_string(),
                    name: "ledger-core".to_string(),
                    root_commit: identity.root_commits.first().cloned(),
                    remote_url: identity.remote_url,
                },
                super::MovedProjectInput {
                    id: "different".to_string(),
                    name: "payments-api".to_string(),
                    root_commit: Some("unrelated".to_string()),
                    remote_url: Some("github.com/acme/payments-api".to_string()),
                },
                super::MovedProjectInput {
                    id: "legacy".to_string(),
                    name: "payments-api".to_string(),
                    root_commit: None,
                    remote_url: None,
                },
            ],
        });

        assert_eq!(found[0].verdict, super::MovedProjectVerdict::SameRepository);
        assert_eq!(
            found[1].verdict,
            super::MovedProjectVerdict::DifferentRepository
        );
        assert_eq!(
            found[2].verdict,
            super::MovedProjectVerdict::SameNameUnconfirmed
        );
        std::fs::remove_dir_all(parent).unwrap();
    }
    fn committed_repo(name: &str, branch: &str) -> std::path::PathBuf {
        let root = test_root(name);
        git_run(&root, &["init", "-b", branch]);
        git_run(&root, &["config", "user.email", "test@example.com"]);
        git_run(&root, &["config", "user.name", "test"]);
        git_run(&root, &["config", "commit.gpgsign", "false"]);
        std::fs::write(root.join("ledger.txt"), "ledger").unwrap();
        git_run(&root, &["add", "--", "ledger.txt"]);
        git_run(&root, &["commit", "-m", "ledger"]);
        root
    }

    fn check_of(path: &std::path::Path) -> super::GitRepoCheck {
        super::validate_git_repo_blocking(path.to_string_lossy().into_owned())
    }

    #[test]
    fn names_the_reason_a_folder_cannot_be_read() {
        let root = test_root("check-reasons");
        let file = root.join("notes.md");
        std::fs::write(&file, "hello").unwrap();

        let missing = check_of(&root.join("gone"));
        let not_a_folder = check_of(&file);
        let plain = check_of(&root);

        assert_eq!(missing.error_kind, Some(super::GitRepoErrorKind::NotFound));
        assert_eq!(
            not_a_folder.error_kind,
            Some(super::GitRepoErrorKind::NotADirectory)
        );
        assert_eq!(
            plain.error_kind,
            Some(super::GitRepoErrorKind::NotARepository)
        );
        assert!(plain.resolved_path.is_some());
        std::fs::remove_dir_all(root).unwrap();
    }

    #[cfg(unix)]
    #[test]
    fn reports_a_folder_it_may_not_open_as_permission_denied() {
        use std::os::unix::fs::PermissionsExt;
        let root = test_root("check-denied");
        let locked = root.join("locked");
        std::fs::create_dir_all(&locked).unwrap();
        std::fs::set_permissions(&locked, std::fs::Permissions::from_mode(0o000)).unwrap();
        let is_enforced = std::fs::read_dir(&locked).is_err();

        let denied = check_of(&locked);

        std::fs::set_permissions(&locked, std::fs::Permissions::from_mode(0o755)).unwrap();
        if is_enforced {
            assert_eq!(
                denied.error_kind,
                Some(super::GitRepoErrorKind::PermissionDenied)
            );
            assert!(!denied.is_repo);
        }
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn reads_the_default_branch_from_origin_head_first() {
        let root = committed_repo("branch-origin-head", "feature-rounding");
        git_run(
            &root,
            &[
                "remote",
                "add",
                "origin",
                "https://example.com/acme/ledger-core.git",
            ],
        );
        git_run(&root, &["update-ref", "refs/remotes/origin/trunk", "HEAD"]);
        git_run(
            &root,
            &[
                "symbolic-ref",
                "refs/remotes/origin/HEAD",
                "refs/remotes/origin/trunk",
            ],
        );

        let check = check_of(&root);

        assert!(check.is_repo);
        assert_eq!(check.default_branch.as_deref(), Some("trunk"));
        assert_eq!(check.error_kind, None);
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn falls_back_to_the_current_branch_without_origin_head() {
        let root = committed_repo("branch-head", "develop");
        let unborn = test_root("branch-unborn");
        git_run(&unborn, &["init", "-b", "main"]);

        assert_eq!(check_of(&root).default_branch.as_deref(), Some("develop"));
        assert_eq!(check_of(&unborn).default_branch.as_deref(), Some("main"));
        std::fs::remove_dir_all(root).unwrap();
        std::fs::remove_dir_all(unborn).unwrap();
    }

    #[test]
    fn reports_no_default_branch_on_a_detached_head() {
        let root = committed_repo("branch-detached", "main");
        git_run(&root, &["checkout", "--detach"]);

        let check = check_of(&root);

        assert!(check.is_repo);
        assert_eq!(check.default_branch, None);
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn scan_reports_each_child_default_branch() {
        let root = test_root("scan-branches");
        let ledger = committed_repo("scan-branches-ledger", "trunk");
        std::fs::rename(&ledger, root.join("ledger-core")).unwrap();
        let notify = root.join("notify-relay");
        std::fs::create_dir_all(&notify).unwrap();
        git_run(&notify, &["init", "-b", "main"]);

        let found = super::scan_child_repos_blocking(root.to_string_lossy().into_owned());

        let branches: Vec<(&str, Option<&str>)> = found
            .iter()
            .map(|repo| (repo.name.as_str(), repo.default_branch.as_deref()))
            .collect();
        assert_eq!(
            branches,
            vec![
                ("ledger-core", Some("trunk")),
                ("notify-relay", Some("main"))
            ]
        );
        std::fs::remove_dir_all(root).unwrap();
    }
}
