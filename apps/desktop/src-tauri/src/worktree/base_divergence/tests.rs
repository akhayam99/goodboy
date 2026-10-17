use super::{base_divergence_with, coalesced, fetch_base_remote, BaseDivergence, DivergenceState};
use crate::worktree::git::git;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::Arc;
use std::time::Duration;

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

fn configure(root: &Path) {
    git_ok(root, &["config", "user.email", "test@example.com"]);
    git_ok(root, &["config", "user.name", "test"]);
    git_ok(root, &["config", "commit.gpgsign", "false"]);
}

struct Fixture {
    origin: PathBuf,
    remote: PathBuf,
    copy: PathBuf,
    parent: PathBuf,
}

fn fixture(name: &str) -> Fixture {
    let origin = temp_root(name);
    git_ok(&origin, &["init", "-b", "main"]);
    configure(&origin);
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
    configure(&copy);
    Fixture {
        origin,
        remote,
        copy,
        parent,
    }
}

fn clean_up(fixture: Fixture) {
    std::fs::remove_dir_all(fixture.origin).unwrap();
    std::fs::remove_dir_all(fixture.parent).unwrap();
}

fn push_new_commit(fixture: &Fixture, file: &str) {
    commit(&fixture.origin, file, file, file);
    git_ok(&fixture.origin, &["push", "origin", "main"]);
}

fn check(fixture: &Fixture) -> BaseDivergence {
    let path = fixture.copy.to_string_lossy().into_owned();
    let mut fetch = |remote: &str| fetch_base_remote(&path, remote, None);
    base_divergence_with(&fixture.copy, Some("main".to_string()), &mut fetch)
}

#[test]
fn reports_up_to_date_after_fetching() {
    let fixture = fixture("divergence-up-to-date");

    let report = check(&fixture);

    assert_eq!(report.state, DivergenceState::UpToDate);
    assert_eq!(report.base.as_deref(), Some("main"));
    assert_eq!(report.upstream.as_deref(), Some("origin/main"));
    assert_eq!((report.ahead, report.behind), (0, 0));
    clean_up(fixture);
}

#[test]
fn reports_behind_without_touching_local_main() {
    let fixture = fixture("divergence-behind");
    push_new_commit(&fixture, "one.txt");
    push_new_commit(&fixture, "two.txt");
    push_new_commit(&fixture, "three.txt");
    let before = git_ok(&fixture.copy, &["rev-parse", "refs/heads/main"]);

    let report = check(&fixture);

    assert_eq!(report.state, DivergenceState::Behind);
    assert_eq!(report.behind, 3);
    assert_eq!(report.ahead, 0);
    assert_eq!(
        git_ok(&fixture.copy, &["rev-parse", "refs/heads/main"]),
        before
    );
    assert!(!fixture.copy.join("one.txt").exists());
    clean_up(fixture);
}

#[test]
fn reports_diverged_when_local_main_has_commits_of_its_own() {
    let fixture = fixture("divergence-diverged");
    commit(&fixture.copy, "local.txt", "local", "local only");
    push_new_commit(&fixture, "remote.txt");

    let report = check(&fixture);

    assert_eq!(report.state, DivergenceState::Diverged);
    assert_eq!((report.ahead, report.behind), (1, 1));
    clean_up(fixture);
}

#[test]
fn reports_ahead_when_only_local_main_moved() {
    let fixture = fixture("divergence-ahead");
    commit(&fixture.copy, "local.txt", "local", "local only");

    let report = check(&fixture);

    assert_eq!(report.state, DivergenceState::Ahead);
    assert_eq!((report.ahead, report.behind), (1, 0));
    clean_up(fixture);
}

#[test]
fn names_the_feature_checkout_and_its_uncommitted_files() {
    let fixture = fixture("divergence-feature");
    git_ok(&fixture.copy, &["checkout", "-b", "mara/ledger-export"]);
    std::fs::write(fixture.copy.join("base.txt"), "edited").unwrap();
    push_new_commit(&fixture, "next.txt");

    let report = check(&fixture);

    assert_eq!(report.state, DivergenceState::Behind);
    assert_eq!(
        report.checkout_branch.as_deref(),
        Some("mara/ledger-export")
    );
    assert_eq!(report.uncommitted, 1);
    assert_eq!(
        git_ok(&fixture.copy, &["rev-parse", "--abbrev-ref", "HEAD"]),
        "mara/ledger-export"
    );
    clean_up(fixture);
}

