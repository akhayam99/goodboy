use super::backups::now_nanos;
use super::check::{check_trial, CheckInput};
use super::commits::{changed_files, single_parent, tree_of};
use super::copies::create_copy;
use super::plan::{
    combined_message, finish_group, message_of, order_steps, plan_error, planned_order,
    resolved_steps, start_of, step_index, Group,
};
use super::reservation::copy_path_of;
use super::runner::git_run;
use super::types::{
    HistoryPlanArgs, HistoryStep, HistoryVerb, ShaMove, StopKind, TrialProgress, TrialResult,
    TrialStop,
};
use crate::worktree::{git, resolve_commit, WorktreeError};
use std::path::Path;

pub(super) const TRIAL_SLUG_PREFIX: &str = "try-";

fn unmerged_files(copy: &Path) -> Vec<String> {
    git(copy, &["diff", "--name-only", "--diff-filter=U"])
        .map(|raw| {
            raw.lines()
                .map(str::trim)
                .filter(|line| !line.is_empty())
                .map(str::to_string)
                .collect()
        })
        .unwrap_or_default()
}

struct Replay {
    head: String,
    map: Vec<ShaMove>,
    stop: Option<TrialStop>,
}

fn stop_of(
    steps: &[HistoryStep],
    sha: &str,
    kind: StopKind,
    files: Vec<String>,
    message: String,
) -> TrialStop {
    TrialStop {
        sha: sha.to_string(),
        index: step_index(steps, sha),
        kind,
        files,
        message,
    }
}

fn replay_in_copy(
    copy: &Path,
    steps: &[HistoryStep],
    ordered: &[HistoryStep],
    progress: &dyn Fn(TrialProgress),
) -> Result<Replay, WorktreeError> {
    let mut group: Option<Group> = None;
    let mut map = Vec::new();
    let mut tip = resolve_commit(copy, "HEAD")?;
    for (position, step) in ordered.iter().enumerate() {
        progress(TrialProgress::Step {
            index: position + 1,
            total: ordered.len(),
            sha: step.sha.clone(),
        });
        if step.verb == HistoryVerb::Drop {
            map.push(ShaMove {
                from: step.sha.clone(),
                to: None,
            });
            continue;
        }
        let info = single_parent(copy, &step.sha)?;
        if step.verb == HistoryVerb::Pick && info.parents[0] == tip {
            git(copy, &["reset", "--hard", "--quiet", &step.sha])?;
            finish_group(group.take(), &tip, &mut map);
            group = Some(Group {
                message: info.message.clone(),
                author: info.author(),
                parent: tip.clone(),
                members: vec![step.sha.clone()],
            });
            tip = step.sha.clone();
            continue;
        }
        let pick = git_run(copy, &["cherry-pick", "--no-commit", &step.sha], None, None)?;
        if pick.status != 0 {
            let files = unmerged_files(copy);
            let kind = if files.is_empty() {
                StopKind::Hook
            } else {
                StopKind::Merge
            };
            finish_group(group.take(), &tip, &mut map);
            return Ok(Replay {
                head: tip,
                map,
                stop: Some(stop_of(
                    steps,
                    &step.sha,
                    kind,
                    files,
                    pick.stderr.trim().to_string(),
                )),
            });
        }
        let is_folding = matches!(step.verb, HistoryVerb::Squash | HistoryVerb::Fixup);
        let commit = if is_folding {
            let Some(current) = group.as_mut() else {
                return Err(plan_error("a squash has no commit to merge into"));
            };
            let message = combined_message(step, &current.message, &info);
            let run = git_run(
                copy,
                &["commit", "--amend", "--allow-empty", "-F", "-"],
                Some(&current.author),
                Some(&message),
            )?;
            current.message = message;
            current.members.push(step.sha.clone());
            run
        } else {
            finish_group(group.take(), &tip, &mut map);
            let message = message_of(step, &info);
            let author = info.author();
            let run = git_run(
                copy,
                &["commit", "--allow-empty", "-F", "-"],
                Some(&author),
                Some(&message),
            )?;
            group = Some(Group {
                message,
                author,
                parent: tip.clone(),
                members: vec![step.sha.clone()],
            });
            run
        };
        if commit.status != 0 {
            let _ = git(copy, &["reset", "--hard", "--quiet", &tip]);
            return Ok(Replay {
                head: tip,
                map,
                stop: Some(stop_of(
                    steps,
                    &step.sha,
                    StopKind::Hook,
                    Vec::new(),
                    format!("{}{}", commit.stdout.trim(), commit.stderr.trim()),
                )),
            });
        }
        tip = resolve_commit(copy, "HEAD")?;
    }
    finish_group(group, &tip, &mut map);
    Ok(Replay {
        head: tip,
        map,
        stop: None,
    })
}

