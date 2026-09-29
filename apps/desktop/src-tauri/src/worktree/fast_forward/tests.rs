use super::{checkout_fast_forward_blocking, ff_merge_args};
use crate::worktree::error::WorktreeError;
use crate::worktree::git::{git, git_argv_log};
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
fn fast_forward_advances_the_branch_to_its_upstream() {
    let root = init_repo("fast-forward-clean");
    commit(&root, "base.txt", "base", "base");
    push_to_new_remote(&root);
    let clone_root = temp_root("fast-forward-clone");
    git_ok(
        &clone_root,
        &[
            "clone",
            root.join("remote.git").to_str().unwrap(),
            clone_root.join("copy").to_str().unwrap(),
        ],
    );
    let copy = clone_root.join("copy");
    git_ok(&copy, &["checkout", "-B", "main", "--track", "origin/main"]);
    commit(&root, "next.txt", "next", "next");
    git_ok(&root, &["push", "origin", "main"]);

    git_argv_log::reset();
    let pulled = checkout_fast_forward_blocking(copy.to_string_lossy().into_owned(), None).unwrap();
    let merge_invocations: Vec<Vec<String>> = git_argv_log::recorded()
        .into_iter()
        .filter(|argv| argv.iter().any(|arg| arg == "merge"))
        .collect();

    assert_eq!(pulled.upstream, "origin/main");
    assert_eq!(pulled.commits_pulled, 1);
    assert!(copy.join("next.txt").is_file());
    assert_eq!(
        merge_invocations,
        vec![vec![
            "-c".to_string(),
            "pull.rebase=false".to_string(),
            "-c".to_string(),
            "rebase.autoStash=false".to_string(),
            "-c".to_string(),
            "merge.autoStash=false".to_string(),
            "merge".to_string(),
            "--ff-only".to_string(),
            "origin/main".to_string(),
        ]]
    );
    std::fs::remove_dir_all(root).unwrap();
    std::fs::remove_dir_all(clone_root).unwrap();
}

#[test]
fn fast_forward_refuses_a_dirty_checkout_and_leaves_it_untouched() {
    let root = init_repo("fast-forward-dirty");
    commit(&root, "base.txt", "base", "base");
    push_to_new_remote(&root);
    std::fs::write(root.join("scratch.txt"), "work in progress").unwrap();
    let before = git_ok(&root, &["rev-parse", "HEAD"]);

    let refusal =
        checkout_fast_forward_blocking(root.to_string_lossy().into_owned(), None).unwrap_err();

    assert!(format!("{refusal}").contains("uncommitted changes"));
    assert_eq!(git_ok(&root, &["rev-parse", "HEAD"]), before);
    assert_eq!(
        std::fs::read_to_string(root.join("scratch.txt")).unwrap(),
        "work in progress"
    );
    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn fast_forward_reports_the_fetch_failure_and_moves_nothing() {
    let root = init_repo("fast-forward-fetch-fails");
    let base = commit(&root, "base.txt", "base", "base");
    push_to_new_remote(&root);
    git_ok(
        &root,
        &[
            "remote",
            "set-url",
            "origin",
            root.join("missing.git").to_str().unwrap(),
        ],
    );

    let error =
        checkout_fast_forward_blocking(root.to_string_lossy().into_owned(), Some("token-for-test"))
            .unwrap_err();

    assert!(matches!(error, WorktreeError::Git { ref message } if !message.is_empty()));
    assert_eq!(git_ok(&root, &["rev-parse", "HEAD"]), base);
    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn fast_forward_refuses_a_branch_without_an_upstream() {
    let root = init_repo("fast-forward-no-upstream");
    commit(&root, "base.txt", "base", "base");

    let refusal =
        checkout_fast_forward_blocking(root.to_string_lossy().into_owned(), None).unwrap_err();

    assert!(format!("{refusal}").contains("no upstream"));
    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn fast_forward_refuses_while_a_merge_is_in_progress() {
    let root = init_repo("fast-forward-mid-merge");
    commit(&root, "shared.txt", "base\n", "base");
    push_to_new_remote(&root);
    git_ok(&root, &["checkout", "-b", "feature"]);
    commit(&root, "shared.txt", "feature\n", "feature");
    git_ok(&root, &["checkout", "main"]);
    commit(&root, "shared.txt", "main\n", "main");
    let merge = git(&root, &["merge", "feature"]);

    let refusal =
        checkout_fast_forward_blocking(root.to_string_lossy().into_owned(), None).unwrap_err();

    assert!(merge.is_err());
    assert!(format!("{refusal}").contains("merge in progress"));
    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn fast_forward_refuses_when_the_working_tree_cannot_be_read() {
    let root = init_repo("fast-forward-unreadable-status");
    commit(&root, "base.txt", "base", "base");
    push_to_new_remote(&root);
    let before = git_ok(&root, &["rev-parse", "HEAD"]);
    std::fs::write(root.join(".git").join("index"), "not an index").unwrap();

    let refusal =
        checkout_fast_forward_blocking(root.to_string_lossy().into_owned(), None).unwrap_err();

    assert!(format!("{refusal}").contains("git status could not be read"));
    assert_eq!(git_ok(&root, &["rev-parse", "HEAD"]), before);
    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn ff_merge_args_builds_the_flags_that_forbid_a_rebase_or_an_autostash() {
    assert_eq!(
        ff_merge_args("origin/main"),
        vec![
            "-c",
            "pull.rebase=false",
            "-c",
            "rebase.autoStash=false",
            "-c",
            "merge.autoStash=false",
            "merge",
            "--ff-only",
            "origin/main",
        ]
    );
}
