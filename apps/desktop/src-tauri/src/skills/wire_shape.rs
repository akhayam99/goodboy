use serde_json::json;

use super::*;
use crate::util::wire_shape::{assert_wire_reads, assert_wire_roundtrip, assert_wire_value};

#[test]
fn wire_shape_skill_row() {
    assert_wire_roundtrip::<SkillRow>(json!({
        "id": "k1",
        "workspaceId": "w1",
        "name": "review",
        "description": "reviews",
        "filePath": "/w/skills/review.md",
        "body": "text",
        "frontmatterJson": "{}",
        "createdAt": "2026-01-01T00:00:00Z",
        "updatedAt": "2026-01-02T00:00:00Z",
    }));
}

#[test]
fn wire_shape_skill_upsert_input() {
    assert_wire_reads::<SkillUpsertInput>(json!({
        "workspaceId": "w1",
        "name": "review",
        "description": "reviews",
        "frontmatterJson": "{}",
        "body": "text",
        "markdown": "---\n---\ntext",
        "filePath": "/w/skills/review.md",
    }));
}

#[test]
fn wire_shape_skill_run_script_result() {
    assert_wire_value(
        &SkillRunScriptResult {
            stdout: "ok".to_string(),
        },
        json!({ "stdout": "ok" }),
    );
}

#[test]
fn wire_shape_skill_run_script_input() {
    assert_wire_reads::<SkillRunScriptInput>(json!({
        "scriptPath": "/w/run.sh",
        "args": ["--fast"],
        "workingDir": "/w",
        "skillId": "k1",
    }));
}
