use super::*;
use crate::test_support::migrated_connection;
use serde_json::Value;

const PARITY: &str = include_str!("parity.json");

fn parity() -> Value {
    serde_json::from_str(PARITY).expect("parity fixture parses")
}

fn text<'a>(value: &'a Value, key: &str) -> &'a str {
    value[key].as_str().expect("fixture text")
}

fn flag(value: &Value, key: &str) -> bool {
    value[key].as_bool().expect("fixture flag")
}

fn number(value: &Value, key: &str) -> i64 {
    value[key].as_i64().expect("fixture number")
}

fn tone_name(tone: Tone) -> &'static str {
    match tone {
        Tone::Danger => "danger",
        Tone::Warning => "warning",
    }
}

fn kind_name(kind: Kind) -> &'static str {
    match kind {
        Kind::Error => "error",
        Kind::HumanInput => "human-input",
        Kind::Other => "other",
    }
}

fn add_workspace(conn: &Connection, id: &str) {
    conn.execute(
        "INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES (?1, ?1, ?1, 1, 1)",
        [id],
    )
    .unwrap();
}

struct Seed<'a> {
    workspace: &'a str,
    session: &'a str,
    state_kind: &'a str,
    branch: &'a str,
}

fn add_session(conn: &Connection, seed: &Seed) {
    let mount = format!("mount-{}", seed.session);
    conn.execute(
        "INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at, active_mount_id)
         VALUES (?1, ?2, 'Ship the ledger sync', ?3, 1, 1, NULL)",
        rusqlite::params![seed.session, seed.workspace, seed.state_kind],
    )
    .unwrap();
    conn.execute(
        "INSERT INTO session_worktrees (id, session_id, branch, created_at) VALUES (?1, ?2, ?3, 1)",
        rusqlite::params![mount, seed.session, seed.branch],
    )
    .unwrap();
    conn.execute(
        "UPDATE sessions SET active_mount_id = ?1 WHERE id = ?2",
        rusqlite::params![mount, seed.session],
    )
    .unwrap();
}

fn add_running_agent(conn: &Connection, session: &str) {
    conn.execute(
        "INSERT INTO agents (id, session_id, ordinal, name, status) VALUES (?1, ?2, 0, 'Builder', 'running')",
        rusqlite::params![format!("agent-{session}"), session],
    )
    .unwrap();
}

fn add_questions(conn: &Connection, session: &str, status: &str, count: i64) {
    for index in 0..count {
        conn.execute(
            "INSERT INTO open_questions (id, session_id, text, status, created_at)
             VALUES (?1, ?2, ?1, ?3, 1)",
            rusqlite::params![format!("q-{session}-{status}-{index}"), session, status],
        )
        .unwrap();
    }
}

fn add_threads(
    conn: &Connection,
    session: &str,
    origin: &str,
    state: &str,
    reason: &str,
    count: i64,
) {
    for index in 0..count {
        conn.execute(
            "INSERT INTO resolve_threads (id, session_id, thread_id, origin_kind, state, state_reason, created_at, updated_at)
             VALUES (?1, ?2, ?1, ?3, ?4, ?5, 1, 1)",
            rusqlite::params![format!("t-{session}-{origin}-{state}-{index}"), session, origin, state, reason],
        )
        .unwrap();
    }
}

fn add_request(conn: &Connection, session: &str, state: &str, snapshot: &str) {
    conn.execute(
        "INSERT INTO mount_pr_links (id, mount_id, provider, host, repo_slug, pr_number, head_branch, url, state, snapshot_json, last_observed_at, created_at, updated_at)
         VALUES (?1, ?2, 'github', 'github.com', 'harborline/ledger-core', 7, 'ak/feat', 'https://example.test/7', ?3, ?4, 1, 1, 1)",
        rusqlite::params![format!("link-{session}"), format!("mount-{session}"), state, snapshot],
    )
    .unwrap();
}

