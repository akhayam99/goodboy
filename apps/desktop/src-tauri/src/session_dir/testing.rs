use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use super::{
    absolute_path, expand_home, marker_path, marker_read, migrate_legacy_marker, SessionDirError,
    SessionMarker, MARKER_DIR,
};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateArgs {
    pub base_path: String,
    pub slug: String,
    pub directory_name: Option<String>,
    pub session_id: String,
    pub workspace_id: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatedSessionDir {
    pub worktree_path: String,
    pub branch_name: String,
    pub slug: String,
    pub reused: bool,
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
    migrate_legacy_marker(path)?;
    std::fs::create_dir_all(path.join(MARKER_DIR))?;
    std::fs::write(marker_path(path), serde_json::to_vec(&marker)?)?;
    Ok(())
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

pub(crate) fn session_dir_create_blocking(
    args: CreateArgs,
) -> Result<CreatedSessionDir, SessionDirError> {
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
