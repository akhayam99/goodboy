use super::{
    dirty_files, drop_own_stash, overlap, parse_dirty, stash_entries, stash_message, AFTER_PUSH,
};
use crate::history::apply::{bring_back, move_branch_with, BEFORE_MOVE};
use crate::history::fixtures::{commit, git_ok, init_repo};
use crate::history::journal::{journal_of, pending_stash, recover_journal};
use crate::history::types::MoveOutcome;
use std::path::PathBuf;

fn repository(name: &str) -> (PathBuf, String, String) {
    let root = init_repo(name);
    commit(&root, "ledger.txt", "one\ntwo\nthree\n", "Acme ledger");
    commit(&root, "notes.txt", "notes\n", "Harborline notes");
    let old = commit(&root, "staged.txt", "staged\n", "Northwind staged");
    let new = commit(
        &root,
        "ledger.txt",
        "one\ntwo\nthree\nfour\n",
        "Cascadia ledger",
    );
    git_ok(&root, &["checkout", "-b", "feature", &old]);
    (root, old, new)
}

fn move_to(root: &std::path::Path, old: &str, new: &str, should_stash: bool) -> MoveOutcome {
    move_branch_with(root, "feature", old, new, false, should_stash).unwrap()
}

#[test]
fn three_disjoint_dirty_files_are_carried_byte_for_byte_with_the_index() {
    let (root, old, new) = repository("carry");
    std::fs::write(root.join("notes.txt"), "my notes\n").unwrap();
    std::fs::write(root.join("staged.txt"), "my staged\n").unwrap();
    git_ok(&root, &["add", "staged.txt"]);
    std::fs::write(root.join("untracked.txt"), "my untracked\n").unwrap();
    let before = git_ok(&root, &["status", "--porcelain"]);
    let outcome = move_to(&root, &old, &new, false);
    assert!(matches!(
        outcome,
        MoveOutcome::Moved {
            carried_count: 3,
            ..
        }
    ));
    assert_eq!(git_ok(&root, &["status", "--porcelain"]), before);
    assert_eq!(
        std::fs::read(root.join("notes.txt")).unwrap(),
        b"my notes\n"
    );
    assert_eq!(
        std::fs::read(root.join("staged.txt")).unwrap(),
        b"my staged\n"
    );
    assert_eq!(
        std::fs::read(root.join("untracked.txt")).unwrap(),
        b"my untracked\n"
    );
}

#[test]
fn overlap_requires_consent_and_staged_and_untracked_files_come_back() {
    let (root, old, new) = repository("overlap");
    std::fs::write(root.join("ledger.txt"), "mine\ntwo\nthree\n").unwrap();
    git_ok(&root, &["add", "ledger.txt"]);
    std::fs::write(root.join("untracked.txt"), "mine\n").unwrap();
    assert_eq!(
        move_to(&root, &old, &new, false),
        MoveOutcome::NeedsStash {
            files: vec!["ledger.txt".to_string()],
            dirty_count: 2
        }
    );
    assert!(matches!(
        move_to(&root, &old, &new, true),
        MoveOutcome::Moved { .. }
    ));
    assert_eq!(
        std::fs::read_to_string(root.join("ledger.txt")).unwrap(),
        "mine\ntwo\nthree\nfour\n"
    );
    assert_eq!(
        git_ok(&root, &["show", ":ledger.txt"]),
        "mine\ntwo\nthree\nfour"
    );
    assert_eq!(
        std::fs::read(root.join("untracked.txt")).unwrap(),
        b"mine\n"
    );
    assert!(stash_entries(&root).unwrap().is_empty());
}

fn older_stashes(root: &std::path::Path) -> Vec<String> {
    for text in ["Acme older", "Northwind older"] {
        std::fs::write(root.join("notes.txt"), text).unwrap();
        git_ok(root, &["stash", "push", "-m", text]);
    }
    stash_entries(root).unwrap()
}

#[test]
fn successful_restore_keeps_two_older_stashes_in_order() {
    let (root, old, new) = repository("older-clean");
    let older = older_stashes(&root);
    std::fs::write(root.join("ledger.txt"), "mine\ntwo\nthree\n").unwrap();
    assert!(matches!(
        move_to(&root, &old, &new, true),
        MoveOutcome::Moved { .. }
    ));
    assert_eq!(stash_entries(&root).unwrap(), older);
}

