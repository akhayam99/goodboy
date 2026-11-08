use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};

use serde::Serialize;

use crate::aux_spawn::SpawnTag;
use crate::proc::git_head;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct LedgerEntry {
    pub(crate) spawn_id: String,
    pub(crate) kind: &'static str,
    pub(crate) pid: u32,
    pub(crate) pgid: Option<u32>,
    pub(crate) session_id: Option<String>,
    pub(crate) mount_path: Option<String>,
    pub(crate) cwd: Option<String>,
    pub(crate) started_at: u64,
    pub(crate) agent_id: Option<String>,
    pub(crate) run_id: Option<String>,
    pub(crate) mount_id: Option<String>,
    pub(crate) branch: Option<String>,
    pub(crate) branch_path: Option<String>,
    #[serde(skip)]
    pub(crate) reflog_mark: Option<String>,
}

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub(crate) struct LedgerOwner {
    pub(crate) agent_id: Option<String>,
    pub(crate) run_id: Option<String>,
    pub(crate) mount_id: Option<String>,
}

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub(crate) struct LedgerContext {
    pub(crate) session_id: Option<String>,
    pub(crate) mount_path: Option<String>,
    pub(crate) cwd: Option<String>,
    pub(crate) owner: LedgerOwner,
}

fn place_of(mount_path: Option<&str>, cwd: Option<&str>) -> Option<std::path::PathBuf> {
    mount_path
        .or(cwd)
        .filter(|path| !path.is_empty())
        .map(std::path::PathBuf::from)
}

pub(crate) type MountPlaces = HashMap<String, String>;

fn current_place(entry: &LedgerEntry, mounts: &MountPlaces) -> Option<std::path::PathBuf> {
    let moved = entry
        .mount_id
        .as_ref()
        .and_then(|id| mounts.get(id))
        .map(String::as_str);
    place_of(moved.or(entry.mount_path.as_deref()), entry.cwd.as_deref())
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct Placement {
    branch: String,
    branch_path: Option<String>,
}

fn placement_of(entry: &LedgerEntry, mounts: &MountPlaces) -> Option<Placement> {
    let recorded = entry.branch.clone()?;
    let unconfirmed = Placement {
        branch: recorded.clone(),
        branch_path: None,
    };
    let Some(place) = current_place(entry, mounts) else {
        return Some(unconfirmed);
    };
    let confirmed = Some(recorded.clone())
        .filter(|name| git_head::has_branch(&place, name))
        .or_else(|| {
            git_head::renamed_to(
                &place,
                &recorded,
                entry.started_at,
                entry.reflog_mark.as_deref(),
            )
        });
    let Some(branch) = confirmed else {
        return Some(unconfirmed);
    };
    Some(Placement {
        branch,
        branch_path: Some(place.to_string_lossy().into_owned()),
    })
}

impl LedgerContext {
    pub(crate) fn from_command(command: &std::process::Command) -> Self {
        Self {
            cwd: command
                .get_current_dir()
                .map(|dir| dir.to_string_lossy().into_owned()),
            ..Self::default()
        }
    }
}

#[derive(Default)]
pub(crate) struct ProcessLedger(Mutex<HashMap<String, LedgerEntry>>);

impl ProcessLedger {
    pub(crate) fn add(&self, entry: LedgerEntry) {
        let Ok(mut map) = self.0.lock() else {
            return;
        };
        map.insert(entry.spawn_id.clone(), entry);
    }

    pub(crate) fn remove(&self, spawn_id: &str) {
        let Ok(mut map) = self.0.lock() else {
            return;
        };
        map.remove(spawn_id);
    }

    pub(crate) fn mount_ids(&self) -> Vec<String> {
        let Ok(map) = self.0.lock() else {
            return Vec::new();
        };
        map.values()
            .filter_map(|entry| entry.mount_id.clone())
            .collect()
    }

    pub(crate) fn list(&self) -> Vec<LedgerEntry> {
        self.list_at(&MountPlaces::new())
    }

    pub(crate) fn list_at(&self, mounts: &MountPlaces) -> Vec<LedgerEntry> {
        self.list_with(mounts, placement_of)
    }

    fn snapshot(&self) -> Vec<LedgerEntry> {
        let Ok(map) = self.0.lock() else {
            return Vec::new();
        };
        map.values().cloned().collect()
    }

    fn list_with(
        &self,
        mounts: &MountPlaces,
        place: impl Fn(&LedgerEntry, &MountPlaces) -> Option<Placement>,
    ) -> Vec<LedgerEntry> {
        let placed: Vec<(LedgerEntry, Placement)> = self
            .snapshot()
            .into_iter()
            .filter_map(|seen| place(&seen, mounts).map(|placement| (seen, placement)))
            .collect();
        let Ok(mut map) = self.0.lock() else {
            return Vec::new();
        };
        for (seen, placement) in placed {
            let Some(current) = map.get_mut(&seen.spawn_id).filter(|row| **row == seen) else {
                continue;
            };
            current.branch = Some(placement.branch);
            current.branch_path = placement.branch_path;
        }
        let mut entries: Vec<LedgerEntry> = map.values().cloned().collect();
        entries.sort_by(|a, b| {
            a.started_at
                .cmp(&b.started_at)
                .then_with(|| a.spawn_id.cmp(&b.spawn_id))
        });
        entries
    }
}

pub(crate) fn global() -> &'static ProcessLedger {
    static LEDGER: OnceLock<ProcessLedger> = OnceLock::new();
    LEDGER.get_or_init(ProcessLedger::default)
}

