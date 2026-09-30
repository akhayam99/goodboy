use super::{run_plan, RunOutcome};
use crate::history::commits::is_ancestor;
use crate::history::fixtures::{
    commit, fold, git_ok, ledger, ledger_plan, picks, plan, run_args, run_ok, slug, step, subjects,
    tried, worktree_count,
};
use crate::history::journal::journal_of;
use crate::history::predict::predict;
use crate::history::reservation::copy_path_of;
use crate::history::types::{HistoryVerb, StepOutcome, StopKind, TrialProgress};

#[test]
fn reordering_independent_commits_keeps_the_same_code_and_passes_the_check() {
    let l = ledger("run-reorder");
    let result = run_ok(
        &l,
        picks(&[
            &l.export, &l.webhook, &l.batch, &l.retries, &l.logging, &l.tests, &l.typo,
        ]),
        "run-reorder",
    );
    assert!(result.is_tree_equal);
    assert!(result.check.unwrap().expects_same_code);
    let head = result.head.unwrap();
    assert_eq!(
        subjects(&l.root, &format!("{}..{head}", l.base))[5],
        "Fix webhook signature check"
    );
}

#[test]
fn folding_into_an_older_commit_keeps_only_the_target_title() {
    let l = ledger("run-fixup-older");
    let mut steps = picks(&[
        &l.export, &l.batch, &l.webhook, &l.retries, &l.logging, &l.tests,
    ]);
    steps.push(fold(&l.typo, &l.export, HistoryVerb::Fixup));
    let result = run_ok(&l, steps, "run-fixup-older");
    assert!(result.is_tree_equal);
    let head = result.head.unwrap();
    let listed = subjects(&l.root, &format!("{}..{head}", l.base));
    assert_eq!(listed.len(), 6);
    assert_eq!(listed[5], "Add ledger export endpoint");
    assert!(!listed.iter().any(|s| s == "Fix typo in CSV header"));
    let first = git_ok(
        &l.root,
        &["rev-list", "--reverse", &format!("{}..{head}", l.base)],
    );
    let oldest = first.lines().next().unwrap();
    assert_eq!(
        git_ok(&l.root, &["log", "-1", "--format=%B", oldest]),
        "Add ledger export endpoint"
    );
}

#[test]
fn folding_into_a_newer_commit_moves_it_up_and_keeps_the_newer_title() {
    let l = ledger("run-fixup-newer");
    let steps = vec![
        fold(&l.export, &l.batch, HistoryVerb::Fixup),
        step(&l.batch, HistoryVerb::Pick),
        step(&l.webhook, HistoryVerb::Pick),
        step(&l.retries, HistoryVerb::Pick),
        step(&l.logging, HistoryVerb::Pick),
        step(&l.tests, HistoryVerb::Pick),
        step(&l.typo, HistoryVerb::Pick),
    ];
    let result = run_ok(&l, steps, "run-fixup-newer");
    assert!(result.is_tree_equal);
    let head = result.head.unwrap();
    let listed = subjects(&l.root, &format!("{}..{head}", l.base));
    assert_eq!(listed.last().unwrap(), "Stream rows in batches of 500");
    assert_eq!(listed.len(), 6);
}

#[test]
fn combining_with_a_target_keeps_both_messages() {
    let l = ledger("run-squash-target");
    let mut steps = picks(&[&l.export, &l.batch, &l.webhook, &l.retries, &l.logging]);
    steps.push(fold(&l.tests, &l.retries, HistoryVerb::Squash));
    steps.push(step(&l.typo, HistoryVerb::Pick));
    let result = run_ok(&l, steps, "run-squash-target");
    let head = result.head.unwrap();
    let listed = subjects(&l.root, &format!("{}..{head}", l.base));
    assert_eq!(listed.len(), 6);
    let combined = git_ok(&l.root, &["log", "-1", "--format=%B", &format!("{head}~2")]);
    assert!(combined.starts_with("Add retries to the export job"));
    assert!(combined.contains("wip export tests"));
    assert!(result.is_tree_equal);
}

