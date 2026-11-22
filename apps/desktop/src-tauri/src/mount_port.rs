use std::collections::{BTreeSet, HashMap};

use rusqlite::Connection;

pub(crate) const FIRST_PORT: u16 = 41000;
pub(crate) const PORTS_PER_MOUNT: u16 = 10;
const SLOTS: u16 = 800;

pub(crate) const LIVE_MOUNTS_FROM: &str = "FROM session_worktrees w \
     JOIN sessions s ON s.id = w.session_id \
     WHERE w.is_attached = 1 AND w.worktree_path IS NOT NULL AND w.worktree_path != '' \
       AND s.deleted_at IS NULL \
     ORDER BY w.created_at, w.id";

fn home_slot(mount_id: &str) -> u16 {
    let hash = mount_id
        .bytes()
        .fold(0xcbf2_9ce4_8422_2325_u64, |acc, byte| {
            (acc ^ u64::from(byte)).wrapping_mul(0x0100_0000_01b3)
        });
    u16::try_from(hash % u64::from(SLOTS)).unwrap_or(0)
}

fn port_of_slot(slot: u16) -> u16 {
    FIRST_PORT + slot * PORTS_PER_MOUNT
}

pub(crate) fn ports_of(mount_ids: &[String]) -> HashMap<String, u16> {
    let mut taken = BTreeSet::new();
    let mut out = HashMap::new();
    for mount_id in mount_ids {
        let home = home_slot(mount_id);
        let free = (0..SLOTS)
            .map(|step| (home + step) % SLOTS)
            .find(|slot| !taken.contains(slot));
        let Some(slot) = free else {
            break;
        };
        taken.insert(slot);
        out.insert(mount_id.clone(), port_of_slot(slot));
    }
    out
}

pub(crate) fn live_mount_ids(conn: &Connection) -> Vec<String> {
    let Ok(mut stmt) = conn.prepare(&format!("SELECT w.id {LIVE_MOUNTS_FROM}")) else {
        return Vec::new();
    };
    let Ok(rows) = stmt.query_map([], |row| row.get::<_, String>(0)) else {
        return Vec::new();
    };
    rows.flatten().collect()
}

pub(crate) fn live_ports(conn: &Connection) -> HashMap<String, u16> {
    ports_of(&live_mount_ids(conn))
}

pub(crate) fn port_in(db: &crate::db::Db, mount_id: Option<&str>) -> Option<u16> {
    let mount_id = mount_id?;
    let conn = db.0.lock().ok()?;
    live_ports(&conn).get(mount_id).copied()
}

pub(crate) fn port_env(port: Option<u16>) -> Vec<(&'static str, String)> {
    port.map(|port| vec![("PORT", port.to_string())])
        .unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn ids(names: &[&str]) -> Vec<String> {
        names.iter().map(|name| (*name).to_string()).collect()
    }

    fn seeded() -> Connection {
        let conn = crate::test_support::migrated_connection();
        conn.execute_batch(
            "INSERT INTO workspaces (id, name, slug, created_at, updated_at)
               VALUES ('w1', 'Harborline', 'harborline', 1, 1);
             INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at, deleted_at)
               VALUES ('s1', 'w1', 'Retry', 'idle', 1, 1, NULL),
                      ('s2', 'w1', 'Batch', 'idle', 1, 1, NULL),
                      ('s3', 'w1', 'Old', 'idle', 1, 1, 5);
             INSERT INTO session_worktrees (id, session_id, worktree_path, branch, created_at, is_attached)
               VALUES ('m-ledger', 's1', '/code/ledger-core/wt-a', 'hl/retry', 1, 1),
                      ('m-ledger-2', 's2', '/code/ledger-core/wt-b', 'hl/batch', 2, 1),
                      ('m-detached', 's1', '/code/notify-relay/wt', 'hl/relay', 3, 0),
                      ('m-deleted', 's3', '/code/payments-api/wt', 'hl/old', 4, 1),
                      ('m-no-path', 's2', NULL, 'hl/none', 5, 1);",
        )
        .expect("seed");
        conn
    }

    #[test]
    fn every_mount_gets_its_own_port() {
        let names: Vec<String> = (0..300).map(|index| format!("mount-{index}")).collect();
        let ports = ports_of(&names);
        let distinct: BTreeSet<u16> = ports.values().copied().collect();
        assert_eq!(ports.len(), 300);
        assert_eq!(distinct.len(), 300);
        assert!(distinct
            .iter()
            .all(|port| (*port - FIRST_PORT).is_multiple_of(PORTS_PER_MOUNT)));
    }

    #[test]
    fn a_mount_keeps_its_port_when_a_newer_one_arrives() {
        let before = ports_of(&ids(&["m-ledger"]));
        let after = ports_of(&ids(&["m-ledger", "m-ledger-2", "m-relay"]));
        assert_eq!(before.get("m-ledger"), after.get("m-ledger"));
    }

    #[test]
    fn only_attached_mounts_with_a_folder_of_a_live_session_get_a_port() {
        let conn = seeded();
        assert_eq!(live_mount_ids(&conn), ids(&["m-ledger", "m-ledger-2"]));
        let ports = live_ports(&conn);
        assert_ne!(ports.get("m-ledger"), ports.get("m-ledger-2"));
        assert_eq!(ports.get("m-detached"), None);
    }

    #[test]
    fn the_env_carries_port_only_for_a_mount() {
        assert_eq!(port_env(Some(41230)), vec![("PORT", "41230".to_string())]);
        assert!(port_env(None).is_empty());
    }
}
