use serde_json::json;

use super::*;
use crate::util::wire_shape::assert_wire_value;

#[test]
fn wire_shape_base_update_result() {
    assert_wire_value(
        &BaseUpdateResult {
            base: "main".to_string(),
            checkout_branch: Some("main".to_string()),
            commits_pulled: 2,
        },
        json!({ "base": "main", "checkoutBranch": "main", "commitsPulled": 2 }),
    );
}