#[test]
fn conflict_keeps_the_saved_files_and_older_stashes() {
    let (root, old, _) = repository("conflict");
    let older = older_stashes(&root);
    git_ok(&root, &["checkout", "main"]);
    let new = commit(
        &root,
        "ledger.txt",
        "main\ntwo\nthree\n",
        "Acme conflicting ledger",
    );
    git_ok(&root, &["checkout", "feature"]);
    std::fs::write(root.join("ledger.txt"), "mine\ntwo\nthree\n").unwrap();
    let MoveOutcome::RestoreConflict { stash, files, .. } = move_to(&root, &old, &new, true) else {
        panic!("expected a restore conflict");
    };
    assert_eq!(files, vec!["ledger.txt"]);
    assert_eq!(git_ok(&root, &["rev-parse", "HEAD"]), new);
    let entries = stash_entries(&root).unwrap();
    assert_eq!(entries[0], stash);
    assert_eq!(&entries[1..], older);
    assert!(std::fs::read_to_string(root.join("ledger.txt"))
        .unwrap()
        .contains("<<<<<<<"));
}

#[test]
fn a_push_in_another_worktree_before_verification_never_gets_applied_or_dropped() {
    let (root, old, new) = repository("race");
    let older = older_stashes(&root);
    let other = root.join("other");
    git_ok(
        &root,
        &[
            "worktree",
            "add",
            "-b",
            "other",
            other.to_str().unwrap(),
            "main",
        ],
    );
    std::fs::write(root.join("ledger.txt"), "mine\ntwo\nthree\n").unwrap();
    let other_clone = other.clone();
    AFTER_PUSH.with(|hook| {
        *hook.borrow_mut() = Some(Box::new(move |_| {
            std::fs::write(other_clone.join("notes.txt"), "other worktree\n").unwrap();
            git_ok(
                &other_clone,
                &["stash", "push", "-m", "Harborline concurrent stash"],
            );
        }))
    });
    assert!(matches!(
        move_to(&root, &old, &new, true),
        MoveOutcome::Blocked { .. }
    ));
    assert_eq!(git_ok(&root, &["rev-parse", "HEAD"]), old);
    assert_eq!(
        std::fs::read(root.join("ledger.txt")).unwrap(),
        b"mine\ntwo\nthree\n"
    );
    let entries = stash_entries(&root).unwrap();
    assert_eq!(&entries[1..], older);
    assert!(stash_message(&root, &entries[0])
        .unwrap()
        .contains("Harborline concurrent stash"));
}

#[test]
fn crash_after_stash_reports_it_and_bring_back_restores_without_moving() {
    let (root, old, new) = repository("crash");
    std::fs::write(root.join("ledger.txt"), "mine\ntwo\nthree\n").unwrap();
    std::fs::write(root.join("untracked.txt"), "untracked\n").unwrap();
    BEFORE_MOVE.with(|hook| *hook.borrow_mut() = Some(Box::new(|_| panic!("simulated crash"))));
    assert!(std::panic::catch_unwind(|| move_to(&root, &old, &new, true)).is_err());
    assert!(recover_journal(&root)
        .unwrap()
        .unwrap()
        .contains("still set aside"));
    let (sha, _) = pending_stash(&root).unwrap().unwrap();
    assert!(matches!(
        bring_back(&root, "feature", &old, &sha).unwrap(),
        MoveOutcome::FilesRestored { .. }
    ));
    assert_eq!(
        std::fs::read(root.join("ledger.txt")).unwrap(),
        b"mine\ntwo\nthree\n"
    );
    assert_eq!(
        std::fs::read(root.join("untracked.txt")).unwrap(),
        b"untracked\n"
    );
    assert!(!journal_of(&root).unwrap().exists());
    assert!(stash_entries(&root).unwrap().is_empty());
}

