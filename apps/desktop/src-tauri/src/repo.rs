use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use thiserror::Error;

pub const CONVERSION_IGNORE_ENTRIES: [&str; 2] = [".goodboy/", "sessions/"];

const INITIAL_COMMIT_MESSAGE: &str = "chore: track this project with git";
const FALLBACK_AUTHOR_NAME: &str = "Goodboy";
const FALLBACK_AUTHOR_EMAIL: &str = "goodboy@localhost";

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
    #[error("not a usable git remote url: {0}")]
    InvalidRemote(String),
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
            RepoInitError::InvalidRemote(_) => "invalid_remote",
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
            return rest.contains('/') && !rest.starts_with('/');
        }
    }
    let Some((user_host, path)) = trimmed.split_once(':') else {
        return false;
    };
    let Some((user, host)) = user_host.split_once('@') else {
        return false;
    };
    !user.is_empty() && !host.is_empty() && !path.is_empty() && !user_host.contains('/')
}

#[tauri::command]
pub fn repo_init_with_remote(args: RepoInitArgs) -> Result<InitializedRepo, RepoInitError> {
    let root = PathBuf::from(args.path.trim());
    if !root.is_dir() {
        return Err(RepoInitError::DirNotFound(args.path.clone()));
    }
    if root.join(".git").exists() {
        return Err(RepoInitError::AlreadyRepo(args.path.clone()));
    }
    let remote_url = args.remote_url.trim().to_string();
    if !is_supported_remote_url(&remote_url) {
        return Err(RepoInitError::InvalidRemote(args.remote_url.clone()));
    }
    let root = std::fs::canonicalize(&root)?;

    run_git(&root, &["init"])?;
    match scaffold_repo(&root, &remote_url) {
        Ok(()) => Ok(InitializedRepo {
            root_path: root.to_string_lossy().into_owned(),
            remote_url,
            branch: "main".to_string(),
        }),
        Err(err) => {
            let _ = std::fs::remove_dir_all(root.join(".git"));
            Err(err)
        }
    }
}

fn scaffold_repo(root: &Path, remote_url: &str) -> Result<(), RepoInitError> {
    run_git(root, &["symbolic-ref", "HEAD", "refs/heads/main"])?;
    for entry in CONVERSION_IGNORE_ENTRIES {
        crate::worktree::ensure_gitignore_entry(root, entry)
            .map_err(|err| RepoInitError::Git {
                message: err.to_string(),
            })?;
    }
    run_git(root, &["add", "-A"])?;
    commit_initial(root)?;
    run_git(root, &["remote", "add", "origin", remote_url])?;
    Ok(())
}

fn commit_initial(root: &Path) -> Result<(), RepoInitError> {
    let plain = run_git(
        root,
        &["commit", "--allow-empty", "-m", INITIAL_COMMIT_MESSAGE],
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
            "--allow-empty",
            "-m",
            INITIAL_COMMIT_MESSAGE,
        ],
    )?;
    Ok(())
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

    #[test]
    fn initializes_a_repo_with_one_commit_and_an_origin() {
        let root = test_root("repo-init");
        std::fs::write(root.join("notes.md"), "hello").unwrap();
        std::fs::create_dir_all(root.join("sessions").join("plan-1")).unwrap();
        std::fs::write(root.join("sessions").join("plan-1").join(".goodboy"), "{}").unwrap();

        let created = repo_init_with_remote(RepoInitArgs {
            path: root.to_string_lossy().into_owned(),
            remote_url: "https://github.com/acme/widgets.git".to_string(),
        })
        .unwrap();

        assert_eq!(created.branch, "main");
        assert!(root.join(".git").is_dir());
        assert_eq!(
            git_output(&root, &["config", "--get", "remote.origin.url"]),
            "https://github.com/acme/widgets.git"
        );
        assert_eq!(git_output(&root, &["rev-parse", "--abbrev-ref", "HEAD"]), "main");
        assert!(!git_output(&root, &["rev-parse", "HEAD"]).is_empty());
        let tracked = git_output(&root, &["ls-files"]);
        assert!(tracked.contains("notes.md"));
        assert!(!tracked.contains("sessions/"));
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn excludes_session_data_through_the_gitignore() {
        let root = test_root("repo-init-ignore");
        std::fs::write(root.join(".gitignore"), "node_modules\n").unwrap();

        repo_init_with_remote(RepoInitArgs {
            path: root.to_string_lossy().into_owned(),
            remote_url: "git@gitlab.com:acme/widgets.git".to_string(),
        })
        .unwrap();

        let ignore = std::fs::read_to_string(root.join(".gitignore")).unwrap();
        let lines: Vec<&str> = ignore.lines().collect();
        assert_eq!(lines, vec!["node_modules", ".goodboy/", "sessions/"]);
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn refuses_a_directory_that_already_has_a_git_dir() {
        let root = test_root("repo-init-existing");
        std::fs::create_dir_all(root.join(".git")).unwrap();

        let err = repo_init_with_remote(RepoInitArgs {
            path: root.to_string_lossy().into_owned(),
            remote_url: "https://github.com/acme/widgets.git".to_string(),
        })
        .unwrap_err();

        assert!(matches!(err, RepoInitError::AlreadyRepo(_)));
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn refuses_a_remote_url_it_cannot_hand_to_git() {
        let root = test_root("repo-init-remote");

        let err = repo_init_with_remote(RepoInitArgs {
            path: root.to_string_lossy().into_owned(),
            remote_url: "--upload-pack=touch /tmp/pwned".to_string(),
        })
        .unwrap_err();

        assert!(matches!(err, RepoInitError::InvalidRemote(_)));
        assert!(!root.join(".git").exists());
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn accepts_only_remote_urls_git_understands() {
        assert!(is_supported_remote_url("https://github.com/acme/widgets.git"));
        assert!(is_supported_remote_url("ssh://git@example.com/acme/widgets"));
        assert!(is_supported_remote_url("git@github.com:acme/widgets.git"));
        assert!(!is_supported_remote_url(""));
        assert!(!is_supported_remote_url("acme/widgets"));
        assert!(!is_supported_remote_url("https://github.com"));
        assert!(!is_supported_remote_url("https://github.com/acme/wid gets"));
    }
}
