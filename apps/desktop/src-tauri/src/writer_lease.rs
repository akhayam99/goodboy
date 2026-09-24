use std::collections::HashSet;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use rusqlite::{params, OptionalExtension, TransactionBehavior};
use serde::{Deserialize, Serialize};
use thiserror::Error;

use crate::db::Db;

#[derive(Debug, Error)]
pub enum WriterLeaseError {
    #[error("writer lease sqlite error: {0}")]
    Sqlite(#[from] rusqlite::Error),
    #[error("writer lease mutex poisoned")]
    Poisoned,
}

impl WriterLeaseError {
    fn kind(&self) -> &'static str {
        match self {
            WriterLeaseError::Sqlite(_) => "sqlite",
            WriterLeaseError::Poisoned => "poisoned",
        }
    }
}

crate::util::impl_error_serialize!(WriterLeaseError);

pub const REPOSITORY_PREFIX: &str = "repo:";
pub const WORKTREE_PREFIX: &str = "tree:";

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WriterLeaseGrant {
    pub id: Option<String>,
    pub holder: String,
    pub token: Option<String>,
    pub is_granted: bool,
    pub blocked_by: Option<String>,
    pub blocked_state: Option<String>,
    pub blocked_resource: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UnknownWriterLease {
    pub id: String,
    pub holder: String,
    pub run_id: Option<String>,
    pub resources: Vec<String>,
    pub created_at: i64,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ManagedCheckout {
    pub repo_root: String,
    pub worktree_path: String,
    #[serde(default)]
    pub git_dir: Option<String>,
}

#[cfg(test)]
pub fn repository_resource(repo_root: &str) -> String {
    format!("{REPOSITORY_PREFIX}{repo_root}")
}

pub fn worktree_resource(repo_root: &str, worktree_path: &str) -> String {
    format!("{WORKTREE_PREFIX}{repo_root}|{worktree_path}")
}

fn is_repository_scope(resource: &str) -> bool {
    resource.starts_with(REPOSITORY_PREFIX)
}

fn repository_of(resource: &str) -> Option<&str> {
    if let Some(rest) = resource.strip_prefix(REPOSITORY_PREFIX) {
        return Some(rest);
    }
    let rest = resource.strip_prefix(WORKTREE_PREFIX)?;
    rest.split_once('|').map(|(repository, _)| repository)
}

fn checkout_of(resource: &str) -> Option<&str> {
    let rest = resource.strip_prefix(WORKTREE_PREFIX)?;
    rest.split_once('|').map(|(_, checkout)| checkout)
}

pub fn resources_conflict(left: &str, right: &str) -> bool {
    if left == right {
        return true;
    }
    if let (Some(left_checkout), Some(right_checkout)) = (checkout_of(left), checkout_of(right)) {
        if left_checkout == right_checkout {
            return true;
        }
    }
    let Some(left_repository) = repository_of(left) else {
        return false;
    };
    let Some(right_repository) = repository_of(right) else {
        return false;
    };
    left_repository == right_repository && (is_repository_scope(left) || is_repository_scope(right))
}

pub struct InvocationExposure<'a> {
    pub binary: &'a str,
    pub permission_mode: &'a str,
    pub is_read_only_role: bool,
    pub working_dir: &'a str,
    pub writable_roots: &'a [String],
    pub checkouts: &'a [ManagedCheckout],
}

pub fn invocation_exposure(request: &InvocationExposure<'_>) -> Vec<String> {
    if enforces_read_only(
        request.binary,
        request.permission_mode,
        request.is_read_only_role,
    ) {
        return Vec::new();
    }
    let mut resources: Vec<String> = Vec::new();
    push_unique(
        &mut resources,
        checkout_resource(request.working_dir, request.checkouts),
    );
    for root in request.writable_roots {
        let Some(resource) = granted_root_resource(root, request.checkouts) else {
            continue;
        };
        push_unique(&mut resources, resource);
    }
    resources
}

fn checkout_resource(path: &str, checkouts: &[ManagedCheckout]) -> String {
    let owning = checkouts
        .iter()
        .find(|checkout| checkout.worktree_path == path);
    match owning {
        Some(checkout) => worktree_resource(&checkout.repo_root, &checkout.worktree_path),
        None => worktree_resource(path, path),
    }
}

fn granted_root_resource(root: &str, checkouts: &[ManagedCheckout]) -> Option<String> {
    let is_shared_metadata = checkouts
        .iter()
        .any(|checkout| checkout.git_dir.as_deref() == Some(root));
    match is_shared_metadata {
        true => None,
        false => Some(checkout_resource(root, checkouts)),
    }
}

fn launcher_name(binary: &str) -> &str {
    std::path::Path::new(binary)
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or(binary)
}

pub fn launcher_proves_read_only(binary: &str) -> bool {
    launcher_is_trusted(binary, crate::path_env::resolved_path())
}

fn launcher_is_trusted(binary: &str, search_path: &str) -> bool {
    let name = launcher_name(binary);
    if !matches!(name, "claude" | "codex") {
        return false;
    }
    if binary == name {
        return true;
    }
    let Some(resolved) = resolve_on_path(name, search_path) else {
        return false;
    };
    match (
        std::fs::canonicalize(binary),
        std::fs::canonicalize(resolved),
    ) {
        (Ok(requested), Ok(trusted)) => requested == trusted,
        _ => false,
    }
}

fn resolve_on_path(name: &str, search_path: &str) -> Option<std::path::PathBuf> {
    std::env::split_paths(search_path)
        .map(|directory| directory.join(name))
        .find(|candidate| candidate.is_file())
}

pub fn enforces_read_only(binary: &str, permission_mode: &str, is_read_only_role: bool) -> bool {
    is_read_only_role && is_confined(binary, permission_mode) && launcher_proves_read_only(binary)
}

pub fn is_confined(binary: &str, permission_mode: &str) -> bool {
    match launcher_name(binary) {
        "cursor-agent" | "opencode" | "openrouter" | "moonshot" => false,
        _ => permission_mode != "bypassPermissions",
    }
}

fn push_unique(resources: &mut Vec<String>, resource: String) {
    if resources.iter().any(|existing| existing == &resource) {
        return;
    }
    resources.push(resource);
}

fn denied(holder: &str, blocked: &BlockingLease) -> WriterLeaseGrant {
    WriterLeaseGrant {
        id: None,
        holder: holder.to_string(),
        token: None,
        is_granted: false,
        blocked_by: Some(blocked.holder.clone()),
        blocked_state: Some(blocked.state.clone()),
        blocked_resource: Some(blocked.resource.clone()),
    }
}

struct BlockingLease {
    holder: String,
    state: String,
    resource: String,
}

struct HeldResource {
    lease_id: String,
    holder: String,
    state: String,
    resource: String,
}

pub fn acquire(
    db: &Db,
    holder: &str,
    resources: &[String],
    run_id: Option<&str>,
) -> Result<WriterLeaseGrant, WriterLeaseError> {
    reconcile(db)?;
    let mut conn = db.0.lock().map_err(|_| WriterLeaseError::Poisoned)?;
    let transaction = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
    let held = {
        let mut statement = transaction.prepare(
            "SELECT lease.id, lease.holder, lease.state, resource.resource
               FROM writer_leases lease
               JOIN writer_lease_resources resource ON resource.lease_id = lease.id
              WHERE lease.state IN ('active','unknown')",
        )?;
        let rows = statement.query_map([], |row| {
            Ok(HeldResource {
                lease_id: row.get(0)?,
                holder: row.get(1)?,
                state: row.get(2)?,
                resource: row.get(3)?,
            })
        })?;
        rows.collect::<Result<Vec<_>, _>>()?
    };
    let existing = held.iter().find(|entry| entry.holder == holder);
    if let Some(entry) = existing {
        let token: String = transaction.query_row(
            "SELECT token FROM writer_leases WHERE id = ?1",
            params![entry.lease_id],
            |row| row.get(0),
        )?;
        let lease_id = entry.lease_id.clone();
        transaction.commit()?;
        return Ok(WriterLeaseGrant {
            id: Some(lease_id),
            holder: holder.to_string(),
            token: Some(token),
            is_granted: true,
            blocked_by: None,
            blocked_state: None,
            blocked_resource: None,
        });
    }
    let blocked = held
        .iter()
        .find(|entry| {
            resources
                .iter()
                .any(|wanted| resources_conflict(wanted, &entry.resource))
        })
        .map(|entry| BlockingLease {
            holder: entry.holder.clone(),
            state: entry.state.clone(),
            resource: entry.resource.clone(),
        });
    if let Some(blocked) = blocked {
        transaction.commit()?;
        return Ok(denied(holder, &blocked));
    }
    let id = uuid_like();
    let token = uuid_like();
    let now = crate::util::now_ms();
    transaction.execute(
        "INSERT INTO writer_leases
         (id, holder, token, state, owner_process_id, process_id, run_id, created_at, updated_at)
         VALUES (?1, ?2, ?3, 'active', ?4, NULL, ?5, ?6, ?6)",
        params![id, holder, token, std::process::id(), run_id, now],
    )?;
    for resource in resources {
        transaction.execute(
            "INSERT OR IGNORE INTO writer_lease_resources (lease_id, resource) VALUES (?1, ?2)",
            params![id, resource],
        )?;
    }
    transaction.commit()?;
    Ok(WriterLeaseGrant {
        id: Some(id),
        holder: holder.to_string(),
        token: Some(token),
        is_granted: true,
        blocked_by: None,
        blocked_state: None,
        blocked_resource: None,
    })
}

const WAIT_POLL_INTERVAL_MS: u64 = 100;

pub const WAIT_CEILING_MS: u64 = 30 * 60 * 1000;

#[derive(Default)]
struct WaiterState {
    waiting: HashSet<String>,
    cancelled: HashSet<String>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct BlockedWait {
    pub waited_ms: u64,
    pub holder: String,
    pub state: String,
    pub resource: String,
}

#[derive(Debug, Clone, PartialEq)]
pub enum WriterLeaseWait {
    Granted(WriterLeaseGrant),
    Cancelled,
    Blocked(BlockedWait),
}

#[derive(Clone)]
pub struct WriterLeaseQueue {
    state: Arc<Mutex<WaiterState>>,
    ceiling: Duration,
}

impl Default for WriterLeaseQueue {
    fn default() -> Self {
        Self {
            state: Arc::new(Mutex::new(WaiterState::default())),
            ceiling: Duration::from_millis(WAIT_CEILING_MS),
        }
    }
}

impl WriterLeaseQueue {
    pub fn new() -> Self {
        Self::default()
    }

    #[cfg(test)]
    pub fn with_ceiling(ceiling: Duration) -> Self {
        Self {
            ceiling,
            ..Self::default()
        }
    }

    pub fn cancel(&self, holder: &str) -> bool {
        let Ok(mut state) = self.state.lock() else {
            return false;
        };
        match state.waiting.contains(holder) {
            true => {
                state.cancelled.insert(holder.to_string());
                true
            }
            false => false,
        }
    }

    #[cfg(test)]
    pub fn is_waiting(&self, holder: &str) -> bool {
        self.state
            .lock()
            .map(|state| state.waiting.contains(holder))
            .unwrap_or(false)
    }

    fn begin(&self, holder: &str) {
        let Ok(mut state) = self.state.lock() else {
            return;
        };
        state.cancelled.remove(holder);
        state.waiting.insert(holder.to_string());
    }

    fn end(&self, holder: &str) {
        let Ok(mut state) = self.state.lock() else {
            return;
        };
        state.cancelled.remove(holder);
        state.waiting.remove(holder);
    }

    fn is_cancelled(&self, holder: &str) -> bool {
        self.state
            .lock()
            .map(|state| state.cancelled.contains(holder))
            .unwrap_or(false)
    }
}

fn named(value: &Option<String>) -> String {
    value.clone().unwrap_or_else(|| "unknown".to_string())
}

fn blocked_wait(waited: Duration, grant: &WriterLeaseGrant) -> BlockedWait {
    BlockedWait {
        waited_ms: u64::try_from(waited.as_millis()).unwrap_or(u64::MAX),
        holder: named(&grant.blocked_by),
        state: named(&grant.blocked_state),
        resource: named(&grant.blocked_resource),
    }
}

pub async fn acquire_waiting(
    db: &Db,
    queue: &WriterLeaseQueue,
    holder: &str,
    resources: &[String],
    run_id: Option<&str>,
) -> Result<WriterLeaseWait, WriterLeaseError> {
    queue.begin(holder);
    let started = Instant::now();
    let outcome = loop {
        if queue.is_cancelled(holder) {
            break Ok(WriterLeaseWait::Cancelled);
        }
        let denied = match acquire(db, holder, resources, run_id) {
            Err(error) => break Err(error),
            Ok(grant) if grant.is_granted => break Ok(WriterLeaseWait::Granted(grant)),
            Ok(grant) => grant,
        };
        let waited = started.elapsed();
        if waited >= queue.ceiling {
            break Ok(WriterLeaseWait::Blocked(blocked_wait(waited, &denied)));
        }
        tokio::time::sleep(Duration::from_millis(WAIT_POLL_INTERVAL_MS)).await;
    };
    queue.end(holder);
    outcome
}

#[derive(Debug, Error)]
pub enum ExposureLeaseError {
    #[error("durable writer lease error: {0}")]
    Lease(#[from] WriterLeaseError),
    #[error("the invocation was cancelled while it waited for a writer lease")]
    Cancelled,
    #[error(
        "gave up after waiting {waited_ms}ms for a writer lease on {resource}, held by {holder} in state {state}"
    )]
    TimedOut {
        waited_ms: u64,
        holder: String,
        state: String,
        resource: String,
    },
}

pub struct HeldWriterLease {
    db: Db,
    token: String,
}

impl HeldWriterLease {
    pub fn bind_process(&self, process_id: u32) {
        let _ = bind_process(&self.db, &self.token, process_id);
    }
}

impl Drop for HeldWriterLease {
    fn drop(&mut self) {
        let _ = release(&self.db, &self.token);
    }
}

pub async fn hold_exposure(
    db: &Db,
    queue: &WriterLeaseQueue,
    holder: &str,
    exposure: &[String],
) -> Result<Option<HeldWriterLease>, ExposureLeaseError> {
    if exposure.is_empty() {
        return Ok(None);
    }
    match acquire_waiting(db, queue, holder, exposure, None).await? {
        WriterLeaseWait::Granted(WriterLeaseGrant {
            token: Some(token), ..
        }) => Ok(Some(HeldWriterLease {
            db: db.clone(),
            token,
        })),
        WriterLeaseWait::Granted(_) | WriterLeaseWait::Cancelled => {
            Err(ExposureLeaseError::Cancelled)
        }
        WriterLeaseWait::Blocked(blocked) => Err(ExposureLeaseError::TimedOut {
            waited_ms: blocked.waited_ms,
            holder: blocked.holder,
            state: blocked.state,
            resource: blocked.resource,
        }),
    }
}

pub fn bind_process(db: &Db, token: &str, process_id: u32) -> Result<bool, WriterLeaseError> {
    let conn = db.0.lock().map_err(|_| WriterLeaseError::Poisoned)?;
    let changed = conn.execute(
        "UPDATE writer_leases SET process_id = ?1, updated_at = ?2
          WHERE token = ?3 AND state = 'active'",
        params![process_id, crate::util::now_ms(), token],
    )?;
    Ok(changed == 1)
}

pub fn release(db: &Db, token: &str) -> Result<bool, WriterLeaseError> {
    let conn = db.0.lock().map_err(|_| WriterLeaseError::Poisoned)?;
    let now = crate::util::now_ms();
    let changed = conn.execute(
        "UPDATE writer_leases SET state = 'released', released_at = ?1, updated_at = ?1
          WHERE token = ?2 AND state != 'released'",
        params![now, token],
    )?;
    Ok(changed == 1)
}

pub fn reconcile(db: &Db) -> Result<(), WriterLeaseError> {
    let conn = db.0.lock().map_err(|_| WriterLeaseError::Poisoned)?;
    let stale = {
        let mut statement = conn.prepare(
            "SELECT id, owner_process_id, process_id FROM writer_leases WHERE state = 'active'",
        )?;
        let rows = statement.query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, u32>(1)?,
                row.get::<_, Option<u32>>(2)?,
            ))
        })?;
        rows.collect::<Result<Vec<_>, _>>()?
    };
    let current = std::process::id();
    let now = crate::util::now_ms();
    for (id, owner_process_id, process_id) in stale {
        if owner_process_id == current {
            continue;
        }
        if crate::invocation_admission::process_is_alive(owner_process_id) {
            continue;
        }
        let next = match process_id {
            Some(pid) if crate::invocation_admission::process_is_alive(pid) => continue,
            Some(_) => "released",
            None => "unknown",
        };
        conn.execute(
            "UPDATE writer_leases SET state = ?1, updated_at = ?2,
                    released_at = CASE WHEN ?1 = 'released' THEN ?2 ELSE released_at END
              WHERE id = ?3 AND state = 'active'",
            params![next, now, id],
        )?;
    }
    Ok(())
}

