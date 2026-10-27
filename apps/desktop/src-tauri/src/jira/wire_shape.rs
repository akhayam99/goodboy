use serde_json::json;

use super::*;
use crate::util::wire_shape::{assert_wire_roundtrip, assert_wire_value};

fn user_wire() -> serde_json::Value {
    json!({
        "accountId": "a1",
        "displayName": "Acme User",
        "emailAddress": "user@acme.example",
        "avatarUrls": { "48x48": "https://example.com/l.png", "24x24": "https://example.com/s.png" },
        "active": true,
    })
}

#[test]
fn wire_shape_jira_user() {
    assert_wire_roundtrip::<JiraUser>(user_wire());
}

#[test]
fn wire_shape_jira_issue() {
    let user: JiraUser = serde_json::from_value(user_wire()).unwrap();
    let reporter: JiraUser = serde_json::from_value(user_wire()).unwrap();
    assert_wire_value(
        &JiraIssue {
            id: "1".to_string(),
            key: "ACM-1".to_string(),
            summary: "Fix".to_string(),
            description: "text".to_string(),
            status: "To Do".to_string(),
            status_category: "new".to_string(),
            issue_type: "Bug".to_string(),
            priority: Some("High".to_string()),
            assignee: Some(user),
            reporter: Some(reporter),
            labels: vec!["bug".to_string()],
            created: "2026-01-01".to_string(),
            updated: "2026-01-02".to_string(),
            url: "link/browse/ACM-1".to_string(),
        },
        json!({
            "id": "1",
            "key": "ACM-1",
            "summary": "Fix",
            "description": "text",
            "status": "To Do",
            "statusCategory": "new",
            "issueType": "Bug",
            "priority": "High",
            "assignee": user_wire(),
            "reporter": user_wire(),
            "labels": ["bug"],
            "created": "2026-01-01",
            "updated": "2026-01-02",
            "url": "link/browse/ACM-1",
        }),
    );
}

#[test]
fn wire_shape_jira_comment() {
    let author: JiraUser = serde_json::from_value(user_wire()).unwrap();
    assert_wire_value(
        &JiraComment {
            id: "c1".to_string(),
            author: Some(author),
            body: "text".to_string(),
            created: "2026-01-01".to_string(),
            updated: "2026-01-02".to_string(),
        },
        json!({
            "id": "c1",
            "author": user_wire(),
            "body": "text",
            "created": "2026-01-01",
            "updated": "2026-01-02",
        }),
    );
}

#[test]
fn wire_shape_jira_transition() {
    assert_wire_roundtrip::<JiraTransition>(json!({
        "id": "t1",
        "name": "Done",
        "to": { "id": "s1", "name": "Done" },
        "hasScreen": true,
    }));
}

#[test]
fn wire_shape_jira_project() {
    assert_wire_roundtrip::<JiraProject>(json!({ "id": "p1", "key": "ACM", "name": "Acme" }));
}
