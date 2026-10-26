use serde_json::json;

use super::*;
use crate::util::wire_shape::assert_wire_value;

#[test]
fn wire_shape_fast_forward_result() {
    assert_wire_value(
        &FastForwardResult {
            branch: "ak/feat".to_string(),
            upstream: "origin/ak/feat".to_string(),
            commits_pulled: 2,
        },
        json!({ "branch": "ak/feat", "upstream": "origin/ak/feat", "commitsPulled": 2 }),
    );
}
