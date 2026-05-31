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
    /// Base branch to cut a new branch from. Defaults to `main`. The branch is
    /// always cut from `origin/<base>` (not the local copy) so a stale local
    /// `main` cannot leak unrelated commits into the new branch. Ignored when
    /// `existing_branch` is set.
    #[serde(rename = "baseBranch", default)]
    pub base_branch: Option<String>,
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

    // Default location: <repo>/.goodboy/worktrees/<prefix>-<slug>. Keeps every
    // session-scoped checkout inside the workspace folder so the user only has
    // one project root to track. The .goodboy dir should be in the repo's
    // .gitignore (we add it on first creation, see ensure_gitignore_entry).
    let parent = args
        .parent_dir
        .map(PathBuf::from)
        .unwrap_or_else(|| repo_path.join(".goodboy").join("worktrees"));
    // For existing branches we still derive a unique directory from the
    // sanitized branch (with slashes replaced) so two sessions adopting the
    // same branch don't collide on disk.
    let dir_slug = existing_branch
        .map(sanitize_slug)
        .unwrap_or_else(|| slug.clone());
    let worktree_path = parent.join(format!("{}-{dir_slug}", args.branch_prefix));

    ensure_gitignore_entry(&repo_path, ".goodboy/")?;

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
        let local_exists = git(
            &repo_path,
            &["rev-parse", "--verify", "--quiet", &format!("refs/heads/{name}")],
        )
        .is_ok();
        if local_exists {
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
            let _ = git(&repo_path, &["fetch", "origin", name]);
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
            )?;
        }
    } else {
        // Cut from `origin/<base>`, not the local checkout, so a stale or
        // dirty local `main` cannot leak unrelated commits into the new
        // branch. We fetch first (best-effort, tolerates offline) and then
        // resolve the actual base ref to use.
        let base = args
            .base_branch
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .unwrap_or("main")
            .to_string();
        try_fetch_origin(&repo_path, &base);
        let base_ref = resolve_origin_base(&repo_path, &base)?;
        git(
            &repo_path,
            &[
                "worktree",
                "add",
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
    // Prefer `origin/<base>` so the diff reflects what GitHub will show on the
    // PR. The local copy of `<base>` is checked only as a fallback for repos
    // where `origin/<base>` doesn't exist (e.g. fresh clone without fetch).
    let candidates = [format!("origin/{user_base}"), user_base.clone()];
    let resolved = candidates
        .iter()
        .find_map(|cand| git(p, &["merge-base", "HEAD", cand]).ok())
        .map(|s| s.trim().to_string())
        .ok_or_else(|| WorktreeError::Git {
            message: format!("cannot resolve merge-base against origin/{user_base} or {user_base}"),
        })?;
    git(p, &["diff", &resolved])
}

#[derive(Debug, Serialize)]
pub struct ChangedFilesSummary {
    pub paths: Vec<String>,
    pub additions: u32,
    pub deletions: u32,
}

/// Distinct file paths that differ between the worktree (including uncommitted
/// + untracked) and the merge-base with the given base branch, plus aggregate
/// line +/- totals.
///
/// Stable across "before vs after push": pushing commits doesn't shrink the
/// count because we diff against the merge-base, not `HEAD`. Untracked files
/// contribute their line count to additions.
#[tauri::command]
pub fn worktree_changed_files(
    worktree_path: String,
    base: Option<String>,
) -> Result<ChangedFilesSummary, WorktreeError> {
    let p = Path::new(&worktree_path);
    if !p.exists() {
        return Err(WorktreeError::RepoNotFound(worktree_path));
    }
    let user_base = base.unwrap_or_else(|| "main".to_string());
    // `origin/<base>` first so the count matches what GitHub will show on the
    // PR (target = origin/main on the server). The local ref and master
    // variants are fallbacks for unusual setups. Must match the order in
    // `worktree_diff` above — otherwise the chip count and the dialog body
    // can resolve different merge-bases and disagree.
    let candidates = [
        format!("origin/{user_base}"),
        user_base.clone(),
        "origin/master".to_string(),
        "master".to_string(),
    ];
    let resolved = candidates
        .iter()
        .find_map(|cand| git(p, &["merge-base", "HEAD", cand]).ok())
        .map(|s| s.trim().to_string())
        .ok_or_else(|| WorktreeError::Git {
            message: format!("cannot resolve merge-base against origin/{user_base} or {user_base}"),
        })?;
    let numstat = git(p, &["diff", "--numstat", &resolved]).unwrap_or_default();
    let mut additions: u32 = 0;
    let mut deletions: u32 = 0;
    let mut set: std::collections::BTreeSet<String> = std::collections::BTreeSet::new();
    for line in numstat.lines() {
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
    }
    // Untracked files: contribute their content as additions.
    let untracked = git(p, &["ls-files", "--others", "--exclude-standard"]).unwrap_or_default();
    for line in untracked.lines() {
        let rel = line.trim();
        if rel.is_empty() {
            continue;
        }
        set.insert(rel.to_string());
        if let Ok(content) = std::fs::read_to_string(p.join(rel)) {
            additions = additions.saturating_add(content.lines().count() as u32);
        }
    }
    Ok(ChangedFilesSummary {
        paths: set.into_iter().collect(),
        additions,
        deletions,
    })
}

#[derive(Debug, Serialize)]
pub struct BranchCommit {
    pub sha: String,
    #[serde(rename = "shortSha")]
    pub short_sha: String,
    pub subject: String,
    pub author: String,
    pub timestamp: i64,
    pub pushed: bool,
    #[serde(rename = "parentSha")]
    pub parent_sha: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct WorktreeStatus {
    pub branch: Option<String>,
    pub head: Option<String>,
    #[serde(rename = "headSubject")]
    pub head_subject: Option<String>,
    pub ahead: u32,
    pub behind: u32,
    pub staged: u32,
    pub unstaged: u32,
    pub untracked: u32,
    /// Distinct file count from `git status --porcelain`. Use for chip counters;
    /// avoids double-counting files that appear both staged and unstaged.
    pub changed: u32,
    #[serde(rename = "hasUpstream")]
    pub has_upstream: bool,
}

const COMMIT_LIMIT: usize = 100;
const COMMIT_FORMAT: &str = "%H%x1f%h%x1f%s%x1f%an%x1f%at%x1f%P";

#[tauri::command]
pub fn worktree_commits(worktree_path: String) -> Result<Vec<BranchCommit>, WorktreeError> {
    let p = Path::new(&worktree_path);
    if !p.exists() {
        return Err(WorktreeError::RepoNotFound(worktree_path));
    }
    let upstream_ref = resolve_upstream(p);
    let unpushed = if let Some(ref upstream) = upstream_ref {
        rev_list_set(p, &format!("{upstream}..HEAD"))
    } else {
        rev_list_set(p, "HEAD")
            .into_iter()
            .take(COMMIT_LIMIT)
            .collect()
    };

    let branch_range = resolve_branch_range(p);
    let log_args: Vec<String> = vec![
        "log".to_string(),
        format!("-n{COMMIT_LIMIT}"),
        format!("--format={COMMIT_FORMAT}"),
        branch_range,
    ];
    let raw = git_strs(p, &log_args)?;
    let mut commits = Vec::new();
    for line in raw.lines() {
        if line.trim().is_empty() {
            continue;
        }
        let parts: Vec<&str> = line.split('\u{1f}').collect();
        if parts.len() < 6 {
            continue;
        }
        let sha = parts[0].to_string();
        let parents: Vec<&str> = parts[5].split_whitespace().collect();
        let parent_sha = parents.first().map(|s| s.to_string());
        let pushed = !unpushed.contains(&sha);
        let timestamp = parts[4].parse::<i64>().unwrap_or(0);
        commits.push(BranchCommit {
            sha,
            short_sha: parts[1].to_string(),
            subject: parts[2].to_string(),
            author: parts[3].to_string(),
            timestamp,
            pushed,
            parent_sha,
        });
    }
    Ok(commits)
}

#[tauri::command]
pub fn worktree_diff_commit(
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
    git(p, &["show", "--format=", trimmed])
}

#[tauri::command]
pub fn worktree_diff_working(
    worktree_path: String,
    scope: String,
) -> Result<String, WorktreeError> {
    let p = Path::new(&worktree_path);
    if !p.exists() {
        return Err(WorktreeError::RepoNotFound(worktree_path));
    }
    match scope.as_str() {
        "unstaged" => git(p, &["diff"]),
        "staged" => git(p, &["diff", "--cached"]),
        "all" => git(p, &["diff", "HEAD"]),
        other => Err(WorktreeError::Git {
            message: format!("unknown scope: {other} (expected unstaged|staged|all)"),
        }),
    }
}

#[tauri::command]
pub fn worktree_status(worktree_path: String) -> Result<WorktreeStatus, WorktreeError> {
    let p = Path::new(&worktree_path);
    if !p.exists() {
        return Err(WorktreeError::RepoNotFound(worktree_path));
    }
    let branch = git(p, &["symbolic-ref", "--quiet", "--short", "HEAD"])
        .ok()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty());
    let head = git(p, &["rev-parse", "HEAD"])
        .ok()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty());
    let head_subject = git(p, &["log", "-1", "--format=%s"])
        .ok()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty());
    let upstream = resolve_upstream(p);
    let (ahead, behind) = if let Some(ref u) = upstream {
        rev_list_left_right(p, u, "HEAD").unwrap_or((0, 0))
    } else {
        (0, 0)
    };
    let (staged, unstaged, untracked, changed) = parse_status_counts(p);
    Ok(WorktreeStatus {
        branch,
        head,
        head_subject,
        ahead,
        behind,
        staged,
        unstaged,
        untracked,
        changed,
        has_upstream: upstream.is_some(),
    })
}

