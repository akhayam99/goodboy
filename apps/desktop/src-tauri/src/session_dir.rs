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
    #[error("session directory already belongs to another session")]
    SessionDirectoryConflict,
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
            SessionDirError::SessionDirectoryConflict => "session_directory_conflict",
            SessionDirError::InvalidDirectoryName => "invalid_directory_name",
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
    #[serde(rename = "directoryName")]
    pub directory_name: Option<String>,
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

fn marker_read(path: &Path) -> Result<SessionMarker, SessionDirError> {
    let marker = std::fs::read(path.join(".goodboy"))?;
    Ok(serde_json::from_slice::<SessionMarker>(&marker)?)
}

fn validate_directory_name(name: &str) -> Result<(), SessionDirError> {
    if name.is_empty() {
        return Err(SessionDirError::InvalidDirectoryName);
    }
    if name.chars().count() > 60 {
        return Err(SessionDirError::InvalidDirectoryName);
    }
    if name.contains('/') || name.contains('\\') {
        return Err(SessionDirError::InvalidDirectoryName);
    }
    if name.contains("..") {
        return Err(SessionDirError::InvalidDirectoryName);
    }
    if name.starts_with('.') {
        return Err(SessionDirError::InvalidDirectoryName);
    }
    if name.ends_with('.') || name.ends_with(' ') {
        return Err(SessionDirError::InvalidDirectoryName);
    }
    if name.chars().any(|ch| ch.is_control()) {
        return Err(SessionDirError::InvalidDirectoryName);
    }
    if name
        .chars()
        .any(|ch| matches!(ch, ':' | '*' | '?' | '"' | '<' | '>' | '|'))
    {
        return Err(SessionDirError::InvalidDirectoryName);
    }
    Ok(())
}

fn resolve_directory_name(args: &CreateArgs) -> Result<String, SessionDirError> {
    let Some(name) = args.directory_name.as_deref() else {
        return Ok(crate::worktree::sanitize_slug(&args.slug));
    };
    validate_directory_name(name)?;
    Ok(name.to_string())
}

#[tauri::command]
pub fn session_container_prepare(path: String) -> Result<String, SessionDirError> {
    let resolved = create_absolute_dir(expand_home(&path)?)?;
    Ok(resolved.to_string_lossy().into_owned())
}

#[tauri::command]
pub fn session_dir_create(args: CreateArgs) -> Result<CreatedSessionDir, SessionDirError> {
    let base = expand_home(&args.base_path)?;
    let slug = resolve_directory_name(&args)?;
    let target = absolute_path(base)?.join("sessions").join(&slug);
    if target.exists() {
        let metadata = std::fs::symlink_metadata(&target)?;
        if !metadata.is_dir() {
            return Err(SessionDirError::SessionDirectoryConflict);
        }
        let marker = match marker_read(&target) {
            Ok(marker) => marker,
            Err(SessionDirError::Io(error)) if error.kind() == std::io::ErrorKind::NotFound => {
                return Err(SessionDirError::SessionDirectoryConflict);
            }
            Err(SessionDirError::Json(_)) => return Err(SessionDirError::SessionDirectoryConflict),
            Err(error) => return Err(error),
        };
        if marker.session_id != args.session_id {
            return Err(SessionDirError::SessionDirectoryConflict);
        }
        let resolved = std::fs::canonicalize(target)?;
        return Ok(CreatedSessionDir {
            worktree_path: resolved.to_string_lossy().into_owned(),
            branch_name: String::new(),
            slug,
            reused: true,
        });
    }
    let resolved = create_absolute_dir(target)?;
    marker_write(&resolved, args.session_id, args.workspace_id)?;
    Ok(CreatedSessionDir {
        worktree_path: resolved.to_string_lossy().into_owned(),
        branch_name: String::new(),
        slug,
        reused: false,
    })
}

#[tauri::command]
pub fn session_dir_remove(args: RemoveArgs) -> Result<(), SessionDirError> {
    let base = absolute_path(expand_home(&args.base_path)?)?;
    let target = absolute_path(expand_home(&args.path)?)?;
    let is_contained = match (std::fs::canonicalize(&base), std::fs::canonicalize(&target)) {
        (Ok(resolved_base), Ok(resolved_target)) => {
            resolved_target.starts_with(&resolved_base) && resolved_target != resolved_base
        }
        _ => target.starts_with(&base) && target != base,
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
pub fn session_marker_write(
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
pub fn session_dir_exists(path: String) -> Result<bool, SessionDirError> {
    Ok(absolute_path(expand_home(&path)?)?.is_dir())
}

#[cfg(test)]
mod tests {
    use std::path::Path;

    use super::{session_dir_create, CreateArgs, SessionDirError, SessionMarker};

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
        let first_created_at = marker.created_at.clone();
        let reused = session_dir_create(args()).unwrap();
        assert!(reused.reused);
        let marker_after_reuse =
            std::fs::read(Path::new(&created.worktree_path).join(".goodboy")).unwrap();
        let marker_after_reuse =
            serde_json::from_slice::<SessionMarker>(&marker_after_reuse).unwrap();
        assert_eq!(marker_after_reuse.created_at, first_created_at);
        assert_eq!(marker_after_reuse.workspace_id, "workspace-1");
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn removes_a_nested_session_directory_and_refuses_anything_else() {
        let root = test_root("simple-session-remove");
        let created = session_dir_create(CreateArgs {
            base_path: root.to_string_lossy().into_owned(),
            slug: "Study Plan".to_string(),
            directory_name: None,
            session_id: "session-1".to_string(),
            workspace_id: "workspace-1".to_string(),
        })
        .unwrap();

        super::session_dir_remove(super::RemoveArgs {
            base_path: root.to_string_lossy().into_owned(),
            path: created.worktree_path.clone(),
        })
        .unwrap();
        assert!(!Path::new(&created.worktree_path).exists());

        let outside = super::session_dir_remove(super::RemoveArgs {
            base_path: root.to_string_lossy().into_owned(),
            path: std::env::temp_dir().to_string_lossy().into_owned(),
        });
        assert!(matches!(outside, Err(SessionDirError::OutsideWorkspace)));

        let base_itself = super::session_dir_remove(super::RemoveArgs {
            base_path: root.to_string_lossy().into_owned(),
            path: root.to_string_lossy().into_owned(),
        });
        assert!(matches!(base_itself, Err(SessionDirError::OutsideWorkspace)));
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn rejects_reusing_a_directory_without_marker() {
        let root = test_root("simple-session-missing-marker");
        let sessions = root.join("sessions");
        std::fs::create_dir_all(sessions.join("study-plan")).unwrap();

        let result = session_dir_create(CreateArgs {
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
        let created = session_dir_create(CreateArgs {
            base_path: root.to_string_lossy().into_owned(),
            slug: "Study Plan".to_string(),
            directory_name: None,
            session_id: "session-1".to_string(),
            workspace_id: "workspace-1".to_string(),
        })
        .unwrap();

        let result = session_dir_create(CreateArgs {
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
        let created = session_dir_create(CreateArgs {
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
            let result = session_dir_create(CreateArgs {
                base_path: root.to_string_lossy().into_owned(),
                slug: "ignored".to_string(),
                directory_name: Some(name.to_string()),
                session_id: "session-1".to_string(),
                workspace_id: "workspace-1".to_string(),
            });
            assert!(matches!(result, Err(SessionDirError::InvalidDirectoryName)));
        }

        let control_result = session_dir_create(CreateArgs {
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
