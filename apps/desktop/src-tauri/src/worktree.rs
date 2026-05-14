use std::path::{Path, PathBuf};

use regex::Regex;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use thiserror::Error;

const MAX_SLUG_LEN: usize = 40;

#[derive(Debug, Error)]
pub enum WorktreeError {
    #[error("repository not found: {0}")]
    RepoNotFound(String),
    #[error("git failed: {message}")]
    Git { message: String },
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("invalid utf-8 in git output")]
    InvalidUtf8,
}

impl Serialize for WorktreeError {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        let mut map = serde_json::Map::new();
        map.insert(
            "kind".to_string(),
            serde_json::Value::String(self.kind().to_string()),
        );
        map.insert(
            "message".to_string(),
            serde_json::Value::String(self.to_string()),
        );
        serde_json::Value::Object(map).serialize(serializer)
    }
}

impl WorktreeError {
    fn kind(&self) -> &'static str {
        match self {
            WorktreeError::RepoNotFound(_) => "repo_not_found",
            WorktreeError::Git { .. } => "git",
            WorktreeError::Io(_) => "io",
            WorktreeError::InvalidUtf8 => "invalid_utf8",
        }
    }
}

#[derive(Debug, Serialize)]
pub struct CreatedWorktree {
    #[serde(rename = "worktreePath")]
    pub worktree_path: String,
    #[serde(rename = "branchName")]
    pub branch_name: String,
    pub slug: String,
    pub reused: bool,
}

#[derive(Debug, Serialize)]
pub struct WorktreeInfo {
    pub path: String,
    pub branch: Option<String>,
    pub head: String,
    #[serde(rename = "isMain")]
    pub is_main: bool,
}

#[derive(Debug, Deserialize)]
pub struct CreateArgs {
    #[serde(rename = "repoPath")]
    pub repo_path: String,
    #[serde(rename = "branchPrefix")]
    pub branch_prefix: String,
    pub slug: String,
    #[serde(rename = "parentDir")]
    pub parent_dir: Option<String>,
    /// When set, the worktree is created from this existing local branch
    /// instead of cutting a new one. `branch_prefix` and `slug` are still used
    /// to derive the worktree directory name.
    #[serde(rename = "existingBranch", default)]
    pub existing_branch: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct BranchInfo {
    pub name: String,
    /// True when this branch is currently checked out in some worktree.
    #[serde(rename = "inUse")]
    pub in_use: bool,
    /// True when the branch has uncommitted changes in its checkout.
    #[serde(rename = "hasUncommitted")]
    pub has_uncommitted: bool,
}

#[derive(Debug, Deserialize)]
pub struct ChangeBranchArgs {
    #[serde(rename = "repoPath")]
    pub repo_path: String,
    #[serde(rename = "worktreePath")]
    pub worktree_path: String,
    pub branch: String,
    /// When true, create the branch with `git switch -c`. When false, switch to
    /// an existing branch with `git switch`.
    #[serde(rename = "createNew")]
    pub create_new: bool,
}

pub fn sanitize_slug(input: &str) -> String {
    let lowered = input.to_ascii_lowercase();
    let alnum_dash = Regex::new(r"[^a-z0-9-]+").unwrap();
    let collapsed_dashes = Regex::new(r"-+").unwrap();
    let edge_dashes = Regex::new(r"^-+|-+$").unwrap();

    let stage1 = alnum_dash.replace_all(&lowered, "-");
    let stage2 = collapsed_dashes.replace_all(&stage1, "-");
    let stage3 = edge_dashes.replace_all(&stage2, "");
    let truncated: String = stage3.chars().take(MAX_SLUG_LEN).collect();
    let trimmed = truncated.trim_end_matches('-').to_string();

    if trimmed.is_empty() {
        let mut hasher = Sha256::new();
        hasher.update(input.as_bytes());
        format!("{:x}", hasher.finalize()).chars().take(8).collect()
    } else {
        trimmed
    }
}

#[tauri::command]
pub fn worktree_create(args: CreateArgs) -> Result<CreatedWorktree, WorktreeError> {
    let repo_path = PathBuf::from(&args.repo_path);
    if !repo_path.exists() {
        return Err(WorktreeError::RepoNotFound(args.repo_path.clone()));
    }

    let slug = sanitize_slug(&args.slug);
    let new_branch_name = format!("{}/{}", args.branch_prefix, slug);
    let existing_branch = args
        .existing_branch
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty());
    let branch_name = existing_branch
        .map(|b| b.to_string())
        .unwrap_or_else(|| new_branch_name.clone());

