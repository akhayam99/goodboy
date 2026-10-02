use std::path::Path;

use serde::Serialize;
use thiserror::Error;

use crate::github::{read_token, run_git_authenticated};
use crate::remote_probe::{probe_with, RemoteProbe};
use crate::repo::{is_repo_root, is_supported_remote_url};
use crate::worktree::{git, redact_credentials};

const PUBLISH_PROBE_TIMEOUT: std::time::Duration = std::time::Duration::from_secs(30);
const REMOTE_NAME: &str = "origin";

#[derive(Debug, Error)]
pub enum PublishError {
    #[error("directory not found: {0}")]
    DirNotFound(String),
    #[error("{0} is not a git repository root")]
    NotARepo(String),
    #[error("not a usable git remote url: {0}")]
    InvalidRemote(String),
    #[error("this project already has a different origin: {0}")]
    RemoteExists(String),
    #[error("git failed: {message}")]
    Git { message: String },
}

crate::util::impl_error_serialize!(PublishError);

impl PublishError {
    fn kind(&self) -> &'static str {
        match self {
            PublishError::DirNotFound(_) => "dir_not_found",
            PublishError::NotARepo(_) => "not_a_repo",
            PublishError::InvalidRemote(_) => "invalid_remote",
            PublishError::RemoteExists(_) => "remote_exists",
            PublishError::Git { .. } => "git",
        }
    }
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LinkedRemote {
    pub remote_url: String,
    pub added: bool,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(tag = "kind", rename_all = "kebab-case")]
pub enum PublishOutcome {
    Published { branch: String, sha: String },
    RemoteHasMain { branch: String },
    NoRemote,
    NothingToPublish,
    Failed { step: PublishStep, message: String },
}

#[derive(Debug, Serialize, PartialEq, Eq, Clone, Copy)]
#[serde(rename_all = "kebab-case")]
pub enum PublishStep {
    Check,
    Push,
    Head,
}

fn failed(step: PublishStep, message: impl AsRef<str>) -> PublishOutcome {
    PublishOutcome::Failed {
        step,
        message: redact_credentials(message.as_ref().trim()),
    }
}

fn repo_root_of(project_path: &str) -> Result<&Path, PublishError> {
    let root = Path::new(project_path.trim());
    if !root.is_dir() {
        return Err(PublishError::DirNotFound(project_path.to_string()));
    }
    if !is_repo_root(root) {
        return Err(PublishError::NotARepo(project_path.to_string()));
    }
    Ok(root)
}

pub(crate) fn link_remote(
    project_path: &str,
    remote_url: &str,
) -> Result<LinkedRemote, PublishError> {
    let url = remote_url.trim().to_string();
    if !is_supported_remote_url(&url) {
        return Err(PublishError::InvalidRemote(remote_url.to_string()));
    }
    let root = repo_root_of(project_path)?;
    let existing = git(root, &["remote", "get-url", REMOTE_NAME])
        .ok()
        .map(|raw| raw.trim().to_string())
        .filter(|found| !found.is_empty());
    if let Some(found) = existing {
        if found == url {
            return Ok(LinkedRemote {
                remote_url: url,
                added: false,
            });
        }
        return Err(PublishError::RemoteExists(redact_credentials(&found)));
    }
    git(root, &["remote", "add", REMOTE_NAME, &url]).map_err(|error| PublishError::Git {
        message: redact_credentials(&error.to_string()),
    })?;
    Ok(LinkedRemote {
        remote_url: url,
        added: true,
    })
}

const PUBLISHABLE_BRANCHES: [&str; 2] = ["main", "master"];

fn current_branch(root: &Path) -> Option<String> {
    git(root, &["symbolic-ref", "--quiet", "--short", "HEAD"])
        .ok()
        .map(|raw| raw.trim().to_string())
        .filter(|name| !name.is_empty())
}

fn has_commit(root: &Path) -> bool {
    git(root, &["rev-parse", "--verify", "--quiet", "HEAD^{commit}"]).is_ok()
}

pub(crate) fn publish_main(
    project_path: &str,
    token: Option<&str>,
    probe_timeout: std::time::Duration,
) -> Result<PublishOutcome, PublishError> {
    let root = repo_root_of(project_path)?;
    let Some(branch) = current_branch(root).filter(|_| has_commit(root)) else {
        return Ok(PublishOutcome::NothingToPublish);
    };
    if !PUBLISHABLE_BRANCHES.contains(&branch.as_str()) {
        return Ok(failed(
            PublishStep::Check,
            format!("Publishing pushes main. Check out main first, this folder is on {branch}."),
        ));
    }
    match probe_with(root, token, probe_timeout) {
        RemoteProbe::NoRemote => return Ok(PublishOutcome::NoRemote),
        RemoteProbe::Unreachable { reason } => return Ok(failed(PublishStep::Check, reason)),
        RemoteProbe::MainPresent {
            branch: remote_branch,
            ..
        } => {
            return Ok(PublishOutcome::RemoteHasMain {
                branch: remote_branch,
            })
        }
        RemoteProbe::ReachableNoMain => {}
    }
    let pushed = run_git_authenticated(
        &["push", "--set-upstream", REMOTE_NAME, &branch],
        project_path.trim(),
        token,
    );
    match pushed {
        Ok(run) if run.exit_code == 0 => {}
        Ok(run) => return Ok(failed(PublishStep::Push, run.stderr)),
        Err(error) => return Ok(failed(PublishStep::Push, error.to_string())),
    }
    if let Err(error) = git(root, &["remote", "set-head", REMOTE_NAME, &branch]) {
        return Ok(failed(PublishStep::Head, error.to_string()));
    }
    let sha = git(root, &["rev-parse", "HEAD"])
        .map(|raw| raw.trim().to_string())
        .map_err(|error| PublishError::Git {
            message: redact_credentials(&error.to_string()),
        })?;
    Ok(PublishOutcome::Published { branch, sha })
}

#[tauri::command]
pub async fn project_link_remote(
    project_path: String,
    remote_url: String,
) -> Result<LinkedRemote, PublishError> {
    tauri::async_runtime::spawn_blocking(move || link_remote(&project_path, &remote_url))
        .await
        .map_err(|error| PublishError::Git {
            message: error.to_string(),
        })?
}

#[tauri::command]
pub async fn project_publish_main(
    project_path: String,
    workspace_id: Option<String>,
    project_id: Option<String>,
) -> Result<PublishOutcome, PublishError> {
    tauri::async_runtime::spawn_blocking(move || {
        let token = read_token(workspace_id.as_deref(), project_id.as_deref());
        publish_main(&project_path, token.as_deref(), PUBLISH_PROBE_TIMEOUT)
    })
    .await
    .map_err(|error| PublishError::Git {
        message: error.to_string(),
    })?
}

#[cfg(test)]
mod tests;
