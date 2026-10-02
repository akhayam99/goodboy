use super::{link_remote, publish_main, LinkedRemote, PublishError, PublishOutcome, PublishStep};
use crate::worktree::git;
use std::path::{Path, PathBuf};
use std::time::Duration;

fn temp_root(name: &str) -> PathBuf {
    let root = std::env::temp_dir().join(format!(
        "goodboy-publish-{name}-{}-{}",
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

fn local_repo(root: &Path) -> PathBuf {
    let repo = root.join("work");
    std::fs::create_dir_all(&repo).unwrap();
    git_ok(&repo, &["init", "-b", "main"]);
    git_ok(&repo, &["config", "user.email", "test@example.com"]);
    git_ok(&repo, &["config", "user.name", "test"]);
    git_ok(&repo, &["config", "commit.gpgsign", "false"]);
    std::fs::write(repo.join("a.txt"), "a").unwrap();
    git_ok(&repo, &["add", "a.txt"]);
    git_ok(&repo, &["commit", "-m", "first"]);
    repo
}

fn bare_remote(root: &Path) -> PathBuf {
    let remote = root.join("remote.git");
    git_ok(
        root,
        &["init", "--bare", "-b", "main", remote.to_str().unwrap()],
    );
    remote
}

fn add_origin(repo: &Path, url: &str) {
    git_ok(repo, &["remote", "add", "origin", url]);
}

fn publish(repo: &Path) -> PublishOutcome {
    publish_main(repo.to_str().unwrap(), None, Duration::from_secs(30)).unwrap()
}

#[test]
fn publishing_pushes_main_with_upstream_and_sets_the_remote_head() {
    let root = temp_root("push");
    let repo = local_repo(&root);
    let remote = bare_remote(&root);
    add_origin(&repo, remote.to_str().unwrap());
    let head = git_ok(&repo, &["rev-parse", "HEAD"]);

    let outcome = publish(&repo);

    assert_eq!(
        outcome,
        PublishOutcome::Published {
            branch: "main".to_string(),
            sha: head.clone(),
        }
    );
    assert_eq!(git_ok(&remote, &["rev-parse", "main"]), head);
    assert_eq!(
        git_ok(&repo, &["rev-parse", "--abbrev-ref", "main@{upstream}"]),
        "origin/main"
    );
    assert_eq!(
        git_ok(&repo, &["symbolic-ref", "refs/remotes/origin/HEAD"]),
        "refs/remotes/origin/main"
    );
    std::fs::remove_dir_all(&root).unwrap();
}

#[test]
fn a_remote_that_already_has_main_is_never_pushed_to() {
    let root = temp_root("clash");
    let repo = local_repo(&root);
    let remote = bare_remote(&root);
    let other = root.join("other");
    git_ok(
        &root,
        &[
            "clone",
            "--quiet",
            remote.to_str().unwrap(),
            other.to_str().unwrap(),
        ],
    );
    git_ok(&other, &["config", "user.email", "test@example.com"]);
    git_ok(&other, &["config", "user.name", "test"]);
    git_ok(&other, &["config", "commit.gpgsign", "false"]);
    git_ok(&other, &["checkout", "-b", "main"]);
    std::fs::write(other.join("readme.md"), "theirs").unwrap();
    git_ok(&other, &["add", "readme.md"]);
    git_ok(&other, &["commit", "-m", "theirs"]);
    git_ok(&other, &["push", "--quiet", "origin", "main"]);
    let theirs = git_ok(&remote, &["rev-parse", "main"]);
    add_origin(&repo, remote.to_str().unwrap());

    let outcome = publish(&repo);

    assert_eq!(
        outcome,
        PublishOutcome::RemoteHasMain {
            branch: "main".to_string()
        }
    );
    assert_eq!(git_ok(&remote, &["rev-parse", "main"]), theirs);
    std::fs::remove_dir_all(&root).unwrap();
}

#[test]
fn a_project_without_origin_reports_no_remote() {
    let root = temp_root("noremote");
    let repo = local_repo(&root);

    assert_eq!(publish(&repo), PublishOutcome::NoRemote);
    std::fs::remove_dir_all(&root).unwrap();
}

#[test]
fn a_repository_without_a_commit_has_nothing_to_publish() {
    let root = temp_root("unborn");
    let repo = root.join("work");
    std::fs::create_dir_all(&repo).unwrap();
    git_ok(&repo, &["init", "-b", "main"]);

    assert_eq!(publish(&repo), PublishOutcome::NothingToPublish);
    std::fs::remove_dir_all(&root).unwrap();
}

#[test]
fn a_feature_branch_is_never_published_as_main() {
    let root = temp_root("feature");
    let repo = local_repo(&root);
    git_ok(&repo, &["checkout", "-b", "feat/side"]);

    let outcome = publish(&repo);

    assert!(matches!(
        outcome,
        PublishOutcome::Failed {
            step: PublishStep::Check,
            ..
        }
    ));
    std::fs::remove_dir_all(&root).unwrap();
}

#[test]
fn an_unreadable_remote_fails_at_the_check_step() {
    let root = temp_root("broken");
    let repo = local_repo(&root);
    add_origin(&repo, root.join("missing.git").to_str().unwrap());

    assert!(matches!(
        publish(&repo),
        PublishOutcome::Failed {
            step: PublishStep::Check,
            ..
        }
    ));
    std::fs::remove_dir_all(&root).unwrap();
}

#[test]
fn linking_adds_origin_once_and_is_idempotent_for_the_same_address() {
    let root = temp_root("link");
    let repo = local_repo(&root);
    let url = "https://example.com/dana/cascadia.git";

    let first = link_remote(repo.to_str().unwrap(), url).unwrap();
    let second = link_remote(repo.to_str().unwrap(), url).unwrap();

    assert_eq!(
        first,
        LinkedRemote {
            remote_url: url.to_string(),
            added: true
        }
    );
    assert_eq!(
        second,
        LinkedRemote {
            remote_url: url.to_string(),
            added: false
        }
    );
    std::fs::remove_dir_all(&root).unwrap();
}

#[test]
fn linking_a_different_address_over_an_existing_origin_is_refused() {
    let root = temp_root("other");
    let repo = local_repo(&root);
    add_origin(&repo, "https://example.com/dana/cascadia.git");

    let result = link_remote(repo.to_str().unwrap(), "https://example.com/a/b.git");

    assert!(matches!(result, Err(PublishError::RemoteExists(_))));
    std::fs::remove_dir_all(&root).unwrap();
}

#[test]
fn linking_refuses_unsupported_addresses() {
    let root = temp_root("invalid");
    let repo = local_repo(&root);

    assert!(matches!(
        link_remote(repo.to_str().unwrap(), "--upload-pack=x"),
        Err(PublishError::InvalidRemote(_))
    ));
    std::fs::remove_dir_all(&root).unwrap();
}
