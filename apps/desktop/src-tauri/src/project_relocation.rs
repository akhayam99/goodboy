use rusqlite::{params, Connection, Transaction};
use serde::{Deserialize, Serialize};
use thiserror::Error;

use crate::db::Db;
use crate::proc::git::Git;
use crate::worktree_writer::{acquire_lease, release_lease, WriterLeaseRegistry, WriterLeases};
use tauri::Manager;

#[derive(Debug, Error)]
pub enum ProjectRelocationError {
    #[error("the folder changed since it was checked")]
    StaleRoot,
    #[error("another folder already uses the selected path")]
    ProjectCollision,
    #[error("a session folder already uses the destination path")]
    WorktreeCollision,
    #[error("an agent is writing in this repository")]
    WriterActive,
    #[error("folder not found")]
    ProjectNotFound,
    #[error("relocation not found or already undone")]
    RelocationNotFound,
    #[error("database unavailable")]
    DatabaseUnavailable,
    #[error("the destination is not a folder")]
    DestinationMissing,
    #[error("the destination holds a different repository")]
    DestinationDiffers,
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
            Self::DestinationMissing => "destination_missing",
            Self::DestinationDiffers => "destination_differs",
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
    pub repair_error: Option<String>,
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

fn at_or_under(column: &str) -> String {
    format!("({column} = ?1 OR substr({column}, 1, length(?1) + 1) = ?1 || '/')")
}

fn update_scoped_path_column(
    tx: &Transaction<'_>,
    table: &str,
    column: &str,
    scope: &str,
    paths: &MovedPaths<'_>,
) -> Result<(), ProjectRelocationError> {
    let sql = format!(
        "UPDATE {table} SET {column} = ?2 || substr({column}, length(?1) + 1) WHERE {} AND ({scope})",
        at_or_under(column)
    );
    tx.execute(
        &sql,
        params![paths.from_root, paths.to_root, paths.project_id],
    )?;
    Ok(())
}

struct MovedPaths<'a> {
    project_id: &'a str,
    from_root: &'a str,
    to_root: &'a str,
}

fn rewrite_json_paths(value: &mut serde_json::Value, from_root: &str, to_root: &str) -> bool {
    match value {
        serde_json::Value::String(text) => {
            if !has_prefix(text, from_root) {
                return false;
            }
            *text = replace_prefix(text, from_root, to_root);
            true
        }
        serde_json::Value::Array(items) => {
            let mut changed = false;
            for item in items.iter_mut() {
                changed |= rewrite_json_paths(item, from_root, to_root);
            }
            changed
        }
        serde_json::Value::Object(map) => {
            let mut changed = false;
            for item in map.values_mut() {
                changed |= rewrite_json_paths(item, from_root, to_root);
            }
            changed
        }
        _ => false,
    }
}

fn rewritten_json(raw: &str, from_root: &str, to_root: &str) -> Option<String> {
    let mut value: serde_json::Value = serde_json::from_str(raw).ok()?;
    rewrite_json_paths(&mut value, from_root, to_root).then(|| value.to_string())
}

fn update_operation_paths(
    tx: &Transaction<'_>,
    paths: &MovedPaths<'_>,
) -> Result<(), ProjectRelocationError> {
    let rows: Vec<(String, String, Option<String>)> = {
        let mut statement = tx.prepare(
            "SELECT id, input_json, result_json FROM mount_operations
             WHERE session_id IN (SELECT session_id FROM session_worktrees WHERE project_id = ?1)",
        )?;
        let found = statement.query_map([paths.project_id], |row| {
            Ok((row.get(0)?, row.get(1)?, row.get(2)?))
        })?;
        found.collect::<Result<_, _>>()?
    };
    for (id, input, result) in rows {
        let next_input = rewritten_json(&input, paths.from_root, paths.to_root);
        let next_result = result
            .as_deref()
            .and_then(|raw| rewritten_json(raw, paths.from_root, paths.to_root));
        if next_input.is_none() && next_result.is_none() {
            continue;
        }
        tx.execute(
            "UPDATE mount_operations SET input_json = ?1, result_json = ?2 WHERE id = ?3",
            params![next_input.unwrap_or(input), next_result.or(result), id],
        )?;
    }
    Ok(())
}