#[test]
fn a_fold_into_a_commit_that_folds_elsewhere_follows_the_chain() {
    let l = ledger("run-chain");
    let steps = vec![
        step(&l.export, HistoryVerb::Pick),
        step(&l.batch, HistoryVerb::Pick),
        step(&l.webhook, HistoryVerb::Pick),
        step(&l.retries, HistoryVerb::Pick),
        fold(&l.logging, &l.tests, HistoryVerb::Fixup),
        fold(&l.tests, &l.retries, HistoryVerb::Squash),
        step(&l.typo, HistoryVerb::Pick),
    ];
    let result = run_ok(&l, steps, "run-chain");
    assert!(result.is_tree_equal);
    let head = result.head.unwrap();
    assert_eq!(subjects(&l.root, &format!("{}..{head}", l.base)).len(), 5);
}

#[test]
fn renaming_changes_only_the_message() {
    let l = ledger("run-reword");
    let mut steps = picks(&[&l.export, &l.batch]);
    let mut reword = step(&l.webhook, HistoryVerb::Reword);
    reword.message = Some("Verify webhook signatures before crediting".to_string());
    steps.push(reword);
    steps.extend(picks(&[&l.retries, &l.logging, &l.tests, &l.typo]));
    let result = run_ok(&l, steps, "run-reword");
    assert!(result.is_tree_equal);
    let head = result.head.unwrap();
    assert!(subjects(&l.root, &format!("{}..{head}", l.base))
        .contains(&"Verify webhook signatures before crediting".to_string()));
}

#[test]
fn removing_a_commit_changes_only_its_own_files() {
    let l = ledger("run-drop");
    let mut steps = picks(&[&l.export, &l.batch, &l.webhook, &l.retries]);
    steps.push(step(&l.logging, HistoryVerb::Drop));
    steps.extend(picks(&[&l.tests, &l.typo]));
    let result = run_ok(&l, steps, "run-drop");
    assert!(!result.is_tree_equal);
    assert_eq!(result.changed_files, vec!["logger.ts".to_string()]);
    let check = result.check.unwrap();
    assert_eq!(check.removed_files, vec!["logger.ts".to_string()]);
    assert!(!check.expects_same_code);
}

#[test]
fn starting_from_today_main_replays_the_branch_on_top_of_it() {
    let l = ledger("run-onto");
    git_ok(&l.root, &["checkout", "-q", "main"]);
    commit(&l.root, "rounding.ts", "round\n", "Cascadia rounding rules");
    let main = commit(&l.root, "keys.ts", "keys\n", "Rotate Acme sandbox keys");
    git_ok(&l.root, &["checkout", "-q", "feature"]);
    let mut args = ledger_plan(
        &l,
        picks(&[
            &l.export, &l.batch, &l.webhook, &l.retries, &l.logging, &l.tests, &l.typo,
        ]),
    );
    args.onto = Some(main.clone());
    let prediction = predict(&args).unwrap();
    assert!(prediction.head.is_some());
    let result = tried(run_plan(&run_args(&l.root, args), &slug("run-onto"), &|_| {}).unwrap());
    let check = result.check.unwrap();
    assert!(check.is_passed, "{:?}", check.problems);
    let head = result.head.unwrap();
    assert!(is_ancestor(&l.root, &main, &head));
    assert_eq!(subjects(&l.root, &format!("{main}..{head}")).len(), 7);
    assert_eq!(git_ok(&l.root, &["rev-parse", "HEAD"]), l.typo);
}

#[test]
fn a_mixed_plan_of_every_action_passes_the_check() {
    let l = ledger("run-mixed");
    let mut reword = step(&l.webhook, HistoryVerb::Reword);
    reword.message = Some("Verify webhook signatures before crediting".to_string());
    let steps = vec![
        step(&l.export, HistoryVerb::Pick),
        step(&l.batch, HistoryVerb::Pick),
        step(&l.retries, HistoryVerb::Pick),
        reword,
        step(&l.logging, HistoryVerb::Drop),
        fold(&l.tests, &l.retries, HistoryVerb::Squash),
        fold(&l.typo, &l.export, HistoryVerb::Fixup),
    ];
    let result = run_ok(&l, steps, "run-mixed");
    let head = result.head.unwrap();
    assert_eq!(
        subjects(&l.root, &format!("{}..{head}", l.base)),
        vec![
            "Verify webhook signatures before crediting",
            "Add retries to the export job",
            "Stream rows in batches of 500",
            "Add ledger export endpoint",
        ]
    );
    assert_eq!(result.changed_files, vec!["logger.ts".to_string()]);
}

