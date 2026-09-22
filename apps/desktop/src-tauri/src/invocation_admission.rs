use std::sync::{Arc, Condvar, Mutex};
use std::time::Duration;

use rusqlite::{params, OptionalExtension, TransactionBehavior};
use serde::Deserialize;
use thiserror::Error;

use crate::db::Db;

const DEFAULT_GLOBAL_LIMIT: u32 = 4;
const DEFAULT_PROVIDER_LIMIT: u32 = 2;
const DEFAULT_HEAVYWEIGHT_LIMIT: u32 = 1;

#[derive(Debug, Error)]
pub enum AdmissionError {
    #[error("sqlite error: {0}")]
    Sqlite(#[from] rusqlite::Error),
    #[error("invocation admission mutex poisoned")]
    Poisoned,
    #[error("spend reservation refused for {budget_identity}: {requested_usd:.6} USD requested with {remaining_usd:.6} USD remaining")]
    BudgetExceeded {
        budget_identity: String,
        requested_usd: f64,
        remaining_usd: f64,
    },
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SpendReservation {
    pub estimated_spend_usd: f64,
    #[serde(default)]
    pub allow_over_budget: bool,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InvocationLimits {
    #[serde(default = "default_global_limit")]
    pub global: u32,
    #[serde(default = "default_provider_limit")]
    pub provider: u32,
    #[serde(default = "default_heavyweight_limit")]
    pub heavyweight: u32,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InvocationContext {
    pub invocation_id: String,
    #[serde(default)]
    pub workspace_id: Option<String>,
    #[serde(default)]
    pub session_id: Option<String>,
    #[serde(default)]
    pub workflow_run_id: Option<String>,
    #[serde(default)]
    pub agent_id: Option<String>,
    #[serde(default)]
    pub provider_identity: Option<String>,
    pub purpose: String,
    #[serde(default)]
    pub is_heavyweight: bool,
    #[serde(default)]
    pub limits: InvocationLimits,
    #[serde(default)]
    pub spend_reservation: Option<SpendReservation>,
}

impl InvocationContext {
    pub fn request(self, provider: &str) -> AdmissionRequest {
        let provider_identity = self
            .provider_identity
            .filter(|identity| identity.is_empty() == false)
            .map(|identity| format!("{provider}:{identity}"))
            .unwrap_or_else(|| provider.to_string());
        AdmissionRequest {
            id: self.invocation_id,
            workspace_id: self.workspace_id,
            session_id: self.session_id,
            workflow_run_id: self.workflow_run_id,
            agent_id: self.agent_id,
            provider: provider.to_string(),
            provider_identity,
            purpose: self.purpose,
            is_heavyweight: self.is_heavyweight,
            limits: self.limits,
            spend_reservation: self.spend_reservation,
        }
    }
}

impl Default for InvocationLimits {
    fn default() -> Self {
        Self {
            global: DEFAULT_GLOBAL_LIMIT,
            provider: DEFAULT_PROVIDER_LIMIT,
            heavyweight: DEFAULT_HEAVYWEIGHT_LIMIT,
        }
    }
}

fn default_global_limit() -> u32 {
    DEFAULT_GLOBAL_LIMIT
}

fn default_provider_limit() -> u32 {
    DEFAULT_PROVIDER_LIMIT
}

fn default_heavyweight_limit() -> u32 {
    DEFAULT_HEAVYWEIGHT_LIMIT
}

#[derive(Clone, Debug)]
pub struct AdmissionRequest {
    pub id: String,
    pub workspace_id: Option<String>,
    pub session_id: Option<String>,
    pub workflow_run_id: Option<String>,
    pub agent_id: Option<String>,
    pub provider: String,
    pub provider_identity: String,
    pub purpose: String,
    pub is_heavyweight: bool,
    pub limits: InvocationLimits,
    pub spend_reservation: Option<SpendReservation>,
}

#[derive(Clone, Default)]
pub struct InvocationAdmission {
    signal: Arc<(Mutex<()>, Condvar)>,
}

pub struct InvocationPermit {
    admission: InvocationAdmission,
    db: Db,
    id: String,
    is_released: bool,
    has_bound_process: bool,
}

impl InvocationAdmission {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn admit(
        &self,
        db: Db,
        request: AdmissionRequest,
    ) -> Result<InvocationPermit, AdmissionError> {
        self.enqueue(&db, &request)?;
        let (mutex, wake) = &*self.signal;
        let mut signal = mutex.lock().map_err(|_| AdmissionError::Poisoned)?;
        loop {
            self.reconcile(&db)?;
            if self.try_claim(&db, &request)? {
                return Ok(InvocationPermit {
                    admission: self.clone(),
                    db,
                    id: request.id,
                    is_released: false,
                    has_bound_process: false,
                });
            }
            let waited = wake
                .wait_timeout(signal, Duration::from_millis(100))
                .map_err(|_| AdmissionError::Poisoned)?;
            signal = waited.0;
        }
    }

    fn enqueue(&self, db: &Db, request: &AdmissionRequest) -> Result<(), AdmissionError> {
        let now = crate::util::now_ms();
        let conn = db.0.lock().map_err(|_| AdmissionError::Poisoned)?;
        conn.execute(
            "INSERT OR IGNORE INTO invocation_tickets
             (id, workspace_id, session_id, workflow_run_id, agent_id, provider, provider_identity, purpose, is_heavyweight, status, owner_process_id, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 'queued', ?10, ?11, ?11)",
            params![
                request.id,
                request.workspace_id,
                request.session_id,
                request.workflow_run_id,
                request.agent_id,
                request.provider,
                request.provider_identity,
                request.purpose,
                request.is_heavyweight as i32,
                std::process::id(),
                now,
            ],
        )?;
        Ok(())
    }

    fn try_claim(&self, db: &Db, request: &AdmissionRequest) -> Result<bool, AdmissionError> {
        let mut conn = db.0.lock().map_err(|_| AdmissionError::Poisoned)?;
        let transaction = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
        let active_global: u32 = transaction.query_row(
            "SELECT COUNT(*) FROM invocation_tickets WHERE status IN ('admitted','running')",
            [],
            |row| row.get(0),
        )?;
        let active_provider: u32 = transaction.query_row(
            "SELECT COUNT(*) FROM invocation_tickets WHERE provider_identity = ?1 AND status IN ('admitted','running')",
            params![request.provider_identity],
            |row| row.get(0),
        )?;
        let active_heavyweight: u32 = transaction.query_row(
            "SELECT COUNT(*) FROM invocation_tickets WHERE provider_identity = ?1 AND is_heavyweight = 1 AND status IN ('admitted','running')",
            params![request.provider_identity],
            |row| row.get(0),
        )?;
        let has_capacity = active_global < request.limits.global.max(1)
            && active_provider < request.limits.provider.max(1)
            && (!request.is_heavyweight || active_heavyweight < request.limits.heavyweight.max(1));
        if !has_capacity {
            transaction.commit()?;
            return Ok(false);
        }
        let reservation = request.spend_reservation.as_ref();
        let (period_start, period_end) = crate::budget::current_month_window_ms();
        if let Some(reservation) = reservation {
            let budget_identity = request.provider.as_str();
            let rule = transaction
                .query_row(
                    "SELECT cap_usd FROM budget_rules WHERE provider = ?1 AND period = 'monthly' LIMIT 1",
                    params![budget_identity],
                    |row| row.get::<_, f64>(0),
                )
                .optional()?;
            if let Some(cap_usd) = rule {
                let measured_usd: f64 = transaction.query_row(
                    "SELECT COALESCE(SUM(estimated_cost_usd), 0) FROM telemetry_records
                     WHERE provider = ?1 AND recorded_at >= ?2 AND recorded_at <= ?3",
                    params![budget_identity, period_start, period_end],
                    |row| row.get(0),
                )?;
                let committed_usd: f64 = transaction.query_row(
                    "SELECT COALESCE(SUM(
                       CASE
                         WHEN ticket.reservation_status = 'reserved' THEN MAX(ticket.estimated_spend_usd - COALESCE((
                           SELECT SUM(usage.estimated_cost_usd) FROM telemetry_records usage WHERE usage.invocation_id = ticket.id
                         ), 0), 0)
                         WHEN ticket.reservation_status = 'settled' AND ticket.measurement_status = 'unknown' THEN ticket.estimated_spend_usd
                         ELSE 0
                       END
                     ), 0)
                     FROM invocation_tickets ticket
                     WHERE ticket.budget_identity = ?1
                       AND ticket.budget_period_start = ?2
                       AND ticket.budget_period_end = ?3",
                    params![budget_identity, period_start, period_end],
                    |row| row.get(0),
                )?;
                let requested_usd = reservation.estimated_spend_usd.max(0.0);
                let remaining_usd = cap_usd - measured_usd - committed_usd;
                if requested_usd > remaining_usd && !reservation.allow_over_budget {
                    transaction.execute(
                        "UPDATE invocation_tickets
                         SET status = 'released', release_reason = 'budget_refused',
                             reservation_status = 'released', released_at = ?1, updated_at = ?1
                         WHERE id = ?2 AND status = 'queued'",
                        params![crate::util::now_ms(), request.id],
                    )?;
                    transaction.commit()?;
                    return Err(AdmissionError::BudgetExceeded {
                        budget_identity: budget_identity.to_string(),
                        requested_usd,
                        remaining_usd,
                    });
                }
            }
        }
        let now = crate::util::now_ms();
        let budget_identity = reservation.map(|_| request.provider.clone());
        let estimated_spend_usd = reservation.map(|value| value.estimated_spend_usd.max(0.0));
        let reservation_status = if reservation.is_some() {
            "reserved"
        } else {
            "none"
        };
        let measurement_status = if reservation.is_some() {
            "pending"
        } else {
            "none"
        };
        let changed = transaction.execute(
            "UPDATE invocation_tickets
             SET status = 'admitted', admitted_at = ?1, updated_at = ?1,
                 budget_identity = ?2, budget_period_start = ?3, budget_period_end = ?4,
                 estimated_spend_usd = ?5, reservation_status = ?6, measurement_status = ?7
             WHERE id = ?8 AND status = 'queued'",
            params![
                now,
                budget_identity,
                period_start,
                period_end,
                estimated_spend_usd,
                reservation_status,
                measurement_status,
                request.id
            ],
        )?;
        transaction.commit()?;
        Ok(changed == 1)
    }

    pub fn reconcile(&self, db: &Db) -> Result<(), AdmissionError> {
        let conn = db.0.lock().map_err(|_| AdmissionError::Poisoned)?;
        let mut statement = conn.prepare(
            "SELECT id, process_id FROM invocation_tickets
             WHERE status IN ('admitted','running') AND owner_process_id != ?1",
        )?;
        let rows = statement.query_map(params![std::process::id()], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, Option<u32>>(1)?))
        })?;
        let stale = rows
            .filter_map(Result::ok)
            .filter(|(_, process_id)| process_id.map_or(true, |pid| !process_is_alive(pid)))
            .map(|(id, _)| id)
            .collect::<Vec<_>>();
        drop(statement);
        let now = crate::util::now_ms();
        let did_release = stale.is_empty() == false;
        for id in stale {
            settle_or_release(&conn, &id, "restart_reconcile", None, now)?;
        }
        if did_release {
            self.signal.1.notify_all();
        }
        Ok(())
    }
}