pub fn unknown_leases(db: &Db) -> Result<Vec<UnknownWriterLease>, WriterLeaseError> {
    let conn = db.0.lock().map_err(|_| WriterLeaseError::Poisoned)?;
    let leases = {
        let mut statement = conn.prepare(
            "SELECT id, holder, run_id, created_at FROM writer_leases
              WHERE state = 'unknown' ORDER BY created_at ASC",
        )?;
        let rows = statement.query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, Option<String>>(2)?,
                row.get::<_, i64>(3)?,
            ))
        })?;
        rows.collect::<Result<Vec<_>, _>>()?
    };
    let mut result: Vec<UnknownWriterLease> = Vec::new();
    for (id, holder, run_id, created_at) in leases {
        let mut statement = conn.prepare(
            "SELECT resource FROM writer_lease_resources WHERE lease_id = ?1 ORDER BY resource ASC",
        )?;
        let rows = statement.query_map(params![id], |row| row.get::<_, String>(0))?;
        let resources = rows.collect::<Result<Vec<_>, _>>()?;
        result.push(UnknownWriterLease {
            id,
            holder,
            run_id,
            resources,
            created_at,
        });
    }
    Ok(result)
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(tag = "kind", rename_all = "kebab-case")]
pub enum UnknownLeaseRelease {
    Released {
        id: String,
        holder: String,
        #[serde(rename = "releasedBy")]
        released_by: String,
        resources: Vec<String>,
    },
    NotFound {
        id: String,
    },
    NotStranded {
        id: String,
        state: String,
    },
    OwnerAlive {
        id: String,
        #[serde(rename = "processId")]
        process_id: u32,
    },
    EvidenceMissing {
        id: String,
    },
}

