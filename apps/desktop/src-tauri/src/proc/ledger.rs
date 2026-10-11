use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};
use std::time::{SystemTime, UNIX_EPOCH};

use serde::Serialize;

use crate::aux_spawn::SpawnTag;

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
}

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub(crate) struct LedgerContext {
    pub(crate) session_id: Option<String>,
    pub(crate) mount_path: Option<String>,
    pub(crate) cwd: Option<String>,
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

    pub(crate) fn list(&self) -> Vec<LedgerEntry> {
        let Ok(map) = self.0.lock() else {
            return Vec::new();
        };
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
    LedgerEntry {
        spawn_id: tag.id.clone(),
        kind: tag.kind.as_str(),
        pid,
        pgid: crate::proc::kernel::identity(pid).map(|identity| identity.pgid),
        session_id: context.session_id,
        mount_path: context.mount_path,
        cwd: context.cwd,
        started_at: now_millis(),
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

fn now_millis() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|elapsed| u64::try_from(elapsed.as_millis()).unwrap_or(u64::MAX))
        .unwrap_or(0)
}

#[tauri::command]
pub(crate) fn process_ledger_list() -> Vec<LedgerEntry> {
    global().list()
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
        process_ledger_list()
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
            },
        );
        assert_eq!(row.spawn_id, tag.id);
        assert_eq!(row.kind, "script");
        assert_eq!(row.pid, std::process::id());
        assert_eq!(row.session_id.as_deref(), Some("session-9"));
        assert_eq!(row.mount_path.as_deref(), Some("/work/notify-relay"));
        assert_eq!(row.cwd.as_deref(), Some("/work/notify-relay/src"));
        assert!(row.started_at > 0);
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
        assert!(process_ledger_list()
            .iter()
            .any(|row| row.spawn_id == tag.id));
        forget(&tag.id);
        assert!(!holds(&tag.id));
    }
}
