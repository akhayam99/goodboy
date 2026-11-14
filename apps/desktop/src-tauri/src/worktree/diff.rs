use super::base::{normalized_base, resolve_base};
use super::changed_files::{parse_name_status_z, parse_numstat_z, ChangedEntry};
use super::error::WorktreeError;
use super::git::{git_plain_paths, resolve_commit, validated_rev};
use crate::util::scoped_path::{resolve_within, ScopedPathError};
use serde::Serialize;
use std::collections::{HashMap, HashSet};
use std::path::Path;

#[tauri::command]
pub async fn worktree_diff(
    worktree_path: String,
    base_branch: Option<String>,
) -> Result<String, WorktreeError> {
    tauri::async_runtime::spawn_blocking(move || worktree_diff_blocking(worktree_path, base_branch))
        .await
        .map_err(|e| WorktreeError::Io(std::io::Error::other(e.to_string())))?
}

pub(super) fn worktree_diff_blocking(
    worktree_path: String,
    base_branch: Option<String>,
) -> Result<String, WorktreeError> {
    let p = Path::new(&worktree_path);
    if !p.exists() {
        return Err(WorktreeError::RepoNotFound(worktree_path));
    }
    let configured_base = normalized_base(base_branch.as_deref());
    let resolved = resolve_base(p, configured_base)
        .map(|(_, merge_base)| merge_base)
        .ok_or_else(|| WorktreeError::Git {
            message: "cannot resolve base branch merge-base".to_string(),
        })?;
    let tracked = git_plain_paths(p, &["diff", &resolved])?;
    Ok(format!("{tracked}{}", untracked_new_file_diffs(p)))
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DiffFileEntry {
    pub path: String,
    pub old_path: Option<String>,
    pub status: &'static str,
    pub additions: u32,
    pub deletions: u32,
    pub is_binary: bool,
    pub is_untracked: bool,
}

#[tauri::command]
pub async fn worktree_diff_files(
    worktree_path: String,
    base_branch: Option<String>,
) -> Result<Vec<DiffFileEntry>, WorktreeError> {
    tauri::async_runtime::spawn_blocking(move || {
        worktree_diff_files_blocking(worktree_path, base_branch)
    })
    .await
    .map_err(|e| WorktreeError::Io(std::io::Error::other(e.to_string())))?
}

pub(super) fn worktree_diff_files_blocking(
    worktree_path: String,
    base_branch: Option<String>,
) -> Result<Vec<DiffFileEntry>, WorktreeError> {
    let p = Path::new(&worktree_path);
    if !p.exists() {
        return Err(WorktreeError::RepoNotFound(worktree_path));
    }
    let configured_base = normalized_base(base_branch.as_deref());
    let resolved = resolve_base(p, configured_base)
        .map(|(_, merge_base)| merge_base)
        .ok_or_else(|| WorktreeError::Git {
            message: "cannot resolve base branch merge-base".to_string(),
        })?;
    let numstat = git_plain_paths(p, &["diff", "--numstat", "-z", "-M", &resolved])?;
    let name_status = git_plain_paths(p, &["diff", "--name-status", "-z", "-M", &resolved])?;
    let statuses = parse_name_status_z(&name_status);
    let by_path: HashMap<&str, &ChangedEntry> = statuses
        .iter()
        .map(|entry| (entry.path.as_str(), entry))
        .collect();
    let mut entries: Vec<DiffFileEntry> = Vec::new();
    for row in parse_numstat_z(&numstat) {
        let known = by_path.get(row.path).copied();
        entries.push(DiffFileEntry {
            path: row.path.to_string(),
            old_path: known.and_then(|entry| entry.from.clone()),
            status: known.map_or("modified", |entry| entry.status),
            additions: row.additions.parse().unwrap_or(0),
            deletions: row.deletions.parse().unwrap_or(0),
            is_binary: row.additions == "-",
            is_untracked: false,
        });
    }
    let counted: HashSet<String> = entries.iter().map(|entry| entry.path.clone()).collect();
    for entry in &statuses {
        if counted.contains(&entry.path) {
            continue;
        }
        entries.push(DiffFileEntry {
            path: entry.path.clone(),
            old_path: entry.from.clone(),
            status: entry.status,
            additions: 0,
            deletions: 0,
            is_binary: false,
            is_untracked: false,
        });
    }
    let untracked = git_plain_paths(p, &["ls-files", "--others", "--exclude-standard", "-z"])?;
    for rel in untracked.split('\0').filter(|rel| !rel.is_empty()) {
        entries.push(untracked_entry_for(p, rel));
    }
    entries.sort_by(|a, b| a.path.cmp(&b.path));
    entries.dedup_by(|a, b| a.path == b.path);
    Ok(entries)
}

fn untracked_entry_for(p: &Path, rel: &str) -> DiffFileEntry {
    let bytes = std::fs::read(p.join(rel)).unwrap_or_default();
    let text = (!bytes.contains(&0))
        .then(|| String::from_utf8(bytes).ok())
        .flatten();
    let additions = text.as_deref().map_or(0, |content| {
        let breaks = content.matches('\n').count();
        match content {
            "" => 0,
            _ if content.ends_with('\n') => breaks,
            _ => breaks + 1,
        }
    });
    DiffFileEntry {
        path: rel.to_string(),
        old_path: None,
        status: "added",
        additions: additions as u32,
        deletions: 0,
        is_binary: text.is_none(),
        is_untracked: true,
    }
}

/// Unified diff for a SINGLE file `rel_path` inside the worktree, against the
/// same merge-base `worktree_diff` uses. The path is taken as worktree-relative
/// and confined to the worktree: any `..` traversal or path that resolves
/// outside the worktree root is refused. Untracked files fall back to the same
/// synthetic new-file diff `worktree_diff` emits.
#[tauri::command]
pub async fn worktree_diff_file(
    worktree_path: String,
    base_branch: Option<String>,
    path: String,
    old_path: Option<String>,
) -> Result<String, WorktreeError> {
    tauri::async_runtime::spawn_blocking(move || {
        worktree_diff_file_blocking(worktree_path, base_branch, path, old_path)
    })
    .await
    .map_err(|e| WorktreeError::Io(std::io::Error::other(e.to_string())))?
}

fn worktree_diff_file_blocking(
    worktree_path: String,
    base_branch: Option<String>,
    path: String,
    old_path: Option<String>,
) -> Result<String, WorktreeError> {
    let p = Path::new(&worktree_path);
    if !p.exists() {
        return Err(WorktreeError::RepoNotFound(worktree_path));
    }
    let rel = confine_rel_path(p, &path)?;
    let configured_base = normalized_base(base_branch.as_deref());
    let resolved = resolve_base(p, configured_base)
        .map(|(_, merge_base)| merge_base)
        .ok_or_else(|| WorktreeError::Git {
            message: "cannot resolve base branch merge-base".to_string(),
        })?;
    // `-- <path>` scopes the diff to the one file. Pathspec is anchored at the
    // worktree root (already confined above), so no traversal is possible.
    let old_rel = match old_path.as_deref() {
        Some(old) => Some(confine_rel_path(p, old)?),
        None => None,
    };
    let mut args: Vec<&str> = vec!["diff", &resolved, "--", &rel];
    if let Some(old) = old_rel.as_deref() {
        args.push(old);
    }
    let tracked = git_plain_paths(p, &args)?;
    if !tracked.is_empty() {
        return Ok(tracked);
    }
    // No tracked diff: the file may be untracked (new). Emit the synthetic
    // new-file diff for just this path, mirroring `untracked_new_file_diffs`.
    Ok(untracked_new_file_diff_for(p, &rel))
}

/// Resolve `path` as a worktree-relative path and verify it stays inside the
/// worktree root. Returns the normalized relative path (forward-slashed) for use
/// as a git pathspec. Refuses absolute paths and any `..` escape.
fn confine_rel_path(worktree: &Path, path: &str) -> Result<String, WorktreeError> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err(WorktreeError::Git {
            message: "diff path is empty".to_string(),
        });
    }
    let escapes = || WorktreeError::Git {
        message: "diff path escapes the worktree".to_string(),
    };
    let root = worktree
        .canonicalize()
        .unwrap_or_else(|_| worktree.to_path_buf());
    let candidate = Path::new(trimmed);
    let relative = if candidate.is_absolute() {
        candidate
            .strip_prefix(&root)
            .or_else(|_| candidate.strip_prefix(worktree))
            .map_err(|_| escapes())?
    } else {
        candidate
    };
    let resolved = match resolve_within(&root, relative) {
        Ok(resolved) => resolved
            .strip_prefix(&root)
            .map_err(|_| escapes())?
            .to_path_buf(),
        Err(ScopedPathError::Unavailable) => relative.to_path_buf(),
        Err(_) => return Err(escapes()),
    };
    let rel = resolved.to_string_lossy().replace('\\', "/");
    if rel.is_empty() {
        return Err(WorktreeError::Git {
            message: "diff path resolves to the worktree root".to_string(),
        });
    }
    Ok(rel)
}

