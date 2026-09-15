use std::path::{Path, PathBuf};

use thiserror::Error;

pub const MAX_EXPORT_BYTES: usize = 8 * 1024 * 1024;

const ALLOWED_EXTENSIONS: [&str; 3] = ["md", "markdown", "txt"];

#[derive(Debug, Error)]
pub enum ArtifactExportError {
    #[error("the artifact has no content to export")]
    Empty,
    #[error("the artifact is larger than the {MAX_EXPORT_BYTES} byte export limit")]
    TooLarge,
    #[error("{0}")]
    Destination(String),
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
}

crate::util::impl_error_serialize!(ArtifactExportError);

impl ArtifactExportError {
    fn kind(&self) -> &'static str {
        match self {
            ArtifactExportError::Empty => "empty",
            ArtifactExportError::TooLarge => "too_large",
            ArtifactExportError::Destination(_) => "destination",
            ArtifactExportError::Io(_) => "io",
        }
    }
}

fn validate_contents(contents: &str) -> Result<(), ArtifactExportError> {
    if contents.trim().is_empty() {
        return Err(ArtifactExportError::Empty);
    }
    if contents.len() > MAX_EXPORT_BYTES {
        return Err(ArtifactExportError::TooLarge);
    }
    Ok(())
}

fn validate_destination(path: &Path) -> Result<(), ArtifactExportError> {
    if !path.is_absolute() {
        return Err(ArtifactExportError::Destination(
            "the destination must be an absolute path".to_string(),
        ));
    }
    if path.is_dir() {
        return Err(ArtifactExportError::Destination(
            "the destination is a directory".to_string(),
        ));
    }
    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .map(str::to_ascii_lowercase)
        .unwrap_or_default();
    if !ALLOWED_EXTENSIONS.contains(&extension.as_str()) {
        return Err(ArtifactExportError::Destination(format!(
            "the destination must end in .md, .markdown or .txt, not .{extension}"
        )));
    }
    let parent = path.parent().ok_or_else(|| {
        ArtifactExportError::Destination("the destination has no folder".to_string())
    })?;
    if !parent.is_dir() {
        return Err(ArtifactExportError::Destination(
            "the destination folder does not exist".to_string(),
        ));
    }
    Ok(())
}

fn temp_sibling(path: &Path) -> PathBuf {
    let name = path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("artifact");
    let parent = path.parent().unwrap_or_else(|| Path::new("."));
    parent.join(format!(".{name}.{}.part", crate::util::uuid_v4()))
}

fn write_atomic(path: &Path, contents: &str) -> Result<(), ArtifactExportError> {
    let temp = temp_sibling(path);
    if let Err(error) = std::fs::write(&temp, contents) {
        let _ = std::fs::remove_file(&temp);
        return Err(ArtifactExportError::Io(error));
    }
    if let Err(error) = std::fs::rename(&temp, path) {
        let _ = std::fs::remove_file(&temp);
        return Err(ArtifactExportError::Io(error));
    }
    Ok(())
}

#[tauri::command]
pub async fn export_artifact_to_file(
    path: String,
    contents: String,
) -> Result<String, ArtifactExportError> {
    validate_contents(&contents)?;
    let destination = PathBuf::from(&path);
    validate_destination(&destination)?;
    write_atomic(&destination, &contents)?;
    Ok(destination.to_string_lossy().into_owned())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn scratch(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("goodboy-artifact-export-{}", uuid()));
        std::fs::create_dir_all(&dir).expect("temp dir");
        dir.join(name)
    }

    fn uuid() -> String {
        crate::util::uuid_v4()
    }

    #[test]
    fn empty_content_is_refused() {
        assert!(matches!(
            validate_contents("   \n "),
            Err(ArtifactExportError::Empty)
        ));
    }

    #[test]
    fn oversized_content_is_refused() {
        let big = "a".repeat(MAX_EXPORT_BYTES + 1);
        assert!(matches!(
            validate_contents(&big),
            Err(ArtifactExportError::TooLarge)
        ));
    }

    #[test]
    fn a_relative_destination_is_refused() {
        let error = validate_destination(Path::new("notes/report.md")).unwrap_err();
        assert_eq!(error.kind(), "destination");
    }

    #[test]
    fn an_unexpected_extension_is_refused() {
        let path = scratch("report.exe");
        let error = validate_destination(&path).unwrap_err();
        assert!(error.to_string().contains(".md"));
    }

    #[test]
    fn a_missing_folder_is_refused() {
        let path = std::env::temp_dir()
            .join(format!("goodboy-missing-{}", uuid()))
            .join("report.md");
        let error = validate_destination(&path).unwrap_err();
        assert!(error.to_string().contains("folder does not exist"));
    }

    #[test]
    fn a_directory_destination_is_refused() {
        let dir = std::env::temp_dir().join(format!("goodboy-dir-{}.md", uuid()));
        std::fs::create_dir_all(&dir).expect("dir");
        let error = validate_destination(&dir).unwrap_err();
        assert!(error.to_string().contains("directory"));
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn the_write_is_atomic_and_leaves_no_temp_file() {
        let path = scratch("report.md");
        write_atomic(&path, "# report\n").expect("write");
        assert_eq!(std::fs::read_to_string(&path).expect("read"), "# report\n");
        let parent = path.parent().expect("parent");
        let leftovers = std::fs::read_dir(parent)
            .expect("read dir")
            .filter_map(|entry| entry.ok())
            .filter(|entry| entry.file_name().to_string_lossy().ends_with(".part"))
            .count();
        assert_eq!(leftovers, 0);
        write_atomic(&path, "# second\n").expect("overwrite");
        assert_eq!(std::fs::read_to_string(&path).expect("read"), "# second\n");
        let _ = std::fs::remove_dir_all(parent);
    }
}
