use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum SessionDirError {
    #[error("home directory is unavailable")]
    HomeUnavailable,
    #[error("directory path cannot be empty")]
    EmptyPath,
    #[error("refusing to remove a path outside the workspace")]
    OutsideWorkspace,
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("json error: {0}")]
    Json(#[from] serde_json::Error),
}

crate::util::impl_error_serialize!(SessionDirError);

impl SessionDirError {
    fn kind(&self) -> &'static str {
        match self {
            SessionDirError::HomeUnavailable => "home_unavailable",
            SessionDirError::EmptyPath => "empty_path",
            SessionDirError::OutsideWorkspace => "outside_workspace",
            SessionDirError::Io(_) => "io",
            SessionDirError::Json(_) => "json",
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct CreateArgs {
    #[serde(rename = "basePath")]
    pub base_path: String,
    pub slug: String,
    #[serde(rename = "sessionId")]
    pub session_id: String,
    #[serde(rename = "workspaceId")]
    pub workspace_id: String,
}

#[derive(Debug, Deserialize)]
pub struct RemoveArgs {
    #[serde(rename = "basePath")]
    pub base_path: String,
    pub path: String,
}

#[derive(Debug, Serialize)]
pub struct CreatedSessionDir {
    #[serde(rename = "worktreePath")]
    pub worktree_path: String,
    #[serde(rename = "branchName")]
    pub branch_name: String,
    pub slug: String,
    pub reused: bool,
}

#[derive(Debug, Deserialize, Serialize)]
struct SessionMarker {
    #[serde(rename = "sessionId")]
    session_id: String,
    #[serde(rename = "workspaceId")]
    workspace_id: String,
    #[serde(rename = "createdAt")]
    created_at: String,
}

#[derive(Debug, Serialize)]
pub struct SimpleSessionScanEntry {
    #[serde(rename = "sessionId")]
    pub session_id: String,
    #[serde(rename = "workspaceId")]
    pub workspace_id: String,
    pub path: String,
}

fn expand_home(path: &str) -> Result<PathBuf, SessionDirError> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err(SessionDirError::EmptyPath);
    }
    if trimmed == "~" {
        return dirs::home_dir().ok_or(SessionDirError::HomeUnavailable);
    }
    if let Some(rest) = trimmed.strip_prefix("~/") {
        return Ok(dirs::home_dir()
            .ok_or(SessionDirError::HomeUnavailable)?
            .join(rest));
    }
    Ok(PathBuf::from(trimmed))
}

fn absolute_path(path: PathBuf) -> Result<PathBuf, SessionDirError> {
    if path.is_absolute() {
        return Ok(path);
    }
    Ok(std::env::current_dir()?.join(path))
}

fn create_absolute_dir(path: PathBuf) -> Result<PathBuf, SessionDirError> {
    let absolute = absolute_path(path)?;
    std::fs::create_dir_all(&absolute)?;
    Ok(std::fs::canonicalize(absolute)?)
}

fn marker_write(
    path: &Path,
    session_id: String,
    workspace_id: String,
) -> Result<(), SessionDirError> {
    let marker = SessionMarker {
        session_id,
        workspace_id,
        created_at: crate::util::iso_now(),
    };
    std::fs::write(path.join(".goodboy"), serde_json::to_vec(&marker)?)?;
    Ok(())
}

fn scan_directory(path: &Path, root: &Path) -> Option<SimpleSessionScanEntry> {
    let metadata = std::fs::symlink_metadata(path).ok()?;
    if !metadata.file_type().is_dir() {
        return None;
    }
    let resolved = std::fs::canonicalize(path).ok()?;
    if !resolved.starts_with(root) {
        return None;
    }
    let marker = std::fs::read(path.join(".goodboy")).ok()?;
    let marker = serde_json::from_slice::<SessionMarker>(&marker).ok()?;
    Some(SimpleSessionScanEntry {
        session_id: marker.session_id,
        workspace_id: marker.workspace_id,
        path: resolved.to_string_lossy().into_owned(),
    })
}

fn scan_children(path: &Path, root: &Path) -> Vec<SimpleSessionScanEntry> {
    let Ok(entries) = std::fs::read_dir(path) else {
        return Vec::new();
    };
    entries
        .filter_map(Result::ok)
        .filter_map(|entry| scan_directory(&entry.path(), root))
        .collect()
}

#[tauri::command]
pub fn simple_workspace_default_path(name: String) -> Result<String, SessionDirError> {
    let home = dirs::home_dir().ok_or(SessionDirError::HomeUnavailable)?;
    let slug = crate::worktree::sanitize_slug(&name);
    Ok(home
        .join("Documents")
        .join("Goodboy")
        .join(slug)
        .to_string_lossy()
        .into_owned())
}

#[tauri::command]
pub fn simple_workspace_prepare(path: String) -> Result<String, SessionDirError> {
    let resolved = create_absolute_dir(expand_home(&path)?)?;
    Ok(resolved.to_string_lossy().into_owned())
}

#[tauri::command]
pub fn session_dir_create(args: CreateArgs) -> Result<CreatedSessionDir, SessionDirError> {
    let base = expand_home(&args.base_path)?;
    let slug = crate::worktree::sanitize_slug(&args.slug);
    let target = absolute_path(base)?.join("sessions").join(&slug);
    let reused = target.exists();
    let resolved = create_absolute_dir(target)?;
    marker_write(&resolved, args.session_id, args.workspace_id)?;
    Ok(CreatedSessionDir {
        worktree_path: resolved.to_string_lossy().into_owned(),
        branch_name: String::new(),
        slug,
        reused,
    })
}

