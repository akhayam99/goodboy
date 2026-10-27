use serde_json::json;

use super::*;
use crate::util::wire_shape::assert_wire_roundtrip;

#[test]
fn wire_shape_linear_viewer() {
    assert_wire_roundtrip::<LinearViewer>(json!({
        "id": "u1",
        "name": "Acme User",
        "email": "user@acme.example",
        "organization": { "urlKey": "acme", "name": "Acme" },
    }));
}

#[test]
fn wire_shape_linear_issue() {
    assert_wire_roundtrip::<LinearIssue>(json!({
        "id": "i1",
        "identifier": "ACM-1",
        "title": "Fix ledger",
        "description": "text",
        "url": "link/ACM-1",
        "state": { "name": "Todo", "type": "unstarted" },
        "team": { "key": "ACM" },
        "priority": 2,
        "priorityLabel": "High",
        "assignee": { "name": "Acme User" },
        "creator": { "name": "Northwind User" },
        "project": { "name": "ledger-core" },
        "labels": { "nodes": [{ "name": "bug", "color": "#f00" }] },
        "updatedAt": "2026-01-01T00:00:00Z",
        "branchName": "acm-1-fix-ledger",
        "attachments": {
            "nodes": [{
                "id": "t1",
                "title": "PR",
                "url": "https://example.com/pr/1",
                "sourceType": "github",
                "metadata": { "a": "b" },
            }],
        },
    }));
}

#[test]
fn wire_shape_linear_issue_comment() {
    assert_wire_roundtrip::<LinearIssueComment>(json!({
        "id": "c1",
        "body": "text",
        "createdAt": "2026-01-01T00:00:00Z",
        "user": { "name": "Acme User", "avatarUrl": "https://example.com/a.png" },
        "parent": { "id": "c0" },
    }));
}

#[test]
fn wire_shape_linear_workflow_state() {
    assert_wire_roundtrip::<LinearWorkflowState>(json!({
        "id": "s1",
        "name": "Done",
        "type": "completed",
        "position": 3.0,
    }));
}

#[test]
fn wire_shape_linear_team_member() {
    assert_wire_roundtrip::<LinearTeamMember>(json!({
        "id": "m1",
        "name": "Acme User",
        "active": true,
    }));
}