#[cfg(unix)]
pub(crate) fn process_is_alive(process_id: u32) -> bool {
    let result = unsafe { libc::kill(process_id as i32, 0) };
    result == 0 || std::io::Error::last_os_error().raw_os_error() == Some(libc::EPERM)
}

#[cfg(not(unix))]
pub(crate) fn process_is_alive(_process_id: u32) -> bool {
    true
}

impl InvocationPermit {
    pub fn bind_process(&mut self, process_id: u32) -> Result<(), AdmissionError> {
        let now = crate::util::now_ms();
        let conn = self.db.0.lock().map_err(|_| AdmissionError::Poisoned)?;
        conn.execute(
            "UPDATE invocation_tickets
             SET status = 'running', process_id = ?1, started_at = ?2, updated_at = ?2
             WHERE id = ?3 AND status = 'admitted'",
            params![process_id, now, self.id],
        )?;
        self.has_bound_process = true;
        Ok(())
    }

    pub fn release(
        &mut self,
        reason: &str,
        exit_code: Option<i32>,
    ) -> Result<bool, AdmissionError> {
        if self.is_released {
            return Ok(false);
        }
        let now = crate::util::now_ms();
        let conn = self.db.0.lock().map_err(|_| AdmissionError::Poisoned)?;
        let changed = if self.has_bound_process {
            settle_or_release(&conn, &self.id, reason, exit_code, now)?
        } else {
            conn.execute(
                "UPDATE invocation_tickets
                 SET status = 'released', exit_code = ?1, release_reason = ?2, released_at = ?3,
                     reservation_status = CASE WHEN reservation_status = 'reserved' THEN 'released' ELSE reservation_status END,
                     measurement_status = CASE WHEN measurement_status = 'pending' THEN 'none' ELSE measurement_status END,
                     reservation_settled_at = CASE WHEN reservation_status = 'reserved' THEN ?3 ELSE reservation_settled_at END,
                     updated_at = ?3
                 WHERE id = ?4 AND status != 'released'",
                params![exit_code, reason, now, self.id],
            )?
        };
        self.is_released = true;
        if changed == 1 {
            self.admission.signal.1.notify_all();
        }
        Ok(changed == 1)
    }
}

