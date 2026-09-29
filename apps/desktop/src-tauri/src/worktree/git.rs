use super::error::WorktreeError;
use crate::proc::git::Git;
use regex::Regex;
use std::path::Path;
use std::sync::OnceLock;

pub(crate) type RunGit<'a> = &'a mut dyn FnMut(&Path, &[&str]) -> Result<String, WorktreeError>;

pub(super) fn is_ancestor(cwd: &Path, ancestor: &str, descendant: &str) -> bool {
    ancestor == descendant
        || git(cwd, &["merge-base", "--is-ancestor", ancestor, descendant]).is_ok()
}

pub(super) fn commit_ref_exists(cwd: &Path, reference: &str) -> bool {
    git(
        cwd,
        &[
            "rev-parse",
            "--verify",
            "--quiet",
            &format!("{reference}^{{commit}}"),
        ],
    )
    .is_ok_and(|raw| !raw.trim().is_empty())
}

pub(super) fn commit_exists(cwd: &Path, sha: &str) -> bool {
    git(cwd, &["cat-file", "-e", &format!("{sha}^{{commit}}")]).is_ok()
}

pub(crate) fn resolve_commit(cwd: &Path, sha: &str) -> Result<String, WorktreeError> {
    let trimmed = sha.trim();
    if trimmed.is_empty() {
        return Err(WorktreeError::Git {
            message: "commit sha is empty".to_string(),
        });
    }
    let resolved = git(
        cwd,
        &[
            "rev-parse",
            "--verify",
            "--quiet",
            &format!("{trimmed}^{{commit}}"),
        ],
    )
    .map(|out| out.trim().to_string())
    .ok()
    .filter(|s| !s.is_empty());
    resolved.ok_or_else(|| WorktreeError::Git {
        message: format!("unknown commit: {trimmed}"),
    })
}

pub(super) fn short_of(sha: &str) -> String {
    sha.chars().take(7).collect()
}

pub(super) fn rev_list_set(cwd: &Path, range: &str) -> std::collections::HashSet<String> {
    git(cwd, &["rev-list", range])
        .ok()
        .map(|s| {
            s.lines()
                .map(|l| l.trim().to_string())
                .filter(|l| !l.is_empty())
                .collect()
        })
        .unwrap_or_default()
}

pub(super) fn git_strs(cwd: &Path, args: &[String]) -> Result<String, WorktreeError> {
    let refs: Vec<&str> = args.iter().map(String::as_str).collect();
    git(cwd, &refs)
}

static CREDENTIAL_IN_URL: OnceLock<Regex> = OnceLock::new();

pub(crate) fn redact_credentials(raw: &str) -> String {
    let pattern = CREDENTIAL_IN_URL.get_or_init(|| {
        Regex::new(r"([A-Za-z][A-Za-z0-9+.\-]*://)[^/@\s]+@").expect("credential pattern compiles")
    });
    pattern.replace_all(raw, "$1***@").into_owned()
}

pub(crate) fn git(cwd: &Path, args: &[&str]) -> Result<String, WorktreeError> {
    #[cfg(test)]
    git_argv_log::record(args);

    Ok(Git::new().cwd(cwd).args(args).batch_auth().stdout()?)
}

#[cfg(test)]
pub(crate) mod git_argv_log {
    use std::cell::RefCell;

    thread_local! {
        static RECORDED: RefCell<Vec<Vec<String>>> = const { RefCell::new(Vec::new()) };
    }

    pub(crate) fn record(args: &[&str]) {
        RECORDED.with(|log| {
            log.borrow_mut()
                .push(args.iter().map(|arg| (*arg).to_string()).collect())
        });
    }

    pub(crate) fn reset() {
        RECORDED.with(|log| log.borrow_mut().clear());
    }

    pub(crate) fn recorded() -> Vec<Vec<String>> {
        RECORDED.with(|log| log.borrow().clone())
    }
}

#[cfg(test)]
mod tests;
