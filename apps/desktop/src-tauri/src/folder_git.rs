mod plan;

use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};

use serde::{Deserialize, Serialize};
use thiserror::Error;

use crate::proc::git::Git;
use crate::repo::{has_commit, repo_state, RepoState};

pub use plan::PlanEntry;

const DEFAULT_BRANCH: &str = "main";
const FIRST_COMMIT_MESSAGE: &str = "Initial commit";
const FALLBACK_AUTHOR_NAME: &str = "Goodboy";
const FALLBACK_AUTHOR_EMAIL: &str = "goodboy@localhost";
const GOODBOY_IGNORE: &str = "/.goodboy";

static SCRATCH_SEQUENCE: AtomicU64 = AtomicU64::new(0);

#[derive(Debug, Error)]
pub enum FolderGitError {
    #[error("folder not found: {0}")]
    NotFound(String),
    #[error("{0} is already tracked with git")]
    AlreadyTracked(String),
    #[error("this folder is inside the git repository at {0}")]
    InsideRepository(String),
    #[error("{0} is not a path Goodboy offered to put in the first commit")]
    UnknownEntry(String),
    #[error("git still does not leave out {0}, so the first commit would carry it")]
    IgnoreNotApplied(String),
    #[error(
        "{0} looks like it holds secrets and was about to be committed. Nothing was committed"
    )]
    SecretStaged(String),
    #[error("{message}")]
    RollbackFailed { message: String },
    #[error("git failed: {message}")]
    Git { message: String },
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
}

crate::util::impl_error_serialize!(FolderGitError);

