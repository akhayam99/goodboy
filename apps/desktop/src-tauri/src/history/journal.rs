use super::commits::rev_parse_all;
use super::runner::git_run;
use crate::worktree::{git, git_dir_of, WorktreeError};
use std::path::{Path, PathBuf};

const JOURNAL_FILE: &str = "goodboy-history.journal";

pub(super) fn journal_of(cwd: &Path) -> Option<PathBuf> {
    git_dir_of(cwd).map(|dir| dir.join(JOURNAL_FILE))
}

fn matches_tree(cwd: &Path, commit: &str) -> bool {
    let index = git_run(cwd, &["diff", "--cached", "--quiet", commit], None, None);
    let files = git_run(cwd, &["diff", "--quiet", commit], None, None);
    index.is_ok_and(|run| run.status == 0) && files.is_ok_and(|run| run.status == 0)
}

pub(super) fn branch_ref(branch: &str) -> String {
    format!("refs/heads/{branch}")
}

pub(super) fn is_on_branch(cwd: &Path, branch: &str) -> bool {
    git(cwd, &["symbolic-ref", "-q", "HEAD"]).is_ok_and(|raw| raw.trim() == branch_ref(branch))
}

pub(super) fn branch_tip(cwd: &Path, branch: &str) -> Option<String> {
    rev_parse_all(cwd, &[format!("{}^{{commit}}", branch_ref(branch))])?
        .into_iter()
        .next()
}

pub(super) fn is_consistent(cwd: &Path) -> bool {
    matches_tree(cwd, "HEAD")
}

fn pending_notice(journal: &Path, detail: &str) -> String {
    format!(
        "An earlier rewrite here was interrupted and {detail} Goodboy changes nothing until it is settled: check git status, then delete {} to go on.",
        journal.display()
    )
}

pub(crate) fn recover_journal(cwd: &Path) -> Result<Option<String>, WorktreeError> {
    let Some(journal) = journal_of(cwd) else {
        return Ok(None);
    };
    if !journal.exists() {
        return Ok(None);
    }
    let recorded = std::fs::read_to_string(&journal)?;
    let lines: Vec<&str> = recorded.lines().map(str::trim).collect();
    let [old, new, _backup, branch, ..] = lines.as_slice() else {
        return Ok(Some(pending_notice(
            &journal,
            "it was written by an older Goodboy that did not record its branch, so it will not be guessed.",
        )));
    };
    let (old, new, branch) = (old.to_string(), new.to_string(), branch.to_string());
    if branch.is_empty() {
        return Ok(Some(pending_notice(
            &journal,
            "it does not name its branch.",
        )));
    }
    let is_ours = is_on_branch(cwd, &branch) && old != new;
    let tip = branch_tip(cwd, &branch);
    if is_ours && tip.as_deref() == Some(old.as_str()) && matches_tree(cwd, &new) {
        let finished = git_run(
            cwd,
            &[
                "update-ref",
                "-m",
                "goodboy: finish rewrite",
                &branch_ref(&branch),
                &new,
                &old,
            ],
            None,
            None,
        )?;
        if finished.status == 0 && is_consistent(cwd) {
            std::fs::remove_file(&journal)?;
            return Ok(None);
        }
        return Ok(Some(pending_notice(
            &journal,
            &format!("finishing it failed: {}", finished.stderr.trim()),
        )));
    }
    if is_ours && tip.as_deref() == Some(new.as_str()) && matches_tree(cwd, &old) {
        let finished = git_run(cwd, &["read-tree", "-m", "-u", &old, &new], None, None)?;
        if finished.status == 0 && is_consistent(cwd) {
            std::fs::remove_file(&journal)?;
            return Ok(None);
        }
        return Ok(Some(pending_notice(
            &journal,
            &format!("finishing it failed: {}", finished.stderr.trim()),
        )));
    }
    if is_consistent(cwd) {
        std::fs::remove_file(&journal)?;
        return Ok(None);
    }
    if !is_on_branch(cwd, &branch) {
        return Ok(Some(pending_notice(
            &journal,
            &format!("belongs to {branch}, which is not checked out here."),
        )));
    }
    Ok(Some(pending_notice(
        &journal,
        "the branch and the files no longer match either side of it.",
    )))
}
