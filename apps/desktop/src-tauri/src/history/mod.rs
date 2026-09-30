mod apply;
mod backups;
mod check;
mod commits;
mod copies;
mod journal;
mod merge_tree;
mod plan;
mod predict;
mod preflight;
mod rebase;
mod remote;
mod reservation;
mod rewriter;
mod run;
mod runner;
mod trial;
mod types;

pub(crate) use apply::*;
pub(crate) use backups::*;
pub(crate) use copies::*;
pub(crate) use predict::*;
pub(crate) use rebase::*;
pub(crate) use remote::*;
#[cfg(test)]
pub(crate) use reservation::reservations_dir;
pub(crate) use rewriter::*;
pub(crate) use run::*;
pub(crate) use runner::*;
pub(crate) use trial::*;

#[cfg(test)]
mod tests {
    use super::check::*;
    use super::commits::*;
    use super::journal::*;
    use super::merge_tree::*;
    use super::plan::*;
    use super::reservation::*;
    use super::types::*;
    use super::*;
    use crate::proc::git::Git;
    use crate::worktree::git;
    use std::path::{Path, PathBuf};

    fn slug(name: &str) -> String {
        format!("{name}-{}-{}", std::process::id(), now_nanos())
    }

    fn temp_root(name: &str) -> PathBuf {
        let root = std::env::temp_dir().join(format!(
            "goodboy-history-test-{name}-{}-{}",
            std::process::id(),
            now_nanos()
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

    fn step(sha: &str, verb: HistoryVerb) -> HistoryStep {
        HistoryStep {
            sha: sha.to_string(),
            verb,
            message: None,
            target: None,
        }
    }

    fn plan(root: &Path, base: &str, head: &str, steps: Vec<HistoryStep>) -> HistoryPlanArgs {
        HistoryPlanArgs {
            worktree_path: root.to_string_lossy().into_owned(),
            base: base.to_string(),
            head: head.to_string(),
            steps,
            onto: None,
        }
    }

    struct Branch {
        root: PathBuf,
        base: String,
        a: String,
        b: String,
        c: String,
    }

    fn branch(name: &str) -> Branch {
        let root = init_repo(name);
        let base = commit(&root, "policy.txt", "one\n", "base");
        git_ok(&root, &["checkout", "-b", "feature"]);
        let a = commit(&root, "policy.txt", "two\n", "A edits the policy");
        let b = commit(&root, "policy.txt", "three\n", "B edits the policy again");
        let c = commit(&root, "notes.txt", "notes\n", "C adds notes");
        Branch {
            root,
            base,
            a,
            b,
            c,
        }
    }

    fn subjects(root: &Path, range: &str) -> Vec<String> {
        git_ok(root, &["log", "--format=%s", range])
            .lines()
            .map(str::to_string)
            .collect()
    }

    #[test]
    fn git_versions_parse_with_vendor_suffixes() {
        assert_eq!(
            parse_git_version("git version 2.50.1 (Apple Git-155)"),
            Some((2, 50))
        );
        assert_eq!(parse_git_version("git version 2.39.0"), Some((2, 39)));
        assert!(Some((2, 39)) < Some(MERGE_TREE_BASE_MIN));
        assert_eq!(parse_git_version("nonsense"), None);
    }

    #[test]
    fn a_plan_without_moves_predicts_the_same_tree() {
        let b = branch("predict-same");
        let args = plan(
            &b.root,
            &b.base,
            &b.c,
            vec![
                step(&b.a, HistoryVerb::Pick),
                step(&b.b, HistoryVerb::Pick),
                step(&b.c, HistoryVerb::Pick),
            ],
        );
        let prediction = predict(&args).unwrap();
        assert!(prediction.is_supported);
        assert!(prediction.is_tree_equal);
        assert!(prediction
            .steps
            .iter()
            .all(|step| step.outcome == StepOutcome::Clean));
        assert_eq!(git_ok(&b.root, &["status", "--porcelain"]), "");
    }

    #[test]
    fn moving_a_commit_above_its_neighbour_predicts_the_conflict() {
        let b = branch("predict-reorder");
        let args = plan(
            &b.root,
            &b.base,
            &b.c,
            vec![
                step(&b.b, HistoryVerb::Pick),
                step(&b.a, HistoryVerb::Pick),
                step(&b.c, HistoryVerb::Pick),
            ],
        );
        let prediction = predict(&args).unwrap();
        assert_eq!(prediction.steps[0].outcome, StepOutcome::Conflict);
        assert_eq!(prediction.steps[0].files, vec!["policy.txt".to_string()]);
        assert_eq!(prediction.steps[1].outcome, StepOutcome::Blocked);
        assert_eq!(prediction.head, None);
    }

    #[test]
    fn dropping_a_commit_its_neighbour_builds_on_conflicts() {
        let b = branch("predict-drop");
        let args = plan(
            &b.root,
            &b.base,
            &b.c,
            vec![
                step(&b.a, HistoryVerb::Drop),
                step(&b.b, HistoryVerb::Pick),
                step(&b.c, HistoryVerb::Pick),
            ],
        );
        let prediction = predict(&args).unwrap();
        assert_eq!(prediction.steps[0].outcome, StepOutcome::Dropped);
        assert_eq!(prediction.steps[1].outcome, StepOutcome::Conflict);
    }

    #[test]
    fn dropping_an_independent_commit_changes_the_code() {
        let b = branch("predict-drop-clean");
        let args = plan(
            &b.root,
            &b.base,
            &b.c,
            vec![
                step(&b.a, HistoryVerb::Pick),
                step(&b.b, HistoryVerb::Pick),
                step(&b.c, HistoryVerb::Drop),
            ],
        );
        let prediction = predict(&args).unwrap();
        assert!(!prediction.is_tree_equal);
        assert_eq!(prediction.changed_files, vec!["notes.txt".to_string()]);
    }

    #[test]
    fn a_commit_whose_changes_are_already_there_predicts_empty() {
        let root = init_repo("predict-empty");
        let base = commit(&root, "a.txt", "one\n", "base");
        git_ok(&root, &["checkout", "-b", "feature"]);
        let first = commit(&root, "a.txt", "two\n", "first");
        let revert = commit(&root, "a.txt", "one\n", "revert");
        let again = commit(&root, "a.txt", "two\n", "again");
        let args = plan(
            &root,
            &base,
            &again,
            vec![
                step(&first, HistoryVerb::Pick),
                step(&revert, HistoryVerb::Drop),
                step(&again, HistoryVerb::Pick),
            ],
        );
        let prediction = predict(&args).unwrap();
        assert_eq!(prediction.steps[2].outcome, StepOutcome::Empty);
        assert!(prediction.is_tree_equal);
    }

    #[test]
    fn folding_moves_the_commit_under_its_target_and_keeps_the_target_message() {
        let b = branch("predict-fold");
        let mut fold = step(&b.c, HistoryVerb::Fixup);
        fold.target = Some(b.a.clone());
        let args = plan(
            &b.root,
            &b.base,
            &b.c,
            vec![
                step(&b.a, HistoryVerb::Pick),
                step(&b.b, HistoryVerb::Pick),
                fold,
            ],
        );
        let prediction = predict(&args).unwrap();
        assert!(prediction.is_tree_equal);
        let head = prediction.head.unwrap();
        assert_eq!(
            subjects(&b.root, &format!("{}..{head}", b.base)),
            vec!["B edits the policy again", "A edits the policy"]
        );
        assert_eq!(prediction.steps[0].new_sha, prediction.steps[2].new_sha);
    }

    #[test]
    fn squash_needs_an_older_commit() {
        let b = branch("predict-squash-first");
        let args = plan(
            &b.root,
            &b.base,
            &b.c,
            vec![
                step(&b.a, HistoryVerb::Squash),
                step(&b.b, HistoryVerb::Pick),
            ],
        );
        assert!(predict(&args).is_err());
    }

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
    fn commits_origin_gained_after_the_apply_come_into_the_plan_and_push_with_lease() {
        let b = branch("origin-ahead");
        let remote = b.root.join("remote.git");
        git_ok(&b.root, &["init", "--bare", remote.to_str().unwrap()]);
        git_ok(
            &b.root,
            &["remote", "add", "origin", remote.to_str().unwrap()],
        );
        git_ok(&b.root, &["push", "-u", "origin", "feature"]);
        let other = b.root.join("other");
        git_ok(
            &b.root,
            &[
                "clone",
                "-q",
                "-b",
                "feature",
                remote.to_str().unwrap(),
                other.to_str().unwrap(),
            ],
        );
        git_ok(&other, &["config", "user.email", "test@example.com"]);
        git_ok(&other, &["config", "user.name", "teammate"]);
        let theirs = commit(&other, "teammate.txt", "hello\n", "Teammate adds a note");
        git_ok(&other, &["push", "-q", "origin", "feature"]);
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
        let rewritten = trial(&args, &slug("origin-ahead"), false)
            .unwrap()
            .head
            .unwrap();
        move_branch_blocking(&b.root, "feature", &b.c, &rewritten).unwrap();

        let ahead = origin_ahead(&b.root, "feature", Some(&b.c), None).unwrap();
        assert_eq!(ahead.remote_sha, theirs);
        assert_eq!(
            ahead
                .commits
                .iter()
                .map(|c| c.sha.clone())
                .collect::<Vec<_>>(),
            vec![theirs.clone()]
        );
        let bring = plan(
            &b.root,
            &rewritten,
            &rewritten,
            vec![step(&theirs, HistoryVerb::Pick)],
        );
        let joined = trial(&bring, &slug("origin-bring"), false)
            .unwrap()
            .head
            .unwrap();
        move_branch_blocking(&b.root, "feature", &rewritten, &joined).unwrap();
        let cwd = b.root.to_string_lossy().into_owned();
        let pushed = crate::github::run_git_authenticated(
            &[
                "push",
                &crate::github::lease_argument("feature", Some(&ahead.remote_sha)),
                "origin",
                "refs/heads/feature:refs/heads/feature",
            ],
            &cwd,
            None,
        )
        .unwrap();
        assert_eq!(
            crate::github::lease_push_outcome(&pushed),
            crate::github::LeasePushOutcome::Pushed
        );
        assert_eq!(
            subjects(&b.root, &format!("{}..feature", b.base)),
            vec!["Teammate adds a note", "C adds notes", "A edits the policy"]
        );
    }

    #[test]
    fn the_lease_push_refuses_when_origin_moved() {
        let b = branch("lease-push");
        let remote = b.root.join("remote.git");
        git_ok(&b.root, &["init", "--bare", remote.to_str().unwrap()]);
        git_ok(
            &b.root,
            &["remote", "add", "origin", remote.to_str().unwrap()],
        );
        git_ok(&b.root, &["push", "-u", "origin", "feature"]);
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
        let new_head = trial(&args, &slug("lease-push"), false)
            .unwrap()
            .head
            .unwrap();
        move_branch_blocking(&b.root, "feature", &b.c, &new_head).unwrap();
        let cwd = b.root.to_string_lossy().into_owned();
        let refspec = "refs/heads/feature:refs/heads/feature";
        let stale = crate::github::run_git_authenticated(
            &[
                "push",
                &crate::github::lease_argument("feature", Some(&b.b)),
                "origin",
                refspec,
            ],
            &cwd,
            None,
        )
        .unwrap();
        assert!(matches!(
            crate::github::lease_push_outcome(&stale),
            crate::github::LeasePushOutcome::Stale { .. }
        ));
        let fresh = crate::github::run_git_authenticated(
            &[
                "push",
                &crate::github::lease_argument("feature", Some(&b.c)),
                "origin",
                refspec,
            ],
            &cwd,
            None,
        )
        .unwrap();
        assert_eq!(
            crate::github::lease_push_outcome(&fresh),
            crate::github::LeasePushOutcome::Pushed
        );
        assert_eq!(
            git_ok(&remote, &["rev-parse", "refs/heads/feature"]),
            new_head
        );
    }

    fn with_remote(b: &Branch) -> PathBuf {
        let remote = b.root.join("remote.git");
        git_ok(&b.root, &["init", "--bare", remote.to_str().unwrap()]);
        git_ok(
            &b.root,
            &["remote", "add", "origin", remote.to_str().unwrap()],
        );
        git_ok(&b.root, &["push", "origin", "main", "feature"]);
        remote
    }

    #[test]
    fn a_rebase_plan_lists_the_branch_commits_onto_origin() {
        let b = branch("rebase-plan");
        with_remote(&b);
        git_ok(&b.root, &["checkout", "main"]);
        let upstream = commit(&b.root, "readme.txt", "hello\n", "main moves on");
        git_ok(&b.root, &["push", "origin", "main"]);
        git_ok(&b.root, &["checkout", "feature"]);
        let plan = rebase_plan(&b.root, Some("main"), true).unwrap();
        assert_eq!(plan.onto, upstream);
        assert_eq!(plan.onto_ref, "origin/main");
        assert_eq!(plan.merge_base, b.base);
        assert_eq!(plan.behind, 1);
        assert_eq!(
            plan.commits
                .iter()
                .map(|c| c.sha.clone())
                .collect::<Vec<_>>(),
            vec![b.a.clone(), b.b.clone(), b.c.clone()]
        );
        let args = plan_args_for_rebase(&b.root, &plan);
        let prediction = predict(&args).unwrap();
        assert!(prediction
            .steps
            .iter()
            .all(|step| step.outcome == StepOutcome::Clean));
    }

    #[test]
    fn a_rebase_plan_without_a_named_base_rebases_onto_the_develop_branch() {
        let root = init_repo("rebase-plan-develop");
        git_ok(&root, &["branch", "-m", "main", "develop"]);
        let base = commit(&root, "policy.txt", "one\n", "base");
        let work = root.join("wt-feature");
        git_ok(
            &root,
            &[
                "worktree",
                "add",
                "-b",
                "feature",
                work.to_str().unwrap(),
                "develop",
            ],
        );
        let own = commit(&work, "notes.txt", "notes\n", "C adds notes");
        let upstream = commit(&root, "readme.txt", "hello\n", "develop moves on");

        let plan = rebase_plan(&work, None, false).unwrap();

        assert_eq!(plan.onto_ref, "develop");
        assert_eq!(plan.onto, upstream);
        assert_eq!(plan.merge_base, base);
        assert_eq!(plan.behind, 1);
        assert_eq!(
            plan.commits
                .iter()
                .map(|c| c.sha.clone())
                .collect::<Vec<_>>(),
            vec![own]
        );
    }

    fn plan_args_for_rebase(root: &Path, plan: &RebasePlan) -> HistoryPlanArgs {
        HistoryPlanArgs {
            worktree_path: root.to_string_lossy().into_owned(),
            base: plan.merge_base.clone(),
            head: plan.head.clone(),
            steps: plan
                .commits
                .iter()
                .map(|c| step(&c.sha, HistoryVerb::Pick))
                .collect(),
            onto: Some(plan.onto.clone()),
        }
    }

    #[test]
    fn the_engine_rebuilds_the_rewriter_result_with_the_plan_messages_and_authors() {
        let b = branch("rewriter-collect");
        let mut reword = step(&b.a, HistoryVerb::Reword);
        reword.message = Some("A edits the policy, reworded".to_string());
        let args = plan(
            &b.root,
            &b.base,
            &b.c,
            vec![
                step(&b.b, HistoryVerb::Pick),
                reword,
                step(&b.c, HistoryVerb::Pick),
            ],
        );
        let prepared = trial(&args, &slug("rewriter-collect"), true).unwrap();
        let copy = PathBuf::from(prepared.copy_path.clone().unwrap());
        assert_eq!(prepared.stop.unwrap().files, vec!["policy.txt".to_string()]);
        std::fs::write(copy.join("policy.txt"), "three\n").unwrap();
        git_ok(&copy, &["add", "policy.txt"]);
        git_ok(
            &copy,
            &["commit", "--no-verify", "-m", "whatever the agent typed"],
        );
        let second = git_run(&copy, &["cherry-pick", "--no-commit", &b.a], None, None).unwrap();
        assert_ne!(second.status, 0);
        std::fs::write(copy.join("policy.txt"), "three\n").unwrap();
        git_ok(&copy, &["add", "policy.txt"]);
        git_ok(
            &copy,
            &["commit", "--no-verify", "--allow-empty", "-m", "second"],
        );
        git_ok(&copy, &["cherry-pick", &b.c]);
        let check = collect_rewrite(&RewriterCollectArgs {
            plan: args,
            copy_path: copy.to_string_lossy().into_owned(),
            skipped: Vec::new(),
            keeps_copy: false,
        })
        .unwrap();
        assert!(check.problems.is_empty(), "{:?}", check.problems);
        let head = check.head.unwrap();
        assert_eq!(
            subjects(&b.root, &format!("{}..{head}", b.base)),
            vec![
                "C adds notes",
                "A edits the policy, reworded",
                "B edits the policy again"
            ]
        );
        assert!(check.is_tree_equal);
        assert!(!copy.exists());
        assert_eq!(git_ok(&b.root, &["rev-parse", "HEAD"]), b.c);
    }

    #[test]
    fn the_engine_refuses_a_rewrite_with_the_wrong_number_of_commits() {
        let b = branch("rewriter-count");
        let args = plan(
            &b.root,
            &b.base,
            &b.c,
            vec![step(&b.b, HistoryVerb::Pick), step(&b.a, HistoryVerb::Pick)],
        );
        let prepared = trial(&args, &slug("rewriter-count"), true).unwrap();
        let copy = PathBuf::from(prepared.copy_path.unwrap());
        git_ok(&copy, &["checkout", "--theirs", "policy.txt"]);
        git_ok(&copy, &["add", "policy.txt"]);
        git_ok(&copy, &["commit", "--no-verify", "-m", "only one"]);
        let check = collect_rewrite(&RewriterCollectArgs {
            plan: args,
            copy_path: copy.to_string_lossy().into_owned(),
            skipped: Vec::new(),
            keeps_copy: false,
        })
        .unwrap();
        assert_eq!(check.head, None);
        assert_eq!(check.problems.len(), 1);
        discard_copy(&copy.to_string_lossy());
    }

    #[test]
    fn a_turn_with_the_push_block_cannot_push_to_origin() {
        let b = branch("push-block");
        let remote = with_remote(&b);
        commit(&b.root, "extra.txt", "extra\n", "extra");
        let output = Git::new()
            .args(["push", "origin", "feature"])
            .cwd(&b.root)
            .push_block()
            .output()
            .unwrap();
        assert!(!output.success());
        let bare = Git::new()
            .args(["push"])
            .cwd(&b.root)
            .push_block()
            .output()
            .unwrap();
        assert!(!bare.success());
        assert_eq!(git_ok(&remote, &["rev-parse", "refs/heads/feature"]), b.c);
    }

    #[test]
    fn predicting_a_thirty_commit_plan_stays_inside_the_budget() {
        let root = init_repo("predict-timing");
        for dir in 0..40 {
            let folder = root.join(format!("src/module{dir}"));
            std::fs::create_dir_all(&folder).unwrap();
            for file in 0..10 {
                std::fs::write(
                    folder.join(format!("file{file}.ts")),
                    format!("export const value{dir}_{file} = {file};\n"),
                )
                .unwrap();
            }
        }
        git_ok(&root, &["add", "."]);
        git_ok(
            &root,
            &["commit", "--no-verify", "-m", "base with 400 files"],
        );
        let base = git_ok(&root, &["rev-parse", "HEAD"]);
        git_ok(&root, &["checkout", "-b", "feature"]);
        let shas: Vec<String> = (0..30)
            .map(|index| {
                commit(
                    &root,
                    &format!("src/module{}/file{}.ts", index % 40, index % 10),
                    &format!("export const changed{index} = true;\n"),
                    &format!("change {index}"),
                )
            })
            .collect();
        let head = shas.last().unwrap().clone();
        let mut steps: Vec<HistoryStep> = shas
            .iter()
            .map(|sha| step(sha, HistoryVerb::Pick))
            .collect();
        steps.swap(3, 4);
        steps[10].verb = HistoryVerb::Squash;
        steps[20].verb = HistoryVerb::Drop;
        let mut fold = step(&shas[25], HistoryVerb::Fixup);
        fold.target = Some(shas[12].clone());
        steps[25] = fold;
        let args = plan(&root, &base, &head, steps);

        let started = std::time::Instant::now();
        let prediction = predict(&args).unwrap();
        let elapsed = started.elapsed().as_millis();

        let resolved = resolve_plan(&root, &args).unwrap();
        let ordered = order_steps(&resolved.steps).unwrap();
        let direct_started = std::time::Instant::now();
        let direct = predict_with(&root, &resolved, &ordered, false).unwrap();
        let direct_elapsed = direct_started.elapsed().as_millis();

        let probe = std::time::Instant::now();
        for _ in 0..10 {
            git_ok(&root, &["rev-parse", "HEAD"]);
        }
        let per_spawn = probe.elapsed().as_millis() / 10;
        eprintln!(
            "history prediction of a 30 commit plan over 400 files: {elapsed} ms batched, {direct_elapsed} ms one spawn per commit, one git spawn: {per_spawn} ms"
        );
        let outcomes = |found: &PlanPrediction| {
            found
                .steps
                .iter()
                .map(|step| (step.sha.clone(), step.outcome, step.files.clone()))
                .collect::<Vec<_>>()
        };
        assert_eq!(outcomes(&prediction), outcomes(&direct));
        assert_eq!(prediction.changed_files, direct.changed_files);
        assert_eq!(prediction.is_tree_equal, direct.is_tree_equal);
        let head = prediction.head.unwrap();
        assert_eq!(
            git_ok(&root, &["rev-parse", &format!("{head}^{{tree}}")]),
            git_ok(
                &root,
                &["rev-parse", &format!("{}^{{tree}}", direct.head.unwrap())]
            )
        );
        assert_eq!(git_ok(&root, &["for-each-ref", PREDICT_REF]), "");
        if supports_batched_replay() {
            assert!(
                elapsed < 1_000 || elapsed < per_spawn * 12,
                "prediction took {elapsed} ms with {per_spawn} ms per git spawn"
            );
        }
    }

    struct Ledger {
        root: PathBuf,
        base: String,
        export: String,
        batch: String,
        webhook: String,
        retries: String,
        logging: String,
        tests: String,
        typo: String,
    }

    fn ledger(name: &str) -> Ledger {
        let root = init_repo(name);
        let base = commit(&root, "ledger.ts", "ledger\n", "Release 2.14");
        git_ok(&root, &["checkout", "-q", "-b", "feature"]);
        let export = commit(
            &root,
            "export.ts",
            "export v1\n",
            "Add ledger export endpoint",
        );
        let batch = commit(
            &root,
            "batch.ts",
            "batch 500\n",
            "Stream rows in batches of 500",
        );
        let webhook = commit(
            &root,
            "webhook.ts",
            "verify\n",
            "Fix webhook signature check",
        );
        let retries = commit(
            &root,
            "retries.ts",
            "retry 3\n",
            "Add retries to the export job",
        );
        let logging = commit(
            &root,
            "logger.ts",
            "debug\n",
            "Add debug logging to the export",
        );
        let tests = commit(&root, "export.test.ts", "tests\n", "wip export tests");
        let typo = commit(&root, "export.ts", "export v2\n", "Fix typo in CSV header");
        Ledger {
            root,
            base,
            export,
            batch,
            webhook,
            retries,
            logging,
            tests,
            typo,
        }
    }

    fn picks(shas: &[&String]) -> Vec<HistoryStep> {
        shas.iter()
            .map(|sha| step(sha, HistoryVerb::Pick))
            .collect()
    }

    fn fold(sha: &str, target: &str, verb: HistoryVerb) -> HistoryStep {
        HistoryStep {
            sha: sha.to_string(),
            verb,
            message: None,
            target: Some(target.to_string()),
        }
    }

    fn run_args(root: &Path, plan: HistoryPlanArgs) -> HistoryRunArgs {
        let _ = root;
        HistoryRunArgs {
            plan,
            branch: "feature".to_string(),
        }
    }

    fn tried(outcome: RunOutcome) -> TrialResult {
        match outcome {
            RunOutcome::Tried { result } => *result,
            RunOutcome::Blocked { reason } => panic!("the run was blocked: {reason}"),
        }
    }

    fn worktree_count(root: &Path) -> usize {
        git_ok(root, &["worktree", "list", "--porcelain"])
            .lines()
            .filter(|line| line.starts_with("worktree "))
            .count()
    }

    fn ledger_plan(l: &Ledger, steps: Vec<HistoryStep>) -> HistoryPlanArgs {
        plan(&l.root, &l.base, &l.typo, steps)
    }

    fn run_ok(l: &Ledger, steps: Vec<HistoryStep>, name: &str) -> TrialResult {
        let result = tried(
            run_plan(
                &run_args(&l.root, ledger_plan(l, steps)),
                &slug(name),
                &|_| {},
            )
            .unwrap(),
        );
        assert_eq!(result.stop, None);
        let check = result.check.clone().unwrap();
        assert!(check.is_passed, "{:?}", check.problems);
        assert_eq!(git_ok(&l.root, &["rev-parse", "HEAD"]), l.typo);
        assert_eq!(worktree_count(&l.root), 1);
        assert!(!copy_path_of(&slug(name)).exists());
        result
    }

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
    fn after_apply_the_lease_push_stops_when_someone_else_pushed() {
        let l = ledger("run-remote-moved");
        let remote = l.root.join("remote.git");
        git_ok(&l.root, &["init", "-q", "--bare", remote.to_str().unwrap()]);
        git_ok(
            &l.root,
            &["remote", "add", "origin", remote.to_str().unwrap()],
        );
        git_ok(&l.root, &["push", "-q", "-u", "origin", "feature"]);
        let other = l.root.join("other");
        git_ok(
            &l.root,
            &[
                "clone",
                "-q",
                "-b",
                "feature",
                remote.to_str().unwrap(),
                other.to_str().unwrap(),
            ],
        );
        git_ok(&other, &["config", "user.email", "tomas@harborline.test"]);
        git_ok(&other, &["config", "user.name", "Tomas Vey"]);
        let theirs = commit(&other, "teammate.ts", "hi\n", "Teammate change");
        git_ok(&other, &["push", "-q", "origin", "feature"]);
        let mut steps = picks(&[
            &l.export, &l.batch, &l.webhook, &l.retries, &l.logging, &l.tests,
        ]);
        steps.push(fold(&l.typo, &l.export, HistoryVerb::Fixup));
        let head = run_ok(&l, steps, "run-remote-moved").head.unwrap();
        move_branch_blocking(&l.root, "feature", &l.typo, &head).unwrap();
        let cwd = l.root.to_string_lossy().into_owned();
        let pushed = crate::github::run_git_authenticated(
            &[
                "push",
                &crate::github::lease_argument("feature", Some(&l.typo)),
                "origin",
                "refs/heads/feature:refs/heads/feature",
            ],
            &cwd,
            None,
        )
        .unwrap();
        assert!(matches!(
            crate::github::lease_push_outcome(&pushed),
            crate::github::LeasePushOutcome::Stale { .. }
        ));
        assert_eq!(
            git_ok(&remote, &["rev-parse", "refs/heads/feature"]),
            theirs
        );
    }

    fn clean_released(dir: &Path, trial_after: u64, other_after: u64) -> usize {
        for _ in 0..40 {
            let cleaned = clean_stale_copies_in(dir, trial_after, other_after);
            if cleaned > 0 {
                return cleaned;
            }
            std::thread::sleep(std::time::Duration::from_millis(50));
        }
        0
    }

    #[test]
    fn stale_copies_are_cleaned_and_real_repositories_are_left_alone() {
        let l = ledger("stale");
        let scratch = l.root.join("scratch");
        std::fs::create_dir_all(&scratch).unwrap();
        let trial_root = scratch.join(format!("{COPY_PREFIX}{TRIAL_SLUG_PREFIX}1"));
        let rewriter_root = scratch.join(format!("{COPY_PREFIX}mount-1"));
        for root in [&trial_root, &rewriter_root] {
            let mut guard = create_copy(&l.root, &root.join(COPY_DIR), &l.base).unwrap();
            guard.is_kept = true;
        }
        let users = scratch.join(format!("{COPY_PREFIX}{TRIAL_SLUG_PREFIX}mine"));
        git_ok(
            &l.root,
            &[
                "worktree",
                "add",
                "--detach",
                "--quiet",
                users.to_str().unwrap(),
                &l.base,
            ],
        );
        std::fs::write(users.join("work.txt"), "my work\n").unwrap();
        let lookalike = scratch.join(format!("{COPY_PREFIX}test-repo"));
        std::fs::create_dir_all(lookalike.join(".git")).unwrap();
        assert_eq!(worktree_count(&l.root), 4);

        assert_eq!(clean_stale_copies_in(&scratch, 0, 0), 0);
        assert!(trial_root.join(COPY_DIR).exists());

        drop(take_held(&trial_root));
        drop(take_held(&rewriter_root));
        assert_eq!(clean_released(&scratch, 0, u64::MAX), 1);
        assert!(!trial_root.exists());
        assert!(rewriter_root.exists());
        assert_eq!(worktree_count(&l.root), 3);
        assert_eq!(clean_released(&scratch, 0, 0), 1);
        assert!(!rewriter_root.exists());
        assert!(lookalike.exists());
        assert_eq!(
            std::fs::read_to_string(users.join("work.txt")).unwrap(),
            "my work\n"
        );
        assert_eq!(worktree_count(&l.root), 2);
    }

    #[test]
    fn copies_are_reserved_in_the_app_folder_and_never_in_tmp() {
        let copy = copy_path_of(&slug("tmp-check"));
        let tmp = std::env::temp_dir();
        for outside in [
            tmp.clone(),
            std::fs::canonicalize(&tmp).unwrap(),
            PathBuf::from("/tmp"),
            PathBuf::from("/private/tmp"),
        ] {
            assert!(!copy.starts_with(&outside), "{}", copy.display());
        }
        assert!(copy.starts_with(dirs::home_dir().unwrap().join(".goodboy")));
    }

    fn forged_owner(l: &Ledger, name: &str) -> (PathBuf, PathBuf, String) {
        let other = temp_root(&format!("{name}-other")).join("review");
        git_ok(
            &l.root,
            &[
                "worktree",
                "add",
                "--detach",
                "--quiet",
                other.to_str().unwrap(),
                &l.base,
            ],
        );
        let review_admin =
            std::fs::canonicalize(git_ok(&other, &["rev-parse", "--absolute-git-dir"])).unwrap();
        let review_gitdir = std::fs::read_to_string(review_admin.join("gitdir"))
            .unwrap()
            .trim()
            .to_string();
        let common = std::fs::canonicalize(l.root.join(".git")).unwrap();
        let text = format!(
            "{RESERVATION_HEADER}\n{}\n1\n{}\n{review_gitdir}\n",
            common.to_string_lossy(),
            review_admin.to_string_lossy()
        );
        (other, review_admin, text)
    }

    #[test]
    fn a_forged_owner_file_never_reaches_another_worktree() {
        let l = ledger("forged-owner");
        let (other, review_admin, forged) = forged_owner(&l, "forged-owner");
        let root = temp_root("forged-owner-copies").join(format!("{COPY_PREFIX}forged"));
        let copy = root.join(COPY_DIR);
        let mut guard = create_copy(&l.root, &copy, &l.base).unwrap();
        guard.is_kept = true;
        std::fs::write(root.join(RESERVATION_FILE), forged).unwrap();
        assert!(copy_git_dirs(&copy).is_none_or(|dirs| dirs.git_dir != review_admin));
        drop(guard);
        discard_copy(&copy.to_string_lossy());
        assert!(review_admin.join("gitdir").exists());
        assert_eq!(git_ok(&other, &["rev-parse", "HEAD"]), l.base);
    }

    #[test]
    fn a_planted_old_reservation_never_removes_another_worktree() {
        let l = ledger("planted-owner");
        let (other, review_admin, forged) = forged_owner(&l, "planted-owner");
        let scratch = temp_root("planted-owner-copies");
        let root = scratch.join(format!("{COPY_PREFIX}{TRIAL_SLUG_PREFIX}planted"));
        std::fs::create_dir_all(root.join(COPY_DIR)).unwrap();
        std::fs::write(root.join(RESERVATION_FILE), forged).unwrap();
        clean_stale_copies_in(&scratch, 0, 0);
        assert!(review_admin.join("gitdir").exists());
        assert_eq!(git_ok(&other, &["rev-parse", "HEAD"]), l.base);
    }

    #[test]
    fn a_copy_another_process_holds_is_never_cleaned() {
        let l = ledger("stale-held");
        let scratch = l.root.join("scratch");
        std::fs::create_dir_all(&scratch).unwrap();
        let root = scratch.join(format!("{COPY_PREFIX}{TRIAL_SLUG_PREFIX}active"));
        let mut guard = create_copy(&l.root, &root.join(COPY_DIR), &l.base).unwrap();
        guard.is_kept = true;
        drop(guard);
        let active = take_held(&root).unwrap();
        let other_process = std::fs::OpenOptions::new()
            .write(true)
            .open(root.join(RESERVATION_LOCK))
            .unwrap();
        assert!(!try_lock_exclusive(&other_process));
        drop(other_process);
        assert_eq!(clean_stale_copies_in(&scratch, 0, 0), 0);
        assert!(root.join(COPY_DIR).exists());
        drop(active);
        assert_eq!(clean_released(&scratch, 0, 0), 1);
        assert!(!root.exists());
    }

    #[test]
    fn discard_never_deletes_a_folder_goodboy_did_not_reserve() {
        let scratch = temp_root("not-reserved");
        let root = scratch.join(format!("{COPY_PREFIX}{TRIAL_SLUG_PREFIX}theirs"));
        std::fs::create_dir_all(root.join(COPY_DIR)).unwrap();
        std::fs::write(root.join(COPY_DIR).join("work.txt"), "theirs\n").unwrap();
        discard_copy(&root.join(COPY_DIR).to_string_lossy());
        assert_eq!(
            std::fs::read_to_string(root.join(COPY_DIR).join("work.txt")).unwrap(),
            "theirs\n"
        );
        assert_eq!(clean_stale_copies_in(&scratch, 0, 0), 0);
        assert!(root.exists());
        let l = ledger("reserved-by-someone");
        let name = slug("reserved-by-someone");
        let taken = copy_path_of(&name);
        std::fs::create_dir_all(taken.parent().unwrap()).unwrap();
        std::fs::write(taken.parent().unwrap().join("note.txt"), "mine\n").unwrap();
        let args = ledger_plan(&l, picks(&[&l.export]));
        assert!(trial(&args, &name, false).is_err());
        assert_eq!(
            std::fs::read_to_string(taken.parent().unwrap().join("note.txt")).unwrap(),
            "mine\n"
        );
        std::fs::remove_dir_all(taken.parent().unwrap()).unwrap();
    }

    #[test]
    fn a_failing_post_checkout_hook_leaves_no_copy_registered() {
        let l = ledger("copy-hook");
        let hooks = l.root.join(".git").join("hooks");
        std::fs::create_dir_all(&hooks).unwrap();
        let hook = hooks.join("post-checkout");
        std::fs::write(&hook, "#!/bin/sh\nexit 1\n").unwrap();
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            std::fs::set_permissions(&hook, std::fs::Permissions::from_mode(0o755)).unwrap();
        }
        let args = ledger_plan(
            &l,
            picks(&[
                &l.export, &l.batch, &l.webhook, &l.retries, &l.logging, &l.tests, &l.typo,
            ]),
        );
        assert!(trial(&args, &slug("copy-hook"), false).is_err());
        assert_eq!(worktree_count(&l.root), 1);
        assert!(!copy_path_of(&slug("copy-hook")).exists());
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
    fn commits_before_the_first_change_keep_their_shas() {
        let l = ledger("run-keep-prefix");
        let mut steps = picks(&[&l.export, &l.batch, &l.webhook, &l.retries]);
        steps.push(step(&l.logging, HistoryVerb::Drop));
        steps.extend(picks(&[&l.tests, &l.typo]));
        let prediction = predict(&ledger_plan(&l, steps.clone())).unwrap();
        assert_eq!(
            prediction.steps[3].new_sha.as_deref(),
            Some(l.retries.as_str())
        );
        assert_ne!(
            prediction.steps[5].new_sha.as_deref(),
            Some(l.tests.as_str())
        );
        let result = run_ok(&l, steps, "run-keep-prefix");
        let head = result.head.clone().unwrap();
        assert!(is_ancestor(&l.root, &l.retries, &head));
        assert!(!is_ancestor(&l.root, &l.tests, &head));
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

    #[test]
    fn an_agent_rewrite_keeps_the_shas_of_the_untouched_older_commits() {
        let root = init_repo("rewriter-prefix");
        let base = commit(&root, "policy.txt", "one\n", "base");
        git_ok(&root, &["checkout", "-q", "-b", "feature"]);
        std::fs::write(root.join("keep.txt"), "keep\n").unwrap();
        git_ok(&root, &["add", "keep.txt"]);
        let dated = crate::path_env::command("git")
            .args([
                "commit",
                "-q",
                "--no-verify",
                "-m",
                "Keep the settlement key",
            ])
            .current_dir(&root)
            .env("GIT_COMMITTER_DATE", "2001-01-01T00:00:00Z")
            .output()
            .unwrap();
        assert!(dated.status.success());
        let kept = git_ok(&root, &["rev-parse", "HEAD"]);
        let a = commit(&root, "policy.txt", "two\n", "A edits the policy");
        let b = commit(&root, "policy.txt", "three\n", "B edits the policy again");
        let args = plan(
            &root,
            &base,
            &b,
            vec![
                step(&kept, HistoryVerb::Pick),
                step(&b, HistoryVerb::Pick),
                step(&a, HistoryVerb::Pick),
            ],
        );
        let prepared = trial(&args, &slug("rewriter-prefix"), true).unwrap();
        let copy = PathBuf::from(prepared.copy_path.clone().unwrap());
        std::fs::write(copy.join("policy.txt"), "three\n").unwrap();
        git_ok(&copy, &["add", "policy.txt"]);
        git_ok(&copy, &["commit", "--no-verify", "-m", "b"]);
        let second = git_run(&copy, &["cherry-pick", "--no-commit", &a], None, None).unwrap();
        assert_ne!(second.status, 0);
        std::fs::write(copy.join("policy.txt"), "three\n").unwrap();
        git_ok(&copy, &["add", "policy.txt"]);
        git_ok(
            &copy,
            &["commit", "--no-verify", "--allow-empty", "-m", "a"],
        );
        let check = collect_rewrite(&RewriterCollectArgs {
            plan: args,
            copy_path: copy.to_string_lossy().into_owned(),
            skipped: Vec::new(),
            keeps_copy: false,
        })
        .unwrap();
        assert!(check.problems.is_empty(), "{:?}", check.problems);
        let head = check.head.unwrap();
        let oldest = git_ok(
            &root,
            &["rev-list", "--reverse", &format!("{base}..{head}")],
        )
        .lines()
        .next()
        .unwrap()
        .to_string();
        assert_eq!(oldest, kept);
        assert!(check.map.contains(&ShaMove {
            from: kept.clone(),
            to: Some(kept.clone()),
        }));
        assert!(!copy.exists());
    }

    #[test]
    fn the_lease_is_the_online_sha_the_plan_includes_and_never_a_later_push() {
        let l = ledger("lease-bound");
        let remote = l.root.join("remote.git");
        git_ok(&l.root, &["init", "-q", "--bare", remote.to_str().unwrap()]);
        git_ok(
            &l.root,
            &["remote", "add", "origin", remote.to_str().unwrap()],
        );
        assert_eq!(
            remote_lease(&l.root, "feature", &l.typo, None, None, None),
            RemoteLease::Absent
        );
        git_ok(
            &l.root,
            &[
                "push",
                "-q",
                "origin",
                &format!("{}:refs/heads/feature", l.webhook),
            ],
        );
        assert_eq!(
            remote_lease(&l.root, "feature", &l.typo, None, None, None),
            RemoteLease::Included {
                sha: l.webhook.clone()
            }
        );
        let other = l.root.join("other");
        git_ok(
            &l.root,
            &[
                "clone",
                "-q",
                "-b",
                "feature",
                remote.to_str().unwrap(),
                other.to_str().unwrap(),
            ],
        );
        git_ok(&other, &["config", "user.email", "tomas@harborline.test"]);
        git_ok(&other, &["config", "user.name", "Tomas Vey"]);
        let theirs = commit(
            &other,
            "teammate.ts",
            "hi\n",
            "Teammate change during the trial",
        );
        git_ok(&other, &["push", "-q", "origin", "feature"]);
        assert_eq!(
            remote_lease(&l.root, "feature", &l.typo, None, None, None),
            RemoteLease::NotIncluded {
                sha: theirs.clone()
            }
        );
        assert_eq!(
            remote_lease(&l.root, "feature", &l.typo, Some(&theirs), None, None),
            RemoteLease::Included { sha: theirs }
        );
    }

    #[test]
    fn restoring_an_older_backup_never_counts_a_later_push_that_carried_a_teammate() {
        let l = ledger("restore-lease-teammate");
        let remote = l.root.join("remote.git");
        git_ok(&l.root, &["init", "-q", "--bare", remote.to_str().unwrap()]);
        git_ok(
            &l.root,
            &["remote", "add", "origin", remote.to_str().unwrap()],
        );
        let push = |sha: &str| {
            git_ok(
                &l.root,
                &[
                    "push",
                    "-q",
                    "-f",
                    "origin",
                    &format!("{sha}:refs/heads/feature"),
                ],
            )
        };
        let tree_of = |sha: &str| git_ok(&l.root, &["rev-parse", &format!("{sha}^{{tree}}")]);
        let first_backup = l.webhook.clone();
        push(&first_backup);
        let first_rewrite = git_ok(
            &l.root,
            &[
                "commit-tree",
                &tree_of(&first_backup),
                "-p",
                &l.base,
                "-m",
                "Rewrite one",
            ],
        );
        push(&first_rewrite);
        let teammate = git_ok(
            &l.root,
            &[
                "commit-tree",
                &tree_of(&l.retries),
                "-p",
                &first_rewrite,
                "-m",
                "Teammate retries",
            ],
        );
        push(&teammate);
        let second_backup = teammate.clone();
        let second_rewrite = git_ok(
            &l.root,
            &[
                "commit-tree",
                &tree_of(&l.retries),
                "-p",
                &l.base,
                "-m",
                "Rewrite two with the teammate",
            ],
        );
        push(&second_rewrite);

        assert_eq!(
            remote_lease(
                &l.root,
                "feature",
                &first_backup,
                Some(&second_rewrite),
                Some(&teammate),
                None
            ),
            RemoteLease::NotIncluded {
                sha: second_rewrite.clone()
            }
        );
        assert_eq!(
            remote_lease(
                &l.root,
                "feature",
                &second_backup,
                Some(&second_rewrite),
                Some(&teammate),
                None
            ),
            RemoteLease::Included {
                sha: second_rewrite.clone()
            }
        );
        assert_eq!(
            remote_lease(
                &l.root,
                "feature",
                &first_backup,
                Some(&second_rewrite),
                None,
                None
            ),
            RemoteLease::Included {
                sha: second_rewrite
            }
        );
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
    fn an_empty_commit_is_kept_and_a_redundant_one_is_never_dropped_silently() {
        let root = init_repo("empty-commits");
        let base = commit(&root, "a.txt", "one\n", "base");
        git_ok(&root, &["checkout", "-q", "-b", "feature"]);
        let first = commit(&root, "a.txt", "two\n", "first");
        git_ok(
            &root,
            &[
                "commit",
                "-q",
                "--no-verify",
                "--allow-empty",
                "-m",
                "Mark the release",
            ],
        );
        let marker = git_ok(&root, &["rev-parse", "HEAD"]);
        let revert = commit(&root, "a.txt", "one\n", "revert");
        let again = commit(&root, "a.txt", "two\n", "again");
        let mut reword = step(&marker, HistoryVerb::Reword);
        reword.message = Some("Mark the ledger release".to_string());
        let args = plan(
            &root,
            &base,
            &again,
            vec![
                step(&first, HistoryVerb::Pick),
                reword,
                step(&revert, HistoryVerb::Drop),
                step(&again, HistoryVerb::Pick),
            ],
        );
        let result = trial(&args, &slug("empty-commits"), false).unwrap();
        let check = result.check.clone().unwrap();
        assert!(check.is_passed, "{:?}", check.problems);
        let head = result.head.unwrap();
        assert_eq!(
            subjects(&root, &format!("{base}..{head}")),
            vec!["again", "Mark the ledger release", "first"]
        );
        let prediction = predict(&args).unwrap();
        assert_eq!(prediction.steps[3].outcome, StepOutcome::Empty);
        assert!(prediction.steps[3].new_sha.is_some());
    }

    #[test]
    fn removing_a_copy_never_prunes_the_other_worktrees_of_the_repo() {
        let l = ledger("no-global-prune");
        let elsewhere = temp_root("unmounted-drive").join("ledger-review");
        git_ok(
            &l.root,
            &[
                "worktree",
                "add",
                "--detach",
                "--quiet",
                elsewhere.to_str().unwrap(),
                &l.base,
            ],
        );
        let admin = l.root.join(".git").join("worktrees").join("ledger-review");
        assert!(admin.exists());
        std::fs::remove_dir_all(&elsewhere).unwrap();
        let args = ledger_plan(
            &l,
            picks(&[
                &l.export, &l.batch, &l.webhook, &l.retries, &l.logging, &l.tests, &l.typo,
            ]),
        );
        trial(&args, &slug("no-global-prune"), false).unwrap();
        assert!(
            admin.exists(),
            "the other worktree's registration was pruned"
        );
        assert!(!copy_path_of(&slug("no-global-prune")).exists());
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

    #[test]
    fn an_agent_that_skips_a_planned_commit_is_refused() {
        let b = branch("rewriter-skip");
        let args = plan(
            &b.root,
            &b.base,
            &b.c,
            vec![step(&b.b, HistoryVerb::Pick), step(&b.a, HistoryVerb::Pick)],
        );
        let prepared = trial(&args, &slug("rewriter-skip"), true).unwrap();
        let copy = PathBuf::from(prepared.copy_path.unwrap());
        std::fs::write(copy.join("policy.txt"), "three\n").unwrap();
        git_ok(&copy, &["add", "policy.txt"]);
        git_ok(
            &copy,
            &["commit", "--no-verify", "-m", "B edits the policy again"],
        );
        let check = collect_rewrite(&RewriterCollectArgs {
            plan: args,
            copy_path: copy.to_string_lossy().into_owned(),
            skipped: vec![b.a.clone()],
            keeps_copy: false,
        })
        .unwrap();
        assert_eq!(check.head, None);
        assert!(!check.problems.is_empty());
        discard_copy(&copy.to_string_lossy());
    }

    #[test]
    fn the_copy_git_dirs_are_its_own_admin_folder_and_the_objects_only() {
        let l = ledger("copy-git-dirs");
        let other = temp_root("copy-git-dirs-other").join("review");
        git_ok(
            &l.root,
            &[
                "worktree",
                "add",
                "--detach",
                "--quiet",
                other.to_str().unwrap(),
                &l.base,
            ],
        );
        let copy = copy_path_of(&slug("copy-git-dirs"));
        let guard = create_copy(&l.root, &copy, &l.base).unwrap();
        let dirs = copy_git_dirs(&copy).unwrap();
        let common = std::fs::canonicalize(l.root.join(".git")).unwrap();
        assert_eq!(PathBuf::from(&dirs.objects_dir), common.join("objects"));
        assert!(PathBuf::from(&dirs.git_dir).starts_with(common.join("worktrees")));
        assert_ne!(
            PathBuf::from(&dirs.git_dir),
            common.join("worktrees").join("review")
        );
        assert!(!common.join("refs").join("heads").starts_with(&dirs.git_dir));
        assert_eq!(
            PathBuf::from(&dirs.packed_refs_lock),
            common.join("packed-refs.lock")
        );
        drop(guard);
        assert_eq!(copy_git_dirs(&l.root.join("copy")), None);
    }

    #[cfg(unix)]
    #[test]
    fn a_copy_whose_git_file_becomes_a_link_never_reaches_another_worktree() {
        let l = ledger("copy-git-link");
        let other = temp_root("copy-git-link-other").join("review");
        git_ok(
            &l.root,
            &[
                "worktree",
                "add",
                "--detach",
                "--quiet",
                other.to_str().unwrap(),
                &l.base,
            ],
        );
        let review_admin =
            std::fs::canonicalize(git_ok(&other, &["rev-parse", "--absolute-git-dir"])).unwrap();
        let copy = copy_path_of(&slug("copy-git-link"));
        let mut guard = create_copy(&l.root, &copy, &l.base).unwrap();
        guard.is_kept = true;
        let own_admin = PathBuf::from(copy_git_dirs(&copy).unwrap().git_dir);

        std::fs::remove_file(copy.join(".git")).unwrap();
        std::os::unix::fs::symlink(other.join(".git"), copy.join(".git")).unwrap();
        assert_eq!(copy_git_dirs(&copy), None);

        drop(guard);
        discard_copy(&copy.to_string_lossy());
        assert!(!copy.exists());
        assert!(review_admin.join("gitdir").exists());
        assert_eq!(git_ok(&other, &["rev-parse", "HEAD"]), l.base);
        assert!(!own_admin.exists());
    }

    #[test]
    fn a_copy_whose_git_file_names_another_admin_dir_keeps_its_recorded_one() {
        let l = ledger("copy-git-retarget");
        let other = temp_root("copy-git-retarget-other").join("review");
        git_ok(
            &l.root,
            &[
                "worktree",
                "add",
                "--detach",
                "--quiet",
                other.to_str().unwrap(),
                &l.base,
            ],
        );
        let review_admin =
            std::fs::canonicalize(git_ok(&other, &["rev-parse", "--absolute-git-dir"])).unwrap();
        let copy = copy_path_of(&slug("copy-git-retarget"));
        let mut guard = create_copy(&l.root, &copy, &l.base).unwrap();
        guard.is_kept = true;
        let own_admin = PathBuf::from(copy_git_dirs(&copy).unwrap().git_dir);
        std::fs::write(
            copy.join(".git"),
            format!("gitdir: {}\n", review_admin.to_string_lossy()),
        )
        .unwrap();
        assert_eq!(
            copy_git_dirs(&copy).map(|dirs| PathBuf::from(dirs.git_dir)),
            Some(own_admin.clone())
        );
        drop(guard);
        discard_copy(&copy.to_string_lossy());
        assert!(review_admin.join("gitdir").exists());
        assert!(!own_admin.exists());
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

    #[cfg(unix)]
    struct WritableAgain(PathBuf);

    #[cfg(unix)]
    impl Drop for WritableAgain {
        fn drop(&mut self) {
            set_writable(&self.0, true, &[]);
        }
    }

    #[cfg(unix)]
    fn set_writable(path: &Path, is_writable: bool, keep: &[PathBuf]) {
        use std::os::unix::fs::PermissionsExt;
        if keep.iter().any(|kept| path.starts_with(kept)) {
            return;
        }
        let Ok(meta) = std::fs::symlink_metadata(path) else {
            return;
        };
        if meta.file_type().is_symlink() {
            return;
        }
        if meta.is_dir() {
            if is_writable {
                let _ = std::fs::set_permissions(path, std::fs::Permissions::from_mode(0o755));
            }
            if let Ok(entries) = std::fs::read_dir(path) {
                for entry in entries.flatten() {
                    set_writable(&entry.path(), is_writable, keep);
                }
            }
            if !is_writable {
                let _ = std::fs::set_permissions(path, std::fs::Permissions::from_mode(0o555));
            }
            return;
        }
        let mode = meta.permissions().mode();
        let next = if is_writable {
            mode | 0o200
        } else {
            mode & !0o222
        };
        let _ = std::fs::set_permissions(path, std::fs::Permissions::from_mode(next));
    }

    fn snapshot(root: &Path, paths: &[PathBuf]) -> std::collections::BTreeMap<PathBuf, Vec<u8>> {
        let mut found = std::collections::BTreeMap::new();
        let mut pending: Vec<PathBuf> = paths.to_vec();
        while let Some(path) = pending.pop() {
            let Ok(meta) = std::fs::symlink_metadata(&path) else {
                continue;
            };
            if meta.is_dir() {
                if let Ok(entries) = std::fs::read_dir(&path) {
                    pending.extend(entries.flatten().map(|entry| entry.path()));
                }
                continue;
            }
            let relative = path.strip_prefix(root).unwrap_or(&path).to_path_buf();
            found.insert(relative, std::fs::read(&path).unwrap_or_default());
        }
        found
    }

    fn git_in(copy: &Path, args: &[&str], todo: Option<&str>) -> std::process::Output {
        let mut command = crate::path_env::command("git");
        command
            .args(args)
            .current_dir(copy)
            .env("GIT_EDITOR", "true")
            .env("GIT_TERMINAL_PROMPT", "0");
        if let Some(todo) = todo {
            command.env("GIT_SEQUENCE_EDITOR", format!("cp {todo}"));
        }
        command.output().unwrap()
    }

    #[cfg(unix)]
    #[test]
    fn the_rewriter_git_sequence_works_inside_its_roots_and_leaves_the_user_refs_untouched() {
        let l = ledger("rewriter-roots");
        let other = temp_root("rewriter-roots-other").join("ledger-review");
        git_ok(
            &l.root,
            &[
                "worktree",
                "add",
                "-q",
                "-b",
                "review",
                other.to_str().unwrap(),
                &l.base,
            ],
        );
        std::fs::write(l.root.join("export.ts"), "work in progress\n").unwrap();
        git_ok(&l.root, &["stash", "push", "-q", "-m", "keep this"]);
        git_ok(&l.root, &["pack-refs", "--all"]);
        let copy = copy_path_of(&slug("rewriter-roots"));
        let mut guard = create_copy(&l.root, &copy, &l.base).unwrap();
        guard.is_kept = true;
        let dirs = copy_git_dirs(&copy).unwrap();
        let root = std::fs::canonicalize(&l.root).unwrap();
        let common = root.join(".git");
        let watched = vec![
            common.join("refs"),
            common.join("packed-refs"),
            common.join("logs"),
            common.join("worktrees").join("ledger-review"),
            root.join("export.ts"),
            root.join("ledger.ts"),
        ];
        let before = snapshot(&root, &watched);
        assert!(before
            .keys()
            .any(|path| path.ends_with("refs/stash") || path.ends_with("logs/refs/stash")));

        let todo = temp_root("rewriter-roots-todo").join("todo");
        std::fs::write(
            &todo,
            [
                &l.typo, &l.export, &l.batch, &l.webhook, &l.retries, &l.logging, &l.tests,
            ]
            .iter()
            .map(|sha| format!("pick {sha}\n"))
            .collect::<String>(),
        )
        .unwrap();
        let keep = vec![
            PathBuf::from(&dirs.objects_dir),
            PathBuf::from(&dirs.git_dir),
        ];
        set_writable(&root, false, &keep);
        let restore = WritableAgain(root.clone());
        let lock = PathBuf::from(&dirs.packed_refs_lock);
        assert_eq!(lock.parent(), Some(common.as_path()));
        {
            use std::os::unix::fs::PermissionsExt;
            std::fs::set_permissions(&common, std::fs::Permissions::from_mode(0o755)).unwrap();
        }
        let names = |dir: &Path| -> Vec<String> {
            let mut found: Vec<String> = std::fs::read_dir(dir)
                .unwrap()
                .flatten()
                .map(|entry| entry.file_name().to_string_lossy().to_string())
                .collect();
            found.sort();
            found
        };
        let common_names = names(&common);

        let todo_text = todo.to_string_lossy().to_string();
        let started = git_in(
            &copy,
            &["rebase", "-i", "--onto", "HEAD", &l.base, &l.tests],
            Some(&todo_text),
        );
        assert!(
            !started.status.success(),
            "the planned conflict should stop the rebase"
        );
        std::fs::write(copy.join("export.ts"), "export v2\n").unwrap();
        let added = git_in(&copy, &["add", "export.ts"], None);
        assert!(
            added.status.success(),
            "{}",
            String::from_utf8_lossy(&added.stderr)
        );
        let next = git_in(&copy, &["rebase", "--continue"], None);
        assert!(
            !next.status.success(),
            "the second step should conflict too"
        );
        std::fs::write(copy.join("export.ts"), "export v2\n").unwrap();
        git_in(&copy, &["add", "export.ts"], None);
        let empty = git_in(
            &copy,
            &[
                "commit",
                "--allow-empty",
                "-m",
                "Add ledger export endpoint",
            ],
            None,
        );
        assert!(
            empty.status.success(),
            "{}",
            String::from_utf8_lossy(&empty.stderr)
        );
        let finished = git_in(&copy, &["rebase", "--continue"], None);
        assert!(
            finished.status.success(),
            "{}",
            String::from_utf8_lossy(&finished.stderr)
        );
        let amended = git_in(
            &copy,
            &["commit", "--amend", "-m", "Add the export test fixtures"],
            None,
        );
        assert!(
            amended.status.success(),
            "{}",
            String::from_utf8_lossy(&amended.stderr)
        );

        assert_eq!(names(&common), common_names);
        assert!(!lock.exists());
        drop(restore);
        assert_eq!(
            git_ok(&copy, &["log", "-1", "--format=%s"]),
            "Add the export test fixtures"
        );
        assert_eq!(
            git_ok(
                &copy,
                &["rev-list", "--count", &format!("{}..HEAD", l.base)]
            ),
            "7"
        );
        assert_eq!(snapshot(&root, &watched), before);
        drop(guard);
        discard_copy(&copy.to_string_lossy());
    }
}
