use super::base::{base_candidates_with, default_base_name, resolve_origin_head};
use super::branch_name::branch_name_problem;
use super::error::WorktreeError;
use super::exclude::ensure_goodboy_excluded;
use super::foreign::{add_remote_backed_worktree, remote_backed_source};
use super::git::{git, RunGit};
use super::inspect::parse_porcelain;
use super::slug::sanitize_slug;
use super::types::{CreateArgs, CreatedWorktree, WorktreeInfo};
use std::path::{Path, PathBuf};

#[tauri::command]
pub async fn worktree_create(args: CreateArgs) -> Result<CreatedWorktree, WorktreeError> {
    tauri::async_runtime::spawn_blocking(move || worktree_create_blocking(args))
        .await
        .map_err(|e| WorktreeError::Io(std::io::Error::other(e.to_string())))?
}

pub(super) fn branch_checkout_path_with(
    repo_path: &Path,
    branch: &str,
    run_git: RunGit<'_>,
) -> Option<String> {
    let stdout = run_git(repo_path, &["worktree", "list", "--porcelain"]).ok()?;
    parse_porcelain(&stdout)
        .into_iter()
        .find(|entry| entry.branch.as_deref() == Some(branch))
        .map(|entry| entry.path)
}

pub(super) fn worktree_create_blocking(args: CreateArgs) -> Result<CreatedWorktree, WorktreeError> {
    let repo_path = PathBuf::from(&args.repo_path);
    if !repo_path.exists() {
        return Err(WorktreeError::RepoNotFound(args.repo_path.clone()));
    }
    if !crate::repo::is_inside_repo(&repo_path) {
        return Err(WorktreeError::NoRepository(args.repo_path.clone()));
    }
    if !crate::repo::has_commit(&repo_path) {
        return Err(WorktreeError::NoCommit(args.repo_path.clone()));
    }

    let new_branch_name = args.branch_name.trim().to_string();
    let existing_branch = args
        .existing_branch
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty());
    if existing_branch.is_none() {
        if let Some(reason) = branch_name_problem(&new_branch_name) {
            return Err(WorktreeError::InvalidBranchName {
                branch: new_branch_name,
                reason: reason.to_string(),
            });
        }
    }
    let branch_name = existing_branch
        .map(|b| b.to_string())
        .unwrap_or_else(|| new_branch_name.clone());

    let parent = args
        .parent_dir
        .map(PathBuf::from)
        .unwrap_or_else(|| repo_path.join(".goodboy").join("worktrees"));
    let slug = sanitize_slug(&branch_name);
    let explicit_dir = args
        .dir_name
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty());
    let worktree_path = match explicit_dir {
        Some(name) => parent.join(sanitize_slug(name)),
        None => parent.join(&slug),
    };

    if worktree_path.starts_with(&repo_path) {
        ensure_goodboy_excluded(&repo_path);
    }

    if let Some(existing) = find_existing(&repo_path, &worktree_path)? {
        return Ok(CreatedWorktree {
            worktree_path: existing.path,
            branch_name: existing.branch.unwrap_or(branch_name),
            slug,
            reused: true,
            tracked_remote: false,
        });
    }

    std::fs::create_dir_all(&parent)?;

    let mut tracked_remote = false;
    if let Some(name) = existing_branch {
        let local_exists = git(
            &repo_path,
            &[
                "rev-parse",
                "--verify",
                "--quiet",
                &format!("refs/heads/{name}"),
            ],
        )
        .is_ok();
        if local_exists {
            if let Some(holder) =
                branch_checkout_path_with(&repo_path, name, &mut |cwd, args| git(cwd, args))
            {
                return Err(WorktreeError::BranchInUse {
                    branch: name.to_string(),
                    path: holder,
                });
            }
            git(
                &repo_path,
                &[
                    "worktree",
                    "add",
                    worktree_path.to_string_lossy().as_ref(),
                    name,
                ],
            )?;
        } else {
            let fallback_ref = args
                .fallback_ref
                .as_deref()
                .map(str::trim)
                .filter(|s| !s.is_empty());
            let fetch_failure = try_fetch_origin(&repo_path, name);
            let remote_exists = fetch_failure.is_none()
                && git(
                    &repo_path,
                    &[
                        "rev-parse",
                        "--verify",
                        "--quiet",
                        &format!("refs/remotes/origin/{name}"),
                    ],
                )
                .is_ok();
            match fallback_ref {
                Some(fallback) if !remote_exists => {
                    git(
                        &repo_path,
                        &["fetch", "origin", &format!("{fallback}:{name}")],
                    )
                    .map_err(|error| with_fetch_cause(error, fetch_failure.as_deref()))?;
                    git(
                        &repo_path,
                        &[
                            "worktree",
                            "add",
                            worktree_path.to_string_lossy().as_ref(),
                            name,
                        ],
                    )?;
                }
                _ if remote_exists => {
                    git(
                        &repo_path,
                        &[
                            "worktree",
                            "add",
                            "--track",
                            "-b",
                            name,
                            worktree_path.to_string_lossy().as_ref(),
                            &format!("origin/{name}"),
                        ],
                    )
                    .map_err(|error| with_fetch_cause(error, fetch_failure.as_deref()))?;
                }
                _ => match fetch_failure.as_deref() {
                    Some(cause) if !remote_ref_is_absent(&repo_path, cause) => {
                        return Err(with_fetch_cause(
                            WorktreeError::Git {
                                message: format!("could not look up origin/{name}"),
                            },
                            Some(cause),
                        ));
                    }
                    _ => {
                        return Err(WorktreeError::BranchNotFound {
                            branch: name.to_string(),
                        });
                    }
                },
            }
        }
    } else if let Some(source) = remote_backed_source(&repo_path, &branch_name)? {
        add_remote_backed_worktree(&repo_path, &worktree_path, &branch_name, &source)?;
        tracked_remote = true;
    } else {
        let configured_base = args
            .base_branch
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty());
        let detected_base = configured_base
            .map(str::to_string)
            .or_else(|| resolve_origin_head(&repo_path))
            .or_else(|| default_base_name(&repo_path, true));
        let fetch_failure = detected_base
            .as_deref()
            .and_then(|base| try_fetch_origin(&repo_path, base));
        let base_ref = resolve_origin_base(&repo_path, configured_base)
            .map_err(|error| with_fetch_cause(error, fetch_failure.as_deref()))?;
        git(
            &repo_path,
            &[
                "worktree",
                "add",
                "--no-track",
                "-b",
                &branch_name,
                worktree_path.to_string_lossy().as_ref(),
                &base_ref,
            ],
        )?;
    }

    Ok(CreatedWorktree {
        worktree_path: worktree_path.to_string_lossy().to_string(),
        branch_name,
        slug,
        reused: false,
        tracked_remote,
    })
}

