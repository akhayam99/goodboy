use std::collections::HashSet;
use std::fs;
use std::io::Read;
use std::path::{Component, Path, PathBuf};

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use thiserror::Error;

const FILE_VERSIONS_DIR: &str = "file-versions";
const STAGING_DIR: &str = "staging";
const DEFAULT_SIZE_CAP_BYTES: u64 = 15 * 1024 * 1024;

#[derive(Debug, Error)]
pub enum FileVersionsError {
    #[error("home directory is unavailable")]
    HomeUnavailable,
    #[error("session id must be a uuid")]
    InvalidSessionId,
    #[error("run id must be a uuid")]
    InvalidRunId,
    #[error("stored name is invalid")]
    InvalidStoredName,
    #[error("relative path is invalid")]
    InvalidRelativePath,
    #[error("session directory not found")]
    SessionDirNotFound,
    #[error("session marker is missing")]
    SessionMarkerMissing,
    #[error("session marker is invalid")]
    SessionMarkerInvalid,
    #[error("session marker does not match session id")]
    SessionMarkerMismatch,
    #[error("path escapes session directory")]
    PathEscapesSession,
    #[error("staging already exists for run")]
    StagingAlreadyExists,
    #[error("staging is missing for run")]
    StagingMissing,
    #[error("staged copy is missing for {0}")]
    MissingStagedCopy(String),
    #[error("staging contains unexpected entry")]
    UnexpectedStagingEntry,
    #[error("stored copy not found")]
    StoredCopyMissing,
    #[error("manifest contains duplicate relative path")]
    DuplicateRelativePath,
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("json error: {0}")]
    Json(#[from] serde_json::Error),
}

crate::util::impl_error_serialize!(FileVersionsError);

impl FileVersionsError {
    fn kind(&self) -> &'static str {
        match self {
            FileVersionsError::HomeUnavailable => "home_unavailable",
            FileVersionsError::InvalidSessionId => "invalid_session_id",
            FileVersionsError::InvalidRunId => "invalid_run_id",
            FileVersionsError::InvalidStoredName => "invalid_stored_name",
            FileVersionsError::InvalidRelativePath => "invalid_relative_path",
            FileVersionsError::SessionDirNotFound => "session_dir_not_found",
            FileVersionsError::SessionMarkerMissing => "session_marker_missing",
            FileVersionsError::SessionMarkerInvalid => "session_marker_invalid",
            FileVersionsError::SessionMarkerMismatch => "session_marker_mismatch",
            FileVersionsError::PathEscapesSession => "path_escapes_session",
            FileVersionsError::StagingAlreadyExists => "staging_already_exists",
            FileVersionsError::StagingMissing => "staging_missing",
            FileVersionsError::MissingStagedCopy(_) => "missing_staged_copy",
            FileVersionsError::UnexpectedStagingEntry => "unexpected_staging_entry",
            FileVersionsError::StoredCopyMissing => "stored_copy_missing",
            FileVersionsError::DuplicateRelativePath => "duplicate_relative_path",
            FileVersionsError::Io(_) => "io",
            FileVersionsError::Json(_) => "json",
        }
    }
}