#[tauri::command]
pub fn session_dir_remove(args: RemoveArgs) -> Result<(), SessionDirError> {
    let base = absolute_path(expand_home(&args.base_path)?)?;
    let target = absolute_path(expand_home(&args.path)?)?;
    let is_contained = match (
        std::fs::canonicalize(&base),
        std::fs::canonicalize(&target),
    ) {
        (Ok(resolved_base), Ok(resolved_target)) => {
            resolved_target.parent() == Some(resolved_base.as_path())
        }
        _ => target.parent() == Some(base.as_path()),
    };
    if !is_contained {
        return Err(SessionDirError::OutsideWorkspace);
    }
    match std::fs::remove_dir_all(target) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(error.into()),
    }
}

#[tauri::command]
pub fn simple_sessions_scan(
    root_path: String,
) -> Result<Vec<SimpleSessionScanEntry>, SessionDirError> {
    let root = absolute_path(expand_home(&root_path)?)?;
    let Ok(root) = std::fs::canonicalize(root) else {
        return Ok(Vec::new());
    };
    let mut entries = scan_children(&root.join("sessions"), &root);
    entries.extend(scan_children(&root, &root));
    Ok(entries)
}

#[tauri::command]
pub fn simple_session_marker_write(
    path: String,
    session_id: String,
    workspace_id: String,
) -> Result<(), SessionDirError> {
    marker_write(
        &absolute_path(expand_home(&path)?)?,
        session_id,
        workspace_id,
    )
}

#[tauri::command]
pub fn simple_session_dir_exists(path: String) -> Result<bool, SessionDirError> {
    Ok(absolute_path(expand_home(&path)?)?.is_dir())
}

#[cfg(test)]
mod tests {
    use std::path::Path;

    use super::{session_dir_create, simple_sessions_scan, CreateArgs, SessionMarker};

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
    fn creates_and_reuses_a_marked_session_directory() {
        let root = test_root("simple-session");
        let args = || CreateArgs {
            base_path: root.to_string_lossy().into_owned(),
            slug: "Study Plan".to_string(),
            session_id: "session-1".to_string(),
            workspace_id: "workspace-1".to_string(),
        };
        let created = session_dir_create(args()).unwrap();
        assert_eq!(created.branch_name, "");
        assert_eq!(created.slug, "study-plan");
        assert!(!created.reused);
        assert!(Path::new(&created.worktree_path).is_dir());
        let marker = std::fs::read(Path::new(&created.worktree_path).join(".goodboy")).unwrap();
        let marker = serde_json::from_slice::<SessionMarker>(&marker).unwrap();
        assert_eq!(marker.session_id, "session-1");
        assert_eq!(marker.workspace_id, "workspace-1");
        assert!(!marker.created_at.is_empty());
        let reused = session_dir_create(args()).unwrap();
        assert!(reused.reused);
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn scans_session_and_root_children_for_markers() {
        let root = test_root("simple-session-scan");
        let created = session_dir_create(CreateArgs {
            base_path: root.to_string_lossy().into_owned(),
            slug: "Study Plan".to_string(),
            session_id: "session-1".to_string(),
            workspace_id: "workspace-1".to_string(),
        })
        .unwrap();
        let moved = root.join("study-plan-moved");
        std::fs::rename(&created.worktree_path, &moved).unwrap();
        let moved = std::fs::canonicalize(moved).unwrap();
        let second = session_dir_create(CreateArgs {
            base_path: root.to_string_lossy().into_owned(),
            slug: "Second Plan".to_string(),
            session_id: "session-2".to_string(),
            workspace_id: "workspace-1".to_string(),
        })
        .unwrap();

        let scanned = simple_sessions_scan(root.to_string_lossy().into_owned()).unwrap();

        assert_eq!(scanned.len(), 2);
        assert!(scanned
            .iter()
            .any(|entry| entry.session_id == "session-1" && entry.path == moved.to_string_lossy()));
        assert!(scanned
            .iter()
            .any(|entry| entry.session_id == "session-2" && entry.path == second.worktree_path));
        std::fs::remove_dir_all(root).unwrap();
    }

    #[cfg(unix)]
    #[test]
    fn skips_symlinked_session_directories() {
        let root = test_root("simple-session-symlink");
        let outside = test_root("simple-session-outside");
        let created = session_dir_create(CreateArgs {
            base_path: outside.to_string_lossy().into_owned(),
            slug: "Outside Plan".to_string(),
            session_id: "session-outside".to_string(),
            workspace_id: "workspace-1".to_string(),
        })
        .unwrap();
        let sessions = root.join("sessions");
        std::fs::create_dir_all(&sessions).unwrap();
        std::os::unix::fs::symlink(&created.worktree_path, sessions.join("linked-plan")).unwrap();

        let scanned = simple_sessions_scan(root.to_string_lossy().into_owned()).unwrap();

        assert!(scanned.is_empty());
        std::fs::remove_dir_all(root).unwrap();
        std::fs::remove_dir_all(outside).unwrap();
    }

    #[test]
    fn scan_entries_include_marker_workspace_id() {
        let root = test_root("simple-session-workspace-id");
        session_dir_create(CreateArgs {
            base_path: root.to_string_lossy().into_owned(),
            slug: "Study Plan".to_string(),
            session_id: "session-1".to_string(),
            workspace_id: "workspace-marker".to_string(),
        })
        .unwrap();

        let scanned = simple_sessions_scan(root.to_string_lossy().into_owned()).unwrap();

        assert_eq!(scanned.len(), 1);
        assert_eq!(scanned[0].workspace_id, "workspace-marker");
        std::fs::remove_dir_all(root).unwrap();
    }
}
