use super::trial;
use crate::history::fixtures::{
    branch, git_ok, ledger, ledger_plan, picks, plan, slug, step, subjects, worktree_count,
};
use crate::history::reservation::{copy_path_of, discard_copy};
use crate::history::types::{HistoryVerb, StopKind};
use std::path::Path;

#[test]
fn the_trial_replays_every_verb_and_keeps_authors() {
    let b = branch("trial-verbs");
    let mut reword = step(&b.c, HistoryVerb::Reword);
    reword.message = Some("C adds release notes".to_string());
    let args = plan(
        &b.root,
        &b.base,
        &b.c,
        vec![
            step(&b.a, HistoryVerb::Pick),
            step(&b.b, HistoryVerb::Squash),
            reword,
        ],
    );
    let trial_slug = slug("trial-verbs");
    let result = trial(&args, &trial_slug, false).unwrap();
    assert_eq!(result.stop, None);
    assert!(result.is_tree_equal);
    let head = result.head.unwrap();
    assert_eq!(
        subjects(&b.root, &format!("{}..{head}", b.base)),
        vec!["C adds release notes", "A edits the policy"]
    );
    let body = git_ok(&b.root, &["log", "-1", "--format=%B", &format!("{head}~1")]);
    assert!(body.contains("B edits the policy again"));
    assert_eq!(
        git_ok(&b.root, &["log", "-1", "--format=%an", &head]),
        "test"
    );
    assert_eq!(result.map.len(), 3);
    assert_eq!(git_ok(&b.root, &["rev-parse", "HEAD"]), b.c);
    assert!(!copy_path_of(&trial_slug).exists());
}

#[test]
fn a_conflicting_trial_leaves_the_branch_untouched() {
    let b = branch("trial-conflict");
    let args = plan(
        &b.root,
        &b.base,
        &b.c,
        vec![step(&b.b, HistoryVerb::Pick), step(&b.a, HistoryVerb::Pick)],
    );
    let result = trial(&args, &slug("trial-conflict"), true).unwrap();
    let stop = result.stop.unwrap();
    assert_eq!(stop.kind, StopKind::Merge);
    assert_eq!(stop.files, vec!["policy.txt".to_string()]);
    assert_eq!(git_ok(&b.root, &["rev-parse", "HEAD"]), b.c);
    let copy = result.copy_path.unwrap();
    assert!(Path::new(&copy).exists());
    discard_copy(&copy);
}

#[test]
fn a_hook_that_changes_the_content_fails_the_check_of_a_clean_replay() {
    let l = ledger("hook-changes-content");
    let hooks = l.root.join(".git").join("hooks");
    std::fs::create_dir_all(&hooks).unwrap();
    let hook = hooks.join("pre-commit");
    std::fs::write(
        &hook,
        "#!/bin/sh\necho injected >> hook.txt\ngit add hook.txt\n",
    )
    .unwrap();
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
    let prepared = trial(&ledger_plan(&l, steps), &slug("hook-changes-content"), true).unwrap();
    assert_eq!(prepared.stop, None);
    assert!(prepared.head.is_some());
    let check = prepared.check.unwrap();
    assert!(!check.is_passed);
    assert_eq!(check.unexpected_files, vec!["hook.txt".to_string()]);
    assert_eq!(git_ok(&l.root, &["rev-parse", "HEAD"]), l.typo);
    assert_eq!(worktree_count(&l.root), 1);
}
