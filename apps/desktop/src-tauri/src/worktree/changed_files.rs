use super::base::{normalized_base, resolve_base};
use super::error::WorktreeError;
use super::git::git;
use serde::Serialize;
use std::path::Path;

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ChangedEntry {
    pub path: String,
    pub status: &'static str,
    pub from: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChangedFilesSummary {
    pub paths: Vec<String>,
    pub entries: Vec<ChangedEntry>,
    pub additions: u32,
    pub deletions: u32,
    pub numstat: String,
}

const LANDED_FILE_LIMIT: usize = 400;
const UNTRACKED_COUNT_LIMIT_BYTES: u64 = 1_048_576;

fn parse_name_status_z(raw: &str) -> Vec<ChangedEntry> {
    let mut tokens = raw.split('\0').filter(|token| !token.is_empty());
    let mut entries = Vec::new();
    while let Some(code) = tokens.next() {
        let Some(letter) = code.chars().next() else {
            continue;
        };
        let Some(first) = tokens.next() else {
            break;
        };
        match letter {
            'R' | 'C' => {
                let Some(target) = tokens.next() else {
                    break;
                };
                entries.push(match letter {
                    'R' => ChangedEntry {
                        path: target.to_string(),
                        status: "renamed",
                        from: Some(first.to_string()),
                    },
                    _ => ChangedEntry {
                        path: target.to_string(),
                        status: "added",
                        from: None,
                    },
                });
            }
            'A' | 'D' | 'M' | 'T' => entries.push(ChangedEntry {
                path: first.to_string(),
                status: match letter {
                    'A' => "added",
                    'D' => "deleted",
                    _ => "modified",
                },
                from: None,
            }),
            _ => {}
        }
    }
    entries
}

struct NumstatRow<'a> {
    additions: &'a str,
    deletions: &'a str,
    path: &'a str,
    display: String,
}

fn parse_numstat_z(raw: &str) -> Vec<NumstatRow<'_>> {
    let mut tokens = raw.split('\0').filter(|token| !token.is_empty());
    let mut rows = Vec::new();
    while let Some(token) = tokens.next() {
        let mut parts = token.splitn(3, '\t');
        let (Some(additions), Some(deletions), Some(path)) =
            (parts.next(), parts.next(), parts.next())
        else {
            continue;
        };
        if !path.is_empty() {
            rows.push(NumstatRow {
                additions,
                deletions,
                path,
                display: path.to_string(),
            });
            continue;
        }
        let (Some(from), Some(to)) = (tokens.next(), tokens.next()) else {
            break;
        };
        rows.push(NumstatRow {
            additions,
            deletions,
            path: to,
            display: format!("{from} => {to}"),
        });
    }
    rows
}

enum UntrackedCount {
    Lines(u32),
    Unknown,
    Unreadable,
}

fn count_untracked(path: &Path) -> UntrackedCount {
    let Ok(meta) = std::fs::symlink_metadata(path) else {
        return UntrackedCount::Unreadable;
    };
    if !meta.is_file() {
        return UntrackedCount::Unreadable;
    }
    if meta.len() > UNTRACKED_COUNT_LIMIT_BYTES {
        return UntrackedCount::Unknown;
    }
    match std::fs::read(path) {
        Ok(bytes) if bytes.contains(&0) => UntrackedCount::Unknown,
        Ok(bytes) => UntrackedCount::Lines(String::from_utf8_lossy(&bytes).lines().count() as u32),
        Err(_) => UntrackedCount::Unreadable,
    }
}