fn live_owner(owner_process_id: u32, process_id: Option<u32>) -> Option<u32> {
    if let Some(pid) = process_id {
        if crate::invocation_admission::process_is_alive(pid) {
            return Some(pid);
        }
    }
    match crate::invocation_admission::process_is_alive(owner_process_id) {
        true => Some(owner_process_id),
        false => None,
    }
}

pub fn release_unknown(
    db: &Db,
    lease_id: &str,
    released_by: &str,
    evidence: &str,
) -> Result<UnknownLeaseRelease, WriterLeaseError> {
    if released_by.trim().is_empty() || evidence.trim().is_empty() {
        return Ok(UnknownLeaseRelease::EvidenceMissing {
            id: lease_id.to_string(),
        });
    }
    let mut conn = db.0.lock().map_err(|_| WriterLeaseError::Poisoned)?;
    let transaction = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
    let found = transaction
        .query_row(
            "SELECT holder, state, owner_process_id, process_id FROM writer_leases WHERE id = ?1",
            params![lease_id],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, u32>(2)?,
                    row.get::<_, Option<u32>>(3)?,
                ))
            },
        )
        .optional()?;
    let Some((holder, state, owner_process_id, process_id)) = found else {
        transaction.commit()?;
        return Ok(UnknownLeaseRelease::NotFound {
            id: lease_id.to_string(),
        });
    };
    if state != "unknown" {
        transaction.commit()?;
        return Ok(UnknownLeaseRelease::NotStranded {
            id: lease_id.to_string(),
            state,
        });
    }
    if let Some(process_id) = live_owner(owner_process_id, process_id) {
        transaction.commit()?;
        return Ok(UnknownLeaseRelease::OwnerAlive {
            id: lease_id.to_string(),
            process_id,
        });
    }
    let now = crate::util::now_ms();
    transaction.execute(
        "UPDATE writer_leases SET state = 'released', released_at = ?1, updated_at = ?1,
                released_by = ?2, release_evidence = ?3
          WHERE id = ?4 AND state = 'unknown'",
        params![now, released_by, evidence, lease_id],
    )?;
    let resources = {
        let mut statement = transaction.prepare(
            "SELECT resource FROM writer_lease_resources WHERE lease_id = ?1 ORDER BY resource ASC",
        )?;
        let rows = statement.query_map(params![lease_id], |row| row.get::<_, String>(0))?;
        rows.collect::<Result<Vec<_>, _>>()?
    };
    transaction.commit()?;
    Ok(UnknownLeaseRelease::Released {
        id: lease_id.to_string(),
        holder,
        released_by: released_by.to_string(),
        resources,
    })
}

