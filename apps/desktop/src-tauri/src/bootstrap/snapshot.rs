use std::collections::HashMap;
use std::path::{Path, PathBuf};

use serde::Serialize;

use super::BootstrapError;
use crate::proc::git::Git;
use crate::worktree::{git, redact_credentials};

const SNAPSHOT_MESSAGE: &str = "chore: snapshot before bootstrap";
const SNAPSHOT_AUTHOR_NAME: &str = "Goodboy";
const SNAPSHOT_AUTHOR_EMAIL: &str = "goodboy@localhost";
const GITLINK_MODE: &str = "160000";
const ABSENT_OID: &str = "0000000000000000000000000000000000000000";

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum FileChange {
    Added,
    Modified,
    Deleted,
    TypeChanged,
}

#[derive(Debug, Clone)]
pub(crate) struct Change {
    pub(crate) path: String,
    pub(crate) change: FileChange,
    pub(crate) new_mode: String,
    pub(crate) new_oid: String,
}

pub(crate) struct Snapshot {
    pub(crate) id: String,
}

pub(crate) fn git_failure(error: impl std::fmt::Display) -> BootstrapError {
    BootstrapError::Git {
        message: redact_credentials(&error.to_string()),
    }
}

pub(crate) fn run(root: &Path, args: &[&str]) -> Result<String, BootstrapError> {
    git(root, args).map_err(git_failure)
}

pub(crate) fn absolute_git_dir(root: &Path) -> Result<PathBuf, BootstrapError> {
    let raw = run(root, &["rev-parse", "--absolute-git-dir"])?;
    Ok(PathBuf::from(raw.trim()))
}

struct IndexFile(PathBuf);

impl Drop for IndexFile {
    fn drop(&mut self) {
        let _ = std::fs::remove_file(&self.0);
    }
}

fn with_index(root: &Path, index: &Path, args: &[&str]) -> Result<String, BootstrapError> {
    Git::new()
        .cwd(root)
        .index_file(index)
        .args(args)
        .stdout()
        .map_err(git_failure)
}

pub(crate) fn take_snapshot(
    root: &Path,
    snapshot_ref: &str,
) -> Result<Option<Snapshot>, BootstrapError> {
    let git_dir = absolute_git_dir(root)?;
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|elapsed| elapsed.as_nanos())
        .unwrap_or_default();
    let index = IndexFile(git_dir.join(format!(
        "goodboy-bootstrap-{}-{nanos}.index",
        std::process::id()
    )));
    with_index(root, &index.0, &["read-tree", "HEAD"])?;
    with_index(root, &index.0, &["add", "-A"])?;
    let tree = with_index(root, &index.0, &["write-tree"])?
        .trim()
        .to_string();
    let head_tree = run(root, &["rev-parse", "HEAD^{tree}"])?.trim().to_string();
    if tree == head_tree {
        return Ok(None);
    }
    let id = Git::new()
        .cwd(root)
        .args([
            "-c",
            &format!("user.name={SNAPSHOT_AUTHOR_NAME}"),
            "-c",
            &format!("user.email={SNAPSHOT_AUTHOR_EMAIL}"),
            "-c",
            "commit.gpgsign=false",
            "commit-tree",
            &tree,
            "-p",
            "HEAD",
            "-m",
            SNAPSHOT_MESSAGE,
        ])
        .stdout()
        .map_err(git_failure)?
        .trim()
        .to_string();
    run(root, &["update-ref", snapshot_ref, &id])?;
    Ok(Some(Snapshot { id }))
}

pub(crate) fn list_changes(root: &Path, snapshot_id: &str) -> Result<Vec<Change>, BootstrapError> {
    let raw = run(
        root,
        &[
            "diff-tree",
            "-r",
            "--raw",
            "-z",
            "--no-renames",
            "--no-abbrev",
            "HEAD",
            snapshot_id,
        ],
    )?;
    let mut parts = raw.split('\0').filter(|part| !part.is_empty());
    let mut changes = Vec::new();
    while let Some(meta) = parts.next() {
        let Some(path) = parts.next() else {
            break;
        };
        let fields: Vec<&str> = meta.trim_start_matches(':').split(' ').collect();
        let [_, new_mode, _, new_oid, status] = fields[..] else {
            continue;
        };
        let change = match status.chars().next() {
            Some('A') => FileChange::Added,
            Some('D') => FileChange::Deleted,
            Some('T') => FileChange::TypeChanged,
            _ => FileChange::Modified,
        };
        changes.push(Change {
            path: path.to_string(),
            change,
            new_mode: new_mode.to_string(),
            new_oid: new_oid.to_string(),
        });
    }
    Ok(changes)
}

