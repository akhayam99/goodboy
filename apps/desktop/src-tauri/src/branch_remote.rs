use std::path::{Path, PathBuf};

use crate::worktree::{git, rev_list_left_right, GitDistance, GitUnknownReason, WorktreeError};

const DEFAULT_REMOTE: &str = "origin";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) struct ConfiguredUpstream<'a> {
    pub name: &'a str,
    pub distance: Option<(u32, u32)>,
}

#[derive(Debug, PartialEq, Eq)]
pub(crate) struct BranchRemote {
    pub tracking: Option<String>,
    pub distance: GitDistance,
}

pub(crate) fn remote_of(configured: Option<&str>) -> &str {
    configured
        .and_then(|name| name.split_once('/'))
        .map(|(remote, _)| remote)
        .filter(|remote| !remote.is_empty())
        .unwrap_or(DEFAULT_REMOTE)
}

pub(crate) fn tracking_sha(cwd: &Path, tracking: &str) -> Option<String> {
    git(
        cwd,
        &[
            "rev-parse",
            "--verify",
            "--quiet",
            &format!("refs/remotes/{tracking}"),
        ],
    )
    .ok()
    .map(|raw| raw.trim().to_string())
    .filter(|sha| !sha.is_empty())
}

pub(crate) fn branch_remote(
    cwd: &Path,
    branch: Option<&str>,
    configured: Option<ConfiguredUpstream<'_>>,
) -> BranchRemote {
    let Some(branch) = branch.map(str::trim).filter(|name| !name.is_empty()) else {
        return BranchRemote {
            tracking: None,
            distance: GitDistance::Unknown {
                reason: GitUnknownReason::DetachedHead,
            },
        };
    };
    let own = format!(
        "{}/{branch}",
        remote_of(configured.map(|upstream| upstream.name))
    );
    let tracks_own = configured.is_some_and(|upstream| upstream.name == own);
    if let Some((ahead, behind)) = configured
        .filter(|_| tracks_own)
        .and_then(|upstream| upstream.distance)
    {
        return BranchRemote {
            tracking: Some(own),
            distance: GitDistance::Known { ahead, behind },
        };
    }
    if tracking_sha(cwd, &own).is_none() {
        return match tracks_own {
            true => BranchRemote {
                tracking: Some(own),
                distance: GitDistance::Unknown {
                    reason: GitUnknownReason::UpstreamGone,
                },
            },
            false => BranchRemote {
                tracking: None,
                distance: GitDistance::Unknown {
                    reason: GitUnknownReason::NoUpstream,
                },
            },
        };
    }
    let distance = match rev_list_left_right(cwd, &format!("refs/remotes/{own}"), "HEAD") {
        Some((ahead, behind)) => GitDistance::Known { ahead, behind },
        None => GitDistance::Unknown {
            reason: GitUnknownReason::RevListFailed,
        },
    };
    BranchRemote {
        tracking: Some(own),
        distance,
    }
}

pub(crate) fn fetch_branch_ref(
    cwd: &Path,
    remote: &str,
    branch: &str,
    token: Option<&str>,
) -> Option<String> {
    let refspec = format!("+refs/heads/{branch}:refs/remotes/{remote}/{branch}");
    let cwd_text = cwd.to_string_lossy().to_string();
    match crate::github::run_git_authenticated(
        &["fetch", "--quiet", "--no-tags", remote, &refspec],
        &cwd_text,
        token,
    ) {
        Ok(result) if result.exit_code == 0 => None,
        Ok(result) => Some(result.stderr.trim().to_string()),
        Err(error) => Some(error.to_string()),
    }
}

pub(crate) fn sync_branch_ref(
    cwd: &Path,
    branch: &str,
    expected_sha: &str,
    token: Option<&str>,
) -> bool {
    let configured = crate::worktree::resolve_upstream(cwd);
    let remote = remote_of(configured.as_deref()).to_string();
    let own = format!("{remote}/{branch}");
    let before = tracking_sha(cwd, &own);
    if before.as_deref() == Some(expected_sha.trim()) {
        return false;
    }
    if fetch_branch_ref(cwd, &remote, branch, token).is_some() {
        return false;
    }
    tracking_sha(cwd, &own) != before
}

#[tauri::command]
pub async fn worktree_sync_branch_ref(
    worktree_path: String,
    branch: String,
    expected_sha: String,
    workspace_id: Option<String>,
    project_id: Option<String>,
) -> Result<bool, WorktreeError> {
    tauri::async_runtime::spawn_blocking(move || {
        let cwd = PathBuf::from(&worktree_path);
        if !cwd.exists() {
            return Err(WorktreeError::RepoNotFound(worktree_path));
        }
        let branch = branch.trim().to_string();
        let expected = expected_sha.trim().to_string();
        if branch.is_empty() || expected.is_empty() {
            return Ok(false);
        }
        let token = crate::github::read_token(workspace_id.as_deref(), project_id.as_deref());
        Ok(sync_branch_ref(&cwd, &branch, &expected, token.as_deref()))
    })
    .await
    .map_err(|e| WorktreeError::Io(std::io::Error::other(e.to_string())))?
}

