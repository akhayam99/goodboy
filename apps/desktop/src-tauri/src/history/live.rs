use super::apply::{move_branch_with, LEASE_HOLDER};
use super::backups::now_nanos;
use super::run::{run_plan, HistoryRunArgs, RunOutcome};
use super::types::{MoveOutcome, ShaMove, TrialResult};
use crate::worktree::WorktreeError;
use crate::worktree_writer::{
    acquire_lease, cancel_lease, holds_lease, release_lease, RunLeaseGuard, WriterLeaseRegistry,
    WriterLeases,
};
use serde::{Deserialize, Serialize};
use std::path::Path;
use tauri::State;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LiveArgs {
    pub request: HistoryRunArgs,
    #[serde(default)]
    pub should_stash: bool,
}

#[derive(Debug, Serialize)]
#[serde(tag = "kind", rename_all = "kebab-case")]
pub enum LiveOutcome {
    Blocked {
        reason: String,
    },
    Stopped {
        result: Box<TrialResult>,
    },
    Finished {
        outcome: MoveOutcome,
        map: Vec<ShaMove>,
    },
}

const LEASE_LOST: &str =
    "The branch lock was lost while the edit was prepared. Nothing was changed. Try again.";

fn edit(args: &LiveArgs, is_lease_held: &dyn Fn() -> bool) -> Result<LiveOutcome, WorktreeError> {
    let plan = &args.request.plan;
    let cwd = Path::new(&plan.worktree_path);
    if let Some(reason) = super::preflight::preflight(cwd, &args.request.branch, &plan.head) {
        return Ok(LiveOutcome::Blocked { reason });
    }
    let replay = run_plan(&args.request, &format!("try-live-{}", now_nanos()), &|_| {})?;
    let result = match replay {
        RunOutcome::Tried { result } => result,
        RunOutcome::Blocked { reason } => return Ok(LiveOutcome::Blocked { reason }),
    };
    if result.stop.is_some() || !result.check.as_ref().is_some_and(|check| check.is_passed) {
        return Ok(LiveOutcome::Stopped { result });
    }
    let Some(head) = result.head.as_ref() else {
        return Ok(LiveOutcome::Stopped { result });
    };
    if !is_lease_held() {
        return Ok(LiveOutcome::Blocked {
            reason: LEASE_LOST.to_string(),
        });
    }
    let outcome = move_branch_with(
        cwd,
        &args.request.branch,
        &plan.head,
        head,
        false,
        args.should_stash,
    )?;
    Ok(LiveOutcome::Finished {
        outcome,
        map: result.map,
    })
}

fn edit_with_lease(
    registry: &WriterLeaseRegistry,
    args: &LiveArgs,
) -> Result<LiveOutcome, WorktreeError> {
    let path = &args.request.plan.worktree_path;
    let lease = acquire_lease(registry, path, LEASE_HOLDER, None);
    if !lease.is_granted {
        cancel_lease(registry, path, LEASE_HOLDER);
        return Ok(LiveOutcome::Blocked {
            reason: format!(
                "{} is writing here. Try again when it finishes.",
                lease.holder.as_deref().unwrap_or("An agent")
            ),
        });
    }
    let Some(token) = lease.token.as_deref() else {
        return Ok(LiveOutcome::Blocked {
            reason: LEASE_LOST.to_string(),
        });
    };
    let guard = RunLeaseGuard::bind(
        registry,
        path,
        LEASE_HOLDER,
        token,
        &format!("history-live-{}", now_nanos()),
        |_| {},
    );
    if guard.is_none() {
        return Ok(LiveOutcome::Blocked {
            reason: LEASE_LOST.to_string(),
        });
    }
    let result = edit(args, &|| holds_lease(registry, path, LEASE_HOLDER, token));
    release_lease(registry, path, LEASE_HOLDER, lease.token.as_deref());
    result
}

#[tauri::command]
pub async fn history_live_edit(
    leases: State<'_, WriterLeases>,
    args: LiveArgs,
) -> Result<LiveOutcome, WorktreeError> {
    let registry = leases.0.clone();
    tauri::async_runtime::spawn_blocking(move || edit_with_lease(&registry, &args))
        .await
        .map_err(|error| WorktreeError::Io(std::io::Error::other(error.to_string())))?
}

#[cfg(test)]
mod tests;