fn seed_case(conn: &Connection, case: &Value) {
    let session = &case["session"];
    let facts = &case["facts"];
    let branch = match flag(session, "isBranchless") {
        true => "",
        false => "ak/feat",
    };
    add_workspace(conn, "ws-harborline");
    add_session(
        conn,
        &Seed {
            workspace: "ws-harborline",
            session: "s-1",
            state_kind: match flag(session, "isErrored") {
                true => "error",
                false => "idle",
            },
            branch,
        },
    );
    if flag(session, "isLive") {
        add_running_agent(conn, "s-1");
    }
    add_questions(conn, "s-1", "open", number(facts, "openQuestions"));
    add_threads(
        conn,
        "s-1",
        "review_comment",
        "needs_answer",
        "",
        number(facts, "fixNeedsYou"),
    );
    add_threads(
        conn,
        "s-1",
        "review_comment",
        "failed",
        "publication_failed:network",
        number(facts, "pushFailed"),
    );
    if flag(facts, "isCiFailing") {
        add_request(conn, "s-1", "open", "{\"checks\":\"failure\"}");
    }
}

fn rows_of(conn: &Connection) -> Vec<WorkspaceAttentionRow> {
    workspace_attention(conn).unwrap()
}

fn codes(row: &WorkspaceAttentionRow) -> Vec<&'static str> {
    row.reasons.clone()
}

#[test]
fn the_reason_table_is_the_one_the_front_end_test_reads() {
    let fixture = parity();
    let listed: Vec<(String, String, String)> = fixture["reasons"]
        .as_array()
        .unwrap()
        .iter()
        .map(|entry| {
            (
                text(entry, "reason").to_string(),
                text(entry, "tone").to_string(),
                text(entry, "kind").to_string(),
            )
        })
        .collect();
    let counted: Vec<(String, String, String)> = REASONS
        .iter()
        .map(|reason| {
            (
                reason.code.to_string(),
                tone_name(reason.tone).to_string(),
                kind_name(reason.kind).to_string(),
            )
        })
        .collect();

    assert_eq!(counted, listed);
}

#[test]
fn every_parity_case_counts_what_the_front_end_counts() {
    let fixture = parity();
    for case in fixture["cases"].as_array().unwrap() {
        let conn = migrated_connection();
        seed_case(&conn, case);
        let rows = rows_of(&conn);
        let name = text(case, "name");

        if flag(case, "isCounted") {
            assert_eq!(rows.len(), 1, "{name}");
            assert_eq!(rows[0].count, 1, "{name}");
            assert_eq!(rows[0].tone, text(case, "tone"), "{name}");
            let expected: Vec<&str> = case["reasons"]
                .as_array()
                .unwrap()
                .iter()
                .map(|reason| reason.as_str().unwrap())
                .collect();
            assert_eq!(codes(&rows[0]), expected, "{name}");
            continue;
        }
        assert!(rows.is_empty(), "{name}");
    }
}

#[test]
fn a_session_with_several_questions_is_counted_once() {
    let conn = migrated_connection();
    add_workspace(&conn, "ws-northwind");
    add_session(
        &conn,
        &Seed {
            workspace: "ws-northwind",
            session: "s-1",
            state_kind: "idle",
            branch: "ak/feat",
        },
    );
    add_session(
        &conn,
        &Seed {
            workspace: "ws-northwind",
            session: "s-2",
            state_kind: "idle",
            branch: "ak/feat",
        },
    );
    add_questions(&conn, "s-1", "open", 2);
    add_questions(&conn, "s-2", "open", 1);

    let rows = rows_of(&conn);

    assert_eq!(rows.len(), 1);
    assert_eq!(rows[0].workspace_id, "ws-northwind");
    assert_eq!(rows[0].count, 2);
    assert_eq!(rows[0].tone, "warning");
    assert_eq!(rows[0].reasons, vec!["open-question"]);
}

