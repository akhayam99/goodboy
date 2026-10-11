use super::{worktree_changed_files_blocking, ChangedEntry};
use crate::worktree::git::git;
use std::path::{Path, PathBuf};

fn git_ok(cwd: &Path, args: &[&str]) -> String {
    git(cwd, args)
        .unwrap_or_else(|err| panic!("git {} failed: {err}", args.join(" ")))
        .trim()
        .to_string()
}

fn init_repo(name: &str) -> PathBuf {
    let root = std::env::temp_dir().join(format!(
        "goodboy-{name}-{}-{}",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ));
    std::fs::create_dir_all(&root).unwrap();
    git_ok(&root, &["init", "-b", "main"]);
    git_ok(&root, &["config", "user.email", "test@example.com"]);
    git_ok(&root, &["config", "user.name", "test"]);
    git_ok(&root, &["config", "commit.gpgsign", "false"]);
    std::fs::write(root.join("base.txt"), "one\n").unwrap();
    git_ok(&root, &["add", "base.txt"]);
    git_ok(&root, &["commit", "-m", "base"]);
    root
}

fn summary(root: &Path) -> (u32, u32) {
    let out = worktree_changed_files_blocking(
        root.to_string_lossy().to_string(),
        Some("main".to_string()),
    )
    .unwrap();
    (out.additions, out.deletions)
}

