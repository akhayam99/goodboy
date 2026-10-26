use serde::{Deserialize, Serialize};
use tauri::State;

use crate::db::{Db, DbError};

mod standing;

use standing::{classify_spend, spend_pct, SpendClock, Standing, SESSION_WARN_PCT};

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BudgetRule {
    pub id: String,
    pub provider: String,
    pub period: String,
    pub cap_usd: f64,
    pub alert_threshold_pct: f64,
    pub extra_tokens_budget: Option<i64>,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionBudget {
    pub session_id: String,
    pub soft_cap_usd: f64,
    pub on_exceed: String,
    pub warn_ratio: f64,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BudgetAlert {
    pub id: String,
    pub kind: String,
    pub provider: Option<String>,
    pub session_id: Option<String>,
    pub current_usd: f64,
    pub cap_usd: f64,
    pub created_at: String,
    pub dismissed_at: Option<String>,
}

fn require_positive_cap(cap_usd: f64) -> Result<(), DbError> {
    if cap_usd.is_finite() && cap_usd > 0.0 {
        return Ok(());
    }
    Err(DbError::InvalidSpendCap)
}

#[tauri::command]
pub async fn budget_rule_upsert(state: State<'_, Db>, rule: BudgetRule) -> Result<(), DbError> {
    require_positive_cap(rule.cap_usd)?;
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
            crate::util::iso_to_ms(&rule.created_at).unwrap_or_else(crate::util::now_ms),
        ],
    )?;
    Ok(())
}

#[tauri::command]
pub async fn budget_rule_list(state: State<'_, Db>) -> Result<Vec<BudgetRule>, DbError> {
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
            created_at: crate::util::ms_to_iso(row.get(6)?),
        })
    })?;
    rows.collect::<Result<Vec<_>, _>>().map_err(DbError::Sqlite)
}

#[tauri::command]
pub async fn budget_rule_delete(state: State<'_, Db>, id: String) -> Result<(), DbError> {
    let conn = state.0.lock().map_err(|_| DbError::Poisoned)?;
    conn.execute(
        "DELETE FROM budget_rules WHERE id = ?1",
        rusqlite::params![id],
    )?;
    Ok(())
}

fn session_on_exceed(on_exceed: Option<String>) -> &'static str {
    match on_exceed.as_deref() {
        Some("warn") => "warn",
        _ => "pause",
    }
}

fn session_warn_ratio() -> f64 {
    SESSION_WARN_PCT / 100.0
}

fn write_session_budget(
    conn: &rusqlite::Connection,
    session_id: &str,
    soft_cap_usd: f64,
    on_exceed: Option<String>,
) -> Result<SessionBudget, DbError> {
    require_positive_cap(soft_cap_usd)?;
    let on_exceed = session_on_exceed(on_exceed);
    conn.execute(
        "INSERT INTO session_budgets (session_id, soft_cap_usd, on_exceed)
         VALUES (?1, ?2, ?3)
         ON CONFLICT(session_id) DO UPDATE SET
           soft_cap_usd = excluded.soft_cap_usd,
           on_exceed = excluded.on_exceed",
        rusqlite::params![session_id, soft_cap_usd, on_exceed],
    )?;
    Ok(SessionBudget {
        session_id: session_id.to_string(),
        soft_cap_usd,
        on_exceed: on_exceed.to_string(),
        warn_ratio: session_warn_ratio(),
    })
}

fn read_session_budget(
    conn: &rusqlite::Connection,
    session_id: &str,
) -> Result<Option<SessionBudget>, DbError> {
    let mut stmt = conn.prepare(
        "SELECT session_id, soft_cap_usd, on_exceed FROM session_budgets WHERE session_id = ?1",
    )?;
    let mut rows = stmt.query_map(rusqlite::params![session_id], |row| {
        Ok(SessionBudget {
            session_id: row.get(0)?,
            soft_cap_usd: row.get(1)?,
            on_exceed: row.get(2)?,
            warn_ratio: session_warn_ratio(),
        })
    })?;
    match rows.next() {
        Some(row) => Ok(Some(row.map_err(DbError::Sqlite)?)),
        None => Ok(None),
    }
}

fn clear_session_budget(conn: &rusqlite::Connection, session_id: &str) -> Result<(), DbError> {
    conn.execute(
        "DELETE FROM session_budgets WHERE session_id = ?1",
        rusqlite::params![session_id],
    )?;
    conn.execute(
        "UPDATE budget_alerts SET dismissed_at = ?2
         WHERE session_id = ?1 AND dismissed_at IS NULL",
        rusqlite::params![session_id, crate::util::now_ms()],
    )?;
    Ok(())
}

#[tauri::command]
pub async fn session_budget_set(
    state: State<'_, Db>,
    session_id: String,
    soft_cap_usd: f64,
    on_exceed: Option<String>,
) -> Result<SessionBudget, DbError> {
    let conn = state.0.lock().map_err(|_| DbError::Poisoned)?;
    write_session_budget(&conn, &session_id, soft_cap_usd, on_exceed)
}