#[tauri::command]
pub async fn worktree_diff_commit(
    worktree_path: String,
    sha: String,
) -> Result<String, WorktreeError> {
    tauri::async_runtime::spawn_blocking(move || worktree_diff_commit_blocking(worktree_path, sha))
        .await
        .map_err(|e| WorktreeError::Io(std::io::Error::other(e.to_string())))?
}

pub(super) fn worktree_diff_commit_blocking(
    worktree_path: String,
    sha: String,
) -> Result<String, WorktreeError> {
    let p = Path::new(&worktree_path);
    if !p.exists() {
        return Err(WorktreeError::RepoNotFound(worktree_path));
    }
    let rev = validated_rev(&sha)?;
    git_plain_paths(p, &["show", "--format=", rev])
}

#[tauri::command]
pub async fn worktree_diff_range(
    worktree_path: String,
    base: String,
    head: String,
    is_from_merge_base: Option<bool>,
) -> Result<String, WorktreeError> {
    tauri::async_runtime::spawn_blocking(move || {
        worktree_diff_range_blocking(
            worktree_path,
            base,
            head,
            is_from_merge_base.unwrap_or(false),
        )
    })
    .await
    .map_err(|e| WorktreeError::Io(std::io::Error::other(e.to_string())))?
}

pub(super) fn worktree_diff_range_blocking(
    worktree_path: String,
    base: String,
    head: String,
    is_from_merge_base: bool,
) -> Result<String, WorktreeError> {
    let p = Path::new(&worktree_path);
    if !p.exists() {
        return Err(WorktreeError::RepoNotFound(worktree_path));
    }
    let from = resolve_commit(p, validated_rev(&base)?)?;
    let to = resolve_commit(p, validated_rev(&head)?)?;
    if is_from_merge_base {
        return git_plain_paths(p, &["diff", &format!("{from}...{to}")]);
    }
    git_plain_paths(p, &["diff", &from, &to])
}

