use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use thiserror::Error;

const CONVERSION_IGNORE_ENTRIES: [&str; 2] = ["/.goodboy", "/sessions/"];

const IGNORE_PROBE_PATHS: [&str; 3] = [".goodboy", ".goodboy/worktrees/probe", "sessions/probe"];

const INITIAL_COMMIT_MESSAGE: &str = "chore: track this project with git";
const FALLBACK_AUTHOR_NAME: &str = "Goodboy";
const FALLBACK_AUTHOR_EMAIL: &str = "goodboy@localhost";
const DEFAULT_BRANCH: &str = "main";

#[derive(Debug, Serialize)]
pub struct GitRepoCheck {
    #[serde(rename = "isRepo")]
    pub is_repo: bool,
    #[serde(rename = "rootPath")]
    pub root_path: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Error)]
pub enum RepoInitError {
    #[error("directory not found: {0}")]
    DirNotFound(String),
    #[error("already a git repository: {0}")]
    AlreadyRepo(String),
    #[error("this folder is already inside the git repository at {0}. open that repository as the workspace instead")]
    NestedRepo(String),
    #[error("not a usable git remote url: {0}")]
    InvalidRemote(String),
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
            RepoInitError::InvalidRemote(_) => "invalid_remote",
            RepoInitError::IgnoreNotApplied(_) => "ignore_not_applied",
            RepoInitError::RollbackFailed { .. } => "rollback_failed",
            RepoInitError::Git { .. } => "git",
            RepoInitError::Io(_) => "io",
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct RepoInitArgs {
    pub path: String,
    #[serde(rename = "remoteUrl")]
    pub remote_url: String,
}

#[derive(Debug, Serialize)]
pub struct InitializedRepo {
    #[serde(rename = "rootPath")]
    pub root_path: String,
    #[serde(rename = "remoteUrl")]
    pub remote_url: String,
    pub branch: String,
}

enum RepoState {
    Absent,
    AtRoot,
    Nested(String),
}

struct GitignoreSnapshot {
    existed: bool,
    content: Option<String>,
}

#[tauri::command]
pub fn validate_git_repo(path: String) -> GitRepoCheck {
    let candidate = Path::new(&path);
    if !candidate.exists() {
        return GitRepoCheck {
            is_repo: false,
            root_path: None,
            error: Some(format!("path does not exist: {path}")),
        };
    }
    let output = match crate::path_env::command("git")
        .args(["rev-parse", "--show-toplevel"])
        .current_dir(candidate)
        .output()
    {
        Ok(out) => out,
        Err(err) => {
            return GitRepoCheck {
                is_repo: false,
                root_path: None,
                error: Some(err.to_string()),
            };
        }
    };
    if !output.status.success() {
        return GitRepoCheck {
            is_repo: false,
            root_path: None,
            error: Some("not a git repository".to_string()),
        };
    }
    let root = String::from_utf8(output.stdout)
        .unwrap_or_default()
        .trim()
        .to_string();
    GitRepoCheck {
        is_repo: true,
        root_path: Some(root),
        error: None,
    }
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
pub fn repo_init_with_remote(args: RepoInitArgs) -> Result<InitializedRepo, RepoInitError> {
    let root = PathBuf::from(args.path.trim());
    if !root.is_dir() {
        return Err(RepoInitError::DirNotFound(args.path.clone()));
    }
    let remote_url = args.remote_url.trim().to_string();
    if !is_supported_remote_url(&remote_url) {
        return Err(RepoInitError::InvalidRemote(args.remote_url.clone()));
    }
    let root = std::fs::canonicalize(&root)?;

    match repo_state(&root)? {
        RepoState::Nested(toplevel) => Err(RepoInitError::NestedRepo(toplevel)),
        RepoState::AtRoot => adopt_repo(&root, &remote_url),
        RepoState::Absent => create_repo(&root, &remote_url),
    }
}

fn repo_state(root: &Path) -> Result<RepoState, RepoInitError> {
    let check = validate_git_repo(root.to_string_lossy().into_owned());
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

fn create_repo(root: &Path, remote_url: &str) -> Result<InitializedRepo, RepoInitError> {
    let snapshot = GitignoreSnapshot::capture(root);
    run_git(root, &["init"])?;
    match scaffold_repo(root, remote_url) {
        Ok(()) => Ok(InitializedRepo {
            root_path: root.to_string_lossy().into_owned(),
            remote_url: remote_url.to_string(),
            branch: DEFAULT_BRANCH.to_string(),
        }),
        Err(err) => Err(undo_creation(root, &snapshot, err)),
    }
}

fn scaffold_repo(root: &Path, remote_url: &str) -> Result<(), RepoInitError> {
    run_git(root, &["symbolic-ref", "HEAD", "refs/heads/main"])?;
    apply_ignore_entries(root)?;
    commit_ignore_file(root)?;
    run_git(root, &["remote", "add", "origin", remote_url])?;
    Ok(())
}

fn adopt_repo(root: &Path, remote_url: &str) -> Result<InitializedRepo, RepoInitError> {
    let snapshot = GitignoreSnapshot::capture(root);
    if let Err(err) = apply_ignore_entries(root) {
        return Err(undo_ignore(root, &snapshot, err));
    }
    if !has_commit(root) {
        run_git(root, &["symbolic-ref", "HEAD", "refs/heads/main"])?;
        commit_ignore_file(root)?;
    }
    let origin = match current_origin(root) {
        Some(existing) => existing,
        None => {
            run_git(root, &["remote", "add", "origin", remote_url])?;
            remote_url.to_string()
        }
    };
    Ok(InitializedRepo {
        root_path: root.to_string_lossy().into_owned(),
        remote_url: origin,
        branch: current_branch(root),
    })
}

fn apply_ignore_entries(root: &Path) -> Result<(), RepoInitError> {
    write_ignore_entries(root)?;
    for probe in IGNORE_PROBE_PATHS {
        if !is_path_ignored(root, probe)? {
            return Err(RepoInitError::IgnoreNotApplied(probe.to_string()));
        }
    }
    Ok(())
}

fn write_ignore_entries(root: &Path) -> Result<(), RepoInitError> {
    let path = root.join(".gitignore");
    let mut next = std::fs::read_to_string(&path).unwrap_or_default();
    let mut added = false;
    for entry in CONVERSION_IGNORE_ENTRIES {
        if next.lines().any(|line| line.trim() == entry) {
            continue;
        }
        if !next.is_empty() && !next.ends_with('\n') {
            next.push('\n');
        }
        next.push_str(entry);
        next.push('\n');
        added = true;
    }
    if !added {
        return Ok(());
    }
    std::fs::write(&path, next)?;
    Ok(())
}

fn is_path_ignored(root: &Path, probe: &str) -> Result<bool, RepoInitError> {
    let output = crate::path_env::command("git")
        .args(["check-ignore", "--no-index", "-q", "--", probe])
        .current_dir(root)
        .output()?;
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

fn has_commit(root: &Path) -> bool {
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
            content: std::fs::read_to_string(&path).ok(),
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
        if std::fs::read_to_string(&path).ok().as_ref() == Some(previous) {
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
mod tests {
    use super::{is_supported_remote_url, repo_init_with_remote, RepoInitArgs, RepoInitError};

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

    fn convert(
        root: &std::path::Path,
        remote_url: &str,
    ) -> Result<super::InitializedRepo, RepoInitError> {
        repo_init_with_remote(RepoInitArgs {
            path: root.to_string_lossy().into_owned(),
            remote_url: remote_url.to_string(),
        })
    }

    #[test]
    fn commits_only_the_ignore_file_and_leaves_the_folder_untracked() {
        let root = test_root("repo-init");
        std::fs::write(root.join("notes.md"), "hello").unwrap();
        std::fs::write(root.join(".env"), "SECRET=1").unwrap();
        std::fs::create_dir_all(root.join("sessions").join("plan-1")).unwrap();
        std::fs::write(root.join("sessions").join("plan-1").join(".goodboy"), "{}").unwrap();

        let created = convert(&root, "https://github.com/acme/widgets.git").unwrap();

        assert_eq!(created.branch, "main");
        assert_eq!(
            git_output(&root, &["config", "--get", "remote.origin.url"]),
            "https://github.com/acme/widgets.git"
        );
        assert_eq!(git_output(&root, &["ls-files"]), ".gitignore");
        assert!(git_output(&root, &["status", "--porcelain"]).contains("?? notes.md"));
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn anchors_the_ignore_entries_to_the_workspace_root() {
        let root = test_root("repo-init-ignore");
        std::fs::write(root.join(".gitignore"), "node_modules\n").unwrap();

        convert(&root, "git@gitlab.com:acme/widgets.git").unwrap();

        let ignore = std::fs::read_to_string(root.join(".gitignore")).unwrap();
        let lines: Vec<&str> = ignore.lines().collect();
        assert_eq!(lines, vec!["node_modules", "/.goodboy", "/sessions/"]);
        assert!(git_ignores(&root, "sessions/plan-1/.goodboy"));
        assert!(git_ignores(&root, ".goodboy"));
        assert!(!git_ignores(&root, "src/app/sessions/page.ts"));
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn refuses_a_directory_that_already_has_a_git_dir() {
        let root = test_root("repo-init-existing");
        std::fs::create_dir_all(root.join(".git")).unwrap();

        let err = convert(&root, "https://github.com/acme/widgets.git").unwrap_err();

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

        let err = convert(&nested, "https://github.com/acme/widgets.git").unwrap_err();

        assert!(matches!(err, RepoInitError::NestedRepo(_)));
        assert!(!nested.join(".git").exists());
        assert!(!nested.join(".gitignore").exists());
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn adopts_a_repository_a_failed_conversion_left_behind() {
        let root = test_root("repo-init-adopt");
        convert(&root, "https://github.com/acme/widgets.git").unwrap();

        let adopted = convert(&root, "https://github.com/acme/other.git").unwrap();

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

        let adopted = convert(&root, "https://github.com/acme/widgets.git").unwrap();

        assert_eq!(adopted.remote_url, "https://github.com/acme/widgets.git");
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

        let err = convert(&root, "https://github.com/acme/widgets.git").unwrap_err();

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

        let err = convert(&root, "https://github.com/acme/widgets.git").unwrap_err();

        assert!(matches!(err, RepoInitError::Io(_)));
        assert!(!root.join(".git").exists());
        assert!(std::fs::symlink_metadata(root.join(".gitignore")).is_err());
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn refuses_a_remote_url_it_cannot_hand_to_git() {
        let root = test_root("repo-init-remote");

        let err = convert(&root, "--upload-pack=touch /tmp/pwned").unwrap_err();

        assert!(matches!(err, RepoInitError::InvalidRemote(_)));
        assert!(!root.join(".git").exists());
        std::fs::remove_dir_all(root).unwrap();
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
}