#[test]
fn counts_the_branch_work_while_it_is_still_waiting_to_land() {
    let root = init_repo("changed-files-open");
    git_ok(&root, &["checkout", "-b", "feature"]);
    std::fs::write(root.join("feature.txt"), "a\nb\nc\n").unwrap();
    git_ok(&root, &["add", "feature.txt"]);
    git_ok(&root, &["commit", "-m", "feature"]);

    assert_eq!(summary(&root), (3, 0));

    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn stops_counting_the_branch_work_once_the_base_carries_it() {
    let root = init_repo("changed-files-merged");
    git_ok(&root, &["checkout", "-b", "feature"]);
    std::fs::write(root.join("feature.txt"), "a\nb\nc\n").unwrap();
    git_ok(&root, &["add", "feature.txt"]);
    git_ok(&root, &["commit", "-m", "feature"]);
    git_ok(&root, &["checkout", "main"]);
    git_ok(
        &root,
        &["merge", "--no-ff", "-m", "merge feature", "feature"],
    );
    git_ok(&root, &["checkout", "feature"]);

    assert_eq!(summary(&root), (0, 0));

    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn keeps_counting_uncommitted_work_on_a_landed_branch() {
    let root = init_repo("changed-files-landed-dirty");
    git_ok(&root, &["checkout", "-b", "feature"]);
    std::fs::write(root.join("feature.txt"), "a\nb\nc\n").unwrap();
    git_ok(&root, &["add", "feature.txt"]);
    git_ok(&root, &["commit", "-m", "feature"]);
    git_ok(&root, &["checkout", "main"]);
    git_ok(
        &root,
        &["merge", "--no-ff", "-m", "merge feature", "feature"],
    );
    git_ok(&root, &["checkout", "feature"]);
    std::fs::write(root.join("feature.txt"), "a\nb\nc\nd\n").unwrap();

    assert_eq!(summary(&root), (1, 0));

    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn reads_a_squash_of_several_commits_as_landed_too() {
    let root = init_repo("changed-files-squashed");
    git_ok(&root, &["checkout", "-b", "feature"]);
    std::fs::write(root.join("feature.txt"), "a\nb\n").unwrap();
    git_ok(&root, &["add", "feature.txt"]);
    git_ok(&root, &["commit", "-m", "feature one"]);
    std::fs::write(root.join("feature.txt"), "a\nb\nc\n").unwrap();
    git_ok(&root, &["add", "feature.txt"]);
    git_ok(&root, &["commit", "-m", "feature two"]);
    git_ok(&root, &["checkout", "main"]);
    git_ok(&root, &["merge", "--squash", "feature"]);
    git_ok(&root, &["commit", "-m", "feature squashed"]);
    git_ok(&root, &["checkout", "feature"]);

    assert_eq!(summary(&root), (0, 0));

    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn still_counts_a_branch_the_base_only_partly_carries() {
    let root = init_repo("changed-files-partly-landed");
    git_ok(&root, &["checkout", "-b", "feature"]);
    std::fs::write(root.join("feature.txt"), "a\nb\nc\n").unwrap();
    git_ok(&root, &["add", "feature.txt"]);
    git_ok(&root, &["commit", "-m", "feature"]);
    std::fs::write(root.join("later.txt"), "d\ne\n").unwrap();
    git_ok(&root, &["add", "later.txt"]);
    git_ok(&root, &["commit", "-m", "later"]);
    git_ok(&root, &["checkout", "main"]);
    git_ok(&root, &["checkout", "feature", "--", "feature.txt"]);
    git_ok(&root, &["add", "feature.txt"]);
    git_ok(&root, &["commit", "-m", "took only the first file"]);
    git_ok(&root, &["checkout", "feature"]);

    assert_eq!(summary(&root), (5, 0));

    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn keeps_counting_a_branch_the_base_changed_further() {
    let root = init_repo("changed-files-moved-on");
    git_ok(&root, &["checkout", "-b", "feature"]);
    std::fs::write(root.join("feature.txt"), "a\nb\nc\n").unwrap();
    git_ok(&root, &["add", "feature.txt"]);
    git_ok(&root, &["commit", "-m", "feature"]);
    git_ok(&root, &["checkout", "main"]);
    std::fs::write(root.join("feature.txt"), "x\ny\n").unwrap();
    git_ok(&root, &["add", "feature.txt"]);
    git_ok(&root, &["commit", "-m", "someone else wrote it first"]);
    git_ok(&root, &["checkout", "feature"]);

    assert_eq!(summary(&root), (3, 0));

    std::fs::remove_dir_all(root).unwrap();
}

fn entry(path: &str, status: &'static str, from: Option<&str>) -> ChangedEntry {
    ChangedEntry {
        path: path.to_string(),
        status,
        from: from.map(str::to_string),
    }
}

#[test]
fn names_the_status_of_every_changed_file() {
    let root = init_repo("changed-files-statuses");
    let body_of = |name: &str| format!("{name} one\n{name} two\n{name} three\n{name} four\n");
    let body = body_of("committed.txt");
    let dirty_body = body_of("dirty.txt");
    for name in ["committed.txt", "dirty.txt", "old.txt", "gone.txt"] {
        std::fs::write(root.join(name), body_of(name)).unwrap();
        git_ok(&root, &["add", name]);
    }
    git_ok(&root, &["commit", "-m", "files"]);
    git_ok(&root, &["checkout", "-b", "feature"]);
    std::fs::write(root.join("committed.txt"), format!("{body}extra\n")).unwrap();
    git_ok(&root, &["add", "committed.txt"]);
    git_ok(&root, &["commit", "-m", "touch"]);
    std::fs::write(root.join("dirty.txt"), format!("{dirty_body}more\n")).unwrap();
    std::fs::write(root.join("fresh.txt"), "a\nb\n").unwrap();
    git_ok(&root, &["mv", "old.txt", "new.txt"]);
    git_ok(&root, &["rm", "gone.txt"]);

    let out = worktree_changed_files_blocking(
        root.to_string_lossy().to_string(),
        Some("main".to_string()),
    )
    .unwrap();

    assert_eq!(
        out.entries,
        vec![
            entry("committed.txt", "modified", None),
            entry("dirty.txt", "modified", None),
            entry("fresh.txt", "added", None),
            entry("gone.txt", "deleted", None),
            entry("new.txt", "renamed", Some("old.txt")),
        ]
    );
    assert_eq!(
        out.numstat,
        "1\t0\tcommitted.txt\n1\t0\tdirty.txt\n0\t4\tgone.txt\n0\t0\told.txt => new.txt\n2\t0\tfresh.txt"
    );

    std::fs::remove_dir_all(root).unwrap();
}