fn settle_or_release(
    conn: &rusqlite::Connection,
    id: &str,
    reason: &str,
    exit_code: Option<i32>,
    now: i64,
) -> Result<usize, rusqlite::Error> {
    let (measurement_count, measured_spend_usd): (u32, f64) = conn.query_row(
        "SELECT COUNT(*), COALESCE(SUM(estimated_cost_usd), 0)
         FROM telemetry_records WHERE invocation_id = ?1",
        params![id],
        |row| Ok((row.get(0)?, row.get(1)?)),
    )?;
    let measurement_status = if measurement_count > 0 {
        "measured"
    } else {
        "unknown"
    };
    conn.execute(
        "UPDATE invocation_tickets
         SET status = 'released', exit_code = ?1, release_reason = ?2, released_at = ?3,
             reservation_status = CASE WHEN reservation_status = 'reserved' THEN 'settled' ELSE reservation_status END,
             measurement_status = CASE WHEN reservation_status = 'reserved' THEN ?4 ELSE measurement_status END,
             measured_spend_usd = CASE WHEN reservation_status = 'reserved' AND ?5 > 0 THEN ?6 ELSE measured_spend_usd END,
             reservation_settled_at = CASE WHEN reservation_status = 'reserved' THEN ?3 ELSE reservation_settled_at END,
             updated_at = ?3
         WHERE id = ?7 AND status != 'released'",
        params![
            exit_code,
            reason,
            now,
            measurement_status,
            measurement_count,
            measured_spend_usd,
            id
        ],
    )
}

