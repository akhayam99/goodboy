use super::check::{check_trial, CheckInput};
use super::commits::{changed_files, is_ancestor, rev_parse_all, single_parent, tree_of, Author};
use super::merge_tree::commit_tree;
use super::plan::{combined_message, message_of, order_steps, resolved_steps, short, start_of};
use super::reservation::discard_copy;
use super::trial::trial;
use super::types::{HistoryPlanArgs, HistoryStep, HistoryVerb, ShaMove, TrialResult};
use crate::worktree::{
    git, in_progress_operation, read_working_tree, resolve_commit, GitWorkingTree, WorktreeError,
};
use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RewriterPrepareArgs {
    pub plan: HistoryPlanArgs,
    pub slug: String,
}

#[tauri::command]
pub async fn history_rewriter_prepare(
    args: RewriterPrepareArgs,
) -> Result<TrialResult, WorktreeError> {
    tauri::async_runtime::spawn_blocking(move || trial(&args.plan, &args.slug, true))
        .await
        .map_err(|e| WorktreeError::Io(std::io::Error::other(e.to_string())))?
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RewriterCollectArgs {
    pub plan: HistoryPlanArgs,
    pub copy_path: String,
    #[serde(default)]
    pub skipped: Vec<String>,
    #[serde(default)]
    pub keeps_copy: bool,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RewriterCheck {
    pub head: Option<String>,
    pub map: Vec<ShaMove>,
    pub problems: Vec<String>,
    pub is_tree_equal: bool,
    pub changed_files: Vec<String>,
}

struct ExpectedGroup {
    members: Vec<String>,
    message: String,
    author: Author,
}

fn expected_groups(
    cwd: &Path,
    ordered: &[HistoryStep],
) -> Result<Vec<ExpectedGroup>, WorktreeError> {
    let mut groups: Vec<ExpectedGroup> = Vec::new();
    for step in ordered {
        if step.verb == HistoryVerb::Drop {
            continue;
        }
        let info = single_parent(cwd, &step.sha)?;
        let is_folding = matches!(step.verb, HistoryVerb::Squash | HistoryVerb::Fixup);
        if is_folding {
            if let Some(current) = groups.last_mut() {
                current.message = combined_message(step, &current.message, &info);
                current.members.push(step.sha.clone());
                continue;
            }
        }
        groups.push(ExpectedGroup {
            members: vec![step.sha.clone()],
            message: message_of(step, &info),
            author: info.author(),
        });
    }
    Ok(groups)
}

pub(super) fn copy_problem(copy: &Path) -> Option<String> {
    if in_progress_operation(copy).is_some() {
        return Some("The copy still has a cherry-pick or merge in progress.".to_string());
    }
    match read_working_tree(copy) {
        GitWorkingTree::Known {
            staged,
            unstaged,
            unmerged,
            ..
        } if staged + unstaged + unmerged > 0 => {
            Some("The copy has changes that were never committed.".to_string())
        }
        GitWorkingTree::Known { .. } => None,
        GitWorkingTree::Unknown { .. } => Some("Couldn't read the copy.".to_string()),
    }
}

pub(crate) fn collect_rewrite(args: &RewriterCollectArgs) -> Result<RewriterCheck, WorktreeError> {
    let cwd = Path::new(&args.plan.worktree_path);
    let copy = Path::new(&args.copy_path);
    if !cwd.exists() {
        return Err(WorktreeError::RepoNotFound(args.plan.worktree_path.clone()));
    }
    if !copy.exists() {
        return Err(WorktreeError::RepoNotFound(args.copy_path.clone()));
    }
    let base = resolve_commit(cwd, &args.plan.base)?;
    let start = resolve_commit(cwd, start_of(&args.plan))?;
    let old_head = resolve_commit(cwd, &args.plan.head)?;
    let steps = resolved_steps(cwd, &args.plan.steps)?;
    let ordered = order_steps(&steps)?;
    let groups = expected_groups(cwd, &ordered)?;
    let mut problems = Vec::new();
    if !args.skipped.is_empty() {
        problems.push(format!(
            "The rewriter skipped {} that the plan keeps; every planned commit must stay, even an empty one.",
            args.skipped
                .iter()
                .map(|sha| short(sha))
                .collect::<Vec<_>>()
                .join(", ")
        ));
    }
    if let Some(problem) = copy_problem(copy) {
        problems.push(problem);
    }
    let copy_head = resolve_commit(copy, "HEAD")?;
    let range = format!("{start}..{copy_head}");
    let made: Vec<String> = git(copy, &["rev-list", "--reverse", "--first-parent", &range])?
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .map(str::to_string)
        .collect();
    if !is_ancestor(copy, &start, &copy_head) {
        problems.push("The copy is no longer built on the plan base.".to_string());
    }
    if made.len() != groups.len() {
        problems.push(format!(
            "The rewriter made {} {}, the plan has {}.",
            made.len(),
            if made.len() == 1 { "commit" } else { "commits" },
            groups.len()
        ));
    }
    if !problems.is_empty() {
        return Ok(RewriterCheck {
            head: None,
            map: Vec::new(),
            problems,
            is_tree_equal: false,
            changed_files: Vec::new(),
        });
    }
    let mut tip = start.clone();
    let mut map = Vec::new();
    for (commit, group) in made.iter().zip(groups.iter()) {
        let is_original = group.members.len() == 1
            && group.members.first() == Some(commit)
            && rev_parse_all(cwd, &[format!("{commit}^")]).as_deref() == Some(&[tip.clone()][..]);
        if is_original {
            tip = commit.clone();
            map.push(ShaMove {
                from: commit.clone(),
                to: Some(tip.clone()),
            });
            continue;
        }
        let tree = tree_of(copy, commit)?;
        tip = commit_tree(cwd, &tree, &tip, &group.message, &group.author)?;
        for member in &group.members {
            map.push(ShaMove {
                from: member.clone(),
                to: Some(tip.clone()),
            });
        }
    }
    for step in &ordered {
        if map.iter().any(|moved| moved.from == step.sha) {
            continue;
        }
        map.push(ShaMove {
            from: step.sha.clone(),
            to: None,
        });
    }
    let check = check_trial(
        cwd,
        None,
        &CheckInput {
            base: &base,
            start: &start,
            old_head: &old_head,
            new_head: &tip,
            steps: &steps,
            ordered: &ordered,
            made: Some(groups.len()),
        },
    );
    if !check.is_passed {
        return Ok(RewriterCheck {
            head: None,
            map: Vec::new(),
            problems: check.problems,
            is_tree_equal: false,
            changed_files: Vec::new(),
        });
    }
    if !args.keeps_copy {
        discard_copy(&args.copy_path);
    }
    Ok(RewriterCheck {
        is_tree_equal: tree_of(cwd, &tip)? == tree_of(cwd, &old_head)?,
        changed_files: changed_files(cwd, &old_head, &tip),
        head: Some(tip),
        map,
        problems,
    })
}

#[tauri::command]
pub async fn history_rewriter_collect(
    args: RewriterCollectArgs,
) -> Result<RewriterCheck, WorktreeError> {
    tauri::async_runtime::spawn_blocking(move || collect_rewrite(&args))
        .await
        .map_err(|e| WorktreeError::Io(std::io::Error::other(e.to_string())))?
}
