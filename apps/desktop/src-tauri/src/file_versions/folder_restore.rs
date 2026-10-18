use std::fs;
use std::path::{Path, PathBuf};
use std::sync::PoisonError;

use serde::{Deserialize, Serialize};

use super::folder_store::{
    copy_file_into, derived_uuid, folder_lock, has_staging, load_index, locate_folder, mirror_hash,
    open_folder, remove_if_present, stored_name_for, write_json_atomic, FolderPaths, Store,
};
use super::folder_turns::{
    kept_of, read_session_turns, read_turn, require_run_id, require_uuid, ChangeKind, TurnChange,
    TurnKind, TurnManifest,
};
use super::{FileVersionsError, FinalizedVersion};

const MAX_READ_BYTES: u64 = 2 * 1024 * 1024;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FolderCheckArgs {
    pub(super) folder_path: String,
    pub(super) session_id: String,
    pub(super) run_id: String,
    pub(super) relative_paths: Option<Vec<String>>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FolderCheckResult {
    pub(super) changed_since: Vec<String>,
    pub(super) pending: Vec<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FolderRestoreArgs {
    pub(super) folder_path: String,
    pub(super) session_id: String,
    pub(super) run_id: String,
    pub(super) restore_run_id: String,
    pub(super) relative_paths: Option<Vec<String>>,
    #[serde(default)]
    pub(super) is_forced: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum RestoreStatus {
    Restored,
    ChangedSince,
    NothingToRestore,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FolderRestoreResult {
    pub(super) status: RestoreStatus,
    pub(super) changed_since: Vec<String>,
    pub(super) turn: Option<TurnManifest>,
    pub(super) kept: Vec<FinalizedVersion>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ReadSide {
    Before,
    After,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FolderReadArgs {
    pub(super) folder_path: String,
    pub(super) session_id: String,
    pub(super) run_id: String,
    pub(super) relative_path: String,
    pub(super) side: ReadSide,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum ReadKind {
    Text,
    Binary,
    Missing,
    Unavailable,
    TooLarge,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FolderReadResult {
    pub(super) kind: ReadKind,
    pub(super) text: Option<String>,
    pub(super) size_bytes: Option<u64>,
}

struct Current {
    hash: Option<String>,
    size_bytes: Option<u64>,
}

fn current_of(root: &Path, relative_path: &str) -> Result<Current, FileVersionsError> {
    let path = super::resolve_session_path(root, relative_path, false)?;
    let absent = Current {
        hash: None,
        size_bytes: None,
    };
    let Ok(metadata) = fs::symlink_metadata(&path) else {
        return Ok(absent);
    };
    if !metadata.file_type().is_file() {
        return Ok(absent);
    }
    Ok(Current {
        hash: Some(super::hash_file(&path)?),
        size_bytes: Some(metadata.len()),
    })
}

fn select<'a>(
    turn: &'a TurnManifest,
    relative_paths: &Option<Vec<String>>,
) -> Result<Vec<&'a TurnChange>, FileVersionsError> {
    let Some(paths) = relative_paths else {
        return Ok(turn.changes.iter().collect());
    };
    let mut selected = Vec::new();
    for path in paths {
        let change = turn
            .changes
            .iter()
            .find(|change| &change.relative_path == path)
            .ok_or(FileVersionsError::InvalidRelativePath)?;
        selected.push(change);
    }
    Ok(selected)
}

fn load_turn(
    folder: &FolderPaths,
    session_id: &str,
    run_id: &str,
) -> Result<TurnManifest, FileVersionsError> {
    read_turn(folder, session_id, run_id)?.ok_or(FileVersionsError::TurnMissing)
}

struct Pending<'a> {
    change: &'a TurnChange,
    current: Current,
}

fn plan<'a>(
    folder: &FolderPaths,
    changes: Vec<&'a TurnChange>,
) -> Result<(Vec<Pending<'a>>, Vec<String>), FileVersionsError> {
    let mut pending = Vec::new();
    let mut changed_since = Vec::new();
    for change in changes {
        let current = current_of(&folder.root, &change.relative_path)?;
        if current.hash == change.before_hash {
            continue;
        }
        if current.hash != change.after_hash {
            changed_since.push(change.relative_path.clone());
        }
        pending.push(Pending { change, current });
    }
    Ok((pending, changed_since))
}

pub(super) fn check_folder_restore(
    store: &Store,
    args: FolderCheckArgs,
) -> Result<FolderCheckResult, FileVersionsError> {
    require_uuid(&args.session_id, FileVersionsError::InvalidSessionId)?;
    require_run_id(&args.run_id)?;
    let folder = open_folder(store, &args.folder_path)?;
    let turn = load_turn(&folder, &args.session_id, &args.run_id)?;
    let (pending, changed_since) = plan(&folder, select(&turn, &args.relative_paths)?)?;
    Ok(FolderCheckResult {
        changed_since,
        pending: pending
            .iter()
            .map(|item| item.change.relative_path.clone())
            .collect(),
    })
}

fn stored_copy(
    store: &Store,
    session_id: &str,
    change: &TurnChange,
) -> Result<Option<PathBuf>, FileVersionsError> {
    let Some(stored_name) = &change.stored_name else {
        return Ok(None);
    };
    if change.is_pruned {
        return Ok(None);
    }
    let name = super::validate_stored_name(stored_name)?;
    let path = store.session_store(session_id).join(name);
    Ok(path.is_file().then_some(path))
}

pub(super) fn restore_folder_turn(
    store: &Store,
    args: FolderRestoreArgs,
) -> Result<FolderRestoreResult, FileVersionsError> {
    require_uuid(&args.session_id, FileVersionsError::InvalidSessionId)?;
    require_run_id(&args.run_id)?;
    require_run_id(&args.restore_run_id)?;
    let folder = open_folder(store, &args.folder_path)?;
    let lock = folder_lock(&folder.key);
    let _guard = lock.lock().unwrap_or_else(PoisonError::into_inner);
    if has_staging(&folder) {
        return Err(FileVersionsError::FolderBusy);
    }
    if folder
        .turn_path(&args.session_id, &args.restore_run_id)
        .exists()
    {
        return Err(FileVersionsError::StagingAlreadyExists);
    }
    let turn = load_turn(&folder, &args.session_id, &args.run_id)?;
    let (pending, changed_since) = plan(&folder, select(&turn, &args.relative_paths)?)?;
    if pending.is_empty() {
        return Ok(FolderRestoreResult {
            status: RestoreStatus::NothingToRestore,
            changed_since,
            turn: None,
            kept: Vec::new(),
        });
    }
    if !changed_since.is_empty() && !args.is_forced {
        return Ok(FolderRestoreResult {
            status: RestoreStatus::ChangedSince,
            changed_since,
            turn: None,
            kept: Vec::new(),
        });
    }
    let mut sources = Vec::new();
    for item in &pending {
        if item.change.before_hash.is_none() {
            sources.push(None);
            continue;
        }
        let source = stored_copy(store, &turn.session_id, item.change)?
            .ok_or(FileVersionsError::StoredCopyMissing)?;
        sources.push(Some(source));
    }
    let session_store = store.session_store(&args.session_id);
    let started_at_ms = crate::util::now_ms();
    let mut applied: Vec<TurnChange> = Vec::new();
    let mut failure: Option<FileVersionsError> = None;
    for (item, source) in pending.iter().zip(sources) {
        match apply_one(&folder, &session_store, &args.restore_run_id, item, source) {
            Ok(change) => applied.push(change),
            Err(error) => {
                failure = Some(error);
                break;
            }
        }
    }
    let manifest = TurnManifest {
        version: turn.version,
        session_id: args.session_id.clone(),
        run_id: args.restore_run_id.clone(),
        folder_id: turn.folder_id.clone(),
        folder_path: folder.root.to_string_lossy().into_owned(),
        kind: TurnKind::Restore,
        restores_run_id: Some(args.run_id.clone()),
        started_at_ms,
        finished_at_ms: crate::util::now_ms(),
        changes: applied,
        skipped: Vec::new(),
    };
    if !manifest.changes.is_empty() {
        write_json_atomic(
            &folder.turn_path(&args.session_id, &args.restore_run_id),
            &manifest,
        )?;
    }
    if let Some(error) = failure {
        return Err(error);
    }
    Ok(FolderRestoreResult {
        status: RestoreStatus::Restored,
        changed_since,
        kept: kept_of(&manifest),
        turn: Some(manifest),
    })
}

fn apply_one(
    folder: &FolderPaths,
    session_store: &Path,
    restore_run_id: &str,
    item: &Pending<'_>,
    source: Option<PathBuf>,
) -> Result<TurnChange, FileVersionsError> {
    let relative = &item.change.relative_path;
    let target = super::resolve_session_path(&folder.root, relative, source.is_some())?;
    let mut version_id = None;
    let mut stored_name = None;
    if item.current.hash.is_some() {
        let id = derived_uuid(&[restore_run_id, &folder.key, relative]);
        let name = stored_name_for(&id, relative)?;
        copy_file_into(&target, &session_store.join(&name), true)?;
        version_id = Some(id);
        stored_name = Some(name);
    }
    match &source {
        Some(path) => {
            copy_file_into(path, &target, true)?;
        }
        None => remove_if_present(&target)?,
    }
    let change = match (&item.current.hash, &item.change.before_hash) {
        (None, Some(_)) => ChangeKind::Added,
        (Some(_), None) => ChangeKind::Deleted,
        _ => ChangeKind::Modified,
    };
    Ok(TurnChange {
        relative_path: relative.clone(),
        change,
        before_hash: item.current.hash.clone(),
        after_hash: item.change.before_hash.clone(),
        before_size_bytes: item.current.size_bytes,
        after_size_bytes: item.change.before_size_bytes,
        version_id,
        stored_name,
        is_pruned: false,
    })
}

fn read_source(path: &Path) -> Result<FolderReadResult, FileVersionsError> {
    let size = fs::metadata(path)?.len();
    if size > MAX_READ_BYTES {
        return Ok(FolderReadResult {
            kind: ReadKind::TooLarge,
            text: None,
            size_bytes: Some(size),
        });
    }
    let bytes = fs::read(path)?;
    let text = String::from_utf8(bytes)
        .ok()
        .filter(|text| !text.contains('\0'));
    let kind = match text {
        Some(_) => ReadKind::Text,
        None => ReadKind::Binary,
    };
    Ok(FolderReadResult {
        kind,
        text,
        size_bytes: Some(size),
    })
}

fn find_after_copy(
    store: &Store,
    folder: &FolderPaths,
    relative_path: &str,
    hash: &str,
) -> Result<Option<PathBuf>, FileVersionsError> {
    if current_of(&folder.root, relative_path)?.hash.as_deref() == Some(hash) {
        return Ok(Some(super::resolve_session_path(
            &folder.root,
            relative_path,
            false,
        )?));
    }
    let index = load_index(folder)?;
    if let Some(entry) = index.entries.get(relative_path) {
        let mirror = folder.mirror_path(relative_path);
        if mirror.is_file() && mirror_hash(folder, relative_path, entry)? == hash {
            return Ok(Some(mirror));
        }
    }
    let Ok(sessions) = fs::read_dir(folder.turns_dir()) else {
        return Ok(None);
    };
    for session in sessions {
        let session_id = session?.file_name().to_string_lossy().into_owned();
        for turn in read_session_turns(folder, &session_id)? {
            for change in &turn.changes {
                if change.relative_path != relative_path
                    || change.before_hash.as_deref() != Some(hash)
                {
                    continue;
                }
                if let Some(path) = stored_copy(store, &session_id, change)? {
                    return Ok(Some(path));
                }
            }
        }
    }
    Ok(None)
}

pub(super) fn read_folder_version(
    store: &Store,
    args: FolderReadArgs,
) -> Result<FolderReadResult, FileVersionsError> {
    require_uuid(&args.session_id, FileVersionsError::InvalidSessionId)?;
    require_run_id(&args.run_id)?;
    let folder = locate_folder(store, &args.folder_path)?;
    let turn = load_turn(&folder, &args.session_id, &args.run_id)?;
    let change = turn
        .changes
        .iter()
        .find(|change| change.relative_path == args.relative_path)
        .ok_or(FileVersionsError::InvalidRelativePath)?;
    let missing = FolderReadResult {
        kind: ReadKind::Missing,
        text: None,
        size_bytes: None,
    };
    let unavailable = FolderReadResult {
        kind: ReadKind::Unavailable,
        text: None,
        size_bytes: None,
    };
    let source = match args.side {
        ReadSide::Before => {
            if change.before_hash.is_none() {
                return Ok(missing);
            }
            stored_copy(store, &turn.session_id, change)?
        }
        ReadSide::After => {
            let Some(hash) = &change.after_hash else {
                return Ok(missing);
            };
            find_after_copy(store, &folder, &change.relative_path, hash)?
        }
    };
    match source {
        Some(path) => read_source(&path),
        None => Ok(unavailable),
    }
}
