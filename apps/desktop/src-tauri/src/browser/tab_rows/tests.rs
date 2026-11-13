use rusqlite::Connection;
use tauri::Url;

use super::{
    delete_row, delete_session_rows, list_rows, list_workspace_rows, pin_row, reorder_rows,
    save_row, stale_session_ids, unpin_row, MoveArgs, SaveArgs, TabOwner, TabRow,
};
use crate::browser::guard::AppOrigins;
use crate::browser::reason::{
    INVALID_ADDRESS, NOT_WEB_ADDRESS, TAB_ROWS_CHANGED, TAB_ROW_GONE, TAB_ROW_OWNER,
};
use crate::test_support::migrated_connection;
use crate::util::MessageError;

fn seeded() -> Connection {
    let conn = migrated_connection();
    conn.execute_batch(
        "PRAGMA foreign_keys = ON;
         INSERT INTO workspaces (id, name, slug, created_at, updated_at)
           VALUES ('w1', 'Harborline', 'harborline', 1, 1);
         INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at)
           VALUES ('s1', 'w1', 'Ship ledger-core', 'idle', 1, 1),
                  ('s2', 'w1', 'Fix notify-relay', 'idle', 1, 1);
         INSERT INTO projects (id, workspace_id, name, root_path, kind, created_at, updated_at)
           VALUES ('p1', 'w1', 'payments-api', '/work/payments-api', 'repo', 1, 1);",
    )
    .expect("seed applies");
    conn
}

fn origins() -> AppOrigins {
    AppOrigins::with_dev_origin(Some(
        Url::parse("http://localhost:1421").expect("dev origin parses"),
    ))
}

fn session(id: &str) -> TabOwner {
    TabOwner::Session {
        session_id: id.to_string(),
    }
}

fn project(id: &str) -> TabOwner {
    TabOwner::Project {
        project_id: id.to_string(),
    }
}

fn save_args(id: &str, owner: TabOwner, url: &str, title: &str) -> SaveArgs {
    SaveArgs {
        id: id.to_string(),
        owner,
        url: url.to_string(),
        title: title.to_string(),
    }
}

fn move_args(id: &str) -> MoveArgs {
    MoveArgs {
        id: id.to_string(),
        session_id: "s1".to_string(),
        project_id: "p1".to_string(),
    }
}

fn save(conn: &Connection, id: &str, owner: TabOwner, url: &str) {
    save_row(
        conn,
        &origins(),
        &save_args(id, owner, url, "Northwind"),
        10,
    )
    .expect("row saves");
}

fn ids(rows: &[TabRow]) -> Vec<&str> {
    rows.iter().map(|row| row.id.as_str()).collect()
}

fn listed(conn: &Connection, owner: &TabOwner) -> Vec<TabRow> {
    list_rows(conn, owner).expect("rows list")
}

fn reason_of(error: MessageError) -> String {
    match error {
        MessageError::Refused(code) | MessageError::Failed(code) => code,
    }
}

#[test]
fn saves_new_rows_at_the_end_of_their_owner() {
    let conn = seeded();
    save(&conn, "a", session("s1"), "https://acme.example/");
    save(&conn, "b", session("s1"), "https://acme.example/docs");
    save(&conn, "c", session("s2"), "https://acme.example/other");

    let rows = listed(&conn, &session("s1"));

    assert_eq!(ids(&rows), vec!["a", "b"]);
    assert_eq!(rows[1].position, 1);
    assert_eq!(listed(&conn, &session("s2")).len(), 1);
}

#[test]
fn lists_the_session_and_pinned_rows_of_one_workspace_in_one_read() {
    let conn = seeded();
    conn.execute_batch(
        "INSERT INTO workspaces (id, name, slug, created_at, updated_at)
           VALUES ('w2', 'Cascadia', 'cascadia', 1, 1);
         INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at)
           VALUES ('s3', 'w2', 'Review payments-api', 'idle', 1, 1);
         INSERT INTO projects (id, workspace_id, name, root_path, kind, created_at, updated_at)
           VALUES ('p2', 'w2', 'ledger-core', '/work/ledger-core', 'repo', 1, 1);",
    )
    .expect("second workspace seeds");
    save(&conn, "a", session("s1"), "https://acme.example/");
    save(&conn, "b", session("s2"), "https://acme.example/docs");
    save(&conn, "c", project("p1"), "https://acme.example/pinned");
    save(&conn, "d", session("s3"), "https://acme.example/other");
    save(&conn, "e", project("p2"), "https://acme.example/other-pin");

    let first = list_workspace_rows(&conn, "w1").expect("rows list");
    let second = list_workspace_rows(&conn, "w2").expect("rows list");

    let mut first_ids = ids(&first);
    first_ids.sort();
    assert_eq!(first_ids, vec!["a", "b", "c"]);
    let mut second_ids = ids(&second);
    second_ids.sort();
    assert_eq!(second_ids, vec!["d", "e"]);
    assert!(list_workspace_rows(&conn, "missing")
        .expect("rows list")
        .is_empty());
}

