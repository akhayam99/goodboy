use super::{branch_checkout_path_with, with_fetch_cause, worktree_create_blocking};
use crate::worktree::error::WorktreeError;
use crate::worktree::git::git;
use crate::worktree::status::resolve_upstream;
use crate::worktree::types::{CreateArgs, CreatedWorktree};
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

fn push_to_new_remote(root: &Path) {
    let remote = root.join("remote.git");
    git_ok(root, &["init", "--bare", remote.to_str().unwrap()]);
    git_ok(root, &["remote", "add", "origin", remote.to_str().unwrap()]);
    git_ok(root, &["push", "-u", "origin", "main"]);
}

#[test]
fn a_branch_checked_out_elsewhere_is_read_from_the_worktree_listing() {
    let listing = "worktree /repo\nHEAD aaaa\nbranch refs/heads/main\n\nworktree /repo/.goodboy/worktrees/one\nHEAD bbbb\nbranch refs/heads/feature/one\n\nworktree /repo/.goodboy/worktrees/two\nHEAD cccc\ndetached\n";

    let holder = branch_checkout_path_with(Path::new("/repo"), "feature/one", &mut |_, _| {
        Ok(listing.to_string())
    });
    let free = branch_checkout_path_with(Path::new("/repo"), "feature/two", &mut |_, _| {
        Ok(listing.to_string())
    });

    assert_eq!(holder.as_deref(), Some("/repo/.goodboy/worktrees/one"));
    assert_eq!(free, None);
}

