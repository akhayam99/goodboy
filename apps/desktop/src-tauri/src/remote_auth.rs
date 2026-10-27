use std::time::Duration;

use crate::github::{gh_available, GhRunResult};
use crate::proc::git::{Git, GitError};

struct HostHelper {
    key: &'static str,
    helper: &'static str,
}

const HOST_HELPERS: [HostHelper; 1] = [HostHelper {
    key: "credential.https://github.com.helper",
    helper: "!gh auth git-credential",
}];

fn helper_args() -> Vec<String> {
    match gh_available() {
        true => HOST_HELPERS
            .iter()
            .flat_map(|entry| {
                [
                    "-c".to_string(),
                    format!("{}=", entry.key),
                    "-c".to_string(),
                    format!("{}={}", entry.key, entry.helper),
                ]
            })
            .collect(),
        false => Vec::new(),
    }
}

pub(crate) fn run_git_authenticated(
    args: &[&str],
    cwd: &str,
    token: Option<&str>,
) -> Result<GhRunResult, GitError> {
    run_git_authenticated_within(args, cwd, token, None)
}

pub(crate) fn run_git_authenticated_within(
    args: &[&str],
    cwd: &str,
    token: Option<&str>,
    timeout: Option<Duration>,
) -> Result<GhRunResult, GitError> {
    let mut git = Git::new().login_env();
    if let Some(limit) = timeout {
        git = git.timeout(limit);
    }
    git = git.args(helper_args()).args(args);
    if !cwd.is_empty() {
        git = git.cwd(cwd);
    }
    if let Some(t) = token.filter(|t| !t.is_empty()) {
        git = git.env("GH_TOKEN", t).env("GITHUB_TOKEN", t);
    }
    let output = git.output()?;
    Ok(GhRunResult {
        stdout: output.stdout_lossy(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
        exit_code: output.status.code().unwrap_or(-1),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_missing_directory_is_a_spawn_error_and_never_a_timeout() {
        let error = run_git_authenticated(
            &["fetch", "origin"],
            "/nonexistent/harborline/ledger-core",
            None,
        )
        .unwrap_err();

        assert!(matches!(error, GitError::Spawn(_)), "{error:?}");
    }

    #[test]
    fn a_remote_that_refuses_is_a_failed_run_with_its_own_stderr() {
        let root = std::env::temp_dir().join(format!(
            "goodboy-remote-auth-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        std::fs::create_dir_all(&root).unwrap();
        let cwd = root.to_string_lossy().to_string();
        let init = run_git_authenticated(&["init", "-b", "main"], &cwd, None).unwrap();
        assert_eq!(init.exit_code, 0);
        let missing = root.join("no-such-remote.git");

        let run = run_git_authenticated(
            &["fetch", "--no-tags", missing.to_str().unwrap()],
            &cwd,
            None,
        )
        .unwrap();

        assert_ne!(run.exit_code, 0);
        assert!(!run.stderr.trim().is_empty());
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn the_helper_table_names_github_only() {
        assert_eq!(HOST_HELPERS.len(), 1);
        assert_eq!(HOST_HELPERS[0].key, "credential.https://github.com.helper");
    }
}
