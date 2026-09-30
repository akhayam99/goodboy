use super::{journal_of, recover_journal};
use crate::history::apply::move_branch_blocking;
use crate::history::fixtures::{branch, fold, git_ok, ledger, picks, run_ok};
use crate::history::types::{HistoryVerb, MoveOutcome};

#[test]
fn a_crash_between_moving_the_ref_and_the_files_recovers() {
    let b = branch("apply-journal");
    let journal = journal_of(&b.root).unwrap();
    git_ok(&b.root, &["update-ref", "HEAD", &b.b, &b.c]);
    std::fs::write(&journal, format!("{}\n{}\nref\nfeature\n", b.c, b.b)).unwrap();
    assert_eq!(recover_journal(&b.root).unwrap(), None);
    assert!(!journal.exists());
    assert_eq!(git_ok(&b.root, &["status", "--porcelain"]), "");
    assert_eq!(git_ok(&b.root, &["rev-parse", "HEAD"]), b.b);
}

#[test]
fn a_legacy_journal_without_a_branch_is_kept_and_never_acted_on() {
    let b = branch("apply-journal-legacy");
    git_ok(&b.root, &["checkout", "-q", "-b", "other"]);
    let journal = journal_of(&b.root).unwrap();
    git_ok(&b.root, &["update-ref", "HEAD", &b.b, &b.c]);
    std::fs::write(&journal, format!("{}\n{}\nref\n", b.c, b.b)).unwrap();
    let notice = recover_journal(&b.root).unwrap().unwrap();
    assert!(notice.contains("older Goodboy"), "{notice}");
    assert!(journal.exists());
    assert_eq!(git_ok(&b.root, &["rev-parse", "HEAD"]), b.b);
    assert_eq!(
        std::fs::read_to_string(b.root.join("policy.txt")).unwrap(),
        "three\n"
    );
    let blocked = move_branch_blocking(&b.root, "other", &b.b, &b.a).unwrap();
    assert!(matches!(blocked, MoveOutcome::Blocked { .. }));
}

#[test]
fn a_repair_that_fails_keeps_the_journal() {
    let l = ledger("apply-journal-locked");
    let mut steps = picks(&[
        &l.export, &l.batch, &l.webhook, &l.retries, &l.logging, &l.tests,
    ]);
    steps.push(fold(&l.typo, &l.export, HistoryVerb::Fixup));
    let head = run_ok(&l, steps, "apply-journal-locked").head.unwrap();
    git_ok(&l.root, &["read-tree", "-m", "-u", &l.typo, &head]);
    let journal = journal_of(&l.root).unwrap();
    std::fs::write(&journal, format!("{}\n{head}\nref\nfeature\n", l.typo)).unwrap();
    let lock = l
        .root
        .join(".git")
        .join("refs")
        .join("heads")
        .join("feature.lock");
    std::fs::write(&lock, "").unwrap();
    let notice = recover_journal(&l.root).unwrap();
    assert!(notice.is_some());
    assert!(journal.exists());
    assert_eq!(
        git_ok(&l.root, &["rev-parse", "refs/heads/feature"]),
        l.typo
    );
    std::fs::remove_file(&lock).unwrap();
    assert_eq!(recover_journal(&l.root).unwrap(), None);
    assert!(!journal.exists());
    assert_eq!(git_ok(&l.root, &["rev-parse", "refs/heads/feature"]), head);
}

#[test]
fn a_crash_after_the_files_moved_finishes_the_ref_move() {
    let l = ledger("apply-journal-forward");
    let mut steps = picks(&[
        &l.export, &l.batch, &l.webhook, &l.retries, &l.logging, &l.tests,
    ]);
    steps.push(fold(&l.typo, &l.export, HistoryVerb::Fixup));
    let head = run_ok(&l, steps, "apply-journal-forward").head.unwrap();
    git_ok(&l.root, &["read-tree", "-m", "-u", &l.typo, &head]);
    let journal = journal_of(&l.root).unwrap();
    std::fs::write(&journal, format!("{}\n{head}\nref\nfeature\n", l.typo)).unwrap();
    assert_eq!(recover_journal(&l.root).unwrap(), None);
    assert!(!journal.exists());
    assert_eq!(git_ok(&l.root, &["rev-parse", "HEAD"]), head);
    assert_eq!(git_ok(&l.root, &["status", "--porcelain"]), "");
}