pub(crate) fn entry_for(tag: &SpawnTag, pid: u32, context: LedgerContext) -> LedgerEntry {
    let place = place_of(context.mount_path.as_deref(), context.cwd.as_deref());
    let branch = place.as_deref().and_then(git_head::branch_at);
    let reflog_mark = place
        .as_deref()
        .zip(branch.as_deref())
        .and_then(|(place, name)| git_head::reflog_mark(place, name));
    let branch_path = branch
        .as_ref()
        .and(place)
        .map(|place| place.to_string_lossy().into_owned());
    LedgerEntry {
        spawn_id: tag.id.clone(),
        kind: tag.kind.as_str(),
        pid,
        pgid: crate::proc::kernel::identity(pid).map(|identity| identity.pgid),
        session_id: context.session_id,
        mount_path: context.mount_path,
        cwd: context.cwd,
        started_at: crate::util::now_millis_u64(),
        agent_id: context.owner.agent_id,
        run_id: context.owner.run_id,
        mount_id: context.owner.mount_id,
        branch,
        branch_path,
        reflog_mark,
    }
}

pub(crate) fn record(tag: &SpawnTag, pid: u32, context: LedgerContext) {
    global().add(entry_for(tag, pid, context));
}

pub(crate) fn forget(spawn_id: &str) {
    global().remove(spawn_id);
}

#[cfg(test)]
pub(crate) fn holds(spawn_id: &str) -> bool {
    global().list().iter().any(|row| row.spawn_id == spawn_id)
}

fn mount_places(conn: &rusqlite::Connection, ids: &[String]) -> MountPlaces {
    let Ok(mut stmt) = conn.prepare(
        "SELECT worktree_path FROM session_worktrees WHERE id = ?1 AND worktree_path IS NOT NULL",
    ) else {
        return MountPlaces::new();
    };
    ids.iter()
        .filter_map(|id| {
            stmt.query_row([id], |row| row.get::<_, String>(0))
                .ok()
                .filter(|path| !path.is_empty())
                .map(|path| (id.clone(), path))
        })
        .collect()
}

pub(crate) fn mount_id_at(
    conn: &rusqlite::Connection,
    session_id: &str,
    cwd: &str,
) -> Option<String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, worktree_path FROM session_worktrees WHERE session_id = ?1 AND worktree_path IS NOT NULL",
        )
        .ok()?;
    let rows = stmt
        .query_map([session_id], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })
        .ok()?;
    let cwd = std::path::Path::new(cwd);
    rows.flatten()
        .filter(|(_, path)| !path.is_empty() && cwd.starts_with(path))
        .max_by_key(|(_, path)| path.len())
        .map(|(id, _)| id)
}

