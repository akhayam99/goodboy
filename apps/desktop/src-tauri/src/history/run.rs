use super::apply::LEASE_HOLDER;
use super::backups::now_nanos;
use super::journal::{journal_of, recover_journal};
use super::preflight::preflight;
use super::trial::{trial_with, TRIAL_SLUG_PREFIX};
use super::types::{HistoryPlanArgs, TrialProgress, TrialResult};
use crate::worktree::WorktreeError;
use crate::worktree_writer::{acquire_lease, cancel_lease, release_lease, WriterLeases};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use tauri::State;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryRunArgs {
    pub plan: HistoryPlanArgs,
    pub branch: String,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(tag = "kind", rename_all = "kebab-case")]
pub enum RunOutcome {
    Blocked { reason: String },
    Tried { result: Box<TrialResult> },
}

pub(crate) fn run_plan(
    args: &HistoryRunArgs,
    slug: &str,
    progress: &dyn Fn(TrialProgress),
) -> Result<RunOutcome, WorktreeError> {
    let cwd = Path::new(&args.plan.worktree_path);
    if !cwd.exists() {
        return Err(WorktreeError::RepoNotFound(args.plan.worktree_path.clone()));
    }
    if let Some(reason) = recover_journal(cwd)? {
        return Ok(RunOutcome::Blocked { reason });
    }
    if let Some(reason) = preflight(cwd, &args.branch, &args.plan.head) {
        return Ok(RunOutcome::Blocked { reason });
    }
    let result = trial_with(&args.plan, slug, false, progress)?;
    Ok(RunOutcome::Tried {
        result: Box::new(result),
    })
}

#[tauri::command]
pub async fn history_plan_run(
    leases: State<'_, WriterLeases>,
    args: HistoryRunArgs,
    on_progress: tauri::ipc::Channel<TrialProgress>,
) -> Result<RunOutcome, WorktreeError> {
    let registry = leases.0.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let cwd = PathBuf::from(&args.plan.worktree_path);
        if journal_of(&cwd).is_some_and(|journal| journal.exists()) {
            let path = args.plan.worktree_path.clone();
            let status = acquire_lease(&registry, &path, LEASE_HOLDER, None);
            if !status.is_granted {
                cancel_lease(&registry, &path, LEASE_HOLDER);
                return Ok(RunOutcome::Blocked {
                    reason: "An agent is writing here, so an interrupted rewrite cannot be settled yet. Try again when it finishes.".to_string(),
                });
            }
            let recovered = recover_journal(&cwd);
            release_lease(&registry, &path, LEASE_HOLDER, status.token.as_deref());
            if let Some(reason) = recovered? {
                return Ok(RunOutcome::Blocked { reason });
            }
        }
        let slug = format!("{TRIAL_SLUG_PREFIX}{}", now_nanos());
        run_plan(&args, &slug, &|event| {
            let _ = on_progress.send(event);
        })
    })
    .await
    .map_err(|e| WorktreeError::Io(std::io::Error::other(e.to_string())))?
}

#[cfg(test)]
mod tests;
