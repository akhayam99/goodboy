use super::plan::plan_error;
use super::runner::git_run;
use crate::worktree::{git, resolve_commit, WorktreeError};
use std::collections::BTreeSet;
use std::path::Path;

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

pub(super) fn object_exists(cwd: &Path, sha: &str) -> bool {
    git_run(
        cwd,
        &["cat-file", "-e", &format!("{sha}^{{commit}}")],
        None,
        None,
    )
    .is_ok_and(|run| run.status == 0)
}

pub(super) fn drop_own_stash(cwd: &Path, sha: &str, message: &str) -> Result<(), WorktreeError> {
    if !own_stash(cwd, sha, message)? {
        return Ok(());
    }
    let positions: Vec<usize> = stash_entries(cwd)?
        .iter()
        .enumerate()
        .filter(|(_, entry)| entry.as_str() == sha)
        .map(|(index, _)| index)
        .collect();
    if positions.len() > 1 {
        return Err(plan_error(
            "the stash has duplicate entries; they were kept safely",
        ));
    }
    let Some(index) = positions.first() else {
        return Ok(());
    };
    let slot = format!("stash@{{{index}}}");
    if resolve_commit(cwd, &slot)? != sha {
        return Err(plan_error(
            "the stash changed during cleanup; it was kept safely",
        ));
    }
    #[cfg(test)]
    BEFORE_DROP.with(|hook| {
        if let Some(hook) = hook.borrow_mut().take() {
            hook(cwd);
        }
    });
    let printed = git(cwd, &["stash", "drop", &slot])?;
    let dropped = printed
        .split(['(', ')'])
        .nth(1)
        .map(str::trim)
        .unwrap_or_default();
    if dropped == sha {
        return Ok(());
    }
    if dropped.is_empty() || !object_exists(cwd, dropped) {
        return Err(plan_error(
            "the stash changed during cleanup; check it in the terminal",
        ));
    }
    let subject = stash_message(cwd, dropped)?;
    git(cwd, &["stash", "store", "-m", &subject, dropped])?;
    Err(plan_error(
        "the stash changed during cleanup; it was kept safely",
    ))
}

pub(super) fn is_restored(cwd: &Path, sha: &str) -> Result<bool, WorktreeError> {
    let unmerged = git_run(
        cwd,
        &["diff", "--name-only", "--diff-filter=U", "-z"],
        None,
        None,
    )?;
    if !paths(&unmerged.stdout).is_empty() {
        return Ok(false);
    }
    let mut has_evidence = false;
    let untracked = format!("{sha}^3");
    if git_run(
        cwd,
        &["rev-parse", "--verify", "--quiet", &untracked],
        None,
        None,
    )?
    .status
        == 0
    {
        let listing = git(cwd, &["ls-tree", "-r", "-z", &untracked])?;
        for record in listing.split('\0').filter(|record| !record.is_empty()) {
            let Some((meta, path)) = record.split_once('\t') else {
                return Ok(false);
            };
            let Some(oid) = meta.split_whitespace().nth(2) else {
                return Ok(false);
            };
            if !cwd.join(path).is_file() {
                return Ok(false);
            }
            let hashed = git_run(cwd, &["hash-object", "--", path], None, None)?;
            if hashed.status != 0 || hashed.stdout.trim() != oid {
                return Ok(false);
            }
            has_evidence = true;
        }
    }
    let changed = git(
        cwd,
        &[
            "diff",
            "--no-renames",
            "--name-only",
            "-z",
            &format!("{sha}^1"),
            sha,
            "--",
        ],
    )?;
    let dirty = dirty_files(cwd)?;
    if paths(&changed).iter().any(|path| dirty.contains(path)) {
        has_evidence = true;
    }
    Ok(has_evidence)
}

pub(super) const GUARD_RETENTION_SECS: u64 = 14 * 24 * 60 * 60;

pub(super) fn prune_guards(
    cwd: &Path,
    now_secs: u64,
    protected: Option<&str>,
) -> Result<(), WorktreeError> {
    let listing = git(
        cwd,
        &[
            "for-each-ref",
            "--format=%(refname) %(objectname) %(committerdate:unix)",
            "refs/goodboy/stash",
        ],
    )?;
    for line in listing.lines() {
        let mut fields = line.split_whitespace();
        let (Some(name), Some(sha), Some(stamp)) = (fields.next(), fields.next(), fields.next())
        else {
            continue;
        };
        let Ok(created) = stamp.parse::<u64>() else {
            continue;
        };
        if Some(sha) == protected || now_secs.saturating_sub(created) <= GUARD_RETENTION_SECS {
            continue;
        }
        let _ = git_run(cwd, &["update-ref", "-d", name, sha], None, None);
    }
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
    pub(super) static BEFORE_DROP: std::cell::RefCell<Option<StashHook>> = const { std::cell::RefCell::new(None) };
    pub(super) static AFTER_PUSH: std::cell::RefCell<Option<StashHook>> = const { std::cell::RefCell::new(None) };
}

#[cfg(test)]
mod tests;
