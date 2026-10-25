use serde_json::json;

use super::*;
use crate::util::wire_shape::assert_wire_value;

fn user() -> BitbucketUser {
    BitbucketUser {
        uuid: "{u1}".to_string(),
        account_id: Some("a1".to_string()),
        nickname: "acme".to_string(),
        display_name: "Acme User".to_string(),
        avatar_url: Some("https://example.com/a.png".to_string()),
    }
}

fn user_wire() -> serde_json::Value {
    json!({
        "uuid": "{u1}",
        "accountId": "a1",
        "nickname": "acme",
        "displayName": "Acme User",
        "avatarUrl": "https://example.com/a.png",
    })
}

fn workspace() -> BitbucketWorkspace {
    BitbucketWorkspace {
        uuid: "{w1}".to_string(),
        slug: "acme".to_string(),
        name: "Acme".to_string(),
        web_url: Some("link/acme".to_string()),
    }
}

fn workspace_wire() -> serde_json::Value {
    json!({
        "uuid": "{w1}",
        "slug": "acme",
        "name": "Acme",
        "webUrl": "link/acme",
    })
}

#[test]
fn wire_shape_bitbucket_user() {
    assert_wire_value(&user(), user_wire());
}

#[test]
fn wire_shape_bitbucket_workspace() {
    assert_wire_value(&workspace(), workspace_wire());
}

#[test]
fn wire_shape_bitbucket_connection() {
    assert_wire_value(
        &BitbucketConnection {
            user: user(),
            workspace: workspace(),
        },
        json!({ "user": user_wire(), "workspace": workspace_wire() }),
    );
}

#[test]
fn wire_shape_bitbucket_participant() {
    assert_wire_value(
        &BitbucketParticipant {
            user: Some(user()),
            role: "REVIEWER".to_string(),
            approved: true,
            state: Some("approved".to_string()),
        },
        json!({
            "user": user_wire(),
            "role": "REVIEWER",
            "approved": true,
            "state": "approved",
        }),
    );
}

#[test]
fn wire_shape_bitbucket_pull_request() {
    assert_wire_value(
        &BitbucketPullRequest {
            id: 4,
            title: "Fix".to_string(),
            description: "text".to_string(),
            state: "OPEN".to_string(),
            request_state: crate::integrations::request_state::RequestState::Open,
            created_on: "2026-01-01".to_string(),
            updated_on: "2026-01-02".to_string(),
            source_branch: "ak/feat".to_string(),
            source_commit: Some("abc".to_string()),
            destination_branch: "main".to_string(),
            destination_commit: Some("def".to_string()),
            author: Some(user()),
            reviewers: vec![user()],
            participants: Vec::new(),
            close_source_branch: true,
            merge_commit: Some("ghi".to_string()),
            comment_count: 2,
            task_count: 1,
            web_url: Some("link/pr/4".to_string()),
        },
        json!({
            "id": 4,
            "title": "Fix",
            "description": "text",
            "state": "OPEN",
            "requestState": "open",
            "createdOn": "2026-01-01",
            "updatedOn": "2026-01-02",
            "sourceBranch": "ak/feat",
            "sourceCommit": "abc",
            "destinationBranch": "main",
            "destinationCommit": "def",
            "author": user_wire(),
            "reviewers": [user_wire()],
            "participants": [],
            "closeSourceBranch": true,
            "mergeCommit": "ghi",
            "commentCount": 2,
            "taskCount": 1,
            "webUrl": "link/pr/4",
        }),
    );
}

#[test]
fn wire_shape_bitbucket_comment() {
    assert_wire_value(
        &BitbucketComment {
            id: 5,
            body: "text".to_string(),
            user: Some(user()),
            created_on: "2026-01-01".to_string(),
            updated_on: "2026-01-02".to_string(),
            deleted: false,
            parent_id: Some(3),
            inline: Some(BitbucketInline {
                path: "a.rs".to_string(),
                from: Some(1),
                to: Some(2),
            }),
            web_url: Some("link/c/5".to_string()),
        },
        json!({
            "id": 5,
            "body": "text",
            "user": user_wire(),
            "createdOn": "2026-01-01",
            "updatedOn": "2026-01-02",
            "deleted": false,
            "parentId": 3,
            "inline": { "path": "a.rs", "from": 1, "to": 2 },
            "webUrl": "link/c/5",
        }),
    );
}

#[test]
fn wire_shape_bitbucket_status() {
    assert_wire_value(
        &BitbucketStatus {
            key: "ci".to_string(),
            name: "CI".to_string(),
            state: "SUCCESSFUL".to_string(),
            url: Some("link/1".to_string()),
            description: Some("ok".to_string()),
            refname: Some("main".to_string()),
            created_on: "2026-01-01".to_string(),
            updated_on: "2026-01-02".to_string(),
        },
        json!({
            "key": "ci",
            "name": "CI",
            "state": "SUCCESSFUL",
            "url": "link/1",
            "description": "ok",
            "refname": "main",
            "createdOn": "2026-01-01",
            "updatedOn": "2026-01-02",
        }),
    );
}

#[test]
fn wire_shape_bitbucket_commit() {
    assert_wire_value(
        &BitbucketCommit {
            hash: "abc".to_string(),
            message: "fix".to_string(),
            date: "2026-01-01".to_string(),
            author: Some("Acme User".to_string()),
        },
        json!({
            "hash": "abc",
            "message": "fix",
            "date": "2026-01-01",
            "author": "Acme User",
        }),
    );
}
