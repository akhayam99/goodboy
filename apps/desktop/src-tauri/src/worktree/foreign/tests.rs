use super::{
    list_remote_branches_blocking, remote_branch_state_blocking, use_remote_commits_blocking,
};
use crate::worktree::branches::worktree_change_branch_blocking as change_branch;
use crate::worktree::create::worktree_create_blocking;
use crate::worktree::error::WorktreeError;
use crate::worktree::git::git;
use crate::worktree::types::{ChangeBranchArgs, CreateArgs};
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

fn push_to_new_remote(root: &Path) -> PathBuf {
    let remote = root.join("remote.git");
    git_ok(root, &["init", "--bare", remote.to_str().unwrap()]);
    git_ok(root, &["remote", "add", "origin", remote.to_str().unwrap()]);
    git_ok(root, &["push", "-u", "origin", "main"]);
    remote
}

fn teammate_pushes_a_branch(root: &Path, branch: &str) -> String {
    let clone = temp_root("teammate");
    git_ok(
        &clone,
        &["clone", root.join("remote.git").to_str().unwrap(), "."],
    );
    git_ok(&clone, &["config", "user.email", "pat@harborline.test"]);
    git_ok(&clone, &["config", "user.name", "Pat Harborline"]);
    git_ok(&clone, &["config", "commit.gpgsign", "false"]);
    git_ok(&clone, &["switch", "-c", branch]);
    commit(&clone, "cta.txt", "one\n", "add the cta");
    let tip = commit(&clone, "cta.txt", "two\n", "wire the cta");
    git_ok(&clone, &["push", "origin", branch]);
    std::fs::remove_dir_all(clone).unwrap();
    tip
}

fn create_args(root: &Path, branch: &str, dir: &str) -> CreateArgs {
    CreateArgs {
        repo_path: root.to_string_lossy().into_owned(),
        branch_name: branch.to_string(),
        parent_dir: Some(
            root.join(".goodboy")
                .join("worktrees")
                .to_string_lossy()
                .into_owned(),
        ),
        existing_branch: None,
        fallback_ref: None,
        base_branch: Some("main".to_string()),
        dir_name: Some(dir.to_string()),
    }
}

fn switch_args(root: &Path, worktree: &Path, branch: &str, create_new: bool) -> ChangeBranchArgs {
    ChangeBranchArgs {
        repo_path: root.to_string_lossy().into_owned(),
        worktree_path: worktree.to_string_lossy().into_owned(),
        branch: branch.to_string(),
        create_new,
    }
}

const TEAMMATE_BRANCH: &str = "grw-1348-cta-for-the-slot";

