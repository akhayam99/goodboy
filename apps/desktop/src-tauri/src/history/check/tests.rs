use super::{check_trial, CheckInput};
use crate::history::fixtures::{commit, git_ok, ledger, picks};
use crate::history::plan::order_steps;

#[test]
fn the_check_names_files_that_differ_when_no_removed_commit_explains_them() {
    let l = ledger("check-mismatch");
    let steps = picks(&[
        &l.export, &l.batch, &l.webhook, &l.retries, &l.logging, &l.tests, &l.typo,
    ]);
    let ordered = order_steps(&steps).unwrap();
    git_ok(&l.root, &["checkout", "-q", "-b", "tampered"]);
    let tampered = commit(
        &l.root,
        "webhook.ts",
        "skip verify\n",
        "Fix typo in CSV header",
    );
    git_ok(&l.root, &["checkout", "-q", "feature"]);
    let check = check_trial(
        &l.root,
        None,
        &CheckInput {
            base: &l.base,
            start: &l.base,
            old_head: &l.typo,
            new_head: &tampered,
            steps: &steps,
            ordered: &ordered,
            made: Some(8),
        },
    );
    assert!(!check.is_passed);
    assert_eq!(check.unexpected_files, vec!["webhook.ts".to_string()]);
    assert!(check.problems.iter().any(|p| p.contains("webhook.ts")));
}

#[test]
fn the_check_refuses_a_result_with_the_wrong_number_of_commits() {
    let l = ledger("check-count");
    let steps = picks(&[
        &l.export, &l.batch, &l.webhook, &l.retries, &l.logging, &l.tests, &l.typo,
    ]);
    let ordered = order_steps(&steps).unwrap();
    let check = check_trial(
        &l.root,
        None,
        &CheckInput {
            base: &l.base,
            start: &l.base,
            old_head: &l.typo,
            new_head: &l.typo,
            steps: &steps,
            ordered: &ordered,
            made: Some(3),
        },
    );
    assert!(!check.is_passed);
    assert!(check.problems[0].contains("7 commits"));
}