#[test]
fn a_conflict_stops_names_the_step_discards_the_copy_and_leaves_the_branch() {
    let l = ledger("run-conflict");
    let events = std::sync::Mutex::new(Vec::new());
    let steps = vec![
        step(&l.typo, HistoryVerb::Pick),
        step(&l.export, HistoryVerb::Pick),
        step(&l.batch, HistoryVerb::Pick),
        step(&l.webhook, HistoryVerb::Pick),
        step(&l.retries, HistoryVerb::Pick),
        step(&l.logging, HistoryVerb::Pick),
        step(&l.tests, HistoryVerb::Pick),
    ];
    let result = tried(
        run_plan(
            &run_args(&l.root, ledger_plan(&l, steps)),
            &slug("run-conflict"),
            &|event| events.lock().unwrap().push(event),
        )
        .unwrap(),
    );
    let stop = result.stop.unwrap();
    assert_eq!(stop.sha, l.typo);
    assert_eq!(stop.kind, StopKind::Merge);
    assert_eq!(stop.files, vec!["export.ts".to_string()]);
    assert_eq!(result.head, None);
    assert_eq!(result.check, None);
    assert_eq!(result.copy_path, None);
    assert_eq!(git_ok(&l.root, &["rev-parse", "HEAD"]), l.typo);
    assert_eq!(git_ok(&l.root, &["status", "--porcelain"]), "");
    assert_eq!(worktree_count(&l.root), 1);
    assert!(!copy_path_of(&slug("run-conflict")).exists());
    assert_eq!(events.lock().unwrap().last(), Some(&TrialProgress::Cleanup));
}

#[test]
fn progress_reports_the_copy_every_step_the_check_and_the_cleanup() {
    let l = ledger("run-progress");
    let events = std::sync::Mutex::new(Vec::new());
    let steps = picks(&[
        &l.export, &l.batch, &l.webhook, &l.retries, &l.logging, &l.tests, &l.typo,
    ]);
    tried(
        run_plan(
            &run_args(&l.root, ledger_plan(&l, steps)),
            &slug("run-progress"),
            &|event| events.lock().unwrap().push(event),
        )
        .unwrap(),
    );
    let seen = events.lock().unwrap().clone();
    assert_eq!(seen.first(), Some(&TrialProgress::Copy));
    assert_eq!(
        seen[1],
        TrialProgress::Step {
            index: 1,
            total: 7,
            sha: l.export.clone()
        }
    );
    assert_eq!(seen.len(), 10);
    assert_eq!(seen[8], TrialProgress::Check);
    assert_eq!(seen[9], TrialProgress::Cleanup);
}

#[test]
fn a_dirty_worktree_blocks_the_run_before_any_copy_is_made() {
    let l = ledger("run-dirty");
    std::fs::write(l.root.join("export.ts"), "half done\n").unwrap();
    let outcome = run_plan(
        &run_args(&l.root, ledger_plan(&l, picks(&[&l.export]))),
        &slug("run-dirty"),
        &|_| panic!("a blocked run must not start"),
    )
    .unwrap();
    let RunOutcome::Blocked { reason } = outcome else {
        panic!("expected the dirty worktree to block the run");
    };
    assert!(reason.contains("not committed"), "{reason}");
    assert_eq!(worktree_count(&l.root), 1);
    assert_eq!(
        std::fs::read_to_string(l.root.join("export.ts")).unwrap(),
        "half done\n"
    );
}

#[test]
fn a_moved_head_or_another_branch_blocks_the_run() {
    let l = ledger("run-moved");
    let stale = plan(&l.root, &l.base, &l.tests, picks(&[&l.export]));
    let RunOutcome::Blocked { reason } =
        run_plan(&run_args(&l.root, stale), &slug("run-moved"), &|_| {}).unwrap()
    else {
        panic!("expected the moved head to block");
    };
    assert!(reason.contains("moved"), "{reason}");
    git_ok(&l.root, &["checkout", "-q", "-b", "other"]);
    let RunOutcome::Blocked { reason } = run_plan(
        &run_args(&l.root, ledger_plan(&l, picks(&[&l.export]))),
        &slug("run-branch"),
        &|_| {},
    )
    .unwrap() else {
        panic!("expected the other branch to block");
    };
    assert!(reason.contains("not feature"), "{reason}");
}

