use super::commits::{rev_parse_all, single_parent, tree_of, Author, CommitInfo};
use super::types::{HistoryPlanArgs, HistoryStep, HistoryVerb, PlannedStep, ShaMove};
use crate::worktree::{resolve_commit, WorktreeError};
use std::path::Path;

pub(super) fn plan_error(message: &str) -> WorktreeError {
    WorktreeError::Git {
        message: message.to_string(),
    }
}

fn commit_rev(name: &str) -> String {
    format!("{}^{{commit}}", name.trim())
}

fn step_revs(steps: &[HistoryStep]) -> Vec<String> {
    steps
        .iter()
        .flat_map(|step| std::iter::once(step.sha.as_str()).chain(step.target.as_deref()))
        .map(commit_rev)
        .collect()
}

fn steps_from(steps: &[HistoryStep], resolved: Vec<String>) -> Vec<HistoryStep> {
    let mut next = resolved.into_iter();
    steps
        .iter()
        .map(|step| HistoryStep {
            sha: next.next().unwrap_or_default(),
            verb: step.verb,
            message: step.message.clone(),
            target: step.target.as_ref().and_then(|_| next.next()),
        })
        .collect()
}

pub(super) struct ResolvedPlan {
    pub(super) start: String,
    pub(super) start_tree: String,
    pub(super) head_tree: String,
    pub(super) steps: Vec<HistoryStep>,
}

pub(super) fn start_of(args: &HistoryPlanArgs) -> &str {
    args.onto
        .as_deref()
        .map(str::trim)
        .filter(|onto| !onto.is_empty())
        .unwrap_or(args.base.trim())
}

pub(super) fn resolve_plan(
    cwd: &Path,
    args: &HistoryPlanArgs,
) -> Result<ResolvedPlan, WorktreeError> {
    let head_commit = commit_rev(&args.head);
    let start = start_of(args);
    let mut revs = vec![
        commit_rev(start),
        format!("{start}^{{tree}}"),
        format!("{head_commit}^{{tree}}"),
    ];
    revs.extend(step_revs(&args.steps));
    if let Some(mut resolved) = rev_parse_all(cwd, &revs) {
        let rest = resolved.split_off(3);
        let mut ends = resolved.into_iter();
        return Ok(ResolvedPlan {
            start: ends.next().unwrap_or_default(),
            start_tree: ends.next().unwrap_or_default(),
            head_tree: ends.next().unwrap_or_default(),
            steps: steps_from(&args.steps, rest),
        });
    }
    let start = resolve_commit(cwd, start)?;
    let head = resolve_commit(cwd, &args.head)?;
    Ok(ResolvedPlan {
        start_tree: tree_of(cwd, &start)?,
        head_tree: tree_of(cwd, &head)?,
        steps: resolved_steps(cwd, &args.steps)?,
        start,
    })
}

pub(super) fn resolved_steps(
    cwd: &Path,
    steps: &[HistoryStep],
) -> Result<Vec<HistoryStep>, WorktreeError> {
    if let Some(resolved) = rev_parse_all(cwd, &step_revs(steps)) {
        return Ok(steps_from(steps, resolved));
    }
    steps
        .iter()
        .map(|step| {
            let target = match step.target.as_deref() {
                Some(target) => Some(resolve_commit(cwd, target)?),
                None => None,
            };
            Ok(HistoryStep {
                sha: resolve_commit(cwd, &step.sha)?,
                verb: step.verb,
                message: step.message.clone(),
                target,
            })
        })
        .collect()
}

fn group_end(ordered: &[HistoryStep], start: usize) -> usize {
    let mut end = start + 1;
    while end < ordered.len()
        && matches!(ordered[end].verb, HistoryVerb::Squash | HistoryVerb::Fixup)
    {
        end += 1;
    }
    end
}

fn is_targeted_fold(step: &HistoryStep) -> bool {
    matches!(step.verb, HistoryVerb::Fixup | HistoryVerb::Squash) && step.target.is_some()
}

