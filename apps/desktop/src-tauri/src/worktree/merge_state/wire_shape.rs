use serde_json::json;

use super::*;
use crate::util::wire_shape::assert_wire_value;

#[test]
fn wire_shape_branch_merge_state() {
    assert_wire_value(
        &BranchMergeState::MergedThen { new_commits: 3 },
        json!({ "kind": "merged-then", "newCommits": 3 }),
    );
    assert_wire_value(
        &BranchMergeState::NotMerged { ahead: 2 },
        json!({ "kind": "not-merged", "ahead": 2 }),
    );
    assert_wire_value(
        &BranchMergeState::MergedViaPr,
        json!({ "kind": "merged-via-pr" }),
    );
}
