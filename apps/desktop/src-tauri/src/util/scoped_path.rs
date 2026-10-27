use std::fs::{self, File};
use std::path::{Component, Path, PathBuf};

#[derive(Debug, thiserror::Error)]
pub(crate) enum ScopedPathError {
    #[error("path escapes the selected root")]
    Escapes,
    #[error("path is unavailable")]
    Unavailable,
    #[error("scoped reads are unavailable on this platform")]
    #[cfg_attr(unix, allow(dead_code))]
    Unsupported,
}

fn has_parent_component(path: &Path) -> bool {
    path.components().any(|part| part == Component::ParentDir)
}

fn canonical_pair(root: &Path, path: &Path) -> Result<(PathBuf, PathBuf), ScopedPathError> {
    if !root.is_absolute() || has_parent_component(root) || has_parent_component(path) {
        return Err(ScopedPathError::Escapes);
    }
    let canonical_root = fs::canonicalize(root).map_err(|_| ScopedPathError::Unavailable)?;
    let canonical_path =
        fs::canonicalize(root.join(path)).map_err(|_| ScopedPathError::Unavailable)?;
    if !canonical_path.starts_with(&canonical_root) {
        return Err(ScopedPathError::Escapes);
    }
    Ok((canonical_root, canonical_path))
}

pub(crate) fn resolve_within(root: &Path, path: &Path) -> Result<PathBuf, ScopedPathError> {
    canonical_pair(root, path).map(|(_, canonical_path)| canonical_path)
}

pub(crate) fn open_within(root: &Path, path: &Path) -> Result<File, ScopedPathError> {
    let (canonical_root, canonical_path) = canonical_pair(root, path)?;
    let relative = canonical_path
        .strip_prefix(&canonical_root)
        .map_err(|_| ScopedPathError::Escapes)?;
    open_relative(&canonical_root, relative)
}

pub(crate) fn open_file_within(root: &Path, path: &Path) -> Result<File, ScopedPathError> {
    match open_within(root, path) {
        Err(ScopedPathError::Unsupported) => {
            let resolved = resolve_within(root, path)?;
            File::open(resolved).map_err(|_| ScopedPathError::Unavailable)
        }
        other => other,
    }
}

#[cfg(unix)]
fn open_relative(root: &Path, relative: &Path) -> Result<File, ScopedPathError> {
    use std::ffi::CString;
    use std::os::fd::{AsRawFd, FromRawFd};
    use std::os::unix::ffi::OsStrExt;
    use std::os::unix::fs::OpenOptionsExt;

    let mut file = fs::OpenOptions::new()
        .read(true)
        .custom_flags(libc::O_DIRECTORY | libc::O_NOFOLLOW)
        .open(root)
        .map_err(|_| ScopedPathError::Unavailable)?;
    let mut parts = relative.components().peekable();
    while let Some(part) = parts.next() {
        let Component::Normal(name) = part else {
            return Err(ScopedPathError::Escapes);
        };
        let name = CString::new(name.as_bytes()).map_err(|_| ScopedPathError::Escapes)?;
        let directory_flag = match parts.peek() {
            Some(_) => libc::O_DIRECTORY,
            None => 0,
        };
        let fd = unsafe {
            libc::openat(
                file.as_raw_fd(),
                name.as_ptr(),
                libc::O_RDONLY
                    | libc::O_CLOEXEC
                    | libc::O_NOFOLLOW
                    | libc::O_NONBLOCK
                    | directory_flag,
            )
        };
        if fd < 0 {
            return Err(ScopedPathError::Unavailable);
        }
        file = unsafe { File::from_raw_fd(fd) };
    }
    Ok(file)
}

#[cfg(not(unix))]
fn open_relative(_root: &Path, _relative: &Path) -> Result<File, ScopedPathError> {
    Err(ScopedPathError::Unsupported)
}

#[cfg(test)]
mod tests {
    use super::{open_within, resolve_within, ScopedPathError};
    use std::fs;
    use std::path::PathBuf;

    struct Fixture(PathBuf);

