use std::collections::HashSet;
use std::sync::{Arc, Mutex, OnceLock};

use rusqlite::functions::FunctionFlags;
use rusqlite::Connection;

use crate::live_child::LiveChildRegistry;
use crate::util::lock_or_recover;

pub const LIVE_FUNCTION: &str = "turn_is_live";

#[derive(Default, Clone)]
pub struct SpawningRuns(Arc<Mutex<HashSet<String>>>);

pub struct SpawningGuard {
    runs: SpawningRuns,
    run_id: String,
}

impl Drop for SpawningGuard {
    fn drop(&mut self) {
        lock_or_recover(&self.runs.0).remove(&self.run_id);
    }
}

impl SpawningRuns {
    pub fn hold(&self, run_id: &str) -> SpawningGuard {
        lock_or_recover(&self.0).insert(run_id.to_string());
        SpawningGuard {
            runs: self.clone(),
            run_id: run_id.to_string(),
        }
    }
}

#[derive(Clone)]
pub struct LiveTurns {
    pub live: LiveChildRegistry,
    pub spawning: SpawningRuns,
}

impl LiveTurns {
    pub fn is_live(&self, run_id: &str) -> bool {
        lock_or_recover(&self.spawning.0).contains(run_id)
            || lock_or_recover(&self.live).contains_key(run_id)
    }
}

static INSTALLED: OnceLock<LiveTurns> = OnceLock::new();

pub fn install(turns: LiveTurns) {
    let _ = INSTALLED.set(turns);
}

pub fn define_with(
    conn: &Connection,
    is_live: impl Fn(&str) -> bool + Send + 'static,
) -> rusqlite::Result<()> {
    conn.create_scalar_function(LIVE_FUNCTION, 1, FunctionFlags::SQLITE_UTF8, move |ctx| {
        let run_id: Option<String> = ctx.get(0)?;
        Ok(run_id.is_some_and(|run_id| is_live(&run_id)))
    })
}

pub fn define(conn: &Connection) -> rusqlite::Result<()> {
    define_with(conn, |run_id| {
        INSTALLED.get().is_some_and(|turns| turns.is_live(run_id))
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn turns() -> LiveTurns {
        LiveTurns {
            live: LiveChildRegistry::default(),
            spawning: SpawningRuns::default(),
        }
    }

    fn live_in_sql(conn: &Connection, run_id: Option<&str>) -> bool {
        conn.query_row(&format!("SELECT {LIVE_FUNCTION}(?1)"), [run_id], |row| {
            row.get(0)
        })
        .expect("live query")
    }

    #[test]
    fn a_run_reads_live_from_its_spawn_until_it_leaves_the_registry() {
        let turns = turns();
        let conn = Connection::open_in_memory().expect("db");
        let lookup = turns.clone();
        define_with(&conn, move |run_id| lookup.is_live(run_id)).expect("define");
        assert!(!live_in_sql(&conn, Some("run-1")));

        let spawning = turns.spawning.hold("run-1");
        assert!(live_in_sql(&conn, Some("run-1")));
        drop(spawning);
        assert!(!live_in_sql(&conn, Some("run-1")));
        assert!(!live_in_sql(&conn, None));
    }
}
