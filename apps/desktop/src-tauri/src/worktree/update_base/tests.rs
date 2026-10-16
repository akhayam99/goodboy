use super::checkout_update_base_blocking;
use crate::worktree::error::WorktreeError;
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

fn commit(root: &Path, file: &str, body: &str, message: &str) {
    std::fs::write(root.join(file), body).unwrap();
    git_ok(root, &["add", file]);
    git_ok(root, &["commit", "-m", message]);
}

struct Fixture {
    origin: PathBuf,
    copy: PathBuf,
    parent: PathBuf,
}

fn fixture(name: &str) -> Fixture {
    let origin = temp_root(name);
    git_ok(&origin, &["init", "-b", "main"]);
    git_ok(&origin, &["config", "user.email", "test@example.com"]);
    git_ok(&origin, &["config", "user.name", "test"]);
    git_ok(&origin, &["config", "commit.gpgsign", "false"]);
    commit(&origin, "base.txt", "base", "base");
    let remote = origin.join("remote.git");
    git_ok(&origin, &["init", "--bare", remote.to_str().unwrap()]);
    git_ok(
        &origin,
        &["remote", "add", "origin", remote.to_str().unwrap()],
    );
    git_ok(&origin, &["push", "-u", "origin", "main"]);
    let parent = temp_root(&format!("{name}-clone"));
    let copy = parent.join("copy");
    git_ok(
        &parent,
        &["clone", remote.to_str().unwrap(), copy.to_str().unwrap()],
    );
    git_ok(&copy, &["config", "user.email", "test@example.com"]);
    git_ok(&copy, &["config", "user.name", "test"]);
    git_ok(&copy, &["config", "commit.gpgsign", "false"]);
    Fixture {
        origin,
        copy,
        parent,
    }
}

fn clean_up(fixture: Fixture) {
    std::fs::remove_dir_all(fixture.origin).unwrap();
    std::fs::remove_dir_all(fixture.parent).unwrap();
}

fn push_new_commit(fixture: &Fixture) {
    commit(&fixture.origin, "next.txt", "next", "next");
    git_ok(&fixture.origin, &["push", "origin", "main"]);
}

fn path_of(fixture: &Fixture) -> String {
    fixture.copy.to_string_lossy().into_owned()
}

#[test]
fn updates_main_without_leaving_the_feature_checkout() {
    let fixture = fixture("update-base-feature");
    git_ok(&fixture.copy, &["checkout", "-b", "mara/ledger-export"]);
    commit(&fixture.copy, "wip.txt", "wip", "feature work");
    push_new_commit(&fixture);

    let result =
        checkout_update_base_blocking(path_of(&fixture), Some("main".to_string()), None).unwrap();

    assert_eq!(result.base, "main");
    assert_eq!(
        result.checkout_branch.as_deref(),
        Some("mara/ledger-export")
    );
    assert_eq!(result.commits_pulled, 1);
    assert_eq!(
        git_ok(&fixture.copy, &["rev-parse", "--abbrev-ref", "HEAD"]),
        "mara/ledger-export"
    );
    assert_eq!(
        git_ok(&fixture.copy, &["rev-parse", "main"]),
        git_ok(&fixture.origin, &["rev-parse", "HEAD"])
    );
    clean_up(fixture);
}

#[test]
fn fast_forwards_the_checkout_that_is_already_on_the_base_branch() {
    let fixture = fixture("update-base-on-main");
    push_new_commit(&fixture);

    let result =
        checkout_update_base_blocking(path_of(&fixture), Some("main".to_string()), None).unwrap();

    assert_eq!(result.checkout_branch.as_deref(), Some("main"));
    assert_eq!(result.commits_pulled, 1);
    assert!(fixture.copy.join("next.txt").is_file());
    clean_up(fixture);
}

#[test]
fn falls_back_to_the_remote_default_branch_when_none_is_named() {
    let fixture = fixture("update-base-default");
    git_ok(&fixture.copy, &["checkout", "-b", "mara/ledger-export"]);
    push_new_commit(&fixture);

    let result = checkout_update_base_blocking(path_of(&fixture), None, None).unwrap();

    assert_eq!(result.base, "main");
    assert_eq!(result.commits_pulled, 1);
    clean_up(fixture);
}

#[test]
fn refuses_when_the_base_branch_is_checked_out_in_another_worktree() {
    let fixture = fixture("update-base-elsewhere");
    git_ok(&fixture.copy, &["checkout", "-b", "mara/ledger-export"]);
    let other = fixture.parent.join("other");
    git_ok(
        &fixture.copy,
        &["worktree", "add", other.to_str().unwrap(), "main"],
    );
    push_new_commit(&fixture);
    let before = git_ok(&fixture.copy, &["rev-parse", "main"]);

    let refusal = checkout_update_base_blocking(path_of(&fixture), Some("main".to_string()), None)
        .unwrap_err();

    assert!(matches!(refusal, WorktreeError::Git { .. }));
    assert_eq!(git_ok(&fixture.copy, &["rev-parse", "main"]), before);
    clean_up(fixture);
}

#[test]
fn refuses_a_base_branch_that_cannot_fast_forward() {
    let fixture = fixture("update-base-diverged");
    commit(&fixture.copy, "local.txt", "local", "local only");
    git_ok(&fixture.copy, &["checkout", "-b", "mara/ledger-export"]);
    push_new_commit(&fixture);
    let before = git_ok(&fixture.copy, &["rev-parse", "main"]);

    let refusal = checkout_update_base_blocking(path_of(&fixture), Some("main".to_string()), None)
        .unwrap_err();

    assert!(matches!(refusal, WorktreeError::Git { .. }));
    assert_eq!(git_ok(&fixture.copy, &["rev-parse", "main"]), before);
    clean_up(fixture);
}

#[test]
fn reports_a_repository_without_a_base_branch() {
    let root = temp_root("update-base-none");
    git_ok(&root, &["init", "-b", "main"]);

    let refusal =
        checkout_update_base_blocking(root.to_string_lossy().into_owned(), None, None).unwrap_err();

    assert!(format!("{refusal}").contains("no base branch"));
    std::fs::remove_dir_all(root).unwrap();
}