    // Default location: <repo>/.kay-am/worktrees/<prefix>-<slug>. Keeps every
    // session-scoped checkout inside the workspace folder so the user only has
    // one project root to track. The .kay-am dir should be in the repo's
    // .gitignore (we add it on first creation, see ensure_gitignore_entry).
    let parent = args
        .parent_dir
        .map(PathBuf::from)
        .unwrap_or_else(|| repo_path.join(".kay-am").join("worktrees"));
    // For existing branches we still derive a unique directory from the
    // sanitized branch (with slashes replaced) so two sessions adopting the
    // same branch don't collide on disk.
    let dir_slug = existing_branch
        .map(sanitize_slug)
        .unwrap_or_else(|| slug.clone());
    let worktree_path = parent.join(format!("{}-{dir_slug}", args.branch_prefix));

    ensure_gitignore_entry(&repo_path, ".kay-am/")?;

    if let Some(existing) = find_existing(&repo_path, &worktree_path)? {
        return Ok(CreatedWorktree {
            worktree_path: existing.path,
            branch_name: existing.branch.unwrap_or(branch_name),
            slug,
            reused: true,
        });
    }

    std::fs::create_dir_all(&parent)?;

    if let Some(name) = existing_branch {
        // Adopt the existing local branch as-is. Fails if the branch is
        // already checked out elsewhere — caller is expected to surface that
        // to the user.
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
        git(
            &repo_path,
            &[
                "worktree",
                "add",
                "-b",
                &branch_name,
                worktree_path.to_string_lossy().as_ref(),
            ],
        )?;
    }

    Ok(CreatedWorktree {
        worktree_path: worktree_path.to_string_lossy().to_string(),
        branch_name,
        slug,
        reused: false,
    })
}

#[tauri::command]
pub fn worktree_list_local_branches(repo_path: String) -> Result<Vec<BranchInfo>, WorktreeError> {
    let p = Path::new(&repo_path);
    if !p.exists() {
        return Err(WorktreeError::RepoNotFound(repo_path));
    }
    let raw = git(
        p,
        &["for-each-ref", "--format=%(refname:short)", "refs/heads"],
    )?;
    let worktrees = parse_porcelain(&git(p, &["worktree", "list", "--porcelain"])?);
    let in_use_branches: std::collections::HashSet<String> = worktrees
        .iter()
        .filter_map(|w| w.branch.clone())
        .collect();
    let mut branches = Vec::new();
    for line in raw.lines() {
        let name = line.trim();
        if name.is_empty() {
            continue;
        }
        let in_use = in_use_branches.contains(name);
        let has_uncommitted = if in_use {
            branch_worktree_has_uncommitted(&worktrees, name).unwrap_or(false)
        } else {
            false
        };
        branches.push(BranchInfo {
            name: name.to_string(),
            in_use,
            has_uncommitted,
        });
    }
    Ok(branches)
}

fn branch_worktree_has_uncommitted(worktrees: &[WorktreeInfo], branch: &str) -> Option<bool> {
    let wt = worktrees.iter().find(|w| w.branch.as_deref() == Some(branch))?;
    let stdout = git(Path::new(&wt.path), &["status", "--porcelain"]).ok()?;
    Some(!stdout.trim().is_empty())
}

#[tauri::command]
pub fn worktree_change_branch(args: ChangeBranchArgs) -> Result<(), WorktreeError> {
    let wt = Path::new(&args.worktree_path);
    if !wt.exists() {
        return Err(WorktreeError::RepoNotFound(args.worktree_path.clone()));
    }
    let trimmed = args.branch.trim();
    if trimmed.is_empty() {
        return Err(WorktreeError::Git {
            message: "branch name is empty".to_string(),
        });
    }
    if args.create_new {
        git(wt, &["switch", "-c", trimmed])?;
    } else {
        git(wt, &["switch", trimmed])?;
    }
    Ok(())
}