#[test]
fn each_workspace_gets_its_own_row_in_a_stable_order() {
    let conn = migrated_connection();
    add_workspace(&conn, "ws-northwind");
    add_workspace(&conn, "ws-harborline");
    add_workspace(&conn, "ws-quiet");
    add_session(
        &conn,
        &Seed {
            workspace: "ws-northwind",
            session: "s-1",
            state_kind: "idle",
            branch: "ak/feat",
        },
    );
    add_session(
        &conn,
        &Seed {
            workspace: "ws-harborline",
            session: "s-2",
            state_kind: "error",
            branch: "ak/feat",
        },
    );
    add_session(
        &conn,
        &Seed {
            workspace: "ws-quiet",
            session: "s-3",
            state_kind: "idle",
            branch: "ak/feat",
        },
    );
    add_questions(&conn, "s-1", "open", 1);

    let rows = rows_of(&conn);

    let ids: Vec<&str> = rows.iter().map(|row| row.workspace_id.as_str()).collect();
    assert_eq!(ids, vec!["ws-harborline", "ws-northwind"]);
    assert_eq!(rows[0].tone, "danger");
    assert_eq!(rows[1].tone, "warning");
}

#[test]
fn an_answered_question_a_settled_request_and_a_review_note_count_nothing() {
    let conn = migrated_connection();
    add_workspace(&conn, "ws-northwind");
    add_session(
        &conn,
        &Seed {
            workspace: "ws-northwind",
            session: "s-1",
            state_kind: "idle",
            branch: "ak/feat",
        },
    );
    add_questions(&conn, "s-1", "answered", 1);
    add_questions(&conn, "s-1", "dismissed", 1);
    add_request(&conn, "s-1", "merged", "{\"checks\":\"failure\"}");
    add_threads(
        &conn,
        "s-1",
        "diff_comment",
        "failed",
        "publication_failed:network",
        1,
    );

    assert!(rows_of(&conn).is_empty());
}

#[test]
fn a_detached_mount_and_an_unreadable_snapshot_do_not_fail_the_count() {
    let conn = migrated_connection();
    add_workspace(&conn, "ws-northwind");
    add_session(
        &conn,
        &Seed {
            workspace: "ws-northwind",
            session: "s-1",
            state_kind: "idle",
            branch: "ak/feat",
        },
    );
    add_request(&conn, "s-1", "open", "not json");
    conn.execute("UPDATE session_worktrees SET is_attached = 0", [])
        .unwrap();

    assert!(rows_of(&conn).is_empty());
}

#[test]
fn archived_deleted_and_disconnected_work_is_left_out() {
    let conn = migrated_connection();
    add_workspace(&conn, "ws-northwind");
    add_workspace(&conn, "ws-gone");
    for session in ["s-1", "s-2", "s-3"] {
        add_session(
            &conn,
            &Seed {
                workspace: "ws-northwind",
                session,
                state_kind: "idle",
                branch: "ak/feat",
            },
        );
        add_questions(&conn, session, "open", 1);
    }
    add_session(
        &conn,
        &Seed {
            workspace: "ws-gone",
            session: "s-4",
            state_kind: "idle",
            branch: "ak/feat",
        },
    );
    add_questions(&conn, "s-4", "open", 1);
    conn.execute("UPDATE sessions SET archived_at = 5 WHERE id = 's-1'", [])
        .unwrap();
    conn.execute("UPDATE sessions SET deleted_at = 5 WHERE id = 's-2'", [])
        .unwrap();
    conn.execute(
        "UPDATE workspaces SET deleted_at = 5 WHERE id = 'ws-gone'",
        [],
    )
    .unwrap();

    let rows = rows_of(&conn);

    assert_eq!(rows.len(), 1);
    assert_eq!(rows[0].workspace_id, "ws-northwind");
    assert_eq!(rows[0].count, 1);
}

#[test]
fn the_wire_shape_is_camel_case() {
    let row = WorkspaceAttentionRow {
        workspace_id: "ws-northwind".to_string(),
        count: 2,
        tone: "danger",
        reasons: vec!["ci-failed"],
    };

    assert_eq!(
        serde_json::to_string(&row).unwrap(),
        "{\"workspaceId\":\"ws-northwind\",\"count\":2,\"tone\":\"danger\",\"reasons\":[\"ci-failed\"]}"
    );
}
