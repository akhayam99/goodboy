use super::restore_worktree_folder_with;
use crate::worktree::folder::remove_worktree_folder_allowing;
use crate::worktree::git::git;
use crate::worktree::types::{
    WorktreeRemovalMode, WorktreeRemovalResult, WorktreeRestoreRefusal, WorktreeRestoreResult,
};
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
        .unwrap_or_else(|error| panic!("git {} failed: {error}", args.join(" ")))
        .trim()
        .to_string()
}

fn init_repo(name: &str) -> PathBuf {
    let root = temp_root(name);
    git_ok(&root, &["init", "-b", "main"]);
    git_ok(&root, &["config", "user.email", "test@example.com"]);
    git_ok(&root, &["config", "user.name", "test"]);
    std::fs::write(root.join("tracked.txt"), "base\n").unwrap();
    git_ok(&root, &["add", "tracked.txt"]);
    git_ok(&root, &["commit", "-m", "base"]);
    std::fs::canonicalize(root).unwrap()
}

fn add_goodboy_worktree(root: &Path, name: &str) -> PathBuf {
    let target = root.join(".goodboy").join("worktrees").join(name);
    git_ok(
        root,
        &[
            "worktree",
            "add",
            "-b",
            &format!("goodboy/{name}"),
            target.to_str().unwrap(),
        ],
    );
    std::fs::canonicalize(target).unwrap()
}

fn remove_folder(root: &Path, target: &Path) -> WorktreeRemovalResult {
    remove_worktree_folder_allowing(
        root,
        target,
        WorktreeRemovalMode::Safe,
        true,
        &mut |cwd, args| git(cwd, args),
        &mut |_| false,
    )
    .unwrap()
}

fn restore(root: &Path, target: &Path, branch: &str) -> WorktreeRestoreResult {
    restore_worktree_folder_with(root, target, branch, &mut |cwd, args| git(cwd, args)).unwrap()
}

fn refusal(result: WorktreeRestoreResult) -> WorktreeRestoreRefusal {
    let WorktreeRestoreResult::Refused { reason, .. } = result else {
        panic!("expected a refusal, found {result:?}");
    };
    reason
}

#[test]
fn undoing_a_removal_brings_the_folder_back_on_its_branch_with_its_commits() {
    let root = init_repo("restore-undo");
    let target = add_goodboy_worktree(&root, "ledger-close");
    std::fs::write(target.join("local.txt"), "work\n").unwrap();
    git_ok(&target, &["add", "local.txt"]);
    git_ok(&target, &["commit", "-m", "local work"]);
    let tip = git_ok(&root, &["rev-parse", "goodboy/ledger-close"]);
    let removed = remove_folder(&root, &target);
    assert!(
        matches!(removed, WorktreeRemovalResult::Removed { .. }),
        "{removed:?}"
    );
    assert!(!target.exists());

    let result = restore(&root, &target, "goodboy/ledger-close");

    assert!(
        matches!(result, WorktreeRestoreResult::Restored { .. }),
        "{result:?}"
    );
    assert!(target.join("local.txt").exists());
    assert_eq!(git_ok(&target, &["rev-parse", "HEAD"]), tip);
    assert_eq!(
        git_ok(&target, &["rev-parse", "--abbrev-ref", "HEAD"]),
        "goodboy/ledger-close"
    );
}

#[test]
fn undoing_twice_never_overwrites_the_folder_that_is_there() {
    let root = init_repo("restore-twice");
    let target = add_goodboy_worktree(&root, "fx-rates");
    remove_folder(&root, &target);
    restore(&root, &target, "goodboy/fx-rates");
    std::fs::write(target.join("notes.txt"), "keep me\n").unwrap();

    let again = restore(&root, &target, "goodboy/fx-rates");

    assert_eq!(refusal(again), WorktreeRestoreRefusal::PathTaken);
    assert_eq!(
        std::fs::read_to_string(target.join("notes.txt")).unwrap(),
        "keep me\n"
    );
}

#[test]
fn undo_is_refused_when_the_branch_is_gone() {
    let root = init_repo("restore-branch-gone");
    let target = add_goodboy_worktree(&root, "retire-export");
    remove_folder(&root, &target);
    git_ok(&root, &["branch", "-D", "goodboy/retire-export"]);

    let result = restore(&root, &target, "goodboy/retire-export");

    assert_eq!(refusal(result), WorktreeRestoreRefusal::BranchMissing);
    assert!(!target.exists());
}

#[test]
fn undo_is_refused_when_another_folder_holds_the_branch() {
    let root = init_repo("restore-branch-held");
    let target = add_goodboy_worktree(&root, "receipt-retry");
    remove_folder(&root, &target);
    let other = root.join(".goodboy").join("worktrees").join("other");
    git_ok(
        &root,
        &[
            "worktree",
            "add",
            other.to_str().unwrap(),
            "goodboy/receipt-retry",
        ],
    );

    let result = restore(&root, &target, "goodboy/receipt-retry");

    assert_eq!(refusal(result), WorktreeRestoreRefusal::BranchInUse);
    assert!(!target.exists());
}

#[test]
fn undo_is_refused_outside_the_goodboy_worktree_folder() {
    let root = init_repo("restore-outside");
    git_ok(&root, &["branch", "goodboy/stray"]);
    let outside = temp_root("restore-outside-target").join("stray");

    let result = restore(&root, &outside, "goodboy/stray");

    assert_eq!(
        refusal(result),
        WorktreeRestoreRefusal::OutsideWorktreeFolder
    );
    assert!(!outside.exists());
}

#[test]
fn undo_is_refused_for_a_branch_name_git_would_read_as_an_option() {
    let root = init_repo("restore-option");
    let target = root.join(".goodboy").join("worktrees").join("opt");

    let result = restore(&root, &target, "--detach");

    assert_eq!(refusal(result), WorktreeRestoreRefusal::BranchMissing);
    assert!(!target.exists());
}

#[test]
fn the_restore_result_reads_the_same_on_the_wire() {
    use crate::util::wire_shape::assert_wire_value;
    use serde_json::json;

    assert_wire_value(
        &WorktreeRestoreResult::Restored {
            path: "/r/w".to_string(),
        },
        json!({ "kind": "restored", "path": "/r/w" }),
    );
    assert_wire_value(
        &WorktreeRestoreResult::Refused {
            path: "/r/w".to_string(),
            reason: WorktreeRestoreRefusal::BranchInUse,
        },
        json!({ "kind": "refused", "path": "/r/w", "reason": "branch-in-use" }),
    );
}
