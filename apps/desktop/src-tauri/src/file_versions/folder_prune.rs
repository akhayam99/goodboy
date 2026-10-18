use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::Path;
use std::sync::PoisonError;

use serde::{Deserialize, Serialize};

use super::folder_store::{
    folder_lock, load_index, locate_folder, remove_if_present, write_json_atomic, FolderPaths,
    Store,
};
use super::folder_turns::{read_session_turns, FolderPathArgs, TurnManifest};
use super::FileVersionsError;

pub(super) const KEEP_AFTER_END_MS: i64 = 30 * 24 * 60 * 60 * 1000;
pub(super) const MIN_CAP_BYTES: u64 = 1024 * 1024 * 1024;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PruneSession {
    pub(super) session_id: String,
    pub(super) ended_at_ms: Option<i64>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FolderPruneArgs {
    pub(super) folder_path: String,
    pub(super) sessions: Vec<PruneSession>,
    pub(super) now_ms: i64,
    pub(super) cap_bytes: Option<u64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PrunedVersion {
    pub(super) session_id: String,
    pub(super) run_id: String,
    pub(super) version_id: String,
    pub(super) stored_name: String,
    pub(super) relative_path: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FolderPruneResult {
    pub(super) pruned: Vec<PrunedVersion>,
    pub(super) removed_turns: usize,
    pub(super) version_bytes: u64,
    pub(super) cap_bytes: u64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FolderSize {
    pub(super) folder_path: String,
    pub(super) is_ready: bool,
    pub(super) file_count: usize,
    pub(super) kept_bytes: u64,
    pub(super) version_bytes: u64,
    pub(super) version_count: usize,
    pub(super) cap_bytes: u64,
}

pub(super) fn cap_for(kept_bytes: u64) -> u64 {
    kept_bytes.max(MIN_CAP_BYTES)
}

fn session_ids(folder: &FolderPaths) -> Result<Vec<String>, FileVersionsError> {
    let entries = match fs::read_dir(folder.turns_dir()) {
        Ok(entries) => entries,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(Vec::new()),
        Err(error) => return Err(FileVersionsError::Io(error)),
    };
    let mut ids = Vec::new();
    for entry in entries {
        let entry = entry?;
        if !entry.path().is_dir() {
            continue;
        }
        let id = entry.file_name().to_string_lossy().into_owned();
        if super::validate_uuid(&id) {
            ids.push(id);
        }
    }
    ids.sort();
    Ok(ids)
}

pub(super) fn list_folder_sessions(
    store: &Store,
    args: FolderPathArgs,
) -> Result<Vec<String>, FileVersionsError> {
    let folder = locate_folder(store, &args.folder_path)?;
    session_ids(&folder)
}

fn remove_copy(store: &Store, session_id: &str, stored_name: &str) -> bool {
    let Ok(name) = super::validate_stored_name(stored_name) else {
        return false;
    };
    remove_if_present(&store.session_store(session_id).join(name)).is_ok()
}

fn version_totals(turns: &[TurnManifest]) -> (u64, usize) {
    turns
        .iter()
        .flat_map(|turn| turn.changes.iter())
        .filter(|change| change.stored_name.is_some() && !change.is_pruned)
        .fold((0, 0), |(bytes, count), change| {
            (bytes + change.before_size_bytes.unwrap_or(0), count + 1)
        })
}

fn all_turns(folder: &FolderPaths) -> Result<Vec<TurnManifest>, FileVersionsError> {
    let mut turns = Vec::new();
    for session_id in session_ids(folder)? {
        turns.extend(read_session_turns(folder, &session_id)?);
    }
    Ok(turns)
}

pub(super) fn folder_size(
    store: &Store,
    args: FolderPathArgs,
) -> Result<FolderSize, FileVersionsError> {
    let folder = locate_folder(store, &args.folder_path)?;
    let index = load_index(&folder)?;
    let (version_bytes, version_count) = version_totals(&all_turns(&folder)?);
    let kept_bytes = index.kept_bytes();
    Ok(FolderSize {
        folder_path: folder.root.to_string_lossy().into_owned(),
        is_ready: index.is_ready,
        file_count: index.entries.len(),
        kept_bytes,
        version_bytes,
        version_count,
        cap_bytes: cap_for(kept_bytes),
    })
}

struct Candidate {
    turn: usize,
    change: usize,
    finished_at_ms: i64,
    size_bytes: u64,
    is_protected: bool,
}

fn pruned_of(turn: &TurnManifest, change: usize) -> Option<PrunedVersion> {
    let entry = turn.changes.get(change)?;
    Some(PrunedVersion {
        session_id: turn.session_id.clone(),
        run_id: turn.run_id.clone(),
        version_id: entry.version_id.clone()?,
        stored_name: entry.stored_name.clone()?,
        relative_path: entry.relative_path.clone(),
    })
}

fn drop_ended_sessions(
    store: &Store,
    folder: &FolderPaths,
    ended: &HashSet<String>,
    pruned: &mut Vec<PrunedVersion>,
) -> Result<usize, FileVersionsError> {
    let mut removed_turns = 0usize;
    for session_id in ended {
        for turn in read_session_turns(folder, session_id)? {
            let mut is_clean = true;
            for (index, change) in turn.changes.iter().enumerate() {
                let Some(stored_name) = &change.stored_name else {
                    continue;
                };
                if change.is_pruned {
                    continue;
                }
                if !remove_copy(store, session_id, stored_name) {
                    is_clean = false;
                    continue;
                }
                if let Some(version) = pruned_of(&turn, index) {
                    pruned.push(version);
                }
            }
            if !is_clean {
                continue;
            }
            remove_if_present(&folder.turn_path(session_id, &turn.run_id))?;
            removed_turns += 1;
        }
        let _ = fs::remove_dir(folder.session_turns_dir(session_id));
    }
    Ok(removed_turns)
}

pub(super) fn prune_folder(
    store: &Store,
    args: FolderPruneArgs,
) -> Result<FolderPruneResult, FileVersionsError> {
    let folder = locate_folder(store, &args.folder_path)?;
    let lock = folder_lock(&folder.key);
    let _guard = lock.lock().unwrap_or_else(PoisonError::into_inner);
    let known: HashMap<&str, Option<i64>> = args
        .sessions
        .iter()
        .filter(|session| super::validate_uuid(&session.session_id))
        .map(|session| (session.session_id.as_str(), session.ended_at_ms))
        .collect();
    let ended: HashSet<String> = known
        .iter()
        .filter_map(|(id, ended_at)| {
            let ended_at = (*ended_at)?;
            (args.now_ms - ended_at > KEEP_AFTER_END_MS).then(|| (*id).to_string())
        })
        .collect();
    let mut pruned = Vec::new();
    let removed_turns = drop_ended_sessions(store, &folder, &ended, &mut pruned)?;
    let mut turns = all_turns(&folder)?;
    let index = load_index(&folder)?;
    let cap_bytes = args
        .cap_bytes
        .unwrap_or_else(|| cap_for(index.kept_bytes()));
    let mut newest: HashMap<(String, String), i64> = HashMap::new();
    for turn in &turns {
        let is_live = matches!(known.get(turn.session_id.as_str()), Some(None));
        if !is_live {
            continue;
        }
        for change in &turn.changes {
            if change.stored_name.is_none() || change.is_pruned {
                continue;
            }
            let key = (turn.session_id.clone(), change.relative_path.clone());
            let slot = newest.entry(key).or_insert(i64::MIN);
            *slot = (*slot).max(turn.finished_at_ms);
        }
    }
    let mut candidates = Vec::new();
    for (turn_index, turn) in turns.iter().enumerate() {
        let state = known.get(turn.session_id.as_str());
        for (change_index, change) in turn.changes.iter().enumerate() {
            if change.stored_name.is_none() || change.is_pruned {
                continue;
            }
            let key = (turn.session_id.clone(), change.relative_path.clone());
            let is_newest_live = matches!(state, Some(None))
                && newest.get(&key).copied() == Some(turn.finished_at_ms);
            candidates.push(Candidate {
                turn: turn_index,
                change: change_index,
                finished_at_ms: turn.finished_at_ms,
                size_bytes: change.before_size_bytes.unwrap_or(0),
                is_protected: state.is_none() || is_newest_live,
            });
        }
    }
    let mut total: u64 = candidates
        .iter()
        .map(|candidate| candidate.size_bytes)
        .sum();
    candidates.sort_by_key(|candidate| candidate.finished_at_ms);
    let mut touched: HashSet<usize> = HashSet::new();
    for candidate in &candidates {
        if total <= cap_bytes {
            break;
        }
        if candidate.is_protected {
            continue;
        }
        let turn = &turns[candidate.turn];
        let Some(stored_name) = turn.changes[candidate.change].stored_name.clone() else {
            continue;
        };
        if !remove_copy(store, &turn.session_id, &stored_name) {
            continue;
        }
        if let Some(version) = pruned_of(turn, candidate.change) {
            pruned.push(version);
        }
        turns[candidate.turn].changes[candidate.change].is_pruned = true;
        total = total.saturating_sub(candidate.size_bytes);
        touched.insert(candidate.turn);
    }
    for turn_index in touched {
        let turn = &turns[turn_index];
        write_json_atomic(&folder.turn_path(&turn.session_id, &turn.run_id), turn)?;
    }
    Ok(FolderPruneResult {
        pruned,
        removed_turns,
        version_bytes: total,
        cap_bytes,
    })
}

fn allocated_tree_bytes(root: &Path) -> u64 {
    let mut total = 0u64;
    let mut stack = vec![root.to_path_buf()];
    while let Some(dir) = stack.pop() {
        let Ok(entries) = fs::read_dir(&dir) else {
            continue;
        };
        for entry in entries.flatten() {
            let Ok(metadata) = fs::symlink_metadata(entry.path()) else {
                continue;
            };
            if metadata.is_dir() {
                stack.push(entry.path());
                continue;
            }
            total += crate::worktree::allocated_bytes(&metadata);
        }
    }
    total
}

pub(crate) fn saved_versions_bytes_blocking(data_dir: &Path) -> u64 {
    allocated_tree_bytes(&data_dir.join(super::FILE_VERSIONS_DIR))
        + allocated_tree_bytes(&data_dir.join(super::folder_store::FOLDER_VERSIONS_DIR))
}
