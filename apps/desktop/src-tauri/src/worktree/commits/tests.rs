use super::{worktree_blame_line_blocking, worktree_commit_range_blocking, RangeCommit};
use crate::worktree::git::git;
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
    git_ok(root, &["commit", "--no-verify", "-m", message]);
    git_ok(root, &["rev-parse", "HEAD"])
}

#[test]
fn the_commit_range_lists_subjects_oldest_first() {
    let root = init_repo("commit-range");
    let base = commit(&root, "base.txt", "base", "base");
    let first = commit(&root, "a.txt", "a", "Add retry policy");
    let second = commit(&root, "b.txt", "b", "fixup! Add retry policy");

    let range =
        worktree_commit_range_blocking(root.to_string_lossy().into_owned(), base, second.clone())
            .unwrap();

    assert_eq!(
        range,
        vec![
            RangeCommit {
                sha: first,
                subject: "Add retry policy".to_string()
            },
            RangeCommit {
                sha: second,
                subject: "fixup! Add retry policy".to_string()
            },
        ]
    );
}

#[test]
fn blame_names_the_commit_that_introduced_a_line() {
    let root = init_repo("blame-line");
    commit(&root, "retry.ts", "one\n", "base");
    let introduced = commit(&root, "retry.ts", "one\ntwo\n", "Add retry policy");

    let blamed = |line: u32| {
        worktree_blame_line_blocking(
            root.to_string_lossy().into_owned(),
            "retry.ts".to_string(),
            line,
        )
        .unwrap()
    };

    assert_eq!(blamed(2), Some(introduced));
    assert_eq!(blamed(0), None);
    assert_eq!(blamed(9), None);
}