#[test]
fn keeps_remote_branches_that_are_gone_because_it_never_prunes() {
    let fixture = fixture("divergence-no-prune");
    git_ok(&fixture.origin, &["push", "origin", "main:old-topic"]);
    git_ok(&fixture.copy, &["fetch", "origin"]);
    git_ok(
        &fixture.origin,
        &["push", "origin", "--delete", "old-topic"],
    );

    let report = check(&fixture);

    assert_eq!(report.state, DivergenceState::UpToDate);
    assert!(!git_ok(
        &fixture.copy,
        &["rev-parse", "--verify", "refs/remotes/origin/old-topic"]
    )
    .is_empty());
    clean_up(fixture);
}

#[test]
fn reports_a_fetch_failure_with_the_git_message() {
    let fixture = fixture("divergence-fetch-failed");
    std::fs::remove_dir_all(&fixture.remote).unwrap();

    let report = check(&fixture);

    assert_eq!(report.state, DivergenceState::FetchFailed);
    assert!(report.message.is_some_and(|message| !message.is_empty()));
    clean_up(fixture);
}

#[test]
fn reports_a_folder_that_is_not_a_repository() {
    let root = temp_root("divergence-missing");
    let mut fetch = |_: &str| Ok(());

    let report = base_divergence_with(&root.join("gone"), None, &mut fetch);

    assert_eq!(report.state, DivergenceState::Missing);
    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn reports_no_base_when_the_local_branch_is_absent() {
    let fixture = fixture("divergence-no-base");
    let mut fetch = |_: &str| Ok(());

    let report = base_divergence_with(&fixture.copy, Some("release".to_string()), &mut fetch);

    assert_eq!(report.state, DivergenceState::NoBase);
    assert_eq!(report.base.as_deref(), Some("release"));
    clean_up(fixture);
}

fn report_of(state: DivergenceState) -> BaseDivergence {
    BaseDivergence {
        state,
        base: Some("main".to_string()),
        upstream: Some("origin/main".to_string()),
        ahead: 0,
        behind: 0,
        checkout_branch: Some("main".to_string()),
        uncommitted: 0,
        message: None,
    }
}

#[test]
fn a_second_caller_during_a_check_waits_for_it_instead_of_fetching_again() {
    let key = format!("coalesce-in-flight-{}", std::process::id());
    let runs = Arc::new(AtomicU32::new(0));
    let threads: Vec<_> = (0..2)
        .map(|_| {
            let key = key.clone();
            let runs = Arc::clone(&runs);
            std::thread::spawn(move || {
                coalesced(&key, Duration::ZERO, || {
                    runs.fetch_add(1, Ordering::SeqCst);
                    std::thread::sleep(Duration::from_millis(300));
                    report_of(DivergenceState::Behind)
                })
            })
        })
        .collect();

    let reports: Vec<_> = threads
        .into_iter()
        .map(|thread| thread.join().unwrap())
        .collect();

    assert_eq!(runs.load(Ordering::SeqCst), 1);
    assert!(reports
        .iter()
        .all(|report| report.state == DivergenceState::Behind));
}

#[test]
fn a_fresh_answer_is_reused_and_a_forced_check_runs_again() {
    let key = format!("coalesce-fresh-{}", std::process::id());
    let runs = AtomicU32::new(0);
    let run = || {
        runs.fetch_add(1, Ordering::SeqCst);
        report_of(DivergenceState::UpToDate)
    };

    coalesced(&key, Duration::from_secs(300), run);
    coalesced(&key, Duration::from_secs(300), run);
    assert_eq!(runs.load(Ordering::SeqCst), 1);

    coalesced(&key, Duration::ZERO, run);
    assert_eq!(runs.load(Ordering::SeqCst), 2);
}