fn update_paths(
    tx: &Transaction<'_>,
    project_id: &str,
    from_root: &str,
    to_root: &str,
    now: i64,
) -> Result<(), ProjectRelocationError> {
    let paths = MovedPaths {
        project_id,
        from_root,
        to_root,
    };
    tx.execute(
        "UPDATE projects SET root_path = ?, updated_at = ? WHERE id = ?",
        params![to_root, now, project_id],
    )?;
    let own_mount = "mount_id IN (SELECT id FROM session_worktrees WHERE project_id = ?3)";
    let unowned_mount = "mount_id IS NULL";
    let own_or_unowned = format!("{own_mount} OR {unowned_mount}");
    let own_project = "project_id = ?3";
    let own_or_orphan = "project_id = ?3 OR project_id IS NULL";
    let own_workspace = "workspace_id = (SELECT workspace_id FROM projects WHERE id = ?3)";
    for column in ["worktree_path", "last_worktree_path"] {
        update_scoped_path_column(tx, "session_worktrees", column, own_project, &paths)?;
    }
    for column in ["repo_root", "worktree_path"] {
        update_scoped_path_column(tx, "retained_worktree_paths", column, own_or_orphan, &paths)?;
    }
    tx.execute(
        "UPDATE worktree_roots SET repo_root = ?2 WHERE repo_root = ?1",
        params![from_root, to_root],
    )?;
    for table in [
        "resolve_candidates",
        "resolve_attempts",
        "resolve_publications",
    ] {
        update_scoped_path_column(tx, table, "worktree_path", &own_or_unowned, &paths)?;
    }
    update_scoped_path_column(tx, "skills", "file_path", own_workspace, &paths)?;
    update_operation_paths(tx, &paths)?;
    tx.execute(
        "UPDATE session_worktrees SET disk_state = 'unchecked', updated_at = ? WHERE project_id = ?",
        params![now, project_id],
    )?;
    Ok(())
}

fn repair_git_links(to_root: &str, worktree_paths: &[String]) -> Result<(), String> {
    let output = Git::new()
        .cwd(to_root)
        .args(["worktree", "repair"])
        .args(worktree_paths)
        .output()
        .map_err(|error| error.to_string())?;
    match output.success() {
        true => Ok(()),
        false => Err(output.stderr_redacted().trim().to_string()),
    }
}

enum Expected {
    AnyFolder,
    RepoWithRootCommit(String),
}

