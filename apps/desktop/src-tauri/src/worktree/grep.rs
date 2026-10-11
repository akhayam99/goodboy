use super::error::WorktreeError;
use crate::proc::git::{Git, GitError};
use std::path::Path;
use std::time::Duration;

const MAX_MATCHES: usize = 300;
const MAX_TEXT_CHARS: usize = 240;
const MAX_WORD_CHARS: usize = 128;
const DEADLINE: Duration = Duration::from_secs(3);

#[derive(Debug, serde::Serialize, PartialEq)]
pub struct GrepMatch {
    path: String,
    line: u32,
    column: u32,
    text: String,
}

#[derive(Debug, serde::Serialize, PartialEq)]
pub struct GrepResult {
    matches: Vec<GrepMatch>,
    truncated: bool,
}

#[tauri::command]
pub async fn worktree_grep_word(
    worktree_path: String,
    word: String,
) -> Result<GrepResult, WorktreeError> {
    tauri::async_runtime::spawn_blocking(move || {
        grep_word(Git::new(), Path::new(&worktree_path), &word, DEADLINE)
    })
    .await
    .map_err(|error| WorktreeError::Io(std::io::Error::other(error.to_string())))?
}

fn is_identifier(word: &str) -> bool {
    let mut chars = word.chars();
    let Some(first) = chars.next() else {
        return false;
    };
    let count = word.chars().count();
    if !(2..=MAX_WORD_CHARS).contains(&count) {
        return false;
    }
    if !(first.is_ascii_alphabetic() || first == '_' || first == '$') {
        return false;
    }
    chars.all(|part| part.is_ascii_alphanumeric() || part == '_' || part == '$')
}

fn grep_word(
    git: Git,
    root: &Path,
    word: &str,
    deadline: Duration,
) -> Result<GrepResult, WorktreeError> {
    if !is_identifier(word) {
        return Err(WorktreeError::Git {
            message: "search word is not an identifier".into(),
        });
    }
    let output = git
        .cwd(root)
        .args([
            "grep",
            "-n",
            "--column",
            "-z",
            "-w",
            "-I",
            "-F",
            "--untracked",
            "-e",
            word,
            "--",
        ])
        .timeout(deadline)
        .output()
        .map_err(|error| match error {
            GitError::Timeout { .. } => WorktreeError::Git {
                message: "the search took too long".into(),
            },
            other => other.into(),
        })?;
    match output.status.code() {
        Some(0) => {}
        Some(1) => {
            return Ok(GrepResult {
                matches: Vec::new(),
                truncated: false,
            })
        }
        _ => {
            return Err(WorktreeError::Git {
                message: format!("git grep failed: {}", output.stderr_redacted().trim()),
            })
        }
    }
    Ok(parse(&output.stdout_lossy()))
}

fn parse(raw: &str) -> GrepResult {
    let mut matches = Vec::new();
    let mut truncated = false;
    for row in raw.lines() {
        if matches.len() >= MAX_MATCHES {
            truncated = true;
            break;
        }
        if let Some(found) = parse_row(row) {
            matches.push(found);
        }
    }
    GrepResult { matches, truncated }
}

fn parse_row(row: &str) -> Option<GrepMatch> {
    let mut parts = row.splitn(4, '\0');
    let path = parts.next()?;
    let line = parts.next()?.parse::<u32>().ok()?;
    let column = parts.next()?.parse::<usize>().ok()?;
    let text = parts.next()?;
    let trimmed = text.trim_start();
    let removed = text.len() - trimmed.len();
    let byte_offset = column.saturating_sub(1).saturating_sub(removed);
    let char_column = trimmed
        .get(..byte_offset)
        .map_or(0, |head| head.chars().count())
        + 1;
    Some(GrepMatch {
        path: path.to_string(),
        line,
        column: char_column as u32,
        text: trimmed.trim_end().chars().take(MAX_TEXT_CHARS).collect(),
    })
}

#[cfg(test)]
mod tests;
