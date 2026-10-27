use std::collections::{BTreeMap, HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex, OnceLock, PoisonError};

use serde::de::DeserializeOwned;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use super::FileVersionsError;

pub(super) const FOLDER_VERSIONS_DIR: &str = "folder-versions";
const INDEX_FILE: &str = "index.json";
const MIRROR_DIR: &str = "mirror";
const STAGING_DIR: &str = "staging";
const TURNS_DIR: &str = "turns";
const INDEX_VERSION: u32 = 1;
const INDEX_FLUSH_EVERY: usize = 500;
const MAX_SKIPPED: usize = 200;
pub(super) const MAX_FOLDER_FILES: usize = 100_000;
pub(super) const MAX_FOLDER_BYTES: u64 = 8 * 1024 * 1024 * 1024;
const SILENT_FOLDERS: &[&str] = &[
    ".git",
    ".goodboy",
    ".Trash",
    ".Spotlight-V100",
    ".fseventsd",
];
const SILENT_FILES: &[&str] = &[".DS_Store", "Icon\r", ".localized"];

#[derive(Debug, Clone)]
pub(super) struct Store {
    pub(super) versions: PathBuf,
    pub(super) folders: PathBuf,
}

impl Store {
    pub(super) fn from_home() -> Result<Self, FileVersionsError> {
        let versions = super::file_versions_root()?;
        let data = versions
            .parent()
            .map(Path::to_path_buf)
            .ok_or(FileVersionsError::HomeUnavailable)?;
        Ok(Self {
            versions,
            folders: data.join(FOLDER_VERSIONS_DIR),
        })
    }

    pub(super) fn session_store(&self, session_id: &str) -> PathBuf {
        super::session_store_dir(&self.versions, session_id)
    }
}

#[derive(Debug, Clone)]
pub(super) struct FolderPaths {
    pub(super) root: PathBuf,
    pub(super) key: String,
    pub(super) dir: PathBuf,
}

impl FolderPaths {
    pub(super) fn index_path(&self) -> PathBuf {
        self.dir.join(INDEX_FILE)
    }

    pub(super) fn mirror_dir(&self) -> PathBuf {
        self.dir.join(MIRROR_DIR)
    }

    pub(super) fn mirror_path(&self, relative_path: &str) -> PathBuf {
        self.mirror_dir().join(relative_path)
    }

    pub(super) fn staging_dir(&self) -> PathBuf {
        self.dir.join(STAGING_DIR)
    }

    pub(super) fn staging_path(&self, run_id: &str) -> PathBuf {
        self.staging_dir().join(format!("{run_id}.json"))
    }

    pub(super) fn turns_dir(&self) -> PathBuf {
        self.dir.join(TURNS_DIR)
    }

    pub(super) fn session_turns_dir(&self, session_id: &str) -> PathBuf {
        self.turns_dir().join(session_id)
    }

