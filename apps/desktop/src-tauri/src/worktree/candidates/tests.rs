use super::{worktree_integrate_candidate_blocking, worktree_quarantine_candidate_blocking};
use crate::worktree::error::WorktreeError;
use crate::worktree::git::git;
use crate::worktree::types::{IntegrateCandidateArgs, QuarantineCandidateArgs};
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

fn head(root: &Path) -> String {
    git_ok(root, &["rev-parse", "HEAD"])
}

fn quarantine(root: &Path, id: &str, base: &str) -> Option<String> {
    worktree_quarantine_candidate_blocking(QuarantineCandidateArgs {
        worktree_path: root.to_string_lossy().into_owned(),
        candidate_id: id.to_string(),
        base_sha: base.to_string(),
    })
    .unwrap()
    .sha
}

fn integrate(
    root: &Path,
    id: &str,
    candidate: &str,
    expected: &str,
) -> Result<String, WorktreeError> {
    worktree_integrate_candidate_blocking(IntegrateCandidateArgs {
        worktree_path: root.to_string_lossy().into_owned(),
        candidate_id: id.to_string(),
        candidate_sha: candidate.to_string(),
        expected_head: expected.to_string(),
    })
    .map(|done| done.sha)
}

#[test]
fn quarantine_moves_the_branch_back_and_keeps_the_work_alive() {
    let root = init_repo("candidate-quarantine");
    let base = commit(&root, "base.txt", "base", "base");
    commit(&root, "fix.txt", "fix", "fix");
    std::fs::write(root.join("loose.txt"), "loose").unwrap();

    let candidate = quarantine(&root, "cand-1", &base).expect("a candidate was produced");

    assert_eq!(head(&root), base, "the branch tip still carries the work");
    assert!(!root.join("fix.txt").exists(), "the tree was not reset");
    assert_eq!(
        git_ok(&root, &["status", "--porcelain=v1"]),
        "",
        "the worktree is not clean"
    );
    assert_eq!(
        git_ok(&root, &["rev-parse", "refs/goodboy/candidates/cand-1"]),
        candidate,
        "the candidate ref does not hold the work"
    );
    assert!(
        git_ok(&root, &["show", &format!("{candidate}:loose.txt")]).contains("loose"),
        "uncommitted work was not captured into the candidate"
    );
}

#[test]
fn quarantine_reports_nothing_when_the_agent_produced_no_change() {
    let root = init_repo("candidate-quarantine-empty");
    let base = commit(&root, "base.txt", "base", "base");

    assert_eq!(quarantine(&root, "cand-empty", &base), None);
    assert_eq!(head(&root), base);
}

#[test]
fn integration_fast_forwards_the_branch_and_the_worktree() {
    let root = init_repo("candidate-integrate");
    let base = commit(&root, "base.txt", "base", "base");
    commit(&root, "fix.txt", "fix", "fix");
    let candidate = quarantine(&root, "cand-1", &base).unwrap();

    let integrated = integrate(&root, "cand-1", &candidate, &base).unwrap();

    assert_eq!(integrated, candidate);
    assert_eq!(head(&root), candidate);
    assert!(root.join("fix.txt").exists(), "the worktree was not synced");
}

#[test]
fn integration_cherry_picks_the_candidate_when_the_head_moved_forward() {
    let root = init_repo("candidate-head-moved");
    let base = commit(&root, "base.txt", "base", "base");
    commit(&root, "fix.txt", "fix", "fix");
    let candidate = quarantine(&root, "cand-1", &base).unwrap();
    let moved = commit(&root, "other.txt", "other", "external");

    let integrated = integrate(&root, "cand-1", &candidate, &base).unwrap();

    assert_ne!(integrated, candidate, "the candidate was not replayed");
    assert_eq!(head(&root), integrated);
    assert_eq!(
        git_ok(&root, &["rev-parse", "HEAD~1"]),
        moved,
        "the commit that moved the branch was lost"
    );
    assert!(root.join("fix.txt").exists(), "the fix is not in the tree");
    assert!(root.join("other.txt").exists(), "the external work is gone");
    assert_eq!(git_ok(&root, &["log", "-1", "--format=%s"]), "fix");
}

#[test]
fn a_replayed_cherry_pick_reports_the_integrated_commit() {
    let root = init_repo("candidate-pick-replay");
    let base = commit(&root, "base.txt", "base", "base");
    commit(&root, "fix.txt", "fix", "fix");
    let candidate = quarantine(&root, "cand-1", &base).unwrap();
    commit(&root, "other.txt", "other", "external");
    let first = integrate(&root, "cand-1", &candidate, &base).unwrap();

    let replayed = integrate(&root, "cand-1", &candidate, &base).unwrap();

    assert_eq!(replayed, first);
    assert_eq!(head(&root), first, "the replay picked the fix twice");
}

#[test]
fn integration_aborts_when_the_fix_no_longer_applies() {
    let root = init_repo("candidate-conflict");
    let base = commit(&root, "shared.txt", "base\n", "base");
    commit(&root, "shared.txt", "fix\n", "fix");
    let candidate = quarantine(&root, "cand-1", &base).unwrap();
    let moved = commit(&root, "shared.txt", "external\n", "external");

    let outcome = integrate(&root, "cand-1", &candidate, &base);

    let message = format!("{outcome:?}");
    assert!(message.contains("no longer applies"), "{message}");
    assert_eq!(head(&root), moved, "the branch was moved anyway");
    assert_eq!(
        git_ok(&root, &["status", "--porcelain=v1"]),
        "",
        "the aborted pick left the worktree dirty"
    );
    assert_eq!(
        std::fs::read_to_string(root.join("shared.txt")).unwrap(),
        "external\n"
    );
}

