use super::{is_safe_branch_name, parse_head_listing, probe_with, HeadListing, RemoteProbe};
use crate::worktree::git;
use std::path::{Path, PathBuf};
use std::time::Duration;

const SHA: &str = "0123456789abcdef0123456789abcdef01234567";

fn temp_root(name: &str) -> PathBuf {
    let root = std::env::temp_dir().join(format!(
        "goodboy-probe-{name}-{}-{}",
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

fn bare_remote(root: &Path, head: &str) -> PathBuf {
    let remote = root.join("remote.git");
    git_ok(
        root,
        &["init", "--bare", "-b", head, remote.to_str().unwrap()],
    );
    remote
}

fn link(repo: &Path, remote: &Path) {
    git_ok(repo, &["remote", "add", "origin", remote.to_str().unwrap()]);
}

fn probe(repo: &Path) -> RemoteProbe {
    probe_with(repo, None, Duration::from_secs(30))
}

#[test]
fn a_repository_without_origin_has_no_remote() {
    let root = temp_root("none");
    let repo = local_repo(&root);

    assert_eq!(probe(&repo), RemoteProbe::NoRemote);
    std::fs::remove_dir_all(&root).unwrap();
}

#[test]
fn a_folder_that_is_not_a_repository_has_no_remote() {
    let root = temp_root("folder");

    assert_eq!(probe(&root), RemoteProbe::NoRemote);
    std::fs::remove_dir_all(&root).unwrap();
}

#[test]
fn an_empty_remote_is_reachable_without_main() {
    let root = temp_root("empty");
    let repo = local_repo(&root);
    let remote = bare_remote(&root, "main");
    link(&repo, &remote);

    assert_eq!(probe(&repo), RemoteProbe::ReachableNoMain);
    std::fs::remove_dir_all(&root).unwrap();
}

#[test]
fn a_remote_with_main_is_fetched_verified_and_set_as_head() {
    let root = temp_root("main");
    let repo = local_repo(&root);
    let remote = bare_remote(&root, "main");
    link(&repo, &remote);
    git_ok(&repo, &["push", "--quiet", "origin", "main"]);
    let head = git_ok(&repo, &["rev-parse", "HEAD"]);
    git_ok(&repo, &["update-ref", "-d", "refs/remotes/origin/main"]);

    assert_eq!(
        probe(&repo),
        RemoteProbe::MainPresent {
            branch: "main".to_string(),
            sha: head,
        }
    );
    assert_eq!(
        git_ok(&repo, &["symbolic-ref", "refs/remotes/origin/HEAD"]),
        "refs/remotes/origin/main"
    );
    std::fs::remove_dir_all(&root).unwrap();
}

#[test]
fn master_as_the_remote_head_is_read_from_the_symref() {
    let root = temp_root("master");
    let repo = local_repo(&root);
    let remote = bare_remote(&root, "master");
    link(&repo, &remote);
    git_ok(&repo, &["push", "--quiet", "origin", "main:master"]);

    let outcome = probe(&repo);

    assert!(matches!(
        outcome,
        RemoteProbe::MainPresent { ref branch, .. } if branch == "master"
    ));
    std::fs::remove_dir_all(&root).unwrap();
}

#[test]
fn an_unreadable_remote_is_unreachable() {
    let root = temp_root("gone");
    let repo = local_repo(&root);
    link(&repo, &root.join("missing.git"));

    assert!(matches!(probe(&repo), RemoteProbe::Unreachable { .. }));
    std::fs::remove_dir_all(&root).unwrap();
}

#[test]
fn a_remote_that_does_not_answer_in_time_is_unreachable() {
    let root = temp_root("slow");
    let repo = local_repo(&root);
    let remote = bare_remote(&root, "main");
    link(&repo, &remote);
    git_ok(&repo, &["push", "--quiet", "origin", "main"]);

    let outcome = probe_with(&repo, None, Duration::from_millis(1));

    assert!(matches!(outcome, RemoteProbe::Unreachable { .. }));
    std::fs::remove_dir_all(&root).unwrap();
}

#[test]
fn a_probe_changes_nothing_but_the_remote_tracking_state() {
    let root = temp_root("pure");
    let repo = local_repo(&root);
    let remote = bare_remote(&root, "main");
    link(&repo, &remote);
    git_ok(&repo, &["push", "--quiet", "origin", "main"]);
    let branch_before = git_ok(&repo, &["rev-parse", "main"]);
    std::fs::write(repo.join("dirty.txt"), "wip").unwrap();

    let _ = probe(&repo);

    assert_eq!(git_ok(&repo, &["rev-parse", "main"]), branch_before);
    assert_eq!(git_ok(&repo, &["status", "--porcelain"]), "?? dirty.txt");
    std::fs::remove_dir_all(&root).unwrap();
}

#[test]
fn the_head_listing_reads_the_symref_and_the_sha() {
    let stdout = format!("ref: refs/heads/trunk\tHEAD\n{SHA}\tHEAD\n{SHA}\trefs/heads/trunk\n");

    assert_eq!(
        parse_head_listing(&stdout),
        HeadListing {
            symref: Some("trunk".to_string()),
            sha: Some(SHA.to_string()),
        }
    );
}

#[test]
fn an_unborn_head_has_a_symref_and_no_sha() {
    assert_eq!(
        parse_head_listing("ref: refs/heads/main\tHEAD\n"),
        HeadListing {
            symref: Some("main".to_string()),
            sha: None,
        }
    );
}

#[test]
fn branch_names_that_could_act_as_options_are_refused() {
    assert!(is_safe_branch_name("main"));
    assert!(is_safe_branch_name("release/1.2"));
    assert!(!is_safe_branch_name("--upload-pack=x"));
    assert!(!is_safe_branch_name("a b"));
    assert!(!is_safe_branch_name("a..b"));
    assert!(!is_safe_branch_name(""));
}