#[test]
fn saving_an_existing_row_updates_url_and_title_and_keeps_position() {
    let conn = seeded();
    save(&conn, "a", session("s1"), "https://acme.example/");
    save(&conn, "b", session("s1"), "https://acme.example/docs");

    let saved = save_row(
        &conn,
        &origins(),
        &save_args(
            "a",
            session("s1"),
            "https://acme.example/next",
            "  Cascadia  ",
        ),
        20,
    )
    .expect("row updates");

    assert_eq!(saved.url, "https://acme.example/next");
    assert_eq!(saved.title, "Cascadia");
    assert_eq!(saved.position, 0);
    assert_eq!(saved.created_at, 10);
    assert_eq!(saved.updated_at, 20);
}

#[test]
fn refuses_to_save_over_a_row_another_owner_holds() {
    let conn = seeded();
    save(&conn, "a", session("s1"), "https://acme.example/");

    let error = save_row(
        &conn,
        &origins(),
        &save_args("a", session("s2"), "https://acme.example/", ""),
        20,
    )
    .expect_err("owner mismatch refused");

    assert_eq!(reason_of(error), TAB_ROW_OWNER);
}

#[test]
fn refuses_addresses_that_are_not_the_web() {
    let conn = seeded();

    for address in [
        "file://acme.example/plan.html",
        "gblocal://localhost/0f1e/work/harborline/plan.html",
        "javascript:alert(1)",
        "http://localhost:1421/",
    ] {
        let error = save_row(
            &conn,
            &origins(),
            &save_args("a", session("s1"), address, ""),
            10,
        )
        .expect_err("address refused");
        assert_eq!(reason_of(error), NOT_WEB_ADDRESS);
    }
    let error = save_row(
        &conn,
        &origins(),
        &save_args("a", session("s1"), "not a url", ""),
        10,
    )
    .expect_err("garbage refused");
    assert_eq!(reason_of(error), INVALID_ADDRESS);
    assert!(listed(&conn, &session("s1")).is_empty());
}

#[test]
fn stores_a_local_file_by_its_file_address_and_never_its_live_one() {
    let conn = seeded();
    let saved = save_row(
        &conn,
        &origins(),
        &save_args(
            "a",
            session("s1"),
            "file:///work/harborline/plan%20v2.html",
            "Plan",
        ),
        10,
    )
    .expect("row saves");

    assert_eq!(saved.url, "file:///work/harborline/plan%20v2.html");
}

#[test]
fn strips_credentials_from_a_stored_address_and_keeps_the_query() {
    let conn = seeded();
    let saved = save_row(
        &conn,
        &origins(),
        &save_args(
            "a",
            session("s1"),
            "https://ana:hunter2@acme.example/docs?page=2#top",
            "",
        ),
        10,
    )
    .expect("row saves");

    assert_eq!(saved.url, "https://acme.example/docs?page=2#top");
    assert_eq!(
        listed(&conn, &session("s1"))[0].url,
        "https://acme.example/docs?page=2#top"
    );
}

#[test]
fn stores_a_blank_page_but_nothing_longer_than_the_caps() {
    let conn = seeded();
    save(&conn, "a", session("s1"), "about:blank");
    let long_title = "t".repeat(2000);
    let saved = save_row(
        &conn,
        &origins(),
        &save_args("b", session("s1"), "https://acme.example/", &long_title),
        10,
    )
    .expect("row saves");
    let long_address = format!("https://acme.example/{}", "p".repeat(9000));
    let error = save_row(
        &conn,
        &origins(),
        &save_args("c", session("s1"), &long_address, ""),
        10,
    )
    .expect_err("long address refused");

    assert_eq!(saved.title.chars().count(), 512);
    assert_eq!(reason_of(error), INVALID_ADDRESS);
}

#[test]
fn reorders_to_the_given_order_and_rewrites_positions() {
    let conn = seeded();
    save(&conn, "a", session("s1"), "https://acme.example/1");
    save(&conn, "b", session("s1"), "https://acme.example/2");
    save(&conn, "c", session("s1"), "https://acme.example/3");

    let rows = reorder_rows(
        &conn,
        &session("s1"),
        &["c".to_string(), "a".to_string(), "b".to_string()],
        30,
    )
    .expect("rows reorder");

    assert_eq!(ids(&rows), vec!["c", "a", "b"]);
    assert_eq!(
        rows.iter().map(|row| row.position).collect::<Vec<_>>(),
        vec![0, 1, 2]
    );
}

#[test]
fn refuses_a_reorder_that_is_not_the_current_set() {
    let conn = seeded();
    save(&conn, "a", session("s1"), "https://acme.example/1");
    save(&conn, "b", session("s1"), "https://acme.example/2");

    for stale in [
        vec!["a".to_string()],
        vec!["a".to_string(), "x".to_string()],
        vec!["a".to_string(), "b".to_string(), "c".to_string()],
    ] {
        let error = reorder_rows(&conn, &session("s1"), &stale, 30).expect_err("stale refused");
        assert_eq!(reason_of(error), TAB_ROWS_CHANGED);
    }
    assert_eq!(ids(&listed(&conn, &session("s1"))), vec!["a", "b"]);
}