fn find_existing(
    repo_path: &Path,
    worktree_path: &Path,
) -> Result<Option<WorktreeInfo>, WorktreeError> {
    let stdout = git(repo_path, &["worktree", "list", "--porcelain"])?;
    let entries = parse_porcelain(&stdout);
    Ok(entries
        .into_iter()
        .find(|w| Path::new(&w.path) == worktree_path))
}

pub(super) fn try_fetch_origin(repo_path: &Path, base: &str) -> Option<String> {
    git(repo_path, &["fetch", "origin", base])
        .err()
        .map(|error| error.to_string())
}

/// Tell "origin has no such branch" apart from "origin could not be reached".
/// Only the first one lets a caller cut the branch itself: an outage that
/// silently became a fresh branch would diverge from the real one.
fn remote_ref_is_absent(repo_path: &Path, fetch_failure: &str) -> bool {
    fetch_failure.contains("couldn't find remote ref")
        || git(repo_path, &["remote", "get-url", "origin"]).is_err()
}

fn with_fetch_cause(error: WorktreeError, fetch_failure: Option<&str>) -> WorktreeError {
    let Some(cause) = fetch_failure else {
        return error;
    };
    let WorktreeError::Git { message } = error else {
        return error;
    };
    WorktreeError::Git {
        message: format!("{message}. fetching from origin failed first: {cause}"),
    }
}

/// Resolve the ref to cut a new branch from. Prefers `origin/<base>` so the
/// new branch never inherits commits that exist only on the local copy of the
/// base branch. Falls back to `origin/master` if base is "main" and only
/// `master` exists on the remote, then to the local branch as a last resort.
/// Errors only when none of those refs exist.
fn resolve_origin_base(
    repo_path: &Path,
    configured_base: Option<&str>,
) -> Result<String, WorktreeError> {
    let candidates = base_candidates_with(repo_path, configured_base, true);
    for cand in &candidates {
        if git(repo_path, &["rev-parse", "--verify", "--quiet", cand]).is_ok() {
            return Ok(cand.clone());
        }
    }
    Err(WorktreeError::Git {
        message: format!("cannot find base ref: tried {}", candidates.join(", ")),
    })
}

#[cfg(test)]
mod tests;
