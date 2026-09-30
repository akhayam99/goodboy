use super::plan::{plan_error, short};
use super::runner::git_run;
use crate::worktree::{git, WorktreeError};
use std::collections::HashMap;
use std::path::Path;

#[derive(Debug, Clone)]
pub(super) struct CommitInfo {
    pub(super) parents: Vec<String>,
    pub(super) author_name: String,
    pub(super) author_email: String,
    pub(super) author_date: String,
    pub(super) message: String,
}

#[derive(Debug, Clone)]
pub(super) struct Author {
    pub(super) name: String,
    pub(super) email: String,
    pub(super) date: String,
}

impl CommitInfo {
    pub(super) fn author(&self) -> Author {
        Author {
            name: self.author_name.clone(),
            email: self.author_email.clone(),
            date: self.author_date.clone(),
        }
    }
}

fn read_commit(cwd: &Path, sha: &str) -> Result<CommitInfo, WorktreeError> {
    let raw = git(
        cwd,
        &[
            "show",
            "-s",
            "--date=raw",
            "--format=%P%x1f%an%x1f%ae%x1f%ad%x1f%B",
            sha,
        ],
    )?;
    Ok(parse_commit(&raw))
}

pub(super) fn read_commits(
    cwd: &Path,
    shas: &[String],
) -> Result<HashMap<String, CommitInfo>, WorktreeError> {
    if shas.is_empty() {
        return Ok(HashMap::new());
    }
    let mut args = vec![
        "show".to_string(),
        "-s".to_string(),
        "--date=raw".to_string(),
        "--format=%H%x1f%P%x1f%an%x1f%ae%x1f%ad%x1f%B%x1e".to_string(),
    ];
    args.extend(shas.iter().cloned());
    let refs: Vec<&str> = args.iter().map(String::as_str).collect();
    let raw = git(cwd, &refs)?;
    Ok(raw
        .split('\u{1e}')
        .filter_map(|record| {
            let record = record.trim_start_matches('\n');
            let (sha, rest) = record.split_once('\u{1f}')?;
            Some((sha.trim().to_string(), parse_commit(rest)))
        })
        .collect())
}

fn parse_commit(raw: &str) -> CommitInfo {
    let mut parts = raw.splitn(5, '\u{1f}');
    let parents = parts
        .next()
        .unwrap_or_default()
        .split_whitespace()
        .map(str::to_string)
        .collect();
    let author_name = parts.next().unwrap_or_default().to_string();
    let author_email = parts.next().unwrap_or_default().to_string();
    let author_date = parts.next().unwrap_or_default().to_string();
    let message = parts.next().unwrap_or_default().trim_end().to_string();
    CommitInfo {
        parents,
        author_name,
        author_email,
        author_date,
        message,
    }
}

pub(super) fn tree_of(cwd: &Path, sha: &str) -> Result<String, WorktreeError> {
    Ok(git(cwd, &["rev-parse", &format!("{sha}^{{tree}}")])?
        .trim()
        .to_string())
}

pub(super) fn changed_files(cwd: &Path, from: &str, to: &str) -> Vec<String> {
    git(cwd, &["diff", "--name-only", from, to])
        .map(|raw| {
            raw.lines()
                .map(str::trim)
                .filter(|line| !line.is_empty())
                .map(str::to_string)
                .collect()
        })
        .unwrap_or_default()
}

pub(super) fn rev_parse_all(cwd: &Path, revs: &[String]) -> Option<Vec<String>> {
    let args: Vec<&str> = std::iter::once("rev-parse")
        .chain(revs.iter().map(String::as_str))
        .collect();
    let raw = git(cwd, &args).ok()?;
    let resolved: Vec<String> = raw
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .map(str::to_string)
        .collect();
    (resolved.len() == revs.len()).then_some(resolved)
}

pub(super) fn single_parent(cwd: &Path, sha: &str) -> Result<CommitInfo, WorktreeError> {
    one_parent(sha, read_commit(cwd, sha)?)
}

pub(super) fn one_parent(sha: &str, info: CommitInfo) -> Result<CommitInfo, WorktreeError> {
    if info.parents.len() != 1 {
        return Err(plan_error(&format!(
            "{} is a merge commit: Rewrite history only replays commits with one parent",
            short(sha)
        )));
    }
    Ok(info)
}

pub(super) fn is_ancestor(cwd: &Path, older: &str, newer: &str) -> bool {
    git_run(
        cwd,
        &["merge-base", "--is-ancestor", older, newer],
        None,
        None,
    )
    .is_ok_and(|run| run.status == 0)
}
