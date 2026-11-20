use std::io::Write;
use std::path::{Path, PathBuf};

fn temp_sibling(path: &Path) -> PathBuf {
    let name = path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("file");
    let parent = path.parent().unwrap_or_else(|| Path::new("."));
    parent.join(format!(".{name}.{}.part", super::uuid_v4()))
}

fn write_synced(path: &Path, bytes: &[u8], is_private: bool) -> std::io::Result<()> {
    let mut options = std::fs::OpenOptions::new();
    options.write(true).create_new(true);
    #[cfg(unix)]
    if is_private {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o600);
    }
    #[cfg(not(unix))]
    let _ = is_private;
    let mut file = options.open(path)?;
    file.write_all(bytes)?;
    file.sync_all()
}

pub(crate) fn write_atomic(path: &Path, bytes: &[u8]) -> std::io::Result<()> {
    replace_with(path, bytes, false)
}

pub(crate) fn write_atomic_private(path: &Path, bytes: &[u8]) -> std::io::Result<()> {
    replace_with(path, bytes, true)
}

fn replace_with(path: &Path, bytes: &[u8], is_private: bool) -> std::io::Result<()> {
    let temp = temp_sibling(path);
    if let Err(error) = write_synced(&temp, bytes, is_private) {
        let _ = std::fs::remove_file(&temp);
        return Err(error);
    }
    if let Err(error) = std::fs::rename(&temp, path) {
        let _ = std::fs::remove_file(&temp);
        return Err(error);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn scratch() -> PathBuf {
        let dir = std::env::temp_dir().join(format!("goodboy-atomic-{}", super::super::uuid_v4()));
        std::fs::create_dir_all(&dir).expect("scratch dir");
        dir
    }

    fn leftovers(dir: &Path) -> usize {
        std::fs::read_dir(dir)
            .expect("read dir")
            .filter_map(|entry| entry.ok())
            .filter(|entry| entry.file_name().to_string_lossy().ends_with(".part"))
            .count()
    }

    #[test]
    fn the_write_replaces_the_file_and_leaves_no_temp_file() {
        let dir = scratch();
        let path = dir.join("report.md");
        write_atomic(&path, b"# report\n").expect("write");
        assert_eq!(std::fs::read_to_string(&path).expect("read"), "# report\n");
        write_atomic(&path, b"# second\n").expect("overwrite");
        assert_eq!(std::fs::read_to_string(&path).expect("read"), "# second\n");
        assert_eq!(leftovers(&dir), 0);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn a_failed_rename_keeps_the_old_file_and_removes_the_temp_file() {
        let dir = scratch();
        let path = dir.join("taken");
        std::fs::create_dir_all(path.join("inside")).expect("a folder in the way");
        assert!(write_atomic(&path, b"new").is_err());
        assert!(path.join("inside").is_dir());
        assert_eq!(leftovers(&dir), 0);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[cfg(unix)]
    #[test]
    fn a_private_write_is_owner_only_from_the_first_byte() {
        use std::os::unix::fs::PermissionsExt;
        let dir = scratch();
        let path = dir.join("identity.json");
        write_atomic_private(&path, b"{}").expect("write");
        let mode = std::fs::metadata(&path).expect("stat").permissions().mode();
        assert_eq!(mode & 0o777, 0o600);
        assert_eq!(leftovers(&dir), 0);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn a_missing_folder_fails_without_creating_it() {
        let dir = scratch();
        let path = dir.join("missing").join("file.json");
        assert!(write_atomic(&path, b"{}").is_err());
        assert!(!dir.join("missing").exists());
        let _ = std::fs::remove_dir_all(&dir);
    }
}
