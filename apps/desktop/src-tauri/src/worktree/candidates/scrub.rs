use crate::proc::git::Git;
use crate::worktree::error::WorktreeError;
use crate::worktree::git::{git, resolve_commit};
use crate::worktree::slug::sanitize_slug;
use std::path::{Component, Path, PathBuf};

const SYMLINK_MODE: &str = "120000";

const PATH_CHUNK: usize = 200;

struct Added {
    path: String,
    mode: String,
    blob: String,
}

fn git_failure(error: impl ToString) -> WorktreeError {
    WorktreeError::Git {
        message: error.to_string(),
    }
}

fn added_entries(cwd: &Path, base: &str, tip: &str) -> Result<Vec<Added>, WorktreeError> {
    let raw = git(
        cwd,
        &[
            "diff",
            "--raw",
            "--no-abbrev",
            "--no-renames",
            "--diff-filter=A",
            "-z",
            base,
            tip,
        ],
    )?;
    let mut tokens = raw.split('\0').filter(|token| !token.is_empty());
    let mut entries = Vec::new();
    while let Some(header) = tokens.next() {
        let Some(path) = tokens.next() else {
            break;
        };
        let fields: Vec<&str> = header.trim_start_matches(':').split_whitespace().collect();
        if fields.len() < 4 {
            continue;
        }
        entries.push(Added {
            path: path.to_string(),
            mode: fields[1].to_string(),
            blob: fields[3].to_string(),
        });
    }
    Ok(entries)
}

fn escapes_checkout(link_path: &str, target: &str) -> bool {
    let target = Path::new(target.trim());
    if target.is_absolute() {
        return true;
    }
    let mut depth = Path::new(link_path)
        .parent()
        .map_or(0, |parent| parent.components().count() as i64);
    for component in target.components() {
        match component {
            Component::ParentDir => {
                depth -= 1;
                if depth < 0 {
                    return true;
                }
            }
            Component::Normal(_) => depth += 1,
            Component::CurDir => {}
            _ => return true,
        }
    }
    false
}

fn is_inside_dependencies(path: &str) -> bool {
    path.split('/').any(|segment| segment == "node_modules")
}

fn ignored_among(cwd: &Path, paths: &[String]) -> Vec<String> {
    if paths.is_empty() {
        return Vec::new();
    }
    let input = paths.iter().fold(Vec::new(), |mut bytes, path| {
        bytes.extend_from_slice(path.as_bytes());
        bytes.push(0);
        bytes
    });
    let Ok(output) = Git::new()
        .cwd(cwd)
        .args(["check-ignore", "--no-index", "-z", "--stdin"])
        .input(input)
        .output()
    else {
        return Vec::new();
    };
    output
        .stdout_lossy()
        .split('\0')
        .filter(|path| !path.is_empty())
        .map(str::to_string)
        .collect()
}

fn leaked_paths(cwd: &Path, base: &str, tip: &str) -> Result<Vec<String>, WorktreeError> {
    let mut leaked: Vec<String> = Vec::new();
    let mut rest: Vec<String> = Vec::new();
    for entry in added_entries(cwd, base, tip)? {
        if is_inside_dependencies(&entry.path) {
            leaked.push(entry.path);
            continue;
        }
        if entry.mode == SYMLINK_MODE {
            let target = git(cwd, &["cat-file", "blob", &entry.blob]).unwrap_or_default();
            if escapes_checkout(&entry.path, &target) {
                leaked.push(entry.path);
                continue;
            }
        }
        rest.push(entry.path);
    }
    for path in ignored_among(cwd, &rest) {
        if !leaked.contains(&path) {
            leaked.push(path);
        }
    }
    Ok(leaked)
}

fn scratch_index(cwd: &Path, candidate_id: &str) -> Result<PathBuf, WorktreeError> {
    let git_dir = git(cwd, &["rev-parse", "--absolute-git-dir"])?;
    let name = format!("goodboy-scrub-{}.index", sanitize_slug(candidate_id));
    Ok(Path::new(git_dir.trim()).join(name))
}

fn with_index(cwd: &Path, index: &Path, args: &[&str]) -> Result<String, WorktreeError> {
    Git::new()
        .cwd(cwd)
        .index_file(index)
        .args(args)
        .stdout()
        .map_err(git_failure)
}

fn commit_meta(cwd: &Path, commit: &str) -> Result<Vec<String>, WorktreeError> {
    let format = "--format=%an%x1f%ae%x1f%aI%x1f%cn%x1f%ce%x1f%cI";
    let raw = git(cwd, &["log", "-1", format, commit])?;
    let meta: Vec<String> = raw
        .trim_end_matches('\n')
        .split('\u{1f}')
        .map(str::to_string)
        .collect();
    if meta.len() != 6 {
        return Err(git_failure("could not read the commit author"));
    }
    Ok(meta)
}

fn rewrite_commit(
    cwd: &Path,
    index: &Path,
    commit: &str,
    parent: &str,
    leaked: &[String],
) -> Result<Option<String>, WorktreeError> {
    with_index(cwd, index, &["read-tree", commit])?;
    for chunk in leaked.chunks(PATH_CHUNK) {
        let mut args = vec!["rm", "--cached", "-r", "-q", "--ignore-unmatch", "--"];
        args.extend(chunk.iter().map(String::as_str));
        with_index(cwd, index, &args)?;
    }
    let tree = with_index(cwd, index, &["write-tree"])?.trim().to_string();
    let parent_tree = git(cwd, &["rev-parse", &format!("{parent}^{{tree}}")])?;
    if tree == parent_tree.trim() {
        return Ok(None);
    }
    let meta = commit_meta(cwd, commit)?;
    let message = git(cwd, &["log", "-1", "--format=%B", commit])?;
    let created = Git::new()
        .cwd(cwd)
        .args(["commit-tree", &tree, "-p", parent])
        .env("GIT_AUTHOR_NAME", &meta[0])
        .env("GIT_AUTHOR_EMAIL", &meta[1])
        .env("GIT_AUTHOR_DATE", &meta[2])
        .env("GIT_COMMITTER_NAME", &meta[3])
        .env("GIT_COMMITTER_EMAIL", &meta[4])
        .env("GIT_COMMITTER_DATE", &meta[5])
        .input(message.trim_end().as_bytes().to_vec())
        .stdout()
        .map_err(git_failure)?;
    Ok(Some(created.trim().to_string()))
}

pub(super) fn scrub_environment(
    cwd: &Path,
    base: &str,
    tip: &str,
    candidate_id: &str,
) -> Result<String, WorktreeError> {
    let leaked = leaked_paths(cwd, base, tip)?;
    if leaked.is_empty() {
        return Ok(tip.to_string());
    }
    let commits = git(cwd, &["rev-list", "--reverse", &format!("{base}..{tip}")])?;
    let index = scratch_index(cwd, candidate_id)?;
    let mut parent = resolve_commit(cwd, base)?;
    let mut failure = None;
    for commit in commits.lines().map(str::trim).filter(|line| !line.is_empty()) {
        match rewrite_commit(cwd, &index, commit, &parent, &leaked) {
            Ok(Some(created)) => parent = created,
            Ok(None) => {}
            Err(error) => {
                failure = Some(error);
                break;
            }
        }
    }
    crate::logging::note_failure("scrub index delete", std::fs::remove_file(&index));
    match failure {
        Some(error) => Err(error),
        None => Ok(parent),
    }
}
