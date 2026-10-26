use serde_json::json;

use super::*;
use crate::util::wire_shape::{assert_wire_reads, assert_wire_value};
use crate::worktree::{GitDistance, GitOperation, GitWorkingTree};

#[test]
fn wire_shape_git_repo_check() {
    assert_wire_value(
        &GitRepoCheck {
            is_repo: false,
            root_path: Some("/r".to_string()),
            resolved_path: Some("/r".to_string()),
            default_branch: Some("main".to_string()),
            error: Some("not a repository".to_string()),
            error_kind: Some(GitRepoErrorKind::NotARepository),
        },
        json!({
            "isRepo": false,
            "rootPath": "/r",
            "resolvedPath": "/r",
            "defaultBranch": "main",
            "error": "not a repository",
            "errorKind": "not_a_repository",
        }),
    );
}

#[test]
fn wire_shape_workspace_git_status() {
    assert_wire_value(
        &WorkspaceGitStatus {
            state: "ready",
            branch: Some("main".to_string()),
            head_subject: Some("fix".to_string()),
            upstream_distance: GitDistance::Known {
                ahead: 1,
                behind: 2,
            },
            working_tree: GitWorkingTree::Known {
                staged: 0,
                unstaged: 1,
                untracked: 2,
                unmerged: 0,
                changed: 3,
            },
            upstream: Some("origin/main".to_string()),
            in_progress: Some(GitOperation::Rebase),
        },
        json!({
            "state": "ready",
            "branch": "main",
            "headSubject": "fix",
            "upstreamDistance": { "kind": "known", "ahead": 1, "behind": 2 },
            "workingTree": {
                "kind": "known",
                "staged": 0,
                "unstaged": 1,
                "untracked": 2,
                "unmerged": 0,
                "changed": 3,
            },
            "upstream": "origin/main",
            "inProgress": "rebase",
        }),
    );
}

#[test]
fn wire_shape_initialized_repo() {
    assert_wire_value(
        &InitializedRepo {
            root_path: "/r".to_string(),
            remote_url: "git@example.com:acme/ledger-core.git".to_string(),
            branch: "main".to_string(),
        },
        json!({
            "rootPath": "/r",
            "remoteUrl": "git@example.com:acme/ledger-core.git",
            "branch": "main",
        }),
    );
}

#[test]
fn wire_shape_child_repo() {
    assert_wire_value(
        &ChildRepo {
            name: "ledger-core".to_string(),
            path: "/r/ledger-core".to_string(),
            default_branch: Some("main".to_string()),
        },
        json!({ "name": "ledger-core", "path": "/r/ledger-core", "defaultBranch": "main" }),
    );
}

#[test]
fn wire_shape_repo_identity() {
    assert_wire_value(
        &RepoIdentity {
            root_commits: vec!["abc".to_string()],
            remote_url: Some("u".to_string()),
        },
        json!({ "rootCommits": ["abc"], "remoteUrl": "u" }),
    );
}

#[test]
fn wire_shape_moved_project_input_and_match() {
    assert_wire_reads::<MovedProjectInput>(json!({
        "id": "p1",
        "name": "ledger-core",
        "rootCommit": "abc",
        "remoteUrl": "u",
    }));
    assert_wire_value(
        &MovedProjectMatch {
            project_id: "p1".to_string(),
            path: Some("/r/ledger-core".to_string()),
            verdict: MovedProjectVerdict::SameRepository,
            identity: Some(RepoIdentity {
                root_commits: vec!["abc".to_string()],
                remote_url: None,
            }),
        },
        json!({
            "projectId": "p1",
            "path": "/r/ledger-core",
            "verdict": "same_repository",
            "identity": { "rootCommits": ["abc"], "remoteUrl": null },
        }),
    );
}
