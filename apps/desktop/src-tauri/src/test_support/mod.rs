use rusqlite::Connection;

const MIGRATED_SCHEMA: &str = include_str!("migrated_schema.sql");

pub(crate) fn apply_migrated_schema(conn: &Connection) {
    conn.execute_batch(MIGRATED_SCHEMA)
        .expect("migrated schema fixture applies");
}

pub(crate) fn migrated_connection() -> Connection {
    let conn = Connection::open_in_memory().expect("memory database opens");
    apply_migrated_schema(&conn);
    conn
}

#[cfg(test)]
mod tests {
    use super::*;

    fn table_columns(conn: &Connection, table: &str) -> Vec<String> {
        let mut statement = conn
            .prepare(&format!("PRAGMA table_info({table})"))
            .expect("pragma prepares");
        statement
            .query_map([], |row| row.get::<_, String>(1))
            .expect("pragma runs")
            .map(|name| name.expect("column name reads"))
            .collect()
    }

    #[test]
    fn the_fixture_builds_the_real_tables_not_a_subset() {
        let conn = migrated_connection();
        let tables: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table'",
                [],
                |row| row.get(0),
            )
            .expect("tables count");

        assert!(tables > 80, "expected the full schema, got {tables} tables");
    }

    #[test]
    fn the_fixture_has_columns_a_hand_written_list_forgot() {
        let conn = migrated_connection();
        let columns = table_columns(&conn, "workspaces");

        assert!(columns.iter().any(|name| name == "after_merge"));
        assert!(!columns.iter().any(|name| name == "default_workflow_id"));
    }
}
