use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum SessionDirError {
    #[error("home directory is unavailable")]
    HomeUnavailable,
    #[error("directory path cannot be empty")]
    EmptyPath,
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
}

crate::util::impl_error_serialize!(SessionDirError);

impl SessionDirError {
    fn kind(&self) -> &'static str {
        match self {
            SessionDirError::HomeUnavailable => "home_unavailable",
            SessionDirError::EmptyPath => "empty_path",
            SessionDirError::Io(_) => "io",
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct CreateArgs {
    #[serde(rename = "basePath")]
    pub base_path: String,
    pub slug: String,
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
    Ok(CreatedSessionDir {
        worktree_path: resolved.to_string_lossy().into_owned(),
        branch_name: String::new(),
        slug,
        reused,
    })
}

#[cfg(test)]
mod tests {
    use std::path::Path;

    use super::{session_dir_create, CreateArgs};

    #[test]
    fn creates_and_reuses_a_plain_session_directory() {
        let root = std::env::temp_dir().join(format!(
            "goodboy-simple-session-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let args = || CreateArgs {
            base_path: root.to_string_lossy().into_owned(),
            slug: "Study Plan".to_string(),
        };
        let created = session_dir_create(args()).unwrap();
        assert_eq!(created.branch_name, "");
        assert_eq!(created.slug, "study-plan");
        assert!(!created.reused);
        assert!(Path::new(&created.worktree_path).is_dir());
        let reused = session_dir_create(args()).unwrap();
        assert!(reused.reused);
        std::fs::remove_dir_all(root).unwrap();
    }
}
