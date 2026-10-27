use std::fs;
use std::path::{Path, PathBuf};
use std::sync::PoisonError;

use super::folder_store::{folder_key, folder_lock, read_json, write_json_atomic, Store};
use super::FileVersionsError;

const FOLDER_PATH_KEY: &str = "folderPath";

fn keyed_path(path: &Path) -> PathBuf {
    if let Ok(found) = fs::canonicalize(path) {
        return found;
    }
    match (path.parent().map(fs::canonicalize), path.file_name()) {
        (Some(Ok(parent)), Some(name)) => parent.join(name),
        _ => path.to_path_buf(),
    }
}

fn json_files(dir: &Path) -> Vec<PathBuf> {
    let Ok(entries) = fs::read_dir(dir) else {
        return Vec::new();
    };
    let mut files = Vec::new();
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            files.extend(json_files(&path));
            continue;
        }
        if path.extension().and_then(|ext| ext.to_str()) == Some("json") {
            files.push(path);
        }
    }
    files
}

fn point_at(path: &Path, from: &str, to: &str) -> Result<(), FileVersionsError> {
    let Some(mut document) = read_json::<serde_json::Value>(path)? else {
        return Ok(());
    };
    let Some(current) = document
        .get(FOLDER_PATH_KEY)
        .and_then(|value| value.as_str())
    else {
        return Ok(());
    };
    if current != from {
        return Ok(());
    }
    document[FOLDER_PATH_KEY] = serde_json::Value::String(to.to_string());
    write_json_atomic(path, &document)
}

pub(super) fn rekey_folder(
    store: &Store,
    from: &Path,
    to: &Path,
) -> Result<bool, FileVersionsError> {
    let from_path = keyed_path(from);
    let to_path = keyed_path(to);
    let from_key = folder_key(&from_path);
    let to_key = folder_key(&to_path);
    if from_key == to_key {
        return Ok(false);
    }
    let source = store.folders.join(&from_key);
    if !source.is_dir() {
        return Ok(false);
    }
    let target = store.folders.join(&to_key);
    if target.exists() {
        return Err(FileVersionsError::FolderVersionsExist);
    }
    let lock = folder_lock(&from_key);
    let _guard = lock.lock().unwrap_or_else(PoisonError::into_inner);
    fs::rename(&source, &target)?;
    let from_text = from_path.to_string_lossy().into_owned();
    let to_text = to_path.to_string_lossy().into_owned();
    let mut documents = vec![target.join("index.json")];
    documents.extend(json_files(&target.join("turns")));
    documents.extend(json_files(&target.join("staging")));
    for document in documents {
        point_at(&document, &from_text, &to_text)?;
    }
    Ok(true)
}
