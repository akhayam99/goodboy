use serde_json::json;

use super::*;
use crate::util::wire_shape::{assert_wire_reads, assert_wire_roundtrip, assert_wire_value};

#[test]
fn wire_shape_session_dir_create_args() {
    assert_wire_reads::<CreateArgs>(json!({
        "basePath": "/base",
        "slug": "feat",
        "directoryName": "feat-dir",
        "sessionId": "s1",
        "workspaceId": "w1",
    }));
}

#[test]
fn wire_shape_session_dir_remove_args() {
    assert_wire_reads::<RemoveArgs>(json!({ "sessionId": "s1", "path": "/base/feat" }));
}

#[test]
fn wire_shape_created_session_dir() {
    assert_wire_value(
        &CreatedSessionDir {
            worktree_path: "/base/feat".to_string(),
            branch_name: "feat".to_string(),
            slug: "feat".to_string(),
            reused: false,
        },
        json!({
            "worktreePath": "/base/feat",
            "branchName": "feat",
            "slug": "feat",
            "reused": false,
        }),
    );
}

#[test]
fn wire_shape_session_marker() {
    assert_wire_roundtrip::<SessionMarker>(json!({
        "sessionId": "s1",
        "workspaceId": "w1",
        "createdAt": "2026-01-01T00:00:00Z",
    }));
}
