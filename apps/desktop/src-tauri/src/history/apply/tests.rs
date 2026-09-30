use super::{apply_move, move_branch_blocking};
use crate::history::backups::{is_backup_of, list_backups};
use crate::history::fixtures::{
    branch, commit, fold, git_ok, ledger, picks, plan, run_ok, slug, step,
};
use crate::history::journal::{journal_of, recover_journal};
use crate::history::trial::trial;
use crate::history::types::{HistoryVerb, MoveOutcome};

#[test]
fn applying_backs_up_moves_the_branch_and_restore_brings_it_back() {
    let b = branch("apply-restore");
    let args = plan(
        &b.root,
        &b.base,
        &b.c,
        vec![
            step(&b.a, HistoryVerb::Pick),
            step(&b.b, HistoryVerb::Squash),
            step(&b.c, HistoryVerb::Pick),
        ],
    );
    let result = trial(&args, &slug("apply-restore"), false).unwrap();
    let new_head = result.head.unwrap();
    let moved = move_branch_blocking(&b.root, "feature", &b.c, &new_head).unwrap();
    let MoveOutcome::Moved { head, backup_ref } = moved else {
        panic!("expected the branch to move");
    };
    assert_eq!(head, new_head);
    assert_eq!(git_ok(&b.root, &["rev-parse", "HEAD"]), new_head);
    assert_eq!(git_ok(&b.root, &["rev-parse", &backup_ref]), b.c);
    assert_eq!(git_ok(&b.root, &["status", "--porcelain"]), "");
    let backups = list_backups(&b.root, "feature").unwrap();
    assert_eq!(backups.len(), 1);
    assert_eq!(backups[0].sha, b.c);
    let restored = move_branch_blocking(&b.root, "feature", &new_head, &b.c).unwrap();
    assert!(matches!(restored, MoveOutcome::Moved { .. }));
    assert_eq!(git_ok(&b.root, &["rev-parse", "HEAD"]), b.c);
    assert_eq!(list_backups(&b.root, "feature").unwrap().len(), 2);
}

#[test]
fn applying_refuses_when_the_head_moved_or_the_tree_is_dirty() {
    let b = branch("apply-refuse");
    let moved = move_branch_blocking(&b.root, "feature", &b.b, &b.a).unwrap();
    assert_eq!(moved, MoveOutcome::HeadMoved { head: b.c.clone() });
    std::fs::write(b.root.join("policy.txt"), "dirty\n").unwrap();
    let blocked = move_branch_blocking(&b.root, "feature", &b.c, &b.a).unwrap();
    assert!(matches!(blocked, MoveOutcome::Blocked { .. }));
    assert_eq!(git_ok(&b.root, &["rev-parse", "HEAD"]), b.c);
}

#[test]
fn apply_backs_up_to_the_branch_namespace_and_restore_returns_exactly() {
    let l = ledger("run-apply-restore");
    let mut steps = picks(&[
        &l.export, &l.batch, &l.webhook, &l.retries, &l.logging, &l.tests,
    ]);
    steps.push(fold(&l.typo, &l.export, HistoryVerb::Fixup));
    let head = run_ok(&l, steps, "run-apply-restore").head.unwrap();
    let MoveOutcome::Moved { backup_ref, .. } =
        move_branch_blocking(&l.root, "feature", &l.typo, &head).unwrap()
    else {
        panic!("expected the branch to move");
    };
    assert!(is_backup_of("feature", &backup_ref));
    assert!(backup_ref.starts_with("refs/goodboy/backup/b-66656174757265/"));
    assert_eq!(git_ok(&l.root, &["rev-parse", &backup_ref]), l.typo);
    assert_eq!(git_ok(&l.root, &["rev-parse", "HEAD"]), head);
    let restored = move_branch_blocking(&l.root, "feature", &head, &backup_ref).unwrap();
    assert!(matches!(restored, MoveOutcome::Moved { .. }));
    assert_eq!(git_ok(&l.root, &["rev-parse", "HEAD"]), l.typo);
    assert_eq!(git_ok(&l.root, &["status", "--porcelain"]), "");
}

