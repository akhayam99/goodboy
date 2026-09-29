use super::base::{base_label, resolve_base_ref};
use super::git::{commit_exists, git, is_ancestor};
use super::inspect::parse_porcelain;
use serde::Serialize;
use std::path::Path;

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(tag = "kind", rename_all = "kebab-case")]
pub enum BranchMergeState {
    Unknown,
    Protected,
    MergedViaMerge,
    MergedViaRebase,
    MergedViaPr,
    MergedThen {
        #[serde(rename = "newCommits")]
        new_commits: u32,
    },
    NoOwnCommits,
    NotMerged {
        ahead: u32,
    },
}

const PROTECTED_BRANCH_NAMES: [&str; 3] = ["main", "master", "develop"];

fn is_protected_branch(cwd: &Path, branch: &str, base_label: &str) -> bool {
    if branch == base_label || PROTECTED_BRANCH_NAMES.contains(&branch) {
        return true;
    }
    let Ok(raw) = git(cwd, &["worktree", "list", "--porcelain"]) else {
        return false;
    };
    parse_porcelain(&raw)
        .into_iter()
        .filter(|entry| !entry.is_main)
        .any(|entry| entry.branch.as_deref() == Some(branch))
}

fn is_on_first_parent_line(cwd: &Path, base_ref: &str, tip_sha: &str) -> bool {
    let Ok(raw) = git(cwd, &["rev-list", "--first-parent", base_ref]) else {
        return false;
    };
    raw.lines().any(|line| line.trim() == tip_sha)
}

fn is_rebase_merged(cwd: &Path, base_ref: &str, branch_ref: &str) -> bool {
    let Ok(raw) = git(cwd, &["cherry", base_ref, branch_ref]) else {
        return false;
    };
    raw.lines().all(|line| !line.trim_start().starts_with('+'))
}

fn commits_after(cwd: &Path, merged_head: &str, tip: &str) -> u32 {
    git(
        cwd,
        &["rev-list", "--count", &format!("{merged_head}..{tip}")],
    )
    .ok()
    .and_then(|raw| raw.trim().parse::<u32>().ok())
    .unwrap_or(0)
}

fn merged_by_request(cwd: &Path, branch: &str, tip: &str, merged_head: &str) -> BranchMergeState {
    let origin_tip = git(
        cwd,
        &[
            "rev-parse",
            "--verify",
            "--quiet",
            &format!("refs/remotes/origin/{branch}"),
        ],
    )
    .ok()
    .map(|raw| raw.trim().to_string())
    .filter(|sha| !sha.is_empty());
    let new_commits = [Some(tip.to_string()), origin_tip]
        .into_iter()
        .flatten()
        .filter(|candidate| !is_ancestor(cwd, candidate, merged_head))
        .map(|candidate| commits_after(cwd, merged_head, &candidate).max(1))
        .max()
        .unwrap_or(0);
    match new_commits {
        0 => BranchMergeState::MergedViaPr,
        _ => BranchMergeState::MergedThen { new_commits },
    }
}

pub(crate) fn branch_merge_state(
    cwd: &Path,
    branch: &str,
    base_branch: Option<&str>,
    merged_head: Option<&str>,
) -> BranchMergeState {
    let Some(base_ref) = resolve_base_ref(cwd, base_branch) else {
        return BranchMergeState::Unknown;
    };
    let base = base_label(&base_ref);
    if is_protected_branch(cwd, branch, &base) {
        return BranchMergeState::Protected;
    }
    let Ok(tip_raw) = git(cwd, &["rev-parse", branch]) else {
        return BranchMergeState::Unknown;
    };
    let tip = tip_raw.trim().to_string();
    let known_head = merged_head
        .map(str::trim)
        .filter(|sha| !sha.is_empty() && commit_exists(cwd, sha));
    if let Some(head) = known_head {
        return merged_by_request(cwd, branch, &tip, head);
    }
    if is_ancestor(cwd, &tip, &base_ref) {
        return match is_on_first_parent_line(cwd, &base_ref, &tip) {
            true => BranchMergeState::NoOwnCommits,
            false => BranchMergeState::MergedViaMerge,
        };
    }
    if is_rebase_merged(cwd, &base_ref, branch) {
        return BranchMergeState::MergedViaRebase;
    }
    let Ok(raw) = git(
        cwd,
        &["rev-list", "--count", &format!("{base_ref}..{branch}")],
    ) else {
        return BranchMergeState::Unknown;
    };
    let Ok(ahead) = raw.trim().parse::<u32>() else {
        return BranchMergeState::Unknown;
    };
    BranchMergeState::NotMerged { ahead }
}

#[cfg(test)]
mod tests;
