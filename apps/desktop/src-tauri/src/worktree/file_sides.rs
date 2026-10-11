use super::base::{normalized_base, resolve_base};
use super::error::WorktreeError;
use super::git::{git, resolve_commit};
use std::path::{Component, Path};

const MAX_BYTES: usize = 2 * 1024 * 1024;
const MAX_LINES: usize = 20_000;

#[derive(Debug, serde::Serialize)]
pub struct FileSides {
    old: Option<String>,
    new: Option<String>,
    too_large: bool,
}

#[tauri::command]
pub async fn worktree_file_sides(
    worktree_path: String,
    path: String,
    old_rev: Option<String>,
    new_rev: Option<String>,
    base_branch: Option<String>,
) -> Result<FileSides, WorktreeError> {
    tauri::async_runtime::spawn_blocking(move || {
        read_sides(&worktree_path, &path, old_rev, new_rev, base_branch)
    })
    .await
    .map_err(|error| WorktreeError::Io(std::io::Error::other(error.to_string())))?
}

fn confined_path(root: &Path, path: &str) -> Result<String, WorktreeError> {
    let relative = Path::new(path);
    if path.is_empty()
        || relative.is_absolute()
        || relative
            .components()
            .any(|part| !matches!(part, Component::Normal(_) | Component::CurDir))
    {
        return Err(WorktreeError::Git {
            message: "file path escapes the worktree".into(),
        });
    }
    let mut current = root.to_path_buf();
    for part in relative.components() {
        current.push(part);
        match current.canonicalize() {
            Ok(resolved) => {
                if !resolved.starts_with(root) {
                    return Err(WorktreeError::Git {
                        message: "file path escapes the worktree".into(),
                    });
                }
            }
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
            Err(error) => return Err(error.into()),
        }
    }
    if current == root {
        return Err(WorktreeError::Git {
            message: "diff path resolves to the worktree root".into(),
        });
    }
    Ok(relative
        .components()
        .filter_map(|part| match part {
            Component::Normal(name) => Some(name.to_string_lossy()),
            _ => None,
        })
        .collect::<Vec<_>>()
        .join("/"))
}

enum Side {
    Missing,
    MissingParent,
    Text(String),
    TooLarge,
}

fn validated_text(result: Result<String, WorktreeError>) -> Result<Side, WorktreeError> {
    let text = match result {
        Ok(text) => text,
        Err(WorktreeError::InvalidUtf8) => return Ok(Side::TooLarge),
        Err(error) => return Err(error),
    };
    if text.len() > MAX_BYTES || text.lines().count() > MAX_LINES || text.contains('\0') {
        return Ok(Side::TooLarge);
    }
    Ok(Side::Text(text))
}

fn revision_side(root: &Path, revision: &str, path: &str) -> Result<Side, WorktreeError> {
    let object = match revision {
        ":0" => {
            let listed = git(root, &["ls-files", "--stage", "--", path])?;
            if listed.is_empty() {
                return Ok(Side::Missing);
            }
            format!(":0:{path}")
        }
        _ => {
            let revision = match resolve_commit(root, revision) {
                Ok(commit) => commit,
                Err(error) => {
                    if let Some(parent) = revision.strip_suffix('^') {
                        let commit = resolve_commit(root, parent)?;
                        let ancestry = git(root, &["rev-list", "--parents", "-n", "1", &commit])?;
                        if ancestry.split_whitespace().count() == 1 {
                            return Ok(Side::MissingParent);
                        }
                    }
                    return Err(error);
                }
            };
            let listed = git(root, &["ls-tree", &revision, "--", path])?;
            if listed.is_empty() {
                return Ok(Side::Missing);
            }
            if listed.split_whitespace().nth(1) != Some("blob") {
                return Err(WorktreeError::Git {
                    message: "diff path is not a file".into(),
                });
            }
            format!("{revision}:{path}")
        }
    };
    let size = git(root, &["cat-file", "-s", &object])?
        .trim()
        .parse::<usize>()
        .map_err(|_| WorktreeError::Git {
            message: "cannot read file object size".into(),
        })?;
    if size > MAX_BYTES {
        return Ok(Side::TooLarge);
    }
    validated_text(git(root, &["show", &object]))
}

fn renamed_old_path(
    root: &Path,
    old_rev: &str,
    new_rev: Option<&str>,
    path: &str,
) -> Result<Option<String>, WorktreeError> {
    let mut args = vec!["diff", "--name-status", "-z"];
    let old_commit;
    let new_commit;
    if old_rev != ":0" {
        old_commit = resolve_commit(root, old_rev)?;
        args.push(&old_commit);
    }
    if let Some(revision) = new_rev {
        if revision == ":0" {
            args.push("--cached");
        }
        if revision != ":0" {
            new_commit = resolve_commit(root, revision)?;
            args.push(&new_commit);
        }
    }
    args.push("--");
    let changed = git(root, &args)?;
    let mut fields = changed.split('\0');
    while let Some(status) = fields.next() {
        let Some(first) = fields.next() else {
            break;
        };
        if !status.starts_with('R') && !status.starts_with('C') {
            continue;
        }
        let Some(destination) = fields.next() else {
            break;
        };
        if destination == path {
            return confined_path(root, first).map(Some);
        }
    }
    Ok(None)
}

fn working_side(root: &Path, path: &str) -> Result<Side, WorktreeError> {
    let file = root.join(path);
    let metadata = match std::fs::metadata(&file) {
        Ok(metadata) => metadata,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(Side::Missing),
        Err(error) => return Err(error.into()),
    };
    if metadata.len() > MAX_BYTES as u64 {
        return Ok(Side::TooLarge);
    }
    let bytes = std::fs::read(file)?;
    validated_text(String::from_utf8(bytes).map_err(|_| WorktreeError::InvalidUtf8))
}

fn read_sides(
    worktree_path: &str,
    path: &str,
    old_rev: Option<String>,
    new_rev: Option<String>,
    base_branch: Option<String>,
) -> Result<FileSides, WorktreeError> {
    let root = Path::new(worktree_path).canonicalize()?;
    let relative = confined_path(&root, path)?;
    let old_revision = match old_rev {
        Some(revision) => revision,
        None => resolve_base(&root, normalized_base(base_branch.as_deref()))
            .map(|(_, merge_base)| merge_base)
            .ok_or_else(|| WorktreeError::Git {
                message: "cannot resolve base branch merge-base".into(),
            })?,
    };
    let mut old = revision_side(&root, &old_revision, &relative)?;
    let new = match new_rev.as_deref() {
        Some(revision) => revision_side(&root, revision, &relative)?,
        None => working_side(&root, &relative)?,
    };
    if matches!(old, Side::Missing) && matches!(new, Side::Text(_)) {
        if let Some(old_path) =
            renamed_old_path(&root, &old_revision, new_rev.as_deref(), &relative)?
        {
            old = revision_side(&root, &old_revision, &old_path)?;
        }
    }
    if matches!(old, Side::TooLarge) || matches!(new, Side::TooLarge) {
        return Ok(FileSides {
            old: None,
            new: None,
            too_large: true,
        });
    }
    let text = |side| match side {
        Side::Text(value) => Some(value),
        Side::Missing | Side::MissingParent | Side::TooLarge => None,
    };
    Ok(FileSides {
        old: text(old),
        new: text(new),
        too_large: false,
    })
}

#[cfg(test)]
mod tests;
