use std::collections::BTreeSet;
use std::path::Path;

use rusqlite::Connection;
use serde::Serialize;
use tauri::State;

use crate::db::Db;
use crate::util::MessageError;

const MAX_PATHS: usize = 2000;

#[derive(Debug, Clone, PartialEq, Eq)]
struct MountRow {
    mount_id: String,
    session_id: String,
    project_id: Option<String>,
    branch: String,
    worktree_path: String,
    base_branch: Option<String>,
    created_at: i64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct LiveMount {
    mount_id: String,
    session_id: String,
    project_id: Option<String>,
    branch: String,
    created_at: i64,
    port: Option<u16>,
    has_fixed_port: bool,
    paths: Vec<String>,
}

fn mount_rows(conn: &Connection) -> Vec<MountRow> {
    let sql = format!(
        "SELECT w.id, w.session_id, w.project_id, w.branch, w.worktree_path, w.base_branch, w.created_at \
         {}",
        crate::mount_port::LIVE_MOUNTS_FROM
    );
    let Ok(mut stmt) = conn.prepare(&sql) else {
        return Vec::new();
    };
    let Ok(rows) = stmt.query_map([], |row| {
        Ok(MountRow {
            mount_id: row.get(0)?,
            session_id: row.get(1)?,
            project_id: row.get(2)?,
            branch: row.get(3)?,
            worktree_path: row.get(4)?,
            base_branch: row.get(5)?,
            created_at: row.get(6)?,
        })
    }) else {
        return Vec::new();
    };
    rows.flatten().collect()
}

fn nul_split(raw: &str) -> impl Iterator<Item = String> + '_ {
    raw.split('\0')
        .filter(|path| !path.is_empty())
        .map(str::to_string)
}

fn git_text(root: &Path, args: &[&str]) -> Result<String, String> {
    crate::worktree::git(root, args).map_err(|error| error.to_string())
}

pub(crate) fn changed_paths(root: &Path, base_branch: Option<&str>) -> Result<Vec<String>, String> {
    git_text(root, &["rev-parse", "--git-dir"])?;
    let base = base_branch.map(str::trim).filter(|base| !base.is_empty());
    let Some((_, merge_base)) = crate::worktree::resolve_base(root, base) else {
        return Ok(Vec::new());
    };
    let diff = git_text(
        root,
        &["diff", "--name-only", "--no-renames", "-z", &merge_base],
    )?;
    let untracked = git_text(root, &["ls-files", "--others", "--exclude-standard", "-z"])?;
    let paths: BTreeSet<String> = nul_split(&diff).chain(nul_split(&untracked)).collect();
    Ok(paths.into_iter().take(MAX_PATHS).collect())
}

fn read_mounts(rows: Vec<MountRow>) -> Result<Vec<LiveMount>, String> {
    let ids: Vec<String> = rows.iter().map(|row| row.mount_id.clone()).collect();
    let ports = crate::mount_port::ports_of(&ids);
    rows.into_iter()
        .map(|row| {
            let root = Path::new(&row.worktree_path);
            let is_on_disk = root.is_dir();
            let paths = match is_on_disk {
                true => changed_paths(root, row.base_branch.as_deref())?,
                false => Vec::new(),
            };
            Ok(LiveMount {
                port: ports.get(&row.mount_id).copied(),
                has_fixed_port: is_on_disk && crate::monitor::watched::has_fixed_port(root),
                paths,
                mount_id: row.mount_id,
                session_id: row.session_id,
                project_id: row.project_id,
                branch: row.branch,
                created_at: row.created_at,
            })
        })
        .collect()
}

#[tauri::command]
pub(crate) async fn overlap_read(db: State<'_, Db>) -> Result<Vec<LiveMount>, MessageError> {
    let rows = {
        let conn =
            db.0.lock()
                .map_err(|_| MessageError::Failed("the database lock is poisoned".to_string()))?;
        mount_rows(&conn)
    };
    tauri::async_runtime::spawn_blocking(move || read_mounts(rows))
        .await
        .map_err(|error| MessageError::Failed(error.to_string()))?
        .map_err(MessageError::Failed)
}

#[cfg(test)]
mod tests {
    use std::process::Command;

    use super::*;

    struct Repo(std::path::PathBuf);

