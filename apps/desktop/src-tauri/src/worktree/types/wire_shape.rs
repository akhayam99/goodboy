use serde_json::json;

use super::*;
use crate::util::wire_shape::assert_wire_value;

#[test]
fn wire_shape_created_worktree() {
    assert_wire_value(
        &CreatedWorktree {
            worktree_path: "/w/ledger-core".to_string(),
            branch_name: "ak/feat".to_string(),
            slug: "feat".to_string(),
            reused: true,
            tracked_remote: false,
        },
        json!({
            "worktreePath": "/w/ledger-core",
            "branchName": "ak/feat",
            "slug": "feat",
            "reused": true,
            "trackedRemote": false,
        }),
    );
}

#[test]
fn wire_shape_worktree_info() {
    assert_wire_value(
        &WorktreeInfo {
            path: "/w/ledger-core".to_string(),
            branch: Some("main".to_string()),
            head: "abc".to_string(),
            is_main: true,
        },
        json!({ "path": "/w/ledger-core", "branch": "main", "head": "abc", "isMain": true }),
    );
}

#[test]
fn wire_shape_worktree_inspection() {
    assert_wire_value(
        &WorktreeInspection::Registered {
            path: "/w/a".to_string(),
            is_main: false,
            is_locked: true,
            lock_reason: Some("busy".to_string()),
        },
        json!({
            "kind": "registered",
            "path": "/w/a",
            "isMain": false,
            "isLocked": true,
            "lockReason": "busy",
        }),
    );
    assert_wire_value(
        &WorktreeInspection::ForeignDirectory {
            path: "/w/a".to_string(),
        },
        json!({ "kind": "foreign-directory", "path": "/w/a" }),
    );
}

#[test]
fn wire_shape_worktree_removal_result() {
    assert_wire_value(
        &WorktreeRemovalResult::Kept {
            path: "/w/a".to_string(),
            reasons: vec![WorktreeRemovalReason::WriterLeaseHeld],
        },
        json!({ "kind": "kept", "path": "/w/a", "reasons": ["writer-lease-held"] }),
    );
}

#[test]
fn wire_shape_branch_integration() {
    assert_wire_value(
        &BranchIntegration::Unmerged {
            base: "main".to_string(),
            ahead: 2,
        },
        json!({ "kind": "unmerged", "base": "main", "ahead": 2 }),
    );
}

#[test]
fn wire_shape_worktree_detach_assessment() {
    assert_wire_value(
        &WorktreeDetachAssessment::Assessed {
            path: "/w/a".to_string(),
            branch: Some("ak/feat".to_string()),
            has_upstream: true,
            affected_files: 1,
            local_only_commits: 2,
            ignored_files: 3,
            ignored_file_samples: vec!["dist".to_string()],
            integration: BranchIntegration::Merged {
                base: "main".to_string(),
            },
        },
        json!({
            "kind": "assessed",
            "path": "/w/a",
            "branch": "ak/feat",
            "hasUpstream": true,
            "affectedFiles": 1,
            "localOnlyCommits": 2,
            "ignoredFiles": 3,
            "ignoredFileSamples": ["dist"],
            "integration": { "kind": "merged", "base": "main" },
        }),
    );
}

#[test]
fn wire_shape_worktree_directory_size() {
    assert_wire_value(
        &WorktreeDirectorySize {
            path: "/w/a".to_string(),
            size_bytes: Some(10),
            is_partial: false,
            exists: true,
        },
        json!({ "path": "/w/a", "sizeBytes": 10, "isPartial": false, "exists": true }),
    );
}

#[test]
fn wire_shape_branch_info() {
    assert_wire_value(
        &BranchInfo {
            name: "main".to_string(),
            in_use: true,
            has_uncommitted: false,
        },
        json!({ "name": "main", "inUse": true, "hasUncommitted": false }),
    );
}

#[test]
fn wire_shape_remote_branch_info() {
    assert_wire_value(
        &RemoteBranchInfo {
            name: "origin/main".to_string(),
            author: "Acme".to_string(),
            sha: "abc".to_string(),
            timestamp: 7,
            has_local: true,
        },
        json!({
            "name": "origin/main",
            "author": "Acme",
            "sha": "abc",
            "timestamp": 7,
            "hasLocal": true,
        }),
    );
}

#[test]
fn wire_shape_remote_branch_state() {
    assert_wire_value(
        &RemoteBranchState {
            remote_ahead: 1,
            local_own: 2,
            remote_contains_local: true,
            remote_sha: "r".to_string(),
            local_sha: "l".to_string(),
        },
        json!({
            "remoteAhead": 1,
            "localOwn": 2,
            "remoteContainsLocal": true,
            "remoteSha": "r",
            "localSha": "l",
        }),
    );
}

#[test]
fn wire_shape_changed_branch() {
    assert_wire_value(&ChangedBranch { adopted: true }, json!({ "adopted": true }));
}

