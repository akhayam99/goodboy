use super::base::branch_integration;
use super::error::WorktreeError;
use super::git::git;
use super::parse_status_v2;
use super::types::{GitWorkingTree, WorktreeDetachAssessment};
use std::path::Path;

#[tauri::command]
pub async fn worktree_detach_assessment(
    worktree_path: String,
    base_branch: Option<String>,
) -> Result<WorktreeDetachAssessment, WorktreeError> {
    tauri::async_runtime::spawn_blocking(move || {
        worktree_detach_assessment_blocking(worktree_path, base_branch)
    })
    .await
    .map_err(|e| WorktreeError::Io(std::io::Error::other(e.to_string())))?
}

pub(crate) fn local_only_commit_count(cwd: &Path) -> Option<u32> {
    git(cwd, &["rev-list", "--count", "HEAD", "--not", "--remotes"])
        .ok()
        .and_then(|raw| raw.trim().parse::<u32>().ok())
}

pub(super) const REPRODUCIBLE_IGNORED_DIRS: [&str; 11] = [
    "node_modules",
    "target",
    "dist",
    "build",
    ".next",
    ".venv",
    "__pycache__",
    ".turbo",
    "coverage",
    ".gradle",
    "Pods",
];

fn is_reproducible_ignored_path(relative: &str) -> bool {
    let top_level = relative.split('/').next().unwrap_or(relative);
    REPRODUCIBLE_IGNORED_DIRS.contains(&top_level)
}

struct IgnoredFilesAtRisk {
    count: u32,
    samples: Vec<String>,
}

fn ignored_files_at_risk(worktree_path: &Path) -> Option<IgnoredFilesAtRisk> {
    let raw = git(
        worktree_path,
        &[
            "ls-files",
            "--others",
            "--ignored",
            "--exclude-standard",
            "--directory",
            "-z",
        ],
    )
    .ok()?;
    let mut at_risk: Vec<String> = raw
        .split_terminator('\0')
        .filter(|line| !line.is_empty())
        .filter(|line| !is_reproducible_ignored_path(line))
        .map(|line| line.to_string())
        .collect();
    at_risk.sort_by(|a, b| a.len().cmp(&b.len()).then_with(|| a.cmp(b)));
    let count = u32::try_from(at_risk.len()).ok()?;
    let samples = at_risk.into_iter().take(5).collect();
    Some(IgnoredFilesAtRisk { count, samples })
}

pub(super) fn worktree_detach_assessment_blocking(
    worktree_path: String,
    base_branch: Option<String>,
) -> Result<WorktreeDetachAssessment, WorktreeError> {
    let p = Path::new(&worktree_path);
    if !p.exists() {
        return Ok(WorktreeDetachAssessment::Missing {
            path: worktree_path,
        });
    }
    let Ok(raw) = git(p, &["status", "--porcelain=v2", "--branch"]) else {
        return Ok(WorktreeDetachAssessment::Unavailable {
            path: worktree_path,
            branch: None,
        });
    };
    let snapshot = parse_status_v2(&raw);
    let branch = snapshot.branch.clone();
    let GitWorkingTree::Known { changed, .. } = snapshot.working_tree else {
        return Ok(WorktreeDetachAssessment::Unavailable {
            path: worktree_path,
            branch,
        });
    };
    let local_only_commits = match snapshot.head {
        None => Some(0),
        Some(_) => local_only_commit_count(p),
    };
    let Some(local_only_commits) = local_only_commits else {
        return Ok(WorktreeDetachAssessment::Unavailable {
            path: worktree_path,
            branch,
        });
    };
    let Some(ignored) = ignored_files_at_risk(p) else {
        return Ok(WorktreeDetachAssessment::Unavailable {
            path: worktree_path,
            branch,
        });
    };
    let integration = branch_integration(p, base_branch.as_deref(), snapshot.head.is_some());
    Ok(WorktreeDetachAssessment::Assessed {
        path: worktree_path,
        branch,
        has_upstream: snapshot.upstream.is_some(),
        affected_files: changed,
        local_only_commits,
        ignored_files: ignored.count,
        ignored_file_samples: ignored.samples,
        integration,
    })
}
