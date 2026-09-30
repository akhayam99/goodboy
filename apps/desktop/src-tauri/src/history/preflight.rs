use crate::worktree::{
    git, in_progress_operation, read_working_tree, resolve_commit, GitWorkingTree,
};
use std::path::Path;

pub(super) fn blocking_reason(cwd: &Path) -> Option<String> {
    if let Some(operation) = in_progress_operation(cwd) {
        return Some(format!(
            "A git {} is in progress in this worktree. Finish or abort it first.",
            match operation {
                crate::worktree::GitOperation::Merge => "merge",
                crate::worktree::GitOperation::Rebase => "rebase",
                crate::worktree::GitOperation::CherryPick => "cherry-pick",
                crate::worktree::GitOperation::Bisect => "bisect",
            }
        ));
    }
    match read_working_tree(cwd) {
        GitWorkingTree::Known {
            staged,
            unstaged,
            unmerged,
            ..
        } => {
            let pending = staged + unstaged + unmerged;
            if pending == 0 {
                return None;
            }
            Some(format!(
                "{pending} {} here {} changes that are not committed. Commit or stash {} first: rewriting needs a clean worktree.",
                if pending == 1 { "file" } else { "files" },
                if pending == 1 { "has" } else { "have" },
                if pending == 1 { "it" } else { "them" }
            ))
        }
        GitWorkingTree::Unknown { .. } => Some("Couldn't read the worktree status.".to_string()),
    }
}

fn nul_paths(raw: &str) -> Vec<String> {
    raw.split('\0')
        .filter(|path| !path.is_empty())
        .map(|path| path.trim_end_matches('/').to_string())
        .collect()
}

fn parents_of(path: &str) -> impl Iterator<Item = &str> {
    path.match_indices('/')
        .map(move |(index, _)| &path[..index])
}

pub(crate) fn untracked_in_the_way(cwd: &Path, target: &str) -> Option<String> {
    let Ok(raw_untracked) = git(cwd, &["ls-files", "-z", "--others", "--directory"]) else {
        return Some("Couldn't list the untracked files here, so nothing was changed.".to_string());
    };
    let untracked = nul_paths(&raw_untracked);
    if untracked.is_empty() {
        return None;
    }
    let Ok(raw_tracked) = git(cwd, &["ls-tree", "-r", "-z", "--name-only", target]) else {
        return Some("Couldn't read the rewritten files, so nothing was changed.".to_string());
    };
    let files: std::collections::HashSet<String> = nul_paths(&raw_tracked).into_iter().collect();
    let dirs: std::collections::HashSet<&str> =
        files.iter().flat_map(|file| parents_of(file)).collect();
    let blocking: Vec<String> = untracked
        .into_iter()
        .filter(|path| {
            files.contains(path)
                || dirs.contains(path.as_str())
                || parents_of(path).any(|parent| files.contains(parent))
        })
        .collect();
    if blocking.is_empty() {
        return None;
    }
    Some(format!(
        "{} untracked or ignored {} would be overwritten: {}. Move or commit {} first. Nothing was changed.",
        blocking.len(),
        if blocking.len() == 1 { "path" } else { "paths" },
        blocking.join(", "),
        if blocking.len() == 1 { "it" } else { "them" }
    ))
}

pub(crate) fn preflight(cwd: &Path, branch: &str, expected_head: &str) -> Option<String> {
    let current_branch = crate::worktree::current_branch_name(cwd).unwrap_or_default();
    if current_branch != branch {
        return Some(format!(
            "This worktree is on {current_branch}, not {branch}. Nothing was changed."
        ));
    }
    if let Some(reason) = blocking_reason(cwd) {
        return Some(reason);
    }
    let head = resolve_commit(cwd, "HEAD").ok()?;
    let expected = resolve_commit(cwd, expected_head).ok()?;
    if head != expected {
        return Some(
            "The branch moved since this plan was made. Refresh to plan on the new commits."
                .to_string(),
        );
    }
    None
}