    impl Fixture {
        fn new() -> Self {
            let root =
                std::env::temp_dir().join(format!("goodboy-scoped-path-{}", rand::random::<u64>()));
            fs::create_dir_all(root.join("out")).unwrap();
            fs::write(root.join("out/file.txt"), b"data").unwrap();
            Self(root)
        }
    }

    impl Drop for Fixture {
        fn drop(&mut self) {
            fs::remove_dir_all(&self.0).unwrap();
        }
    }

    #[test]
    fn resolves_relative_and_absolute_paths_inside_root() {
        let fixture = Fixture::new();
        let expected = fs::canonicalize(fixture.0.join("out/file.txt")).unwrap();
        for path in [
            PathBuf::from("out/file.txt"),
            fixture.0.join("out/file.txt"),
        ] {
            assert_eq!(resolve_within(&fixture.0, &path).unwrap(), expected);
        }
    }

    #[test]
    fn rejects_paths_outside_root() {
        let fixture = Fixture::new();
        let outside = Fixture::new();
        assert!(matches!(
            resolve_within(&fixture.0, &outside.0.join("out/file.txt")),
            Err(ScopedPathError::Escapes)
        ));
    }

    #[test]
    fn rejects_parent_traversal_and_relative_roots() {
        let fixture = Fixture::new();
        assert!(matches!(
            resolve_within(&fixture.0, &PathBuf::from("out/../out/file.txt")),
            Err(ScopedPathError::Escapes)
        ));
        assert!(matches!(
            resolve_within(&PathBuf::from("relative"), &PathBuf::from("out")),
            Err(ScopedPathError::Escapes)
        ));
    }

    #[test]
    fn reports_missing_paths_as_unavailable() {
        let fixture = Fixture::new();
        assert!(matches!(
            resolve_within(&fixture.0, &PathBuf::from("out/missing.txt")),
            Err(ScopedPathError::Unavailable)
        ));
    }

    #[cfg(unix)]
    #[test]
    fn rejects_file_and_directory_symlink_escapes() {
        let fixture = Fixture::new();
        let outside = Fixture::new();
        std::os::unix::fs::symlink(outside.0.join("out/file.txt"), fixture.0.join("escape.txt"))
            .unwrap();
        std::os::unix::fs::symlink(&outside.0, fixture.0.join("escape")).unwrap();
        assert!(resolve_within(&fixture.0, &PathBuf::from("escape.txt")).is_err());
        assert!(open_within(&fixture.0, &PathBuf::from("escape.txt")).is_err());
        assert!(open_within(&fixture.0, &PathBuf::from("escape/out/file.txt")).is_err());
    }

    #[cfg(unix)]
    #[test]
    fn rejects_a_file_swapped_for_an_in_root_symlink_after_canonicalization() {
        let fixture = Fixture::new();
        let root = fs::canonicalize(&fixture.0).unwrap();
        let path = fs::canonicalize(root.join("out/file.txt")).unwrap();
        let relative = path.strip_prefix(&root).unwrap();
        fs::rename(&path, root.join("original.txt")).unwrap();
        std::os::unix::fs::symlink(root.join("original.txt"), &path).unwrap();
        assert!(super::open_relative(&root, relative).is_err());
    }

    #[cfg(unix)]
    #[test]
    fn rejects_a_directory_swapped_for_an_in_root_symlink_after_canonicalization() {
        let fixture = Fixture::new();
        let root = fs::canonicalize(&fixture.0).unwrap();
        let path = fs::canonicalize(root.join("out/file.txt")).unwrap();
        let relative = path.strip_prefix(&root).unwrap();
        fs::rename(root.join("out"), root.join("original")).unwrap();
        std::os::unix::fs::symlink(root.join("original"), root.join("out")).unwrap();
        assert!(super::open_relative(&root, relative).is_err());
    }

    #[cfg(not(unix))]
    #[test]
    fn refuses_strict_opens_on_unsupported_platforms() {
        let fixture = Fixture::new();
        assert!(matches!(
            open_within(&fixture.0, &PathBuf::from("out/file.txt")),
            Err(ScopedPathError::Unsupported)
        ));
    }
}
