use super::base::resolve_origin_head;
use super::git::{commit_ref_exists, git};
use super::status::{current_branch_name, distance_between, read_working_tree};
use super::types::{GitDistance, GitWorkingTree};
use serde::Serialize;
use std::collections::HashMap;
use std::path::Path;
use std::sync::{Arc, Mutex, OnceLock};
use std::time::{Duration, Instant};

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum DivergenceState {
    UpToDate,
    Behind,
    Ahead,
    Diverged,
    NoUpstream,
    NoBase,
    FetchFailed,
    Missing,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct BaseDivergence {
    pub state: DivergenceState,
    pub base: Option<String>,
    pub upstream: Option<String>,
    pub ahead: u32,
    pub behind: u32,
    pub checkout_branch: Option<String>,
    pub uncommitted: u32,
    pub message: Option<String>,
}

type Fetch<'a> = &'a mut dyn FnMut(&str) -> Result<(), String>;

const FETCH_TIMEOUT: Duration = Duration::from_secs(120);

pub(super) fn fetch_base_remote(
    project_path: &str,
    remote: &str,
    token: Option<&str>,
) -> Result<(), String> {
    let result = crate::github::run_git_authenticated_within(
        &["fetch", "--no-tags", "--no-prune", remote],
        project_path,
        token,
        Some(FETCH_TIMEOUT),
    )
    .map_err(|error| error.to_string())?;
    if result.exit_code != 0 {
        return Err(result.stderr.trim().to_string());
    }
    Ok(())
}

struct Settled {
    finished_at: Instant,
    report: BaseDivergence,
}

type Slot = Arc<Mutex<Option<Settled>>>;

fn slots() -> &'static Mutex<HashMap<String, Slot>> {
    static SLOTS: OnceLock<Mutex<HashMap<String, Slot>>> = OnceLock::new();
    SLOTS.get_or_init(|| Mutex::new(HashMap::new()))
}

fn slot_of(key: &str) -> Slot {
    let mut map = slots()
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
    map.entry(key.to_string())
        .or_insert_with(|| Arc::new(Mutex::new(None)))
        .clone()
}

pub(super) fn coalesced<F>(key: &str, max_age: Duration, check: F) -> BaseDivergence
where
    F: FnOnce() -> BaseDivergence,
{
    let slot = slot_of(key);
    let entered_at = Instant::now();
    let mut settled = slot.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
    if let Some(last) = settled.as_ref() {
        if last.finished_at >= entered_at || last.finished_at.elapsed() < max_age {
            return last.report.clone();
        }
    }
    let report = check();
    *settled = Some(Settled {
        finished_at: Instant::now(),
        report: report.clone(),
    });
    report
}

fn blank(state: DivergenceState) -> BaseDivergence {
    BaseDivergence {
        state,
        base: None,
        upstream: None,
        ahead: 0,
        behind: 0,
        checkout_branch: None,
        uncommitted: 0,
        message: None,
    }
}

fn named_base(base_branch: Option<String>) -> Option<String> {
    base_branch
        .map(|name| name.trim().to_string())
        .filter(|name| !name.is_empty())
}

fn configured_upstream(p: &Path, base: &str) -> Option<String> {
    git(
        p,
        &[
            "rev-parse",
            "--abbrev-ref",
            "--symbolic-full-name",
            &format!("{base}@{{upstream}}"),
        ],
    )
    .ok()
    .map(|found| found.trim().to_string())
    .filter(|found| !found.is_empty())
}

fn remote_of(p: &Path, base: &str) -> Option<String> {
    git(p, &["config", "--get", &format!("branch.{base}.remote")])
        .ok()
        .map(|found| found.trim().to_string())
        .filter(|found| !found.is_empty() && found != ".")
        .or_else(|| crate::repo::default_remote_name(p))
}

fn uncommitted_of(p: &Path) -> u32 {
    match read_working_tree(p) {
        GitWorkingTree::Known { changed, .. } => changed,
        GitWorkingTree::Unknown { .. } => 0,
    }
}

pub(super) fn base_divergence_with(
    p: &Path,
    base_branch: Option<String>,
    fetch: Fetch<'_>,
) -> BaseDivergence {
    if !p.is_dir() || !crate::repo::is_repo_root(p) {
        return blank(DivergenceState::Missing);
    }
    let checkout_branch = current_branch_name(p);
    let uncommitted = uncommitted_of(p);
    let shell = |state: DivergenceState, base: Option<String>| BaseDivergence {
        base,
        checkout_branch: checkout_branch.clone(),
        uncommitted,
        ..blank(state)
    };
    let Some(base) = named_base(base_branch).or_else(|| resolve_origin_head(p)) else {
        return shell(DivergenceState::NoBase, None);
    };
    let local = format!("refs/heads/{base}");
    if !commit_ref_exists(p, &local) {
        return shell(DivergenceState::NoBase, Some(base));
    }
    let Some(remote) = remote_of(p, &base) else {
        return shell(DivergenceState::NoUpstream, Some(base));
    };
    if let Err(message) = fetch(&remote) {
        return BaseDivergence {
            message: Some(message),
            ..shell(DivergenceState::FetchFailed, Some(base))
        };
    }
    let upstream = configured_upstream(p, &base).unwrap_or_else(|| format!("{remote}/{base}"));
    if !commit_ref_exists(p, &format!("refs/remotes/{upstream}")) {
        return shell(DivergenceState::NoUpstream, Some(base));
    }
    let (ahead, behind) = match distance_between(p, &upstream, &local) {
        GitDistance::Known { ahead, behind } => (ahead, behind),
        GitDistance::Unknown { .. } => {
            return BaseDivergence {
                upstream: Some(upstream),
                message: Some(format!("cannot compare {base} with its upstream")),
                ..shell(DivergenceState::FetchFailed, Some(base))
            };
        }
    };
    let state = match (ahead > 0, behind > 0) {
        (true, true) => DivergenceState::Diverged,
        (false, true) => DivergenceState::Behind,
        (true, false) => DivergenceState::Ahead,
        (false, false) => DivergenceState::UpToDate,
    };
    BaseDivergence {
        upstream: Some(upstream),
        ahead,
        behind,
        ..shell(state, Some(base))
    }
}

fn coalesce_key(p: &Path, base_branch: Option<&str>) -> String {
    let canonical = std::fs::canonicalize(p).unwrap_or_else(|_| p.to_path_buf());
    format!(
        "{}\u{0}{}",
        canonical.to_string_lossy(),
        base_branch.unwrap_or_default().trim()
    )
}

#[tauri::command]
pub async fn repo_base_divergence(
    project_path: String,
    base_branch: Option<String>,
    max_age_ms: u64,
    workspace_id: Option<String>,
    project_id: Option<String>,
) -> BaseDivergence {
    tauri::async_runtime::spawn_blocking(move || {
        let p = Path::new(project_path.trim());
        let key = coalesce_key(p, base_branch.as_deref());
        coalesced(&key, Duration::from_millis(max_age_ms), || {
            let token = crate::github::read_token(workspace_id.as_deref(), project_id.as_deref());
            let mut fetch =
                |remote: &str| fetch_base_remote(&project_path, remote, token.as_deref());
            base_divergence_with(p, base_branch, &mut fetch)
        })
    })
    .await
    .unwrap_or_else(|_| blank(DivergenceState::Missing))
}

#[cfg(test)]
mod tests;