#[cfg(test)]
mod tests {
    use super::{branch_remote, sync_branch_ref, BranchRemote, ConfiguredUpstream};
    use crate::worktree::resolve_upstream;
    use crate::worktree::{GitDistance, GitUnknownReason};
    use std::path::{Path, PathBuf};

    fn temp_root(name: &str) -> PathBuf {
        let root = std::env::temp_dir().join(format!(
            "goodboy-branch-remote-{name}-{}-{}",
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
        crate::worktree::git(cwd, args)
            .unwrap_or_else(|err| panic!("git {} failed: {err}", args.join(" ")))
            .trim()
            .to_string()
    }

    fn configure(repo: &Path) {
        git_ok(repo, &["config", "user.email", "test@example.com"]);
        git_ok(repo, &["config", "user.name", "test"]);
        git_ok(repo, &["config", "commit.gpgsign", "false"]);
    }

    fn commit(repo: &Path, message: &str) -> String {
        git_ok(repo, &["commit", "--allow-empty", "-m", message]);
        git_ok(repo, &["rev-parse", "HEAD"])
    }

    struct Fixture {
        root: PathBuf,
        clone: PathBuf,
        session: PathBuf,
    }

    fn session_branch(name: &str) -> Fixture {
        let root = temp_root(name);
        let remote = root.join("remote.git");
        let clone = root.join("clone");
        git_ok(
            &root,
            &["init", "--bare", "--quiet", remote.to_str().unwrap()],
        );
        git_ok(
            &root,
            &[
                "clone",
                "--quiet",
                remote.to_str().unwrap(),
                clone.to_str().unwrap(),
            ],
        );
        configure(&clone);
        commit(&clone, "base");
        git_ok(
            &clone,
            &["push", "--quiet", "origin", "HEAD:refs/heads/main"],
        );
        git_ok(&clone, &["fetch", "--quiet", "origin"]);
        let session = root.join("session");
        git_ok(
            &clone,
            &[
                "worktree",
                "add",
                "--quiet",
                "--track",
                "-b",
                "feature",
                session.to_str().unwrap(),
                "origin/main",
            ],
        );
        Fixture {
            root,
            clone,
            session,
        }
    }

    fn read(fixture: &Fixture) -> BranchRemote {
        let configured = resolve_upstream(&fixture.session);
        branch_remote(
            &fixture.session,
            Some("feature"),
            configured.as_deref().map(|name| ConfiguredUpstream {
                name,
                distance: None,
            }),
        )
    }

    #[test]
    fn a_branch_that_tracks_origin_main_is_not_pushed_yet() {
        let fixture = session_branch("not-pushed");
        commit(&fixture.session, "one");
        commit(&fixture.session, "two");

        assert_eq!(
            resolve_upstream(&fixture.session).as_deref(),
            Some("origin/main")
        );
        assert_eq!(
            read(&fixture),
            BranchRemote {
                tracking: None,
                distance: GitDistance::Unknown {
                    reason: GitUnknownReason::NoUpstream
                },
            }
        );
        std::fs::remove_dir_all(&fixture.root).unwrap();
    }

    #[test]
    fn eight_pushed_commits_leave_nothing_to_push_even_while_git_tracks_main() {
        let fixture = session_branch("already-pushed");
        for index in 0..8 {
            commit(&fixture.session, &format!("commit {index}"));
        }
        git_ok(&fixture.session, &["push", "--quiet", "origin", "feature"]);

        assert_eq!(
            git_ok(&fixture.session, &["rev-list", "--count", "@{u}..HEAD"]),
            "8"
        );
        assert_eq!(
            read(&fixture),
            BranchRemote {
                tracking: Some("origin/feature".to_string()),
                distance: GitDistance::Known {
                    ahead: 0,
                    behind: 0
                },
            }
        );
        std::fs::remove_dir_all(&fixture.root).unwrap();
    }

    #[test]
    fn only_the_commits_after_the_push_count_as_unpushed() {
        let fixture = session_branch("local-only-commits");
        commit(&fixture.session, "pushed");
        git_ok(&fixture.session, &["push", "--quiet", "origin", "feature"]);
        commit(&fixture.session, "local one");
        commit(&fixture.session, "local two");

        assert_eq!(
            read(&fixture).distance,
            GitDistance::Known {
                ahead: 2,
                behind: 0
            }
        );
        std::fs::remove_dir_all(&fixture.root).unwrap();
    }

    #[test]
    fn a_push_from_another_worktree_of_the_same_repo_is_seen_without_a_fetch() {
        let fixture = session_branch("other-worktree");
        commit(&fixture.session, "one");
        let other = fixture.root.join("other");
        git_ok(
            &fixture.clone,
            &[
                "worktree",
                "add",
                "--quiet",
                "--detach",
                other.to_str().unwrap(),
                "feature",
            ],
        );
        git_ok(
            &other,
            &["push", "--quiet", "origin", "HEAD:refs/heads/feature"],
        );

        assert_eq!(
            read(&fixture).distance,
            GitDistance::Known {
                ahead: 0,
                behind: 0
            }
        );
        std::fs::remove_dir_all(&fixture.root).unwrap();
    }

    #[test]
    fn a_force_pushed_remote_reads_as_diverged_once_its_head_is_synced() {
        let fixture = session_branch("diverged");
        commit(&fixture.session, "shared");
        git_ok(&fixture.session, &["push", "--quiet", "origin", "feature"]);
        commit(&fixture.session, "local one");
        commit(&fixture.session, "local two");
        let elsewhere = fixture.root.join("elsewhere");
        git_ok(
            &fixture.root,
            &[
                "clone",
                "--quiet",
                "-b",
                "feature",
                fixture.root.join("remote.git").to_str().unwrap(),
                elsewhere.to_str().unwrap(),
            ],
        );
        configure(&elsewhere);
        git_ok(&elsewhere, &["reset", "--quiet", "--hard", "HEAD~1"]);
        commit(&elsewhere, "rewritten one");
        let remote_head = commit(&elsewhere, "rewritten two");
        git_ok(
            &elsewhere,
            &["push", "--quiet", "--force", "origin", "feature"],
        );

        assert_eq!(
            read(&fixture).distance,
            GitDistance::Known {
                ahead: 2,
                behind: 0
            }
        );
        assert!(sync_branch_ref(
            &fixture.session,
            "feature",
            &remote_head,
            None
        ));
        assert_eq!(
            read(&fixture).distance,
            GitDistance::Known {
                ahead: 3,
                behind: 2
            }
        );
        assert!(!sync_branch_ref(
            &fixture.session,
            "feature",
            &remote_head,
            None
        ));
        std::fs::remove_dir_all(&fixture.root).unwrap();
    }

    #[test]
    fn a_missing_tracking_ref_catches_up_to_the_pull_request_head() {
        let fixture = session_branch("stale-ref");
        let pushed = commit(&fixture.session, "one");
        git_ok(&fixture.session, &["push", "--quiet", "origin", "feature"]);
        git_ok(
            &fixture.session,
            &["update-ref", "-d", "refs/remotes/origin/feature"],
        );
        assert_eq!(read(&fixture).tracking, None);

        assert!(sync_branch_ref(&fixture.session, "feature", &pushed, None));
        assert_eq!(
            read(&fixture).distance,
            GitDistance::Known {
                ahead: 0,
                behind: 0
            }
        );
        std::fs::remove_dir_all(&fixture.root).unwrap();
    }

    #[test]
    fn a_pruned_own_upstream_reads_as_gone() {
        let fixture = session_branch("gone");
        commit(&fixture.session, "one");
        git_ok(
            &fixture.session,
            &["push", "--quiet", "--set-upstream", "origin", "feature"],
        );
        git_ok(
            &fixture.session,
            &["update-ref", "-d", "refs/remotes/origin/feature"],
        );

        assert_eq!(
            branch_remote(
                &fixture.session,
                Some("feature"),
                Some(ConfiguredUpstream {
                    name: "origin/feature",
                    distance: None,
                }),
            ),
            BranchRemote {
                tracking: Some("origin/feature".to_string()),
                distance: GitDistance::Unknown {
                    reason: GitUnknownReason::UpstreamGone
                },
            }
        );
        std::fs::remove_dir_all(&fixture.root).unwrap();
    }

    #[test]
    fn a_configured_own_upstream_reuses_the_status_distance_without_spawning_git() {
        let fixture = session_branch("fast-path");
        crate::worktree::git_argv_log::reset();

        let remote = branch_remote(
            &fixture.session,
            Some("feature"),
            Some(ConfiguredUpstream {
                name: "origin/feature",
                distance: Some((3, 1)),
            }),
        );

        assert!(crate::worktree::git_argv_log::recorded().is_empty());
        assert_eq!(
            remote.distance,
            GitDistance::Known {
                ahead: 3,
                behind: 1
            }
        );
        std::fs::remove_dir_all(&fixture.root).unwrap();
    }

    #[test]
    fn a_detached_head_has_no_branch_remote() {
        let fixture = session_branch("detached");

        assert_eq!(
            branch_remote(&fixture.session, None, None).distance,
            GitDistance::Unknown {
                reason: GitUnknownReason::DetachedHead
            }
        );
        std::fs::remove_dir_all(&fixture.root).unwrap();
    }
}
