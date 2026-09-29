use super::error::WorktreeError;
use super::git::git;
use super::status::{
    current_branch_name, distance_between, in_progress_operation, operation_label,
    read_working_tree, resolve_upstream,
};
use super::types::{GitDistance, GitWorkingTree};
use serde::Serialize;
use std::path::Path;

#[derive(Debug, Serialize, PartialEq, Eq)]
pub struct FastForwardResult {
    pub branch: String,
    pub upstream: String,
    #[serde(rename = "commitsPulled")]
    pub commits_pulled: u32,
}

const FF_SAFETY_FLAGS: [&str; 6] = [
    "-c",
    "pull.rebase=false",
    "-c",
    "rebase.autoStash=false",
    "-c",
    "merge.autoStash=false",
];

pub(super) fn ff_merge_args(upstream: &str) -> Vec<&str> {
    let mut args: Vec<&str> = FF_SAFETY_FLAGS.to_vec();
    args.extend_from_slice(&["merge", "--ff-only", upstream]);
    args
}

#[tauri::command]
pub async fn checkout_fast_forward(
    checkout_path: String,
    workspace_id: Option<String>,
    project_id: Option<String>,
) -> Result<FastForwardResult, WorktreeError> {
    tauri::async_runtime::spawn_blocking(move || {
        let token = crate::github::read_token(workspace_id.as_deref(), project_id.as_deref());
        checkout_fast_forward_blocking(checkout_path, token.as_deref())
    })
    .await
    .map_err(|e| WorktreeError::Io(std::io::Error::other(e.to_string())))?
}

fn fetch_remote_authenticated(
    checkout_path: &str,
    remote: &str,
    token: Option<&str>,
) -> Result<(), WorktreeError> {
    let result =
        crate::github::run_git_authenticated(&["fetch", "--no-tags", remote], checkout_path, token)
            .map_err(|error| WorktreeError::Git {
                message: error.to_string(),
            })?;
    if result.exit_code != 0 {
        return Err(WorktreeError::Git {
            message: result.stderr.trim().to_string(),
        });
    }
    Ok(())
}

pub(super) fn checkout_fast_forward_blocking(
    checkout_path: String,
    token: Option<&str>,
) -> Result<FastForwardResult, WorktreeError> {
    let p = Path::new(&checkout_path);
    if !p.exists() {
        return Err(WorktreeError::RepoNotFound(checkout_path));
    }
    let Some(branch) = current_branch_name(p) else {
        return Err(WorktreeError::Git {
            message: "this checkout isn't on a branch, so there's no branch to update".to_string(),
        });
    };
    let Some(upstream) = resolve_upstream(p) else {
        return Err(WorktreeError::Git {
            message: format!("{branch} tracks no upstream branch yet"),
        });
    };
    if git(
        p,
        &[
            "rev-parse",
            "--verify",
            "--quiet",
            &format!("refs/remotes/{upstream}"),
        ],
    )
    .is_err()
    {
        return Err(WorktreeError::Git {
            message: format!("git doesn't recognize {upstream} as a branch on the remote"),
        });
    }
    if let Some(operation) = in_progress_operation(p) {
        return Err(WorktreeError::Git {
            message: format!(
                "finish the {} in progress first",
                operation_label(operation)
            ),
        });
    }
    match read_working_tree(p) {
        GitWorkingTree::Unknown { .. } => {
            return Err(WorktreeError::Git {
                message: "git status could not be read, so this checkout cannot be updated safely"
                    .to_string(),
            });
        }
        GitWorkingTree::Known { changed, .. } if changed > 0 => {
            return Err(WorktreeError::Git {
                message: "this checkout has uncommitted changes. commit or stash them first"
                    .to_string(),
            });
        }
        GitWorkingTree::Known { .. } => {}
    }
    let Some((remote, _)) = upstream.split_once('/') else {
        return Err(WorktreeError::Git {
            message: format!("cannot tell which remote {upstream} belongs to"),
        });
    };
    fetch_remote_authenticated(&checkout_path, remote, token)?;
    let behind = match distance_between(p, &upstream, "HEAD") {
        GitDistance::Known { behind, .. } => behind,
        GitDistance::Unknown { .. } => {
            return Err(WorktreeError::Git {
                message: format!("cannot tell how far {branch} is behind {upstream}"),
            });
        }
    };
    git(p, &ff_merge_args(&upstream))?;
    Ok(FastForwardResult {
        branch,
        upstream,
        commits_pulled: behind,
    })
}