#[test]
fn deleting_is_idempotent_and_scoped_to_the_owner() {
    let conn = seeded();
    save(&conn, "a", session("s1"), "https://acme.example/");

    let error = delete_row(&conn, &session("s2"), "a").expect_err("other owner refused");
    assert_eq!(reason_of(error), TAB_ROW_OWNER);
    assert_eq!(listed(&conn, &session("s1")).len(), 1);

    delete_row(&conn, &session("s1"), "a").expect("row deletes");
    delete_row(&conn, &session("s1"), "a").expect("second delete is a no-op");
    assert!(listed(&conn, &session("s1")).is_empty());
}

#[test]
fn deleting_session_rows_keeps_pins_and_other_sessions() {
    let conn = seeded();
    save(&conn, "a", session("s1"), "https://acme.example/1");
    save(&conn, "b", session("s1"), "https://acme.example/2");
    save(&conn, "c", session("s2"), "https://acme.example/3");
    pin_row(&conn, &move_args("b"), 40).expect("row pins");

    let removed = delete_session_rows(&conn, "s1").expect("session rows delete");

    assert_eq!(removed, 1);
    assert_eq!(ids(&listed(&conn, &project("p1"))), vec!["b"]);
    assert_eq!(ids(&listed(&conn, &session("s2"))), vec!["c"]);
}

#[test]
fn pin_moves_a_row_to_the_project_and_unpin_moves_it_back() {
    let conn = seeded();
    save(&conn, "a", session("s1"), "https://acme.example/1");
    save(&conn, "b", session("s1"), "https://acme.example/2");

    let pinned = pin_row(&conn, &move_args("a"), 40).expect("row pins");
    assert_eq!(pinned.session_id, None);
    assert_eq!(pinned.project_id.as_deref(), Some("p1"));
    assert_eq!(pinned.position, 0);
    assert_eq!(ids(&listed(&conn, &session("s1"))), vec!["b"]);

    let again = pin_row(&conn, &move_args("a"), 50).expect("pin is idempotent");
    assert_eq!(again.updated_at, 40);

    let unpinned = unpin_row(&conn, &move_args("a"), 60).expect("row unpins");
    assert_eq!(unpinned.session_id.as_deref(), Some("s1"));
    assert_eq!(unpinned.project_id, None);
    assert_eq!(unpinned.position, 2);

    let again = unpin_row(&conn, &move_args("a"), 70).expect("unpin is idempotent");
    assert_eq!(again.updated_at, 60);
}

#[test]
fn pin_and_unpin_name_both_targets_and_refuse_a_stranger() {
    let conn = seeded();
    save(&conn, "a", session("s2"), "https://acme.example/1");

    let error = pin_row(&conn, &move_args("a"), 40).expect_err("row of another session refused");
    assert_eq!(reason_of(error), TAB_ROW_OWNER);
    let error = pin_row(&conn, &move_args("missing"), 40).expect_err("missing row refused");
    assert_eq!(reason_of(error), TAB_ROW_GONE);
    let error = unpin_row(&conn, &move_args("a"), 40).expect_err("row of another session refused");
    assert_eq!(reason_of(error), TAB_ROW_OWNER);
}

#[test]
fn names_the_sessions_whose_tabs_outlived_them() {
    let conn = seeded();
    save(&conn, "a", session("s1"), "https://acme.example/1");
    save(&conn, "b", session("s2"), "https://acme.example/2");
    save(&conn, "c", project("p1"), "https://acme.example/3");
    assert!(stale_session_ids(&conn, &[]).expect("lists").is_empty());

    conn.execute("UPDATE sessions SET archived_at = 5 WHERE id = 's1'", [])
        .expect("session archives");
    let live = vec!["s1".to_string(), "s2".to_string(), "gone".to_string()];

    assert_eq!(
        stale_session_ids(&conn, &live).expect("lists"),
        vec!["gone".to_string(), "s1".to_string()]
    );
    assert_eq!(
        stale_session_ids(&conn, &[]).expect("lists"),
        vec!["s1".to_string()]
    );
}

#[test]
fn rows_follow_their_session_and_project_on_delete() {
    let conn = seeded();
    save(&conn, "a", session("s1"), "https://acme.example/1");
    save(&conn, "b", project("p1"), "https://acme.example/2");

    conn.execute("DELETE FROM sessions WHERE id = 's1'", [])
        .expect("session deletes");
    assert!(listed(&conn, &session("s1")).is_empty());
    assert_eq!(listed(&conn, &project("p1")).len(), 1);

    conn.execute("DELETE FROM projects WHERE id = 'p1'", [])
        .expect("project deletes");
    assert!(listed(&conn, &project("p1")).is_empty());
}
