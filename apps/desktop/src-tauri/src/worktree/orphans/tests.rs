use super::{allocated_bytes, collect_orphans, worktree_directory_size_blocking};
use crate::worktree::git::git;
use crate::worktree::remove::remove_worktree_checked_with;
use crate::worktree::types::{WorktreeRemovalMode, WorktreeRemovalResult};
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
        .unwrap_or_else(|error| panic!("git {} failed: {error}", args.join(" ")))
        .trim()
        .to_string()
}

fn init_repo(name: &str) -> PathBuf {
    let root = temp_root(name);
    git_ok(&root, &["init", "-b", "main"]);
    git_ok(&root, &["config", "user.email", "test@example.com"]);
    git_ok(&root, &["config", "user.name", "test"]);
    std::fs::write(root.join(".gitignore"), "node_modules/\n").unwrap();
    std::fs::write(root.join("tracked.txt"), "base\n").unwrap();
    git_ok(&root, &["add", ".gitignore", "tracked.txt"]);
    git_ok(&root, &["commit", "-m", "base"]);
    std::fs::canonicalize(root).unwrap()
}

fn add_worktree(root: &Path, name: &str) -> PathBuf {
    let target = root.join("worktrees").join(name);
    git_ok(
        root,
        &[
            "worktree",
            "add",
            "-b",
            &format!("test/{name}"),
            target.to_str().unwrap(),
        ],
    );
    std::fs::canonicalize(target).unwrap()
}

fn remove(root: &Path, target: &Path) -> WorktreeRemovalResult {
    remove_with_mode(root, target, WorktreeRemovalMode::Safe)
}

fn remove_with_mode(
    root: &Path,
    target: &Path,
    mode: WorktreeRemovalMode,
) -> WorktreeRemovalResult {
    remove_worktree_checked_with(
        root,
        target,
        mode,
        &mut |cwd, args| git(cwd, args),
        &mut |_| false,
    )
    .unwrap()
}

#[test]
fn dependency_size_is_reported_and_disappears_after_safe_cleanup() {
    let root = init_repo("remove-dependencies");
    let target = add_worktree(&root, "dependencies");
    std::fs::create_dir_all(target.join("node_modules").join("dep")).unwrap();
    std::fs::write(
        target.join("node_modules").join("dep").join("index.js"),
        vec![0u8; 4096],
    )
    .unwrap();

    let before = worktree_directory_size_blocking(target.to_string_lossy().into_owned());
    let removed = remove(&root, &target);
    let after = worktree_directory_size_blocking(target.to_string_lossy().into_owned());

    assert!(before.size_bytes.is_some_and(|bytes| bytes >= 4096));
    assert!(matches!(removed, WorktreeRemovalResult::Removed { .. }));
    assert_eq!((after.exists, after.size_bytes), (false, None));
}

fn make_worktree_dir(parent: &Path, name: &str, bytes: usize) -> PathBuf {
    let dir = parent.join(name);
    std::fs::create_dir_all(dir.join("src")).unwrap();
    std::fs::write(dir.join("src").join("main.ts"), "x".repeat(bytes)).unwrap();
    dir
}

#[test]
fn a_folder_git_forgot_and_no_session_claims_is_reported() {
    let root = temp_root("orphan-scan");
    let parent = root.join(".goodboy").join("worktrees");
    std::fs::create_dir_all(&parent).unwrap();
    let registered = make_worktree_dir(&parent, "gb-live", 10);
    let claimed = make_worktree_dir(&parent, "gb-known", 10);
    let orphan = make_worktree_dir(&parent, "gb-ghost", 4096);

    let found = collect_orphans(
        &root,
        &[registered.to_string_lossy().into_owned()],
        &[claimed.to_string_lossy().into_owned()],
    );

    assert_eq!(
        found.iter().map(|o| o.name.as_str()).collect::<Vec<_>>(),
        vec!["gb-ghost", "gb-live"]
    );
    assert!(!found[0].is_registered);
    assert!(found[1].is_registered);
    assert!(orphan.exists());
    assert!(registered.exists());
    assert!(claimed.exists());
}

