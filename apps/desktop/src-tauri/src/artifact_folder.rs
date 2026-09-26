use std::path::{Path, PathBuf};

use serde::Deserialize;

use crate::artifacts::{write_atomic, ArtifactExportError, MAX_EXPORT_BYTES};

const FOLDER_EXTENSIONS: [&str; 4] = ["html", "css", "md", "json"];

const MAX_FOLDER_FILES: usize = 64;

const MAX_SEGMENT_LENGTH: usize = 120;

const MAX_PATH_DEPTH: usize = 2;

#[derive(Debug, Deserialize)]
pub struct FolderFile {
    pub path: String,
    pub contents: String,
}

fn destination(message: &str) -> ArtifactExportError {
    ArtifactExportError::Destination(message.to_string())
}

pub(crate) fn is_safe_segment(segment: &str) -> bool {
    !segment.is_empty()
        && segment.len() <= MAX_SEGMENT_LENGTH
        && !segment.starts_with('.')
        && segment
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_' || c == '.')
}

fn validate_parent(parent: &Path) -> Result<(), ArtifactExportError> {
    if !parent.is_absolute() {
        return Err(destination("the destination must be an absolute path"));
    }
    if !parent.is_dir() {
        return Err(destination("the destination folder does not exist"));
    }
    Ok(())
}

fn validate_file_path(path: &str) -> Result<Vec<&str>, ArtifactExportError> {
    let segments: Vec<&str> = path.split('/').collect();
    if segments.len() > MAX_PATH_DEPTH || !segments.iter().all(|s| is_safe_segment(s)) {
        return Err(ArtifactExportError::Destination(format!(
            "{path} is not a plain file name inside the folder"
        )));
    }
    let extension = Path::new(path)
        .extension()
        .and_then(|value| value.to_str())
        .map(str::to_ascii_lowercase)
        .unwrap_or_default();
    if !FOLDER_EXTENSIONS.contains(&extension.as_str()) {
        return Err(ArtifactExportError::Destination(format!(
            "{path} must end in .html, .css, .md or .json"
        )));
    }
    Ok(segments)
}

fn validate_files(files: &[FolderFile]) -> Result<(), ArtifactExportError> {
    if files.is_empty() {
        return Err(ArtifactExportError::Empty);
    }
    if files.len() > MAX_FOLDER_FILES {
        return Err(destination("the folder has too many files"));
    }
    let total: usize = files.iter().map(|file| file.contents.len()).sum();
    if total > MAX_EXPORT_BYTES {
        return Err(ArtifactExportError::TooLarge);
    }
    for file in files {
        if file.contents.trim().is_empty() {
            return Err(ArtifactExportError::Empty);
        }
        validate_file_path(&file.path)?;
    }
    Ok(())
}

pub fn write_folder(
    parent: &Path,
    folder: &str,
    files: &[FolderFile],
) -> Result<PathBuf, ArtifactExportError> {
    validate_parent(parent)?;
    if !is_safe_segment(folder) {
        return Err(destination("the folder name is not a plain name"));
    }
    validate_files(files)?;
    let root = parent.join(folder);
    std::fs::create_dir_all(&root)?;
    for file in files {
        let segments = validate_file_path(&file.path)?;
        let target = segments
            .iter()
            .fold(root.clone(), |path, segment| path.join(segment));
        if let Some(dir) = target.parent() {
            std::fs::create_dir_all(dir)?;
        }
        write_atomic(&target, &file.contents)?;
    }
    Ok(root)
}

#[tauri::command]
pub async fn export_artifact_folder(
    parent: String,
    folder: String,
    files: Vec<FolderFile>,
) -> Result<String, ArtifactExportError> {
    let root = write_folder(Path::new(&parent), &folder, &files)?;
    Ok(root.to_string_lossy().into_owned())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn scratch() -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "goodboy-artifact-folder-{}",
            crate::util::uuid_v4()
        ));
        std::fs::create_dir_all(&dir).expect("temp dir");
        dir
    }

    fn file(path: &str, contents: &str) -> FolderFile {
        FolderFile {
            path: path.to_string(),
            contents: contents.to_string(),
        }
    }

    #[test]
    fn writes_the_files_and_one_nested_folder() {
        let parent = scratch();
        let files = vec![
            file("index.html", "<p>flow</p>"),
            file("screens/sign-in.html", "<p>sign in</p>"),
            file("wireframe.json", "{}"),
        ];
        let root =
            write_folder(&parent, "2026-09-25-settlement-flow-8d21e0", &files).expect("write");
        assert_eq!(
            std::fs::read_to_string(root.join("screens").join("sign-in.html")).expect("read"),
            "<p>sign in</p>"
        );
        assert!(root.join("index.html").is_file());
        let _ = std::fs::remove_dir_all(parent);
    }

    #[test]
    fn refuses_a_path_that_climbs_out() {
        let parent = scratch();
        for path in [
            "../escape.html",
            "screens/../../x.html",
            "/abs.html",
            ".hidden.html",
        ] {
            let error = write_folder(&parent, "flow", &[file(path, "x")]).unwrap_err();
            assert!(error.to_string().contains("plain file name"), "{path}");
        }
        let _ = std::fs::remove_dir_all(parent);
    }

    #[test]
    fn refuses_a_deep_path_and_a_bad_folder_name() {
        let parent = scratch();
        assert!(write_folder(&parent, "flow", &[file("a/b/c.html", "x")]).is_err());
        assert!(write_folder(&parent, "..", &[file("a.html", "x")]).is_err());
        assert!(write_folder(&parent, "a/b", &[file("a.html", "x")]).is_err());
        let _ = std::fs::remove_dir_all(parent);
    }

    #[test]
    fn refuses_an_extension_outside_the_allowlist() {
        let parent = scratch();
        let error = write_folder(&parent, "flow", &[file("run.js", "x")]).unwrap_err();
        assert!(error.to_string().contains(".html"));
        let _ = std::fs::remove_dir_all(parent);
    }

    #[test]
    fn refuses_a_relative_or_missing_parent() {
        assert!(write_folder(Path::new("relative"), "flow", &[file("a.html", "x")]).is_err());
        let missing =
            std::env::temp_dir().join(format!("goodboy-missing-{}", crate::util::uuid_v4()));
        assert!(write_folder(&missing, "flow", &[file("a.html", "x")]).is_err());
    }

    #[test]
    fn refuses_an_oversized_or_empty_folder() {
        let parent = scratch();
        let big = "a".repeat(MAX_EXPORT_BYTES + 1);
        assert!(matches!(
            write_folder(&parent, "flow", &[file("a.html", &big)]),
            Err(ArtifactExportError::TooLarge)
        ));
        assert!(matches!(
            write_folder(&parent, "flow", &[]),
            Err(ArtifactExportError::Empty)
        ));
        let _ = std::fs::remove_dir_all(parent);
    }
}
