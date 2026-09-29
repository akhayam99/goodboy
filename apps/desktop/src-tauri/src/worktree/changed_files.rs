use super::base::{normalized_base, resolve_base};
use super::error::WorktreeError;
use super::git::git;
use serde::Serialize;
use std::path::Path;

#[derive(Debug, Serialize)]
pub struct ChangedFilesSummary {
    pub paths: Vec<String>,
    pub additions: u32,
    pub deletions: u32,
    /// Raw per-file numstat lines for the SAME change set as `paths` —
    /// "<adds>\t<dels>\t<path>" (binary files: "-\t-\t<path>"), one per line,
    /// INCLUDING untracked files (counted as additions, deletions 0). This is the
    /// source of truth mirrored to the mobile `files_touched_numstat` context
    /// slot, so the phone gets both the file list and the +/- counts from one
    /// value computed against the same merge-base the desktop's own view uses.
    pub numstat: String,
}

const LANDED_FILE_LIMIT: usize = 400;

/// Whether the base branch already carries everything this branch committed.
///
/// `base..HEAD` is empty once the branch is merged with a merge commit. A
/// squash or a rebase rewrites the commits, so ancestry says nothing: compare
/// the files the branch touched instead, and call it landed when the base and
/// the branch tip agree on every one of them. The caller then measures the
/// working tree against `HEAD` rather than the merge-base, so a landed branch
/// reads as clean until it is worked on again.
fn branch_work_landed(cwd: &Path, base_ref: &str, merge_base: &str) -> bool {
    let Ok(raw) = git(cwd, &["rev-list", "--count", &format!("{base_ref}..HEAD")]) else {
        return false;
    };
    let Ok(ahead) = raw.trim().parse::<usize>() else {
        return false;
    };
    if ahead == 0 {
        return true;
    }
    let Ok(touched) = git(cwd, &["diff", "--name-only", merge_base, "HEAD"]) else {
        return false;
    };
    let paths: Vec<&str> = touched
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .collect();
    if paths.is_empty() || paths.len() > LANDED_FILE_LIMIT {
        return paths.is_empty();
    }
    let mut args: Vec<&str> = vec!["diff", "--name-only", base_ref, "HEAD", "--"];
    args.extend(paths.iter().copied());
    let Ok(remaining) = git(cwd, &args) else {
        return false;
    };
    remaining.trim().is_empty()
}

/// Distinct file paths that differ between the worktree (including uncommitted
/// + untracked) and the merge-base with the given base branch, plus aggregate
/// line +/- totals.
///
/// Stable across "before vs after push": pushing commits doesn't shrink the
/// count because we diff against the merge-base, not `HEAD`. Once the branch
/// has landed in the base there is nothing left to measure against that
/// merge-base, so the comparison moves to `HEAD` and only uncommitted work
/// counts. Untracked files contribute their line count to additions.
#[tauri::command]
pub async fn worktree_changed_files(
    worktree_path: String,
    base_branch: Option<String>,
) -> Result<ChangedFilesSummary, WorktreeError> {
    tauri::async_runtime::spawn_blocking(move || {
        worktree_changed_files_blocking(worktree_path, base_branch)
    })
    .await
    .map_err(|e| WorktreeError::Io(std::io::Error::other(e.to_string())))?
}

pub(super) fn worktree_changed_files_blocking(
    worktree_path: String,
    base_branch: Option<String>,
) -> Result<ChangedFilesSummary, WorktreeError> {
    let p = Path::new(&worktree_path);
    if !p.exists() {
        return Err(WorktreeError::RepoNotFound(worktree_path));
    }
    let configured_base = normalized_base(base_branch.as_deref());
    let (base_ref, merge_base) =
        resolve_base(p, configured_base).ok_or_else(|| WorktreeError::Git {
            message: "cannot resolve base branch merge-base".to_string(),
        })?;
    let resolved = if branch_work_landed(p, &base_ref, &merge_base) {
        "HEAD".to_string()
    } else {
        merge_base
    };
    let tracked_numstat = git(p, &["diff", "--numstat", &resolved]).unwrap_or_default();
    let mut additions: u32 = 0;
    let mut deletions: u32 = 0;
    let mut set: std::collections::BTreeSet<String> = std::collections::BTreeSet::new();
    // Collect the per-file numstat lines so we can mirror them verbatim into the
    // `files_touched_numstat` context slot (same merge-base as above).
    let mut numstat_lines: Vec<String> = Vec::new();
    for line in tracked_numstat.lines() {
        // numstat format: "<adds>\t<dels>\t<path>" — binary files show "-\t-\t<path>"
        let mut parts = line.splitn(3, '\t');
        let add_s = parts.next().unwrap_or("");
        let del_s = parts.next().unwrap_or("");
        let path = parts.next().unwrap_or("").trim();
        if path.is_empty() {
            continue;
        }
        if let Ok(a) = add_s.parse::<u32>() {
            additions = additions.saturating_add(a);
        }
        if let Ok(d) = del_s.parse::<u32>() {
            deletions = deletions.saturating_add(d);
        }
        set.insert(path.to_string());
        // Preserve git's exact line (including "-\t-\t" for binary).
        numstat_lines.push(format!("{add_s}\t{del_s}\t{path}"));
    }
    // Untracked files: contribute their content as additions. `git diff` doesn't
    // see them, so synthesize a numstat line ("<lines>\t0\t<path>") to keep the
    // slot's file list complete and the +/- counts consistent with `additions`.
    let untracked = git(p, &["ls-files", "--others", "--exclude-standard"]).unwrap_or_default();
    for line in untracked.lines() {
        let rel = line.trim();
        if rel.is_empty() {
            continue;
        }
        set.insert(rel.to_string());
        match std::fs::read(p.join(rel)) {
            Ok(bytes) if bytes.contains(&0) => {
                // Binary untracked file — mirror git's "-\t-\t<path>" form.
                numstat_lines.push(format!("-\t-\t{rel}"));
            }
            Ok(bytes) => {
                let n = String::from_utf8_lossy(&bytes).lines().count() as u32;
                additions = additions.saturating_add(n);
                numstat_lines.push(format!("{n}\t0\t{rel}"));
            }
            Err(_) => {
                numstat_lines.push(format!("0\t0\t{rel}"));
            }
        }
    }
    Ok(ChangedFilesSummary {
        paths: set.into_iter().collect(),
        additions,
        deletions,
        numstat: numstat_lines.join("\n"),
    })
}
