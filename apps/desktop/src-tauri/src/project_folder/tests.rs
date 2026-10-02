use super::{create_project_folder, is_valid_folder_name};
use crate::repo::RepoInitError;
use crate::worktree::git;
use std::path::{Path, PathBuf};

fn temp_root(name: &str) -> PathBuf {
    let root = std::env::temp_dir().join(format!(
        "goodboy-folder-{name}-{}-{}",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ));
    std::fs::create_dir_all(&root).unwrap();
    std::fs::canonicalize(root).unwrap()
}

fn git_ok(cwd: &Path, args: &[&str]) -> String {
    git(cwd, args)
        .unwrap_or_else(|err| panic!("git {} failed: {err}", args.join(" ")))
        .trim()
        .to_string()
}

#[test]
fn a_new_project_folder_holds_a_repository_with_one_first_commit_on_main() {
    let parent = temp_root("create");

    let created = create_project_folder(parent.to_str().unwrap(), "cascadia").unwrap();

    let folder = parent.join("cascadia");
    assert_eq!(created.root_path, folder.to_string_lossy());
    assert_eq!(created.branch, "main");
    assert_eq!(
        git_ok(&folder, &["rev-parse", "--abbrev-ref", "HEAD"]),
        "main"
    );
    assert_eq!(git_ok(&folder, &["rev-list", "--count", "HEAD"]), "1");
    assert_eq!(
        git_ok(&folder, &["show", "--name-only", "--format=", "HEAD"]),
        ".gitignore"
    );
    assert_eq!(git_ok(&folder, &["status", "--porcelain"]), "");
    std::fs::remove_dir_all(&parent).unwrap();
}

#[test]
fn a_missing_parent_is_refused_and_nothing_is_created() {
    let parent = temp_root("missing");
    let absent = parent.join("nowhere");

    let result = create_project_folder(absent.to_str().unwrap(), "cascadia");

    assert!(matches!(result, Err(RepoInitError::DirNotFound(_))));
    assert!(!absent.exists());
    std::fs::remove_dir_all(&parent).unwrap();
}

#[test]
fn an_existing_folder_is_refused_and_left_alone() {
    let parent = temp_root("exists");
    std::fs::create_dir(parent.join("cascadia")).unwrap();
    std::fs::write(parent.join("cascadia").join("keep.txt"), "mine").unwrap();

    let result = create_project_folder(parent.to_str().unwrap(), "cascadia");

    assert!(matches!(result, Err(RepoInitError::AlreadyExists(_))));
    assert_eq!(
        std::fs::read_to_string(parent.join("cascadia").join("keep.txt")).unwrap(),
        "mine"
    );
    std::fs::remove_dir_all(&parent).unwrap();
}

#[test]
fn a_parent_inside_another_repository_is_refused_before_anything_is_created() {
    let parent = temp_root("nested");
    git_ok(&parent, &["init", "-b", "main"]);
    let inner = parent.join("games");
    std::fs::create_dir(&inner).unwrap();

    let inside = create_project_folder(inner.to_str().unwrap(), "cascadia");
    let at_root = create_project_folder(parent.to_str().unwrap(), "cascadia");

    assert!(matches!(inside, Err(RepoInitError::NestedRepo(_))));
    assert!(matches!(at_root, Err(RepoInitError::NestedRepo(_))));
    assert!(!inner.join("cascadia").exists());
    assert!(!parent.join("cascadia").exists());
    std::fs::remove_dir_all(&parent).unwrap();
}

#[test]
fn names_that_could_escape_or_hide_are_refused() {
    let parent = temp_root("names");

    for name in ["", "  ", "a/b", "..", ".hidden", "-flag", "a b", "tail."] {
        let result = create_project_folder(parent.to_str().unwrap(), name);
        assert!(
            matches!(result, Err(RepoInitError::InvalidName(_))),
            "{name:?} should be refused"
        );
    }
    assert_eq!(std::fs::read_dir(&parent).unwrap().count(), 0);
    std::fs::remove_dir_all(&parent).unwrap();
}

#[test]
fn folder_names_allow_letters_numbers_dashes_dots_and_underscores() {
    assert!(is_valid_folder_name("ledger-core"));
    assert!(is_valid_folder_name("game_2.0"));
    assert!(!is_valid_folder_name(&"a".repeat(65)));
}
