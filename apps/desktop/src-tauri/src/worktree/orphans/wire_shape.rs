use serde_json::json;

use super::*;
use crate::util::wire_shape::assert_wire_value;

#[test]
fn wire_shape_orphan_worktree() {
    assert_wire_value(
        &OrphanWorktree {
            path: "/r/.goodboy/worktrees/a".to_string(),
            name: "a".to_string(),
            is_registered: false,
        },
        json!({ "path": "/r/.goodboy/worktrees/a", "name": "a", "isRegistered": false }),
    );
}
