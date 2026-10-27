use super::{
    worktree_diff_commit_blocking, worktree_diff_range_blocking, worktree_diff_working_blocking,
};
use crate::worktree::git::git;
use std::path::{Path, PathBuf};

fn git_ok(cwd: &Path, args: &[&str]) -> String {
    git(cwd, args)
        .unwrap_or_else(|err| panic!("git {} failed: {err}", args.join(" ")))
        .trim()
        .to_string()
}

fn repo_with(name: &str, file: &str) -> PathBuf {
    let root = std::env::temp_dir().join(format!(
        "goodboy-diff-{name}-{}-{}",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ));
    std::fs::create_dir_all(&root).unwrap();
    let root = std::fs::canonicalize(root).unwrap();
    git_ok(&root, &["init", "-b", "main"]);
    git_ok(&root, &["config", "user.email", "test@example.com"]);
    git_ok(&root, &["config", "user.name", "test"]);
    git_ok(&root, &["config", "commit.gpgsign", "false"]);
    std::fs::write(root.join(file), "one\n").unwrap();
    git_ok(&root, &["add", file]);
    git_ok(&root, &["commit", "-m", "base"]);
    root
}

#[test]
fn a_tracked_file_with_accents_keeps_its_plain_name_in_the_diff() {
    let root = repo_with("tracked", "café.ts");
    std::fs::write(root.join("café.ts"), "two\n").unwrap();

    let diff =
        worktree_diff_working_blocking(root.to_string_lossy().into_owned(), "all".into()).unwrap();

    assert!(diff.contains("diff --git a/café.ts b/café.ts"));
    assert!(!diff.contains("\\303"));
    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn an_untracked_file_with_accents_gets_a_plain_header() {
    let root = repo_with("untracked", "base.ts");
    std::fs::write(root.join("naïve.ts"), "fresh\n").unwrap();

    let diff =
        worktree_diff_working_blocking(root.to_string_lossy().into_owned(), "all".into()).unwrap();

    assert!(diff.contains("diff --git a/naïve.ts b/naïve.ts"));
    assert!(diff.contains("+fresh"));
    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn a_commit_diff_refuses_an_option_shaped_revision() {
    let root = repo_with("dash-commit", "a.txt");
    let path = root.to_string_lossy().into_owned();

    assert!(worktree_diff_commit_blocking(path.clone(), "--output=leak.txt".to_string()).is_err());
    assert!(!root.join("leak.txt").exists());
    let head = git_ok(&root, &["rev-parse", "HEAD"]);
    assert!(worktree_diff_commit_blocking(path, head).is_ok());
    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn a_range_diff_refuses_an_option_shaped_revision() {
    let root = repo_with("dash-range", "a.txt");
    let path = root.to_string_lossy().into_owned();

    assert!(worktree_diff_range_blocking(
        path,
        "--output=leak.txt".to_string(),
        "HEAD".to_string()
    )
    .is_err());
    assert!(!root.join("leak.txt").exists());
    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn a_file_diff_path_outside_the_worktree_is_refused() {
    let root = repo_with("confine-outside", "a.ts");
    let outside = repo_with("confine-other", "b.ts");

    assert!(super::confine_rel_path(&root, outside.join("b.ts").to_str().unwrap()).is_err());
    assert!(super::confine_rel_path(&root, "../b.ts").is_err());
    assert!(super::confine_rel_path(&root, "/").is_err());
    assert_eq!(super::confine_rel_path(&root, "a.ts").unwrap(), "a.ts");
    assert_eq!(
        super::confine_rel_path(&root, root.join("a.ts").to_str().unwrap()).unwrap(),
        "a.ts"
    );
}

#[cfg(unix)]
#[test]
fn a_file_diff_path_through_a_symlink_to_outside_is_refused() {
    let root = repo_with("confine-link", "a.ts");
    let outside = repo_with("confine-link-target", "secret.ts");
    std::os::unix::fs::symlink(outside.join("secret.ts"), root.join("link.ts")).unwrap();
    std::os::unix::fs::symlink(&outside, root.join("linked-dir")).unwrap();

    assert!(super::confine_rel_path(&root, "link.ts").is_err());
    assert!(super::confine_rel_path(&root, "linked-dir/secret.ts").is_err());
}

#[test]
fn a_deleted_file_path_inside_the_worktree_is_still_accepted() {
    let root = repo_with("confine-deleted", "a.ts");

    assert_eq!(
        super::confine_rel_path(&root, "gone/old.ts").unwrap(),
        "gone/old.ts"
    );
}
