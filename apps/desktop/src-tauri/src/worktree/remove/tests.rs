use super::{remove_worktree_checked_leased, remove_worktree_checked_with};
use crate::worktree::error::WorktreeError;
use crate::worktree::git::git;
use crate::worktree::types::{WorktreeRemovalMode, WorktreeRemovalReason, WorktreeRemovalResult};
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

fn not_empty() -> WorktreeError {
    WorktreeError::Git {
        message:
            "git worktree remove --force /x failed: fatal: could not remove: Directory not empty"
                .to_string(),
    }
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
    std::fs::write(root.join(".gitignore"), "node_modules/\n").unwrap();
    std::fs::write(root.join("tracked.txt"), "base\n").unwrap();
    git_ok(&root, &["add", ".gitignore", "tracked.txt"]);
    git_ok(&root, &["commit", "-m", "base"]);
    std::fs::canonicalize(root).unwrap()
}

fn add_worktree(root: &Path, name: &str) -> PathBuf {
    let target = root.join("worktrees").join(name);
    git_ok(
        root,
        &[
            "worktree",
            "add",
            "-b",
            &format!("test/{name}"),
            target.to_str().unwrap(),
        ],
    );
    std::fs::canonicalize(target).unwrap()
}

fn remove(root: &Path, target: &Path) -> WorktreeRemovalResult {
    remove_with_mode(root, target, WorktreeRemovalMode::Safe)
}

fn remove_with_mode(
    root: &Path,
    target: &Path,
    mode: WorktreeRemovalMode,
) -> WorktreeRemovalResult {
    remove_worktree_checked_with(
        root,
        target,
        mode,
        &mut |cwd, args| git(cwd, args),
        &mut |_| false,
    )
    .unwrap()
}

fn kept_reasons(result: WorktreeRemovalResult) -> Vec<WorktreeRemovalReason> {
    let WorktreeRemovalResult::Kept { reasons, .. } = result else {
        panic!("expected kept result, found {result:?}");
    };
    reasons
}

#[test]
fn clean_registered_worktree_with_ignored_dependencies_is_removed() {
    let root = init_repo("remove-clean");
    let target = add_worktree(&root, "clean");
    std::fs::create_dir_all(target.join("node_modules").join("dep")).unwrap();
    std::fs::write(
        target.join("node_modules").join("dep").join("index.js"),
        "x",
    )
    .unwrap();

    let result = remove(&root, &target);

    assert!(matches!(result, WorktreeRemovalResult::Removed { .. }));
    assert!(!target.exists());
}

#[test]
fn dirty_worktree_is_kept_with_each_change_reason() {
    let root = init_repo("remove-dirty");
    let target = add_worktree(&root, "dirty");
    std::fs::write(target.join("tracked.txt"), "changed\n").unwrap();
    std::fs::write(target.join("staged.txt"), "staged\n").unwrap();
    git_ok(&target, &["add", "staged.txt"]);
    std::fs::write(target.join("untracked.txt"), "untracked\n").unwrap();

    let reasons = kept_reasons(remove(&root, &target));

    assert!(reasons.contains(&WorktreeRemovalReason::StagedChanges));
    assert!(reasons.contains(&WorktreeRemovalReason::UnstagedChanges));
    assert!(reasons.contains(&WorktreeRemovalReason::UntrackedFiles));
    assert!(target.exists());
}

#[test]
fn conflicted_worktree_and_in_progress_merge_are_kept() {
    let root = init_repo("remove-conflict");
    let target = add_worktree(&root, "conflict");
    std::fs::write(root.join("tracked.txt"), "main\n").unwrap();
    git_ok(&root, &["commit", "-am", "main change"]);
    std::fs::write(target.join("tracked.txt"), "branch\n").unwrap();
    git_ok(&target, &["commit", "-am", "branch change"]);
    assert!(git(&target, &["merge", "main"]).is_err());

    let reasons = kept_reasons(remove(&root, &target));

    assert!(reasons.contains(&WorktreeRemovalReason::UnmergedConflicts));
    assert!(reasons.contains(&WorktreeRemovalReason::OperationInProgress));
    assert!(target.exists());
}

