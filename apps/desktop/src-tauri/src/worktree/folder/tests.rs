use super::{remove_worktree_folder_allowing, remove_worktree_folder_with};
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

fn kept_reasons(result: WorktreeRemovalResult) -> Vec<WorktreeRemovalReason> {
    let WorktreeRemovalResult::Kept { reasons, .. } = result else {
        panic!("expected kept result, found {result:?}");
    };
    reasons
}

fn make_worktree_dir(parent: &Path, name: &str, bytes: usize) -> PathBuf {
    let dir = parent.join(name);
    std::fs::create_dir_all(dir.join("src")).unwrap();
    std::fs::write(dir.join("src").join("main.ts"), "x".repeat(bytes)).unwrap();
    dir
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

fn remove_folder(root: &Path, target: &Path, mode: WorktreeRemovalMode) -> WorktreeRemovalResult {
    remove_worktree_folder_with(
        root,
        target,
        mode,
        &mut |cwd, args| git(cwd, args),
        &mut |_| false,
    )
    .unwrap()
}

#[test]
fn folder_removal_removes_a_clean_goodboy_worktree_and_keeps_its_branch() {
    let root = init_repo("folder-clean");
    let target = add_goodboy_worktree(&root, "gb-clean");

    let result = remove_folder(&root, &target, WorktreeRemovalMode::Safe);

    assert!(
        matches!(result, WorktreeRemovalResult::Removed { .. }),
        "{result:?}"
    );
    assert!(!target.exists());
    assert_eq!(
        git_ok(&root, &["branch", "--list", "goodboy/gb-clean"]),
        "goodboy/gb-clean"
    );
}

fn commit_in(worktree: &Path, name: &str) {
    std::fs::write(worktree.join(name), "work\n").unwrap();
    git_ok(worktree, &["add", name]);
    git_ok(worktree, &["commit", "-m", name]);
}

#[test]
fn folder_removal_keeps_a_clean_worktree_with_unpushed_commits_until_confirmed() {
    let root = init_repo("folder-unpushed");
    let target = add_goodboy_worktree(&root, "gb-unpushed");
    commit_in(&target, "local.txt");

    let safe = remove_folder(&root, &target, WorktreeRemovalMode::Safe);
    assert_eq!(
        kept_reasons(safe),
        vec![WorktreeRemovalReason::UnpushedCommits]
    );
    assert!(target.join("local.txt").exists());

    let confirmed = remove_folder(&root, &target, WorktreeRemovalMode::Confirmed);
    assert!(
        matches!(confirmed, WorktreeRemovalResult::Removed { .. }),
        "{confirmed:?}"
    );
    assert!(!target.exists());
}

#[test]
fn folder_removal_allowing_local_commits_removes_a_clean_folder_and_keeps_its_branch() {
    let root = init_repo("folder-unpushed-allowed");
    let target = add_goodboy_worktree(&root, "gb-allowed");
    commit_in(&target, "local.txt");

    let result = remove_worktree_folder_allowing(
        &root,
        &target,
        WorktreeRemovalMode::Safe,
        true,
        &mut |cwd, args| git(cwd, args),
        &mut |_| false,
    )
    .unwrap();

    assert!(
        matches!(result, WorktreeRemovalResult::Removed { .. }),
        "{result:?}"
    );
    assert!(!target.exists());
    assert_eq!(
        git_ok(&root, &["rev-parse", "--verify", "goodboy/gb-allowed"]).len(),
        40
    );
}

#[test]
fn folder_removal_allowing_local_commits_still_keeps_uncommitted_work() {
    let root = init_repo("folder-unpushed-allowed-dirty");
    let target = add_goodboy_worktree(&root, "gb-allowed-dirty");
    commit_in(&target, "local.txt");
    std::fs::write(target.join("draft.txt"), "draft\n").unwrap();

    let result = remove_worktree_folder_allowing(
        &root,
        &target,
        WorktreeRemovalMode::Safe,
        true,
        &mut |cwd, args| git(cwd, args),
        &mut |_| false,
    )
    .unwrap();

    assert_eq!(
        kept_reasons(result),
        vec![WorktreeRemovalReason::UntrackedFiles]
    );
    assert!(target.exists());
}

#[test]
fn folder_removal_keeps_a_pushed_branch_with_newer_local_commits() {
    let root = init_repo("folder-unpushed-remote");
    publish_repo(&root);
    let target = add_goodboy_worktree(&root, "gb-ahead");
    commit_in(&target, "pushed.txt");
    git_ok(&target, &["push", "-u", "origin", "goodboy/gb-ahead"]);
    commit_in(&target, "local.txt");

    let result = remove_folder(&root, &target, WorktreeRemovalMode::Safe);

    assert_eq!(
        kept_reasons(result),
        vec![WorktreeRemovalReason::UnpushedCommits]
    );
    assert!(target.exists());
}

#[test]
fn folder_removal_removes_a_clean_worktree_whose_branch_is_pushed() {
    let root = init_repo("folder-pushed");
    publish_repo(&root);
    let target = add_goodboy_worktree(&root, "gb-pushed");
    commit_in(&target, "pushed.txt");
    git_ok(&target, &["push", "-u", "origin", "goodboy/gb-pushed"]);

    let result = remove_folder(&root, &target, WorktreeRemovalMode::Safe);

    assert!(
        matches!(result, WorktreeRemovalResult::Removed { .. }),
        "{result:?}"
    );
    assert!(!target.exists());
}

#[test]
fn folder_removal_reports_changes_and_unpushed_commits_together() {
    let root = init_repo("folder-unpushed-dirty");
    let target = add_goodboy_worktree(&root, "gb-both");
    commit_in(&target, "local.txt");
    std::fs::write(target.join("draft.md"), "unsaved\n").unwrap();

    let result = remove_folder(&root, &target, WorktreeRemovalMode::Safe);

    assert_eq!(
        kept_reasons(result),
        vec![
            WorktreeRemovalReason::UntrackedFiles,
            WorktreeRemovalReason::UnpushedCommits
        ]
    );
}

#[test]
fn folder_removal_keeps_a_dirty_worktree_in_safe_mode() {
    let root = init_repo("folder-dirty");
    let target = add_goodboy_worktree(&root, "gb-dirty");
    std::fs::write(target.join("tracked.txt"), "changed\n").unwrap();
    std::fs::write(target.join("draft.md"), "unsaved\n").unwrap();

    let result = remove_folder(&root, &target, WorktreeRemovalMode::Safe);

    assert_eq!(
        kept_reasons(result),
        vec![
            WorktreeRemovalReason::UnstagedChanges,
            WorktreeRemovalReason::UntrackedFiles
        ]
    );
    assert!(target.join("draft.md").exists());
}

#[test]
fn folder_removal_forces_a_dirty_worktree_only_when_confirmed() {
    let root = init_repo("folder-dirty-confirmed");
    let target = add_goodboy_worktree(&root, "gb-dirty");
    std::fs::write(target.join("draft.md"), "unsaved\n").unwrap();

    let result = remove_folder(&root, &target, WorktreeRemovalMode::Confirmed);

    assert!(
        matches!(result, WorktreeRemovalResult::Removed { .. }),
        "{result:?}"
    );
    assert!(!target.exists());
}

#[test]
fn folder_removal_keeps_a_worktree_an_agent_is_writing_in() {
    let root = init_repo("folder-lease");
    let target = add_goodboy_worktree(&root, "gb-busy");

    let result = remove_worktree_folder_with(
        &root,
        &target,
        WorktreeRemovalMode::Confirmed,
        &mut |cwd, args| git(cwd, args),
        &mut |_| true,
    )
    .unwrap();

    assert_eq!(
        kept_reasons(result),
        vec![WorktreeRemovalReason::WriterLeaseHeld]
    );
    assert!(target.exists());
}

#[test]
fn folder_removal_keeps_an_unregistered_folder_until_confirmed() {
    let root = init_repo("folder-unregistered");
    let parent = root.join(".goodboy").join("worktrees");
    std::fs::create_dir_all(&parent).unwrap();
    let ghost = make_worktree_dir(&parent, "gb-ghost", 64);

    let safe = remove_folder(&root, &ghost, WorktreeRemovalMode::Safe);
    assert_eq!(
        kept_reasons(safe),
        vec![WorktreeRemovalReason::NotRegistered]
    );
    assert!(ghost.exists());

    let confirmed = remove_folder(&root, &ghost, WorktreeRemovalMode::Confirmed);
    assert!(
        matches!(confirmed, WorktreeRemovalResult::Removed { .. }),
        "{confirmed:?}"
    );
    assert!(!ghost.exists());
}

#[test]
fn folder_removal_refuses_a_path_outside_the_goodboy_worktrees_folder() {
    let root = init_repo("folder-confine");
    std::fs::create_dir_all(root.join(".goodboy").join("worktrees")).unwrap();
    let claude = make_worktree_dir(&root.join(".claude").join("worktrees"), "x", 16);
    let outside = make_worktree_dir(&root, "precious", 16);
    let nested = make_worktree_dir(
        &root.join(".goodboy").join("worktrees").join("gb-a"),
        "inner",
        16,
    );

    for target in [&claude, &outside, &nested, &root] {
        let result = remove_folder(&root, target, WorktreeRemovalMode::Confirmed);
        assert_eq!(
            kept_reasons(result),
            vec![WorktreeRemovalReason::OutsideWorktreeFolder],
            "{target:?}"
        );
        assert!(
            target.exists(),
            "a path outside the folder was deleted: {target:?}"
        );
    }
}

#[cfg(unix)]
#[test]
fn folder_removal_refuses_a_symlink_that_escapes_the_worktrees_folder() {
    let root = init_repo("folder-symlink");
    let parent = root.join(".goodboy").join("worktrees");
    std::fs::create_dir_all(&parent).unwrap();
    let precious = make_worktree_dir(&temp_root("folder-symlink-target"), "precious", 16);
    let link = parent.join("gb-link");
    std::os::unix::fs::symlink(&precious, &link).unwrap();
    let hop = parent.join("gb-hop");
    std::os::unix::fs::symlink(precious.parent().unwrap(), &hop).unwrap();

    for target in [link.clone(), hop.join("precious")] {
        let result = remove_folder(&root, &target, WorktreeRemovalMode::Confirmed);
        assert_eq!(
            kept_reasons(result),
            vec![WorktreeRemovalReason::OutsideWorktreeFolder],
            "{target:?}"
        );
    }
    assert!(precious.join("src").join("main.ts").exists());
}

#[cfg(unix)]
#[test]
fn folder_removal_refuses_when_the_worktrees_folder_itself_escapes_the_repository() {
    let root = init_repo("folder-parent-symlink");
    let elsewhere = temp_root("folder-parent-elsewhere");
    let victim = make_worktree_dir(&elsewhere, "gb-victim", 16);
    std::fs::create_dir_all(root.join(".goodboy")).unwrap();
    std::os::unix::fs::symlink(&elsewhere, root.join(".goodboy").join("worktrees")).unwrap();

    let result = remove_folder(
        &root,
        &root.join(".goodboy").join("worktrees").join("gb-victim"),
        WorktreeRemovalMode::Confirmed,
    );

    assert_eq!(
        kept_reasons(result),
        vec![WorktreeRemovalReason::OutsideWorktreeFolder]
    );
    assert!(victim.exists());
}

#[test]
fn folder_removal_refuses_a_clone_of_another_repository() {
    let root = init_repo("folder-foreign");
    let parent = root.join(".goodboy").join("worktrees");
    std::fs::create_dir_all(&parent).unwrap();
    let other = init_repo("folder-foreign-other");
    let clone = parent.join("gb-clone");
    git_ok(
        &root,
        &["clone", other.to_str().unwrap(), clone.to_str().unwrap()],
    );

    let result = remove_folder(&root, &clone, WorktreeRemovalMode::Confirmed);

    assert_eq!(
        kept_reasons(result),
        vec![WorktreeRemovalReason::DifferentRepository]
    );
    assert!(clone.join("tracked.txt").exists());
}

#[test]
fn folder_removal_reports_an_absent_folder_as_missing() {
    let root = init_repo("folder-missing");
    std::fs::create_dir_all(root.join(".goodboy").join("worktrees")).unwrap();

    let result = remove_folder(
        &root,
        &root.join(".goodboy").join("worktrees").join("gb-gone"),
        WorktreeRemovalMode::Safe,
    );

    assert!(
        matches!(result, WorktreeRemovalResult::Missing { .. }),
        "{result:?}"
    );
}

fn publish_repo(root: &Path) {
    let bare = root.join("origin.git");
    git_ok(root, &["init", "--bare", bare.to_str().unwrap()]);
    git_ok(root, &["remote", "add", "origin", bare.to_str().unwrap()]);
    git_ok(root, &["push", "-u", "origin", "main"]);
    git_ok(root, &["remote", "set-head", "origin", "main"]);
}
