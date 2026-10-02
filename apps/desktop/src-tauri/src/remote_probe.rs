use std::path::Path;
use std::time::Duration;

use serde::Serialize;

use crate::github::{run_git_authenticated_within, GithubError};
use crate::repo::{default_remote_name, is_repo_root};
use crate::worktree::{git, redact_credentials};

const PROBE_TIMEOUT: Duration = Duration::from_secs(15);

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(tag = "kind", rename_all = "kebab-case")]
pub enum RemoteProbe {
    NoRemote,
    Unreachable { reason: String },
    ReachableNoMain,
    MainPresent { branch: String, sha: String },
}

#[derive(Debug, PartialEq, Eq)]
struct HeadListing {
    symref: Option<String>,
    sha: Option<String>,
}

fn unreachable(reason: impl AsRef<str>) -> RemoteProbe {
    RemoteProbe::Unreachable {
        reason: redact_credentials(reason.as_ref().trim()),
    }
}

fn parse_head_listing(stdout: &str) -> HeadListing {
    let mut listing = HeadListing {
        symref: None,
        sha: None,
    };
    for line in stdout.lines() {
        let Some((left, name)) = line.split_once('\t') else {
            continue;
        };
        if name.trim() != "HEAD" {
            continue;
        }
        if let Some(target) = left.trim().strip_prefix("ref: refs/heads/") {
            listing.symref = Some(target.trim().to_string());
            continue;
        }
        let sha = left.trim();
        if sha.len() >= 40 && sha.chars().all(|c| c.is_ascii_hexdigit()) {
            listing.sha = Some(sha.to_string());
        }
    }
    listing
}

fn is_safe_branch_name(name: &str) -> bool {
    !name.is_empty()
        && !name.starts_with('-')
        && !name.starts_with('/')
        && !name.ends_with('/')
        && !name.ends_with(".lock")
        && !name.contains("..")
        && !name.contains("//")
        && !name.contains("@{")
        && name
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '/' | '-' | '_' | '.'))
}

fn branch_of_matching_head(
    root: &Path,
    remote: &str,
    sha: &str,
    token: Option<&str>,
    timeout: Duration,
) -> Result<Option<String>, String> {
    let root_text = root.to_string_lossy().to_string();
    let listing = run_git_authenticated_within(
        &["ls-remote", "--heads", remote],
        &root_text,
        token,
        Some(timeout),
    )
    .map_err(|error| describe(&error))?;
    if listing.exit_code != 0 {
        return Err(listing.stderr);
    }
    let matching = |wanted: &str| {
        listing.stdout.lines().find_map(|line| {
            let (found_sha, name) = line.split_once('\t')?;
            let branch = name.trim().strip_prefix("refs/heads/")?;
            (found_sha.trim() == sha && branch == wanted).then(|| branch.to_string())
        })
    };
    Ok(matching("main").or_else(|| matching("master")))
}

fn describe(error: &GithubError) -> String {
    match error {
        GithubError::Timeout => "the remote did not answer in time".to_string(),
        other => other.to_string(),
    }
}

pub(crate) fn probe_with(root: &Path, token: Option<&str>, timeout: Duration) -> RemoteProbe {
    if !root.is_dir() || !is_repo_root(root) {
        return RemoteProbe::NoRemote;
    }
    let Some(remote) = default_remote_name(root) else {
        return RemoteProbe::NoRemote;
    };
    let root_text = root.to_string_lossy().to_string();
    let head = match run_git_authenticated_within(
        &["ls-remote", "--symref", &remote, "HEAD"],
        &root_text,
        token,
        Some(timeout),
    ) {
        Ok(run) if run.exit_code == 0 => parse_head_listing(&run.stdout),
        Ok(run) => return unreachable(run.stderr),
        Err(error) => return unreachable(describe(&error)),
    };
    let Some(sha) = head.sha else {
        return RemoteProbe::ReachableNoMain;
    };
    let branch = match head.symref {
        Some(branch) => branch,
        None => match branch_of_matching_head(root, &remote, &sha, token, timeout) {
            Ok(Some(branch)) => branch,
            Ok(None) => return unreachable("the remote default branch could not be read"),
            Err(reason) => return unreachable(reason),
        },
    };
    if !is_safe_branch_name(&branch) {
        return unreachable("the remote default branch has an unsupported name");
    }
    let refspec = format!("+refs/heads/{branch}:refs/remotes/{remote}/{branch}");
    match run_git_authenticated_within(
        &["fetch", "--quiet", "--no-tags", &remote, &refspec],
        &root_text,
        token,
        Some(timeout),
    ) {
        Ok(run) if run.exit_code == 0 => {}
        Ok(run) => return unreachable(run.stderr),
        Err(error) => return unreachable(describe(&error)),
    }
    let tracking = format!("refs/remotes/{remote}/{branch}^{{commit}}");
    let verified = match git(root, &["rev-parse", "--verify", "--quiet", &tracking]) {
        Ok(raw) if !raw.trim().is_empty() => raw.trim().to_string(),
        Ok(_) => return unreachable("the fetched default branch could not be verified"),
        Err(error) => return unreachable(error.to_string()),
    };
    if let Err(error) = git(root, &["remote", "set-head", &remote, &branch]) {
        return unreachable(error.to_string());
    }
    RemoteProbe::MainPresent {
        branch,
        sha: verified,
    }
}

#[tauri::command]
pub async fn project_remote_probe(
    project_path: String,
    workspace_id: Option<String>,
    project_id: Option<String>,
) -> RemoteProbe {
    tauri::async_runtime::spawn_blocking(move || {
        let token = crate::github::read_token(workspace_id.as_deref(), project_id.as_deref());
        probe_with(
            Path::new(project_path.trim()),
            token.as_deref(),
            PROBE_TIMEOUT,
        )
    })
    .await
    .unwrap_or_else(|error| unreachable(error.to_string()))
}

#[cfg(test)]
mod tests;