#[test]
fn directory_size_counts_files_without_following_symlinks() {
    let root = temp_root("directory-size");
    let target = root.join("target");
    let external = root.join("external.bin");
    std::fs::create_dir_all(target.join("nested")).unwrap();
    std::fs::write(target.join("one.bin"), vec![0u8; 10]).unwrap();
    std::fs::write(target.join("nested").join("two.bin"), vec![0u8; 25]).unwrap();
    std::fs::write(&external, vec![0u8; 4096]).unwrap();
    #[cfg(unix)]
    std::os::unix::fs::symlink(&external, target.join("external-link")).unwrap();

    let result = worktree_directory_size_blocking(target.to_string_lossy().into_owned());

    let expected = [
        target.join("one.bin"),
        target.join("nested").join("two.bin"),
    ]
    .iter()
    .map(|file| allocated_bytes(&std::fs::metadata(file).unwrap()))
    .sum::<u64>();
    assert_eq!(result.size_bytes, Some(expected));
    assert!(expected >= 35);
    assert!(!result.is_partial);
    assert!(result.exists);
}

#[cfg(unix)]
#[test]
fn directory_size_counts_allocated_blocks_so_sparse_files_stay_small() {
    let root = temp_root("directory-size-sparse");
    let target = root.join("target");
    std::fs::create_dir_all(&target).unwrap();
    let sparse = std::fs::File::create(target.join("sparse.bin")).unwrap();
    sparse.set_len(64 * 1024 * 1024).unwrap();

    let result = worktree_directory_size_blocking(target.to_string_lossy().into_owned());

    assert!(result.size_bytes.unwrap() < 64 * 1024 * 1024);
}

#[test]
fn absent_directory_has_no_size() {
    let root = temp_root("directory-size-missing");
    let target = root.join("missing");

    let result = worktree_directory_size_blocking(target.to_string_lossy().into_owned());

    assert_eq!(result.size_bytes, None);
    assert!(!result.is_partial);
    assert!(!result.exists);
}

#[cfg(unix)]
#[test]
fn unreadable_directory_is_distinct_from_an_empty_directory() {
    use std::os::unix::fs::PermissionsExt;

    let root = temp_root("directory-size-unreadable");
    let empty = root.join("empty");
    let unreadable = root.join("unreadable");
    std::fs::create_dir_all(&empty).unwrap();
    std::fs::create_dir_all(&unreadable).unwrap();
    std::fs::set_permissions(&unreadable, std::fs::Permissions::from_mode(0o000)).unwrap();

    let empty_result = worktree_directory_size_blocking(empty.to_string_lossy().into_owned());
    let unreadable_result =
        worktree_directory_size_blocking(unreadable.to_string_lossy().into_owned());

    std::fs::set_permissions(&unreadable, std::fs::Permissions::from_mode(0o700)).unwrap();
    assert_eq!(empty_result.size_bytes, Some(0));
    assert!(!empty_result.is_partial);
    assert_eq!(unreadable_result.size_bytes, None);
    assert!(unreadable_result.is_partial);
}

#[cfg(unix)]
#[test]
fn unreadable_child_marks_a_partial_size() {
    use std::os::unix::fs::PermissionsExt;

    let root = temp_root("directory-size-partial");
    let target = root.join("target");
    let unreadable = target.join("unreadable");
    std::fs::create_dir_all(&unreadable).unwrap();
    std::fs::write(target.join("readable.bin"), vec![0u8; 17]).unwrap();
    std::fs::write(unreadable.join("hidden.bin"), vec![0u8; 100]).unwrap();
    std::fs::set_permissions(&unreadable, std::fs::Permissions::from_mode(0o000)).unwrap();

    let result = worktree_directory_size_blocking(target.to_string_lossy().into_owned());

    std::fs::set_permissions(&unreadable, std::fs::Permissions::from_mode(0o700)).unwrap();
    let readable = allocated_bytes(&std::fs::metadata(target.join("readable.bin")).unwrap());
    assert_eq!(result.size_bytes, Some(readable));
    assert!(result.is_partial);
    assert!(result.exists);
}
