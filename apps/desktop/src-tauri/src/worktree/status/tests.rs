use super::{
    distance_between, git_dir_of, in_progress_operation, parse_status_v2, read_working_tree,
    rev_list_left_right, worktree_status_blocking, StatusSnapshot,
};
use crate::worktree::base::resolve_base;
use crate::worktree::commits::{worktree_abort_rebase_blocking, worktree_commits_blocking};
use crate::worktree::create::worktree_create_blocking;
use crate::worktree::git::{git, git_argv_log};
use crate::worktree::types::{
    CreateArgs, CreatedWorktree, GitDistance, GitOperation, GitUnknownReason, GitWorkingTree,
};
use std::path::{Path, PathBuf};

fn temp_root(name: &str) -> PathBuf {
    let root = std::env::temp_dir().join(format!(
        "goodboy-{name}-{}-{}",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
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
    git_ok(root, &["commit", "-m", message]);
    git_ok(root, &["rev-parse", "HEAD"])
}

fn push_to_new_remote(root: &Path) {
    let remote = root.join("remote.git");
    git_ok(root, &["init", "--bare", remote.to_str().unwrap()]);
    git_ok(root, &["remote", "add", "origin", remote.to_str().unwrap()]);
    git_ok(root, &["push", "-u", "origin", "main"]);
}

#[test]
fn status_counts_commits_ahead_of_and_behind_main() {
    let root = init_repo("status-main-position");
    commit(&root, "base.txt", "base", "base");
    push_to_new_remote(&root);
    git_ok(&root, &["checkout", "-b", "feature"]);
    commit(&root, "feature.txt", "feature", "feature");
    commit(&root, "feature-two.txt", "feature two", "feature two");
    git_ok(&root, &["checkout", "main"]);
    commit(&root, "main.txt", "main", "main");
    git_ok(&root, &["push", "origin", "main"]);
    git_ok(&root, &["checkout", "feature"]);

    let status = worktree_status_blocking(root.to_string_lossy().into_owned(), None).unwrap();

    assert_eq!(
        status.main_distance,
        GitDistance::Known {
            ahead: 2,
            behind: 1
        }
    );
}

#[test]
fn porcelain_v2_headers_and_entries_become_one_snapshot() {
    let raw = "# branch.oid 0123abcd\n# branch.head feature\n# branch.upstream origin/feature\n# branch.ab +2 -1\n1 M. N... 100644 100644 100644 aaaa bbbb staged.txt\n1 .M N... 100644 100644 100644 aaaa bbbb unstaged.txt\n1 MM N... 100644 100644 100644 aaaa bbbb both.txt\n2 R. N... 100644 100644 100644 aaaa bbbb R100 renamed.txt\told.txt\nu UU N... 100644 100644 100644 100644 aaaa bbbb cccc conflict.txt\n? new.txt\n! ignored.txt\n";

    assert_eq!(
        parse_status_v2(raw),
        StatusSnapshot {
            branch: Some("feature".to_string()),
            head: Some("0123abcd".to_string()),
            upstream: Some("origin/feature".to_string()),
            upstream_ab: Some((2, 1)),
            working_tree: GitWorkingTree::Known {
                staged: 3,
                unstaged: 2,
                untracked: 1,
                unmerged: 1,
                changed: 6
            },
        }
    );
}

#[test]
fn porcelain_v2_detached_and_initial_heads_read_as_absent() {
    let raw = "# branch.oid (initial)\n# branch.head (detached)\n";
    let snapshot = parse_status_v2(raw);

    assert_eq!(snapshot.branch, None);
    assert_eq!(snapshot.head, None);
    assert_eq!(snapshot.upstream, None);
    assert_eq!(snapshot.upstream_ab, None);
}

#[test]
fn status_reads_a_configured_base_with_three_git_spawns() {
    let root = init_repo("status-spawn-budget");
    commit(&root, "base.txt", "base", "base");
    push_to_new_remote(&root);
    git_ok(&root, &["checkout", "-b", "feature"]);
    commit(&root, "feature.txt", "feature", "feature");
    git_ok(&root, &["push", "-u", "origin", "feature"]);
    std::fs::write(root.join("dirty.txt"), "dirty").unwrap();

    git_argv_log::reset();
    let status =
        worktree_status_blocking(root.to_string_lossy().into_owned(), Some("main".into())).unwrap();
    let spawned = git_argv_log::recorded();

    assert_eq!(spawned.len(), 3, "git argv: {spawned:?}");
    assert_eq!(status.branch.as_deref(), Some("feature"));
    assert!(status.head.is_some());
    assert_eq!(status.head_subject.as_deref(), Some("feature"));
    assert_eq!(status.upstream.as_deref(), Some("origin/feature"));
    assert_eq!(
        status.upstream_distance,
        GitDistance::Known {
            ahead: 0,
            behind: 0
        }
    );
    assert_eq!(
        status.main_distance,
        GitDistance::Known {
            ahead: 1,
            behind: 0
        }
    );
    assert_eq!(
        status.working_tree,
        GitWorkingTree::Known {
            staged: 0,
            unstaged: 0,
            untracked: 2,
            unmerged: 0,
            changed: 2
        },
        "dirty.txt plus the bare remote.git the harness leaves inside the repo"
    );
    assert_eq!(status.in_progress, None);
    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn a_failed_status_read_reports_status_read_failed_for_the_upstream_distance() {
    let root = temp_root("status-read-failure");

    let status = worktree_status_blocking(root.to_string_lossy().into_owned(), None).unwrap();

    assert_eq!(
        status.upstream_distance,
        GitDistance::Unknown {
            reason: GitUnknownReason::StatusReadFailed
        }
    );
    assert_eq!(
        status.working_tree,
        GitWorkingTree::Unknown {
            reason: GitUnknownReason::StatusReadFailed
        }
    );
    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn a_malformed_dot_git_file_falls_back_to_rev_parse() {
    let broken = temp_root("git-dir-malformed");
    std::fs::write(broken.join(".git"), "garbage").unwrap();

    assert_eq!(git_dir_of(&broken), None);
    std::fs::remove_dir_all(&broken).unwrap();

    let root = init_repo("git-dir-resolution");
    commit(&root, "base.txt", "base", "base");

    assert_eq!(git_dir_of(&root), Some(root.join(".git")));

    let linked = root.join("wt");
    git_ok(
        &root,
        &["worktree", "add", linked.to_str().unwrap(), "-b", "wt"],
    );
    let linked_dir = git_dir_of(&linked).unwrap();

    assert!(linked_dir.join("HEAD").is_file());
    std::fs::remove_dir_all(&root).unwrap();
}

#[test]
fn status_reports_a_detached_head_and_a_missing_upstream() {
    let root = init_repo("status-detached");
    commit(&root, "base.txt", "base", "base");
    let status = worktree_status_blocking(root.to_string_lossy().into_owned(), None).unwrap();
    assert_eq!(
        status.upstream_distance,
        GitDistance::Unknown {
            reason: GitUnknownReason::NoUpstream
        }
    );

    git_ok(&root, &["checkout", "--detach"]);
    let detached = worktree_status_blocking(root.to_string_lossy().into_owned(), None).unwrap();

    assert_eq!(detached.branch, None);
    assert_eq!(
        detached.upstream_distance,
        GitDistance::Unknown {
            reason: GitUnknownReason::DetachedHead
        }
    );
    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn a_pruned_upstream_is_reported_as_gone_not_a_read_failure() {
    let root = init_repo("status-upstream-gone");
    commit(&root, "base.txt", "base", "base");
    push_to_new_remote(&root);

    git_ok(&root, &["update-ref", "-d", "refs/remotes/origin/main"]);
    let status = worktree_status_blocking(root.to_string_lossy().into_owned(), None).unwrap();

    assert_eq!(status.upstream.as_deref(), Some("origin/main"));
    assert_eq!(
        status.upstream_distance,
        GitDistance::Unknown {
            reason: GitUnknownReason::UpstreamGone
        }
    );
    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn a_failed_rev_list_is_reported_as_unknown_rather_than_in_sync() {
    let root = init_repo("fail-closed-rev-list");
    commit(&root, "base.txt", "base", "base");

    assert_eq!(rev_list_left_right(&root, "missing-ref", "HEAD"), None);
    assert_eq!(
        distance_between(&root, "missing-ref", "HEAD"),
        GitDistance::Unknown {
            reason: GitUnknownReason::RevListFailed
        }
    );
    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn an_unresolvable_main_ref_is_reported_as_unknown_rather_than_zero_distance() {
    let root = temp_root("fail-closed-resolve-main");
    git_ok(&root, &["init", "-b", "trunk"]);
    git_ok(&root, &["config", "user.email", "test@example.com"]);
    git_ok(&root, &["config", "user.name", "test"]);
    git_ok(&root, &["config", "commit.gpgsign", "false"]);
    commit(&root, "base.txt", "base", "base");

    let status = worktree_status_blocking(root.to_string_lossy().into_owned(), None).unwrap();

    assert_eq!(resolve_base(&root, None), None);
    assert_eq!(
        status.main_distance,
        GitDistance::Unknown {
            reason: GitUnknownReason::MainRefUnresolved
        }
    );
    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn a_failed_status_read_is_reported_as_unknown_rather_than_a_clean_tree() {
    let root = temp_root("fail-closed-status-read");

    assert_eq!(
        read_working_tree(&root),
        GitWorkingTree::Unknown {
            reason: GitUnknownReason::StatusReadFailed
        }
    );
    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn a_merge_conflict_is_counted_as_unmerged_and_never_as_staged_or_unstaged() {
    let root = init_repo("fail-closed-conflict");
    commit(&root, "shared.txt", "base\n", "base");
    git_ok(&root, &["checkout", "-b", "feature"]);
    commit(&root, "shared.txt", "feature\n", "feature");
    git_ok(&root, &["checkout", "main"]);
    commit(&root, "shared.txt", "main\n", "main");
    let merge = git(&root, &["merge", "feature"]);

    assert!(merge.is_err());
    assert_eq!(
        read_working_tree(&root),
        GitWorkingTree::Known {
            staged: 0,
            unstaged: 0,
            untracked: 0,
            unmerged: 1,
            changed: 1
        }
    );
    assert_eq!(in_progress_operation(&root), Some(GitOperation::Merge));
    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn a_finished_conflicted_rebase_is_not_in_progress() {
    let root = init_repo("finished-conflicted-rebase");
    commit(&root, "shared.txt", "base\n", "base");
    git_ok(&root, &["checkout", "-b", "feature"]);
    commit(&root, "shared.txt", "feature\n", "feature change");
    git_ok(&root, &["checkout", "main"]);
    commit(&root, "shared.txt", "main change\n", "main change");
    git_ok(&root, &["checkout", "feature"]);

    let rebase = git(&root, &["rebase", "main"]);

    assert!(rebase.is_err());
    assert!(root.join(".git").join("rebase-merge").is_dir());

    std::fs::write(root.join("shared.txt"), "resolved\n").unwrap();
    git_ok(&root, &["add", "shared.txt"]);
    git_ok(&root, &["rebase", "--continue"]);

    assert!(
        root.join(".git").join("REBASE_HEAD").is_file(),
        "expected git's own leftover REBASE_HEAD after a finished rebase"
    );
    assert!(!root.join(".git").join("rebase-merge").exists());
    assert!(!root.join(".git").join("rebase-apply").exists());
    assert_eq!(in_progress_operation(&root), None);
    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn aborting_a_stopped_rebase_puts_the_branch_back() {
    let root = init_repo("abort-stopped-rebase");
    commit(&root, "shared.txt", "base\n", "base");
    git_ok(&root, &["checkout", "-b", "feature"]);
    let before = commit(&root, "shared.txt", "feature\n", "feature change");
    git_ok(&root, &["checkout", "main"]);
    commit(&root, "shared.txt", "main change\n", "main change");
    git_ok(&root, &["checkout", "feature"]);
    assert!(git(&root, &["rebase", "main"]).is_err());

    worktree_abort_rebase_blocking(root.to_str().unwrap()).unwrap();

    assert_eq!(in_progress_operation(&root), None);
    assert_eq!(git(&root, &["rev-parse", "HEAD"]).unwrap().trim(), before);
    assert!(worktree_abort_rebase_blocking(root.to_str().unwrap()).is_err());
    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn resolves_master_when_the_repository_has_no_main_branch() {
    let root = temp_root("resolve-main-master");
    git_ok(&root, &["init", "-b", "master"]);
    git_ok(&root, &["config", "user.email", "test@example.com"]);
    git_ok(&root, &["config", "user.name", "test"]);
    git_ok(&root, &["config", "commit.gpgsign", "false"]);
    let base = commit(&root, "base.txt", "base", "base");
    git_ok(&root, &["checkout", "-b", "feature"]);
    commit(&root, "feature.txt", "feature", "feature");

    let (main_ref, merge_base) = resolve_base(&root, None).expect("master resolves as main");

    assert_eq!(main_ref, "master");
    assert_eq!(merge_base, base);
    assert_eq!(
        worktree_status_blocking(root.to_string_lossy().into_owned(), None)
            .unwrap()
            .main_distance,
        GitDistance::Known {
            ahead: 1,
            behind: 0
        }
    );
    std::fs::remove_dir_all(root).unwrap();
}

fn create_session_mount(root: &Path, slug: &str) -> CreatedWorktree {
    let parent = root.join(".goodboy").join("worktrees");
    worktree_create_blocking(CreateArgs {
        repo_path: root.to_string_lossy().into_owned(),
        branch_prefix: "goodboy".to_string(),
        slug: slug.to_string(),
        parent_dir: Some(parent.to_string_lossy().into_owned()),
        existing_branch: None,
        fallback_ref: None,
        base_branch: None,
        dir_name: Some(slug.to_string()),
    })
    .unwrap()
}

#[test]
fn eight_pushed_commits_read_as_on_origin_with_nothing_to_push() {
    let root = std::fs::canonicalize(init_repo("session-pushed-eight")).unwrap();
    commit(&root, "base.txt", "base\n", "base");
    push_to_new_remote(&root);
    let created = create_session_mount(&root, "pushed-eight");
    let path = PathBuf::from(&created.worktree_path);
    git_ok(&path, &["branch", "--set-upstream-to", "origin/main"]);
    for index in 0..8 {
        commit(
            &path,
            &format!("file-{index}.txt"),
            "body\n",
            &format!("commit {index}"),
        );
    }
    let before = worktree_status_blocking(created.worktree_path.clone(), None).unwrap();
    assert_eq!(before.upstream, None);
    assert_eq!(
        before.upstream_distance,
        GitDistance::Unknown {
            reason: GitUnknownReason::NoUpstream
        }
    );

    git_ok(&path, &["push", "origin", &created.branch_name]);
    commit(&path, "local.txt", "local\n", "local only");

    let status = worktree_status_blocking(created.worktree_path.clone(), None).unwrap();
    let own = format!("origin/{}", created.branch_name);
    assert_eq!(status.upstream.as_deref(), Some(own.as_str()));
    assert_eq!(
        status.upstream_distance,
        GitDistance::Known {
            ahead: 1,
            behind: 0
        }
    );
    let commits = worktree_commits_blocking(created.worktree_path.clone()).unwrap();
    let unpushed: Vec<&str> = commits
        .iter()
        .filter(|commit| !commit.pushed)
        .map(|commit| commit.subject.as_str())
        .collect();
    assert_eq!(unpushed, vec!["local only"]);
    assert_eq!(commits.iter().filter(|commit| commit.pushed).count(), 8);
    std::fs::remove_dir_all(root).unwrap();
}