/// Range argument for `git log` that lists only commits unique to the current
/// branch (i.e. since divergence from `main`). Falls back to `HEAD` when no
/// merge-base can be resolved — typical for a brand-new repo without `main`.
fn resolve_branch_range(cwd: &Path) -> String {
    for base in ["main", "origin/main"] {
        if let Ok(out) = git(cwd, &["merge-base", "HEAD", base]) {
            let sha = out.trim();
            if !sha.is_empty() {
                return format!("{sha}..HEAD");
            }
        }
    }
    "HEAD".to_string()
}

fn resolve_upstream(cwd: &Path) -> Option<String> {
    git(cwd, &["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"])
        .ok()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
}

fn rev_list_set(cwd: &Path, range: &str) -> std::collections::HashSet<String> {
    git(cwd, &["rev-list", range])
        .ok()
        .map(|s| s.lines().map(|l| l.trim().to_string()).filter(|l| !l.is_empty()).collect())
        .unwrap_or_default()
}

fn rev_list_left_right(cwd: &Path, left: &str, right: &str) -> Option<(u32, u32)> {
    let out = git(cwd, &["rev-list", "--left-right", "--count", &format!("{left}...{right}")]).ok()?;
    let parts: Vec<&str> = out.split_whitespace().collect();
    if parts.len() < 2 {
        return None;
    }
    let behind = parts[0].parse::<u32>().ok()?;
    let ahead = parts[1].parse::<u32>().ok()?;
    Some((ahead, behind))
}

