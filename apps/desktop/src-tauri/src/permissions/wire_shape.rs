use serde_json::json;

use super::*;
use crate::util::wire_shape::{assert_wire_reads, assert_wire_roundtrip};

#[test]
fn wire_shape_permission_rule_row() {
    assert_wire_roundtrip::<PermissionRuleRow>(json!({
        "id": "r1",
        "scope": "workspace",
        "workspaceId": "w1",
        "sessionId": "s1",
        "patternTool": "Bash",
        "patternArgsMatcher": "git *",
        "decision": "allow",
        "priority": 3,
        "createdAt": "2026-01-01T00:00:00Z",
        "updatedAt": "2026-01-02T00:00:00Z",
    }));
}

#[test]
fn wire_shape_permission_rule_upsert_input() {
    assert_wire_reads::<PermissionRuleUpsertInput>(json!({
        "id": "r1",
        "scope": "workspace",
        "workspaceId": "w1",
        "sessionId": "s1",
        "patternTool": "Bash",
        "patternArgsMatcher": "git *",
        "decision": "allow",
        "priority": 3,
    }));
}

#[test]
fn wire_shape_permission_audit_row() {
    assert_wire_roundtrip::<PermissionAuditRow>(json!({
        "id": "a1",
        "runId": "run1",
        "sessionId": "s1",
        "toolUseId": "tu1",
        "toolName": "Bash",
        "inputJson": "{}",
        "decision": "allow",
        "ruleId": "r1",
        "decidedBy": "rule",
        "requestedAt": "2026-01-01T00:00:00Z",
        "decidedAt": "2026-01-01T00:00:01Z",
    }));
}

#[test]
fn wire_shape_permission_audit_insert_input() {
    assert_wire_reads::<PermissionAuditInsertInput>(json!({
        "id": "a1",
        "runId": "run1",
        "sessionId": "s1",
        "toolUseId": "tu1",
        "toolName": "Bash",
        "inputJson": "{}",
        "decision": "allow",
        "ruleId": "r1",
        "decidedBy": "rule",
        "requestedAt": "2026-01-01T00:00:00Z",
        "decidedAt": "2026-01-01T00:00:01Z",
    }));
}

#[test]
fn wire_shape_audit_retry_row() {
    assert_wire_roundtrip::<AuditRetryRow>(json!({
        "id": "q1",
        "payloadJson": "{}",
        "attempts": 2,
        "lastError": "boom",
        "createdAt": 10,
        "updatedAt": 11,
    }));
}

#[test]
fn wire_shape_audit_retry_enqueue_input() {
    assert_wire_reads::<AuditRetryEnqueueInput>(json!({ "id": "q1", "payloadJson": "{}" }));
}
