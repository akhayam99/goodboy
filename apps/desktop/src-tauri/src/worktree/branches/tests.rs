use super::{
    normalize_branch_names, repo_default_base_branch_blocking, worktree_branch_holder_blocking,
    worktree_change_branch_blocking,
};
use crate::worktree::error::WorktreeError;
use crate::worktree::git::git;
use crate::worktree::types::ChangeBranchArgs;
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
fn branch_names_strip_origin_and_preserve_the_first_occurrence() {
    let raw = "main\nfeature/search\norigin\norigin/HEAD\norigin/main\norigin/release\nupstream/HEAD\nupstream/release\n";

    assert_eq!(
        normalize_branch_names(raw),
        vec!["main", "feature/search", "release", "upstream/release"]
    );
}

#[test]
fn refuses_to_switch_onto_a_branch_another_worktree_holds() {
    let root = std::fs::canonicalize(init_repo("switch-in-use")).unwrap();
    commit(&root, "a.txt", "a\n", "first");
    let parent_dir = root.join(".goodboy").join("worktrees");
    let holder = parent_dir.join("holder");
    let mover = parent_dir.join("mover");
    std::fs::create_dir_all(&parent_dir).unwrap();
    git_ok(
        &root,
        &["worktree", "add", "-b", "ak/held", holder.to_str().unwrap()],
    );
    git_ok(
        &root,
        &["worktree", "add", "-b", "ak/mine", mover.to_str().unwrap()],
    );

    let error = worktree_change_branch_blocking(ChangeBranchArgs {
        repo_path: root.to_string_lossy().into_owned(),
        worktree_path: mover.to_string_lossy().into_owned(),
        branch: "ak/held".to_string(),
        create_new: false,
    })
    .unwrap_err();

    let wire = serde_json::to_value(&error).unwrap();
    assert_eq!(wire["kind"], "branch_in_use");
    let WorktreeError::BranchInUse { branch, .. } = error else {
        panic!("expected a branch-in-use error, found {error:?}");
    };
    assert_eq!(branch, "ak/held");
    assert_eq!(
        git_ok(&mover, &["rev-parse", "--abbrev-ref", "HEAD"]),
        "ak/mine"
    );
    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn switches_onto_a_branch_no_other_worktree_holds() {
    let root = std::fs::canonicalize(init_repo("switch-free")).unwrap();
    commit(&root, "a.txt", "a\n", "first");
    let parent_dir = root.join(".goodboy").join("worktrees");
    let mover = parent_dir.join("mover");
    std::fs::create_dir_all(&parent_dir).unwrap();
    git_ok(
        &root,
        &["worktree", "add", "-b", "ak/mine", mover.to_str().unwrap()],
    );
    git_ok(&root, &["branch", "ak/free"]);

    worktree_change_branch_blocking(ChangeBranchArgs {
        repo_path: root.to_string_lossy().into_owned(),
        worktree_path: mover.to_string_lossy().into_owned(),
        branch: "ak/free".to_string(),
        create_new: false,
    })
    .unwrap();

    assert_eq!(
        git_ok(&mover, &["rev-parse", "--abbrev-ref", "HEAD"]),
        "ak/free"
    );
    worktree_change_branch_blocking(ChangeBranchArgs {
        repo_path: root.to_string_lossy().into_owned(),
        worktree_path: mover.to_string_lossy().into_owned(),
        branch: "ak/free".to_string(),
        create_new: false,
    })
    .unwrap();
    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn names_the_worktree_that_holds_a_branch() {
    let root = std::fs::canonicalize(init_repo("branch-holder")).unwrap();
    commit(&root, "a.txt", "a\n", "first");
    let parent_dir = root.join(".goodboy").join("worktrees");
    let holder = parent_dir.join("holder");
    std::fs::create_dir_all(&parent_dir).unwrap();
    git_ok(
        &root,
        &["worktree", "add", "-b", "ak/held", holder.to_str().unwrap()],
    );
    git_ok(&root, &["branch", "ak/free"]);

    let found =
        worktree_branch_holder_blocking(root.to_string_lossy().into_owned(), "ak/held".to_string())
            .unwrap()
            .expect("the held branch has a holder");

    assert_eq!(
        std::fs::canonicalize(found).unwrap(),
        std::fs::canonicalize(&holder).unwrap()
    );
    assert_eq!(
        worktree_branch_holder_blocking(root.to_string_lossy().into_owned(), "ak/free".to_string())
            .unwrap(),
        None
    );
    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn repo_default_base_branch_reads_origin_head() {
    let root = init_repo("default-base-branch");
    commit(&root, "a.txt", "hello", "init");
    push_to_new_remote(&root);
    git_ok(
        &root,
        &[
            "symbolic-ref",
            "refs/remotes/origin/HEAD",
            "refs/remotes/origin/main",
        ],
    );

    let resolved = repo_default_base_branch_blocking(root.to_str().unwrap().to_string());

    assert_eq!(resolved.unwrap(), Some("main".to_string()));
    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn repo_default_base_branch_is_none_without_an_origin_head() {
    let root = init_repo("default-base-branch-none");
    commit(&root, "a.txt", "hello", "init");

    let resolved = repo_default_base_branch_blocking(root.to_str().unwrap().to_string());

    assert_eq!(resolved.unwrap(), None);
    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn repo_default_base_branch_refuses_a_missing_repo() {
    let missing = std::env::temp_dir().join("goodboy-missing-repo-for-default-base");

    let resolved = repo_default_base_branch_blocking(missing.to_str().unwrap().to_string());

    assert!(resolved.is_err());
}
