use rusqlite::Connection;
use serde_json::json;
use tauri::Url;

use super::{
    list_visits, record_visit, retitle_visit, visitable_address, VisitRow, LISTED_VISITS,
    MAX_VISITS_PER_SESSION,
};
use crate::browser::guard::AppOrigins;
use crate::browser::tab_rows::{delete_session_rows, stale_session_ids};
use crate::test_support::migrated_connection;
use crate::util::wire_shape::assert_wire_value;

fn seeded() -> Connection {
    let conn = migrated_connection();
    conn.execute_batch(
        "PRAGMA foreign_keys = ON;
         INSERT INTO workspaces (id, name, slug, created_at, updated_at)
           VALUES ('w1', 'Harborline', 'harborline', 1, 1);
         INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at)
           VALUES ('s1', 'w1', 'Ship ledger-core', 'idle', 1, 1),
                  ('s2', 'w1', 'Fix notify-relay', 'idle', 1, 1);",
    )
    .expect("seed applies");
    conn
}

fn origins() -> AppOrigins {
    AppOrigins::with_dev_origin(Some(
        Url::parse("http://localhost:1421").expect("dev origin parses"),
    ))
}

fn urls(rows: &[VisitRow]) -> Vec<&str> {
    rows.iter().map(|row| row.url.as_str()).collect()
}

#[test]
fn wire_shape_visit_row() {
    assert_wire_value(
        &VisitRow {
            url: "http://localhost:5173/checkout".to_string(),
            title: "Checkout".to_string(),
            visited_at: 7,
        },
        json!({
            "url": "http://localhost:5173/checkout",
            "title": "Checkout",
            "visitedAt": 7,
        }),
    );
}

#[test]
fn keeps_only_web_addresses_without_credentials_or_fragment() {
    let origins = origins();
    assert_eq!(
        visitable_address("http://user:secret@localhost:5173/checkout#total", &origins),
        Some("http://localhost:5173/checkout".to_string())
    );
    assert_eq!(visitable_address("about:blank", &origins), None);
    assert_eq!(visitable_address("http://localhost:1421/", &origins), None);
    assert_eq!(visitable_address("file:///etc/hosts", &origins), None);
}

#[test]
fn one_row_per_address_moves_to_the_top_on_a_new_visit() {
    let conn = seeded();
    record_visit(&conn, "s1", "http://localhost:5173/checkout", "Checkout", 1).expect("saves");
    record_visit(&conn, "s1", "http://localhost:5173/tax", "Tax rates", 2).expect("saves");
    record_visit(&conn, "s1", "http://localhost:5173/checkout", "", 3).expect("saves");

    let rows = list_visits(&conn, "s1", LISTED_VISITS).expect("lists");
    assert_eq!(
        urls(&rows),
        vec![
            "http://localhost:5173/checkout",
            "http://localhost:5173/tax"
        ]
    );
    assert_eq!(rows[0].title, "Checkout");
    assert_eq!(rows[0].visited_at, 3);
    assert!(list_visits(&conn, "s2", LISTED_VISITS)
        .expect("lists")
        .is_empty());
}

#[test]
fn a_title_change_renames_the_visit_of_that_address_only() {
    let conn = seeded();
    record_visit(&conn, "s1", "http://localhost:5173/checkout", "", 1).expect("saves");
    record_visit(&conn, "s2", "http://localhost:5173/checkout", "Old", 1).expect("saves");

    assert_eq!(
        retitle_visit(
            &conn,
            "s1",
            "http://localhost:5173/checkout",
            "Confirm order"
        )
        .expect("renames"),
        1
    );
    assert_eq!(
        retitle_visit(&conn, "s1", "http://localhost:5173/checkout", "  ").expect("skips"),
        0
    );

    assert_eq!(
        list_visits(&conn, "s1", LISTED_VISITS).expect("lists")[0].title,
        "Confirm order"
    );
    assert_eq!(
        list_visits(&conn, "s2", LISTED_VISITS).expect("lists")[0].title,
        "Old"
    );
}

#[test]
fn keeps_at_most_two_hundred_visits_per_session_dropping_the_oldest() {
    let conn = seeded();
    let total = MAX_VISITS_PER_SESSION + 5;
    for index in 0..total {
        record_visit(
            &conn,
            "s1",
            &format!("http://localhost:5173/page/{index}"),
            "Page",
            index,
        )
        .expect("saves");
    }
    record_visit(&conn, "s2", "http://localhost:5173/other", "Other", 1).expect("saves");

    let kept: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM browser_visits WHERE session_id = 's1'",
            [],
            |row| row.get(0),
        )
        .expect("counts");
    assert_eq!(kept, MAX_VISITS_PER_SESSION);
    let oldest: i64 = conn
        .query_row(
            "SELECT MIN(updated_at) FROM browser_visits WHERE session_id = 's1'",
            [],
            |row| row.get(0),
        )
        .expect("reads");
    assert_eq!(oldest, 5);

    let listed = list_visits(&conn, "s1", LISTED_VISITS).expect("lists");
    assert_eq!(listed.len() as i64, LISTED_VISITS);
    assert_eq!(
        listed[0].url,
        format!("http://localhost:5173/page/{}", total - 1)
    );
    assert_eq!(
        list_visits(&conn, "s2", LISTED_VISITS)
            .expect("lists")
            .len(),
        1
    );
}

#[test]
fn visits_go_with_the_session_tab_rows_on_archive() {
    let conn = seeded();
    record_visit(&conn, "s1", "http://localhost:5173/checkout", "Checkout", 1).expect("saves");
    record_visit(&conn, "s2", "http://localhost:5173/checkout", "Checkout", 1).expect("saves");

    delete_session_rows(&conn, "s1").expect("deletes");

    assert!(list_visits(&conn, "s1", LISTED_VISITS)
        .expect("lists")
        .is_empty());
    assert_eq!(
        list_visits(&conn, "s2", LISTED_VISITS)
            .expect("lists")
            .len(),
        1
    );
}

#[test]
fn the_stale_sweep_finds_an_archived_session_that_holds_only_visits() {
    let conn = seeded();
    record_visit(&conn, "s1", "http://localhost:5173/checkout", "Checkout", 1).expect("saves");
    conn.execute("UPDATE sessions SET archived_at = 9 WHERE id = 's1'", [])
        .expect("archives");

    assert_eq!(stale_session_ids(&conn, &[]).expect("sweeps"), vec!["s1"]);
}

#[test]
fn visits_go_when_the_session_row_is_deleted() {
    let conn = seeded();
    record_visit(&conn, "s1", "http://localhost:5173/checkout", "Checkout", 1).expect("saves");
    conn.execute("DELETE FROM sessions WHERE id = 's1'", [])
        .expect("deletes");

    assert!(list_visits(&conn, "s1", LISTED_VISITS)
        .expect("lists")
        .is_empty());
}
