use super::tidy_goodboy_dir;
use crate::worktree::create::worktree_create_blocking;
use crate::worktree::git::git;
use crate::worktree::remove::remove_worktree_checked_with;
use crate::worktree::types::{CreateArgs, CreatedWorktree, WorktreeRemovalMode};
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

fn remove_checked(root: &Path, worktree_path: &str) {
    remove_worktree_checked_with(
        root,
        Path::new(worktree_path),
        WorktreeRemovalMode::Safe,
        &mut |cwd, args| git(cwd, args),
        &mut |_| false,
    )
    .unwrap();
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
fn the_exclude_entry_is_written_once_and_survives_a_detach() {
    let root = std::fs::canonicalize(init_repo("exclude-lifecycle")).unwrap();
    commit(&root, "base.txt", "base", "base");
    push_to_new_remote(&root);
    let created = create_session_mount(&root, "goal-def67890");

    let reused = create_session_mount(&root, "goal-def67890");
    assert!(reused.reused);
    let exclude_path = root.join(".git").join("info").join("exclude");
    let exclude = std::fs::read_to_string(&exclude_path).unwrap();
    assert_eq!(
        exclude.lines().filter(|line| *line == ".goodboy/").count(),
        1
    );

    remove_checked(&root, &created.worktree_path);

    assert!(!Path::new(&created.worktree_path).exists());
    let after = std::fs::read_to_string(&exclude_path).unwrap();
    assert_eq!(after.lines().filter(|line| *line == ".goodboy/").count(), 1);
    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn deleting_the_last_mount_tidies_the_goodboy_dir_and_the_exclude_entry() {
    let root = std::fs::canonicalize(init_repo("tidy-last-mount")).unwrap();
    commit(&root, "base.txt", "base", "base");
    push_to_new_remote(&root);
    let created = create_session_mount(&root, "goal-tidy0001");

    remove_checked(&root, &created.worktree_path);
    tidy_goodboy_dir(&root);

    assert!(!root.join(".goodboy").exists());
    let exclude_path = root.join(".git").join("info").join("exclude");
    let exclude = std::fs::read_to_string(&exclude_path).unwrap();
    assert_eq!(
        exclude.lines().filter(|line| *line == ".goodboy/").count(),
        0
    );
    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn tidy_keeps_the_goodboy_dir_and_the_exclude_entry_while_another_mount_remains() {
    let root = std::fs::canonicalize(init_repo("tidy-shared-repo")).unwrap();
    commit(&root, "base.txt", "base", "base");
    push_to_new_remote(&root);
    let removed = create_session_mount(&root, "goal-tidy0002");
    let survivor = create_session_mount(&root, "goal-tidy0003");

    remove_checked(&root, &removed.worktree_path);
    tidy_goodboy_dir(&root);

    assert!(Path::new(&survivor.worktree_path).is_dir());
    let exclude_path = root.join(".git").join("info").join("exclude");
    let exclude = std::fs::read_to_string(&exclude_path).unwrap();
    assert_eq!(
        exclude.lines().filter(|line| *line == ".goodboy/").count(),
        1
    );
    std::fs::remove_dir_all(root).unwrap();
}
