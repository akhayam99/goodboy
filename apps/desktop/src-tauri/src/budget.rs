use serde::{Deserialize, Serialize};
use tauri::State;

use crate::db::{Db, DbError};

#[derive(Debug, Serialize, Deserialize)]
pub struct BudgetRule {
    pub id: String,
    pub provider: String,
    pub period: String,
    #[serde(rename = "capUsd")]
    pub cap_usd: f64,
    #[serde(rename = "alertThresholdPct")]
    pub alert_threshold_pct: f64,
    #[serde(rename = "extraTokensBudget")]
    pub extra_tokens_budget: Option<i64>,
    #[serde(rename = "createdAt")]
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SessionBudget {
    #[serde(rename = "sessionId")]
    pub session_id: String,
    #[serde(rename = "softCapUsd")]
    pub soft_cap_usd: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BudgetAlert {
    pub id: String,
    pub kind: String,
    pub provider: Option<String>,
    #[serde(rename = "sessionId")]
    pub session_id: Option<String>,
    #[serde(rename = "currentUsd")]
    pub current_usd: f64,
    #[serde(rename = "capUsd")]
    pub cap_usd: f64,
    #[serde(rename = "createdAt")]
    pub created_at: String,
    #[serde(rename = "dismissedAt")]
    pub dismissed_at: Option<String>,
}

#[tauri::command]
pub fn budget_rule_upsert(state: State<'_, Db>, rule: BudgetRule) -> Result<(), DbError> {
    let conn = state.0.lock().map_err(|_| DbError::Poisoned)?;
    conn.execute(
        "INSERT INTO budget_rules (id, provider, period, cap_usd, alert_threshold_pct, extra_tokens_budget, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
         ON CONFLICT(id) DO UPDATE SET
           provider = excluded.provider,
           period = excluded.period,
           cap_usd = excluded.cap_usd,
           alert_threshold_pct = excluded.alert_threshold_pct,
           extra_tokens_budget = excluded.extra_tokens_budget",
        rusqlite::params![
            rule.id,
            rule.provider,
            rule.period,
            rule.cap_usd,
            rule.alert_threshold_pct,
            rule.extra_tokens_budget,
            rule.created_at,
        ],
    )?;
    Ok(())
}

#[tauri::command]
pub fn budget_rule_list(state: State<'_, Db>) -> Result<Vec<BudgetRule>, DbError> {
    let conn = state.0.lock().map_err(|_| DbError::Poisoned)?;
    let mut stmt = conn.prepare(
        "SELECT id, provider, period, cap_usd, alert_threshold_pct, extra_tokens_budget, created_at FROM budget_rules",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(BudgetRule {
            id: row.get(0)?,
            provider: row.get(1)?,
            period: row.get(2)?,
            cap_usd: row.get(3)?,
            alert_threshold_pct: row.get(4)?,
            extra_tokens_budget: row.get(5)?,
            created_at: row.get(6)?,
        })
    })?;
    rows.collect::<Result<Vec<_>, _>>().map_err(DbError::Sqlite)
}

#[tauri::command]
pub fn budget_rule_delete(state: State<'_, Db>, id: String) -> Result<(), DbError> {
    let conn = state.0.lock().map_err(|_| DbError::Poisoned)?;
    conn.execute(
        "DELETE FROM budget_rules WHERE id = ?1",
        rusqlite::params![id],
    )?;
    Ok(())
}

#[tauri::command]
pub fn session_budget_set(
    state: State<'_, Db>,
    session_id: String,
    soft_cap_usd: f64,
) -> Result<(), DbError> {
    let conn = state.0.lock().map_err(|_| DbError::Poisoned)?;
    conn.execute(
        "INSERT INTO session_budgets (session_id, soft_cap_usd)
         VALUES (?1, ?2)
         ON CONFLICT(session_id) DO UPDATE SET soft_cap_usd = excluded.soft_cap_usd",
        rusqlite::params![session_id, soft_cap_usd],
    )?;
    Ok(())
}

#[tauri::command]
pub fn session_budget_get(
    state: State<'_, Db>,
    session_id: String,
) -> Result<Option<SessionBudget>, DbError> {
    let conn = state.0.lock().map_err(|_| DbError::Poisoned)?;
    let mut stmt =
        conn.prepare("SELECT session_id, soft_cap_usd FROM session_budgets WHERE session_id = ?1")?;
    let mut rows = stmt.query_map(rusqlite::params![session_id], |row| {
        Ok(SessionBudget {
            session_id: row.get(0)?,
            soft_cap_usd: row.get(1)?,
        })
    })?;
    match rows.next() {
        Some(row) => Ok(Some(row.map_err(DbError::Sqlite)?)),
        None => Ok(None),
    }
}

#[tauri::command]
pub fn budget_alerts_list(state: State<'_, Db>) -> Result<Vec<BudgetAlert>, DbError> {
    let conn = state.0.lock().map_err(|_| DbError::Poisoned)?;
    let mut stmt = conn.prepare(
        "SELECT id, kind, provider, session_id, current_usd, cap_usd, created_at, dismissed_at
         FROM budget_alerts
         WHERE dismissed_at IS NULL",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(BudgetAlert {
            id: row.get(0)?,
            kind: row.get(1)?,
            provider: row.get(2)?,
            session_id: row.get(3)?,
            current_usd: row.get(4)?,
            cap_usd: row.get(5)?,
            created_at: row.get(6)?,
            dismissed_at: row.get(7)?,
        })
    })?;
    rows.collect::<Result<Vec<_>, _>>().map_err(DbError::Sqlite)
}

