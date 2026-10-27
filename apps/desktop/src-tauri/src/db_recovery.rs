use std::path::{Path, PathBuf};

use crate::db::{move_if_present, open_connection, resolve_db_path, with_suffix, DbError};

fn kept_path(path: &Path, stamp: u64) -> PathBuf {
    with_suffix(path, &format!(".unopened-{stamp}"))
}

fn check_openable_at(path: &Path) -> Result<(), DbError> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    open_connection(path).map(drop)
}

fn move_aside(path: &Path, stamp: u64) -> Result<PathBuf, DbError> {
    if !path.exists() {
        return Err(DbError::MigrationSnapshotFilesystem(
            "there is no database file to move aside".to_string(),
        ));
    }
    let kept = kept_path(path, stamp);
    if kept.exists() {
        return Err(DbError::MigrationSnapshotFilesystem(format!(
            "{} already exists",
            kept.display()
        )));
    }
    move_if_present(path, &kept)?;
    for suffix in ["-wal", "-shm"] {
        move_if_present(&with_suffix(path, suffix), &with_suffix(&kept, suffix))?;
    }
    Ok(kept)
}

#[tauri::command(async)]
pub fn db_check_openable() -> Result<(), DbError> {
    check_openable_at(&resolve_db_path()?)
}

#[tauri::command(async)]
pub fn db_move_aside() -> Result<String, DbError> {
    let kept = move_aside(&resolve_db_path()?, crate::util::now_secs())?;
    Ok(kept.to_string_lossy().into_owned())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn scratch_dir(name: &str) -> PathBuf {
        let dir =
            std::env::temp_dir().join(format!("goodboy-db-aside-{name}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn a_file_that_is_not_a_database_does_not_open() {
        let dir = scratch_dir("garbage");
        let path = dir.join("data.db");
        std::fs::write(&path, b"this is not sqlite at all, only text").unwrap();

        assert!(check_openable_at(&path).is_err());
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn a_healthy_database_opens_again_and_stays_where_it_is() {
        let dir = scratch_dir("healthy");
        let path = dir.join("data.db");
        let conn = open_connection(&path).unwrap();
        conn.pragma_update(None, "user_version", 7).unwrap();
        drop(conn);

        assert!(check_openable_at(&path).is_ok());
        let reopened = open_connection(&path).unwrap();
        let version: i64 = reopened
            .pragma_query_value(None, "user_version", |row| row.get(0))
            .unwrap();
        assert_eq!(version, 7);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn moving_aside_keeps_the_file_and_its_journals_under_a_new_name() {
        let dir = scratch_dir("move");
        let path = dir.join("data.db");
        std::fs::write(&path, b"main").unwrap();
        std::fs::write(with_suffix(&path, "-wal"), b"wal").unwrap();
        std::fs::write(with_suffix(&path, "-shm"), b"shm").unwrap();

        let kept = move_aside(&path, 42).unwrap();

        assert_eq!(kept, dir.join("data.db.unopened-42"));
        assert!(!path.exists());
        assert!(!with_suffix(&path, "-wal").exists());
        assert!(!with_suffix(&path, "-shm").exists());
        assert_eq!(std::fs::read(&kept).unwrap(), b"main");
        assert_eq!(std::fs::read(with_suffix(&kept, "-wal")).unwrap(), b"wal");
        assert_eq!(std::fs::read(with_suffix(&kept, "-shm")).unwrap(), b"shm");
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn a_launch_after_moving_aside_creates_a_fresh_database() {
        let dir = scratch_dir("fresh");
        let path = dir.join("data.db");
        std::fs::write(&path, b"this is not sqlite at all, only text").unwrap();
        assert!(check_openable_at(&path).is_err());

        let kept = move_aside(&path, 7).unwrap();

        assert!(check_openable_at(&path).is_ok());
        let fresh = open_connection(&path).unwrap();
        let tables: i64 = fresh
            .query_row("SELECT count(*) FROM sqlite_master", [], |row| row.get(0))
            .unwrap();
        assert_eq!(tables, 0);
        assert_eq!(
            std::fs::read(&kept).unwrap(),
            b"this is not sqlite at all, only text"
        );
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn moving_aside_never_overwrites_an_earlier_copy() {
        let dir = scratch_dir("twice");
        let path = dir.join("data.db");
        std::fs::write(&path, b"second").unwrap();
        std::fs::write(dir.join("data.db.unopened-9"), b"first").unwrap();

        let outcome = move_aside(&path, 9);

        assert!(outcome.is_err());
        assert_eq!(std::fs::read(&path).unwrap(), b"second");
        assert_eq!(
            std::fs::read(dir.join("data.db.unopened-9")).unwrap(),
            b"first"
        );
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn moving_aside_without_a_file_says_so_and_creates_nothing() {
        let dir = scratch_dir("missing");
        let path = dir.join("data.db");

        let outcome = move_aside(&path, 1);

        assert!(matches!(
            outcome,
            Err(DbError::MigrationSnapshotFilesystem(_))
        ));
        assert!(!dir.join("data.db.unopened-1").exists());
        let _ = std::fs::remove_dir_all(&dir);
    }
}