#[test]
fn cleanup_locks_the_shared_ref_and_keeps_a_newer_stash() {
    let (root, _, _) = repository("cleanup-race");
    let older = older_stashes(&root);
    let sha = older[0].clone();
    let message = stash_message(&root, &sha).unwrap();
    std::fs::write(root.join("notes.txt"), "newer stash\n").unwrap();
    git_ok(&root, &["stash", "push", "-m", "Cascadia newer"]);
    let newer = stash_entries(&root).unwrap()[0].clone();
    drop_own_stash(&root, &sha, &message).unwrap();
    assert_eq!(stash_entries(&root).unwrap(), vec![newer, older[1].clone()]);
}

#[test]
fn status_paths_preserve_whitespace_rename_sides_and_deduplicate() {
    assert_eq!(
        parse_dirty(" M space \n.txt\0R  new.txt\0old.txt\0 M old.txt\0?? untracked\0").unwrap(),
        vec!["new.txt", "old.txt", "space \n.txt", "untracked"]
    );
    assert!(parse_dirty("").unwrap().is_empty());
    assert!(parse_dirty("R  new.txt\0").is_err());
    assert!(parse_dirty("x\0").is_err());
    let large = format!("?? {}\0", "x".repeat(100_000));
    assert_eq!(parse_dirty(&large).unwrap()[0].len(), 100_000);
}

#[test]
fn renamed_and_file_directory_collisions_count_as_overlap() {
    let (root, _, _) = repository("rename");
    git_ok(&root, &["mv", "notes.txt", "renamed.txt"]);
    assert_eq!(
        dirty_files(&root).unwrap(),
        vec!["notes.txt", "renamed.txt"]
    );
    assert_eq!(
        overlap(
            &["assets".to_string(), "folder/notes".to_string()],
            &["assets/logo".to_string(), "folder".to_string()]
        ),
        vec!["assets", "folder/notes"]
    );
}

#[test]
fn stash_refuses_ignored_files_that_its_reset_would_overwrite() {
    let (root, _, new) = repository("ignored-reset");
    commit(
        &root,
        ".gitignore",
        "assets/private.txt\n",
        "Acme ignore private file",
    );
    let old = commit(&root, "assets", "tracked file\n", "Northwind assets");
    std::fs::remove_file(root.join("assets")).unwrap();
    std::fs::create_dir(root.join("assets")).unwrap();
    std::fs::write(root.join("assets/private.txt"), "must survive\n").unwrap();
    std::fs::write(root.join("ledger.txt"), "mine\ntwo\nthree\n").unwrap();
    assert!(matches!(
        move_to(&root, &old, &new, true),
        MoveOutcome::Blocked { .. }
    ));
    assert_eq!(
        std::fs::read(root.join("assets/private.txt")).unwrap(),
        b"must survive\n"
    );
    assert_eq!(git_ok(&root, &["rev-parse", "HEAD"]), old);
    assert!(stash_entries(&root).unwrap().is_empty());
}

#[test]
fn bring_back_rolls_back_an_interrupted_file_move_before_applying() {
    let (root, old, new) = repository("crash-files");
    std::fs::write(root.join("ledger.txt"), "mine\ntwo\nthree\n").unwrap();
    let target = new.clone();
    let original = old.clone();
    BEFORE_MOVE.with(|hook| {
        *hook.borrow_mut() = Some(Box::new(move |cwd| {
            git_ok(cwd, &["read-tree", "-m", "-u", &original, &target]);
            panic!("simulated crash after file move");
        }))
    });
    assert!(std::panic::catch_unwind(|| move_to(&root, &old, &new, true)).is_err());
    let (sha, _) = pending_stash(&root).unwrap().unwrap();
    assert!(matches!(
        bring_back(&root, "feature", &old, &sha).unwrap(),
        MoveOutcome::FilesRestored { .. }
    ));
    assert_eq!(
        std::fs::read(root.join("ledger.txt")).unwrap(),
        b"mine\ntwo\nthree\n"
    );
    assert_eq!(git_ok(&root, &["rev-parse", "HEAD"]), old);
}

#[test]
fn committed_locks_never_remove_a_new_lock_at_the_same_path() {
    let (root, _, _) = repository("lock-ownership");
    let older = older_stashes(&root);
    let sha = &older[0];
    let message = stash_message(&root, sha).unwrap();
    let log_lock = root.join(".git/logs/refs/stash.lock");
    super::AFTER_LOCK_COMMIT.with(|hook| {
        *hook.borrow_mut() = Some(Box::new(|path| {
            std::fs::write(path, "another process").unwrap();
        }))
    });
    drop_own_stash(&root, sha, &message).unwrap();
    assert_eq!(
        std::fs::read_to_string(&log_lock).unwrap(),
        "another process"
    );
    std::fs::remove_file(log_lock).unwrap();
}