#[tauri::command]
pub fn worktree_remove(repo_path: String, worktree_path: String) -> Result<(), WorktreeError> {
    git(
        Path::new(&repo_path),
        &["worktree", "remove", "--force", &worktree_path],
    )?;
    Ok(())
}

#[tauri::command]
pub fn worktree_list(repo_path: String) -> Result<Vec<WorktreeInfo>, WorktreeError> {
    let stdout = git(Path::new(&repo_path), &["worktree", "list", "--porcelain"])?;
    Ok(parse_porcelain(&stdout))
}

#[tauri::command]
pub fn worktree_diff(
    worktree_path: String,
    base: Option<String>,
) -> Result<String, WorktreeError> {
    let p = Path::new(&worktree_path);
    if !p.exists() {
        return Err(WorktreeError::RepoNotFound(worktree_path));
    }
    let user_base = base.unwrap_or_else(|| "main".to_string());
    let candidates = [user_base.clone(), format!("origin/{user_base}")];
    let resolved = candidates
        .iter()
        .find_map(|cand| git(p, &["merge-base", "HEAD", cand]).ok())
        .map(|s| s.trim().to_string())
        .ok_or_else(|| WorktreeError::Git {
            message: format!("cannot resolve merge-base against {user_base} or origin/{user_base}"),
        })?;
    git(p, &["diff", &resolved])
}

#[tauri::command]
pub fn worktree_exists(
    repo_path: String,
    branch_prefix: String,
    slug: String,
) -> Result<bool, WorktreeError> {
    let entries = worktree_list(repo_path)?;
    let target_branch = format!("{branch_prefix}/{}", sanitize_slug(&slug));
    Ok(entries
        .iter()
        .any(|w| w.branch.as_deref() == Some(target_branch.as_str())))
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

/// Append a line to the repo's .gitignore if it isn't already present, so the
/// worktree directory created by kay-am doesn't leak into git status. No-ops
/// when the file is already gitignoring the entry, when no .gitignore exists
/// and writing fails, or when the entry is already there.
fn ensure_gitignore_entry(repo_path: &Path, entry: &str) -> Result<(), WorktreeError> {
    let gitignore = repo_path.join(".gitignore");
    let existing = std::fs::read_to_string(&gitignore).unwrap_or_default();
    let has_entry = existing
        .lines()
        .any(|line| line.trim() == entry || line.trim() == entry.trim_end_matches('/'));
    if has_entry {
        return Ok(());
    }
    let needs_newline = !existing.is_empty() && !existing.ends_with('\n');
    let mut next = existing;
    if needs_newline {
        next.push('\n');
    }
    next.push_str(entry);
    next.push('\n');
    // Best-effort: silently swallow write errors so a read-only repo doesn't
    // block worktree creation.
    let _ = std::fs::write(&gitignore, next);
    Ok(())
}

fn git(cwd: &Path, args: &[&str]) -> Result<String, WorktreeError> {
    let output = crate::path_env::command("git").args(args).current_dir(cwd).output()?;
    if !output.status.success() {
        let stderr = String::from_utf8(output.stderr).unwrap_or_default();
        return Err(WorktreeError::Git {
            message: format!("git {} failed: {stderr}", args.join(" ")).trim().to_string(),
        });
    }
    String::from_utf8(output.stdout).map_err(|_| WorktreeError::InvalidUtf8)
}

fn parse_porcelain(stdout: &str) -> Vec<WorktreeInfo> {
    let mut entries = Vec::new();
    let mut is_first = true;

    for block in stdout.split("\n\n") {
        let block = block.trim();
        if block.is_empty() {
            continue;
        }

        let mut path = String::new();
        let mut branch: Option<String> = None;
        let mut head = String::new();

        for line in block.lines() {
            if let Some(rest) = line.strip_prefix("worktree ") {
                path = rest.to_string();
            } else if let Some(rest) = line.strip_prefix("HEAD ") {
                head = rest.to_string();
            } else if let Some(rest) = line.strip_prefix("branch ") {
                branch = Some(rest.trim_start_matches("refs/heads/").to_string());
            } else if line == "detached" {
                branch = None;
            }
        }

        if !path.is_empty() {
            entries.push(WorktreeInfo {
                path,
                branch,
                head,
                is_main: is_first,
            });
            is_first = false;
        }
    }

    entries
}
