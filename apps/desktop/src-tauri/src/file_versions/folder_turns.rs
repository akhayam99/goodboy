use std::collections::HashMap;
use std::fs;
use std::sync::PoisonError;

use serde::{Deserialize, Serialize};

use super::folder_store::{
    copy_file_into, derived_uuid, folder_lock, has_staging, is_cancelled, load_index,
    locate_folder, mirror_hash, open_folder, read_json, remove_if_present, stored_name_for,
    sync_mirror, walk_folder, write_index, write_json_atomic, CopyMethod, FolderPaths, FolderSkip,
    IndexEntry, Store,
};
use super::{FileVersionsError, FinalizedVersion, DEFAULT_SIZE_CAP_BYTES};

const MANIFEST_VERSION: u32 = 1;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum TurnKind {
    Turn,
    Restore,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ChangeKind {
    Added,
    Modified,
    Deleted,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TurnChange {
    pub(super) relative_path: String,
    pub(super) change: ChangeKind,
    pub(super) before_hash: Option<String>,
    pub(super) after_hash: Option<String>,
    pub(super) before_size_bytes: Option<u64>,
    pub(super) after_size_bytes: Option<u64>,
    pub(super) version_id: Option<String>,
    pub(super) stored_name: Option<String>,
    #[serde(default)]
    pub(super) is_pruned: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TurnManifest {
    pub(super) version: u32,
    pub(super) session_id: String,
    pub(super) run_id: String,
    pub(super) folder_id: Option<String>,
    pub(super) folder_path: String,
    pub(super) kind: TurnKind,
    pub(super) restores_run_id: Option<String>,
    pub(super) started_at_ms: i64,
    pub(super) finished_at_ms: i64,
    pub(super) changes: Vec<TurnChange>,
    pub(super) skipped: Vec<FolderSkip>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct StagingRecord {
    pub(super) version: u32,
    pub(super) session_id: String,
    pub(super) run_id: String,
    pub(super) folder_path: String,
    pub(super) folder_id: Option<String>,
    pub(super) started_at_ms: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FolderStatus {
    pub(super) folder_path: String,
    pub(super) is_ready: bool,
    pub(super) is_turn_open: bool,
    pub(super) file_count: usize,
    pub(super) kept_bytes: u64,
    pub(super) skipped: Vec<FolderSkip>,
    pub(super) method: Option<CopyMethod>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FolderBeginResult {
    pub(super) run_id: String,
    pub(super) was_ready: bool,
    pub(super) copied: usize,
    pub(super) method: Option<CopyMethod>,
    pub(super) skipped: Vec<FolderSkip>,
    pub(super) recovered: Vec<FolderFinalizeResult>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FolderFinalizeResult {
    pub(super) session_id: String,
    pub(super) run_id: String,
    pub(super) turn: Option<TurnManifest>,
    pub(super) kept: Vec<FinalizedVersion>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StagedFolderRun {
    pub(super) folder_path: String,
    pub(super) session_id: String,
    pub(super) run_id: String,
    pub(super) started_at_ms: i64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FolderPrepareArgs {
    pub(super) folder_path: String,
    pub(super) folder_id: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FolderPathArgs {
    pub(super) folder_path: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FolderBeginArgs {
    pub(super) folder_path: String,
    pub(super) folder_id: Option<String>,
    pub(super) session_id: String,
    pub(super) run_id: String,
    pub(super) size_cap_bytes: Option<u64>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FolderRunArgs {
    pub(super) folder_path: String,
    pub(super) session_id: String,
    pub(super) run_id: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FolderSessionArgs {
    pub(super) folder_path: String,
    pub(super) session_id: String,
}

pub(super) fn require_uuid(value: &str, error: FileVersionsError) -> Result<(), FileVersionsError> {
    match super::validate_uuid(value) {
        true => Ok(()),
        false => Err(error),
    }
}

pub(super) fn require_run_id(value: &str) -> Result<(), FileVersionsError> {
    let is_safe = !value.is_empty()
        && value.len() <= 128
        && value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || byte == b'-' || byte == b'_');
    match is_safe {
        true => Ok(()),
        false => Err(FileVersionsError::InvalidRunId),
    }
}

fn status_of(
    folder: &FolderPaths,
    method: Option<CopyMethod>,
) -> Result<FolderStatus, FileVersionsError> {
    let index = load_index(folder)?;
    Ok(FolderStatus {
        folder_path: folder.root.to_string_lossy().into_owned(),
        is_ready: index.is_ready,
        is_turn_open: has_staging(folder),
        file_count: index.entries.len(),
        kept_bytes: index.kept_bytes(),
        skipped: index.skipped,
        method,
    })
}

pub(super) fn prepare_folder(
    store: &Store,
    args: FolderPrepareArgs,
) -> Result<FolderStatus, FileVersionsError> {
    let folder = open_folder(store, &args.folder_path)?;
    let lock = folder_lock(&folder.key);
    let _guard = lock.lock().unwrap_or_else(PoisonError::into_inner);
    if has_staging(&folder) {
        return status_of(&folder, None);
    }
    let mut index = load_index(&folder)?;
    if args.folder_id.is_some() {
        index.folder_id = args.folder_id;
    }
    let walk = walk_folder(&folder.root, DEFAULT_SIZE_CAP_BYTES)?;
    let key = folder.key.clone();
    let outcome = sync_mirror(&folder, &mut index, &walk, &|| is_cancelled(&key))?;
    index.is_ready = true;
    write_index(&folder, &index)?;
    status_of(&folder, outcome.method)
}

pub(super) fn folder_status(
    store: &Store,
    args: FolderPathArgs,
) -> Result<FolderStatus, FileVersionsError> {
    let folder = locate_folder(store, &args.folder_path)?;
    status_of(&folder, None)
}

fn read_staging(
    folder: &FolderPaths,
    run_id: &str,
) -> Result<Option<StagingRecord>, FileVersionsError> {
    read_json::<StagingRecord>(&folder.staging_path(run_id))
}

fn leftover_runs(
    folder: &FolderPaths,
    run_id: &str,
) -> Result<Vec<StagingRecord>, FileVersionsError> {
    let entries = match fs::read_dir(folder.staging_dir()) {
        Ok(entries) => entries,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(Vec::new()),
        Err(error) => return Err(FileVersionsError::Io(error)),
    };
    let mut records = Vec::new();
    for entry in entries {
        let path = entry?.path();
        if path.extension().and_then(|value| value.to_str()) != Some("json") {
            continue;
        }
        match read_json::<StagingRecord>(&path) {
            Ok(Some(record)) if record.run_id != run_id => records.push(record),
            Ok(_) => {}
            Err(FileVersionsError::Json(_)) => remove_if_present(&path)?,
            Err(error) => return Err(error),
        }
    }
    records.sort_by_key(|record| record.started_at_ms);
    Ok(records)
}

pub(super) fn begin_folder_turn(
    store: &Store,
    args: FolderBeginArgs,
) -> Result<FolderBeginResult, FileVersionsError> {
    require_uuid(&args.session_id, FileVersionsError::InvalidSessionId)?;
    require_run_id(&args.run_id)?;
    let folder = open_folder(store, &args.folder_path)?;
    let lock = folder_lock(&folder.key);
    let _guard = lock.lock().unwrap_or_else(PoisonError::into_inner);
    if folder.staging_path(&args.run_id).exists()
        || folder.turn_path(&args.session_id, &args.run_id).exists()
    {
        return Err(FileVersionsError::StagingAlreadyExists);
    }
    let mut recovered = Vec::new();
    for record in leftover_runs(&folder, &args.run_id)? {
        recovered.push(finalize_locked(
            store,
            &folder,
            &record.session_id,
            &record.run_id,
        )?);
    }
    let mut index = load_index(&folder)?;
    let was_ready = index.is_ready;
    if args.folder_id.is_some() {
        index.folder_id = args.folder_id.clone();
    }
    let size_cap = args.size_cap_bytes.unwrap_or(DEFAULT_SIZE_CAP_BYTES);
    let walk = walk_folder(&folder.root, size_cap)?;
    let outcome = sync_mirror(&folder, &mut index, &walk, &|| false)?;
    index.is_ready = true;
    write_index(&folder, &index)?;
    let record = StagingRecord {
        version: MANIFEST_VERSION,
        session_id: args.session_id,
        run_id: args.run_id.clone(),
        folder_path: folder.root.to_string_lossy().into_owned(),
        folder_id: index.folder_id.clone(),
        started_at_ms: crate::util::now_ms(),
    };
    write_json_atomic(&folder.staging_path(&args.run_id), &record)?;
    Ok(FolderBeginResult {
        run_id: args.run_id,
        was_ready,
        copied: outcome.copied,
        method: outcome.method,
        skipped: walk.skipped,
        recovered,
    })
}

pub(super) fn kept_of(manifest: &TurnManifest) -> Vec<FinalizedVersion> {
    manifest
        .changes
        .iter()
        .filter_map(|change| {
            let id = change.version_id.clone()?;
            let stored_name = change.stored_name.clone()?;
            let content_hash = change.before_hash.clone()?;
            let change_kind = match change.after_hash {
                Some(_) => "modified",
                None => "deleted",
            };
            Some(FinalizedVersion {
                id,
                relative_path: change.relative_path.clone(),
                stored_name,
                size_bytes: change.before_size_bytes.unwrap_or(0),
                content_hash,
                change_kind: change_kind.to_string(),
            })
        })
        .collect()
}

pub(super) fn read_turn(
    folder: &FolderPaths,
    session_id: &str,
    run_id: &str,
) -> Result<Option<TurnManifest>, FileVersionsError> {
    read_json::<TurnManifest>(&folder.turn_path(session_id, run_id))
}

struct Planned {
    change: TurnChange,
    entry: Option<IndexEntry>,
    source: Option<std::path::PathBuf>,
}

fn finalize_locked(
    store: &Store,
    folder: &FolderPaths,
    session_id: &str,
    run_id: &str,
) -> Result<FolderFinalizeResult, FileVersionsError> {
    if let Some(turn) = read_turn(folder, session_id, run_id)? {
        remove_if_present(&folder.staging_path(run_id))?;
        return Ok(FolderFinalizeResult {
            session_id: session_id.to_string(),
            run_id: run_id.to_string(),
            kept: kept_of(&turn),
            turn: Some(turn),
        });
    }
    let Some(record) = read_staging(folder, run_id)? else {
        return Ok(FolderFinalizeResult {
            session_id: session_id.to_string(),
            run_id: run_id.to_string(),
            turn: None,
            kept: Vec::new(),
        });
    };
    if record.session_id != session_id {
        return Err(FileVersionsError::SessionMarkerMismatch);
    }
    let mut index = load_index(folder)?;
    let walk = walk_folder(&folder.root, DEFAULT_SIZE_CAP_BYTES)?;
    let live: HashMap<&str, &super::folder_store::WalkFile> = walk
        .files
        .iter()
        .map(|file| (file.relative_path.as_str(), file))
        .collect();
    let mut planned: Vec<Planned> = Vec::new();
    let mut refreshed: Vec<(String, IndexEntry)> = Vec::new();
    for (relative, entry) in &index.entries {
        let Some(file) = live.get(relative.as_str()) else {
            planned.push(Planned {
                change: TurnChange {
                    relative_path: relative.clone(),
                    change: ChangeKind::Deleted,
                    before_hash: Some(mirror_hash(folder, relative, entry)?),
                    after_hash: None,
                    before_size_bytes: Some(entry.stat.size_bytes),
                    after_size_bytes: None,
                    version_id: None,
                    stored_name: None,
                    is_pruned: false,
                },
                entry: None,
                source: None,
            });
            continue;
        };
        if file.stat == entry.stat {
            continue;
        }
        let after = super::hash_file(&file.path)?;
        let before = mirror_hash(folder, relative, entry)?;
        if after == before {
            refreshed.push((
                relative.clone(),
                IndexEntry {
                    stat: file.stat,
                    content_hash: Some(before),
                },
            ));
            continue;
        }
        planned.push(Planned {
            change: TurnChange {
                relative_path: relative.clone(),
                change: ChangeKind::Modified,
                before_hash: Some(before),
                after_hash: Some(after),
                before_size_bytes: Some(entry.stat.size_bytes),
                after_size_bytes: Some(file.stat.size_bytes),
                version_id: None,
                stored_name: None,
                is_pruned: false,
            },
            entry: Some(IndexEntry {
                stat: file.stat,
                content_hash: None,
            }),
            source: Some(file.path.clone()),
        });
    }
    for file in &walk.files {
        if index.entries.contains_key(&file.relative_path) {
            continue;
        }
        planned.push(Planned {
            change: TurnChange {
                relative_path: file.relative_path.clone(),
                change: ChangeKind::Added,
                before_hash: None,
                after_hash: Some(super::hash_file(&file.path)?),
                before_size_bytes: None,
                after_size_bytes: Some(file.stat.size_bytes),
                version_id: None,
                stored_name: None,
                is_pruned: false,
            },
            entry: Some(IndexEntry {
                stat: file.stat,
                content_hash: None,
            }),
            source: Some(file.path.clone()),
        });
    }
    planned.sort_by(|left, right| left.change.relative_path.cmp(&right.change.relative_path));
    let session_store = store.session_store(session_id);
    for item in &mut planned {
        if item.change.change == ChangeKind::Added {
            continue;
        }
        let version_id = derived_uuid(&[run_id, &folder.key, &item.change.relative_path]);
        let stored_name = stored_name_for(&version_id, &item.change.relative_path)?;
        copy_file_into(
            &folder.mirror_path(&item.change.relative_path),
            &session_store.join(&stored_name),
            true,
        )?;
        item.change.version_id = Some(version_id);
        item.change.stored_name = Some(stored_name);
    }
    let manifest = TurnManifest {
        version: MANIFEST_VERSION,
        session_id: session_id.to_string(),
        run_id: run_id.to_string(),
        folder_id: record.folder_id.clone(),
        folder_path: folder.root.to_string_lossy().into_owned(),
        kind: TurnKind::Turn,
        restores_run_id: None,
        started_at_ms: record.started_at_ms,
        finished_at_ms: crate::util::now_ms(),
        changes: planned.iter().map(|item| item.change.clone()).collect(),
        skipped: walk.skipped.clone(),
    };
    if !manifest.changes.is_empty() {
        write_json_atomic(&folder.turn_path(session_id, run_id), &manifest)?;
    }
    for item in planned {
        let relative = item.change.relative_path;
        let (Some(source), Some(entry)) = (item.source, item.entry) else {
            remove_if_present(&folder.mirror_path(&relative))?;
            index.entries.remove(&relative);
            continue;
        };
        match copy_file_into(&source, &folder.mirror_path(&relative), true) {
            Ok(_) => {
                index.entries.insert(relative, entry);
            }
            Err(_) => {
                index.entries.remove(&relative);
            }
        }
    }
    for (relative, entry) in refreshed {
        index.entries.insert(relative, entry);
    }
    index.skipped = walk.skipped;
    write_index(folder, &index)?;
    remove_if_present(&folder.staging_path(run_id))?;
    let turn = (!manifest.changes.is_empty()).then_some(manifest);
    Ok(FolderFinalizeResult {
        session_id: session_id.to_string(),
        run_id: run_id.to_string(),
        kept: turn.as_ref().map(kept_of).unwrap_or_default(),
        turn,
    })
}

pub(super) fn finalize_folder_turn(
    store: &Store,
    args: FolderRunArgs,
) -> Result<FolderFinalizeResult, FileVersionsError> {
    require_uuid(&args.session_id, FileVersionsError::InvalidSessionId)?;
    require_run_id(&args.run_id)?;
    let folder = open_folder(store, &args.folder_path)?;
    let lock = folder_lock(&folder.key);
    let _guard = lock.lock().unwrap_or_else(PoisonError::into_inner);
    finalize_locked(store, &folder, &args.session_id, &args.run_id)
}

pub(super) fn discard_folder_turn(
    store: &Store,
    args: FolderRunArgs,
) -> Result<bool, FileVersionsError> {
    require_uuid(&args.session_id, FileVersionsError::InvalidSessionId)?;
    require_run_id(&args.run_id)?;
    let folder = locate_folder(store, &args.folder_path)?;
    let lock = folder_lock(&folder.key);
    let _guard = lock.lock().unwrap_or_else(PoisonError::into_inner);
    let Some(record) = read_staging(&folder, &args.run_id)? else {
        return Ok(false);
    };
    if record.session_id != args.session_id {
        return Err(FileVersionsError::SessionMarkerMismatch);
    }
    remove_if_present(&folder.staging_path(&args.run_id))?;
    Ok(true)
}

pub(super) fn list_staged_folder_runs(
    store: &Store,
) -> Result<Vec<StagedFolderRun>, FileVersionsError> {
    let entries = match fs::read_dir(&store.folders) {
        Ok(entries) => entries,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(Vec::new()),
        Err(error) => return Err(FileVersionsError::Io(error)),
    };
    let mut runs = Vec::new();
    for entry in entries {
        let staging = entry?.path().join("staging");
        let Ok(records) = fs::read_dir(&staging) else {
            continue;
        };
        for record in records {
            let path = record?.path();
            let Ok(Some(parsed)) = read_json::<StagingRecord>(&path) else {
                continue;
            };
            runs.push(StagedFolderRun {
                folder_path: parsed.folder_path,
                session_id: parsed.session_id,
                run_id: parsed.run_id,
                started_at_ms: parsed.started_at_ms,
            });
        }
    }
    runs.sort_by(|left, right| {
        left.folder_path
            .cmp(&right.folder_path)
            .then(left.run_id.cmp(&right.run_id))
    });
    Ok(runs)
}

pub(super) fn read_session_turns(
    folder: &FolderPaths,
    session_id: &str,
) -> Result<Vec<TurnManifest>, FileVersionsError> {
    let entries = match fs::read_dir(folder.session_turns_dir(session_id)) {
        Ok(entries) => entries,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(Vec::new()),
        Err(error) => return Err(FileVersionsError::Io(error)),
    };
    let mut turns = Vec::new();
    for entry in entries {
        let path = entry?.path();
        if path.extension().and_then(|value| value.to_str()) != Some("json") {
            continue;
        }
        let Ok(Some(turn)) = read_json::<TurnManifest>(&path) else {
            continue;
        };
        if turn.session_id != session_id {
            continue;
        }
        turns.push(turn);
    }
    turns.sort_by(|left, right| {
        right
            .finished_at_ms
            .cmp(&left.finished_at_ms)
            .then(right.run_id.cmp(&left.run_id))
    });
    Ok(turns)
}

pub(super) fn list_folder_turns(
    store: &Store,
    args: FolderSessionArgs,
) -> Result<Vec<TurnManifest>, FileVersionsError> {
    require_uuid(&args.session_id, FileVersionsError::InvalidSessionId)?;
    let folder = locate_folder(store, &args.folder_path)?;
    read_session_turns(&folder, &args.session_id)
}

pub(super) fn forget_folder(store: &Store, args: FolderPathArgs) -> Result<(), FileVersionsError> {
    let folder = locate_folder(store, &args.folder_path)?;
    if has_staging(&folder) {
        return Err(FileVersionsError::FolderBusy);
    }
    super::folder_store::mark_cancelled(&folder.key, true);
    let lock = folder_lock(&folder.key);
    let guard = lock.lock().unwrap_or_else(PoisonError::into_inner);
    if has_staging(&folder) {
        drop(guard);
        super::folder_store::mark_cancelled(&folder.key, false);
        return Err(FileVersionsError::FolderBusy);
    }
    let removed = remove_mirror(&folder);
    drop(guard);
    super::folder_store::mark_cancelled(&folder.key, false);
    removed
}

fn remove_mirror(folder: &FolderPaths) -> Result<(), FileVersionsError> {
    match fs::remove_dir_all(folder.mirror_dir()) {
        Ok(()) => {}
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
        Err(error) => return Err(FileVersionsError::Io(error)),
    }
    remove_if_present(&folder.index_path())?;
    let _ = fs::remove_dir_all(folder.staging_dir());
    let is_empty = fs::read_dir(&folder.dir)
        .map(|mut entries| entries.next().is_none())
        .unwrap_or(false);
    if is_empty {
        let _ = fs::remove_dir(&folder.dir);
    }
    Ok(())
}