pub(crate) fn mount_id_in(
    db: &crate::db::Db,
    session_id: &str,
    cwd: Option<&str>,
) -> Option<String> {
    let cwd = cwd.filter(|cwd| !cwd.is_empty())?;
    let conn = db.0.lock().ok()?;
    mount_id_at(&conn, session_id, cwd)
}

#[tauri::command(async)]
pub(crate) fn process_ledger_list(
    db: tauri::State<'_, crate::db::Db>,
) -> Result<Vec<LedgerEntry>, crate::util::MessageError> {
    let ids = global().mount_ids();
    let mounts = match db.0.lock() {
        Ok(conn) => mount_places(&conn, &ids),
        Err(_) => MountPlaces::new(),
    };
    Ok(global().list_at(&mounts))
}

#[cfg(test)]
pub(crate) mod test_support {
    use super::*;
    use std::time::{Duration, Instant};

    pub(crate) fn scratch_dir(label: &str) -> std::path::PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "goodboy-ledger-{label}-{:016x}",
            rand::random::<u64>()
        ));
        std::fs::create_dir_all(&dir).expect("scratch dir");
        dir
    }

    fn row_at(cwd: &str) -> Option<LedgerEntry> {
        global()
            .list()
            .into_iter()
            .find(|row| row.cwd.as_deref() == Some(cwd))
    }

    pub(crate) fn wait_for_row(cwd: &str) -> LedgerEntry {
        let deadline = Instant::now() + Duration::from_secs(10);
        loop {
            if let Some(row) = row_at(cwd) {
                return row;
            }
            assert!(Instant::now() < deadline, "no ledger row for {cwd}");
            std::thread::sleep(Duration::from_millis(20));
        }
    }

    pub(crate) fn assert_row_gone(cwd: &str) {
        let deadline = Instant::now() + Duration::from_secs(10);
        while row_at(cwd).is_some() {
            assert!(Instant::now() < deadline, "the ledger still holds {cwd}");
            std::thread::sleep(Duration::from_millis(20));
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::aux_spawn::SpawnKind;

    fn entry(spawn_id: &str, started_at: u64) -> LedgerEntry {
        LedgerEntry {
            spawn_id: spawn_id.to_string(),
            kind: "turn",
            pid: 4242,
            pgid: Some(4242),
            session_id: Some("session-1".to_string()),
            mount_path: None,
            cwd: Some("/work/ledger-core".to_string()),
            started_at,
            agent_id: None,
            run_id: None,
            mount_id: None,
            branch: None,
            branch_path: None,
            reflog_mark: None,
        }
    }

    #[test]
    fn add_then_remove_leaves_the_ledger_empty() {
        let ledger = ProcessLedger::default();
        ledger.add(entry("a", 1));
        assert_eq!(ledger.list().len(), 1);
        ledger.remove("a");
        assert!(ledger.list().is_empty());
    }

    #[test]
    fn removing_an_unknown_spawn_id_is_a_no_op() {
        let ledger = ProcessLedger::default();
        ledger.add(entry("a", 1));
        ledger.remove("missing");
        ledger.remove("missing");
        assert_eq!(ledger.list().len(), 1);
    }

    #[test]
    fn adding_the_same_spawn_id_twice_keeps_one_row() {
        let ledger = ProcessLedger::default();
        ledger.add(entry("a", 1));
        ledger.add(entry("a", 2));
        let rows = ledger.list();
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].started_at, 2);
    }

    #[test]
    fn the_list_is_ordered_by_start_then_spawn_id() {
        let ledger = ProcessLedger::default();
        ledger.add(entry("c", 5));
        ledger.add(entry("b", 5));
        ledger.add(entry("a", 9));
        let ids: Vec<String> = ledger.list().into_iter().map(|row| row.spawn_id).collect();
        assert_eq!(ids, vec!["b", "c", "a"]);
    }

    #[test]
    fn an_entry_carries_the_tag_kind_and_the_context() {
        let tag = SpawnTag::new(SpawnKind::Script);
        let row = entry_for(
            &tag,
            std::process::id(),
            LedgerContext {
                session_id: Some("session-9".to_string()),
                mount_path: Some("/work/notify-relay".to_string()),
                cwd: Some("/work/notify-relay/src".to_string()),
                owner: LedgerOwner::default(),
            },
        );
        assert_eq!(row.spawn_id, tag.id);
        assert_eq!(row.kind, "script");
        assert_eq!(row.pid, std::process::id());
        assert_eq!(row.session_id.as_deref(), Some("session-9"));
        assert_eq!(row.mount_path.as_deref(), Some("/work/notify-relay"));
        assert_eq!(row.cwd.as_deref(), Some("/work/notify-relay/src"));
        assert!(row.started_at > 0);
        assert_eq!(row.agent_id, None);
        assert_eq!(row.run_id, None);
        assert_eq!(row.branch, None);
    }

    #[test]
    fn an_agent_spawn_records_its_agent_run_mount_and_branch() {
        let repo = git_head::test_support::repo_on(
            &test_support::scratch_dir("agent"),
            "nw/fix-duplicate-credit",
        );
        let tag = SpawnTag::new(SpawnKind::Turn);
        let row = entry_for(
            &tag,
            std::process::id(),
            LedgerContext {
                session_id: Some("session-3".to_string()),
                mount_path: Some(repo.to_string_lossy().into_owned()),
                cwd: None,
                owner: LedgerOwner {
                    agent_id: Some("agent-implementer".to_string()),
                    run_id: Some("run-fix-credit".to_string()),
                    mount_id: Some("mount-payments-api".to_string()),
                },
            },
        );
        assert_eq!(row.agent_id.as_deref(), Some("agent-implementer"));
        assert_eq!(row.run_id.as_deref(), Some("run-fix-credit"));
        assert_eq!(row.mount_id.as_deref(), Some("mount-payments-api"));
        assert_eq!(row.branch.as_deref(), Some("nw/fix-duplicate-credit"));
        let json = serde_json::to_value(&row).expect("serialize");
        assert_eq!(json["agentId"], "agent-implementer");
        assert_eq!(json["runId"], "run-fix-credit");
        assert_eq!(json["mountId"], "mount-payments-api");
        assert_eq!(json["branch"], "nw/fix-duplicate-credit");
    }

    #[test]
    fn a_live_process_keeps_its_branch_when_the_worktree_switches() {
        let repo = git_head::test_support::repo_on(
            &test_support::scratch_dir("switch"),
            "nw/fix-duplicate-credit",
        );
        let ledger = ProcessLedger::default();
        let tag = SpawnTag::new(SpawnKind::Terminal);
        ledger.add(entry_for(
            &tag,
            4242,
            LedgerContext {
                cwd: Some(repo.to_string_lossy().into_owned()),
                ..LedgerContext::default()
            },
        ));
        git_head::test_support::switch_to(&repo, "nw/ledger-rounding");
        assert_eq!(
            ledger.list()[0].branch.as_deref(),
            Some("nw/fix-duplicate-credit")
        );
    }

    use git_head::test_support::{git_at, git_repo_on, millis_at, EPOCH_SECS};

    const STARTED: u64 = EPOCH_SECS + 50;

    fn ledger_on(repo: &std::path::Path, mount_id: Option<&str>) -> ProcessLedger {
        let ledger = ProcessLedger::default();
        let tag = SpawnTag::new(SpawnKind::Script);
        let row = entry_for(
            &tag,
            4242,
            LedgerContext {
                mount_path: Some(repo.to_string_lossy().into_owned()),
                owner: LedgerOwner {
                    mount_id: mount_id.map(str::to_string),
                    ..LedgerOwner::default()
                },
                ..LedgerContext::default()
            },
        );
        ledger.add(LedgerEntry {
            started_at: millis_at(STARTED),
            ..row
        });
        ledger
    }

    #[test]
    fn a_renamed_branch_follows_the_new_name() {
        let repo = git_repo_on(&test_support::scratch_dir("rename"), "nw/credit");
        let ledger = ledger_on(&repo, None);
        git_at(
            &repo,
            STARTED + 10,
            &["branch", "-m", "nw/credit", "nw/credit-fix"],
        );
        let row = ledger.list().remove(0);
        assert_eq!(row.branch.as_deref(), Some("nw/credit-fix"));
        assert_eq!(row.branch_path, Some(repo.to_string_lossy().into_owned()));
    }

    #[test]
    fn a_rename_then_a_switch_before_the_next_read_keeps_the_new_name() {
        let repo = git_repo_on(&test_support::scratch_dir("rename-switch"), "nw/credit");
        let ledger = ledger_on(&repo, None);
        git_at(
            &repo,
            STARTED + 10,
            &["branch", "-m", "nw/credit", "nw/credit-fix"],
        );
        git_at(&repo, STARTED + 20, &["switch", "-q", "-c", "nw/rounding"]);
        assert_eq!(ledger.list()[0].branch.as_deref(), Some("nw/credit-fix"));
        assert_eq!(ledger.list()[0].branch.as_deref(), Some("nw/credit-fix"));
    }

    #[test]
    fn a_deleted_branch_keeps_the_recorded_name_unconfirmed() {
        let repo = git_repo_on(&test_support::scratch_dir("delete"), "nw/credit");
        let ledger = ledger_on(&repo, None);
        git_at(&repo, STARTED + 10, &["switch", "-q", "-c", "nw/rounding"]);
        git_at(&repo, STARTED + 20, &["branch", "-D", "nw/credit"]);
        let row = ledger.list().remove(0);
        assert_eq!(row.branch.as_deref(), Some("nw/credit"));
        assert_eq!(row.branch_path, None);
    }

    #[test]
    fn a_recreated_name_does_not_follow_a_rename_older_than_the_process() {
        let repo = git_repo_on(&test_support::scratch_dir("recreated"), "nw/credit");
        git_at(
            &repo,
            STARTED - 30,
            &["branch", "-m", "nw/credit", "nw/credit-fix"],
        );
        git_at(&repo, STARTED - 20, &["switch", "-q", "-c", "nw/credit"]);
        let ledger = ledger_on(&repo, None);
        assert_eq!(ledger.list()[0].branch.as_deref(), Some("nw/credit"));
        git_at(&repo, STARTED + 10, &["switch", "-q", "main"]);
        git_at(&repo, STARTED + 20, &["branch", "-D", "nw/credit"]);
        let row = ledger.list().remove(0);
        assert_eq!(row.branch.as_deref(), Some("nw/credit"));
        assert_eq!(row.branch_path, None);
    }

    #[test]
    fn a_branch_is_resolved_with_the_ledger_unlocked() {
        let ledger = ProcessLedger::default();
        let branched = |spawn_id: &str, started_at: u64| LedgerEntry {
            branch: Some("nw/credit".to_string()),
            ..entry(spawn_id, started_at)
        };
        ledger.add(branched("kept", 1));
        ledger.add(branched("stopped", 2));
        ledger.add(branched("respawned", 3));
        let rows = ledger.list_with(&MountPlaces::new(), |seen, _| {
            assert!(ledger.0.try_lock().is_ok());
            ledger.remove("stopped");
            if seen.spawn_id == "respawned" {
                ledger.add(branched("respawned", 9));
            }
            Some(Placement {
                branch: "nw/credit-fix".to_string(),
                branch_path: Some("/work/payments-api".to_string()),
            })
        });
        let summary: Vec<(String, Option<String>)> = rows
            .into_iter()
            .map(|row| (row.spawn_id, row.branch))
            .collect();
        assert_eq!(
            summary,
            vec![
                ("kept".to_string(), Some("nw/credit-fix".to_string())),
                ("respawned".to_string(), Some("nw/credit".to_string())),
            ]
        );
    }

    #[test]
    fn a_moved_worktree_is_read_through_the_current_place_of_its_mount() {
        let base = test_support::scratch_dir("moved");
        let main = git_repo_on(&base.join("payments-api"), "main");
        let before = base.join("credit");
        let after = base.join("credit-moved");
        let before_text = before.to_string_lossy().into_owned();
        let after_text = after.to_string_lossy().into_owned();
        git_at(
            &main,
            EPOCH_SECS,
            &["worktree", "add", "-q", "-b", "nw/credit", &before_text],
        );
        let ledger = ledger_on(&before, Some("mount-credit"));
        git_at(
            &main,
            STARTED + 10,
            &["worktree", "move", &before_text, &after_text],
        );
        git_at(
            &after,
            STARTED + 20,
            &["branch", "-m", "nw/credit", "nw/credit-fix"],
        );
        let unknown = ledger.list().remove(0);
        assert_eq!(unknown.branch.as_deref(), Some("nw/credit"));
        assert_eq!(unknown.branch_path, None);
        let places = MountPlaces::from([("mount-credit".to_string(), after_text.clone())]);
        let row = ledger.list_at(&places).remove(0);
        assert_eq!(row.branch.as_deref(), Some("nw/credit-fix"));
        assert_eq!(row.branch_path, Some(after_text));
        assert_eq!(row.mount_path, Some(before_text));
    }

    #[test]
    fn a_mount_place_is_read_by_its_id_from_the_database() {
        let conn = rusqlite::Connection::open_in_memory().expect("db");
        conn.execute_batch(
            "CREATE TABLE session_worktrees (id TEXT, worktree_path TEXT);
             INSERT INTO session_worktrees VALUES ('mount-credit', '/work/payments-api-moved');
             INSERT INTO session_worktrees VALUES ('mount-detached', NULL);",
        )
        .expect("schema");
        let ids = vec![
            "mount-credit".to_string(),
            "mount-detached".to_string(),
            "mount-missing".to_string(),
        ];
        assert_eq!(
            mount_places(&conn, &ids),
            MountPlaces::from([(
                "mount-credit".to_string(),
                "/work/payments-api-moved".to_string()
            )])
        );
    }

    #[test]
    fn a_working_directory_names_the_deepest_mount_of_its_session() {
        let conn = rusqlite::Connection::open_in_memory().expect("db");
        conn.execute_batch(
            "CREATE TABLE session_worktrees (id TEXT, session_id TEXT, worktree_path TEXT);
             INSERT INTO session_worktrees VALUES ('mount-root', 'session-1', '/work/payments-api');
             INSERT INTO session_worktrees VALUES ('mount-credit', 'session-1', '/work/payments-api/credit');
             INSERT INTO session_worktrees VALUES ('mount-other', 'session-2', '/work/ledger-core');
             INSERT INTO session_worktrees VALUES ('mount-detached', 'session-1', NULL);",
        )
        .expect("schema");
        assert_eq!(
            mount_id_at(&conn, "session-1", "/work/payments-api/credit/src").as_deref(),
            Some("mount-credit")
        );
        assert_eq!(
            mount_id_at(&conn, "session-1", "/work/payments-api").as_deref(),
            Some("mount-root")
        );
        assert_eq!(
            mount_id_at(&conn, "session-1", "/work/payments-api-old"),
            None
        );
        assert_eq!(mount_id_at(&conn, "session-1", "/work/ledger-core"), None);
        assert_eq!(mount_id_at(&conn, "session-9", "/work/payments-api"), None);
    }

    #[test]
    fn the_context_reads_the_working_directory_of_a_command() {
        let mut command = std::process::Command::new("true");
        assert_eq!(LedgerContext::from_command(&command).cwd, None);
        command.current_dir("/work/payments-api");
        assert_eq!(
            LedgerContext::from_command(&command).cwd.as_deref(),
            Some("/work/payments-api")
        );
    }

    #[cfg(unix)]
    #[test]
    fn the_group_of_a_live_process_is_read_from_the_kernel() {
        let tag = SpawnTag::new(SpawnKind::Turn);
        let row = entry_for(&tag, std::process::id(), LedgerContext::default());
        assert_eq!(row.pgid, Some(unsafe { libc::getpgid(0) } as u32));
    }

    #[test]
    fn the_command_lists_what_the_global_ledger_holds() {
        let tag = SpawnTag::new(SpawnKind::Probe);
        record(&tag, 4242, LedgerContext::default());
        assert!(global().list().iter().any(|row| row.spawn_id == tag.id));
        forget(&tag.id);
        assert!(!holds(&tag.id));
    }
}
