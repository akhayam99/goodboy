use super::base::{normalized_base, resolve_base};
use super::error::WorktreeError;
use super::git::{git, resolve_commit};
use std::path::Path;

const PLAIN_PATHS: [&str; 2] = ["-c", "core.quotepath=false"];

fn git_plain_paths(p: &Path, args: &[&str]) -> Result<String, WorktreeError> {
    let argv: Vec<&str> = PLAIN_PATHS.iter().chain(args.iter()).copied().collect();
    git(p, &argv)
}

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
) -> Result<String, WorktreeError> {
    tauri::async_runtime::spawn_blocking(move || {
        worktree_diff_file_blocking(worktree_path, base_branch, path)
    })
    .await
    .map_err(|e| WorktreeError::Io(std::io::Error::other(e.to_string())))?
}

fn worktree_diff_file_blocking(
    worktree_path: String,
    base_branch: Option<String>,
    path: String,
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
    let tracked = git_plain_paths(p, &["diff", &resolved, "--", &rel])?;
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
    let candidate = Path::new(trimmed);
    let abs = if candidate.is_absolute() {
        candidate.to_path_buf()
    } else {
        worktree.join(candidate)
    };
    // Reject any `..` component up front (cheap, no fs access) so we never even
    // canonicalize a traversal attempt.
    if abs
        .components()
        .any(|c| matches!(c, std::path::Component::ParentDir))
    {
        return Err(WorktreeError::Git {
            message: "diff path escapes the worktree".to_string(),
        });
    }
    let root = worktree
        .canonicalize()
        .unwrap_or_else(|_| worktree.to_path_buf());
    // Canonicalize when the file exists (resolves symlinks); fall back to the
    // lexical join for not-yet-existing (e.g. untracked-but-deleted) paths.
    let resolved = abs.canonicalize().unwrap_or(abs);
    if !resolved.starts_with(&root) {
        return Err(WorktreeError::Git {
            message: "diff path escapes the worktree".to_string(),
        });
    }
    let rel = resolved
        .strip_prefix(&root)
        .unwrap_or(&resolved)
        .to_string_lossy()
        .replace('\\', "/");
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

fn worktree_diff_commit_blocking(
    worktree_path: String,
    sha: String,
) -> Result<String, WorktreeError> {
    let p = Path::new(&worktree_path);
    if !p.exists() {
        return Err(WorktreeError::RepoNotFound(worktree_path));
    }
    let trimmed = sha.trim();
    if trimmed.is_empty() {
        return Err(WorktreeError::Git {
            message: "commit sha is empty".to_string(),
        });
    }
    git_plain_paths(p, &["show", "--format=", trimmed])
}

#[tauri::command]
pub async fn worktree_diff_range(
    worktree_path: String,
    base: String,
    head: String,
) -> Result<String, WorktreeError> {
    tauri::async_runtime::spawn_blocking(move || {
        worktree_diff_range_blocking(worktree_path, base, head)
    })
    .await
    .map_err(|e| WorktreeError::Io(std::io::Error::other(e.to_string())))?
}

fn worktree_diff_range_blocking(
    worktree_path: String,
    base: String,
    head: String,
) -> Result<String, WorktreeError> {
    let p = Path::new(&worktree_path);
    if !p.exists() {
        return Err(WorktreeError::RepoNotFound(worktree_path));
    }
    let from = resolve_commit(p, base.trim())?;
    let to = resolve_commit(p, head.trim())?;
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
