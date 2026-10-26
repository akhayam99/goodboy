use serde_json::json;

use super::*;
use crate::util::wire_shape::{assert_wire_reads, assert_wire_value};

#[test]
fn wire_shape_folder_facts_request() {
    assert_wire_reads::<FolderFactsRequest>(json!({ "repoRoot": "/r", "path": "/r/w" }));
}

#[test]
fn wire_shape_worktree_folder_facts() {
    assert_wire_value(
        &WorktreeFolderFacts {
            path: "/r/w".to_string(),
            exists: true,
            is_registered: true,
            branch: Some("ak/feat".to_string()),
            last_commit_at: Some(10),
            local_only_commits: Some(2),
            changed_files: 3,
            changed_sample: Some("a.ts".to_string()),
            reasons: vec![WorktreeRemovalReason::Locked],
            verdict: FolderVerdict::Unavailable,
        },
        json!({
            "path": "/r/w",
            "exists": true,
            "isRegistered": true,
            "branch": "ak/feat",
            "lastCommitAt": 10,
            "localOnlyCommits": 2,
            "changedFiles": 3,
            "changedSample": "a.ts",
            "reasons": ["locked"],
            "verdict": "unavailable",
        }),
    );
}

#[test]
fn wire_shape_disk_free() {
    assert_wire_value(
        &DiskFree {
            free_bytes: Some(1),
            total_bytes: Some(2),
        },
        json!({ "freeBytes": 1, "totalBytes": 2 }),
    );
}

#[test]
fn wire_shape_app_data_usage() {
    assert_wire_value(
        &AppDataUsage {
            folder: "/data".to_string(),
            database_bytes: 1,
            snapshot_bytes: 2,
            snapshot_count: 3,
            saved_versions_bytes: 4,
        },
        json!({
            "folder": "/data",
            "databaseBytes": 1,
            "snapshotBytes": 2,
            "snapshotCount": 3,
            "savedVersionsBytes": 4,
        }),
    );
}
