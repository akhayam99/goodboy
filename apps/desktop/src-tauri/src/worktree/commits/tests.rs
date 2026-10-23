use super::{
    worktree_blame_line_blocking, worktree_commit_range_blocking,
    worktree_continue_rebase_blocking, worktree_rebase_conflicts_blocking,
    worktree_start_rebase_blocking, RangeCommit, RebaseConflictFile, RebaseStep,
};
use crate::worktree::git::git;
use crate::worktree::status::in_progress_operation;
use crate::worktree::types::GitOperation;
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

fn diverged_repo(name: &str) -> (PathBuf, String) {
    let root = init_repo(name);
    commit(&root, "page.css", "base\n", "base");
    git_ok(&root, &["checkout", "-b", "feature"]);
    let before = commit(&root, "page.css", "feature\n", "Center the members page");
    git_ok(&root, &["checkout", "main"]);
    commit(&root, "page.css", "main\n", "Tighten the page grid");
    git_ok(&root, &["checkout", "feature"]);
    (root, before)
}

fn path_of(root: &Path) -> String {
    root.to_string_lossy().into_owned()
}

#[test]
fn starting_a_rebase_stops_in_the_worktree_on_the_conflict() {
    let (root, _) = diverged_repo("start-rebase-conflict");

    let step = worktree_start_rebase_blocking(&path_of(&root), "main", "feature").unwrap();

    assert_eq!(
        step,
        RebaseStep {
            is_in_progress: true
        }
    );
    assert_eq!(in_progress_operation(&root), Some(GitOperation::Rebase));
    assert_eq!(
        worktree_rebase_conflicts_blocking(&path_of(&root)).unwrap(),
        vec![RebaseConflictFile {
            path: "page.css".to_string(),
            has_markers: true,
            is_stage_only: false
        }]
    );
    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn continue_refuses_while_a_file_still_has_conflict_markers() {
    let (root, _) = diverged_repo("continue-refuses");
    worktree_start_rebase_blocking(&path_of(&root), "main", "feature").unwrap();

    let refused = worktree_continue_rebase_blocking(&path_of(&root)).unwrap_err();

    assert!(
        refused.to_string().contains("1 file still conflict"),
        "{refused}"
    );
    assert_eq!(in_progress_operation(&root), Some(GitOperation::Rebase));
    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn continue_stages_the_resolved_file_and_finishes_the_rebase() {
    let (root, before) = diverged_repo("continue-finishes");
    worktree_start_rebase_blocking(&path_of(&root), "main", "feature").unwrap();
    std::fs::write(root.join("page.css"), "main\nfeature\n").unwrap();

    assert_eq!(
        worktree_rebase_conflicts_blocking(&path_of(&root)).unwrap(),
        vec![RebaseConflictFile {
            path: "page.css".to_string(),
            has_markers: false,
            is_stage_only: false
        }]
    );
    let step = worktree_continue_rebase_blocking(&path_of(&root)).unwrap();

    assert_eq!(
        step,
        RebaseStep {
            is_in_progress: false
        }
    );
    assert_eq!(in_progress_operation(&root), None);
    let head = git_ok(&root, &["rev-parse", "HEAD"]);
    assert_ne!(head, before);
    assert_eq!(
        git_ok(&root, &["log", "-1", "--format=%s"]),
        "Center the members page"
    );
    assert_eq!(
        git_ok(&root, &["rev-parse", "HEAD~1"]),
        git_ok(&root, &["rev-parse", "main"])
    );
    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn continue_refuses_when_no_rebase_is_stopped() {
    let (root, _) = diverged_repo("continue-no-rebase");

    assert!(worktree_continue_rebase_blocking(&path_of(&root)).is_err());
    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn starting_a_clean_rebase_finishes_it_at_once() {
    let root = init_repo("start-rebase-clean");
    commit(&root, "base.txt", "base\n", "base");
    git_ok(&root, &["checkout", "-b", "feature"]);
    commit(&root, "members.css", "feature\n", "Center the members page");
    git_ok(&root, &["checkout", "main"]);
    commit(&root, "grid.css", "main\n", "Tighten the page grid");
    git_ok(&root, &["checkout", "feature"]);

    let step = worktree_start_rebase_blocking(&path_of(&root), "main", "feature").unwrap();

    assert_eq!(
        step,
        RebaseStep {
            is_in_progress: false
        }
    );
    assert_eq!(
        git_ok(&root, &["rev-parse", "HEAD~1"]),
        git_ok(&root, &["rev-parse", "main"])
    );
    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn starting_a_rebase_refuses_an_option_as_the_base_and_a_second_rebase() {
    let (root, _) = diverged_repo("start-rebase-refuses");

    assert!(worktree_start_rebase_blocking(&path_of(&root), "--exec=true", "feature").is_err());
    worktree_start_rebase_blocking(&path_of(&root), "main", "feature").unwrap();
    assert!(worktree_start_rebase_blocking(&path_of(&root), "main", "feature").is_err());
    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn starting_a_rebase_refuses_a_worktree_now_on_another_branch() {
    let (root, before) = diverged_repo("start-rebase-other-branch");
    git_ok(&root, &["checkout", "-b", "ledger-core"]);

    let refused = worktree_start_rebase_blocking(&path_of(&root), "main", "feature").unwrap_err();

    assert!(
        refused
            .to_string()
            .contains("this worktree is on ledger-core, not feature"),
        "{refused}"
    );
    assert_eq!(in_progress_operation(&root), None);
    assert_eq!(git_ok(&root, &["rev-parse", "HEAD"]), before);
    std::fs::remove_dir_all(root).unwrap();
}

fn modify_delete_repo(name: &str) -> PathBuf {
    let root = init_repo(name);
    commit(&root, "page.css", "base\n", "base");
    git_ok(&root, &["checkout", "-b", "feature"]);
    commit(&root, "page.css", "feature\n", "Center the members page");
    git_ok(&root, &["checkout", "main"]);
    git_ok(&root, &["rm", "-q", "page.css"]);
    git_ok(&root, &["commit", "--no-verify", "-m", "Drop the page"]);
    git_ok(&root, &["checkout", "feature"]);
    root
}

fn binary_repo(name: &str) -> PathBuf {
    let root = init_repo(name);
    commit(&root, "logo.bin", "base\0\n", "base");
    git_ok(&root, &["checkout", "-b", "feature"]);
    commit(&root, "logo.bin", "feature\0\n", "Recolor the logo");
    git_ok(&root, &["checkout", "main"]);
    commit(&root, "logo.bin", "main\0\n", "Shrink the logo");
    git_ok(&root, &["checkout", "feature"]);
    root
}

#[test]
fn a_modify_delete_conflict_needs_a_stage_and_blocks_continue() {
    let root = modify_delete_repo("modify-delete");
    worktree_start_rebase_blocking(&path_of(&root), "main", "feature").unwrap();

    assert_eq!(
        worktree_rebase_conflicts_blocking(&path_of(&root)).unwrap(),
        vec![RebaseConflictFile {
            path: "page.css".to_string(),
            has_markers: false,
            is_stage_only: true
        }]
    );
    let refused = worktree_continue_rebase_blocking(&path_of(&root)).unwrap_err();
    assert!(
        refused.to_string().contains("1 file still conflict"),
        "{refused}"
    );

    git_ok(&root, &["rm", "-q", "page.css"]);
    assert_eq!(
        worktree_rebase_conflicts_blocking(&path_of(&root)).unwrap(),
        vec![]
    );
    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn a_binary_conflict_needs_a_stage_until_the_file_is_added() {
    let root = binary_repo("binary-conflict");
    worktree_start_rebase_blocking(&path_of(&root), "main", "feature").unwrap();

    assert_eq!(
        worktree_rebase_conflicts_blocking(&path_of(&root)).unwrap(),
        vec![RebaseConflictFile {
            path: "logo.bin".to_string(),
            has_markers: false,
            is_stage_only: true
        }]
    );
    assert!(worktree_continue_rebase_blocking(&path_of(&root)).is_err());

    git_ok(&root, &["add", "logo.bin"]);
    let step = worktree_continue_rebase_blocking(&path_of(&root)).unwrap();
    assert_eq!(
        step,
        RebaseStep {
            is_in_progress: false
        }
    );
    std::fs::remove_dir_all(root).unwrap();
}
