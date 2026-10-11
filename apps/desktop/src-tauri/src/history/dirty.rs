use super::journal::sync_directory;
use super::plan::plan_error;
use super::runner::git_run;
use crate::worktree::{git, resolve_commit, WorktreeError};
use std::collections::BTreeSet;
use std::io::Write;
use std::path::{Path, PathBuf};

pub(super) fn paths(raw: &str) -> Vec<String> {
    raw.split('\0')
        .filter(|path| !path.is_empty())
        .map(str::to_string)
        .collect()
}

pub(super) fn parse_dirty(raw: &str) -> Result<Vec<String>, WorktreeError> {
    let mut records = raw.split('\0').filter(|record| !record.is_empty());
    let mut files = BTreeSet::new();
    while let Some(record) = records.next() {
        if record.len() < 4
            || !record.as_bytes()[..2].iter().all(u8::is_ascii)
            || record.as_bytes()[2] != b' '
        {
            return Err(plan_error("couldn't read the changed files safely"));
        }
        files.insert(record[3..].to_string());
        if record[..2].contains(['R', 'C']) {
            let source = records
                .next()
                .ok_or_else(|| plan_error("a renamed file has no source path"))?;
            files.insert(source.to_string());
        }
    }
    Ok(files.into_iter().collect())
}

pub(super) fn dirty_files(cwd: &Path) -> Result<Vec<String>, WorktreeError> {
    let run = git_run(
        cwd,
        &["status", "--porcelain=v1", "-z", "--untracked-files=all"],
        None,
        None,
    )?;
    if run.status != 0 || run.stdout.contains('\u{fffd}') {
        return Err(plan_error("couldn't read the changed files safely"));
    }
    parse_dirty(&run.stdout)
}

pub(super) fn touched_files(
    cwd: &Path,
    expected: &str,
    target: &str,
) -> Result<Vec<String>, WorktreeError> {
    let run = git_run(
        cwd,
        &[
            "diff",
            "--no-renames",
            "--name-only",
            "-z",
            expected,
            target,
            "--",
        ],
        None,
        None,
    )?;
    if run.status != 0 || run.stdout.contains('\u{fffd}') {
        return Err(plan_error("couldn't read the rewritten files safely"));
    }
    Ok(paths(&run.stdout))
}

pub(super) fn overlap(dirty: &[String], touched: &[String]) -> Vec<String> {
    dirty
        .iter()
        .filter(|file| {
            touched.iter().any(|target| {
                *file == target
                    || file.starts_with(&format!("{target}/"))
                    || target.starts_with(&format!("{file}/"))
            })
        })
        .cloned()
        .collect()
}

pub(super) fn overlap_for_repo(
    cwd: &Path,
    dirty: &[String],
    touched: &[String],
) -> Result<Vec<String>, WorktreeError> {
    let mode = git_run(cwd, &["config", "--bool", "core.ignorecase"], None, None)?;
    if ![0, 1].contains(&mode.status) {
        return Err(plan_error("couldn't check path case sensitivity safely"));
    }
    if mode.stdout.trim() != "true" {
        return Ok(overlap(dirty, touched));
    }
    let compared_dirty: Vec<String> = dirty.iter().map(|path| path.to_lowercase()).collect();
    let compared_touched: Vec<String> = touched.iter().map(|path| path.to_lowercase()).collect();
    let matching = overlap(&compared_dirty, &compared_touched);
    Ok(dirty
        .iter()
        .filter(|path| matching.contains(&path.to_lowercase()))
        .cloned()
        .collect())
}

pub(super) fn stash_message(cwd: &Path, sha: &str) -> Result<String, WorktreeError> {
    Ok(git(cwd, &["show", "-s", "--format=%s", sha, "--"])?
        .trim()
        .to_string())
}

pub(super) fn stash_entries(cwd: &Path) -> Result<Vec<String>, WorktreeError> {
    Ok(git(cwd, &["stash", "list", "--format=%H"])?
        .lines()
        .map(str::to_string)
        .collect())
}

pub(super) fn own_stash(cwd: &Path, sha: &str, message: &str) -> Result<bool, WorktreeError> {
    Ok(stash_entries(cwd)?.iter().any(|entry| entry == sha) && stash_message(cwd, sha)? == message)
}

pub(super) fn stash_matches(
    cwd: &Path,
    sha: &str,
    message: &str,
    expected: &str,
) -> Result<bool, WorktreeError> {
    if stash_message(cwd, sha)? != message {
        return Ok(false);
    }
    let parents = git(cwd, &["rev-list", "--parents", "-n", "1", sha])?;
    let fields: Vec<&str> = parents.split_whitespace().collect();
    if ![3, 4].contains(&fields.len()) || fields.get(1) != Some(&expected) {
        return Ok(false);
    }
    Ok(resolve_commit(cwd, &format!("{sha}^2^1"))? == expected)
}

