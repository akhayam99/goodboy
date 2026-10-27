use serde_json::json;

use super::*;
use crate::util::wire_shape::{assert_wire_reads, assert_wire_value};

#[test]
fn wire_shape_goodboy_ignore_status_dto() {
    assert_wire_value(
        &GoodboyIgnoreStatusDto {
            source: "repo".to_string(),
            path: Some("/r/.goodboyignore".to_string()),
            line: Some(3),
        },
        json!({ "source": "repo", "path": "/r/.goodboyignore", "line": 3 }),
    );
}

#[test]
fn wire_shape_goodboy_ignore_apply_args() {
    assert_wire_reads::<GoodboyIgnoreApplyArgs>(json!({ "repoPath": "/r", "target": "repo" }));
}