#[tauri::command]
pub async fn worktree_diff_working(
    worktree_path: String,
    scope: String,
) -> Result<String, WorktreeError> {
    tauri::async_runtime::spawn_blocking(move || {
        worktree_diff_working_blocking(worktree_path, scope)
    })
    .await
    .map_err(|e| WorktreeError::Io(std::io::Error::other(e.to_string())))?
}

fn worktree_diff_working_blocking(
    worktree_path: String,
    scope: String,
) -> Result<String, WorktreeError> {
    let p = Path::new(&worktree_path);
    if !p.exists() {
        return Err(WorktreeError::RepoNotFound(worktree_path));
    }
    match scope.as_str() {
        "unstaged" => git_plain_paths(p, &["diff"]),
        "staged" => git_plain_paths(p, &["diff", "--cached"]),
        "all" => {
            let tracked = git_plain_paths(p, &["diff", "HEAD"])?;
            Ok(format!("{tracked}{}", untracked_new_file_diffs(p)))
        }
        other => Err(WorktreeError::Git {
            message: format!("unknown scope: {other} (expected unstaged|staged|all)"),
        }),
    }
}

fn untracked_new_file_diffs(p: &Path) -> String {
    let untracked =
        git_plain_paths(p, &["ls-files", "--others", "--exclude-standard"]).unwrap_or_default();
    let mut out = String::new();
    for line in untracked.lines() {
        let rel = line.trim();
        if rel.is_empty() {
            continue;
        }
        out.push_str(&untracked_new_file_diff_for(p, rel));
    }
    out
}

/// Synthetic new-file unified diff for a single untracked `rel` path. Returns an
/// empty string when the file isn't actually untracked (git lists nothing), so a
/// caller can treat "" as "no diff for this path".
fn untracked_new_file_diff_for(p: &Path, rel: &str) -> String {
    // Only emit if git agrees this path is untracked — keeps the single-file
    // diff honest (a tracked-but-unchanged file produces nothing).
    let listed = git_plain_paths(
        p,
        &["ls-files", "--others", "--exclude-standard", "--", rel],
    )
    .unwrap_or_default();
    if listed.lines().map(str::trim).all(|l| l != rel) {
        return String::new();
    }
    let mut out = String::new();
    out.push_str(&format!("diff --git a/{rel} b/{rel}\n"));
    out.push_str("new file mode 100644\n");
    let bytes = match std::fs::read(p.join(rel)) {
        Ok(b) => b,
        Err(_) => {
            out.push_str("--- /dev/null\n");
            out.push_str(&format!("+++ b/{rel}\n"));
            return out;
        }
    };
    if bytes.contains(&0) {
        out.push_str(&format!("Binary files /dev/null and b/{rel} differ\n"));
        return out;
    }
    let content = match String::from_utf8(bytes) {
        Ok(s) => s,
        Err(_) => {
            out.push_str(&format!("Binary files /dev/null and b/{rel} differ\n"));
            return out;
        }
    };
    out.push_str("--- /dev/null\n");
    out.push_str(&format!("+++ b/{rel}\n"));
    if content.is_empty() {
        return out;
    }
    let ends_with_nl = content.ends_with('\n');
    let lines: Vec<&str> = if ends_with_nl {
        content.split_terminator('\n').collect()
    } else {
        content.split('\n').collect()
    };
    let n = lines.len();
    out.push_str(&format!("@@ -0,0 +1,{n} @@\n"));
    for (i, l) in lines.iter().enumerate() {
        out.push_str(&format!("+{l}\n"));
        if !ends_with_nl && i == n - 1 {
            out.push_str("\\ No newline at end of file\n");
        }
    }
    out
}

#[cfg(test)]
mod tests;
