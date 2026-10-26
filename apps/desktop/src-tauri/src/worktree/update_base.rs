use super::base::resolve_origin_head;
use super::error::WorktreeError;
use super::fast_forward::checkout_fast_forward_blocking;
use super::git::git;
use super::status::current_branch_name;
use serde::Serialize;
use std::path::Path;

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct BaseUpdateResult {
    pub base: String,
    pub checkout_branch: Option<String>,
    pub commits_pulled: u32,
}

fn git_error(message: impl Into<String>) -> WorktreeError {
    WorktreeError::Git {
        message: message.into(),
    }
}

fn named_base(base_branch: Option<String>) -> Option<String> {
    base_branch
        .map(|name| name.trim().to_string())
        .filter(|name| !name.is_empty())
}

#[tauri::command]
pub async fn checkout_update_base(
    checkout_path: String,
    base_branch: Option<String>,
    workspace_id: Option<String>,
    project_id: Option<String>,
) -> Result<BaseUpdateResult, WorktreeError> {
    tauri::async_runtime::spawn_blocking(move || {
        let token = crate::github::read_token(workspace_id.as_deref(), project_id.as_deref())?;
        checkout_update_base_blocking(checkout_path, base_branch, token.as_deref())
    })
    .await
    .map_err(|e| WorktreeError::Io(std::io::Error::other(e.to_string())))?
}

fn rev_of(p: &Path, reference: &str) -> Option<String> {
    git(p, &["rev-parse", "--verify", "--quiet", reference])
        .ok()
        .map(|sha| sha.trim().to_string())
        .filter(|sha| !sha.is_empty())
}

pub(super) fn checkout_update_base_blocking(
    checkout_path: String,
    base_branch: Option<String>,
    token: Option<&str>,
) -> Result<BaseUpdateResult, WorktreeError> {
    let p = Path::new(&checkout_path);
    if !p.exists() {
        return Err(WorktreeError::RepoNotFound(checkout_path));
    }
    let Some(base) = named_base(base_branch).or_else(|| resolve_origin_head(p)) else {
        return Err(git_error("no base branch is set for this repository"));
    };
    let current = current_branch_name(p);
    if current.as_deref() == Some(base.as_str()) {
        let result = checkout_fast_forward_blocking(checkout_path, token)?;
        return Ok(BaseUpdateResult {
            base,
            checkout_branch: current,
            commits_pulled: result.commits_pulled,
        });
    }
    let local_ref = format!("refs/heads/{base}");
    let Some(before) = rev_of(p, &local_ref) else {
        return Err(git_error(format!(
            "there is no local branch {base} to update"
        )));
    };
    let refspec = format!("{base}:{base}");
    let fetched = crate::remote_auth::run_git_authenticated(
        &["fetch", "--no-tags", "origin", &refspec],
        &checkout_path,
        token,
    )
    .map_err(|error| git_error(error.to_string()))?;
    if fetched.exit_code != 0 {
        return Err(git_error(fetched.stderr.trim().to_string()));
    }
    let after = rev_of(p, &local_ref).unwrap_or_else(|| before.clone());
    let commits_pulled = match before == after {
        true => 0,
        false => git(p, &["rev-list", "--count", &format!("{before}..{after}")])
            .ok()
            .and_then(|count| count.trim().parse::<u32>().ok())
            .unwrap_or(0),
    };
    Ok(BaseUpdateResult {
        base,
        checkout_branch: current,
        commits_pulled,
    })
}

#[cfg(test)]
mod tests;

#[cfg(test)]
mod wire_shape;