pub(super) fn find_stash(
    cwd: &Path,
    message: &str,
    expected: &str,
) -> Result<Option<String>, WorktreeError> {
    let mut candidates = BTreeSet::new();
    for sha in stash_entries(cwd)? {
        if stash_matches(cwd, &sha, message, expected)? {
            candidates.insert(sha);
        }
    }
    if candidates.len() > 1 {
        return Err(plan_error(
            "the saved files have ambiguous stash entries; nothing was restored",
        ));
    }
    if let Some(sha) = candidates.into_iter().next() {
        return Ok(Some(sha));
    }
    let objects = git(
        cwd,
        &[
            "cat-file",
            "--batch-all-objects",
            "--batch-check=%(objectname) %(objecttype)",
        ],
    )?;
    let commits: Vec<&str> = objects
        .lines()
        .filter_map(|line| line.strip_suffix(" commit"))
        .filter(|sha| {
            [40, 64].contains(&sha.len()) && sha.bytes().all(|byte| byte.is_ascii_hexdigit())
        })
        .collect();
    let mut candidates = BTreeSet::new();
    for chunk in commits.chunks(256) {
        let mut args = vec!["log", "--no-walk", "--format=%H%x00%s%x00"];
        args.extend_from_slice(chunk);
        args.push("--");
        let raw = git(cwd, &args)?;
        let fields: Vec<&str> = raw.split('\0').collect();
        for record in fields.as_chunks::<2>().0 {
            let sha = record[0].trim();
            if record[1] == message && stash_matches(cwd, sha, message, expected)? {
                candidates.insert(sha.to_string());
            }
        }
    }
    if candidates.len() > 1 {
        return Err(plan_error(
            "the saved files have ambiguous stash objects; nothing was restored",
        ));
    }
    Ok(candidates.into_iter().next())
}

pub(super) fn push_stash(cwd: &Path, message: &str) -> Result<String, WorktreeError> {
    git(
        cwd,
        &["stash", "push", "--include-untracked", "-m", message],
    )?;
    #[cfg(test)]
    AFTER_PUSH.with(|hook| {
        if let Some(hook) = hook.borrow_mut().take() {
            hook(cwd);
        }
    });
    resolve_commit(cwd, "refs/stash")
}

struct StashLock {
    path: PathBuf,
    is_active: bool,
}

impl Drop for StashLock {
    fn drop(&mut self) {
        if self.is_active {
            let _ = std::fs::remove_file(&self.path);
        }
    }
}

impl StashLock {
    fn commit(mut self, target: &Path) -> Result<(), WorktreeError> {
        std::fs::rename(&self.path, target)?;
        self.is_active = false;
        if let Some(parent) = target.parent() {
            sync_directory(parent)?;
        }
        #[cfg(test)]
        AFTER_LOCK_COMMIT.with(|hook| {
            if let Some(hook) = hook.borrow_mut().take() {
                hook(&self.path);
            }
        });
        Ok(())
    }
}

fn lock(path: PathBuf) -> Result<(StashLock, std::fs::File), WorktreeError> {
    let file = std::fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&path)?;
    Ok((
        StashLock {
            path,
            is_active: true,
        },
        file,
    ))
}