#[test]
fn creating_a_new_branch_named_like_a_remote_one_tracks_the_remote() {
    let root = std::fs::canonicalize(init_repo("foreign-create")).unwrap();
    commit(&root, "base.txt", "base\n", "base");
    push_to_new_remote(&root);
    let tip = teammate_pushes_a_branch(&root, TEAMMATE_BRANCH);

    let created = worktree_create_blocking(create_args(&root, TEAMMATE_BRANCH, "pr")).unwrap();

    let path = PathBuf::from(&created.worktree_path);
    assert!(created.tracked_remote);
    assert_eq!(git_ok(&path, &["rev-parse", "HEAD"]), tip);
    assert_eq!(
        git_ok(&path, &["rev-parse", "--abbrev-ref", "@{upstream}"]),
        format!("origin/{TEAMMATE_BRANCH}")
    );
    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn creating_a_fresh_branch_still_cuts_from_the_base() {
    let root = std::fs::canonicalize(init_repo("foreign-fresh")).unwrap();
    let base = commit(&root, "base.txt", "base\n", "base");
    push_to_new_remote(&root);

    let created = worktree_create_blocking(create_args(&root, "ak/own-work", "own")).unwrap();

    let path = PathBuf::from(&created.worktree_path);
    assert!(!created.tracked_remote);
    assert_eq!(git_ok(&path, &["rev-parse", "HEAD"]), base);
    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn creating_a_new_branch_refuses_a_local_branch_that_differs_from_the_remote() {
    let root = std::fs::canonicalize(init_repo("foreign-create-differs")).unwrap();
    commit(&root, "base.txt", "base\n", "base");
    push_to_new_remote(&root);
    teammate_pushes_a_branch(&root, TEAMMATE_BRANCH);
    git_ok(&root, &["branch", TEAMMATE_BRANCH, "main"]);
    let local = git_ok(&root, &["rev-parse", TEAMMATE_BRANCH]);

    let error = worktree_create_blocking(create_args(&root, TEAMMATE_BRANCH, "pr")).unwrap_err();

    let wire = serde_json::to_value(&error).unwrap();
    assert_eq!(wire["kind"], "local_branch_differs");
    assert_eq!(git_ok(&root, &["rev-parse", TEAMMATE_BRANCH]), local);
    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn switching_with_create_new_onto_a_remote_name_tracks_the_remote() {
    let root = std::fs::canonicalize(init_repo("foreign-switch")).unwrap();
    commit(&root, "base.txt", "base\n", "base");
    push_to_new_remote(&root);
    let tip = teammate_pushes_a_branch(&root, TEAMMATE_BRANCH);
    let mount = worktree_create_blocking(create_args(&root, "ak/mine", "mine")).unwrap();
    let mount_path = PathBuf::from(&mount.worktree_path);

    let changed = change_branch(switch_args(&root, &mount_path, TEAMMATE_BRANCH, true)).unwrap();

    assert!(changed.adopted);
    assert_eq!(git_ok(&mount_path, &["rev-parse", "HEAD"]), tip);
    assert_eq!(
        git_ok(&mount_path, &["rev-parse", "--abbrev-ref", "@{upstream}"]),
        format!("origin/{TEAMMATE_BRANCH}")
    );
    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn switching_with_create_new_onto_a_fresh_name_is_not_an_adoption() {
    let root = std::fs::canonicalize(init_repo("foreign-switch-fresh")).unwrap();
    let base = commit(&root, "base.txt", "base\n", "base");
    push_to_new_remote(&root);
    let mount = worktree_create_blocking(create_args(&root, "ak/mine", "mine")).unwrap();
    let mount_path = PathBuf::from(&mount.worktree_path);

    let changed = change_branch(switch_args(&root, &mount_path, "ak/next", true)).unwrap();

    assert!(!changed.adopted);
    assert_eq!(git_ok(&mount_path, &["rev-parse", "HEAD"]), base);
    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn switching_with_create_new_refuses_a_local_branch_that_differs() {
    let root = std::fs::canonicalize(init_repo("foreign-switch-differs")).unwrap();
    commit(&root, "base.txt", "base\n", "base");
    push_to_new_remote(&root);
    teammate_pushes_a_branch(&root, TEAMMATE_BRANCH);
    git_ok(&root, &["branch", TEAMMATE_BRANCH, "main"]);
    let mount = worktree_create_blocking(create_args(&root, "ak/mine", "mine")).unwrap();
    let mount_path = PathBuf::from(&mount.worktree_path);

    let error = change_branch(switch_args(&root, &mount_path, TEAMMATE_BRANCH, true)).unwrap_err();

    let wire = serde_json::to_value(&error).unwrap();
    assert_eq!(wire["kind"], "local_branch_differs");
    assert_eq!(
        git_ok(&mount_path, &["rev-parse", "--abbrev-ref", "HEAD"]),
        "ak/mine"
    );
    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn switching_onto_a_remote_only_branch_tracks_it() {
    let root = std::fs::canonicalize(init_repo("foreign-switch-existing")).unwrap();
    commit(&root, "base.txt", "base\n", "base");
    push_to_new_remote(&root);
    let tip = teammate_pushes_a_branch(&root, TEAMMATE_BRANCH);
    let mount = worktree_create_blocking(create_args(&root, "ak/mine", "mine")).unwrap();
    let mount_path = PathBuf::from(&mount.worktree_path);

    change_branch(switch_args(&root, &mount_path, TEAMMATE_BRANCH, false)).unwrap();

    assert_eq!(git_ok(&mount_path, &["rev-parse", "HEAD"]), tip);
    assert_eq!(
        git_ok(&mount_path, &["rev-parse", "--abbrev-ref", "@{upstream}"]),
        format!("origin/{TEAMMATE_BRANCH}")
    );
    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn lists_remote_branches_with_author_and_local_presence() {
    let root = std::fs::canonicalize(init_repo("foreign-list")).unwrap();
    commit(&root, "base.txt", "base\n", "base");
    push_to_new_remote(&root);
    teammate_pushes_a_branch(&root, TEAMMATE_BRANCH);
    git_ok(&root, &["fetch", "origin"]);

    let branches = list_remote_branches_blocking(root.to_string_lossy().into_owned()).unwrap();

    let teammate = branches
        .iter()
        .find(|branch| branch.name == TEAMMATE_BRANCH)
        .expect("the teammate branch is listed");
    assert_eq!(teammate.author, "Pat Harborline");
    assert!(!teammate.has_local);
    let main = branches
        .iter()
        .find(|branch| branch.name == "main")
        .unwrap();
    assert!(main.has_local);
    assert!(branches.iter().all(|branch| branch.name != "HEAD"));
    std::fs::remove_dir_all(root).unwrap();
}

fn stranded_mount(root: &Path) -> PathBuf {
    commit(root, "base.txt", "base\n", "base");
    push_to_new_remote(root);
    teammate_pushes_a_branch(root, TEAMMATE_BRANCH);
    git_ok(root, &["fetch", "origin"]);
    let parent = root.join(".goodboy").join("worktrees");
    std::fs::create_dir_all(&parent).unwrap();
    let path = parent.join("stranded");
    git_ok(
        root,
        &[
            "worktree",
            "add",
            "--no-track",
            "-b",
            TEAMMATE_BRANCH,
            path.to_str().unwrap(),
            "main",
        ],
    );
    path
}

#[test]
fn reads_a_remote_branch_with_commits_while_the_local_one_has_none() {
    let root = std::fs::canonicalize(init_repo("foreign-state")).unwrap();
    stranded_mount(&root);

    let state = remote_branch_state_blocking(
        root.to_string_lossy().into_owned(),
        TEAMMATE_BRANCH.to_string(),
        Some("main".to_string()),
    )
    .unwrap()
    .expect("both refs exist");

    assert_eq!(state.remote_ahead, 2);
    assert_eq!(state.local_own, 0);
    assert!(state.remote_contains_local);
    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn reads_nothing_when_the_remote_has_no_such_branch() {
    let root = std::fs::canonicalize(init_repo("foreign-state-none")).unwrap();
    commit(&root, "base.txt", "base\n", "base");
    push_to_new_remote(&root);
    git_ok(&root, &["branch", "ak/mine", "main"]);

    let state = remote_branch_state_blocking(
        root.to_string_lossy().into_owned(),
        "ak/mine".to_string(),
        Some("main".to_string()),
    )
    .unwrap();

    assert_eq!(state, None);
    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn moves_a_stranded_worktree_onto_the_remote_commits() {
    let root = std::fs::canonicalize(init_repo("foreign-repair")).unwrap();
    let path = stranded_mount(&root);
    let tip = git_ok(&root, &["rev-parse", &format!("origin/{TEAMMATE_BRANCH}")]);

    use_remote_commits_blocking(
        path.to_string_lossy().into_owned(),
        TEAMMATE_BRANCH.to_string(),
    )
    .unwrap();

    assert_eq!(git_ok(&path, &["rev-parse", "HEAD"]), tip);
    assert_eq!(
        git_ok(&path, &["rev-parse", "--abbrev-ref", "@{upstream}"]),
        format!("origin/{TEAMMATE_BRANCH}")
    );
    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn repair_refuses_a_dirty_worktree_and_changes_nothing() {
    let root = std::fs::canonicalize(init_repo("foreign-repair-dirty")).unwrap();
    let path = stranded_mount(&root);
    let before = git_ok(&path, &["rev-parse", "HEAD"]);
    std::fs::write(path.join("notes.txt"), "wip\n").unwrap();

    let error = use_remote_commits_blocking(
        path.to_string_lossy().into_owned(),
        TEAMMATE_BRANCH.to_string(),
    )
    .unwrap_err();

    let WorktreeError::Git { message } = error else {
        panic!("expected a git error, found {error:?}");
    };
    assert!(message.contains("uncommitted changes"));
    assert_eq!(git_ok(&path, &["rev-parse", "HEAD"]), before);
    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn repair_refuses_a_local_branch_with_commits_of_its_own() {
    let root = std::fs::canonicalize(init_repo("foreign-repair-own")).unwrap();
    let path = stranded_mount(&root);
    let own = commit(&path, "mine.txt", "mine\n", "my own work");

    let error = use_remote_commits_blocking(
        path.to_string_lossy().into_owned(),
        TEAMMATE_BRANCH.to_string(),
    )
    .unwrap_err();

    let wire = serde_json::to_value(&error).unwrap();
    assert_eq!(wire["kind"], "local_branch_differs");
    assert_eq!(git_ok(&path, &["rev-parse", "HEAD"]), own);
    std::fs::remove_dir_all(root).unwrap();
}
