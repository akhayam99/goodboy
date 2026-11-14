use super::{
    worktree_diff_commit_blocking, worktree_diff_files_blocking, worktree_diff_range_blocking,
    worktree_diff_working_blocking, DiffFileEntry,
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
        "HEAD".to_string(),
        false
    )
    .is_err());
    assert!(!root.join("leak.txt").exists());
    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn a_range_diff_from_the_merge_base_leaves_out_what_the_base_changed_since() {
    let root = repo_with("merge-base", "a.txt");
    let path = root.to_string_lossy().into_owned();
    git_ok(&root, &["checkout", "-b", "ak/ledger-export"]);
    std::fs::write(root.join("pnpm-lock.yaml"), "lock\n").unwrap();
    git_ok(&root, &["add", "pnpm-lock.yaml"]);
    git_ok(&root, &["commit", "-m", "lock"]);
    git_ok(&root, &["checkout", "main"]);
    std::fs::write(root.join("main.txt"), "main\n").unwrap();
    git_ok(&root, &["add", "main.txt"]);
    git_ok(&root, &["commit", "-m", "main moves"]);

    let from_base = worktree_diff_range_blocking(
        path.clone(),
        "main".to_string(),
        "ak/ledger-export".to_string(),
        true,
    )
    .unwrap();
    let plain = worktree_diff_range_blocking(
        path,
        "main".to_string(),
        "ak/ledger-export".to_string(),
        false,
    )
    .unwrap();

    assert!(from_base.contains("b/pnpm-lock.yaml"));
    assert!(!from_base.contains("main.txt"));
    assert!(plain.contains("main.txt"));
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

fn branch_files(root: &Path) -> Vec<DiffFileEntry> {
    worktree_diff_files_blocking(root.to_string_lossy().into_owned(), Some("main".into())).unwrap()
}

fn entry_of<'a>(entries: &'a [DiffFileEntry], path: &str) -> &'a DiffFileEntry {
    entries
        .iter()
        .find(|entry| entry.path == path)
        .unwrap_or_else(|| panic!("no entry for {path}"))
}

#[test]
fn the_file_list_counts_tracked_edits_adds_and_deletes_against_the_merge_base() {
    let root = repo_with("list-tracked", "keep.ts");
    std::fs::write(root.join("gone.ts"), "a\nb\n").unwrap();
    git_ok(&root, &["add", "gone.ts"]);
    git_ok(&root, &["commit", "-m", "second"]);
    git_ok(&root, &["checkout", "-b", "feat"]);
    std::fs::write(root.join("keep.ts"), "one\ntwo\nthree\n").unwrap();
    std::fs::write(root.join("fresh.ts"), "x\n").unwrap();
    git_ok(&root, &["add", "fresh.ts"]);
    git_ok(&root, &["rm", "-q", "gone.ts"]);
    git_ok(&root, &["commit", "-am", "work"]);

    let entries = branch_files(&root);

    assert_eq!(entries.len(), 3);
    let kept = entry_of(&entries, "keep.ts");
    assert_eq!(
        (kept.status, kept.additions, kept.deletions),
        ("modified", 2, 0)
    );
    let fresh = entry_of(&entries, "fresh.ts");
    assert_eq!(
        (fresh.status, fresh.additions, fresh.is_untracked),
        ("added", 1, false)
    );
    let gone = entry_of(&entries, "gone.ts");
    assert_eq!(
        (gone.status, gone.additions, gone.deletions),
        ("deleted", 0, 2)
    );
    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn the_file_list_keeps_the_old_path_of_a_rename() {
    let root = repo_with("list-rename", "old.ts");
    git_ok(&root, &["checkout", "-b", "feat"]);
    git_ok(&root, &["mv", "old.ts", "new.ts"]);
    git_ok(&root, &["commit", "-m", "move"]);

    let entries = branch_files(&root);

    assert_eq!(entries.len(), 1);
    assert_eq!(entries[0].path, "new.ts");
    assert_eq!(entries[0].old_path.as_deref(), Some("old.ts"));
    assert_eq!(entries[0].status, "renamed");
    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn a_single_file_diff_with_the_old_path_keeps_the_rename() {
    let root = repo_with("file-rename", "old.ts");
    git_ok(&root, &["checkout", "-b", "feat"]);
    git_ok(&root, &["mv", "old.ts", "new.ts"]);
    git_ok(&root, &["commit", "-m", "move"]);
    let worktree = root.to_string_lossy().into_owned();

    let alone = super::worktree_diff_file_blocking(
        worktree.clone(),
        Some("main".into()),
        "new.ts".into(),
        None,
    )
    .unwrap();
    let paired = super::worktree_diff_file_blocking(
        worktree,
        Some("main".into()),
        "new.ts".into(),
        Some("old.ts".into()),
    )
    .unwrap();

    assert!(alone.contains("new file mode"));
    assert!(paired.contains("rename from old.ts"));
    assert!(paired.contains("rename to new.ts"));
    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn a_single_file_diff_refuses_an_old_path_outside_the_worktree() {
    let root = repo_with("file-old-outside", "a.ts");

    let result = super::worktree_diff_file_blocking(
        root.to_string_lossy().into_owned(),
        Some("main".into()),
        "a.ts".into(),
        Some("../b.ts".into()),
    );

    assert!(result.is_err());
    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn the_file_list_marks_a_tracked_binary_and_an_untracked_file() {
    let root = repo_with("list-binary", "base.ts");
    git_ok(&root, &["checkout", "-b", "feat"]);
    std::fs::write(root.join("logo.bin"), [0u8, 1, 2, 0]).unwrap();
    git_ok(&root, &["add", "logo.bin"]);
    git_ok(&root, &["commit", "-m", "bin"]);
    std::fs::write(root.join("naïve.ts"), "a\nb\nc").unwrap();
    std::fs::write(root.join("blob.dat"), [0u8, 9]).unwrap();
    std::fs::write(root.join("empty.ts"), "").unwrap();

    let entries = branch_files(&root);

    let logo = entry_of(&entries, "logo.bin");
    assert!(logo.is_binary && !logo.is_untracked);
    let naive = entry_of(&entries, "naïve.ts");
    assert_eq!((naive.status, naive.additions), ("added", 3));
    assert!(naive.is_untracked && !naive.is_binary);
    let blob = entry_of(&entries, "blob.dat");
    assert!(blob.is_untracked && blob.is_binary);
    let empty = entry_of(&entries, "empty.ts");
    assert_eq!((empty.additions, empty.is_binary), (0, false));
    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn the_file_list_agrees_with_the_full_diff_on_which_files_changed() {
    let root = repo_with("list-agree", "a.ts");
    git_ok(&root, &["checkout", "-b", "feat"]);
    std::fs::write(root.join("a.ts"), "two\n").unwrap();
    std::fs::write(root.join("b.ts"), "new\n").unwrap();

    let entries = branch_files(&root);
    let full =
        super::worktree_diff_blocking(root.to_string_lossy().into_owned(), Some("main".into()))
            .unwrap();

    for entry in &entries {
        assert!(full.contains(&format!("diff --git a/{0} b/{0}", entry.path)));
    }
    assert_eq!(full.matches("diff --git").count(), entries.len());
    std::fs::remove_dir_all(root).unwrap();
}
