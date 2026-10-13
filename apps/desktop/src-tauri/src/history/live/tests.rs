use super::{edit, edit_with_lease, LiveArgs, LiveOutcome};
use crate::history::apply::restore_blocking;
use crate::history::backups::{backup_namespace, list_backups, now_nanos};
use crate::history::fixtures::{
    branch, git_ok, ledger, ledger_plan, picks, plan, run_args, step, subjects,
};
use crate::history::types::{HistoryStep, HistoryVerb, MoveOutcome};
use crate::worktree_writer::{acquire_lease, lease_status, WriterLeaseRegistry};

fn apply(root: &std::path::Path, plan: crate::history::types::HistoryPlanArgs) -> MoveOutcome {
    let args = LiveArgs {
        request: run_args(root, plan),
        should_stash: false,
    };
    let LiveOutcome::Finished { outcome, .. } =
        edit_with_lease(&WriterLeaseRegistry::default(), &args).unwrap()
    else {
        panic!("expected a live edit");
    };
    outcome
}

#[test]
fn live_reword_undo_and_redo_preserve_the_tree_and_retain_refs() {
    let l = ledger("live-reword");
    let mut steps = picks(&[
        &l.export, &l.batch, &l.webhook, &l.retries, &l.logging, &l.tests, &l.typo,
    ]);
    steps[0].verb = HistoryVerb::Reword;
    steps[0].message = Some("Acme ledger export".to_string());
    let tree = git_ok(&l.root, &["rev-parse", "HEAD^{tree}"]);
    let MoveOutcome::Moved {
        head, backup_ref, ..
    } = apply(&l.root, ledger_plan(&l, steps))
    else {
        panic!("expected move")
    };
    assert_eq!(git_ok(&l.root, &["rev-parse", "HEAD"]), head);
    assert_eq!(
        subjects(&l.root, &format!("{}..HEAD", l.base))
            .last()
            .unwrap(),
        "Acme ledger export"
    );
    let MoveOutcome::Moved {
        head: restored,
        backup_ref: redo,
        ..
    } = restore_blocking(&l.root, "feature", &head, &backup_ref).unwrap()
    else {
        panic!("expected undo")
    };
    assert_eq!(restored, l.typo);
    let MoveOutcome::Moved { head: redone, .. } =
        restore_blocking(&l.root, "feature", &restored, &redo).unwrap()
    else {
        panic!("expected redo")
    };
    assert_eq!(redone, head);
    assert_eq!(git_ok(&l.root, &["rev-parse", "HEAD^{tree}"]), tree);
    assert_eq!(list_backups(&l.root, "feature").unwrap().len(), 3);
}

#[test]
fn one_successful_live_edit_adds_exactly_one_version() {
    let l = ledger("live-one-version");
    assert!(list_backups(&l.root, "feature").unwrap().is_empty());
    let MoveOutcome::Moved { backup_ref, .. } = apply(
        &l.root,
        ledger_plan(&l, picks(&[&l.export, &l.batch, &l.webhook])),
    ) else {
        panic!("expected move")
    };
    let backups = list_backups(&l.root, "feature").unwrap();
    assert_eq!(backups.len(), 1);
    assert_eq!(backups[0].ref_name, backup_ref);
}

#[test]
fn live_reorder_fold_and_drop_apply_without_a_separate_apply_step() {
    for verb in [HistoryVerb::Pick, HistoryVerb::Fixup, HistoryVerb::Drop] {
        let l = ledger("live-operations");
        let mut steps = picks(&[
            &l.export, &l.batch, &l.webhook, &l.retries, &l.logging, &l.tests, &l.typo,
        ]);
        if verb == HistoryVerb::Pick {
            steps.swap(1, 2);
        }
        if verb != HistoryVerb::Pick {
            steps[5] = HistoryStep {
                sha: l.tests.clone(),
                verb,
                message: None,
                target: (verb == HistoryVerb::Fixup).then(|| l.retries.clone()),
            };
        }
        let MoveOutcome::Moved { head, .. } = apply(&l.root, ledger_plan(&l, steps)) else {
            panic!("expected move")
        };
        assert_eq!(git_ok(&l.root, &["rev-parse", "HEAD"]), head);
        let count = git_ok(
            &l.root,
            &["rev-list", "--count", &format!("{}..HEAD", l.base)],
        );
        let expected = match verb {
            HistoryVerb::Pick => "7",
            _ => "6",
        };
        assert_eq!(count, expected);
    }
}

