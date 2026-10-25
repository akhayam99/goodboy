use serde_json::json;

use super::*;
use crate::util::wire_shape::assert_wire_value;

#[test]
fn wire_shape_move_outcome_needs_stash() {
    assert_wire_value(
        &MoveOutcome::NeedsStash {
            files: vec!["a.rs".to_string()],
            dirty_count: 1,
        },
        json!({ "kind": "needs-stash", "files": ["a.rs"], "dirtyCount": 1 }),
    );
}

#[test]
fn wire_shape_move_outcome_files_restored() {
    assert_wire_value(
        &MoveOutcome::FilesRestored {
            stash: "s".to_string(),
            cleanup_error: Some("boom".to_string()),
        },
        json!({ "kind": "files-restored", "stash": "s", "cleanupError": "boom" }),
    );
    assert_wire_value(
        &MoveOutcome::FilesRestored {
            stash: "s".to_string(),
            cleanup_error: None,
        },
        json!({ "kind": "files-restored", "stash": "s" }),
    );
}

#[test]
fn wire_shape_move_outcome_restore_conflict() {
    assert_wire_value(
        &MoveOutcome::RestoreConflict {
            stash: "s".to_string(),
            files: vec!["a.rs".to_string()],
            head: "h".to_string(),
            backup_ref: "refs/backup".to_string(),
        },
        json!({
            "kind": "restore-conflict",
            "stash": "s",
            "files": ["a.rs"],
            "head": "h",
            "backupRef": "refs/backup",
        }),
    );
}

#[test]
fn wire_shape_move_outcome_moved() {
    assert_wire_value(
        &MoveOutcome::Moved {
            cleanup_error: Some("boom".to_string()),
            carried_count: 2,
            head: "h".to_string(),
            backup_ref: "refs/backup".to_string(),
        },
        json!({
            "kind": "moved",
            "cleanupError": "boom",
            "carriedCount": 2,
            "head": "h",
            "backupRef": "refs/backup",
        }),
    );
    assert_wire_value(
        &MoveOutcome::Moved {
            cleanup_error: None,
            carried_count: 0,
            head: "h".to_string(),
            backup_ref: "refs/backup".to_string(),
        },
        json!({
            "kind": "moved",
            "carriedCount": 0,
            "head": "h",
            "backupRef": "refs/backup",
        }),
    );
}

#[test]
fn wire_shape_move_outcome_plain_variants() {
    assert_wire_value(
        &MoveOutcome::SetAside {
            stash: "s".to_string(),
            reason: "r".to_string(),
        },
        json!({ "kind": "set-aside", "stash": "s", "reason": "r" }),
    );
    assert_wire_value(
        &MoveOutcome::Busy {
            holder: Some("h".to_string()),
        },
        json!({ "kind": "busy", "holder": "h" }),
    );
    assert_wire_value(
        &MoveOutcome::HeadMoved {
            head: "h".to_string(),
        },
        json!({ "kind": "head-moved", "head": "h" }),
    );
    assert_wire_value(
        &MoveOutcome::Blocked {
            reason: "r".to_string(),
        },
        json!({ "kind": "blocked", "reason": "r" }),
    );
}