#[test]
fn status_failure_is_treated_as_unsafe() {
    let root = init_repo("remove-status-failure");
    let target = add_worktree(&root, "status-failure");
    let git_dir = PathBuf::from(git_ok(&target, &["rev-parse", "--absolute-git-dir"]));
    std::fs::write(git_dir.join("index"), "invalid index").unwrap();

    let reasons = kept_reasons(remove(&root, &target));

    assert_eq!(reasons, vec![WorktreeRemovalReason::StatusUnavailable]);
    assert!(target.exists());
}

#[test]
fn locked_worktree_is_kept() {
    let root = init_repo("remove-locked");
    let target = add_worktree(&root, "locked");
    git_ok(
        &root,
        &[
            "worktree",
            "lock",
            "--reason",
            "busy",
            target.to_str().unwrap(),
        ],
    );

    let reasons = kept_reasons(remove(&root, &target));

    assert_eq!(reasons, vec![WorktreeRemovalReason::Locked]);
    assert!(target.exists());
}

#[test]
fn wrong_repository_and_main_checkout_are_kept() {
    let root = init_repo("remove-owner");
    let other = init_repo("remove-other-owner");
    let target = add_worktree(&root, "owned");

    let wrong_repo = kept_reasons(remove(&other, &target));
    let main_checkout = kept_reasons(remove(&root, &root));

    assert_eq!(wrong_repo, vec![WorktreeRemovalReason::DifferentRepository]);
    assert_eq!(main_checkout, vec![WorktreeRemovalReason::MainCheckout]);
    assert!(target.exists());
}

#[test]
fn missing_path_is_reported_without_removal() {
    let root = init_repo("remove-missing");
    let target = root.join("missing");

    let result = remove(&root, &target);

    assert_eq!(
        result,
        WorktreeRemovalResult::Missing {
            path: target.to_string_lossy().into_owned()
        }
    );
}

#[test]
fn unexpected_directory_is_kept() {
    let root = init_repo("remove-unexpected");
    let target = root.join("unexpected");
    std::fs::create_dir_all(&target).unwrap();

    let reasons = kept_reasons(remove(&root, &target));

    assert_eq!(reasons, vec![WorktreeRemovalReason::UnexpectedDirectory]);
    assert!(target.exists());
}

