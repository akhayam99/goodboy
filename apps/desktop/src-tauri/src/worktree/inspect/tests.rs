use super::inspect_worktree_with;
use crate::worktree::git::git;
use crate::worktree::types::WorktreeInspection;
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

#[test]
fn inspection_distinguishes_registered_missing_foreign_and_unavailable() {
    let root = init_repo("inspect");
    let target = add_worktree(&root, "registered");
    let foreign = root.join("foreign");
    let missing = root.join("missing");
    let unavailable = root.join("unavailable");
    std::fs::create_dir_all(&foreign).unwrap();
    let mut run_git = |cwd: &Path, args: &[&str]| git(cwd, args);

    let registered = inspect_worktree_with(&root, &target, &mut run_git);
    let missing_result = inspect_worktree_with(&root, &missing, &mut run_git);
    let foreign_result = inspect_worktree_with(&root, &foreign, &mut run_git);
    let unavailable_result = inspect_worktree_with(&unavailable, &foreign, &mut run_git);

    assert!(matches!(registered, WorktreeInspection::Registered { .. }));
    assert!(matches!(missing_result, WorktreeInspection::Missing { .. }));
    assert!(matches!(
        foreign_result,
        WorktreeInspection::ForeignDirectory { .. }
    ));
    assert!(matches!(
        unavailable_result,
        WorktreeInspection::RepositoryUnavailable { .. }
    ));
}