fn parse_status_counts(cwd: &Path) -> (u32, u32, u32, u32) {
    let raw = match git(cwd, &["status", "--porcelain=v1"]) {
        Ok(s) => s,
        Err(_) => return (0, 0, 0, 0),
    };
    let mut staged = 0u32;
    let mut unstaged = 0u32;
    let mut untracked = 0u32;
    let mut changed = 0u32;
    for line in raw.lines() {
        let bytes = line.as_bytes();
        if bytes.len() < 2 {
            continue;
        }
        changed += 1;
        let x = bytes[0] as char;
        let y = bytes[1] as char;
        if x == '?' && y == '?' {
            untracked += 1;
            continue;
        }
        if x != ' ' && x != '?' {
            staged += 1;
        }
        if y != ' ' && y != '?' {
            unstaged += 1;
        }
    }
    (staged, unstaged, untracked, changed)
}

fn git_strs(cwd: &Path, args: &[String]) -> Result<String, WorktreeError> {
    let refs: Vec<&str> = args.iter().map(String::as_str).collect();
    git(cwd, &refs)
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
/// worktree directory created by Goodboy doesn't leak into git status. No-ops
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

/// Best-effort fetch of `origin/<base>`. Silently swallows errors so that
/// offline sessions or repos without an `origin` remote still let the user
/// create a worktree — they just fall back to whatever `origin/<base>` already
/// points at locally (or to the local branch as a last resort).
fn try_fetch_origin(repo_path: &Path, base: &str) {
    let _ = git(repo_path, &["fetch", "origin", base]);
}

/// Resolve the ref to cut a new branch from. Prefers `origin/<base>` so the
/// new branch never inherits commits that exist only on the local copy of the
/// base branch. Falls back to `origin/master` if base is "main" and only
/// `master` exists on the remote, then to the local branch as a last resort.
/// Errors only when none of those refs exist.
fn resolve_origin_base(repo_path: &Path, base: &str) -> Result<String, WorktreeError> {
    let mut candidates: Vec<String> = vec![format!("origin/{base}")];
    if base == "main" {
        candidates.push("origin/master".to_string());
    } else if base == "master" {
        candidates.push("origin/main".to_string());
    }
    candidates.push(base.to_string());
    if base == "main" {
        candidates.push("master".to_string());
    } else if base == "master" {
        candidates.push("main".to_string());
    }
    for cand in &candidates {
        if git(repo_path, &["rev-parse", "--verify", "--quiet", cand]).is_ok() {
            return Ok(cand.clone());
        }
    }
    Err(WorktreeError::Git {
        message: format!(
            "cannot find base ref: tried {}",
            candidates.join(", ")
        ),
    })
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
