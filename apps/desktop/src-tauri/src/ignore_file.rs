use std::fs;
use std::io::ErrorKind;
use std::path::{Path, PathBuf};

pub(crate) const GOODBOY_IGNORE_ENTRY: &str = "/.goodboy/";

const GOODBOY_SPELLINGS: [&str; 4] = [".goodboy/", "/.goodboy/", ".goodboy", "/.goodboy"];

#[derive(Debug, thiserror::Error)]
pub(crate) enum IgnoreWriteError {
    #[error("the ignore file is read only, so Goodboy left it alone")]
    ReadOnly,
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
}

pub(crate) fn is_goodboy_entry(line: &[u8]) -> bool {
    let trimmed = line.trim_ascii();
    GOODBOY_SPELLINGS
        .iter()
        .any(|spelling| spelling.as_bytes() == trimmed)
}

fn is_same_entry(entry: &str, line: &[u8]) -> bool {
    match is_goodboy_entry(entry.as_bytes()) {
        true => is_goodboy_entry(line),
        false => line.trim_ascii() == entry.as_bytes(),
    }
}

fn real_path(path: &Path) -> Result<PathBuf, IgnoreWriteError> {
    let is_link = fs::symlink_metadata(path)
        .map(|meta| meta.file_type().is_symlink())
        .unwrap_or(false);
    match is_link {
        true => Ok(fs::canonicalize(path)?),
        false => Ok(path.to_path_buf()),
    }
}

fn read_bytes(path: &Path) -> Result<Vec<u8>, IgnoreWriteError> {
    match fs::read(path) {
        Ok(bytes) => Ok(bytes),
        Err(error) if error.kind() == ErrorKind::NotFound => Ok(Vec::new()),
        Err(error) => Err(IgnoreWriteError::Io(error)),
    }
}

pub(crate) fn write_atomic(path: &Path, bytes: &[u8]) -> Result<(), IgnoreWriteError> {
    let target = real_path(path)?;
    let existing = fs::metadata(&target).ok();
    if existing
        .as_ref()
        .is_some_and(|meta| meta.permissions().readonly())
    {
        return Err(IgnoreWriteError::ReadOnly);
    }
    let parent = target
        .parent()
        .ok_or_else(|| std::io::Error::other("the ignore file has no folder"))?;
    fs::create_dir_all(parent)?;
    let temp = parent.join(format!(".gb-ignore-{}.tmp", crate::util::uuid_v4()));
    fs::write(&temp, bytes)?;
    if let Some(meta) = &existing {
        if let Err(error) = fs::set_permissions(&temp, meta.permissions()) {
            let _ = fs::remove_file(&temp);
            return Err(IgnoreWriteError::Io(error));
        }
    }
    if let Err(error) = fs::rename(&temp, &target) {
        let _ = fs::remove_file(&temp);
        return Err(IgnoreWriteError::Io(error));
    }
    Ok(())
}

pub(crate) fn append_ignore_entries(
    path: &Path,
    entries: &[&str],
) -> Result<bool, IgnoreWriteError> {
    let mut bytes = read_bytes(&real_path(path)?)?;
    let mut is_added = false;
    for entry in entries {
        let is_present = bytes
            .split(|byte| *byte == b'\n')
            .any(|line| is_same_entry(entry, line));
        if is_present {
            continue;
        }
        if !bytes.is_empty() && bytes.last() != Some(&b'\n') {
            bytes.push(b'\n');
        }
        bytes.extend_from_slice(entry.as_bytes());
        bytes.push(b'\n');
        is_added = true;
    }
    if !is_added {
        return Ok(false);
    }
    write_atomic(path, &bytes)?;
    Ok(true)
}

