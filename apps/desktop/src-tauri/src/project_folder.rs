use std::path::{Path, PathBuf};

use crate::repo::{init_repo_at, repo_state, InitializedRepo, RepoInitError, RepoState};

const MAX_NAME_LENGTH: usize = 64;

fn is_valid_folder_name(name: &str) -> bool {
    !name.is_empty()
        && name.len() <= MAX_NAME_LENGTH
        && !name.starts_with('.')
        && !name.starts_with('-')
        && !name.ends_with('.')
        && name
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | '.'))
}

fn discard_new_folder(folder: &Path) {
    let _ = std::fs::remove_dir_all(folder);
}

pub(crate) fn create_project_folder(
    parent: &str,
    name: &str,
) -> Result<InitializedRepo, RepoInitError> {
    let name = name.trim();
    if !is_valid_folder_name(name) {
        return Err(RepoInitError::InvalidName(name.to_string()));
    }
    let parent_path = PathBuf::from(parent.trim());
    if !parent_path.is_dir() {
        return Err(RepoInitError::DirNotFound(parent.to_string()));
    }
    let parent_path = std::fs::canonicalize(&parent_path)?;
    match repo_state(&parent_path)? {
        RepoState::Absent => {}
        RepoState::AtRoot => {
            return Err(RepoInitError::NestedRepo(
                parent_path.to_string_lossy().into_owned(),
            ))
        }
        RepoState::Nested(toplevel) => return Err(RepoInitError::NestedRepo(toplevel)),
    }
    let folder = parent_path.join(name);
    if folder.exists() {
        return Err(RepoInitError::AlreadyExists(
            folder.to_string_lossy().into_owned(),
        ));
    }
    std::fs::create_dir(&folder)?;
    match init_repo_at(&folder.to_string_lossy(), None) {
        Ok(initialized) => Ok(initialized),
        Err(error) => {
            discard_new_folder(&folder);
            Err(error)
        }
    }
}

#[tauri::command]
pub async fn project_folder_create(
    parent_path: String,
    name: String,
) -> Result<InitializedRepo, RepoInitError> {
    tauri::async_runtime::spawn_blocking(move || create_project_folder(&parent_path, &name))
        .await
        .map_err(|error| RepoInitError::Io(std::io::Error::other(error.to_string())))?
}

#[cfg(test)]
mod tests;
