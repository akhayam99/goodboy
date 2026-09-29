mod base;
mod branches;
mod candidates;
mod changed_files;
mod commits;
mod create;
mod detach;
mod diff;
mod error;
mod exclude;
mod fast_forward;
mod folder;
mod git;
mod inspect;
mod merge_state;
mod orphans;
mod remove;
mod scratch;
mod slug;
mod status;
mod types;

pub(crate) use base::*;
pub(crate) use branches::*;
pub(crate) use candidates::*;
pub(crate) use changed_files::*;
pub(crate) use commits::*;
pub(crate) use create::*;
pub(crate) use detach::*;
pub(crate) use diff::*;
pub(crate) use error::*;
pub(crate) use exclude::*;
pub(crate) use fast_forward::*;
pub(crate) use folder::*;
pub(crate) use git::*;
pub(crate) use inspect::*;
pub(crate) use merge_state::*;
pub(crate) use orphans::*;
pub(crate) use remove::*;
pub(crate) use scratch::*;
pub(crate) use slug::*;
pub(crate) use status::*;
pub(crate) use types::*;

#[cfg(test)]
mod sanitize_slug_tests {
    use super::{sanitize_slug, slugify, MAX_SLUG_LEN};
    use serde::Deserialize;

    #[derive(Deserialize)]
    struct SlugCase {
        name: String,
        input: String,
        #[serde(rename = "maxLength")]
        max_length: Option<usize>,
        expected: String,
    }

    #[derive(Deserialize)]
    struct SlugFixture {
        #[serde(rename = "defaultMaxLength")]
        default_max_length: usize,
        cases: Vec<SlugCase>,
    }

    const SLUG_FIXTURE: &str =
        include_str!("../../../../../packages/core/src/slug/slug.fixture.json");

    #[test]
    fn matches_the_shared_fixture_the_typescript_slugify_is_tested_against() {
        let fixture: SlugFixture = serde_json::from_str(SLUG_FIXTURE).unwrap();

        assert_eq!(fixture.default_max_length, MAX_SLUG_LEN);
        assert!(!fixture.cases.is_empty());
        for case in fixture.cases {
            let max_len = case.max_length.unwrap_or(MAX_SLUG_LEN);
            assert_eq!(
                slugify(&case.input, max_len),
                case.expected,
                "case: {}",
                case.name
            );
        }
    }

    #[test]
    fn replaces_a_branch_separator_so_the_directory_never_nests() {
        assert_eq!(sanitize_slug("alice/fix-parser"), "alice-fix-parser");
    }

    #[test]
    fn truncates_at_the_slug_budget_without_a_trailing_dash() {
        let sanitized = sanitize_slug(&format!("{}-tail", "a".repeat(MAX_SLUG_LEN - 1)));

        assert_eq!(sanitized, "a".repeat(MAX_SLUG_LEN - 1));
    }

    #[test]
    fn lowercases_ascii_only() {
        assert_eq!(sanitize_slug("Fix-Parser"), "fix-parser");
        assert_eq!(sanitize_slug("caff\u{c8}"), "caff");
    }

    #[test]
    fn leaves_an_already_sanitized_name_untouched() {
        let once = sanitize_slug("Alice/Fix   Parser/../weird");

        assert_eq!(sanitize_slug(&once), once);
    }

    #[test]
    fn leaves_a_mount_directory_name_untouched() {
        let name = "alice-fix-p-9f1c2d3e-4a5b-6c7d-8e9f-0a1b2c3d4e5f";

        assert_eq!(name.len(), MAX_SLUG_LEN);
        assert_eq!(sanitize_slug(name), name);
    }
}