impl FolderGitError {
    fn kind(&self) -> &'static str {
        match self {
            FolderGitError::NotFound(_) => "not_found",
            FolderGitError::AlreadyTracked(_) => "already_tracked",
            FolderGitError::InsideRepository(_) => "inside_repository",
            FolderGitError::UnknownEntry(_) => "unknown_entry",
            FolderGitError::IgnoreNotApplied(_) => "ignore_not_applied",
            FolderGitError::SecretStaged(_) => "secret_staged",
            FolderGitError::RollbackFailed { .. } => "rollback_failed",
            FolderGitError::Git { .. } => "git",
            FolderGitError::Io(_) => "io",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum PlanStart {
    NoGit,
    NoCommits,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CommitAuthor {
    pub name: String,
    pub email: String,
    pub is_fallback: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FirstCommitPlan {
    pub root_path: String,
    pub start: PlanStart,
    pub branch: String,
    pub author: CommitAuthor,
    pub entries: Vec<PlanEntry>,
    pub has_ignore_file: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FirstCommitArgs {
    pub path: String,
    #[serde(default)]
    pub include: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FirstCommit {
    pub root_path: String,
    pub branch: String,
    pub commit: String,
    pub files: u32,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum ProbeState {
    None,
    Empty,
    Tracked,
    Above,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FolderGitProbe {
    pub path: String,
    pub state: ProbeState,
    pub root_path: Option<String>,
    pub branch: Option<String>,
    pub commit_count: u32,
    pub remote_url: Option<String>,
}

#[tauri::command]
pub async fn folder_git_first_commit_plan(path: String) -> Result<FirstCommitPlan, FolderGitError> {
    tauri::async_runtime::spawn_blocking(move || first_commit_plan_blocking(&path))
        .await
        .map_err(|error| FolderGitError::Io(std::io::Error::other(error.to_string())))?
}

#[tauri::command]
pub async fn folder_git_make_first_commit(
    args: FirstCommitArgs,
) -> Result<FirstCommit, FolderGitError> {
    tauri::async_runtime::spawn_blocking(move || make_first_commit_blocking(&args))
        .await
        .map_err(|error| FolderGitError::Io(std::io::Error::other(error.to_string())))?
}

#[tauri::command]
pub async fn folder_git_probe(path: String) -> Result<FolderGitProbe, FolderGitError> {
    tauri::async_runtime::spawn_blocking(move || probe_blocking(&path))
        .await
        .map_err(|error| FolderGitError::Io(std::io::Error::other(error.to_string())))?
}

fn canonical_folder(path: &str) -> Result<PathBuf, FolderGitError> {
    let trimmed = path.trim();
    let candidate = Path::new(trimmed);
    if !candidate.is_absolute() || !candidate.is_dir() {
        return Err(FolderGitError::NotFound(trimmed.to_string()));
    }
    Ok(std::fs::canonicalize(candidate)?)
}

fn state_of(root: &Path) -> Result<RepoState, FolderGitError> {
    repo_state(root).map_err(|error| match error {
        crate::repo::RepoInitError::AlreadyRepo(found) => FolderGitError::AlreadyTracked(found),
        other => FolderGitError::Git {
            message: other.to_string(),
        },
    })
}

fn start_of(root: &Path) -> Result<PlanStart, FolderGitError> {
    match state_of(root)? {
        RepoState::Absent => Ok(PlanStart::NoGit),
        RepoState::Nested(toplevel) => Err(FolderGitError::InsideRepository(toplevel)),
        RepoState::AtRoot if has_commit(root) => Err(FolderGitError::AlreadyTracked(
            root.to_string_lossy().into_owned(),
        )),
        RepoState::AtRoot => Ok(PlanStart::NoCommits),
    }
}

fn run(root: &Path, args: &[&str]) -> Result<String, FolderGitError> {
    Git::new()
        .cwd(root)
        .env("GIT_OPTIONAL_LOCKS", "0")
        .args(args)
        .stdout()
        .map_err(|error| FolderGitError::Git {
            message: error.to_string(),
        })
}

fn split_paths(raw: &str) -> Vec<String> {
    raw.split('\0')
        .filter(|path| !path.is_empty())
        .map(str::to_string)
        .collect()
}

struct ScratchGitDir(PathBuf);

impl ScratchGitDir {
    fn create() -> Result<Self, FolderGitError> {
        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|elapsed| elapsed.as_nanos())
            .unwrap_or_default();
        let sequence = SCRATCH_SEQUENCE.fetch_add(1, Ordering::Relaxed);
        let dir = std::env::temp_dir().join(format!(
            "goodboy-first-commit-plan-{}-{nanos}-{sequence}",
            std::process::id()
        ));
        std::fs::create_dir_all(&dir)?;
        run(&dir, &["init", "--quiet", "--bare", "."])?;
        Ok(Self(dir))
    }
}

impl Drop for ScratchGitDir {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.0);
    }
}

fn candidate_paths(root: &Path, start: PlanStart) -> Result<Vec<String>, FolderGitError> {
    if start == PlanStart::NoCommits {
        let mut paths = split_paths(&run(
            root,
            &["ls-files", "-z", "--others", "--exclude-standard"],
        )?);
        paths.extend(split_paths(&run(root, &["ls-files", "-z", "--cached"])?));
        paths.sort();
        paths.dedup();
        return Ok(paths);
    }
    let scratch = ScratchGitDir::create()?;
    let git_dir = format!("--git-dir={}", scratch.0.to_string_lossy());
    let work_tree = format!("--work-tree={}", root.to_string_lossy());
    let raw = run(
        root,
        &[
            &git_dir,
            &work_tree,
            "ls-files",
            "-z",
            "--others",
            "--exclude-standard",
        ],
    )?;
    Ok(split_paths(&raw))
}

fn has_goodboy_sessions(root: &Path) -> bool {
    let Ok(children) = std::fs::read_dir(root.join("sessions")) else {
        return false;
    };
    children
        .flatten()
        .any(|child| child.path().join(".goodboy").exists())
}

fn config_value(root: &Path, key: &str) -> Option<String> {
    run(root, &["config", "--get", key])
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}

fn author_of(root: &Path) -> CommitAuthor {
    match (
        config_value(root, "user.name"),
        config_value(root, "user.email"),
    ) {
        (Some(name), Some(email)) => CommitAuthor {
            name,
            email,
            is_fallback: false,
        },
        _ => CommitAuthor {
            name: FALLBACK_AUTHOR_NAME.to_string(),
            email: FALLBACK_AUTHOR_EMAIL.to_string(),
            is_fallback: true,
        },
    }
}

fn branch_of(root: &Path, start: PlanStart) -> String {
    if start == PlanStart::NoGit {
        return DEFAULT_BRANCH.to_string();
    }
    run(root, &["symbolic-ref", "--short", "HEAD"])
        .map(|found| found.trim().to_string())
        .ok()
        .filter(|found| !found.is_empty())
        .unwrap_or_else(|| DEFAULT_BRANCH.to_string())
}

pub(crate) fn first_commit_plan_blocking(path: &str) -> Result<FirstCommitPlan, FolderGitError> {
    let root = canonical_folder(path)?;
    let start = start_of(&root)?;
    let paths = candidate_paths(&root, start)?;
    let entries = plan::plan_entries(&paths, has_goodboy_sessions(&root));
    Ok(FirstCommitPlan {
        root_path: root.to_string_lossy().into_owned(),
        start,
        branch: branch_of(&root, start),
        author: author_of(&root),
        entries,
        has_ignore_file: root.join(".gitignore").is_file(),
    })
}

struct Undo {
    created_git: bool,
    gitignore: Option<String>,
    index: Option<Vec<u8>>,
}

impl Undo {
    fn capture(root: &Path, start: PlanStart) -> Self {
        let index = (start == PlanStart::NoCommits)
            .then(|| std::fs::read(root.join(".git").join("index")).ok())
            .flatten();
        Self {
            created_git: start == PlanStart::NoGit,
            gitignore: std::fs::read_to_string(root.join(".gitignore")).ok(),
            index,
        }
    }

    fn apply(&self, root: &Path, cause: FolderGitError) -> FolderGitError {
        let mut failures: Vec<String> = Vec::new();
        if self.created_git {
            if let Err(error) = std::fs::remove_dir_all(root.join(".git")) {
                if error.kind() != std::io::ErrorKind::NotFound {
                    failures.push(format!("could not remove .git: {error}"));
                }
            }
        }
        if !self.created_git {
            let index = root.join(".git").join("index");
            let restored = match self.index.as_ref() {
                Some(bytes) => std::fs::write(&index, bytes),
                None => remove_if_present(&index),
            };
            if let Err(error) = restored {
                failures.push(format!("could not restore the git index: {error}"));
            }
        }
        let ignore = root.join(".gitignore");
        let restored = match self.gitignore.as_ref() {
            Some(previous) => std::fs::write(&ignore, previous),
            None => remove_if_present(&ignore),
        };
        if let Err(error) = restored {
            failures.push(format!("could not restore .gitignore: {error}"));
        }
        if failures.is_empty() {
            return cause;
        }
        FolderGitError::RollbackFailed {
            message: format!("{cause}. {} left behind", failures.join(", ")),
        }
    }
}

fn remove_if_present(path: &Path) -> std::io::Result<()> {
    match std::fs::remove_file(path) {
        Err(error) if error.kind() != std::io::ErrorKind::NotFound => Err(error),
        _ => Ok(()),
    }
}

fn ignore_lines(entries: &[PlanEntry], include: &[String], root: &Path) -> Vec<String> {
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("/"));
    let mut lines: Vec<String> = Vec::new();
    if !crate::goodboy_ignore::probe_ignored(root, &home) {
        lines.push(GOODBOY_IGNORE.to_string());
    }
    for entry in entries {
        let is_kept_out = entry.is_left_out && !include.contains(&entry.key);
        if !is_kept_out {
            continue;
        }
        if let Some(line) = entry.ignore.as_ref() {
            if !lines.contains(line) {
                lines.push(line.clone());
            }
        }
    }
    lines
}

fn write_ignore(root: &Path, lines: &[String]) -> Result<(), FolderGitError> {
    let path = root.join(".gitignore");
    let mut next = std::fs::read_to_string(&path).unwrap_or_default();
    let mut added = false;
    for line in lines {
        if next.lines().any(|existing| existing.trim() == line) {
            continue;
        }
        if !next.is_empty() && !next.ends_with('\n') {
            next.push('\n');
        }
        next.push_str(line);
        next.push('\n');
        added = true;
    }
    if added {
        std::fs::write(&path, next)?;
    }
    Ok(())
}

fn is_ignored(root: &Path, path: &str) -> Result<bool, FolderGitError> {
    let output = Git::new()
        .cwd(root)
        .args(["check-ignore", "--no-index", "-q", "--", path])
        .output()
        .map_err(|error| FolderGitError::Git {
            message: error.to_string(),
        })?;
    match output.status.code() {
        Some(0) => Ok(true),
        Some(1) => Ok(false),
        _ => Err(FolderGitError::Git {
            message: format!(
                "git check-ignore {path} failed: {}",
                output.stderr_redacted().trim()
            ),
        }),
    }
}

fn verify_left_out(
    root: &Path,
    entries: &[PlanEntry],
    include: &[String],
) -> Result<(), FolderGitError> {
    for entry in entries {
        if !entry.is_left_out || include.contains(&entry.key) {
            continue;
        }
        for sample in &entry.sample {
            if !is_ignored(root, sample)? {
                return Err(FolderGitError::IgnoreNotApplied(sample.clone()));
            }
        }
    }
    Ok(())
}

fn verify_no_secret_staged(root: &Path) -> Result<u32, FolderGitError> {
    let staged = split_paths(&run(root, &["ls-files", "-z", "--cached"])?);
    for path in &staged {
        let name = path.rsplit('/').next().unwrap_or(path);
        if plan::is_secret_name(name) {
            return Err(FolderGitError::SecretStaged(path.clone()));
        }
    }
    Ok(u32::try_from(staged.len()).unwrap_or(u32::MAX))
}

fn commit(root: &Path, author: &CommitAuthor) -> Result<(), FolderGitError> {
    let mut identity: Vec<String> = Vec::new();
    if author.is_fallback {
        identity.push("-c".to_string());
        identity.push(format!("user.name={FALLBACK_AUTHOR_NAME}"));
        identity.push("-c".to_string());
        identity.push(format!("user.email={FALLBACK_AUTHOR_EMAIL}"));
    }
    let tail = ["commit", "--quiet", "-m", FIRST_COMMIT_MESSAGE];
    let plain: Vec<&str> = identity
        .iter()
        .map(String::as_str)
        .chain(tail.iter().copied())
        .collect();
    if run(root, &plain).is_ok() {
        return Ok(());
    }
    let unsigned: Vec<&str> = ["-c", "commit.gpgsign=false"]
        .into_iter()
        .chain(identity.iter().map(String::as_str))
        .chain(tail.iter().copied())
        .collect();
    run(root, &unsigned).map(|_| ())
}

fn scaffold(
    root: &Path,
    plan: &FirstCommitPlan,
    include: &[String],
) -> Result<FirstCommit, FolderGitError> {
    if plan.start == PlanStart::NoGit {
        run(root, &["init", "--quiet"])?;
        run(root, &["symbolic-ref", "HEAD", "refs/heads/main"])?;
    }
    write_ignore(root, &ignore_lines(&plan.entries, include, root))?;
    verify_left_out(root, &plan.entries, include)?;
    run(root, &["add", "--all", "--", "."])?;
    let files = verify_no_secret_staged(root)?;
    commit(root, &plan.author)?;
    let sha = run(root, &["rev-parse", "HEAD"])?.trim().to_string();
    Ok(FirstCommit {
        root_path: plan.root_path.clone(),
        branch: plan.branch.clone(),
        commit: sha,
        files,
    })
}

pub(crate) fn make_first_commit_blocking(
    args: &FirstCommitArgs,
) -> Result<FirstCommit, FolderGitError> {
    let plan = first_commit_plan_blocking(&args.path)?;
    for key in &args.include {
        let is_offered = plan
            .entries
            .iter()
            .any(|entry| entry.can_toggle && &entry.key == key);
        if !is_offered {
            return Err(FolderGitError::UnknownEntry(key.clone()));
        }
    }
    let root = PathBuf::from(&plan.root_path);
    let undo = Undo::capture(&root, plan.start);
    scaffold(&root, &plan, &args.include).map_err(|cause| undo.apply(&root, cause))
}

fn remote_of(root: &Path) -> Option<String> {
    let remotes = run(root, &["remote"]).ok()?;
    let first = remotes
        .lines()
        .map(str::trim)
        .find(|name| !name.is_empty())?;
    config_value(root, &format!("remote.{first}.url"))
}

pub(crate) fn probe_blocking(path: &str) -> Result<FolderGitProbe, FolderGitError> {
    let root = canonical_folder(path)?;
    let trimmed = path.trim().to_string();
    let found = match state_of(&root) {
        Ok(found) => found,
        Err(FolderGitError::AlreadyTracked(_)) => RepoState::AtRoot,
        Err(other) => return Err(other),
    };
    let blank = |state: ProbeState, root_path: Option<String>| FolderGitProbe {
        path: trimmed.clone(),
        state,
        root_path,
        branch: None,
        commit_count: 0,
        remote_url: None,
    };
    match found {
        RepoState::Absent => Ok(blank(ProbeState::None, None)),
        RepoState::Nested(toplevel) => Ok(blank(ProbeState::Above, Some(toplevel))),
        RepoState::AtRoot => {
            let root_path = Some(root.to_string_lossy().into_owned());
            let branch = Some(branch_of(&root, PlanStart::NoCommits));
            let remote_url = remote_of(&root);
            if !has_commit(&root) {
                return Ok(FolderGitProbe {
                    branch,
                    remote_url,
                    ..blank(ProbeState::Empty, root_path)
                });
            }
            let commit_count = run(&root, &["rev-list", "--count", "HEAD"])
                .ok()
                .and_then(|raw| raw.trim().parse::<u32>().ok())
                .unwrap_or(0);
            Ok(FolderGitProbe {
                branch,
                remote_url,
                commit_count,
                ..blank(ProbeState::Tracked, root_path)
            })
        }
    }
}

#[cfg(test)]
mod tests;