fn branch_work_landed(cwd: &Path, base_ref: &str, merge_base: &str) -> bool {
    let Ok(raw) = git(cwd, &["rev-list", "--count", &format!("{base_ref}..HEAD")]) else {
        return false;
    };
    let Ok(ahead) = raw.trim().parse::<usize>() else {
        return false;
    };
    if ahead == 0 {
        return true;
    }
    let Ok(touched) = git(cwd, &["diff", "--name-only", "-z", merge_base, "HEAD"]) else {
        return false;
    };
    let paths: Vec<&str> = touched
        .split('\0')
        .filter(|line| !line.is_empty())
        .collect();
    if paths.is_empty() || paths.len() > LANDED_FILE_LIMIT {
        return paths.is_empty();
    }
    let mut args: Vec<&str> = vec!["diff", "--name-only", base_ref, "HEAD", "--"];
    args.extend(paths.iter().copied());
    let Ok(remaining) = git(cwd, &args) else {
        return false;
    };
    remaining.trim().is_empty()
}

#[tauri::command]
pub async fn worktree_changed_files(
    worktree_path: String,
    base_branch: Option<String>,
) -> Result<ChangedFilesSummary, WorktreeError> {
    tauri::async_runtime::spawn_blocking(move || {
        worktree_changed_files_blocking(worktree_path, base_branch)
    })
    .await
    .map_err(|e| WorktreeError::Io(std::io::Error::other(e.to_string())))?
}

pub(super) fn worktree_changed_files_blocking(
    worktree_path: String,
    base_branch: Option<String>,
) -> Result<ChangedFilesSummary, WorktreeError> {
    let p = Path::new(&worktree_path);
    if !p.exists() {
        return Err(WorktreeError::RepoNotFound(worktree_path));
    }
    let configured_base = normalized_base(base_branch.as_deref());
    let (base_ref, merge_base) =
        resolve_base(p, configured_base).ok_or_else(|| WorktreeError::Git {
            message: "cannot resolve base branch merge-base".to_string(),
        })?;
    let resolved = if branch_work_landed(p, &base_ref, &merge_base) {
        "HEAD".to_string()
    } else {
        merge_base
    };
    let tracked_numstat = git(p, &["diff", "--numstat", "-z", &resolved])?;
    let mut additions: u32 = 0;
    let mut deletions: u32 = 0;
    let mut set: std::collections::BTreeSet<String> = std::collections::BTreeSet::new();
    let mut numstat_lines: Vec<String> = Vec::new();
    for row in parse_numstat_z(&tracked_numstat) {
        if let Ok(a) = row.additions.parse::<u32>() {
            additions = additions.saturating_add(a);
        }
        if let Ok(d) = row.deletions.parse::<u32>() {
            deletions = deletions.saturating_add(d);
        }
        set.insert(row.path.to_string());
        numstat_lines.push(format!(
            "{}\t{}\t{}",
            row.additions, row.deletions, row.display
        ));
    }
    let untracked = git(p, &["ls-files", "--others", "--exclude-standard", "-z"])?;
    let untracked_paths: Vec<&str> = untracked
        .split('\0')
        .filter(|rel| !rel.is_empty())
        .collect();
    for rel in &untracked_paths {
        set.insert((*rel).to_string());
        match count_untracked(&p.join(rel)) {
            UntrackedCount::Unknown => numstat_lines.push(format!("-\t-\t{rel}")),
            UntrackedCount::Lines(n) => {
                additions = additions.saturating_add(n);
                numstat_lines.push(format!("{n}\t0\t{rel}"));
            }
            UntrackedCount::Unreadable => numstat_lines.push(format!("0\t0\t{rel}")),
        }
    }
    let name_status = git(p, &["diff", "--name-status", "-M", "-z", &resolved])?;
    let mut entries: Vec<ChangedEntry> = parse_name_status_z(&name_status);
    for rel in &untracked_paths {
        entries.push(ChangedEntry {
            path: (*rel).to_string(),
            status: "added",
            from: None,
        });
    }
    entries.sort_by(|a, b| a.path.cmp(&b.path));
    entries.dedup_by(|a, b| a.path == b.path);
    Ok(ChangedFilesSummary {
        paths: set.into_iter().collect(),
        entries,
        additions,
        deletions,
        numstat: numstat_lines.join("\n"),
    })
}

#[cfg(test)]
mod tests;
