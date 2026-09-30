use super::{
    backup_namespace, is_backup_of, list_backups, now_nanos, prune_backups, prune_backups_before,
    BACKUP_PREFIX, KEPT_STAMP,
};
use crate::history::apply::{move_branch_blocking, restore_blocking};
use crate::history::check::lines_of;
use crate::history::fixtures::{branch, git_ok, ledger, picks, run_ok, step};
use crate::history::runner::git_run;
use crate::history::types::{HistoryVerb, MoveOutcome};

#[test]
fn old_backups_are_pruned() {
    let b = branch("prune");
    let old = format!("{}/1000000000000000000", backup_namespace("feature"));
    let fresh = format!("{}/{}", backup_namespace("feature"), now_nanos());
    git_ok(&b.root, &["update-ref", &old, &b.a]);
    git_ok(&b.root, &["update-ref", &fresh, &b.b]);
    prune_backups(&b.root);
    let left = list_backups(&b.root, "feature").unwrap();
    assert_eq!(left.len(), 1);
    assert_eq!(left[0].ref_name, fresh);
}

#[test]
fn backups_of_branches_whose_names_look_alike_never_mix() {
    let b = branch("backup-namespace");
    let slash = format!("{}/{}", backup_namespace("feature/a"), now_nanos());
    let dash = format!("{}/{}", backup_namespace("feature-a"), now_nanos());
    git_ok(&b.root, &["update-ref", &slash, &b.a]);
    git_ok(&b.root, &["update-ref", &dash, &b.b]);
    git_ok(
        &b.root,
        &["update-ref", "refs/goodboy/backup/feature-a/1000", &b.c],
    );
    let listed: Vec<String> = list_backups(&b.root, "feature-a")
        .unwrap()
        .into_iter()
        .filter(|backup| !backup.is_legacy)
        .map(|backup| backup.ref_name)
        .collect();
    assert_eq!(listed, vec![dash.clone()]);
    assert!(is_backup_of("feature-a", &dash));
    assert!(!is_backup_of("feature-a", &slash));
    assert!(!is_backup_of(
        "feature-a",
        "refs/goodboy/backup/feature-a/1000"
    ));
    assert!(!is_backup_of("feature-a", &format!("{dash}/../x")));
}

#[test]
fn an_older_backup_stays_read_only_and_never_moves_onto_a_later_branch_with_its_slug() {
    let b = branch("legacy-backups");
    let deleted = "refs/goodboy/backup/feature-ledger/1000000000000000000";
    git_ok(&b.root, &["update-ref", deleted, &b.a]);
    git_ok(&b.root, &["checkout", "-q", "-b", "feature-ledger"]);
    git_ok(&b.root, &["branch", "team/other"]);

    for owner in ["feature-ledger", "Feature/Ledger"] {
        let listed = list_backups(&b.root, owner).unwrap();
        assert_eq!(listed.len(), 1, "{owner}");
        assert!(listed[0].is_legacy);
        assert_eq!(listed[0].ref_name, deleted);
    }
    assert!(list_backups(&b.root, "team/other").unwrap().is_empty());
    assert!(restore_blocking(&b.root, "feature-ledger", &b.c, deleted).is_err());
    assert_eq!(git_ok(&b.root, &["rev-parse", "HEAD"]), b.c);
    prune_backups_before(&b.root, u64::MAX);
    assert_eq!(git_ok(&b.root, &["rev-parse", deleted]), b.a);
    assert_eq!(
        git_ok(
            &b.root,
            &["for-each-ref", "--format=%(refname)", BACKUP_PREFIX]
        ),
        deleted
    );
}

#[test]
fn pruning_keeps_twenty_restore_backups_and_always_the_newest_backup_of_a_branch() {
    let b = branch("prune-caps");
    let kept_space = backup_namespace("feature");
    let stamp = |index: u128| 1_000_000_000_000_000_000u128 + index * 1_000_000_000;
    for index in 0..22 {
        git_ok(
            &b.root,
            &[
                "update-ref",
                &format!("{kept_space}/{KEPT_STAMP}{}", stamp(index)),
                &b.a,
            ],
        );
    }
    let lone = format!("{}/{}", backup_namespace("team/lone"), stamp(1));
    git_ok(&b.root, &["update-ref", &lone, &b.b]);
    let older = format!("{}/{}", backup_namespace("team/pair"), stamp(1));
    let newer = format!("{}/{}", backup_namespace("team/pair"), stamp(2));
    git_ok(&b.root, &["update-ref", &older, &b.b]);
    git_ok(&b.root, &["update-ref", &newer, &b.c]);

    prune_backups_before(&b.root, u64::MAX);

    let left = lines_of(&git_ok(
        &b.root,
        &["for-each-ref", "--format=%(refname)", BACKUP_PREFIX],
    ));
    let kept: Vec<&String> = left
        .iter()
        .filter(|name| name.starts_with(&kept_space))
        .collect();
    assert_eq!(kept.len(), 20);
    assert!(left.contains(&format!("{kept_space}/{KEPT_STAMP}{}", stamp(21))));
    assert!(!left.contains(&format!("{kept_space}/{KEPT_STAMP}{}", stamp(0))));
    assert!(!left.contains(&format!("{kept_space}/{KEPT_STAMP}{}", stamp(1))));
    assert!(left.contains(&lone));
    assert!(left.contains(&newer));
    assert!(!left.contains(&older));
}

