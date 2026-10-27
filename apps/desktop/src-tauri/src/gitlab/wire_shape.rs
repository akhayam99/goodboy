use serde_json::json;

use super::*;
use crate::util::wire_shape::{assert_wire_alias, assert_wire_roundtrip, assert_wire_value};

fn author_wire() -> serde_json::Value {
    json!({
        "id": 7,
        "username": "acme",
        "name": "Acme User",
        "avatarUrl": "https://example.com/a.png",
    })
}

#[test]
fn wire_shape_gitlab_user() {
    assert_wire_roundtrip::<GitlabUser>(json!({
        "id": 7,
        "username": "acme",
        "name": "Acme User",
        "avatarUrl": "https://example.com/a.png",
    }));
    assert_wire_alias::<GitlabUser>(
        json!({ "id": 7, "username": "acme", "name": "A", "avatar_url": "u" }),
        json!({ "id": 7, "username": "acme", "name": "A", "avatarUrl": "u" }),
    );
}

#[test]
fn wire_shape_gitlab_issue() {
    let wire = json!({
        "id": 1,
        "iid": 2,
        "projectId": 3,
        "title": "Fix",
        "description": "text",
        "state": "opened",
        "webUrl": "link/acme/ledger-core/-/issues/2",
        "references": { "full": "acme/ledger-core#2" },
        "updatedAt": "2026-01-01T00:00:00Z",
        "milestone": { "title": "v1" },
        "labels": ["bug"],
    });
    assert_wire_roundtrip::<GitlabIssue>(wire.clone());
    assert_wire_alias::<GitlabIssue>(
        json!({
            "id": 1,
            "iid": 2,
            "project_id": 3,
            "title": "Fix",
            "description": "text",
            "state": "opened",
            "web_url": "link/acme/ledger-core/-/issues/2",
            "references": { "full": "acme/ledger-core#2" },
            "updated_at": "2026-01-01T00:00:00Z",
            "milestone": { "title": "v1" },
            "labels": ["bug"],
        }),
        wire,
    );
}

#[test]
fn wire_shape_gitlab_merge_request() {
    let wire = json!({
        "id": 1,
        "iid": 2,
        "projectId": 3,
        "title": "Fix",
        "description": "text",
        "state": "opened",
        "requestState": "draft",
        "webUrl": "link/mr/2",
        "sourceBranch": "ak/feat",
        "targetBranch": "main",
        "draft": true,
        "isMergeWhenPipelineSucceeds": true,
        "hasConflicts": false,
        "mergeStatus": "can_be_merged",
        "updatedAt": "2026-01-01T00:00:00Z",
        "sha": "abc",
        "mergedAt": "2026-01-02T00:00:00Z",
        "author": author_wire(),
        "reviewers": [author_wire()],
        "createdAt": "2025-12-31T00:00:00Z",
        "detailedMergeStatus": "mergeable",
        "headPipeline": { "id": 9, "status": "success", "webUrl": "link/p/9" },
    });
    assert_wire_roundtrip::<GitlabMergeRequest>(wire.clone());
    assert_wire_alias::<GitlabMergeRequest>(
        json!({
            "id": 1,
            "iid": 2,
            "project_id": 3,
            "title": "Fix",
            "description": "text",
            "state": "opened",
            "web_url": "link/mr/2",
            "source_branch": "ak/feat",
            "target_branch": "main",
            "draft": true,
            "merge_when_pipeline_succeeds": true,
            "has_conflicts": false,
            "merge_status": "can_be_merged",
            "updated_at": "2026-01-01T00:00:00Z",
            "sha": "abc",
            "merged_at": "2026-01-02T00:00:00Z",
            "author": { "id": 7, "username": "acme", "name": "Acme User", "avatar_url": "https://example.com/a.png" },
            "reviewers": [author_wire()],
            "created_at": "2025-12-31T00:00:00Z",
            "detailed_merge_status": "mergeable",
            "head_pipeline": { "id": 9, "status": "success", "web_url": "link/p/9" },
        }),
        wire,
    );
}

#[test]
fn wire_shape_gitlab_diff_refs() {
    assert_wire_roundtrip::<GitlabDiffRefs>(json!({
        "baseSha": "b",
        "headSha": "h",
        "startSha": "s",
    }));
    assert_wire_alias::<GitlabDiffRefs>(
        json!({ "base_sha": "b", "head_sha": "h", "start_sha": "s" }),
        json!({ "baseSha": "b", "headSha": "h", "startSha": "s" }),
    );
}