#[test]
fn live_conflict_keeps_head_index_worktree_and_remote_exactly_as_before() {
    let b = branch("live-conflict");
    let before = git_ok(&b.root, &["rev-parse", "HEAD"]);
    let index = git_ok(&b.root, &["write-tree"]);
    let files = std::fs::read(b.root.join("policy.txt")).unwrap();
    let args = LiveArgs {
        request: run_args(
            &b.root,
            plan(
                &b.root,
                &b.base,
                &b.c,
                vec![
                    step(&b.b, HistoryVerb::Pick),
                    step(&b.a, HistoryVerb::Pick),
                    step(&b.c, HistoryVerb::Pick),
                ],
            ),
        ),
        should_stash: false,
    };
    let LiveOutcome::Stopped { result } =
        edit_with_lease(&WriterLeaseRegistry::default(), &args).unwrap()
    else {
        panic!("expected conflict")
    };
    assert!(result.stop.is_some());
    assert_eq!(git_ok(&b.root, &["rev-parse", "HEAD"]), before);
    assert_eq!(git_ok(&b.root, &["write-tree"]), index);
    assert_eq!(std::fs::read(b.root.join("policy.txt")).unwrap(), files);
    assert!(list_backups(&b.root, "feature").unwrap().is_empty());
}

#[test]
fn live_edit_is_blocked_immediately_by_an_agent_reservation() {
    let l = ledger("live-reservation");
    let registry = WriterLeaseRegistry::default();
    let path = l.root.to_string_lossy().to_string();
    acquire_lease(&registry, &path, "Acme agent", None);
    let args = LiveArgs {
        request: run_args(&l.root, ledger_plan(&l, picks(&[&l.export]))),
        should_stash: false,
    };
    let LiveOutcome::Blocked { reason } = edit_with_lease(&registry, &args).unwrap() else {
        panic!("expected reservation")
    };
    assert!(reason.contains("Acme agent"));
    assert_eq!(git_ok(&l.root, &["rev-parse", "HEAD"]), l.typo);
    assert!(list_backups(&l.root, "feature").unwrap().is_empty());
}

#[test]
fn live_dirty_overlap_requires_consent_and_a_stale_undo_cannot_reset_another_writer() {
    let l = ledger("live-dirty");
    std::fs::write(l.root.join("export.test.ts"), "Acme local changes\n").unwrap();
    let mut steps = picks(&[
        &l.export, &l.batch, &l.webhook, &l.retries, &l.logging, &l.tests, &l.typo,
    ]);
    steps[5].verb = HistoryVerb::Drop;
    assert!(matches!(
        apply(&l.root, ledger_plan(&l, steps)),
        MoveOutcome::NeedsStash { .. }
    ));
    assert_eq!(git_ok(&l.root, &["rev-parse", "HEAD"]), l.typo);
    assert_eq!(
        std::fs::read_to_string(l.root.join("export.test.ts")).unwrap(),
        "Acme local changes\n"
    );
    assert!(list_backups(&l.root, "feature").unwrap().is_empty());
    let backup = format!("{}/{}", backup_namespace("feature"), now_nanos());
    git_ok(&l.root, &["update-ref", &backup, &l.typo]);
    assert!(matches!(
        restore_blocking(&l.root, "feature", &l.tests, &backup).unwrap(),
        MoveOutcome::HeadMoved { .. }
    ));
}

#[test]
fn a_long_live_edit_session_keeps_every_undo_ref_when_cleanup_runs() {
    let b = branch("live-retention");
    let mut head = b.c.clone();
    let mut refs = Vec::new();
    for index in 0..12 {
        let mut edited = step(&head, HistoryVerb::Reword);
        edited.message = Some(format!("Acme notes {index}"));
        let MoveOutcome::Moved {
            head: next,
            backup_ref,
            ..
        } = apply(
            &b.root,
            plan(
                &b.root,
                &b.base,
                &head,
                vec![
                    step(&b.a, HistoryVerb::Pick),
                    step(&b.b, HistoryVerb::Pick),
                    edited,
                ],
            ),
        )
        else {
            panic!("expected edit")
        };
        refs.push((backup_ref, head));
        head = next;
        crate::history::backups::prune_backups(&b.root);
    }
    for (reference, expected) in refs {
        assert_eq!(git_ok(&b.root, &["rev-parse", &reference]), expected);
    }
}

#[test]
fn a_lost_lease_aborts_the_replay_before_the_branch_moves() {
    let l = ledger("live-lease-lost");
    let args = LiveArgs {
        request: run_args(&l.root, ledger_plan(&l, picks(&[&l.export]))),
        should_stash: false,
    };
    let LiveOutcome::Blocked { reason } = edit(&args, &|| false).unwrap() else {
        panic!("expected an abort")
    };
    assert!(reason.contains("lock was lost"));
    assert_eq!(git_ok(&l.root, &["rev-parse", "HEAD"]), l.typo);
    assert!(list_backups(&l.root, "feature").unwrap().is_empty());
}

#[test]
fn the_live_lease_is_bound_to_its_replay_and_freed_afterwards() {
    let l = ledger("live-lease-bound");
    let registry = WriterLeaseRegistry::default();
    let path = l.root.to_string_lossy().to_string();
    let args = LiveArgs {
        request: run_args(&l.root, ledger_plan(&l, picks(&[&l.export]))),
        should_stash: false,
    };
    edit_with_lease(&registry, &args).unwrap();
    let status = lease_status(&registry, &path);
    assert!(status.holder.is_none());
    assert!(status.run_id.is_none());
}
