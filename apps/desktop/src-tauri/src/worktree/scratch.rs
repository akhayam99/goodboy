use super::error::WorktreeError;
use super::git::{git, resolve_commit};
use super::slug::sanitize_slug;
use std::path::{Path, PathBuf};

#[tauri::command]
pub async fn worktree_scratch_add(
    worktree_path: String,
    sha: String,
    slug: String,
) -> Result<String, WorktreeError> {
    tauri::async_runtime::spawn_blocking(move || {
        worktree_scratch_add_blocking(worktree_path, sha, slug)
    })
    .await
    .map_err(|e| WorktreeError::Io(std::io::Error::other(e.to_string())))?
}

const SCRATCH_PREFIX: &str = "goodboy-check-";

fn scratch_path_of(slug: &str) -> PathBuf {
    std::env::temp_dir().join(format!("{SCRATCH_PREFIX}{}", sanitize_slug(slug)))
}

fn refused_scratch() -> WorktreeError {
    WorktreeError::Git {
        message: "path is not a scratch worktree".to_string(),
    }
}

fn confine_scratch_path(scratch_path: &str) -> Result<(), WorktreeError> {
    let path = Path::new(scratch_path);
    let (Some(parent), Some(name)) = (path.parent(), path.file_name()) else {
        return Err(refused_scratch());
    };
    let is_scratch_name = name
        .to_str()
        .is_some_and(|name| name.len() > SCRATCH_PREFIX.len() && name.starts_with(SCRATCH_PREFIX));
    if !is_scratch_name {
        return Err(refused_scratch());
    }
    let temp = std::fs::canonicalize(std::env::temp_dir())?;
    let canonical_parent = std::fs::canonicalize(parent).map_err(|_| refused_scratch())?;
    if canonical_parent != temp {
        return Err(refused_scratch());
    }
    match std::fs::symlink_metadata(path) {
        Ok(metadata) if !metadata.is_dir() => Err(refused_scratch()),
        _ => Ok(()),
    }
}

fn discard_scratch(cwd: &Path, path: &str) {
    crate::logging::note_failure(
        "scratch worktree remove",
        git(cwd, &["worktree", "remove", "--force", path]),
    );
    if Path::new(path).exists() {
        crate::logging::note_failure("scratch folder delete", std::fs::remove_dir_all(path));
    }
    crate::logging::note_failure("scratch worktree prune", git(cwd, &["worktree", "prune"]));
}

fn worktree_scratch_add_blocking(
    worktree_path: String,
    sha: String,
    slug: String,
) -> Result<String, WorktreeError> {
    let p = Path::new(&worktree_path);
    if !p.exists() {
        return Err(WorktreeError::RepoNotFound(worktree_path));
    }
    let commit = resolve_commit(p, sha.trim())?;
    let dir = scratch_path_of(&slug);
    let dir_path = dir.to_string_lossy().to_string();
    discard_scratch(p, &dir_path);
    git(
        p,
        &["worktree", "add", "--detach", "--quiet", &dir_path, &commit],
    )?;
    Ok(dir_path)
}

#[tauri::command]
pub async fn worktree_scratch_remove(
    worktree_path: String,
    scratch_path: String,
) -> Result<(), WorktreeError> {
    tauri::async_runtime::spawn_blocking(move || {
        worktree_scratch_remove_blocking(worktree_path, scratch_path)
    })
    .await
    .map_err(|e| WorktreeError::Io(std::io::Error::other(e.to_string())))?
}

fn worktree_scratch_remove_blocking(
    worktree_path: String,
    scratch_path: String,
) -> Result<(), WorktreeError> {
    confine_scratch_path(&scratch_path)?;
    let p = Path::new(&worktree_path);
    if !p.exists() {
        return Err(WorktreeError::RepoNotFound(worktree_path));
    }
    discard_scratch(p, &scratch_path);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{
        confine_scratch_path, scratch_path_of, worktree_scratch_remove_blocking, SCRATCH_PREFIX,
    };
    use std::path::PathBuf;

    fn temp_dir_named(name: &str) -> PathBuf {
        std::env::temp_dir().join(format!("{name}-{}", rand::random::<u64>()))
    }

    #[test]
    fn accepts_the_scratch_path_built_from_a_slug() {
        let path = scratch_path_of("harborline-check");
        assert!(confine_scratch_path(&path.to_string_lossy()).is_ok());
    }

    #[test]
    fn refuses_the_filesystem_root_and_the_temp_dir() {
        assert!(confine_scratch_path("/").is_err());
        assert!(confine_scratch_path(&std::env::temp_dir().to_string_lossy()).is_err());
        assert!(confine_scratch_path(&format!(
            "{}/{SCRATCH_PREFIX}",
            std::env::temp_dir().display()
        ))
        .is_err());
    }

    #[test]
    fn refuses_a_project_folder_outside_the_temp_dir() {
        let project = temp_dir_named("northwind-project");
        std::fs::create_dir_all(&project).unwrap();

        assert!(confine_scratch_path(&project.to_string_lossy()).is_err());
        assert!(worktree_scratch_remove_blocking(
            std::env::temp_dir().to_string_lossy().into_owned(),
            project.to_string_lossy().into_owned()
        )
        .is_err());
        assert!(project.exists());
        std::fs::remove_dir_all(project).unwrap();
    }

    #[test]
    fn refuses_a_scratch_name_nested_below_another_folder() {
        let parent = temp_dir_named("acme-parent");
        let nested = parent.join(format!("{SCRATCH_PREFIX}x"));
        std::fs::create_dir_all(&nested).unwrap();

        assert!(confine_scratch_path(&nested.to_string_lossy()).is_err());
        std::fs::remove_dir_all(parent).unwrap();
    }

    #[cfg(unix)]
    #[test]
    fn refuses_a_scratch_name_that_is_a_symlink() {
        let victim = temp_dir_named("cascadia-victim");
        std::fs::create_dir_all(&victim).unwrap();
        let link =
            std::env::temp_dir().join(format!("{SCRATCH_PREFIX}link-{}", rand::random::<u64>()));
        std::os::unix::fs::symlink(&victim, &link).unwrap();

        assert!(confine_scratch_path(&link.to_string_lossy()).is_err());
        assert!(victim.exists());
        std::fs::remove_file(link).unwrap();
        std::fs::remove_dir_all(victim).unwrap();
    }
}
