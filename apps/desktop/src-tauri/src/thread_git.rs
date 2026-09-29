use std::path::{Path, PathBuf};

use serde::Serialize;

use crate::branch_remote::{fetch_branch_ref, remote_of, tracking_sha};
use crate::worktree::{git, landed_equivalent, resolve_upstream, WorktreeError};

const FIELD_SEPARATOR: char = '\u{1f}';
const MAX_TOUCHING_COMMITS: usize = 5;
const MAX_SCANNED_COMMITS: usize = 30;

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct OriginFetch {
    pub fetched: bool,
    pub error: Option<String>,
    pub remote_head: Option<String>,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct FixOnOrigin {
    pub on_origin: bool,
    pub landed_as: Option<String>,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct OriginCommit {
    pub sha: String,
    pub author: String,
    pub email: String,
    pub subject: String,
    pub committed_at: i64,
}

fn existing_worktree(worktree_path: &str) -> Result<PathBuf, WorktreeError> {
    let path = PathBuf::from(worktree_path);
    if !path.exists() {
        return Err(WorktreeError::RepoNotFound(worktree_path.to_string()));
    }
    Ok(path)
}

fn remote_name(cwd: &Path) -> String {
    let configured = resolve_upstream(cwd);
    remote_of(configured.as_deref()).to_string()
}

fn origin_ref(cwd: &Path, branch: &str) -> String {
    format!("refs/remotes/{}/{branch}", remote_name(cwd))
}

pub(crate) fn fetch_origin_branch(cwd: &Path, branch: &str, token: Option<&str>) -> OriginFetch {
    let remote = remote_name(cwd);
    let error = fetch_branch_ref(cwd, &remote, branch, token);
    OriginFetch {
        fetched: error.is_none(),
        error,
        remote_head: tracking_sha(cwd, &format!("{remote}/{branch}")),
    }
}

pub(crate) fn fix_on_origin(
    cwd: &Path,
    branch: &str,
    sha: &str,
) -> Result<FixOnOrigin, WorktreeError> {
    let reference = origin_ref(cwd, branch);
    if git(cwd, &["rev-parse", "--verify", "--quiet", &reference]).is_err() {
        return Ok(FixOnOrigin {
            on_origin: false,
            landed_as: None,
        });
    }
    let known = git(cwd, &["cat-file", "-e", &format!("{sha}^{{commit}}")]).is_ok();
    if !known {
        return Ok(FixOnOrigin {
            on_origin: false,
            landed_as: None,
        });
    }
    let on_origin = git(cwd, &["merge-base", "--is-ancestor", sha, &reference]).is_ok();
    if on_origin {
        return Ok(FixOnOrigin {
            on_origin: true,
            landed_as: None,
        });
    }
    let parent = git(
        cwd,
        &["rev-parse", "--verify", "--quiet", &format!("{sha}^")],
    )
    .map(|raw| raw.trim().to_string())
    .unwrap_or_default();
    if parent.is_empty() {
        return Ok(FixOnOrigin {
            on_origin: false,
            landed_as: None,
        });
    }
    let landed_as = landed_equivalent(cwd, &parent, sha, &reference).unwrap_or(None);
    Ok(FixOnOrigin {
        on_origin: false,
        landed_as,
    })
}

fn parse_origin_commits(raw: &str) -> Vec<OriginCommit> {
    raw.lines()
        .filter_map(|line| {
            let mut fields = line.split(FIELD_SEPARATOR);
            let sha = fields.next()?.trim().to_string();
            let author = fields.next()?.to_string();
            let email = fields.next()?.to_string();
            let committed_at = fields.next()?.trim().parse::<i64>().ok()?;
            let subject = fields.next()?.to_string();
            if sha.len() < 40 {
                return None;
            }
            Some(OriginCommit {
                sha,
                author,
                email,
                subject,
                committed_at,
            })
        })
        .collect()
}

pub(crate) fn origin_commits_touching(
    cwd: &Path,
    branch: &str,
    path: &str,
    start_line: u32,
    end_line: u32,
    since_secs: i64,
) -> Vec<OriginCommit> {
    let reference = origin_ref(cwd, branch);
    let range = format!(
        "{},{}:{path}",
        start_line.max(1),
        end_line.max(start_line).max(1)
    );
    let format = format!(
        "--format=%H{sep}%an{sep}%ae{sep}%ct{sep}%s",
        sep = FIELD_SEPARATOR
    );
    let count = format!("--max-count={MAX_SCANNED_COMMITS}");
    let Ok(raw) = git(
        cwd,
        &[
            "log",
            "--no-merges",
            &count,
            &format,
            "-s",
            "-L",
            &range,
            &reference,
        ],
    ) else {
        return Vec::new();
    };
    parse_origin_commits(&raw)
        .into_iter()
        .filter(|commit| commit.committed_at >= since_secs)
        .take(MAX_TOUCHING_COMMITS)
        .collect()
}

#[tauri::command]
pub async fn worktree_fetch_origin_branch(
    worktree_path: String,
    branch: String,
    workspace_id: Option<String>,
    project_id: Option<String>,
) -> Result<OriginFetch, WorktreeError> {
    tauri::async_runtime::spawn_blocking(move || {
        let cwd = existing_worktree(&worktree_path)?;
        let branch = branch.trim().to_string();
        if branch.is_empty() {
            return Ok(OriginFetch {
                fetched: false,
                error: Some("the branch is unknown".to_string()),
                remote_head: None,
            });
        }
        let token = crate::github::read_token(workspace_id.as_deref(), project_id.as_deref());
        Ok(fetch_origin_branch(&cwd, &branch, token.as_deref()))
    })
    .await
    .map_err(|e| WorktreeError::Io(std::io::Error::other(e.to_string())))?
}

#[tauri::command]
pub async fn worktree_fix_on_origin(
    worktree_path: String,
    branch: String,
    sha: String,
) -> Result<FixOnOrigin, WorktreeError> {
    tauri::async_runtime::spawn_blocking(move || {
        let cwd = existing_worktree(&worktree_path)?;
        fix_on_origin(&cwd, branch.trim(), sha.trim())
    })
    .await
    .map_err(|e| WorktreeError::Io(std::io::Error::other(e.to_string())))?
}

#[tauri::command]
pub async fn worktree_origin_commits_touching(
    worktree_path: String,
    branch: String,
    path: String,
    start_line: u32,
    end_line: u32,
    since_secs: i64,
) -> Result<Vec<OriginCommit>, WorktreeError> {
    tauri::async_runtime::spawn_blocking(move || {
        let cwd = existing_worktree(&worktree_path)?;
        Ok(origin_commits_touching(
            &cwd,
            branch.trim(),
            path.trim(),
            start_line,
            end_line,
            since_secs,
        ))
    })
    .await
    .map_err(|e| WorktreeError::Io(std::io::Error::other(e.to_string())))?
}

#[cfg(test)]
mod tests {
    use super::{fix_on_origin, origin_commits_touching, parse_origin_commits};
    use crate::worktree::git;
    use std::path::{Path, PathBuf};

    fn temp_root(name: &str) -> PathBuf {
        let root = std::env::temp_dir().join(format!(
            "goodboy-thread-git-{name}-{}-{}",
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

    fn with_origin(root: &Path) -> PathBuf {
        let remote = root.join("remote.git");
        git_ok(root, &["init", "--bare", remote.to_str().unwrap()]);
        git_ok(root, &["remote", "add", "origin", remote.to_str().unwrap()]);
        git_ok(root, &["push", "-u", "origin", "main"]);
        remote
    }

    #[test]
    fn a_fix_pushed_by_hand_is_on_origin() {
        let root = init_repo("on-origin");
        commit(&root, "a.txt", "one\n", "base");
        with_origin(&root);
        let fix = commit(&root, "a.txt", "two\n", "fix");
        assert!(!fix_on_origin(&root, "main", &fix).unwrap().on_origin);
        git_ok(&root, &["push", "origin", "main"]);
        let seen = fix_on_origin(&root, "main", &fix).unwrap();
        assert!(seen.on_origin);
        assert_eq!(seen.landed_as, None);
    }

    #[test]
    fn the_same_patch_under_another_sha_is_reported_as_landed() {
        let root = init_repo("landed");
        commit(&root, "a.txt", "one\n", "base");
        with_origin(&root);
        git_ok(&root, &["checkout", "-b", "fix"]);
        let fix = commit(&root, "a.txt", "two\n", "fix");
        git_ok(&root, &["checkout", "main"]);
        commit(&root, "b.txt", "other\n", "unrelated");
        git_ok(&root, &["cherry-pick", &fix]);
        let landed = git_ok(&root, &["rev-parse", "HEAD"]);
        git_ok(&root, &["push", "origin", "main"]);
        let seen = fix_on_origin(&root, "main", &fix).unwrap();
        assert!(!seen.on_origin);
        assert_eq!(seen.landed_as, Some(landed));
    }

    #[test]
    fn a_commit_that_changes_the_commented_lines_is_listed() {
        let root = init_repo("touching");
        commit(&root, "m.txt", "a\nb\nc\nd\ne\n", "base");
        with_origin(&root);
        let far = commit(&root, "m.txt", "a\nb\nc\nd\nE\n", "far edit");
        let near = commit(&root, "m.txt", "a\nB\nc\nd\nE\n", "near edit");
        git_ok(&root, &["push", "origin", "main"]);
        let found = origin_commits_touching(&root, "main", "m.txt", 2, 3, 0);
        let shas: Vec<&str> = found.iter().map(|commit| commit.sha.as_str()).collect();
        assert!(shas.contains(&near.as_str()));
        assert!(!shas.contains(&far.as_str()));
        assert_eq!(found[0].author, "test");
    }

    #[test]
    fn a_missing_file_yields_no_commits() {
        let root = init_repo("no-file");
        commit(&root, "m.txt", "a\n", "base");
        with_origin(&root);
        assert!(origin_commits_touching(&root, "main", "gone.txt", 1, 2, 0).is_empty());
    }

    #[test]
    fn parses_the_separated_log_lines() {
        let sha = "a".repeat(40);
        let raw = format!("{sha}\u{1f}Theo Varga\u{1f}t@x.dev\u{1f}1790668742\u{1f}fix | it\n");
        let parsed = parse_origin_commits(&raw);
        assert_eq!(parsed.len(), 1);
        assert_eq!(parsed[0].subject, "fix | it");
        assert_eq!(parsed[0].committed_at, 1790668742);
    }
}
