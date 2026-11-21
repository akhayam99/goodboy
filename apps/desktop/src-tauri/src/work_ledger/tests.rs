use rusqlite::Connection;
use serde_json::json;

use super::{
    ledger_exit_code, mount_branch, record_end, record_start, script_start, ScriptStart, WorkStart,
    SCRIPT, STOPPED_EXIT_CODE,
};
use crate::test_support::{apply_migrated_schema, migrated_connection};

const SEED: &str = "PRAGMA foreign_keys = ON;
     INSERT INTO workspaces (id, name, slug, created_at, updated_at)
       VALUES ('w1', 'Harborline', 'harborline', 1, 1);
     INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at)
       VALUES ('s1', 'w1', 'Ship payments-api', 'idle', 1, 1);";

fn seeded() -> Connection {
    let conn = migrated_connection();
    conn.execute_batch(SEED).expect("seed applies");
    conn
}

fn start_of(run_id: &str, session_id: &str) -> WorkStart {
    script_start(ScriptStart {
        run_id,
        script_id: "test:integration",
        name: "test:integration",
        session_id,
        mount_id: Some("mount-payments-api"),
        branch: Some("nw/retry"),
        cwd: "/work/payments-api",
        started_at: 100,
    })
}

type Row = (
    String,
    String,
    Option<String>,
    String,
    i64,
    Option<i64>,
    Option<i64>,
    String,
);

fn rows(conn: &Connection) -> Vec<Row> {
    let mut statement = conn
        .prepare(
            "SELECT run_id, session_id, mount_id, kind, started_at, ended_at, exit_code, payload_json
             FROM work_events ORDER BY started_at",
        )
        .expect("select prepares");
    statement
        .query_map([], |row| {
            Ok((
                row.get(0)?,
                row.get(1)?,
                row.get(2)?,
                row.get(3)?,
                row.get(4)?,
                row.get(5)?,
                row.get(6)?,
                row.get(7)?,
            ))
        })
        .expect("select runs")
        .collect::<rusqlite::Result<Vec<_>>>()
        .expect("rows read")
}

#[test]
fn a_script_run_is_one_row_with_its_mount_and_its_end() {
    let conn = seeded();

    record_start(&conn, &start_of("run-1", "s1")).expect("start saved");
    record_end(&conn, "run-1", 900, 1).expect("end saved");

    let saved = rows(&conn);
    assert_eq!(saved.len(), 1);
    let (run_id, session_id, mount_id, kind, started_at, ended_at, exit_code, payload) =
        saved[0].clone();
    assert_eq!(
        (run_id.as_str(), session_id.as_str(), mount_id.as_deref()),
        ("run-1", "s1", Some("mount-payments-api"))
    );
    assert_eq!(kind, SCRIPT);
    assert_eq!((started_at, ended_at, exit_code), (100, Some(900), Some(1)));
    assert_eq!(
        serde_json::from_str::<serde_json::Value>(&payload).expect("payload parses"),
        json!({
            "scriptId": "test:integration",
            "name": "test:integration",
            "branch": "nw/retry",
            "cwd": "/work/payments-api",
        })
    );
}

#[test]
fn two_windows_reporting_one_run_leave_one_row_and_the_first_end() {
    let conn = seeded();

    assert_eq!(
        record_start(&conn, &start_of("run-1", "s1")).expect("first"),
        1
    );
    assert_eq!(
        record_start(&conn, &start_of("run-1", "s1")).expect("second"),
        0
    );
    assert_eq!(record_end(&conn, "run-1", 900, 0).expect("first end"), 1);
    assert_eq!(record_end(&conn, "run-1", 950, 130).expect("second end"), 0);

    let saved = rows(&conn);
    assert_eq!(saved.len(), 1);
    assert_eq!((saved[0].5, saved[0].6), (Some(900), Some(0)));
}

#[test]
fn a_run_of_a_session_that_is_gone_writes_nothing() {
    let conn = seeded();

    assert_eq!(
        record_start(&conn, &start_of("run-1", "gone")).expect("skipped"),
        0
    );
    assert_eq!(record_end(&conn, "run-1", 900, 0).expect("no row"), 0);
    assert!(rows(&conn).is_empty());
}

#[test]
fn a_run_survives_a_restart() {
    let dir = std::env::temp_dir().join(format!(
        "goodboy-work-ledger-{:016x}",
        rand::random::<u64>()
    ));
    std::fs::create_dir_all(&dir).expect("scratch dir");
    let path = dir.join("data.db");
    {
        let conn = Connection::open(&path).expect("file opens");
        apply_migrated_schema(&conn);
        conn.execute_batch(SEED).expect("seed applies");
        record_start(&conn, &start_of("run-1", "s1")).expect("start saved");
        record_end(&conn, "run-1", 900, 0).expect("end saved");
        record_start(&conn, &start_of("run-2", "s1")).expect("open run saved");
    }

    let reopened = Connection::open(&path).expect("file reopens");
    let saved = rows(&reopened);
    let _ = std::fs::remove_dir_all(&dir);

    assert_eq!(
        saved
            .iter()
            .map(|row| (row.0.as_str(), row.5, row.6))
            .collect::<Vec<_>>(),
        vec![("run-1", Some(900), Some(0)), ("run-2", None, None)]
    );
}

#[test]
fn a_ledger_row_goes_with_its_session() {
    let conn = seeded();
    record_start(&conn, &start_of("run-1", "s1")).expect("start saved");

    conn.execute("DELETE FROM sessions WHERE id = 's1'", [])
        .expect("session deleted");

    assert!(rows(&conn).is_empty());
}

#[test]
fn a_mount_branch_is_read_at_the_time_of_the_start() {
    let conn = seeded();
    conn.execute_batch(
        "INSERT INTO session_worktrees (id, session_id, worktree_path, branch, created_at)
           VALUES ('mount-payments-api', 's1', '/work/payments-api', 'nw/retry', 1);",
    )
    .expect("mount seeded");

    let branch = mount_branch(&conn, "mount-payments-api");
    record_start(
        &conn,
        &script_start(ScriptStart {
            run_id: "run-1",
            script_id: "test:integration",
            name: "test:integration",
            session_id: "s1",
            mount_id: Some("mount-payments-api"),
            branch: branch.as_deref(),
            cwd: "/work/payments-api",
            started_at: 100,
        }),
    )
    .expect("start saved");
    conn.execute(
        "UPDATE session_worktrees SET branch = 'nw/other' WHERE id = 'mount-payments-api'",
        [],
    )
    .expect("mount moved");

    let payload: serde_json::Value =
        serde_json::from_str(&rows(&conn)[0].7).expect("payload parses");
    assert_eq!(payload["branch"], json!("nw/retry"));
    assert_eq!(
        mount_branch(&conn, "mount-payments-api").as_deref(),
        Some("nw/other")
    );
    assert_eq!(mount_branch(&conn, "gone"), None);
}

#[test]
fn a_stopped_run_is_saved_with_the_stop_code_and_a_natural_exit_keeps_its_own() {
    assert_eq!(ledger_exit_code(-1, true), STOPPED_EXIT_CODE);
    assert_eq!(ledger_exit_code(0, true), STOPPED_EXIT_CODE);
    assert_eq!(ledger_exit_code(-1, false), -1);
    assert_eq!(ledger_exit_code(3, false), 3);
}