pub(crate) fn nested_repositories(changes: &[Change]) -> Vec<String> {
    changes
        .iter()
        .filter(|change| change.new_mode == GITLINK_MODE && change.change != FileChange::Deleted)
        .map(|change| change.path.clone())
        .collect()
}

pub(crate) fn object_sizes(root: &Path, changes: &[Change]) -> Result<Vec<u64>, BootstrapError> {
    let wanted: Vec<&Change> = changes
        .iter()
        .filter(|change| change.new_oid != ABSENT_OID)
        .collect();
    if wanted.is_empty() {
        return Ok(Vec::new());
    }
    let input: String = wanted
        .iter()
        .map(|change| format!("{}\n", change.new_oid))
        .collect();
    let output = Git::new()
        .cwd(root)
        .args(["cat-file", "--batch-check=%(objectsize)"])
        .input(input)
        .stdout()
        .map_err(git_failure)?;
    Ok(output
        .lines()
        .map(|line| line.trim().parse::<u64>().unwrap_or(0))
        .collect())
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct Content {
    pub(crate) oid: String,
    pub(crate) mode: String,
}

#[cfg(unix)]
fn mode_of_file(metadata: &std::fs::Metadata) -> &'static str {
    use std::os::unix::fs::PermissionsExt;
    if metadata.permissions().mode() & 0o111 != 0 {
        "100755"
    } else {
        "100644"
    }
}

#[cfg(not(unix))]
fn mode_of_file(_metadata: &std::fs::Metadata) -> &'static str {
    "100644"
}

fn hash_stdin(dir: &Path, bytes: Vec<u8>) -> Result<String, BootstrapError> {
    Ok(Git::new()
        .cwd(dir)
        .args(["hash-object", "--stdin"])
        .input(bytes)
        .stdout()
        .map_err(git_failure)?
        .trim()
        .to_string())
}

pub(crate) fn hash_paths(
    dir: &Path,
    paths: &[String],
) -> Result<HashMap<String, Option<Content>>, BootstrapError> {
    let mut found: HashMap<String, Option<Content>> = HashMap::new();
    let mut batch: Vec<(String, &'static str)> = Vec::new();
    for rel in paths {
        if rel.contains('\n') {
            return Err(BootstrapError::InvalidInput(format!(
                "{rel:?} has a line break in its name"
            )));
        }
        let full = dir.join(rel);
        let metadata = match std::fs::symlink_metadata(&full) {
            Ok(metadata) => metadata,
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
                found.insert(rel.clone(), None);
                continue;
            }
            Err(error) => return Err(BootstrapError::Io(error)),
        };
        if metadata.file_type().is_symlink() {
            let target = std::fs::read_link(&full)?;
            let oid = hash_stdin(dir, target.to_string_lossy().into_owned().into_bytes())?;
            found.insert(
                rel.clone(),
                Some(Content {
                    oid,
                    mode: "120000".to_string(),
                }),
            );
            continue;
        }
        if !metadata.is_file() {
            found.insert(rel.clone(), None);
            continue;
        }
        batch.push((rel.clone(), mode_of_file(&metadata)));
    }
    if batch.is_empty() {
        return Ok(found);
    }
    let input: String = batch.iter().map(|(rel, _)| format!("{rel}\n")).collect();
    let output = Git::new()
        .cwd(dir)
        .args(["hash-object", "--stdin-paths"])
        .input(input)
        .stdout()
        .map_err(git_failure)?;
    for ((rel, mode), oid) in batch.into_iter().zip(output.lines()) {
        found.insert(
            rel,
            Some(Content {
                oid: oid.trim().to_string(),
                mode: mode.to_string(),
            }),
        );
    }
    Ok(found)
}

pub(crate) fn matches_snapshot(change: &Change, content: &Option<Content>) -> bool {
    match (change.change, content) {
        (FileChange::Deleted, None) => true,
        (FileChange::Deleted, Some(_)) => false,
        (_, None) => false,
        (_, Some(found)) => found.oid == change.new_oid && found.mode == change.new_mode,
    }
}

pub(crate) fn mismatches(
    dir: &Path,
    changes: &[Change],
    skip: &std::collections::HashSet<String>,
) -> Result<Vec<String>, BootstrapError> {
    let paths: Vec<String> = changes
        .iter()
        .filter(|change| !skip.contains(&change.path))
        .map(|change| change.path.clone())
        .collect();
    let hashed = hash_paths(dir, &paths)?;
    Ok(changes
        .iter()
        .filter(|change| !skip.contains(&change.path))
        .filter(|change| {
            let content = hashed.get(&change.path).cloned().unwrap_or(None);
            !matches_snapshot(change, &content)
        })
        .map(|change| change.path.clone())
        .collect())
}