pub(crate) fn remove_goodboy_entries(path: &Path) -> Result<bool, IgnoreWriteError> {
    let existing = match fs::read(real_path(path)?) {
        Ok(bytes) => bytes,
        Err(error) if error.kind() == ErrorKind::NotFound => return Ok(false),
        Err(error) => return Err(IgnoreWriteError::Io(error)),
    };
    let mut kept: Vec<u8> = Vec::with_capacity(existing.len());
    for line in existing.split_inclusive(|byte| *byte == b'\n') {
        if is_goodboy_entry(line) {
            continue;
        }
        kept.extend_from_slice(line);
    }
    if kept == existing {
        return Ok(false);
    }
    write_atomic(path, &kept)?;
    Ok(true)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_dir(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "goodboy-ignore-file-{name}-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn the_goodboy_entry_is_recognised_in_every_spelling() {
        for spelling in [
            ".goodboy/",
            "/.goodboy/",
            ".goodboy",
            "/.goodboy",
            "  /.goodboy/  ",
        ] {
            assert!(is_goodboy_entry(spelling.as_bytes()), "{spelling}");
        }
        for other in ["goodboy/", ".goodboy-old/", "/sessions/", ""] {
            assert!(!is_goodboy_entry(other.as_bytes()), "{other}");
        }
    }

    #[test]
    fn an_entry_is_added_once_after_the_existing_lines() {
        let dir = temp_dir("append");
        let path = dir.join(".gitignore");
        fs::write(&path, "node_modules/").unwrap();

        assert!(append_ignore_entries(&path, &[GOODBOY_IGNORE_ENTRY]).unwrap());
        assert!(!append_ignore_entries(&path, &[GOODBOY_IGNORE_ENTRY]).unwrap());

        assert_eq!(
            fs::read_to_string(&path).unwrap(),
            "node_modules/\n/.goodboy/\n"
        );
        fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn an_older_spelling_of_the_entry_is_not_added_twice() {
        let dir = temp_dir("spelling");
        let path = dir.join(".gitignore");
        fs::write(&path, "/.goodboy\n").unwrap();

        assert!(!append_ignore_entries(&path, &[GOODBOY_IGNORE_ENTRY]).unwrap());

        assert_eq!(fs::read_to_string(&path).unwrap(), "/.goodboy\n");
        fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn a_file_that_is_not_utf_8_keeps_every_byte() {
        let dir = temp_dir("bytes");
        let path = dir.join(".gitignore");
        let original: Vec<u8> = b"caf\xe9/\nnotes.txt".to_vec();
        fs::write(&path, &original).unwrap();

        assert!(append_ignore_entries(&path, &["/sessions/"]).unwrap());

        let mut expected = original;
        expected.extend_from_slice(b"\n/sessions/\n");
        assert_eq!(fs::read(&path).unwrap(), expected);
        fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn a_file_that_cannot_be_read_is_never_replaced() {
        let dir = temp_dir("unreadable");
        let path = dir.join(".gitignore");
        fs::create_dir_all(&path).unwrap();

        let result = append_ignore_entries(&path, &[GOODBOY_IGNORE_ENTRY]);

        assert!(matches!(result, Err(IgnoreWriteError::Io(_))));
        assert!(path.is_dir());
        fs::remove_dir_all(dir).unwrap();
    }

    #[cfg(unix)]
    #[test]
    fn a_read_only_file_is_refused_and_keeps_its_content() {
        use std::os::unix::fs::PermissionsExt;
        let dir = temp_dir("readonly");
        let path = dir.join(".gitignore");
        fs::write(&path, "target/\n").unwrap();
        fs::set_permissions(&path, fs::Permissions::from_mode(0o444)).unwrap();

        let result = append_ignore_entries(&path, &[GOODBOY_IGNORE_ENTRY]);

        assert!(matches!(result, Err(IgnoreWriteError::ReadOnly)));
        assert_eq!(fs::read_to_string(&path).unwrap(), "target/\n");
        fs::set_permissions(&path, fs::Permissions::from_mode(0o644)).unwrap();
        fs::remove_dir_all(dir).unwrap();
    }

    #[cfg(unix)]
    #[test]
    fn a_linked_dotfile_is_written_through_and_stays_a_link() {
        let dir = temp_dir("link");
        let real = dir.join("dotfiles-ignore");
        let link = dir.join("global-ignore");
        fs::write(&real, "*.log\n").unwrap();
        std::os::unix::fs::symlink(&real, &link).unwrap();

        assert!(append_ignore_entries(&link, &[GOODBOY_IGNORE_ENTRY]).unwrap());

        assert!(fs::symlink_metadata(&link)
            .unwrap()
            .file_type()
            .is_symlink());
        assert_eq!(fs::read_to_string(&real).unwrap(), "*.log\n/.goodboy/\n");
        fs::remove_dir_all(dir).unwrap();
    }

    #[cfg(unix)]
    #[test]
    fn a_link_to_nowhere_is_never_replaced_by_a_file() {
        let dir = temp_dir("dangling");
        let link = dir.join(".gitignore");
        std::os::unix::fs::symlink(dir.join("missing").join("target"), &link).unwrap();

        let result = append_ignore_entries(&link, &[GOODBOY_IGNORE_ENTRY]);

        assert!(matches!(result, Err(IgnoreWriteError::Io(_))));
        assert!(fs::symlink_metadata(&link)
            .unwrap()
            .file_type()
            .is_symlink());
        fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn removing_the_entry_keeps_the_other_lines_and_their_bytes() {
        let dir = temp_dir("remove");
        let path = dir.join("exclude");
        fs::write(&path, b"caf\xe9\n.goodboy/\nlogs/\n/.goodboy\n").unwrap();

        assert!(remove_goodboy_entries(&path).unwrap());

        assert_eq!(fs::read(&path).unwrap(), b"caf\xe9\nlogs/\n".to_vec());
        assert!(!remove_goodboy_entries(&path).unwrap());
        fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn removing_from_a_missing_file_is_nothing_to_do() {
        let dir = temp_dir("remove-missing");

        assert!(!remove_goodboy_entries(&dir.join("exclude")).unwrap());
        fs::remove_dir_all(dir).unwrap();
    }
}
