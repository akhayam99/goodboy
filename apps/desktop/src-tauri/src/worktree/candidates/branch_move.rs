use super::owner_tree::changes_between;
use crate::worktree::error::WorktreeError;
use crate::worktree::git::{git, resolve_commit};
use std::collections::{BTreeSet, HashSet};
use std::path::Path;

const SWITCHED_BEFORE: &str =
    "your branch changed before Goodboy could move it, so nothing was changed";
const SWITCHED_DURING: &str =
    "your branch changed while Goodboy was moving it, so the files were put back and nothing was changed";
const LEFT_AFTER_FAILURE: &str =
    "Git refused to update the branch and files of the fix changed since, so they were left as they are: check them";

pub(super) type RunIndex<'a> = &'a dyn Fn(&[&str]) -> Result<String, WorktreeError>;

fn git_failure(error: impl ToString) -> WorktreeError {
    WorktreeError::Git {
        message: error.to_string(),
    }
}

fn symbolic_of(path: &Path) -> Option<String> {
    git(path, &["symbolic-ref", "-q", "HEAD"])
        .ok()
        .map(|name| name.trim().to_string())
        .filter(|name| !name.is_empty())
}

pub(super) struct BranchTarget {
    pub(super) refname: Option<String>,
    pub(super) head: String,
}

impl BranchTarget {
    pub(super) fn capture(path: &Path) -> Result<Self, WorktreeError> {
        Ok(Self {
            refname: symbolic_of(path),
            head: resolve_commit(path, "HEAD")?,
        })
    }

    pub(super) fn is_current(&self, path: &Path) -> bool {
        symbolic_of(path) == self.refname
            && resolve_commit(path, "HEAD").ok().as_deref() == Some(self.head.as_str())
    }
}

fn ancestors_of(path: &str) -> Vec<String> {
    let mut found = Vec::new();
    let mut rest = path;
    while let Some(cut) = rest.rfind('/') {
        rest = &rest[..cut];
        found.push(rest.to_string());
    }
    found
}

fn tracked_among(run: RunIndex<'_>, paths: &[&str]) -> Result<HashSet<String>, WorktreeError> {
    let mut args = vec!["--literal-pathspecs", "ls-files", "-z", "--cached", "--"];
    args.extend_from_slice(paths);
    Ok(run(&args)?
        .split('\0')
        .filter(|entry| !entry.is_empty())
        .map(str::to_string)
        .collect())
}

pub(super) fn ensure_nothing_untracked_in_the_way(
    path: &Path,
    run: RunIndex<'_>,
    from: &str,
    to: &str,
) -> Result<(), WorktreeError> {
    let changed: HashSet<String> = changes_between(path, from, to)?
        .into_iter()
        .map(|change| change.path)
        .collect();
    let mut asked = BTreeSet::new();
    for changed_path in &changed {
        asked.insert(changed_path.clone());
        asked.extend(ancestors_of(changed_path));
    }
    let on_disk: Vec<(String, bool)> = asked
        .into_iter()
        .filter_map(|entry| {
            std::fs::symlink_metadata(path.join(&entry))
                .ok()
                .map(|meta| (entry, meta.is_dir()))
        })
        .collect();
    if on_disk.is_empty() {
        return Ok(());
    }
    let names: Vec<&str> = on_disk.iter().map(|(entry, _)| entry.as_str()).collect();
    let tracked = tracked_among(run, &names)?;
    let blocking = on_disk
        .iter()
        .find(|(entry, is_dir)| !tracked.contains(entry) && (changed.contains(entry) || !is_dir));
    if let Some((entry, _)) = blocking {
        return Err(git_failure(format!(
            "{entry} is in your working tree but not tracked by Git, and the fix writes there, so nothing was changed: move it away first"
        )));
    }
    Ok(())
}

pub(super) struct BranchMove<'a> {
    pub(super) path: &'a Path,
    pub(super) target: &'a BranchTarget,
    pub(super) to: &'a str,
    pub(super) in_the_way: &'a str,
}

fn is_index_at(path: &Path, tree: &str, paths: &[String]) -> bool {
    if paths.is_empty() {
        return true;
    }
    let mut args = vec![
        "--literal-pathspecs",
        "diff-index",
        "--cached",
        "--quiet",
        tree,
        "--",
    ];
    args.extend(paths.iter().map(String::as_str));
    git(path, &args).is_ok()
}

fn roll_back(path: &Path, from: &str, to: &str, reason: String) -> WorktreeError {
    crate::logging::note_failure(
        "branch move refresh",
        git(path, &["update-index", "-q", "--refresh"]),
    );
    if git(path, &["read-tree", "-m", "-u", to, from]).is_err() {
        return git_failure(LEFT_AFTER_FAILURE);
    }
    git_failure(reason)
}

pub(super) fn move_branch(plan: BranchMove<'_>) -> Result<(), WorktreeError> {
    let BranchMove {
        path,
        target,
        to,
        in_the_way,
    } = plan;
    let from = target.head.as_str();
    if !target.is_current(path) {
        return Err(git_failure(SWITCHED_BEFORE));
    }
    let changed: Vec<String> = changes_between(path, from, to)?
        .into_iter()
        .map(|change| change.path)
        .collect();
    if !is_index_at(path, from, &changed) {
        return Err(git_failure(in_the_way));
    }
    ensure_nothing_untracked_in_the_way(path, &|args| git(path, args), from, to)?;
    git(path, &["update-index", "-q", "--refresh"])?;
    if git(path, &["read-tree", "-m", "-u", from, to]).is_err() {
        return Err(git_failure(in_the_way));
    }
    after_files_moved(path);
    if !target.is_current(path) {
        return Err(roll_back(path, from, to, SWITCHED_DURING.to_string()));
    }
    let updated = match target.refname.as_deref() {
        Some(refname) => git(path, &["update-ref", refname, to, from]),
        None => git(path, &["update-ref", "--no-deref", "HEAD", to, from]),
    };
    if let Err(error) = updated {
        return Err(roll_back(
            path,
            from,
            to,
            format!("Git refused to update the branch, so the files were put back: {error}"),
        ));
    }
    Ok(())
}

pub(super) fn after_files_moved(path: &Path) {
    #[cfg(test)]
    AFTER_FILES_MOVED.with(|hook| {
        if let Some(run) = hook.borrow().as_ref() {
            run(path);
        }
    });
    #[cfg(not(test))]
    let _ = path;
}

#[cfg(test)]
pub(super) type FilesMovedHook = Option<Box<dyn Fn(&Path)>>;

#[cfg(test)]
thread_local! {
    pub(super) static AFTER_FILES_MOVED: std::cell::RefCell<FilesMovedHook> =
        const { std::cell::RefCell::new(None) };
}