fn uuid_like() -> String {
    use std::sync::atomic::{AtomicU64, Ordering};
    static COUNTER: AtomicU64 = AtomicU64::new(1);
    format!(
        "{}-{}-{}",
        std::process::id(),
        crate::util::now_ms(),
        COUNTER.fetch_add(1, Ordering::Relaxed)
    )
}

#[tauri::command]
pub fn writer_lease_acquire(
    database: tauri::State<'_, Db>,
    holder: String,
    resources: Vec<String>,
    run_id: Option<String>,
) -> Result<WriterLeaseGrant, WriterLeaseError> {
    acquire(database.inner(), &holder, &resources, run_id.as_deref())
}

fn waited_grant(holder: &str, waited: WriterLeaseWait) -> WriterLeaseGrant {
    match waited {
        WriterLeaseWait::Granted(grant) => grant,
        WriterLeaseWait::Cancelled => WriterLeaseGrant {
            id: None,
            holder: holder.to_string(),
            token: None,
            is_granted: false,
            blocked_by: None,
            blocked_state: Some("cancelled".to_string()),
            blocked_resource: None,
        },
        WriterLeaseWait::Blocked(blocked) => WriterLeaseGrant {
            id: None,
            holder: holder.to_string(),
            token: None,
            is_granted: false,
            blocked_by: Some(blocked.holder),
            blocked_state: Some(blocked.state),
            blocked_resource: Some(blocked.resource),
        },
    }
}

#[tauri::command]
pub async fn writer_lease_acquire_waiting(
    database: tauri::State<'_, Db>,
    queue: tauri::State<'_, WriterLeaseQueue>,
    holder: String,
    resources: Vec<String>,
    run_id: Option<String>,
) -> Result<WriterLeaseGrant, WriterLeaseError> {
    let waited = acquire_waiting(
        database.inner(),
        queue.inner(),
        &holder,
        &resources,
        run_id.as_deref(),
    )
    .await?;
    Ok(waited_grant(&holder, waited))
}

#[tauri::command]
pub fn writer_lease_release(
    database: tauri::State<'_, Db>,
    token: String,
) -> Result<bool, WriterLeaseError> {
    release(database.inner(), &token)
}

#[tauri::command]
pub fn writer_lease_release_unknown(
    database: tauri::State<'_, Db>,
    lease_id: String,
    released_by: String,
    evidence: String,
) -> Result<UnknownLeaseRelease, WriterLeaseError> {
    release_unknown(database.inner(), &lease_id, &released_by, &evidence)
}

#[tauri::command]
pub fn writer_lease_unknown(
    database: tauri::State<'_, Db>,
) -> Result<Vec<UnknownWriterLease>, WriterLeaseError> {
    unknown_leases(database.inner())
}

#[cfg(test)]
mod tests {
    use std::path::PathBuf;
    use std::sync::{Arc, Mutex};

    use super::*;