#[test]
fn apply_refuses_to_overwrite_an_untracked_file() {
    let l = ledger("apply-untracked");
    git_ok(&l.root, &["rm", "-q", "logger.ts"]);
    git_ok(
        &l.root,
        &["commit", "-q", "--no-verify", "-m", "Stop logging"],
    );
    let now = git_ok(&l.root, &["rev-parse", "HEAD"]);
    std::fs::write(l.root.join("logger.ts"), "mine\n").unwrap();
    let blocked = move_branch_blocking(&l.root, "feature", &now, &l.typo).unwrap();
    let MoveOutcome::Blocked { reason } = blocked else {
        panic!("expected the untracked file to block");
    };
    assert!(reason.contains("logger.ts"), "{reason}");
    assert_eq!(
        std::fs::read_to_string(l.root.join("logger.ts")).unwrap(),
        "mine\n"
    );
    assert_eq!(git_ok(&l.root, &["rev-parse", "HEAD"]), now);
}

#[test]
fn apply_refuses_to_replace_an_untracked_folder_or_an_ignored_file() {
    let l = ledger("apply-untracked-folder");
    std::fs::write(l.root.join(".gitignore"), "build.log\n").unwrap();
    git_ok(&l.root, &["add", ".gitignore"]);
    git_ok(
        &l.root,
        &["commit", "-q", "--no-verify", "-m", "Ignore the build log"],
    );
    let ignored = git_ok(&l.root, &["rev-parse", "HEAD"]);
    git_ok(&l.root, &["rm", "-q", "--cached", "logger.ts"]);
    std::fs::remove_file(l.root.join("logger.ts")).unwrap();
    git_ok(
        &l.root,
        &["commit", "-q", "--no-verify", "-m", "Drop the logger file"],
    );
    let now = git_ok(&l.root, &["rev-parse", "HEAD"]);
    std::fs::create_dir_all(l.root.join("logger.ts")).unwrap();
    std::fs::write(l.root.join("logger.ts").join("notes.txt"), "mine\n").unwrap();
    let blocked = move_branch_blocking(&l.root, "feature", &now, &ignored).unwrap();
    let MoveOutcome::Blocked { reason } = blocked else {
        panic!("expected the untracked folder to block");
    };
    assert!(reason.contains("logger.ts"), "{reason}");
    assert_eq!(
        std::fs::read_to_string(l.root.join("logger.ts").join("notes.txt")).unwrap(),
        "mine\n"
    );
    std::fs::remove_dir_all(l.root.join("logger.ts")).unwrap();
    std::fs::write(l.root.join("build.log"), "tracked log\n").unwrap();
    git_ok(&l.root, &["add", "-f", "build.log"]);
    git_ok(
        &l.root,
        &["commit", "-q", "--no-verify", "-m", "Track the build log"],
    );
    let tracked_log = git_ok(&l.root, &["rev-parse", "HEAD"]);
    git_ok(&l.root, &["reset", "-q", "--hard", &now]);
    std::fs::write(l.root.join("build.log"), "my local log\n").unwrap();
    let blocked = move_branch_blocking(&l.root, "feature", &now, &tracked_log).unwrap();
    assert!(matches!(blocked, MoveOutcome::Blocked { .. }));
    assert_eq!(
        std::fs::read_to_string(l.root.join("build.log")).unwrap(),
        "my local log\n"
    );
    assert_eq!(git_ok(&l.root, &["rev-parse", "HEAD"]), now);
}

#[test]
fn a_file_where_the_rewrite_needs_a_folder_blocks_too() {
    let l = ledger("apply-untracked-parent");
    git_ok(&l.root, &["rm", "-q", "export.test.ts"]);
    git_ok(
        &l.root,
        &["commit", "-q", "--no-verify", "-m", "No tests yet"],
    );
    let now = git_ok(&l.root, &["rev-parse", "HEAD"]);
    std::fs::create_dir_all(l.root.join("assets")).unwrap();
    std::fs::write(l.root.join("assets").join("logo.svg"), "<svg/>\n").unwrap();
    git_ok(&l.root, &["add", "assets/logo.svg"]);
    git_ok(
        &l.root,
        &["commit", "-q", "--no-verify", "-m", "Add the logo"],
    );
    let with_assets = git_ok(&l.root, &["rev-parse", "HEAD"]);
    git_ok(&l.root, &["reset", "-q", "--hard", &now]);
    std::fs::write(l.root.join("assets"), "a note, not a folder\n").unwrap();
    let blocked = move_branch_blocking(&l.root, "feature", &now, &with_assets).unwrap();
    assert!(matches!(blocked, MoveOutcome::Blocked { .. }));
    assert_eq!(
        std::fs::read_to_string(l.root.join("assets")).unwrap(),
        "a note, not a folder\n"
    );
}

