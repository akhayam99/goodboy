use super::backups::is_backup_of;
use super::commits::rev_parse_all;
use super::dirty::{find_stash, object_exists, stash_matches};
use super::plan::plan_error;
use super::runner::git_run;
use crate::worktree::{git, git_dir_of, WorktreeError};
use std::io::Write;
use std::path::{Path, PathBuf};

const JOURNAL_FILE: &str = "goodboy-history.journal";

pub(super) fn journal_of(cwd: &Path) -> Option<PathBuf> {
    git_dir_of(cwd).map(|dir| dir.join(JOURNAL_FILE))
}

pub(super) fn matches_tree(cwd: &Path, commit: &str) -> bool {
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

pub(super) fn write_journal(journal: &Path, text: &str) -> Result<(), WorktreeError> {
    let pending = journal.with_extension(format!("pending-{}", super::backups::now_nanos()));
    let mut file = std::fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&pending)?;
    file.write_all(text.as_bytes())?;
    file.sync_all()?;
    #[cfg(test)]
    BEFORE_JOURNAL_RENAME.with(|should_stop| {
        if should_stop.replace(false) {
            panic!("simulated crash before journal rename");
        }
    });
    std::fs::rename(&pending, journal)?;
    let parent = journal
        .parent()
        .ok_or_else(|| plan_error("the journal has no directory"))?;
    sync_directory(parent)?;
    Ok(())
}

fn sync_directory(path: &Path) -> Result<(), WorktreeError> {
    if cfg!(unix) {
        std::fs::File::open(path)?.sync_all()?;
    }
    Ok(())
}

pub(crate) fn recover_journal(cwd: &Path) -> Result<Option<String>, WorktreeError> {
    let Some(journal) = journal_of(cwd) else {
        return Ok(None);
    };
    if !journal.exists() {
        return Ok(None);
    }
    settle_unsaved_intent(cwd)?;
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
    if let Some((stash, _)) = pending_stash(cwd)? {
        return Ok(Some(format!(
            "Your files from the last rebase are still set aside. Stash {stash}."
        )));
    }
    if lines.get(6) == Some(&"restored") {
        std::fs::remove_file(&journal)?;
        return Ok(None);
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

pub(super) fn pending_stash(cwd: &Path) -> Result<Option<(String, String)>, WorktreeError> {
    let Some(journal) = journal_of(cwd).filter(|path| path.exists()) else {
        return Ok(None);
    };
    let raw = std::fs::read_to_string(journal)?;
    let lines: Vec<&str> = raw.lines().collect();
    if lines.get(6) == Some(&"restored") {
        return Ok(None);
    }
    let Some(line) = lines.get(4) else {
        return Ok(None);
    };
    let message = lines
        .get(5)
        .ok_or_else(|| plan_error("the stash journal is incomplete; nothing was changed"))?;
    let branch = lines
        .get(3)
        .ok_or_else(|| plan_error("the stash journal has no branch"))?;
    if !message.starts_with(&format!("On {branch}: goodboy: rebase {branch} ")) {
        return Err(plan_error(
            "the stash journal does not identify this rebase",
        ));
    }
    if *line == "stash pending" {
        let expected = lines.first().copied().unwrap_or_default();
        return Ok(find_stash(cwd, message, expected)?.map(|sha| (sha, message.to_string())));
    }
    let sha = line
        .strip_prefix("stash ")
        .ok_or_else(|| plan_error("the stash journal is invalid"))?;
    if !sha.bytes().all(|byte| byte.is_ascii_hexdigit()) || ![40, 64].contains(&sha.len()) {
        return Err(plan_error("the stash journal has an invalid commit"));
    }
    if !object_exists(cwd, sha) {
        return Ok(Some((sha.to_string(), message.to_string())));
    }
    if stash_matches(
        cwd,
        sha,
        message,
        lines.first().copied().unwrap_or_default(),
    )? {
        return Ok(Some((sha.to_string(), message.to_string())));
    }
    Err(plan_error(&format!("Your files were saved in stash {sha}, but its entry is gone. Check it in the terminal before continuing.")))
}

pub(super) fn set_phase(journal: &Path, phase: Option<&str>) -> Result<(), WorktreeError> {
    let raw = std::fs::read_to_string(journal)?;
    let mut kept: Vec<&str> = raw.lines().take(6).collect();
    if let Some(phase) = phase {
        kept.push(phase);
    }
    write_journal(journal, &format!("{}\n", kept.join("\n")))
}

pub(super) struct Intent<'a> {
    pub old: &'a str,
    pub new: &'a str,
    pub backup: &'a str,
    pub branch: &'a str,
}

pub(super) fn roll_back_intent(
    cwd: &Path,
    journal: &Path,
    intent: &Intent,
) -> Result<(), WorktreeError> {
    if is_backup_of(intent.branch, intent.backup) {
        let _ = git_run(
            cwd,
            &["update-ref", "-d", intent.backup, intent.old],
            None,
            None,
        );
    }
    if is_on_branch(cwd, intent.branch)
        && branch_tip(cwd, intent.branch).as_deref() == Some(intent.old)
    {
        std::fs::remove_file(journal)?;
        return Ok(());
    }
    write_journal(
        journal,
        &format!(
            "{}\n{}\n{}\n{}\n",
            intent.old, intent.new, intent.backup, intent.branch
        ),
    )
}

fn settle_unsaved_intent(cwd: &Path) -> Result<(), WorktreeError> {
    let Some(journal) = journal_of(cwd).filter(|path| path.exists()) else {
        return Ok(());
    };
    let raw = std::fs::read_to_string(&journal)?;
    let lines: Vec<&str> = raw.lines().collect();
    if lines.get(4) != Some(&"stash pending") || lines.len() > 6 {
        return Ok(());
    }
    let (Some(old), Some(new), Some(backup), Some(branch), Some(message)) = (
        lines.first(),
        lines.get(1),
        lines.get(2),
        lines.get(3),
        lines.get(5),
    ) else {
        return Ok(());
    };
    if find_stash(cwd, message, old)?.is_some() {
        return Ok(());
    }
    roll_back_intent(
        cwd,
        &journal,
        &Intent {
            old,
            new,
            backup,
            branch,
        },
    )
}

#[cfg(test)]
thread_local! {
    pub(super) static BEFORE_JOURNAL_RENAME: std::cell::Cell<bool> = const { std::cell::Cell::new(false) };
}

#[cfg(test)]
mod tests;