#[test]
fn integration_refuses_when_the_branch_was_rewritten_under_the_candidate() {
    let root = init_repo("candidate-rewritten");
    let base = commit(&root, "base.txt", "base", "base");
    commit(&root, "fix.txt", "fix", "fix");
    let candidate = quarantine(&root, "cand-1", &base).unwrap();
    git_ok(
        &root,
        &["commit", "--amend", "--no-verify", "-m", "rewritten"],
    );
    let rewritten = head(&root);

    let outcome = integrate(&root, "cand-1", &candidate, &base);

    assert!(outcome.is_err(), "{outcome:?}");
    assert_eq!(head(&root), rewritten, "the branch was moved anyway");
}

#[test]
fn a_replayed_integration_after_a_crash_does_not_integrate_twice() {
    let root = init_repo("candidate-replay");
    let base = commit(&root, "base.txt", "base", "base");
    commit(&root, "fix.txt", "fix", "fix");
    let candidate = quarantine(&root, "cand-1", &base).unwrap();
    integrate(&root, "cand-1", &candidate, &base).unwrap();
    let after_first = head(&root);
    let follow_up = commit(&root, "later.txt", "later", "later");

    let replayed = integrate(&root, "cand-1", &candidate, &base).unwrap();

    assert_eq!(replayed, candidate, "the replay reported another commit");
    assert_eq!(after_first, candidate);
    assert_eq!(head(&root), follow_up, "the replay moved the branch");
    assert_eq!(
        git_ok(&root, &["rev-list", "--count", &format!("{base}..HEAD")]),
        "2",
        "the candidate was integrated twice"
    );
}

fn forget_integration(root: &Path, id: &str, candidate: &str) {
    let dir = root.join(".git").join("goodboy-candidate-integrations");
    std::fs::remove_file(dir.join(format!("{id}.journal"))).unwrap();
    std::fs::write(dir.join(format!("{id}.picking")), format!("{candidate}\n")).unwrap();
}

#[test]
fn a_retry_after_a_crash_past_the_cherry_pick_records_it_without_picking_again() {
    let root = init_repo("candidate-pick-crash");
    let base = commit(&root, "base.txt", "base", "base");
    commit(&root, "fix.txt", "fix", "fix");
    commit(&root, "test.txt", "test", "test");
    let candidate = quarantine(&root, "cand-1", &base).unwrap();
    commit(&root, "other.txt", "other", "external");
    let picked = integrate(&root, "cand-1", &candidate, &base).unwrap();
    forget_integration(&root, "cand-1", &candidate);
    let later = commit(&root, "later.txt", "later", "later");

    let retried = integrate(&root, "cand-1", &candidate, &base).unwrap();

    assert_eq!(retried, picked, "the retry reported another commit");
    assert_eq!(head(&root), later, "the retry moved the branch");
    assert_eq!(
        git_ok(&root, &["rev-list", "--count", &format!("{base}..HEAD")]),
        "4",
        "the fix was picked twice"
    );
    assert_eq!(
        integrate(&root, "cand-1", &candidate, &base).unwrap(),
        picked,
        "the retry did not record the integration"
    );
}

#[test]
fn a_retry_after_a_crash_still_refuses_a_fix_that_no_longer_applies() {
    let root = init_repo("candidate-pick-crash-conflict");
    let base = commit(&root, "shared.txt", "base\n", "base");
    commit(&root, "shared.txt", "fix\n", "fix");
    let candidate = quarantine(&root, "cand-1", &base).unwrap();
    let moved = commit(&root, "shared.txt", "external\n", "external");
    let dir = root.join(".git").join("goodboy-candidate-integrations");
    std::fs::create_dir_all(&dir).unwrap();
    std::fs::write(dir.join("cand-1.picking"), format!("{candidate}\n")).unwrap();

    let outcome = integrate(&root, "cand-1", &candidate, &base);

    let message = format!("{outcome:?}");
    assert!(message.contains("no longer applies"), "{message}");
    assert_eq!(head(&root), moved, "the branch was moved anyway");
    assert_eq!(git_ok(&root, &["status", "--porcelain=v1"]), "");
    assert!(
        !dir.join("cand-1.journal").exists(),
        "a refused fix was recorded"
    );
}

#[test]
fn a_journal_naming_another_commit_is_refused() {
    let root = init_repo("candidate-journal-mismatch");
    let base = commit(&root, "base.txt", "base", "base");
    commit(&root, "fix.txt", "fix", "fix");
    let first = quarantine(&root, "cand-1", &base).unwrap();
    integrate(&root, "cand-1", &first, &base).unwrap();
    commit(&root, "second.txt", "second", "second");
    let second = quarantine(&root, "cand-1", &first).unwrap();

    let outcome = integrate(&root, "cand-1", &second, &first);

    assert!(outcome.is_err(), "{outcome:?}");
    assert_eq!(head(&root), first);
}

#[test]
fn a_deferred_candidate_never_becomes_reachable_from_the_tip() {
    let root = init_repo("candidate-deferred");
    let base = commit(&root, "base.txt", "base", "base");
    commit(&root, "a.txt", "a", "a");
    let accepted = quarantine(&root, "cand-a", &base).unwrap();
    integrate(&root, "cand-a", &accepted, &base).unwrap();
    commit(&root, "b.txt", "b", "b");
    let deferred = quarantine(&root, "cand-b", &accepted).unwrap();

    assert_eq!(head(&root), accepted);
    assert!(
        git(
            &root,
            &["merge-base", "--is-ancestor", &deferred, &accepted]
        )
        .is_err(),
        "the deferred candidate is reachable from the branch tip"
    );
    assert!(!root.join("b.txt").exists(), "deferred work is in the tree");
}