impl Drop for InvocationPermit {
    fn drop(&mut self) {
        let _ = self.release("dropped", None);
    }
}

#[cfg(test)]
mod tests {
    use std::path::PathBuf;

    use rusqlite::Connection;

    use super::*;

    fn database() -> Db {
        let connection = Connection::open_in_memory().expect("database");
        connection
            .execute_batch(
                "CREATE TABLE invocation_tickets (
                   id TEXT PRIMARY KEY,
                   workspace_id TEXT,
                   session_id TEXT,
                   workflow_run_id TEXT,
                   agent_id TEXT,
                   provider TEXT NOT NULL,
                   provider_identity TEXT NOT NULL,
                   purpose TEXT NOT NULL,
                   is_heavyweight INTEGER NOT NULL,
                   status TEXT NOT NULL,
                   process_id INTEGER,
                   exit_code INTEGER,
                   release_reason TEXT,
                   owner_process_id INTEGER NOT NULL,
                   created_at INTEGER NOT NULL,
                   admitted_at INTEGER,
                   started_at INTEGER,
                   released_at INTEGER,
                   updated_at INTEGER NOT NULL,
                   budget_identity TEXT,
                   budget_period_start INTEGER,
                   budget_period_end INTEGER,
                   estimated_spend_usd REAL,
                   measured_spend_usd REAL,
                   reservation_status TEXT NOT NULL DEFAULT 'none',
                   measurement_status TEXT NOT NULL DEFAULT 'none',
                   reservation_settled_at INTEGER
                 );
                 CREATE TABLE budget_rules (
                   id TEXT PRIMARY KEY,
                   provider TEXT NOT NULL,
                   period TEXT NOT NULL,
                   cap_usd REAL NOT NULL,
                   alert_threshold_pct REAL NOT NULL
                 );
                 CREATE TABLE telemetry_records (
                   id TEXT PRIMARY KEY,
                   provider TEXT NOT NULL,
                   estimated_cost_usd REAL NOT NULL,
                   recorded_at INTEGER NOT NULL,
                   invocation_id TEXT
                 );",
            )
            .expect("schema");
        Db(Arc::new(Mutex::new(connection)), PathBuf::new())
    }

    fn request(id: &str, identity: &str, is_heavyweight: bool) -> AdmissionRequest {
        AdmissionRequest {
            id: id.to_string(),
            workspace_id: None,
            session_id: None,
            workflow_run_id: None,
            agent_id: None,
            provider: "codex".to_string(),
            provider_identity: identity.to_string(),
            purpose: if is_heavyweight {
                "agent_turn".to_string()
            } else {
                "summarizer".to_string()
            },
            is_heavyweight,
            limits: InvocationLimits {
                global: 2,
                provider: 2,
                heavyweight: 1,
            },
            spend_reservation: None,
        }
    }

    fn status(db: &Db, id: &str) -> String {
        db.0.lock()
            .expect("lock")
            .query_row(
                "SELECT status FROM invocation_tickets WHERE id = ?1",
                params![id],
                |row| row.get(0),
            )
            .expect("status")
    }

    #[test]
    fn two_claims_for_the_final_slot_admit_exactly_one() {
        let db = database();
        let admission = InvocationAdmission::new();
        let mut first = request("one", "codex:account", false);
        first.limits.global = 1;
        let mut second = request("two", "codex:account", false);
        second.limits.global = 1;
        admission.enqueue(&db, &first).expect("enqueue first");
        admission.enqueue(&db, &second).expect("enqueue second");

        assert!(admission.try_claim(&db, &first).expect("claim first"));
        assert!(!admission.try_claim(&db, &second).expect("claim second"));
        assert_eq!(status(&db, "two"), "queued");
    }

    #[test]
    fn heavyweight_claims_serialize_per_identity() {
        let db = database();
        let admission = InvocationAdmission::new();
        let first = request("one", "codex:account", true);
        let second = request("two", "codex:account", true);
        admission.enqueue(&db, &first).expect("enqueue first");
        admission.enqueue(&db, &second).expect("enqueue second");

        assert!(admission.try_claim(&db, &first).expect("claim first"));
        assert!(!admission.try_claim(&db, &second).expect("claim second"));
    }

    #[test]
    fn provider_accounts_have_independent_identity_limits() {
        let db = database();
        let admission = InvocationAdmission::new();
        let mut first = request("one", "codex:first", false);
        first.limits.provider = 1;
        let mut second = request("two", "codex:second", false);
        second.limits.provider = 1;
        admission.enqueue(&db, &first).expect("enqueue first");
        admission.enqueue(&db, &second).expect("enqueue second");

        assert!(admission.try_claim(&db, &first).expect("claim first"));
        assert!(admission.try_claim(&db, &second).expect("claim second"));
    }

    #[test]
    fn auxiliary_claim_runs_beside_a_heavyweight_claim() {
        let db = database();
        let admission = InvocationAdmission::new();
        let heavy = request("heavy", "codex:account", true);
        let auxiliary = request("summary", "codex:account", false);
        admission.enqueue(&db, &heavy).expect("enqueue heavy");
        admission
            .enqueue(&db, &auxiliary)
            .expect("enqueue auxiliary");

        assert!(admission.try_claim(&db, &heavy).expect("claim heavy"));
        assert!(admission
            .try_claim(&db, &auxiliary)
            .expect("claim auxiliary"));
    }

    #[test]
    fn released_parent_slot_admits_a_waiting_follow_up() {
        let db = database();
        let admission = InvocationAdmission::new();
        let mut parent = request("parent", "codex:account", true);
        parent.limits.global = 1;
        let mut follow_up = request("follow-up", "codex:account", false);
        follow_up.limits.global = 1;
        admission.enqueue(&db, &parent).expect("enqueue parent");
        admission
            .enqueue(&db, &follow_up)
            .expect("enqueue follow-up");
        assert!(admission.try_claim(&db, &parent).expect("claim parent"));
        assert!(!admission
            .try_claim(&db, &follow_up)
            .expect("claim blocked follow-up"));
        let mut permit = InvocationPermit {
            admission: admission.clone(),
            db: db.clone(),
            id: parent.id,
            is_released: false,
            has_bound_process: false,
        };

        assert!(permit
            .release("completed", Some(0))
            .expect("release parent"));
        assert!(admission
            .try_claim(&db, &follow_up)
            .expect("claim follow-up"));
    }

    #[test]
    fn cancellation_releases_exactly_once() {
        let db = database();
        let admission = InvocationAdmission::new();
        let request = request("one", "codex:account", false);
        admission.enqueue(&db, &request).expect("enqueue");
        assert!(admission.try_claim(&db, &request).expect("claim"));
        let mut permit = InvocationPermit {
            admission,
            db,
            id: request.id,
            is_released: false,
            has_bound_process: false,
        };

        assert!(permit.release("cancelled", None).expect("first release"));
        assert!(!permit.release("failed", Some(1)).expect("second release"));
    }

    #[test]
    fn failed_spawn_drop_releases_exactly_once() {
        let db = database();
        let admission = InvocationAdmission::new();
        let request = request("one", "codex:account", false);
        admission.enqueue(&db, &request).expect("enqueue");
        assert!(admission.try_claim(&db, &request).expect("claim"));
        let permit = InvocationPermit {
            admission,
            db: db.clone(),
            id: request.id,
            is_released: false,
            has_bound_process: false,
        };

        drop(permit);

        assert_eq!(status(&db, "one"), "released");
    }

    #[test]
    fn non_zero_exit_releases_exactly_once() {
        let db = database();
        let admission = InvocationAdmission::new();
        let request = request("one", "codex:account", false);
        admission.enqueue(&db, &request).expect("enqueue");
        assert!(admission.try_claim(&db, &request).expect("claim"));
        let mut permit = InvocationPermit {
            admission,
            db: db.clone(),
            id: request.id,
            is_released: false,
            has_bound_process: false,
        };

        assert!(permit.release("non_zero_exit", Some(17)).expect("release"));
        assert!(!permit
            .release("non_zero_exit", Some(17))
            .expect("duplicate release"));
        assert_eq!(status(&db, "one"), "released");
    }

    #[test]
    fn restart_releases_gone_processes_and_keeps_live_processes() {
        let db = database();
        let admission = InvocationAdmission::new();
        let now = crate::util::now_ms();
        db.0.lock()
            .expect("lock")
            .execute(
                "INSERT INTO invocation_tickets
                 (id, provider, provider_identity, purpose, is_heavyweight, status, process_id, owner_process_id, created_at, updated_at)
                 VALUES ('gone', 'codex', 'codex:a', 'agent_turn', 1, 'running', 4294967294, 0, ?1, ?1),
                        ('live', 'codex', 'codex:b', 'agent_turn', 1, 'running', ?2, 0, ?1, ?1)",
                params![now, std::process::id()],
            )
            .expect("insert tickets");

        admission.reconcile(&db).expect("reconcile");

        assert_eq!(status(&db, "gone"), "released");
        assert_eq!(status(&db, "live"), "running");
    }

    fn reserving(id: &str, estimated_spend_usd: f64) -> AdmissionRequest {
        let mut request = request(id, "codex:account", false);
        request.spend_reservation = Some(SpendReservation {
            estimated_spend_usd,
            allow_over_budget: false,
        });
        request
    }

    fn cap(db: &Db, cap_usd: f64) {
        db.0.lock()
            .expect("lock")
            .execute(
                "INSERT INTO budget_rules (id, provider, period, cap_usd, alert_threshold_pct)
                 VALUES ('rule', 'codex', 'monthly', ?1, 80)",
                params![cap_usd],
            )
            .expect("budget rule");
    }

    fn reservation_of(db: &Db, id: &str) -> (String, String, Option<f64>, Option<f64>) {
        db.0.lock()
            .expect("lock")
            .query_row(
                "SELECT reservation_status, measurement_status, estimated_spend_usd, measured_spend_usd
                   FROM invocation_tickets WHERE id = ?1",
                params![id],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
            )
            .expect("reservation")
    }

    fn record_usage(db: &Db, invocation_id: &str, cost_usd: f64) {
        let (start, _) = crate::budget::current_month_window_ms();
        db.0.lock()
            .expect("lock")
            .execute(
                "INSERT INTO telemetry_records (id, provider, estimated_cost_usd, recorded_at, invocation_id)
                 VALUES (?1, 'codex', ?2, ?3, ?4)",
                params![format!("usage-{invocation_id}"), cost_usd, start + 1, invocation_id],
            )
            .expect("usage");
    }

    #[test]
    fn two_callers_competing_for_the_remaining_allowance_leave_exactly_one_reserved() {
        let db = database();
        let admission = InvocationAdmission::new();
        cap(&db, 1.0);
        let first = reserving("one", 0.8);
        let second = reserving("two", 0.8);
        admission.enqueue(&db, &first).expect("enqueue first");
        admission.enqueue(&db, &second).expect("enqueue second");

        assert!(admission.try_claim(&db, &first).expect("first claim"));
        let refused = admission
            .try_claim(&db, &second)
            .expect_err("second refused");

        assert!(matches!(refused, AdmissionError::BudgetExceeded { .. }));
        assert_eq!(reservation_of(&db, "one").0, "reserved");
        assert_eq!(reservation_of(&db, "two").0, "released");
        assert_eq!(status(&db, "two"), "released");
    }

    #[test]
    fn a_refusal_leaves_no_commitment_so_a_reroute_can_reserve_a_smaller_estimate() {
        let db = database();
        let admission = InvocationAdmission::new();
        cap(&db, 1.0);
        let refused = reserving("big", 2.0);
        admission.enqueue(&db, &refused).expect("enqueue");
        assert!(admission.try_claim(&db, &refused).is_err());

        let rerouted = reserving("small", 0.5);
        admission.enqueue(&db, &rerouted).expect("enqueue reroute");
        assert!(admission.try_claim(&db, &rerouted).expect("reroute claim"));
        assert_eq!(reservation_of(&db, "small").0, "reserved");
    }

    #[test]
    fn a_launch_that_never_happened_releases_its_reservation() {
        let db = database();
        let admission = InvocationAdmission::new();
        cap(&db, 10.0);
        let request = reserving("never", 1.0);
        admission.enqueue(&db, &request).expect("enqueue");
        assert!(admission.try_claim(&db, &request).expect("claim"));
        let mut permit = InvocationPermit {
            admission: admission.clone(),
            db: db.clone(),
            id: request.id.clone(),
            is_released: false,
            has_bound_process: false,
        };

        assert!(permit.release("spawn_failed", None).expect("release"));

        let (reservation_status, measurement_status, _, _) = reservation_of(&db, "never");
        assert_eq!(reservation_status, "released");
        assert_eq!(measurement_status, "none");
    }

    #[test]
    fn settlement_uses_real_usage_when_it_arrives_and_stays_conservative_when_it_does_not() {
        let db = database();
        let admission = InvocationAdmission::new();
        cap(&db, 10.0);
        let measured = reserving("measured", 1.0);
        let silent = reserving("silent", 1.0);
        admission.enqueue(&db, &measured).expect("enqueue measured");
        admission.enqueue(&db, &silent).expect("enqueue silent");
        assert!(admission.try_claim(&db, &measured).expect("claim measured"));
        assert!(admission.try_claim(&db, &silent).expect("claim silent"));
        record_usage(&db, "measured", 0.25);
        let mut measured_permit = InvocationPermit {
            admission: admission.clone(),
            db: db.clone(),
            id: measured.id.clone(),
            is_released: false,
            has_bound_process: true,
        };
        let mut silent_permit = InvocationPermit {
            admission: admission.clone(),
            db: db.clone(),
            id: silent.id.clone(),
            is_released: false,
            has_bound_process: true,
        };

        assert!(measured_permit
            .release("completed", Some(0))
            .expect("settle measured"));
        assert!(silent_permit
            .release("completed", Some(0))
            .expect("settle silent"));

        let settled = reservation_of(&db, "measured");
        assert_eq!(settled.0, "settled");
        assert_eq!(settled.1, "measured");
        assert_eq!(settled.2, Some(1.0));
        assert_eq!(settled.3, Some(0.25));
        let unknown = reservation_of(&db, "silent");
        assert_eq!(unknown.0, "settled");
        assert_eq!(unknown.1, "unknown");
        assert_eq!(unknown.3, None);
    }

    #[test]
    fn an_unknown_settlement_keeps_committing_its_estimate_against_the_cap() {
        let db = database();
        let admission = InvocationAdmission::new();
        cap(&db, 1.0);
        let silent = reserving("silent", 0.9);
        admission.enqueue(&db, &silent).expect("enqueue");
        assert!(admission.try_claim(&db, &silent).expect("claim"));
        let mut permit = InvocationPermit {
            admission: admission.clone(),
            db: db.clone(),
            id: silent.id.clone(),
            is_released: false,
            has_bound_process: true,
        };
        assert!(permit.release("completed", Some(0)).expect("settle"));

        let next = reserving("next", 0.5);
        admission.enqueue(&db, &next).expect("enqueue next");

        assert!(matches!(
            admission.try_claim(&db, &next).expect_err("refused"),
            AdmissionError::BudgetExceeded { .. }
        ));
    }
}