pub(super) fn drop_own_stash(cwd: &Path, sha: &str, message: &str) -> Result<(), WorktreeError> {
    if !own_stash(cwd, sha, message)? {
        return Ok(());
    }
    let reference = PathBuf::from(
        git(
            cwd,
            &[
                "rev-parse",
                "--path-format=absolute",
                "--git-path",
                "refs/stash",
            ],
        )?
        .trim(),
    );
    let log = PathBuf::from(
        git(
            cwd,
            &[
                "rev-parse",
                "--path-format=absolute",
                "--git-path",
                "logs/refs/stash",
            ],
        )?
        .trim(),
    );
    let (reference_lock, mut reference_file) = lock(reference.with_extension("lock"))?;
    let (log_lock, mut log_file) = lock(log.with_extension("lock"))?;
    let raw = std::fs::read_to_string(&log)?;
    let mut kept = Vec::new();
    let mut has_removed = false;
    let copies = raw
        .lines()
        .filter(|line| line.split_whitespace().nth(1) == Some(sha))
        .count();
    if copies > 1 {
        return Err(plan_error(
            "the stash has duplicate entries; they were kept safely",
        ));
    }
    for line in raw.lines() {
        let mut fields = line.splitn(3, ' ');
        let old = fields.next().unwrap_or_default();
        let new = fields.next().unwrap_or_default();
        let rest = fields.next().unwrap_or_default();
        if old.len() != sha.len() || new.len() != sha.len() || !rest.contains('\t') {
            return Err(plan_error(
                "couldn't clean up the stash safely; your files are restored",
            ));
        }
        if new == sha
            && rest
                .split_once('\t')
                .is_some_and(|(_, text)| text == message)
        {
            has_removed = true;
            continue;
        }
        kept.push(line.to_string());
    }
    if !has_removed {
        return Ok(());
    }
    let tip = resolve_commit(cwd, "refs/stash")?;
    if kept.is_empty() {
        let packed = git_run(cwd, &["show-ref", "--verify", "refs/stash"], None, None)?;
        if packed.status != 0 || !reference.exists() || tip != sha {
            return Err(plan_error(
                "couldn't clean up the stash safely; your files are restored",
            ));
        }
        let packed_path = PathBuf::from(
            git(
                cwd,
                &[
                    "rev-parse",
                    "--path-format=absolute",
                    "--git-path",
                    "packed-refs",
                ],
            )?
            .trim(),
        );
        if packed_path.exists()
            && std::fs::read_to_string(packed_path)?
                .lines()
                .any(|line| line.ends_with(" refs/stash"))
        {
            return Err(plan_error(
                "the restored stash is packed; it was kept safely",
            ));
        }
        std::fs::remove_file(&reference)?;
        if let Some(parent) = reference.parent() {
            sync_directory(parent)?;
        }
        log_file.sync_all()?;
        log_lock.commit(&log)?;
        return Ok(());
    }
    let mut previous = "0".repeat(sha.len());
    for line in &mut kept {
        let (_, rest) = line
            .split_once(' ')
            .ok_or_else(|| plan_error("the stash log is incomplete"))?;
        let next = rest
            .split_whitespace()
            .next()
            .unwrap_or_default()
            .to_string();
        *line = format!("{previous} {rest}");
        previous = next;
    }
    let new_tip = kept
        .last()
        .and_then(|line| line.split_whitespace().nth(1))
        .ok_or_else(|| plan_error("the stash log is incomplete"))?;
    if tip != sha && tip != new_tip {
        return Err(plan_error(
            "the stash changed during cleanup; it was kept safely",
        ));
    }
    log_file.write_all(format!("{}\n", kept.join("\n")).as_bytes())?;
    log_file.sync_all()?;
    reference_file.write_all(format!("{new_tip}\n").as_bytes())?;
    reference_file.sync_all()?;
    log_lock.commit(&log)?;
    #[cfg(test)]
    AFTER_LOG_COMMIT.with(|hook| {
        if let Some(hook) = hook.borrow_mut().take() {
            hook(cwd);
        }
    });
    reference_lock.commit(&reference)?;
    Ok(())
}

pub(super) fn restore_stash(cwd: &Path, sha: &str) -> Result<Vec<String>, WorktreeError> {
    let result = git_run(cwd, &["stash", "apply", "--index", sha], None, None)?;
    if result.status == 0 {
        return Ok(Vec::new());
    }
    let conflicts = git_run(
        cwd,
        &["diff", "--name-only", "--diff-filter=U", "-z"],
        None,
        None,
    )?;
    let files = paths(&conflicts.stdout);
    if !files.is_empty() {
        return Ok(files);
    }
    let changed = dirty_files(cwd)?;
    if !changed.is_empty() {
        return Ok(changed);
    }
    let saved = git_run(
        cwd,
        &[
            "stash",
            "show",
            "--include-untracked",
            "--name-only",
            "-z",
            sha,
        ],
        None,
        None,
    )?;
    let files = paths(&saved.stdout);
    if !files.is_empty() {
        return Ok(files);
    }
    Err(plan_error(&format!(
        "your files remain saved in stash {sha}: {}",
        result.stderr.trim()
    )))
}

#[cfg(test)]
type StashHook = Box<dyn FnOnce(&Path)>;

#[cfg(test)]
thread_local! {
    pub(super) static AFTER_LOG_COMMIT: std::cell::RefCell<Option<StashHook>> = const { std::cell::RefCell::new(None) };
    pub(super) static AFTER_LOCK_COMMIT: std::cell::RefCell<Option<StashHook>> = const { std::cell::RefCell::new(None) };
    pub(super) static AFTER_PUSH: std::cell::RefCell<Option<StashHook>> = const { std::cell::RefCell::new(None) };
}

#[cfg(test)]
mod tests;
