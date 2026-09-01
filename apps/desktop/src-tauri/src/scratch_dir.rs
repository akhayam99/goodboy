use std::path::{Path, PathBuf};

use thiserror::Error;

#[derive(Debug, Error)]
pub enum ScratchDirError {
    #[error("invalid session id")]
    InvalidSessionId,
    #[error("goodboy root unavailable: {0}")]
    Root(String),
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
}

crate::util::impl_error_serialize!(ScratchDirError);

impl ScratchDirError {
    fn kind(&self) -> &'static str {
        match self {
            ScratchDirError::InvalidSessionId => "invalid_session_id",
            ScratchDirError::Root(_) => "root",
            ScratchDirError::Io(_) => "io",
        }
    }
}

fn validate_session_id(session_id: &str) -> Result<(), ScratchDirError> {
    let bytes = session_id.as_bytes();
    if bytes.len() != 36 {
        return Err(ScratchDirError::InvalidSessionId);
    }
    for (index, byte) in bytes.iter().enumerate() {
        let valid = match index {
            8 | 13 | 18 | 23 => *byte == b'-',
            _ => byte.is_ascii_hexdigit(),
        };
        if !valid {
            return Err(ScratchDirError::InvalidSessionId);
        }
    }
    Ok(())
}

fn scratch_path(root: &Path, session_id: &str) -> Result<PathBuf, ScratchDirError> {
    validate_session_id(session_id)?;
    Ok(root.join("scratch").join(session_id))
}

fn goodboy_root() -> Result<PathBuf, ScratchDirError> {
    let db_path =
        crate::db::resolve_db_path().map_err(|error| ScratchDirError::Root(error.to_string()))?;
    match db_path.parent() {
        Some(parent) => Ok(parent.to_path_buf()),
        None => Err(ScratchDirError::Root("db path has no parent".to_string())),
    }
}

fn prepare_in(root: &Path, session_id: &str) -> Result<String, ScratchDirError> {
    let target = scratch_path(root, session_id)?;
    std::fs::create_dir_all(&target)?;
    Ok(target.to_string_lossy().into_owned())
}

fn remove_in(root: &Path, session_id: &str) -> Result<(), ScratchDirError> {
    let target = scratch_path(root, session_id)?;
    match std::fs::remove_dir_all(target) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(error.into()),
    }
}

#[tauri::command]
pub fn scratch_dir_prepare(session_id: String) -> Result<String, ScratchDirError> {
    prepare_in(&goodboy_root()?, &session_id)
}

#[tauri::command]
pub async fn scratch_dir_remove(session_id: String) -> Result<(), ScratchDirError> {
    tauri::async_runtime::spawn_blocking(move || scratch_dir_remove_blocking(session_id))
        .await
        .map_err(|e| ScratchDirError::Io(std::io::Error::other(e.to_string())))?
}

fn scratch_dir_remove_blocking(session_id: String) -> Result<(), ScratchDirError> {
    remove_in(&goodboy_root()?, &session_id)
}

#[cfg(test)]
mod tests {
    use std::path::Path;

    use super::{prepare_in, remove_in, scratch_path, ScratchDirError};

    const SESSION_ID: &str = "6f616b42-0ed8-471e-823f-ee4aca6b7ce9";

    fn test_root(name: &str) -> std::path::PathBuf {
        std::env::temp_dir().join(format!(
            "goodboy-{name}-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ))
    }

    #[test]
    fn builds_the_scratch_path_under_root_for_a_uuid() {
        let path = scratch_path(Path::new("/tmp/goodboy-root"), SESSION_ID).unwrap();
        assert_eq!(
            path,
            Path::new("/tmp/goodboy-root")
                .join("scratch")
                .join(SESSION_ID)
        );
    }

    #[test]
    fn rejects_traversal_shaped_and_non_uuid_ids() {
        let invalid = [
            "../../../../../../etc/passwd-aaaaaaaaaaa",
            "..%2f..%2f..%2f..%2f..%2f..%2fetc%2fpwd",
            "6f616b42-0ed8-471e-823f-ee4aca6b7ce9/x",
            "6f616b42.0ed8.471e.823f.ee4aca6b7ce9aa",
            "6f616b42-0ed8-471e-823f",
            "",
        ];
        for id in invalid {
            let result = scratch_path(Path::new("/tmp/goodboy-root"), id);
            assert!(matches!(result, Err(ScratchDirError::InvalidSessionId)));
        }
    }

    #[test]
    fn prepares_and_removes_the_scratch_directory() {
        let root = test_root("scratch");
        let created = prepare_in(&root, SESSION_ID).unwrap();
        assert!(Path::new(&created).is_dir());
        assert!(created.ends_with(&format!("scratch/{SESSION_ID}")));

        remove_in(&root, SESSION_ID).unwrap();
        assert!(!Path::new(&created).exists());

        remove_in(&root, SESSION_ID).unwrap();
        std::fs::remove_dir_all(root).unwrap();
    }
}