    impl Drop for Repo {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.0);
        }
    }

    fn run(cwd: &Path, args: &[&str]) {
        let status = Command::new("git")
            .args(args)
            .current_dir(cwd)
            .env("GIT_AUTHOR_NAME", "Harborline")
            .env("GIT_AUTHOR_EMAIL", "dev@harborline.test")
            .env("GIT_COMMITTER_NAME", "Harborline")
            .env("GIT_COMMITTER_EMAIL", "dev@harborline.test")
            .status()
            .expect("git runs");
        assert!(status.success(), "git {args:?}");
    }

    fn write(root: &Path, rel: &str, body: &str) {
        let path = root.join(rel);
        std::fs::create_dir_all(path.parent().expect("parent")).expect("dirs");
        std::fs::write(path, body).expect("write");
    }

    fn repo(label: &str) -> Repo {
        let root = std::env::temp_dir().join(format!(
            "goodboy-overlap-{label}-{:016x}",
            rand::random::<u64>()
        ));
        std::fs::create_dir_all(&root).expect("root");
        run(&root, &["init", "-q", "-b", "main"]);
        write(&root, "src/retry/state.ts", "export const a = 1;\n");
        write(&root, "README.md", "ledger-core\n");
        run(&root, &["add", "."]);
        run(&root, &["commit", "-q", "-m", "base"]);
        Repo(root)
    }

    #[test]
    fn changed_paths_keep_commits_edits_and_new_files_since_the_base() {
        let repo = repo("changed");
        let root = &repo.0;
        run(root, &["checkout", "-q", "-b", "hl/retry"]);
        write(root, "src/retry/state.ts", "export const a = 2;\n");
        run(root, &["commit", "-q", "-am", "retry"]);
        write(root, "README.md", "ledger-core, edited\n");
        write(root, "src/retry/new.ts", "export const b = 1;\n");
        assert_eq!(
            changed_paths(root, Some("main")).expect("paths"),
            vec![
                "README.md".to_string(),
                "src/retry/new.ts".to_string(),
                "src/retry/state.ts".to_string(),
            ]
        );
    }

    #[test]
    fn a_branch_without_changes_has_no_paths() {
        let repo = repo("clean");
        run(&repo.0, &["checkout", "-q", "-b", "hl/clean"]);
        assert!(changed_paths(&repo.0, Some("main"))
            .expect("paths")
            .is_empty());
    }

    #[test]
    fn a_rename_lists_the_old_path_and_the_new_one() {
        let repo = repo("rename");
        let root = &repo.0;
        run(root, &["checkout", "-q", "-b", "hl/move"]);
        run(root, &["mv", "src/retry/state.ts", "src/retry/moved.ts"]);
        run(root, &["commit", "-q", "-m", "move"]);
        assert_eq!(
            changed_paths(root, Some("main")).expect("paths"),
            vec![
                "src/retry/moved.ts".to_string(),
                "src/retry/state.ts".to_string(),
            ]
        );
    }

    #[test]
    fn a_folder_git_cannot_read_fails_the_whole_read() {
        let plain = Repo(std::env::temp_dir().join(format!(
            "goodboy-overlap-plain-{:016x}",
            rand::random::<u64>()
        )));
        std::fs::create_dir_all(&plain.0).expect("root");
        let row = MountRow {
            mount_id: "m-plain".to_string(),
            session_id: "s1".to_string(),
            project_id: None,
            branch: "hl/plain".to_string(),
            worktree_path: plain.0.to_string_lossy().into_owned(),
            base_branch: Some("main".to_string()),
            created_at: 1,
        };
        assert!(read_mounts(vec![row]).is_err());
    }

    #[test]
    fn live_mounts_carry_their_port_and_their_paths() {
        let repo = repo("rows");
        run(&repo.0, &["checkout", "-q", "-b", "hl/retry"]);
        write(&repo.0, "src/retry/state.ts", "export const a = 3;\n");
        let path = repo.0.to_string_lossy().into_owned();
        let conn = crate::test_support::migrated_connection();
        conn.execute_batch(&format!(
            "INSERT INTO workspaces (id, name, slug, created_at, updated_at)
               VALUES ('w1', 'Harborline', 'harborline', 1, 1);
             INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at)
               VALUES ('s1', 'w1', 'Retry', 'idle', 1, 1);
             INSERT INTO session_worktrees (id, session_id, worktree_path, branch, base_branch, created_at)
               VALUES ('m1', 's1', '{path}', 'hl/retry', 'main', 1),
                      ('m2', 's1', '/mock/harborline/gone', 'hl/gone', 'main', 2);"
        ))
        .expect("seed");
        let mounts = read_mounts(mount_rows(&conn)).expect("mounts");
        assert_eq!(mounts.len(), 2);
        assert_eq!(mounts[0].paths, vec!["src/retry/state.ts".to_string()]);
        assert!(mounts[0].port.is_some());
        assert!(mounts[1].paths.is_empty());
        assert_ne!(mounts[0].port, mounts[1].port);
    }
}
