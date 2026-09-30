use super::commits::{changed_files, is_ancestor, tree_of};
use super::merge_tree::{merge_in_memory, MergeResult};
use super::rewriter::copy_problem;
use super::runner::supports_merge_tree_base;
use super::types::{HistoryStep, HistoryVerb, TrialCheck};
use crate::worktree::git;
use std::path::Path;

pub(super) struct CheckInput<'a> {
    pub(super) base: &'a str,
    pub(super) start: &'a str,
    pub(super) old_head: &'a str,
    pub(super) new_head: &'a str,
    pub(super) steps: &'a [HistoryStep],
    pub(super) ordered: &'a [HistoryStep],
    pub(super) made: Option<usize>,
}

pub(super) fn lines_of(raw: &str) -> Vec<String> {
    raw.lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .map(str::to_string)
        .collect()
}

fn files_of_commit(cwd: &Path, sha: &str) -> Vec<String> {
    git(
        cwd,
        &[
            "diff-tree",
            "--no-commit-id",
            "--name-only",
            "-r",
            "--root",
            sha,
        ],
    )
    .map(|raw| lines_of(&raw))
    .unwrap_or_default()
}

fn count_of(cwd: &Path, args: &[&str]) -> Option<usize> {
    git(cwd, args).ok()?.trim().parse::<usize>().ok()
}

fn plural_files(count: usize) -> &'static str {
    if count == 1 {
        "file"
    } else {
        "files"
    }
}

pub(super) fn check_trial(cwd: &Path, copy: Option<&Path>, input: &CheckInput<'_>) -> TrialCheck {
    let mut problems = Vec::new();
    if let Some(problem) = copy.and_then(copy_problem) {
        problems.push(problem);
    }
    if !is_ancestor(cwd, input.start, input.new_head) {
        problems.push("The result is not built on the commit it should start from.".to_string());
    }
    let range = format!("{}..{}", input.start, input.new_head);
    let merges = count_of(cwd, &["rev-list", "--count", "--min-parents=2", &range]);
    if merges != Some(0) {
        problems.push("The result contains a merge commit.".to_string());
    }
    if let Some(made) = input.made {
        let counted = count_of(cwd, &["rev-list", "--count", "--first-parent", &range]);
        if counted != Some(made) {
            problems.push(format!(
                "The result has {} commits, the plan makes {made}.",
                counted.map_or_else(|| "an unknown number of".to_string(), |n| n.to_string())
            ));
        }
    }
    let dropped: Vec<&HistoryStep> = input
        .ordered
        .iter()
        .filter(|step| step.verb == HistoryVerb::Drop)
        .collect();
    let mut removed_files: Vec<String> = dropped
        .iter()
        .flat_map(|step| files_of_commit(cwd, &step.sha))
        .collect();
    removed_files.sort();
    removed_files.dedup();
    let own: std::collections::HashSet<String> = git(
        cwd,
        &["rev-list", &format!("{}..{}", input.base, input.old_head)],
    )
    .map(|raw| lines_of(&raw).into_iter().collect())
    .unwrap_or_default();
    let planned: std::collections::HashSet<String> =
        input.steps.iter().map(|step| step.sha.clone()).collect();
    let is_rewrite = !own.is_empty() && own == planned;
    let is_rebase = input.start != input.base;
    let mut unexpected_files = Vec::new();
    if is_rewrite {
        let new_tree = tree_of(cwd, input.new_head).unwrap_or_default();
        let (expected, main_files) = if is_rebase {
            let merged = supports_merge_tree_base()
                .then(|| merge_in_memory(cwd, input.base, input.start, input.old_head).ok())
                .flatten();
            match merged {
                Some(MergeResult::Tree(tree)) => (Some(tree), Vec::new()),
                _ => (None, changed_files(cwd, input.base, input.start)),
            }
        } else {
            (tree_of(cwd, input.old_head).ok(), Vec::new())
        };
        let differing = match expected {
            Some(tree) => changed_files(cwd, &tree, &new_tree),
            None => changed_files(cwd, input.old_head, &new_tree),
        };
        unexpected_files = differing
            .into_iter()
            .filter(|file| !removed_files.contains(file) && !main_files.contains(file))
            .collect();
        if !unexpected_files.is_empty() {
            problems.push(format!(
                "The result differs from what the plan should make in {} {}: {}.",
                unexpected_files.len(),
                plural_files(unexpected_files.len()),
                unexpected_files.join(", ")
            ));
        }
    }
    TrialCheck {
        is_passed: problems.is_empty(),
        expects_same_code: is_rewrite && !is_rebase && dropped.is_empty(),
        problems,
        unexpected_files,
        removed_files,
    }
}

#[cfg(test)]
mod tests;
