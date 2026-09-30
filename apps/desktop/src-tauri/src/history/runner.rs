use super::commits::Author;
use crate::proc::git::Git;
use crate::worktree::WorktreeError;
use std::path::Path;
use std::sync::OnceLock;

const MERGE_TREE_BASE_MIN: (u32, u32) = (2, 40);

const BATCHED_REPLAY_MIN: (u32, u32) = (2, 45);

pub(super) struct GitRun {
    pub(super) status: i32,
    pub(super) stdout: String,
    pub(super) stderr: String,
}

pub(super) fn git_run(
    cwd: &Path,
    args: &[&str],
    author: Option<&Author>,
    input: Option<&str>,
) -> Result<GitRun, WorktreeError> {
    let mut git = Git::new().args(args).cwd(cwd);
    if let Some(author) = author {
        git = git
            .env("GIT_AUTHOR_NAME", &author.name)
            .env("GIT_AUTHOR_EMAIL", &author.email)
            .env("GIT_AUTHOR_DATE", &author.date);
    }
    if let Some(text) = input {
        git = git.input(text);
    }
    let output = git.output()?;
    if let Some(error) = output.input_error {
        return Err(error.into());
    }
    Ok(GitRun {
        status: output.status.code().unwrap_or(-1),
        stdout: output.stdout_lossy(),
        stderr: output.stderr_redacted(),
    })
}

fn parse_git_version(raw: &str) -> Option<(u32, u32)> {
    let version = raw.trim().strip_prefix("git version ")?;
    let mut parts = version.split(|c: char| !c.is_ascii_digit());
    let major = parts.next()?.parse::<u32>().ok()?;
    let minor = parts.next()?.parse::<u32>().ok()?;
    Some((major, minor))
}

fn git_version() -> Option<(u32, u32)> {
    static VERSION: OnceLock<Option<(u32, u32)>> = OnceLock::new();
    *VERSION.get_or_init(|| {
        let output = Git::new().arg("--version").output().ok()?;
        parse_git_version(&output.stdout_lossy())
    })
}

pub(crate) fn supports_merge_tree_base() -> bool {
    git_version().is_some_and(|version| version >= MERGE_TREE_BASE_MIN)
}

pub(super) fn supports_batched_replay() -> bool {
    git_version().is_some_and(|version| version >= BATCHED_REPLAY_MIN)
}

#[tauri::command]
pub fn history_git_supported() -> bool {
    supports_merge_tree_base()
}

#[cfg(test)]
mod tests;