    pub(super) fn turn_path(&self, session_id: &str, run_id: &str) -> PathBuf {
        self.session_turns_dir(session_id)
            .join(format!("{run_id}.json"))
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub(super) struct FileStat {
    pub(super) size_bytes: u64,
    pub(super) modified_secs: i64,
    pub(super) modified_nanos: i64,
    pub(super) inode: u64,
}

#[cfg(unix)]
pub(super) fn stat_of(metadata: &fs::Metadata) -> FileStat {
    use std::os::unix::fs::MetadataExt;
    FileStat {
        size_bytes: metadata.len(),
        modified_secs: metadata.mtime(),
        modified_nanos: metadata.mtime_nsec(),
        inode: metadata.ino(),
    }
}

#[cfg(not(unix))]
pub(super) fn stat_of(metadata: &fs::Metadata) -> FileStat {
    let modified = metadata
        .modified()
        .ok()
        .and_then(|time| time.duration_since(std::time::UNIX_EPOCH).ok())
        .unwrap_or_default();
    FileStat {
        size_bytes: metadata.len(),
        modified_secs: i64::try_from(modified.as_secs()).unwrap_or(i64::MAX),
        modified_nanos: i64::from(modified.subsec_nanos()),
        inode: 0,
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct IndexEntry {
    #[serde(flatten)]
    pub(super) stat: FileStat,
    pub(super) content_hash: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FolderSkip {
    pub(super) relative_path: String,
    pub(super) reason: String,
    pub(super) size_bytes: Option<u64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(super) omitted: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct FolderIndex {
    pub(super) version: u32,
    pub(super) folder_path: String,
    pub(super) folder_id: Option<String>,
    pub(super) is_ready: bool,
    pub(super) entries: BTreeMap<String, IndexEntry>,
    pub(super) skipped: Vec<FolderSkip>,
}

impl FolderIndex {
    pub(super) fn kept_bytes(&self) -> u64 {
        self.entries
            .values()
            .map(|entry| entry.stat.size_bytes)
            .sum()
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum CopyMethod {
    Clone,
    Copy,
}

pub(super) struct WalkFile {
    pub(super) relative_path: String,
    pub(super) path: PathBuf,
    pub(super) stat: FileStat,
}

pub(super) struct Walk {
    pub(super) files: Vec<WalkFile>,
    pub(super) skipped: Vec<FolderSkip>,
    pub(super) total_bytes: u64,
}

pub(super) struct SyncOutcome {
    pub(super) copied: usize,
    pub(super) method: Option<CopyMethod>,
}

fn locks() -> &'static Mutex<HashMap<String, Arc<Mutex<()>>>> {
    static LOCKS: OnceLock<Mutex<HashMap<String, Arc<Mutex<()>>>>> = OnceLock::new();
    LOCKS.get_or_init(Default::default)
}

fn cancelled() -> &'static Mutex<HashSet<String>> {
    static CANCELLED: OnceLock<Mutex<HashSet<String>>> = OnceLock::new();
    CANCELLED.get_or_init(Default::default)
}

pub(super) fn folder_lock(key: &str) -> Arc<Mutex<()>> {
    let mut map = locks().lock().unwrap_or_else(PoisonError::into_inner);
    map.entry(key.to_string()).or_default().clone()
}

pub(super) fn mark_cancelled(key: &str, is_cancelled: bool) {
    let mut set = cancelled().lock().unwrap_or_else(PoisonError::into_inner);
    if is_cancelled {
        set.insert(key.to_string());
        return;
    }
    set.remove(key);
}

pub(super) fn is_cancelled(key: &str) -> bool {
    cancelled()
        .lock()
        .unwrap_or_else(PoisonError::into_inner)
        .contains(key)
}

pub(super) fn folder_key(path: &Path) -> String {
    let mut hasher = Sha256::new();
    hasher.update(path.to_string_lossy().as_bytes());
    let digest = format!("{:x}", hasher.finalize());
    digest[..32].to_string()
}

pub(super) fn locate_folder(
    store: &Store,
    folder_path: &str,
) -> Result<FolderPaths, FileVersionsError> {
    let trimmed = folder_path.trim();
    if trimmed.is_empty() {
        return Err(FileVersionsError::FolderNotFound);
    }
    let raw = PathBuf::from(trimmed);
    if !raw.is_absolute() {
        return Err(FileVersionsError::FolderNotFound);
    }
    let root = fs::canonicalize(&raw).unwrap_or(raw);
    let key = folder_key(&root);
    let dir = store.folders.join(&key);
    Ok(FolderPaths { root, key, dir })
}

pub(super) fn open_folder(
    store: &Store,
    folder_path: &str,
) -> Result<FolderPaths, FileVersionsError> {
    let folder = locate_folder(store, folder_path)?;
    if !folder.root.is_dir() {
        return Err(FileVersionsError::FolderNotFound);
    }
    refuse_folder(store, &folder.root)?;
    Ok(folder)
}

fn refuse_folder(store: &Store, root: &Path) -> Result<(), FileVersionsError> {
    if root.parent().is_none() {
        return Err(FileVersionsError::FolderRefused);
    }
    let home = dirs::home_dir().and_then(|home| fs::canonicalize(home).ok());
    if home.as_deref() == Some(root) {
        return Err(FileVersionsError::FolderRefused);
    }
    let Some(data) = store.folders.parent() else {
        return Ok(());
    };
    let data = fs::canonicalize(data).unwrap_or_else(|_| data.to_path_buf());
    if root.starts_with(&data) || data.starts_with(root) {
        return Err(FileVersionsError::FolderRefused);
    }
    Ok(())
}

pub(super) fn read_json<T: DeserializeOwned>(path: &Path) -> Result<Option<T>, FileVersionsError> {
    let raw = match fs::read(path) {
        Ok(raw) => raw,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(error) => return Err(FileVersionsError::Io(error)),
    };
    Ok(Some(serde_json::from_slice(&raw)?))
}

pub(super) fn write_json_atomic<T: Serialize>(
    path: &Path,
    value: &T,
) -> Result<(), FileVersionsError> {
    let parent = path
        .parent()
        .ok_or(FileVersionsError::InvalidRelativePath)?;
    fs::create_dir_all(parent)?;
    let temp = parent.join(format!(".{}.tmp", crate::util::uuid_v4()));
    fs::write(&temp, serde_json::to_vec(value)?)?;
    if let Err(error) = fs::rename(&temp, path) {
        let _ = fs::remove_file(&temp);
        return Err(FileVersionsError::Io(error));
    }
    Ok(())
}

pub(super) fn remove_if_present(path: &Path) -> Result<(), FileVersionsError> {
    match fs::remove_file(path) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(FileVersionsError::Io(error)),
    }
}

pub(super) fn load_index(folder: &FolderPaths) -> Result<FolderIndex, FileVersionsError> {
    let fresh = FolderIndex {
        version: INDEX_VERSION,
        folder_path: folder.root.to_string_lossy().into_owned(),
        folder_id: None,
        is_ready: false,
        entries: BTreeMap::new(),
        skipped: Vec::new(),
    };
    match read_json::<FolderIndex>(&folder.index_path()) {
        Ok(Some(index)) => Ok(index),
        Ok(None) => Ok(fresh),
        Err(FileVersionsError::Json(_)) => Ok(fresh),
        Err(error) => Err(error),
    }
}

pub(super) fn write_index(
    folder: &FolderPaths,
    index: &FolderIndex,
) -> Result<(), FileVersionsError> {
    write_json_atomic(&folder.index_path(), index)
}

pub(super) fn has_staging(folder: &FolderPaths) -> bool {
    fs::read_dir(folder.staging_dir())
        .map(|mut entries| entries.next().is_some())
        .unwrap_or(false)
}

#[cfg(target_os = "macos")]
const CLONE_NOFOLLOW: u32 = 0x0001;

#[cfg(target_os = "macos")]
fn try_clone(source: &Path, target: &Path) -> bool {
    use std::ffi::CString;
    use std::os::unix::ffi::OsStrExt;
    let (Ok(from), Ok(to)) = (
        CString::new(source.as_os_str().as_bytes()),
        CString::new(target.as_os_str().as_bytes()),
    ) else {
        return false;
    };
    unsafe { libc::clonefile(from.as_ptr(), to.as_ptr(), CLONE_NOFOLLOW) == 0 }
}

#[cfg(not(target_os = "macos"))]
fn try_clone(_source: &Path, _target: &Path) -> bool {
    false
}

pub(super) fn copy_atomic(source: &Path, target: &Path) -> Result<(), FileVersionsError> {
    let parent = target
        .parent()
        .ok_or(FileVersionsError::InvalidRelativePath)?;
    let temp = parent.join(format!(".gb-{}.tmp", crate::util::uuid_v4()));
    if let Err(error) = fs::copy(source, &temp) {
        let _ = fs::remove_file(&temp);
        return Err(FileVersionsError::Io(error));
    }
    if let Err(error) = fs::rename(&temp, target) {
        let _ = fs::remove_file(&temp);
        return Err(FileVersionsError::Io(error));
    }
    Ok(())
}

pub(super) fn copy_file_into(
    source: &Path,
    target: &Path,
    can_clone: bool,
) -> Result<CopyMethod, FileVersionsError> {
    let parent = target
        .parent()
        .ok_or(FileVersionsError::InvalidRelativePath)?;
    fs::create_dir_all(parent)?;
    let temp = parent.join(format!(".gb-{}.tmp", crate::util::uuid_v4()));
    let method = match can_clone && try_clone(source, &temp) {
        true => CopyMethod::Clone,
        false => {
            fs::copy(source, &temp)?;
            CopyMethod::Copy
        }
    };
    if target.is_dir() {
        fs::remove_dir_all(target)?;
    }
    if let Err(error) = fs::rename(&temp, target) {
        let _ = fs::remove_file(&temp);
        return Err(FileVersionsError::Io(error));
    }
    Ok(method)
}

fn push_skip(walk: &mut Walk, relative_path: String, reason: &str, size_bytes: Option<u64>) {
    if walk.skipped.len() >= MAX_SKIPPED {
        return;
    }
    walk.skipped.push(FolderSkip {
        relative_path,
        reason: reason.to_string(),
        size_bytes,
        omitted: None,
    });
}

fn link_reason(root: &Path, path: &Path) -> &'static str {
    match fs::canonicalize(path) {
        Ok(target) if target.starts_with(root) => "link",
        _ => "link_outside",
    }
}

fn is_session_folder(path: &Path) -> bool {
    path.join(".goodboy").exists() && crate::session_dir::marker_read(path).is_ok()
}

pub(super) fn walk_folder(root: &Path, size_cap_bytes: u64) -> Result<Walk, FileVersionsError> {
    walk_folder_within(root, size_cap_bytes, MAX_FOLDER_FILES)
}

pub(super) fn walk_folder_within(
    root: &Path,
    size_cap_bytes: u64,
    max_files: usize,
) -> Result<Walk, FileVersionsError> {
    let mut walk = Walk {
        files: Vec::new(),
        skipped: Vec::new(),
        total_bytes: 0,
    };
    let mut first_over_limit: Option<String> = None;
    let mut omitted_by_limit: u64 = 0;
    let mut stack = vec![root.to_path_buf()];
    while let Some(dir) = stack.pop() {
        let entries = match fs::read_dir(&dir) {
            Ok(entries) => entries,
            Err(error) if dir == root => return Err(FileVersionsError::Io(error)),
            Err(_) => {
                push_skip(
                    &mut walk,
                    super::relative_path(root, &dir)?,
                    "unreadable",
                    None,
                );
                continue;
            }
        };
        let mut entries: Vec<fs::DirEntry> = entries.filter_map(Result::ok).collect();
        entries.sort_by_key(|entry| entry.file_name());
        let mut subfolders = Vec::new();
        for entry in entries {
            let path = entry.path();
            let name = entry.file_name().to_string_lossy().into_owned();
            let relative = super::relative_path(root, &path)?;
            let Ok(metadata) = fs::symlink_metadata(&path) else {
                push_skip(&mut walk, relative, "unreadable", None);
                continue;
            };
            let kind = metadata.file_type();
            if kind.is_symlink() {
                let reason = link_reason(root, &path);
                push_skip(&mut walk, relative, reason, None);
                continue;
            }
            if kind.is_dir() {
                if SILENT_FOLDERS.contains(&name.as_str()) {
                    continue;
                }
                if crate::reproducible_dirs::is_skipped_in_walk(name.as_str()) {
                    push_skip(&mut walk, relative, "skipped_folder", None);
                    continue;
                }
                if is_session_folder(&path) {
                    push_skip(&mut walk, relative, "session_folder", None);
                    continue;
                }
                subfolders.push(path);
                continue;
            }
            if SILENT_FILES.contains(&name.as_str()) {
                continue;
            }
            if !kind.is_file() {
                push_skip(&mut walk, relative, "not_regular_file", None);
                continue;
            }
            let size = metadata.len();
            if size > size_cap_bytes {
                push_skip(&mut walk, relative, "too_large", Some(size));
                continue;
            }
            if first_over_limit.is_some()
                || walk.files.len() >= max_files
                || walk.total_bytes + size > MAX_FOLDER_BYTES
            {
                omitted_by_limit += 1;
                if first_over_limit.is_none() {
                    first_over_limit = Some(relative);
                }
                continue;
            }
            walk.total_bytes += size;
            walk.files.push(WalkFile {
                relative_path: relative,
                path,
                stat: stat_of(&metadata),
            });
        }
        subfolders.reverse();
        stack.extend(subfolders);
    }
    if let Some(relative_path) = first_over_limit {
        walk.skipped.push(FolderSkip {
            relative_path,
            reason: "folder_limit".to_string(),
            size_bytes: None,
            omitted: Some(omitted_by_limit),
        });
    }
    walk.files
        .sort_by(|left, right| left.relative_path.cmp(&right.relative_path));
    walk.skipped
        .sort_by(|left, right| left.relative_path.cmp(&right.relative_path));
    Ok(walk)
}

pub(super) fn mirror_hash(
    folder: &FolderPaths,
    relative_path: &str,
    entry: &IndexEntry,
) -> Result<String, FileVersionsError> {
    if let Some(hash) = &entry.content_hash {
        return Ok(hash.clone());
    }
    super::hash_file(&folder.mirror_path(relative_path))
}

pub(super) fn sync_mirror(
    folder: &FolderPaths,
    index: &mut FolderIndex,
    walk: &Walk,
    is_cancelled_now: &dyn Fn() -> bool,
) -> Result<SyncOutcome, FileVersionsError> {
    let live: HashSet<&str> = walk
        .files
        .iter()
        .map(|file| file.relative_path.as_str())
        .collect();
    let stale: Vec<String> = index
        .entries
        .keys()
        .filter(|key| !live.contains(key.as_str()))
        .cloned()
        .collect();
    for relative in stale {
        remove_if_present(&folder.mirror_path(&relative))?;
        index.entries.remove(&relative);
    }
    let mut copied = 0usize;
    let mut method = None;
    for file in &walk.files {
        let mirror = folder.mirror_path(&file.relative_path);
        let is_current = index
            .entries
            .get(&file.relative_path)
            .is_some_and(|entry| entry.stat == file.stat && mirror.is_file());
        if is_current {
            continue;
        }
        match copy_file_into(&file.path, &mirror, true) {
            Ok(used) => method = Some(used),
            Err(FileVersionsError::Io(error)) if error.kind() == std::io::ErrorKind::NotFound => {
                index.entries.remove(&file.relative_path);
                continue;
            }
            Err(error) => return Err(error),
        }
        index.entries.insert(
            file.relative_path.clone(),
            IndexEntry {
                stat: file.stat,
                content_hash: None,
            },
        );
        copied += 1;
        if !copied.is_multiple_of(INDEX_FLUSH_EVERY) {
            continue;
        }
        write_index(folder, index)?;
        if is_cancelled_now() {
            return Err(FileVersionsError::Cancelled);
        }
    }
    index.skipped = walk.skipped.clone();
    write_index(folder, index)?;
    Ok(SyncOutcome { copied, method })
}

pub(super) fn derived_uuid(parts: &[&str]) -> String {
    let mut hasher = Sha256::new();
    for part in parts {
        hasher.update(part.as_bytes());
        hasher.update([0u8]);
    }
    let mut bytes: [u8; 16] = [0; 16];
    bytes.copy_from_slice(&hasher.finalize()[..16]);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    let hex: String = bytes.iter().map(|byte| format!("{byte:02x}")).collect();
    format!(
        "{}-{}-{}-{}-{}",
        &hex[0..8],
        &hex[8..12],
        &hex[12..16],
        &hex[16..20],
        &hex[20..32]
    )
}

pub(super) fn stored_name_for(
    version_id: &str,
    relative_path: &str,
) -> Result<String, FileVersionsError> {
    let file_name = super::file_name_from_relative_path(relative_path)?;
    Ok(format!(
        "{}-{}",
        crate::attachment::sanitize_segment(version_id),
        crate::attachment::sanitize_segment(file_name)
    ))
}
