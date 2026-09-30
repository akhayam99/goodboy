use super::runner::git_run;
use super::types::HistoryBackup;
use crate::worktree::{git, sanitize_slug, WorktreeError};
use std::collections::HashMap;
use std::path::{Path, PathBuf};

pub(super) const BACKUP_PREFIX: &str = "refs/goodboy/backup";

const BACKUP_KEEP_SECS: u64 = 30 * 24 * 60 * 60;

const KEPT_BACKUP_CAP: usize = 20;

pub(super) fn backup_namespace(branch: &str) -> String {
    let encoded: String = branch.bytes().map(|byte| format!("{byte:02x}")).collect();
    format!("{BACKUP_PREFIX}/b-{encoded}")
}

pub(super) const KEPT_STAMP: &str = "keep-";

fn is_stamp(stamp: &str) -> bool {
    let digits = stamp.strip_prefix(KEPT_STAMP).unwrap_or(stamp);
    !digits.is_empty() && digits.bytes().all(|byte| byte.is_ascii_digit())
}

pub(crate) fn is_backup_of(branch: &str, ref_name: &str) -> bool {
    ref_name
        .strip_prefix(&format!("{}/", backup_namespace(branch)))
        .is_some_and(is_stamp)
}

pub(super) fn now_nanos() -> u128 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|elapsed| elapsed.as_nanos())
        .unwrap_or_default()
}

fn created_at_of(ref_name: &str) -> u64 {
    ref_name
        .rsplit('/')
        .next()
        .map(|stamp| stamp.strip_prefix(KEPT_STAMP).unwrap_or(stamp))
        .and_then(|stamp| stamp.parse::<u128>().ok())
        .map(|nanos| (nanos / 1_000_000_000) as u64)
        .unwrap_or_default()
}

fn legacy_backup_of(ref_name: &str) -> Option<(&str, &str)> {
    let rest = ref_name.strip_prefix(&format!("{BACKUP_PREFIX}/"))?;
    let (slug, stamp) = rest.split_once('/')?;
    let is_legacy = !slug.starts_with("b-")
        && !stamp.is_empty()
        && stamp.bytes().all(|byte| byte.is_ascii_digit());
    is_legacy.then_some((slug, stamp))
}

fn backup_refs(cwd: &Path) -> Result<Vec<(String, String, String)>, WorktreeError> {
    let raw = git(
        cwd,
        &[
            "for-each-ref",
            "--format=%(refname)%1f%(objectname)%1f%(subject)",
            BACKUP_PREFIX,
        ],
    )?;
    Ok(raw
        .lines()
        .filter_map(|line| {
            let mut parts = line.split('\u{1f}');
            let ref_name = parts.next()?.trim().to_string();
            let sha = parts.next()?.trim().to_string();
            let subject = parts.next().unwrap_or_default().trim().to_string();
            Some((ref_name, sha, subject))
        })
        .collect())
}

pub(crate) fn list_backups(cwd: &Path, branch: &str) -> Result<Vec<HistoryBackup>, WorktreeError> {
    let slug = sanitize_slug(branch);
    let mut backups: Vec<HistoryBackup> = backup_refs(cwd)?
        .into_iter()
        .filter_map(|(ref_name, sha, subject)| {
            let is_legacy = legacy_backup_of(&ref_name).is_some_and(|(legacy, _)| legacy == slug);
            if !is_legacy && !is_backup_of(branch, &ref_name) {
                return None;
            }
            Some(HistoryBackup {
                created_at: created_at_of(&ref_name),
                ref_name,
                sha,
                subject,
                is_legacy,
            })
        })
        .collect();
    backups.sort_by_key(|backup| std::cmp::Reverse(backup.created_at));
    Ok(backups)
}

pub(crate) fn prune_backups(cwd: &Path) {
    prune_backups_before(
        cwd,
        crate::util::now_secs().saturating_sub(BACKUP_KEEP_SECS),
    );
}

fn stamp_of(ref_name: &str) -> Option<(bool, u128)> {
    let stamp = ref_name.rsplit('/').next()?;
    let digits = stamp.strip_prefix(KEPT_STAMP);
    let nanos = digits.unwrap_or(stamp).parse::<u128>().ok()?;
    Some((digits.is_some(), nanos))
}

fn is_kept_elsewhere(cwd: &Path, ref_name: &str, sha: &str) -> bool {
    git(
        cwd,
        &[
            "for-each-ref",
            "--format=%(refname)",
            "--contains",
            sha,
            "refs/heads",
            "refs/remotes",
            "refs/tags",
            BACKUP_PREFIX,
        ],
    )
    .is_ok_and(|raw| {
        raw.lines().map(str::trim).any(|line| {
            line != ref_name
                && (!line.starts_with(BACKUP_PREFIX)
                    || stamp_of(line).is_some_and(|(is_kept, _)| is_kept))
        })
    })
}

type BackupSpaces = HashMap<String, Vec<(bool, u128, String, String)>>;

fn backup_spaces(cwd: &Path) -> Option<BackupSpaces> {
    let refs = backup_refs(cwd).ok()?;
    let mut spaces: BackupSpaces = HashMap::new();
    for (ref_name, sha, _) in refs {
        if legacy_backup_of(&ref_name).is_some() || !ref_name.contains("/b-") {
            continue;
        }
        let (Some((space, _)), Some((is_kept, nanos))) =
            (ref_name.rsplit_once('/'), stamp_of(&ref_name))
        else {
            continue;
        };
        spaces
            .entry(space.to_string())
            .or_default()
            .push((is_kept, nanos, ref_name.clone(), sha));
    }
    for backups in spaces.values_mut() {
        backups.sort_by_key(|backup| std::cmp::Reverse(backup.1));
    }
    Some(spaces)
}

pub(super) fn prune_backups_before(cwd: &Path, cutoff: u64) {
    let Some(spaces) = backup_spaces(cwd) else {
        return;
    };
    for backups in spaces.values() {
        for (is_kept, _, ref_name, sha) in backups.iter().skip(1) {
            let created = created_at_of(ref_name);
            if !*is_kept && created > 0 && created < cutoff {
                let _ = git_run(cwd, &["update-ref", "-d", ref_name, sha], None, None);
            }
        }
    }
    let Some(spaces) = backup_spaces(cwd) else {
        return;
    };
    for backups in spaces.values() {
        let mut kept_seen = 0;
        for (index, (is_kept, _, ref_name, sha)) in backups.iter().enumerate() {
            if !*is_kept {
                continue;
            }
            kept_seen += 1;
            if index > 0 && kept_seen > KEPT_BACKUP_CAP && is_kept_elsewhere(cwd, ref_name, sha) {
                let _ = git_run(cwd, &["update-ref", "-d", ref_name, sha], None, None);
            }
        }
    }
}

#[tauri::command]
pub async fn history_backups_list(
    worktree_path: String,
    branch: String,
) -> Result<Vec<HistoryBackup>, WorktreeError> {
    tauri::async_runtime::spawn_blocking(move || {
        let cwd = PathBuf::from(&worktree_path);
        if !cwd.exists() {
            return Err(WorktreeError::RepoNotFound(worktree_path));
        }
        list_backups(&cwd, &branch)
    })
    .await
    .map_err(|e| WorktreeError::Io(std::io::Error::other(e.to_string())))?
}
