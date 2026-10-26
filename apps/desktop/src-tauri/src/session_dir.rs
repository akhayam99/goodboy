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
    #[cfg(test)]
    #[error("session directory already belongs to another session")]
    SessionDirectoryConflict,
    #[cfg(test)]
    #[error("invalid session directory name")]
    InvalidDirectoryName,
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
            #[cfg(test)]
            SessionDirError::SessionDirectoryConflict => "session_directory_conflict",
            #[cfg(test)]
            SessionDirError::InvalidDirectoryName => "invalid_directory_name",
            SessionDirError::Io(_) => "io",
            SessionDirError::Json(_) => "json",
        }
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoveArgs {
    pub session_id: String,
    pub path: String,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SessionMarker {
    pub(crate) session_id: String,
    workspace_id: String,
    created_at: String,
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

const MARKER_DIR: &str = ".goodboy";
const MARKER_FILE: &str = "session.json";

fn marker_path(path: &Path) -> PathBuf {
    path.join(MARKER_DIR).join(MARKER_FILE)
}

pub fn migrate_legacy_marker(path: &Path) -> std::io::Result<()> {
    let legacy = path.join(MARKER_DIR);
    if !legacy.is_file() {
        return Ok(());
    }
    let bytes = std::fs::read(&legacy)?;
    std::fs::remove_file(&legacy)?;
    std::fs::create_dir_all(path.join(MARKER_DIR))?;
    std::fs::write(marker_path(path), bytes)?;
    Ok(())
}

pub(crate) fn marker_read(path: &Path) -> Result<SessionMarker, SessionDirError> {
    let modern = marker_path(path);
    let marker = if modern.is_file() {
        std::fs::read(modern)?
    } else {
        std::fs::read(path.join(MARKER_DIR))?
    };
    Ok(serde_json::from_slice::<SessionMarker>(&marker)?)
}

#[tauri::command]
pub async fn session_dir_remove(args: RemoveArgs) -> Result<(), SessionDirError> {
    tauri::async_runtime::spawn_blocking(move || session_dir_remove_blocking(args))
        .await
        .map_err(|e| SessionDirError::Io(std::io::Error::other(e.to_string())))?
}

fn session_dir_remove_blocking(args: RemoveArgs) -> Result<(), SessionDirError> {
    let target = absolute_path(expand_home(&args.path)?)?;
    let (Some(parent), Some(name)) = (target.parent(), target.file_name()) else {
        return Err(SessionDirError::OutsideWorkspace);
    };
    let parent = match std::fs::canonicalize(parent) {
        Ok(parent) => parent,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(()),
        Err(error) => return Err(error.into()),
    };
    let resolved = parent.join(name);
    match std::fs::symlink_metadata(&resolved) {
        Ok(metadata) if metadata.is_dir() => {}
        Ok(_) => return Err(SessionDirError::OutsideWorkspace),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(()),
        Err(error) => return Err(error.into()),
    }
    if !is_owned_session_dir(&resolved, &args.session_id)
        && !is_owned_session_dir(&parent, &args.session_id)
    {
        return Err(SessionDirError::OutsideWorkspace);
    }
    match std::fs::remove_dir_all(resolved) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(error.into()),
    }
}

fn is_owned_session_dir(dir: &Path, session_id: &str) -> bool {
    let Some(parent) = dir.parent() else {
        return false;
    };
    if parent.file_name() != Some(std::ffi::OsStr::new("sessions")) {
        return false;
    }
    matches!(marker_read(dir), Ok(marker) if marker.session_id == session_id)
}

#[tauri::command]
pub async fn session_dir_exists(path: String) -> Result<bool, SessionDirError> {
    tauri::async_runtime::spawn_blocking(move || session_dir_exists_blocking(path))
        .await
        .map_err(|e| SessionDirError::Io(std::io::Error::other(e.to_string())))?
}

fn session_dir_exists_blocking(path: String) -> Result<bool, SessionDirError> {
    Ok(absolute_path(expand_home(&path)?)?.is_dir())
}

#[cfg(test)]
mod wire_shape;

#[cfg(test)]
pub(crate) mod testing;

#[cfg(test)]
pub(crate) use testing::{session_dir_create_blocking, CreateArgs, CreatedSessionDir};

#[cfg(test)]
mod tests {
    use std::path::Path;

    use super::{session_dir_create_blocking, CreateArgs, SessionDirError, SessionMarker};

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
            directory_name: None,
            session_id: "session-1".to_string(),
            workspace_id: "workspace-1".to_string(),
        };
        let created = session_dir_create_blocking(args()).unwrap();
        assert_eq!(created.branch_name, "");
        assert_eq!(created.slug, "study-plan");
        assert!(!created.reused);
        assert!(Path::new(&created.worktree_path).is_dir());
        let marker = std::fs::read(
            Path::new(&created.worktree_path)
                .join(".goodboy")
                .join("session.json"),
        )
        .unwrap();
        let marker = serde_json::from_slice::<SessionMarker>(&marker).unwrap();
        assert_eq!(marker.session_id, "session-1");
        assert_eq!(marker.workspace_id, "workspace-1");
        assert!(!marker.created_at.is_empty());
        let first_created_at = marker.created_at.clone();
        let reused = session_dir_create_blocking(args()).unwrap();
        assert!(reused.reused);
        let marker_after_reuse = std::fs::read(
            Path::new(&created.worktree_path)
                .join(".goodboy")
                .join("session.json"),
        )
        .unwrap();
        let marker_after_reuse =
            serde_json::from_slice::<SessionMarker>(&marker_after_reuse).unwrap();
        assert_eq!(marker_after_reuse.created_at, first_created_at);
        assert_eq!(marker_after_reuse.workspace_id, "workspace-1");
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn reuses_a_directory_marked_with_the_legacy_marker_file() {
        let root = test_root("legacy-marker");
        let target = root.join("sessions").join("study-plan");
        std::fs::create_dir_all(&target).unwrap();
        std::fs::write(
            target.join(".goodboy"),
            br#"{"sessionId":"session-1","workspaceId":"workspace-1","createdAt":"2026-01-01T00:00:00Z"}"#,
        )
        .unwrap();
        let created = session_dir_create_blocking(CreateArgs {
            base_path: root.to_string_lossy().into_owned(),
            slug: "Study Plan".to_string(),
            directory_name: None,
            session_id: "session-1".to_string(),
            workspace_id: "workspace-1".to_string(),
        })
        .unwrap();
        assert!(created.reused);
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn removes_a_nested_session_directory_and_refuses_anything_else() {
        let root = test_root("simple-session-remove");
        let created = session_dir_create_blocking(CreateArgs {
            base_path: root.to_string_lossy().into_owned(),
            slug: "Study Plan".to_string(),
            directory_name: None,
            session_id: "session-1".to_string(),
            workspace_id: "workspace-1".to_string(),
        })
        .unwrap();

        super::session_dir_remove_blocking(remove_args("session-1", &created.worktree_path))
            .unwrap();
        assert!(!Path::new(&created.worktree_path).exists());

        std::fs::remove_dir_all(root).unwrap();
    }

    fn remove_args(session_id: &str, path: &str) -> super::RemoveArgs {
        super::RemoveArgs {
            session_id: session_id.to_string(),
            path: path.to_string(),
        }
    }

    fn created_session(root: &Path, session_id: &str) -> super::CreatedSessionDir {
        session_dir_create_blocking(CreateArgs {
            base_path: root.to_string_lossy().into_owned(),
            slug: "Study Plan".to_string(),
            directory_name: None,
            session_id: session_id.to_string(),
            workspace_id: "workspace-1".to_string(),
        })
        .unwrap()
    }

    #[test]
    fn refuses_a_root_a_home_and_a_project_folder() {
        let root = test_root("simple-session-remove-refuse");
        let created = created_session(&root, "session-1");
        let project = root.join("projects").join("harborline");
        std::fs::create_dir_all(&project).unwrap();
        std::fs::write(project.join("keep.txt"), "keep").unwrap();

        for path in [
            "/".to_string(),
            std::env::temp_dir().to_string_lossy().into_owned(),
            root.to_string_lossy().into_owned(),
            root.join("sessions").to_string_lossy().into_owned(),
            project.to_string_lossy().into_owned(),
            dirs::home_dir().unwrap().to_string_lossy().into_owned(),
        ] {
            let result = super::session_dir_remove_blocking(remove_args("session-1", &path));
            assert!(
                matches!(result, Err(SessionDirError::OutsideWorkspace)),
                "{path} must be refused"
            );
        }
        assert!(project.join("keep.txt").exists());
        assert!(Path::new(&created.worktree_path).exists());
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn refuses_a_session_directory_owned_by_another_session() {
        let root = test_root("simple-session-remove-other");
        let created = created_session(&root, "session-1");

        let result =
            super::session_dir_remove_blocking(remove_args("session-2", &created.worktree_path));

        assert!(matches!(result, Err(SessionDirError::OutsideWorkspace)));
        assert!(Path::new(&created.worktree_path).exists());
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn refuses_a_sessions_child_without_a_marker() {
        let root = test_root("simple-session-remove-unmarked");
        let unmarked = root.join("sessions").join("notes");
        std::fs::create_dir_all(&unmarked).unwrap();

        let result = super::session_dir_remove_blocking(remove_args(
            "session-1",
            &unmarked.to_string_lossy(),
        ));

        assert!(matches!(result, Err(SessionDirError::OutsideWorkspace)));
        assert!(unmarked.exists());
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn removes_a_mount_directory_inside_an_owned_session_directory() {
        let root = test_root("simple-session-remove-mount");
        let created = created_session(&root, "session-1");
        let mount = Path::new(&created.worktree_path).join("northwind");
        std::fs::create_dir_all(&mount).unwrap();

        super::session_dir_remove_blocking(remove_args("session-1", &mount.to_string_lossy()))
            .unwrap();

        assert!(!mount.exists());
        assert!(Path::new(&created.worktree_path).exists());
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn removing_a_missing_session_directory_succeeds() {
        let root = test_root("simple-session-remove-missing");
        let missing = root.join("sessions").join("gone");

        let result = super::session_dir_remove_blocking(remove_args(
            "session-1",
            &missing.to_string_lossy(),
        ));

        assert!(result.is_ok());
    }

    #[cfg(unix)]
    #[test]
    fn refuses_a_session_directory_replaced_by_a_symlink() {
        let root = test_root("simple-session-remove-link");
        let created = created_session(&root, "session-1");
        let victim = root.join("projects").join("harborline");
        std::fs::create_dir_all(&victim).unwrap();
        std::fs::remove_dir_all(&created.worktree_path).unwrap();
        std::os::unix::fs::symlink(&victim, &created.worktree_path).unwrap();

        let result =
            super::session_dir_remove_blocking(remove_args("session-1", &created.worktree_path));

        assert!(matches!(result, Err(SessionDirError::OutsideWorkspace)));
        assert!(victim.exists());
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn rejects_reusing_a_directory_without_marker() {
        let root = test_root("simple-session-missing-marker");
        let sessions = root.join("sessions");
        std::fs::create_dir_all(sessions.join("study-plan")).unwrap();

        let result = session_dir_create_blocking(CreateArgs {
            base_path: root.to_string_lossy().into_owned(),
            slug: "Study Plan".to_string(),
            directory_name: None,
            session_id: "session-1".to_string(),
            workspace_id: "workspace-1".to_string(),
        });

        assert!(matches!(
            result,
            Err(SessionDirError::SessionDirectoryConflict)
        ));
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn rejects_reusing_a_directory_owned_by_another_session() {
        let root = test_root("simple-session-session-conflict");
        let created = session_dir_create_blocking(CreateArgs {
            base_path: root.to_string_lossy().into_owned(),
            slug: "Study Plan".to_string(),
            directory_name: None,
            session_id: "session-1".to_string(),
            workspace_id: "workspace-1".to_string(),
        })
        .unwrap();

        let result = session_dir_create_blocking(CreateArgs {
            base_path: root.to_string_lossy().into_owned(),
            slug: "Study Plan".to_string(),
            directory_name: None,
            session_id: "session-2".to_string(),
            workspace_id: "workspace-1".to_string(),
        });

        assert!(matches!(
            result,
            Err(SessionDirError::SessionDirectoryConflict)
        ));
        assert!(Path::new(&created.worktree_path).is_dir());
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn creates_a_directory_from_an_explicit_name() {
        let root = test_root("simple-session-explicit-name");
        let created = session_dir_create_blocking(CreateArgs {
            base_path: root.to_string_lossy().into_owned(),
            slug: "ignored".to_string(),
            directory_name: Some("MatchAnalysis_20260514".to_string()),
            session_id: "session-1".to_string(),
            workspace_id: "workspace-1".to_string(),
        })
        .unwrap();

        assert_eq!(created.slug, "MatchAnalysis_20260514");
        assert!(created
            .worktree_path
            .ends_with("/sessions/MatchAnalysis_20260514"));
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn rejects_invalid_explicit_directory_names() {
        let root = test_root("simple-session-invalid-explicit-name");
        let too_long = "a".repeat(61);
        let invalid_names = [
            ".hidden",
            "name/part",
            "name\\part",
            "name..part",
            "name.",
            "name ",
            "name|part",
            &too_long,
        ];

        for name in invalid_names {
            let result = session_dir_create_blocking(CreateArgs {
                base_path: root.to_string_lossy().into_owned(),
                slug: "ignored".to_string(),
                directory_name: Some(name.to_string()),
                session_id: "session-1".to_string(),
                workspace_id: "workspace-1".to_string(),
            });
            assert!(matches!(result, Err(SessionDirError::InvalidDirectoryName)));
        }

        let control_result = session_dir_create_blocking(CreateArgs {
            base_path: root.to_string_lossy().into_owned(),
            slug: "ignored".to_string(),
            directory_name: Some("name\u{0007}part".to_string()),
            session_id: "session-1".to_string(),
            workspace_id: "workspace-1".to_string(),
        });
        assert!(matches!(
            control_result,
            Err(SessionDirError::InvalidDirectoryName)
        ));
    }
}
