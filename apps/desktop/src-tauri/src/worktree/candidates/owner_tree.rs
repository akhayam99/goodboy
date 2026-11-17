use crate::proc::git::Git;
use crate::worktree::error::WorktreeError;
use crate::worktree::git::{git, is_ancestor, resolve_commit, short_of};
use std::path::Path;

pub(crate) const OWNER_TREE_SUBJECT: &str = "goodboy: your working tree before the fix";

const SNAPSHOT_NAME: &str = "Goodboy";
const SNAPSHOT_EMAIL: &str = "goodboy@localhost";
const APPLYING: &str = "applying-to-working-tree";
const APPLIED: &str = "applied-to-working-tree";

fn git_failure(error: impl ToString) -> WorktreeError {
    WorktreeError::Git {
        message: error.to_string(),
    }
}

fn with_index(cwd: &Path, index: &Path, args: &[&str]) -> Result<String, WorktreeError> {
    Git::new()
        .cwd(cwd)
        .index_file(index)
        .args(args)
        .stdout()
        .map_err(git_failure)
}

fn write_tree_of_working_tree(
    cwd: &Path,
    head: &str,
    index: &Path,
) -> Result<String, WorktreeError> {
    let git_dir = git(cwd, &["rev-parse", "--absolute-git-dir"])?;
    let own_index = Path::new(git_dir.trim()).join("index");
    if own_index.is_file() {
        std::fs::copy(&own_index, index)?;
    }
    if !index.is_file() {
        with_index(cwd, index, &["read-tree", head])?;
    }
    with_index(cwd, index, &["add", "--all", "--", "."])?;
    Ok(with_index(cwd, index, &["write-tree"])?.trim().to_string())
}

pub(crate) fn snapshot_owner_tree(cwd: &Path, head: &str) -> Result<Option<String>, WorktreeError> {
    let git_dir = git(cwd, &["rev-parse", "--absolute-git-dir"])?;
    let index = Path::new(git_dir.trim()).join(format!(
        "goodboy-owner-tree-{}-{}.index",
        std::process::id(),
        short_of(head)
    ));
    let tree = write_tree_of_working_tree(cwd, head, &index);
    crate::logging::note_failure("owner tree index delete", std::fs::remove_file(&index));
    let tree = tree?;
    let head_tree = git(cwd, &["rev-parse", &format!("{head}^{{tree}}")])?;
    if tree == head_tree.trim() {
        return Ok(None);
    }
    let created = Git::new()
        .cwd(cwd)
        .args(["commit-tree", &tree, "-p", head])
        .env("GIT_AUTHOR_NAME", SNAPSHOT_NAME)
        .env("GIT_AUTHOR_EMAIL", SNAPSHOT_EMAIL)
        .env("GIT_COMMITTER_NAME", SNAPSHOT_NAME)
        .env("GIT_COMMITTER_EMAIL", SNAPSHOT_EMAIL)
        .input(OWNER_TREE_SUBJECT.as_bytes().to_vec())
        .stdout()
        .map_err(git_failure)?;
    Ok(Some(created.trim().to_string()))
}

pub(super) fn owner_tree_under(cwd: &Path, actual: &str, candidate: &str) -> Option<String> {
    let found = git(
        cwd,
        &[
            "rev-list",
            "--max-count=1",
            "--fixed-strings",
            &format!("--grep={OWNER_TREE_SUBJECT}"),
            &format!("{actual}..{candidate}"),
        ],
    )
    .ok()?;
    let sha = found.trim();
    (!sha.is_empty()).then(|| sha.to_string())
}

fn journal_state(journal: &Path, candidate: &str) -> Result<Option<String>, WorktreeError> {
    if !journal.exists() {
        return Ok(None);
    }
    let recorded = std::fs::read_to_string(journal)?;
    let mut lines = recorded.lines().map(str::trim);
    if lines.next() != Some(candidate) {
        return Err(git_failure(
            "the integration journal holds a different commit for this candidate",
        ));
    }
    Ok(lines.next().map(str::to_string))
}

fn write_state(journal: &Path, candidate: &str, state: &str) -> Result<(), WorktreeError> {
    let dir = journal
        .parent()
        .ok_or_else(|| git_failure("the integration journal has no parent directory"))?;
    std::fs::create_dir_all(dir)?;
    let pending = journal.with_extension("pending");
    std::fs::write(&pending, format!("{candidate}\n{state}\n"))?;
    std::fs::rename(&pending, journal)?;
    Ok(())
}

fn apply_patch(cwd: &Path, patch: &str, is_reverse: bool) -> Result<(), WorktreeError> {
    let mut args = vec!["apply", "--whitespace=nowarn"];
    if is_reverse {
        args.extend(["--reverse", "--check"]);
    }
    args.push("-");
    Git::new()
        .cwd(cwd)
        .args(args)
        .input(patch.as_bytes().to_vec())
        .stdout()
        .map(|_| ())
        .map_err(git_failure)
}

pub(super) struct OwnerTreeIntegration<'a> {
    pub(super) path: &'a Path,
    pub(super) journal: &'a Path,
    pub(super) snapshot: &'a str,
    pub(super) expected: &'a str,
    pub(super) candidate: &'a str,
    pub(super) actual: &'a str,
}

pub(super) fn integrate_onto_owner_tree(
    plan: OwnerTreeIntegration<'_>,
) -> Result<String, WorktreeError> {
    let OwnerTreeIntegration {
        path,
        journal,
        snapshot,
        expected,
        candidate,
        actual,
    } = plan;
    let state = journal_state(journal, candidate)?;
    if state.as_deref() == Some(APPLIED) {
        return Ok(candidate.to_string());
    }
    if !is_ancestor(path, expected, candidate) {
        return Err(git_failure(
            "the candidate is not based on the expected branch head",
        ));
    }
    let parent = resolve_commit(path, &format!("{snapshot}^"))?;
    if !is_ancestor(path, &parent, actual) {
        return Err(git_failure(format!(
            "the branch moved: expected head {}, found {}",
            short_of(&parent),
            short_of(actual)
        )));
    }
    let patch = git(
        path,
        &["diff", "--binary", "--no-renames", expected, candidate],
    )?;
    if patch.trim().is_empty() {
        write_state(journal, candidate, APPLIED)?;
        return Ok(candidate.to_string());
    }
    if state.as_deref() == Some(APPLYING) && apply_patch(path, &patch, true).is_ok() {
        write_state(journal, candidate, APPLIED)?;
        return Ok(candidate.to_string());
    }
    write_state(journal, candidate, APPLYING)?;
    if apply_patch(path, &patch, false).is_err() {
        crate::logging::note_failure("owner tree journal delete", std::fs::remove_file(journal));
        return Err(git_failure("the fix no longer applies on the branch"));
    }
    write_state(journal, candidate, APPLIED)?;
    Ok(candidate.to_string())
}

#[cfg(test)]
mod tests;
