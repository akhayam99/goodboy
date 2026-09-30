use super::plan::{plan_error, short};
use crate::worktree::{git, resolve_commit, WorktreeError};
use serde::Serialize;
use std::path::{Path, PathBuf};

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RebaseCommit {
    pub sha: String,
    pub subject: String,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RebasePlan {
    pub onto: String,
    pub onto_ref: String,
    pub merge_base: String,
    pub head: String,
    pub commits: Vec<RebaseCommit>,
    pub behind: u32,
    pub fetch_error: Option<String>,
}

pub(crate) fn rebase_plan(
    cwd: &Path,
    base_branch: Option<&str>,
    fetches: bool,
) -> Result<RebasePlan, WorktreeError> {
    let named = base_branch
        .map(str::trim)
        .filter(|name| !name.is_empty())
        .map(str::to_string);
    let base = named
        .or_else(|| crate::worktree::default_base_name(cwd, false))
        .ok_or_else(|| plan_error("no base branch could be found for this repository"))?;
    let base = base.as_str();
    let fetch_error = if fetches {
        git(cwd, &["fetch", "--quiet", "origin", base])
            .err()
            .map(|error| error.to_string())
    } else {
        None
    };
    let remote_ref = format!("origin/{base}");
    let (onto_ref, onto) = match resolve_commit(cwd, &remote_ref) {
        Ok(sha) => (remote_ref, sha),
        Err(_) => (base.to_string(), resolve_commit(cwd, base)?),
    };
    let head = resolve_commit(cwd, "HEAD")?;
    let merge_base = git(cwd, &["merge-base", "HEAD", &onto])?.trim().to_string();
    let range = format!("{merge_base}..{head}");
    let raw = git(
        cwd,
        &["log", "--reverse", "--format=%H%x1f%P%x1f%s", &range],
    )?;
    let mut commits = Vec::new();
    for line in raw.lines().filter(|line| !line.trim().is_empty()) {
        let mut parts = line.splitn(3, '\u{1f}');
        let sha = parts.next().unwrap_or_default().to_string();
        let parents = parts.next().unwrap_or_default().split_whitespace().count();
        if parents != 1 {
            return Err(plan_error(&format!(
                "{} is a merge commit: rebase it by hand",
                short(&sha)
            )));
        }
        commits.push(RebaseCommit {
            sha,
            subject: parts.next().unwrap_or_default().to_string(),
        });
    }
    let behind = git(cwd, &["rev-list", "--count", &format!("{head}..{onto}")])?
        .trim()
        .parse::<u32>()
        .unwrap_or_default();
    Ok(RebasePlan {
        onto,
        onto_ref,
        merge_base,
        head,
        commits,
        behind,
        fetch_error,
    })
}

#[tauri::command]
pub async fn history_rebase_plan(
    worktree_path: String,
    base_branch: Option<String>,
    fetches: bool,
) -> Result<RebasePlan, WorktreeError> {
    tauri::async_runtime::spawn_blocking(move || {
        let cwd = PathBuf::from(&worktree_path);
        if !cwd.exists() {
            return Err(WorktreeError::RepoNotFound(worktree_path));
        }
        rebase_plan(&cwd, base_branch.as_deref(), fetches)
    })
    .await
    .map_err(|e| WorktreeError::Io(std::io::Error::other(e.to_string())))?
}

#[cfg(test)]
mod tests;
