use super::worktree_diff_working_blocking;
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