pub(crate) fn trial(
    args: &HistoryPlanArgs,
    slug: &str,
    keeps_copy_on_stop: bool,
) -> Result<TrialResult, WorktreeError> {
    trial_with(args, slug, keeps_copy_on_stop, &|_| {})
}

pub(crate) fn trial_with(
    args: &HistoryPlanArgs,
    slug: &str,
    keeps_copy_on_stop: bool,
    progress: &dyn Fn(TrialProgress),
) -> Result<TrialResult, WorktreeError> {
    let cwd = Path::new(&args.worktree_path);
    if !cwd.exists() {
        return Err(WorktreeError::RepoNotFound(args.worktree_path.clone()));
    }
    let base = resolve_commit(cwd, &args.base)?;
    let start = resolve_commit(cwd, start_of(args))?;
    let old_head = resolve_commit(cwd, &args.head)?;
    let steps = resolved_steps(cwd, &args.steps)?;
    let ordered = order_steps(&steps)?;
    let order = planned_order(cwd, &ordered)?;
    let copy = copy_path_of(slug);
    let copy_text = copy.to_string_lossy().to_string();
    progress(TrialProgress::Copy);
    let mut guard = create_copy(cwd, &copy, &start)?;
    let replay = replay_in_copy(&copy, &steps, &ordered, progress)?;
    if replay.stop.is_some() {
        progress(TrialProgress::Cleanup);
        guard.is_kept = keeps_copy_on_stop;
        drop(guard);
        return Ok(TrialResult {
            head: None,
            map: replay.map,
            is_tree_equal: false,
            changed_files: Vec::new(),
            stop: replay.stop,
            copy_path: keeps_copy_on_stop.then_some(copy_text),
            order,
            check: None,
        });
    }
    progress(TrialProgress::Check);
    let made = ordered
        .iter()
        .filter(|step| {
            !matches!(
                step.verb,
                HistoryVerb::Drop | HistoryVerb::Squash | HistoryVerb::Fixup
            )
        })
        .count();
    let check = check_trial(
        cwd,
        Some(&copy),
        &CheckInput {
            base: &base,
            start: &start,
            old_head: &old_head,
            new_head: &replay.head,
            steps: &steps,
            ordered: &ordered,
            made: Some(made),
        },
    );
    progress(TrialProgress::Cleanup);
    drop(guard);
    Ok(TrialResult {
        is_tree_equal: tree_of(cwd, &replay.head)? == tree_of(cwd, &old_head)?,
        changed_files: changed_files(cwd, &old_head, &replay.head),
        head: Some(replay.head),
        map: replay.map,
        stop: None,
        copy_path: None,
        order,
        check: Some(check),
    })
}

#[tauri::command]
pub async fn history_plan_try(args: HistoryPlanArgs) -> Result<TrialResult, WorktreeError> {
    tauri::async_runtime::spawn_blocking(move || {
        let slug = format!("{TRIAL_SLUG_PREFIX}{}", now_nanos());
        trial(&args, &slug, false)
    })
    .await
    .map_err(|e| WorktreeError::Io(std::io::Error::other(e.to_string())))?
}