#[cfg(test)]
mod rewrite_tests {
    use super::{
        remove_worktree_checked_with, worktree_branch_holder_blocking,
        worktree_change_branch_blocking, worktree_create_blocking, worktree_status_blocking,
        ChangeBranchArgs, CreateArgs, GitDistance, GitUnknownReason, GitWorkingTree,
        WorktreeRemovalMode,
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
        super::git(cwd, args)
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
    fn branch_names_strip_origin_and_preserve_the_first_occurrence() {
        let raw = "main\nfeature/search\norigin\norigin/HEAD\norigin/main\norigin/release\nupstream/HEAD\nupstream/release\n";

        assert_eq!(
            super::normalize_branch_names(raw),
            vec!["main", "feature/search", "release", "upstream/release"]
        );
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
            super::parse_status_v2(raw),
            super::StatusSnapshot {
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
        let snapshot = super::parse_status_v2(raw);

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

        super::git_argv_log::reset();
        let status =
            worktree_status_blocking(root.to_string_lossy().into_owned(), Some("main".into()))
                .unwrap();
        let spawned = super::git_argv_log::recorded();

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

        assert_eq!(super::git_dir_of(&broken), None);
        std::fs::remove_dir_all(&broken).unwrap();

        let root = init_repo("git-dir-resolution");
        commit(&root, "base.txt", "base", "base");

        assert_eq!(super::git_dir_of(&root), Some(root.join(".git")));

        let linked = root.join("wt");
        git_ok(
            &root,
            &["worktree", "add", linked.to_str().unwrap(), "-b", "wt"],
        );
        let linked_dir = super::git_dir_of(&linked).unwrap();

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

        assert_eq!(
            super::rev_list_left_right(&root, "missing-ref", "HEAD"),
            None
        );
        assert_eq!(
            super::distance_between(&root, "missing-ref", "HEAD"),
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

        assert_eq!(super::resolve_base(&root, None), None);
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
            super::read_working_tree(&root),
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
        let merge = super::git(&root, &["merge", "feature"]);

        assert!(merge.is_err());
        assert_eq!(
            super::read_working_tree(&root),
            GitWorkingTree::Known {
                staged: 0,
                unstaged: 0,
                untracked: 0,
                unmerged: 1,
                changed: 1
            }
        );
        assert_eq!(
            super::in_progress_operation(&root),
            Some(super::GitOperation::Merge)
        );
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

        let rebase = super::git(&root, &["rebase", "main"]);

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
        assert_eq!(super::in_progress_operation(&root), None);
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
        assert!(super::git(&root, &["rebase", "main"]).is_err());

        super::worktree_abort_rebase_blocking(root.to_str().unwrap()).unwrap();

        assert_eq!(super::in_progress_operation(&root), None);
        assert_eq!(
            super::git(&root, &["rev-parse", "HEAD"]).unwrap().trim(),
            before
        );
        assert!(super::worktree_abort_rebase_blocking(root.to_str().unwrap()).is_err());
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

        let (main_ref, merge_base) =
            super::resolve_base(&root, None).expect("master resolves as main");

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

    #[test]
    fn fast_forward_advances_the_branch_to_its_upstream() {
        let root = init_repo("fast-forward-clean");
        commit(&root, "base.txt", "base", "base");
        push_to_new_remote(&root);
        let clone_root = temp_root("fast-forward-clone");
        git_ok(
            &clone_root,
            &[
                "clone",
                root.join("remote.git").to_str().unwrap(),
                clone_root.join("copy").to_str().unwrap(),
            ],
        );
        let copy = clone_root.join("copy");
        git_ok(&copy, &["checkout", "-B", "main", "--track", "origin/main"]);
        commit(&root, "next.txt", "next", "next");
        git_ok(&root, &["push", "origin", "main"]);

        super::git_argv_log::reset();
        let pulled =
            super::checkout_fast_forward_blocking(copy.to_string_lossy().into_owned(), None)
                .unwrap();
        let merge_invocations: Vec<Vec<String>> = super::git_argv_log::recorded()
            .into_iter()
            .filter(|argv| argv.iter().any(|arg| arg == "merge"))
            .collect();

        assert_eq!(pulled.upstream, "origin/main");
        assert_eq!(pulled.commits_pulled, 1);
        assert!(copy.join("next.txt").is_file());
        assert_eq!(
            merge_invocations,
            vec![vec![
                "-c".to_string(),
                "pull.rebase=false".to_string(),
                "-c".to_string(),
                "rebase.autoStash=false".to_string(),
                "-c".to_string(),
                "merge.autoStash=false".to_string(),
                "merge".to_string(),
                "--ff-only".to_string(),
                "origin/main".to_string(),
            ]]
        );
        std::fs::remove_dir_all(root).unwrap();
        std::fs::remove_dir_all(clone_root).unwrap();
    }

    #[test]
    fn fast_forward_refuses_a_dirty_checkout_and_leaves_it_untouched() {
        let root = init_repo("fast-forward-dirty");
        commit(&root, "base.txt", "base", "base");
        push_to_new_remote(&root);
        std::fs::write(root.join("scratch.txt"), "work in progress").unwrap();
        let before = git_ok(&root, &["rev-parse", "HEAD"]);

        let refusal =
            super::checkout_fast_forward_blocking(root.to_string_lossy().into_owned(), None)
                .unwrap_err();

        assert!(format!("{refusal}").contains("uncommitted changes"));
        assert_eq!(git_ok(&root, &["rev-parse", "HEAD"]), before);
        assert_eq!(
            std::fs::read_to_string(root.join("scratch.txt")).unwrap(),
            "work in progress"
        );
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn fast_forward_reports_the_fetch_failure_and_moves_nothing() {
        let root = init_repo("fast-forward-fetch-fails");
        let base = commit(&root, "base.txt", "base", "base");
        push_to_new_remote(&root);
        git_ok(
            &root,
            &[
                "remote",
                "set-url",
                "origin",
                root.join("missing.git").to_str().unwrap(),
            ],
        );

        let error = super::checkout_fast_forward_blocking(
            root.to_string_lossy().into_owned(),
            Some("token-for-test"),
        )
        .unwrap_err();

        assert!(matches!(error, super::WorktreeError::Git { ref message } if !message.is_empty()));
        assert_eq!(git_ok(&root, &["rev-parse", "HEAD"]), base);
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn fast_forward_refuses_a_branch_without_an_upstream() {
        let root = init_repo("fast-forward-no-upstream");
        commit(&root, "base.txt", "base", "base");

        let refusal =
            super::checkout_fast_forward_blocking(root.to_string_lossy().into_owned(), None)
                .unwrap_err();

        assert!(format!("{refusal}").contains("no upstream"));
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn fast_forward_refuses_while_a_merge_is_in_progress() {
        let root = init_repo("fast-forward-mid-merge");
        commit(&root, "shared.txt", "base\n", "base");
        push_to_new_remote(&root);
        git_ok(&root, &["checkout", "-b", "feature"]);
        commit(&root, "shared.txt", "feature\n", "feature");
        git_ok(&root, &["checkout", "main"]);
        commit(&root, "shared.txt", "main\n", "main");
        let merge = super::git(&root, &["merge", "feature"]);

        let refusal =
            super::checkout_fast_forward_blocking(root.to_string_lossy().into_owned(), None)
                .unwrap_err();

        assert!(merge.is_err());
        assert!(format!("{refusal}").contains("merge in progress"));
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn fast_forward_refuses_when_the_working_tree_cannot_be_read() {
        let root = init_repo("fast-forward-unreadable-status");
        commit(&root, "base.txt", "base", "base");
        push_to_new_remote(&root);
        let before = git_ok(&root, &["rev-parse", "HEAD"]);
        std::fs::write(root.join(".git").join("index"), "not an index").unwrap();

        let refusal =
            super::checkout_fast_forward_blocking(root.to_string_lossy().into_owned(), None)
                .unwrap_err();

        assert!(format!("{refusal}").contains("git status could not be read"));
        assert_eq!(git_ok(&root, &["rev-parse", "HEAD"]), before);
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn ff_merge_args_builds_the_flags_that_forbid_a_rebase_or_an_autostash() {
        assert_eq!(
            super::ff_merge_args("origin/main"),
            vec![
                "-c",
                "pull.rebase=false",
                "-c",
                "rebase.autoStash=false",
                "-c",
                "merge.autoStash=false",
                "merge",
                "--ff-only",
                "origin/main",
            ]
        );
    }

    #[test]
    fn a_remote_url_carrying_a_token_is_redacted_before_it_reaches_the_user() {
        let leaky = "fatal: unable to access 'https://someone:ghp_secretvalue@github.com/acme/widgets.git/': the remote hung up";

        let safe = super::redact_credentials(leaky);

        assert!(!safe.contains("ghp_secretvalue"));
        assert!(!safe.contains("someone"));
        assert!(safe.contains("https://***@github.com/acme/widgets.git/"));
        assert_eq!(
            super::redact_credentials(
                "fatal: repository 'https://github.com/acme/widgets' not found"
            ),
            "fatal: repository 'https://github.com/acme/widgets' not found"
        );
    }

    #[test]
    fn a_branch_checked_out_elsewhere_is_read_from_the_worktree_listing() {
        let listing = "worktree /repo\nHEAD aaaa\nbranch refs/heads/main\n\nworktree /repo/.goodboy/worktrees/one\nHEAD bbbb\nbranch refs/heads/feature/one\n\nworktree /repo/.goodboy/worktrees/two\nHEAD cccc\ndetached\n";

        let holder =
            super::branch_checkout_path_with(Path::new("/repo"), "feature/one", &mut |_, _| {
                Ok(listing.to_string())
            });
        let free =
            super::branch_checkout_path_with(Path::new("/repo"), "feature/two", &mut |_, _| {
                Ok(listing.to_string())
            });

        assert_eq!(holder.as_deref(), Some("/repo/.goodboy/worktrees/one"));
        assert_eq!(free, None);
    }

    #[test]
    fn adopting_a_branch_another_worktree_holds_names_that_worktree() {
        let root = std::fs::canonicalize(init_repo("adopt-in-use")).unwrap();
        commit(&root, "a.txt", "a\n", "first");
        let parent_dir = root.join(".goodboy").join("worktrees");
        let holder = parent_dir.join("holder");
        std::fs::create_dir_all(&parent_dir).unwrap();
        git_ok(
            &root,
            &[
                "worktree",
                "add",
                "-b",
                "feature/shared",
                holder.to_str().unwrap(),
            ],
        );

        let error = worktree_create_blocking(CreateArgs {
            repo_path: root.to_string_lossy().into_owned(),
            branch_prefix: "feature".to_string(),
            slug: "shared".to_string(),
            parent_dir: Some(parent_dir.to_string_lossy().into_owned()),
            existing_branch: Some("feature/shared".to_string()),
            fallback_ref: None,
            base_branch: None,
            dir_name: Some("second".to_string()),
        })
        .unwrap_err();

        let wire = serde_json::to_value(&error).unwrap();
        let super::WorktreeError::BranchInUse { branch, path } = error else {
            panic!("expected a branch-in-use error, found {error:?}");
        };
        assert_eq!(branch, "feature/shared");
        assert_eq!(
            std::fs::canonicalize(&path).unwrap(),
            std::fs::canonicalize(&holder).unwrap()
        );
        assert_eq!(wire["kind"], "branch_in_use");
        assert!(wire["message"]
            .as_str()
            .unwrap()
            .contains(holder.to_string_lossy().as_ref()));
        assert!(!parent_dir.join("second").exists());
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn adopting_a_branch_that_exists_nowhere_names_the_branch() {
        let root = std::fs::canonicalize(init_repo("adopt-missing")).unwrap();
        commit(&root, "a.txt", "a\n", "first");
        let parent_dir = root.join(".goodboy").join("worktrees");
        std::fs::create_dir_all(&parent_dir).unwrap();

        let error = worktree_create_blocking(CreateArgs {
            repo_path: root.to_string_lossy().into_owned(),
            branch_prefix: "ak".to_string(),
            slug: "second-half".to_string(),
            parent_dir: Some(parent_dir.to_string_lossy().into_owned()),
            existing_branch: Some("ak/second-half".to_string()),
            fallback_ref: None,
            base_branch: None,
            dir_name: Some("second".to_string()),
        })
        .unwrap_err();

        let wire = serde_json::to_value(&error).unwrap();
        let super::WorktreeError::BranchNotFound { branch } = error else {
            panic!("expected a branch-not-found error, found {error:?}");
        };
        assert_eq!(branch, "ak/second-half");
        assert_eq!(wire["kind"], "branch_not_found");
        assert!(wire["message"].as_str().unwrap().contains("ak/second-half"));
        assert!(!parent_dir.join("second").exists());
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn keeps_adoption_failing_when_origin_cannot_be_reached() {
        let root = std::fs::canonicalize(init_repo("adopt-unreachable")).unwrap();
        commit(&root, "a.txt", "a\n", "first");
        git_ok(
            &root,
            &[
                "remote",
                "add",
                "origin",
                "https://127.0.0.1:1/nothing/here.git",
            ],
        );
        let parent_dir = root.join(".goodboy").join("worktrees");
        std::fs::create_dir_all(&parent_dir).unwrap();

        let error = worktree_create_blocking(CreateArgs {
            repo_path: root.to_string_lossy().into_owned(),
            branch_prefix: "ak".to_string(),
            slug: "second-half".to_string(),
            parent_dir: Some(parent_dir.to_string_lossy().into_owned()),
            existing_branch: Some("ak/second-half".to_string()),
            fallback_ref: None,
            base_branch: None,
            dir_name: Some("second".to_string()),
        })
        .unwrap_err();

        let wire = serde_json::to_value(&error).unwrap();
        assert_eq!(wire["kind"], "git");
        assert!(!parent_dir.join("second").exists());
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn refuses_to_switch_onto_a_branch_another_worktree_holds() {
        let root = std::fs::canonicalize(init_repo("switch-in-use")).unwrap();
        commit(&root, "a.txt", "a\n", "first");
        let parent_dir = root.join(".goodboy").join("worktrees");
        let holder = parent_dir.join("holder");
        let mover = parent_dir.join("mover");
        std::fs::create_dir_all(&parent_dir).unwrap();
        git_ok(
            &root,
            &["worktree", "add", "-b", "ak/held", holder.to_str().unwrap()],
        );
        git_ok(
            &root,
            &["worktree", "add", "-b", "ak/mine", mover.to_str().unwrap()],
        );

        let error = worktree_change_branch_blocking(ChangeBranchArgs {
            repo_path: root.to_string_lossy().into_owned(),
            worktree_path: mover.to_string_lossy().into_owned(),
            branch: "ak/held".to_string(),
            create_new: false,
        })
        .unwrap_err();

        let wire = serde_json::to_value(&error).unwrap();
        assert_eq!(wire["kind"], "branch_in_use");
        let super::WorktreeError::BranchInUse { branch, .. } = error else {
            panic!("expected a branch-in-use error, found {error:?}");
        };
        assert_eq!(branch, "ak/held");
        assert_eq!(
            git_ok(&mover, &["rev-parse", "--abbrev-ref", "HEAD"]),
            "ak/mine"
        );
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn switches_onto_a_branch_no_other_worktree_holds() {
        let root = std::fs::canonicalize(init_repo("switch-free")).unwrap();
        commit(&root, "a.txt", "a\n", "first");
        let parent_dir = root.join(".goodboy").join("worktrees");
        let mover = parent_dir.join("mover");
        std::fs::create_dir_all(&parent_dir).unwrap();
        git_ok(
            &root,
            &["worktree", "add", "-b", "ak/mine", mover.to_str().unwrap()],
        );
        git_ok(&root, &["branch", "ak/free"]);

        worktree_change_branch_blocking(ChangeBranchArgs {
            repo_path: root.to_string_lossy().into_owned(),
            worktree_path: mover.to_string_lossy().into_owned(),
            branch: "ak/free".to_string(),
            create_new: false,
        })
        .unwrap();

        assert_eq!(
            git_ok(&mover, &["rev-parse", "--abbrev-ref", "HEAD"]),
            "ak/free"
        );
        worktree_change_branch_blocking(ChangeBranchArgs {
            repo_path: root.to_string_lossy().into_owned(),
            worktree_path: mover.to_string_lossy().into_owned(),
            branch: "ak/free".to_string(),
            create_new: false,
        })
        .unwrap();
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn names_the_worktree_that_holds_a_branch() {
        let root = std::fs::canonicalize(init_repo("branch-holder")).unwrap();
        commit(&root, "a.txt", "a\n", "first");
        let parent_dir = root.join(".goodboy").join("worktrees");
        let holder = parent_dir.join("holder");
        std::fs::create_dir_all(&parent_dir).unwrap();
        git_ok(
            &root,
            &["worktree", "add", "-b", "ak/held", holder.to_str().unwrap()],
        );
        git_ok(&root, &["branch", "ak/free"]);

        let found = worktree_branch_holder_blocking(
            root.to_string_lossy().into_owned(),
            "ak/held".to_string(),
        )
        .unwrap()
        .expect("the held branch has a holder");

        assert_eq!(
            std::fs::canonicalize(found).unwrap(),
            std::fs::canonicalize(&holder).unwrap()
        );
        assert_eq!(
            worktree_branch_holder_blocking(
                root.to_string_lossy().into_owned(),
                "ak/free".to_string()
            )
            .unwrap(),
            None
        );
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn names_the_failed_fetch_when_the_base_ref_cannot_be_found() {
        let root = init_repo("create-fetch-cause");
        commit(&root, "base.txt", "base", "base");

        let error = worktree_create_blocking(CreateArgs {
            repo_path: root.to_string_lossy().into_owned(),
            branch_prefix: "ak".to_string(),
            slug: "first".to_string(),
            existing_branch: None,
            fallback_ref: None,
            base_branch: Some("release-42".to_string()),
            parent_dir: None,
            dir_name: None,
        })
        .unwrap_err();

        let super::WorktreeError::Git { message } = error else {
            panic!("expected a git error, found {error:?}");
        };
        assert!(
            message.contains("cannot find base ref"),
            "missing the base ref cause: {message}"
        );
        assert!(
            message.contains("fetching from origin failed first"),
            "the fetch cause was dropped: {message}"
        );
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn keeps_the_error_untouched_when_the_fetch_succeeded() {
        let plain = super::WorktreeError::Git {
            message: "cannot find base ref: tried origin/main".to_string(),
        };

        let super::WorktreeError::Git { message } = super::with_fetch_cause(plain, None) else {
            panic!("expected a git error");
        };
        assert_eq!(message, "cannot find base ref: tried origin/main");
    }

    #[test]
    fn refuses_to_create_a_worktree_before_the_repository_exists() {
        let root = temp_root("create-without-git");

        let plain = worktree_create_blocking(CreateArgs {
            repo_path: root.to_string_lossy().into_owned(),
            branch_prefix: "ak".to_string(),
            slug: "first".to_string(),
            existing_branch: None,
            fallback_ref: None,
            base_branch: None,
            parent_dir: None,
            dir_name: None,
        })
        .unwrap_err();

        assert!(matches!(plain, super::WorktreeError::NoRepository(_)));
        assert!(!root.join(".gitignore").exists());
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn refuses_to_create_a_worktree_before_the_first_commit() {
        let root = init_repo("create-without-commit");

        let unborn = worktree_create_blocking(CreateArgs {
            repo_path: root.to_string_lossy().into_owned(),
            branch_prefix: "ak".to_string(),
            slug: "first".to_string(),
            existing_branch: None,
            fallback_ref: None,
            base_branch: None,
            parent_dir: None,
            dir_name: None,
        })
        .unwrap_err();

        assert!(matches!(unborn, super::WorktreeError::NoCommit(_)));
        assert!(!root.join(".gitignore").exists());
        std::fs::remove_dir_all(root).unwrap();
    }

    fn remove_checked(root: &Path, worktree_path: &str) {
        remove_worktree_checked_with(
            root,
            Path::new(worktree_path),
            WorktreeRemovalMode::Safe,
            &mut |cwd, args| super::git(cwd, args),
            &mut |_| false,
        )
        .unwrap();
    }

    fn create_session_mount(root: &Path, slug: &str) -> super::CreatedWorktree {
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
    fn a_new_session_branch_does_not_track_the_base_it_was_cut_from() {
        let root = std::fs::canonicalize(init_repo("session-no-track")).unwrap();
        commit(&root, "base.txt", "base\n", "base");
        push_to_new_remote(&root);
        let created = create_session_mount(&root, "no-track");
        let path = PathBuf::from(&created.worktree_path);

        assert!(super::resolve_upstream(&path).is_none());
        std::fs::remove_dir_all(root).unwrap();
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
        let commits = super::worktree_commits_blocking(created.worktree_path.clone()).unwrap();
        let unpushed: Vec<&str> = commits
            .iter()
            .filter(|commit| !commit.pushed)
            .map(|commit| commit.subject.as_str())
            .collect();
        assert_eq!(unpushed, vec!["local only"]);
        assert_eq!(commits.iter().filter(|commit| commit.pushed).count(), 8);
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn selected_split_keeps_the_parent_worktree_while_resolving_a_cherry_pick() {
        let root = std::fs::canonicalize(init_repo("selected-split")).unwrap();
        commit(&root, "auth.txt", "base\n", "base");
        push_to_new_remote(&root);
        let parent_dir = root.join(".goodboy").join("worktrees");
        let parent = worktree_create_blocking(CreateArgs {
            repo_path: root.to_string_lossy().into_owned(),
            branch_prefix: "feature".to_string(),
            slug: "eng-3240-draft".to_string(),
            parent_dir: Some(parent_dir.to_string_lossy().into_owned()),
            existing_branch: None,
            fallback_ref: None,
            base_branch: Some("main".to_string()),
            dir_name: Some("mount-parent".to_string()),
        })
        .unwrap();
        let parent_path = PathBuf::from(&parent.worktree_path);
        let selected = commit(
            &parent_path,
            "auth.txt",
            "parent auth\n",
            "extract authentication",
        );
        commit(
            &parent_path,
            "parent-only.txt",
            "later work\n",
            "continue parent draft",
        );
        let parent_head = git_ok(&parent_path, &["rev-parse", "HEAD"]);
        let split = worktree_create_blocking(CreateArgs {
            repo_path: root.to_string_lossy().into_owned(),
            branch_prefix: "feature".to_string(),
            slug: "eng-3240-auth".to_string(),
            parent_dir: Some(parent_dir.to_string_lossy().into_owned()),
            existing_branch: None,
            fallback_ref: None,
            base_branch: Some("main".to_string()),
            dir_name: Some("mount-split".to_string()),
        })
        .unwrap();
        let split_path = PathBuf::from(&split.worktree_path);
        commit(
            &split_path,
            "auth.txt",
            "split preparation\n",
            "prepare selected split",
        );

        assert!(super::git(&split_path, &["cherry-pick", &selected]).is_err());
        std::fs::write(
            split_path.join("auth.txt"),
            "split preparation\nparent auth\n",
        )
        .unwrap();
        git_ok(&split_path, &["add", "auth.txt"]);
        git_ok(&split_path, &["cherry-pick", "--continue"]);

        assert_eq!(git_ok(&parent_path, &["rev-parse", "HEAD"]), parent_head);
        assert_eq!(
            (
                parent_path.join("parent-only.txt").exists(),
                split_path.join("parent-only.txt").exists()
            ),
            (true, false)
        );
        assert_eq!(
            (
                git_ok(&parent_path, &["branch", "--show-current"]),
                git_ok(&split_path, &["branch", "--show-current"])
            ),
            (parent.branch_name, split.branch_name)
        );
    }

    #[test]
    fn a_session_mount_lands_under_goodboy_worktrees_and_stays_out_of_status() {
        let root = std::fs::canonicalize(init_repo("exclude-on-create")).unwrap();
        commit(&root, "base.txt", "base", "base");
        push_to_new_remote(&root);

        let created = create_session_mount(&root, "goal-abc12345");

        assert_eq!(
            created.worktree_path,
            root.join(".goodboy")
                .join("worktrees")
                .join("goal-abc12345")
                .to_string_lossy()
        );
        let exclude =
            std::fs::read_to_string(root.join(".git").join("info").join("exclude")).unwrap();
        assert_eq!(
            exclude.lines().filter(|line| *line == ".goodboy/").count(),
            1
        );
        let status = git_ok(&root, &["status", "--porcelain"]);
        assert!(!status.contains(".goodboy"), "{status}");
        assert!(!root.join(".gitignore").exists());
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn the_exclude_entry_is_written_once_and_survives_a_detach() {
        let root = std::fs::canonicalize(init_repo("exclude-lifecycle")).unwrap();
        commit(&root, "base.txt", "base", "base");
        push_to_new_remote(&root);
        let created = create_session_mount(&root, "goal-def67890");

        let reused = create_session_mount(&root, "goal-def67890");
        assert!(reused.reused);
        let exclude_path = root.join(".git").join("info").join("exclude");
        let exclude = std::fs::read_to_string(&exclude_path).unwrap();
        assert_eq!(
            exclude.lines().filter(|line| *line == ".goodboy/").count(),
            1
        );

        remove_checked(&root, &created.worktree_path);

        assert!(!Path::new(&created.worktree_path).exists());
        let after = std::fs::read_to_string(&exclude_path).unwrap();
        assert_eq!(after.lines().filter(|line| *line == ".goodboy/").count(), 1);
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn deleting_the_last_mount_tidies_the_goodboy_dir_and_the_exclude_entry() {
        let root = std::fs::canonicalize(init_repo("tidy-last-mount")).unwrap();
        commit(&root, "base.txt", "base", "base");
        push_to_new_remote(&root);
        let created = create_session_mount(&root, "goal-tidy0001");

        remove_checked(&root, &created.worktree_path);
        super::tidy_goodboy_dir(&root);

        assert!(!root.join(".goodboy").exists());
        let exclude_path = root.join(".git").join("info").join("exclude");
        let exclude = std::fs::read_to_string(&exclude_path).unwrap();
        assert_eq!(
            exclude.lines().filter(|line| *line == ".goodboy/").count(),
            0
        );
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn tidy_keeps_the_goodboy_dir_and_the_exclude_entry_while_another_mount_remains() {
        let root = std::fs::canonicalize(init_repo("tidy-shared-repo")).unwrap();
        commit(&root, "base.txt", "base", "base");
        push_to_new_remote(&root);
        let removed = create_session_mount(&root, "goal-tidy0002");
        let survivor = create_session_mount(&root, "goal-tidy0003");

        remove_checked(&root, &removed.worktree_path);
        super::tidy_goodboy_dir(&root);

        assert!(Path::new(&survivor.worktree_path).is_dir());
        let exclude_path = root.join(".git").join("info").join("exclude");
        let exclude = std::fs::read_to_string(&exclude_path).unwrap();
        assert_eq!(
            exclude.lines().filter(|line| *line == ".goodboy/").count(),
            1
        );
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn repo_default_base_branch_reads_origin_head() {
        let root = init_repo("default-base-branch");
        commit(&root, "a.txt", "hello", "init");
        push_to_new_remote(&root);
        git_ok(
            &root,
            &[
                "symbolic-ref",
                "refs/remotes/origin/HEAD",
                "refs/remotes/origin/main",
            ],
        );

        let resolved = super::repo_default_base_branch_blocking(root.to_str().unwrap().to_string());

        assert_eq!(resolved.unwrap(), Some("main".to_string()));
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn repo_default_base_branch_is_none_without_an_origin_head() {
        let root = init_repo("default-base-branch-none");
        commit(&root, "a.txt", "hello", "init");

        let resolved = super::repo_default_base_branch_blocking(root.to_str().unwrap().to_string());

        assert_eq!(resolved.unwrap(), None);
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn repo_default_base_branch_refuses_a_missing_repo() {
        let missing = std::env::temp_dir().join("goodboy-missing-repo-for-default-base");

        let resolved =
            super::repo_default_base_branch_blocking(missing.to_str().unwrap().to_string());

        assert!(resolved.is_err());
    }

    #[test]
    fn branch_merge_state_flags_a_branch_with_no_own_commits() {
        let root = init_repo("merge-state-empty");
        commit(&root, "a.txt", "hello", "init");
        git_ok(&root, &["branch", "goodboy/empty"]);

        let state = super::branch_merge_state(&root, "goodboy/empty", Some("main"), None);

        assert_eq!(state, super::BranchMergeState::NoOwnCommits);
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn branch_merge_state_reports_merged_via_merge_commit() {
        let root = init_repo("merge-state-merged");
        commit(&root, "a.txt", "hello", "init");
        git_ok(&root, &["checkout", "-b", "goodboy/feature"]);
        commit(&root, "b.txt", "feature", "feature work");
        git_ok(&root, &["checkout", "main"]);
        git_ok(
            &root,
            &["merge", "--no-ff", "-m", "merge feature", "goodboy/feature"],
        );

        let state = super::branch_merge_state(&root, "goodboy/feature", Some("main"), None);

        assert_eq!(state, super::BranchMergeState::MergedViaMerge);
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn branch_merge_state_reports_merged_via_rebase() {
        let root = init_repo("merge-state-rebased");
        commit(&root, "a.txt", "hello", "init");
        git_ok(&root, &["checkout", "-b", "goodboy/rebased"]);
        std::fs::write(root.join("b.txt"), "feature").unwrap();
        git_ok(&root, &["add", "b.txt"]);
        git_ok(&root, &["commit", "-m", "feature work"]);
        let feature_sha = git_ok(&root, &["rev-parse", "HEAD"]);
        git_ok(&root, &["checkout", "main"]);
        commit(&root, "c.txt", "main moved on", "main work");
        git_ok(&root, &["cherry-pick", &feature_sha]);

        let state = super::branch_merge_state(&root, "goodboy/rebased", Some("main"), None);

        assert_eq!(state, super::BranchMergeState::MergedViaRebase);
        std::fs::remove_dir_all(root).unwrap();
    }

    fn squash_merge(root: &Path, branch: &str) -> String {
        git_ok(root, &["checkout", "-b", branch]);
        commit(root, "b.txt", "one", "first");
        commit(root, "c.txt", "two", "second");
        let head = git_ok(root, &["rev-parse", "HEAD"]);
        git_ok(root, &["checkout", "main"]);
        commit(root, "d.txt", "main moved on", "main work");
        git_ok(root, &["merge", "--squash", branch]);
        git_ok(root, &["commit", "-m", "squash feature"]);
        head
    }

    #[test]
    fn branch_merge_state_reads_a_squash_as_merged_only_from_the_request() {
        let root = init_repo("merge-state-squashed");
        commit(&root, "a.txt", "hello", "init");
        let head = squash_merge(&root, "goodboy/squashed");

        let without = super::branch_merge_state(&root, "goodboy/squashed", Some("main"), None);
        let with = super::branch_merge_state(&root, "goodboy/squashed", Some("main"), Some(&head));

        assert_eq!(without, super::BranchMergeState::NotMerged { ahead: 2 });
        assert_eq!(with, super::BranchMergeState::MergedViaPr);
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn branch_merge_state_counts_commits_after_the_merged_head() {
        let root = init_repo("merge-state-merged-then");
        commit(&root, "a.txt", "hello", "init");
        let head = squash_merge(&root, "goodboy/reused");
        git_ok(&root, &["checkout", "goodboy/reused"]);
        commit(&root, "e.txt", "more", "after merge one");
        commit(&root, "f.txt", "more", "after merge two");
        git_ok(&root, &["checkout", "main"]);

        let state = super::branch_merge_state(&root, "goodboy/reused", Some("main"), Some(&head));

        assert_eq!(
            state,
            super::BranchMergeState::MergedThen { new_commits: 2 }
        );
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn branch_merge_state_falls_back_to_git_when_the_merged_head_is_unknown() {
        let root = init_repo("merge-state-missing-head");
        commit(&root, "a.txt", "hello", "init");
        git_ok(&root, &["checkout", "-b", "goodboy/feature"]);
        commit(&root, "b.txt", "feature", "feature work");
        git_ok(&root, &["checkout", "main"]);

        let state = super::branch_merge_state(
            &root,
            "goodboy/feature",
            Some("main"),
            Some("0000000000000000000000000000000000000000"),
        );

        assert_eq!(state, super::BranchMergeState::NotMerged { ahead: 1 });
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn branch_merge_state_reports_not_merged_when_ahead() {
        let root = init_repo("merge-state-unmerged");
        commit(&root, "a.txt", "hello", "init");
        git_ok(&root, &["checkout", "-b", "goodboy/reused"]);
        commit(&root, "b.txt", "feature", "feature work");

        let state = super::branch_merge_state(&root, "goodboy/reused", Some("main"), None);

        assert_eq!(state, super::BranchMergeState::NotMerged { ahead: 1 });
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn branch_merge_state_protects_the_base_branch_itself() {
        let root = init_repo("merge-state-protected");
        commit(&root, "a.txt", "hello", "init");

        let state = super::branch_merge_state(&root, "main", Some("main"), None);

        assert_eq!(state, super::BranchMergeState::Protected);
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn branch_merge_state_protects_a_branch_held_by_another_worktree() {
        let root = init_repo("merge-state-held");
        commit(&root, "a.txt", "hello", "init");
        git_ok(&root, &["branch", "goodboy/held"]);
        let other = root.join("other-worktree");
        git_ok(
            &root,
            &["worktree", "add", other.to_str().unwrap(), "goodboy/held"],
        );

        let state = super::branch_merge_state(&root, "goodboy/held", Some("main"), None);

        assert_eq!(state, super::BranchMergeState::Protected);
        git_ok(
            &root,
            &["worktree", "remove", "--force", other.to_str().unwrap()],
        );
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn branch_merge_state_is_unknown_without_a_resolvable_base() {
        let root = init_repo("merge-state-unknown-base");
        commit(&root, "a.txt", "hello", "init");
        git_ok(&root, &["branch", "goodboy/orphan"]);
        git_ok(&root, &["branch", "-m", "main", "trunk"]);

        let state = super::branch_merge_state(&root, "goodboy/orphan", None, None);

        assert_eq!(state, super::BranchMergeState::Unknown);
        std::fs::remove_dir_all(root).unwrap();
    }
}

#[cfg(test)]
mod default_base_tests {
    use super::{
        worktree_changed_files_blocking, worktree_create_blocking, worktree_diff_blocking,
        worktree_status_blocking, BranchIntegration, CreateArgs, GitDistance,
    };
    use std::path::{Path, PathBuf};

    fn git_ok(cwd: &Path, args: &[&str]) -> String {
        super::git(cwd, args)
            .unwrap_or_else(|err| panic!("git {} failed: {err}", args.join(" ")))
            .trim()
            .to_string()
    }

    fn repo_on(name: &str, branch: &str) -> PathBuf {
        let root = std::env::temp_dir().join(format!(
            "goodboy-default-base-{name}-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        std::fs::create_dir_all(&root).unwrap();
        let root = std::fs::canonicalize(root).unwrap();
        git_ok(&root, &["init", "-b", branch]);
        git_ok(&root, &["config", "user.email", "test@example.com"]);
        git_ok(&root, &["config", "user.name", "test"]);
        git_ok(&root, &["config", "commit.gpgsign", "false"]);
        commit(&root, "base.txt", "base\n", "base");
        root
    }

    fn commit(root: &Path, file: &str, body: &str, message: &str) -> String {
        std::fs::write(root.join(file), body).unwrap();
        git_ok(root, &["add", file]);
        git_ok(root, &["commit", "-m", message]);
        git_ok(root, &["rev-parse", "HEAD"])
    }

    fn mount(root: &Path, slug: &str) -> PathBuf {
        let parent = root.join(".goodboy").join("worktrees");
        let created = worktree_create_blocking(CreateArgs {
            repo_path: root.to_string_lossy().into_owned(),
            branch_prefix: "goodboy".to_string(),
            slug: slug.to_string(),
            parent_dir: Some(parent.to_string_lossy().into_owned()),
            existing_branch: None,
            fallback_ref: None,
            base_branch: None,
            dir_name: Some(slug.to_string()),
        })
        .unwrap();
        let path = PathBuf::from(created.worktree_path);
        git_ok(&path, &["config", "user.email", "test@example.com"]);
        git_ok(&path, &["config", "user.name", "test"]);
        path
    }

    fn cleanup(root: PathBuf) {
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn a_new_mount_is_cut_from_the_develop_branch_of_a_develop_repo() {
        let root = repo_on("create", "develop");
        let tip = commit(&root, "tip.txt", "tip\n", "tip");

        let path = mount(&root, "dev-create");

        assert_eq!(git_ok(&path, &["rev-parse", "HEAD"]), tip);
        cleanup(root);
    }

    #[test]
    fn a_new_mount_is_cut_from_a_custom_default_branch_when_no_remote_names_one() {
        let root = repo_on("create-release", "release");
        let tip = commit(&root, "tip.txt", "tip\n", "tip");

        let path = mount(&root, "rel-create");

        assert_eq!(git_ok(&path, &["rev-parse", "HEAD"]), tip);
        cleanup(root);
    }

    #[test]
    fn the_base_of_a_develop_repo_resolves_to_develop_for_diff_and_status() {
        let root = repo_on("resolve", "develop");
        let fork = git_ok(&root, &["rev-parse", "HEAD"]);
        let path = mount(&root, "dev-resolve");
        commit(&path, "feature.txt", "a\nb\n", "feature");

        let (base_ref, merge_base) = super::resolve_base(&path, None).expect("develop resolves");
        let status = worktree_status_blocking(path.to_string_lossy().into_owned(), None).unwrap();
        let diff = worktree_diff_blocking(path.to_string_lossy().into_owned(), None).unwrap();
        let changed =
            worktree_changed_files_blocking(path.to_string_lossy().into_owned(), None).unwrap();

        assert_eq!((base_ref, merge_base), ("develop".to_string(), fork));
        assert_eq!(
            status.main_distance,
            GitDistance::Known {
                ahead: 1,
                behind: 0
            }
        );
        assert!(diff.contains("feature.txt"));
        assert_eq!(changed.additions, 2);
        cleanup(root);
    }

    #[test]
    fn a_custom_default_branch_resolves_through_the_main_checkout_of_a_linked_mount() {
        let root = repo_on("resolve-release", "release");
        let path = mount(&root, "rel-resolve");
        commit(&path, "feature.txt", "a\n", "feature");

        let (base_ref, _) = super::resolve_base(&path, None).expect("release resolves");

        assert_eq!(base_ref, "release");
        cleanup(root);
    }

    #[test]
    fn the_merge_check_of_a_develop_repo_uses_develop() {
        let root = repo_on("integration", "develop");
        let path = mount(&root, "dev-integration");
        let branch = git_ok(&path, &["rev-parse", "--abbrev-ref", "HEAD"]);
        commit(&path, "feature.txt", "a\n", "feature");

        assert_eq!(
            super::resolve_base_ref(&path, None).as_deref(),
            Some("develop")
        );
        assert_eq!(
            super::branch_integration(&path, None, true),
            BranchIntegration::Unmerged {
                base: "develop".to_string(),
                ahead: 1
            }
        );

        git_ok(&root, &["merge", "--ff-only", &branch]);

        assert_eq!(
            super::branch_integration(&path, None, true),
            BranchIntegration::Merged {
                base: "develop".to_string()
            }
        );
        cleanup(root);
    }

    #[test]
    fn a_develop_repo_without_origin_head_prefers_the_remote_develop() {
        let root = repo_on("origin-develop", "develop");
        let remote = root.join("remote.git");
        git_ok(&root, &["init", "--bare", remote.to_str().unwrap()]);
        git_ok(
            &root,
            &["remote", "add", "origin", remote.to_str().unwrap()],
        );
        git_ok(&root, &["push", "-u", "origin", "develop"]);
        git_ok(&root, &["checkout", "-b", "scratch"]);
        let path = mount(&root, "dev-origin");
        commit(&path, "feature.txt", "a\n", "feature");

        assert!(super::git(&root, &["symbolic-ref", "refs/remotes/origin/HEAD"]).is_err());
        assert_eq!(
            super::resolve_base_ref(&path, None).as_deref(),
            Some("origin/develop")
        );
        assert_eq!(
            super::resolve_base(&path, None).map(|(base_ref, _)| base_ref),
            Some("origin/develop".to_string())
        );
        cleanup(root);
    }

    #[test]
    fn main_still_wins_over_develop_when_both_exist_and_no_remote_names_a_default() {
        let root = repo_on("both", "main");
        git_ok(&root, &["checkout", "-b", "develop"]);
        let path = mount(&root, "both-main");
        commit(&path, "feature.txt", "a\n", "feature");

        assert_eq!(
            super::resolve_base(&path, None).map(|(base_ref, _)| base_ref),
            Some("main".to_string())
        );
        assert_eq!(
            super::resolve_base_ref(&path, None).as_deref(),
            Some("main")
        );
        cleanup(root);
    }

    #[test]
    fn a_checkout_on_a_known_default_name_is_never_its_own_base() {
        for name in ["main", "develop"] {
            let root = repo_on(&format!("own-{name}"), name);

            assert_eq!(super::resolve_base(&root, None), None, "{name}");
            assert_eq!(super::resolve_base_ref(&root, None), None, "{name}");
            assert_eq!(super::default_base_name(&root, false), None, "{name}");
            assert!(
                crate::history::rebase_plan(&root, None, false).is_err(),
                "{name}"
            );
            cleanup(root);
        }
    }

    #[test]
    fn a_dangling_origin_head_falls_through_for_every_resolver() {
        let root = repo_on("dangling-head", "main");
        let remote = root.join("remote.git");
        git_ok(&root, &["init", "--bare", remote.to_str().unwrap()]);
        git_ok(
            &root,
            &["remote", "add", "origin", remote.to_str().unwrap()],
        );
        git_ok(&root, &["push", "-u", "origin", "main"]);
        git_ok(
            &root,
            &[
                "symbolic-ref",
                "refs/remotes/origin/HEAD",
                "refs/remotes/origin/master",
            ],
        );
        let path = mount(&root, "dangling");
        commit(&path, "feature.txt", "a\n", "feature");

        let plan = crate::history::rebase_plan(&path, None, false).unwrap();

        assert_eq!(plan.onto_ref, "origin/main");
        assert_eq!(
            super::default_base_name(&path, false).as_deref(),
            Some("main")
        );
        assert_eq!(
            super::resolve_base(&path, None).map(|(base_ref, _)| base_ref),
            Some("origin/main".to_string())
        );
        assert_eq!(
            super::resolve_base_ref(&path, None).as_deref(),
            Some("origin/main")
        );
        cleanup(root);
    }

    #[test]
    fn a_checkout_on_its_own_branch_does_not_become_its_own_base() {
        let root = repo_on("self-base", "trunk");

        assert_eq!(super::resolve_base(&root, None), None);
        assert_eq!(super::resolve_base_ref(&root, None), None);
        cleanup(root);
    }
}

#[cfg(test)]
mod changed_files_tests {
    use super::worktree_changed_files_blocking;
    use std::path::{Path, PathBuf};

    fn git_ok(cwd: &Path, args: &[&str]) -> String {
        super::git(cwd, args)
            .unwrap_or_else(|err| panic!("git {} failed: {err}", args.join(" ")))
            .trim()
            .to_string()
    }

    fn init_repo(name: &str) -> PathBuf {
        let root = std::env::temp_dir().join(format!(
            "goodboy-{name}-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        std::fs::create_dir_all(&root).unwrap();
        git_ok(&root, &["init", "-b", "main"]);
        git_ok(&root, &["config", "user.email", "test@example.com"]);
        git_ok(&root, &["config", "user.name", "test"]);
        git_ok(&root, &["config", "commit.gpgsign", "false"]);
        std::fs::write(root.join("base.txt"), "one\n").unwrap();
        git_ok(&root, &["add", "base.txt"]);
        git_ok(&root, &["commit", "-m", "base"]);
        root
    }

    fn summary(root: &Path) -> (u32, u32) {
        let out = worktree_changed_files_blocking(
            root.to_string_lossy().to_string(),
            Some("main".to_string()),
        )
        .unwrap();
        (out.additions, out.deletions)
    }

    #[test]
    fn counts_the_branch_work_while_it_is_still_waiting_to_land() {
        let root = init_repo("changed-files-open");
        git_ok(&root, &["checkout", "-b", "feature"]);
        std::fs::write(root.join("feature.txt"), "a\nb\nc\n").unwrap();
        git_ok(&root, &["add", "feature.txt"]);
        git_ok(&root, &["commit", "-m", "feature"]);

        assert_eq!(summary(&root), (3, 0));

        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn stops_counting_the_branch_work_once_the_base_carries_it() {
        let root = init_repo("changed-files-merged");
        git_ok(&root, &["checkout", "-b", "feature"]);
        std::fs::write(root.join("feature.txt"), "a\nb\nc\n").unwrap();
        git_ok(&root, &["add", "feature.txt"]);
        git_ok(&root, &["commit", "-m", "feature"]);
        git_ok(&root, &["checkout", "main"]);
        git_ok(
            &root,
            &["merge", "--no-ff", "-m", "merge feature", "feature"],
        );
        git_ok(&root, &["checkout", "feature"]);

        assert_eq!(summary(&root), (0, 0));

        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn keeps_counting_uncommitted_work_on_a_landed_branch() {
        let root = init_repo("changed-files-landed-dirty");
        git_ok(&root, &["checkout", "-b", "feature"]);
        std::fs::write(root.join("feature.txt"), "a\nb\nc\n").unwrap();
        git_ok(&root, &["add", "feature.txt"]);
        git_ok(&root, &["commit", "-m", "feature"]);
        git_ok(&root, &["checkout", "main"]);
        git_ok(
            &root,
            &["merge", "--no-ff", "-m", "merge feature", "feature"],
        );
        git_ok(&root, &["checkout", "feature"]);
        std::fs::write(root.join("feature.txt"), "a\nb\nc\nd\n").unwrap();

        assert_eq!(summary(&root), (1, 0));

        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn reads_a_squash_of_several_commits_as_landed_too() {
        let root = init_repo("changed-files-squashed");
        git_ok(&root, &["checkout", "-b", "feature"]);
        std::fs::write(root.join("feature.txt"), "a\nb\n").unwrap();
        git_ok(&root, &["add", "feature.txt"]);
        git_ok(&root, &["commit", "-m", "feature one"]);
        std::fs::write(root.join("feature.txt"), "a\nb\nc\n").unwrap();
        git_ok(&root, &["add", "feature.txt"]);
        git_ok(&root, &["commit", "-m", "feature two"]);
        git_ok(&root, &["checkout", "main"]);
        git_ok(&root, &["merge", "--squash", "feature"]);
        git_ok(&root, &["commit", "-m", "feature squashed"]);
        git_ok(&root, &["checkout", "feature"]);

        assert_eq!(summary(&root), (0, 0));

        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn still_counts_a_branch_the_base_only_partly_carries() {
        let root = init_repo("changed-files-partly-landed");
        git_ok(&root, &["checkout", "-b", "feature"]);
        std::fs::write(root.join("feature.txt"), "a\nb\nc\n").unwrap();
        git_ok(&root, &["add", "feature.txt"]);
        git_ok(&root, &["commit", "-m", "feature"]);
        std::fs::write(root.join("later.txt"), "d\ne\n").unwrap();
        git_ok(&root, &["add", "later.txt"]);
        git_ok(&root, &["commit", "-m", "later"]);
        git_ok(&root, &["checkout", "main"]);
        git_ok(&root, &["checkout", "feature", "--", "feature.txt"]);
        git_ok(&root, &["add", "feature.txt"]);
        git_ok(&root, &["commit", "-m", "took only the first file"]);
        git_ok(&root, &["checkout", "feature"]);

        assert_eq!(summary(&root), (5, 0));

        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn keeps_counting_a_branch_the_base_changed_further() {
        let root = init_repo("changed-files-moved-on");
        git_ok(&root, &["checkout", "-b", "feature"]);
        std::fs::write(root.join("feature.txt"), "a\nb\nc\n").unwrap();
        git_ok(&root, &["add", "feature.txt"]);
        git_ok(&root, &["commit", "-m", "feature"]);
        git_ok(&root, &["checkout", "main"]);
        std::fs::write(root.join("feature.txt"), "x\ny\n").unwrap();
        git_ok(&root, &["add", "feature.txt"]);
        git_ok(&root, &["commit", "-m", "someone else wrote it first"]);
        git_ok(&root, &["checkout", "feature"]);

        assert_eq!(summary(&root), (3, 0));

        std::fs::remove_dir_all(root).unwrap();
    }
}

#[cfg(test)]
mod teardown_tests {
    use super::{
        allocated_bytes, collect_orphans, inspect_worktree_with, remove_worktree_checked_leased,
        remove_worktree_checked_with, remove_worktree_folder_with,
        worktree_detach_assessment_blocking, worktree_directory_size_blocking, BranchIntegration,
        WorktreeDetachAssessment, WorktreeError, WorktreeInspection, WorktreeRemovalMode,
        WorktreeRemovalReason, WorktreeRemovalResult, REPRODUCIBLE_IGNORED_DIRS,
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

    fn not_empty() -> WorktreeError {
        WorktreeError::Git {
            message:
                "git worktree remove --force /x failed: fatal: could not remove: Directory not empty"
                    .to_string(),
        }
    }

    fn git_ok(cwd: &Path, args: &[&str]) -> String {
        super::git(cwd, args)
            .unwrap_or_else(|error| panic!("git {} failed: {error}", args.join(" ")))
            .trim()
            .to_string()
    }

    fn init_repo(name: &str) -> PathBuf {
        let root = temp_root(name);
        git_ok(&root, &["init", "-b", "main"]);
        git_ok(&root, &["config", "user.email", "test@example.com"]);
        git_ok(&root, &["config", "user.name", "test"]);
        std::fs::write(root.join(".gitignore"), "node_modules/\n").unwrap();
        std::fs::write(root.join("tracked.txt"), "base\n").unwrap();
        git_ok(&root, &["add", ".gitignore", "tracked.txt"]);
        git_ok(&root, &["commit", "-m", "base"]);
        std::fs::canonicalize(root).unwrap()
    }

    fn add_worktree(root: &Path, name: &str) -> PathBuf {
        let target = root.join("worktrees").join(name);
        git_ok(
            root,
            &[
                "worktree",
                "add",
                "-b",
                &format!("test/{name}"),
                target.to_str().unwrap(),
            ],
        );
        std::fs::canonicalize(target).unwrap()
    }

    fn remove(root: &Path, target: &Path) -> WorktreeRemovalResult {
        remove_with_mode(root, target, WorktreeRemovalMode::Safe)
    }

    fn remove_with_mode(
        root: &Path,
        target: &Path,
        mode: WorktreeRemovalMode,
    ) -> WorktreeRemovalResult {
        remove_worktree_checked_with(
            root,
            target,
            mode,
            &mut |cwd, args| super::git(cwd, args),
            &mut |_| false,
        )
        .unwrap()
    }

    fn kept_reasons(result: WorktreeRemovalResult) -> Vec<WorktreeRemovalReason> {
        let WorktreeRemovalResult::Kept { reasons, .. } = result else {
            panic!("expected kept result, found {result:?}");
        };
        reasons
    }

    #[test]
    fn clean_registered_worktree_with_ignored_dependencies_is_removed() {
        let root = init_repo("remove-clean");
        let target = add_worktree(&root, "clean");
        std::fs::create_dir_all(target.join("node_modules").join("dep")).unwrap();
        std::fs::write(
            target.join("node_modules").join("dep").join("index.js"),
            "x",
        )
        .unwrap();

        let result = remove(&root, &target);

        assert!(matches!(result, WorktreeRemovalResult::Removed { .. }));
        assert!(!target.exists());
    }

    #[test]
    fn dependency_size_is_reported_and_disappears_after_safe_cleanup() {
        let root = init_repo("remove-dependencies");
        let target = add_worktree(&root, "dependencies");
        std::fs::create_dir_all(target.join("node_modules").join("dep")).unwrap();
        std::fs::write(
            target.join("node_modules").join("dep").join("index.js"),
            vec![0u8; 4096],
        )
        .unwrap();

        let before = worktree_directory_size_blocking(target.to_string_lossy().into_owned());
        let removed = remove(&root, &target);
        let after = worktree_directory_size_blocking(target.to_string_lossy().into_owned());

        assert!(before.size_bytes.is_some_and(|bytes| bytes >= 4096));
        assert!(matches!(removed, WorktreeRemovalResult::Removed { .. }));
        assert_eq!((after.exists, after.size_bytes), (false, None));
    }

    #[test]
    fn dirty_worktree_is_kept_with_each_change_reason() {
        let root = init_repo("remove-dirty");
        let target = add_worktree(&root, "dirty");
        std::fs::write(target.join("tracked.txt"), "changed\n").unwrap();
        std::fs::write(target.join("staged.txt"), "staged\n").unwrap();
        git_ok(&target, &["add", "staged.txt"]);
        std::fs::write(target.join("untracked.txt"), "untracked\n").unwrap();

        let reasons = kept_reasons(remove(&root, &target));

        assert!(reasons.contains(&WorktreeRemovalReason::StagedChanges));
        assert!(reasons.contains(&WorktreeRemovalReason::UnstagedChanges));
        assert!(reasons.contains(&WorktreeRemovalReason::UntrackedFiles));
        assert!(target.exists());
    }

    #[test]
    fn conflicted_worktree_and_in_progress_merge_are_kept() {
        let root = init_repo("remove-conflict");
        let target = add_worktree(&root, "conflict");
        std::fs::write(root.join("tracked.txt"), "main\n").unwrap();
        git_ok(&root, &["commit", "-am", "main change"]);
        std::fs::write(target.join("tracked.txt"), "branch\n").unwrap();
        git_ok(&target, &["commit", "-am", "branch change"]);
        assert!(super::git(&target, &["merge", "main"]).is_err());

        let reasons = kept_reasons(remove(&root, &target));

        assert!(reasons.contains(&WorktreeRemovalReason::UnmergedConflicts));
        assert!(reasons.contains(&WorktreeRemovalReason::OperationInProgress));
        assert!(target.exists());
    }

    #[test]
    fn status_failure_is_treated_as_unsafe() {
        let root = init_repo("remove-status-failure");
        let target = add_worktree(&root, "status-failure");
        let git_dir = PathBuf::from(git_ok(&target, &["rev-parse", "--absolute-git-dir"]));
        std::fs::write(git_dir.join("index"), "invalid index").unwrap();

        let reasons = kept_reasons(remove(&root, &target));

        assert_eq!(reasons, vec![WorktreeRemovalReason::StatusUnavailable]);
        assert!(target.exists());
    }

    #[test]
    fn locked_worktree_is_kept() {
        let root = init_repo("remove-locked");
        let target = add_worktree(&root, "locked");
        git_ok(
            &root,
            &[
                "worktree",
                "lock",
                "--reason",
                "busy",
                target.to_str().unwrap(),
            ],
        );

        let reasons = kept_reasons(remove(&root, &target));

        assert_eq!(reasons, vec![WorktreeRemovalReason::Locked]);
        assert!(target.exists());
    }

    #[test]
    fn wrong_repository_and_main_checkout_are_kept() {
        let root = init_repo("remove-owner");
        let other = init_repo("remove-other-owner");
        let target = add_worktree(&root, "owned");

        let wrong_repo = kept_reasons(remove(&other, &target));
        let main_checkout = kept_reasons(remove(&root, &root));

        assert_eq!(wrong_repo, vec![WorktreeRemovalReason::DifferentRepository]);
        assert_eq!(main_checkout, vec![WorktreeRemovalReason::MainCheckout]);
        assert!(target.exists());
    }

    #[test]
    fn missing_path_is_reported_without_removal() {
        let root = init_repo("remove-missing");
        let target = root.join("missing");

        let result = remove(&root, &target);

        assert_eq!(
            result,
            WorktreeRemovalResult::Missing {
                path: target.to_string_lossy().into_owned()
            }
        );
    }

    #[test]
    fn unexpected_directory_is_kept() {
        let root = init_repo("remove-unexpected");
        let target = root.join("unexpected");
        std::fs::create_dir_all(&target).unwrap();

        let reasons = kept_reasons(remove(&root, &target));

        assert_eq!(reasons, vec![WorktreeRemovalReason::UnexpectedDirectory]);
        assert!(target.exists());
    }

    #[test]
    fn a_lease_taken_through_a_symlinked_path_keeps_the_worktree() {
        let root = init_repo("remove-leased-symlink");
        let target = add_worktree(&root, "leased");
        let mirror = temp_root("remove-leased-mirror").join("mirror");
        std::os::unix::fs::symlink(&root, &mirror).unwrap();
        let path_the_agent_sees = mirror.join("worktrees").join("leased");
        let registry = crate::worktree_writer::WriterLeases::new().0;
        let granted = crate::worktree_writer::acquire_lease(
            &registry,
            path_the_agent_sees.to_string_lossy().as_ref(),
            "agent-1",
            None,
        );

        let result =
            remove_worktree_checked_leased(&registry, &root, &target, WorktreeRemovalMode::Safe)
                .unwrap();

        assert!(granted.is_granted);
        assert_ne!(path_the_agent_sees, target);
        assert_eq!(
            kept_reasons(result),
            vec![WorktreeRemovalReason::WriterLeaseHeld]
        );
        assert!(target.join("tracked.txt").exists());
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn a_released_lease_no_longer_keeps_the_worktree() {
        let root = init_repo("remove-lease-released");
        let target = add_worktree(&root, "released");
        let registry = crate::worktree_writer::WriterLeases::new().0;
        let granted = crate::worktree_writer::acquire_lease(
            &registry,
            target.to_string_lossy().as_ref(),
            "agent-1",
            None,
        );
        crate::worktree_writer::release_lease(
            &registry,
            target.to_string_lossy().as_ref(),
            "agent-1",
            granted.token.as_deref(),
        );

        let result =
            remove_worktree_checked_leased(&registry, &root, &target, WorktreeRemovalMode::Safe)
                .unwrap();

        assert!(matches!(result, WorktreeRemovalResult::Removed { .. }));
        assert!(!target.exists());
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn fallback_removes_only_the_revalidated_registered_target() {
        let root = init_repo("remove-fallback");
        let target = add_worktree(&root, "fallback");
        let neighbor = root.join("worktrees").join("keep-me");
        std::fs::create_dir_all(target.join("node_modules").join("dep")).unwrap();
        std::fs::write(
            target.join("node_modules").join("dep").join("index.js"),
            "x",
        )
        .unwrap();
        std::fs::create_dir_all(&neighbor).unwrap();
        let mut remove_attempts = 0;

        let result = remove_worktree_checked_with(
            &root,
            &target,
            WorktreeRemovalMode::Safe,
            &mut |cwd, args| {
                if args.starts_with(&["worktree", "remove"]) {
                    remove_attempts += 1;
                    return Err(not_empty());
                }
                super::git(cwd, args)
            },
            &mut |_| false,
        )
        .unwrap();

        assert!(matches!(result, WorktreeRemovalResult::Removed { .. }));
        assert_eq!(remove_attempts, 2);
        assert!(!target.exists());
        assert!(neighbor.exists());
    }

    #[test]
    fn fallback_keeps_a_target_that_changes_before_revalidation() {
        let root = init_repo("remove-fallback-swap");
        let target = add_worktree(&root, "fallback-swap");
        let displaced = root.join("displaced");
        let mut remove_attempts = 0;

        let result = remove_worktree_checked_with(
            &root,
            &target,
            WorktreeRemovalMode::Safe,
            &mut |cwd, args| {
                if args.starts_with(&["worktree", "remove"]) {
                    remove_attempts += 1;
                    if remove_attempts == 2 {
                        std::fs::rename(&target, &displaced).unwrap();
                        std::fs::create_dir_all(&target).unwrap();
                        std::fs::write(target.join("precious.txt"), "keep").unwrap();
                    }
                    return Err(not_empty());
                }
                super::git(cwd, args)
            },
            &mut |_| false,
        )
        .unwrap();

        assert_eq!(
            kept_reasons(result),
            vec![WorktreeRemovalReason::UnexpectedDirectory]
        );
        assert!(target.join("precious.txt").exists());
    }

    #[test]
    fn inspection_distinguishes_registered_missing_foreign_and_unavailable() {
        let root = init_repo("inspect");
        let target = add_worktree(&root, "registered");
        let foreign = root.join("foreign");
        let missing = root.join("missing");
        let unavailable = root.join("unavailable");
        std::fs::create_dir_all(&foreign).unwrap();
        let mut run_git = |cwd: &Path, args: &[&str]| super::git(cwd, args);

        let registered = inspect_worktree_with(&root, &target, &mut run_git);
        let missing_result = inspect_worktree_with(&root, &missing, &mut run_git);
        let foreign_result = inspect_worktree_with(&root, &foreign, &mut run_git);
        let unavailable_result = inspect_worktree_with(&unavailable, &foreign, &mut run_git);

        assert!(matches!(registered, WorktreeInspection::Registered { .. }));
        assert!(matches!(missing_result, WorktreeInspection::Missing { .. }));
        assert!(matches!(
            foreign_result,
            WorktreeInspection::ForeignDirectory { .. }
        ));
        assert!(matches!(
            unavailable_result,
            WorktreeInspection::RepositoryUnavailable { .. }
        ));
    }

    fn make_worktree_dir(parent: &Path, name: &str, bytes: usize) -> PathBuf {
        let dir = parent.join(name);
        std::fs::create_dir_all(dir.join("src")).unwrap();
        std::fs::write(dir.join("src").join("main.ts"), "x".repeat(bytes)).unwrap();
        dir
    }

    #[test]
    fn a_folder_git_forgot_and_no_session_claims_is_reported() {
        let root = temp_root("orphan-scan");
        let parent = root.join(".goodboy").join("worktrees");
        std::fs::create_dir_all(&parent).unwrap();
        let registered = make_worktree_dir(&parent, "gb-live", 10);
        let claimed = make_worktree_dir(&parent, "gb-known", 10);
        let orphan = make_worktree_dir(&parent, "gb-ghost", 4096);

        let found = collect_orphans(
            &root,
            &[registered.to_string_lossy().into_owned()],
            &[claimed.to_string_lossy().into_owned()],
        );

        assert_eq!(
            found.iter().map(|o| o.name.as_str()).collect::<Vec<_>>(),
            vec!["gb-ghost", "gb-live"]
        );
        assert!(!found[0].is_registered);
        assert!(found[1].is_registered);
        assert!(orphan.exists());
        assert!(registered.exists());
        assert!(claimed.exists());
    }

    #[test]
    fn directory_size_counts_files_without_following_symlinks() {
        let root = temp_root("directory-size");
        let target = root.join("target");
        let external = root.join("external.bin");
        std::fs::create_dir_all(target.join("nested")).unwrap();
        std::fs::write(target.join("one.bin"), vec![0u8; 10]).unwrap();
        std::fs::write(target.join("nested").join("two.bin"), vec![0u8; 25]).unwrap();
        std::fs::write(&external, vec![0u8; 4096]).unwrap();
        #[cfg(unix)]
        std::os::unix::fs::symlink(&external, target.join("external-link")).unwrap();

        let result = worktree_directory_size_blocking(target.to_string_lossy().into_owned());

        let expected = [
            target.join("one.bin"),
            target.join("nested").join("two.bin"),
        ]
        .iter()
        .map(|file| allocated_bytes(&std::fs::metadata(file).unwrap()))
        .sum::<u64>();
        assert_eq!(result.size_bytes, Some(expected));
        assert!(expected >= 35);
        assert!(!result.is_partial);
        assert!(result.exists);
    }

    #[cfg(unix)]
    #[test]
    fn directory_size_counts_allocated_blocks_so_sparse_files_stay_small() {
        let root = temp_root("directory-size-sparse");
        let target = root.join("target");
        std::fs::create_dir_all(&target).unwrap();
        let sparse = std::fs::File::create(target.join("sparse.bin")).unwrap();
        sparse.set_len(64 * 1024 * 1024).unwrap();

        let result = worktree_directory_size_blocking(target.to_string_lossy().into_owned());

        assert!(result.size_bytes.unwrap() < 64 * 1024 * 1024);
    }

    #[test]
    fn absent_directory_has_no_size() {
        let root = temp_root("directory-size-missing");
        let target = root.join("missing");

        let result = worktree_directory_size_blocking(target.to_string_lossy().into_owned());

        assert_eq!(result.size_bytes, None);
        assert!(!result.is_partial);
        assert!(!result.exists);
    }

    #[cfg(unix)]
    #[test]
    fn unreadable_directory_is_distinct_from_an_empty_directory() {
        use std::os::unix::fs::PermissionsExt;

        let root = temp_root("directory-size-unreadable");
        let empty = root.join("empty");
        let unreadable = root.join("unreadable");
        std::fs::create_dir_all(&empty).unwrap();
        std::fs::create_dir_all(&unreadable).unwrap();
        std::fs::set_permissions(&unreadable, std::fs::Permissions::from_mode(0o000)).unwrap();

        let empty_result = worktree_directory_size_blocking(empty.to_string_lossy().into_owned());
        let unreadable_result =
            worktree_directory_size_blocking(unreadable.to_string_lossy().into_owned());

        std::fs::set_permissions(&unreadable, std::fs::Permissions::from_mode(0o700)).unwrap();
        assert_eq!(empty_result.size_bytes, Some(0));
        assert!(!empty_result.is_partial);
        assert_eq!(unreadable_result.size_bytes, None);
        assert!(unreadable_result.is_partial);
    }

    #[cfg(unix)]
    #[test]
    fn unreadable_child_marks_a_partial_size() {
        use std::os::unix::fs::PermissionsExt;

        let root = temp_root("directory-size-partial");
        let target = root.join("target");
        let unreadable = target.join("unreadable");
        std::fs::create_dir_all(&unreadable).unwrap();
        std::fs::write(target.join("readable.bin"), vec![0u8; 17]).unwrap();
        std::fs::write(unreadable.join("hidden.bin"), vec![0u8; 100]).unwrap();
        std::fs::set_permissions(&unreadable, std::fs::Permissions::from_mode(0o000)).unwrap();

        let result = worktree_directory_size_blocking(target.to_string_lossy().into_owned());

        std::fs::set_permissions(&unreadable, std::fs::Permissions::from_mode(0o700)).unwrap();
        let readable = allocated_bytes(&std::fs::metadata(target.join("readable.bin")).unwrap());
        assert_eq!(result.size_bytes, Some(readable));
        assert!(result.is_partial);
        assert!(result.exists);
    }

    fn add_goodboy_worktree(root: &Path, name: &str) -> PathBuf {
        let target = root.join(".goodboy").join("worktrees").join(name);
        git_ok(
            root,
            &[
                "worktree",
                "add",
                "-b",
                &format!("goodboy/{name}"),
                target.to_str().unwrap(),
            ],
        );
        std::fs::canonicalize(target).unwrap()
    }

    fn remove_folder(
        root: &Path,
        target: &Path,
        mode: WorktreeRemovalMode,
    ) -> WorktreeRemovalResult {
        remove_worktree_folder_with(
            root,
            target,
            mode,
            &mut |cwd, args| super::git(cwd, args),
            &mut |_| false,
        )
        .unwrap()
    }

    #[test]
    fn folder_removal_removes_a_clean_goodboy_worktree_and_keeps_its_branch() {
        let root = init_repo("folder-clean");
        let target = add_goodboy_worktree(&root, "gb-clean");

        let result = remove_folder(&root, &target, WorktreeRemovalMode::Safe);

        assert!(
            matches!(result, WorktreeRemovalResult::Removed { .. }),
            "{result:?}"
        );
        assert!(!target.exists());
        assert_eq!(
            git_ok(&root, &["branch", "--list", "goodboy/gb-clean"]),
            "goodboy/gb-clean"
        );
    }

    fn commit_in(worktree: &Path, name: &str) {
        std::fs::write(worktree.join(name), "work\n").unwrap();
        git_ok(worktree, &["add", name]);
        git_ok(worktree, &["commit", "-m", name]);
    }

    #[test]
    fn folder_removal_keeps_a_clean_worktree_with_unpushed_commits_until_confirmed() {
        let root = init_repo("folder-unpushed");
        let target = add_goodboy_worktree(&root, "gb-unpushed");
        commit_in(&target, "local.txt");

        let safe = remove_folder(&root, &target, WorktreeRemovalMode::Safe);
        assert_eq!(
            kept_reasons(safe),
            vec![WorktreeRemovalReason::UnpushedCommits]
        );
        assert!(target.join("local.txt").exists());

        let confirmed = remove_folder(&root, &target, WorktreeRemovalMode::Confirmed);
        assert!(
            matches!(confirmed, WorktreeRemovalResult::Removed { .. }),
            "{confirmed:?}"
        );
        assert!(!target.exists());
    }

    #[test]
    fn folder_removal_allowing_local_commits_removes_a_clean_folder_and_keeps_its_branch() {
        let root = init_repo("folder-unpushed-allowed");
        let target = add_goodboy_worktree(&root, "gb-allowed");
        commit_in(&target, "local.txt");

        let result = super::remove_worktree_folder_allowing(
            &root,
            &target,
            WorktreeRemovalMode::Safe,
            true,
            &mut |cwd, args| super::git(cwd, args),
            &mut |_| false,
        )
        .unwrap();

        assert!(
            matches!(result, WorktreeRemovalResult::Removed { .. }),
            "{result:?}"
        );
        assert!(!target.exists());
        assert_eq!(
            git_ok(&root, &["rev-parse", "--verify", "goodboy/gb-allowed"]).len(),
            40
        );
    }

    #[test]
    fn folder_removal_allowing_local_commits_still_keeps_uncommitted_work() {
        let root = init_repo("folder-unpushed-allowed-dirty");
        let target = add_goodboy_worktree(&root, "gb-allowed-dirty");
        commit_in(&target, "local.txt");
        std::fs::write(target.join("draft.txt"), "draft\n").unwrap();

        let result = super::remove_worktree_folder_allowing(
            &root,
            &target,
            WorktreeRemovalMode::Safe,
            true,
            &mut |cwd, args| super::git(cwd, args),
            &mut |_| false,
        )
        .unwrap();

        assert_eq!(
            kept_reasons(result),
            vec![WorktreeRemovalReason::UntrackedFiles]
        );
        assert!(target.exists());
    }

    #[test]
    fn folder_removal_keeps_a_pushed_branch_with_newer_local_commits() {
        let root = init_repo("folder-unpushed-remote");
        publish_repo(&root);
        let target = add_goodboy_worktree(&root, "gb-ahead");
        commit_in(&target, "pushed.txt");
        git_ok(&target, &["push", "-u", "origin", "goodboy/gb-ahead"]);
        commit_in(&target, "local.txt");

        let result = remove_folder(&root, &target, WorktreeRemovalMode::Safe);

        assert_eq!(
            kept_reasons(result),
            vec![WorktreeRemovalReason::UnpushedCommits]
        );
        assert!(target.exists());
    }

    #[test]
    fn folder_removal_removes_a_clean_worktree_whose_branch_is_pushed() {
        let root = init_repo("folder-pushed");
        publish_repo(&root);
        let target = add_goodboy_worktree(&root, "gb-pushed");
        commit_in(&target, "pushed.txt");
        git_ok(&target, &["push", "-u", "origin", "goodboy/gb-pushed"]);

        let result = remove_folder(&root, &target, WorktreeRemovalMode::Safe);

        assert!(
            matches!(result, WorktreeRemovalResult::Removed { .. }),
            "{result:?}"
        );
        assert!(!target.exists());
    }

    #[test]
    fn folder_removal_reports_changes_and_unpushed_commits_together() {
        let root = init_repo("folder-unpushed-dirty");
        let target = add_goodboy_worktree(&root, "gb-both");
        commit_in(&target, "local.txt");
        std::fs::write(target.join("draft.md"), "unsaved\n").unwrap();

        let result = remove_folder(&root, &target, WorktreeRemovalMode::Safe);

        assert_eq!(
            kept_reasons(result),
            vec![
                WorktreeRemovalReason::UntrackedFiles,
                WorktreeRemovalReason::UnpushedCommits
            ]
        );
    }

    #[test]
    fn folder_removal_keeps_a_dirty_worktree_in_safe_mode() {
        let root = init_repo("folder-dirty");
        let target = add_goodboy_worktree(&root, "gb-dirty");
        std::fs::write(target.join("tracked.txt"), "changed\n").unwrap();
        std::fs::write(target.join("draft.md"), "unsaved\n").unwrap();

        let result = remove_folder(&root, &target, WorktreeRemovalMode::Safe);

        assert_eq!(
            kept_reasons(result),
            vec![
                WorktreeRemovalReason::UnstagedChanges,
                WorktreeRemovalReason::UntrackedFiles
            ]
        );
        assert!(target.join("draft.md").exists());
    }

    #[test]
    fn folder_removal_forces_a_dirty_worktree_only_when_confirmed() {
        let root = init_repo("folder-dirty-confirmed");
        let target = add_goodboy_worktree(&root, "gb-dirty");
        std::fs::write(target.join("draft.md"), "unsaved\n").unwrap();

        let result = remove_folder(&root, &target, WorktreeRemovalMode::Confirmed);

        assert!(
            matches!(result, WorktreeRemovalResult::Removed { .. }),
            "{result:?}"
        );
        assert!(!target.exists());
    }

    #[test]
    fn folder_removal_keeps_a_worktree_an_agent_is_writing_in() {
        let root = init_repo("folder-lease");
        let target = add_goodboy_worktree(&root, "gb-busy");

        let result = remove_worktree_folder_with(
            &root,
            &target,
            WorktreeRemovalMode::Confirmed,
            &mut |cwd, args| super::git(cwd, args),
            &mut |_| true,
        )
        .unwrap();

        assert_eq!(
            kept_reasons(result),
            vec![WorktreeRemovalReason::WriterLeaseHeld]
        );
        assert!(target.exists());
    }

    #[test]
    fn folder_removal_keeps_an_unregistered_folder_until_confirmed() {
        let root = init_repo("folder-unregistered");
        let parent = root.join(".goodboy").join("worktrees");
        std::fs::create_dir_all(&parent).unwrap();
        let ghost = make_worktree_dir(&parent, "gb-ghost", 64);

        let safe = remove_folder(&root, &ghost, WorktreeRemovalMode::Safe);
        assert_eq!(
            kept_reasons(safe),
            vec![WorktreeRemovalReason::NotRegistered]
        );
        assert!(ghost.exists());

        let confirmed = remove_folder(&root, &ghost, WorktreeRemovalMode::Confirmed);
        assert!(
            matches!(confirmed, WorktreeRemovalResult::Removed { .. }),
            "{confirmed:?}"
        );
        assert!(!ghost.exists());
    }

    #[test]
    fn folder_removal_refuses_a_path_outside_the_goodboy_worktrees_folder() {
        let root = init_repo("folder-confine");
        std::fs::create_dir_all(root.join(".goodboy").join("worktrees")).unwrap();
        let claude = make_worktree_dir(&root.join(".claude").join("worktrees"), "x", 16);
        let outside = make_worktree_dir(&root, "precious", 16);
        let nested = make_worktree_dir(
            &root.join(".goodboy").join("worktrees").join("gb-a"),
            "inner",
            16,
        );

        for target in [&claude, &outside, &nested, &root] {
            let result = remove_folder(&root, target, WorktreeRemovalMode::Confirmed);
            assert_eq!(
                kept_reasons(result),
                vec![WorktreeRemovalReason::OutsideWorktreeFolder],
                "{target:?}"
            );
            assert!(
                target.exists(),
                "a path outside the folder was deleted: {target:?}"
            );
        }
    }

    #[cfg(unix)]
    #[test]
    fn folder_removal_refuses_a_symlink_that_escapes_the_worktrees_folder() {
        let root = init_repo("folder-symlink");
        let parent = root.join(".goodboy").join("worktrees");
        std::fs::create_dir_all(&parent).unwrap();
        let precious = make_worktree_dir(&temp_root("folder-symlink-target"), "precious", 16);
        let link = parent.join("gb-link");
        std::os::unix::fs::symlink(&precious, &link).unwrap();
        let hop = parent.join("gb-hop");
        std::os::unix::fs::symlink(precious.parent().unwrap(), &hop).unwrap();

        for target in [link.clone(), hop.join("precious")] {
            let result = remove_folder(&root, &target, WorktreeRemovalMode::Confirmed);
            assert_eq!(
                kept_reasons(result),
                vec![WorktreeRemovalReason::OutsideWorktreeFolder],
                "{target:?}"
            );
        }
        assert!(precious.join("src").join("main.ts").exists());
    }

    #[cfg(unix)]
    #[test]
    fn folder_removal_refuses_when_the_worktrees_folder_itself_escapes_the_repository() {
        let root = init_repo("folder-parent-symlink");
        let elsewhere = temp_root("folder-parent-elsewhere");
        let victim = make_worktree_dir(&elsewhere, "gb-victim", 16);
        std::fs::create_dir_all(root.join(".goodboy")).unwrap();
        std::os::unix::fs::symlink(&elsewhere, root.join(".goodboy").join("worktrees")).unwrap();

        let result = remove_folder(
            &root,
            &root.join(".goodboy").join("worktrees").join("gb-victim"),
            WorktreeRemovalMode::Confirmed,
        );

        assert_eq!(
            kept_reasons(result),
            vec![WorktreeRemovalReason::OutsideWorktreeFolder]
        );
        assert!(victim.exists());
    }

    #[test]
    fn folder_removal_refuses_a_clone_of_another_repository() {
        let root = init_repo("folder-foreign");
        let parent = root.join(".goodboy").join("worktrees");
        std::fs::create_dir_all(&parent).unwrap();
        let other = init_repo("folder-foreign-other");
        let clone = parent.join("gb-clone");
        git_ok(
            &root,
            &["clone", other.to_str().unwrap(), clone.to_str().unwrap()],
        );

        let result = remove_folder(&root, &clone, WorktreeRemovalMode::Confirmed);

        assert_eq!(
            kept_reasons(result),
            vec![WorktreeRemovalReason::DifferentRepository]
        );
        assert!(clone.join("tracked.txt").exists());
    }

    #[test]
    fn folder_removal_reports_an_absent_folder_as_missing() {
        let root = init_repo("folder-missing");
        std::fs::create_dir_all(root.join(".goodboy").join("worktrees")).unwrap();

        let result = remove_folder(
            &root,
            &root.join(".goodboy").join("worktrees").join("gb-gone"),
            WorktreeRemovalMode::Safe,
        );

        assert!(
            matches!(result, WorktreeRemovalResult::Missing { .. }),
            "{result:?}"
        );
    }

    fn publish_repo(root: &Path) {
        let bare = root.join("origin.git");
        git_ok(root, &["init", "--bare", bare.to_str().unwrap()]);
        git_ok(root, &["remote", "add", "origin", bare.to_str().unwrap()]);
        git_ok(root, &["push", "-u", "origin", "main"]);
        git_ok(root, &["remote", "set-head", "origin", "main"]);
    }

    fn assess(target: &Path) -> WorktreeDetachAssessment {
        worktree_detach_assessment_blocking(target.to_string_lossy().into_owned(), None).unwrap()
    }

    fn assess_against(target: &Path, base_branch: &str) -> WorktreeDetachAssessment {
        worktree_detach_assessment_blocking(
            target.to_string_lossy().into_owned(),
            Some(base_branch.to_string()),
        )
        .unwrap()
    }

    fn integration_of(assessment: &WorktreeDetachAssessment) -> &BranchIntegration {
        match assessment {
            WorktreeDetachAssessment::Assessed { integration, .. } => integration,
            _ => panic!("expected an assessed worktree"),
        }
    }

    #[test]
    fn safe_removal_never_passes_force_to_git() {
        let root = init_repo("remove-no-force");
        let target = add_worktree(&root, "no-force");
        let mut seen: Vec<String> = Vec::new();

        let result = remove_worktree_checked_with(
            &root,
            &target,
            WorktreeRemovalMode::Safe,
            &mut |cwd, args| {
                if args.starts_with(&["worktree", "remove"]) {
                    seen = args.iter().map(|arg| arg.to_string()).collect();
                }
                super::git(cwd, args)
            },
            &mut |_| false,
        )
        .unwrap();

        assert!(matches!(result, WorktreeRemovalResult::Removed { .. }));
        assert!(!seen.iter().any(|arg| arg == "--force"), "{seen:?}");
        assert!(!target.exists());
    }

    #[test]
    fn confirmed_removal_forces_a_dirty_worktree_that_safe_mode_keeps() {
        let root = init_repo("remove-confirmed");
        let target = add_worktree(&root, "confirmed");
        std::fs::write(target.join("tracked.txt"), "edited\n").unwrap();
        std::fs::write(target.join("scratch.txt"), "new\n").unwrap();

        let kept = remove(&root, &target);
        let mut seen: Vec<String> = Vec::new();
        let confirmed = remove_worktree_checked_with(
            &root,
            &target,
            WorktreeRemovalMode::Confirmed,
            &mut |cwd, args| {
                if args.starts_with(&["worktree", "remove"]) {
                    seen = args.iter().map(|arg| arg.to_string()).collect();
                }
                super::git(cwd, args)
            },
            &mut |_| false,
        )
        .unwrap();

        assert_eq!(
            kept_reasons(kept),
            vec![
                WorktreeRemovalReason::UnstagedChanges,
                WorktreeRemovalReason::UntrackedFiles
            ]
        );
        assert!(matches!(confirmed, WorktreeRemovalResult::Removed { .. }));
        assert!(seen.iter().any(|arg| arg == "--force"), "{seen:?}");
        assert!(!target.exists());
        assert_eq!(
            git_ok(&root, &["rev-parse", "--verify", "test/confirmed"]).len(),
            40
        );
    }

    #[test]
    fn assessment_reports_a_clean_published_worktree_as_safe() {
        let root = init_repo("assess-clean");
        publish_repo(&root);
        let target = add_worktree(&root, "clean");
        git_ok(&target, &["push", "-u", "origin", "test/clean"]);

        assert_eq!(
            assess(&target),
            WorktreeDetachAssessment::Assessed {
                path: target.to_string_lossy().into_owned(),
                branch: Some("test/clean".to_string()),
                has_upstream: true,
                affected_files: 0,
                local_only_commits: 0,
                ignored_files: 0,
                ignored_file_samples: Vec::new(),
                integration: BranchIntegration::Merged {
                    base: "origin/main".to_string()
                },
            }
        );
    }

    #[test]
    fn assessment_treats_reproducible_ignored_directories_as_no_risk() {
        let root = init_repo("assess-ignored-reproducible");
        publish_repo(&root);
        let target = add_worktree(&root, "ignored-reproducible");
        git_ok(
            &target,
            &["push", "-u", "origin", "test/ignored-reproducible"],
        );
        let ignores = REPRODUCIBLE_IGNORED_DIRS
            .iter()
            .map(|directory| format!("{directory}/\n"))
            .collect::<String>();
        std::fs::write(target.join(".gitignore"), ignores).unwrap();
        for directory in REPRODUCIBLE_IGNORED_DIRS {
            let nested = target.join(directory).join("nested");
            std::fs::create_dir_all(&nested).unwrap();
            std::fs::write(nested.join("artifact.bin"), "x").unwrap();
        }

        let WorktreeDetachAssessment::Assessed {
            ignored_files,
            ignored_file_samples,
            ..
        } = assess(&target)
        else {
            panic!("expected an assessed worktree");
        };

        assert_eq!(ignored_files, 0);
        assert!(ignored_file_samples.is_empty());
    }

    #[test]
    fn assessment_reports_and_names_a_non_reproducible_ignored_file() {
        let root = init_repo("assess-ignored-env");
        publish_repo(&root);
        let target = add_worktree(&root, "ignored-env");
        git_ok(&target, &["push", "-u", "origin", "test/ignored-env"]);
        std::fs::write(target.join(".gitignore"), "node_modules/\n.env.local\n").unwrap();
        std::fs::write(target.join(".env.local"), "SECRET=1\n").unwrap();

        let WorktreeDetachAssessment::Assessed {
            ignored_files,
            ignored_file_samples,
            ..
        } = assess(&target)
        else {
            panic!("expected an assessed worktree");
        };

        assert_eq!(ignored_files, 1);
        assert_eq!(ignored_file_samples, vec![".env.local".to_string()]);
    }

    #[test]
    fn assessment_excludes_reproducible_names_only_at_the_top_level() {
        let root = init_repo("assess-ignored-top-level");
        publish_repo(&root);
        let target = add_worktree(&root, "ignored-top-level");
        git_ok(&target, &["push", "-u", "origin", "test/ignored-top-level"]);
        std::fs::write(target.join(".gitignore"), "**/node_modules/\n").unwrap();
        let nested = target.join("scratch").join("node_modules");
        std::fs::create_dir_all(&nested).unwrap();
        std::fs::write(nested.join("local.bin"), "x").unwrap();
        std::fs::create_dir_all(target.join("node_modules")).unwrap();
        std::fs::write(target.join("node_modules").join("dep.js"), "x").unwrap();

        let WorktreeDetachAssessment::Assessed {
            ignored_files,
            ignored_file_samples,
            ..
        } = assess(&target)
        else {
            panic!("expected an assessed worktree");
        };

        assert_eq!(ignored_files, 2);
        assert_eq!(
            ignored_file_samples,
            vec!["scratch/".to_string(), "scratch/node_modules/".to_string()]
        );
    }

    #[test]
    fn assessment_limits_relative_samples_and_orders_shortest_first() {
        let root = init_repo("assess-ignored-samples");
        publish_repo(&root);
        let target = add_worktree(&root, "ignored-samples");
        git_ok(&target, &["push", "-u", "origin", "test/ignored-samples"]);
        let paths = [
            ".a",
            ".env",
            "local.db",
            "notes.txt",
            "settings.json",
            "space file.txt",
        ];
        std::fs::write(target.join(".gitignore"), paths.join("\n")).unwrap();
        for relative in paths {
            let path = target.join(relative);
            if let Some(parent) = path.parent() {
                std::fs::create_dir_all(parent).unwrap();
            }
            std::fs::write(path, "x").unwrap();
        }

        let WorktreeDetachAssessment::Assessed {
            ignored_files,
            ignored_file_samples,
            ..
        } = assess(&target)
        else {
            panic!("expected an assessed worktree");
        };

        assert_eq!(ignored_files, 6);
        assert_eq!(
            ignored_file_samples,
            vec![
                ".a".to_string(),
                ".env".to_string(),
                "local.db".to_string(),
                "notes.txt".to_string(),
                "settings.json".to_string(),
            ]
        );
        assert!(ignored_file_samples
            .iter()
            .all(|sample| !Path::new(sample).is_absolute()));
    }

    #[test]
    fn assessment_counts_only_the_non_reproducible_ignored_file_when_both_are_present() {
        let root = init_repo("assess-ignored-mixed");
        publish_repo(&root);
        let target = add_worktree(&root, "ignored-mixed");
        git_ok(&target, &["push", "-u", "origin", "test/ignored-mixed"]);
        std::fs::write(target.join(".gitignore"), "node_modules/\n.env.local\n").unwrap();
        std::fs::write(target.join(".env.local"), "SECRET=1\n").unwrap();
        std::fs::create_dir_all(target.join("node_modules")).unwrap();
        std::fs::write(target.join("node_modules").join("dep.js"), "x").unwrap();

        let WorktreeDetachAssessment::Assessed {
            ignored_files,
            ignored_file_samples,
            ..
        } = assess(&target)
        else {
            panic!("expected an assessed worktree");
        };

        assert_eq!(ignored_files, 1);
        assert_eq!(ignored_file_samples, vec![".env.local".to_string()]);
    }

    #[test]
    fn assessment_counts_each_affected_path_once_and_skips_ignored_files() {
        let root = init_repo("assess-files");
        publish_repo(&root);
        let target = add_worktree(&root, "files");
        git_ok(&target, &["push", "-u", "origin", "test/files"]);
        std::fs::write(target.join("tracked.txt"), "staged\n").unwrap();
        git_ok(&target, &["add", "tracked.txt"]);
        std::fs::write(target.join("tracked.txt"), "staged and then edited\n").unwrap();
        std::fs::write(target.join("scratch.txt"), "untracked\n").unwrap();
        std::fs::create_dir_all(target.join("node_modules")).unwrap();
        std::fs::write(target.join("node_modules").join("dep.js"), "x").unwrap();

        let WorktreeDetachAssessment::Assessed {
            affected_files,
            local_only_commits,
            has_upstream,
            ..
        } = assess(&target)
        else {
            panic!("expected an assessed worktree");
        };

        assert_eq!(
            (affected_files, local_only_commits, has_upstream),
            (2, 0, true)
        );
    }

    #[test]
    fn assessment_counts_commits_that_no_remote_ref_contains() {
        let root = init_repo("assess-commits");
        publish_repo(&root);
        let target = add_worktree(&root, "commits");
        git_ok(&target, &["push", "-u", "origin", "test/commits"]);
        std::fs::write(target.join("tracked.txt"), "local\n").unwrap();
        git_ok(&target, &["commit", "-am", "local work"]);

        let WorktreeDetachAssessment::Assessed {
            affected_files,
            local_only_commits,
            has_upstream,
            ..
        } = assess(&target)
        else {
            panic!("expected an assessed worktree");
        };

        assert_eq!(
            (affected_files, local_only_commits, has_upstream),
            (0, 1, true)
        );
    }

    #[test]
    fn assessment_reports_a_branch_without_an_upstream() {
        let root = init_repo("assess-no-upstream");
        publish_repo(&root);
        let target = add_worktree(&root, "no-upstream");

        let WorktreeDetachAssessment::Assessed {
            affected_files,
            local_only_commits,
            has_upstream,
            ..
        } = assess(&target)
        else {
            panic!("expected an assessed worktree");
        };

        assert_eq!(
            (affected_files, local_only_commits, has_upstream),
            (0, 0, false)
        );
    }

    #[test]
    fn assessment_reports_an_absent_directory_as_missing() {
        let root = init_repo("assess-missing");
        let target = root.join("worktrees").join("gone");

        assert_eq!(
            assess(&target),
            WorktreeDetachAssessment::Missing {
                path: target.to_string_lossy().into_owned()
            }
        );
    }

    #[test]
    fn assessment_reports_a_branch_merged_into_the_configured_base() {
        let root = init_repo("assess-merged-base");
        publish_repo(&root);
        let target = add_worktree(&root, "merged-base");
        git_ok(&target, &["push", "-u", "origin", "test/merged-base"]);

        assert_eq!(
            integration_of(&assess_against(&target, "main")),
            &BranchIntegration::Merged {
                base: "origin/main".to_string()
            }
        );
    }

    #[test]
    fn assessment_counts_commits_missing_from_the_configured_base() {
        let root = init_repo("assess-unmerged-base");
        publish_repo(&root);
        let target = add_worktree(&root, "unmerged-base");
        std::fs::write(target.join("first.txt"), "one\n").unwrap();
        git_ok(&target, &["add", "first.txt"]);
        git_ok(&target, &["commit", "-m", "first"]);
        std::fs::write(target.join("second.txt"), "two\n").unwrap();
        git_ok(&target, &["add", "second.txt"]);
        git_ok(&target, &["commit", "-m", "second"]);
        git_ok(&target, &["push", "-u", "origin", "test/unmerged-base"]);

        assert_eq!(
            integration_of(&assess_against(&target, "main")),
            &BranchIntegration::Unmerged {
                base: "origin/main".to_string(),
                ahead: 2
            }
        );
    }

    #[test]
    fn assessment_reads_integration_against_the_project_base_not_main() {
        let root = init_repo("assess-project-base");
        publish_repo(&root);
        let target = add_worktree(&root, "project-base");
        std::fs::write(target.join("feature.txt"), "work\n").unwrap();
        git_ok(&target, &["add", "feature.txt"]);
        git_ok(&target, &["commit", "-m", "feature"]);
        git_ok(&target, &["push", "-u", "origin", "test/project-base"]);
        git_ok(&target, &["push", "origin", "HEAD:refs/heads/develop"]);
        git_ok(&target, &["fetch", "origin"]);

        assert_eq!(
            integration_of(&assess_against(&target, "develop")),
            &BranchIntegration::Merged {
                base: "origin/develop".to_string()
            }
        );
        assert_eq!(
            integration_of(&assess_against(&target, "main")),
            &BranchIntegration::Unmerged {
                base: "origin/main".to_string(),
                ahead: 1
            }
        );
    }

    #[test]
    fn assessment_reports_unknown_integration_when_the_base_does_not_resolve() {
        let root = init_repo("assess-base-missing");
        publish_repo(&root);
        let target = add_worktree(&root, "base-missing");
        git_ok(&target, &["push", "-u", "origin", "test/base-missing"]);

        assert_eq!(
            integration_of(&assess_against(&target, "release/never-cut")),
            &BranchIntegration::Unknown
        );
    }

    #[test]
    fn assessment_reports_unknown_integration_when_no_base_is_configured_and_none_is_published() {
        let root = init_repo("assess-base-absent");
        let target = add_worktree(&root, "base-absent");
        git_ok(&root, &["branch", "-m", "main", "trunk"]);
        git_ok(&root, &["checkout", "--detach"]);

        assert_eq!(
            integration_of(&assess(&target)),
            &BranchIntegration::Unknown
        );
    }

    #[test]
    fn assessment_finds_the_local_default_branch_when_no_base_is_configured_and_no_remote_exists() {
        let root = init_repo("assess-local-default");
        let target = add_worktree(&root, "local-default");

        assert_eq!(
            integration_of(&assess(&target)),
            &BranchIntegration::Merged {
                base: "main".to_string()
            }
        );
    }

    #[test]
    fn assessment_falls_back_to_a_local_base_branch_without_a_remote() {
        let root = init_repo("assess-local-base");
        let target = add_worktree(&root, "local-base");

        assert_eq!(
            integration_of(&assess_against(&target, "main")),
            &BranchIntegration::Merged {
                base: "main".to_string()
            }
        );
    }

    #[test]
    fn assessment_reports_a_non_repository_directory_as_unavailable() {
        let root = temp_root("assess-unavailable");
        std::fs::create_dir_all(root.join("plain")).unwrap();

        assert_eq!(
            assess(&root.join("plain")),
            WorktreeDetachAssessment::Unavailable {
                path: root.join("plain").to_string_lossy().into_owned(),
                branch: None
            }
        );
    }
}

#[cfg(test)]
mod candidate_tests {
    use super::{
        worktree_integrate_candidate_blocking, worktree_quarantine_candidate_blocking,
        IntegrateCandidateArgs, QuarantineCandidateArgs,
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
        super::git(cwd, args)
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

    fn head(root: &Path) -> String {
        git_ok(root, &["rev-parse", "HEAD"])
    }

    fn quarantine(root: &Path, id: &str, base: &str) -> Option<String> {
        worktree_quarantine_candidate_blocking(QuarantineCandidateArgs {
            worktree_path: root.to_string_lossy().into_owned(),
            candidate_id: id.to_string(),
            base_sha: base.to_string(),
        })
        .unwrap()
        .sha
    }

    fn integrate(
        root: &Path,
        id: &str,
        candidate: &str,
        expected: &str,
    ) -> Result<String, super::WorktreeError> {
        worktree_integrate_candidate_blocking(IntegrateCandidateArgs {
            worktree_path: root.to_string_lossy().into_owned(),
            candidate_id: id.to_string(),
            candidate_sha: candidate.to_string(),
            expected_head: expected.to_string(),
        })
        .map(|done| done.sha)
    }

    #[test]
    fn quarantine_moves_the_branch_back_and_keeps_the_work_alive() {
        let root = init_repo("candidate-quarantine");
        let base = commit(&root, "base.txt", "base", "base");
        commit(&root, "fix.txt", "fix", "fix");
        std::fs::write(root.join("loose.txt"), "loose").unwrap();

        let candidate = quarantine(&root, "cand-1", &base).expect("a candidate was produced");

        assert_eq!(head(&root), base, "the branch tip still carries the work");
        assert!(!root.join("fix.txt").exists(), "the tree was not reset");
        assert_eq!(
            git_ok(&root, &["status", "--porcelain=v1"]),
            "",
            "the worktree is not clean"
        );
        assert_eq!(
            git_ok(&root, &["rev-parse", "refs/goodboy/candidates/cand-1"]),
            candidate,
            "the candidate ref does not hold the work"
        );
        assert!(
            git_ok(&root, &["show", &format!("{candidate}:loose.txt")]).contains("loose"),
            "uncommitted work was not captured into the candidate"
        );
    }

    #[test]
    fn quarantine_reports_nothing_when_the_agent_produced_no_change() {
        let root = init_repo("candidate-quarantine-empty");
        let base = commit(&root, "base.txt", "base", "base");

        assert_eq!(quarantine(&root, "cand-empty", &base), None);
        assert_eq!(head(&root), base);
    }

    #[test]
    fn integration_fast_forwards_the_branch_and_the_worktree() {
        let root = init_repo("candidate-integrate");
        let base = commit(&root, "base.txt", "base", "base");
        commit(&root, "fix.txt", "fix", "fix");
        let candidate = quarantine(&root, "cand-1", &base).unwrap();

        let integrated = integrate(&root, "cand-1", &candidate, &base).unwrap();

        assert_eq!(integrated, candidate);
        assert_eq!(head(&root), candidate);
        assert!(root.join("fix.txt").exists(), "the worktree was not synced");
    }

    #[test]
    fn integration_cherry_picks_the_candidate_when_the_head_moved_forward() {
        let root = init_repo("candidate-head-moved");
        let base = commit(&root, "base.txt", "base", "base");
        commit(&root, "fix.txt", "fix", "fix");
        let candidate = quarantine(&root, "cand-1", &base).unwrap();
        let moved = commit(&root, "other.txt", "other", "external");

        let integrated = integrate(&root, "cand-1", &candidate, &base).unwrap();

        assert_ne!(integrated, candidate, "the candidate was not replayed");
        assert_eq!(head(&root), integrated);
        assert_eq!(
            git_ok(&root, &["rev-parse", "HEAD~1"]),
            moved,
            "the commit that moved the branch was lost"
        );
        assert!(root.join("fix.txt").exists(), "the fix is not in the tree");
        assert!(root.join("other.txt").exists(), "the external work is gone");
        assert_eq!(git_ok(&root, &["log", "-1", "--format=%s"]), "fix");
    }

    #[test]
    fn a_replayed_cherry_pick_reports_the_integrated_commit() {
        let root = init_repo("candidate-pick-replay");
        let base = commit(&root, "base.txt", "base", "base");
        commit(&root, "fix.txt", "fix", "fix");
        let candidate = quarantine(&root, "cand-1", &base).unwrap();
        commit(&root, "other.txt", "other", "external");
        let first = integrate(&root, "cand-1", &candidate, &base).unwrap();

        let replayed = integrate(&root, "cand-1", &candidate, &base).unwrap();

        assert_eq!(replayed, first);
        assert_eq!(head(&root), first, "the replay picked the fix twice");
    }

    #[test]
    fn integration_aborts_when_the_fix_no_longer_applies() {
        let root = init_repo("candidate-conflict");
        let base = commit(&root, "shared.txt", "base\n", "base");
        commit(&root, "shared.txt", "fix\n", "fix");
        let candidate = quarantine(&root, "cand-1", &base).unwrap();
        let moved = commit(&root, "shared.txt", "external\n", "external");

        let outcome = integrate(&root, "cand-1", &candidate, &base);

        let message = format!("{outcome:?}");
        assert!(message.contains("no longer applies"), "{message}");
        assert_eq!(head(&root), moved, "the branch was moved anyway");
        assert_eq!(
            git_ok(&root, &["status", "--porcelain=v1"]),
            "",
            "the aborted pick left the worktree dirty"
        );
        assert_eq!(
            std::fs::read_to_string(root.join("shared.txt")).unwrap(),
            "external\n"
        );
    }

    #[test]
    fn integration_refuses_when_the_branch_was_rewritten_under_the_candidate() {
        let root = init_repo("candidate-rewritten");
        let base = commit(&root, "base.txt", "base", "base");
        commit(&root, "fix.txt", "fix", "fix");
        let candidate = quarantine(&root, "cand-1", &base).unwrap();
        git_ok(
            &root,
            &["commit", "--amend", "--no-verify", "-m", "rewritten"],
        );
        let rewritten = head(&root);

        let outcome = integrate(&root, "cand-1", &candidate, &base);

        assert!(outcome.is_err(), "{outcome:?}");
        assert_eq!(head(&root), rewritten, "the branch was moved anyway");
    }

    #[test]
    fn the_commit_range_lists_subjects_oldest_first() {
        let root = init_repo("commit-range");
        let base = commit(&root, "base.txt", "base", "base");
        let first = commit(&root, "a.txt", "a", "Add retry policy");
        let second = commit(&root, "b.txt", "b", "fixup! Add retry policy");

        let range = super::worktree_commit_range_blocking(
            root.to_string_lossy().into_owned(),
            base,
            second.clone(),
        )
        .unwrap();

        assert_eq!(
            range,
            vec![
                super::RangeCommit {
                    sha: first,
                    subject: "Add retry policy".to_string()
                },
                super::RangeCommit {
                    sha: second,
                    subject: "fixup! Add retry policy".to_string()
                },
            ]
        );
    }

    #[test]
    fn blame_names_the_commit_that_introduced_a_line() {
        let root = init_repo("blame-line");
        commit(&root, "retry.ts", "one\n", "base");
        let introduced = commit(&root, "retry.ts", "one\ntwo\n", "Add retry policy");

        let blamed = |line: u32| {
            super::worktree_blame_line_blocking(
                root.to_string_lossy().into_owned(),
                "retry.ts".to_string(),
                line,
            )
            .unwrap()
        };

        assert_eq!(blamed(2), Some(introduced));
        assert_eq!(blamed(0), None);
        assert_eq!(blamed(9), None);
    }

    #[test]
    fn a_replayed_integration_after_a_crash_does_not_integrate_twice() {
        let root = init_repo("candidate-replay");
        let base = commit(&root, "base.txt", "base", "base");
        commit(&root, "fix.txt", "fix", "fix");
        let candidate = quarantine(&root, "cand-1", &base).unwrap();
        integrate(&root, "cand-1", &candidate, &base).unwrap();
        let after_first = head(&root);
        let follow_up = commit(&root, "later.txt", "later", "later");

        let replayed = integrate(&root, "cand-1", &candidate, &base).unwrap();

        assert_eq!(replayed, candidate, "the replay reported another commit");
        assert_eq!(after_first, candidate);
        assert_eq!(head(&root), follow_up, "the replay moved the branch");
        assert_eq!(
            git_ok(&root, &["rev-list", "--count", &format!("{base}..HEAD")]),
            "2",
            "the candidate was integrated twice"
        );
    }

    fn forget_integration(root: &Path, id: &str, candidate: &str) {
        let dir = root.join(".git").join("goodboy-candidate-integrations");
        std::fs::remove_file(dir.join(format!("{id}.journal"))).unwrap();
        std::fs::write(dir.join(format!("{id}.picking")), format!("{candidate}\n")).unwrap();
    }

    #[test]
    fn a_retry_after_a_crash_past_the_cherry_pick_records_it_without_picking_again() {
        let root = init_repo("candidate-pick-crash");
        let base = commit(&root, "base.txt", "base", "base");
        commit(&root, "fix.txt", "fix", "fix");
        commit(&root, "test.txt", "test", "test");
        let candidate = quarantine(&root, "cand-1", &base).unwrap();
        commit(&root, "other.txt", "other", "external");
        let picked = integrate(&root, "cand-1", &candidate, &base).unwrap();
        forget_integration(&root, "cand-1", &candidate);
        let later = commit(&root, "later.txt", "later", "later");

        let retried = integrate(&root, "cand-1", &candidate, &base).unwrap();

        assert_eq!(retried, picked, "the retry reported another commit");
        assert_eq!(head(&root), later, "the retry moved the branch");
        assert_eq!(
            git_ok(&root, &["rev-list", "--count", &format!("{base}..HEAD")]),
            "4",
            "the fix was picked twice"
        );
        assert_eq!(
            integrate(&root, "cand-1", &candidate, &base).unwrap(),
            picked,
            "the retry did not record the integration"
        );
    }

    #[test]
    fn a_retry_after_a_crash_still_refuses_a_fix_that_no_longer_applies() {
        let root = init_repo("candidate-pick-crash-conflict");
        let base = commit(&root, "shared.txt", "base\n", "base");
        commit(&root, "shared.txt", "fix\n", "fix");
        let candidate = quarantine(&root, "cand-1", &base).unwrap();
        let moved = commit(&root, "shared.txt", "external\n", "external");
        let dir = root.join(".git").join("goodboy-candidate-integrations");
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(dir.join("cand-1.picking"), format!("{candidate}\n")).unwrap();

        let outcome = integrate(&root, "cand-1", &candidate, &base);

        let message = format!("{outcome:?}");
        assert!(message.contains("no longer applies"), "{message}");
        assert_eq!(head(&root), moved, "the branch was moved anyway");
        assert_eq!(git_ok(&root, &["status", "--porcelain=v1"]), "");
        assert!(
            !dir.join("cand-1.journal").exists(),
            "a refused fix was recorded"
        );
    }

    #[test]
    fn a_journal_naming_another_commit_is_refused() {
        let root = init_repo("candidate-journal-mismatch");
        let base = commit(&root, "base.txt", "base", "base");
        commit(&root, "fix.txt", "fix", "fix");
        let first = quarantine(&root, "cand-1", &base).unwrap();
        integrate(&root, "cand-1", &first, &base).unwrap();
        commit(&root, "second.txt", "second", "second");
        let second = quarantine(&root, "cand-1", &first).unwrap();

        let outcome = integrate(&root, "cand-1", &second, &first);

        assert!(outcome.is_err(), "{outcome:?}");
        assert_eq!(head(&root), first);
    }

    #[test]
    fn a_deferred_candidate_never_becomes_reachable_from_the_tip() {
        let root = init_repo("candidate-deferred");
        let base = commit(&root, "base.txt", "base", "base");
        commit(&root, "a.txt", "a", "a");
        let accepted = quarantine(&root, "cand-a", &base).unwrap();
        integrate(&root, "cand-a", &accepted, &base).unwrap();
        commit(&root, "b.txt", "b", "b");
        let deferred = quarantine(&root, "cand-b", &accepted).unwrap();

        assert_eq!(head(&root), accepted);
        assert!(
            super::git(
                &root,
                &["merge-base", "--is-ancestor", &deferred, &accepted]
            )
            .is_err(),
            "the deferred candidate is reachable from the branch tip"
        );
        assert!(!root.join("b.txt").exists(), "deferred work is in the tree");
    }
}