pub(crate) fn order_steps(steps: &[HistoryStep]) -> Result<Vec<HistoryStep>, WorktreeError> {
    let (mut pending, mut ordered): (Vec<HistoryStep>, Vec<HistoryStep>) =
        steps.iter().cloned().partition(is_targeted_fold);
    while !pending.is_empty() {
        let before = pending.len();
        let mut waiting = Vec::new();
        for fold in pending {
            let target = fold.target.clone().unwrap_or_default();
            let Some(index) = ordered.iter().position(|step| step.sha == target) else {
                waiting.push(fold);
                continue;
            };
            if ordered[index].verb == HistoryVerb::Drop {
                return Err(plan_error(&format!(
                    "{} folds into {}, which the plan drops",
                    short(&fold.sha),
                    short(&target)
                )));
            }
            let at = group_end(&ordered, index);
            ordered.insert(at, fold);
        }
        if waiting.len() == before {
            let fold = &waiting[0];
            return Err(plan_error(&format!(
                "{} folds into a commit that is not in the plan",
                short(&fold.sha)
            )));
        }
        pending = waiting;
    }
    let mut has_commit = false;
    for step in &ordered {
        match step.verb {
            HistoryVerb::Drop => {}
            HistoryVerb::Squash | HistoryVerb::Fixup if !has_commit => {
                return Err(plan_error(&format!(
                    "{} has no older commit to merge into",
                    short(&step.sha)
                )));
            }
            HistoryVerb::Reword
                if step
                    .message
                    .as_deref()
                    .map(str::trim)
                    .unwrap_or_default()
                    .is_empty() =>
            {
                return Err(plan_error(&format!(
                    "{} needs a message to reword it",
                    short(&step.sha)
                )));
            }
            _ => has_commit = true,
        }
    }
    Ok(ordered)
}

pub(super) fn short(sha: &str) -> String {
    sha.chars().take(7).collect()
}

pub(super) fn message_of(step: &HistoryStep, info: &CommitInfo) -> String {
    step.message
        .as_deref()
        .map(str::trim)
        .filter(|message| !message.is_empty())
        .map(str::to_string)
        .unwrap_or_else(|| info.message.clone())
}

pub(super) fn combined_message(step: &HistoryStep, group: &str, info: &CommitInfo) -> String {
    if let Some(message) = step
        .message
        .as_deref()
        .map(str::trim)
        .filter(|message| !message.is_empty())
    {
        return message.to_string();
    }
    if step.verb == HistoryVerb::Fixup {
        return group.to_string();
    }
    format!("{group}\n\n{}", info.message)
}

pub(super) struct Group {
    pub(super) message: String,
    pub(super) author: Author,
    pub(super) parent: String,
    pub(super) members: Vec<String>,
}

pub(super) fn finish_group(group: Option<Group>, tip: &str, map: &mut Vec<ShaMove>) {
    let Some(group) = group else {
        return;
    };
    for member in group.members {
        map.push(ShaMove {
            from: member,
            to: Some(tip.to_string()),
        });
    }
}

pub(super) fn step_index(steps: &[HistoryStep], sha: &str) -> usize {
    steps
        .iter()
        .position(|step| step.sha == sha)
        .unwrap_or_default()
}

pub(super) fn planned_order(
    cwd: &Path,
    ordered: &[HistoryStep],
) -> Result<Vec<PlannedStep>, WorktreeError> {
    let mut group_message: Option<String> = None;
    let mut planned = Vec::new();
    for step in ordered {
        if step.verb == HistoryVerb::Drop {
            planned.push(PlannedStep {
                sha: step.sha.clone(),
                verb: step.verb,
                message: String::new(),
            });
            continue;
        }
        let info = single_parent(cwd, &step.sha)?;
        let message = match (&group_message, step.verb) {
            (Some(current), HistoryVerb::Squash | HistoryVerb::Fixup) => {
                combined_message(step, current, &info)
            }
            _ => message_of(step, &info),
        };
        group_message = Some(message.clone());
        planned.push(PlannedStep {
            sha: step.sha.clone(),
            verb: step.verb,
            message,
        });
    }
    Ok(planned)
}