#[test]
fn adopting_a_branch_another_worktree_holds_names_that_worktree() {
    let root = std::fs::canonicalize(init_repo("adopt-in-use")).unwrap();
    commit(&root, "a.txt", "a\n", "first");
    let parent_dir = root.join(".goodboy").join("worktrees");
    let holder = parent_dir.join("holder");
    std::fs::create_dir_all(&parent_dir).unwrap();
    git_ok(
        &root,
        &[
            "worktree",
            "add",
            "-b",
            "feature/shared",
            holder.to_str().unwrap(),
        ],
    );

    let error = worktree_create_blocking(CreateArgs {
        repo_path: root.to_string_lossy().into_owned(),
        branch_name: "feature/shared".to_string(),
        parent_dir: Some(parent_dir.to_string_lossy().into_owned()),
        existing_branch: Some("feature/shared".to_string()),
        fallback_ref: None,
        base_branch: None,
        dir_name: Some("second".to_string()),
    })
    .unwrap_err();

    let wire = serde_json::to_value(&error).unwrap();
    let WorktreeError::BranchInUse { branch, path } = error else {
        panic!("expected a branch-in-use error, found {error:?}");
    };
    assert_eq!(branch, "feature/shared");
    assert_eq!(
        std::fs::canonicalize(&path).unwrap(),
        std::fs::canonicalize(&holder).unwrap()
    );
    assert_eq!(wire["kind"], "branch_in_use");
    assert!(wire["message"]
        .as_str()
        .unwrap()
        .contains(holder.to_string_lossy().as_ref()));
    assert!(!parent_dir.join("second").exists());
    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn adopting_a_branch_that_exists_nowhere_names_the_branch() {
    let root = std::fs::canonicalize(init_repo("adopt-missing")).unwrap();
    commit(&root, "a.txt", "a\n", "first");
    let parent_dir = root.join(".goodboy").join("worktrees");
    std::fs::create_dir_all(&parent_dir).unwrap();

    let error = worktree_create_blocking(CreateArgs {
        repo_path: root.to_string_lossy().into_owned(),
        branch_name: "ak/second-half".to_string(),
        parent_dir: Some(parent_dir.to_string_lossy().into_owned()),
        existing_branch: Some("ak/second-half".to_string()),
        fallback_ref: None,
        base_branch: None,
        dir_name: Some("second".to_string()),
    })
    .unwrap_err();

    let wire = serde_json::to_value(&error).unwrap();
    let WorktreeError::BranchNotFound { branch } = error else {
        panic!("expected a branch-not-found error, found {error:?}");
    };
    assert_eq!(branch, "ak/second-half");
    assert_eq!(wire["kind"], "branch_not_found");
    assert!(wire["message"].as_str().unwrap().contains("ak/second-half"));
    assert!(!parent_dir.join("second").exists());
    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn keeps_adoption_failing_when_origin_cannot_be_reached() {
    let root = std::fs::canonicalize(init_repo("adopt-unreachable")).unwrap();
    commit(&root, "a.txt", "a\n", "first");
    git_ok(
        &root,
        &[
            "remote",
            "add",
            "origin",
            "https://127.0.0.1:1/nothing/here.git",
        ],
    );
    let parent_dir = root.join(".goodboy").join("worktrees");
    std::fs::create_dir_all(&parent_dir).unwrap();

    let error = worktree_create_blocking(CreateArgs {
        repo_path: root.to_string_lossy().into_owned(),
        branch_name: "ak/second-half".to_string(),
        parent_dir: Some(parent_dir.to_string_lossy().into_owned()),
        existing_branch: Some("ak/second-half".to_string()),
        fallback_ref: None,
        base_branch: None,
        dir_name: Some("second".to_string()),
    })
    .unwrap_err();

    let wire = serde_json::to_value(&error).unwrap();
    assert_eq!(wire["kind"], "git");
    assert!(!parent_dir.join("second").exists());
    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn names_the_failed_fetch_when_the_base_ref_cannot_be_found() {
    let root = init_repo("create-fetch-cause");
    commit(&root, "base.txt", "base", "base");

    let error = worktree_create_blocking(CreateArgs {
        repo_path: root.to_string_lossy().into_owned(),
        branch_name: "ak/first".to_string(),
        existing_branch: None,
        fallback_ref: None,
        base_branch: Some("release-42".to_string()),
        parent_dir: None,
        dir_name: None,
    })
    .unwrap_err();

    let WorktreeError::Git { message } = error else {
        panic!("expected a git error, found {error:?}");
    };
    assert!(
        message.contains("cannot find base ref"),
        "missing the base ref cause: {message}"
    );
    assert!(
        message.contains("fetching from origin failed first"),
        "the fetch cause was dropped: {message}"
    );
    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn keeps_the_error_untouched_when_the_fetch_succeeded() {
    let plain = WorktreeError::Git {
        message: "cannot find base ref: tried origin/main".to_string(),
    };

    let WorktreeError::Git { message } = with_fetch_cause(plain, None) else {
        panic!("expected a git error");
    };
    assert_eq!(message, "cannot find base ref: tried origin/main");
}

#[test]
fn refuses_to_create_a_worktree_before_the_repository_exists() {
    let root = temp_root("create-without-git");

    let plain = worktree_create_blocking(CreateArgs {
        repo_path: root.to_string_lossy().into_owned(),
        branch_name: "ak/first".to_string(),
        existing_branch: None,
        fallback_ref: None,
        base_branch: None,
        parent_dir: None,
        dir_name: None,
    })
    .unwrap_err();

    assert!(matches!(plain, WorktreeError::NoRepository(_)));
    assert!(!root.join(".gitignore").exists());
    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn refuses_to_create_a_worktree_before_the_first_commit() {
    let root = init_repo("create-without-commit");

    let unborn = worktree_create_blocking(CreateArgs {
        repo_path: root.to_string_lossy().into_owned(),
        branch_name: "ak/first".to_string(),
        existing_branch: None,
        fallback_ref: None,
        base_branch: None,
        parent_dir: None,
        dir_name: None,
    })
    .unwrap_err();

    assert!(matches!(unborn, WorktreeError::NoCommit(_)));
    assert!(!root.join(".gitignore").exists());
    std::fs::remove_dir_all(root).unwrap();
}

fn create_session_mount(root: &Path, slug: &str) -> CreatedWorktree {
    let parent = root.join(".goodboy").join("worktrees");
    worktree_create_blocking(CreateArgs {
        repo_path: root.to_string_lossy().into_owned(),
        branch_name: format!("goodboy/{slug}"),
        parent_dir: Some(parent.to_string_lossy().into_owned()),
        existing_branch: None,
        fallback_ref: None,
        base_branch: None,
        dir_name: Some(slug.to_string()),
    })
    .unwrap()
}

#[test]
fn a_new_session_branch_does_not_track_the_base_it_was_cut_from() {
    let root = std::fs::canonicalize(init_repo("session-no-track")).unwrap();
    commit(&root, "base.txt", "base\n", "base");
    push_to_new_remote(&root);
    let created = create_session_mount(&root, "no-track");
    let path = PathBuf::from(&created.worktree_path);

    assert!(resolve_upstream(&path).is_none());
    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn selected_split_keeps_the_parent_worktree_while_resolving_a_cherry_pick() {
    let root = std::fs::canonicalize(init_repo("selected-split")).unwrap();
    commit(&root, "auth.txt", "base\n", "base");
    push_to_new_remote(&root);
    let parent_dir = root.join(".goodboy").join("worktrees");
    let parent = worktree_create_blocking(CreateArgs {
        repo_path: root.to_string_lossy().into_owned(),
        branch_name: "feature/eng-3240-draft".to_string(),
        parent_dir: Some(parent_dir.to_string_lossy().into_owned()),
        existing_branch: None,
        fallback_ref: None,
        base_branch: Some("main".to_string()),
        dir_name: Some("mount-parent".to_string()),
    })
    .unwrap();
    let parent_path = PathBuf::from(&parent.worktree_path);
    let selected = commit(
        &parent_path,
        "auth.txt",
        "parent auth\n",
        "extract authentication",
    );
    commit(
        &parent_path,
        "parent-only.txt",
        "later work\n",
        "continue parent draft",
    );
    let parent_head = git_ok(&parent_path, &["rev-parse", "HEAD"]);
    let split = worktree_create_blocking(CreateArgs {
        repo_path: root.to_string_lossy().into_owned(),
        branch_name: "feature/eng-3240-auth".to_string(),
        parent_dir: Some(parent_dir.to_string_lossy().into_owned()),
        existing_branch: None,
        fallback_ref: None,
        base_branch: Some("main".to_string()),
        dir_name: Some("mount-split".to_string()),
    })
    .unwrap();
    let split_path = PathBuf::from(&split.worktree_path);
    commit(
        &split_path,
        "auth.txt",
        "split preparation\n",
        "prepare selected split",
    );

    assert!(git(&split_path, &["cherry-pick", &selected]).is_err());
    std::fs::write(
        split_path.join("auth.txt"),
        "split preparation\nparent auth\n",
    )
    .unwrap();
    git_ok(&split_path, &["add", "auth.txt"]);
    git_ok(&split_path, &["cherry-pick", "--continue"]);

    assert_eq!(git_ok(&parent_path, &["rev-parse", "HEAD"]), parent_head);
    assert_eq!(
        (
            parent_path.join("parent-only.txt").exists(),
            split_path.join("parent-only.txt").exists()
        ),
        (true, false)
    );
    assert_eq!(
        (
            git_ok(&parent_path, &["branch", "--show-current"]),
            git_ok(&split_path, &["branch", "--show-current"])
        ),
        (parent.branch_name, split.branch_name)
    );
}

#[test]
fn a_session_mount_lands_under_goodboy_worktrees_and_stays_out_of_status() {
    let root = std::fs::canonicalize(init_repo("exclude-on-create")).unwrap();
    commit(&root, "base.txt", "base", "base");
    push_to_new_remote(&root);

    let created = create_session_mount(&root, "goal-abc12345");

    assert_eq!(
        created.worktree_path,
        root.join(".goodboy")
            .join("worktrees")
            .join("goal-abc12345")
            .to_string_lossy()
    );
    let exclude = std::fs::read_to_string(root.join(".git").join("info").join("exclude")).unwrap();
    assert_eq!(
        exclude.lines().filter(|line| *line == ".goodboy/").count(),
        1
    );
    let status = git_ok(&root, &["status", "--porcelain"]);
    assert!(!status.contains(".goodboy"), "{status}");
    assert!(!root.join(".gitignore").exists());
    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn a_prefix_with_a_slash_cuts_the_full_name_into_one_flat_folder() {
    let root = std::fs::canonicalize(init_repo("nested-prefix")).unwrap();
    commit(&root, "base.txt", "base\n", "base");
    push_to_new_remote(&root);
    let parent = root.join(".goodboy").join("worktrees");

    let created = worktree_create_blocking(CreateArgs {
        repo_path: root.to_string_lossy().into_owned(),
        branch_name: "team/ak/har-212-payments-retry".to_string(),
        parent_dir: Some(parent.to_string_lossy().into_owned()),
        existing_branch: None,
        fallback_ref: None,
        base_branch: None,
        dir_name: None,
    })
    .unwrap();

    assert_eq!(created.branch_name, "team/ak/har-212-payments-retry");
    assert_eq!(
        PathBuf::from(&created.worktree_path),
        parent.join("team-ak-har-212-payments-retry")
    );
    assert_eq!(
        std::fs::read_dir(&parent).unwrap().count(),
        1,
        "the prefix must not open a folder per segment"
    );
    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn a_branch_name_the_validator_refuses_fails_before_anything_is_created() {
    let root = std::fs::canonicalize(init_repo("invalid-branch")).unwrap();
    commit(&root, "base.txt", "base\n", "base");
    push_to_new_remote(&root);
    let parent = root.join(".goodboy").join("worktrees");

    let error = worktree_create_blocking(CreateArgs {
        repo_path: root.to_string_lossy().into_owned(),
        branch_name: "hl/payments..retry".to_string(),
        parent_dir: Some(parent.to_string_lossy().into_owned()),
        existing_branch: None,
        fallback_ref: None,
        base_branch: None,
        dir_name: Some("payments".to_string()),
    })
    .unwrap_err();

    let WorktreeError::InvalidBranchName { branch, reason } = error else {
        panic!("expected an invalid branch name error, found {error:?}");
    };
    assert_eq!(branch, "hl/payments..retry");
    assert_eq!(reason, "double-dot");
    assert!(!parent.join("payments").exists());
    std::fs::remove_dir_all(root).unwrap();
}
