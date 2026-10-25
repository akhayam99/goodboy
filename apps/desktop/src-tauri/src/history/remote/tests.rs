use super::{commits_only_online, origin_ahead, remote_lease, RemoteLease};
use crate::history::apply::move_branch_blocking;
use crate::history::fixtures::{
    branch, commit, fold, git_ok, ledger, picks, plan, run_ok, slug, step, subjects, with_remote,
};
use crate::history::trial::trial;
use crate::history::types::HistoryVerb;
use crate::proc::git::Git;

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

    let ahead = origin_ahead(&b.root, "feature", Some(&b.c), None, true).unwrap();
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
    let pushed = crate::remote_auth::run_git_authenticated(
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
fn the_known_remote_sha_is_the_tracking_ref_from_before_the_fetch() {
    let b = branch("known-remote");
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

    let ahead = origin_ahead(&b.root, "feature", None, None, false).unwrap();
    assert_eq!(ahead.known_remote_sha, Some(b.c.clone()));
    assert_eq!(ahead.remote_sha, theirs);

    let unpushed = origin_ahead(&b.root, "feature", None, None, false).unwrap();
    assert_eq!(unpushed.known_remote_sha, Some(theirs));
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
    let stale = crate::remote_auth::run_git_authenticated(
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
    let fresh = crate::remote_auth::run_git_authenticated(
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

#[test]
fn the_lease_push_sends_the_checked_sha_even_when_the_branch_moved_after_the_check() {
    let b = branch("lease-sha");
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
    let checked = trial(&args, &slug("lease-sha"), false)
        .unwrap()
        .head
        .unwrap();
    move_branch_blocking(&b.root, "feature", &b.c, &checked).unwrap();
    let later = commit(
        &b.root,
        "later.txt",
        "later\n",
        "Someone commits after the check",
    );
    let cwd = b.root.to_string_lossy().into_owned();

    let pushed =
        crate::github::push_with_lease_blocking(&cwd, "feature", Some(&b.c), Some(&checked), None)
            .unwrap();

    assert_eq!(pushed, crate::github::LeasePushOutcome::Pushed);
    assert_eq!(
        git_ok(&remote, &["rev-parse", "refs/heads/feature"]),
        checked
    );
    assert_eq!(git_ok(&b.root, &["rev-parse", "refs/heads/feature"]), later);
    assert!(crate::github::lease_push_args("feature", None, Some("HEAD")).is_err());
    assert_eq!(
        crate::github::lease_push_args("feature", None, None).unwrap()[3],
        "refs/heads/feature:refs/heads/feature"
    );
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
    let pushed = crate::remote_auth::run_git_authenticated(
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

fn pushed_branch(name: &str) -> (crate::history::fixtures::Branch, std::path::PathBuf) {
    let b = branch(name);
    let remote = b.root.join("remote.git");
    git_ok(&b.root, &["init", "--bare", remote.to_str().unwrap()]);
    git_ok(
        &b.root,
        &["remote", "add", "origin", remote.to_str().unwrap()],
    );
    git_ok(&b.root, &["push", "-u", "origin", "feature"]);
    (b, remote)
}

#[test]
fn a_rebased_branch_has_no_commit_only_online() {
    let (b, _remote) = pushed_branch("only-online-rebased");
    git_ok(
        &b.root,
        &["commit", "--amend", "--no-verify", "-m", "Reworded"],
    );

    let ahead = origin_ahead(&b.root, "feature", None, None, false).unwrap();
    assert!(ahead.only_online.is_empty());
}

#[test]
fn a_commit_someone_else_pushed_is_the_only_one_online() {
    let (b, remote) = pushed_branch("only-online-teammate");
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
    git_ok(
        &b.root,
        &["commit", "--amend", "--no-verify", "-m", "Reworded"],
    );

    let ahead = origin_ahead(&b.root, "feature", None, None, false).unwrap();
    assert_eq!(
        ahead
            .only_online
            .iter()
            .map(|c| (c.sha.clone(), c.subject.clone()))
            .collect::<Vec<_>>(),
        vec![(theirs, "Teammate adds a note".to_string())]
    );
}

#[test]
fn a_merge_commit_that_exists_only_online_is_listed() {
    let b = branch("only-online-merge");
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
    git_ok(&other, &["checkout", "-q", "-b", "side"]);
    commit(
        &other,
        "side.txt",
        "side\n",
        "Teammate works on a side branch",
    );
    git_ok(&other, &["checkout", "-q", "feature"]);
    commit(&other, "main.txt", "main\n", "Teammate moves feature on");
    git_ok(
        &other,
        &[
            "merge",
            "--no-ff",
            "-q",
            "-m",
            "Merge side into feature",
            "side",
        ],
    );
    git_ok(&other, &["push", "-q", "origin", "feature"]);
    git_ok(&b.root, &["fetch", "-q", "origin"]);
    let remote_sha = crate::worktree::resolve_commit(&b.root, "origin/feature").unwrap();

    let listed = commits_only_online(&b.root, &remote_sha).unwrap();

    assert_eq!(
        listed
            .iter()
            .map(|c| c.subject.as_str())
            .collect::<Vec<_>>(),
        vec![
            "Teammate works on a side branch",
            "Teammate moves feature on",
            "Merge side into feature"
        ]
    );
}

#[test]
fn a_remote_only_merge_is_listed_by_origin_ahead_and_refused_only_when_bringing_in() {
    let b = branch("origin-ahead-merge");
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
    git_ok(&other, &["checkout", "-q", "-b", "side"]);
    commit(
        &other,
        "side.txt",
        "side\n",
        "Teammate works on a side branch",
    );
    git_ok(&other, &["checkout", "-q", "feature"]);
    commit(&other, "main.txt", "main\n", "Teammate moves feature on");
    git_ok(
        &other,
        &[
            "merge",
            "--no-ff",
            "-q",
            "-m",
            "Merge side into feature",
            "side",
        ],
    );
    git_ok(&other, &["push", "-q", "origin", "feature"]);

    let ahead = origin_ahead(&b.root, "feature", None, None, false).unwrap();
    assert_eq!(
        ahead
            .only_online
            .iter()
            .map(|c| c.subject.as_str())
            .collect::<Vec<_>>(),
        vec![
            "Teammate works on a side branch",
            "Teammate moves feature on",
            "Merge side into feature"
        ]
    );

    let refused = origin_ahead(&b.root, "feature", None, None, true).unwrap_err();
    assert!(refused
        .to_string()
        .contains("is a merge commit: bring it in by hand"));
}