#[tauri::command]
pub async fn session_budget_get(
    state: State<'_, Db>,
    session_id: String,
) -> Result<Option<SessionBudget>, DbError> {
    let conn = state.0.lock().map_err(|_| DbError::Poisoned)?;
    read_session_budget(&conn, &session_id)
}

#[tauri::command]
pub async fn session_budget_clear(state: State<'_, Db>, session_id: String) -> Result<(), DbError> {
    let conn = state.0.lock().map_err(|_| DbError::Poisoned)?;
    clear_session_budget(&conn, &session_id)
}

#[tauri::command]
pub async fn budget_alerts_list(state: State<'_, Db>) -> Result<Vec<BudgetAlert>, DbError> {
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
            created_at: crate::util::ms_to_iso(row.get(6)?),
            dismissed_at: crate::util::optional_ms_to_iso(row.get(7)?),
        })
    })?;
    rows.collect::<Result<Vec<_>, _>>().map_err(DbError::Sqlite)
}

#[tauri::command]
pub async fn budget_alert_dismiss(state: State<'_, Db>, id: String) -> Result<(), DbError> {
    let conn = state.0.lock().map_err(|_| DbError::Poisoned)?;
    conn.execute(
        "UPDATE budget_alerts SET dismissed_at = ?2 WHERE id = ?1",
        rusqlite::params![id, crate::util::now_ms()],
    )?;
    Ok(())
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BudgetCheckResult {
    pub remaining_usd: f64,
    pub pct: f64,
    pub exceeded: bool,
    pub over_threshold: bool,
    pub spent_usd: f64,
    pub cap_usd: Option<f64>,
    pub threshold_pct: Option<f64>,
    pub window_start_ms: i64,
    pub window_end_ms: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderSpendPeriods {
    pub today_usd: f64,
    pub last_7_days_usd: f64,
    pub this_month_usd: f64,
}

#[derive(Debug, Serialize)]
pub struct ProviderBudgetOverview {
    pub status: BudgetCheckResult,
    pub periods: ProviderSpendPeriods,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EmitAlertsInput {
    pub provider: String,
    pub session_id: String,
    pub utc_offset_minutes: i32,
}

#[tauri::command]
pub async fn budget_emit_alerts(
    state: State<'_, Db>,
    input: EmitAlertsInput,
) -> Result<Vec<BudgetAlert>, DbError> {
    let conn = state.0.lock().map_err(|_| DbError::Poisoned)?;
    emit_alerts_at(
        &conn,
        &input.provider,
        &input.session_id,
        SpendClock::now(input.utc_offset_minutes),
    )
}

fn emit_alerts_at(
    conn: &rusqlite::Connection,
    provider: &str,
    session_id: &str,
    clock: SpendClock,
) -> Result<Vec<BudgetAlert>, DbError> {
    let now_ms = clock.now_ms;
    let now = crate::util::ms_to_iso(now_ms);
    let period = "monthly";

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

    let (start_ms, end_ms) = clock.month_window_ms();

    let mut created: Vec<BudgetAlert> = Vec::new();

    if let Some((_rule_id, cap_usd, threshold_pct)) = provider_rule {
        let spent = provider_spend_between(conn, provider, start_ms, end_ms)?;

        let alert_kind: Option<&str> = match classify_spend(spent, cap_usd, threshold_pct) {
            Standing::Over => Some("provider-exceeded"),
            Standing::Near => Some("provider-threshold"),
            Standing::Clear => None,
        };

        if let Some(kind) = alert_kind {
            dismiss_provider_alerts_before(conn, provider, start_ms, now_ms)?;
            if !has_open_provider_alert(conn, kind, provider, start_ms)? {
                let id = crate::util::uuid_v4();
                conn.execute(
                    "INSERT INTO budget_alerts (id, kind, provider, session_id, current_usd, cap_usd, created_at, dismissed_at)
                     VALUES (?1, ?2, ?3, NULL, ?4, ?5, ?6, NULL)",
                    rusqlite::params![id, kind, provider, spent, cap_usd, now_ms],
                )?;
                created.push(BudgetAlert {
                    id,
                    kind: kind.to_string(),
                    provider: Some(provider.to_string()),
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

        let alert_kind: Option<&str> = match classify_spend(spent, cap_usd, SESSION_WARN_PCT) {
            Standing::Over => Some("session-exceeded"),
            Standing::Near => Some("session-threshold"),
            Standing::Clear => None,
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
                    rusqlite::params![id, kind, session_id, spent, cap_usd, now_ms],
                )?;
                created.push(BudgetAlert {
                    id,
                    kind: kind.to_string(),
                    provider: None,
                    session_id: Some(session_id.to_string()),
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

fn has_open_provider_alert(
    conn: &rusqlite::Connection,
    kind: &str,
    provider: &str,
    month_start_ms: i64,
) -> Result<bool, DbError> {
    let open: i64 = conn.query_row(
        "SELECT COUNT(*) FROM budget_alerts
          WHERE kind = ?1 AND provider = ?2 AND dismissed_at IS NULL AND created_at >= ?3",
        rusqlite::params![kind, provider, month_start_ms],
        |row| row.get(0),
    )?;
    Ok(open > 0)
}

fn dismiss_provider_alerts_before(
    conn: &rusqlite::Connection,
    provider: &str,
    month_start_ms: i64,
    now_ms: i64,
) -> Result<usize, DbError> {
    conn.execute(
        "UPDATE budget_alerts SET dismissed_at = ?3
          WHERE provider = ?1 AND kind LIKE 'provider-%'
            AND dismissed_at IS NULL AND created_at < ?2",
        rusqlite::params![provider, month_start_ms, now_ms],
    )
    .map_err(DbError::Sqlite)
}

fn provider_spend_between(
    conn: &rusqlite::Connection,
    provider: &str,
    start_ms: i64,
    end_ms: i64,
) -> Result<f64, DbError> {
    conn.query_row(
        "SELECT COALESCE(SUM(estimated_cost_usd), 0) FROM telemetry_records
          WHERE provider = ?1 AND recorded_at >= ?2 AND recorded_at <= ?3",
        rusqlite::params![provider, start_ms, end_ms],
        |row| row.get(0),
    )
    .map_err(DbError::Sqlite)
}

fn provider_budget_status(
    conn: &rusqlite::Connection,
    provider: &str,
    period: &str,
    clock: SpendClock,
) -> Result<BudgetCheckResult, DbError> {
    let rule: Option<(f64, f64)> = {
        let mut stmt = conn.prepare(
            "SELECT cap_usd, alert_threshold_pct FROM budget_rules WHERE provider = ?1 AND period = ?2 LIMIT 1",
        )?;
        let mut rows = stmt.query_map(rusqlite::params![provider, period], |row| {
            Ok((row.get::<_, f64>(0)?, row.get::<_, f64>(1)?))
        })?;
        match rows.next() {
            Some(r) => Some(r.map_err(DbError::Sqlite)?),
            None => None,
        }
    };

    let (start_ms, end_ms) = clock.month_window_ms();
    let spent = provider_spend_between(conn, provider, start_ms, end_ms)?;

    let Some((cap_usd, threshold_pct)) = rule else {
        return Ok(BudgetCheckResult {
            remaining_usd: f64::INFINITY,
            pct: 0.0,
            exceeded: false,
            over_threshold: false,
            spent_usd: spent,
            cap_usd: None,
            threshold_pct: None,
            window_start_ms: start_ms,
            window_end_ms: end_ms,
        });
    };

    let remaining = cap_usd - spent;
    let pct = spend_pct(spent, cap_usd);
    let standing = classify_spend(spent, cap_usd, threshold_pct);

    Ok(BudgetCheckResult {
        remaining_usd: remaining,
        pct,
        exceeded: standing == Standing::Over,
        over_threshold: standing == Standing::Near,
        spent_usd: spent,
        cap_usd: Some(cap_usd),
        threshold_pct: Some(threshold_pct),
        window_start_ms: start_ms,
        window_end_ms: end_ms,
    })
}

fn provider_budget_overview_at(
    conn: &rusqlite::Connection,
    provider: &str,
    today_start_ms: i64,
    week_start_ms: i64,
    clock: SpendClock,
) -> Result<ProviderBudgetOverview, DbError> {
    let status = provider_budget_status(conn, provider, "monthly", clock)?;
    let (today_usd, last_7_days_usd) = conn.query_row(
        "SELECT
           COALESCE(SUM(CASE WHEN recorded_at >= ?2 THEN estimated_cost_usd END), 0),
           COALESCE(SUM(CASE WHEN recorded_at >= ?3 THEN estimated_cost_usd END), 0)
           FROM telemetry_records
          WHERE provider = ?1 AND recorded_at >= ?4",
        rusqlite::params![
            provider,
            today_start_ms,
            week_start_ms,
            today_start_ms.min(week_start_ms)
        ],
        |row| Ok((row.get::<_, f64>(0)?, row.get::<_, f64>(1)?)),
    )?;
    let this_month_usd = status.spent_usd;
    Ok(ProviderBudgetOverview {
        status,
        periods: ProviderSpendPeriods {
            today_usd,
            last_7_days_usd,
            this_month_usd,
        },
    })
}

#[tauri::command]
pub async fn check_provider_budget(
    state: State<'_, Db>,
    provider: String,
    period: String,
    utc_offset_minutes: i32,
) -> Result<BudgetCheckResult, DbError> {
    let conn = state.0.lock().map_err(|_| DbError::Poisoned)?;
    provider_budget_status(
        &conn,
        &provider,
        &period,
        SpendClock::now(utc_offset_minutes),
    )
}

#[tauri::command]
pub async fn provider_budget_overview(
    state: State<'_, Db>,
    provider: String,
    today_start_ms: i64,
    week_start_ms: i64,
    utc_offset_minutes: i32,
) -> Result<ProviderBudgetOverview, DbError> {
    let conn = state.0.lock().map_err(|_| DbError::Poisoned)?;
    provider_budget_overview_at(
        &conn,
        &provider,
        today_start_ms,
        week_start_ms,
        SpendClock::now(utc_offset_minutes),
    )
}

#[cfg(test)]
mod wire_shape;

#[cfg(test)]
mod tests {
    use super::*;

    fn fixed_clock() -> SpendClock {
        SpendClock::at(crate::util::ymd_to_epoch_ms(2026, 10, 15), 0)
    }

    fn budget_conn() -> rusqlite::Connection {
        let conn = rusqlite::Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE budget_rules (
                id TEXT PRIMARY KEY, provider TEXT, period TEXT,
                cap_usd REAL, alert_threshold_pct REAL
            );
            CREATE TABLE telemetry_records (
                id TEXT PRIMARY KEY, provider TEXT, estimated_cost_usd REAL, recorded_at INTEGER
            );",
        )
        .unwrap();
        conn
    }

    fn insert_rule(conn: &rusqlite::Connection, cap_usd: f64, threshold_pct: f64) {
        conn.execute(
            "INSERT INTO budget_rules (id, provider, period, cap_usd, alert_threshold_pct)
             VALUES ('r1', 'anthropic', 'monthly', ?1, ?2)",
            rusqlite::params![cap_usd, threshold_pct],
        )
        .unwrap();
    }

    fn insert_spend(conn: &rusqlite::Connection, id: &str, cost_usd: f64) {
        let (start_ms, _) = fixed_clock().month_window_ms();
        conn.execute(
            "INSERT INTO telemetry_records (id, provider, estimated_cost_usd, recorded_at)
             VALUES (?1, 'anthropic', ?2, ?3)",
            rusqlite::params![id, cost_usd, start_ms],
        )
        .unwrap();
    }

    fn session_budget_conn() -> rusqlite::Connection {
        let conn = rusqlite::Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE session_budgets (
                session_id TEXT PRIMARY KEY, soft_cap_usd REAL NOT NULL,
                on_exceed TEXT NOT NULL DEFAULT 'pause' CHECK (on_exceed IN ('pause', 'warn'))
            );
            CREATE TABLE budget_alerts (
                id TEXT PRIMARY KEY, kind TEXT, provider TEXT, session_id TEXT,
                current_usd REAL, cap_usd REAL, created_at INTEGER, dismissed_at INTEGER
            );",
        )
        .unwrap();
        conn
    }

    #[test]
    fn a_session_limit_keeps_what_happens_when_it_is_passed() {
        let conn = session_budget_conn();
        write_session_budget(&conn, "s1", 10.0, Some("warn".to_string())).unwrap();

        let budget = read_session_budget(&conn, "s1").unwrap().unwrap();
        assert_eq!(budget.soft_cap_usd, 10.0);
        assert_eq!(budget.on_exceed, "warn");

        write_session_budget(&conn, "s1", 12.0, None).unwrap();
        let budget = read_session_budget(&conn, "s1").unwrap().unwrap();
        assert_eq!(budget.soft_cap_usd, 12.0);
        assert_eq!(budget.on_exceed, "pause");
    }

    #[test]
    fn clearing_a_session_limit_drops_it_and_its_open_alerts() {
        let conn = session_budget_conn();
        write_session_budget(&conn, "s1", 10.0, None).unwrap();
        conn.execute(
            "INSERT INTO budget_alerts (id, kind, session_id, current_usd, cap_usd, created_at)
             VALUES ('a1', 'session-exceeded', 's1', 11.0, 10.0, 1)",
            [],
        )
        .unwrap();

        clear_session_budget(&conn, "s1").unwrap();

        assert!(read_session_budget(&conn, "s1").unwrap().is_none());
        let open: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM budget_alerts WHERE dismissed_at IS NULL",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(open, 0);
    }

    #[test]
    fn no_rule_leaves_the_provider_unbounded() {
        let conn = budget_conn();
        let result = provider_budget_status(&conn, "anthropic", "monthly", fixed_clock()).unwrap();

        assert!(result.remaining_usd.is_infinite());
        assert_eq!(result.pct, 0.0);
        assert!(!result.exceeded);
        assert!(!result.over_threshold);
    }

    #[test]
    fn under_threshold_is_not_flagged() {
        let conn = budget_conn();
        insert_rule(&conn, 100.0, 80.0);
        insert_spend(&conn, "t1", 50.0);

        let result = provider_budget_status(&conn, "anthropic", "monthly", fixed_clock()).unwrap();

        assert_eq!(result.pct, 50.0);
        assert_eq!(result.remaining_usd, 50.0);
        assert!(!result.exceeded);
        assert!(!result.over_threshold);
    }

    #[test]
    fn over_threshold_but_under_cap_is_flagged_without_exceeding() {
        let conn = budget_conn();
        insert_rule(&conn, 100.0, 80.0);
        insert_spend(&conn, "t1", 85.0);

        let result = provider_budget_status(&conn, "anthropic", "monthly", fixed_clock()).unwrap();

        assert_eq!(result.pct, 85.0);
        assert_eq!(result.remaining_usd, 15.0);
        assert!(!result.exceeded);
        assert!(result.over_threshold);
    }

    #[test]
    fn over_cap_exceeds_and_clears_the_threshold_flag() {
        let conn = budget_conn();
        insert_rule(&conn, 100.0, 80.0);
        insert_spend(&conn, "t1", 120.0);

        let result = provider_budget_status(&conn, "anthropic", "monthly", fixed_clock()).unwrap();

        assert_eq!(result.pct, 120.0);
        assert!(result.exceeded);
        assert!(!result.over_threshold);
    }

    #[test]
    fn a_custom_threshold_moves_the_flag_point() {
        let conn = budget_conn();
        insert_rule(&conn, 100.0, 50.0);
        insert_spend(&conn, "t1", 60.0);

        let result = provider_budget_status(&conn, "anthropic", "monthly", fixed_clock()).unwrap();

        assert!(!result.exceeded);
        assert!(result.over_threshold);
    }

    #[test]
    fn spend_outside_the_month_window_is_ignored() {
        let conn = budget_conn();
        insert_rule(&conn, 100.0, 80.0);
        let (start_ms, _) = fixed_clock().month_window_ms();
        conn.execute(
            "INSERT INTO telemetry_records (id, provider, estimated_cost_usd, recorded_at)
             VALUES ('old', 'anthropic', 90.0, ?1)",
            rusqlite::params![start_ms - 1],
        )
        .unwrap();

        let result = provider_budget_status(&conn, "anthropic", "monthly", fixed_clock()).unwrap();

        assert_eq!(result.pct, 0.0);
        assert!(!result.over_threshold);
    }

    fn ms(year: i64, month: u32, day: u32) -> i64 {
        crate::util::ymd_to_epoch_ms(year, month, day)
    }

    #[test]
    fn the_last_millisecond_of_a_month_still_belongs_to_it() {
        let (start, end) = SpendClock::at(ms(2026, 10, 1) - 1, 0).month_window_ms();

        assert_eq!(start, ms(2026, 9, 1));
        assert_eq!(end, ms(2026, 10, 1) - 1);
    }

    #[test]
    fn the_first_millisecond_of_the_next_month_opens_a_new_window() {
        let (start, end) = SpendClock::at(ms(2026, 10, 1), 0).month_window_ms();

        assert_eq!(start, ms(2026, 10, 1));
        assert_eq!(end, ms(2026, 11, 1) - 1);
    }

    #[test]
    fn december_rolls_into_january_of_the_next_year() {
        let (start, end) = SpendClock::at(ms(2026, 12, 31) + 86_399_999, 0).month_window_ms();

        assert_eq!(start, ms(2026, 12, 1));
        assert_eq!(end, ms(2027, 1, 1) - 1);
    }

    #[test]
    fn february_of_a_leap_year_ends_on_the_twenty_ninth() {
        let (start, end) = SpendClock::at(ms(2028, 2, 10), 0).month_window_ms();

        assert_eq!(start, ms(2028, 2, 1));
        assert_eq!(end, ms(2028, 3, 1) - 1);
    }

    #[test]
    fn spend_on_the_last_millisecond_of_last_month_is_not_this_months() {
        let conn = budget_conn();
        insert_rule(&conn, 100.0, 80.0);
        let (start_ms, end_ms) = fixed_clock().month_window_ms();
        conn.execute(
            "INSERT INTO telemetry_records (id, provider, estimated_cost_usd, recorded_at)
             VALUES ('last', 'anthropic', 90.0, ?1), ('first', 'anthropic', 10.0, ?2)",
            rusqlite::params![start_ms - 1, start_ms],
        )
        .unwrap();

        let result = provider_budget_status(&conn, "anthropic", "monthly", fixed_clock()).unwrap();

        assert_eq!(result.spent_usd, 10.0);
        assert_eq!(result.window_start_ms, start_ms);
        assert_eq!(result.window_end_ms, end_ms);
    }

    #[test]
    fn the_status_reports_the_rule_and_the_spend_behind_the_percentage() {
        let conn = budget_conn();
        insert_rule(&conn, 200.0, 70.0);
        insert_spend(&conn, "t1", 50.0);

        let result = provider_budget_status(&conn, "anthropic", "monthly", fixed_clock()).unwrap();

        assert_eq!(result.spent_usd, 50.0);
        assert_eq!(result.cap_usd, Some(200.0));
        assert_eq!(result.threshold_pct, Some(70.0));
        assert_eq!(result.pct, 25.0);
    }

    #[test]
    fn a_provider_without_a_rule_still_reports_its_spend() {
        let conn = budget_conn();
        insert_spend(&conn, "t1", 12.5);

        let result = provider_budget_status(&conn, "anthropic", "monthly", fixed_clock()).unwrap();

        assert_eq!(result.spent_usd, 12.5);
        assert_eq!(result.cap_usd, None);
    }

    #[test]
    fn the_overview_month_is_the_status_spend() {
        let conn = budget_conn();
        insert_rule(&conn, 100.0, 80.0);
        insert_spend(&conn, "t1", 30.0);
        let (start_ms, _) = fixed_clock().month_window_ms();

        let overview =
            provider_budget_overview_at(&conn, "anthropic", start_ms, start_ms, fixed_clock())
                .unwrap();

        assert_eq!(overview.periods.this_month_usd, overview.status.spent_usd);
        assert_eq!(overview.periods.this_month_usd, 30.0);
    }

    #[test]
    fn the_overview_splits_today_and_the_last_seven_days() {
        let conn = budget_conn();
        conn.execute(
            "INSERT INTO telemetry_records (id, provider, estimated_cost_usd, recorded_at) VALUES
             ('old', 'anthropic', 1.0, 999),
             ('week', 'anthropic', 2.0, 1500),
             ('today', 'anthropic', 4.0, 2500),
             ('other', 'openai', 8.0, 2500)",
            [],
        )
        .unwrap();

        let overview =
            provider_budget_overview_at(&conn, "anthropic", 2000, 1000, fixed_clock()).unwrap();

        assert_eq!(overview.periods.today_usd, 4.0);
        assert_eq!(overview.periods.last_7_days_usd, 6.0);
    }

    #[test]
    fn an_alert_from_last_month_does_not_silence_this_months() {
        let conn = session_budget_conn();
        let month_start = ms(2026, 10, 1);
        conn.execute(
            "INSERT INTO budget_alerts (id, kind, provider, session_id, current_usd, cap_usd, created_at, dismissed_at)
             VALUES ('a1', 'provider-threshold', 'anthropic', NULL, 85.0, 100.0, ?1, NULL)",
            rusqlite::params![month_start - 1],
        )
        .unwrap();

        assert!(
            !has_open_provider_alert(&conn, "provider-threshold", "anthropic", month_start)
                .unwrap()
        );
        assert!(
            has_open_provider_alert(&conn, "provider-threshold", "anthropic", month_start - 5)
                .unwrap()
        );
    }

    #[test]
    fn a_new_month_closes_last_months_open_provider_alerts_only() {
        let conn = session_budget_conn();
        let month_start = ms(2026, 10, 1);
        conn.execute_batch(
            "INSERT INTO budget_alerts (id, kind, provider, session_id, current_usd, cap_usd, created_at, dismissed_at) VALUES
             ('old-threshold', 'provider-threshold', 'anthropic', NULL, 85.0, 100.0, 1000, NULL),
             ('old-exceeded', 'provider-exceeded', 'anthropic', NULL, 105.0, 100.0, 2000, NULL),
             ('other-provider', 'provider-threshold', 'openai', NULL, 85.0, 100.0, 1000, NULL),
             ('old-session', 'session-threshold', NULL, 's1', 8.0, 10.0, 1000, NULL);",
        )
        .unwrap();
        conn.execute(
            "INSERT INTO budget_alerts (id, kind, provider, session_id, current_usd, cap_usd, created_at, dismissed_at)
             VALUES ('fresh', 'provider-threshold', 'anthropic', NULL, 85.0, 100.0, ?1, NULL)",
            rusqlite::params![month_start + 5],
        )
        .unwrap();

        let closed =
            dismiss_provider_alerts_before(&conn, "anthropic", month_start, month_start + 10)
                .unwrap();

        let open: Vec<String> = conn
            .prepare("SELECT id FROM budget_alerts WHERE dismissed_at IS NULL ORDER BY id")
            .unwrap()
            .query_map([], |row| row.get(0))
            .unwrap()
            .collect::<Result<_, _>>()
            .unwrap();
        assert_eq!(closed, 2);
        assert_eq!(open, vec!["fresh", "old-session", "other-provider"]);
    }

    #[test]
    fn spend_equal_to_the_cap_is_exceeded_and_not_merely_near() {
        let conn = budget_conn();
        insert_rule(&conn, 100.0, 80.0);
        insert_spend(&conn, "t1", 100.0);

        let result = provider_budget_status(&conn, "anthropic", "monthly", fixed_clock()).unwrap();

        assert_eq!(result.pct, 100.0);
        assert_eq!(result.remaining_usd, 0.0);
        assert!(result.exceeded);
        assert!(!result.over_threshold);
    }

    #[test]
    fn a_cap_of_zero_is_exceeded_whatever_was_spent() {
        let conn = budget_conn();
        insert_rule(&conn, 0.0, 80.0);

        let idle = provider_budget_status(&conn, "anthropic", "monthly", fixed_clock()).unwrap();
        assert_eq!(idle.pct, 100.0);
        assert!(idle.exceeded);
        assert!(!idle.over_threshold);

        insert_spend(&conn, "t1", 0.01);
        let spent = provider_budget_status(&conn, "anthropic", "monthly", fixed_clock()).unwrap();
        assert_eq!(spent.pct, 100.0);
        assert!(spent.exceeded);
        assert!(!spent.over_threshold);
    }

    #[test]
    fn the_period_argument_picks_the_rule_and_never_the_window() {
        let conn = budget_conn();
        insert_rule(&conn, 100.0, 80.0);
        insert_spend(&conn, "t1", 40.0);

        let weekly = provider_budget_status(&conn, "anthropic", "weekly", fixed_clock()).unwrap();

        assert_eq!(weekly.cap_usd, None);
        assert_eq!(weekly.spent_usd, 40.0);
        assert_eq!(weekly.window_start_ms, fixed_clock().month_window_ms().0);
    }

    fn emit_conn() -> rusqlite::Connection {
        let conn = rusqlite::Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE budget_rules (
                id TEXT PRIMARY KEY, provider TEXT, period TEXT,
                cap_usd REAL, alert_threshold_pct REAL
            );
            CREATE TABLE telemetry_records (
                id TEXT PRIMARY KEY, provider TEXT, session_id TEXT,
                estimated_cost_usd REAL, recorded_at INTEGER
            );
            CREATE TABLE session_budgets (
                session_id TEXT PRIMARY KEY, soft_cap_usd REAL NOT NULL,
                on_exceed TEXT NOT NULL DEFAULT 'pause'
            );
            CREATE TABLE budget_alerts (
                id TEXT PRIMARY KEY, kind TEXT, provider TEXT, session_id TEXT,
                current_usd REAL, cap_usd REAL, created_at INTEGER, dismissed_at INTEGER
            );",
        )
        .unwrap();
        conn
    }

    fn emit_rule(conn: &rusqlite::Connection, cap_usd: f64, threshold_pct: f64) {
        conn.execute(
            "INSERT INTO budget_rules (id, provider, period, cap_usd, alert_threshold_pct)
             VALUES ('r1', 'anthropic', 'monthly', ?1, ?2)",
            rusqlite::params![cap_usd, threshold_pct],
        )
        .unwrap();
    }

    fn emit_spend(conn: &rusqlite::Connection, id: &str, cost_usd: f64, recorded_at: i64) {
        conn.execute(
            "INSERT INTO telemetry_records (id, provider, session_id, estimated_cost_usd, recorded_at)
             VALUES (?1, 'anthropic', 's1', ?2, ?3)",
            rusqlite::params![id, cost_usd, recorded_at],
        )
        .unwrap();
    }

    fn emitted_kinds(conn: &rusqlite::Connection, now_ms: i64) -> Vec<String> {
        emit_alerts_at(conn, "anthropic", "s1", SpendClock::at(now_ms, 0))
            .unwrap()
            .into_iter()
            .map(|alert| alert.kind)
            .collect()
    }

    #[test]
    fn the_alert_calls_spend_equal_to_the_provider_cap_exceeded() {
        let conn = emit_conn();
        let now = ms(2026, 10, 15);
        emit_rule(&conn, 100.0, 80.0);
        emit_spend(&conn, "t1", 100.0, now);

        assert_eq!(emitted_kinds(&conn, now), vec!["provider-exceeded"]);
    }

    #[test]
    fn the_alert_flags_the_threshold_below_the_cap() {
        let conn = emit_conn();
        let now = ms(2026, 10, 15);
        emit_rule(&conn, 100.0, 80.0);
        emit_spend(&conn, "t1", 80.0, now);

        assert_eq!(emitted_kinds(&conn, now), vec!["provider-threshold"]);
    }

    #[test]
    fn the_alert_calls_a_provider_cap_of_zero_exceeded() {
        let conn = emit_conn();
        let now = ms(2026, 10, 15);
        emit_rule(&conn, 0.0, 80.0);
        emit_spend(&conn, "t1", 5.0, now);

        assert_eq!(emitted_kinds(&conn, now), vec!["provider-exceeded"]);
    }

    #[test]
    fn the_alert_calls_spend_equal_to_the_session_cap_exceeded() {
        let conn = emit_conn();
        let now = ms(2026, 10, 15);
        conn.execute(
            "INSERT INTO session_budgets (session_id, soft_cap_usd) VALUES ('s1', 10.0)",
            [],
        )
        .unwrap();
        emit_spend(&conn, "t1", 10.0, now);

        assert_eq!(emitted_kinds(&conn, now), vec!["session-exceeded"]);
    }

    #[test]
    fn the_alert_warns_a_session_at_eighty_percent_and_not_before() {
        let conn = emit_conn();
        let now = ms(2026, 10, 15);
        conn.execute(
            "INSERT INTO session_budgets (session_id, soft_cap_usd) VALUES ('s1', 10.0)",
            [],
        )
        .unwrap();
        emit_spend(&conn, "t1", 7.9, now);
        assert!(emitted_kinds(&conn, now).is_empty());

        emit_spend(&conn, "t2", 0.1, now);
        assert_eq!(emitted_kinds(&conn, now), vec!["session-threshold"]);
    }

    #[test]
    fn the_alert_calls_a_session_cap_of_zero_exceeded() {
        let conn = emit_conn();
        let now = ms(2026, 10, 15);
        conn.execute(
            "INSERT INTO session_budgets (session_id, soft_cap_usd) VALUES ('s1', 0.0)",
            [],
        )
        .unwrap();
        emit_spend(&conn, "t1", 3.0, now);

        assert_eq!(emitted_kinds(&conn, now), vec!["session-exceeded"]);
    }

    #[test]
    fn the_same_alert_is_not_raised_twice_while_it_is_open() {
        let conn = emit_conn();
        let now = ms(2026, 10, 15);
        emit_rule(&conn, 100.0, 80.0);
        emit_spend(&conn, "t1", 100.0, now);

        assert_eq!(emitted_kinds(&conn, now).len(), 1);
        assert!(emitted_kinds(&conn, now).is_empty());
    }

    const HALF_HOUR_MS: i64 = 30 * 60 * 1000;
    const TWO_HOURS_MS: i64 = 2 * 60 * 60 * 1000;

    #[test]
    fn half_past_midnight_local_on_the_first_opens_the_new_month() {
        let local_midnight_utc_ms = ms(2026, 10, 1) - TWO_HOURS_MS;
        let clock = SpendClock::at(local_midnight_utc_ms + HALF_HOUR_MS, 120);

        let (start, end) = clock.month_window_ms();

        assert_eq!(start, local_midnight_utc_ms);
        assert_eq!(end, ms(2026, 11, 1) - TWO_HOURS_MS - 1);
    }

    #[test]
    fn east_of_utc_on_the_first_today_never_exceeds_the_month() {
        let conn = budget_conn();
        let local_midnight_utc_ms = ms(2026, 10, 1) - TWO_HOURS_MS;
        let clock = SpendClock::at(local_midnight_utc_ms + HALF_HOUR_MS, 120);
        conn.execute(
            "INSERT INTO telemetry_records (id, provider, estimated_cost_usd, recorded_at)
             VALUES ('evening', 'anthropic', 5.0, ?1), ('late', 'anthropic', 3.0, ?2)",
            rusqlite::params![
                local_midnight_utc_ms - 1,
                local_midnight_utc_ms + HALF_HOUR_MS
            ],
        )
        .unwrap();

        let overview = provider_budget_overview_at(
            &conn,
            "anthropic",
            local_midnight_utc_ms,
            local_midnight_utc_ms - 6 * 86_400_000,
            clock,
        )
        .unwrap();

        assert_eq!(overview.periods.today_usd, 3.0);
        assert_eq!(overview.periods.this_month_usd, 3.0);
        assert_eq!(overview.periods.last_7_days_usd, 8.0);
        assert!(overview.periods.today_usd <= overview.periods.this_month_usd);
    }

    #[test]
    fn a_session_limit_carries_the_warn_ratio_the_screens_use() {
        let conn = session_budget_conn();

        let written = write_session_budget(&conn, "s1", 10.0, None).unwrap();
        let read = read_session_budget(&conn, "s1").unwrap().unwrap();

        assert_eq!(written.warn_ratio, 0.8);
        assert_eq!(read.warn_ratio, 0.8);
        assert_eq!(written.on_exceed, "pause");
    }

    #[test]
    fn a_session_cap_of_zero_or_less_is_refused_and_nothing_is_stored() {
        let conn = session_budget_conn();
        for cap in [0.0, -5.0, f64::NAN, f64::INFINITY] {
            let outcome = write_session_budget(&conn, "s1", cap, None);
            assert!(matches!(outcome, Err(DbError::InvalidSpendCap)), "{cap}");
        }
        assert!(read_session_budget(&conn, "s1").unwrap().is_none());
    }

    #[test]
    fn only_a_finite_cap_above_zero_passes_the_provider_rule_check() {
        assert!(require_positive_cap(0.01).is_ok());
        for cap in [0.0, -1.0, f64::NAN, f64::NEG_INFINITY] {
            assert!(matches!(
                require_positive_cap(cap),
                Err(DbError::InvalidSpendCap)
            ));
        }
    }
}