fn destination_expectation(
    connection: &Connection,
    project_id: &str,
) -> Result<Expected, ProjectRelocationError> {
    let known: Option<(String, Option<String>)> = connection
        .query_row(
            "SELECT kind, root_commit FROM projects WHERE id = ?",
            [project_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .optional()?;
    Ok(match known {
        Some((kind, Some(root_commit))) if kind == "repo" => {
            Expected::RepoWithRootCommit(root_commit)
        }
        _ => Expected::AnyFolder,
    })
}

fn destination_verified(
    destination: &str,
    expected: &Expected,
) -> Result<(), ProjectRelocationError> {
    let path = std::path::Path::new(destination);
    if !path.is_dir() {
        return Err(ProjectRelocationError::DestinationMissing);
    }
    let Expected::RepoWithRootCommit(root_commit) = expected else {
        return Ok(());
    };
    let found = crate::repo::repo_identity_blocking(path)
        .map(|identity| identity.root_commits.contains(root_commit))
        .unwrap_or(false);
    match found {
        true => Ok(()),
        false => Err(ProjectRelocationError::DestinationDiffers),
    }
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

fn carried_over(
    from_root: &str,
    to_root: &str,
    worktree_paths: &[String],
) -> ProjectRelocationOutcome {
    let mut problems = Vec::new();
    if let Err(message) = repair_git_links(to_root, worktree_paths) {
        problems.push(format!("git links: {message}"));
    }
    if let Err(error) = crate::file_versions::rekey_folder_versions(from_root, to_root) {
        problems.push(format!("saved versions: {error}"));
    }
    ProjectRelocationOutcome {
        repair_error: match problems.is_empty() {
            true => None,
            false => Some(problems.join("; ")),
        },
    }
}

struct ProjectRelocationOutcome {
    repair_error: Option<String>,
}

fn expectation_of(db: &Db, project_id: &str) -> Result<Expected, ProjectRelocationError> {
    let connection =
        db.0.lock()
            .map_err(|_| ProjectRelocationError::DatabaseUnavailable)?;
    destination_expectation(&connection, project_id)
}

fn relocate_blocking(
    db: &Db,
    leases: &WriterLeaseRegistry,
    args: &ProjectRelocateArgs,
) -> Result<ProjectRelocationResult, ProjectRelocationError> {
    let from_root = normalized_root(&args.from_root);
    let to_root = normalized_root(&args.to_root);
    let holder = format!("project-relocation:{}", args.relocation_id);
    let lease = acquire_lease(leases, &from_root, &holder, None);
    if !lease.is_granted {
        return Err(ProjectRelocationError::WriterActive);
    }
    let result = expectation_of(db, &args.project_id)
        .and_then(|expected| destination_verified(&to_root, &expected))
        .and_then(|()| {
            db.0.lock()
                .map_err(|_| ProjectRelocationError::DatabaseUnavailable)
                .and_then(|mut connection| {
                    relocate_with_connection(&mut connection, args, crate::util::now_ms())
                })
        });
    release_lease(leases, &from_root, &holder, lease.token.as_deref());
    let worktree_paths = result?;
    let outcome = carried_over(&from_root, &to_root, &worktree_paths);
    Ok(ProjectRelocationResult {
        relocation_id: args.relocation_id.clone(),
        repaired_git_links: outcome.repair_error.is_none(),
        repair_error: outcome.repair_error,
        restored_session_folders: worktree_paths.len(),
    })
}

fn undo_blocking(
    db: &Db,
    leases: &WriterLeaseRegistry,
    args: &ProjectRelocationUndoArgs,
) -> Result<ProjectRelocationResult, ProjectRelocationError> {
    let (project_id, current_root, restored_root) = {
        let connection =
            db.0.lock()
                .map_err(|_| ProjectRelocationError::DatabaseUnavailable)?;
        connection
            .query_row(
                "SELECT project_id, to_root, from_root FROM project_relocations WHERE id = ? AND undone_at IS NULL",
                [&args.relocation_id],
                |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?, row.get::<_, String>(2)?)),
            )
            .optional()?
            .ok_or(ProjectRelocationError::RelocationNotFound)?
    };
    let holder = format!("project-relocation-undo:{}", args.relocation_id);
    let lease = acquire_lease(leases, &current_root, &holder, None);
    if !lease.is_granted {
        return Err(ProjectRelocationError::WriterActive);
    }
    let result = expectation_of(db, &project_id)
        .and_then(|expected| destination_verified(&restored_root, &expected))
        .and_then(|()| {
            db.0.lock()
                .map_err(|_| ProjectRelocationError::DatabaseUnavailable)
                .and_then(|mut connection| {
                    undo_with_connection(
                        &mut connection,
                        &args.relocation_id,
                        crate::util::now_ms(),
                    )
                })
        });
    release_lease(leases, &current_root, &holder, lease.token.as_deref());
    let (restored_root, worktree_paths) = result?;
    let outcome = carried_over(&current_root, &restored_root, &worktree_paths);
    Ok(ProjectRelocationResult {
        relocation_id: args.relocation_id.clone(),
        repaired_git_links: outcome.repair_error.is_none(),
        repair_error: outcome.repair_error,
        restored_session_folders: worktree_paths.len(),
    })
}

fn join_failure(error: tauri::Error) -> ProjectRelocationError {
    ProjectRelocationError::Sqlite(rusqlite::Error::ToSqlConversionFailure(Box::new(
        std::io::Error::other(error.to_string()),
    )))
}

#[tauri::command]
pub async fn project_relocate(
    args: ProjectRelocateArgs,
    app: tauri::AppHandle,
) -> Result<ProjectRelocationResult, ProjectRelocationError> {
    tauri::async_runtime::spawn_blocking(move || {
        relocate_blocking(&app.state::<Db>(), &app.state::<WriterLeases>().0, &args)
    })
    .await
    .map_err(join_failure)?
}

#[tauri::command]
pub async fn project_relocation_undo(
    args: ProjectRelocationUndoArgs,
    app: tauri::AppHandle,
) -> Result<ProjectRelocationResult, ProjectRelocationError> {
    tauri::async_runtime::spawn_blocking(move || {
        undo_blocking(&app.state::<Db>(), &app.state::<WriterLeases>().0, &args)
    })
    .await
    .map_err(join_failure)?
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
        crate::test_support::migrated_connection()
    }

    fn seed(connection: &Connection) {
        connection
            .execute_batch(
                "INSERT INTO workspaces (id, name, slug, created_at, updated_at)
                 VALUES ('workspace', 'Acme', 'acme', 1, 1);
                 INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at)
                 VALUES ('session', 'workspace', 'Goal', 'idle', 1, 1);",
            )
            .expect("workspace and session insert");
        connection
            .execute(
                "INSERT INTO projects (id, workspace_id, name, root_path, kind, created_at, updated_at)
                 VALUES ('project', 'workspace', 'payments-api', '/old/repo', 'repo', 1, 1)",
                [],
            )
            .expect("project inserts");
        connection
            .execute(
                "INSERT INTO session_worktrees
                   (id, session_id, worktree_path, branch, created_at, project_id, last_worktree_path, disk_state, updated_at)
                 VALUES ('mount', 'session', '/old/repo/.goodboy/worktrees/task', 'task', 1, 'project',
                         '/old/repo/.goodboy/worktrees/task', 'missing', 1)",
                [],
            )
            .expect("mount inserts");
        connection
            .execute(
                "INSERT INTO retained_worktree_paths
                   (id, repo_root, worktree_path, branch, reason, first_seen_at, created_at, updated_at)
                 VALUES ('kept', '/old/repo', '/old/repo/.goodboy/worktrees/kept', 'kept', 'unmount', 1, 1, 1)",
                [],
            )
            .expect("kept path inserts");
        connection
            .execute(
                "INSERT INTO worktree_roots (repo_root, first_seen_at, added_by)
                 VALUES ('/old/repo', 1, 'project')",
                [],
            )
            .expect("root inserts");
        connection
            .execute(
                "INSERT INTO skills (id, workspace_id, name, description, file_path, body, frontmatter_json, created_at, updated_at)
                 VALUES ('skill', 'workspace', 'review', 'Review', '/old/repo/.goodboy/skills/review/SKILL.md', 'body', '{}', 1, 1)",
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
            .execute(
                "INSERT INTO projects (id, workspace_id, name, root_path, kind, created_at, updated_at)
                 VALUES ('other', 'workspace', 'notify-relay', '/new/repo', 'repo', 1, 1)",
                [],
            )
            .expect("other project inserts");

        let error = relocate_with_connection(&mut connection, &args(), 2).expect_err("move fails");

        assert!(matches!(error, ProjectRelocationError::ProjectCollision));
        assert_eq!(
            error.to_string(),
            "another folder already uses the selected path"
        );
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
    fn says_folder_and_never_project_in_what_the_user_reads() {
        let messages = [
            ProjectRelocationError::StaleRoot,
            ProjectRelocationError::ProjectCollision,
            ProjectRelocationError::WorktreeCollision,
            ProjectRelocationError::WriterActive,
            ProjectRelocationError::ProjectNotFound,
            ProjectRelocationError::RelocationNotFound,
            ProjectRelocationError::DatabaseUnavailable,
        ]
        .map(|error| error.to_string());

        assert!(messages.iter().all(|message| !message.contains("project")));
        assert_eq!(messages[0], "the folder changed since it was checked");
        assert_eq!(messages[4], "folder not found");
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
        )
        .is_ok());
        let moved_list = git(&moved_repo, &["worktree", "list", "--porcelain"]);
        assert!(String::from_utf8_lossy(&moved_list.stdout)
            .contains(moved_worktree.to_string_lossy().as_ref()));

        std::fs::rename(&moved_repo, &original_repo).expect("repo restores");
        assert!(repair_git_links(
            original_repo.to_string_lossy().as_ref(),
            &[original_worktree.to_string_lossy().into_owned()],
        )
        .is_ok());
        let restored_list = git(&original_repo, &["worktree", "list", "--porcelain"]);
        assert!(String::from_utf8_lossy(&restored_list.stdout)
            .contains(original_worktree.to_string_lossy().as_ref()));
        std::fs::remove_dir_all(root).expect("test root removes");
    }

    fn insert_project(connection: &Connection, id: &str, root: &str) {
        connection
            .execute(
                "INSERT INTO projects (id, workspace_id, name, root_path, kind, created_at, updated_at)
                 VALUES (?, 'workspace', ?, ?, 'repo', 1, 1)",
                params![id, id, root],
            )
            .expect("project inserts");
    }

    fn insert_mount(connection: &Connection, id: &str, project_id: &str, path: &str) {
        connection
            .execute(
                "INSERT INTO session_worktrees
                   (id, session_id, worktree_path, branch, created_at, project_id, last_worktree_path, disk_state, updated_at)
                 VALUES (?, 'session', ?, ?, 1, ?, ?, 'missing', 1)",
                params![id, path, id, project_id, path],
            )
            .expect("mount inserts");
    }

    fn insert_retained(connection: &Connection, id: &str, project_id: Option<&str>, root: &str) {
        connection
            .execute(
                "INSERT INTO retained_worktree_paths
                   (id, project_id, repo_root, worktree_path, branch, reason, first_seen_at, created_at, updated_at)
                 VALUES (?, ?, ?, ?, 'kept', 'unmount', 1, 1, 1)",
                params![id, project_id, root, format!("{root}/.goodboy/worktrees/{id}")],
            )
            .expect("retained inserts");
    }

    fn text(connection: &Connection, sql: &str) -> String {
        connection
            .query_row(sql, [], |row| row.get::<_, String>(0))
            .expect("text reads")
    }

    fn move_args(project_id: &str, from_root: &str, to_root: &str) -> ProjectRelocateArgs {
        ProjectRelocateArgs {
            relocation_id: "relocation".to_string(),
            project_id: project_id.to_string(),
            from_root: from_root.to_string(),
            to_root: to_root.to_string(),
        }
    }

    #[test]
    fn a_sibling_folder_with_a_similar_name_keeps_every_path() {
        let mut connection = database();
        seed(&connection);
        insert_project(&connection, "web", "/old/repo-web");
        insert_mount(
            &connection,
            "web-mount",
            "web",
            "/old/repo-web/.goodboy/worktrees/task",
        );
        insert_retained(&connection, "web-kept", Some("web"), "/old/repo-web");
        insert_retained(&connection, "web-orphan", None, "/old/repo-web");
        connection
            .execute(
                "INSERT INTO worktree_roots (repo_root, first_seen_at, added_by) VALUES ('/old/repo-web', 1, 'project')",
                [],
            )
            .expect("sibling root inserts");

        relocate_with_connection(&mut connection, &args(), 2).expect("move succeeds");

        assert_eq!(
            text(
                &connection,
                "SELECT worktree_path FROM session_worktrees WHERE id = 'web-mount'"
            ),
            "/old/repo-web/.goodboy/worktrees/task"
        );
        assert_eq!(
            text(
                &connection,
                "SELECT repo_root FROM retained_worktree_paths WHERE id = 'web-kept'"
            ),
            "/old/repo-web"
        );
        assert_eq!(
            text(
                &connection,
                "SELECT repo_root FROM retained_worktree_paths WHERE id = 'web-orphan'"
            ),
            "/old/repo-web"
        );
        assert_eq!(
            text(
                &connection,
                "SELECT repo_root FROM worktree_roots WHERE repo_root LIKE '%-web'"
            ),
            "/old/repo-web"
        );
        assert_eq!(
            text(
                &connection,
                "SELECT repo_root FROM retained_worktree_paths WHERE id = 'kept'"
            ),
            "/new/repo"
        );
    }

    #[test]
    fn an_underscore_or_a_percent_in_the_path_is_not_a_wildcard() {
        let mut connection = database();
        seed(&connection);
        connection
            .execute("UPDATE projects SET root_path = '/old/ledger_core'", [])
            .expect("root renames");
        connection
            .execute(
                "UPDATE session_worktrees SET worktree_path = '/old/ledger_core/.goodboy/worktrees/task', last_worktree_path = '/old/ledger_core/.goodboy/worktrees/task'",
                [],
            )
            .expect("mount renames");
        insert_project(&connection, "lookalike", "/old/ledgerXcore");
        insert_mount(
            &connection,
            "lookalike-mount",
            "lookalike",
            "/old/ledgerXcore/.goodboy/worktrees/task",
        );
        insert_retained(&connection, "lookalike-orphan", None, "/old/ledgerXcore");
        insert_project(&connection, "percent", "/old/100%/repo");
        insert_mount(
            &connection,
            "percent-mount",
            "percent",
            "/old/100%/repo/.goodboy/worktrees/task",
        );
        insert_project(&connection, "digits", "/old/1005/repo");
        insert_mount(
            &connection,
            "digits-mount",
            "digits",
            "/old/1005/repo/.goodboy/worktrees/task",
        );
        insert_retained(&connection, "digits-orphan", None, "/old/1005/repo");

        relocate_with_connection(
            &mut connection,
            &move_args("project", "/old/ledger_core", "/new/ledger_core"),
            2,
        )
        .expect("move succeeds");
        relocate_with_connection(
            &mut connection,
            &ProjectRelocateArgs {
                relocation_id: "relocation-percent".to_string(),
                ..move_args("percent", "/old/100%/repo", "/new/100%/repo")
            },
            3,
        )
        .expect("move succeeds");

        assert_eq!(
            text(
                &connection,
                "SELECT worktree_path FROM session_worktrees WHERE id = 'lookalike-mount'"
            ),
            "/old/ledgerXcore/.goodboy/worktrees/task"
        );
        assert_eq!(
            text(
                &connection,
                "SELECT repo_root FROM retained_worktree_paths WHERE id = 'lookalike-orphan'"
            ),
            "/old/ledgerXcore"
        );
        assert_eq!(
            text(
                &connection,
                "SELECT worktree_path FROM session_worktrees WHERE id = 'digits-mount'"
            ),
            "/old/1005/repo/.goodboy/worktrees/task"
        );
        assert_eq!(
            text(
                &connection,
                "SELECT repo_root FROM retained_worktree_paths WHERE id = 'digits-orphan'"
            ),
            "/old/1005/repo"
        );
        assert_eq!(
            text(
                &connection,
                "SELECT worktree_path FROM session_worktrees WHERE id = 'percent-mount'"
            ),
            "/new/100%/repo/.goodboy/worktrees/task"
        );
        assert_eq!(
            text(
                &connection,
                "SELECT worktree_path FROM session_worktrees WHERE id = 'mount'"
            ),
            "/new/ledger_core/.goodboy/worktrees/task"
        );
    }

    #[test]
    fn a_nested_project_keeps_its_own_paths_when_the_outer_one_moves() {
        let mut connection = database();
        seed(&connection);
        insert_project(&connection, "inner", "/old/repo/inner");
        insert_mount(
            &connection,
            "inner-mount",
            "inner",
            "/old/repo/inner/.goodboy/worktrees/task",
        );
        insert_retained(&connection, "inner-kept", Some("inner"), "/old/repo/inner");

        relocate_with_connection(&mut connection, &args(), 2).expect("move succeeds");

        assert_eq!(
            text(
                &connection,
                "SELECT worktree_path FROM session_worktrees WHERE id = 'inner-mount'"
            ),
            "/old/repo/inner/.goodboy/worktrees/task"
        );
        assert_eq!(
            text(
                &connection,
                "SELECT repo_root FROM retained_worktree_paths WHERE id = 'inner-kept'"
            ),
            "/old/repo/inner"
        );
        assert_eq!(
            text(
                &connection,
                "SELECT worktree_path FROM session_worktrees WHERE id = 'mount'"
            ),
            "/new/repo/.goodboy/worktrees/task"
        );
    }

    #[test]
    fn a_path_with_non_ascii_letters_moves_by_characters_not_bytes() {
        let mut connection = database();
        seed(&connection);
        connection
            .execute("UPDATE projects SET root_path = '/old/citt\u{e0}'", [])
            .expect("root renames");
        connection
            .execute(
                "UPDATE session_worktrees SET worktree_path = '/old/citt\u{e0}/.goodboy/worktrees/task'",
                [],
            )
            .expect("mount renames");

        relocate_with_connection(
            &mut connection,
            &move_args("project", "/old/citt\u{e0}", "/new/citt\u{e0}"),
            2,
        )
        .expect("move succeeds");

        assert_eq!(
            text(
                &connection,
                "SELECT worktree_path FROM session_worktrees WHERE id = 'mount'"
            ),
            "/new/citt\u{e0}/.goodboy/worktrees/task"
        );
    }

    #[test]
    fn operation_json_is_rewritten_by_value_and_only_for_paths_inside_the_folder() {
        let mut connection = database();
        seed(&connection);
        connection
            .execute(
                "INSERT INTO mount_operations
                   (id, session_id, mount_id, request_id, kind, status, expected_revision, input_json, result_json, created_at, updated_at)
                 VALUES ('operation', 'session', 'mount', 'request', 'attach', 'succeeded', 0, ?, ?, 1, 1)",
                params![
                    r#"{"path":"/old/repo/.goodboy/worktrees/task","sibling":"/old/repo-web/x","note":"see /old/repo for details","list":["/old/repo/a","/old/other","/old/repo/b"]}"#,
                    r#"{"worktreePath":"/old/repo","count":2}"#,
                ],
            )
            .expect("operation inserts");

        relocate_with_connection(&mut connection, &args(), 2).expect("move succeeds");

        let input: serde_json::Value = serde_json::from_str(&text(
            &connection,
            "SELECT input_json FROM mount_operations",
        ))
        .expect("input stays json");
        assert_eq!(input["path"], "/new/repo/.goodboy/worktrees/task");
        assert_eq!(input["sibling"], "/old/repo-web/x");
        assert_eq!(input["note"], "see /old/repo for details");
        assert_eq!(input["list"][0], "/new/repo/a");
        assert_eq!(input["list"][1], "/old/other");
        assert_eq!(input["list"][2], "/new/repo/b");
        let result: serde_json::Value = serde_json::from_str(&text(
            &connection,
            "SELECT result_json FROM mount_operations",
        ))
        .expect("result stays json");
        assert_eq!(result["worktreePath"], "/new/repo");
        assert_eq!(result["count"], 2);
    }

    #[test]
    fn undo_puts_a_scoped_move_back_without_touching_siblings() {
        let mut connection = database();
        seed(&connection);
        insert_project(&connection, "web", "/old/repo-web");
        insert_mount(
            &connection,
            "web-mount",
            "web",
            "/old/repo-web/.goodboy/worktrees/task",
        );

        relocate_with_connection(&mut connection, &args(), 2).expect("move succeeds");
        undo_with_connection(&mut connection, "relocation", 3).expect("undo succeeds");

        assert_eq!(
            text(
                &connection,
                "SELECT worktree_path FROM session_worktrees WHERE id = 'mount'"
            ),
            "/old/repo/.goodboy/worktrees/task"
        );
        assert_eq!(
            text(
                &connection,
                "SELECT worktree_path FROM session_worktrees WHERE id = 'web-mount'"
            ),
            "/old/repo-web/.goodboy/worktrees/task"
        );
        assert_eq!(
            text(&connection, "SELECT repo_root FROM worktree_roots"),
            "/old/repo"
        );
    }

    fn destination_checked(
        connection: &Connection,
        project_id: &str,
        destination: &str,
    ) -> Result<(), ProjectRelocationError> {
        destination_verified(
            destination,
            &destination_expectation(connection, project_id)?,
        )
    }

    fn real_repo(name: &str) -> (std::path::PathBuf, String) {
        let root = test_root(name);
        assert!(git(&root, &["init", "-b", "main"]).status.success());
        assert!(git(&root, &["config", "user.name", "Goodboy Test"])
            .status
            .success());
        assert!(git(&root, &["config", "user.email", "goodboy@localhost"])
            .status
            .success());
        assert!(git(&root, &["config", "commit.gpgsign", "false"])
            .status
            .success());
        assert!(git(&root, &["commit", "--allow-empty", "-m", name])
            .status
            .success());
        let roots = git(&root, &["rev-list", "--max-parents=0", "HEAD"]);
        let first = String::from_utf8_lossy(&roots.stdout).trim().to_string();
        (root, first)
    }

    #[test]
    fn the_destination_must_be_a_folder_holding_the_same_repository() {
        let connection = database();
        seed(&connection);
        let (repo, root_commit) = real_repo("destination");
        let (other, _) = real_repo("destination-other");
        connection
            .execute("UPDATE projects SET root_commit = ?", [&root_commit])
            .expect("root commit saves");

        assert!(destination_checked(&connection, "project", &repo.to_string_lossy()).is_ok());
        assert!(matches!(
            destination_checked(&connection, "project", &other.to_string_lossy()),
            Err(ProjectRelocationError::DestinationDiffers)
        ));
        assert!(matches!(
            destination_checked(&connection, "project", "/does/not/exist/ledger-core"),
            Err(ProjectRelocationError::DestinationMissing)
        ));
        let plain = test_root("destination-plain");
        assert!(matches!(
            destination_checked(&connection, "project", &plain.to_string_lossy()),
            Err(ProjectRelocationError::DestinationDiffers)
        ));
        connection
            .execute("UPDATE projects SET root_commit = NULL", [])
            .expect("root commit clears");
        assert!(destination_checked(&connection, "project", &plain.to_string_lossy()).is_ok());
        for path in [repo, other, plain] {
            std::fs::remove_dir_all(path).expect("test root removes");
        }
    }

    #[test]
    fn a_failed_repair_comes_back_as_text_for_the_screen() {
        let plain = test_root("repair-failure");

        let outcome = repair_git_links(&plain.to_string_lossy(), &[]);

        let message = outcome.expect_err("a folder that is not a repository cannot be repaired");
        assert!(!message.is_empty());
        std::fs::remove_dir_all(plain).expect("test root removes");
    }
}
