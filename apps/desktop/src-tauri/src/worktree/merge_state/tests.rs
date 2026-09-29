use super::{branch_merge_state, BranchMergeState};
use crate::worktree::git::git;
use std::path::{Path, PathBuf};

fn temp_root(name: &str) -> PathBuf {
    let root = std::env::temp_dir().join(format!(
        "goodboy-{name}-{}-{}",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ));
    std::fs::create_dir_all(&root).unwrap();
    root
}

fn git_ok(cwd: &Path, args: &[&str]) -> String {
    git(cwd, args)
        .unwrap_or_else(|err| panic!("git {} failed: {err}", args.join(" ")))
        .trim()
        .to_string()
}

fn init_repo(name: &str) -> PathBuf {
    let root = temp_root(name);
    git_ok(&root, &["init", "-b", "main"]);
    git_ok(&root, &["config", "user.email", "test@example.com"]);
    git_ok(&root, &["config", "user.name", "test"]);
    git_ok(&root, &["config", "commit.gpgsign", "false"]);
    root
}

fn commit(root: &Path, file: &str, body: &str, message: &str) -> String {
    std::fs::write(root.join(file), body).unwrap();
    git_ok(root, &["add", file]);
    git_ok(root, &["commit", "-m", message]);
    git_ok(root, &["rev-parse", "HEAD"])
}

#[test]
fn branch_merge_state_flags_a_branch_with_no_own_commits() {
    let root = init_repo("merge-state-empty");
    commit(&root, "a.txt", "hello", "init");
    git_ok(&root, &["branch", "goodboy/empty"]);

    let state = branch_merge_state(&root, "goodboy/empty", Some("main"), None);

    assert_eq!(state, BranchMergeState::NoOwnCommits);
    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn branch_merge_state_reports_merged_via_merge_commit() {
    let root = init_repo("merge-state-merged");
    commit(&root, "a.txt", "hello", "init");
    git_ok(&root, &["checkout", "-b", "goodboy/feature"]);
    commit(&root, "b.txt", "feature", "feature work");
    git_ok(&root, &["checkout", "main"]);
    git_ok(
        &root,
        &["merge", "--no-ff", "-m", "merge feature", "goodboy/feature"],
    );

    let state = branch_merge_state(&root, "goodboy/feature", Some("main"), None);

    assert_eq!(state, BranchMergeState::MergedViaMerge);
    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn branch_merge_state_reports_merged_via_rebase() {
    let root = init_repo("merge-state-rebased");
    commit(&root, "a.txt", "hello", "init");
    git_ok(&root, &["checkout", "-b", "goodboy/rebased"]);
    std::fs::write(root.join("b.txt"), "feature").unwrap();
    git_ok(&root, &["add", "b.txt"]);
    git_ok(&root, &["commit", "-m", "feature work"]);
    let feature_sha = git_ok(&root, &["rev-parse", "HEAD"]);
    git_ok(&root, &["checkout", "main"]);
    commit(&root, "c.txt", "main moved on", "main work");
    git_ok(&root, &["cherry-pick", &feature_sha]);

    let state = branch_merge_state(&root, "goodboy/rebased", Some("main"), None);

    assert_eq!(state, BranchMergeState::MergedViaRebase);
    std::fs::remove_dir_all(root).unwrap();
}

fn squash_merge(root: &Path, branch: &str) -> String {
    git_ok(root, &["checkout", "-b", branch]);
    commit(root, "b.txt", "one", "first");
    commit(root, "c.txt", "two", "second");
    let head = git_ok(root, &["rev-parse", "HEAD"]);
    git_ok(root, &["checkout", "main"]);
    commit(root, "d.txt", "main moved on", "main work");
    git_ok(root, &["merge", "--squash", branch]);
    git_ok(root, &["commit", "-m", "squash feature"]);
    head
}

#[test]
fn branch_merge_state_reads_a_squash_as_merged_only_from_the_request() {
    let root = init_repo("merge-state-squashed");
    commit(&root, "a.txt", "hello", "init");
    let head = squash_merge(&root, "goodboy/squashed");

    let without = branch_merge_state(&root, "goodboy/squashed", Some("main"), None);
    let with = branch_merge_state(&root, "goodboy/squashed", Some("main"), Some(&head));

    assert_eq!(without, BranchMergeState::NotMerged { ahead: 2 });
    assert_eq!(with, BranchMergeState::MergedViaPr);
    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn branch_merge_state_counts_commits_after_the_merged_head() {
    let root = init_repo("merge-state-merged-then");
    commit(&root, "a.txt", "hello", "init");
    let head = squash_merge(&root, "goodboy/reused");
    git_ok(&root, &["checkout", "goodboy/reused"]);
    commit(&root, "e.txt", "more", "after merge one");
    commit(&root, "f.txt", "more", "after merge two");
    git_ok(&root, &["checkout", "main"]);

    let state = branch_merge_state(&root, "goodboy/reused", Some("main"), Some(&head));

    assert_eq!(state, BranchMergeState::MergedThen { new_commits: 2 });
    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn branch_merge_state_falls_back_to_git_when_the_merged_head_is_unknown() {
    let root = init_repo("merge-state-missing-head");
    commit(&root, "a.txt", "hello", "init");
    git_ok(&root, &["checkout", "-b", "goodboy/feature"]);
    commit(&root, "b.txt", "feature", "feature work");
    git_ok(&root, &["checkout", "main"]);

    let state = branch_merge_state(
        &root,
        "goodboy/feature",
        Some("main"),
        Some("0000000000000000000000000000000000000000"),
    );

    assert_eq!(state, BranchMergeState::NotMerged { ahead: 1 });
    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn branch_merge_state_reports_not_merged_when_ahead() {
    let root = init_repo("merge-state-unmerged");
    commit(&root, "a.txt", "hello", "init");
    git_ok(&root, &["checkout", "-b", "goodboy/reused"]);
    commit(&root, "b.txt", "feature", "feature work");

    let state = branch_merge_state(&root, "goodboy/reused", Some("main"), None);

    assert_eq!(state, BranchMergeState::NotMerged { ahead: 1 });
    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn branch_merge_state_protects_the_base_branch_itself() {
    let root = init_repo("merge-state-protected");
    commit(&root, "a.txt", "hello", "init");

    let state = branch_merge_state(&root, "main", Some("main"), None);

    assert_eq!(state, BranchMergeState::Protected);
    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn branch_merge_state_protects_a_branch_held_by_another_worktree() {
    let root = init_repo("merge-state-held");
    commit(&root, "a.txt", "hello", "init");
    git_ok(&root, &["branch", "goodboy/held"]);
    let other = root.join("other-worktree");
    git_ok(
        &root,
        &["worktree", "add", other.to_str().unwrap(), "goodboy/held"],
    );

    let state = branch_merge_state(&root, "goodboy/held", Some("main"), None);

    assert_eq!(state, BranchMergeState::Protected);
    git_ok(
        &root,
        &["worktree", "remove", "--force", other.to_str().unwrap()],
    );
    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn branch_merge_state_is_unknown_without_a_resolvable_base() {
    let root = init_repo("merge-state-unknown-base");
    commit(&root, "a.txt", "hello", "init");
    git_ok(&root, &["branch", "goodboy/orphan"]);
    git_ok(&root, &["branch", "-m", "main", "trunk"]);

    let state = branch_merge_state(&root, "goodboy/orphan", None, None);

    assert_eq!(state, BranchMergeState::Unknown);
    std::fs::remove_dir_all(root).unwrap();
}
