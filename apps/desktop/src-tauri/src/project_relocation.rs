use rusqlite::{params, Connection, Transaction};
use serde::{Deserialize, Serialize};
use tauri::State;
use thiserror::Error;

use crate::db::Db;
use crate::proc::git::Git;
use crate::worktree_writer::{acquire_lease, release_lease, WriterLeases};

#[derive(Debug, Error)]
pub enum ProjectRelocationError {
    #[error("project folder changed since it was checked")]
    StaleRoot,
    #[error("the selected folder is already linked to another project")]
    ProjectCollision,
    #[error("a session folder already uses the destination path")]
    WorktreeCollision,
    #[error("an agent is writing in this repository")]
    WriterActive,
    #[error("project not found")]
    ProjectNotFound,
    #[error("relocation not found or already undone")]
    RelocationNotFound,
    #[error("database unavailable")]
    DatabaseUnavailable,
    #[error("sqlite error: {0}")]
    Sqlite(#[from] rusqlite::Error),
}

crate::util::impl_error_serialize!(ProjectRelocationError);

impl ProjectRelocationError {
    fn kind(&self) -> &'static str {
        match self {
            Self::StaleRoot => "stale_root",
            Self::ProjectCollision => "project_collision",
            Self::WorktreeCollision => "worktree_collision",
            Self::WriterActive => "writer_active",
            Self::ProjectNotFound => "project_not_found",
            Self::RelocationNotFound => "relocation_not_found",
            Self::DatabaseUnavailable => "database_unavailable",
            Self::Sqlite(_) => "sqlite",
        }
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectRelocateArgs {
    pub relocation_id: String,
    pub project_id: String,
    pub from_root: String,
    pub to_root: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectRelocationUndoArgs {
    pub relocation_id: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectRelocationResult {
    pub relocation_id: String,
    pub repaired_git_links: bool,
    pub restored_session_folders: usize,
}

fn normalized_root(path: &str) -> String {
    let trimmed = path.trim_end_matches('/');
    if trimmed.is_empty() {
        return "/".to_string();
    }
    trimmed.to_string()
}

fn has_prefix(path: &str, root: &str) -> bool {
    path == root
        || path
            .strip_prefix(root)
            .map(|suffix| suffix.starts_with('/'))
            .unwrap_or(false)
}

fn replace_prefix(path: &str, from_root: &str, to_root: &str) -> String {
    if path == from_root {
        return to_root.to_string();
    }
    path.strip_prefix(from_root)
        .filter(|suffix| suffix.starts_with('/'))
        .map(|suffix| format!("{to_root}{suffix}"))
        .unwrap_or_else(|| path.to_string())
}

fn prefixed_paths(
    tx: &Transaction<'_>,
    project_id: &str,
    from_root: &str,
) -> Result<Vec<String>, ProjectRelocationError> {
    let mut statement = tx.prepare(
        "SELECT worktree_path FROM session_worktrees WHERE project_id = ? AND worktree_path IS NOT NULL",
    )?;
    let rows = statement.query_map([project_id], |row| row.get::<_, String>(0))?;
    Ok(rows
        .filter_map(Result::ok)
        .filter(|path| has_prefix(path, from_root))
        .collect())
}

fn verify_move(
    tx: &Transaction<'_>,
    project_id: &str,
    from_root: &str,
    to_root: &str,
    worktree_paths: &[String],
) -> Result<(), ProjectRelocationError> {
    let current: Option<String> = tx
        .query_row(
            "SELECT root_path FROM projects WHERE id = ?",
            [project_id],
            |row| row.get(0),
        )
        .optional()?;
    let Some(current) = current else {
        return Err(ProjectRelocationError::ProjectNotFound);
    };
    if normalized_root(&current) != from_root {
        return Err(ProjectRelocationError::StaleRoot);
    }
    let project_collision: i64 = tx.query_row(
        "SELECT COUNT(*) FROM projects WHERE id != ? AND root_path = ?",
        params![project_id, to_root],
        |row| row.get(0),
    )?;
    if project_collision > 0 {
        return Err(ProjectRelocationError::ProjectCollision);
    }
    for path in worktree_paths {
        let target = replace_prefix(path, from_root, to_root);
        let collision: i64 = tx.query_row(
            "SELECT COUNT(*) FROM session_worktrees WHERE project_id != ? AND worktree_path = ?",
            params![project_id, target],
            |row| row.get(0),
        )?;
        if collision > 0 {
            return Err(ProjectRelocationError::WorktreeCollision);
        }
    }
    Ok(())
}

fn update_path_column(
    tx: &Transaction<'_>,
    table: &str,
    column: &str,
    from_root: &str,
    to_root: &str,
) -> Result<(), ProjectRelocationError> {
    let sql = format!(
        "UPDATE {table} SET {column} = ? || substr({column}, ? + 1) WHERE {column} = ? OR {column} LIKE ?"
    );
    tx.execute(
        &sql,
        params![
            to_root,
            from_root.len() as i64,
            from_root,
            format!("{from_root}/%")
        ],
    )?;
    Ok(())
}

fn update_paths(
    tx: &Transaction<'_>,
    project_id: &str,
    from_root: &str,
    to_root: &str,
    now: i64,
) -> Result<(), ProjectRelocationError> {
    tx.execute(
        "UPDATE projects SET root_path = ?, updated_at = ? WHERE id = ?",
        params![to_root, now, project_id],
    )?;
    for column in ["worktree_path", "last_worktree_path"] {
        update_path_column(tx, "session_worktrees", column, from_root, to_root)?;
    }
    for column in ["repo_root", "worktree_path"] {
        update_path_column(tx, "retained_worktree_paths", column, from_root, to_root)?;
    }
    update_path_column(tx, "worktree_roots", "repo_root", from_root, to_root)?;
    update_path_column(
        tx,
        "resolve_candidates",
        "worktree_path",
        from_root,
        to_root,
    )?;
    update_path_column(tx, "resolve_attempts", "worktree_path", from_root, to_root)?;
    update_path_column(
        tx,
        "resolve_publications",
        "worktree_path",
        from_root,
        to_root,
    )?;
    update_path_column(tx, "skills", "file_path", from_root, to_root)?;
    tx.execute(
        "UPDATE mount_operations SET input_json = replace(input_json, ?, ?), result_json = replace(result_json, ?, ?) WHERE input_json LIKE ? OR result_json LIKE ?",
        params![from_root, to_root, from_root, to_root, format!("%{from_root}%"), format!("%{from_root}%")],
    )?;
    tx.execute(
        "UPDATE session_worktrees SET disk_state = 'unchecked', updated_at = ? WHERE project_id = ?",
        params![now, project_id],
    )?;
    Ok(())
}

fn repair_git_links(to_root: &str, worktree_paths: &[String]) -> bool {
    Git::new()
        .cwd(to_root)
        .args(["worktree", "repair"])
        .args(worktree_paths)
        .output()
        .map(|output| output.success())
        .unwrap_or(false)
}

fn relocate_with_connection(
    connection: &mut Connection,
    args: &ProjectRelocateArgs,
    now: i64,
) -> Result<Vec<String>, ProjectRelocationError> {
    let from_root = normalized_root(&args.from_root);
    let to_root = normalized_root(&args.to_root);
    let tx = connection.transaction()?;
    let worktree_paths = prefixed_paths(&tx, &args.project_id, &from_root)?;
    verify_move(&tx, &args.project_id, &from_root, &to_root, &worktree_paths)?;
    update_paths(&tx, &args.project_id, &from_root, &to_root, now)?;
    tx.execute(
        "INSERT INTO project_relocations (id, project_id, from_root, to_root, moved_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        params![args.relocation_id, args.project_id, from_root, to_root, now, now, now],
    )?;
    tx.commit()?;
    Ok(worktree_paths
        .iter()
        .map(|path| replace_prefix(path, &from_root, &to_root))
        .collect())
}

fn undo_with_connection(
    connection: &mut Connection,
    relocation_id: &str,
    now: i64,
) -> Result<(String, Vec<String>), ProjectRelocationError> {
    let tx = connection.transaction()?;
    let relocation = tx
        .query_row(
            "SELECT project_id, from_root, to_root FROM project_relocations WHERE id = ? AND undone_at IS NULL",
            [relocation_id],
            |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?, row.get::<_, String>(2)?)),
        )
        .optional()?;
    let Some((project_id, from_root, to_root)) = relocation else {
        return Err(ProjectRelocationError::RelocationNotFound);
    };
    let worktree_paths = prefixed_paths(&tx, &project_id, &to_root)?;
    verify_move(&tx, &project_id, &to_root, &from_root, &worktree_paths)?;
    update_paths(&tx, &project_id, &to_root, &from_root, now)?;
    tx.execute(
        "UPDATE project_relocations SET undone_at = ?, updated_at = ? WHERE id = ?",
        params![now, now, relocation_id],
    )?;
    tx.commit()?;
    Ok((
        from_root.clone(),
        worktree_paths
            .iter()
            .map(|path| replace_prefix(path, &to_root, &from_root))
            .collect(),
    ))
}

#[tauri::command]
pub async fn project_relocate(
    args: ProjectRelocateArgs,
    db: State<'_, Db>,
    leases: State<'_, WriterLeases>,
) -> Result<ProjectRelocationResult, ProjectRelocationError> {
    let from_root = normalized_root(&args.from_root);
    let holder = format!("project-relocation:{}", args.relocation_id);
    let lease = acquire_lease(&leases.0, &from_root, &holder, None);
    if !lease.is_granted {
        return Err(ProjectRelocationError::WriterActive);
    }
    let result =
        db.0.lock()
            .map_err(|_| ProjectRelocationError::DatabaseUnavailable)
            .and_then(|mut connection| {
                relocate_with_connection(&mut connection, &args, crate::util::now_ms())
            });
    release_lease(&leases.0, &from_root, &holder, lease.token.as_deref());
    let worktree_paths = result?;
    let repaired_git_links = repair_git_links(&args.to_root, &worktree_paths);
    Ok(ProjectRelocationResult {
        relocation_id: args.relocation_id,
        repaired_git_links,
        restored_session_folders: worktree_paths.len(),
    })
}

#[tauri::command]
pub async fn project_relocation_undo(
    args: ProjectRelocationUndoArgs,
    db: State<'_, Db>,
    leases: State<'_, WriterLeases>,
) -> Result<ProjectRelocationResult, ProjectRelocationError> {
    let mut connection =
        db.0.lock()
            .map_err(|_| ProjectRelocationError::DatabaseUnavailable)?;
    let current_root = connection
        .query_row(
            "SELECT to_root FROM project_relocations WHERE id = ? AND undone_at IS NULL",
            [&args.relocation_id],
            |row| row.get::<_, String>(0),
        )
        .optional()?
        .ok_or(ProjectRelocationError::RelocationNotFound)?;
    let holder = format!("project-relocation-undo:{}", args.relocation_id);
    let lease = acquire_lease(&leases.0, &current_root, &holder, None);
    if !lease.is_granted {
        return Err(ProjectRelocationError::WriterActive);
    }
    let result = undo_with_connection(&mut connection, &args.relocation_id, crate::util::now_ms());
    release_lease(&leases.0, &current_root, &holder, lease.token.as_deref());
    let (restored_root, worktree_paths) = result?;
    let repaired_git_links = repair_git_links(&restored_root, &worktree_paths);
    Ok(ProjectRelocationResult {
        relocation_id: args.relocation_id,
        repaired_git_links,
        restored_session_folders: worktree_paths.len(),
    })
}

trait OptionalRow<T> {
    fn optional(self) -> Result<Option<T>, rusqlite::Error>;
}

impl<T> OptionalRow<T> for Result<T, rusqlite::Error> {
    fn optional(self) -> Result<Option<T>, rusqlite::Error> {
        match self {
            Ok(value) => Ok(Some(value)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(error) => Err(error),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_root(name: &str) -> std::path::PathBuf {
        let root = std::env::temp_dir().join(format!(
            "goodboy-relocation-{name}-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .expect("clock advances")
                .as_nanos()
        ));
        std::fs::create_dir_all(&root).expect("test root creates");
        root
    }

    fn git(root: &std::path::Path, args: &[&str]) -> std::process::Output {
        crate::path_env::command("git")
            .args(args)
            .current_dir(root)
            .output()
            .expect("git runs")
    }

    fn database() -> Connection {
        let connection = Connection::open_in_memory().expect("database opens");
        connection
            .execute_batch(
                "CREATE TABLE projects (id TEXT PRIMARY KEY, root_path TEXT UNIQUE, updated_at INTEGER);\
                 CREATE TABLE session_worktrees (id TEXT PRIMARY KEY, project_id TEXT, worktree_path TEXT UNIQUE, last_worktree_path TEXT, disk_state TEXT, updated_at INTEGER);\
                 CREATE TABLE retained_worktree_paths (id TEXT PRIMARY KEY, repo_root TEXT, worktree_path TEXT);\
                 CREATE TABLE worktree_roots (repo_root TEXT PRIMARY KEY);\
                 CREATE TABLE resolve_candidates (id TEXT PRIMARY KEY, worktree_path TEXT);\
                 CREATE TABLE resolve_attempts (id TEXT PRIMARY KEY, worktree_path TEXT);\
                 CREATE TABLE resolve_publications (id TEXT PRIMARY KEY, worktree_path TEXT);\
                 CREATE TABLE skills (id TEXT PRIMARY KEY, file_path TEXT);\
                 CREATE TABLE mount_operations (id TEXT PRIMARY KEY, input_json TEXT, result_json TEXT);\
                 CREATE TABLE project_relocations (id TEXT PRIMARY KEY, project_id TEXT, from_root TEXT, to_root TEXT, moved_at INTEGER, undone_at INTEGER, created_at INTEGER, updated_at INTEGER);",
            )
            .expect("schema applies");
        connection
    }

    fn seed(connection: &Connection) {
        connection
            .execute(
                "INSERT INTO projects VALUES ('project', '/old/repo', 1)",
                [],
            )
            .expect("project inserts");
        connection
            .execute(
                "INSERT INTO session_worktrees VALUES ('mount', 'project', '/old/repo/.goodboy/worktrees/task', '/old/repo/.goodboy/worktrees/task', 'missing', 1)",
                [],
            )
            .expect("mount inserts");
        connection
            .execute(
                "INSERT INTO retained_worktree_paths VALUES ('kept', '/old/repo', '/old/repo/.goodboy/worktrees/kept')",
                [],
            )
            .expect("kept path inserts");
        connection
            .execute("INSERT INTO worktree_roots VALUES ('/old/repo')", [])
            .expect("root inserts");
        connection
            .execute(
                "INSERT INTO skills VALUES ('skill', '/old/repo/.goodboy/skills/review/SKILL.md')",
                [],
            )
            .expect("skill inserts");
    }

    fn args() -> ProjectRelocateArgs {
        ProjectRelocateArgs {
            relocation_id: "relocation".to_string(),
            project_id: "project".to_string(),
            from_root: "/old/repo".to_string(),
            to_root: "/new/repo".to_string(),
        }
    }

    #[test]
    fn relocate_rewrites_owned_paths_and_undo_restores_them() {
        let mut connection = database();
        seed(&connection);

        let paths = relocate_with_connection(&mut connection, &args(), 2).expect("move succeeds");
        assert_eq!(paths, vec!["/new/repo/.goodboy/worktrees/task"]);
        assert_eq!(
            connection
                .query_row("SELECT root_path FROM projects", [], |row| row
                    .get::<_, String>(0))
                .expect("project reads"),
            "/new/repo"
        );
        assert_eq!(
            connection
                .query_row("SELECT file_path FROM skills", [], |row| row
                    .get::<_, String>(0))
                .expect("skill reads"),
            "/new/repo/.goodboy/skills/review/SKILL.md"
        );

        let (_, restored) =
            undo_with_connection(&mut connection, "relocation", 3).expect("undo succeeds");
        assert_eq!(restored, vec!["/old/repo/.goodboy/worktrees/task"]);
        assert_eq!(
            connection
                .query_row("SELECT undone_at FROM project_relocations", [], |row| row
                    .get::<_, i64>(
                    0
                ))
                .expect("relocation reads"),
            3
        );
    }

    #[test]
    fn collision_rolls_back_every_path_change() {
        let mut connection = database();
        seed(&connection);
        connection
            .execute("INSERT INTO projects VALUES ('other', '/new/repo', 1)", [])
            .expect("other project inserts");

        let error = relocate_with_connection(&mut connection, &args(), 2).expect_err("move fails");

        assert!(matches!(error, ProjectRelocationError::ProjectCollision));
        assert_eq!(
            connection
                .query_row(
                    "SELECT root_path FROM projects WHERE id = 'project'",
                    [],
                    |row| row.get::<_, String>(0)
                )
                .expect("project reads"),
            "/old/repo"
        );
        assert_eq!(
            connection
                .query_row("SELECT COUNT(*) FROM project_relocations", [], |row| row
                    .get::<_, i64>(0))
                .expect("count reads"),
            0
        );
    }

    #[test]
    fn repairs_git_links_after_moving_a_repo_in_both_directions() {
        let root = test_root("git-repair");
        let original_parent = root.join("original");
        let moved_parent = root.join("moved");
        let original_repo = original_parent.join("ledger-core");
        std::fs::create_dir_all(&original_repo).expect("repo creates");
        assert!(git(&original_repo, &["init"]).status.success());
        assert!(
            git(&original_repo, &["config", "user.name", "Goodboy Test"])
                .status
                .success()
        );
        assert!(git(
            &original_repo,
            &["config", "user.email", "goodboy@localhost"]
        )
        .status
        .success());
        std::fs::write(original_repo.join(".gitignore"), "/.goodboy\n").expect("ignore writes");
        assert!(git(&original_repo, &["add", ".gitignore"]).status.success());
        assert!(git(&original_repo, &["commit", "-m", "initial"])
            .status
            .success());
        let original_worktree = original_repo.join(".goodboy/worktrees/task");
        assert!(git(
            &original_repo,
            &[
                "worktree",
                "add",
                "-b",
                "goodboy/task",
                original_worktree.to_string_lossy().as_ref(),
            ],
        )
        .status
        .success());

        std::fs::create_dir_all(&moved_parent).expect("moved parent creates");
        let moved_repo = moved_parent.join("ledger-core");
        std::fs::rename(&original_repo, &moved_repo).expect("repo moves");
        let moved_worktree = moved_repo.join(".goodboy/worktrees/task");
        assert!(repair_git_links(
            moved_repo.to_string_lossy().as_ref(),
            &[moved_worktree.to_string_lossy().into_owned()],
        ));
        let moved_list = git(&moved_repo, &["worktree", "list", "--porcelain"]);
        assert!(String::from_utf8_lossy(&moved_list.stdout)
            .contains(moved_worktree.to_string_lossy().as_ref()));

        std::fs::rename(&moved_repo, &original_repo).expect("repo restores");
        assert!(repair_git_links(
            original_repo.to_string_lossy().as_ref(),
            &[original_worktree.to_string_lossy().into_owned()],
        ));
        let restored_list = git(&original_repo, &["worktree", "list", "--porcelain"]);
        assert!(String::from_utf8_lossy(&restored_list.stdout)
            .contains(original_worktree.to_string_lossy().as_ref()));
        std::fs::remove_dir_all(root).expect("test root removes");
    }
}