#[derive(Debug, Deserialize)]
struct SessionMarker {
    #[serde(rename = "sessionId")]
    session_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SnapshotManifestEntry {
    relative_path: String,
    size_bytes: u64,
    content_hash: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SnapshotSkippedEntry {
    relative_path: String,
    reason: String,
    size_bytes: Option<u64>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BeginSnapshotResult {
    manifest: Vec<SnapshotManifestEntry>,
    skipped: Vec<SnapshotSkippedEntry>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BeginSnapshotArgs {
    session_dir: String,
    session_id: String,
    run_id: String,
    size_cap_bytes: Option<u64>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FinalizedVersion {
    id: String,
    relative_path: String,
    stored_name: String,
    size_bytes: u64,
    content_hash: String,
    change_kind: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FinalizeSnapshotResult {
    kept: Vec<FinalizedVersion>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FinalizeSnapshotArgs {
    session_dir: String,
    session_id: String,
    run_id: String,
    manifest: Vec<SnapshotManifestEntry>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RestoreVersionArgs {
    session_dir: String,
    session_id: String,
    relative_path: String,
    stored_name: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteVersionArgs {
    session_id: String,
    stored_name: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PurgeSessionArgs {
    session_id: String,
}

#[tauri::command]
pub fn file_versions_begin_snapshot(
    args: BeginSnapshotArgs,
) -> Result<BeginSnapshotResult, FileVersionsError> {
    let root = file_versions_root()?;
    begin_snapshot_with_root(&root, args)
}

#[tauri::command]
pub fn file_versions_finalize_snapshot(
    args: FinalizeSnapshotArgs,
) -> Result<FinalizeSnapshotResult, FileVersionsError> {
    let root = file_versions_root()?;
    finalize_snapshot_with_root(&root, args)
}

#[tauri::command]
pub fn file_versions_restore(args: RestoreVersionArgs) -> Result<(), FileVersionsError> {
    let root = file_versions_root()?;
    restore_version_with_root(&root, args)
}

#[tauri::command]
pub fn file_versions_delete(args: DeleteVersionArgs) -> Result<(), FileVersionsError> {
    let root = file_versions_root()?;
    delete_version_with_root(&root, args)
}

#[tauri::command]
pub fn file_versions_purge_session(args: PurgeSessionArgs) -> Result<(), FileVersionsError> {
    let root = file_versions_root()?;
    purge_session_with_root(&root, args)
}

fn begin_snapshot_with_root(
    root: &Path,
    args: BeginSnapshotArgs,
) -> Result<BeginSnapshotResult, FileVersionsError> {
    validate_uuid(&args.session_id).then_some(()).ok_or(FileVersionsError::InvalidSessionId)?;
    validate_uuid(&args.run_id).then_some(()).ok_or(FileVersionsError::InvalidRunId)?;
    let session_root = ensure_session_root(&args.session_dir, &args.session_id)?;
    let run_dir = run_staging_dir(root, &args.session_id, &args.run_id);
    if run_dir.exists() {
        return Err(FileVersionsError::StagingAlreadyExists);
    }
    let size_cap = args.size_cap_bytes.unwrap_or(DEFAULT_SIZE_CAP_BYTES);
    let (manifest, skipped) = collect_manifest(&session_root, size_cap)?;
    fs::create_dir_all(&run_dir)?;
    for entry in &manifest {
        let source = resolve_session_path(&session_root, &entry.relative_path, false)?;
        if !source.is_file() {
            return Err(FileVersionsError::MissingStagedCopy(
                entry.relative_path.clone(),
            ));
        }
        let staged = staged_path(&run_dir, &entry.relative_path);
        fs::copy(source, staged)?;
    }
    Ok(BeginSnapshotResult { manifest, skipped })
}

fn finalize_snapshot_with_root(
    root: &Path,
    args: FinalizeSnapshotArgs,
) -> Result<FinalizeSnapshotResult, FileVersionsError> {
    validate_uuid(&args.session_id).then_some(()).ok_or(FileVersionsError::InvalidSessionId)?;
    validate_uuid(&args.run_id).then_some(()).ok_or(FileVersionsError::InvalidRunId)?;
    let session_root = ensure_session_root(&args.session_dir, &args.session_id)?;
    let run_dir = run_staging_dir(root, &args.session_id, &args.run_id);
    if !run_dir.is_dir() {
        return Err(FileVersionsError::StagingMissing);
    }
    let session_store = session_store_dir(root, &args.session_id);
    fs::create_dir_all(&session_store)?;

    let mut kept = Vec::new();
    let mut seen = HashSet::new();

    for entry in args.manifest {
        if !seen.insert(entry.relative_path.clone()) {
            return Err(FileVersionsError::DuplicateRelativePath);
        }
        let staged = staged_path(&run_dir, &entry.relative_path);
        if !staged.is_file() {
            return Err(FileVersionsError::MissingStagedCopy(
                entry.relative_path.clone(),
            ));
        }
        let current_hash = current_file_hash(&session_root, &entry.relative_path)?;
        if current_hash.as_deref() == Some(entry.content_hash.as_str()) {
            fs::remove_file(staged)?;
            continue;
        }
        let id = crate::util::uuid_v4();
        let file_name = file_name_from_relative_path(&entry.relative_path)?;
        let stored_name = format!(
            "{}-{}",
            crate::attachment::sanitize_segment(&id),
            crate::attachment::sanitize_segment(file_name)
        );
        let stored = session_store.join(&stored_name);
        fs::rename(staged, stored)?;
        let change_kind = match current_hash {
            Some(_) => "modified".to_string(),
            None => "deleted".to_string(),
        };
        kept.push(FinalizedVersion {
            id,
            relative_path: entry.relative_path,
            stored_name,
            size_bytes: entry.size_bytes,
            content_hash: entry.content_hash,
            change_kind,
        });
    }

    clear_staging_dir(&run_dir)?;

    Ok(FinalizeSnapshotResult { kept })
}

fn restore_version_with_root(root: &Path, args: RestoreVersionArgs) -> Result<(), FileVersionsError> {
    validate_uuid(&args.session_id).then_some(()).ok_or(FileVersionsError::InvalidSessionId)?;
    let stored_name = validate_stored_name(&args.stored_name)?;
    let session_root = ensure_session_root(&args.session_dir, &args.session_id)?;
    let session_store = session_store_dir(root, &args.session_id);
    let source = session_store.join(stored_name);
    if !source.is_file() {
        return Err(FileVersionsError::StoredCopyMissing);
    }
    let target = resolve_session_path(&session_root, &args.relative_path, true)?;
    fs::copy(source, target)?;
    Ok(())
}

fn delete_version_with_root(root: &Path, args: DeleteVersionArgs) -> Result<(), FileVersionsError> {
    validate_uuid(&args.session_id).then_some(()).ok_or(FileVersionsError::InvalidSessionId)?;
    let stored_name = validate_stored_name(&args.stored_name)?;
    let target = session_store_dir(root, &args.session_id).join(stored_name);
    match fs::remove_file(target) {
        Ok(()) => Ok(()),
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(err) => Err(FileVersionsError::Io(err)),
    }
}

fn purge_session_with_root(root: &Path, args: PurgeSessionArgs) -> Result<(), FileVersionsError> {
    validate_uuid(&args.session_id).then_some(()).ok_or(FileVersionsError::InvalidSessionId)?;
    let session_dir = session_store_dir(root, &args.session_id);
    match fs::remove_dir_all(session_dir) {
        Ok(()) => Ok(()),
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(err) => Err(FileVersionsError::Io(err)),
    }
}

fn file_versions_root() -> Result<PathBuf, FileVersionsError> {
    let home = dirs::home_dir().ok_or(FileVersionsError::HomeUnavailable)?;
    Ok(home.join(".goodboy").join(FILE_VERSIONS_DIR))
}

fn session_store_dir(root: &Path, session_id: &str) -> PathBuf {
    root.join(session_id)
}

fn run_staging_dir(root: &Path, session_id: &str, run_id: &str) -> PathBuf {
    session_store_dir(root, session_id).join(STAGING_DIR).join(run_id)
}

fn validate_stored_name(stored_name: &str) -> Result<String, FileVersionsError> {
    let trimmed = stored_name.trim();
    if trimmed.is_empty() {
        return Err(FileVersionsError::InvalidStoredName);
    }
    let sanitized = crate::attachment::sanitize_segment(trimmed);
    if sanitized != trimmed {
        return Err(FileVersionsError::InvalidStoredName);
    }
    Ok(sanitized)
}

fn ensure_session_root(session_dir: &str, session_id: &str) -> Result<PathBuf, FileVersionsError> {
    let trimmed = session_dir.trim();
    if trimmed.is_empty() {
        return Err(FileVersionsError::SessionDirNotFound);
    }
    let root = PathBuf::from(trimmed);
    let canonical = fs::canonicalize(root).map_err(|_| FileVersionsError::SessionDirNotFound)?;
    if !canonical.is_dir() {
        return Err(FileVersionsError::SessionDirNotFound);
    }
    let marker_path = canonical.join(".goodboy");
    if !marker_path.is_file() {
        return Err(FileVersionsError::SessionMarkerMissing);
    }
    let marker_raw = fs::read(marker_path)?;
    let marker =
        serde_json::from_slice::<SessionMarker>(&marker_raw).map_err(|_| FileVersionsError::SessionMarkerInvalid)?;
    if marker.session_id != session_id {
        return Err(FileVersionsError::SessionMarkerMismatch);
    }
    Ok(canonical)
}

fn collect_manifest(
    session_root: &Path,
    size_cap_bytes: u64,
) -> Result<(Vec<SnapshotManifestEntry>, Vec<SnapshotSkippedEntry>), FileVersionsError> {
    let mut manifest = Vec::new();
    let mut skipped = Vec::new();
    let mut stack = vec![session_root.to_path_buf()];

    while let Some(dir) = stack.pop() {
        for entry in fs::read_dir(&dir)? {
            let entry = entry?;
            let path = entry.path();
            let rel = relative_path(session_root, &path)?;
            let file_name = entry.file_name().to_string_lossy().to_string();
            if file_name.starts_with('.') {
                skipped.push(SnapshotSkippedEntry {
                    relative_path: rel,
                    reason: "dotfile".to_string(),
                    size_bytes: None,
                });
                continue;
            }
            let metadata = fs::symlink_metadata(&path)?;
            if metadata.file_type().is_dir() {
                stack.push(path);
                continue;
            }
            if !metadata.file_type().is_file() {
                skipped.push(SnapshotSkippedEntry {
                    relative_path: rel,
                    reason: "not_regular_file".to_string(),
                    size_bytes: None,
                });
                continue;
            }
            if metadata.len() > size_cap_bytes {
                skipped.push(SnapshotSkippedEntry {
                    relative_path: rel,
                    reason: "too_large".to_string(),
                    size_bytes: Some(metadata.len()),
                });
                continue;
            }
            manifest.push(SnapshotManifestEntry {
                relative_path: rel,
                size_bytes: metadata.len(),
                content_hash: hash_file(&path)?,
            });
        }
    }

    manifest.sort_by(|left, right| left.relative_path.cmp(&right.relative_path));
    skipped.sort_by(|left, right| left.relative_path.cmp(&right.relative_path));
    Ok((manifest, skipped))
}

fn current_file_hash(
    session_root: &Path,
    relative_path: &str,
) -> Result<Option<String>, FileVersionsError> {
    let path = resolve_session_path(session_root, relative_path, false)?;
    if !path.exists() {
        return Ok(None);
    }
    let metadata = fs::symlink_metadata(&path)?;
    if !metadata.file_type().is_file() {
        return Ok(None);
    }
    Ok(Some(hash_file(&path)?))
}

fn clear_staging_dir(run_dir: &Path) -> Result<(), FileVersionsError> {
    if !run_dir.is_dir() {
        return Ok(());
    }
    for entry in fs::read_dir(run_dir)? {
        let entry = entry?;
        let path = entry.path();
        if path.is_file() {
            fs::remove_file(path)?;
            continue;
        }
        return Err(FileVersionsError::UnexpectedStagingEntry);
    }
    fs::remove_dir(run_dir)?;
    if let Some(staging_parent) = run_dir.parent() {
        if staging_parent.is_dir() && fs::read_dir(staging_parent)?.next().is_none() {
            fs::remove_dir(staging_parent)?;
        }
    }
    Ok(())
}

fn staged_path(run_dir: &Path, relative_path: &str) -> PathBuf {
    let mut hasher = Sha256::new();
    hasher.update(relative_path.as_bytes());
    let digest = format!("{:x}", hasher.finalize());
    run_dir.join(format!("{digest}.bin"))
}

fn file_name_from_relative_path(relative_path: &str) -> Result<&str, FileVersionsError> {
    let path = Path::new(relative_path);
    path.file_name()
        .and_then(|segment| segment.to_str())
        .ok_or(FileVersionsError::InvalidRelativePath)
}

fn resolve_session_path(
    session_root: &Path,
    relative_path: &str,
    create_parent: bool,
) -> Result<PathBuf, FileVersionsError> {
    let components = parse_relative_components(relative_path)?;
    let (file_name, parent_components) = components
        .split_last()
        .ok_or(FileVersionsError::InvalidRelativePath)?;
    let mut current = session_root.to_path_buf();
    for component in parent_components {
        let next = current.join(component);
        if next.exists() {
            let canonical = fs::canonicalize(&next)?;
            if !canonical.starts_with(session_root) {
                return Err(FileVersionsError::PathEscapesSession);
            }
            if !canonical.is_dir() {
                return Err(FileVersionsError::InvalidRelativePath);
            }
            current = canonical;
            continue;
        }
        if create_parent {
            fs::create_dir(&next)?;
        }
        current = next;
    }
    let target = current.join(file_name);
    if !target.exists() {
        return Ok(target);
    }
    let canonical = fs::canonicalize(&target)?;
    if !canonical.starts_with(session_root) {
        return Err(FileVersionsError::PathEscapesSession);
    }
    Ok(canonical)
}

fn parse_relative_components(relative_path: &str) -> Result<Vec<String>, FileVersionsError> {
    let trimmed = relative_path.trim();
    if trimmed.is_empty() {
        return Err(FileVersionsError::InvalidRelativePath);
    }
    let parsed = Path::new(trimmed);
    if parsed.is_absolute() {
        return Err(FileVersionsError::InvalidRelativePath);
    }
    let mut components = Vec::new();
    for component in parsed.components() {
        match component {
            Component::Normal(segment) => components.push(segment.to_string_lossy().to_string()),
            _ => return Err(FileVersionsError::InvalidRelativePath),
        }
    }
    if components.is_empty() {
        return Err(FileVersionsError::InvalidRelativePath);
    }
    Ok(components)
}

fn relative_path(root: &Path, path: &Path) -> Result<String, FileVersionsError> {
    let rel = path
        .strip_prefix(root)
        .map_err(|_| FileVersionsError::InvalidRelativePath)?;
    let mut parts = Vec::new();
    for component in rel.components() {
        match component {
            Component::Normal(segment) => parts.push(segment.to_string_lossy().to_string()),
            _ => return Err(FileVersionsError::InvalidRelativePath),
        }
    }
    if parts.is_empty() {
        return Err(FileVersionsError::InvalidRelativePath);
    }
    Ok(parts.join("/"))
}

fn hash_file(path: &Path) -> Result<String, FileVersionsError> {
    let mut file = fs::File::open(path)?;
    let mut hasher = Sha256::new();
    let mut buffer = [0u8; 16 * 1024];
    loop {
        let read = file.read(&mut buffer)?;
        if read == 0 {
            break;
        }
        hasher.update(&buffer[..read]);
    }
    Ok(format!("{:x}", hasher.finalize()))
}

fn validate_uuid(value: &str) -> bool {
    let bytes = value.as_bytes();
    if bytes.len() != 36 {
        return false;
    }
    for (index, byte) in bytes.iter().enumerate() {
        if matches!(index, 8 | 13 | 18 | 23) {
            if *byte != b'-' {
                return false;
            }
            continue;
        }
        if !byte.is_ascii_hexdigit() {
            return false;
        }
    }
    true
}

#[cfg(test)]
mod tests {
    use super::*;

    const SESSION_ID: &str = "11111111-1111-4111-8111-111111111111";
    const RUN_ID: &str = "22222222-2222-4222-8222-222222222222";

    fn temp_dir(name: &str) -> PathBuf {
        std::env::temp_dir().join(format!(
            "goodboy-file-versions-{name}-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ))
    }

    fn write_marker(path: &Path, session_id: &str) {
        fs::create_dir_all(path).unwrap();
        let marker = serde_json::json!({
            "sessionId": session_id,
            "workspaceId": "workspace-1",
            "createdAt": "2026-08-02T00:00:00Z"
        });
        fs::write(path.join(".goodboy"), serde_json::to_vec(&marker).unwrap()).unwrap();
    }

    #[test]
    fn restore_rejects_invalid_relative_paths_and_marker_mismatch() {
        let store_root = temp_dir("restore-invalid-store");
        let session_root = temp_dir("restore-invalid-session");
        write_marker(&session_root, SESSION_ID);
        let session_store = session_store_dir(&store_root, SESSION_ID);
        fs::create_dir_all(&session_store).unwrap();
        fs::write(session_store.join("copy.bin"), b"snapshot").unwrap();

        let absolute = restore_version_with_root(
            &store_root,
            RestoreVersionArgs {
                session_dir: session_root.to_string_lossy().to_string(),
                session_id: SESSION_ID.to_string(),
                relative_path: "/tmp/escape.txt".to_string(),
                stored_name: "copy.bin".to_string(),
            },
        );
        assert!(matches!(absolute, Err(FileVersionsError::InvalidRelativePath)));

        let parent = restore_version_with_root(
            &store_root,
            RestoreVersionArgs {
                session_dir: session_root.to_string_lossy().to_string(),
                session_id: SESSION_ID.to_string(),
                relative_path: "../escape.txt".to_string(),
                stored_name: "copy.bin".to_string(),
            },
        );
        assert!(matches!(parent, Err(FileVersionsError::InvalidRelativePath)));

        let mismatch = restore_version_with_root(
            &store_root,
            RestoreVersionArgs {
                session_dir: session_root.to_string_lossy().to_string(),
                session_id: "33333333-3333-4333-8333-333333333333".to_string(),
                relative_path: "safe.txt".to_string(),
                stored_name: "copy.bin".to_string(),
            },
        );
        assert!(matches!(mismatch, Err(FileVersionsError::SessionMarkerMismatch)));

        let _ = fs::remove_dir_all(store_root);
        let _ = fs::remove_dir_all(session_root);
    }

    #[cfg(unix)]
    #[test]
    fn restore_rejects_symlink_escape() {
        let store_root = temp_dir("symlink-store");
        let session_root = temp_dir("symlink-session");
        let outside = temp_dir("symlink-outside");
        write_marker(&session_root, SESSION_ID);
        fs::create_dir_all(&outside).unwrap();
        std::os::unix::fs::symlink(&outside, session_root.join("link")).unwrap();
        let session_store = session_store_dir(&store_root, SESSION_ID);
        fs::create_dir_all(&session_store).unwrap();
        fs::write(session_store.join("copy.bin"), b"snapshot").unwrap();

        let result = restore_version_with_root(
            &store_root,
            RestoreVersionArgs {
                session_dir: session_root.to_string_lossy().to_string(),
                session_id: SESSION_ID.to_string(),
                relative_path: "link/escape.txt".to_string(),
                stored_name: "copy.bin".to_string(),
            },
        );
        assert!(matches!(result, Err(FileVersionsError::PathEscapesSession)));

        let _ = fs::remove_dir_all(store_root);
        let _ = fs::remove_dir_all(session_root);
        let _ = fs::remove_dir_all(outside);
    }

    #[test]
    fn begin_and_finalize_keeps_only_modified_and_deleted_files() {
        let store_root = temp_dir("begin-finalize-store");
        let session_root = temp_dir("begin-finalize-session");
        write_marker(&session_root, SESSION_ID);
        fs::write(session_root.join("unchanged.txt"), b"same").unwrap();
        fs::write(session_root.join("modified.txt"), b"before").unwrap();
        fs::write(session_root.join("deleted.txt"), b"remove").unwrap();
        fs::write(session_root.join(".ignored"), b"hidden").unwrap();

        let begin = begin_snapshot_with_root(
            &store_root,
            BeginSnapshotArgs {
                session_dir: session_root.to_string_lossy().to_string(),
                session_id: SESSION_ID.to_string(),
                run_id: RUN_ID.to_string(),
                size_cap_bytes: Some(1024),
            },
        )
        .unwrap();
        assert_eq!(begin.manifest.len(), 3);
        assert!(begin
            .manifest
            .iter()
            .any(|entry| entry.relative_path == "unchanged.txt"));
        assert!(begin
            .manifest
            .iter()
            .any(|entry| entry.relative_path == "modified.txt"));
        assert!(begin
            .manifest
            .iter()
            .any(|entry| entry.relative_path == "deleted.txt"));
        assert!(begin
            .skipped
            .iter()
            .any(|entry| entry.relative_path == ".goodboy" && entry.reason == "dotfile"));

        fs::write(session_root.join("modified.txt"), b"after").unwrap();
        fs::remove_file(session_root.join("deleted.txt")).unwrap();

        let finalize = finalize_snapshot_with_root(
            &store_root,
            FinalizeSnapshotArgs {
                session_dir: session_root.to_string_lossy().to_string(),
                session_id: SESSION_ID.to_string(),
                run_id: RUN_ID.to_string(),
                manifest: begin.manifest,
            },
        )
        .unwrap();

        assert_eq!(finalize.kept.len(), 2);
        assert!(finalize
            .kept
            .iter()
            .any(|entry| entry.relative_path == "modified.txt" && entry.change_kind == "modified"));
        assert!(finalize
            .kept
            .iter()
            .any(|entry| entry.relative_path == "deleted.txt" && entry.change_kind == "deleted"));
        assert!(finalize
            .kept
            .iter()
            .all(|entry| session_store_dir(&store_root, SESSION_ID).join(&entry.stored_name).is_file()));

        let run_dir = run_staging_dir(&store_root, SESSION_ID, RUN_ID);
        assert!(!run_dir.exists());

        let _ = fs::remove_dir_all(store_root);
        let _ = fs::remove_dir_all(session_root);
    }
}