#[tauri::command]
pub fn budget_alert_dismiss(state: State<'_, Db>, id: String) -> Result<(), DbError> {
    let conn = state.0.lock().map_err(|_| DbError::Poisoned)?;
    conn.execute(
        "UPDATE budget_alerts SET dismissed_at = datetime('now') WHERE id = ?1",
        rusqlite::params![id],
    )?;
    Ok(())
}

#[derive(Debug, Serialize)]
pub struct BudgetCheckResult {
    #[serde(rename = "remainingUsd")]
    pub remaining_usd: f64,
    pub pct: f64,
    pub exceeded: bool,
}

fn current_month_window_ms() -> (i64, i64) {
    use std::time::{SystemTime, UNIX_EPOCH};
    let now_ms = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system clock before epoch")
        .as_millis() as i64;

    // Days elapsed in epoch ÷ average — use integer arithmetic to find month boundaries.
    // Convert ms → seconds for easier calculation.
    let now_s = now_ms / 1000;
    // Approximate: find year+month via days since epoch.
    // Use a simple loop: count years/months from 1970.
    let (year, month) = crate::util::epoch_seconds_to_year_month(now_s);

    let start_ms = crate::util::ymd_to_epoch_ms(year, month, 1);
    let (ny, nm) = if month == 12 {
        (year + 1, 1)
    } else {
        (year, month + 1)
    };
    let end_ms = crate::util::ymd_to_epoch_ms(ny, nm, 1) - 1;

    (start_ms, end_ms)
}

#[derive(Debug, Serialize, Deserialize)]
pub struct EmitAlertsInput {
    pub provider: String,
    #[serde(rename = "sessionId")]
    pub session_id: String,
}

#[tauri::command]
pub fn budget_emit_alerts(
    state: State<'_, Db>,
    input: EmitAlertsInput,
) -> Result<Vec<BudgetAlert>, DbError> {
    let conn = state.0.lock().map_err(|_| DbError::Poisoned)?;
    let now = crate::util::iso_now();
    let period = "monthly";
    let provider = &input.provider;
    let session_id = &input.session_id;

    // --- provider budget check ---
    let provider_rule: Option<(String, f64, f64)> = {
        let mut stmt = conn.prepare(
            "SELECT id, cap_usd, alert_threshold_pct FROM budget_rules WHERE provider = ?1 AND period = ?2 LIMIT 1",
        )?;
        let mut rows = stmt.query_map(rusqlite::params![provider, period], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, f64>(1)?,
                row.get::<_, f64>(2)?,
            ))
        })?;
        match rows.next() {
            Some(r) => Some(r.map_err(DbError::Sqlite)?),
            None => None,
        }
    };

    let (start_ms, end_ms) = current_month_window_ms();

    let mut created: Vec<BudgetAlert> = Vec::new();

    if let Some((_rule_id, cap_usd, threshold_pct)) = provider_rule {
        let spent: f64 = conn.query_row(
            "SELECT COALESCE(SUM(estimated_cost_usd), 0) FROM telemetry_records
              WHERE provider = ?1 AND recorded_at >= ?2 AND recorded_at <= ?3",
            rusqlite::params![provider, start_ms, end_ms],
            |row| row.get(0),
        )?;

        let pct = if cap_usd > 0.0 {
            (spent / cap_usd) * 100.0
        } else {
            0.0
        };

        let alert_kind: Option<&str> = if pct >= 100.0 {
            Some("provider-exceeded")
        } else if pct >= threshold_pct {
            Some("provider-threshold")
        } else {
            None
        };

        if let Some(kind) = alert_kind {
            let already: i64 = conn.query_row(
                "SELECT COUNT(*) FROM budget_alerts WHERE kind = ?1 AND provider = ?2 AND dismissed_at IS NULL",
                rusqlite::params![kind, provider],
                |row| row.get(0),
            )?;
            if already == 0 {
                let id = crate::util::uuid_v4();
                conn.execute(
                    "INSERT INTO budget_alerts (id, kind, provider, session_id, current_usd, cap_usd, created_at, dismissed_at)
                     VALUES (?1, ?2, ?3, NULL, ?4, ?5, ?6, NULL)",
                    rusqlite::params![id, kind, provider, spent, cap_usd, now],
                )?;
                created.push(BudgetAlert {
                    id,
                    kind: kind.to_string(),
                    provider: Some(provider.clone()),
                    session_id: None,
                    current_usd: spent,
                    cap_usd,
                    created_at: now.clone(),
                    dismissed_at: None,
                });
            }
        }
    }

    // --- session budget check ---
    let session_cap: Option<f64> = {
        let mut stmt =
            conn.prepare("SELECT soft_cap_usd FROM session_budgets WHERE session_id = ?1 LIMIT 1")?;
        let mut rows = stmt.query_map(rusqlite::params![session_id], |row| row.get(0))?;
        match rows.next() {
            Some(r) => Some(r.map_err(DbError::Sqlite)?),
            None => None,
        }
    };

    if let Some(cap_usd) = session_cap {
        let spent: f64 = conn.query_row(
            "SELECT COALESCE(SUM(estimated_cost_usd), 0) FROM telemetry_records WHERE session_id = ?1",
            rusqlite::params![session_id],
            |row| row.get(0),
        )?;

        let pct = if cap_usd > 0.0 {
            (spent / cap_usd) * 100.0
        } else {
            0.0
        };

        let alert_kind: Option<&str> = if pct >= 100.0 {
            Some("session-exceeded")
        } else if pct >= 80.0 {
            Some("session-threshold")
        } else {
            None
        };

        if let Some(kind) = alert_kind {
            let already: i64 = conn.query_row(
                "SELECT COUNT(*) FROM budget_alerts WHERE kind = ?1 AND session_id = ?2 AND dismissed_at IS NULL",
                rusqlite::params![kind, session_id],
                |row| row.get(0),
            )?;
            if already == 0 {
                let id = crate::util::uuid_v4();
                conn.execute(
                    "INSERT INTO budget_alerts (id, kind, provider, session_id, current_usd, cap_usd, created_at, dismissed_at)
                     VALUES (?1, ?2, NULL, ?3, ?4, ?5, ?6, NULL)",
                    rusqlite::params![id, kind, session_id, spent, cap_usd, now],
                )?;
                created.push(BudgetAlert {
                    id,
                    kind: kind.to_string(),
                    provider: None,
                    session_id: Some(session_id.clone()),
                    current_usd: spent,
                    cap_usd,
                    created_at: now.clone(),
                    dismissed_at: None,
                });
            }
        }
    }

    Ok(created)
}