#[test]
fn wire_shape_gitlab_mr_discussion() {
    let wire = json!({
        "id": "d1",
        "individualNote": true,
        "notes": [{
            "id": 1,
            "body": "text",
            "system": false,
            "author": author_wire(),
            "createdAt": "2026-01-01T00:00:00Z",
            "resolvable": true,
            "resolved": false,
            "position": { "newPath": "a.rs", "oldPath": "b.rs", "newLine": 3, "oldLine": 4 },
        }],
    });
    assert_wire_roundtrip::<GitlabMrDiscussion>(wire.clone());
    assert_wire_alias::<GitlabMrDiscussion>(
        json!({
            "id": "d1",
            "individual_note": true,
            "notes": [{
                "id": 1,
                "body": "text",
                "system": false,
                "author": author_wire(),
                "created_at": "2026-01-01T00:00:00Z",
                "resolvable": true,
                "resolved": false,
                "position": { "new_path": "a.rs", "old_path": "b.rs", "new_line": 3, "old_line": 4 },
            }],
        }),
        wire,
    );
}

#[test]
fn wire_shape_gitlab_issue_note() {
    let wire = json!({
        "id": 1,
        "body": "text",
        "system": false,
        "author": author_wire(),
        "createdAt": "2026-01-01T00:00:00Z",
    });
    assert_wire_roundtrip::<GitlabIssueNote>(wire.clone());
    assert_wire_alias::<GitlabIssueNote>(
        json!({
            "id": 1,
            "body": "text",
            "system": false,
            "author": author_wire(),
            "created_at": "2026-01-01T00:00:00Z",
        }),
        wire,
    );
}

#[test]
fn wire_shape_gitlab_mr_approval_state() {
    let wire = json!({
        "approvalsRequired": 2,
        "approvalsLeft": 1,
        "userHasApproved": true,
        "userCanApprove": false,
        "approvedBy": [{ "user": author_wire() }],
    });
    assert_wire_roundtrip::<GitlabMrApprovalState>(wire.clone());
    assert_wire_alias::<GitlabMrApprovalState>(
        json!({
            "approvals_required": 2,
            "approvals_left": 1,
            "user_has_approved": true,
            "user_can_approve": false,
            "approved_by": [{ "user": author_wire() }],
        }),
        wire,
    );
}

#[test]
fn wire_shape_gitlab_merge_settings() {
    let wire = json!({
        "mergeMethod": "ff",
        "squashOption": "default_on",
        "onlyAllowMergeIfPipelineSucceeds": true,
    });
    assert_wire_roundtrip::<GitlabMergeSettings>(wire.clone());
    assert_wire_alias::<GitlabMergeSettings>(
        json!({
            "merge_method": "ff",
            "squash_option": "default_on",
            "only_allow_merge_if_pipeline_succeeds": true,
        }),
        wire,
    );
}

#[test]
fn wire_shape_gitlab_pipeline_job_and_checks() {
    let pipeline = json!({
        "id": 9,
        "status": "success",
        "webUrl": "link/p/9",
        "sha": "abc",
        "projectId": 3,
    });
    let job = json!({
        "id": 10,
        "name": "test",
        "stage": "test",
        "status": "success",
        "webUrl": "link/j/10",
        "allowFailure": true,
        "duration": 1.5,
    });
    assert_wire_roundtrip::<GitlabPipeline>(pipeline.clone());
    assert_wire_roundtrip::<GitlabJob>(job.clone());
    assert_wire_alias::<GitlabJob>(
        json!({
            "id": 10,
            "name": "test",
            "stage": "test",
            "status": "success",
            "web_url": "link/j/10",
            "allow_failure": true,
            "duration": 1.5,
        }),
        job.clone(),
    );
    let checks = GitlabMrChecks {
        pipeline: Some(serde_json::from_value(pipeline.clone()).unwrap()),
        jobs: vec![serde_json::from_value(job.clone()).unwrap()],
    };
    assert_wire_value(&checks, json!({ "pipeline": pipeline, "jobs": [job] }));
}

#[test]
fn wire_shape_gitlab_mr_commit() {
    let wire = json!({
        "id": "abc",
        "shortId": "ab",
        "title": "fix",
        "authorName": "Acme User",
        "committedDate": "2026-01-01T00:00:00Z",
    });
    assert_wire_roundtrip::<GitlabMrCommit>(wire.clone());
    assert_wire_alias::<GitlabMrCommit>(
        json!({
            "id": "abc",
            "short_id": "ab",
            "title": "fix",
            "author_name": "Acme User",
            "committed_date": "2026-01-01T00:00:00Z",
        }),
        wire,
    );
}

#[test]
fn wire_shape_gitlab_discussion_position_reads_camel_case() {
    let position: GitlabDiscussionPosition = serde_json::from_value(json!({
        "baseSha": "b",
        "headSha": "h",
        "startSha": "s",
        "newPath": "a.rs",
        "newLine": 3,
        "oldPath": "b.rs",
        "oldLine": 4,
    }))
    .unwrap();
    assert_eq!(position.base_sha, "b");
    assert_eq!(position.head_sha, "h");
    assert_eq!(position.start_sha, "s");
    assert_eq!(position.new_path, "a.rs");
    assert_eq!(position.new_line, Some(3));
    assert_eq!(position.old_path.as_deref(), Some("b.rs"));
    assert_eq!(position.old_line, Some(4));
}
