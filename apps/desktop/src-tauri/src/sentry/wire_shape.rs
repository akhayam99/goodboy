use serde_json::json;

use super::*;
use crate::util::wire_shape::{assert_wire_roundtrip, assert_wire_value};

#[test]
fn wire_shape_sentry_issue() {
    assert_wire_roundtrip::<SentryIssue>(json!({
        "id": "1",
        "project": { "slug": "payments-api", "name": "payments-api" },
        "shortId": "PAY-1",
        "title": "Boom",
        "culprit": "ledger.rs",
        "level": "error",
        "status": "unresolved",
        "count": "4",
        "userCount": 2,
        "firstSeen": "2026-01-01T00:00:00Z",
        "lastSeen": "2026-01-02T00:00:00Z",
        "permalink": "link/1",
        "metadata": { "type": "Error", "value": "boom" },
    }));
}

#[test]
fn wire_shape_sentry_code_mapping() {
    assert_wire_roundtrip::<SentryCodeMapping>(json!({
        "projectSlug": "payments-api",
        "repoName": "northwind/ledger-core",
        "stackRoot": "services/payments",
        "sourceRoot": "services/payments",
    }));
}

#[test]
fn wire_shape_sentry_issues_page_keeps_snake_case_cursor() {
    assert_wire_value(
        &SentryIssuesPage {
            issues: Vec::new(),
            next_cursor: Some("c".to_string()),
        },
        json!({ "issues": [], "next_cursor": "c" }),
    );
}

#[test]
fn wire_shape_sentry_issue_detail_keeps_snake_case_frame_keys() {
    assert_wire_value(
        &SentryIssueDetail {
            title: Some("Boom".to_string()),
            culprit: Some("ledger.rs".to_string()),
            frames: vec![SentryStackFrame {
                filename: Some("ledger.rs".to_string()),
                function: Some("run".to_string()),
                line_no: Some(3),
                in_app: true,
            }],
            tags: vec![SentryTag {
                key: "env".to_string(),
                value: "prod".to_string(),
            }],
            breadcrumbs: vec![SentryBreadcrumb {
                category: Some("http".to_string()),
                message: Some("GET".to_string()),
                level: Some("info".to_string()),
                timestamp: Some("2026-01-01T00:00:00Z".to_string()),
            }],
        },
        json!({
            "title": "Boom",
            "culprit": "ledger.rs",
            "frames": [{
                "filename": "ledger.rs",
                "function": "run",
                "line_no": 3,
                "in_app": true,
            }],
            "tags": [{ "key": "env", "value": "prod" }],
            "breadcrumbs": [{
                "category": "http",
                "message": "GET",
                "level": "info",
                "timestamp": "2026-01-01T00:00:00Z",
            }],
        }),
    );
}