#[test]
fn a_cleanup_crash_keeps_every_other_reflog_entry() {
    let (root, _, _) = repository("cleanup-crash");
    let older = older_stashes(&root);
    std::fs::write(root.join("notes.txt"), "Goodboy saved files\n").unwrap();
    git_ok(&root, &["stash", "push", "-m", "goodboy: rebase feature 1"]);
    let sha = git_ok(&root, &["rev-parse", "refs/stash"]);
    let message = stash_message(&root, &sha).unwrap();
    super::AFTER_LOG_COMMIT
        .with(|hook| *hook.borrow_mut() = Some(Box::new(|_| panic!("simulated cleanup crash"))));
    assert!(std::panic::catch_unwind(|| drop_own_stash(&root, &sha, &message)).is_err());
    let raw = std::fs::read_to_string(root.join(".git/logs/refs/stash")).unwrap();
    let remaining: Vec<&str> = raw
        .lines()
        .rev()
        .map(|line| line.split_whitespace().nth(1).unwrap())
        .collect();
    assert_eq!(remaining, older);
    assert_eq!(git_ok(&root, &["rev-parse", "refs/stash"]), sha);
}

#[test]
fn ambiguous_duplicate_stashes_are_never_deleted() {
    let (root, _, _) = repository("duplicate-stash");
    let older = older_stashes(&root);
    let sha = &older[0];
    let message = stash_message(&root, sha).unwrap();
    let log = root.join(".git/logs/refs/stash");
    let raw = std::fs::read_to_string(&log).unwrap();
    let duplicate = raw.lines().last().unwrap();
    std::fs::write(&log, format!("{raw}{duplicate}\n")).unwrap();
    let before = stash_entries(&root).unwrap();
    assert!(drop_own_stash(&root, sha, &message).is_err());
    assert_eq!(stash_entries(&root).unwrap(), before);
}

#[test]
fn a_dropped_entry_before_verification_is_recovered_by_its_exact_object() {
    let (root, old, new) = repository("dropped-race");
    let older = older_stashes(&root);
    std::fs::write(root.join("ledger.txt"), "mine\ntwo\nthree\n").unwrap();
    std::fs::write(root.join("untracked.txt"), "untracked\n").unwrap();
    AFTER_PUSH.with(|hook| {
        *hook.borrow_mut() = Some(Box::new(|cwd| {
            git_ok(cwd, &["stash", "drop"]);
        }));
    });
    assert!(matches!(
        move_to(&root, &old, &new, true),
        MoveOutcome::Blocked { .. }
    ));
    assert_eq!(git_ok(&root, &["rev-parse", "HEAD"]), old);
    assert_eq!(
        std::fs::read(root.join("ledger.txt")).unwrap(),
        b"mine\ntwo\nthree\n"
    );
    assert_eq!(
        std::fs::read(root.join("untracked.txt")).unwrap(),
        b"untracked\n"
    );
    assert_eq!(stash_entries(&root).unwrap(), older);
    assert!(!journal_of(&root).unwrap().exists());
}

#[test]
fn a_recorded_stash_can_be_restored_after_its_shared_entry_is_dropped() {
    let (root, old, new) = repository("dropped-recovery");
    std::fs::write(root.join("ledger.txt"), "mine\ntwo\nthree\n").unwrap();
    BEFORE_MOVE.with(|hook| *hook.borrow_mut() = Some(Box::new(|_| panic!("simulated crash"))));
    assert!(std::panic::catch_unwind(|| move_to(&root, &old, &new, true)).is_err());
    let (sha, _) = pending_stash(&root).unwrap().unwrap();
    git_ok(&root, &["stash", "drop"]);
    assert_eq!(pending_stash(&root).unwrap().unwrap().0, sha);
    assert!(matches!(
        bring_back(&root, "feature", &old, &sha).unwrap(),
        MoveOutcome::FilesRestored { .. }
    ));
    assert_eq!(
        std::fs::read(root.join("ledger.txt")).unwrap(),
        b"mine\ntwo\nthree\n"
    );
    assert!(git_ok(
        &root,
        &["for-each-ref", "--format=%(refname)", "refs/goodboy/stash"]
    )
    .is_empty());
}