#[test]
fn the_restore_backup_cap_never_drops_the_only_ref_to_its_commits() {
    let b = branch("prune-only-ref");
    let space = backup_namespace("feature");
    let stamp = |index: u128| 1_000_000_000_000_000_000u128 + index * 1_000_000_000;
    let tree = git_ok(&b.root, &["rev-parse", &format!("{}^{{tree}}", b.b)]);
    let dangling = git_ok(
        &b.root,
        &[
            "commit-tree",
            &tree,
            "-p",
            &b.a,
            "-m",
            "Only kept by a backup",
        ],
    );
    let oldest = format!("{space}/{KEPT_STAMP}{}", stamp(0));
    let second = format!("{space}/{KEPT_STAMP}{}", stamp(1));
    git_ok(&b.root, &["update-ref", &oldest, &dangling]);
    git_ok(&b.root, &["update-ref", &second, &b.a]);
    for index in 2..22 {
        git_ok(
            &b.root,
            &[
                "update-ref",
                &format!("{space}/{KEPT_STAMP}{}", stamp(index)),
                &b.c,
            ],
        );
    }

    prune_backups_before(&b.root, u64::MAX);

    assert_eq!(git_ok(&b.root, &["rev-parse", &oldest]), dangling);
    assert!(
        git_run(
            &b.root,
            &["rev-parse", "--verify", "--quiet", &second],
            None,
            None
        )
        .unwrap()
        .status
            != 0
    );
}

#[test]
fn the_cap_never_leans_on_a_timed_backup_that_expires_in_the_same_prune() {
    let b = branch("prune-expiring-witness");
    let space = backup_namespace("feature");
    let stamp = |index: u128| 1_000_000_000_000_000_000u128 + index * 1_000_000_000;
    let tree = git_ok(&b.root, &["rev-parse", &format!("{}^{{tree}}", b.b)]);
    let only = git_ok(
        &b.root,
        &[
            "commit-tree",
            &tree,
            "-p",
            &b.a,
            "-m",
            "Reached by two backups",
        ],
    );
    let expiring = format!("{space}/{}", stamp(0));
    let capped = format!("{space}/{KEPT_STAMP}{}", stamp(1));
    git_ok(&b.root, &["update-ref", &expiring, &only]);
    git_ok(&b.root, &["update-ref", &capped, &only]);
    for index in 2..22 {
        git_ok(
            &b.root,
            &[
                "update-ref",
                &format!("{space}/{KEPT_STAMP}{}", stamp(index)),
                &b.c,
            ],
        );
    }

    prune_backups_before(&b.root, u64::MAX);

    assert!(
        git_run(
            &b.root,
            &["rev-parse", "--verify", "--quiet", &expiring],
            None,
            None
        )
        .unwrap()
        .status
            != 0
    );
    assert_eq!(git_ok(&b.root, &["rev-parse", &capped]), only);
}

#[test]
fn the_cap_never_counts_a_timed_backup_as_keeping_a_commit() {
    let b = branch("prune-timed-witness");
    let space = backup_namespace("feature");
    let stamp = |index: u128| 1_000_000_000_000_000_000u128 + index * 1_000_000_000;
    let tree = git_ok(&b.root, &["rev-parse", &format!("{}^{{tree}}", b.b)]);
    let only = git_ok(
        &b.root,
        &[
            "commit-tree",
            &tree,
            "-p",
            &b.a,
            "-m",
            "Reached by a timed backup",
        ],
    );
    let capped = format!("{space}/{KEPT_STAMP}{}", stamp(1));
    let timed = format!("{}/{}", backup_namespace("team/other"), stamp(0));
    git_ok(&b.root, &["update-ref", &capped, &only]);
    git_ok(&b.root, &["update-ref", &timed, &only]);
    for index in 2..22 {
        git_ok(
            &b.root,
            &[
                "update-ref",
                &format!("{space}/{KEPT_STAMP}{}", stamp(index)),
                &b.c,
            ],
        );
    }

    prune_backups_before(&b.root, 0);

    assert_eq!(git_ok(&b.root, &["rev-parse", &capped]), only);
    assert_eq!(git_ok(&b.root, &["rev-parse", &timed]), only);
}

#[test]
fn the_backup_a_restore_leaves_is_never_pruned() {
    let l = ledger("restore-backup-kept");
    let mut steps = picks(&[&l.export, &l.batch, &l.webhook, &l.retries, &l.logging]);
    steps.push(step(&l.tests, HistoryVerb::Drop));
    steps.push(step(&l.typo, HistoryVerb::Pick));
    let head = run_ok(&l, steps, "restore-backup-kept").head.unwrap();
    let MoveOutcome::Moved {
        backup_ref: rewrite_backup,
        ..
    } = move_branch_blocking(&l.root, "feature", &l.typo, &head).unwrap()
    else {
        panic!("expected the rewrite to move the branch");
    };
    let MoveOutcome::Moved {
        backup_ref: restore_backup,
        ..
    } = restore_blocking(&l.root, "feature", &head, &rewrite_backup).unwrap()
    else {
        panic!("expected the restore to move the branch");
    };
    assert_eq!(git_ok(&l.root, &["rev-parse", "HEAD"]), l.typo);
    prune_backups_before(&l.root, u64::MAX);
    assert_eq!(git_ok(&l.root, &["rev-parse", &restore_backup]), head);
    assert!(
        git_run(
            &l.root,
            &["rev-parse", "--verify", "--quiet", &rewrite_backup],
            None,
            None
        )
        .unwrap()
        .status
            != 0
    );
    let listed = list_backups(&l.root, "feature").unwrap();
    assert!(listed
        .iter()
        .any(|backup| backup.ref_name == restore_backup));
}
