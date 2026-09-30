use super::commits::is_ancestor;
use super::plan::{plan_error, short};
use super::rebase::RebaseCommit;
use crate::worktree::{git, resolve_commit, WorktreeError};
use serde::Serialize;
use std::path::{Path, PathBuf};

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct OriginAhead {
    pub remote_sha: String,
    pub commits: Vec<RebaseCommit>,
    pub fetch_error: Option<String>,
}

pub(crate) fn origin_ahead(
    cwd: &Path,
    branch: &str,
    since: Option<&str>,
    token: Option<&str>,
) -> Result<OriginAhead, WorktreeError> {
    let fetch_error = crate::branch_remote::fetch_branch_ref(cwd, "origin", branch, token);
    let remote_sha = resolve_commit(cwd, &format!("origin/{branch}"))?;
    let from = match since.map(str::trim).filter(|sha| !sha.is_empty()) {
        Some(sha) => resolve_commit(cwd, sha)?,
        None => resolve_commit(cwd, "HEAD")?,
    };
    let range = format!("{from}..{remote_sha}");
    let raw = git(
        cwd,
        &["log", "--reverse", "--format=%H%x1f%P%x1f%s", &range],
    )?;
    let mut commits = Vec::new();
    for line in raw.lines().filter(|line| !line.trim().is_empty()) {
        let mut parts = line.splitn(3, '\u{1f}');
        let sha = parts.next().unwrap_or_default().to_string();
        if parts.next().unwrap_or_default().split_whitespace().count() != 1 {
            return Err(plan_error(&format!(
                "{} on origin is a merge commit: bring it in by hand",
                short(&sha)
            )));
        }
        commits.push(RebaseCommit {
            sha,
            subject: parts.next().unwrap_or_default().to_string(),
        });
    }
    Ok(OriginAhead {
        remote_sha,
        commits,
        fetch_error,
    })
}

#[tauri::command]
pub async fn history_origin_ahead(
    worktree_path: String,
    branch: String,
    since: Option<String>,
    workspace_id: Option<String>,
    project_id: Option<String>,
) -> Result<OriginAhead, WorktreeError> {
    tauri::async_runtime::spawn_blocking(move || {
        let cwd = PathBuf::from(&worktree_path);
        if !cwd.exists() {
            return Err(WorktreeError::RepoNotFound(worktree_path));
        }
        let token = crate::github::read_token(workspace_id.as_deref(), project_id.as_deref());
        origin_ahead(&cwd, &branch, since.as_deref(), token.as_deref())
    })
    .await
    .map_err(|e| WorktreeError::Io(std::io::Error::other(e.to_string())))?
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(tag = "kind", rename_all = "kebab-case")]
pub enum RemoteLease {
    Absent,
    Included { sha: String },
    NotIncluded { sha: String },
    Unknown { reason: String },
}

pub(crate) fn remote_lease(
    cwd: &Path,
    branch: &str,
    expected_head: &str,
    incorporated: Option<&str>,
    incorporated_since: Option<&str>,
    token: Option<&str>,
) -> RemoteLease {
    let reference = format!("refs/heads/{branch}");
    let cwd_text = cwd.to_string_lossy().to_string();
    let run = match crate::github::run_git_authenticated(
        &["ls-remote", "origin", &reference],
        &cwd_text,
        token,
    ) {
        Ok(run) if run.exit_code == 0 => run,
        Ok(run) => {
            return RemoteLease::Unknown {
                reason: run.stderr.trim().to_string(),
            }
        }
        Err(error) => {
            return RemoteLease::Unknown {
                reason: error.to_string(),
            }
        }
    };
    let found = run.stdout.lines().find_map(|line| {
        let (sha, name) = line.split_once('\t')?;
        (name.trim() == reference).then(|| sha.trim().to_string())
    });
    let Some(sha) = found else {
        return RemoteLease::Absent;
    };
    let Ok(expected) = resolve_commit(cwd, expected_head) else {
        return RemoteLease::Unknown {
            reason: "the branch head the plan started from is missing".to_string(),
        };
    };
    let is_incorporated = incorporated.map(str::trim) == Some(sha.as_str())
        && incorporated_since
            .map(str::trim)
            .is_none_or(|since| is_ancestor(cwd, since, &expected));
    if is_incorporated || is_ancestor(cwd, &sha, &expected) {
        return RemoteLease::Included { sha };
    }
    RemoteLease::NotIncluded { sha }
}

#[tauri::command]
pub async fn history_remote_lease(
    worktree_path: String,
    branch: String,
    expected_head: String,
    incorporated: Option<String>,
    incorporated_since: Option<String>,
    workspace_id: Option<String>,
    project_id: Option<String>,
) -> Result<RemoteLease, WorktreeError> {
    tauri::async_runtime::spawn_blocking(move || {
        let cwd = PathBuf::from(&worktree_path);
        if !cwd.exists() {
            return Err(WorktreeError::RepoNotFound(worktree_path));
        }
        let token = crate::github::read_token(workspace_id.as_deref(), project_id.as_deref());
        Ok(remote_lease(
            &cwd,
            &branch,
            &expected_head,
            incorporated.as_deref(),
            incorporated_since.as_deref(),
            token.as_deref(),
        ))
    })
    .await
    .map_err(|e| WorktreeError::Io(std::io::Error::other(e.to_string())))?
}