#[test]
fn a_failing_commit_hook_stops_the_trial_and_discards_the_copy() {
    let l = ledger("run-hook");
    let hooks = l.root.join(".git").join("hooks");
    std::fs::create_dir_all(&hooks).unwrap();
    let hook = hooks.join("commit-msg");
    std::fs::write(&hook, "#!/bin/sh\necho refused by policy\nexit 1\n").unwrap();
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(&hook, std::fs::Permissions::from_mode(0o755)).unwrap();
    }
    let mut reword = step(&l.export, HistoryVerb::Reword);
    reword.message = Some("Add the ledger export endpoint".to_string());
    let mut steps = vec![reword];
    steps.extend(picks(&[
        &l.batch, &l.webhook, &l.retries, &l.logging, &l.tests, &l.typo,
    ]));
    let result = tried(
        run_plan(
            &run_args(&l.root, ledger_plan(&l, steps)),
            &slug("run-hook"),
            &|_| {},
        )
        .unwrap(),
    );
    let stop = result.stop.unwrap();
    assert_eq!(stop.kind, StopKind::Hook);
    assert!(stop.message.contains("refused by policy"));
    assert_eq!(worktree_count(&l.root), 1);
    assert_eq!(git_ok(&l.root, &["rev-parse", "HEAD"]), l.typo);
}

#[test]
fn starting_from_a_main_that_changed_the_same_lines_stops_and_leaves_the_branch() {
    let l = ledger("run-onto-conflict");
    git_ok(&l.root, &["checkout", "-q", "main"]);
    let main = commit(
        &l.root,
        "export.ts",
        "export from main\n",
        "Cascadia rounding rules",
    );
    git_ok(&l.root, &["checkout", "-q", "feature"]);
    let mut args = ledger_plan(
        &l,
        picks(&[
            &l.export, &l.batch, &l.webhook, &l.retries, &l.logging, &l.tests, &l.typo,
        ]),
    );
    args.onto = Some(main);
    let prediction = predict(&args).unwrap();
    assert_eq!(prediction.steps[0].outcome, StepOutcome::Conflict);
    let result = tried(
        run_plan(
            &run_args(&l.root, args),
            &slug("run-onto-conflict"),
            &|_| {},
        )
        .unwrap(),
    );
    assert_eq!(result.stop.unwrap().sha, l.export);
    assert_eq!(git_ok(&l.root, &["rev-parse", "HEAD"]), l.typo);
    assert_eq!(worktree_count(&l.root), 1);
}

#[test]
fn a_crash_after_the_files_moved_is_settled_before_the_next_run_checks_cleanliness() {
    let l = ledger("run-after-crash");
    let mut steps = picks(&[&l.export, &l.batch, &l.webhook, &l.retries, &l.logging]);
    steps.push(step(&l.tests, HistoryVerb::Drop));
    steps.push(step(&l.typo, HistoryVerb::Pick));
    let head = run_ok(&l, steps, "run-after-crash").head.unwrap();
    git_ok(&l.root, &["read-tree", "-m", "-u", &l.typo, &head]);
    let journal = journal_of(&l.root).unwrap();
    std::fs::write(&journal, format!("{}\n{head}\nref\nfeature\n", l.typo)).unwrap();
    let outcome = run_plan(
        &run_args(&l.root, ledger_plan(&l, picks(&[&l.export]))),
        &slug("run-after-crash-next"),
        &|_| {},
    )
    .unwrap();
    let RunOutcome::Blocked { reason } = outcome else {
        panic!("the plan was made before the finished rewrite, so it should not run");
    };
    assert!(!reason.contains("not committed"), "{reason}");
    assert!(!journal.exists());
    assert_eq!(git_ok(&l.root, &["rev-parse", "refs/heads/feature"]), head);
    assert_eq!(git_ok(&l.root, &["status", "--porcelain"]), "");
}
