use super::{
    worktree_integrate_candidate_blocking, worktree_quarantine_candidate_blocking,
    worktree_split_candidates_blocking,
};
use crate::worktree::error::WorktreeError;
use crate::worktree::git::git;
use crate::worktree::types::{
    IntegrateCandidateArgs, QuarantineCandidateArgs, SplitCandidatePick, SplitCandidatesArgs,
};
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
        stack: false,
    })
    .unwrap()
    .sha
}

fn quarantine_stacked(root: &Path, id: &str, base: &str) -> Option<String> {
    worktree_quarantine_candidate_blocking(QuarantineCandidateArgs {
        worktree_path: root.to_string_lossy().into_owned(),
        candidate_id: id.to_string(),
        base_sha: base.to_string(),
        stack: true,
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
    std::fs::write(root.join("base.txt"), "base edited").unwrap();

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
        git_ok(&root, &["show", &format!("{candidate}:base.txt")]).contains("base edited"),
        "an uncommitted edit to a tracked file was not captured into the candidate"
    );
}

#[test]
fn an_untracked_file_never_enters_a_candidate() {
    let root = init_repo("candidate-untracked");
    let base = commit(&root, "base.txt", "base", "base");
    std::fs::write(root.join("base.txt"), "base edited").unwrap();
    std::fs::write(root.join("loose.txt"), "loose").unwrap();

    let candidate = quarantine(&root, "cand-1", &base).expect("a candidate was produced");

    let files = git_ok(&root, &["ls-tree", "-r", "--name-only", &candidate]);
    assert!(!files.contains("loose.txt"), "{files}");
}

#[test]
fn a_candidate_made_only_of_untracked_files_is_empty() {
    let root = init_repo("candidate-only-untracked");
    let base = commit(&root, "base.txt", "base", "base");
    std::fs::write(root.join("loose.txt"), "loose").unwrap();

    assert_eq!(quarantine(&root, "cand-1", &base), None);
    assert_eq!(head(&root), base);
}

#[test]
fn a_staged_new_file_enters_a_candidate() {
    let root = init_repo("candidate-staged");
    let base = commit(&root, "base.txt", "base", "base");
    std::fs::write(root.join("added.txt"), "added").unwrap();
    git_ok(&root, &["add", "added.txt"]);

    let candidate = quarantine(&root, "cand-1", &base).expect("a candidate was produced");

    assert!(git_ok(&root, &["ls-tree", "-r", "--name-only", &candidate]).contains("added.txt"));
}

#[cfg(unix)]
fn link_dist(root: &Path, library: &str, target: &Path) {
    let dist = root.join("libraries").join(library).join("dist");
    std::fs::create_dir_all(dist.parent().unwrap()).unwrap();
    std::os::unix::fs::symlink(target, dist).unwrap();
}

#[cfg(unix)]
#[test]
fn symlinks_into_the_main_checkout_never_enter_a_candidate() {
    let root = init_repo("candidate-dist-symlinks");
    let main = temp_root("candidate-dist-main");
    std::fs::create_dir_all(main.join("libraries/ledger-core/dist")).unwrap();
    let base = commit(&root, "base.txt", "base", "base");
    std::fs::write(root.join("base.txt"), "base edited").unwrap();
    link_dist(
        &root,
        "ledger-core",
        &main.join("libraries/ledger-core/dist"),
    );
    link_dist(
        &root,
        "notify-relay",
        &main.join("libraries/notify-relay/dist"),
    );

    let candidate = quarantine(&root, "cand-1", &base).expect("a candidate was produced");

    let files = git_ok(&root, &["ls-tree", "-r", "--name-only", &candidate]);
    assert!(!files.contains("dist"), "{files}");
}

#[cfg(unix)]
#[test]
fn symlinks_the_agent_committed_itself_are_stripped_from_the_candidate() {
    let root = init_repo("candidate-committed-symlinks");
    let main = temp_root("candidate-committed-main");
    let base = commit(&root, "base.txt", "base", "base");
    commit(&root, "fix.txt", "fix", "fix the rounding");
    link_dist(
        &root,
        "ledger-core",
        &main.join("libraries/ledger-core/dist"),
    );
    git_ok(&root, &["add", "--all"]);
    git_ok(
        &root,
        &["commit", "--no-verify", "-m", "oops, add built output"],
    );
    commit(&root, "second.txt", "second", "second fix");

    let candidate = quarantine(&root, "cand-1", &base).expect("a candidate was produced");

    let files = git_ok(&root, &["ls-tree", "-r", "--name-only", &candidate]);
    assert!(!files.contains("dist"), "{files}");
    assert!(
        files.contains("fix.txt") && files.contains("second.txt"),
        "{files}"
    );
    assert_eq!(
        git_ok(
            &root,
            &["log", "--format=%s", &format!("{base}..{candidate}")]
        ),
        "second fix\nfix the rounding",
        "the agent's own commits were not kept as they were"
    );
}

#[test]
fn ignored_build_output_never_enters_a_candidate() {
    let root = init_repo("candidate-ignored");
    std::fs::write(root.join(".gitignore"), "dist/\n").unwrap();
    git_ok(&root, &["add", ".gitignore"]);
    let base = commit(&root, "base.txt", "base", "base");
    commit(&root, "fix.txt", "fix", "fix");
    std::fs::create_dir_all(root.join("dist")).unwrap();
    std::fs::write(root.join("dist/out.js"), "built").unwrap();
    git_ok(&root, &["add", "--force", "dist/out.js"]);
    git_ok(&root, &["commit", "--no-verify", "-m", "built output"]);

    let candidate = quarantine(&root, "cand-1", &base).expect("a candidate was produced");

    let files = git_ok(&root, &["ls-tree", "-r", "--name-only", &candidate]);
    assert!(!files.contains("dist/out.js"), "{files}");
    assert!(files.contains("fix.txt"), "{files}");
}

#[cfg(unix)]
#[test]
fn a_relative_link_inside_the_repository_is_kept() {
    let root = init_repo("candidate-inner-link");
    let base = commit(&root, "base.txt", "base", "base");
    std::os::unix::fs::symlink("base.txt", root.join("alias.txt")).unwrap();
    git_ok(&root, &["add", "alias.txt"]);
    git_ok(&root, &["commit", "--no-verify", "-m", "alias"]);

    let candidate = quarantine(&root, "cand-1", &base).expect("a candidate was produced");

    assert!(git_ok(&root, &["ls-tree", "-r", "--name-only", &candidate]).contains("alias.txt"));
}

#[test]
fn a_stacked_quarantine_leaves_the_copy_on_the_candidate_tip() {
    let root = init_repo("candidate-stacked");
    let base = commit(&root, "base.txt", "base", "base");
    commit(&root, "fix.txt", "fix", "fix");

    let candidate = quarantine_stacked(&root, "cand-1", &base).expect("a candidate");

    assert_eq!(head(&root), candidate, "the copy did not stay on the tip");
    assert_eq!(
        git_ok(&root, &["rev-parse", "refs/goodboy/candidates/cand-1"]),
        candidate
    );
    assert!(root.join("fix.txt").exists());
}

#[test]
fn a_second_stacked_quarantine_builds_on_the_first() {
    let root = init_repo("candidate-stacked-twice");
    let base = commit(&root, "base.txt", "base", "base");
    commit(&root, "a.txt", "a", "fix a");
    let first = quarantine_stacked(&root, "turn-1", &base).unwrap();
    commit(&root, "b.txt", "b", "fix b");

    let second = quarantine_stacked(&root, "turn-2", &first).unwrap();

    assert_eq!(
        git_ok(&root, &["rev-parse", &format!("{second}~1")]),
        first,
        "the second candidate is not stacked on the first"
    );
}

#[test]
fn stacked_splitting_gives_each_commit_its_own_candidate_in_commit_order() {
    let root = init_repo("candidate-split-stacked");
    let base = commit(&root, "base.txt", "base", "base");
    let first = commit(&root, "a.txt", "a", "fix a");
    let second = commit(&root, "b.txt", "b", "fix b");
    let third = commit(&root, "c.txt", "c", "fix c");
    quarantine_stacked(&root, "run-1", &base).unwrap();

    let done = split_stacked(
        &root,
        &base,
        &[
            ("run-1-c", &third),
            ("run-1-a", &first),
            ("run-1-b", &second),
        ],
    );

    let sha_of = |id: &str| {
        done.iter()
            .find(|(candidate, _)| candidate == id)
            .and_then(|(_, sha)| sha.clone())
            .unwrap()
    };
    assert_eq!(sha_of("run-1-a"), first);
    assert_eq!(sha_of("run-1-b"), second);
    assert_eq!(sha_of("run-1-c"), third);
    assert_eq!(head(&root), third, "the copy left its stacked tip");
    assert_eq!(
        git_ok(&root, &["rev-parse", "refs/goodboy/candidates/run-1-b"]),
        second
    );
}

#[test]
fn stacked_splitting_refuses_when_a_commit_belongs_to_no_comment() {
    let root = init_repo("candidate-split-stacked-leftover");
    let base = commit(&root, "base.txt", "base", "base");
    let first = commit(&root, "a.txt", "a", "fix a");
    commit(&root, "lint.txt", "lint", "lint pass");
    let third = commit(&root, "c.txt", "c", "fix c");
    quarantine_stacked(&root, "run-1", &base).unwrap();

    let done = split_stacked(&root, &base, &[("run-1-a", &first), ("run-1-c", &third)]);

    assert!(done.iter().all(|(_, sha)| sha.is_none()), "{done:?}");
    assert_eq!(head(&root), third, "the copy moved off its tip");
}

#[test]
fn stacked_splitting_refuses_two_comments_on_one_commit() {
    let root = init_repo("candidate-split-stacked-shared");
    let base = commit(&root, "base.txt", "base", "base");
    let only = commit(&root, "a.txt", "a", "fix both");
    quarantine_stacked(&root, "run-1", &base).unwrap();

    let done = split_stacked(&root, &base, &[("run-1-a", &only), ("run-1-b", &only)]);

    assert!(done.iter().all(|(_, sha)| sha.is_none()), "{done:?}");
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

fn resolve_copy(root: &Path, scratch: &Path, attempt: &str) -> PathBuf {
    let copy = scratch
        .join(format!("goodboy-history-resolve-{attempt}"))
        .join("copy");
    let made = crate::history::prepare_resolve_copy_at(root, &copy, None).unwrap();
    assert_eq!(made.head, head(root), "the copy is not at the branch head");
    copy
}

fn registered(root: &Path, copy: &Path) -> bool {
    let canonical = std::fs::canonicalize(copy)
        .map(|path| path.to_string_lossy().to_string())
        .unwrap_or_default();
    !canonical.is_empty() && git_ok(root, &["worktree", "list", "--porcelain"]).contains(&canonical)
}

#[test]
fn fixes_in_separate_copies_become_candidates_and_all_land_on_accept() {
    let root = init_repo("resolve-copies");
    let base = commit(&root, "ledger.ts", "ledger", "base");
    let scratch = temp_root("resolve-copies-scratch");
    let first = resolve_copy(&root, &scratch, "one");
    let second = resolve_copy(&root, &scratch, "two");
    commit(&first, "rounding.ts", "half even", "round half even");
    std::fs::write(second.join("refunds.ts"), "refunds").unwrap();
    git_ok(&second, &["add", "refunds.ts"]);

    let one = quarantine(&first, "attempt-one", &base).unwrap();
    let two = quarantine(&second, "attempt-two", &base).unwrap();

    assert_eq!(head(&root), base, "a copy wrote to the real branch");
    let landed_one = integrate(&root, "attempt-one", &one, &base).unwrap();
    let landed_two = integrate(&root, "attempt-two", &two, &base).unwrap();
    assert_eq!(landed_one, one);
    assert_eq!(head(&root), landed_two);
    assert!(root.join("rounding.ts").exists() && root.join("refunds.ts").exists());

    crate::history::discard_copy(&first.to_string_lossy());
    crate::history::discard_copy(&second.to_string_lossy());
    assert!(!first.exists() && !second.exists(), "a copy stayed on disk");
}

#[test]
fn a_colliding_fix_is_refused_at_accept_and_the_branch_rolls_back() {
    let root = init_repo("resolve-copies-collide");
    let base = commit(&root, "ledger.ts", "round up", "base");
    let scratch = temp_root("resolve-copies-collide-scratch");
    let first = resolve_copy(&root, &scratch, "one");
    let second = resolve_copy(&root, &scratch, "two");
    commit(&first, "ledger.ts", "round half even", "half even");
    commit(&second, "ledger.ts", "round down", "down");
    let one = quarantine(&first, "attempt-one", &base).unwrap();
    let two = quarantine(&second, "attempt-two", &base).unwrap();
    let landed = integrate(&root, "attempt-one", &one, &base).unwrap();

    let outcome = integrate(&root, "attempt-two", &two, &base);

    assert!(outcome.is_err(), "{outcome:?}");
    assert_eq!(head(&root), landed, "the branch did not roll back");
    assert_eq!(git_ok(&root, &["status", "--porcelain=v1"]), "");
    assert_eq!(
        std::fs::read_to_string(root.join("ledger.ts")).unwrap(),
        "round half even"
    );
    crate::history::discard_copy(&first.to_string_lossy());
    crate::history::discard_copy(&second.to_string_lossy());
}

fn split(root: &Path, base: &str, picks: &[(&str, &str)]) -> Vec<(String, Option<String>)> {
    worktree_split_candidates_blocking(SplitCandidatesArgs {
        worktree_path: root.to_string_lossy().into_owned(),
        base_sha: base.to_string(),
        picks: picks
            .iter()
            .map(|(id, sha)| SplitCandidatePick {
                candidate_id: (*id).to_string(),
                commit_sha: (*sha).to_string(),
            })
            .collect(),
        stack: false,
    })
    .unwrap()
    .into_iter()
    .map(|done| (done.candidate_id, done.sha))
    .collect()
}

fn split_stacked(root: &Path, base: &str, picks: &[(&str, &str)]) -> Vec<(String, Option<String>)> {
    worktree_split_candidates_blocking(SplitCandidatesArgs {
        worktree_path: root.to_string_lossy().into_owned(),
        base_sha: base.to_string(),
        picks: picks
            .iter()
            .map(|(id, sha)| SplitCandidatePick {
                candidate_id: (*id).to_string(),
                commit_sha: (*sha).to_string(),
            })
            .collect(),
        stack: true,
    })
    .unwrap()
    .into_iter()
    .map(|done| (done.candidate_id, done.sha))
    .collect()
}

#[test]
fn a_chain_of_fixes_splits_into_one_candidate_per_commit_on_the_same_base() {
    let root = init_repo("candidate-split");
    let base = commit(&root, "base.txt", "base", "base");
    let first = commit(&root, "a.txt", "a", "fix a");
    let second = commit(&root, "b.txt", "b", "fix b");
    quarantine(&root, "run-1", &base).unwrap();

    let done = split(&root, &base, &[("run-1-a", &first), ("run-1-b", &second)]);

    assert_eq!(done.len(), 2);
    assert_eq!(head(&root), base, "the copy did not go back to its base");
    assert_eq!(git_ok(&root, &["status", "--porcelain=v1"]), "");
    for (id, sha) in &done {
        let sha = sha.as_deref().expect("an independent fix splits");
        assert_eq!(git_ok(&root, &["rev-parse", &format!("{sha}^")]), base);
        assert_eq!(
            git_ok(
                &root,
                &["rev-parse", &format!("refs/goodboy/candidates/{id}")]
            ),
            sha
        );
    }
    let a = done[0].1.clone().unwrap();
    let b = done[1].1.clone().unwrap();
    assert_eq!(
        git_ok(&root, &["diff", "--name-only", &base, &a]),
        "a.txt",
        "the first candidate holds more than its own fix"
    );
    assert_eq!(git_ok(&root, &["diff", "--name-only", &base, &b]), "b.txt");
}

#[test]
fn each_split_candidate_lands_alone_without_the_others() {
    let root = init_repo("candidate-split-alone");
    let base = commit(&root, "base.txt", "base", "base");
    let first = commit(&root, "a.txt", "a", "fix a");
    let second = commit(&root, "b.txt", "b", "fix b");
    quarantine(&root, "run-1", &base).unwrap();
    let done = split(&root, &base, &[("run-1-a", &first), ("run-1-b", &second)]);
    let second_candidate = done[1].1.clone().unwrap();

    integrate(&root, "run-1-b", &second_candidate, &base).unwrap();

    assert!(root.join("b.txt").exists(), "the picked fix did not land");
    assert!(
        !root.join("a.txt").exists(),
        "a fix that was not picked landed"
    );
}

#[test]
fn a_fix_that_builds_on_an_earlier_one_cannot_be_split_off() {
    let root = init_repo("candidate-split-dependent");
    let base = commit(&root, "shared.txt", "base\n", "base");
    let first = commit(&root, "shared.txt", "first\n", "fix a");
    let second = commit(&root, "shared.txt", "second\n", "fix b");
    quarantine(&root, "run-1", &base).unwrap();

    let done = split(&root, &base, &[("run-1-a", &first), ("run-1-b", &second)]);

    assert!(
        done[0].1.is_some(),
        "the first fix has nothing to depend on"
    );
    assert_eq!(done[1].1, None, "a dependent fix was split anyway");
    assert_eq!(head(&root), base);
    assert_eq!(git_ok(&root, &["status", "--porcelain=v1"]), "");
}

#[test]
fn a_commit_the_copy_does_not_know_is_reported_as_not_split() {
    let root = init_repo("candidate-split-unknown");
    let base = commit(&root, "base.txt", "base", "base");
    commit(&root, "a.txt", "a", "fix a");
    quarantine(&root, "run-1", &base).unwrap();

    let done = split(
        &root,
        &base,
        &[("run-1-a", "0000000000000000000000000000000000000000")],
    );

    assert_eq!(done, vec![("run-1-a".to_string(), None)]);
}

#[test]
fn splitting_refuses_a_copy_that_is_not_at_the_base() {
    let root = init_repo("candidate-split-moved");
    let base = commit(&root, "base.txt", "base", "base");
    let first = commit(&root, "a.txt", "a", "fix a");

    let outcome = worktree_split_candidates_blocking(SplitCandidatesArgs {
        worktree_path: root.to_string_lossy().into_owned(),
        base_sha: base,
        picks: vec![SplitCandidatePick {
            candidate_id: "run-1-a".to_string(),
            commit_sha: first,
        }],
        stack: false,
    });

    assert!(outcome.is_err(), "{outcome:?}");
}

#[test]
fn a_resolve_copy_left_by_an_earlier_run_is_removed_at_start() {
    let root = init_repo("resolve-copies-orphan");
    commit(&root, "ledger.ts", "ledger", "base");
    let scratch = temp_root("resolve-copies-orphan-scratch");
    let copy = resolve_copy(&root, &scratch, "orphan");
    crate::history::release_held_copy_for_test(&copy);
    assert!(registered(&root, &copy));

    let cleaned = crate::history::clean_stale_copies_in(&scratch, u64::MAX, u64::MAX);

    assert_eq!(cleaned, 1);
    assert!(!copy.exists(), "the orphan copy is still on disk");
}