#[tauri::command]
pub fn check_provider_budget(
    state: State<'_, Db>,
    provider: String,
    period: String,
) -> Result<BudgetCheckResult, DbError> {
    let conn = state.0.lock().map_err(|_| DbError::Poisoned)?;

    let rule: Option<(f64,)> = {
        let mut stmt = conn.prepare(
            "SELECT cap_usd FROM budget_rules WHERE provider = ?1 AND period = ?2 LIMIT 1",
        )?;
        let mut rows = stmt.query_map(rusqlite::params![provider, period], |row| {
            Ok((row.get::<_, f64>(0)?,))
        })?;
        match rows.next() {
            Some(r) => Some(r.map_err(DbError::Sqlite)?),
            None => None,
        }
    };

    let Some((cap_usd,)) = rule else {
        return Ok(BudgetCheckResult {
            remaining_usd: f64::INFINITY,
            pct: 0.0,
            exceeded: false,
        });
    };

    let (start_ms, end_ms) = current_month_window_ms();

    let spent: f64 = conn.query_row(
        "SELECT COALESCE(SUM(estimated_cost_usd), 0) FROM telemetry_records
          WHERE provider = ?1 AND recorded_at >= ?2 AND recorded_at <= ?3",
        rusqlite::params![provider, start_ms, end_ms],
        |row| row.get(0),
    )?;

    let remaining = cap_usd - spent;
    let pct = if cap_usd > 0.0 {
        (spent / cap_usd) * 100.0
    } else {
        0.0
    };

    Ok(BudgetCheckResult {
        remaining_usd: remaining,
        pct,
        exceeded: spent > cap_usd,
    })
}

#[tauri::command]
pub fn check_session_budget(
    state: State<'_, Db>,
    session_id: String,
) -> Result<BudgetCheckResult, DbError> {
    let conn = state.0.lock().map_err(|_| DbError::Poisoned)?;

    let cap: Option<f64> = {
        let mut stmt =
            conn.prepare("SELECT soft_cap_usd FROM session_budgets WHERE session_id = ?1 LIMIT 1")?;
        let mut rows = stmt.query_map(rusqlite::params![session_id], |row| row.get(0))?;
        match rows.next() {
            Some(r) => Some(r.map_err(DbError::Sqlite)?),
            None => None,
        }
    };

    let Some(cap_usd) = cap else {
        return Ok(BudgetCheckResult {
            remaining_usd: f64::INFINITY,
            pct: 0.0,
            exceeded: false,
        });
    };

    let spent: f64 = conn.query_row(
        "SELECT COALESCE(SUM(estimated_cost_usd), 0) FROM telemetry_records WHERE session_id = ?1",
        rusqlite::params![session_id],
        |row| row.get(0),
    )?;

    let remaining = cap_usd - spent;
    let pct = if cap_usd > 0.0 {
        (spent / cap_usd) * 100.0
    } else {
        0.0
    };

    Ok(BudgetCheckResult {
        remaining_usd: remaining,
        pct,
        exceeded: spent > cap_usd,
    })
}