#[test]
fn unresolved_stash_intent_is_never_deleted_as_a_clean_rewrite() {
    let (root, old, new) = repository("missing-intent");
    let journal = journal_of(&root).unwrap();
    std::fs::write(
        &journal,
        format!(
            "{old}\n{new}\nbackup\nfeature\nstash pending\nOn feature: goodboy: rebase feature 1\n"
        ),
    )
    .unwrap();
    assert!(recover_journal(&root).is_err());
    assert!(journal.exists());
    assert_eq!(git_ok(&root, &["rev-parse", "HEAD"]), old);
}

#[test]
fn path_case_policy_protects_ignored_directory_collisions() {
    let (root, _, new) = repository("ignored-case");
    git_ok(&root, &["config", "core.ignorecase", "true"]);
    commit(
        &root,
        ".gitignore",
        "Assets/private.txt\n",
        "Acme ignore case",
    );
    let old = commit(&root, "assets", "tracked file\n", "Northwind assets");
    std::fs::remove_file(root.join("assets")).unwrap();
    std::fs::create_dir(root.join("Assets")).unwrap();
    std::fs::write(root.join("Assets/private.txt"), "must survive\n").unwrap();
    std::fs::write(root.join("ledger.txt"), "mine\ntwo\nthree\n").unwrap();
    assert!(matches!(
        move_to(&root, &old, &new, true),
        MoveOutcome::Blocked { .. }
    ));
    assert_eq!(
        std::fs::read(root.join("Assets/private.txt")).unwrap(),
        b"must survive\n"
    );
    assert!(stash_entries(&root).unwrap().is_empty());
}

#[test]
fn cleanup_failure_keeps_the_stash_and_reports_the_completed_move() {
    let (root, old, new) = repository("cleanup-busy");
    let older = older_stashes(&root);
    std::fs::write(root.join("ledger.txt"), "mine\ntwo\nthree\n").unwrap();
    BEFORE_MOVE.with(|hook| {
        *hook.borrow_mut() = Some(Box::new(|cwd| {
            std::fs::write(cwd.join(".git/refs/stash.lock"), "another writer").unwrap();
        }));
    });
    let MoveOutcome::Moved {
        head,
        cleanup_error: Some(error),
        ..
    } = move_to(&root, &old, &new, true)
    else {
        panic!("expected the completed move with a cleanup warning");
    };
    assert_eq!(head, new);
    assert!(error.contains("Stash"));
    assert_eq!(
        std::fs::read(root.join("ledger.txt")).unwrap(),
        b"mine\ntwo\nthree\nfour\n"
    );
    let entries = stash_entries(&root).unwrap();
    assert_eq!(&entries[1..], older);
    assert!(pending_stash(&root).unwrap().is_none());
    std::fs::remove_file(root.join(".git/refs/stash.lock")).unwrap();
}

#[test]
fn undo_requires_consent_and_restores_files_with_a_kept_backup() {
    let (root, old, new) = repository("dirty-undo");
    assert!(matches!(
        move_to(&root, &old, &new, false),
        MoveOutcome::Moved { .. }
    ));
    std::fs::write(root.join("ledger.txt"), "mine\ntwo\nthree\nfour\n").unwrap();
    assert!(matches!(
        move_branch_with(&root, "feature", &new, &old, true, false).unwrap(),
        MoveOutcome::NeedsStash { .. }
    ));
    let MoveOutcome::Moved {
        head,
        backup_ref,
        cleanup_error: None,
        ..
    } = move_branch_with(&root, "feature", &new, &old, true, true).unwrap()
    else {
        panic!("expected the old history with restored files");
    };
    assert_eq!(head, old);
    assert_eq!(git_ok(&root, &["rev-parse", &backup_ref]), new);
    assert!(backup_ref.contains("/keep-"));
    assert_eq!(
        std::fs::read(root.join("ledger.txt")).unwrap(),
        b"mine\ntwo\nthree\n"
    );
    assert!(stash_entries(&root).unwrap().is_empty());
}