#[test]
fn a_lease_taken_through_a_symlinked_path_keeps_the_worktree() {
    let root = init_repo("remove-leased-symlink");
    let target = add_worktree(&root, "leased");
    let mirror = temp_root("remove-leased-mirror").join("mirror");
    std::os::unix::fs::symlink(&root, &mirror).unwrap();
    let path_the_agent_sees = mirror.join("worktrees").join("leased");
    let registry = crate::worktree_writer::WriterLeases::new().0;
    let granted = crate::worktree_writer::acquire_lease(
        &registry,
        path_the_agent_sees.to_string_lossy().as_ref(),
        "agent-1",
        None,
    );

    let result =
        remove_worktree_checked_leased(&registry, &root, &target, WorktreeRemovalMode::Safe)
            .unwrap();

    assert!(granted.is_granted);
    assert_ne!(path_the_agent_sees, target);
    assert_eq!(
        kept_reasons(result),
        vec![WorktreeRemovalReason::WriterLeaseHeld]
    );
    assert!(target.join("tracked.txt").exists());
    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn a_released_lease_no_longer_keeps_the_worktree() {
    let root = init_repo("remove-lease-released");
    let target = add_worktree(&root, "released");
    let registry = crate::worktree_writer::WriterLeases::new().0;
    let granted = crate::worktree_writer::acquire_lease(
        &registry,
        target.to_string_lossy().as_ref(),
        "agent-1",
        None,
    );
    crate::worktree_writer::release_lease(
        &registry,
        target.to_string_lossy().as_ref(),
        "agent-1",
        granted.token.as_deref(),
    );

    let result =
        remove_worktree_checked_leased(&registry, &root, &target, WorktreeRemovalMode::Safe)
            .unwrap();

    assert!(matches!(result, WorktreeRemovalResult::Removed { .. }));
    assert!(!target.exists());
    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn fallback_removes_only_the_revalidated_registered_target() {
    let root = init_repo("remove-fallback");
    let target = add_worktree(&root, "fallback");
    let neighbor = root.join("worktrees").join("keep-me");
    std::fs::create_dir_all(target.join("node_modules").join("dep")).unwrap();
    std::fs::write(
        target.join("node_modules").join("dep").join("index.js"),
        "x",
    )
    .unwrap();
    std::fs::create_dir_all(&neighbor).unwrap();
    let mut remove_attempts = 0;

    let result = remove_worktree_checked_with(
        &root,
        &target,
        WorktreeRemovalMode::Safe,
        &mut |cwd, args| {
            if args.starts_with(&["worktree", "remove"]) {
                remove_attempts += 1;
                return Err(not_empty());
            }
            git(cwd, args)
        },
        &mut |_| false,
    )
    .unwrap();

    assert!(matches!(result, WorktreeRemovalResult::Removed { .. }));
    assert_eq!(remove_attempts, 2);
    assert!(!target.exists());
    assert!(neighbor.exists());
}

#[test]
fn fallback_keeps_a_target_that_changes_before_revalidation() {
    let root = init_repo("remove-fallback-swap");
    let target = add_worktree(&root, "fallback-swap");
    let displaced = root.join("displaced");
    let mut remove_attempts = 0;

    let result = remove_worktree_checked_with(
        &root,
        &target,
        WorktreeRemovalMode::Safe,
        &mut |cwd, args| {
            if args.starts_with(&["worktree", "remove"]) {
                remove_attempts += 1;
                if remove_attempts == 2 {
                    std::fs::rename(&target, &displaced).unwrap();
                    std::fs::create_dir_all(&target).unwrap();
                    std::fs::write(target.join("precious.txt"), "keep").unwrap();
                }
                return Err(not_empty());
            }
            git(cwd, args)
        },
        &mut |_| false,
    )
    .unwrap();

    assert_eq!(
        kept_reasons(result),
        vec![WorktreeRemovalReason::UnexpectedDirectory]
    );
    assert!(target.join("precious.txt").exists());
}

#[test]
fn safe_removal_never_passes_force_to_git() {
    let root = init_repo("remove-no-force");
    let target = add_worktree(&root, "no-force");
    let mut seen: Vec<String> = Vec::new();

    let result = remove_worktree_checked_with(
        &root,
        &target,
        WorktreeRemovalMode::Safe,
        &mut |cwd, args| {
            if args.starts_with(&["worktree", "remove"]) {
                seen = args.iter().map(|arg| arg.to_string()).collect();
            }
            git(cwd, args)
        },
        &mut |_| false,
    )
    .unwrap();

    assert!(matches!(result, WorktreeRemovalResult::Removed { .. }));
    assert!(!seen.iter().any(|arg| arg == "--force"), "{seen:?}");
    assert!(!target.exists());
}

#[test]
fn confirmed_removal_forces_a_dirty_worktree_that_safe_mode_keeps() {
    let root = init_repo("remove-confirmed");
    let target = add_worktree(&root, "confirmed");
    std::fs::write(target.join("tracked.txt"), "edited\n").unwrap();
    std::fs::write(target.join("scratch.txt"), "new\n").unwrap();

    let kept = remove(&root, &target);
    let mut seen: Vec<String> = Vec::new();
    let confirmed = remove_worktree_checked_with(
        &root,
        &target,
        WorktreeRemovalMode::Confirmed,
        &mut |cwd, args| {
            if args.starts_with(&["worktree", "remove"]) {
                seen = args.iter().map(|arg| arg.to_string()).collect();
            }
            git(cwd, args)
        },
        &mut |_| false,
    )
    .unwrap();

    assert_eq!(
        kept_reasons(kept),
        vec![
            WorktreeRemovalReason::UnstagedChanges,
            WorktreeRemovalReason::UntrackedFiles
        ]
    );
    assert!(matches!(confirmed, WorktreeRemovalResult::Removed { .. }));
    assert!(seen.iter().any(|arg| arg == "--force"), "{seen:?}");
    assert!(!target.exists());
    assert_eq!(
        git_ok(&root, &["rev-parse", "--verify", "test/confirmed"]).len(),
        40
    );
}