#[test]
fn a_local_edit_that_appears_after_the_checks_is_kept_and_nothing_moves() {
    let l = ledger("apply-late-edit");
    let mut steps = picks(&[
        &l.export, &l.batch, &l.webhook, &l.retries, &l.logging, &l.tests,
    ]);
    steps.push(step(&l.typo, HistoryVerb::Drop));
    let head = run_ok(&l, steps, "apply-late-edit").head.unwrap();
    std::fs::write(l.root.join("export.ts"), "edited while applying\n").unwrap();
    let outcome = apply_move(
        &l.root,
        "feature",
        &l.typo,
        &head,
        "refs/goodboy/backup/feature/1",
    )
    .unwrap();
    assert!(
        matches!(outcome, MoveOutcome::Blocked { .. }),
        "{outcome:?}"
    );
    assert_eq!(
        std::fs::read_to_string(l.root.join("export.ts")).unwrap(),
        "edited while applying\n"
    );
    assert_eq!(git_ok(&l.root, &["rev-parse", "HEAD"]), l.typo);
}

#[test]
fn a_commit_that_lands_during_the_move_is_never_reset_away() {
    let l = ledger("apply-late-commit");
    let mut steps = picks(&[
        &l.export, &l.batch, &l.webhook, &l.retries, &l.logging, &l.tests,
    ]);
    steps.push(fold(&l.typo, &l.export, HistoryVerb::Fixup));
    let head = run_ok(&l, steps, "apply-late-commit").head.unwrap();
    let late = commit(
        &l.root,
        "late.txt",
        "late\n",
        "Late commit from another tool",
    );
    let outcome = apply_move(
        &l.root,
        "feature",
        &l.typo,
        &head,
        "refs/goodboy/backup/feature/1",
    )
    .unwrap();
    assert!(!matches!(outcome, MoveOutcome::Moved { .. }), "{outcome:?}");
    assert_eq!(git_ok(&l.root, &["rev-parse", "HEAD"]), late);
    assert_eq!(
        std::fs::read_to_string(l.root.join("late.txt")).unwrap(),
        "late\n"
    );
}

#[test]
fn switching_to_another_branch_at_the_same_commit_never_rewrites_it() {
    let l = ledger("apply-other-branch");
    let mut steps = picks(&[
        &l.export, &l.batch, &l.webhook, &l.retries, &l.logging, &l.tests,
    ]);
    steps.push(fold(&l.typo, &l.export, HistoryVerb::Fixup));
    let head = run_ok(&l, steps, "apply-other-branch").head.unwrap();
    git_ok(&l.root, &["checkout", "-q", "-b", "release"]);
    let outcome = apply_move(
        &l.root,
        "feature",
        &l.typo,
        &head,
        "refs/goodboy/backup/feature/1",
    )
    .unwrap();
    assert!(!matches!(outcome, MoveOutcome::Moved { .. }), "{outcome:?}");
    assert_eq!(
        git_ok(&l.root, &["rev-parse", "refs/heads/release"]),
        l.typo
    );
    assert_eq!(
        git_ok(&l.root, &["rev-parse", "refs/heads/feature"]),
        l.typo
    );
    assert_eq!(git_ok(&l.root, &["status", "--porcelain"]), "");
    let journal = journal_of(&l.root).unwrap();
    git_ok(&l.root, &["read-tree", "-m", "-u", &l.typo, &head]);
    std::fs::write(&journal, format!("{}\n{head}\nref\nfeature\n", l.typo)).unwrap();
    recover_journal(&l.root).unwrap();
    assert_eq!(
        git_ok(&l.root, &["rev-parse", "refs/heads/release"]),
        l.typo
    );
    assert_eq!(
        git_ok(&l.root, &["rev-parse", "refs/heads/feature"]),
        l.typo
    );
}