    fn test_db() -> Db {
        let conn = rusqlite::Connection::open_in_memory().expect("memory database");
        conn.execute_batch(
            "CREATE TABLE writer_leases (
               id TEXT PRIMARY KEY,
               holder TEXT NOT NULL,
               token TEXT NOT NULL UNIQUE,
               state TEXT NOT NULL CHECK (state IN ('active','unknown','released')),
               owner_process_id INTEGER NOT NULL,
               process_id INTEGER,
               run_id TEXT,
               created_at INTEGER NOT NULL,
               updated_at INTEGER NOT NULL,
               released_at INTEGER,
               released_by TEXT,
               release_evidence TEXT
             );
             CREATE TABLE writer_lease_resources (
               lease_id TEXT NOT NULL,
               resource TEXT NOT NULL,
               PRIMARY KEY (lease_id, resource)
             );",
        )
        .expect("schema");
        Db(Arc::new(Mutex::new(conn)), PathBuf::new())
    }

    fn checkouts() -> Vec<ManagedCheckout> {
        vec![
            ManagedCheckout {
                repo_root: "/repos/app".to_string(),
                worktree_path: "/repos/app/.worktrees/one".to_string(),
                git_dir: Some("/repos/app/.git".to_string()),
            },
            ManagedCheckout {
                repo_root: "/repos/app".to_string(),
                worktree_path: "/repos/app/.worktrees/two".to_string(),
                git_dir: Some("/repos/app/.git".to_string()),
            },
        ]
    }

    #[test]
    fn a_repository_scope_conflicts_with_any_checkout_of_that_repository() {
        assert!(resources_conflict(
            &repository_resource("/repos/app"),
            &worktree_resource("/repos/app", "/repos/app/.worktrees/two"),
        ));
        assert!(!resources_conflict(
            &worktree_resource("/repos/app", "/repos/app/.worktrees/one"),
            &worktree_resource("/repos/app", "/repos/app/.worktrees/two"),
        ));
        assert!(!resources_conflict(
            &repository_resource("/repos/app"),
            &repository_resource("/repos/other"),
        ));
    }

    #[test]
    fn a_bypassed_launcher_is_not_confined_and_a_sandboxed_one_is() {
        assert!(!is_confined("cursor-agent", "default"));
        assert!(!is_confined("/usr/local/bin/opencode", "default"));
        assert!(!is_confined("codex", "bypassPermissions"));
        assert!(is_confined("codex", "default"));
        assert!(is_confined("agy", "default"));
        assert!(is_confined("claude", "acceptEdits"));
        assert!(!is_confined("claude", "bypassPermissions"));
    }

    fn exposure_of(
        binary: &str,
        permission_mode: &str,
        is_read_only_role: bool,
        working_dir: &str,
        writable_roots: &[String],
    ) -> Vec<String> {
        invocation_exposure(&InvocationExposure {
            binary,
            permission_mode,
            is_read_only_role,
            working_dir,
            writable_roots,
            checkouts: &checkouts(),
        })
    }

    #[test]
    fn an_unconfined_invocation_takes_its_checkout_and_the_siblings_it_was_granted() {
        let exposure = exposure_of(
            "codex",
            "bypassPermissions",
            false,
            "/repos/app/.worktrees/one",
            &[
                "/repos/app/.worktrees/two".to_string(),
                "/repos/app/.git".to_string(),
            ],
        );
        assert_eq!(
            exposure,
            vec![
                worktree_resource("/repos/app", "/repos/app/.worktrees/one"),
                worktree_resource("/repos/app", "/repos/app/.worktrees/two"),
            ]
        );
    }

    #[test]
    fn a_confined_invocation_without_shared_metadata_exposes_only_its_checkout() {
        let exposure = exposure_of("codex", "default", false, "/repos/app/.worktrees/one", &[]);
        assert_eq!(
            exposure,
            vec![worktree_resource("/repos/app", "/repos/app/.worktrees/one")]
        );
    }

    #[test]
    fn a_granted_git_common_directory_does_not_escalate_a_turn_to_a_repository_scope() {
        let exposure = exposure_of(
            "codex",
            "default",
            false,
            "/repos/app/.worktrees/one",
            &["/repos/app/.git".to_string()],
        );
        assert_eq!(
            exposure,
            vec![worktree_resource("/repos/app", "/repos/app/.worktrees/one")]
        );
        assert!(!exposure
            .iter()
            .any(|resource| resource.starts_with(REPOSITORY_PREFIX)));
    }

    #[test]
    fn two_turns_in_different_worktrees_of_one_repository_do_not_exclude_each_other() {
        let db = test_db();
        let roots = vec!["/repos/app/.git".to_string()];
        let first = exposure_of(
            "claude",
            "default",
            false,
            "/repos/app/.worktrees/one",
            &roots,
        );
        let second = exposure_of(
            "claude",
            "bypassPermissions",
            false,
            "/repos/app/.worktrees/two",
            &roots,
        );
        assert!(
            acquire(&db, "run-1", &first, Some("run-1"))
                .expect("first")
                .is_granted
        );
        assert!(
            acquire(&db, "run-2", &second, Some("run-2"))
                .expect("second")
                .is_granted
        );
    }

    #[test]
    fn a_read_only_role_holds_no_lease_on_claude_or_codex() {
        for binary in ["claude", "codex"] {
            let exposure = exposure_of(
                binary,
                "default",
                true,
                "/repos/app/.worktrees/one",
                &["/repos/app/.git".to_string()],
            );
            assert!(exposure.is_empty(), "{binary} should hold no resource");
        }
    }

    #[test]
    fn four_read_only_scouts_share_one_checkout_at_the_same_time() {
        let db = test_db();
        for index in 0..4 {
            let exposure = exposure_of("claude", "default", true, "/repos/app/.worktrees/one", &[]);
            assert!(exposure.is_empty());
            let grant = acquire(&db, &format!("scout-{index}"), &exposure, None).expect("scout");
            assert!(grant.is_granted);
        }
    }

    #[test]
    fn a_read_only_role_on_an_unscopable_launcher_still_takes_a_lease() {
        for binary in ["cursor-agent", "opencode", "agy"] {
            let exposure = exposure_of(binary, "default", true, "/repos/app/.worktrees/one", &[]);
            assert_eq!(
                exposure,
                vec![worktree_resource("/repos/app", "/repos/app/.worktrees/one")],
                "{binary} cannot prove a read-only invocation"
            );
        }
    }

    #[test]
    fn a_read_only_role_under_a_bypass_mode_is_not_proven_read_only() {
        let exposure = exposure_of(
            "claude",
            "bypassPermissions",
            true,
            "/repos/app/.worktrees/one",
            &[],
        );
        assert_eq!(
            exposure,
            vec![worktree_resource("/repos/app", "/repos/app/.worktrees/one")]
        );
        assert!(!enforces_read_only("claude", "bypassPermissions", true));
        assert!(enforces_read_only("claude", "default", true));
        assert!(!enforces_read_only("claude", "default", false));
    }

    #[test]
    fn a_mount_operation_still_takes_the_repository_and_excludes_a_turn_in_it() {
        let db = test_db();
        let mount = vec![repository_resource("/repos/app")];
        assert!(
            acquire(&db, "mount:mount-1", &mount, None)
                .expect("mount")
                .is_granted
        );
        let turn = exposure_of("claude", "default", false, "/repos/app/.worktrees/one", &[]);
        let denied = acquire(&db, "run-1", &turn, Some("run-1")).expect("turn");
        assert!(!denied.is_granted);
        assert_eq!(denied.blocked_by.as_deref(), Some("mount:mount-1"));
        let elsewhere = invocation_exposure(&InvocationExposure {
            binary: "claude",
            permission_mode: "default",
            is_read_only_role: false,
            working_dir: "/repos/other/main",
            writable_roots: &[],
            checkouts: &[],
        });
        assert!(
            acquire(&db, "run-2", &elsewhere, Some("run-2"))
                .expect("other repository")
                .is_granted
        );
    }

    #[test]
    fn two_implementers_in_one_checkout_cannot_hold_a_lease_at_the_same_time() {
        let db = test_db();
        let resources = vec![worktree_resource("/repos/app", "/repos/app/.worktrees/one")];
        let first = acquire(&db, "agent-1", &resources, Some("run-1")).expect("first");
        assert!(first.is_granted);
        let second = acquire(&db, "agent-2", &resources, Some("run-2")).expect("second");
        assert!(!second.is_granted);
        assert_eq!(second.blocked_by.as_deref(), Some("agent-1"));
        assert_eq!(second.blocked_state.as_deref(), Some("active"));
    }

    #[test]
    fn a_bypassed_process_excludes_every_managed_checkout_it_was_granted() {
        let db = test_db();
        let bypassed = exposure_of(
            "cursor-agent",
            "default",
            false,
            "/repos/app/.worktrees/one",
            &["/repos/app/.worktrees/two".to_string()],
        );
        let granted = acquire(&db, "agent-bypassed", &bypassed, Some("run-1")).expect("bypassed");
        assert!(granted.is_granted);
        let sibling = vec![worktree_resource("/repos/app", "/repos/app/.worktrees/two")];
        let denied = acquire(&db, "agent-sibling", &sibling, Some("run-2")).expect("sibling");
        assert!(!denied.is_granted);
        assert_eq!(denied.blocked_by.as_deref(), Some("agent-bypassed"));
        let elsewhere = vec![worktree_resource("/repos/other", "/repos/other/main")];
        assert!(
            acquire(&db, "agent-other", &elsewhere, None)
                .expect("other repository")
                .is_granted
        );
    }

    #[test]
    fn releasing_is_idempotent_and_frees_the_resource() {
        let db = test_db();
        let resources = vec![worktree_resource("/repos/app", "/repos/app/.worktrees/one")];
        let granted = acquire(&db, "agent-1", &resources, None).expect("granted");
        let token = granted.token.expect("token");
        assert!(release(&db, &token).expect("first release"));
        assert!(!release(&db, &token).expect("second release"));
        assert!(
            acquire(&db, "agent-2", &resources, None)
                .expect("after release")
                .is_granted
        );
    }

    #[test]
    fn a_failed_spawn_releases_the_lease_it_never_bound() {
        let db = test_db();
        let resources = vec![repository_resource("/repos/app")];
        let granted = acquire(&db, "agent-1", &resources, Some("run-1")).expect("granted");
        let token = granted.token.expect("token");
        assert!(release(&db, &token).expect("release after failed spawn"));
        let next = acquire(&db, "agent-2", &resources, Some("run-2")).expect("next");
        assert!(next.is_granted);
    }

    #[test]
    fn a_lease_whose_process_is_gone_is_reclaimed_after_a_restart() {
        let db = test_db();
        let resources = vec![repository_resource("/repos/app")];
        let granted = acquire(&db, "agent-1", &resources, Some("run-1")).expect("granted");
        let token = granted.token.clone().expect("token");
        assert!(bind_process(&db, &token, 999_999).expect("bind"));
        {
            let conn = db.0.lock().expect("lock");
            conn.execute(
                "UPDATE writer_leases SET owner_process_id = 999998",
                params![],
            )
            .expect("simulate restart");
        }
        let next = acquire(&db, "agent-2", &resources, Some("run-2")).expect("next");
        assert!(next.is_granted);
        assert!(unknown_leases(&db).expect("unknown").is_empty());
    }

    #[test]
    fn a_lease_whose_ownership_is_unknown_after_a_restart_is_surfaced_not_reused() {
        let db = test_db();
        let resources = vec![repository_resource("/repos/app")];
        acquire(&db, "agent-1", &resources, Some("run-1")).expect("granted");
        {
            let conn = db.0.lock().expect("lock");
            conn.execute(
                "UPDATE writer_leases SET owner_process_id = 999998",
                params![],
            )
            .expect("simulate restart");
        }
        let denied = acquire(&db, "agent-2", &resources, Some("run-2")).expect("next");
        assert!(!denied.is_granted);
        assert_eq!(denied.blocked_state.as_deref(), Some("unknown"));
        let surfaced = unknown_leases(&db).expect("unknown");
        assert_eq!(surfaced.len(), 1);
        assert_eq!(surfaced[0].holder, "agent-1");
        assert_eq!(surfaced[0].resources, resources);
    }

    fn strand(db: &Db) {
        {
            let conn = db.0.lock().expect("lock");
            conn.execute(
                "UPDATE writer_leases SET owner_process_id = 999998",
                params![],
            )
            .expect("simulate restart");
        }
        reconcile(db).expect("reconcile");
    }

    #[test]
    fn a_stranded_unknown_lease_is_released_explicitly_and_the_release_is_recorded() {
        let db = test_db();
        let resources = vec![repository_resource("/repos/app")];
        acquire(&db, "agent-1", &resources, Some("run-1")).expect("granted");
        strand(&db);
        let stranded = unknown_leases(&db).expect("unknown");
        let lease_id = stranded[0].id.clone();

        let released = release_unknown(
            &db,
            &lease_id,
            "the user",
            "inspected the holder and confirmed nothing is writing",
        )
        .expect("release");

        assert_eq!(
            released,
            UnknownLeaseRelease::Released {
                id: lease_id.clone(),
                holder: "agent-1".to_string(),
                released_by: "the user".to_string(),
                resources: resources.clone(),
            }
        );
        assert!(unknown_leases(&db).expect("unknown").is_empty());
        let recorded: (String, String, String) = {
            let conn = db.0.lock().expect("lock");
            conn.query_row(
                "SELECT state, released_by, release_evidence FROM writer_leases WHERE id = ?1",
                params![lease_id],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
            )
            .expect("row")
        };
        assert_eq!(recorded.0, "released");
        assert_eq!(recorded.1, "the user");
        assert_eq!(
            recorded.2,
            "inspected the holder and confirmed nothing is writing"
        );
        let next = acquire(&db, "agent-2", &resources, Some("run-2")).expect("next");
        assert!(next.is_granted);
    }

    #[test]
    fn releasing_a_lease_whose_owner_is_alive_is_refused() {
        let db = test_db();
        let resources = vec![repository_resource("/repos/app")];
        acquire(&db, "agent-1", &resources, Some("run-1")).expect("granted");
        let lease_id: String = {
            let conn = db.0.lock().expect("lock");
            conn.execute(
                "UPDATE writer_leases SET state = 'unknown'",
                params![],
            )
            .expect("simulate a stale unknown row");
            conn.query_row("SELECT id FROM writer_leases", params![], |row| row.get(0))
                .expect("id")
        };

        let refused = release_unknown(&db, &lease_id, "the user", "looks stuck").expect("refusal");

        assert_eq!(
            refused,
            UnknownLeaseRelease::OwnerAlive {
                id: lease_id.clone(),
                process_id: std::process::id(),
            }
        );
        let state: String = {
            let conn = db.0.lock().expect("lock");
            conn.query_row(
                "SELECT state FROM writer_leases WHERE id = ?1",
                params![lease_id],
                |row| row.get(0),
            )
            .expect("row")
        };
        assert_eq!(state, "unknown");
        let denied = acquire(&db, "agent-2", &resources, Some("run-2")).expect("next");
        assert!(!denied.is_granted);
    }

    #[test]
    fn releasing_an_active_lease_through_the_stranded_path_is_refused() {
        let db = test_db();
        let resources = vec![repository_resource("/repos/app")];
        let granted = acquire(&db, "agent-1", &resources, Some("run-1")).expect("granted");
        let lease_id = granted.id.clone().expect("id");

        let refused =
            release_unknown(&db, &lease_id, "the user", "looks stuck").expect("refusal");

        assert_eq!(
            refused,
            UnknownLeaseRelease::NotStranded {
                id: lease_id,
                state: "active".to_string(),
            }
        );
    }

    #[test]
    fn releasing_a_stranded_lease_without_evidence_is_refused() {
        let db = test_db();
        let resources = vec![repository_resource("/repos/app")];
        acquire(&db, "agent-1", &resources, Some("run-1")).expect("granted");
        strand(&db);
        let lease_id = unknown_leases(&db).expect("unknown")[0].id.clone();

        assert_eq!(
            release_unknown(&db, &lease_id, "the user", "   ").expect("refusal"),
            UnknownLeaseRelease::EvidenceMissing {
                id: lease_id.clone()
            }
        );
        assert_eq!(unknown_leases(&db).expect("unknown").len(), 1);
    }

    #[tokio::test]
    async fn a_waiter_proceeds_once_a_stranded_lease_is_released_explicitly() {
        let db = test_db();
        let queue = WriterLeaseQueue::with_ceiling(Duration::from_secs(30));
        let resources = vec![repository_resource("/repos/app")];
        acquire(&db, "agent-1", &resources, Some("run-1")).expect("granted");
        strand(&db);
        let lease_id = unknown_leases(&db).expect("unknown")[0].id.clone();

        let waiting = {
            let db = db.clone();
            let queue = queue.clone();
            let resources = resources.clone();
            tokio::spawn(async move {
                acquire_waiting(&db, &queue, "run-2", &resources, Some("run-2")).await
            })
        };
        assert!(settle_until(|| queue.is_waiting("run-2")).await);
        release_unknown(&db, &lease_id, "the user", "confirmed the holder is gone")
            .expect("release");

        let waited = waiting.await.expect("join").expect("result");
        let WriterLeaseWait::Granted(grant) = waited else {
            panic!("the waiter should have taken the freed resource");
        };
        assert!(grant.is_granted);
    }

    #[test]
    fn re_acquiring_as_the_same_holder_returns_the_lease_it_already_holds() {
        let db = test_db();
        let resources = vec![repository_resource("/repos/app")];
        let first = acquire(&db, "agent-1", &resources, Some("run-1")).expect("first");
        let again = acquire(&db, "agent-1", &resources, Some("run-1")).expect("again");
        assert!(again.is_granted);
        assert_eq!(again.token, first.token);
    }

    fn holder_count(db: &Db, holder: &str) -> u32 {
        let conn = db.0.lock().expect("lock");
        conn.query_row(
            "SELECT COUNT(*) FROM writer_leases WHERE holder = ?1 AND state != 'released'",
            params![holder],
            |row| row.get(0),
        )
        .expect("count")
    }

    async fn settle_until(check: impl Fn() -> bool) -> bool {
        for _ in 0..200 {
            if check() {
                return true;
            }
            tokio::time::sleep(Duration::from_millis(5)).await;
        }
        false
    }

    #[tokio::test]
    async fn a_second_writer_in_one_checkout_waits_and_proceeds_when_the_first_releases() {
        let db = test_db();
        let queue = WriterLeaseQueue::new();
        let resources = vec![worktree_resource("/repos/app", "/repos/app/.worktrees/one")];
        let first = acquire(&db, "run-1", &resources, Some("run-1")).expect("first");
        let token = first.token.clone().expect("token");

        let waiter = tokio::spawn({
            let db = db.clone();
            let queue = queue.clone();
            let resources = resources.clone();
            async move { acquire_waiting(&db, &queue, "run-2", &resources, Some("run-2")).await }
        });

        assert!(
            settle_until(|| queue.is_waiting("run-2")).await,
            "the second writer never started waiting"
        );
        assert_eq!(holder_count(&db, "run-2"), 0);
        assert!(release(&db, &token).expect("release"));

        let waited = waiter.await.expect("waiter task").expect("waiter result");
        let WriterLeaseWait::Granted(granted) = waited else {
            panic!("the second writer never acquired after the first released");
        };
        assert!(granted.is_granted);
        assert_eq!(granted.holder, "run-2");
        assert!(!queue.is_waiting("run-2"));
    }

    #[tokio::test]
    async fn a_cancelled_waiter_releases_and_holds_no_lease_and_no_invocation_ticket() {
        let db = test_db();
        {
            let conn = db.0.lock().expect("lock");
            conn.execute_batch(
                "CREATE TABLE invocation_tickets (id TEXT PRIMARY KEY, status TEXT NOT NULL);",
            )
            .expect("ticket schema");
        }
        let queue = WriterLeaseQueue::new();
        let resources = vec![worktree_resource("/repos/app", "/repos/app/.worktrees/one")];
        acquire(&db, "run-1", &resources, Some("run-1")).expect("first");

        let waiter = tokio::spawn({
            let db = db.clone();
            let queue = queue.clone();
            let resources = resources.clone();
            async move { acquire_waiting(&db, &queue, "run-2", &resources, Some("run-2")).await }
        });

        assert!(
            settle_until(|| queue.is_waiting("run-2")).await,
            "the second writer never started waiting"
        );
        assert!(queue.cancel("run-2"));

        let outcome = waiter.await.expect("waiter task").expect("waiter result");
        assert_eq!(outcome, WriterLeaseWait::Cancelled);
        assert_eq!(holder_count(&db, "run-2"), 0);
        let tickets: u32 = {
            let conn = db.0.lock().expect("lock");
            conn.query_row("SELECT COUNT(*) FROM invocation_tickets", [], |row| {
                row.get(0)
            })
            .expect("tickets")
        };
        assert_eq!(tickets, 0);
        assert!(!queue.is_waiting("run-2"));
        assert!(!queue.cancel("run-2"));
    }

    #[tokio::test]
    async fn a_waiter_that_can_take_its_resources_never_blocks() {
        let db = test_db();
        let queue = WriterLeaseQueue::new();
        let resources = vec![worktree_resource("/repos/app", "/repos/app/.worktrees/one")];
        let waited = acquire_waiting(&db, &queue, "run-1", &resources, Some("run-1"))
            .await
            .expect("result");
        let WriterLeaseWait::Granted(granted) = waited else {
            panic!("an uncontended waiter should acquire immediately");
        };
        assert!(granted.is_granted);
        assert!(!queue.is_waiting("run-1"));
    }

    #[tokio::test]
    async fn a_waiter_behind_a_stranded_unknown_lease_gives_up_and_names_the_holder() {
        let db = test_db();
        let queue = WriterLeaseQueue::with_ceiling(Duration::from_millis(250));
        let resources = vec![repository_resource("/repos/app")];
        acquire(&db, "agent-1", &resources, Some("run-1")).expect("granted");
        {
            let conn = db.0.lock().expect("lock");
            conn.execute(
                "UPDATE writer_leases SET owner_process_id = 999998",
                params![],
            )
            .expect("simulate restart");
        }

        let waited = acquire_waiting(&db, &queue, "run-2", &resources, Some("run-2"))
            .await
            .expect("result");
        let WriterLeaseWait::Blocked(blocked) = waited else {
            panic!("the waiter should have given up on the stranded lease");
        };
        assert_eq!(blocked.holder, "agent-1");
        assert_eq!(blocked.state, "unknown");
        assert_eq!(blocked.resource, repository_resource("/repos/app"));
        assert!(blocked.waited_ms >= 250);
        assert_eq!(holder_count(&db, "run-2"), 0);
        assert!(!queue.is_waiting("run-2"));
    }

    #[tokio::test]
    async fn a_waiter_within_the_ceiling_still_waits_for_an_ordinary_writer() {
        let db = test_db();
        let queue = WriterLeaseQueue::with_ceiling(Duration::from_secs(30));
        let resources = vec![worktree_resource("/repos/app", "/repos/app/.worktrees/one")];
        let first = acquire(&db, "run-1", &resources, Some("run-1")).expect("first");
        let token = first.token.clone().expect("token");

        let waiter = tokio::spawn({
            let db = db.clone();
            let queue = queue.clone();
            let resources = resources.clone();
            async move { acquire_waiting(&db, &queue, "run-2", &resources, Some("run-2")).await }
        });

        assert!(
            settle_until(|| queue.is_waiting("run-2")).await,
            "the second writer never started waiting"
        );
        assert!(release(&db, &token).expect("release"));
        let waited = waiter.await.expect("waiter task").expect("waiter result");
        assert!(matches!(waited, WriterLeaseWait::Granted(_)));
    }

    fn launcher_directory(label: &str) -> std::path::PathBuf {
        let directory = std::env::temp_dir().join(format!(
            "goodboy-launcher-{label}-{}-{}",
            std::process::id(),
            crate::util::now_ms()
        ));
        std::fs::create_dir_all(&directory).expect("launcher directory");
        std::fs::write(directory.join("claude"), "").expect("launcher file");
        directory
    }

    #[test]
    fn only_the_launcher_the_app_path_resolves_can_prove_a_read_only_invocation() {
        let trusted = launcher_directory("trusted");
        let impostor = launcher_directory("impostor");
        let search_path = trusted.to_string_lossy().to_string();
        let trusted_binary = trusted.join("claude").to_string_lossy().to_string();
        let impostor_binary = impostor.join("claude").to_string_lossy().to_string();

        assert!(launcher_is_trusted("claude", &search_path));
        assert!(launcher_is_trusted(&trusted_binary, &search_path));
        assert!(!launcher_is_trusted(&impostor_binary, &search_path));
        assert!(!launcher_is_trusted("/nowhere/codex", &search_path));
        assert!(!launcher_is_trusted("cursor-agent", &search_path));

        let _ = std::fs::remove_dir_all(trusted);
        let _ = std::fs::remove_dir_all(impostor);
    }

    #[test]
    fn two_names_for_one_checkout_conflict() {
        assert!(resources_conflict(
            &worktree_resource("/repos/app/.worktrees/one", "/repos/app/.worktrees/one"),
            &worktree_resource("/repos/app", "/repos/app/.worktrees/one"),
        ));
    }

    #[test]
    fn a_waited_denial_reports_the_blocking_holder_instead_of_a_grant() {
        let grant = waited_grant(
            "mount:one",
            WriterLeaseWait::Blocked(BlockedWait {
                waited_ms: 1_800_000,
                holder: "run-1".to_string(),
                state: "active".to_string(),
                resource: repository_resource("/repos/app"),
            }),
        );
        assert!(!grant.is_granted);
        assert_eq!(grant.blocked_by.as_deref(), Some("run-1"));
        assert_eq!(grant.blocked_state.as_deref(), Some("active"));
    }

    #[tokio::test]
    async fn a_mount_operation_waits_for_a_turn_instead_of_failing() {
        let db = test_db();
        let queue = WriterLeaseQueue::new();
        let turn = vec![worktree_resource("/repos/app", "/repos/app/.worktrees/one")];
        let token = acquire(&db, "run-1", &turn, Some("run-1"))
            .expect("turn")
            .token
            .expect("token");

        let mount = tokio::spawn({
            let db = db.clone();
            let queue = queue.clone();
            async move {
                acquire_waiting(
                    &db,
                    &queue,
                    "mount:one",
                    &[repository_resource("/repos/app")],
                    None,
                )
                .await
            }
        });
        assert!(settle_until(|| queue.is_waiting("mount:one")).await);
        assert!(release(&db, &token).expect("release"));

        let waited = mount.await.expect("mount task").expect("mount result");
        assert!(waited_grant("mount:one", waited).is_granted);
    }

    #[tokio::test]
    async fn an_unproven_auxiliary_launcher_holds_its_checkout_until_it_drops() {
        let db = test_db();
        let queue = WriterLeaseQueue::new();
        let exposure = invocation_exposure(&InvocationExposure {
            binary: "cursor-agent",
            permission_mode: "default",
            is_read_only_role: true,
            working_dir: "/repos/app/.worktrees/one",
            writable_roots: &[],
            checkouts: &[],
        });

        let held = hold_exposure(&db, &queue, "summarizer-1", &exposure)
            .await
            .expect("hold")
            .expect("lease");
        let turn = vec![worktree_resource("/repos/app", "/repos/app/.worktrees/one")];
        assert!(!acquire(&db, "run-1", &turn, None).expect("turn").is_granted);
        drop(held);
        assert!(acquire(&db, "run-1", &turn, None).expect("turn").is_granted);
    }

    #[test]
    fn the_default_ceiling_outlasts_a_long_turn_and_still_surfaces_the_same_session() {
        assert_eq!(
            WriterLeaseQueue::new().ceiling,
            Duration::from_secs(30 * 60)
        );
        assert_eq!(WAIT_CEILING_MS, 30 * 60 * 1000);
    }
}