#[test]
fn wire_shape_split_candidate() {
    assert_wire_value(
        &SplitCandidate {
            candidate_id: "c1".to_string(),
            sha: Some("abc".to_string()),
        },
        json!({ "candidateId": "c1", "sha": "abc" }),
    );
}

#[test]
fn wire_shape_integrated_candidate() {
    assert_wire_value(
        &IntegratedCandidate {
            sha: "abc".to_string(),
        },
        json!({ "sha": "abc" }),
    );
}

#[test]
fn wire_shape_quarantined_candidate() {
    assert_wire_value(
        &QuarantinedCandidate {
            sha: Some("abc".to_string()),
            base_sha: "base".to_string(),
        },
        json!({ "sha": "abc", "baseSha": "base" }),
    );
}

#[test]
fn wire_shape_branch_commit() {
    assert_wire_value(
        &BranchCommit {
            sha: "abc".to_string(),
            short_sha: "ab".to_string(),
            subject: "fix".to_string(),
            author: "Acme".to_string(),
            timestamp: 5,
            pushed: true,
            parent_sha: Some("p".to_string()),
        },
        json!({
            "sha": "abc",
            "shortSha": "ab",
            "subject": "fix",
            "author": "Acme",
            "timestamp": 5,
            "pushed": true,
            "parentSha": "p",
        }),
    );
}

#[test]
fn wire_shape_git_distance_and_working_tree() {
    assert_wire_value(
        &GitDistance::Unknown {
            reason: GitUnknownReason::UpstreamGone,
        },
        json!({ "kind": "unknown", "reason": "upstream-gone" }),
    );
    assert_wire_value(
        &GitWorkingTree::Known {
            staged: 1,
            unstaged: 2,
            untracked: 3,
            unmerged: 4,
            changed: 5,
        },
        json!({
            "kind": "known",
            "staged": 1,
            "unstaged": 2,
            "untracked": 3,
            "unmerged": 4,
            "changed": 5,
        }),
    );
}

#[test]
fn wire_shape_worktree_status() {
    assert_wire_value(
        &WorktreeStatus {
            branch: Some("ak/feat".to_string()),
            head: Some("abc".to_string()),
            head_subject: Some("fix".to_string()),
            upstream_distance: GitDistance::Known {
                ahead: 1,
                behind: 0,
            },
            main_distance: GitDistance::Known {
                ahead: 2,
                behind: 3,
            },
            working_tree: GitWorkingTree::Unknown {
                reason: GitUnknownReason::StatusReadFailed,
            },
            upstream: Some("origin/ak/feat".to_string()),
            in_progress: Some(GitOperation::CherryPick),
        },
        json!({
            "branch": "ak/feat",
            "head": "abc",
            "headSubject": "fix",
            "upstreamDistance": { "kind": "known", "ahead": 1, "behind": 0 },
            "mainDistance": { "kind": "known", "ahead": 2, "behind": 3 },
            "workingTree": { "kind": "unknown", "reason": "status-read-failed" },
            "upstream": "origin/ak/feat",
            "inProgress": "cherry-pick",
        }),
    );
}

#[test]
fn wire_shape_inputs_read_camel_case() {
    let create: CreateArgs = serde_json::from_value(json!({
        "repoPath": "/r",
        "branchName": "b",
        "parentDir": "/p",
        "existingBranch": "e",
        "fallbackRef": "f",
        "baseBranch": "main",
        "dirName": "d",
    }))
    .unwrap();
    assert_eq!(create.repo_path, "/r");
    assert_eq!(create.parent_dir.as_deref(), Some("/p"));
    assert_eq!(create.existing_branch.as_deref(), Some("e"));
    assert_eq!(create.fallback_ref.as_deref(), Some("f"));
    assert_eq!(create.base_branch.as_deref(), Some("main"));
    assert_eq!(create.dir_name.as_deref(), Some("d"));

    let change: ChangeBranchArgs = serde_json::from_value(json!({
        "repoPath": "/r",
        "worktreePath": "/w",
        "branch": "b",
        "createNew": true,
    }))
    .unwrap();
    assert_eq!(change.worktree_path, "/w");
    assert!(change.create_new);

    let integrate: IntegrateCandidateArgs = serde_json::from_value(json!({
        "worktreePath": "/w",
        "candidateId": "c",
        "candidateSha": "s",
        "expectedHead": "h",
    }))
    .unwrap();
    assert_eq!(integrate.expected_head, "h");

    let quarantine: QuarantineCandidateArgs = serde_json::from_value(json!({
        "worktreePath": "/w",
        "candidateId": "c",
        "baseSha": "b",
        "stack": true,
    }))
    .unwrap();
    assert_eq!(quarantine.base_sha, "b");
    assert!(quarantine.stack);

    let split: SplitCandidatesArgs = serde_json::from_value(json!({
        "worktreePath": "/w",
        "baseSha": "b",
        "picks": [{ "candidateId": "c", "commitSha": "s" }],
        "stack": true,
    }))
    .unwrap();
    assert_eq!(split.picks[0].commit_sha, "s");
    assert!(split.stack);
}
