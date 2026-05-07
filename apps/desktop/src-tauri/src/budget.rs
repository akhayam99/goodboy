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
        "INSERT INTO budget_rules (id, provider, period, cap_usd, alert_threshold_pct, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)
         ON CONFLICT(id) DO UPDATE SET
           provider = excluded.provider,
           period = excluded.period,
           cap_usd = excluded.cap_usd,
           alert_threshold_pct = excluded.alert_threshold_pct",
        rusqlite::params![
            rule.id,
            rule.provider,
            rule.period,
            rule.cap_usd,
            rule.alert_threshold_pct,
            rule.created_at,
        ],
    )?;
    Ok(())
}

#[tauri::command]
pub fn budget_rule_list(state: State<'_, Db>) -> Result<Vec<BudgetRule>, DbError> {
    let conn = state.0.lock().map_err(|_| DbError::Poisoned)?;
    let mut stmt = conn.prepare(
        "SELECT id, provider, period, cap_usd, alert_threshold_pct, created_at FROM budget_rules",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(BudgetRule {
            id: row.get(0)?,
            provider: row.get(1)?,
            period: row.get(2)?,
            cap_usd: row.get(3)?,
            alert_threshold_pct: row.get(4)?,
            created_at: row.get(5)?,
        })
    })?;
    rows.collect::<Result<Vec<_>, _>>().map_err(DbError::Sqlite)
}

#[tauri::command]
pub fn budget_rule_delete(state: State<'_, Db>, id: String) -> Result<(), DbError> {
    let conn = state.0.lock().map_err(|_| DbError::Poisoned)?;
    conn.execute("DELETE FROM budget_rules WHERE id = ?1", rusqlite::params![id])?;
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
