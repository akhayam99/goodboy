use super::commits::{changed_files, one_parent, read_commits, single_parent, tree_of};
use super::merge_tree::{MergeResult, Replayer};
use super::plan::{
    combined_message, finish_group, message_of, order_steps, plan_error, resolve_plan, Group,
    ResolvedPlan,
};
use super::runner::{supports_batched_replay, supports_merge_tree_base};
use super::types::{
    HistoryPlanArgs, HistoryStep, HistoryVerb, PlanPrediction, StepOutcome, StepPrediction,
};
use crate::worktree::WorktreeError;
use std::collections::HashMap;
use std::path::Path;

pub(crate) fn predict(args: &HistoryPlanArgs) -> Result<PlanPrediction, WorktreeError> {
    let cwd = Path::new(&args.worktree_path);
    if !cwd.exists() {
        return Err(WorktreeError::RepoNotFound(args.worktree_path.clone()));
    }
    if !supports_merge_tree_base() {
        return Ok(PlanPrediction {
            is_supported: false,
            steps: Vec::new(),
            head: None,
            is_tree_equal: false,
            changed_files: Vec::new(),
        });
    }
    let resolved = resolve_plan(cwd, args)?;
    let ordered = order_steps(&resolved.steps)?;
    if supports_batched_replay() {
        if let Ok(found) = predict_with(cwd, &resolved, &ordered, true) {
            return Ok(found);
        }
    }
    predict_with(cwd, &resolved, &ordered, false)
}

pub(super) fn predict_with(
    cwd: &Path,
    resolved: &ResolvedPlan,
    ordered: &[HistoryStep],
    batched: bool,
) -> Result<PlanPrediction, WorktreeError> {
    let steps = &resolved.steps;
    let replayed: Vec<String> = ordered
        .iter()
        .filter(|step| step.verb != HistoryVerb::Drop)
        .map(|step| step.sha.clone())
        .collect();
    let mut infos = read_commits(cwd, &replayed)?;
    let mut replayer = Replayer::start(cwd, batched)?;
    let mut outcomes: HashMap<String, StepPrediction> = HashMap::new();
    let mut tip = resolved.start.clone();
    let mut tip_tree = resolved.start_tree.clone();
    let mut group: Option<Group> = None;
    let mut map = Vec::new();
    let mut stopped = false;
    for step in ordered {
        if stopped {
            outcomes.insert(step.sha.clone(), blocked(&step.sha));
            continue;
        }
        if step.verb == HistoryVerb::Drop {
            outcomes.insert(
                step.sha.clone(),
                prediction(&step.sha, StepOutcome::Dropped),
            );
            continue;
        }
        let info = match infos.remove(&step.sha) {
            Some(found) => one_parent(&step.sha, found)?,
            None => single_parent(cwd, &step.sha)?,
        };
        if step.verb == HistoryVerb::Pick && info.parents[0] == tip {
            finish_group(group.take(), &tip, &mut map);
            group = Some(Group {
                message: info.message.clone(),
                author: info.author(),
                parent: tip.clone(),
                members: vec![step.sha.clone()],
            });
            tip = step.sha.clone();
            tip_tree = tree_of(cwd, &tip)?;
            outcomes.insert(step.sha.clone(), prediction(&step.sha, StepOutcome::Clean));
            continue;
        }
        let merge_base = info.parents[0].clone();
        match replayer.merge(cwd, &merge_base, &tip, &tip_tree, &step.sha)? {
            MergeResult::Conflict(files) => {
                outcomes.insert(
                    step.sha.clone(),
                    StepPrediction {
                        sha: step.sha.clone(),
                        outcome: StepOutcome::Conflict,
                        files,
                        new_sha: None,
                    },
                );
                stopped = true;
            }
            MergeResult::Tree(tree) => {
                let is_folding = matches!(step.verb, HistoryVerb::Squash | HistoryVerb::Fixup);
                let is_empty = !is_folding && tree == tip_tree;
                if is_folding {
                    let Some(current) = group.as_mut() else {
                        return Err(plan_error("a squash has no commit to merge into"));
                    };
                    let message = combined_message(step, &current.message, &info);
                    let author = current.author.clone();
                    tip = replayer.commit(cwd, &tree, &current.parent, &message, &author)?;
                    current.message = message;
                    current.members.push(step.sha.clone());
                    tip_tree = tree;
                } else {
                    finish_group(group.take(), &tip, &mut map);
                    let message = message_of(step, &info);
                    let author = info.author();
                    let parent = tip.clone();
                    tip = replayer.commit(cwd, &tree, &parent, &message, &author)?;
                    tip_tree = tree;
                    group = Some(Group {
                        message,
                        author,
                        parent,
                        members: vec![step.sha.clone()],
                    });
                }
                let outcome = if is_empty {
                    StepOutcome::Empty
                } else {
                    StepOutcome::Clean
                };
                outcomes.insert(step.sha.clone(), prediction(&step.sha, outcome));
            }
        }
    }
    finish_group(group, &tip, &mut map);
    let written = replayer.finish(cwd)?;
    let sha_of = |handle: &str| {
        written
            .get(handle)
            .cloned()
            .unwrap_or_else(|| handle.to_string())
    };
    for moved in &map {
        if let Some(entry) = outcomes.get_mut(&moved.from) {
            entry.new_sha = moved.to.as_deref().map(sha_of);
        }
    }
    let ordered_outcomes = steps
        .iter()
        .map(|step| {
            outcomes
                .remove(&step.sha)
                .unwrap_or_else(|| blocked(&step.sha))
        })
        .collect();
    if stopped {
        return Ok(PlanPrediction {
            is_supported: true,
            steps: ordered_outcomes,
            head: None,
            is_tree_equal: false,
            changed_files: Vec::new(),
        });
    }
    Ok(PlanPrediction {
        is_supported: true,
        steps: ordered_outcomes,
        is_tree_equal: tip_tree == resolved.head_tree,
        changed_files: changed_files(cwd, &resolved.head_tree, &tip_tree),
        head: Some(sha_of(&tip)),
    })
}

pub(super) fn prediction(sha: &str, outcome: StepOutcome) -> StepPrediction {
    StepPrediction {
        sha: sha.to_string(),
        outcome,
        files: Vec::new(),
        new_sha: None,
    }
}

pub(super) fn blocked(sha: &str) -> StepPrediction {
    prediction(sha, StepOutcome::Blocked)
}

#[tauri::command]
pub async fn history_plan_predict(args: HistoryPlanArgs) -> Result<PlanPrediction, WorktreeError> {
    tauri::async_runtime::spawn_blocking(move || predict(&args))
        .await
        .map_err(|e| WorktreeError::Io(std::io::Error::other(e.to_string())))?
}
